/**
 * OrchestrationEngine — sequential event queue that processes
 * domain events one at a time. Events pushed during processing
 * are queued and handled after the current event completes.
 */

import { CEOService } from '../services/ceo.js';
import { AdvisorService } from '../services/advisor.js';
import { DispatcherService } from '../services/dispatcher.js';
import { WorkerService } from '../services/worker.js';
import { getTask } from '../db/tasks.js';
import { applyTransition } from './state-machine.js';
import { logEvent } from '../db/audit.js';
import { logMessage } from '../db/messages.js';

export type EngineEvent =
  | { type: 'planning_cycle'; orgId: string }
  | { type: 'briefing_cycle'; orgId: string }
  | { type: 'plan_approved'; orgId: string; planId: string }
  | { type: 'task_completed'; orgId: string; taskId: string }
  | { type: 'review_verdict'; orgId: string; taskId: string }
  | { type: 'judge_verdict'; orgId: string; taskId: string }
  | { type: 'escalation'; orgId: string; taskId: string }
  | { type: 'phase_completed'; orgId: string; initiativeId: string; phase: number }
  | { type: 'owner_reply'; orgId: string; briefingId: string }
  | { type: 'memory_cleanup'; orgId: string };

export class OrchestrationEngine {
  private queue: EngineEvent[] = [];
  private processing = false;

  private ceo = new CEOService();
  private advisor = new AdvisorService();
  private dispatcher = new DispatcherService();
  private worker = new WorkerService();

  /** Enqueue an event and start draining if not already running. */
  push(event: EngineEvent): void {
    this.queue.push(event);
    if (!this.processing) {
      this.drain();
    }
  }

  /** Override in subclass or mock in tests to handle events. */
  async handleEvent(event: EngineEvent): Promise<void> {
    switch (event.type) {
      case 'planning_cycle':
        return this.handlePlanningCycle(event.orgId);
      case 'plan_approved':
        return this.handlePlanApproved(event.orgId, event.planId);
      case 'task_completed':
        return this.handleTaskCompleted(event.orgId, event.taskId);
      default:
        console.log(`[engine] unhandled event: ${event.type}`);
    }
  }

  private async handlePlanningCycle(orgId: string): Promise<void> {
    const plan = await this.ceo.planningCycle(orgId);
    const { verdict } = await this.advisor.reviewPlan(plan.id);

    if (verdict === 'FLAGGED') {
      logEvent('planning.cycle', 'Engine', {
        planId: plan.id,
        outcome: 'flagged_for_owner',
        verdict,
      });
      return;
    }

    this.push({ type: 'plan_approved', orgId, planId: plan.id });

    logEvent('planning.cycle', 'Engine', {
      planId: plan.id,
      outcome: 'auto_approved',
      verdict,
    });
  }

  private async handlePlanApproved(orgId: string, planId: string): Promise<void> {
    // Dispatch ready tasks
    const dispatchedIds = await this.dispatcher.executePlan(planId);

    // Execute each dispatched task
    for (const taskId of dispatchedIds) {
      const task = await getTask(taskId);
      if (!task) continue;

      try {
        // Transition: DISPATCHED → IN_PROGRESS
        await applyTransition(taskId, 'IN_PROGRESS', 'Dispatcher-1', 'worker starting');

        // Execute the worker
        const output = await this.worker.execute(task);

        // Push task_completed for post-processing
        this.push({ type: 'task_completed', orgId, taskId });

        // Log flag if worker raised one
        if (output.flag) {
          logMessage({
            org_id: orgId,
            from_role: 'worker',
            from_agent_id: task.assigned_worker ?? 'Worker-1',
            to_role: 'ceo',
            message_type: 'flag',
            payload: { taskId, flag: output.flag },
          });
        }
      } catch (err) {
        // Worker failed — mark task as FAILED
        try {
          await applyTransition(taskId, 'FAILED', 'Engine', err instanceof Error ? err.message : 'worker error');
        } catch {
          // State transition might also fail if not in valid state
        }

        logEvent('worker.failed', 'Engine', {
          taskId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logEvent('planning.approved', 'Engine', {
      planId,
      dispatchedCount: dispatchedIds.length,
    });
  }

  private async handleTaskCompleted(orgId: string, taskId: string): Promise<void> {
    const task = await getTask(taskId);
    if (!task) return;

    // Transition: IN_PROGRESS → REVIEW
    await applyTransition(taskId, 'REVIEW', task.assigned_worker ?? 'Worker-1', 'worker submitted output');

    logEvent('task.transition', 'Engine', {
      taskId,
      transition: 'IN_PROGRESS → REVIEW',
    });

    // Push review event — handled in Phase 4
    this.push({ type: 'review_verdict', orgId, taskId });
  }

  private async drain(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      try {
        await this.handleEvent(event);
      } catch (err) {
        console.error(`[engine] error handling ${event.type}:`, err);
      }
    }
    this.processing = false;
  }
}
