import cron, { type ScheduledTask } from 'node-cron';
import type { OrchestrationEngine } from './engine.js';

export class Scheduler {
  private jobs: ScheduledTask[] = [];

  constructor(
    private engine: OrchestrationEngine,
    private orgId: string,
  ) {}

  start(): void {
    // Monthly planning: 1st of month, 6pm
    this.jobs.push(
      cron.schedule('0 18 1 * *', () => {
        console.log('[scheduler] triggering monthly planning');
        this.engine.push({ type: 'monthly_planning', orgId: this.orgId });
      }),
    );

    // Weekly planning: Sunday 8pm
    this.jobs.push(
      cron.schedule('0 20 * * 0', () => {
        console.log('[scheduler] triggering weekly planning');
        this.engine.push({ type: 'weekly_planning', orgId: this.orgId });
      }),
    );

    // Daily planning: 7am
    this.jobs.push(
      cron.schedule('0 7 * * *', () => {
        console.log('[scheduler] triggering daily planning');
        this.engine.push({ type: 'daily_planning', orgId: this.orgId });
      }),
    );

    // Curator: weekly, Monday 2am
    this.jobs.push(
      cron.schedule('0 2 * * 1', () => {
        console.log('[scheduler] triggering curator cycle');
        this.engine.push({ type: 'curator_cycle', orgId: this.orgId });
      }),
    );

    // Memory cleanup: daily 3am — dedup + staleness flagging
    this.jobs.push(
      cron.schedule('0 3 * * *', () => {
        console.log('[scheduler] triggering memory cleanup');
        this.engine.push({ type: 'memory_cleanup', orgId: this.orgId });
      }),
    );
  }

  stop(): void {
    this.jobs.forEach((job) => job.stop());
    this.jobs = [];
  }
}
