'use client'

import { useState } from 'react'
import { getAuthHeaders } from '@/lib/auth-headers'

export function TaskFeedbackBox({ taskId, orgId }: { taskId: string; orgId: string }) {
  const [feedback, setFeedback] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    if (!feedback.trim() || sending) return

    setSending(true)
    setError('')

    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENGINE_URL}/api/orchestration/task-feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ orgId, taskId, feedback: feedback.trim() }),
        }
      )

      if (!res.ok) throw new Error('Failed to send feedback')

      setSent(true)
      setFeedback('')
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
    return <p className="inspect-feedback-sent">Feedback sent — rework in progress.</p>
  }

  return (
    <form onSubmit={handleSend} className="inspect-feedback-form">
      <textarea
        className="inspect-feedback-textarea"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Direct feedback to the worker..."
        disabled={sending}
      />
      {error && <p className="inspect-feedback-error">{error}</p>}
      <button
        type="submit"
        className="inspect-feedback-send"
        disabled={sending || !feedback.trim()}
      >
        {sending ? 'Sending...' : 'Send Feedback'}
      </button>
    </form>
  )
}
