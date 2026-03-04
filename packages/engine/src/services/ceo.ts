import type { Plan, PlanOutput, BriefingContent, EscalationDiagnosis, OwnerReplyIntent } from '@precept/shared';
import { FIELD_LABELS, PRECEPTS_FIELDS, type PreceptsDraft } from '@precept/shared';
import { invokeAgent } from '../ai/invoke.js';
import { CEO_PLANNING_SYSTEM_PROMPT, buildCEOPlanningMessage } from '../ai/prompts/ceo-planning.js';
import { CEO_ESCALATION_SYSTEM_PROMPT, buildEscalationMessage } from '../ai/prompts/ceo-escalation.js';
import { CEO_BRIEFING_SYSTEM_PROMPT, buildBriefingMessage } from '../ai/prompts/ceo-briefing.js';
import { CEO_REPLY_PARSING_SYSTEM_PROMPT, buildReplyParsingMessage } from '../ai/prompts/ceo-reply-parsing.js';
import { ScribeService } from './scribe.js';
import { getLatestPrecepts } from '../db/precepts.js';
import { getRecentLessons, logDecision } from '../db/decisions.js';
import { getRecentFeedback } from '../db/owner-feedback.js';
import { createInitiative, getActiveInitiatives } from '../db/initiatives.js';
import { createPlan, getUnapprovedPlans } from '../db/plans.js';
import { createTasks, getTask, getTasksByState, updateTaskDependencies, type CreateTaskParams } from '../db/tasks.js';
import { logMessage } from '../db/messages.js';
import { logEvent } from '../db/audit.js';

function preceptsToMarkdown(content: PreceptsDraft): string {
  const sections: string[] = [];
  for (const field of PRECEPTS_FIELDS) {
    const f = content[field];
    if (!f?.content) continue;
    sections.push(`## ${FIELD_LABELS[field]}\n\n${f.content}`);
  }
  return sections.join('\n\n');
}

export class CEOService {
  private scribe = new ScribeService();

