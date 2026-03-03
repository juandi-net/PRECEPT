import { Hono } from 'hono';
import { OrchestrationEngine } from '../orchestration/engine.js';

// Singleton engine instance — shared across routes
const engine = new OrchestrationEngine();

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
  const body = await c.req.json<{ orgId: string; briefingId: string }>();
  if (!body?.orgId || !body?.briefingId) {
    return c.json({ error: 'orgId and briefingId required' }, 400);
  }

  engine.push({ type: 'owner_reply', orgId: body.orgId, briefingId: body.briefingId });
  return c.json({ status: 'triggered', event: 'owner_reply' });
});

orchestration.get('/tasks/:planId', async (c) => {
  const { planId } = c.req.param();
  // TODO: read tasks from DB
  return c.json({ planId, tasks: [] });
});

orchestration.get('/health', (c) => {
  return c.json({ status: 'ok', engine: 'running' });
});
