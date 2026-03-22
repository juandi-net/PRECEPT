import { CEO_TOOLS } from '../../tools/ceo-tools.js';

function buildToolDocs(): string {
  return CEO_TOOLS.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n');
}

export const CEO_TASK_COMPLETION_SYSTEM_PROMPT = `You are the CEO of this organization. A task just reached a terminal state. Your job is to decide what, if anything, to do about it.

DECISION FRAMEWORK (check in order):
1. Did you promise the owner you'd follow up on this? Check the recent chat history. If yes — write a brief update.
2. Is the result significant enough that the owner should know right now? If yes — write a brief update.
3. Does this result demand immediate follow-up action (e.g., a failure that blocks other work, a result that changes strategy)? If yes — use your tools.
4. If none of the above — do nothing. Return a brief internal note. Most completions need no action.

PRESENCE-AWARE COMMUNICATION:
- If the owner is present on The Interface — write the chat update. They will see it in real time.
- If the owner is NOT present and it is NOT urgent — do nothing. The daily briefing will cover it automatically through the Scribe's audit log compression.
- If the owner is NOT present and it IS urgent — write the chat update AND create a board_request to ensure they get an email notification.

WHEN YOU WRITE AN UPDATE:
- 1-2 sentences max. The owner needs a status ping, not a report.
- Include a markdown link to the task: [task title](/inspect/task/{task_id})
- Be specific about what was accomplished or what went wrong.
- Be conversational and direct.

CONSTRAINTS:
- This is NOT a planning session. Do not generate plans.
- If the result suggests new work is needed, you may create a single follow-up task, but do not redesign the initiative.
- Do not use JSON in your response. Write plain text.

Available tools:
${buildToolDocs()}`;

export function buildTaskCompletionMessage(params: {
  taskId: string;
  title: string;
  state: 'ACCEPTED' | 'FAILED';
  role: string;
  source: string;
  initiativeName: string | null;
  outputSummary: string;
  verdictReason: string;
  chatHistory: Array<{ role: string; content: string }>;
  ownerPresence: { present: boolean; lastSeenDescription: string };
}): string {
  const parts: string[] = [];

  parts.push('## Completed Task');
  parts.push(`Title: ${params.title}`);
  parts.push(`State: ${params.state}`);
  parts.push(`Role: ${params.role}`);
  parts.push(`Source: ${params.source}`);
  parts.push(`Initiative: ${params.initiativeName ?? 'none'}`);
  parts.push(`Task ID: ${params.taskId}`);

  parts.push('\n## Result');
  parts.push(params.outputSummary || 'No output recorded.');

  parts.push('\n## Judge\'s Verdict');
  parts.push(params.verdictReason || 'No verdict reason recorded.');

  if (params.chatHistory.length > 0) {
    parts.push('\n## Recent Chat (last 10 messages)');
    for (const msg of params.chatHistory) {
      parts.push(`${msg.role === 'owner' ? 'Owner' : 'CEO'}: ${msg.content}`);
    }
  }

  parts.push('\n## Owner Presence');
  parts.push(params.ownerPresence.present
    ? 'Present — active on The Interface'
    : params.ownerPresence.lastSeenDescription);

  return parts.join('\n');
}
