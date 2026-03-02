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

function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'md') return 'text/markdown';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'pdf') return 'application/pdf';
  return '';
}

onboarding.post('/:sessionId/documents', async (c) => {
  const sessionId = c.req.param('sessionId');

  try {
    const body = await c.req.parseBody({ all: true });
    const rawFiles = body['files'];
    const fileList = Array.isArray(rawFiles) ? rawFiles : rawFiles ? [rawFiles] : [];

    const files: Array<{ buffer: Buffer; filename: string; mimeType: string }> = [];
    for (const f of fileList) {
      if (!(f instanceof File)) continue;
      const arrayBuffer = await f.arrayBuffer();
      files.push({
        buffer: Buffer.from(arrayBuffer),
        filename: f.name,
        mimeType: inferMimeType(f),
      });
    }

    if (files.length === 0) {
      return c.json({ error: 'No files provided' }, 400);
    }

    const documents = await service.addDocuments(sessionId, files);
    return c.json({ documents });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

onboarding.delete('/:sessionId/documents/:index', async (c) => {
  const sessionId = c.req.param('sessionId');
  const index = parseInt(c.req.param('index'), 10);

  if (isNaN(index)) {
    return c.json({ error: 'Invalid index' }, 400);
  }

  try {
    const documents = await service.removeDocument(sessionId, index);
    return c.json({ documents });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export { onboarding };
