import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInvokeAgent } = vi.hoisted(() => ({
  mockInvokeAgent: vi.fn(),
}));

vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: mockInvokeAgent,
}));

vi.mock('../../db/plans.js', () => ({
  getPlan: vi.fn().mockResolvedValue({
    id: 'plan-1',
    org_id: 'org-1',
    content: {
      initiatives: [
        {
          name: 'Sensor PoC',
          description: 'Prove sensor works',
          rationale: 'Core target',
          phases: [
            {
              phase_number: 1,
              description: 'Setup',
              tasks: [{ id: 't-1', role: 'researcher', description: 'Research' }],
            },
          ],
        },
      ],
      decisions: [
        { decision: 'Use off-the-shelf sensor', reasoning: 'Fast', alternatives: 'Custom', why_not: 'Cost' },
      ],
      board_requests: [],
    },
    advisor_verdict: null,
    advisor_notes: null,
    owner_approved: false,
    created_at: new Date().toISOString(),
  }),
  updateAdvisorVerdict: vi.fn(),
}));

vi.mock('../../db/precepts.js', () => ({
  getLatestPrecepts: vi.fn().mockResolvedValue({
    id: 'prec-1',
    content: {
      identity: { content: 'We are ROOKIE.', state: 'confirmed' },
    },
  }),
}));

vi.mock('../../db/decisions.js', () => ({
  getRecentDecisions: vi.fn().mockResolvedValue([]),
  getRecentLessons: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
}));

import { AdvisorService } from '../advisor.js';
import { updateAdvisorVerdict } from '../../db/plans.js';

describe('AdvisorService', () => {
  let advisor: AdvisorService;

  beforeEach(() => {
    vi.clearAllMocks();
    advisor = new AdvisorService();
  });

  it('calls invokeAgent with opus and jsonMode', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: { verdict: 'APPROVED', notes: 'Plan looks solid.' },
      usage: { promptTokens: 400, completionTokens: 200, totalTokens: 600 },
      model: 'test-opus',
      durationMs: 1500,
    });

    await advisor.reviewPlan('plan-1');

    expect(mockInvokeAgent).toHaveBeenCalledWith(
      'Advisor-1',
      expect.objectContaining({
        model: 'opus',
        jsonMode: true,
        temperature: 0.6,
      }),
    );
  });

  it('writes APPROVED verdict to DB', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: { verdict: 'APPROVED', notes: 'Plan looks solid.' },
      usage: { promptTokens: 400, completionTokens: 200, totalTokens: 600 },
      model: 'test-opus',
      durationMs: 1500,
    });

    const result = await advisor.reviewPlan('plan-1');

    expect(result.verdict).toBe('APPROVED');
    expect(updateAdvisorVerdict).toHaveBeenCalledWith('plan-1', 'APPROVED', 'Plan looks solid.');
  });

  it('handles FLAGGED verdict', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: {
        verdict: 'FLAGGED',
        notes: 'Resource overcommitment detected — 3 initiatives exceed team capacity.',
      },
      usage: { promptTokens: 400, completionTokens: 200, totalTokens: 600 },
      model: 'test-opus',
      durationMs: 1500,
    });

    const result = await advisor.reviewPlan('plan-1');

    expect(result.verdict).toBe('FLAGGED');
    expect(updateAdvisorVerdict).toHaveBeenCalledWith(
      'plan-1',
      'FLAGGED',
      'Resource overcommitment detected — 3 initiatives exceed team capacity.',
    );
  });

  it('handles APPROVED_WITH_CONCERNS verdict', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: {
        verdict: 'APPROVED_WITH_CONCERNS',
        notes: 'Timeline aggressive but feasible.',
      },
      usage: { promptTokens: 400, completionTokens: 200, totalTokens: 600 },
      model: 'test-opus',
      durationMs: 1500,
    });

    const result = await advisor.reviewPlan('plan-1');

    expect(result.verdict).toBe('APPROVED_WITH_CONCERNS');
    expect(updateAdvisorVerdict).toHaveBeenCalledWith(
      'plan-1',
      'APPROVED_WITH_CONCERNS',
      'Timeline aggressive but feasible.',
    );
  });

  it('throws if plan not found', async () => {
    const { getPlan } = await import('../../db/plans.js');
    vi.mocked(getPlan).mockResolvedValueOnce(null);

    await expect(advisor.reviewPlan('missing')).rejects.toThrow('Plan not found: missing');
  });
});
