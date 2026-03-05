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

  // Get latest proactive CEO letter (briefing or escalation)
  const { data: latestLetter } = await supabase
    .from('ceo_chat_messages')
    .select('content, created_at')
    .eq('org_id', org.id)
    .eq('role', 'ceo')
    .in('type', ['briefing', 'escalation'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Get latest owner message to check if they've responded
  const { data: latestOwnerMsg } = await supabase
    .from('ceo_chat_messages')
    .select('created_at')
    .eq('org_id', org.id)
    .eq('role', 'owner')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Show letter only if it exists and owner hasn't responded after it
  const ownerResponded = latestLetter && latestOwnerMsg
    && new Date(latestOwnerMsg.created_at) > new Date(latestLetter.created_at)
  const latestMessage = ownerResponded ? null : latestLetter

  const { data: precepts } = await supabase
    .from('precepts')
    .select('content')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const missionField = (precepts?.content as Record<string, unknown>)
    ?.mission_statement as { content?: string } | undefined
  const mission = missionField?.content ?? null

  const letterHtml = latestMessage
    ? parseMarkdownLinks(latestMessage.content)
    : 'Nothing to report.'

  const dateStr = format(new Date(), 'MMMM d, yyyy')

  return (
    <div className="interface-page">
      <div className="interface-header">
        <span><strong>{org.name.toUpperCase()}</strong></span>
        {mission && (
          <span className="interface-mission"><strong>{mission}</strong></span>
        )}
        <span><strong>{dateStr}</strong></span>
      </div>
      <div className="interface-center">
        <div className="interface-content">
          <div
            className="interface-letter"
            dangerouslySetInnerHTML={{ __html: letterHtml }}
          />
          <InputBox orgId={org.id} />
        </div>
      </div>
    </div>
  )
}
