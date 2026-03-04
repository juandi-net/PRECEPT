import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReviewVerdict } from '@precept/shared';

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
    created_at: new Date().toISOString(),
    updated_at: null,
  }),
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
}));

import { ReviewerService } from '../reviewer.js';

describe('ReviewerService', () => {
  let reviewer: ReviewerService;

  beforeEach(() => {
    vi.clearAllMocks();
    reviewer = new ReviewerService();
  });

  it('calls invokeAgent with opus and jsonMode', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: { verdict: 'GOOD', notes: 'Well structured research.' },
      usage: { promptTokens: 400, completionTokens: 150, totalTokens: 550 },
      model: 'test-opus',
      durationMs: 1200,
    });

    await reviewer.evaluate('task-1');

    expect(mockInvokeAgent).toHaveBeenCalledWith(
      'Reviewer-1',
      expect.objectContaining({
        model: 'opus',
        jsonMode: true,
        temperature: 0.5,
      }),
    );
  });

  it('returns POLISH verdict with feedback and areas', async () => {
    const polishVerdict: ReviewVerdict = {
      verdict: 'POLISH',
      feedback: 'Pin diagram lacks voltage specs.',
      areas: ['completeness', 'technical detail'],
    };

    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: polishVerdict,
      usage: { promptTokens: 400, completionTokens: 150, totalTokens: 550 },
      model: 'test-opus',
      durationMs: 1200,
    });

    const result = await reviewer.evaluate('task-1');

    expect(result.verdict).toBe('POLISH');
    expect(result).toHaveProperty('feedback', 'Pin diagram lacks voltage specs.');
    expect(result).toHaveProperty('areas', ['completeness', 'technical detail']);
  });

  it('returns GOOD verdict with notes', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: { verdict: 'GOOD', notes: 'Solid work.' },
      usage: { promptTokens: 400, completionTokens: 150, totalTokens: 550 },
      model: 'test-opus',
      durationMs: 1200,
    });

    const result = await reviewer.evaluate('task-1');

    expect(result.verdict).toBe('GOOD');
    expect(result).toHaveProperty('notes', 'Solid work.');
  });

  it('returns EXCELLENT verdict with commendation', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: {
        verdict: 'EXCELLENT',
        commendation: 'Exceptionally thorough pin diagram with signal timing analysis.',
        notes: 'Above and beyond requirements.',
      },
      usage: { promptTokens: 400, completionTokens: 150, totalTokens: 550 },
      model: 'test-opus',
      durationMs: 1200,
    });

    const result = await reviewer.evaluate('task-1');

    expect(result.verdict).toBe('EXCELLENT');
    expect(result).toHaveProperty('commendation');
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
        description: 'Research',
        acceptance_criteria: ['Done'],
        priority: 'high',
      },
      output: null,
      skills_loaded: [],
      depends_on: [],
      revision_count: 0,
    polish_count: 0,
      created_at: new Date().toISOString(),
      updated_at: null,
    });

    await expect(reviewer.evaluate('task-1')).rejects.toThrow('no output');
  });
});
