'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { AlertTriangle, Info } from 'lucide-react'

interface ExceptionTask {
  id: string
  state: string
  spec: { description?: string } | null
}

export function Exceptions({ orgId }: { orgId: string }) {
  const [exceptions, setExceptions] = useState<ExceptionTask[]>([])

  const fetchExceptions = useCallback(() => {
    const supabase = createClient()
    supabase
      .from('tasks')
      .select('id, state, spec')
      .eq('org_id', orgId)
      .in('state', ['ESCALATED', 'FAILED'])
      .order('updated_at', { ascending: false })
      .then(({ data }) => { if (data) setExceptions(data) })
  }, [orgId])

  useEffect(() => { fetchExceptions() }, [fetchExceptions])

  useRealtime({ table: 'tasks', filter: `org_id=eq.${orgId}`, onPayload: fetchExceptions })

  if (exceptions.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Exceptions
      </h2>
      <div className="space-y-2 rounded-lg border p-3">
        {exceptions.map((task) => (
          <div key={task.id} className="flex items-start gap-2 text-sm">
            {task.state === 'ESCALATED' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            )}
            <span>
              {task.spec?.description ?? task.id} — <span className="text-muted-foreground">{task.state.toLowerCase()}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
