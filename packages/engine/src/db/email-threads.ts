import { db } from './client.js'

export interface EmailThread {
  id: string
  org_id: string
  thread_type: 'briefing' | 'escalation' | 'board_request' | 'adhoc'
  subject: string
  status: 'open' | 'closed'
  created_at: string
  updated_at: string
}

export interface EmailMessage {
  id: string
  thread_id: string
  org_id: string
  direction: 'outbound' | 'inbound'
  sender_role: 'ceo' | 'owner'
  content: string
  resend_email_id: string | null
  resend_message_id: string | null
  created_at: string
}

export async function createThread(
  orgId: string,
  threadType: 'briefing' | 'escalation' | 'board_request' | 'adhoc',
  subject: string
): Promise<EmailThread> {
  const { data, error } = await db
    .from('email_threads')
    .insert({ org_id: orgId, thread_type: threadType, subject })
    .select()
    .single()
  if (error) throw new Error(`Failed to create email thread: ${error.message}`)
  return data
}

export async function insertEmailMessage(params: {
  threadId: string
  orgId: string
  direction: 'outbound' | 'inbound'
  senderRole: 'ceo' | 'owner'
  content: string
  resendEmailId?: string | null
  resendMessageId?: string | null
}): Promise<EmailMessage> {
  const { data, error } = await db
    .from('email_messages')
    .insert({
      thread_id: params.threadId,
      org_id: params.orgId,
      direction: params.direction,
      sender_role: params.senderRole,
      content: params.content,
      resend_email_id: params.resendEmailId ?? null,
      resend_message_id: params.resendMessageId ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(`Failed to insert email message: ${error.message}`)
  return data
}

export async function getThreadMessages(threadId: string): Promise<EmailMessage[]> {
  const { data, error } = await db
    .from('email_messages')
    .select()
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to get thread messages: ${error.message}`)
  return data ?? []
}

export async function getLatestBriefingThread(orgId: string): Promise<{
  thread: EmailThread
  messages: EmailMessage[]
} | null> {
  const { data: thread, error } = await db
    .from('email_threads')
    .select()
    .eq('org_id', orgId)
    .eq('thread_type', 'briefing')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !thread) return null

  const messages = await getThreadMessages(thread.id)
  return { thread, messages }
}

export async function getThreadByMessageId(
  resendMessageId: string
): Promise<{ threadId: string; threadType: EmailThread['thread_type'] } | null> {
  const { data, error } = await db
    .from('email_messages')
    .select('thread_id, email_threads(thread_type)')
    .eq('resend_message_id', resendMessageId)
    .single()

  if (error || !data) return null

  const threadType = (data as any).email_threads?.thread_type
  if (!threadType) return null

  return { threadId: data.thread_id, threadType }
}

export async function getThreadBySubject(
  orgId: string,
  rawSubject: string
): Promise<{ threadId: string; threadType: EmailThread['thread_type'] } | null> {
  // Strip "Re: " / "Fwd: " prefixes (case-insensitive, repeating)
  const subject = rawSubject.replace(/^(?:re|fwd):\s*/gi, '').trim()
  if (!subject) return null

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await db
    .from('email_threads')
    .select('id, thread_type')
    .eq('org_id', orgId)
    .eq('subject', subject)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return { threadId: data.id, threadType: data.thread_type }
}

export async function getRecentEmailMessages(orgId: string, limit: number = 20): Promise<Array<{
  content: string;
  direction: 'outbound' | 'inbound';
  sender_role: 'ceo' | 'owner';
  created_at: string;
  thread_type: string;
  thread_subject: string;
}>> {
  const { data, error } = await db
    .from('email_messages')
    .select('content, direction, sender_role, created_at, email_threads(thread_type, subject)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get recent email messages: ${error.message}`);

  return (data ?? []).map((m: any) => ({
    content: m.content,
    direction: m.direction,
    sender_role: m.sender_role,
    created_at: m.created_at,
    thread_type: m.email_threads?.thread_type ?? 'unknown',
    thread_subject: m.email_threads?.subject ?? '',
  })).reverse(); // chronological order
}

export async function getThreadMessageIds(threadId: string): Promise<string[]> {
  const { data, error } = await db
    .from('email_messages')
    .select('resend_message_id')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to get thread message IDs: ${error.message}`)
  return (data ?? [])
    .map(m => m.resend_message_id)
    .filter((id): id is string => id != null)
}
