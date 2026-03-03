import { db } from './client.js';
import type { AuditEventType } from '@precept/shared';

export async function logEvent(
  eventType: AuditEventType,
  agent: string,
  detail?: Record<string, unknown>,
  tokensUsed?: number
): Promise<void> {
  const { error } = await db
    .from('audit_log')
    .insert({
      event_type: eventType,
      agent,
      detail: detail ?? null,
      tokens_used: tokensUsed ?? null,
    });

  if (error) {
    // Audit logging should not crash the system — log to stderr and continue
    console.error(`Audit log failed: ${error.message}`);
  }
}

export interface AuditEntry {
  id: string;
  event_type: string;
  agent_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function getRecentEvents(orgId: string, limit = 50): Promise<AuditEntry[]> {
  const { data, error } = await db
    .from('audit_log')
    .select()
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get recent events: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    event_type: row.event_type as string,
    agent_id: row.agent as string,
    metadata: row.detail as Record<string, unknown> | null,
    created_at: row.created_at as string,
  }));
}
