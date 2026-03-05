'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls, useNodesState, useEdgesState,
  type Node, type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AgentNode, type AgentNodeData } from './agent-node'
import { AnimatedEdge } from './animated-edge'
import { getLayoutedElements } from '@/lib/elk-layout'
import { auditEventToNodeId, auditEventToEdge } from '@/lib/audit-to-node'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'

const nodeTypes = { agent: AgentNode }
const edgeTypes = { animated: AnimatedEdge }

const ORG_NODES: Array<{ id: string; role: string; label: string; model: string }> = [
  { id: 'board', role: 'Board', label: 'Board (Owner)', model: '—' },
  { id: 'ceo', role: 'CEO', label: 'CEO', model: 'Opus 4.6' },
  { id: 'advisor', role: 'Advisor', label: 'Advisor', model: 'Opus 4.6' },
  { id: 'scribe', role: 'Scribe', label: 'Scribe', model: 'Sonnet 4.6' },
  { id: 'reviewer', role: 'Reviewer', label: 'Reviewer', model: 'Sonnet 4.6' },
  { id: 'judge', role: 'Judge', label: 'Judge', model: 'Opus 4.6' },
  { id: 'curator', role: 'Curator', label: 'Curator', model: 'Sonnet 4.6' },
  { id: 'dispatcher', role: 'Dispatcher', label: 'Dispatcher', model: 'Sonnet 4.6' },
]

const ORG_EDGES: Array<{ id: string; source: string; target: string }> = [
  { id: 'board-ceo', source: 'board', target: 'ceo' },
  { id: 'board-advisor', source: 'board', target: 'advisor' },
  { id: 'ceo-scribe', source: 'ceo', target: 'scribe' },
  { id: 'ceo-reviewer', source: 'ceo', target: 'reviewer' },
  { id: 'ceo-judge', source: 'ceo', target: 'judge' },
  { id: 'ceo-curator', source: 'ceo', target: 'curator' },
  { id: 'ceo-dispatcher', source: 'ceo', target: 'dispatcher' },
]

const NODE_WIDTH = 160
const NODE_HEIGHT = 70

export function OrgChart({ orgId, compact = false }: { orgId: string; compact?: boolean }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [initialized, setInitialized] = useState(false)
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Initialize layout
  useEffect(() => {
    async function layout() {
      // Fetch active workers
      const supabase = createClient()
      const { data: activeTasks } = await supabase
        .from('tasks')
        .select('assigned_worker, role')
        .eq('org_id', orgId)
        .in('state', ['DISPATCHED', 'IN_PROGRESS', 'REVIEW', 'JUDGMENT', 'REVISION', 'POLISH'])

      const workerSet = new Map<string, string>()
      for (const t of activeTasks ?? []) {
        if (t.assigned_worker && !workerSet.has(t.assigned_worker)) {
          workerSet.set(t.assigned_worker, t.role)
        }
      }

      const allNodes = [
        ...ORG_NODES.map(n => ({ id: n.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
        ...Array.from(workerSet.keys()).map(w => ({ id: w, width: NODE_WIDTH, height: NODE_HEIGHT })),
      ]
      const allEdges = [
        ...ORG_EDGES.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] })),
        ...Array.from(workerSet.keys()).map(w => ({
          id: `dispatcher-${w}`,
          sources: ['dispatcher'],
          targets: [w],
        })),
      ]

      const positions = await getLayoutedElements(allNodes, allEdges)

      const flowNodes: Node[] = [
        ...ORG_NODES.map(n => ({
          id: n.id,
          type: 'agent' as const,
          position: positions.get(n.id) ?? { x: 0, y: 0 },
          data: { role: n.role, label: n.label, model: n.model, status: 'idle' } satisfies AgentNodeData,
        })),
        ...Array.from(workerSet.entries()).map(([id, role]) => ({
          id,
          type: 'agent' as const,
          position: positions.get(id) ?? { x: 0, y: 0 },
          data: { role: 'Worker', label: id, model: 'Sonnet 4.6', status: 'active' as const, currentTask: role } satisfies AgentNodeData,
        })),
      ]

      const flowEdges: Edge[] = [
        ...ORG_EDGES.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'animated' as const,
          data: { animated: false },
        })),
        ...Array.from(workerSet.keys()).map(w => ({
          id: `dispatcher-${w}`,
          source: 'dispatcher',
          target: w,
          type: 'animated' as const,
          data: { animated: false },
        })),
      ]

      setNodes(flowNodes)
      setEdges(flowEdges)
      setInitialized(true)
    }
    layout()
  }, [orgId, setNodes, setEdges])

  // Handle real-time audit events
  const handleAuditEvent = useCallback((payload: { new?: Record<string, unknown> }) => {
    const event = payload.new as { event_type?: string; agent?: string } | undefined
    if (!event?.event_type) return

    const nodeId = auditEventToNodeId(event.event_type)
    const edgeId = auditEventToEdge(event.event_type)

    // Activate node
    if (nodeId) {
      setNodes(nds => nds.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, status: 'active' } } : n
      ))

      // Clear existing timer
      const existingTimer = timersRef.current.get(nodeId)
      if (existingTimer) clearTimeout(existingTimer)

      // Revert after 3s
      const timer = setTimeout(() => {
        setNodes(nds => nds.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, status: 'idle' } } : n
        ))
        timersRef.current.delete(nodeId)
      }, 3000)
      timersRef.current.set(nodeId, timer)
    }

    // Animate edge
    if (edgeId) {
      setEdges(eds => eds.map(e =>
        e.id === edgeId ? { ...e, data: { ...e.data, animated: true } } : e
      ))

      const edgeTimer = setTimeout(() => {
        setEdges(eds => eds.map(e =>
          e.id === edgeId ? { ...e, data: { ...e.data, animated: false } } : e
        ))
      }, 3000)
      timersRef.current.set(`edge-${edgeId}`, edgeTimer)
    }
  }, [setNodes, setEdges])

  useRealtime({
    table: 'audit_log',
    filter: `org_id=eq.${orgId}`,
    event: 'INSERT',
    onPayload: handleAuditEvent,
  })

  // Clean up timers
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer))
    }
  }, [])

  if (!initialized) {
    return <div className={`flex ${compact ? 'h-full' : 'h-[600px]'} items-center justify-center text-muted-foreground`}>Loading org chart...</div>
  }

  return (
    <div className={`${compact ? 'h-full' : 'h-[600px]'} w-full rounded-lg border`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        {!compact && <Controls />}
      </ReactFlow>
    </div>
  )
}
