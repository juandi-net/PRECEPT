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
