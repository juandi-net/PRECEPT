import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { onboarding } from './routes/onboarding.js';
import { orchestration, engine } from './routes/orchestration.js';
import { webhooks } from './routes/webhooks.js';
import { Scheduler } from './orchestration/scheduler.js';

const app = new Hono();

app.use('/*', cors({
  origin: (origin) => origin,
}));

app.get('/health', (c) => c.json({ status: 'ok' }));
app.route('/api/onboarding', onboarding);
app.route('/api/orchestration', orchestration);
app.route('/api/webhooks', webhooks);

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT) || 3001;
  const orgId = process.env.DEFAULT_ORG_ID ?? '';

  // Recovery scan on startup
  if (orgId) {
    engine.recoverFromRestart(orgId).catch((err) => {
      console.error('[startup] recovery scan failed:', err);
    });
  }

  // Start scheduler
  if (orgId) {
    const scheduler = new Scheduler(engine, orgId);
    scheduler.start();
    console.log(`[startup] scheduler started for org ${orgId}`);
  }

  console.log(`Engine running on port ${port}`);
  serve({ fetch: app.fetch, port });
}

export { app };
