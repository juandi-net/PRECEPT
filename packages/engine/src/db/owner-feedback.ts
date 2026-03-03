import { db } from './client.js';
import type { OwnerReplyIntent } from '@precept/shared';

export interface OwnerFeedback {
  id: string;
  orgId: string;
  source: 'briefing_reply' | 'decision_room' | 'direct';
  rawContent: string;
  parsedIntent: OwnerReplyIntent | null;
  planId: string | null;
  initiativeId: string | null;
  createdAt: string;
}

export async function logOwnerFeedback(params: {
  orgId: string;
  source: string;
  rawContent: string;
  parsedIntent: OwnerReplyIntent;
  planId?: string;
  initiativeId?: string;
}): Promise<void> {
  const { error } = await db
    .from('owner_feedback_history')
    .insert({
      org_id: params.orgId,
      source: params.source,
      raw_content: params.rawContent,
      parsed_intent: params.parsedIntent,
      plan_id: params.planId ?? null,
      initiative_id: params.initiativeId ?? null,
    });

  if (error) throw new Error(`Failed to log owner feedback: ${error.message}`);
}

export async function getRecentFeedback(orgId: string, limit = 10): Promise<OwnerFeedback[]> {
  const { data, error } = await db
    .from('owner_feedback_history')
    .select()
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get recent feedback: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    orgId: row.org_id as string,
    source: row.source as OwnerFeedback['source'],
    rawContent: row.raw_content as string,
    parsedIntent: (row.parsed_intent as OwnerReplyIntent) ?? null,
    planId: (row.plan_id as string) ?? null,
    initiativeId: (row.initiative_id as string) ?? null,
    createdAt: row.created_at as string,
  }));
}
