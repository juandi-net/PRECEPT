/**
 * OrchestrationEngine — sequential event queue that processes
 * domain events one at a time. Events pushed during processing
 * are queued and handled after the current event completes.
 */

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

  /** Enqueue an event and start draining if not already running. */
  push(event: EngineEvent): void {
    this.queue.push(event);
    if (!this.processing) {
      this.drain();
    }
  }

  /** Override in subclass or mock in tests to handle events. */
  async handleEvent(event: EngineEvent): Promise<void> {
    // Stub — real handlers wired in Phase 1.7
    console.log(`[engine] unhandled event: ${event.type}`);
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
