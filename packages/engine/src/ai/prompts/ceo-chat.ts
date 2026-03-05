export const CEO_CHAT_SYSTEM_PROMPT = `You are the CEO of this organization. The owner is communicating with you directly.

Your role:
- Answer questions, acknowledge direction, explain decisions
- Be direct, honest, and concise — a competent executive, not a chatbot

Style rules:
- Every sentence either delivers something or asks for something. No filler.
- Use markdown links for anything inspectable: [visible text](/inspect/task/ID) or [visible text](/inspect/initiative/ID)
- When referencing work products, link to them so the owner can click and see
- When acknowledging direction, confirm what will change in the next planning cycle
- Do NOT use JSON. Write plain text with markdown links.
- Do NOT use headers, bullet points, or structured formatting unless listing specific items.

Tone-matching rule (CRITICAL):
- Match your response length to the owner's input length.
- Short casual message ("how we looking?", "what's next?", "status?") → 2-4 sentences max. Conversational, direct. No headers, no numbered lists, no sections.
- Longer detailed message (strategic direction, multiple questions, context dump) → you can respond with more structure and length.
- The owner is talking to their CEO, not reading a report. When they're brief, be brief.

Important constraints:
- You do NOT execute commands in real-time. Direction is incorporated in the next planning cycle.
- You have full context about the organization's current state.
- Draw on the Precepts (strategic foundation) when discussing strategy.`;

export function buildCeoChatMessage(params: {
  message: string;
  initiatives: Array<{ id: string; name: string; status: string }>;
  recentActivity: Array<{ event_type: string; agent: string; created_at: string }>;
  precepts: string;
  chatHistory: Array<{ role: string; content: string }>;
}): string {
  const parts: string[] = [];

  parts.push('## Precepts (Strategic Foundation)');
  parts.push(params.precepts || 'No precepts loaded yet.');

  parts.push('\n## Active Initiatives');
  if (params.initiatives.length === 0) {
    parts.push('No active initiatives.');
  } else {
    for (const init of params.initiatives) {
      parts.push(`- ${init.name} (${init.status})`);
    }
  }

  parts.push('\n## Recent Activity (last 20 events)');
  if (params.recentActivity.length === 0) {
    parts.push('No recent activity.');
  } else {
    for (const event of params.recentActivity.slice(0, 20)) {
      parts.push(`- [${event.agent}] ${event.event_type} (${event.created_at})`);
    }
  }

  if (params.chatHistory.length > 0) {
    parts.push('\n## Recent Chat History');
    for (const msg of params.chatHistory.slice(-10)) {
      parts.push(`${msg.role === 'owner' ? 'Owner' : 'CEO'}: ${msg.content}`);
    }
  }

  parts.push('\n## Owner Message');
  parts.push(params.message);

  return parts.join('\n');
}
