import { db } from './client.js';

export interface RoleMemoryMatch {
  id: string;
  role: string;
  domain: string | null;
  content: string;
  confidence: string;
  entryType: string;
  sourceTask: string | null;
  similarity: number;
}

export interface StoreRoleMemoryParams {
  orgId: string;
  role: string;
  content: string;
  embedding: number[];
  sourceTaskId?: string;
  domain?: string;
  confidence?: 'high' | 'medium' | 'low';
  entryType?: 'finding' | 'craft_pattern' | 'contact';
}

export async function storeRoleMemory(params: StoreRoleMemoryParams): Promise<void> {
  const { error } = await db
    .from('role_memory')
    .insert({
      org_id: params.orgId,
      role: params.role,
      content: params.content,
      embedding: params.embedding,
      source_task: params.sourceTaskId ?? null,
      domain: params.domain ?? null,
      confidence: params.confidence ?? 'medium',
      entry_type: params.entryType ?? 'finding',
    });

  if (error) throw new Error(`Failed to store role memory: ${error.message}`);
}

export async function matchRoleMemory(
  orgId: string,
  role: string,
  embedding: number[],
  count = 5
): Promise<RoleMemoryMatch[]> {
  const { data, error } = await db.rpc('match_role_memory', {
    query_embedding: embedding,
    match_org_id: orgId,
    match_role: role,
    match_count: count,
  });

  if (error) throw new Error(`Failed to match role memory: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    role: row.role as string,
    domain: (row.domain as string) ?? null,
    content: row.content as string,
    confidence: row.confidence as string,
    entryType: row.entry_type as string,
    sourceTask: (row.source_task as string) ?? null,
    similarity: row.similarity as number,
  }));
}

export async function deduplicateRoleMemory(
  orgId: string,
  threshold = 0.95,
  role?: string
): Promise<number> {
  const { data, error } = await db.rpc('deduplicate_role_memory', {
    target_org_id: orgId,
    similarity_threshold: threshold,
    target_role: role ?? null,
  });

  if (error) throw new Error(`Failed to deduplicate role memory: ${error.message}`);
  return data as number;
}

export async function flagStaleRoleMemory(
  orgId: string,
  staleDays = 30,
): Promise<number> {
  const { data, error } = await db.rpc('flag_stale_role_memory', {
    target_org_id: orgId,
    stale_days: staleDays,
  });

  if (error) throw new Error(`Failed to flag stale role memory: ${error.message}`);
  return data as number;
}

export async function getActiveRoleMemoryEntries(
  orgId: string,
  role: string,
): Promise<Array<{ content: string; entryType: string; confidence: string; created_at: string; last_retrieved_at: string | null }>> {
  const { data, error } = await db
    .from('role_memory')
    .select('content, entry_type, confidence, created_at, last_retrieved_at')
    .eq('org_id', orgId)
    .eq('role', role)
    .eq('status', 'active')
    .order('last_retrieved_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to get role memory entries: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    content: row.content as string,
    entryType: row.entry_type as string,
    confidence: row.confidence as string,
    created_at: row.created_at as string,
    last_retrieved_at: (row.last_retrieved_at as string) ?? null,
  }));
}
