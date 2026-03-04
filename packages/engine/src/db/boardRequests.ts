import { db } from './client.js'

export async function createBoardRequest(
  orgId: string,
  planId: string,
  request: { request: string; context: string; urgency: string; fallback: string }
) {
  const { error } = await db.from('board_requests').insert({
    org_id: orgId,
    plan_id: planId,
    content: request.request,
    context: request.context,
    urgency: request.urgency,
    fallback: request.fallback,
  })
  if (error) throw new Error(`Failed to create board request: ${error.message}`)
}

export async function respondToBoardRequest(id: string, response: string): Promise<boolean> {
  const { data, error } = await db.from('board_requests').update({
    status: 'responded',
    owner_response: response,
    responded_at: new Date().toISOString(),
  }).eq('id', id).select('id')
  if (error) throw new Error(`Failed to respond to board request: ${error.message}`)
  return (data?.length ?? 0) > 0
}
