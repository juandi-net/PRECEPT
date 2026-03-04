'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'

export function EngineStatus() {
  const [connected, setConnected] = useState(true)
  const [lastCycle, setLastCycle] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase.channel('connection-health')
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    supabase
      .from('audit_log')
      .select('created_at')
      .like('event_type', 'ceo.planning%')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setLastCycle(data.created_at)
      })

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span>Engine: {connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      {lastCycle && (
        <p>Last cycle: {formatDistanceToNow(new Date(lastCycle), { addSuffix: true })}</p>
      )}
    </div>
  )
}
