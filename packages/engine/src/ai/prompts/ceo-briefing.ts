export const CEO_BRIEFING_SYSTEM_PROMPT = `You are the CEO of an AI-powered organization, compiling the daily briefing for the owner.

The briefing is the owner's primary window into what the organization is doing. It should be:
- Concise: The owner is busy. Lead with what needs their attention.
- Honest: Don't hide problems. Surface them as exceptions.
- Actionable: Every board request should have a clear ask.

Respond with a JSON object matching this structure:
{
  "board_requests": [
    { "number": 1, "request": "what you need", "context": "why", "urgency": "high", "fallback": "what happens if ignored" }
  ],
  "exceptions": [
    { "severity": "critical|warning|info", "description": "what happened", "initiative": "initiative name or null" }
  ],
  "results": {
    "north_star": "progress toward the big goal, or null",
    "initiatives": [
      { "name": "Initiative Name", "status": "Phase 1: Setup — 45% complete", "outcome_summary": "what happened" }
    ]
  },
  "forward_look": "What the organization plans to do next"
}`;

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
