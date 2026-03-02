import type { PreceptsFieldName } from './precepts';

export type SkillScope = 'org_wide' | 'role_specific' | 'leadership_only';
export type SkillStatus = 'active' | 'deprecated';

export interface SkillIndex {
  id: string;
  name: string;
  scope: SkillScope;
  role: string | null;
  status: SkillStatus;
  triggerTags: string[];
  filePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeedSkillSpec {
  name: string;
  scope: SkillScope;
  tags: string[];
  preceptsFields: PreceptsFieldName[];
  description: string;
}

export const SEED_SKILLS: SeedSkillSpec[] = [
  {
    name: 'communication-tone',
    scope: 'org_wide',
    tags: ['communication', 'writing', 'tone'],
    preceptsFields: ['identity', 'active_priorities', 'constraints'],
    description: 'How the organization communicates — voice, tone, formality level',
  },
  {
    name: 'data-classification',
    scope: 'org_wide',
    tags: ['data', 'security', 'classification'],
    preceptsFields: ['data_policy', 'constraints'],
    description: 'What data is sensitive and how to handle it',
  },
  {
    name: 'quality-baseline',
    scope: 'org_wide',
    tags: ['quality', 'standards', 'baseline'],
    preceptsFields: ['success_definition', 'constraints', 'active_priorities'],
    description: 'Minimum quality standards for all work output',
  },
];
