import { db } from './client.js';
import type { SkillIndex, SkillScope, SkillStatus } from '@precept/shared';

export interface InsertSkillParams {
  name: string;
  scope: SkillScope;
  role: string | null;
  status: SkillStatus;
  triggerTags: string[];
  filePath: string;
}

export async function upsertSkill(params: InsertSkillParams): Promise<SkillIndex> {
  const { data, error } = await db
    .from('skill_index')
    .upsert({
      name: params.name,
      scope: params.scope,
      role: params.role,
      status: params.status,
      trigger_tags: params.triggerTags,
      file_path: params.filePath,
    }, { onConflict: 'name' })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert skill: ${error.message}`);

  return {
    id: data.id,
    name: data.name,
    scope: data.scope,
    role: data.role,
    status: data.status,
    triggerTags: data.trigger_tags,
    filePath: data.file_path,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
