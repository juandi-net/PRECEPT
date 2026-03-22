import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JudgeVerdict } from '@precept/shared';

const { mockInvokeAndValidate } = vi.hoisted(() => ({
  mockInvokeAndValidate: vi.fn(),
}));

vi.mock('../../ai/validate.js', () => ({
  invokeAndValidate: mockInvokeAndValidate,
  SchemaValidationError: class SchemaValidationError extends Error {
    constructor(public readonly label: string, public readonly firstError: Error) {
      super(`${label}: validation failed. ${firstError.message}`);
      this.name = 'SchemaValidationError';
    }
  },
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
    source: 'planning_cycle' as const,
    created_at: new Date().toISOString(),
    updated_at: null,
  }),
}));

vi.mock('../../db/cornerstone.js', () => ({
  getLatestCornerstone: vi.fn().mockResolvedValue({
    id: 'cs-1',
    sessionId: 'session-1',
    version: 1,
    content: {
      root: { name: 'root', content: 'Build tools that honor human conviction', state: 'confirmed', notes: null },
      identity: { name: 'identity', content: 'A leadership amplifier, not an automation tool', state: 'confirmed', notes: null },
      constraints: { name: 'constraints', content: 'Never compromise owner values for efficiency', state: 'confirmed', notes: null },
      mission_statement: null,
      product_service: null,
      stage: null,
      success_definition: null,
      resources: null,
      competitive_landscape: null,
      history: null,
      active_priorities: null,
      data_policy: null,
    },
    classification: 'internal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
}));

vi.mock('../../config/role-registry.js', () => ({
  roleRegistry: {
    getModel: vi.fn().mockResolvedValue('opus'),
    getEndpoint: vi.fn().mockResolvedValue(null),
  },
}));

import { JudgeService } from '../judge.js';

function mockValidResponse(data: JudgeVerdict) {
  mockInvokeAndValidate.mockResolvedValue({
    response: {
      content: '{}',
      parsed: data,
      usage: { promptTokens: 400, completionTokens: 150, totalTokens: 550 },
      model: 'test-opus',
      durationMs: 1200,
    },
    data,
  });
}

describe('JudgeService', () => {
  let judge: JudgeService;

  beforeEach(() => {
    vi.clearAllMocks();
    judge = new JudgeService();
  });

  it('calls invokeAndValidate with opus and jsonMode', async () => {
    mockValidResponse({
      verdict: 'ACCEPT',
      assessment: 'All criteria met.',
      criteria_met: ['Pin diagram documented', 'SPI interface identified'],
    });

    await judge.evaluate('task-1');

    expect(mockInvokeAndValidate).toHaveBeenCalledWith(
      'Judge-1',
      expect.objectContaining({
        model: 'opus',
        jsonMode: true,
        temperature: 0.4,
      }),
      expect.anything(), // JudgeVerdictSchema
      'judge verdict',
    );
  });

  it('returns ACCEPT verdict with criteria_met', async () => {
    const acceptVerdict: JudgeVerdict = {
      verdict: 'ACCEPT',
      assessment: 'All criteria met.',
      criteria_met: ['Pin diagram documented', 'SPI interface identified'],
    };

    mockValidResponse(acceptVerdict);

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

    mockValidResponse(reviseVerdict);

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

    mockValidResponse(escalateVerdict);

    const result = await judge.evaluate('task-1');

    expect(result.verdict).toBe('ESCALATE');
    expect(result).toHaveProperty('diagnosis_hint', 'capability_problem');
  });

  it('defaults to REVISE on SchemaValidationError', async () => {
    const { SchemaValidationError } = await import('../../ai/validate.js');
    mockInvokeAndValidate.mockRejectedValue(
      new SchemaValidationError('judge verdict', new Error('missing field') as any),
    );

    const result = await judge.evaluate('task-1');

    expect(result.verdict).toBe('REVISE');
    expect(result).toHaveProperty('feedback', 'Judge response was malformed — sending for re-review.');
    expect(result).toHaveProperty('criteria_failed', []);
  });

  it('throws when task not found', async () => {
    const { getTask } = await import('../../db/tasks.js');
    vi.mocked(getTask).mockResolvedValueOnce(null);

    await expect(judge.evaluate('missing')).rejects.toThrow('Task not found: missing');
  });

  it('receives Cornerstone context in the prompt', async () => {
    mockValidResponse({
      verdict: 'ACCEPT',
      assessment: 'All criteria met.',
      criteria_met: ['Pin diagram documented', 'SPI interface identified'],
      value_alignment: 'aligned',
      value_notes: null,
    });

    await judge.evaluate('task-1');

    const call = mockInvokeAndValidate.mock.calls[0];
    const userMessage = call[1].messages[0].content as string;

    expect(userMessage).toContain('Cornerstone Context');
    expect(userMessage).toContain('Build tools that honor human conviction');
    expect(userMessage).toContain('A leadership amplifier, not an automation tool');
    expect(userMessage).toContain('Never compromise owner values for efficiency');
  });

  it('works without Cornerstone context', async () => {
    const { getLatestCornerstone } = await import('../../db/cornerstone.js');
    vi.mocked(getLatestCornerstone).mockResolvedValueOnce(null);

    mockValidResponse({
      verdict: 'ACCEPT',
      assessment: 'All criteria met.',
      criteria_met: ['Pin diagram documented', 'SPI interface identified'],
    });

    const result = await judge.evaluate('task-1');

    expect(result.verdict).toBe('ACCEPT');
    const call = mockInvokeAndValidate.mock.calls[0];
    const userMessage = call[1].messages[0].content as string;
    expect(userMessage).not.toContain('Cornerstone Context');
  });
});
