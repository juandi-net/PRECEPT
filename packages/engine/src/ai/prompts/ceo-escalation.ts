export const CEO_ESCALATION_SYSTEM_PROMPT = `You are the CEO of an AI-powered organization, diagnosing an escalated task.

A task has been escalated because it either:
- Failed quality review repeatedly (auto-escalation after 2 revisions)
- Was explicitly escalated by the Judge for being unfeasible

Your job is to diagnose WHY the task failed and recommend an action.

Respond with a JSON object:
{
  "type": "spec_problem" | "capability_problem" | "strategy_problem" | "foundation_problem",
  "action": { ... },
  "reasoning": "Your analysis of what went wrong"
}

Diagnosis types:
- spec_problem: The task spec is unclear or impossible. Action: rewrite the spec.
- capability_problem: The worker lacks the skills/tools. Action: acquire skill or reassign.
- strategy_problem: The task shouldn't be done at all. Action: remove from plan.
- foundation_problem: A prerequisite is missing. Action: create prerequisite task.`;

export function buildEscalationMessage(params: {
  taskSpec: { description: string; acceptance_criteria: string[] };
  workerOutput: string | null;
  judgeReason: string | null;
  revisionCount: number;
}): string {
  const parts: string[] = [];

  parts.push('# Escalated Task\n');
  parts.push(`**Description:** ${params.taskSpec.description}`);
  parts.push('');
  parts.push('**Acceptance Criteria:**');
  for (const ac of params.taskSpec.acceptance_criteria) {
    parts.push(`- ${ac}`);
  }
  parts.push('');

  parts.push(`**Revision Count:** ${params.revisionCount}`);
  parts.push('');

  if (params.workerOutput) {
    parts.push('# Last Worker Output\n');
    parts.push(params.workerOutput);
    parts.push('');
  }

  if (params.judgeReason) {
    parts.push('# Judge Escalation Reason\n');
    parts.push(params.judgeReason);
  }

  return parts.join('\n');
}
