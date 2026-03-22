import type { EscalationDiagnosis } from './evaluation.js';

export type TaskState =
  | 'PLANNED'
  | 'QUEUED'
  | 'DISPATCHED'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'POLISH'
  | 'JUDGMENT'
  | 'REVISION'
  | 'ACCEPTED'
  | 'ESCALATED'
  | 'FAILED';

export type TaskRole = 'researcher' | 'coder' | 'writer' | 'analyst' | 'ops';

export type TaskPriority = 'high' | 'medium' | 'low';

export type TaskStakes = 'low' | 'standard' | 'high' | 'critical';

export type TaskSource = 'planning_cycle' | 'owner_directed';

export interface TaskSpec {
  title: string;
  description: string;
  acceptance_criteria: string[];
  priority: TaskPriority;
  stakes?: TaskStakes; // defaults to 'standard' when absent
}

export type FieldSignalType = 'observation' | 'contradiction' | 'opportunity' | 'risk';

export interface FieldSignal {
  type: FieldSignalType;
  confidence: 'low' | 'medium' | 'high';
  content: string;
  relevant_to?: string; // initiative_id, precepts section, or free tag
}

export interface WorkerOutput {
  output: string;
  key_findings: string[];
  confidence: 'high' | 'medium' | 'low';
  flag: string | null;              // KEEP for backward compat
  field_signals?: FieldSignal[];    // structured replacement for flag
  notes: string | null;
}

export interface Task {
  id: string;
  org_id: string;
  plan_id: string | null;
  initiative_id: string | null;
  phase: number;
  state: TaskState;
  role: TaskRole;
  assigned_worker: string | null;
  spec: TaskSpec;
  output: WorkerOutput | null;
  skills_loaded: string[];
  depends_on: string[];
  revision_count: number;
  polish_count: number;
  source: TaskSource;
  created_at: string;
  updated_at: string | null;
  linear_issue_id: string | null;
  escalation_diagnosis: EscalationDiagnosis | null;
  owner_read_at: string | null;
}

export interface TaskTransition {
  id: string;
  org_id: string;
  task_id: string;
  from_state: TaskState | null;
  to_state: TaskState;
  agent_id: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ExperimentSpec {
  hypothesis: string;
  variants: string[];           // skill version names or prompt variant labels
  metric: string;               // 'acceptance_rate' | 'owner_time_cost' | 'memory_quality'
  sample_size: number;          // tasks per variant (minimum 3)
  success_threshold: number;    // minimum improvement % to keep winner (default 10)
  status: 'planned' | 'running' | 'concluded';
  results?: ExperimentResult;
}

export interface ExperimentResult {
  winner: string | null;        // null if no variant met threshold
  metrics_by_variant: Record<string, number>;
  sample_sizes: Record<string, number>;
  concluded_at: string;
}
