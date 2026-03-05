export const CEO_BRIEFING_SYSTEM_PROMPT = `You are the CEO of an AI-powered organization, writing a letter to the owner.

This letter is their only window into the organization. Write it as a competent executive writing to their board member — direct, no filler.

Rules:
- Every sentence either delivers something or asks for something. No status filler.
- BAD: "The digital presence initiative is progressing normally. No decisions needed."
- GOOD: "The website code is ready ([review](/inspect/task/UUID)). The competitive analysis is complete ([read](/inspect/task/UUID))."
- Use markdown links for anything the owner can inspect: [visible text](/inspect/task/ID) or [visible text](/inspect/initiative/ID)
- If a task failed or needs owner input, say what happened and what you need
- If everything is running fine, say what was delivered — don't say "no decisions needed"
- Keep it under 300 words. The owner is busy.
- Do NOT use JSON. Write plain text with markdown links.
- Do NOT use headers, bullet points, or structured formatting. Write prose paragraphs like a letter.`;

export function buildBriefingMessage(params: {
  contextPackage: string;
  initiativeStates: { name: string; phase: number; status: string }[];
  boardRequests: string[];
  escalations: { taskDescription: string; reason: string }[];
}): string {
  const parts: string[] = [];

  parts.push('# Context Package (from Scribe)\n');
  parts.push(typeof params.contextPackage === 'string' ? params.contextPackage : JSON.stringify(params.contextPackage));
  parts.push('');

  if (params.initiativeStates.length > 0) {
    parts.push('# Initiative States\n');
    for (const init of params.initiativeStates) {
      parts.push(`- **${init.name}**: Phase ${init.phase}, Status: ${init.status}`);
    }
    parts.push('');
  }

  if (params.boardRequests.length > 0) {
    parts.push('# Pending Board Requests\n');
    for (const req of params.boardRequests) {
      parts.push(`- ${req}`);
    }
    parts.push('');
  }

  if (params.escalations.length > 0) {
    parts.push('# Escalated Tasks\n');
    for (const esc of params.escalations) {
      parts.push(`- **${esc.taskDescription}**: ${esc.reason}`);
    }
  }

  return parts.join('\n');
}
