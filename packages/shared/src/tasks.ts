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

export interface TaskSpec {
  description: string;
  acceptance_criteria: string[];
  priority: TaskPriority;
}

export interface WorkerOutput {
  output: string;
  key_findings: string[];
  confidence: 'high' | 'medium' | 'low';
  flag: string | null;
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
  created_at: string;
  updated_at: string | null;
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
