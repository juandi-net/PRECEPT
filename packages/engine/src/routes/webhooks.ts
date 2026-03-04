import { Hono } from 'hono';
import { Resend } from 'resend';
import { engine } from './orchestration.js';

export const webhooks = new Hono();

webhooks.post('/resend', async (c) => {
  const payload = await c.req.json();

  // Only handle inbound email events
  if (payload?.type !== 'email.received') {
    return c.json({ status: 'ignored', type: payload?.type });
  }

  const emailId = payload?.data?.email_id;
  if (!emailId) {
    return c.json({ error: 'No email_id in payload' }, 400);
  }

  // Fetch full email content via Resend API (webhook only has metadata)
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: email, error } = await resend.emails.get(emailId);
  if (error || !email) {
    return c.json({ error: 'Failed to fetch email content' }, 500);
  }

  const content = email.text ?? email.html ?? '';
  if (!content) {
    return c.json({ error: 'No reply content found' }, 400);
  }

  // Route by "to" address to determine org
  // Convention: ceo@mail.{orgdomain} — extract org from address
  // For now: use DEFAULT_ORG_ID
  const orgId = process.env.DEFAULT_ORG_ID ?? 'org-1';

  engine.push({
    type: 'owner_reply',
    orgId,
    briefingId: payload?.data?.subject ?? 'unknown',
    content,
  });

  return c.json({ status: 'received', event: 'owner_reply' });
});
