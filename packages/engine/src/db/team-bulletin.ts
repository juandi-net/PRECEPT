import { db } from './client.js';

export interface BulletinEntry {
  id: string;
  orgId: string;
  taskId: string | null;
  role: string;
  summary: string;
  createdAt: string;
}

export interface BulletinParams {
  orgId: string;
  taskId?: string;
  role: string;
  summary: string;
}

export async function addBulletinEntry(params: BulletinParams): Promise<void> {
  const { error } = await db
    .from('team_bulletin')
    .insert({
      org_id: params.orgId,
      task_id: params.taskId ?? null,
      role: params.role,
      summary: params.summary,
    });

  if (error) throw new Error(`Failed to add bulletin entry: ${error.message}`);
}

export async function getRecentBulletin(orgId: string, limit = 10): Promise<BulletinEntry[]> {
  const { data, error } = await db
    .from('team_bulletin')
    .select()
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get recent bulletin: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    orgId: row.org_id as string,
    taskId: (row.task_id as string) ?? null,
    role: row.role as string,
    summary: row.summary as string,
    createdAt: row.created_at as string,
  }));
}
