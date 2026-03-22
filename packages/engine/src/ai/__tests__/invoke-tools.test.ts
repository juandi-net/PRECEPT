import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('../client.js', () => ({
  ai: { chat: { completions: { create: mockCreate } } },
  MODELS: { opus: 'test-opus', sonnet: 'test-sonnet' },
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
}));

import { invokeAgent } from '../invoke.js';
import type { ToolDefinition, ToolHandler } from '../invoke.js';

describe('invokeAgent with tools', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes tool definitions to the API call', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Done', tool_calls: undefined }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });

    const tools: ToolDefinition[] = [{
      type: 'function',
      function: {
        name: 'bash_execute',
        description: 'Execute a bash command',
        parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
      },
    }];

    await invokeAgent('Worker-1', {
      orgId: 'org-1',
      model: 'sonnet',
      systemPrompt: 'You are a worker.',
      messages: [{ role: 'user', content: 'Do the task' }],
      tools,
      toolHandler: async () => 'result',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tools,
      }),
    );
  });

  it('executes tool calls and continues the loop', async () => {
    // First call: model requests a tool call
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'bash_execute', arguments: '{"command":"echo hello"}' },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });

    // Second call: model produces final response
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Task complete. Output: hello', tool_calls: undefined }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
    });

    const toolHandler = vi.fn().mockResolvedValue('hello\n');

    const result = await invokeAgent('Worker-1', {
      orgId: 'org-1',
      model: 'sonnet',
      systemPrompt: 'You are a worker.',
      messages: [{ role: 'user', content: 'Run echo hello' }],
      tools: [{
        type: 'function',
        function: {
          name: 'bash_execute',
          description: 'Execute a bash command',
          parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
        },
      }],
      toolHandler,
    });

    expect(toolHandler).toHaveBeenCalledWith('bash_execute', { command: 'echo hello' });
    expect(result.content).toBe('Task complete. Output: hello');
    // Two API calls total (initial + after tool result)
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('limits tool call loop iterations to prevent runaway', async () => {
    // Always return tool calls (runaway scenario)
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'bash_execute', arguments: '{"command":"echo hi"}' },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });

    const toolHandler = vi.fn().mockResolvedValue('hi');

    await expect(
      invokeAgent('Worker-1', {
        orgId: 'org-1',
        model: 'sonnet',
        systemPrompt: 'test',
        messages: [{ role: 'user', content: 'test' }],
        tools: [{
          type: 'function',
          function: { name: 'bash_execute', description: 'test', parameters: {} },
        }],
        toolHandler,
        maxToolRounds: 3,
      }),
    ).rejects.toThrow('exceeded maximum tool call rounds');
  });

  it('works without tools (backward compatible)', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello', tool_calls: undefined }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
    });

    const result = await invokeAgent('Worker-1', {
      orgId: 'org-1',
      model: 'sonnet',
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.content).toBe('Hello');
    // No tools field sent
    expect(mockCreate).toHaveBeenCalledWith(
      expect.not.objectContaining({ tools: expect.anything() }),
    );
  });

  it('catches tool handler errors and returns them as tool results', async () => {
    // First call: model requests a tool call
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'create_task', arguments: '{"role":"coder"}' },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });

    // Second call: model sees the error and produces a final response
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Sorry, the task could not be created due to: RLS policy violation', tool_calls: undefined }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
    });

    const toolHandler = vi.fn().mockRejectedValue(new Error('Failed to create task: RLS policy violation'));

    const result = await invokeAgent('CEO-1', {
      orgId: 'org-1',
      model: 'opus',
      systemPrompt: 'You are the CEO.',
      messages: [{ role: 'user', content: 'Create a task' }],
      tools: [{ type: 'function', function: { name: 'create_task', description: 'Create a task', parameters: {} } }],
      toolHandler,
    });

    // The invocation should NOT throw — error becomes a tool result
    expect(result.content).toContain('RLS policy violation');
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Verify the error was passed back as a tool result message
    const secondCallArgs = mockCreate.mock.calls[1][0];
    const toolResultMsg = secondCallArgs.messages.find((m: any) => m.role === 'tool');
    expect(toolResultMsg).toBeDefined();
    expect(toolResultMsg.content).toContain('RLS policy violation');
  });

  it('aggregates token usage across tool rounds', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: null,
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'bash_execute', arguments: '{"command":"ls"}' } }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Done', tool_calls: undefined }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
    });

    const result = await invokeAgent('Worker-1', {
      orgId: 'org-1',
      model: 'sonnet',
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'test' }],
      tools: [{ type: 'function', function: { name: 'bash_execute', description: 'test', parameters: {} } }],
      toolHandler: async () => 'output',
    });

    expect(result.usage.promptTokens).toBe(300);
    expect(result.usage.completionTokens).toBe(150);
    expect(result.usage.totalTokens).toBe(450);
  });
});
