import type { TaskState } from '@precept/shared';
import { getTask, updateTaskState, incrementRevisionCount, logTransition } from '../db/tasks.js';

const VALID_TRANSITIONS: Record<TaskState, Set<TaskState>> = {
  PLANNED:     new Set(['QUEUED']),
  QUEUED:      new Set(['DISPATCHED']),
  DISPATCHED:  new Set(['IN_PROGRESS']),
  IN_PROGRESS: new Set(['REVIEW', 'FAILED']),
  REVIEW:      new Set(['POLISH', 'JUDGMENT']),
  POLISH:      new Set(['REVIEW']),
  JUDGMENT:    new Set(['ACCEPTED', 'REVISION', 'ESCALATED']),
  REVISION:    new Set(['REVIEW']),
  FAILED:      new Set(['ESCALATED']),
  ESCALATED:   new Set(['QUEUED', 'PLANNED']),
  ACCEPTED:    new Set([]), // terminal
};

export function validateTransition(from: TaskState, to: TaskState): boolean {
  return VALID_TRANSITIONS[from]?.has(to) ?? false;
}

/**
 * Apply a state transition to a task. Validates the transition, handles
 * auto-escalation on revision overflow, updates DB, and logs the transition.
 *
 * Returns the actual target state (may differ from requested if auto-escalated).
 */
export async function applyTransition(
  taskId: string,
  toState: TaskState,
  agentId: string,
  reason?: string
): Promise<TaskState> {
  const task = await getTask(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);

  const fromState = task.state;

  if (!validateTransition(fromState, toState)) {
    throw new Error(`Invalid transition: ${fromState} → ${toState} for task ${taskId}`);
  }

  let actualTarget = toState;

  // Auto-escalation: if JUDGMENT → REVISION and revision_count >= 2 after increment
  if (fromState === 'JUDGMENT' && toState === 'REVISION') {
    const newCount = await incrementRevisionCount(taskId);
    if (newCount >= 2) {
      actualTarget = 'ESCALATED';
    }
  }

  await updateTaskState(taskId, actualTarget);
  await logTransition({
    orgId: task.org_id,
    taskId,
    fromState,
    toState: actualTarget,
    agentId,
    reason,
  });

  return actualTarget;
}
