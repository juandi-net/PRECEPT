import type { CornerstoneFieldName } from './cornerstone';

export type SkillScope = 'org_wide' | 'role_specific' | 'leadership_only';
export type SkillStatus = 'active' | 'deprecated';

export interface SkillIndex {
  id: string;
  name: string;
  description: string;
  scope: SkillScope;
  role: string | null;
  status: SkillStatus;
  triggerTags: string[];
  filePath: string | null;
  content: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeedSkillSpec {
  name: string;
  scope: SkillScope;
  tags: string[];
  cornerstoneFields: CornerstoneFieldName[];
  description: string;
}

export const SEED_SKILLS: SeedSkillSpec[] = [
  {
    name: 'communication-tone',
    scope: 'org_wide',
    tags: ['communication', 'writing', 'tone'],
    cornerstoneFields: ['identity', 'active_priorities', 'constraints'],
    description: 'How the organization communicates — voice, tone, formality level',
  },
  {
    name: 'data-classification',
    scope: 'org_wide',
    tags: ['data', 'security', 'classification'],
    cornerstoneFields: ['data_policy', 'constraints'],
    description: 'What data is sensitive and how to handle it',
  },
  {
    name: 'quality-baseline',
    scope: 'org_wide',
    tags: ['quality', 'standards', 'baseline'],
    cornerstoneFields: ['success_definition', 'constraints', 'active_priorities'],
    description: 'Minimum quality standards for all work output',
  },
];
