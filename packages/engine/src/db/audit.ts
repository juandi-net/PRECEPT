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
