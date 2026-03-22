import { Hono } from 'hono';
import { OrchestrationEngine } from '../orchestration/engine.js';
import { CEOService } from '../services/ceo.js';
import { respondToBoardRequest, markBoardRequestsRead } from '../db/boardRequests.js';
import { getTask, getTasksByPlan, markTasksRead } from '../db/tasks.js';
import { getPlan } from '../db/plans.js';

// Singleton instances — shared across routes
const engine = new OrchestrationEngine();
const ceo = new CEOService();

export { engine };

export const orchestration = new Hono();

orchestration.post('/trigger-planning', async (c) => {
  const body = await c.req.json<{ orgId: string; level?: string }>();
  if (!body?.orgId) return c.json({ error: 'orgId required' }, 400);

  const level = body.level ?? 'weekly';
  switch (level) {
    case 'monthly':
      engine.push({ type: 'monthly_planning', orgId: body.orgId });
      break;
    case 'weekly':
      engine.push({ type: 'weekly_planning', orgId: body.orgId });
      break;
    case 'daily':
      engine.push({ type: 'daily_planning', orgId: body.orgId });
      break;
    default:
      return c.json({ error: `Invalid level: ${level}. Must be monthly, weekly, or daily.` }, 400);
  }
  return c.json({ status: 'triggered', event: `${level}_planning` });
});

orchestration.post('/trigger-briefing', async (c) => {
  const body = await c.req.json<{ orgId: string }>();
  if (!body?.orgId) return c.json({ error: 'orgId required' }, 400);

  engine.push({ type: 'briefing_cycle', orgId: body.orgId });
  return c.json({ status: 'triggered', event: 'briefing_cycle' });
});

orchestration.post('/approve-plan/:planId', async (c) => {
  const { planId } = c.req.param();
  const body = await c.req.json<{ orgId: string }>();
  if (!body?.orgId) return c.json({ error: 'orgId required' }, 400);

  const plan = await getPlan(planId);
  if (!plan) return c.json({ error: 'plan not found' }, 404);

  engine.push({ type: 'plan_approved', orgId: body.orgId, planId, level: plan.plan_level });
  return c.json({ status: 'triggered', event: 'plan_approved', planId });
});

orchestration.post('/owner-reply', async (c) => {
  const body = await c.req.json<{ orgId: string; briefingId: string; content: string }>();
  if (!body?.orgId || !body?.content) {
    return c.json({ error: 'orgId and content required' }, 400);
  }

  engine.push({ type: 'owner_reply', orgId: body.orgId, briefingId: body.briefingId ?? 'direct', content: body.content });
  return c.json({ status: 'triggered', event: 'owner_reply' });
});

orchestration.get('/tasks/:planId', async (c) => {
  const { planId } = c.req.param();
  const tasks = await getTasksByPlan(planId);
  return c.json({ planId, tasks });
});

orchestration.post('/ceo-chat', async (c) => {
  const body = await c.req.json<{
    orgId: string;
    message: string;
    attachments?: Array<{ filename: string; mediaType: string; base64: string }>;
  }>();
  if (!body?.orgId || !body?.message) {
    return c.json({ error: 'orgId and message required' }, 400);
  }

  try {
    const response = await ceo.handleChatMessage(
      body.orgId,
      body.message,
      (taskId) => {
        engine.push({ type: 'dispatch_task', orgId: body.orgId, taskId });
      },
      () => {
        engine.push({ type: 'adhoc_planning', orgId: body.orgId, ownerInput: body.message });
      },
      async (taskId) => {
        const task = await getTask(taskId);
        if (task) await engine.cleanupWorkspaceIfNeeded(task);
        await engine.dispatchReadyTasks(body.orgId, taskId);
      },
      body.attachments,
    );
    return c.json({ response });
  } catch (err) {
    console.error('[ceo-chat] Error:', err);
    return c.json({ error: 'CEO chat failed' }, 500);
  }
});

orchestration.post('/task-feedback', async (c) => {
  const body = await c.req.json<{ orgId: string; taskId: string; feedback: string }>();
  if (!body?.orgId || !body?.taskId || !body?.feedback) {
    return c.json({ error: 'orgId, taskId, and feedback required' }, 400);
  }

  engine.push({ type: 'owner_task_feedback', orgId: body.orgId, taskId: body.taskId, feedback: body.feedback });
  return c.json({ status: 'queued' });
});

orchestration.post('/board-requests/:id/respond', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{ orgId: string; response: string }>();
  if (!body?.orgId || !body?.response) {
    return c.json({ error: 'orgId and response required' }, 400);
  }

  const updated = await respondToBoardRequest(id, body.response);
  if (!updated) {
    return c.json({ error: 'Board request not found' }, 404);
  }

  engine.push({
    type: 'owner_reply',
    orgId: body.orgId,
    briefingId: 'board_request',
    content: body.response,
  });

  return c.json({ status: 'responded' });
});

orchestration.post('/trigger-curator', async (c) => {
  const body = await c.req.json<{ orgId: string }>();
  if (!body?.orgId) return c.json({ error: 'orgId required' }, 400);

  engine.push({ type: 'curator_cycle', orgId: body.orgId });
  return c.json({ status: 'triggered', event: 'curator_cycle' });
});

orchestration.post('/mark-read', async (c) => {
  const body = await c.req.json<{
    items: Array<{ type: 'escalation' | 'board_request'; id: string }>
  }>();
  if (!body?.items?.length) return c.json({ status: 'ok' });

  const taskIds = body.items.filter(i => i.type === 'escalation').map(i => i.id);
  const brIds = body.items.filter(i => i.type === 'board_request').map(i => i.id);

  await Promise.all([
    markTasksRead(taskIds),
    markBoardRequestsRead(brIds),
  ]);

  return c.json({ status: 'ok' });
});

orchestration.get('/health', (c) => {
  return c.json({ status: 'ok', engine: 'running' });
});
