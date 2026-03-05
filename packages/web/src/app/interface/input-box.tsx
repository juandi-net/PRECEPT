'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function InputBox({ orgId }: { orgId: string }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || sending) return

    setSending(true)
    setError('')

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENGINE_URL}/api/orchestration/ceo-chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId, message: message.trim() }),
        }
      )

      if (!res.ok) throw new Error('Failed to send message')

      setMessage('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSend}>
      <textarea
        className="interface-textarea"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder=""
        disabled={sending}
      />
      {error && <p className="interface-error">{error}</p>}
      <button
        type="submit"
        className="interface-send"
        disabled={sending || !message.trim()}
      >
        {sending ? 'Sending...' : 'Send'}
      </button>
    </form>
  )
}
