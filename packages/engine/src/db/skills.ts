import { db } from './client.js';
import type { SkillIndex, SkillScope, SkillStatus } from '@precept/shared';
import { dbQuery, dbQueryOptional } from './query.js';

interface SkillRow {
  id: string;
  name: string;
  description: string | null;
  scope: SkillScope;
  role: string | null;
  status: SkillStatus;
  trigger_tags: string[];
  file_path: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
}

export async function getSkillByName(orgId: string, name: string): Promise<SkillIndex | null> {
  const data = await dbQueryOptional<SkillRow>(
    'getSkillByName',
    async () => db
      .from('skill_index')
      .select('*')
      .eq('org_id', orgId)
      .eq('name', name)
      .eq('status', 'active')
      .single(),
  );

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    description: data.description ?? '',
    scope: data.scope,
    role: data.role,
    status: data.status,
    triggerTags: data.trigger_tags,
    filePath: data.file_path,
    content: data.content,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Get skill index (names + descriptions) for a worker's role.
 * Returns org-wide skills + role-specific skills for the given role.
 * Used to populate the worker's system prompt with available skills.
 */
export async function getSkillIndexForWorker(
  orgId: string,
  role: string
): Promise<Array<{ name: string; description: string }>> {
  const data = await dbQuery<Array<{ name: string; description: string }>>(
    'getSkillIndexForWorker',
    async () => db
      .from('skill_index')
      .select('name, description')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .or(`scope.eq.org_wide,and(scope.eq.role_specific,role.eq.${role})`)
      .order('scope', { ascending: false }),
  );
  return data.map(s => ({
    name: s.name,
    description: s.description ?? '',
  }));
}

export async function getAllActiveSkillNames(orgId: string): Promise<string[]> {
  const data = await dbQuery<Array<{ name: string }>>(
    'getAllActiveSkillNames',
    async () => db
      .from('skill_index')
      .select('name')
      .eq('org_id', orgId)
      .eq('status', 'active'),
  );
  return data.map(s => s.name);
}

export interface InsertSkillParams {
  orgId: string;
  name: string;
  description?: string;
  scope: SkillScope;
  role: string | null;
  status: SkillStatus;
  triggerTags: string[];
  content?: string | null;
}

export async function upsertSkill(params: InsertSkillParams): Promise<SkillIndex> {
  const { data, error } = await db
    .from('skill_index')
    .upsert({
      org_id: params.orgId,
      name: params.name,
      description: params.description ?? '',
      scope: params.scope,
      role: params.role,
      status: params.status,
      trigger_tags: params.triggerTags,
      ...(params.content !== undefined ? { content: params.content } : {}),
    }, { onConflict: 'org_id,name' })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert skill: ${error.message}`);

  return {
    id: data.id,
    name: data.name,
    description: data.description ?? '',
    scope: data.scope,
    role: data.role,
    status: data.status,
    triggerTags: data.trigger_tags,
    filePath: data.file_path,
    content: data.content,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
