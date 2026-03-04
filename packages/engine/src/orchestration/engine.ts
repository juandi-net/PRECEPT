/**
 * OrchestrationEngine — sequential event queue that processes
 * domain events one at a time. Events pushed during processing
 * are queued and handled after the current event completes.
 */

import { CEOService } from '../services/ceo.js';
import { AdvisorService } from '../services/advisor.js';
import { DispatcherService } from '../services/dispatcher.js';
import { WorkerService } from '../services/worker.js';
import { ReviewerService } from '../services/reviewer.js';
import { JudgeService } from '../services/judge.js';
import { ScribeService } from '../services/scribe.js';
import { getTask, getTasksByPlan, getTasksByState } from '../db/tasks.js';
import { approvePlan } from '../db/plans.js';
import { logOwnerFeedback } from '../db/owner-feedback.js';
import { applyTransition } from './state-machine.js';
import { getDispatchableTasks, checkPhaseCompletion } from './dependency.js';
import { logEvent } from '../db/audit.js';
import { logMessage } from '../db/messages.js';

export type EngineEvent =
  | { type: 'planning_cycle'; orgId: string }
  | { type: 'briefing_cycle'; orgId: string }
  | { type: 'plan_approved'; orgId: string; planId: string }
  | { type: 'task_completed'; orgId: string; taskId: string }
  | { type: 'review_verdict'; orgId: string; taskId: string }
  | { type: 'judge_verdict'; orgId: string; taskId: string }
  | { type: 'escalation'; orgId: string; taskId: string }
  | { type: 'phase_completed'; orgId: string; initiativeId: string; phase: number }
  | { type: 'owner_reply'; orgId: string; briefingId: string; content: string }
  | { type: 'memory_cleanup'; orgId: string };

export class OrchestrationEngine {
  private queue: EngineEvent[] = [];
  private processing = false;

  private ceo = new CEOService();
  private advisor = new AdvisorService();
  private dispatcher = new DispatcherService();
  private worker = new WorkerService();
  private reviewer = new ReviewerService();
  private judge = new JudgeService();
  private scribe = new ScribeService();

  /** Enqueue an event and start draining if not already running. */
  push(event: EngineEvent): void {
    this.queue.push(event);
    if (!this.processing) {
      this.drain();
    }
  }

  /** Override in subclass or mock in tests to handle events. */
  async handleEvent(event: EngineEvent): Promise<void> {
    switch (event.type) {
      case 'planning_cycle':
        return this.handlePlanningCycle(event.orgId);
      case 'briefing_cycle':
        return this.handleBriefingCycle(event.orgId);
      case 'plan_approved':
        return this.handlePlanApproved(event.orgId, event.planId);
      case 'task_completed':
        return this.handleTaskCompleted(event.orgId, event.taskId);
      case 'review_verdict':
        return this.handleReviewVerdict(event.orgId, event.taskId);
      case 'judge_verdict':
        return this.handleJudgeVerdict(event.orgId, event.taskId);
      case 'escalation':
        return this.handleEscalation(event.orgId, event.taskId);
      case 'owner_reply':
        return this.handleOwnerReply(event.orgId, event.content);
      default:
        console.log(`[engine] unhandled event: ${event.type}`);
    }
  }

  // --- Recovery ---

