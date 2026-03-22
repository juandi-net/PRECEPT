import type { EngineContext } from './types.js';
import type { ReviewerService } from '../../services/reviewer.js';
import type { JudgeService } from '../../services/judge.js';
import type { CEOService } from '../../services/ceo.js';
import { getTask, incrementPolishCount, getTransitions } from '../../db/tasks.js';
import { applyTransition } from '../state-machine.js';
import { logEvent } from '../../db/audit.js';
import { logMessage } from '../../db/messages.js';
import { logSkillEvent } from '../../db/skill-events.js';
import { embedText, embedTexts } from '../../lib/embeddings.js';
import { storeRoleMemory } from '../../db/role-memory.js';
import { fireLinearAcceptMirror } from '../../lib/linear.js';
import { updateProfileAfterReview } from '../../db/agent-profiles.js';
import { addBulletinEntry } from '../../db/team-bulletin.js';
import { logLesson } from '../../db/decisions.js';
import { markCredentialVerified } from '../../db/credentials.js';
import { roleRegistry } from '../../config/role-registry.js';

const MAX_REWORK_ATTEMPTS = 3;

export class EvaluationHandlers {
  private curatorFastPathCooldown: Map<string, number> = new Map();
  private static CURATOR_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

  constructor(
    private ctx: EngineContext,
    private reviewer: ReviewerService,
    private judge: JudgeService,
    private ceo: CEOService,
  ) {}

