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

export interface SkillPerformanceSummary {
  skillName: string;
  timesLoaded: number;
  accepts: number;
  rejects: number;
}

export async function getSkillPerformanceSummary(
  orgId: string,
  sinceDays: number = 7
): Promise<SkillPerformanceSummary[]> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  const { data, error } = await db
    .from('skill_events')
    .select('skill_name, event_type')
    .eq('org_id', orgId)
    .in('event_type', ['loaded', 'correlated_accept', 'correlated_reject'])
    .gte('created_at', since.toISOString());

  if (error) throw new Error(`Failed to get skill performance: ${error.message}`);
  if (!data || data.length === 0) return [];

  const map = new Map<string, { loaded: number; accepts: number; rejects: number }>();
  for (const row of data) {
    const entry = map.get(row.skill_name) ?? { loaded: 0, accepts: 0, rejects: 0 };
    if (row.event_type === 'loaded') entry.loaded++;
    else if (row.event_type === 'correlated_accept') entry.accepts++;
    else if (row.event_type === 'correlated_reject') entry.rejects++;
    map.set(row.skill_name, entry);
  }

  return Array.from(map.entries())
    .map(([skillName, stats]) => ({
      skillName,
      timesLoaded: stats.loaded,
      accepts: stats.accepts,
      rejects: stats.rejects,
    }))
    .sort((a, b) => b.rejects - a.rejects || b.timesLoaded - a.timesLoaded);
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
