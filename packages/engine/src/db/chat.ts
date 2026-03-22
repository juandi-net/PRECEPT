import { db } from './client.js'

export type MessageType = 'briefing' | 'escalation' | 'response' | 'owner' | 'task_update'

export async function insertChatMessage(orgId: string, role: 'owner' | 'ceo', content: string, type: MessageType) {
  const { data, error } = await db
    .from('ceo_chat_messages')
    .insert({ org_id: orgId, role, content, type })
    .select()
    .single()
  if (error) throw new Error(`Failed to insert chat message: ${error.message}`)
  return data
}

export async function getRecentOwnerMessages(orgId: string, limit = 10) {
  const { data, error } = await db
    .from('ceo_chat_messages')
    .select()
    .eq('org_id', orgId)
    .eq('role', 'owner')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Failed to get owner messages: ${error.message}`)
  return (data ?? []).reverse() // chronological order
}

export async function getChatHistory(orgId: string, limit = 50) {
  const { data, error } = await db
    .from('ceo_chat_messages')
    .select()
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Failed to get chat history: ${error.message}`)
  return (data ?? []).reverse() // chronological order
}
