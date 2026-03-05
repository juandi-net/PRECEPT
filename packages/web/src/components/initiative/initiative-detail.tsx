'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { getInitiativeHealth } from '@/lib/health'
import { TaskTable } from './task-table'
import { formatDistanceToNow } from 'date-fns'

interface Initiative {
  id: string
  name: string
  status: string
  phase_current: number
  created_at: string
}

interface Task {
  id: string
  state: string
  role: string
  phase: number
  assigned_worker: string | null
  spec: Record<string, unknown> | null
  output: Record<string, unknown> | null
}

const HEALTH_DOT: Record<string, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
}

export function InitiativeDetail({ initiative }: { initiative: Initiative }) {
  const [tasks, setTasks] = useState<Task[]>([])

  const fetchTasks = useCallback(() => {
    const supabase = createClient()
    supabase
      .from('tasks')
      .select('id, state, role, phase, assigned_worker, spec, output')
      .eq('initiative_id', initiative.id)
      .order('phase')
      .order('created_at')
      .then(({ data }) => { if (data) setTasks(data) })
  }, [initiative.id])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  useRealtime({
    table: 'tasks',
    filter: `initiative_id=eq.${initiative.id}`,
    onPayload: fetchTasks,
  })

  const health = getInitiativeHealth(tasks, initiative.status)

  // Group tasks by phase
  const phases = new Map<number, Task[]>()
  for (const task of tasks) {
    const existing = phases.get(task.phase) ?? []
    existing.push(task)
    phases.set(task.phase, existing)
  }

  return (
    <div className="space-y-6">
      {/* Initiative Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{initiative.name}</h1>
          <span className={`h-3 w-3 rounded-full ${HEALTH_DOT[health]}`} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Phase {initiative.phase_current} &middot; {initiative.status} &middot;
          Created {formatDistanceToNow(new Date(initiative.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Phase Sections */}
      {Array.from(phases.entries())
        .sort(([a], [b]) => a - b)
        .map(([phase, phaseTasks]) => {
          const accepted = phaseTasks.filter(t => t.state === 'ACCEPTED').length
          return (
            <section key={phase}>
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Phase {phase}
                <span className="ml-2 text-xs">
                  ({accepted}/{phaseTasks.length} accepted)
                </span>
              </h2>
              <TaskTable tasks={phaseTasks} />
            </section>
          )
        })}

      {tasks.length === 0 && (
        <p className="text-sm text-muted-foreground">No tasks created yet.</p>
      )}
    </div>
  )
}
