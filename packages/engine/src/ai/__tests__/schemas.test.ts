import { describe, expect, it } from 'vitest';

import {
  WorkerOutputSchema,
  ReviewVerdictSchema,
  JudgeVerdictSchema,
  PlanOutputSchema,
  EscalationDiagnosisSchema,
  OwnerReplyIntentSchema,
  AdvisorOutputSchema,
  CuratorOutputSchema,
} from '../schemas.js';

// ---------------------------------------------------------------------------
// WorkerOutputSchema
// ---------------------------------------------------------------------------

describe('WorkerOutputSchema', () => {
  it('accepts valid worker output', () => {
    const result = WorkerOutputSchema.safeParse({
      output: 'Research complete.',
      key_findings: ['finding 1', 'finding 2'],
      confidence: 'high',
      flag: null,
      notes: 'All good.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when output field is missing', () => {
    const result = WorkerOutputSchema.safeParse({
      key_findings: [],
      confidence: 'low',
      flag: null,
      notes: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid confidence value', () => {
    const result = WorkerOutputSchema.safeParse({
      output: 'done',
      key_findings: [],
      confidence: 'uncertain',
      flag: null,
      notes: null,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ReviewVerdictSchema
// ---------------------------------------------------------------------------

describe('ReviewVerdictSchema', () => {
  it('accepts POLISH verdict', () => {
    const result = ReviewVerdictSchema.safeParse({
      verdict: 'POLISH',
      feedback: 'Needs work on section 2.',
      areas: ['formatting', 'depth'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts GOOD verdict', () => {
    const result = ReviewVerdictSchema.safeParse({
      verdict: 'GOOD',
      notes: 'Solid work.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts EXCELLENT verdict', () => {
    const result = ReviewVerdictSchema.safeParse({
      verdict: 'EXCELLENT',
      commendation: 'Outstanding analysis.',
      notes: 'Exceeded expectations.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown verdict', () => {
    const result = ReviewVerdictSchema.safeParse({
      verdict: 'TERRIBLE',
      notes: 'bad',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// JudgeVerdictSchema
// ---------------------------------------------------------------------------

describe('JudgeVerdictSchema', () => {
  it('accepts ACCEPT verdict', () => {
    const result = JudgeVerdictSchema.safeParse({
      verdict: 'ACCEPT',
      assessment: 'Meets all criteria.',
      criteria_met: ['accuracy', 'completeness'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts REVISE verdict', () => {
    const result = JudgeVerdictSchema.safeParse({
      verdict: 'REVISE',
      feedback: 'Missing key section.',
      criteria_failed: ['completeness'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts ESCALATE verdict', () => {
    const result = JudgeVerdictSchema.safeParse({
      verdict: 'ESCALATE',
      reason: 'Fundamental misunderstanding of spec.',
      diagnosis_hint: 'spec_problem',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid diagnosis_hint', () => {
    const result = JudgeVerdictSchema.safeParse({
      verdict: 'ESCALATE',
      reason: 'Something wrong.',
      diagnosis_hint: 'unknown_problem',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PlanOutputSchema
// ---------------------------------------------------------------------------

describe('PlanOutputSchema', () => {
  it('accepts valid plan output', () => {
    const result = PlanOutputSchema.safeParse({
      initiatives: [
        {
          name: 'Launch v2',
          description: 'Ship the next version.',
          rationale: 'Users need it.',
          phases: [
            {
              phase_number: 1,
              description: 'Foundation',
              tasks: [
                {
                  id: 't-1',
                  role: 'coder',
                  title: 'Setup repo',
                  description: 'Initialize project.',
                  acceptance_criteria: ['repo exists'],
                  depends_on: [],
                  priority: 'high',
                },
              ],
            },
          ],
        },
      ],
      decisions: [
        {
          decision: 'Use TypeScript',
          reasoning: 'Type safety.',
          alternatives: 'JavaScript',
          why_not: 'No types.',
        },
      ],
      board_requests: [
        {
          request: 'Hire a designer',
          context: 'No design capacity.',
          urgency: 'medium',
          fallback: 'Use templates.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects when initiatives is missing', () => {
    const result = PlanOutputSchema.safeParse({
      decisions: [],
      board_requests: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid task priority', () => {
    const result = PlanOutputSchema.safeParse({
      initiatives: [
        {
          name: 'X',
          description: 'Y',
          rationale: 'Z',
          phases: [
            {
              phase_number: 1,
              description: 'P1',
              tasks: [
                {
                  id: 't-1',
                  role: 'coder',
                  title: 'T',
                  description: 'D',
                  acceptance_criteria: [],
                  depends_on: [],
                  priority: 'critical', // invalid
                },
              ],
            },
          ],
        },
      ],
      decisions: [],
      board_requests: [],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EscalationDiagnosisSchema
// ---------------------------------------------------------------------------

describe('EscalationDiagnosisSchema', () => {
  it('accepts valid escalation diagnosis', () => {
    const result = EscalationDiagnosisSchema.safeParse({
      type: 'capability_problem',
      action: { reassign: true, to_role: 'analyst' },
      reasoning: 'Worker lacks required domain expertise.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid type', () => {
    const result = EscalationDiagnosisSchema.safeParse({
      type: 'unknown_problem',
      action: {},
      reasoning: 'test',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// OwnerReplyIntentSchema
// ---------------------------------------------------------------------------

describe('OwnerReplyIntentSchema', () => {
  it('accepts valid intent with approve action', () => {
    const result = OwnerReplyIntentSchema.safeParse({
      actions: [{ type: 'approve', target_id: 'init-1' }],
      raw_text: 'Looks good, approve initiative 1.',
      should_replan: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts intent with mixed actions', () => {
    const result = OwnerReplyIntentSchema.safeParse({
      actions: [
        { type: 'approve', target_id: 'init-1' },
        { type: 'pivot', target_id: 'init-2', direction: 'Focus on performance.' },
        { type: 'free_text', content: 'Also consider caching.' },
        { type: 'clarify', question: 'What is the timeline?' },
      ],
      raw_text: 'Approve 1, pivot 2 toward perf, also caching. Timeline?',
      should_replan: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects action with unknown type', () => {
    const result = OwnerReplyIntentSchema.safeParse({
      actions: [{ type: 'reject', target_id: 'init-1' }],
      raw_text: 'Reject this.',
      should_replan: false,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AdvisorOutputSchema
// ---------------------------------------------------------------------------

describe('AdvisorOutputSchema', () => {
  it('accepts valid advisor output', () => {
    const result = AdvisorOutputSchema.safeParse({
      verdict: 'APPROVED',
      notes: 'Plan is well-structured.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts FLAGGED verdict', () => {
    const result = AdvisorOutputSchema.safeParse({
      verdict: 'FLAGGED',
      notes: 'Budget concerns.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid verdict', () => {
    const result = AdvisorOutputSchema.safeParse({
      verdict: 'REJECTED',
      notes: 'No.',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CuratorOutputSchema
// ---------------------------------------------------------------------------

describe('CuratorOutputSchema', () => {
  it('accepts valid curator output', () => {
    const result = CuratorOutputSchema.safeParse({
      actions: [
        {
          type: 'create',
          name: 'api-design',
          scope: 'org_wide',
          role: null,
          tags: ['architecture', 'api'],
          content: '# API Design\nUse RESTful conventions.',
        },
      ],
      reasoning: 'No existing API design skill found.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts action without optional content', () => {
    const result = CuratorOutputSchema.safeParse({
      actions: [
        {
          type: 'deprecate',
          name: 'old-skill',
          scope: 'role_specific',
          role: 'coder',
          tags: [],
        },
      ],
      reasoning: 'Skill is outdated.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid action type', () => {
    const result = CuratorOutputSchema.safeParse({
      actions: [
        {
          type: 'delete',
          name: 'skill',
          scope: 'org_wide',
          role: null,
          tags: [],
        },
      ],
      reasoning: 'test',
    });
    expect(result.success).toBe(false);
  });
});
