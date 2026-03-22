import type { Plan, PlanOutput, PlanInitiative, MonthlyPlanOutput, PlanLevel, EscalationDiagnosis, OwnerReplyIntent } from '@precept/shared';
import { getCeoChatSystemPrompt, buildCeoChatMessage, computeOwnerPresence } from '../ai/prompts/ceo-chat.js';
import { CEO_TASK_COMPLETION_SYSTEM_PROMPT, buildTaskCompletionMessage } from '../ai/prompts/ceo-task-completion.js';
import { insertChatMessage, getChatHistory, getRecentOwnerMessages } from '../db/chat.js';
import { getOwnerLastSeen } from '../db/orgs.js';
import { getRecentEvents } from '../db/audit.js';
import { createBoardRequest, getPendingBoardRequests } from '../db/boardRequests.js';
import { invokeAgent } from '../ai/invoke.js';
import { invokeAndValidate, SchemaValidationError } from '../ai/validate.js';
import { PlanOutputSchema, MonthlyPlanOutputSchema, EscalationDiagnosisSchema, OwnerReplyIntentSchema } from '../ai/schemas.js';
import { z } from 'zod';
import { CEO_WEEKLY_PLANNING_SYSTEM_PROMPT, buildWeeklyPlanningMessage } from '../ai/prompts/ceo-planning-weekly.js';
import { CEO_ESCALATION_SYSTEM_PROMPT, buildEscalationMessage } from '../ai/prompts/ceo-escalation.js';
import { CEO_BRIEFING_SYSTEM_PROMPT, buildBriefingMessage } from '../ai/prompts/ceo-briefing.js';
import { CEO_REPLY_PARSING_SYSTEM_PROMPT, buildReplyParsingMessage } from '../ai/prompts/ceo-reply-parsing.js';
import { CEO_EMAIL_REPLY_DECISION_PROMPT, CEO_EMAIL_REPLY_COMPOSE_PROMPT } from '../ai/prompts/ceo-email-reply.js';
import { getRecentEmailMessages } from '../db/email-threads.js';
import { ScribeService } from './scribe.js';
import { getLatestCornerstone } from '../db/cornerstone.js';
import { getRecentLessons, logDecision } from '../db/decisions.js';
import { getRecentFeedback } from '../db/owner-feedback.js';
import { createInitiative, getActiveInitiatives } from '../db/initiatives.js';
import { createPlan, getUnapprovedPlans, getLatestPlanByLevel, getRecentAdhocPlan } from '../db/plans.js';
import { createTasks, getTask, getTasksByState, getTransitions, updateTaskDependencies, updateEscalationDiagnosis, type CreateTaskParams } from '../db/tasks.js';
import { logMessage } from '../db/messages.js';
import { logEvent } from '../db/audit.js';
import { CEO_TOOLS, createCeoToolHandler } from '../tools/ceo-tools.js';
import { resolveCredentials } from '../lib/credentials.js';
import { cornerstoneToMarkdown } from '../lib/formatting.js';
import { roleRegistry } from '../config/role-registry.js';

/** Module-level cache for chat summaries — survives across CEOService instances */
const chatSummaryCache = new Map<string, { summary: string; coveredCount: number }>();

export class CEOService {
  private scribe = new ScribeService();

