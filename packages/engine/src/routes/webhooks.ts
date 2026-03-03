import { Hono } from 'hono';
import { engine } from './orchestration.js';

export const webhooks = new Hono();

webhooks.post('/agentmail', async (c) => {
  const body = await c.req.json<{
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }>();

  const content = body?.text ?? body?.html ?? '';
  if (!content) {
    return c.json({ error: 'No reply content found' }, 400);
  }

  // Extract orgId from the "to" address or subject
  // For now, use a simple convention: DEFAULT_ORG_ID from env
  const orgId = process.env.DEFAULT_ORG_ID ?? 'org-1';

  engine.push({
    type: 'owner_reply',
    orgId,
    briefingId: body?.subject ?? 'unknown',
    content,
  });

  return c.json({ status: 'received', event: 'owner_reply' });
});