  async handleReviewVerdict(orgId: string, taskId: string): Promise<void> {
    const start = Date.now();
    const verdict = await this.reviewer.evaluate(taskId);

    logMessage({
      org_id: orgId,
      from_role: 'reviewer',
      from_agent_id: 'Reviewer-1',
      to_role: 'dispatcher',
      message_type: 'review_verdict',
      payload: { taskId, verdict: verdict.verdict },
    });

    if (verdict.verdict === 'POLISH') {
      await applyTransition(taskId, 'POLISH', 'Reviewer-1', verdict.feedback);

      // Check polish-specific rework limit (separate from judge revision_count)
      const polishCount = await incrementPolishCount(taskId);
      if (polishCount >= MAX_REWORK_ATTEMPTS) {
        console.log(`[engine] review done — POLISH but max rework attempts (${MAX_REWORK_ATTEMPTS}) reached for task ${taskId.slice(0, 8)}, escalating`);
        await applyTransition(taskId, 'REVIEW', 'Engine', 'max polish attempts reached');
        await applyTransition(taskId, 'JUDGMENT', 'Engine', 'forced to judgment after max polish');
        await applyTransition(taskId, 'ESCALATED', 'Engine', `exceeded ${MAX_REWORK_ATTEMPTS} rework attempts`);
        this.ctx.push({ type: 'escalation', orgId, taskId });
        logEvent(orgId, 'review.verdict', 'Engine', { taskId, verdict: 'POLISH', escalated: true, polishCount });
        return;
      }

      // Worker rework with reviewer feedback
      const task = await getTask(taskId);
      if (!task) return;

      try {
        await this.ctx.runWorker(task, orgId, { type: 'rework', feedback: verdict.feedback, source: 'reviewer' });
        // Transition POLISH → REVIEW and re-invoke reviewer
        await applyTransition(taskId, 'REVIEW', 'Engine', 'rework complete, re-reviewing');
        this.ctx.push({ type: 'review_verdict', orgId, taskId });
      } catch (err) {
        console.error(`[worker] rework failed for task ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
        // Failed rework — transition through to FAILED
        try {
          await applyTransition(taskId, 'REVIEW', 'Engine', 'rework failed');
          await applyTransition(taskId, 'JUDGMENT', 'Engine', 'rework failed — escalating');
          await applyTransition(taskId, 'ESCALATED', 'Engine', 'worker rework error');
          this.ctx.push({ type: 'escalation', orgId, taskId });
        } catch { /* transition may fail if state already changed */ }
      }

      console.log(`[engine] review done — verdict: POLISH for task ${taskId.slice(0, 8)}, polish #${polishCount} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'review.verdict', 'Engine', { taskId, verdict: 'POLISH', polishCount });

      // Update agent profile with POLISH verdict (fire-and-forget)
      this.fireProfileUpdate(orgId, taskId, verdict);
      return;
    }

    // GOOD or EXCELLENT → proceed to judgment
    console.log(`[engine] review done — verdict: ${verdict.verdict} for task ${taskId.slice(0, 8)} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    await applyTransition(taskId, 'JUDGMENT', 'Reviewer-1', `review passed: ${verdict.verdict}`);
    this.ctx.push({ type: 'judge_verdict', orgId, taskId });

    // Store reviewer craft pattern in role memory (fire-and-forget)
    const craftContent = verdict.verdict === 'EXCELLENT'
      ? `${verdict.commendation}\n${verdict.notes}`
      : verdict.notes;
    if (craftContent.trim().length >= 10) {
      this.storeCraftPattern(orgId, taskId, craftContent, verdict.verdict === 'EXCELLENT' ? 'high' : 'medium').catch(err =>
        console.error(`[engine] craft_pattern storage failed for ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`));
    }

    // Update agent profile with GOOD/EXCELLENT verdict (fire-and-forget)
    this.fireProfileUpdate(orgId, taskId, verdict);
  }

  async handleJudgeVerdict(orgId: string, taskId: string): Promise<void> {
    const start = Date.now();
    const verdict = await this.judge.evaluate(taskId);

    logMessage({
      org_id: orgId,
      from_role: 'judge',
      from_agent_id: 'Judge-1',
      to_role: 'dispatcher',
      message_type: 'judge_verdict',
      payload: { taskId, verdict: verdict.verdict },
    });

    if (verdict.verdict === 'ACCEPT') {
      await applyTransition(taskId, 'ACCEPTED', 'Judge-1', verdict.assessment);
      const taskForCleanup = await getTask(taskId);
      if (taskForCleanup) this.ctx.cleanupWorkspaceIfNeeded(taskForCleanup);
      await this.ctx.dispatchReadyTasks(orgId, taskId);

      // Linear mirror — fire-and-forget
      fireLinearAcceptMirror(orgId, taskId, 'Judge-1');

      console.log(`[engine] judge done — verdict: ACCEPT for task ${taskId.slice(0, 8)} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'judge.verdict', 'Engine', { taskId, verdict: 'ACCEPT' });

      // Log skill correlation
      const acceptedForSkills = await getTask(taskId);
      if (acceptedForSkills?.skills_loaded?.length) {
        for (const skillName of acceptedForSkills.skills_loaded) {
          logSkillEvent({ orgId, skillName, eventType: 'correlated_accept', metadata: { taskId, verdict: 'ACCEPT', taskRole: acceptedForSkills.role } });
        }
      }

      // Store key findings in role memory (fire-and-forget — embedding is async)
      this.storeAcceptedFindings(orgId, taskId).catch(err =>
        console.error(`[engine] role-memory storage failed for ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`));

      // Team bulletin — one-line summary for cross-role awareness (fire-and-forget)
      const taskForBulletin = await getTask(taskId);
      if (taskForBulletin) {
        const title = taskForBulletin.spec.title ?? taskForBulletin.spec.description.slice(0, 60);
        const outputSnippet = taskForBulletin.output?.output?.slice(0, 80) ?? '';
        const summary = outputSnippet ? `${title} — ${outputSnippet}` : title;
        addBulletinEntry({
          orgId,
          taskId,
          role: taskForBulletin.role,
          summary: summary.slice(0, 120),
        }).catch(err =>
          console.error(`[engine] bulletin entry failed for ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`));
      }

      // Auto-mark credentials as verified — if a task using them was accepted, they work (fire-and-forget)
      const acceptedTask = await getTask(taskId);
      const reqCreds = (acceptedTask?.spec as { required_credentials?: string[] })?.required_credentials;
      if (reqCreds?.length) {
        for (const key of reqCreds) {
          markCredentialVerified(orgId, key).catch(err =>
            console.error(`[engine] credential verification mark failed for '${key}': ${err instanceof Error ? err.message : String(err)}`));
        }
      }
      // CEO task-completion triage
      this.ctx.push({ type: 'task_terminal', orgId, taskId });
      return;
    }

    if (verdict.verdict === 'REVISE') {
      // applyTransition handles auto-ESCALATE if revision_count >= 2
      const actualState = await applyTransition(taskId, 'REVISION', 'Judge-1', verdict.feedback);

      if (actualState === 'ESCALATED') {
        console.log(`[engine] judge done — verdict: REVISE → auto-escalated for task ${taskId.slice(0, 8)} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
        this.ctx.push({ type: 'escalation', orgId, taskId });
        logEvent(orgId, 'judge.verdict', 'Engine', { taskId, verdict: 'REVISE', escalated: true });
      } else {
        // REVISION → worker rework → REVIEW → full review/judge cycle
        const task = await getTask(taskId);
        if (!task) return;

        try {
          await this.ctx.runWorker(task, orgId, { type: 'rework', feedback: verdict.feedback, source: 'judge' });
          await applyTransition(taskId, 'REVIEW', 'Engine', 'rework complete, re-reviewing');
          this.ctx.push({ type: 'review_verdict', orgId, taskId });
        } catch (err) {
          console.error(`[worker] rework failed for task ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
          try {
            await applyTransition(taskId, 'REVIEW', 'Engine', 'rework failed');
            await applyTransition(taskId, 'JUDGMENT', 'Engine', 'rework failed — escalating');
            await applyTransition(taskId, 'ESCALATED', 'Engine', 'worker rework error');
            this.ctx.push({ type: 'escalation', orgId, taskId });
          } catch { /* transition may fail if state already changed */ }
        }

        console.log(`[engine] judge done — verdict: REVISE for task ${taskId.slice(0, 8)} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
        logEvent(orgId, 'judge.verdict', 'Engine', { taskId, verdict: 'REVISE' });

        // Log skill correlation for revision
        const revisedTask = await getTask(taskId);
        if (revisedTask?.skills_loaded?.length) {
          for (const skillName of revisedTask.skills_loaded) {
            logSkillEvent({ orgId, skillName, eventType: 'correlated_reject', metadata: { taskId, verdict: 'REVISE', taskRole: revisedTask.role } });
          }
        }
      }
      return;
    }

    // ESCALATE
    console.log(`[engine] judge done — verdict: ESCALATE for task ${taskId.slice(0, 8)} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    await applyTransition(taskId, 'ESCALATED', 'Judge-1', verdict.reason);
    const taskForCleanup2 = await getTask(taskId);
    if (taskForCleanup2) this.ctx.cleanupWorkspaceIfNeeded(taskForCleanup2);
    this.ctx.push({ type: 'escalation', orgId, taskId });
    logEvent(orgId, 'judge.verdict', 'Engine', { taskId, verdict: 'ESCALATE' });

    // Log skill correlation for escalation
    if (taskForCleanup2?.skills_loaded?.length) {
      for (const skillName of taskForCleanup2.skills_loaded) {
        logSkillEvent({ orgId, skillName, eventType: 'correlated_reject', metadata: { taskId, verdict: 'ESCALATE', taskRole: taskForCleanup2.role } });
      }
    }
  }

  async handleTaskTerminal(orgId: string, taskId: string): Promise<void> {
    const start = Date.now();
    console.log(`[ceo] starting task-completion triage for task ${taskId.slice(0, 8)}...`);
    try {
      await this.ceo.handleTaskCompletion(orgId, taskId,
        // onDispatch — push dispatch_task event to the queue
        (createdTaskId) => { this.ctx.push({ type: 'dispatch_task', orgId, taskId: createdTaskId }); },
        // onAdhocPlan — trigger ad-hoc planning
        () => { this.ctx.push({ type: 'adhoc_planning', orgId, ownerInput: '[CEO-initiated from task completion]' }); },
        // onResolveAccepted — push task_terminal for the resolved task
        (resolvedTaskId) => { this.ctx.push({ type: 'task_terminal', orgId, taskId: resolvedTaskId }); },
      );
      console.log(`[ceo] task-completion triage done for ${taskId.slice(0, 8)} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    } catch (err) {
      console.error(`[ceo] task-completion triage failed for ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async handleEscalation(orgId: string, taskId: string): Promise<void> {
    const start = Date.now();
    console.log(`[ceo] starting escalation diagnosis for task ${taskId.slice(0, 8)}...`);
    try {
      const diagnosis = await this.ceo.handleEscalation(taskId);
      console.log(`[ceo] escalation done — diagnosis: ${diagnosis.type} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'task.escalated', 'Engine', { taskId, diagnosisType: diagnosis.type });

      // Store lesson from escalation diagnosis (fire-and-forget)
      const escalatedTask = await getTask(taskId);
      if (escalatedTask) {
        getTransitions(taskId).then(transitions => {
          const lastJudgeFeedback = transitions
            .filter(t => t.agent_id.startsWith('Judge') && t.reason)
            .pop()?.reason ?? 'no judge feedback';
          return logLesson({
            orgId,
            initiativeId: escalatedTask.initiative_id ?? undefined,
            whatTried: escalatedTask.spec.description,
            whatHappened: `Escalated: ${lastJudgeFeedback}`,
            whatLearned: diagnosis.reasoning,
          });
        }).catch(err =>
          console.error(`[engine] lesson storage failed for ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`));
      }

      // Curator fast-path: if spec_problem rooted in loaded skills, trigger early Curator cycle
      if (
        diagnosis.type === 'spec_problem' &&
        escalatedTask?.skills_loaded?.length
      ) {
        const cooldownKey = `${orgId}:${[...escalatedTask.skills_loaded].sort().join(',')}`;
        const lastTriggered = this.curatorFastPathCooldown.get(cooldownKey) ?? 0;
        const now = Date.now();

        if (now - lastTriggered < EvaluationHandlers.CURATOR_COOLDOWN_MS) {
          console.log(`[engine] Curator fast-path on cooldown for ${cooldownKey}, skipping`);
        } else {
          this.curatorFastPathCooldown.set(cooldownKey, now);
          console.log(`[engine] skill-rooted spec_problem — triggering Curator fast-path`);
          this.ctx.push({ type: 'curator_cycle', orgId });
          logEvent(orgId, 'curator.fast_path', 'Engine', {
            taskId,
            diagnosis: diagnosis.type,
            skills: escalatedTask.skills_loaded,
          });
        }
      }

      // Owner notification for escalated tasks is now handled by headlines on The Interface
    } catch (err) {
      console.error(`[ceo] escalation failed for task ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
      logEvent(orgId, 'task.escalated', 'Engine', { taskId, error: 'escalation handler not yet implemented' });
    }
  }

  /** Update agent profile after a reviewer verdict (fire-and-forget). */
  private fireProfileUpdate(orgId: string, taskId: string, verdict: { verdict: 'POLISH'; feedback: string } | { verdict: 'GOOD'; notes: string } | { verdict: 'EXCELLENT'; commendation: string; notes: string }): void {
    getTask(taskId).then(async (task) => {
      if (!task?.assigned_worker) return;
      const model = await roleRegistry.getModel(orgId, 'worker').catch(() => 'unknown');
      const craftNote = verdict.verdict === 'EXCELLENT'
        ? verdict.commendation
        : verdict.verdict === 'POLISH'
          ? verdict.feedback
          : verdict.notes;
      await updateProfileAfterReview({
        orgId,
        agentId: task.assigned_worker,
        role: task.role,
        model,
        verdictType: verdict.verdict,
        craftNote: craftNote ?? null,
      });
    }).catch(err =>
      console.error(`[engine] agent profile update failed for ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`));
  }

  /** Store accepted task's key_findings as role memory entries (fire-and-forget). */
  private async storeAcceptedFindings(orgId: string, taskId: string): Promise<void> {
    const task = await getTask(taskId);
    if (!task?.output?.key_findings?.length) return;

    const findings = task.output.key_findings;
    const embeddings = await embedTexts(findings, 'document');

    for (let i = 0; i < findings.length; i++) {
      await storeRoleMemory({
        orgId,
        role: task.role,
        content: findings[i],
        embedding: embeddings[i],
        sourceTaskId: task.id,
        confidence: task.output.confidence,
        entryType: 'finding',
      });
    }

    console.log(`[engine] stored ${findings.length} key_findings in role_memory for task ${taskId.slice(0, 8)}`);
  }

  /** Store a reviewer craft pattern observation as role memory (fire-and-forget). */
  private async storeCraftPattern(
    orgId: string,
    taskId: string,
    content: string,
    confidence: 'high' | 'medium',
  ): Promise<void> {
    const task = await getTask(taskId);
    if (!task) return;

    const embedding = await embedText(content, 'document');
    await storeRoleMemory({
      orgId,
      role: task.role,
      content,
      embedding,
      sourceTaskId: taskId,
      confidence,
      entryType: 'craft_pattern',
    });

    console.log(`[engine] stored craft_pattern in role_memory for task ${taskId.slice(0, 8)}`);
  }
}