  private async processPlanOutput(
    orgId: string,
    planOutput: PlanOutput | MonthlyPlanOutput,
    level: PlanLevel,
    parentPlanId: string | null,
  ): Promise<Plan> {
    // Create plan record
    const plan = await createPlan({
      orgId,
      content: planOutput,
      planLevel: level,
      parentPlanId,
    });

    // Create initiatives and tasks
    const activeInitiatives = await getActiveInitiatives(orgId);

    for (const init of planOutput.initiatives) {
      const existing = activeInitiatives.find(
        (ai) => ai.name.toLowerCase() === init.name.toLowerCase()
          || ai.name.toLowerCase().includes(init.name.toLowerCase())
          || init.name.toLowerCase().includes(ai.name.toLowerCase())
      );

      let initiative;
      if (existing) {
        console.log(`[ceo] reusing existing initiative "${existing.name}" instead of creating duplicate "${init.name}"`);
        logEvent(orgId, 'planning.dedup', 'CEO-1', {
          existingInitiative: existing.name,
          proposedInitiative: init.name,
        });
        initiative = existing;
      } else {
        initiative = await createInitiative({
          orgId,
          name: init.name,
          description: init.description,
        });
      }

      // Monthly plans have no tasks — only weekly/daily/adhoc create tasks
      if (level !== 'monthly') {
        const idMap = new Map<string, string>();

        for (const phase of (init as PlanInitiative).phases) {
          const taskParams: CreateTaskParams[] = phase.tasks.map((t) => ({
            orgId,
            planId: plan.id,
            initiativeId: initiative.id,
            phase: phase.phase_number,
            role: t.role,
            spec: {
              title: t.title,
              description: t.description,
              acceptance_criteria: t.acceptance_criteria,
              priority: t.priority,
              ...(t.required_credentials?.length ? { required_credentials: t.required_credentials } : {}),
            },
            dependsOn: [],
          }));

          const createdTasks = await createTasks(taskParams);

          phase.tasks.forEach((planTask, idx) => {
            if (createdTasks[idx]) {
              idMap.set(planTask.id, createdTasks[idx].id);
            }
          });

          for (let i = 0; i < phase.tasks.length; i++) {
            const planDeps = phase.tasks[i].depends_on;
            if (planDeps.length === 0) continue;

            const remappedDeps = planDeps
              .map((planId) => idMap.get(planId))
              .filter((uuid): uuid is string => uuid !== undefined);

            if (remappedDeps.length > 0) {
              await updateTaskDependencies(createdTasks[i].id, remappedDeps);
            }
          }
        }
      }
    }

    // Log decisions
    for (const d of planOutput.decisions) {
      await logDecision({
        orgId,
        decision: d.decision,
        reasoning: d.reasoning,
        alternatives: d.alternatives,
        whyNot: d.why_not,
      });
    }

    // Create board requests in DB, then send one batch email
    const createdRequests: Array<{
      id: string;
      request: string;
      context: string;
      urgency: string;
      fallback: string;
    }> = [];

    for (const br of planOutput.board_requests ?? []) {
      const created = await createBoardRequest(orgId, plan.id, br);
      createdRequests.push({ id: created.id, ...br });
    }

    if (createdRequests.length > 0) {
      try {
        const [org, creds] = await Promise.all([
          (await import('../db/orgs.js')).getOrg(orgId),
          resolveCredentials(orgId),
        ]);
        const { sendBatchBoardRequestEmail } = await import('../lib/email.js');
        const { createThread: createEmailThread, insertEmailMessage } = await import('../db/email-threads.js');
        const { updateBoardRequestThreadId } = await import('../db/boardRequests.js');

        const orgName = org?.name ?? orgId;
        const count = createdRequests.length;
        const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
        const thread = await createEmailThread(orgId, 'board_request', `${orgName} — Board Requests (${count})`);

        const sendResult = await sendBatchBoardRequestEmail({
          to: creds.ownerEmail ?? 'owner@org',
          orgName,
          requests: createdRequests,
          appUrl,
          resendApiKey: creds.resendApiKey,
          emailDomain: creds.emailDomain,
        });

        if (sendResult) {
          for (const br of createdRequests) {
            await updateBoardRequestThreadId(br.id, thread.id);
          }
          await insertEmailMessage({
            threadId: thread.id,
            orgId,
            direction: 'outbound',
            senderRole: 'ceo',
            content: createdRequests.map((r) =>
              `Board Request: ${r.request}\nContext: ${r.context}\nUrgency: ${r.urgency}\nFallback: ${r.fallback}`
            ).join('\n\n---\n\n'),
            resendEmailId: sendResult.emailId,
            resendMessageId: sendResult.messageId,
          });
        }
      } catch (err) {
        console.error(`[ceo] batch board request email failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Log messages and audit
    logMessage({
      org_id: orgId,
      from_role: 'ceo',
      from_agent_id: 'CEO-1',
      to_role: 'dispatcher',
      message_type: 'plan',
      payload: { planId: plan.id },
    });

    return plan;
  }

  async monthlyPlan(orgId: string): Promise<Plan> {
    const start = Date.now();
    console.log('[ceo] starting monthly plan generation...');

    const cornerstone = await getLatestCornerstone(orgId);
    if (!cornerstone) throw new Error(`No Cornerstone found for org ${orgId}`);
    const cornerstoneMd = cornerstoneToMarkdown(cornerstone.content);

    const contextMsg = await this.scribe.compressContext(orgId);
    const [lessons, feedback, ownerMessages, pendingBoardReqs, emailMessages] = await Promise.all([
      getRecentLessons(orgId, 10),
      getRecentFeedback(orgId, 10),
      getRecentOwnerMessages(orgId, 10),
      getPendingBoardRequests(orgId),
      getRecentEmailMessages(orgId, 20),
    ]);

    const { CEO_MONTHLY_PLANNING_SYSTEM_PROMPT, buildMonthlyPlanningMessage } =
      await import('../ai/prompts/ceo-planning-monthly.js');

    const userMessage = buildMonthlyPlanningMessage(
      cornerstoneMd,
      contextMsg.payload,
      lessons.map((l) => ({ whatTried: l.whatTried, whatLearned: l.whatLearned })),
      feedback.map((f) => ({ rawContent: f.rawContent, parsedIntent: f.parsedIntent })),
      ownerMessages.map((m) => ({ content: m.content, createdAt: m.created_at })),
      [],
      pendingBoardReqs.map((br) => ({ content: br.content, urgency: br.urgency, created_at: br.created_at })),
      emailMessages.map((m) => ({ content: m.content, direction: m.direction, senderRole: m.sender_role, createdAt: m.created_at, threadType: m.thread_type })),
    );

    const model = await roleRegistry.getModel(orgId, 'ceo');
    const endpoint = await roleRegistry.getEndpoint(orgId, 'ceo');
    const { data: planOutput } = await invokeAndValidate('CEO-1', {
      orgId,
      model,
      endpoint,
      systemPrompt: CEO_MONTHLY_PLANNING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.7,
      jsonMode: true,
    }, MonthlyPlanOutputSchema, 'CEO monthly planning');

    const plan = await this.processPlanOutput(orgId, planOutput, 'monthly', null);

    const phaseCount = planOutput.initiatives.reduce((s, i) => s + i.phases.length, 0);
    console.log(`[ceo] monthly plan done — ${planOutput.initiatives.length} initiatives, ${phaseCount} phases (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'planning.monthly', 'CEO-1', { planId: plan.id, initiativeCount: planOutput.initiatives.length });

    return plan;
  }

  async weeklyPlan(orgId: string): Promise<Plan> {
    const start = Date.now();
    console.log('[ceo] starting weekly plan generation...');

    const cornerstone = await getLatestCornerstone(orgId);
    if (!cornerstone) throw new Error(`No Cornerstone found for org ${orgId}`);
    const cornerstoneMd = cornerstoneToMarkdown(cornerstone.content);

    const contextMsg = await this.scribe.compressContext(orgId);
    const [lessons, feedback, ownerMessages, pendingBoardReqs, emailMessages] = await Promise.all([
      getRecentLessons(orgId, 10),
      getRecentFeedback(orgId, 10),
      getRecentOwnerMessages(orgId, 10),
      getPendingBoardRequests(orgId),
      getRecentEmailMessages(orgId, 20),
    ]);

    // Get parent monthly plan
    const monthlyPlan = await getLatestPlanByLevel(orgId, 'monthly');
    const parentPlanText = monthlyPlan ? JSON.stringify(monthlyPlan.content, null, 2) : null;

    const userMessage = buildWeeklyPlanningMessage(
      cornerstoneMd,
      contextMsg.payload,
      lessons.map((l) => ({ whatTried: l.whatTried, whatLearned: l.whatLearned })),
      feedback.map((f) => ({ rawContent: f.rawContent, parsedIntent: f.parsedIntent })),
      ownerMessages.map((m) => ({ content: m.content, createdAt: m.created_at })),
      [],
      parentPlanText,
      pendingBoardReqs.map((br) => ({ content: br.content, urgency: br.urgency, created_at: br.created_at })),
      emailMessages.map((m) => ({ content: m.content, direction: m.direction, senderRole: m.sender_role, createdAt: m.created_at, threadType: m.thread_type })),
    );

    const model = await roleRegistry.getModel(orgId, 'ceo');
    const endpoint = await roleRegistry.getEndpoint(orgId, 'ceo');
    const { data: planOutput } = await invokeAndValidate('CEO-1', {
      orgId,
      model,
      endpoint,
      systemPrompt: CEO_WEEKLY_PLANNING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.7,
      jsonMode: true,
    }, PlanOutputSchema, 'CEO weekly planning');

    const plan = await this.processPlanOutput(orgId, planOutput, 'weekly', monthlyPlan?.id ?? null);

    const taskCount = planOutput.initiatives.reduce(
      (sum, i) => sum + i.phases.reduce((s, p) => s + p.tasks.length, 0), 0);
    console.log(`[ceo] weekly plan done — ${planOutput.initiatives.length} initiatives, ${taskCount} tasks (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'planning.weekly', 'CEO-1', { planId: plan.id, initiativeCount: planOutput.initiatives.length, taskCount });

    return plan;
  }

  async dailyPlan(orgId: string): Promise<Plan> {
    const start = Date.now();
    console.log('[ceo] starting daily plan generation...');

    const weeklyPlan = await getLatestPlanByLevel(orgId, 'weekly');
    const parentPlanText = weeklyPlan ? JSON.stringify(weeklyPlan.content, null, 2) : null;

    const [queued, failed, escalated, initiatives, pendingBoardReqs] = await Promise.all([
      getTasksByState(orgId, 'QUEUED'),
      getTasksByState(orgId, 'FAILED'),
      getTasksByState(orgId, 'ESCALATED'),
      getActiveInitiatives(orgId),
      getPendingBoardRequests(orgId),
    ]);

    const { CEO_DAILY_PLANNING_SYSTEM_PROMPT, buildDailyPlanningMessage } =
      await import('../ai/prompts/ceo-planning-daily.js');

    const taskSummary = (t: { id: string; spec: { title: string }; state: string; role: string }) =>
      ({ id: t.id, title: t.spec.title, state: t.state, role: t.role });

    const userMessage = buildDailyPlanningMessage(
      parentPlanText,
      queued.map(taskSummary),
      failed.map(taskSummary),
      escalated.map(taskSummary),
      initiatives.map((i) => ({ name: i.name, status: i.status, phase: i.phase_current })),
      pendingBoardReqs.map((br) => ({ content: br.content, urgency: br.urgency, created_at: br.created_at })),
    );

    const model = await roleRegistry.getModel(orgId, 'ceo');
    const endpoint = await roleRegistry.getEndpoint(orgId, 'ceo');
    const { data: planOutput } = await invokeAndValidate('CEO-1', {
      orgId,
      model,
      endpoint,
      systemPrompt: CEO_DAILY_PLANNING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.5,
      jsonMode: true,
    }, PlanOutputSchema, 'CEO daily planning');

    const plan = await this.processPlanOutput(orgId, planOutput, 'daily', weeklyPlan?.id ?? null);

    const taskCount = planOutput.initiatives.reduce(
      (sum, i) => sum + i.phases.reduce((s, p) => s + p.tasks.length, 0), 0);
    console.log(`[ceo] daily plan done — ${taskCount} tasks (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'planning.daily', 'CEO-1', { planId: plan.id, taskCount });

    return plan;
  }

  async adhocPlan(orgId: string, ownerInput: string): Promise<Plan | null> {
    const start = Date.now();
    console.log('[ceo] starting ad-hoc plan generation...');

    // Debounce: skip if recent ad-hoc plan exists
    const recent = await getRecentAdhocPlan(orgId, 5);
    if (recent) {
      console.log('[ceo] ad-hoc plan skipped — recent plan exists');
      logEvent(orgId, 'planning.adhoc.debounced', 'CEO-1', { recentPlanId: recent.id });
      return null;  // null signals debounce — caller skips advisor review
    }

    const [monthlyPlan, weeklyPlan, initiatives] = await Promise.all([
      getLatestPlanByLevel(orgId, 'monthly'),
      getLatestPlanByLevel(orgId, 'weekly'),
      getActiveInitiatives(orgId),
    ]);

    const { CEO_ADHOC_PLANNING_SYSTEM_PROMPT, buildAdhocPlanningMessage } =
      await import('../ai/prompts/ceo-planning-adhoc.js');

    const userMessage = buildAdhocPlanningMessage(
      ownerInput,
      monthlyPlan ? JSON.stringify(monthlyPlan.content, null, 2) : null,
      weeklyPlan ? JSON.stringify(weeklyPlan.content, null, 2) : null,
      initiatives.map((i) => ({ name: i.name, status: i.status, phase: i.phase_current })),
    );

    const model = await roleRegistry.getModel(orgId, 'ceo');
    const endpoint = await roleRegistry.getEndpoint(orgId, 'ceo');
    const { data: planOutput } = await invokeAndValidate('CEO-1', {
      orgId,
      model,
      endpoint,
      systemPrompt: CEO_ADHOC_PLANNING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.5,
      jsonMode: true,
    }, PlanOutputSchema, 'CEO adhoc planning');

    const plan = await this.processPlanOutput(orgId, planOutput, 'adhoc', weeklyPlan?.id ?? null);

    const taskCount = planOutput.initiatives.reduce(
      (sum, i) => sum + i.phases.reduce((s, p) => s + p.tasks.length, 0), 0);
    console.log(`[ceo] ad-hoc plan done — ${taskCount} tasks (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'planning.adhoc', 'CEO-1', { planId: plan.id, taskCount, ownerInput: ownerInput.substring(0, 100) });

    return plan;
  }

  async handleEscalation(taskId: string): Promise<EscalationDiagnosis> {
    const task = await getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const transitions = await getTransitions(taskId);
    const judgeEscalation = transitions
      .filter(t => t.to_state === 'ESCALATED' && t.agent_id === 'Judge-1')
      .pop();

    const model = await roleRegistry.getModel(task.org_id, 'ceo');
    const endpoint = await roleRegistry.getEndpoint(task.org_id, 'ceo');
    const { data: diagnosis } = await invokeAndValidate('CEO-1', {
      orgId: task.org_id,
      model,
      endpoint,
      systemPrompt: CEO_ESCALATION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: buildEscalationMessage({
          taskSpec: task.spec,
          workerOutput: task.output?.output ?? null,
          judgeReason: judgeEscalation?.reason ?? null,
          revisionCount: task.revision_count,
        }),
      }],
      temperature: 0.5,
      jsonMode: true,
    }, EscalationDiagnosisSchema, 'CEO escalation diagnosis');

    // Persist structured diagnosis on the task (rendered as headline on The Interface)
    await updateEscalationDiagnosis(taskId, diagnosis);

    return diagnosis;
  }

  async handleTaskCompletion(
    orgId: string,
    taskId: string,
    onDispatch?: (taskId: string) => void,
    onAdhocPlan?: () => void,
    onResolveAccepted?: (taskId: string) => void,
  ): Promise<void> {
    const start = Date.now();

    const [task, transitions, chatHistory, ownerLastSeen] = await Promise.all([
      getTask(taskId),
      getTransitions(taskId),
      getChatHistory(orgId, 10),
      getOwnerLastSeen(orgId),
    ]);

    if (!task) return;

    // Find the terminal transition reason
    const terminalTransition = transitions
      .filter(t => t.to_state === task.state)
      .pop();

    // Compute owner presence (15s threshold = 3x heartbeat interval)
    const PRESENCE_THRESHOLD_MS = 15_000;
    const ownerPresent = ownerLastSeen !== null &&
      (Date.now() - ownerLastSeen.getTime()) < PRESENCE_THRESHOLD_MS;
    const lastSeenDescription = ownerLastSeen === null
      ? 'Never seen'
      : `Not present — last seen ${Math.round((Date.now() - ownerLastSeen.getTime()) / 1000)}s ago`;

    // Resolve initiative name if linked
    let initiativeName: string | null = null;
    if (task.initiative_id) {
      const { getActiveInitiatives } = await import('../db/initiatives.js');
      const initiatives = await getActiveInitiatives(orgId);
      initiativeName = initiatives.find(i => i.id === task.initiative_id)?.name ?? null;
    }

    const userMessage = buildTaskCompletionMessage({
      taskId: task.id,
      title: task.spec.title ?? task.spec.description.slice(0, 60),
      state: task.state as 'ACCEPTED' | 'FAILED',
      role: task.role,
      source: task.source ?? 'planning_cycle',
      initiativeName,
      outputSummary: task.output?.output?.substring(0, 500) ?? '',
      verdictReason: terminalTransition?.reason ?? '',
      chatHistory: chatHistory.map(m => ({ role: m.role, content: m.content })),
      ownerPresence: { present: ownerPresent, lastSeenDescription },
    });

    const model = await roleRegistry.getModel(orgId, 'ceo');
    const endpoint = await roleRegistry.getEndpoint(orgId, 'ceo');
    const response = await invokeAgent('CEO-1', {
      orgId,
      model,
      endpoint,
      systemPrompt: CEO_TASK_COMPLETION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.3,
      tools: CEO_TOOLS,
      toolHandler: createCeoToolHandler(orgId, onDispatch, onAdhocPlan, onResolveAccepted),
    });

    const wroteMessage = response.content.trim().length > 10;
    if (wroteMessage) {
      await insertChatMessage(orgId, 'ceo', response.content, 'task_update');
    }

    console.log(`[ceo] task completion ${wroteMessage ? 'notified' : 'no action'} for ${taskId.slice(0, 8)} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'ceo.task_completion', 'CEO-1', { taskId, wrote_message: wroteMessage });
  }

  async compileBriefing(orgId: string): Promise<{ letter: string; boardRequestCount: number }> {
    const start = Date.now();
    console.log('[ceo] starting briefing compilation...');
    const [contextMsg, initiatives, escalated, ownerMessages, emailMessages, ownerLastSeen] = await Promise.all([
      this.scribe.compressContext(orgId),
      getActiveInitiatives(orgId),
      getTasksByState(orgId, 'ESCALATED'),
      getRecentOwnerMessages(orgId, 10),
      getRecentEmailMessages(orgId, 20),
      getOwnerLastSeen(orgId),
    ]);

    // Collect pending board requests from unapproved plans
    const unapproved = await getUnapprovedPlans(orgId);
    const boardRequests = unapproved.flatMap((p) =>
      (p.content.board_requests ?? []).map((r) => r.request),
    );

    const model = await roleRegistry.getModel(orgId, 'ceo');
    const endpoint = await roleRegistry.getEndpoint(orgId, 'ceo');
    const response = await invokeAgent('CEO-1', {
      orgId,
      model,
      endpoint,
      systemPrompt: CEO_BRIEFING_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: buildBriefingMessage({
          contextPackage: typeof contextMsg.payload === 'string' ? contextMsg.payload : JSON.stringify(contextMsg.payload),
          initiativeStates: initiatives.map((i) => ({
            name: i.name,
            phase: i.phase_current,
            status: i.status,
          })),
          boardRequests,
          escalations: escalated.map((t) => ({
            taskDescription: t.spec.title ?? t.spec.description,
            reason: `Revision count: ${t.revision_count}`,
            seenByOwner: t.owner_read_at != null,
          })),
          ownerMessages: ownerMessages.map((m) => ({ content: m.content, createdAt: m.created_at })),
          emailMessages: emailMessages.map((m) => ({ content: m.content, direction: m.direction, senderRole: m.sender_role, createdAt: m.created_at, threadType: m.thread_type })),
          ownerPresence: computeOwnerPresence(ownerLastSeen),
        }),
      }],
      temperature: 0.5,
    });

    // Store letter in chat history
    await insertChatMessage(orgId, 'ceo', response.content, 'briefing');

    console.log(`[ceo] briefing compiled (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'briefing.compiled', 'CEO-1', { orgId });
    return { letter: response.content, boardRequestCount: boardRequests.length };
  }

  async handleOwnerReply(orgId: string, content: string): Promise<OwnerReplyIntent> {
    const initiatives = await getActiveInitiatives(orgId);

    // Collect pending board requests
    const unapproved = await getUnapprovedPlans(orgId);
    const boardRequests = unapproved.flatMap((p) =>
      (p.content.board_requests ?? []).map((r) => r.request),
    );

    const model = await roleRegistry.getModel(orgId, 'ceo');
    const endpoint = await roleRegistry.getEndpoint(orgId, 'ceo');
    const { data: intent } = await invokeAndValidate('CEO-1', {
      orgId,
      model,
      endpoint,
      systemPrompt: CEO_REPLY_PARSING_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: buildReplyParsingMessage({
          rawReply: content,
          initiativeNames: initiatives.map((i) => ({ id: i.id, name: i.name })),
          pendingBoardRequests: boardRequests,
        }),
      }],
      temperature: 0.3,
      jsonMode: true,
    }, OwnerReplyIntentSchema, 'CEO owner reply parsing');

    return intent;
  }

  /** Get chat context with Scribe compression for older messages */
  private async getChatContext(orgId: string): Promise<{
    recentHistory: Array<{ role: string; content: string }>;
    conversationSummary?: string;
  }> {
    const allHistory = await getChatHistory(orgId, 50);

    if (allHistory.length <= 10) {
      return { recentHistory: allHistory.map(m => ({ role: m.role, content: m.content })) };
    }

    const oldMessages = allHistory.slice(0, -10);
    const recentMessages = allHistory.slice(-10);

    const cached = chatSummaryCache.get(orgId);
    let conversationSummary: string;

    if (cached && cached.coveredCount === oldMessages.length) {
      conversationSummary = cached.summary;
    } else {
      conversationSummary = await this.scribe.compressChat(
        orgId,
        oldMessages.map(m => ({ role: m.role, content: m.content })),
      );
      chatSummaryCache.set(orgId, { summary: conversationSummary, coveredCount: oldMessages.length });
    }

    return {
      recentHistory: recentMessages.map(m => ({ role: m.role, content: m.content })),
      conversationSummary,
    };
  }

  async handleChatMessage(
    orgId: string,
    message: string,
    onDispatch?: (taskId: string) => void,
    onAdhocPlan?: () => void,
    onResolveAccepted?: (taskId: string) => void,
    attachments?: Array<{ filename: string; mediaType: string; base64: string }>,
  ): Promise<string> {
    const start = Date.now();

    // Store owner message
    await insertChatMessage(orgId, 'owner', message, 'owner');

    const [{ recentHistory, conversationSummary }, ownerLastSeen] = await Promise.all([
      this.getChatContext(orgId),
      getOwnerLastSeen(orgId),
    ]);

    const textContent = buildCeoChatMessage({
      message,
      chatHistory: recentHistory,
      conversationSummary,
      ownerPresence: computeOwnerPresence(ownerLastSeen),
    });

    // Build content blocks: text + any attached files
    let content: string | Array<Record<string, unknown>> = textContent;
    if (attachments && attachments.length > 0) {
      const blocks: Array<Record<string, unknown>> = [
        { type: 'text', text: textContent },
      ];
      for (const att of attachments) {
        if (att.mediaType.startsWith('image/')) {
          blocks.push({
            type: 'image_url',
            image_url: { url: `data:${att.mediaType};base64,${att.base64}` },
          });
        } else if (att.mediaType === 'application/pdf') {
          blocks.push({
            type: 'image_url',
            image_url: { url: `data:application/pdf;base64,${att.base64}` },
          });
        } else {
          // Text-based files (CSV, plain text): decode and include inline
          const decoded = Buffer.from(att.base64, 'base64').toString('utf-8');
          blocks.push({
            type: 'text',
            text: `\n\n--- Attached file: ${att.filename} ---\n${decoded}`,
          });
        }
      }
      content = blocks;
    }

    const model = await roleRegistry.getModel(orgId, 'ceo');
    const endpoint = await roleRegistry.getEndpoint(orgId, 'ceo');
    const response = await invokeAgent('CEO-1', {
      orgId,
      model,
      endpoint,
      systemPrompt: getCeoChatSystemPrompt(),
      messages: [{
        role: 'user',
        content,
      }],
      temperature: 0.4,
      tools: CEO_TOOLS,
      toolHandler: createCeoToolHandler(orgId, onDispatch, onAdhocPlan, onResolveAccepted),
    });

    // Store CEO response
    await insertChatMessage(orgId, 'ceo', response.content, 'response');

    console.log(`[ceo] chat response (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'ceo.chat', 'CEO-1', { ownerMessage: message.substring(0, 100) });
    return response.content;
  }

  /** Full CEO invocation for inbound email replies — same authority as chat, response delivered via email */
  async handleEmailReply(orgId: string, message: string): Promise<string> {
    const start = Date.now();

    // Cross-channel context: chat history (with compression) + email thread history
    const [{ recentHistory, conversationSummary }, emailMessages, ownerLastSeen] = await Promise.all([
      this.getChatContext(orgId),
      getRecentEmailMessages(orgId, 20),
      getOwnerLastSeen(orgId),
    ]);

    const textContent = buildCeoChatMessage({
      message,
      chatHistory: recentHistory,
      conversationSummary,
      emailHistory: emailMessages.map(m => ({
        content: m.content, direction: m.direction, senderRole: m.sender_role,
        createdAt: m.created_at, threadType: m.thread_type,
      })),
      ownerPresence: computeOwnerPresence(ownerLastSeen),
    });

    const model = await roleRegistry.getModel(orgId, 'ceo');
    const endpoint = await roleRegistry.getEndpoint(orgId, 'ceo');
    const response = await invokeAgent('CEO-1', {
      orgId,
      model,
      endpoint,
      systemPrompt: getCeoChatSystemPrompt(),
      messages: [{ role: 'user', content: textContent }],
      temperature: 0.4,
      tools: CEO_TOOLS,
      // Note: onResolveAccepted not wired here — email reply lacks engine context.
      // Transition and diagnosis patch work without it; cleanup/dispatch happen on next engine tick.
      toolHandler: createCeoToolHandler(orgId),
    });

    console.log(`[ceo] email reply (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    logEvent(orgId, 'ceo.email_reply', 'CEO-1', { ownerMessage: message.substring(0, 100) });
    return response.content;
  }

  async shouldReplyToEmail(
    orgId: string,
    ownerMessage: string,
    intent: OwnerReplyIntent,
  ): Promise<boolean> {
    // Quick heuristic — skip LLM call for obvious cases
    const hasClarify = intent.actions.some((a) => a.type === 'clarify');
    if (hasClarify) return true;

    const allApprovals = intent.actions.every((a) => a.type === 'approve');
    if (allApprovals) return false;

    // For ambiguous cases, ask the CEO
    const ShouldReplySchema = z.object({ shouldReply: z.boolean() });
    try {
      const model = await roleRegistry.getModel(orgId, 'ceo');
      const endpoint = await roleRegistry.getEndpoint(orgId, 'ceo');
      const { data } = await invokeAndValidate('CEO-1', {
        orgId,
        model,
        endpoint,
        systemPrompt: CEO_EMAIL_REPLY_DECISION_PROMPT,
        messages: [{
          role: 'user',
          content: `Owner wrote: "${ownerMessage}"\n\nParsed intent: ${JSON.stringify(intent.actions)}`,
        }],
        temperature: 0.3,
        jsonMode: true,
      }, ShouldReplySchema, 'CEO email reply decision');
      return data.shouldReply;
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        console.warn(`[ceo] shouldReplyToEmail validation failed, defaulting to false: ${err.message}`);
        return false;
      }
      throw err;
    }
  }

  async composeEmailReply(
    orgId: string,
    ownerMessage: string,
    intent: OwnerReplyIntent,
  ): Promise<string> {
    const model = await roleRegistry.getModel(orgId, 'ceo');
    const endpoint = await roleRegistry.getEndpoint(orgId, 'ceo');
    const response = await invokeAgent('CEO-1', {
      orgId,
      model,
      endpoint,
      systemPrompt: CEO_EMAIL_REPLY_COMPOSE_PROMPT,
      messages: [{
        role: 'user',
        content: `Owner wrote: "${ownerMessage}"\n\nParsed intent: ${JSON.stringify(intent.actions)}\n\nWrite a brief reply.`,
      }],
      temperature: 0.4,
    });

    return response.content;
  }
}
