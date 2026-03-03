import cron, { type ScheduledTask } from 'node-cron';
import type { OrchestrationEngine } from './engine.js';

export class Scheduler {
  private jobs: ScheduledTask[] = [];

  constructor(
    private engine: OrchestrationEngine,
    private orgId: string,
  ) {}

  start(): void {
    // Weekly planning: Sunday 8pm
    this.jobs.push(
      cron.schedule('0 20 * * 0', () => {
        this.engine.push({ type: 'planning_cycle', orgId: this.orgId });
      }),
    );

    // Daily briefing: 7am
    this.jobs.push(
      cron.schedule('0 7 * * *', () => {
        this.engine.push({ type: 'briefing_cycle', orgId: this.orgId });
      }),
    );
  }

  stop(): void {
    this.jobs.forEach((job) => job.stop());
    this.jobs = [];
  }
}
