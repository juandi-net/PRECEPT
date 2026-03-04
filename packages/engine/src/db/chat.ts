import { db } from './client.js'

export async function insertChatMessage(orgId: string, role: 'owner' | 'ceo', content: string) {
  const { data, error } = await db
    .from('ceo_chat_messages')
    .insert({ org_id: orgId, role, content })
    .select()
    .single()
  if (error) throw new Error(`Failed to insert chat message: ${error.message}`)
  return data
}

export async function getChatHistory(orgId: string, limit = 50) {
  const { data, error } = await db
    .from('ceo_chat_messages')
    .select()
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`Failed to get chat history: ${error.message}`)
  return data ?? []
}
