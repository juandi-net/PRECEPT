import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReviewVerdict } from '@precept/shared';

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
    state: 'REVIEW',
    role: 'researcher',
    assigned_worker: 'Worker-researcher-1',
    spec: {
      description: 'Research IMU sensor hardware',
      acceptance_criteria: ['Pin diagram documented'],
      priority: 'high',
    },
    output: {
      output: 'IMU sensor pin diagram documented.',
      key_findings: ['SPI interface'],
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
    linear_issue_id: null,
    escalation_diagnosis: null,
    owner_read_at: null,
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

import { ReviewerService } from '../reviewer.js';

function mockValidResponse(data: ReviewVerdict) {
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

describe('ReviewerService', () => {
  let reviewer: ReviewerService;

  beforeEach(() => {
    vi.clearAllMocks();
    reviewer = new ReviewerService();
  });

  it('calls invokeAndValidate with opus and jsonMode', async () => {
    mockValidResponse({ verdict: 'GOOD', notes: 'Well structured research.' });

    await reviewer.evaluate('task-1');

    expect(mockInvokeAndValidate).toHaveBeenCalledWith(
      'Reviewer-1',
      expect.objectContaining({
        model: 'opus',
        jsonMode: true,
        temperature: 0.5,
      }),
      expect.anything(), // ReviewVerdictSchema
      'review verdict',
    );
  });

  it('returns POLISH verdict with feedback and areas', async () => {
    const polishVerdict: ReviewVerdict = {
      verdict: 'POLISH',
      feedback: 'Pin diagram lacks voltage specs.',
      areas: ['completeness', 'technical detail'],
    };

    mockValidResponse(polishVerdict);

    const result = await reviewer.evaluate('task-1');

    expect(result.verdict).toBe('POLISH');
    expect(result).toHaveProperty('feedback', 'Pin diagram lacks voltage specs.');
    expect(result).toHaveProperty('areas', ['completeness', 'technical detail']);
  });

  it('returns GOOD verdict with notes', async () => {
    mockValidResponse({ verdict: 'GOOD', notes: 'Solid work.' });

    const result = await reviewer.evaluate('task-1');

    expect(result.verdict).toBe('GOOD');
    expect(result).toHaveProperty('notes', 'Solid work.');
  });

  it('returns EXCELLENT verdict with commendation', async () => {
    mockValidResponse({
      verdict: 'EXCELLENT',
      commendation: 'Exceptionally thorough pin diagram with signal timing analysis.',
      notes: 'Above and beyond requirements.',
    });

    const result = await reviewer.evaluate('task-1');

    expect(result.verdict).toBe('EXCELLENT');
    expect(result).toHaveProperty('commendation');
  });

  it('defaults to POLISH on SchemaValidationError', async () => {
    const { SchemaValidationError } = await import('../../ai/validate.js');
    mockInvokeAndValidate.mockRejectedValue(
      new SchemaValidationError('review verdict', new Error('missing field') as any),
    );

    const result = await reviewer.evaluate('task-1');

    expect(result.verdict).toBe('POLISH');
    expect(result).toHaveProperty('feedback', 'Review response was malformed — please re-review.');
    expect(result).toHaveProperty('areas', []);
  });

  it('throws when task not found', async () => {
    const { getTask } = await import('../../db/tasks.js');
    vi.mocked(getTask).mockResolvedValueOnce(null);

    await expect(reviewer.evaluate('missing')).rejects.toThrow('Task not found: missing');
  });

  it('throws when task has no output', async () => {
    const { getTask } = await import('../../db/tasks.js');
    vi.mocked(getTask).mockResolvedValueOnce({
      id: 'task-1',
      org_id: 'org-1',
      plan_id: 'plan-1',
      initiative_id: 'init-1',
      phase: 1,
      state: 'REVIEW',
      role: 'researcher',
      assigned_worker: 'Worker-researcher-1',
      spec: {
        title: 'Research task',
        description: 'Research',
        acceptance_criteria: ['Done'],
        priority: 'high',
      },
      output: null,
      skills_loaded: [],
      depends_on: [],
      revision_count: 0,
      polish_count: 0,
      source: 'planning_cycle' as const,
      created_at: new Date().toISOString(),
      updated_at: null,
      linear_issue_id: null,
      escalation_diagnosis: null,
      owner_read_at: null,
    });

    await expect(reviewer.evaluate('task-1')).rejects.toThrow('no output');
  });
});
