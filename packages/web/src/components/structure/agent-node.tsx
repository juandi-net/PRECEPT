'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

const ROLE_BORDER: Record<string, string> = {
  Board: 'border-yellow-500',
  CEO: 'border-blue-500',
  Advisor: 'border-purple-500',
  Scribe: 'border-gray-400',
  Curator: 'border-gray-400',
  Dispatcher: 'border-orange-500',
  Reviewer: 'border-teal-500',
  Judge: 'border-red-500',
  Worker: 'border-green-500',
}

export interface AgentNodeData {
  role: string
  label: string
  model: string
  status: 'idle' | 'active' | 'waiting'
  currentTask?: string
  [key: string]: unknown
}

export const AgentNode = memo(function AgentNode({ data }: NodeProps) {
  const d = data as AgentNodeData
  const borderColor = ROLE_BORDER[d.role] ?? 'border-gray-300'

  return (
    <>
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div
        className={`rounded-lg border-2 bg-background px-4 py-3 shadow-sm transition-all ${borderColor} ${
          d.status === 'idle' ? 'opacity-50' : ''
        } ${
          d.status === 'active' ? 'shadow-md' : ''
        } ${
          d.status === 'waiting' ? 'border-dashed' : ''
        }`}
        style={d.status === 'active' ? {
          animation: 'pulse-glow 2s ease-in-out infinite',
        } : undefined}
      >
        <p className="font-semibold text-sm">{d.label}</p>
        <p className="text-xs text-muted-foreground">{d.model}</p>
        {d.currentTask && (
          <p className="text-xs mt-1 truncate max-w-[140px]">{d.currentTask}</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </>
  )
})
