'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { TaskDetail } from './task-detail'

interface Task {
  id: string
  state: string
  role: string
  assigned_worker: string | null
  spec: Record<string, unknown> | null
  output: Record<string, unknown> | null
}

const STATE_COLORS: Record<string, string> = {
  PLANNED: 'bg-gray-100 text-gray-800',
  QUEUED: 'bg-gray-100 text-gray-800',
  DISPATCHED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  REVIEW: 'bg-teal-100 text-teal-800',
  JUDGMENT: 'bg-teal-100 text-teal-800',
  POLISH: 'bg-yellow-100 text-yellow-800',
  REVISION: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  ESCALATED: 'bg-red-100 text-red-800',
  FAILED: 'bg-red-100 text-red-800',
}

export function TaskTable({ tasks }: { tasks: Task[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-1">
      {tasks.map((task) => {
        const description = (task.spec as Record<string, string> | null)?.description ?? task.id.slice(0, 8)
        const isExpanded = expandedId === task.id

        return (
          <div key={task.id}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : task.id)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <span className="flex-1 truncate">{description}</span>
              <Badge className={STATE_COLORS[task.state] ?? 'bg-gray-100 text-gray-800'}>
                {task.state}
              </Badge>
              {task.assigned_worker && (
                <span className="text-xs text-muted-foreground">{task.assigned_worker}</span>
              )}
            </button>
            {isExpanded && (
              <div className="ml-3 mt-1 mb-2">
                <TaskDetail taskId={task.id} spec={task.spec} output={task.output} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
