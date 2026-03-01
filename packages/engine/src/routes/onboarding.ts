import { Hono } from 'hono';
import { OnboardingService } from '../services/onboarding.js';

const onboarding = new Hono();
const service = new OnboardingService();

onboarding.post('/start', async (c) => {
  try {
    const result = await service.startSession();
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

onboarding.post('/message', async (c) => {
  const body = await c.req.json();
  const { sessionId, message } = body;

  if (!sessionId || !message) {
    return c.json({ error: 'sessionId and message are required' }, 400);
  }

  try {
    const result = await service.sendMessage(sessionId, message);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

onboarding.post('/complete', async (c) => {
  const body = await c.req.json();
  const { sessionId, finalDraft } = body;

  if (!sessionId || !finalDraft) {
    return c.json({ error: 'sessionId and finalDraft are required' }, 400);
  }

  try {
    const result = await service.completeSession(sessionId, finalDraft);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

onboarding.get('/status', async (c) => {
  const sessionId = c.req.query('sessionId');

  if (!sessionId) {
    return c.json({ error: 'sessionId query param is required' }, 400);
  }

  const session = await service.getSessionStatus(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  return c.json({ session });
});

export { onboarding };
