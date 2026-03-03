import { db } from './client.js';
import type { InternalMessage } from '@precept/shared';

export async function logMessage(
  msg: Omit<InternalMessage, 'id' | 'created_at'>
): Promise<void> {
  const { error } = await db
    .from('messages')
    .insert({
      org_id: msg.org_id,
      from_role: msg.from_role,
      from_agent_id: msg.from_agent_id,
      to_role: msg.to_role,
      message_type: msg.message_type,
      payload: msg.payload,
      reference_id: msg.reference_id ?? null,
    });

  if (error) {
    // Message logging should not crash the system — log to stderr and continue
    console.error(`Message log failed: ${error.message}`);
  }
}
