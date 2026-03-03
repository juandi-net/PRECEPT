import { db } from './client.js';

export interface AgentProfile {
  id: string;
  orgId: string;
  agentId: string;
  role: string;
  model: string;
  tasksCompleted: number;
  acceptanceRate: number | null;
  recentTrend: 'improving' | 'stable' | 'declining' | null;
  strengths: string[];
  weaknesses: string[];
  craftNotes: string | null;
  trustLevel: 'apprentice' | 'journeyman' | 'master';
  createdAt: string;
  updatedAt: string | null;
}

export interface UpsertProfileParams {
  orgId: string;
  agentId: string;
  role: string;
  model: string;
  strengths?: string[];
  weaknesses?: string[];
  craftNotes?: string;
  trustLevel?: 'apprentice' | 'journeyman' | 'master';
}

function mapProfile(row: Record<string, unknown>): AgentProfile {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    agentId: row.agent_id as string,
    role: row.role as string,
    model: row.model as string,
    tasksCompleted: row.tasks_completed as number,
    acceptanceRate: (row.acceptance_rate as number) ?? null,
    recentTrend: (row.recent_trend as AgentProfile['recentTrend']) ?? null,
    strengths: (row.strengths as string[]) ?? [],
    weaknesses: (row.weaknesses as string[]) ?? [],
    craftNotes: (row.craft_notes as string) ?? null,
    trustLevel: row.trust_level as AgentProfile['trustLevel'],
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? null,
  };
}

export async function getProfile(orgId: string, agentId: string): Promise<AgentProfile | null> {
  const { data, error } = await db
    .from('agent_profiles')
    .select()
    .eq('org_id', orgId)
    .eq('agent_id', agentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get agent profile: ${error.message}`);
  }
  return mapProfile(data);
}

export async function getProfilesByRole(orgId: string, role: string): Promise<AgentProfile[]> {
  const { data, error } = await db
    .from('agent_profiles')
    .select()
    .eq('org_id', orgId)
    .eq('role', role);

  if (error) throw new Error(`Failed to get profiles by role: ${error.message}`);
  return (data ?? []).map(mapProfile);
}

export async function upsertProfile(params: UpsertProfileParams): Promise<void> {
  const { error } = await db
    .from('agent_profiles')
    .upsert({
      org_id: params.orgId,
      agent_id: params.agentId,
      role: params.role,
      model: params.model,
      strengths: params.strengths ?? [],
      weaknesses: params.weaknesses ?? [],
      craft_notes: params.craftNotes ?? null,
      trust_level: params.trustLevel ?? 'apprentice',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agent_id' });

  if (error) throw new Error(`Failed to upsert agent profile: ${error.message}`);
}

export async function incrementTaskCount(agentId: string, orgId: string): Promise<void> {
  const profile = await getProfile(orgId, agentId);
  if (!profile) return;

  const { error } = await db
    .from('agent_profiles')
    .update({
      tasks_completed: profile.tasksCompleted + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .eq('agent_id', agentId);

  if (error) throw new Error(`Failed to increment task count: ${error.message}`);
}
