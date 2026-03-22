import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdvisorVerdict } from '@precept/shared';

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

vi.mock('../../db/cornerstone.js', () => ({
  getLatestCornerstone: vi.fn().mockResolvedValue({
    id: 'prec-1',
    content: {
      identity: { content: 'We are Test Org.', state: 'confirmed' },
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

vi.mock('../../db/initiatives.js', () => ({
  getActiveInitiatives: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../config/role-registry.js', () => ({
  roleRegistry: {
    getModel: vi.fn().mockResolvedValue('opus'),
    getEndpoint: vi.fn().mockResolvedValue(null),
  },
}));

import { AdvisorService } from '../advisor.js';
import { updateAdvisorVerdict } from '../../db/plans.js';

function mockValidResponse(data: { verdict: AdvisorVerdict; notes: string }) {
  mockInvokeAndValidate.mockResolvedValue({
    response: {
      content: '{}',
      parsed: data,
      usage: { promptTokens: 400, completionTokens: 200, totalTokens: 600 },
      model: 'test-opus',
      durationMs: 1500,
    },
    data,
  });
}

describe('AdvisorService', () => {
  let advisor: AdvisorService;

  beforeEach(() => {
    vi.clearAllMocks();
    advisor = new AdvisorService();
  });

  it('calls invokeAndValidate with opus and jsonMode', async () => {
    mockValidResponse({ verdict: 'APPROVED', notes: 'Plan looks solid.' });

    await advisor.reviewPlan('plan-1');

    expect(mockInvokeAndValidate).toHaveBeenCalledWith(
      'Advisor-1',
      expect.objectContaining({
        model: 'opus',
        jsonMode: true,
        temperature: 0.6,
      }),
      expect.anything(), // AdvisorOutputSchema
      'advisor verdict',
    );
  });

  it('writes APPROVED verdict to DB', async () => {
    mockValidResponse({ verdict: 'APPROVED', notes: 'Plan looks solid.' });

    const result = await advisor.reviewPlan('plan-1');

    expect(result.verdict).toBe('APPROVED');
    expect(updateAdvisorVerdict).toHaveBeenCalledWith('plan-1', 'APPROVED', 'Plan looks solid.');
  });

  it('handles FLAGGED verdict', async () => {
    mockValidResponse({
      verdict: 'FLAGGED',
      notes: 'Resource overcommitment detected — 3 initiatives exceed team capacity.',
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
    mockValidResponse({
      verdict: 'APPROVED_WITH_CONCERNS',
      notes: 'Timeline aggressive but feasible.',
    });

    const result = await advisor.reviewPlan('plan-1');

    expect(result.verdict).toBe('APPROVED_WITH_CONCERNS');
    expect(updateAdvisorVerdict).toHaveBeenCalledWith(
      'plan-1',
      'APPROVED_WITH_CONCERNS',
      'Timeline aggressive but feasible.',
    );
  });

  it('defaults to APPROVED on SchemaValidationError', async () => {
    const { SchemaValidationError } = await import('../../ai/validate.js');
    mockInvokeAndValidate.mockRejectedValue(
      new SchemaValidationError('advisor verdict', new Error('missing field') as any),
    );

    const result = await advisor.reviewPlan('plan-1');

    expect(result.verdict).toBe('APPROVED');
    expect(result.notes).toBe('Advisor response was malformed — skipping review.');
    expect(updateAdvisorVerdict).toHaveBeenCalledWith(
      'plan-1',
      'APPROVED',
      'Advisor response was malformed — skipping review.',
    );
  });

  it('throws if plan not found', async () => {
    const { getPlan } = await import('../../db/plans.js');
    vi.mocked(getPlan).mockResolvedValueOnce(null);

    await expect(advisor.reviewPlan('missing')).rejects.toThrow('Plan not found: missing');
  });
});
