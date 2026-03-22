import { db } from './client.js';
import type { Task, TaskState, TaskSource, WorkerOutput, TaskTransition } from '@precept/shared';

export interface CreateTaskParams {
  orgId: string;
  planId?: string;
  initiativeId?: string;
  phase: number;
  role: string;
  spec: { title?: string; description: string; acceptance_criteria: string[]; priority: string; required_credentials?: string[] };
  dependsOn?: string[];
  skillsLoaded?: string[];
  source?: TaskSource;
}

function mapTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    plan_id: (row.plan_id as string) ?? null,
    initiative_id: (row.initiative_id as string) ?? null,
    phase: row.phase as number,
    state: row.state as TaskState,
    role: row.role as Task['role'],
    assigned_worker: (row.assigned_worker as string) ?? null,
    spec: row.spec as Task['spec'],
    output: (row.output as WorkerOutput) ?? null,
    skills_loaded: (row.skills_loaded as string[]) ?? [],
    depends_on: (row.depends_on as string[]) ?? [],
    revision_count: row.revision_count as number,
    polish_count: (row.polish_count as number) ?? 0,
    source: (row.source as Task['source']) ?? 'planning_cycle',
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string) ?? null,
    linear_issue_id: (row.linear_issue_id as string) ?? null,
    escalation_diagnosis: (row.escalation_diagnosis as Task['escalation_diagnosis']) ?? null,
    owner_read_at: (row.owner_read_at as string) ?? null,
  };
}

export async function createTask(params: CreateTaskParams): Promise<Task> {
  const { data, error } = await db
    .from('tasks')
    .insert({
      org_id: params.orgId,
      plan_id: params.planId ?? null,
      initiative_id: params.initiativeId ?? null,
      phase: params.phase,
      role: params.role,
      spec: params.spec,
      depends_on: params.dependsOn ?? [],
      skills_loaded: params.skillsLoaded ?? [],
      source: params.source ?? 'planning_cycle',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create task: ${error.message}`);
  return mapTask(data);
}

export async function createTasks(paramsList: CreateTaskParams[]): Promise<Task[]> {
  const rows = paramsList.map((params) => ({
    org_id: params.orgId,
    plan_id: params.planId ?? null,
    initiative_id: params.initiativeId ?? null,
    phase: params.phase,
    role: params.role,
    spec: params.spec,
    depends_on: params.dependsOn ?? [],
    skills_loaded: params.skillsLoaded ?? [],
    source: params.source ?? 'planning_cycle',
  }));

  const { data, error } = await db
    .from('tasks')
    .insert(rows)
    .select();

  if (error) throw new Error(`Failed to create tasks: ${error.message}`);
  return (data ?? []).map(mapTask);
}

export async function getTask(taskId: string): Promise<Task | null> {
  const { data, error } = await db
    .from('tasks')
    .select()
    .eq('id', taskId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get task: ${error.message}`);
  }
  return mapTask(data);
}

export async function getTasksByPlan(planId: string): Promise<Task[]> {
  const { data, error } = await db
    .from('tasks')
    .select()
    .eq('plan_id', planId)
    .is('deleted_at', null)
    .order('phase', { ascending: true });

  if (error) throw new Error(`Failed to get tasks by plan: ${error.message}`);
  return (data ?? []).map(mapTask);
}

export async function getTasksByInitiative(initiativeId: string): Promise<Task[]> {
  const { data, error } = await db
    .from('tasks')
    .select()
    .eq('initiative_id', initiativeId)
    .is('deleted_at', null)
    .order('phase', { ascending: true });

  if (error) throw new Error(`Failed to get tasks by initiative: ${error.message}`);
  return (data ?? []).map(mapTask);
}

export async function getTasksByState(orgId: string, state: TaskState): Promise<Task[]> {
  const { data, error } = await db
    .from('tasks')
    .select()
    .eq('org_id', orgId)
    .eq('state', state)
    .is('deleted_at', null);

  if (error) throw new Error(`Failed to get tasks by state: ${error.message}`);
  return (data ?? []).map(mapTask);
}

export async function getTasksByStates(orgId: string, states: TaskState[]): Promise<Task[]> {
  const { data, error } = await db
    .from('tasks')
    .select()
    .eq('org_id', orgId)
    .in('state', states)
    .is('deleted_at', null);

  if (error) throw new Error(`Failed to get tasks by states: ${error.message}`);
  return (data ?? []).map(mapTask);
}

