'use client'

import { useState, useEffect } from 'react'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseMarkdownLinks(text: string): string {
  return escapeHtml(text).replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>'
  )
}

export function InputBox({ orgId }: { orgId: string }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [response, setResponse] = useState<string | null>(null)
  const [dotCount, setDotCount] = useState(1)

  useEffect(() => {
    if (!sending) return
    setDotCount(1)
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1)
    }, 500)
    return () => clearInterval(interval)
  }, [sending])

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
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

      const data = await res.json()
      setResponse(data.response ?? null)
      setMessage('')
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

  return (
    <form onSubmit={handleSend}>
      {response && (
        <div
          className="interface-letter interface-response"
          dangerouslySetInnerHTML={{ __html: parseMarkdownLinks(response) }}
        />
      )}
      <textarea
        className="interface-textarea"
        value={message}
        onChange={(e) => {
          setMessage(e.target.value)
          if (response) setResponse(null)
        }}
        onKeyDown={handleKeyDown}
        placeholder=""
        disabled={sending}
      />
      {error && <p className="interface-error">{error}</p>}
      <button
        type="submit"
        className="interface-send"
        disabled={sending || !message.trim()}
      >
        {sending ? `Thinking${'.'.repeat(dotCount)}` : 'Send'}
      </button>
    </form>
  )
}
