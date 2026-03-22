import type { Task, WorkerOutput } from '@precept/shared';
import { TIER_BEHAVIORS } from '@precept/shared';
import type { EngineContext, WorkerMode } from './types.js';
import type { WorkerService } from '../../services/worker.js';
import type { DispatcherService } from '../../services/dispatcher.js';
import type { Semaphore } from '../../lib/semaphore.js';
import { cleanupCoderWorkspace } from '../../tools/workspace.js';
import { isContainerAvailable } from '../../infra/container-manager.js';
import { getTask, getTasksByPlan, getTransitions } from '../../db/tasks.js';
import { applyTransition } from '../state-machine.js';
import { getDispatchableTasks, checkPhaseCompletion } from '../dependency.js';
import { logEvent } from '../../db/audit.js';
import { logMessage } from '../../db/messages.js';
import { roleRegistry } from '../../config/role-registry.js';
import { fireLinearAcceptMirror } from '../../lib/linear.js';
import { logLesson } from '../../db/decisions.js';
import { addBulletinEntry } from '../../db/team-bulletin.js';

export class ExecutionHandlers {
  constructor(
    private ctx: EngineContext,
    private worker: WorkerService,
    private dispatcher: DispatcherService,
    private workerSemaphore: Semaphore,
  ) {}

  async handleTaskCompleted(orgId: string, taskId: string): Promise<void> {
    const task = await getTask(taskId);
    if (!task) return;

    // Check tier behavior — only execution tier goes through evaluation
    const config = await roleRegistry.get(orgId, task.role);
    const tier = config?.tier ?? 'execution';
    const behavior = TIER_BEHAVIORS[tier];

    if (!behavior.requiresEvaluation) {
      // System/leadership output — log and accept directly
      console.log(`[engine] task ${taskId.slice(0, 8)} completed — tier ${tier} skips evaluation`);
      await applyTransition(taskId, 'REVIEW', task.assigned_worker ?? 'Worker-1', 'worker submitted output');
      await applyTransition(taskId, 'JUDGMENT', 'Engine', `${tier} tier: evaluation not required`);
      await applyTransition(taskId, 'ACCEPTED', 'Engine', `${tier} tier: auto-accepted`);
      // Linear mirror — fire-and-forget
      fireLinearAcceptMirror(orgId, taskId, 'Engine');

      // Team bulletin for auto-accepted tasks (fire-and-forget)
      const acceptedForBulletin = await getTask(taskId);
      if (acceptedForBulletin) {
        const title = acceptedForBulletin.spec.title ?? acceptedForBulletin.spec.description.slice(0, 60);
        const outputSnippet = acceptedForBulletin.output?.output?.slice(0, 80) ?? '';
        const summary = outputSnippet ? `${title} — ${outputSnippet}` : title;
        addBulletinEntry({
          orgId,
          taskId,
          role: acceptedForBulletin.role,
          summary: summary.slice(0, 120),
        }).catch(err =>
          console.error(`[engine] bulletin entry failed for ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`));
      }

      await this.dispatchReadyTasks(orgId, taskId);
      // CEO task-completion triage
      this.ctx.push({ type: 'task_terminal', orgId, taskId });
      return;
    }

    // Check separation policy for elastic evaluation
    const reviewerConfig = await roleRegistry.get(orgId, 'reviewer');
    const stakes = task.spec.stakes ?? 'standard';
    const policy = reviewerConfig?.separationPolicy ?? 'always';

    const skipReviewer = (policy === 'high_stakes' && stakes === 'low')
                      || (policy === 'never');

    await applyTransition(taskId, 'REVIEW', task.assigned_worker ?? 'Worker-1', 'worker submitted output');

    if (skipReviewer) {
      // Skip reviewer, go directly to judgment
      console.log(`[engine] task ${taskId.slice(0, 8)} completed — low-stakes, reviewer skipped per separation_policy`);
      await applyTransition(taskId, 'JUDGMENT', 'Engine', 'low-stakes: reviewer skipped per separation_policy');
      this.ctx.push({ type: 'judge_verdict', orgId, taskId });
    } else {
      console.log(`[engine] task ${taskId.slice(0, 8)} completed — moving to review`);
      this.ctx.push({ type: 'review_verdict', orgId, taskId });
    }
  }

