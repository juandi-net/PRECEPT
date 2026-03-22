export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { OrgSwitcher } from '@/components/org-switcher'
import { InterfaceSession } from './interface-session'
import { NewsTicker } from './news-ticker'
import { PullToRefresh } from './pull-to-refresh'
import { parseMarkdown } from './parse'
import { escalationRequest, boardRequest, type RequestItem } from './requests'
import type { EscalationDiagnosis } from '@precept/shared'
import './interface.css'

export default async function InterfacePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgs } = await supabase
    .from('orgs')
    .select('id, name')
    .order('created_at')

  if (!orgs || orgs.length === 0) redirect('/onboarding')

  const cookieStore = await cookies()
  const savedOrgId = cookieStore.get('active_org_id')?.value
  const org = orgs.find((o) => o.id === savedOrgId) ?? orgs[0]

  // --- Requests: escalated tasks + pending board requests ---
  const [{ data: escalatedTasks }, { data: pendingBoardRequests }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, spec, escalation_diagnosis')
      .eq('org_id', org.id)
      .eq('state', 'ESCALATED')
      .not('escalation_diagnosis', 'is', null)
      .order('updated_at', { ascending: false }),
    supabase
      .from('board_requests')
      .select('id, content')
      .eq('org_id', org.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ])

  const requests: RequestItem[] = [
    ...(escalatedTasks ?? []).map((t: Record<string, unknown>) => {
      const spec = t.spec as { title?: string; description?: string }
      const title = spec.title ?? spec.description ?? 'Untitled task'
      return escalationRequest(t.id as string, title, t.escalation_diagnosis as EscalationDiagnosis)
    }),
    ...(pendingBoardRequests ?? []).map((br: Record<string, unknown>) =>
      boardRequest(br.id as string, br.content as string)
    ),
  ]

  // --- CEO response: latest response to owner (not briefings, not escalations) ---
  const { data: latestResponse } = await supabase
    .from('ceo_chat_messages')
    .select('content, created_at')
    .eq('org_id', org.id)
    .eq('role', 'ceo')
    .eq('type', 'response')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Check if owner has sent a message after the latest response
  const { data: latestOwnerMsg } = await supabase
    .from('ceo_chat_messages')
    .select('created_at')
    .eq('org_id', org.id)
    .eq('role', 'owner')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Only show response if it's newer than the owner's last message (clean slate)
  const showResponse = latestResponse && (
    !latestOwnerMsg || new Date(latestResponse.created_at) > new Date(latestOwnerMsg.created_at)
  )
  const responseHtml = showResponse ? parseMarkdown(latestResponse.content) : null

  const { data: cornerstone } = await supabase
    .from('cornerstone')
    .select('content')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const missionField = (cornerstone?.content as Record<string, unknown>)
    ?.mission_statement as { content?: string } | undefined
  const mission = missionField?.content ?? null

  const dateStr = format(new Date(), 'MMMM d, yyyy')

  return (
    <div className="interface-page">
      <div className="interface-header">
        <OrgSwitcher orgs={orgs} activeOrg={org} />
        {mission && (
          <span className="interface-mission"><strong>{mission}</strong></span>
        )}
        <span><strong>{dateStr}</strong></span>
      </div>
      <PullToRefresh targetSelector=".interface-center" />
      <div className="interface-center">
        <div className="interface-content">
          {requests.length > 0 && (
            <details className="interface-requests">
              <summary className="interface-requests-summary">
                {requests.length} {requests.length === 1 ? 'decision' : 'decisions'} needed
              </summary>
              {requests.map((r) => (
                <p key={r.id} className="interface-request" dangerouslySetInnerHTML={{ __html: r.html }} />
              ))}
            </details>
          )}
          <InterfaceSession
            orgId={org.id}
            responseHtml={responseHtml}
            requestItems={requests.map(r => ({ type: r.type, id: r.id }))}
          />
        </div>
      </div>
      <NewsTicker orgId={org.id} />
    </div>
  )
}
