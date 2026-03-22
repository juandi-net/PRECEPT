import { db } from './client.js';
import type { Initiative } from '@precept/shared';

export interface CreateInitiativeParams {
  orgId: string;
  name: string;
  description?: string;
}

function mapInitiative(row: Record<string, unknown>): Initiative {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    github_repo_url: (row.github_repo_url as string) ?? null,
    status: row.status as Initiative['status'],
    phase_current: row.phase_current as number,
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string) ?? null,
  };
}

export async function createInitiative(params: CreateInitiativeParams): Promise<Initiative> {
  const { data, error } = await db
    .from('initiatives')
    .insert({
      org_id: params.orgId,
      name: params.name,
      description: params.description ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create initiative: ${error.message}`);
  return mapInitiative(data);
}

export async function getInitiative(id: string): Promise<Initiative | null> {
  const { data, error } = await db
    .from('initiatives')
    .select()
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get initiative: ${error.message}`);
  }
  return mapInitiative(data);
}

export async function getActiveInitiatives(orgId: string): Promise<Initiative[]> {
  const { data, error } = await db
    .from('initiatives')
    .select()
    .eq('org_id', orgId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get active initiatives: ${error.message}`);
  return (data ?? []).map(mapInitiative);
}

export async function updateInitiativeStatus(id: string, status: string): Promise<void> {
  const { error } = await db
    .from('initiatives')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to update initiative status: ${error.message}`);
}

export async function updateInitiativeRepoUrl(id: string, url: string): Promise<void> {
  const { error } = await db
    .from('initiatives')
    .update({ github_repo_url: url, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to update initiative repo URL: ${error.message}`);
}

export async function updateInitiativePhase(id: string, phase: number): Promise<void> {
  const { error } = await db
    .from('initiatives')
    .update({ phase_current: phase, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to update initiative phase: ${error.message}`);
}

export async function softDeleteInitiative(initiativeId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error: initError } = await db
    .from('initiatives')
    .update({ deleted_at: now })
    .eq('id', initiativeId);

  if (initError) throw new Error(`Failed to delete initiative: ${initError.message}`);

  // Cascade: soft-delete all tasks under this initiative
  const { error: taskError } = await db
    .from('tasks')
    .update({ deleted_at: now })
    .eq('initiative_id', initiativeId);

  if (taskError) throw new Error(`Failed to cascade-delete tasks: ${taskError.message}`);
}
