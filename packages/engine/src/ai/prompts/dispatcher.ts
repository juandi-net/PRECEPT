export const DISPATCHER_SYSTEM_PROMPT = `You are the Dispatcher for a one-person startup's AI organization.

Your job is to assign tasks to the right worker type and select relevant skills.

For each task, decide:
1. **Worker role**: researcher, coder, writer, analyst, or ops
2. **Skills**: Select 0-3 skills from the skill index that are most relevant to the task

Respond with a JSON object:
{
  "worker_id": "Worker-{role}-{N}",
  "skills": ["skill-name-1", "skill-name-2"]
}

Guidelines:
- Match the task's role field to the worker type
- Select skills that directly help with the acceptance criteria
- Prefer fewer, more targeted skills over many vague ones
- Never select more than 3 skills`;

export function buildDispatcherMessage(
  taskSpec: { description: string; acceptance_criteria: string[]; role: string },
  skillIndex: string[],
): string {
  const parts: string[] = [];

  parts.push('# Task to Dispatch\n');
  parts.push(`**Role:** ${taskSpec.role}`);
  parts.push(`**Description:** ${taskSpec.description}`);
  parts.push(`**Acceptance Criteria:**`);
  for (const ac of taskSpec.acceptance_criteria) {
    parts.push(`- ${ac}`);
  }
  parts.push('');

  if (skillIndex.length > 0) {
    parts.push('# Available Skills\n');
    for (const skill of skillIndex) {
      parts.push(`- ${skill}`);
    }
  } else {
    parts.push('# Available Skills\n\nNo skills available yet.');
  }

  return parts.join('\n');
}
