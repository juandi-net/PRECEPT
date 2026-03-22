import type { Task } from '@precept/shared';
import { getTask, getTasksByPlan, updateTaskWorker, updateTaskLinearIssueId } from '../db/tasks.js';
import { mirrorTaskCreated } from '../lib/linear.js';
import { getDispatchableTasks } from '../orchestration/dependency.js';
import { applyTransition } from '../orchestration/state-machine.js';
import { logEvent } from '../db/audit.js';
import { createCoderWorkspace } from '../tools/workspace.js';
import { resolveCredentials } from '../lib/credentials.js';
import { getInitiative } from '../db/initiatives.js';
import { db } from '../db/client.js';
import { getProfilesByRole } from '../db/agent-profiles.js';

export class DispatcherService {
  /**
   * Dispatch ready tasks for a plan.
   * Returns IDs of tasks that were dispatched.
   */
  async executePlan(planId: string): Promise<string[]> {
    const start = Date.now();
    console.log('[dispatcher] assigning tasks...');

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

    console.log(`[dispatcher] done — ${dispatched.length} tasks dispatched (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    return dispatched;
  }

  async dispatchTask(task: Task): Promise<void> {
    // Transition: PLANNED → QUEUED
    await applyTransition(task.id, 'QUEUED', 'Dispatcher-1', 'task ready for dispatch');

    const workerId = await this.selectWorker(task.org_id, task.role);
    await updateTaskWorker(task.id, workerId);

    // Create isolated workspace for coder tasks
    if (task.role === 'coder') {
      const initiative = task.initiative_id ? await getInitiative(task.initiative_id) : null;
      const creds = await resolveCredentials(task.org_id);
      const repoUrl = initiative?.github_repo_url ?? creds.githubRepoUrl;
      if (repoUrl) {
        try {
          const workspace = await createCoderWorkspace(
            task.org_id,
            task.id,
            repoUrl,
          );
          // Store workspace path and repo URL in task spec
          const current = await getTask(task.id);
          if (current) {
            const updatedSpec = { ...current.spec, workspace_path: workspace.workspaceDir, workspace_repo_url: repoUrl };
            await db.from('tasks').update({ spec: updatedSpec, updated_at: new Date().toISOString() }).eq('id', task.id);
          }
        } catch (err) {
          console.error(`[dispatcher] workspace creation failed for ${task.id.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
          // Non-fatal — worker falls back to simple workspace
        }
      }
    }

    // Transition: QUEUED → DISPATCHED
    await applyTransition(task.id, 'DISPATCHED', 'Dispatcher-1', `assigned to ${workerId}`);

    logEvent(task.org_id, 'dispatch.task', 'Dispatcher-1', {
      taskId: task.id,
      workerId,
    });

    // Linear mirror — fire-and-forget
    resolveCredentials(task.org_id).then(creds => {
      if (!creds.linearApiKey) return;
      mirrorTaskCreated(
        creds.linearApiKey,
        task.org_id,
        task.id,
        task.spec.title ?? task.spec.description.slice(0, 100),
        task.spec.description,
      ).then(issueId => {
        if (issueId) {
          updateTaskLinearIssueId(task.id, issueId);
          logEvent(task.org_id, 'linear.mirror_created', 'Dispatcher-1', { taskId: task.id, linearIssueId: issueId });
        }
      });
    }).catch(err => console.error(`[linear] mirror fire-and-forget error: ${err instanceof Error ? err.message : String(err)}`));
  }

  /**
   * Select the best available worker for a role.
   * Prefers agents with higher acceptance rates. Falls back to default naming.
   */
  private async selectWorker(orgId: string, role: string): Promise<string> {
    try {
      const profiles = await getProfilesByRole(orgId, role);
      if (profiles.length > 0) {
        // Sort by acceptance_rate descending, nulls last
        profiles.sort((a, b) => (b.acceptanceRate ?? -1) - (a.acceptanceRate ?? -1));
        return profiles[0].agentId;
      }
    } catch {
      // Fall through to default
    }
    return `Worker-${role}-1`;
  }
}
