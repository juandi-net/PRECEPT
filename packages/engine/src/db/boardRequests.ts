import { db } from './client.js'

export async function createBoardRequest(
  orgId: string,
  planId: string | null,
  request: { request: string; context: string; urgency: string; fallback: string }
): Promise<{ id: string }> {
  const { data, error } = await db.from('board_requests').insert({
    org_id: orgId,
    plan_id: planId,
    content: request.request,
    context: request.context,
    urgency: request.urgency,
    fallback: request.fallback,
  }).select('id').single()
  if (error) throw new Error(`Failed to create board request: ${error.message}`)
  return data
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

export interface BoardRequestRow {
  id: string;
  org_id: string;
  plan_id: string | null;
  content: string;
  context: string | null;
  urgency: string;
  fallback: string | null;
  status: string;
  owner_response: string | null;
  thread_id: string | null;
  created_at: string;
  responded_at: string | null;
  owner_read_at: string | null;
}

export async function getPendingBoardRequests(orgId: string): Promise<BoardRequestRow[]> {
  const { data, error } = await db.from('board_requests')
    .select()
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to get pending board requests: ${error.message}`)
  return data ?? []
}

export async function respondToBoardRequestByThreadId(threadId: string, response: string): Promise<boolean> {
  const { data, error } = await db.from('board_requests').update({
    status: 'responded',
    owner_response: response,
    responded_at: new Date().toISOString(),
  }).eq('thread_id', threadId).eq('status', 'pending').select('id')
  if (error) throw new Error(`Failed to respond to board request by thread: ${error.message}`)
  return (data?.length ?? 0) > 0
}

export async function updateBoardRequestThreadId(id: string, threadId: string): Promise<void> {
  const { error } = await db.from('board_requests')
    .update({ thread_id: threadId })
    .eq('id', id)
  if (error) throw new Error(`Failed to update board request thread_id: ${error.message}`)
}

export async function resolveBoardRequest(id: string, resolution: string): Promise<boolean> {
  const { data, error } = await db.from('board_requests').update({
    status: 'resolved',
    owner_response: resolution,
    responded_at: new Date().toISOString(),
  }).eq('id', id).select('id')
  if (error) throw new Error(`Failed to resolve board request: ${error.message}`)
  return (data?.length ?? 0) > 0
}

export async function markBoardRequestsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await db.from('board_requests')
    .update({ owner_read_at: new Date().toISOString() })
    .in('id', ids)
    .is('owner_read_at', null)

  if (error) throw new Error(`Failed to mark board requests read: ${error.message}`)
}
