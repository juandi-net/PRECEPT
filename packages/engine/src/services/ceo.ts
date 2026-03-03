import type { Plan, PlanOutput, BriefingContent, EscalationDiagnosis, OwnerReplyIntent } from '@precept/shared';
import { FIELD_LABELS, PRECEPTS_FIELDS, type PreceptsDraft } from '@precept/shared';
import { invokeAgent } from '../ai/invoke.js';
import { CEO_PLANNING_SYSTEM_PROMPT, buildCEOPlanningMessage } from '../ai/prompts/ceo-planning.js';
import { ScribeService } from './scribe.js';
import { getLatestPrecepts } from '../db/precepts.js';
import { getRecentLessons, logDecision } from '../db/decisions.js';
import { getRecentFeedback } from '../db/owner-feedback.js';
import { createInitiative } from '../db/initiatives.js';
import { createPlan } from '../db/plans.js';
import { createTasks, type CreateTaskParams } from '../db/tasks.js';
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

      // 7. Create tasks with depends_on ID remapping
      for (const phase of init.phases) {
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
          dependsOn: t.depends_on,
          skillsLoaded: t.skills,
        }));

        // Bulk insert returns tasks with generated UUIDs
        const createdTasks = await createTasks(taskParams);

        // Build ID remap: plan-internal ID → generated UUID
        const idMap = new Map<string, string>();
        phase.tasks.forEach((planTask, idx) => {
          if (createdTasks[idx]) {
            idMap.set(planTask.id, createdTasks[idx].id);
          }
        });

        // NOTE: depends_on remapping would need a second pass to update
        // the DB with real UUIDs. For now, tasks store plan-internal IDs
        // and the dependency resolver uses the plan-internal ID scheme.
        // Full remapping will be wired when the Dispatcher consumes tasks.
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

    logEvent('planning.cycle', 'CEO-1', {
      planId: plan.id,
      initiativeCount: planOutput.initiatives.length,
      taskCount: planOutput.initiatives.reduce(
        (sum, i) => sum + i.phases.reduce((s, p) => s + p.tasks.length, 0),
        0,
      ),
    });

    return plan;
  }

  // Stubs — implemented in later phases
  async handleEscalation(_taskId: string): Promise<EscalationDiagnosis> {
    throw new Error('Not implemented — Phase 4');
  }

  async compileBriefing(_orgId: string): Promise<BriefingContent> {
    throw new Error('Not implemented — Phase 5');
  }

  async handleOwnerReply(_orgId: string, _content: string): Promise<OwnerReplyIntent> {
    throw new Error('Not implemented — Phase 5');
  }
}