  async handleDispatchTask(orgId: string, taskId: string): Promise<void> {
    const start = Date.now();
    const task = await getTask(taskId);
    if (!task) {
      console.error(`[engine] dispatch_task: task ${taskId} not found`);
      return;
    }

    console.log(`[engine] dispatching owner-created task ${taskId.slice(0, 8)}...`);

    try {
      await this.dispatcher.dispatchTask(task);
      const dispatched = await getTask(taskId);
      if (!dispatched) return;
      await applyTransition(taskId, 'IN_PROGRESS', 'Engine', 'owner-created task starting');
      // Fire-and-forget
      this.ctx.executeWorkerInBackground(dispatched, orgId, { type: 'execute' });
    } catch (err) {
      console.error(`[engine] dispatch_task failed for ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
      try { await applyTransition(taskId, 'FAILED', 'Engine', 'dispatch_task worker error'); } catch { /* ignore */ }
      this.scheduleFailedTerminalEvent(orgId, taskId);
      this.logFailedTaskLesson(task, orgId, 'dispatch_task worker error');
    }

    console.log(`[engine] dispatch_task ${taskId.slice(0, 8)} launched (${((Date.now() - start) / 1000).toFixed(1)}s)`);
  }

  /**
   * Execute or rework a task via the worker, handling flag messages.
   * Callers handle state transitions and error recovery.
   */
  async runWorker(
    task: Task,
    orgId: string,
    mode: WorkerMode,
  ): Promise<WorkerOutput> {
    const output = mode.type === 'execute'
      ? await this.worker.execute(task)
      : await this.worker.rework(task, mode.feedback, mode.source);

    if (output.flag) {
      logMessage({
        org_id: orgId,
        from_role: 'worker',
        from_agent_id: task.assigned_worker ?? 'Worker-1',
        to_role: 'ceo',
        message_type: 'flag',
        payload: { taskId: task.id, flag: output.flag },
      });
    }

    // Route field signals
    const signals = output.field_signals;
    if (signals && signals.length > 0) {
      logEvent(orgId, 'worker.field_signal' as any, task.assigned_worker ?? 'Worker-1', {
        taskId: task.id,
        signals,
      });
      // Notify CEO about risks and contradictions
      for (const sig of signals) {
        if (sig.type === 'risk' || sig.type === 'contradiction') {
          logMessage({
            org_id: orgId,
            from_role: 'worker',
            from_agent_id: task.assigned_worker ?? 'Worker-1',
            to_role: 'ceo',
            message_type: 'field_signal',
            payload: { taskId: task.id, signal: sig },
          });
        }
      }
    }

    return output;
  }

  /**
   * Fire-and-forget worker execution. Acquires the semaphore, runs the worker,
   * and pushes completion/failure events to the queue. Does NOT block the caller.
   */
  executeWorkerInBackground(
    task: Task,
    orgId: string,
    mode: WorkerMode,
    onComplete?: () => Promise<void>,
  ): void {
    if (!isContainerAvailable()) {
      console.error(`[engine] container runtime not available — refusing to dispatch task ${task.id.slice(0, 8)}`);
      applyTransition(task.id, 'FAILED', 'Engine', 'Apple Container runtime not available. Install container CLI and run \'container system start\'.').catch(() => {});
      this.scheduleFailedTerminalEvent(orgId, task.id);
      return;
    }

    this.workerSemaphore.run(async () => {
      try {
        await this.runWorker(task, orgId, mode);
        if (onComplete) await onComplete();
        this.ctx.push({ type: 'task_completed', orgId, taskId: task.id });
      } catch (err) {
        console.error(`[worker] failed task ${task.id.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
        try {
          await applyTransition(task.id, 'FAILED', 'Engine', err instanceof Error ? err.message : 'worker error');
        } catch { /* ignore */ }
        this.scheduleFailedTerminalEvent(orgId, task.id);
        this.cleanupWorkspaceIfNeeded(task);
        logEvent(orgId, 'worker.failed', 'Engine', { taskId: task.id, error: err instanceof Error ? err.message : String(err) });
        this.logFailedTaskLesson(task, orgId, err instanceof Error ? err.message : 'worker error');
      }
    }).catch(err => {
      // Semaphore itself should never throw, but guard anyway
      console.error(`[engine] semaphore error for task ${task.id.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  /**
   * After a task reaches a terminal state, check its plan for newly dispatchable tasks
   * and phase completion. This creates a rolling dispatch window.
   */
  async dispatchReadyTasks(orgId: string, taskId: string): Promise<void> {
    const task = await getTask(taskId);
    if (!task?.plan_id) return;

    const allTasks = await getTasksByPlan(task.plan_id);
    const newlyReady = getDispatchableTasks(allTasks);

    for (const ready of newlyReady) {
      try {
        await this.dispatcher.dispatchTask(ready);
        const dispatched = await getTask(ready.id);
        if (!dispatched) continue;
        await applyTransition(ready.id, 'IN_PROGRESS', 'Engine', 'worker starting');
        // Fire-and-forget — worker runs in background
        this.executeWorkerInBackground(dispatched, orgId, { type: 'execute' });
      } catch (err) {
        console.error(`[worker] failed task ${ready.id}: ${err instanceof Error ? err.message : String(err)}`);
        try { await applyTransition(ready.id, 'FAILED', 'Engine', 'worker error'); } catch { /* ignore */ }
        this.scheduleFailedTerminalEvent(orgId, ready.id);
        this.logFailedTaskLesson(ready, orgId, 'worker error');
      }
    }

    // Check phase completion
    if (task.initiative_id && checkPhaseCompletion(allTasks, task.phase)) {
      this.ctx.push({ type: 'phase_completed', orgId, initiativeId: task.initiative_id, phase: task.phase });
    }
  }

  /** Store a lesson when a task fails (fire-and-forget). */
  private logFailedTaskLesson(task: Task, orgId: string, errorMsg: string): void {
    getTransitions(task.id).then(transitions => {
      const lastFeedback = transitions
        .filter(t => t.reason && (t.agent_id.startsWith('Judge') || t.agent_id.startsWith('Reviewer')))
        .pop()?.reason ?? 'no feedback';
      return logLesson({
        orgId,
        initiativeId: task.initiative_id ?? undefined,
        whatTried: task.spec.description,
        whatHappened: `Task failed: ${errorMsg}`,
        whatLearned: `Task failed after max revisions. Last feedback: ${lastFeedback}`,
      });
    }).catch(err =>
      console.error(`[engine] lesson storage failed for ${task.id.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`));
  }

  /** Push task_terminal event after delay, only if task is still FAILED (not auto-escalated). */
  private scheduleFailedTerminalEvent(orgId: string, taskId: string): void {
    setTimeout(async () => {
      try {
        const task = await getTask(taskId);
        if (task?.state === 'FAILED') {
          this.ctx.push({ type: 'task_terminal', orgId, taskId });
        }
      } catch (err) {
        console.error(`[engine] failed to check task state for terminal event: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, 2500);
  }

  async cleanupWorkspaceIfNeeded(task: Task): Promise<void> {
    const specWithWorkspace = task.spec as Task['spec'] & { workspace_path?: string; workspace_repo_url?: string };
    if (specWithWorkspace.workspace_path && task.role === 'coder') {
      cleanupCoderWorkspace(task.org_id, task.id, specWithWorkspace.workspace_repo_url ?? '').catch(err =>
        console.error(`[engine] workspace cleanup failed for ${task.id.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`)
      );
    }
  }
}
