import { Hono } from 'hono';

export const webhooks = new Hono();

webhooks.post('/agentmail', async (c) => {
  // TODO: parse AgentMail webhook payload, extract owner reply, wire to engine
  return c.json({ status: 'received' });
});
