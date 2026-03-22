import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import type { AgentResponse, InvokeAgentOptions } from '../invoke.js';

// Hoist the mock fn so vi.mock factory can reference it
const { mockInvokeAgent } = vi.hoisted(() => ({
  mockInvokeAgent: vi.fn<(...args: any[]) => Promise<AgentResponse>>(),
}));

vi.mock('../invoke.js', () => ({
  invokeAgent: (...args: any[]) => mockInvokeAgent(...args),
}));

import { invokeAndValidate, SchemaValidationError } from '../validate.js';

const TestSchema = z.object({ value: z.number() });

const baseOptions: InvokeAgentOptions = {
  orgId: 'org-1',
  model: 'sonnet',
  systemPrompt: 'test',
  messages: [{ role: 'user', content: 'test' }],
  jsonMode: true,
};

const makeResponse = (parsed: unknown): AgentResponse => ({
  content: JSON.stringify(parsed),
  parsed: parsed as Record<string, unknown>,
  usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  model: 'test',
  durationMs: 0,
});

describe('invokeAndValidate', () => {
  beforeEach(() => {
    mockInvokeAgent.mockReset();
  });

  it('returns validated data on first attempt', async () => {
    mockInvokeAgent.mockResolvedValue(makeResponse({ value: 42 }));

    const { data } = await invokeAndValidate('test-agent', baseOptions, TestSchema, 'test');
    expect(data).toEqual({ value: 42 });
    expect(mockInvokeAgent).toHaveBeenCalledTimes(1);
  });

  it('retries with error feedback on validation failure', async () => {
    mockInvokeAgent
      .mockResolvedValueOnce(makeResponse({ wrong: 'shape' }))
      .mockResolvedValueOnce(makeResponse({ value: 42 }));

    const { data } = await invokeAndValidate('test-agent', baseOptions, TestSchema, 'test');
    expect(data).toEqual({ value: 42 });
    expect(mockInvokeAgent).toHaveBeenCalledTimes(2);

    // Check retry includes error feedback
    const retryCall = mockInvokeAgent.mock.calls[1];
    const retryMessages = retryCall[1].messages;
    expect(retryMessages.at(-1).content).toContain('not valid');
  });

  it('throws SchemaValidationError after two failures', async () => {
    mockInvokeAgent
      .mockResolvedValueOnce(makeResponse({ wrong: 'shape' }))
      .mockResolvedValueOnce(makeResponse({ still: 'wrong' }));

    await expect(
      invokeAndValidate('test-agent', baseOptions, TestSchema, 'test-op')
    ).rejects.toThrow(SchemaValidationError);
  });

  it('SchemaValidationError includes label', async () => {
    mockInvokeAgent
      .mockResolvedValueOnce(makeResponse({}))
      .mockResolvedValueOnce(makeResponse({}));

    try {
      await invokeAndValidate('test-agent', baseOptions, TestSchema, 'my-operation');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaValidationError);
      expect((err as SchemaValidationError).label).toBe('my-operation');
    }
  });
});
