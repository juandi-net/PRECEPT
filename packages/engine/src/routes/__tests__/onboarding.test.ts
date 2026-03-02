import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../../index.js';

vi.mock('../../services/onboarding.js', () => {
  const OnboardingService = vi.fn();
  OnboardingService.prototype.startSession = vi.fn();
  OnboardingService.prototype.sendMessage = vi.fn();
  OnboardingService.prototype.completeSession = vi.fn();
  OnboardingService.prototype.getSessionStatus = vi.fn();
  return { OnboardingService };
});

import { OnboardingService } from '../../services/onboarding.js';

describe('Onboarding Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/onboarding/start', () => {
    it('returns 200 with sessionId and opening message', async () => {
      vi.mocked(OnboardingService.prototype.startSession).mockResolvedValue({
        sessionId: 'session-1',
        message: 'Hello! Tell me about your business.',
      });

      const res = await app.request('/api/onboarding/start', { method: 'POST' });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.sessionId).toBe('session-1');
      expect(body.message).toBeDefined();
    });
  });

  describe('POST /api/onboarding/message', () => {
    it('returns 200 with CEO reply and updated draft', async () => {
      vi.mocked(OnboardingService.prototype.sendMessage).mockResolvedValue({
        message: 'Tell me more.',
        preceptsDraft: {} as any,
        phase: 1,
      });

      const res = await app.request('/api/onboarding/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'session-1', message: 'We sell software.' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.message).toBe('Tell me more.');
    });

    it('returns 400 when sessionId is missing', async () => {
      const res = await app.request('/api/onboarding/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/onboarding/complete', () => {
    it('returns 200 with preceptsId', async () => {
      vi.mocked(OnboardingService.prototype.completeSession).mockResolvedValue({
        preceptsId: 'precepts-1',
      });

      const res = await app.request('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'session-1', finalDraft: {} }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.preceptsId).toBe('precepts-1');
    });
  });

  describe('GET /api/onboarding/status', () => {
    it('returns session when found', async () => {
      vi.mocked(OnboardingService.prototype.getSessionStatus).mockResolvedValue({
        id: 'session-1',
        status: 'in_progress',
        conversation: [],
        preceptsDraft: {} as any,
        extractionTracker: {} as any,
        startedAt: new Date().toISOString(),
        completedAt: null,
      });

      const res = await app.request('/api/onboarding/status?sessionId=session-1');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.session.id).toBe('session-1');
    });

    it('returns 404 when session not found', async () => {
      vi.mocked(OnboardingService.prototype.getSessionStatus).mockResolvedValue(null);

      const res = await app.request('/api/onboarding/status?sessionId=nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