  async planningCycle(orgId: string): Promise<Plan> {
    const start = Date.now();
    console.log('[ceo] starting plan generation...');

    // 1. Read Precepts
    const precepts = await getLatestPrecepts(orgId);
    if (!precepts) throw new Error(`No Precepts found for org ${orgId}`);
    const preceptsMd = preceptsToMarkdown(precepts.content);

    // 2. Call Scribe for context
    const contextMsg = await this.scribe.compressContext(orgId);

    // 3. Read lessons and owner feedback
    const [lessons, feedback] = await Promise.all([
      getRecentLessons(orgId, 10),
      getRecentFeedback(orgId, 10),
    ]);

    // 4. Build CEO prompt
    const userMessage = buildCEOPlanningMessage(
      preceptsMd,
      contextMsg.payload,
      lessons.map((l) => ({ whatTried: l.whatTried, whatLearned: l.whatLearned })),
      feedback.map((f) => ({ rawContent: f.rawContent, parsedIntent: f.parsedIntent })),
      [], // TODO: read skill files from disk in later iteration
    );

    // 5. Invoke CEO
    const response = await invokeAgent('CEO-1', {
      orgId,
      model: 'opus',
      systemPrompt: CEO_PLANNING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.7,
      jsonMode: true,
    });

    const planOutput = response.parsed as unknown as PlanOutput;
    if (!planOutput?.initiatives) {
      throw new Error('CEO produced invalid plan: missing initiatives');
    }

    // 6. Create initiatives
    for (const init of planOutput.initiatives) {
      const initiative = await createInitiative({
        orgId,
        name: init.name,
        description: init.description,
      });

      // 7. Create tasks, then remap plan-internal depends_on IDs to real UUIDs
      // Accumulate plan-ID → UUID mapping across all phases in this initiative
      const idMap = new Map<string, string>();

      for (const phase of init.phases) {
        // First pass: insert with empty depends_on (column is UUID[], can't store plan IDs)
        const taskParams: CreateTaskParams[] = phase.tasks.map((t) => ({
          orgId,
          initiativeId: initiative.id,
          phase: phase.phase_number,
          role: t.role,
          spec: {
            description: t.description,
            acceptance_criteria: t.acceptance_criteria,
            priority: t.priority,
          },
          dependsOn: [],
          skillsLoaded: t.skills,
        }));

        const createdTasks = await createTasks(taskParams);

        // Build ID remap: plan-internal ID → generated UUID
        phase.tasks.forEach((planTask, idx) => {
          if (createdTasks[idx]) {
            idMap.set(planTask.id, createdTasks[idx].id);
          }
        });

        // Second pass: update depends_on with remapped UUIDs
        for (let i = 0; i < phase.tasks.length; i++) {
          const planDeps = phase.tasks[i].depends_on;
          if (planDeps.length === 0) continue;

          const remappedDeps = planDeps
            .map((planId) => idMap.get(planId))
            .filter((uuid): uuid is string => uuid !== undefined);

          if (remappedDeps.length > 0) {
            await updateTaskDependencies(createdTasks[i].id, remappedDeps);
          }
        }
      }
    }

    // 8. Log decisions
    for (const d of planOutput.decisions) {
      await logDecision({
        orgId,
        decision: d.decision,
        reasoning: d.reasoning,
        alternatives: d.alternatives,
        whyNot: d.why_not,
      });
    }

    // 9. Create plan record
    const plan = await createPlan({
      orgId,
      content: planOutput,
    });

    // Log messages and audit
    logMessage({
      org_id: orgId,
      from_role: 'ceo',
      from_agent_id: 'CEO-1',
      to_role: 'dispatcher',
      message_type: 'plan',
      payload: { planId: plan.id },
    });

    const initiativeCount = planOutput.initiatives.length;
    const taskCount = planOutput.initiatives.reduce(
      (sum, i) => sum + i.phases.reduce((s, p) => s + p.tasks.length, 0),
      0,
    );

    console.log(`[ceo] done — ${initiativeCount} initiatives, ${taskCount} tasks (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'planning.cycle', 'CEO-1', {
      planId: plan.id,
      initiativeCount,
      taskCount,
    });

    return plan;
  }

  async handleEscalation(taskId: string): Promise<EscalationDiagnosis> {
    const start = Date.now();
    const task = await getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const response = await invokeAgent('CEO-1', {
      orgId: task.org_id,
      model: 'opus',
      systemPrompt: CEO_ESCALATION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: buildEscalationMessage({
          taskSpec: task.spec,
          workerOutput: task.output?.output ?? null,
          judgeReason: null, // TODO: read from last judge verdict transition
          revisionCount: task.revision_count,
        }),
      }],
      temperature: 0.5,
      jsonMode: true,
    });

    const diagnosis = response.parsed as unknown as EscalationDiagnosis;
    if (!diagnosis?.type) {
      throw new Error('CEO produced invalid escalation diagnosis');
    }

    console.log(`[ceo] escalation done — diagnosis: ${diagnosis.type} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(task.org_id, 'task.escalated', 'CEO-1', { taskId, diagnosisType: diagnosis.type });
    return diagnosis;
  }

  async compileBriefing(orgId: string): Promise<BriefingContent> {
    const start = Date.now();
    console.log('[ceo] starting briefing compilation...');
    const contextMsg = await this.scribe.compressContext(orgId);
    const initiatives = await getActiveInitiatives(orgId);
    const escalated = await getTasksByState(orgId, 'ESCALATED');

    // Collect pending board requests from unapproved plans
    const unapproved = await getUnapprovedPlans(orgId);
    const boardRequests = unapproved.flatMap((p) =>
      (p.content.board_requests ?? []).map((r) => r.request),
    );

    const response = await invokeAgent('CEO-1', {
      orgId,
      model: 'opus',
      systemPrompt: CEO_BRIEFING_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: buildBriefingMessage({
          contextPackage: typeof contextMsg.payload === 'string' ? contextMsg.payload : JSON.stringify(contextMsg.payload),
          initiativeStates: initiatives.map((i) => ({
            name: i.name,
            phase: i.phase_current,
            status: i.status,
          })),
          boardRequests,
          escalations: escalated.map((t) => ({
            taskDescription: t.spec.description,
            reason: `Revision count: ${t.revision_count}`,
          })),
        }),
      }],
      temperature: 0.5,
      jsonMode: true,
    });

    const content = response.parsed as unknown as BriefingContent;
    if (!content?.results) {
      throw new Error('CEO produced invalid briefing content');
    }

    console.log(`[ceo] briefing compiled (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'briefing.compiled', 'CEO-1', { orgId });
    return content;
  }

  async handleOwnerReply(orgId: string, content: string): Promise<OwnerReplyIntent> {
    const start = Date.now();
    const initiatives = await getActiveInitiatives(orgId);

    // Collect pending board requests
    const unapproved = await getUnapprovedPlans(orgId);
    const boardRequests = unapproved.flatMap((p) =>
      (p.content.board_requests ?? []).map((r) => r.request),
    );

    const response = await invokeAgent('CEO-1', {
      orgId,
      model: 'opus',
      systemPrompt: CEO_REPLY_PARSING_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: buildReplyParsingMessage({
          rawReply: content,
          initiativeNames: initiatives.map((i) => ({ id: i.id, name: i.name })),
          pendingBoardRequests: boardRequests,
        }),
      }],
      temperature: 0.3,
      jsonMode: true,
    });

    const intent = response.parsed as unknown as OwnerReplyIntent;
    if (!intent?.actions) {
      throw new Error('CEO produced invalid reply intent');
    }

    console.log(`[ceo] owner reply parsed — ${intent.actions.length} actions (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'owner.reply', 'CEO-1', { orgId, actionCount: intent.actions.length });
    return intent;
  }
}
