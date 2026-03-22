import { db } from './client.js';

export interface PlanningHistoryResult {
  source: 'audit_log' | 'decision_log';
  id: string;
  created_at: string;
  event_type: string | null;
  decision_type: string | null;
  agent_id: string | null;
  summary: string;
  rank: number;
}

export async function searchPlanningHistory(
  orgId: string,
  query: string,
  limit: number = 20
): Promise<PlanningHistoryResult[]> {
  const { data, error } = await db.rpc('search_planning_history', {
    p_org_id: orgId,
    p_query: query,
    p_limit: limit,
  });

  if (error) {
    console.error(`Planning history search failed: ${error.message}`);
    return [];
  }

  return (data ?? []) as PlanningHistoryResult[];
}
