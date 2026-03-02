import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { onboarding } from './routes/onboarding.js';

const app = new Hono();

app.use('/*', cors({
  origin: (origin) => origin,
}));

app.get('/health', (c) => c.json({ status: 'ok' }));
app.route('/api/onboarding', onboarding);

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT) || 3001;
  console.log(`Engine running on port ${port}`);
  serve({ fetch: app.fetch, port });
}

export { app };
