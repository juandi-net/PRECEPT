import type { Task } from '@precept/shared';
import { getTasksByPlan, updateTaskState, updateTaskWorker } from '../db/tasks.js';
import { getDispatchableTasks } from '../orchestration/dependency.js';
import { applyTransition } from '../orchestration/state-machine.js';
import { logEvent } from '../db/audit.js';

export class DispatcherService {
  /**
   * Dispatch ready tasks for a plan.
   * Returns IDs of tasks that were dispatched.
   */
  async executePlan(planId: string): Promise<string[]> {
    // 1. Get all tasks for this plan
    const allTasks = await getTasksByPlan(planId);
    if (allTasks.length === 0) return [];

    // 2. Find dispatchable tasks (PLANNED with all deps ACCEPTED)
    const ready = getDispatchableTasks(allTasks);
    if (ready.length === 0) return [];

    const dispatched: string[] = [];

    // 3. Dispatch each ready task
    for (const task of ready) {
      try {
        await this.dispatchTask(task);
        dispatched.push(task.id);
      } catch (err) {
        console.error(`[dispatcher] failed to dispatch task ${task.id}:`, err);
        logEvent(task.org_id, 'dispatch.task', 'Dispatcher-1', {
          taskId: task.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const orgId = allTasks[0]?.org_id ?? '';
    logEvent(orgId, 'dispatch.plan', 'Dispatcher-1', {
      planId,
      totalTasks: allTasks.length,
      dispatchedCount: dispatched.length,
    });

    return dispatched;
  }

  private async dispatchTask(task: Task): Promise<void> {
    // Transition: PLANNED → QUEUED
    await applyTransition(task.id, 'QUEUED', 'Dispatcher-1', 'task ready for dispatch');

    // Assign worker based on role (deterministic for now, AI selection later)
    const workerId = `Worker-${task.role}-1`;
    const skills = task.skills_loaded.slice(0, 3);

    await updateTaskWorker(task.id, workerId, skills);

    // Transition: QUEUED → DISPATCHED
    await applyTransition(task.id, 'DISPATCHED', 'Dispatcher-1', `assigned to ${workerId}`);

    logEvent(task.org_id, 'dispatch.task', 'Dispatcher-1', {
      taskId: task.id,
      workerId,
      skills,
    });
  }
}
