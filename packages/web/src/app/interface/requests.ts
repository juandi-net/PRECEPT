import type { EscalationDiagnosis } from '@precept/shared'
import { escapeHtml } from './parse'

function firstSentence(text: string, maxLen = 120): string {
  const match = text.match(/^[^.!?]+[.!?]/)
  if (match) return match[0].length <= maxLen ? match[0] : match[0].slice(0, maxLen - 1) + '…'
  return text.length <= maxLen ? text : text.slice(0, maxLen - 1) + '…'
}

export interface RequestItem {
  type: 'escalation' | 'board_request'
  id: string
  html: string
}

export function escalationRequest(
  id: string,
  title: string,
  diagnosis: EscalationDiagnosis,
): RequestItem {
  const snippet = firstSentence(diagnosis.reasoning)
  return {
    type: 'escalation',
    id,
    html: `Need your input: <a href="/inspect/task/${id}">${escapeHtml(title)}</a> — ${escapeHtml(snippet)}`,
  }
}

export function boardRequest(
  id: string,
  content: string,
): RequestItem {
  const snippet = firstSentence(content)
  return {
    type: 'board_request',
    id,
    html: `Decision needed: <a href="/inspect/board-request/${id}">${escapeHtml(snippet)}</a>`,
  }
}
