import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { onboarding } from './routes/onboarding.js';
import { orchestration, engine } from './routes/orchestration.js';
import { webhooks } from './routes/webhooks.js';
import { githubApp } from './routes/github-app.js';
import { Scheduler } from './orchestration/scheduler.js';
import { embedText } from './lib/embeddings.js';
import { initContainerRuntime } from './infra/container-manager.js';
import { requireAuth } from './middleware/auth.js';

const app = new Hono();

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use('/*', cors({
  origin: (origin) => ALLOWED_ORIGINS.includes(origin) ? origin : '',
}));

app.get('/health', (c) => c.json({ status: 'ok' }));

// Protected routes — require valid Supabase JWT
app.use('/api/onboarding/*', requireAuth);
app.use('/api/orchestration/*', requireAuth);

app.route('/api/onboarding', onboarding);
app.route('/api/orchestration', orchestration);
app.route('/api/webhooks', webhooks);
app.route('/api/github/app', githubApp);

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    const port = Number(process.env.PORT) || 3001;
    const orgId = process.env.DEFAULT_ORG_ID ?? '';

    // Pre-warm embedding model — blocks ~30s on first run, instant after
    try {
      await embedText('warmup', 'query');
      console.log('[startup] embedding model cached');
    } catch (err) {
      console.error('[startup] embedding model warmup failed:', err instanceof Error ? err.message : String(err));
    }

    // Initialize Apple Container runtime
    await initContainerRuntime();

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
  })();
}

export { app };
