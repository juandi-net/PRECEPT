'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuthHeaders } from '@/lib/auth-headers'
import { InputBox } from './input-box'

interface RequestRef {
  type: 'escalation' | 'board_request'
  id: string
}

export function InterfaceSession({
  orgId,
  responseHtml,
  requestItems,
}: {
  orgId: string
  responseHtml: string | null
  requestItems: RequestRef[]
}) {
  const router = useRouter()
  const [followUp, setFollowUp] = useState<string | null>(null)
  const seenMessageIds = useRef(new Set<string>())
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mark headline items as read on mount
  useEffect(() => {
    if (requestItems.length === 0) return
    getAuthHeaders().then(authHeaders =>
      fetch(`${process.env.NEXT_PUBLIC_ENGINE_URL}/api/orchestration/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ items: requestItems }),
      })
    ).catch(() => {}) // fire-and-forget
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch latest CEO message — used as polling fallback and heartbeat refetch
  const refetchLatest = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('ceo_chat_messages')
      .select('id, content')
      .eq('org_id', orgId)
      .eq('role', 'ceo')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data && !seenMessageIds.current.has(data.id)) {
      seenMessageIds.current.add(data.id)
      setFollowUp(data.content)
      router.refresh()
    }
  }, [orgId, router])

  // Real-time subscriptions: CEO messages + task state changes
  useEffect(() => {
    const supabase = createClient()

    // --- CEO messages channel with reconnect handling ---
    const msgChannel = supabase
      .channel(`ceo-messages-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ceo_chat_messages',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; role: string; content: string }
          if (row.role !== 'ceo') return
          if (seenMessageIds.current.has(row.id)) return
          seenMessageIds.current.add(row.id)

          setFollowUp(row.content)
          router.refresh()

          // Clear heartbeat timer — a message arrived as expected
          if (heartbeatTimerRef.current) {
            clearTimeout(heartbeatTimerRef.current)
            heartbeatTimerRef.current = null
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Connected — stop polling fallback if running
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Disconnected — activate 5-second polling fallback
          if (!pollIntervalRef.current) {
            pollIntervalRef.current = setInterval(refetchLatest, 5_000)
          }
        }
      })

    // --- Task state changes channel ---
    const taskChannel = supabase
      .channel(`task-state-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const row = payload.new as { state: string }
          if (['ESCALATED', 'ACCEPTED', 'FAILED'].includes(row.state)) {
            router.refresh()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(taskChannel)
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      if (heartbeatTimerRef.current) {
        clearTimeout(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
    }
  }, [orgId, router, refetchLatest])

  // Owner presence heartbeat — 5s interval when tab is visible
  useEffect(() => {
    const supabase = createClient()
    let intervalId: ReturnType<typeof setInterval> | null = null

    const sendHeartbeat = () => {
      supabase
        .from('orgs')
        .update({ owner_last_seen_at: new Date().toISOString() })
        .eq('id', orgId)
        .then() // fire-and-forget
    }

    const startHeartbeat = () => {
      if (intervalId) return
      sendHeartbeat() // immediate first pulse
      intervalId = setInterval(sendHeartbeat, 5_000)
    }

    const stopHeartbeat = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startHeartbeat()
      } else {
        stopHeartbeat()
      }
    }

    // Start immediately if tab is visible
    if (document.visibilityState === 'visible') {
      startHeartbeat()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopHeartbeat()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [orgId])

  // Heartbeat: after owner sends, if no realtime message within 60s, refetch
  const handleSendStart = useCallback(() => {
    if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current)
    heartbeatTimerRef.current = setTimeout(() => {
      refetchLatest()
      heartbeatTimerRef.current = null
    }, 60_000)
  }, [refetchLatest])

  const handleSendComplete = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <InputBox
      orgId={orgId}
      responseHtml={responseHtml}
      followUp={followUp}
      onSendStart={handleSendStart}
      onSendComplete={handleSendComplete}
    />
  )
}
