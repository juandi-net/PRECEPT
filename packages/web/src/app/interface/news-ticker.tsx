'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TickerItem {
  id: string
  text: string
  taskId: string | null
}

const EVENT_MAP: Record<string, { role: string; action: string }> = {
  'worker.start': { role: '', action: 'working on' },
  'worker.complete': { role: '', action: 'completed' },
  'worker.rework_complete': { role: '', action: 'revised' },
  'worker.failed': { role: '', action: 'failed on' },
  'review.start': { role: 'Reviewer', action: 'evaluating' },
  'review.verdict': { role: 'Reviewer', action: 'reviewed' },
  'judge.start': { role: 'Judge', action: 'evaluating' },
  'judge.verdict': { role: 'Judge', action: '' },
  'dispatch.task': { role: 'Dispatcher', action: 'assigned' },
  'dispatch.plan': { role: 'Dispatcher', action: 'dispatching plan' },
  'planning.cycle': { role: 'CEO', action: 'planning next cycle' },
  'planning.ceo': { role: 'CEO', action: 'reviewing plan' },
  'planning.advisor': { role: 'Advisor', action: 'consulting' },
  'planning.scribe': { role: 'Scribe', action: 'documenting' },
  'planning.approved': { role: 'CEO', action: 'approved plan' },
  'briefing.compiled': { role: 'CEO', action: 'compiling briefing' },
  'briefing.sent': { role: 'CEO', action: 'sent briefing' },
}

const TICKER_EVENT_TYPES = Object.keys(EVENT_MAP)

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatEvent(
  eventType: string,
  detail: Record<string, unknown> | null,
  taskDescription: string | null,
  taskRole: string | null
): string {
  const mapping = EVENT_MAP[eventType]
  if (!mapping) {
    return eventType.replace(/[._]/g, ' ')
  }

  let role = mapping.role
  if (!role && taskRole) {
    role = capitalizeFirst(taskRole)
  } else if (!role) {
    role = 'Worker'
  }

  let action = mapping.action
  if (eventType === 'judge.verdict' && detail) {
    const verdict = (detail.verdict as string) ?? 'evaluated'
    action = verdict === 'ACCEPTED' ? 'accepted' : 'revised'
  }

  if (taskDescription) {
    return `${role} ${action} ${taskDescription}`
  }

  return `${role} ${action}`
}

async function fetchTickerItems(orgId: string): Promise<TickerItem[]> {
  const supabase = createClient()

  const { data: events } = await supabase
    .from('audit_log')
    .select('id, event_type, detail')
    .eq('org_id', orgId)
    .in('event_type', TICKER_EVENT_TYPES)
    .order('created_at', { ascending: false })
    .limit(15)

  if (!events?.length) return []

  const taskIds = events
    .map((e: Record<string, unknown>) => {
      const detail = e.detail as Record<string, unknown> | null
      return (detail?.taskId ?? detail?.task_id) as string | undefined
    })
    .filter((id): id is string => !!id)

  let taskMap: Record<string, { role: string; description: string }> = {}

  if (taskIds.length > 0) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, role, spec')
      .in('id', [...new Set(taskIds)])

    taskMap = Object.fromEntries(
      (tasks ?? []).map((t: Record<string, unknown>) => {
        const spec = t.spec as { title?: string; description?: string }
        return [t.id as string, { role: t.role as string, description: spec?.title ?? spec?.description ?? '' }]
      })
    )
  }

  return events.map((row: Record<string, unknown>) => {
    const detail = row.detail as Record<string, unknown> | null
    const taskId = (detail?.taskId ?? detail?.task_id) as string | undefined
    const task = taskId ? taskMap[taskId] : undefined
    return {
      id: row.id as string,
      text: formatEvent(
        row.event_type as string,
        detail,
        task?.description ?? null,
        task?.role ?? null
      ),
      taskId: taskId ?? null,
    }
  })
}

export function NewsTicker({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<TickerItem[]>([])

  useEffect(() => {
    let active = true
    const load = () =>
      fetchTickerItems(orgId)
        .then((data) => { if (active) setItems(data) })
        .catch(() => {})
    load()
    const interval = setInterval(load, 12_000)
    return () => { active = false; clearInterval(interval) }
  }, [orgId])

  const tickerContent = useMemo(() => [...items, ...items], [items])

  const duration = Math.max(items.length * 6, 45)

  if (items.length === 0) {
    return (
      <div className="ticker-bar">
        <div className="ticker-idle">System idle</div>
      </div>
    )
  }

  return (
    <div className="ticker-bar">
      <div
        className="ticker-track"
        style={{ '--ticker-duration': `${duration}s` } as React.CSSProperties}
      >
        {tickerContent.map((item, i) => (
          <span key={`${item.id}-${i}`}>
            {i > 0 && <span className="ticker-separator"> · </span>}
            {item.taskId ? (
              <a href={`/inspect/task/${item.taskId}`} className="ticker-item">
                {item.text}
              </a>
            ) : (
              <span className="ticker-item">{item.text}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
