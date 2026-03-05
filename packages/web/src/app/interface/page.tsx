import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { InputBox } from './input-box'
import './interface.css'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseMarkdownLinks(text: string): string {
  // HTML-escape first to prevent XSS from LLM output, then convert markdown links
  return escapeHtml(text).replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>'
  )
}

export default async function InterfacePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('orgs')
    .select('id, name')
    .single()

  if (!org) redirect('/onboarding')

  const { data: latestMessage } = await supabase
    .from('ceo_chat_messages')
    .select('content, created_at')
    .eq('org_id', org.id)
    .eq('role', 'ceo')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const letterHtml = latestMessage
    ? parseMarkdownLinks(latestMessage.content)
    : 'No letters yet. Send a message to get started.'

  const dateStr = format(new Date(), 'MMMM d, yyyy')

  return (
    <div className="interface-page">
      <div className="interface-header">
        <span>{org.name.toUpperCase()}</span>
        <span>{dateStr}</span>
      </div>
      <div
        className="interface-letter"
        dangerouslySetInnerHTML={{ __html: letterHtml }}
      />
      <InputBox orgId={org.id} />
    </div>
  )
}
