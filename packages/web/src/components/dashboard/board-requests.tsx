'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

interface BoardRequest {
  id: string
  content: string
  context: string | null
  urgency: string
  fallback: string | null
  status: string
  created_at: string
}

const URGENCY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'secondary',
  medium: 'default',
  high: 'destructive',
}

export function BoardRequests({ orgId }: { orgId: string }) {
  const [requests, setRequests] = useState<BoardRequest[]>([])
  const [responding, setResponding] = useState<BoardRequest | null>(null)
  const [response, setResponse] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('board_requests')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .order('created_at')
      .then(({ data }) => {
        if (data) setRequests(data)
      })
  }, [orgId])

  const handlePayload = useCallback(() => {
    // Refetch on any change
    const supabase = createClient()
    supabase
      .from('board_requests')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .order('created_at')
      .then(({ data }) => {
        if (data) setRequests(data)
      })
  }, [orgId])

  useRealtime({
    table: 'board_requests',
    filter: `org_id=eq.${orgId}`,
    onPayload: handlePayload,
  })

  async function handleSubmitResponse() {
    if (!responding || !response.trim()) return
    setSubmitting(true)

    try {
      await fetch(`${process.env.NEXT_PUBLIC_ENGINE_URL}/api/orchestration/board-requests/${responding.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, response: response.trim() }),
      })
      setResponding(null)
      setResponse('')
    } catch (err) {
      console.error('Failed to respond to board request:', err)
    } finally {
      setSubmitting(false)
    }
  }

  if (requests.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Board Requests
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {requests.map((req, i) => (
          <Card key={req.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">#{i + 1}</CardTitle>
                <Badge variant={URGENCY_VARIANT[req.urgency] ?? 'secondary'}>
                  {req.urgency}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <p className="text-sm">{req.content}</p>
              {req.context && (
                <p className="mt-1 text-xs text-muted-foreground">{req.context}</p>
              )}
            </CardContent>
            <CardFooter>
              <Button size="sm" variant="outline" onClick={() => setResponding(req)}>
                Respond
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={!!responding} onOpenChange={(open) => { if (!open) setResponding(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Board Request</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{responding?.content}</p>
          {responding?.fallback && (
            <p className="text-xs text-muted-foreground">
              Fallback if no response: {responding.fallback}
            </p>
          )}
          <Textarea
            placeholder="Your response..."
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSubmitResponse} disabled={submitting || !response.trim()}>
              {submitting ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
