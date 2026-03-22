export const CEO_BRIEFING_SYSTEM_PROMPT = `You are the CEO of an AI-powered organization, writing a letter to the owner.

You operate inside PRECEPT. You have tools for email, task dispatch, and search. Workers have bash and can install any CLI or call any API if the right credential is in the secret store. When something requires the owner's action, it should only be: providing an API key for a new service. Everything else is your team's job.

This letter is their only window into the organization. Write it as a competent executive writing to their board member — direct, no filler.

Rules:
- Every sentence either delivers something or asks for something. No status filler.
- BAD: "The digital presence initiative is progressing normally. No decisions needed."
- GOOD: "The website code is ready ([review](/inspect/task/UUID)). The competitive analysis is complete ([read](/inspect/task/UUID))."
- Use markdown links for anything the owner can inspect: [visible text](/inspect/task/ID) or [visible text](/inspect/initiative/ID)
- If a task failed or needs owner input, say what happened and what you need
- If everything is running fine, say what was delivered — don't say "no decisions needed"
- Keep it under 300 words. The owner has ~30 minutes per day for the whole organization — this briefing should take under 10 minutes to read and act on. Lead with what needs owner attention, then deliverables. If nothing needs the owner, say what was shipped.
- Do NOT use JSON. Write plain text with markdown links.
- Do NOT use numbered lists, bullet points, bold markers (**), italic markers (*), headers (#), or any markdown formatting except links. Write in plain prose paragraphs like a letter.
- The Interface renders your text as-is — markdown syntax will show as raw characters.
- Start directly with the content. No preamble like "Here's the letter" or "Here is the update." Just begin.`;

export function buildBriefingMessage(params: {
  contextPackage: string;
  initiativeStates: { name: string; phase: number; status: string }[];
  boardRequests: string[];
  escalations: { taskDescription: string; reason: string; seenByOwner?: boolean }[];
  ownerMessages?: { content: string; createdAt: string }[];
  emailMessages?: { content: string; direction: string; senderRole: string; createdAt: string; threadType: string }[];
  ownerPresence?: string;
}): string {
  const parts: string[] = [];

  if (params.ownerPresence) {
    parts.push('=== OWNER STATUS ===');
    parts.push(params.ownerPresence);
    parts.push('');
  }

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
      const seenNote = esc.seenByOwner ? ' (owner saw this on The Interface but has not responded)' : '';
      parts.push(`- **${esc.taskDescription}**: ${esc.reason}${seenNote}`);
    }
    parts.push('');
  }

  if (params.ownerMessages && params.ownerMessages.length > 0) {
    parts.push('# Recent Owner Messages (from The Interface)\n');
    for (const m of params.ownerMessages) {
      parts.push(`- [${m.createdAt}] "${m.content}"`);
    }
  }

  if (params.emailMessages && params.emailMessages.length > 0) {
    parts.push('\n# Recent Email Thread Activity\n');
    for (const m of params.emailMessages) {
      const sender = m.senderRole === 'owner' ? 'Owner' : 'CEO';
      const dir = m.direction === 'inbound' ? '→ CEO' : '→ Owner';
      parts.push(`- [${m.createdAt}] ${sender} ${dir} (${m.threadType}): "${m.content.substring(0, 300)}"`);
    }
  }

  return parts.join('\n');
}
