import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('../client.js', () => ({
  ai: {
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  },
  MODELS: { opus: 'test-opus', sonnet: 'test-sonnet' } as const,
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
}));

import { invokeAgent, AgentInvocationError, extractJSON } from '../invoke.js';
import { logEvent } from '../../db/audit.js';

function mockResponse(content: string, tokens = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }) {
  return {
    choices: [{ message: { content } }],
    usage: tokens,
  };
}

describe('invokeAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns AgentResponse with correct fields on success', async () => {
    mockCreate.mockResolvedValue(mockResponse('Hello world'));

    const result = await invokeAgent('CEO-1', {
      orgId: 'org-1',
      model: 'opus',
      systemPrompt: 'You are helpful',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.content).toBe('Hello world');
    expect(result.usage.promptTokens).toBe(10);
    expect(result.usage.completionTokens).toBe(20);
    expect(result.usage.totalTokens).toBe(30);
    expect(result.model).toBe('test-opus');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.parsed).toBeUndefined();
  });

  it('extracts JSON when jsonMode is true', async () => {
    mockCreate.mockResolvedValue(mockResponse('```json\n{"key": "value"}\n```'));

    const result = await invokeAgent('CEO-1', {
      orgId: 'org-1',
      model: 'opus',
      systemPrompt: 'Return JSON',
      messages: [{ role: 'user', content: 'Give me JSON' }],
      jsonMode: true,
    });

    expect(result.parsed).toEqual({ key: 'value' });
  });

  it('retries on failure and succeeds', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('Server error'))
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValue(mockResponse('Success'));

    const result = await invokeAgent('Worker-1', {
      orgId: 'org-1',
      model: 'sonnet',
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'test' }],
    }, [0, 0, 0]); // zero-delay retries for tests

    expect(result.content).toBe('Success');
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('throws AgentInvocationError when all retries exhausted', async () => {
    mockCreate.mockRejectedValue(new Error('Persistent failure'));

    await expect(
      invokeAgent('Worker-1', {
        orgId: 'org-1',
        model: 'sonnet',
        systemPrompt: 'test',
        messages: [{ role: 'user', content: 'test' }],
      }, [0, 0, 0]) // zero-delay retries for tests
    ).rejects.toThrow(AgentInvocationError);

    // 1 initial + 3 retries = 4 attempts
    expect(mockCreate).toHaveBeenCalledTimes(4);
  });

  it('logs audit event on successful call', async () => {
    mockCreate.mockResolvedValue(mockResponse('OK'));

    await invokeAgent('CEO-1', {
      orgId: 'org-1',
      model: 'opus',
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(logEvent).toHaveBeenCalledWith(
      'org-1',
      'ai.call',
      'CEO-1',
      expect.objectContaining({
        model: 'test-opus',
        jsonMode: false,
      }),
      30
    );
  });
});

describe('extractJSON', () => {
  it('strips markdown fences and parses', () => {
    expect(extractJSON('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('parses plain JSON', () => {
    expect(extractJSON('{"a": 1}')).toEqual({ a: 1 });
  });

  it('finds JSON object in surrounding text', () => {
    expect(extractJSON('Here is the result: {"a": 1} done')).toEqual({ a: 1 });
  });

  it('returns undefined for non-JSON', () => {
    expect(extractJSON('no json here')).toBeUndefined();
  });
});
