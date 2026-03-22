import type { PlanLevel } from '@precept/shared';
import type { EngineContext } from './types.js';
import type { CEOService } from '../../services/ceo.js';
import type { AdvisorService } from '../../services/advisor.js';
import type { DispatcherService } from '../../services/dispatcher.js';
import { getTask } from '../../db/tasks.js';
import { approvePlan, getPlanForCurrentMonth, getPlanForCurrentWeek } from '../../db/plans.js';
import { getOrg } from '../../db/orgs.js';
import { resolveCredentials } from '../../lib/credentials.js';
import { applyTransition } from '../state-machine.js';
import { logEvent } from '../../db/audit.js';
import { createThread, insertEmailMessage } from '../../db/email-threads.js';

export class PlanningHandlers {
  constructor(
    private ctx: EngineContext,
    private ceo: CEOService,
    private advisor: AdvisorService,
    private dispatcher: DispatcherService,
  ) {}

  async handleMonthlyPlanning(orgId: string): Promise<void> {
    const start = Date.now();
    const plan = await this.ceo.monthlyPlan(orgId);
    const { verdict } = await this.advisor.reviewPlan(plan.id);

    if (verdict === 'FLAGGED') {
      console.log(`[engine] monthly planning done — flagged for owner (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'planning.monthly', 'Engine', { planId: plan.id, outcome: 'flagged_for_owner', verdict });
      return;
    }

    console.log(`[engine] monthly planning done — auto-approved (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    this.ctx.push({ type: 'plan_approved', orgId, planId: plan.id, level: 'monthly' });
    logEvent(orgId, 'planning.monthly', 'Engine', { planId: plan.id, outcome: 'auto_approved', verdict });
  }

  async handleWeeklyPlanning(orgId: string): Promise<void> {
    // Cascade: ensure a monthly plan exists for the current month
    const monthlyPlan = await getPlanForCurrentMonth(orgId);
    if (!monthlyPlan) {
      console.log('[engine] weekly cascade — no monthly plan for current month, running monthly first');
      await this.handleMonthlyPlanning(orgId);
    }

    const start = Date.now();
    const plan = await this.ceo.weeklyPlan(orgId);
    const { verdict } = await this.advisor.reviewPlan(plan.id);

    if (verdict === 'FLAGGED') {
      console.log(`[engine] weekly planning done — flagged for owner (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'planning.weekly', 'Engine', { planId: plan.id, outcome: 'flagged_for_owner', verdict });
      return;
    }

    console.log(`[engine] weekly planning done — auto-approved (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    this.ctx.push({ type: 'plan_approved', orgId, planId: plan.id, level: 'weekly' });
    logEvent(orgId, 'planning.weekly', 'Engine', { planId: plan.id, outcome: 'auto_approved', verdict });

    // Trigger briefing after weekly plan
    this.ctx.push({ type: 'briefing_cycle', orgId });
  }

  async handleDailyPlanning(orgId: string): Promise<void> {
    // Cascade: ensure a weekly plan exists for the current week
    // (which itself cascades to monthly if needed)
    const weeklyPlan = await getPlanForCurrentWeek(orgId);
    if (!weeklyPlan) {
      console.log('[engine] daily cascade — no weekly plan for current week, running weekly first');
      await this.handleWeeklyPlanning(orgId);
    }

    const start = Date.now();
    const plan = await this.ceo.dailyPlan(orgId);
    const { verdict } = await this.advisor.reviewPlan(plan.id);

    if (verdict === 'FLAGGED') {
      console.log(`[engine] daily planning done — flagged for owner (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'planning.daily', 'Engine', { planId: plan.id, outcome: 'flagged_for_owner', verdict });
      return;
    }

    console.log(`[engine] daily planning done — auto-approved (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    this.ctx.push({ type: 'plan_approved', orgId, planId: plan.id, level: 'daily' });
    logEvent(orgId, 'planning.daily', 'Engine', { planId: plan.id, outcome: 'auto_approved', verdict });

    // Trigger briefing after daily plan
    this.ctx.push({ type: 'briefing_cycle', orgId });
  }

  async handleAdhocPlanning(orgId: string, ownerInput: string): Promise<void> {
    const start = Date.now();
    const plan = await this.ceo.adhocPlan(orgId, ownerInput);

    // null means debounced — skip advisor review
    if (!plan) {
      console.log(`[engine] ad-hoc planning debounced (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      return;
    }

    const { verdict } = await this.advisor.reviewPlan(plan.id);

    if (verdict === 'FLAGGED') {
      console.log(`[engine] ad-hoc planning done — flagged for owner (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'planning.adhoc', 'Engine', { planId: plan.id, outcome: 'flagged_for_owner', verdict });
      return;
    }

    console.log(`[engine] ad-hoc planning done — auto-approved (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    this.ctx.push({ type: 'plan_approved', orgId, planId: plan.id, level: 'adhoc' });
    logEvent(orgId, 'planning.adhoc', 'Engine', { planId: plan.id, outcome: 'auto_approved', verdict });
  }

  async handleBriefingCycle(orgId: string): Promise<void> {
    const start = Date.now();
    const { letter, boardRequestCount } = await this.ceo.compileBriefing(orgId);

    const [org, creds] = await Promise.all([getOrg(orgId), resolveCredentials(orgId)]);
    const orgName = org?.name ?? orgId;

    if (!creds.resendApiKey) {
      console.log(`[engine] briefing compiled — no Resend API key, skipping (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'briefing.sent', 'Engine', { orgId, method: 'skipped' });
      return;
    }

    const { sendBriefing, letterToHtml } = await import('../../lib/email.js');
    const shortDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const thread = await createThread(orgId, 'briefing', `${orgName} — ${shortDate}`);

    const sendResult = await sendBriefing({
      to: creds.ownerEmail ?? 'owner@org',
      orgName,
      date: new Date(),
      boardRequestCount,
      htmlContent: letterToHtml(letter, orgName),
      resendApiKey: creds.resendApiKey,
      emailDomain: creds.emailDomain,
    });

    if (sendResult) {
      await insertEmailMessage({
        threadId: thread.id,
        orgId,
        direction: 'outbound',
        senderRole: 'ceo',
        content: letter,
        resendEmailId: sendResult.emailId,
        resendMessageId: sendResult.messageId,
      });
    }

    console.log(`[engine] briefing sent via Resend (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'briefing.sent', 'Engine', { orgId, method: 'resend', threadId: thread.id });
  }

  async handlePlanApproved(orgId: string, planId: string, level: PlanLevel): Promise<void> {
    const start = Date.now();
    await approvePlan(planId);

    // Monthly plans have no tasks to dispatch — cascade to weekly
    if (level === 'monthly') {
      console.log(`[engine] monthly plan approved — cascading to weekly (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      logEvent(orgId, 'planning.approved', 'Engine', { planId, level, cascade: 'weekly_planning' });
      this.ctx.push({ type: 'weekly_planning', orgId });
      return;
    }

    // Weekly and daily/adhoc plans dispatch tasks
    const dispatchedIds = await this.dispatcher.executePlan(planId);

    for (const taskId of dispatchedIds) {
      const task = await getTask(taskId);
      if (!task) continue;

      try {
        await applyTransition(taskId, 'IN_PROGRESS', 'Dispatcher-1', 'worker starting');
        this.ctx.executeWorkerInBackground(task, orgId, { type: 'execute' });
      } catch (err) {
        console.error(`[engine] failed to start task ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
        try { await applyTransition(taskId, 'FAILED', 'Engine', err instanceof Error ? err.message : 'dispatch error'); } catch { /* ignore */ }
        setTimeout(async () => {
          try {
            const t = await getTask(taskId);
            if (t?.state === 'FAILED') this.ctx.push({ type: 'task_terminal', orgId, taskId });
          } catch { /* ignore */ }
        }, 2500);
        logEvent(orgId, 'worker.failed', 'Engine', { taskId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    console.log(`[engine] plan approved (${level}) — ${dispatchedIds.length} tasks launched (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'planning.approved', 'Engine', { planId, level, dispatchedCount: dispatchedIds.length });

    // Weekly plans cascade to daily; daily/adhoc are terminal
    if (level === 'weekly') {
      this.ctx.push({ type: 'daily_planning', orgId });
    }
  }
}
