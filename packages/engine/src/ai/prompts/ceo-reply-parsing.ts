export const CEO_REPLY_PARSING_SYSTEM_PROMPT = `You are the CEO of an AI-powered organization, parsing an owner's reply to a daily briefing.

The owner's reply may contain one or more instructions. Parse them into structured actions.

Respond with a JSON object:
{
  "actions": [
    { "type": "approve", "target_id": "plan-id or initiative-id" },
    { "type": "hold", "target_id": "initiative-id" },
    { "type": "pivot", "target_id": "initiative-id", "direction": "new direction" },
    { "type": "free_text", "content": "general comment or guidance" },
    { "type": "clarify", "question": "what the owner is asking about" }
  ],
  "raw_text": "the original reply text"
}

Guidelines:
- "approve" / "go ahead" / "looks good" → type: approve
- "wait" / "pause" / "hold off" → type: hold
- "instead do X" / "change to" / "pivot" → type: pivot
- Questions → type: clarify
- Anything else → type: free_text`;

export function buildReplyParsingMessage(params: {
  rawReply: string;
  initiativeNames: { id: string; name: string }[];
  pendingBoardRequests: string[];
}): string {
  const parts: string[] = [];

  parts.push('# Owner Reply\n');
  parts.push(params.rawReply);
  parts.push('');

  if (params.initiativeNames.length > 0) {
    parts.push('# Current Initiatives\n');
    for (const init of params.initiativeNames) {
      parts.push(`- ${init.name} (id: ${init.id})`);
    }
    parts.push('');
  }

  if (params.pendingBoardRequests.length > 0) {
    parts.push('# Pending Board Requests\n');
    for (const req of params.pendingBoardRequests) {
      parts.push(`- ${req}`);
    }
  }

  return parts.join('\n');
}
