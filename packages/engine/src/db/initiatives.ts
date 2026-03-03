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

export async function updateInitiativePhase(id: string, phase: number): Promise<void> {
  const { error } = await db
    .from('initiatives')
    .update({ phase_current: phase, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to update initiative phase: ${error.message}`);
}
