import type { Task } from '@precept/shared';
import type { EngineContext } from './types.js';
import type { CuratorService } from '../../services/curator.js';
import { getTask, getTasksByState, getTasksByStates } from '../../db/tasks.js';
import { deduplicateRoleMemory, flagStaleRoleMemory } from '../../db/role-memory.js';
import { applyTransition } from '../state-machine.js';
import { logEvent } from '../../db/audit.js';

export class MaintenanceHandlers {
  constructor(
    private ctx: EngineContext,
    private curator: CuratorService,
  ) {}

  async recoverFromRestart(orgId: string): Promise<void> {
    const start = Date.now();
    console.log('[engine] starting recovery scan...');
    const timeoutMs = parseInt(process.env.TASK_TIMEOUT_MS ?? '600000', 10);
    const now = Date.now();

    // Single query for all recoverable states
    const tasks = await getTasksByStates(orgId, [
      'QUEUED', 'DISPATCHED', 'IN_PROGRESS', 'REVIEW', 'POLISH', 'REVISION', 'JUDGMENT',
    ]);

    // Group by state for processing
    const byState = new Map<string, Task[]>();
    for (const task of tasks) {
      const group = byState.get(task.state) ?? [];
      group.push(task);
      byState.set(task.state, group);
    }

    // QUEUED tasks → re-dispatch
    for (const task of byState.get('QUEUED') ?? []) {
      logEvent(orgId, 'task.transition', 'Engine', { taskId: task.id, recovery: 'QUEUED → re-dispatch' });
      try {
        await applyTransition(task.id, 'DISPATCHED', 'Engine', 'recovery re-dispatch');
        await applyTransition(task.id, 'IN_PROGRESS', 'Engine', 'recovery worker starting');
        await this.ctx.runWorker(task, orgId, { type: 'execute' });
        this.ctx.push({ type: 'task_completed', orgId, taskId: task.id });
      } catch (err) {
        console.error(`[engine] recovery worker failed for task ${task.id}: ${err instanceof Error ? err.message : String(err)}`);
        try { await applyTransition(task.id, 'FAILED', 'Engine', 'recovery worker error'); } catch { /* ignore */ }
        setTimeout(async () => {
          try {
            const t = await getTask(task.id);
            if (t?.state === 'FAILED') this.ctx.push({ type: 'task_terminal', orgId, taskId: task.id });
          } catch { /* ignore */ }
        }, 2500);
      }
    }

    // DISPATCHED → check timeout, fail if stale
    for (const task of byState.get('DISPATCHED') ?? []) {
      const updatedAt = task.updated_at ? new Date(task.updated_at).getTime() : new Date(task.created_at).getTime();
      if (now - updatedAt > timeoutMs) {
        try {
          await applyTransition(task.id, 'FAILED', 'Engine', 'recovery timeout');
          setTimeout(async () => {
            try {
              const t = await getTask(task.id);
              if (t?.state === 'FAILED') this.ctx.push({ type: 'task_terminal', orgId, taskId: task.id });
            } catch { /* ignore */ }
          }, 2500);
        } catch (err) {
          console.error(`[engine] recovery transition failed for task ${task.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
        logEvent(orgId, 'task.transition', 'Engine', { taskId: task.id, recovery: 'timeout → FAILED' });
      }
    }

    // IN_PROGRESS → reset stuck tasks (>15 min) to QUEUED and re-dispatch
    const STUCK_THRESHOLD_MS = 15 * 60 * 1000;
    let stuckCount = 0;
    for (const task of byState.get('IN_PROGRESS') ?? []) {
      const updatedAt = task.updated_at ? new Date(task.updated_at).getTime() : new Date(task.created_at).getTime();
      if (now - updatedAt > STUCK_THRESHOLD_MS) {
        try {
          await applyTransition(task.id, 'QUEUED', 'Engine', 'recovery reset stuck task');
          await applyTransition(task.id, 'DISPATCHED', 'Engine', 'recovery re-dispatch');
          await applyTransition(task.id, 'IN_PROGRESS', 'Engine', 'recovery worker starting');
          const refreshed = await getTask(task.id);
          if (refreshed) {
            this.ctx.executeWorkerInBackground(refreshed, orgId, { type: 'execute' });
          }
          stuckCount++;
        } catch (err) {
          console.error(`[engine] recovery reset failed for task ${task.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    if (stuckCount > 0) {
      console.log(`[recovery] reset ${stuckCount} stuck tasks`);
      logEvent(orgId, 'engine.recovery', 'Engine', { recovery: 'stuck_reset', count: stuckCount });
    }

    // REVIEW → re-invoke reviewer
    for (const task of byState.get('REVIEW') ?? []) {
      this.ctx.push({ type: 'review_verdict', orgId, taskId: task.id });
    }

    // POLISH → transition to REVIEW, re-invoke
    for (const task of byState.get('POLISH') ?? []) {
      try {
        await applyTransition(task.id, 'REVIEW', 'Engine', 'recovery from POLISH');
        this.ctx.push({ type: 'review_verdict', orgId, taskId: task.id });
        logEvent(orgId, 'task.transition', 'Engine', { taskId: task.id, recovery: 'POLISH → REVIEW' });
      } catch (err) {
        console.error(`[engine] recovery POLISH→REVIEW failed for task ${task.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // REVISION → transition to REVIEW, re-invoke
    for (const task of byState.get('REVISION') ?? []) {
      try {
        await applyTransition(task.id, 'REVIEW', 'Engine', 'recovery from REVISION');
        this.ctx.push({ type: 'review_verdict', orgId, taskId: task.id });
        logEvent(orgId, 'task.transition', 'Engine', { taskId: task.id, recovery: 'REVISION → REVIEW' });
      } catch (err) {
        console.error(`[engine] recovery REVISION→REVIEW failed for task ${task.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // JUDGMENT → re-invoke judge
    for (const task of byState.get('JUDGMENT') ?? []) {
      this.ctx.push({ type: 'judge_verdict', orgId, taskId: task.id });
    }

    console.log(`[engine] recovery scan done (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'engine.recovery', 'Engine', { recovery: 'scan_complete', orgId });
  }

  async handleCuratorCycle(orgId: string): Promise<void> {
    const start = Date.now();
    try {
      const result = await this.curator.extractSkills(orgId);
      console.log(`[engine] curator cycle done (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    } catch (err) {
      console.error(`[engine] curator cycle failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async handleMemoryCleanup(orgId: string): Promise<void> {
    const start = Date.now();
    try {
      const deduped = await deduplicateRoleMemory(orgId, 0.95);
      const stale = await flagStaleRoleMemory(orgId, 30);
      console.log(`[engine] memory cleanup done — deduped=${deduped} stale=${stale} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    } catch (err) {
      console.error(`[engine] memory cleanup failed:`, err instanceof Error ? err.message : String(err));
    }
  }

  async handlePhaseCompleted(orgId: string, initiativeId: string, phase: number): Promise<void> {
    console.log(`[engine] phase ${phase} completed for initiative ${initiativeId.slice(0, 8)}`);
    logEvent(orgId, 'engine.phase_completed', 'Engine', { initiativeId, phase });

    // Find a PLANNED task from this initiative to get the plan for dispatch
    const planned = await getTasksByState(orgId, 'PLANNED');
    const nextTask = planned.find(t => t.initiative_id === initiativeId);

    if (!nextTask) {
      console.log(`[engine] all tasks dispatched for initiative ${initiativeId.slice(0, 8)}`);
      return;
    }

    await this.ctx.dispatchReadyTasks(orgId, nextTask.id);
  }
}
