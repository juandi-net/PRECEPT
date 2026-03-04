'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface TaskTransition {
  id: string
  from_state: string | null
  to_state: string
  agent_id: string
  reason: string | null
  created_at: string
}

interface AuditEvent {
  id: string
  event_type: string
  agent: string
  detail: Record<string, unknown> | null
  created_at: string
}

interface TaskDetailProps {
  taskId: string
  spec: Record<string, unknown> | null
  output: Record<string, unknown> | null
}

export function TaskDetail({ taskId, spec, output }: TaskDetailProps) {
  const [transitions, setTransitions] = useState<TaskTransition[]>([])
  const [reviewHistory, setReviewHistory] = useState<AuditEvent[]>([])

  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('task_transitions')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at')
      .then(({ data }) => { if (data) setTransitions(data) })

    supabase
      .from('audit_log')
      .select('*')
      .or(`event_type.ilike.%reviewer%,event_type.ilike.%judge%`)
      .ilike('detail->>taskId', taskId)
      .order('created_at')
      .then(({ data }) => { if (data) setReviewHistory(data) })
  }, [taskId])

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      {/* Spec */}
      <div>
        <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Spec</h4>
        {spec ? (
          <div className="text-sm whitespace-pre-wrap">
            {(spec as Record<string, string>).description ?? JSON.stringify(spec, null, 2)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No spec available</p>
        )}
      </div>

      <Separator />

      {/* Worker Output */}
      <div>
        <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Worker Output</h4>
        {output ? (
          <div className="max-h-64 overflow-auto text-sm whitespace-pre-wrap">
            {typeof output === 'string' ? output : (output as Record<string, string>).content ?? JSON.stringify(output, null, 2)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No output yet</p>
        )}
      </div>

      {/* Review History */}
      {reviewHistory.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Review History</h4>
            <div className="space-y-2">
              {reviewHistory.map((event) => (
                <div key={event.id} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="shrink-0 text-xs">{event.agent}</Badge>
                  <span className="text-muted-foreground">
                    {event.event_type}: {JSON.stringify(event.detail)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* State Transitions */}
      {transitions.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Transitions</h4>
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {transitions.map((t, i) => (
                <span key={t.id}>
                  {i > 0 && <span className="mx-1">&rarr;</span>}
                  {t.to_state}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
