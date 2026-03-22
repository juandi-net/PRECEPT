import { db } from './client.js';

export async function getRoleSummary(
  orgId: string,
  role: string
): Promise<string | null> {
  const { data, error } = await db
    .from('role_summaries')
    .select('content')
    .eq('org_id', orgId)
    .eq('role', role)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // no rows
    console.error(`[role-summaries] failed to get: ${error.message}`);
    return null;
  }
  return data?.content ?? null;
}

export async function upsertRoleSummary(
  orgId: string,
  role: string,
  content: string,
  tokenCount?: number
): Promise<void> {
  const { error } = await db
    .from('role_summaries')
    .upsert({
      org_id: orgId,
      role,
      content,
      token_count: tokenCount ?? null,
    }, { onConflict: 'org_id,role' });

  if (error) {
    console.error(`[role-summaries] upsert failed: ${error.message}`);
  }
}
