'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatDistanceToNow } from 'date-fns'

interface AuditEvent {
  id: string
  event_type: string
  agent: string
  detail: Record<string, unknown> | null
  tokens_used: number | null
  created_at: string
}

const ROLE_COLORS: Record<string, string> = {
  CEO: 'bg-blue-100 text-blue-800',
  Advisor: 'bg-purple-100 text-purple-800',
  Scribe: 'bg-gray-100 text-gray-800',
  Curator: 'bg-gray-100 text-gray-800',
  Dispatcher: 'bg-orange-100 text-orange-800',
  Reviewer: 'bg-teal-100 text-teal-800',
  Judge: 'bg-red-100 text-red-800',
  Worker: 'bg-green-100 text-green-800',
}

const ROLES = ['All', 'CEO', 'Advisor', 'Scribe', 'Curator', 'Dispatcher', 'Reviewer', 'Judge', 'Worker']
const EVENT_TYPES = ['All', 'planning', 'dispatch', 'worker', 'review', 'judge', 'briefing', 'owner', 'ceo']

function getRoleBadgeColor(agent: string): string {
  for (const [role, color] of Object.entries(ROLE_COLORS)) {
    if (agent.toLowerCase().includes(role.toLowerCase())) return color
  }
  return 'bg-gray-100 text-gray-800'
}

function getRoleFromAgent(agent: string): string {
  for (const role of Object.keys(ROLE_COLORS)) {
    if (agent.toLowerCase().includes(role.toLowerCase())) return role
  }
  return agent
}

const PAGE_SIZE = 50

export function AuditLog({ orgId }: { orgId: string }) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  const fetchEvents = useCallback(async (reset = false) => {
    const supabase = createClient()
    const currentOffset = reset ? 0 : offset

    let query = supabase
      .from('audit_log')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1)

    if (roleFilter !== 'All') {
      query = query.ilike('agent', `%${roleFilter}%`)
    }
    if (typeFilter !== 'All') {
      query = query.ilike('event_type', `${typeFilter}%`)
    }
    if (search) {
      query = query.ilike('event_type', `%${search}%`)
    }

    const { data } = await query
    if (data) {
      if (reset) {
        setEvents(data)
        setOffset(PAGE_SIZE)
      } else {
        setEvents(prev => [...prev, ...data])
        setOffset(currentOffset + PAGE_SIZE)
      }
      setHasMore(data.length === PAGE_SIZE)
    }
  }, [orgId, roleFilter, typeFilter, search, offset])

  // Initial load + refetch on filter change
  useEffect(() => {
    setOffset(0)
    fetchEvents(true)
  }, [orgId, roleFilter, typeFilter, search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time: prepend new events
  const handleNewEvent = useCallback((payload: { new?: Record<string, unknown> }) => {
    const newEvent = payload.new as AuditEvent | undefined
    if (newEvent) {
      setEvents(prev => [newEvent, ...prev])
      setNewIds(prev => new Set(prev).add(newEvent.id))
      setTimeout(() => {
        setNewIds(prev => {
          const next = new Set(prev)
          next.delete(newEvent.id)
          return next
        })
      }, 2000)
    }
  }, [])

  useRealtime({
    table: 'audit_log',
    filter: `org_id=eq.${orgId}`,
    event: 'INSERT',
    onPayload: handleNewEvent,
  })

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Input
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48"
        />
      </div>

      {/* Log entries */}
      <div className="space-y-1">
        {events.map((event) => (
          <div key={event.id}>
            <button
              onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                newIds.has(event.id) ? 'animate-fade-in bg-muted/50' : ''
              }`}
            >
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
              </span>
              <Badge className={`shrink-0 ${getRoleBadgeColor(event.agent)}`}>
                {getRoleFromAgent(event.agent)}
              </Badge>
              <span className="flex-1 truncate">{event.event_type}</span>
              {event.tokens_used && (
                <span className="text-xs text-muted-foreground">{event.tokens_used} tok</span>
              )}
            </button>
            {expandedId === event.id && event.detail && (
              <div className="mx-3 mb-2 rounded-md bg-muted/30 p-3">
                <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-48">
                  {JSON.stringify(event.detail, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <Button variant="outline" className="w-full" onClick={() => fetchEvents(false)}>
          Load more
        </Button>
      )}

      {events.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No audit events found.</p>
      )}
    </div>
  )
}
