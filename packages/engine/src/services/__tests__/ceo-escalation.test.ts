import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    spec: { description: 'Research sensors', acceptance_criteria: ['Pin diagram'] },
    output: { output: 'Partial diagram', key_findings: [], confidence: 'low', flag: null, notes: null },
    revision_count: 2,
  }),
}));

vi.mock('../../db/precepts.js', () => ({
  getLatestPrecepts: vi.fn().mockResolvedValue({
    id: 'prec-1',
    content: { identity: { content: 'We are ROOKIE.', state: 'confirmed' } },
  }),
}));

vi.mock('../../db/decisions.js', () => ({
  getRecentLessons: vi.fn().mockResolvedValue([]),
  logDecision: vi.fn(),
}));

vi.mock('../../db/owner-feedback.js', () => ({
  getRecentFeedback: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/initiatives.js', () => ({
  createInitiative: vi.fn().mockResolvedValue({ id: 'init-1' }),
  getActiveInitiatives: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/plans.js', () => ({
  createPlan: vi.fn().mockResolvedValue({ id: 'plan-1' }),
  getUnapprovedPlans: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/tasks.js', () => ({
  createTasks: vi.fn().mockResolvedValue([]),
  getTask: vi.fn().mockResolvedValue({
    id: 'task-1',
    org_id: 'org-1',
    spec: { description: 'Research sensors', acceptance_criteria: ['Pin diagram'] },
    output: { output: 'Partial diagram', key_findings: [], confidence: 'low', flag: null, notes: null },
    revision_count: 2,
  }),
  getTasksByState: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/messages.js', () => ({
  logMessage: vi.fn(),
}));

vi.mock('../../db/chat.js', () => ({
  insertChatMessage: vi.fn(),
  getChatHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
  getRecentEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/boardRequests.js', () => ({
  createBoardRequest: vi.fn(),
}));

vi.mock('../scribe.js', () => ({
  ScribeService: vi.fn().mockImplementation(() => ({
    compressContext: vi.fn().mockResolvedValue({
      payload: { summary: 'No activity.' },
    }),
  })),
}));

import { CEOService } from '../ceo.js';

describe('CEOService — escalation', () => {
  let ceo: CEOService;

  beforeEach(() => {
    vi.clearAllMocks();
    ceo = new CEOService();
  });

  it('handleEscalation returns diagnosis', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: {
        type: 'spec_problem',
        action: { rewrite: 'Make acceptance criteria more specific' },
        reasoning: 'The criteria "Pin diagram" is too vague.',
      },
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-opus',
      durationMs: 1000,
    });

    const diagnosis = await ceo.handleEscalation('task-1');

    expect(diagnosis.type).toBe('spec_problem');
    expect(diagnosis.reasoning).toContain('vague');
  });
});

describe('CEOService — briefing', () => {
  let ceo: CEOService;

  beforeEach(() => {
    vi.clearAllMocks();
    ceo = new CEOService();
  });

  it('compileBriefing returns plain-text letter', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: 'The sensor research is complete. See the results ([view](/inspect/task/abc)).',
      parsed: null,
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-opus',
      durationMs: 1000,
    });

    const letter = await ceo.compileBriefing('org-1');

    expect(typeof letter).toBe('string');
    expect(letter).toContain('sensor research');
  });
});

describe('CEOService — reply parsing', () => {
  let ceo: CEOService;

  beforeEach(() => {
    vi.clearAllMocks();
    ceo = new CEOService();
  });

  it('handleOwnerReply parses reply into actions', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: {
        actions: [{ type: 'approve', target_id: 'plan-1' }],
        raw_text: 'Looks good, go ahead.',
      },
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-opus',
      durationMs: 1000,
    });

    const intent = await ceo.handleOwnerReply('org-1', 'Looks good, go ahead.');

    expect(intent.actions).toHaveLength(1);
    expect(intent.actions[0].type).toBe('approve');
  });
});