  async recoverFromRestart(orgId: string): Promise<void> {
    const start = Date.now();
    console.log('[engine] starting recovery scan...');
    const timeoutMs = parseInt(process.env.TASK_TIMEOUT_MS ?? '600000', 10);
    const now = Date.now();

    // QUEUED tasks → re-dispatch
    const queued = await getTasksByState(orgId, 'QUEUED');
    for (const task of queued) {
      logEvent(orgId, 'task.transition', 'Engine', { taskId: task.id, recovery: 'QUEUED → re-dispatch' });
      // Push plan_approved won't work (it expects PLANNED tasks).
      // Transition QUEUED → DISPATCHED → IN_PROGRESS manually.
      try {
        await applyTransition(task.id, 'DISPATCHED', 'Engine', 'recovery re-dispatch');
        await applyTransition(task.id, 'IN_PROGRESS', 'Engine', 'recovery worker starting');
        const output = await this.worker.execute(task);
        this.push({ type: 'task_completed', orgId, taskId: task.id });
        if (output.flag) {
          logMessage({
            org_id: orgId,
            from_role: 'worker',
            from_agent_id: task.assigned_worker ?? 'Worker-1',
            to_role: 'ceo',
            message_type: 'flag',
            payload: { taskId: task.id, flag: output.flag },
          });
        }
      } catch (err) {
        console.error(`[engine] recovery worker failed for task ${task.id}: ${err instanceof Error ? err.message : String(err)}`);
        try { await applyTransition(task.id, 'FAILED', 'Engine', 'recovery worker error'); } catch { /* ignore */ }
      }
    }

    // DISPATCHED / IN_PROGRESS → check timeout
    const dispatched = await getTasksByState(orgId, 'DISPATCHED');
    const inProgress = await getTasksByState(orgId, 'IN_PROGRESS');
    for (const task of [...dispatched, ...inProgress]) {
      const updatedAt = task.updated_at ? new Date(task.updated_at).getTime() : new Date(task.created_at).getTime();
      if (now - updatedAt > timeoutMs) {
        try {
          await applyTransition(task.id, 'FAILED', 'Engine', 'recovery timeout');
        } catch (err) {
          console.error(`[engine] recovery transition failed for task ${task.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
        logEvent(orgId, 'task.transition', 'Engine', { taskId: task.id, recovery: 'timeout → FAILED' });
      }
    }

    // REVIEW with no subsequent action → re-invoke reviewer
    const inReview = await getTasksByState(orgId, 'REVIEW');
    for (const task of inReview) {
      this.push({ type: 'review_verdict', orgId, taskId: task.id });
    }

    // JUDGMENT with no subsequent action → re-invoke judge
    const inJudgment = await getTasksByState(orgId, 'JUDGMENT');
    for (const task of inJudgment) {
      this.push({ type: 'judge_verdict', orgId, taskId: task.id });
    }

    console.log(`[engine] recovery scan done (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'planning.cycle', 'Engine', { recovery: 'scan_complete', orgId });
  }

  // --- Handlers ---

  private async handlePlanningCycle(orgId: string): Promise<void> {
    const start = Date.now();
    const plan = await this.ceo.planningCycle(orgId);
    const { verdict } = await this.advisor.reviewPlan(plan.id);

    if (verdict === 'FLAGGED') {
      console.log(`[engine] planning cycle done — flagged for owner (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'planning.cycle', 'Engine', { planId: plan.id, outcome: 'flagged_for_owner', verdict });
      return;
    }

    console.log(`[engine] planning cycle done — auto-approved (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    this.push({ type: 'plan_approved', orgId, planId: plan.id });
    logEvent(orgId, 'planning.cycle', 'Engine', { planId: plan.id, outcome: 'auto_approved', verdict });
  }

  private async handleBriefingCycle(orgId: string): Promise<void> {
    const start = Date.now();
    const content = await this.ceo.compileBriefing(orgId);
    logEvent(orgId, 'briefing.compiled', 'Engine', { orgId });

    // Deliver briefing (Resend or log)
    if (process.env.RESEND_API_KEY) {
      const { sendBriefing, briefingToHtml } = await import('../lib/email.js');
      await sendBriefing({
        to: process.env.OWNER_EMAIL ?? 'owner@org',
        orgName: orgId,
        date: new Date().toISOString().split('T')[0],
        htmlContent: briefingToHtml(content),
      });
      console.log(`[engine] briefing sent via Resend (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'briefing.sent', 'Engine', { orgId, method: 'resend' });
    } else {
      console.log(`[engine] briefing compiled — Resend not configured, skipping delivery (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'briefing.sent', 'Engine', { orgId, method: 'skipped' });
    }
  }

  private async handlePlanApproved(orgId: string, planId: string): Promise<void> {
    const start = Date.now();
    await approvePlan(planId);
    const dispatchedIds = await this.dispatcher.executePlan(planId);

    for (const taskId of dispatchedIds) {
      const task = await getTask(taskId);
      if (!task) continue;

      try {
        await applyTransition(taskId, 'IN_PROGRESS', 'Dispatcher-1', 'worker starting');
        const output = await this.worker.execute(task);
        this.push({ type: 'task_completed', orgId, taskId });

        if (output.flag) {
          logMessage({
            org_id: orgId,
            from_role: 'worker',
            from_agent_id: task.assigned_worker ?? 'Worker-1',
            to_role: 'ceo',
            message_type: 'flag',
            payload: { taskId, flag: output.flag },
          });
        }
      } catch (err) {
        console.error(`[worker] failed task ${taskId}: ${err instanceof Error ? err.message : String(err)}`);
        try { await applyTransition(taskId, 'FAILED', 'Engine', err instanceof Error ? err.message : 'worker error'); } catch { /* ignore */ }
        logEvent(orgId, 'worker.failed', 'Engine', { taskId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    console.log(`[engine] plan approved — ${dispatchedIds.length} tasks dispatched (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'planning.approved', 'Engine', { planId, dispatchedCount: dispatchedIds.length });
  }

  private async handleTaskCompleted(orgId: string, taskId: string): Promise<void> {
    const task = await getTask(taskId);
    if (!task) return;

    console.log(`[engine] task ${taskId.slice(0, 8)} completed — moving to review`);
    await applyTransition(taskId, 'REVIEW', task.assigned_worker ?? 'Worker-1', 'worker submitted output');
    this.push({ type: 'review_verdict', orgId, taskId });
  }

  private async handleReviewVerdict(orgId: string, taskId: string): Promise<void> {
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
      // Re-dispatch for polish — back to REVIEW after worker resubmits
      // For now, log that polish is needed (worker re-dispatch requires rework context)
      console.log(`[engine] review done — verdict: POLISH for task ${taskId.slice(0, 8)} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'review.verdict', 'Engine', { taskId, verdict: 'POLISH' });
      return;
    }

    // GOOD or EXCELLENT → proceed to judgment
    console.log(`[engine] review done — verdict: ${verdict.verdict} for task ${taskId.slice(0, 8)} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    await applyTransition(taskId, 'JUDGMENT', 'Reviewer-1', `review passed: ${verdict.verdict}`);
    this.push({ type: 'judge_verdict', orgId, taskId });
  }

  private async handleJudgeVerdict(orgId: string, taskId: string): Promise<void> {
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

      // Check for newly dispatchable tasks and phase completion
      const task = await getTask(taskId);
      if (task?.plan_id) {
        const allTasks = await getTasksByPlan(task.plan_id);
        const newlyReady = getDispatchableTasks(allTasks);
        for (const ready of newlyReady) {
          // Dispatch via plan_approved won't work for individual tasks.
          // Manually dispatch.
          try {
            await this.dispatcher['dispatchTask'](ready);
            await applyTransition(ready.id, 'IN_PROGRESS', 'Engine', 'worker starting');
            const output = await this.worker.execute(ready);
            this.push({ type: 'task_completed', orgId, taskId: ready.id });
            if (output.flag) {
              logMessage({
                org_id: orgId,
                from_role: 'worker',
                from_agent_id: ready.assigned_worker ?? 'Worker-1',
                to_role: 'ceo',
                message_type: 'flag',
                payload: { taskId: ready.id, flag: output.flag },
              });
            }
          } catch (err) {
            console.error(`[worker] failed task ${ready.id}: ${err instanceof Error ? err.message : String(err)}`);
            try { await applyTransition(ready.id, 'FAILED', 'Engine', 'worker error'); } catch { /* ignore */ }
          }
        }

        // Check phase completion
        if (task.initiative_id && checkPhaseCompletion(allTasks, task.phase)) {
          this.push({ type: 'phase_completed', orgId, initiativeId: task.initiative_id, phase: task.phase });
        }
      }

      console.log(`[engine] judge done — verdict: ACCEPT for task ${taskId.slice(0, 8)} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'judge.verdict', 'Engine', { taskId, verdict: 'ACCEPT' });
      return;
    }

    if (verdict.verdict === 'REVISE') {
      // applyTransition handles auto-ESCALATE if revision_count >= 2
      const actualState = await applyTransition(taskId, 'REVISION', 'Judge-1', verdict.feedback);

      if (actualState === 'ESCALATED') {
        console.log(`[engine] judge done — verdict: REVISE → auto-escalated for task ${taskId.slice(0, 8)} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
        this.push({ type: 'escalation', orgId, taskId });
      } else {
        // REVISION → back to REVIEW after worker resubmits
        console.log(`[engine] judge done — verdict: REVISE for task ${taskId.slice(0, 8)} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
        logEvent(orgId, 'judge.verdict', 'Engine', { taskId, verdict: 'REVISE' });
      }
      return;
    }

    // ESCALATE
    console.log(`[engine] judge done — verdict: ESCALATE for task ${taskId.slice(0, 8)} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    await applyTransition(taskId, 'ESCALATED', 'Judge-1', verdict.reason);
    this.push({ type: 'escalation', orgId, taskId });
    logEvent(orgId, 'judge.verdict', 'Engine', { taskId, verdict: 'ESCALATE' });
  }

  private async handleEscalation(orgId: string, taskId: string): Promise<void> {
    const start = Date.now();
    console.log(`[ceo] starting escalation diagnosis for task ${taskId.slice(0, 8)}...`);
    try {
      const diagnosis = await this.ceo.handleEscalation(taskId);
      console.log(`[ceo] escalation done — diagnosis: ${diagnosis.type} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'task.escalated', 'Engine', { taskId, diagnosisType: diagnosis.type });
    } catch (err) {
      console.error(`[ceo] escalation failed for task ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
      logEvent(orgId, 'task.escalated', 'Engine', { taskId, error: 'escalation handler not yet implemented' });
    }
  }

  private async handleOwnerReply(orgId: string, content: string): Promise<void> {
    const start = Date.now();
    console.log('[ceo] starting owner reply parsing...');
    const intent = await this.ceo.handleOwnerReply(orgId, content);

    // Store feedback
    await logOwnerFeedback({
      orgId,
      source: 'briefing_reply',
      rawContent: content,
      parsedIntent: intent,
    });

    // Process actions
    for (const action of intent.actions) {
      switch (action.type) {
        case 'approve':
          await approvePlan(action.target_id);
          this.push({ type: 'plan_approved', orgId, planId: action.target_id });
          break;
        case 'hold':
          logEvent(orgId, 'owner.action', 'Engine', { orgId, action: 'hold', targetId: action.target_id });
          break;
        case 'pivot':
          logEvent(orgId, 'owner.action', 'Engine', { orgId, action: 'pivot', targetId: action.target_id, direction: action.direction });
          break;
        case 'free_text':
          logEvent(orgId, 'owner.action', 'Engine', { orgId, action: 'free_text' });
          break;
        case 'clarify':
          logEvent(orgId, 'owner.action', 'Engine', { orgId, action: 'clarify', question: action.question });
          break;
      }
    }

    console.log(`[ceo] owner reply parsed — ${intent.actions.length} actions (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'owner.reply', 'Engine', { orgId, actionCount: intent.actions.length });
  }

  private async drain(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      try {
        await this.handleEvent(event);
      } catch (err) {
        console.error(`[engine] error handling ${event.type}:`, err);
      }
    }
    this.processing = false;
  }
}
