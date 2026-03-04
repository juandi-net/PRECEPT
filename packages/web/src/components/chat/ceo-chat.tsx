'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'owner' | 'ceo'
  content: string
  created_at: string
}

export function CeoChat({ orgId }: { orgId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load history
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('ceo_chat_messages')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at')
      .then(({ data }) => { if (data) setMessages(data) })
  }, [orgId])

  // Real-time subscription
  const handlePayload = useCallback(() => {
    const supabase = createClient()
    supabase
      .from('ceo_chat_messages')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at')
      .then(({ data }) => {
        if (data) {
          setMessages(data)
          setIsThinking(false)
        }
      })
  }, [orgId])

  useRealtime({
    table: 'ceo_chat_messages',
    filter: `org_id=eq.${orgId}`,
    onPayload: handlePayload,
  })

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isThinking) return

    const message = input.trim()
    setInput('')
    setIsThinking(true)

    try {
      await fetch(`${process.env.NEXT_PUBLIC_ENGINE_URL}/api/orchestration/ceo-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, message }),
      })
      // Real-time subscription will update messages
    } catch (err) {
      console.error('Failed to send chat message:', err)
      setIsThinking(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col">
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
          {messages.map((msg) => {
            const isOwner = msg.role === 'owner'
            return (
              <div key={msg.id} className={`flex ${isOwner ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    isOwner
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            )
          })}
          {isThinking && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-neutral-100 px-4 py-3">
                <p className="text-sm text-muted-foreground animate-pulse">CEO is thinking...</p>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSend} className="flex gap-2 border-t p-4">
        <Input
          placeholder="Type a message to the CEO..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isThinking}
        />
        <Button type="submit" size="icon" disabled={isThinking || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
