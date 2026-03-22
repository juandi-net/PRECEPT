import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { TaskFeedbackBox } from './task-feedback'
import './inspect-task.css'

export const dynamic = 'force-dynamic'

function OutputRenderer({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w*)\n?([\s\S]*?)```/)
          const code = match?.[2]?.trim() ?? part
          return (
            <pre key={i} className="inspect-code-block">
              <code>{code}</code>
            </pre>
          )
        }

        const withLinks = part.split(/(https?:\/\/[^\s)]+)/g)
        return (
          <p key={i} className="inspect-output-text">
            {withLinks.map((segment, j) =>
              segment.match(/^https?:\/\//) ? (
                <a key={j} href={segment} target="_blank" rel="noopener noreferrer" className="inspect-link">
                  {segment}
                </a>
              ) : (
                segment
              )
            )}
          </p>
        )
      })}
    </>
  )
}

export default async function InspectTaskPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (!task) {
    return (
      <div className="inspect-page">
        <div className="inspect-container">
          <div className="inspect-not-found">
            <h1 className="inspect-title">Task not found</h1>
            <a href="/interface" className="inspect-back">Back to Interface</a>
          </div>
        </div>
      </div>
    )
  }

  const { data: transitions } = await supabase
    .from('task_transitions')
    .select('*')
    .eq('task_id', id)
    .order('created_at', { ascending: true })

  const spec = task.spec as { title?: string; description?: string; acceptance_criteria?: string[] }
  const output = task.output as { output?: string } | null
  const skillsLoaded = (task.skills_loaded as string[]) ?? []
  const escalationDiagnosis = task.escalation_diagnosis as {
    type?: string
    reasoning?: string
    action?: Record<string, unknown>
  } | null

  let initiativeName: string | null = null
  if (task.initiative_id) {
    const { data: initiative } = await supabase
      .from('initiatives')
      .select('name')
      .eq('id', task.initiative_id)
      .single()
    initiativeName = initiative?.name ?? null
  }

  const latestReason = transitions?.length
    ? transitions[transitions.length - 1].reason
    : null

  const reviewStates = new Set(['REVIEW', 'JUDGMENT', 'REVISION', 'POLISH', 'ACCEPTED', 'ESCALATED'])
  const reviewTransitions = (transitions ?? []).filter(
    (t: any) => reviewStates.has(t.to_state) && t.reason
  )

  return (
    <div className="inspect-page">
      <div className="inspect-container">
        <a href="/interface" className="inspect-back-top">← Back</a>

        <h1 className="inspect-title">{spec.title ?? `Task ${id}`}</h1>

        <div className="inspect-meta">
          <span className="inspect-status-badge" data-state={task.state}>{task.state}</span>
          <span className="inspect-role">{task.role}</span>
          {initiativeName && <span className="inspect-role">{initiativeName}</span>}
        </div>

        {escalationDiagnosis && (
          <div className="inspect-detail-section">
            <div className="inspect-label">
              Escalation — {escalationDiagnosis.type?.replace(/_/g, ' ')}
            </div>
            <p className="inspect-value">{escalationDiagnosis.reasoning}</p>
          </div>
        )}

        <div className="inspect-output">
          {output?.output ? (
            <OutputRenderer content={output.output} />
          ) : (
            <p className="inspect-empty">No output yet</p>
          )}
        </div>

        {latestReason && (
          <p className="inspect-latest-reason">{latestReason}</p>
        )}

        <TaskFeedbackBox taskId={task.id} orgId={task.org_id} />

        <details className="inspect-full-details">
          <summary>Show full details</summary>

          <div className="inspect-detail-section">
            <div className="inspect-label">Description</div>
            <p className="inspect-value">{spec.description ?? 'No description'}</p>
          </div>

          {spec.acceptance_criteria && spec.acceptance_criteria.length > 0 && (
            <div className="inspect-detail-section">
              <div className="inspect-label">Acceptance criteria</div>
              <ul className="inspect-criteria-list">
                {spec.acceptance_criteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {reviewTransitions.length > 0 && (
            <div className="inspect-detail-section">
              <div className="inspect-label">Review history</div>
              {reviewTransitions.map((t: any) => (
                <div key={t.id} className="inspect-review-entry">
                  <span className="inspect-review-agent">{t.agent_id}</span>
                  <span className="inspect-review-reason">{t.reason}</span>
                  <span className="inspect-transition-time">
                    {' '}{format(new Date(t.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="inspect-detail-section">
            <div className="inspect-label">State transitions</div>
            {transitions && transitions.length > 0 ? (
              <div className="inspect-transitions">
                {transitions.map((t: any) => (
                  <div key={t.id} className="inspect-transition-entry">
                    <span>{t.from_state ?? '(created)'}</span>
                    <span className="inspect-transition-arrow"> → </span>
                    <span>{t.to_state}</span>
                    <span className="inspect-transition-agent"> · {t.agent_id}</span>
                    {t.reason && (
                      <span className="inspect-transition-reason"> · {t.reason}</span>
                    )}
                    <span className="inspect-transition-time">
                      {' '}{format(new Date(t.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="inspect-empty">No transitions recorded</p>
            )}
          </div>

          <div className="inspect-detail-section">
            <div className="inspect-meta-row">
              <span className="inspect-label">Assigned worker</span>
              <span className="inspect-meta-value">{task.assigned_worker ?? '—'}</span>
            </div>
            <div className="inspect-meta-row">
              <span className="inspect-label">Revision count</span>
              <span className="inspect-meta-value">{task.revision_count}</span>
            </div>
          </div>

          {skillsLoaded.length > 0 && (
            <p className="inspect-skills-footer">
              Skills: {skillsLoaded.join(', ')}
            </p>
          )}
        </details>

        <a href="/interface" className="inspect-back">Back to Interface</a>
      </div>
    </div>
  )
}
