export const PRECEPTS_FIELDS = [
  'mission_statement',
  'identity',
  'product_service',
  'stage',
  'success_definition',
  'resources',
  'constraints',
  'competitive_landscape',
  'history',
  'active_priorities',
  'data_policy',
] as const;

export type PreceptsFieldName = (typeof PRECEPTS_FIELDS)[number];

export type FieldState = 'confirmed' | 'hypothesis' | 'research_pending' | 'open_question';

export interface PreceptsField {
  name: PreceptsFieldName;
  content: string;
  state: FieldState;
  notes: string | null;
}

export type PreceptsDraft = Record<PreceptsFieldName, PreceptsField | null>;

export interface Precepts {
  id: string;
  sessionId: string;
  version: number;
  content: PreceptsDraft;
  classification: 'public' | 'internal';
  createdAt: string;
  updatedAt: string;
}

export const FIELD_LABELS: Record<PreceptsFieldName, string> = {
  mission_statement: 'Mission Statement',
  identity: 'Identity',
  product_service: 'Product / Service',
  stage: 'Stage',
  success_definition: 'Success Definition',
  resources: 'Resources',
  constraints: 'Constraints',
  competitive_landscape: 'Competitive Landscape',
  history: 'History',
  active_priorities: 'Active Priorities',
  data_policy: 'Data Policy',
};
