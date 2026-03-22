'use client'

import { useState, useEffect, useRef } from 'react'
import { getAuthHeaders } from '@/lib/auth-headers'
import { parseMarkdown } from './parse'

interface InputBoxProps {
  orgId: string
  responseHtml: string | null
  followUp: string | null
  onSendStart: () => void
  onSendComplete: () => void
}

export function InputBox({ orgId, responseHtml, followUp, onSendStart, onSendComplete }: InputBoxProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [response, setResponse] = useState<string | null>(null)
  const [dotCount, setDotCount] = useState(0)
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!sending) return
    setDotCount(0)
    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4)
    }, 400)
    return () => clearInterval(interval)
  }, [sending])

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    if (!message.trim() || sending) return

    const text = message.trim()
    const attachedFiles = [...files]
    setSending(true)
    setError('')
    setMessage('')
    setFiles([])

    onSendStart()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90_000)

    try {
      const attachments = await Promise.all(
        attachedFiles.map(async (file) => {
          const buffer = await file.arrayBuffer()
          const base64 = btoa(
            new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), '')
          )
          return { filename: file.name, mediaType: file.type, base64 }
        })
      )

      const authHeaders = await getAuthHeaders()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENGINE_URL}/api/orchestration/ceo-chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            orgId,
            message: text,
            ...(attachments.length > 0 && { attachments }),
          }),
          signal: controller.signal,
        }
      )
      clearTimeout(timeout)

      if (!res.ok) throw new Error('Failed to send message')

      const data = await res.json()
      setResponse(data.response ?? null)
      if (navigator.vibrate) navigator.vibrate(50)

      if (data.response) {
        onSendComplete()
      }
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Still waiting for a response...')
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    } finally {
      setSending(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length > 0) {
      setFiles((prev) => [...prev, ...selected])
    }
    e.target.value = ''
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // CEO response: followUp (polled) > inline response > server-rendered responseHtml
  const rawHtml = followUp
    ? parseMarkdown(followUp)
    : response
      ? parseMarkdown(response)
      : responseHtml
  // Belt-and-suspenders: if resolved HTML is empty/whitespace (e.g. stale cache),
  // fall back so the user never sees a blank page.
  const displayHtml =
    rawHtml && rawHtml.replace(/<[^>]*>/g, '').trim()
      ? rawHtml
      : '<p>Nothing to report.</p>'

  return (
    <form onSubmit={handleSend}>
      <div
        className="interface-letter"
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />
      <textarea
        className="interface-textarea"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder=""
        disabled={sending}
      />
      {files.length > 0 && (
        <div className="interface-file-chips">
          {files.map((file, i) => (
            <span key={`${file.name}-${i}`} className="interface-file-chip">
              {file.name}
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="interface-file-chip-remove"
                aria-label={`Remove ${file.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {error && <p className="interface-error">{error}</p>}
      <div className="interface-input-footer">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="interface-attach"
          >
            Attach
          </button>
        </div>
        <button
          type="submit"
          className="interface-send"
          disabled={sending || !message.trim()}
        >
          {sending ? (
            <span className="thinking-text">
              Thinking
              <span className={dotCount >= 1 ? 'thinking-dot-on' : 'thinking-dot-off'}>.</span>
              <span className={dotCount >= 2 ? 'thinking-dot-on' : 'thinking-dot-off'}>.</span>
              <span className={dotCount >= 3 ? 'thinking-dot-on' : 'thinking-dot-off'}>.</span>
            </span>
          ) : 'Send'}
        </button>
      </div>
    </form>
  )
}