export async function getTasksByPhase(planId: string, phase: number): Promise<Task[]> {
  const { data, error } = await db
    .from('tasks')
    .select()
    .eq('plan_id', planId)
    .eq('phase', phase)
    .is('deleted_at', null);

  if (error) throw new Error(`Failed to get tasks by phase: ${error.message}`);
  return (data ?? []).map(mapTask);
}

export async function updateTaskState(taskId: string, state: TaskState): Promise<void> {
  const { error } = await db
    .from('tasks')
    .update({ state, updated_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to update task state: ${error.message}`);
}

export async function updateTaskOutput(taskId: string, output: WorkerOutput): Promise<void> {
  const { error } = await db
    .from('tasks')
    .update({ output, updated_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to update task output: ${error.message}`);
}

export async function updateTaskWorker(
  taskId: string,
  workerId: string,
): Promise<void> {
  const { error } = await db
    .from('tasks')
    .update({
      assigned_worker: workerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to update task worker: ${error.message}`);
}

export async function updateTaskSkillsLoaded(taskId: string, skills: string[]): Promise<void> {
  const { error } = await db
    .from('tasks')
    .update({ skills_loaded: skills, updated_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to update task skills_loaded: ${error.message}`);
}

export async function incrementRevisionCount(taskId: string): Promise<number> {
  const { data, error } = await db.rpc('increment_revision_count', { task_uuid: taskId });
  if (error) throw new Error(`Failed to increment revision count: ${error.message}`);
  return data as number;
}

export async function incrementPolishCount(taskId: string): Promise<number> {
  const { data, error } = await db.rpc('increment_polish_count', { task_uuid: taskId });
  if (error) throw new Error(`Failed to increment polish count: ${error.message}`);
  return data as number;
}

export async function updateTaskDependencies(taskId: string, dependsOn: string[]): Promise<void> {
  const { error } = await db
    .from('tasks')
    .update({ depends_on: dependsOn, updated_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to update task dependencies: ${error.message}`);
}

export async function getDependentTasks(taskId: string): Promise<Task[]> {
  const { data, error } = await db
    .from('tasks')
    .select()
    .contains('depends_on', [taskId])
    .is('deleted_at', null);

  if (error) throw new Error(`Failed to get dependent tasks: ${error.message}`);
  return (data ?? []).map(mapTask);
}

export async function logTransition(params: {
  orgId: string;
  taskId: string;
  fromState: TaskState | null;
  toState: TaskState;
  agentId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await db
    .from('task_transitions')
    .insert({
      org_id: params.orgId,
      task_id: params.taskId,
      from_state: params.fromState,
      to_state: params.toState,
      agent_id: params.agentId,
      reason: params.reason ?? null,
      metadata: params.metadata ?? null,
    });

  if (error) throw new Error(`Failed to log transition: ${error.message}`);
}

export async function getTransitions(taskId: string): Promise<TaskTransition[]> {
  const { data, error } = await db
    .from('task_transitions')
    .select()
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get transitions: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    org_id: row.org_id as string,
    task_id: row.task_id as string,
    from_state: (row.from_state as TaskState) ?? null,
    to_state: row.to_state as TaskState,
    agent_id: row.agent_id as string,
    reason: (row.reason as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    created_at: row.created_at as string,
  }));
}

export async function updateTaskLinearIssueId(taskId: string, linearIssueId: string): Promise<void> {
  const { error } = await db
    .from('tasks')
    .update({ linear_issue_id: linearIssueId, updated_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) console.error(`[tasks] failed to set linear_issue_id: ${error.message}`);
}

export async function updateEscalationDiagnosis(taskId: string, diagnosis: import('@precept/shared').EscalationDiagnosis): Promise<void> {
  const { error } = await db
    .from('tasks')
    .update({ escalation_diagnosis: diagnosis, updated_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to update escalation diagnosis: ${error.message}`);
}

export async function markTasksRead(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  const { error } = await db
    .from('tasks')
    .update({ owner_read_at: new Date().toISOString() })
    .in('id', taskIds)
    .is('owner_read_at', null);

  if (error) throw new Error(`Failed to mark tasks read: ${error.message}`);
}

export async function softDeleteTask(taskId: string): Promise<void> {
  const { error } = await db
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to delete task: ${error.message}`);
}
