import { db } from './client.js';

export type SkillEventType =
  | 'created'
  | 'refined'
  | 'deprecated'
  | 'loaded'
  | 'correlated_accept'
  | 'correlated_reject';

export interface LogSkillEventParams {
  orgId: string;
  skillName: string;
  eventType: SkillEventType;
  version?: number;
  metadata?: Record<string, unknown>;
}

export async function logSkillEvent(params: LogSkillEventParams): Promise<void> {
  const { error } = await db.from('skill_events').insert({
    org_id: params.orgId,
    skill_name: params.skillName,
    event_type: params.eventType,
    version: params.version ?? null,
    metadata: params.metadata ?? {},
  });
  if (error) console.error(`[skill-events] failed to log: ${error.message}`);
  // Fire-and-forget — same pattern as audit log
}

export async function getSkillEventHistory(
  orgId: string,
  skillName: string,
  limit: number = 50
) {
  const { data, error } = await db
    .from('skill_events')
    .select()
    .eq('org_id', orgId)
    .eq('skill_name', skillName)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get skill events: ${error.message}`);
  return data ?? [];
}

export async function getSkillEventsByType(
  orgId: string,
  eventType: SkillEventType,
  since?: Date
) {
  let query = db
    .from('skill_events')
    .select()
    .eq('org_id', orgId)
    .eq('event_type', eventType);

  if (since) {
    query = query.gte('created_at', since.toISOString());
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to get skill events: ${error.message}`);
  return data ?? [];
}
