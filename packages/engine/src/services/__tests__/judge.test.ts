import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JudgeVerdict } from '@precept/shared';

const { mockInvokeAgent } = vi.hoisted(() => ({
  mockInvokeAgent: vi.fn(),
}));

vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: mockInvokeAgent,
}));

vi.mock('../../db/tasks.js', () => ({
  getTask: vi.fn().mockResolvedValue({
    id: 'task-1',
    org_id: 'org-1',
    plan_id: 'plan-1',
    initiative_id: 'init-1',
    phase: 1,
    state: 'JUDGMENT',
    role: 'researcher',
    assigned_worker: 'Worker-researcher-1',
    spec: {
      description: 'Research IMU sensor hardware',
      acceptance_criteria: ['Pin diagram documented', 'SPI interface identified'],
      priority: 'high',
    },
    output: {
      output: 'IMU sensor pin diagram documented with SPI interface.',
      key_findings: ['SPI interface at 4MHz'],
      confidence: 'high',
      flag: null,
      notes: null,
    },
    skills_loaded: [],
    depends_on: [],
    revision_count: 0,
    polish_count: 0,
    created_at: new Date().toISOString(),
    updated_at: null,
  }),
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
}));

import { JudgeService } from '../judge.js';

describe('JudgeService', () => {
  let judge: JudgeService;

  beforeEach(() => {
    vi.clearAllMocks();
    judge = new JudgeService();
  });

  it('calls invokeAgent with opus and jsonMode', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: {
        verdict: 'ACCEPT',
        assessment: 'All criteria met.',
        criteria_met: ['Pin diagram documented', 'SPI interface identified'],
      },
      usage: { promptTokens: 400, completionTokens: 150, totalTokens: 550 },
      model: 'test-opus',
      durationMs: 1200,
    });

    await judge.evaluate('task-1');

    expect(mockInvokeAgent).toHaveBeenCalledWith(
      'Judge-1',
      expect.objectContaining({
        model: 'opus',
        jsonMode: true,
        temperature: 0.4,
      }),
    );
  });

  it('returns ACCEPT verdict with criteria_met', async () => {
    const acceptVerdict: JudgeVerdict = {
      verdict: 'ACCEPT',
      assessment: 'All criteria met.',
      criteria_met: ['Pin diagram documented', 'SPI interface identified'],
    };

    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: acceptVerdict,
      usage: { promptTokens: 400, completionTokens: 150, totalTokens: 550 },
      model: 'test-opus',
      durationMs: 1200,
    });

    const result = await judge.evaluate('task-1');

    expect(result.verdict).toBe('ACCEPT');
    expect(result).toHaveProperty('criteria_met', ['Pin diagram documented', 'SPI interface identified']);
  });

  it('returns REVISE verdict with criteria_failed', async () => {
    const reviseVerdict: JudgeVerdict = {
      verdict: 'REVISE',
      feedback: 'SPI interface not fully documented.',
      criteria_failed: ['SPI interface identified'],
    };

    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: reviseVerdict,
      usage: { promptTokens: 400, completionTokens: 150, totalTokens: 550 },
      model: 'test-opus',
      durationMs: 1200,
    });

    const result = await judge.evaluate('task-1');

    expect(result.verdict).toBe('REVISE');
    expect(result).toHaveProperty('criteria_failed', ['SPI interface identified']);
  });

  it('returns ESCALATE verdict with diagnosis_hint', async () => {
    const escalateVerdict: JudgeVerdict = {
      verdict: 'ESCALATE',
      reason: 'Task fundamentally cannot be completed with available tools.',
      diagnosis_hint: 'capability_problem',
    };

    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: escalateVerdict,
      usage: { promptTokens: 400, completionTokens: 150, totalTokens: 550 },
      model: 'test-opus',
      durationMs: 1200,
    });

    const result = await judge.evaluate('task-1');

    expect(result.verdict).toBe('ESCALATE');
    expect(result).toHaveProperty('diagnosis_hint', 'capability_problem');
  });

  it('throws when task not found', async () => {
    const { getTask } = await import('../../db/tasks.js');
    vi.mocked(getTask).mockResolvedValueOnce(null);

    await expect(judge.evaluate('missing')).rejects.toThrow('Task not found: missing');
  });
});
