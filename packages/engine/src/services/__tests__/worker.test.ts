import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task, WorkerOutput } from '@precept/shared';

const { mockInvokeAgent } = vi.hoisted(() => ({
  mockInvokeAgent: vi.fn(),
}));

vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: mockInvokeAgent,
}));

vi.mock('../../db/tasks.js', () => ({
  updateTaskOutput: vi.fn(),
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
}));

import { WorkerService } from '../worker.js';
import { updateTaskOutput } from '../../db/tasks.js';

const VALID_OUTPUT: WorkerOutput = {
  output: 'IMU sensor pin diagram documented with SPI interface details.',
  key_findings: ['SPI interface at 4MHz', 'Requires 3.3V regulator'],
  confidence: 'high',
  flag: null,
  notes: null,
};

function makeTask(overrides?: Partial<Task>): Task {
  return {
    id: 'task-1',
    org_id: 'org-1',
    plan_id: 'plan-1',
    initiative_id: 'init-1',
    phase: 1,
    state: 'IN_PROGRESS',
    role: 'researcher',
    assigned_worker: 'Worker-researcher-1',
    spec: {
      description: 'Research IMU sensor hardware',
      acceptance_criteria: ['Pin diagram documented'],
      priority: 'high',
    },
    output: null,
    skills_loaded: [],
    depends_on: [],
    revision_count: 0,
    created_at: new Date().toISOString(),
    updated_at: null,
    ...overrides,
  };
}

describe('WorkerService', () => {
  let worker: WorkerService;

  beforeEach(() => {
    vi.clearAllMocks();
    worker = new WorkerService();
  });

  it('calls invokeAgent with sonnet and jsonMode', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: VALID_OUTPUT,
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    await worker.execute(makeTask());

    expect(mockInvokeAgent).toHaveBeenCalledWith(
      'Worker-researcher-1',
      expect.objectContaining({
        model: 'sonnet',
        jsonMode: true,
        temperature: 0.5,
      }),
    );
  });

  it('returns parsed WorkerOutput', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: VALID_OUTPUT,
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    const result = await worker.execute(makeTask());

    expect(result.output).toBe(VALID_OUTPUT.output);
    expect(result.confidence).toBe('high');
    expect(result.key_findings).toEqual(['SPI interface at 4MHz', 'Requires 3.3V regulator']);
  });

  it('stores output in task via updateTaskOutput', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: VALID_OUTPUT,
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    await worker.execute(makeTask());

    expect(updateTaskOutput).toHaveBeenCalledWith('task-1', VALID_OUTPUT);
  });

  it('returns output with flag when worker flags something', async () => {
    const flaggedOutput: WorkerOutput = {
      ...VALID_OUTPUT,
      flag: 'Sensor requires import license — may delay timeline',
    };

    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: flaggedOutput,
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    const result = await worker.execute(makeTask());

    expect(result.flag).toBe('Sensor requires import license — may delay timeline');
  });

  it('throws when invokeAgent returns invalid output', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: { bad: 'data' },
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    await expect(worker.execute(makeTask())).rejects.toThrow('Worker produced invalid output');
  });
});
