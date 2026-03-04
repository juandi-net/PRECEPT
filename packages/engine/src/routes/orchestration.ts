import { Hono } from 'hono';
import { OrchestrationEngine } from '../orchestration/engine.js';
import { CEOService } from '../services/ceo.js';
import { respondToBoardRequest } from '../db/boardRequests.js';

// Singleton instances — shared across routes
const engine = new OrchestrationEngine();
const ceo = new CEOService();

export { engine };

export const orchestration = new Hono();

orchestration.post('/trigger-planning', async (c) => {
  const body = await c.req.json<{ orgId: string }>();
  if (!body?.orgId) return c.json({ error: 'orgId required' }, 400);

  engine.push({ type: 'planning_cycle', orgId: body.orgId });
  return c.json({ status: 'triggered', event: 'planning_cycle' });
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

  engine.push({ type: 'plan_approved', orgId: body.orgId, planId });
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
  // TODO: read tasks from DB
  return c.json({ planId, tasks: [] });
});

orchestration.post('/ceo-chat', async (c) => {
  const body = await c.req.json<{ orgId: string; message: string }>();
  if (!body?.orgId || !body?.message) {
    return c.json({ error: 'orgId and message required' }, 400);
  }

  try {
    const response = await ceo.handleChatMessage(body.orgId, body.message);
    return c.json({ response });
  } catch (err) {
    console.error('[ceo-chat] Error:', err);
    return c.json({ error: 'CEO chat failed' }, 500);
  }
});

orchestration.post('/board-requests/:id/respond', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{ orgId: string; response: string }>();
  if (!body?.orgId || !body?.response) {
    return c.json({ error: 'orgId and response required' }, 400);
  }

  await respondToBoardRequest(id, body.response);

  engine.push({
    type: 'owner_reply',
    orgId: body.orgId,
    briefingId: 'board_request',
    content: body.response,
  });

  return c.json({ status: 'responded' });
});

orchestration.get('/health', (c) => {
  return c.json({ status: 'ok', engine: 'running' });
});
