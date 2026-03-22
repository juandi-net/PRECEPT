import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { BoardRequestResponse } from './board-request-response'
import '../../task/[id]/inspect-task.css'

export const dynamic = 'force-dynamic'

export default async function InspectBoardRequestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: boardRequest } = await supabase
    .from('board_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (!boardRequest) {
    return (
      <div className="inspect-page">
        <div className="inspect-container">
          <div className="inspect-not-found">
            <h1 className="inspect-title">Board request not found</h1>
            <a href="/interface" className="inspect-back">Back to Interface</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="inspect-page">
      <div className="inspect-container">
        <a href="/interface" className="inspect-back-top">← Back to Interface</a>

        <h1 className="inspect-title">{boardRequest.content}</h1>

        <div className="inspect-meta">
          <div className="inspect-meta-row">
            <span className="inspect-label">Status</span>
            <span className="inspect-meta-value">{boardRequest.status}</span>
          </div>
          <div className="inspect-meta-row">
            <span className="inspect-label">Urgency</span>
            <span className="inspect-meta-value">{boardRequest.urgency}</span>
          </div>
          <div className="inspect-meta-row">
            <span className="inspect-label">Created</span>
            <span className="inspect-meta-value">
              {format(new Date(boardRequest.created_at), 'MMM d, h:mm a')}
            </span>
          </div>
          {boardRequest.responded_at && (
            <div className="inspect-meta-row">
              <span className="inspect-label">Responded</span>
              <span className="inspect-meta-value">
                {format(new Date(boardRequest.responded_at), 'MMM d, h:mm a')}
              </span>
            </div>
          )}
        </div>

        {boardRequest.context && (
          <div className="inspect-section">
            <div className="inspect-label">Context</div>
            <p className="inspect-value">{boardRequest.context}</p>
          </div>
        )}

        <div className="inspect-section">
          <div className="inspect-label">Fallback if no response</div>
          <p className="inspect-value">{boardRequest.fallback ?? 'None specified'}</p>
        </div>

        <div className="inspect-section">
          <div className="inspect-label">Your response</div>
          {boardRequest.status === 'responded' ? (
            <p className="inspect-value">{boardRequest.owner_response}</p>
          ) : (
            <BoardRequestResponse requestId={boardRequest.id} orgId={boardRequest.org_id} />
          )}
        </div>

        <a href="/interface" className="inspect-back">Back to Interface</a>
      </div>
    </div>
  )
}
