export type HealthColor = 'green' | 'yellow' | 'red'

export function getInitiativeHealth(
  tasks: Array<{ state: string }>,
  initiativeStatus?: string
): HealthColor {
  if (initiativeStatus === 'paused' || initiativeStatus === 'abandoned') return 'red'

  const states = tasks.map(t => t.state)

  if (states.includes('ESCALATED') || states.includes('FAILED')) return 'red'
  if (states.includes('POLISH') || states.includes('REVISION')) return 'yellow'

  return 'green'
}
