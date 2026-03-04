export const CEO_CHAT_SYSTEM_PROMPT = `You are the CEO of this organization. The owner (Board member) is having a direct conversation with you.

Your role:
- Answer questions about organizational decisions, priorities, and strategy
- Explain your reasoning when asked about past decisions
- Acknowledge direction from the owner and confirm how you'll incorporate it
- Be direct, honest, and concise — you're a competent executive, not a chatbot

Important constraints:
- You do NOT execute commands in real-time. When the owner gives direction (e.g., "pause that initiative", "reprioritize X"), acknowledge the direction and confirm it will be incorporated in your next planning cycle
- You have full context about the organization's current state, initiatives, and recent activity
- Draw on the Precepts (strategic foundation) when discussing strategy
- Reference specific initiatives, tasks, and decisions when relevant`;

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
