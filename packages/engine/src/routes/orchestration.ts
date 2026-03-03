import { Hono } from 'hono';

export const orchestration = new Hono();

orchestration.post('/trigger-planning', async (c) => {
  // TODO: wire to engine.push({ type: 'planning_cycle', orgId })
  return c.json({ status: 'queued', event: 'planning_cycle' });
});

orchestration.post('/trigger-briefing', async (c) => {
  // TODO: wire to engine.push({ type: 'briefing_cycle', orgId })
  return c.json({ status: 'queued', event: 'briefing_cycle' });
});

orchestration.post('/approve-plan/:planId', async (c) => {
  const { planId } = c.req.param();
  // TODO: wire to engine.push({ type: 'plan_approved', orgId, planId })
  return c.json({ status: 'queued', event: 'plan_approved', planId });
});

orchestration.post('/owner-reply', async (c) => {
  // TODO: parse body, wire to engine.push({ type: 'owner_reply', orgId, briefingId })
  return c.json({ status: 'queued', event: 'owner_reply' });
});

orchestration.get('/tasks/:planId', async (c) => {
  const { planId } = c.req.param();
  // TODO: read tasks from DB
  return c.json({ planId, tasks: [] });
});

orchestration.get('/health', (c) => {
  return c.json({ status: 'ok', engine: 'running' });
});
