/**
 * OrchestrationEngine — sequential event queue that processes
 * domain events one at a time. Events pushed during processing
 * are queued and handled after the current event completes.
 */

import type { Task, WorkerOutput, PlanLevel } from '@precept/shared';
import { CEOService } from '../services/ceo.js';
import { AdvisorService } from '../services/advisor.js';
import { DispatcherService } from '../services/dispatcher.js';
import { WorkerService } from '../services/worker.js';
import { ReviewerService } from '../services/reviewer.js';
import { JudgeService } from '../services/judge.js';
import { ScribeService } from '../services/scribe.js';
import { CuratorService } from '../services/curator.js';
import { Semaphore } from '../lib/semaphore.js';
import type { WorkerMode } from './handlers/types.js';
import { PlanningHandlers } from './handlers/planning.js';
import { ExecutionHandlers } from './handlers/execution.js';
import { EvaluationHandlers } from './handlers/evaluation.js';
import { OwnerHandlers } from './handlers/owner.js';
import { MaintenanceHandlers } from './handlers/maintenance.js';

export type EngineEvent =
  | { type: 'monthly_planning'; orgId: string }
  | { type: 'weekly_planning'; orgId: string }
  | { type: 'daily_planning'; orgId: string }
  | { type: 'adhoc_planning'; orgId: string; ownerInput: string }
  | { type: 'briefing_cycle'; orgId: string }
  | { type: 'plan_approved'; orgId: string; planId: string; level: PlanLevel }
  | { type: 'task_completed'; orgId: string; taskId: string }
  | { type: 'review_verdict'; orgId: string; taskId: string }
  | { type: 'judge_verdict'; orgId: string; taskId: string }
  | { type: 'escalation'; orgId: string; taskId: string }
  | { type: 'phase_completed'; orgId: string; initiativeId: string; phase: number }
  | { type: 'owner_reply'; orgId: string; briefingId: string; content: string; threadId?: string | null }
  | { type: 'curator_cycle'; orgId: string }
  | { type: 'owner_task_feedback'; orgId: string; taskId: string; feedback: string }
  | { type: 'dispatch_task'; orgId: string; taskId: string }
  | { type: 'task_terminal'; orgId: string; taskId: string }
  | { type: 'memory_cleanup'; orgId: string };

export class OrchestrationEngine {
  private queue: EngineEvent[] = [];
  private processing = false;

  // Services
  private ceo = new CEOService();
  private advisor = new AdvisorService();
  private dispatcher = new DispatcherService();
  private worker = new WorkerService();
  private reviewer = new ReviewerService();
  private judge = new JudgeService();
  private scribe = new ScribeService();
  private curator = new CuratorService();
  private workerSemaphore = new Semaphore(
    parseInt(process.env.WORKER_CONCURRENCY_LIMIT ?? '3', 10)
  );

  // Handler modules
  private execution = new ExecutionHandlers(this, this.worker, this.dispatcher, this.workerSemaphore);
  private planning = new PlanningHandlers(this, this.ceo, this.advisor, this.dispatcher);
  private evaluation = new EvaluationHandlers(this, this.reviewer, this.judge, this.ceo);
  private owner = new OwnerHandlers(this, this.ceo);
  private maintenance = new MaintenanceHandlers(this, this.curator);

  // EngineContext implementation
  push(event: EngineEvent): void {
    this.queue.push(event);
    if (!this.processing) {
      this.drain();
    }
  }

  runWorker(task: Task, orgId: string, mode: WorkerMode): Promise<WorkerOutput> {
    return this.execution.runWorker(task, orgId, mode);
  }

  executeWorkerInBackground(task: Task, orgId: string, mode: WorkerMode, onComplete?: () => Promise<void>): void {
    this.execution.executeWorkerInBackground(task, orgId, mode, onComplete);
  }

  dispatchReadyTasks(orgId: string, taskId: string): Promise<void> {
    return this.execution.dispatchReadyTasks(orgId, taskId);
  }

  cleanupWorkspaceIfNeeded(task: Task): Promise<void> {
    return this.execution.cleanupWorkspaceIfNeeded(task);
  }

  /** Override in subclass or mock in tests to handle events. */
  async handleEvent(event: EngineEvent): Promise<void> {
    switch (event.type) {
      case 'monthly_planning': return this.planning.handleMonthlyPlanning(event.orgId);
      case 'weekly_planning': return this.planning.handleWeeklyPlanning(event.orgId);
      case 'daily_planning': return this.planning.handleDailyPlanning(event.orgId);
      case 'adhoc_planning': return this.planning.handleAdhocPlanning(event.orgId, event.ownerInput);
      case 'briefing_cycle': return this.planning.handleBriefingCycle(event.orgId);
      case 'plan_approved': return this.planning.handlePlanApproved(event.orgId, event.planId, event.level);
      case 'task_completed': return this.execution.handleTaskCompleted(event.orgId, event.taskId);
      case 'review_verdict': return this.evaluation.handleReviewVerdict(event.orgId, event.taskId);
      case 'judge_verdict': return this.evaluation.handleJudgeVerdict(event.orgId, event.taskId);
      case 'escalation': return this.evaluation.handleEscalation(event.orgId, event.taskId);
      case 'phase_completed': return this.maintenance.handlePhaseCompleted(event.orgId, event.initiativeId, event.phase);
      case 'owner_reply': return this.owner.handleOwnerReply(event.orgId, event.content, event.threadId ?? null);
      case 'curator_cycle': return this.maintenance.handleCuratorCycle(event.orgId);
      case 'owner_task_feedback': return this.owner.handleOwnerTaskFeedback(event.orgId, event.taskId, event.feedback);
      case 'dispatch_task': return this.execution.handleDispatchTask(event.orgId, event.taskId);
      case 'task_terminal': return this.evaluation.handleTaskTerminal(event.orgId, event.taskId);
      case 'memory_cleanup': return this.maintenance.handleMemoryCleanup(event.orgId);
      default: {
        const _exhaustive: never = event;
        console.warn(`[engine] unhandled event: ${(_exhaustive as EngineEvent).type}`);
      }
    }
  }

  async recoverFromRestart(orgId: string): Promise<void> {
    return this.maintenance.recoverFromRestart(orgId);
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
