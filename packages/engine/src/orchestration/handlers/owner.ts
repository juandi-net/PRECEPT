import type { EngineContext } from './types.js';
import type { CEOService } from '../../services/ceo.js';
import { getTask } from '../../db/tasks.js';
import { approvePlan, getPlan } from '../../db/plans.js';
import { getOrg } from '../../db/orgs.js';
import { resolveCredentials } from '../../lib/credentials.js';
import { logOwnerFeedback } from '../../db/owner-feedback.js';
import { applyTransition } from '../state-machine.js';
import { logEvent } from '../../db/audit.js';
import { getLatestBriefingThread, getThreadMessageIds, insertEmailMessage } from '../../db/email-threads.js';

export class OwnerHandlers {
  constructor(
    private ctx: EngineContext,
    private ceo: CEOService,
  ) {}

  async handleOwnerReply(orgId: string, content: string, threadId: string | null): Promise<void> {
    const start = Date.now();
    const intent = await this.ceo.handleOwnerReply(orgId, content);
    console.log(`[ceo] owner reply parsed — ${intent.actions.length} actions (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'owner.reply', 'CEO-1', { orgId, actionCount: intent.actions.length });

    // Store feedback
    await logOwnerFeedback({
      orgId,
      source: 'briefing_reply',
      rawContent: content,
      parsedIntent: intent,
    });

    // Process actions
    for (const action of intent.actions) {
      switch (action.type) {
        case 'approve': {
          const plan = await getPlan(action.target_id);
          if (!plan) break;
          await approvePlan(action.target_id);
          this.ctx.push({ type: 'plan_approved', orgId, planId: action.target_id, level: plan.plan_level });
          break;
        }
        case 'hold':
          logEvent(orgId, 'owner.action', 'Engine', { orgId, action: 'hold', targetId: action.target_id });
          break;
        case 'pivot':
          logEvent(orgId, 'owner.action', 'Engine', { orgId, action: 'pivot', targetId: action.target_id, direction: action.direction });
          break;
        case 'free_text':
          logEvent(orgId, 'owner.action', 'Engine', { orgId, action: 'free_text' });
          break;
        case 'clarify':
          logEvent(orgId, 'owner.action', 'Engine', { orgId, action: 'clarify', question: action.question });
          break;
      }
    }

    // CEO reply-back in email thread if warranted
    if (threadId) {
      const needsReply = await this.ceo.shouldReplyToEmail(orgId, content, intent);

      if (needsReply) {
        const replyText = await this.ceo.composeEmailReply(orgId, content, intent);
        const thread = await getLatestBriefingThread(orgId);

        if (thread) {
          const creds = await resolveCredentials(orgId);
          const { sendEmailReply, letterToHtml } = await import('../../lib/email.js');
          const org = await getOrg(orgId);
          const orgName = org?.name ?? orgId;
          const messageIds = await getThreadMessageIds(thread.thread.id);
          const lastMessageId = messageIds[messageIds.length - 1] ?? '';

          const sendResult = await sendEmailReply({
            to: creds.ownerEmail ?? 'owner@org',
            orgName,
            htmlContent: letterToHtml(replyText, orgName),
            subject: thread.thread.subject,
            inReplyTo: lastMessageId,
            references: messageIds,
            resendApiKey: creds.resendApiKey,
            emailDomain: creds.emailDomain,
          });

          if (sendResult) {
            await insertEmailMessage({
              threadId: thread.thread.id,
              orgId,
              direction: 'outbound',
              senderRole: 'ceo',
              content: replyText,
              resendEmailId: sendResult.emailId,
              resendMessageId: sendResult.messageId,
            });
            console.log(`[engine] CEO reply-back sent in email thread ${thread.thread.id.slice(0, 8)}`);
          }
        }
      }
    }

    // Trigger ad-hoc planning if the reply parser flagged it
    if (intent.should_replan) {
      console.log('[engine] owner reply triggered ad-hoc replanning');
      this.ctx.push({ type: 'adhoc_planning', orgId, ownerInput: content });
    }
  }

  async handleOwnerTaskFeedback(orgId: string, taskId: string, feedback: string): Promise<void> {
    const start = Date.now();
    const task = await getTask(taskId);
    if (!task) {
      console.error(`[engine] owner feedback: task ${taskId} not found`);
      return;
    }

    console.log(`[engine] processing owner feedback for task ${taskId.slice(0, 8)}...`);

    // Owner override — first-class state machine transition
    await applyTransition(taskId, 'IN_PROGRESS', 'Owner', 'owner feedback override');

    // Log owner feedback
    await logOwnerFeedback({
      orgId,
      source: 'direct',
      rawContent: feedback,
      parsedIntent: { actions: [{ type: 'free_text' }] } as any,
    });

    // Re-fetch task with current state for rework
    const freshTask = await getTask(taskId);
    if (!freshTask) return;

    try {
      await this.ctx.runWorker(freshTask, orgId, { type: 'rework', feedback, source: 'owner' });
      this.ctx.push({ type: 'task_completed', orgId, taskId });
    } catch (err) {
      console.error(`[engine] owner feedback rework failed for task ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
      try { await applyTransition(taskId, 'FAILED', 'Engine', 'owner feedback rework error'); } catch { /* ignore */ }
      setTimeout(async () => {
        try {
          const t = await getTask(taskId);
          if (t?.state === 'FAILED') this.ctx.push({ type: 'task_terminal', orgId, taskId });
        } catch { /* ignore */ }
      }, 2500);
    }

    logEvent(orgId, 'owner.task_feedback', 'Owner', { taskId, feedbackLength: feedback.length });
    console.log(`[engine] owner feedback processed for task ${taskId.slice(0, 8)} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
  }
}
