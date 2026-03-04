'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { getInitiativeHealth, type HealthColor } from '@/lib/health'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Initiative {
  id: string
  name: string
  status: string
  phase_current: number
}

interface Task {
  id: string
  state: string
  initiative_id: string
}

const HEALTH_DOT: Record<HealthColor, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
}

export function InitiativeCards({ orgId }: { orgId: string }) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  const fetchData = useCallback(() => {
    const supabase = createClient()
    supabase
      .from('initiatives')
      .select('id, name, status, phase_current')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .then(({ data }) => { if (data) setInitiatives(data) })
    supabase
      .from('tasks')
      .select('id, state, initiative_id')
      .eq('org_id', orgId)
      .then(({ data }) => { if (data) setTasks(data) })
  }, [orgId])

  useEffect(() => { fetchData() }, [fetchData])

  useRealtime({ table: 'initiatives', filter: `org_id=eq.${orgId}`, onPayload: fetchData })
  useRealtime({ table: 'tasks', filter: `org_id=eq.${orgId}`, onPayload: fetchData })

  if (initiatives.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Initiatives
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {initiatives.map((init) => {
          const initTasks = tasks.filter(t => t.initiative_id === init.id)
          const health = getInitiativeHealth(initTasks, init.status)
          const accepted = initTasks.filter(t => t.state === 'ACCEPTED').length
          const total = initTasks.length

          return (
            <Link key={init.id} href={`/dashboard/${init.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{init.name}</CardTitle>
                    <span className={`h-2.5 w-2.5 rounded-full ${HEALTH_DOT[health]}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Phase {init.phase_current}
                  </p>
                  {total > 0 && (
                    <div className="mt-2">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>{accepted}/{total} tasks accepted</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary transition-all"
                          style={{ width: `${total > 0 ? (accepted / total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
