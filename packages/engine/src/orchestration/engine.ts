/**
 * OrchestrationEngine — sequential event queue that processes
 * domain events one at a time. Events pushed during processing
 * are queued and handled after the current event completes.
 */

import { CEOService } from '../services/ceo.js';
import { AdvisorService } from '../services/advisor.js';
import { logEvent } from '../db/audit.js';

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
      default:
        console.log(`[engine] unhandled event: ${event.type}`);
    }
  }

  private async handlePlanningCycle(orgId: string): Promise<void> {
    // 1. CEO creates plan
    const plan = await this.ceo.planningCycle(orgId);

    // 2. Advisor reviews plan
    const { verdict } = await this.advisor.reviewPlan(plan.id);

    // 3. Route based on verdict
    if (verdict === 'FLAGGED') {
      logEvent('planning.cycle', 'Engine', {
        planId: plan.id,
        outcome: 'flagged_for_owner',
        verdict,
      });
      // Wait for owner review — don't auto-approve
      return;
    }

    // APPROVED or APPROVED_WITH_CONCERNS → push plan_approved
    this.push({ type: 'plan_approved', orgId, planId: plan.id });

    logEvent('planning.cycle', 'Engine', {
      planId: plan.id,
      outcome: 'auto_approved',
      verdict,
    });
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
