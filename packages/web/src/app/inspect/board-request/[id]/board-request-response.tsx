'use client'

import { useState } from 'react'
import { getAuthHeaders } from '@/lib/auth-headers'

export function BoardRequestResponse({ requestId, orgId }: { requestId: string; orgId: string }) {
  const [response, setResponse] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    if (!response.trim() || sending) return

    setSending(true)
    setError('')

    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENGINE_URL}/api/orchestration/board-requests/${requestId}/respond`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ orgId, response: response.trim() }),
        }
      )

      if (!res.ok) throw new Error('Failed to send response')

      setSent(true)
      setResponse('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (sent) {
    return <p className="inspect-feedback-sent">Response sent.</p>
  }

  return (
    <form onSubmit={handleSend} className="inspect-feedback-form">
      <textarea
        className="inspect-feedback-textarea"
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Your response to this board request..."
        disabled={sending}
      />
      {error && <p className="inspect-feedback-error">{error}</p>}
      <button
        type="submit"
        className="inspect-feedback-send"
        disabled={sending || !response.trim()}
      >
        {sending ? 'Sending...' : 'Send Response'}
      </button>
    </form>
  )
}
