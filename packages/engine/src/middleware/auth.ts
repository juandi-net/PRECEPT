import type { MiddlewareHandler } from 'hono';
import { db } from '../db/client.js';

/**
 * Validates the caller's Supabase access token.
 * Rejects requests without a valid JWT.
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = header.slice(7);
  const { data: { user }, error } = await db.auth.getUser(token);

  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
};
