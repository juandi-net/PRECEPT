import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInvokeAgent } = vi.hoisted(() => ({
  mockInvokeAgent: vi.fn(),
}));

vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: mockInvokeAgent,
}));

vi.mock('../../db/audit.js', () => ({
  getRecentEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/initiatives.js', () => ({
  getActiveInitiatives: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/decisions.js', () => ({
  getRecentLessons: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/messages.js', () => ({
  logMessage: vi.fn(),
}));

import { ScribeService } from '../scribe.js';
import { getRecentEvents } from '../../db/audit.js';
import { getActiveInitiatives } from '../../db/initiatives.js';
import { getRecentLessons } from '../../db/decisions.js';

describe('ScribeService', () => {
  let scribe: ScribeService;

  beforeEach(() => {
    vi.clearAllMocks();
    scribe = new ScribeService();
  });

  it('compressContext calls invokeAgent with sonnet and jsonMode', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: {
        summary: 'No significant activity this cycle.',
        initiative_states: [],
        exceptions: [],
        patterns: [],
        skill_changes: [],
      },
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'test-sonnet',
      durationMs: 500,
    });

    const result = await scribe.compressContext('org-1');

    expect(mockInvokeAgent).toHaveBeenCalledWith(
      'Scribe-1',
      expect.objectContaining({
        model: 'sonnet',
        jsonMode: true,
        temperature: 0.3,
      }),
    );
    expect(result.from_role).toBe('scribe');
    expect(result.message_type).toBe('context_package');
    expect(result.org_id).toBe('org-1');
  });

  it('reads audit events, initiatives, and lessons for context', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: {
        summary: 'Activity detected.',
        initiative_states: [],
        exceptions: [],
        patterns: [],
        skill_changes: [],
      },
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'test-sonnet',
      durationMs: 500,
    });

    await scribe.compressContext('org-1');

    expect(getRecentEvents).toHaveBeenCalledWith('org-1', expect.any(Number));
    expect(getActiveInitiatives).toHaveBeenCalledWith('org-1');
    expect(getRecentLessons).toHaveBeenCalledWith('org-1', expect.any(Number));
  });

  it('returns InternalMessage with context_package payload', async () => {
    const payload = {
      summary: 'ROOKIE completed sensor research.',
      initiative_states: [{ name: 'Sensor PoC', status: 'active', progress: '30%' }],
      exceptions: [],
      patterns: ['Research tasks trending high acceptance'],
      skill_changes: [],
    };

    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: payload,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'test-sonnet',
      durationMs: 500,
    });

    const result = await scribe.compressContext('org-1');

    expect(result.payload).toEqual(payload);
    expect(result.to_role).toBe('ceo');
  });
});
