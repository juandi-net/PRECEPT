import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInvokeAgent, mockInvokeAndValidate } = vi.hoisted(() => ({
  mockInvokeAgent: vi.fn(),
  mockInvokeAndValidate: vi.fn(),
}));

vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: mockInvokeAgent,
}));

vi.mock('../../ai/validate.js', () => ({
  invokeAndValidate: mockInvokeAndValidate,
  SchemaValidationError: class SchemaValidationError extends Error {
    constructor(public label: string, public firstError: any, public retryError?: any) {
      super(`${label}: validation failed`);
      this.name = 'SchemaValidationError';
    }
  },
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

vi.mock('../../db/cornerstone.js', () => ({
  getLatestCornerstone: vi.fn().mockResolvedValue({
    id: 'prec-1',
    content: { identity: { content: 'We are Test Org.', state: 'confirmed' } },
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
  getTransitions: vi.fn().mockResolvedValue([]),
  updateEscalationDiagnosis: vi.fn(),
  updateTaskDependencies: vi.fn(),
}));

vi.mock('../../db/messages.js', () => ({
  logMessage: vi.fn(),
}));

vi.mock('../../db/chat.js', () => ({
  insertChatMessage: vi.fn(),
  getChatHistory: vi.fn().mockResolvedValue([]),
  getRecentOwnerMessages: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
  getRecentEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/boardRequests.js', () => ({
  createBoardRequest: vi.fn(),
}));

vi.mock('../../config/role-registry.js', () => ({
  roleRegistry: {
    getModel: vi.fn().mockResolvedValue('opus'),
    getEndpoint: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../scribe.js', () => ({
  ScribeService: vi.fn().mockImplementation(() => ({
    compressContext: vi.fn().mockResolvedValue({
      payload: { summary: 'No activity.' },
    }),
  })),
}));

vi.mock('../../lib/credentials.js', () => ({
  resolveCredentials: vi.fn().mockResolvedValue({
    resendApiKey: undefined,
    emailDomain: undefined,
    ownerEmail: undefined,
    githubToken: undefined,
    githubOrg: undefined,
    githubRepoUrl: undefined,
    linearApiKey: undefined,
    linearTeamId: undefined,
  }),
}));

vi.mock('../../lib/linear.js', () => ({
  createIssue: vi.fn().mockResolvedValue(null),
  addComment: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../db/planning-history.js', () => ({
  searchPlanningHistory: vi.fn().mockResolvedValue([]),
}));

import { CEOService } from '../ceo.js';

describe('CEOService — escalation', () => {
  let ceo: CEOService;

  beforeEach(() => {
    vi.clearAllMocks();
    ceo = new CEOService();
  });

  it('handleEscalation returns diagnosis', async () => {
    const diagnosisData = {
      type: 'spec_problem',
      action: { rewrite: 'Make acceptance criteria more specific' },
      reasoning: 'The criteria "Pin diagram" is too vague.',
    };
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: diagnosisData,
        usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
        model: 'test-opus',
        durationMs: 1000,
      },
      data: diagnosisData,
    });

    const diagnosis = await ceo.handleEscalation('task-1');

    expect(diagnosis.type).toBe('spec_problem');
    expect(diagnosis.reasoning).toContain('vague');
  });

  it('handleEscalation persists diagnosis on task', async () => {
    const { updateEscalationDiagnosis } = await import('../../db/tasks.js');
    const diagnosisData = {
      type: 'foundation_problem',
      action: { create_prerequisite: 'IMU data capture' },
      reasoning: 'Physical sensor data is required before analysis can proceed.',
    };
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: diagnosisData,
        usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
        model: 'test-opus',
        durationMs: 1000,
      },
      data: diagnosisData,
    });

    await ceo.handleEscalation('task-1');

    expect(updateEscalationDiagnosis).toHaveBeenCalledWith('task-1', diagnosisData);
  });

  it('handleEscalation does not insert chat message', async () => {
    const { insertChatMessage } = await import('../../db/chat.js');
    const diagnosisData = {
      type: 'spec_problem',
      action: { rewrite: 'Make criteria specific' },
      reasoning: 'The criteria is too vague.',
    };
    mockInvokeAndValidate.mockResolvedValue({
      response: { content: '{}', parsed: diagnosisData, usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 }, model: 'test-opus', durationMs: 1000 },
      data: diagnosisData,
    });

    await ceo.handleEscalation('task-1');

    expect(insertChatMessage).not.toHaveBeenCalled();
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

    const { letter, boardRequestCount } = await ceo.compileBriefing('org-1');

    expect(typeof letter).toBe('string');
    expect(letter).toContain('sensor research');
    expect(typeof boardRequestCount).toBe('number');
  });
});

describe('CEOService — reply parsing', () => {
  let ceo: CEOService;

  beforeEach(() => {
    vi.clearAllMocks();
    ceo = new CEOService();
  });

  it('handleOwnerReply parses reply into actions', async () => {
    const intentData = {
      actions: [{ type: 'approve', target_id: 'plan-1' }],
      raw_text: 'Looks good, go ahead.',
      should_replan: false,
    };
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: intentData,
        usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
        model: 'test-opus',
        durationMs: 1000,
      },
      data: intentData,
    });

    const intent = await ceo.handleOwnerReply('org-1', 'Looks good, go ahead.');

    expect(intent.actions).toHaveLength(1);
    expect(intent.actions[0].type).toBe('approve');
  });
});
