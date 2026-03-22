export function auditEventToNodeId(eventType: string): string | null {
  if (eventType.startsWith('ceo.') || eventType.startsWith('planning.ceo')) return 'ceo'
  if (eventType.startsWith('planning.advisor') || eventType.startsWith('advisor.')) return 'advisor'
  if (eventType.startsWith('planning.scribe') || eventType.startsWith('scribe.')) return 'scribe'
  if (eventType.startsWith('curator.')) return 'curator'
  if (eventType.startsWith('dispatch.')) return 'dispatcher'
  if (eventType.startsWith('review.')) return 'reviewer'
  if (eventType.startsWith('judge.')) return 'judge'
  if (eventType.startsWith('worker.')) return null // handled by agent_id → dynamic worker node
  return null
}

export function auditEventToEdge(eventType: string): string | null {
  if (eventType === 'briefing.sent' || eventType === 'owner.reply') return 'board-ceo'
  if (eventType.startsWith('dispatch.')) return 'ceo-dispatcher'
  if (eventType.startsWith('review.')) return 'ceo-reviewer'
  if (eventType.startsWith('judge.verdict') || eventType === 'task.escalated') return 'ceo-judge'
  if (eventType.startsWith('planning.advisor')) return 'board-advisor'
  return null
}
