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

vi.mock('../../db/client.js', () => ({
  db: { from: vi.fn() },
}));

vi.mock('../../db/credentials.js', () => ({
  markCredentialVerified: vi.fn(),
  getCredential: vi.fn(),
  storeCredential: vi.fn(),
  listCredentials: vi.fn().mockResolvedValue([]),
  revokeCredential: vi.fn(),
}));

vi.mock('../../db/cornerstone.js', () => ({
  getLatestCornerstone: vi.fn().mockResolvedValue({
    id: 'prec-1',
    content: {
      identity: { content: 'We are Test Org.', state: 'confirmed' },
      product: { content: 'Smart widgets.', state: 'hypothesis' },
    },
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
  createInitiative: vi.fn().mockResolvedValue({ id: 'init-1', name: 'Test' }),
  getActiveInitiatives: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/plans.js', () => ({
  createPlan: vi.fn().mockResolvedValue({ id: 'plan-1', plan_level: 'weekly', parent_plan_id: null }),
  getUnapprovedPlans: vi.fn().mockResolvedValue([]),
  getLatestPlanByLevel: vi.fn().mockResolvedValue(null),
  getRecentAdhocPlan: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../db/tasks.js', () => ({
  createTasks: vi.fn().mockResolvedValue([
    { id: 'uuid-1' },
    { id: 'uuid-2' },
  ]),
  updateTaskDependencies: vi.fn().mockResolvedValue(undefined),
  getTasksByState: vi.fn().mockResolvedValue([]),
  getTask: vi.fn(),
  getTransitions: vi.fn().mockResolvedValue([]),
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
  createBoardRequest: vi.fn().mockResolvedValue({ id: 'br-1' }),
  updateBoardRequestThreadId: vi.fn().mockResolvedValue(undefined),
  getPendingBoardRequests: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/orgs.js', () => ({
  getOrg: vi.fn().mockResolvedValue({ name: 'Test Org' }),
  getOwnerLastSeen: vi.fn().mockResolvedValue(null),
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

vi.mock('../../lib/email.js', () => ({
  sendBatchBoardRequestEmail: vi.fn().mockResolvedValue({ emailId: 'email-1', messageId: '<email-1@resend.dev>' }),
}));

vi.mock('../../db/email-threads.js', () => ({
  createThread: vi.fn().mockResolvedValue({ id: 'thread-1' }),
  insertEmailMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
}));

vi.mock('../../lib/linear.js', () => ({
  createIssue: vi.fn().mockResolvedValue(null),
  addComment: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../db/planning-history.js', () => ({
  searchPlanningHistory: vi.fn().mockResolvedValue([]),
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
      id: 'msg-1',
      org_id: 'org-1',
      from_role: 'scribe',
      from_agent_id: 'Scribe-1',
      to_role: 'ceo',
      message_type: 'context_package',
      payload: { summary: 'No activity.' },
      created_at: new Date().toISOString(),
    }),
  })),
}));

import { CEOService } from '../ceo.js';
import { createInitiative } from '../../db/initiatives.js';
import { createPlan } from '../../db/plans.js';
import { createTasks, getTask, getTransitions } from '../../db/tasks.js';
import { logDecision } from '../../db/decisions.js';
import { createBoardRequest, updateBoardRequestThreadId } from '../../db/boardRequests.js';
import { sendBatchBoardRequestEmail } from '../../lib/email.js';
import { createThread, insertEmailMessage } from '../../db/email-threads.js';
import { insertChatMessage, getChatHistory } from '../../db/chat.js';
import { logEvent } from '../../db/audit.js';
import { getOwnerLastSeen } from '../../db/orgs.js';

const VALID_PLAN_OUTPUT = {
  initiatives: [
    {
      name: 'Sensor PoC',
      description: 'Prove sensor works on ball',
      rationale: 'Core 90-day target',
      phases: [
        {
          phase_number: 1,
          description: 'Hardware setup',
          tasks: [
            {
              id: 'task-1',
              role: 'researcher',
              title: 'Research sensor hardware',
              description: 'Research sensor hardware',
              acceptance_criteria: ['Pin diagram documented'],
              depends_on: [],
              skills: [],
              priority: 'high',
            },
            {
              id: 'task-2',
              role: 'coder',
              title: 'Write data capture app',
              description: 'Write data capture app',
              acceptance_criteria: ['App captures IMU data'],
              depends_on: ['task-1'],
              skills: [],
              priority: 'high',
            },
          ],
        },
      ],
    },
  ],
  decisions: [
    {
      decision: 'Start with off-the-shelf sensor',
      reasoning: 'Under $100, proves concept fast',
      alternatives: 'Custom PCB',
      why_not: 'Too expensive for PoC stage',
    },
  ],
  board_requests: [],
};

const PLAN_WITH_BOARD_REQUESTS = {
  initiatives: [],
  decisions: [],
  board_requests: [
    { request: 'Hire a designer?', context: 'Design blocking launch', urgency: 'high', fallback: 'Proceed without' },
    { request: 'Increase budget?', context: 'Running low', urgency: 'medium', fallback: 'Cut features' },
  ],
};

describe('CEOService', () => {
  let ceo: CEOService;

  beforeEach(() => {
    vi.clearAllMocks();
    ceo = new CEOService();
  });

  it('weeklyPlan calls invokeAndValidate with opus and jsonMode', async () => {
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: VALID_PLAN_OUTPUT,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'test-opus',
        durationMs: 2000,
      },
      data: VALID_PLAN_OUTPUT,
    });

    await ceo.weeklyPlan('org-1');

    expect(mockInvokeAndValidate).toHaveBeenCalledWith(
      'CEO-1',
      expect.objectContaining({
        model: 'opus',
        jsonMode: true,
        temperature: 0.7,
      }),
      expect.anything(),
      'CEO weekly planning',
    );
    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        planLevel: 'weekly',
      }),
    );
  });

  it('creates initiatives from plan output', async () => {
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: VALID_PLAN_OUTPUT,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'test-opus',
        durationMs: 2000,
      },
      data: VALID_PLAN_OUTPUT,
    });

    await ceo.weeklyPlan('org-1');

    expect(createInitiative).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        name: 'Sensor PoC',
      }),
    );
  });

  it('creates tasks with planId, phase, and spec', async () => {
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: VALID_PLAN_OUTPUT,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'test-opus',
        durationMs: 2000,
      },
      data: VALID_PLAN_OUTPUT,
    });

    await ceo.weeklyPlan('org-1');

    expect(createTasks).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          orgId: 'org-1',
          planId: 'plan-1',
          phase: 1,
          role: 'researcher',
        }),
      ]),
    );
  });

  it('creates plan before tasks', async () => {
    const callOrder: string[] = [];
    (createPlan as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callOrder.push('createPlan');
      return { id: 'plan-1', plan_level: 'weekly', parent_plan_id: null };
    });
    (createTasks as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callOrder.push('createTasks');
      return [{ id: 'uuid-1' }, { id: 'uuid-2' }];
    });

    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: VALID_PLAN_OUTPUT,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'test-opus',
        durationMs: 2000,
      },
      data: VALID_PLAN_OUTPUT,
    });

    await ceo.weeklyPlan('org-1');

    expect(callOrder.indexOf('createPlan')).toBeLessThan(callOrder.indexOf('createTasks'));
  });

  it('logs decisions from plan output', async () => {
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: VALID_PLAN_OUTPUT,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'test-opus',
        durationMs: 2000,
      },
      data: VALID_PLAN_OUTPUT,
    });

    await ceo.weeklyPlan('org-1');

    expect(logDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        decision: 'Start with off-the-shelf sensor',
      }),
    );
  });

  it('creates plan with content and planLevel weekly', async () => {
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: VALID_PLAN_OUTPUT,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'test-opus',
        durationMs: 2000,
      },
      data: VALID_PLAN_OUTPUT,
    });

    await ceo.weeklyPlan('org-1');

    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        planLevel: 'weekly',
      }),
    );
  });

  it('monthlyPlan calls invokeAndValidate with opus and creates plan with planLevel monthly', async () => {
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: VALID_PLAN_OUTPUT,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'test-opus',
        durationMs: 2000,
      },
      data: VALID_PLAN_OUTPUT,
    });

    await ceo.monthlyPlan('org-1');

    expect(mockInvokeAndValidate).toHaveBeenCalledWith(
      'CEO-1',
      expect.objectContaining({
        model: 'opus',
        jsonMode: true,
        temperature: 0.7,
      }),
      expect.anything(),
      'CEO monthly planning',
    );
    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        planLevel: 'monthly',
        parentPlanId: null,
      }),
    );
  });

  it('dailyPlan calls invokeAndValidate with roleRegistry model and creates plan with planLevel daily', async () => {
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: VALID_PLAN_OUTPUT,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'test-opus',
        durationMs: 1000,
      },
      data: VALID_PLAN_OUTPUT,
    });

    await ceo.dailyPlan('org-1');

    expect(mockInvokeAndValidate).toHaveBeenCalledWith(
      'CEO-1',
      expect.objectContaining({
        model: 'opus',
        jsonMode: true,
        temperature: 0.5,
      }),
      expect.anything(),
      'CEO daily planning',
    );
    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        planLevel: 'daily',
      }),
    );
  });

  it('adhocPlan uses roleRegistry model and creates plan with planLevel adhoc', async () => {
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: VALID_PLAN_OUTPUT,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'test-opus',
        durationMs: 1000,
      },
      data: VALID_PLAN_OUTPUT,
    });

    const plan = await ceo.adhocPlan('org-1', 'Pivot to basketball analytics');

    expect(plan).not.toBeNull();
    expect(mockInvokeAndValidate).toHaveBeenCalledWith(
      'CEO-1',
      expect.objectContaining({
        model: 'opus',
        jsonMode: true,
        temperature: 0.5,
      }),
      expect.anything(),
      'CEO adhoc planning',
    );
    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        planLevel: 'adhoc',
      }),
    );
  });

  it('adhocPlan returns null when debounced', async () => {
    const { getRecentAdhocPlan } = await import('../../db/plans.js');
    (getRecentAdhocPlan as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'recent-plan' });

    const plan = await ceo.adhocPlan('org-1', 'Something urgent');

    expect(plan).toBeNull();
    expect(mockInvokeAndValidate).not.toHaveBeenCalled();
  });

  it('sends one batch email for multiple board requests', async () => {
    // Return distinct IDs for the two board requests
    (createBoardRequest as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'br-1' })
      .mockResolvedValueOnce({ id: 'br-2' });

    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: PLAN_WITH_BOARD_REQUESTS,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'test-opus',
        durationMs: 2000,
      },
      data: PLAN_WITH_BOARD_REQUESTS,
    });

    await ceo.weeklyPlan('org-1');

    // Both board requests created in DB
    expect(createBoardRequest).toHaveBeenCalledTimes(2);

    // Only one batch email sent
    expect(sendBatchBoardRequestEmail).toHaveBeenCalledTimes(1);
    expect(sendBatchBoardRequestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        orgName: 'Test Org',
        requests: expect.arrayContaining([
          expect.objectContaining({ id: 'br-1', request: 'Hire a designer?' }),
          expect.objectContaining({ id: 'br-2', request: 'Increase budget?' }),
        ]),
      }),
    );

    // One email thread created (not two)
    expect(createThread).toHaveBeenCalledTimes(1);

    // Both board requests linked to the same thread with distinct IDs
    expect(updateBoardRequestThreadId).toHaveBeenCalledTimes(2);
    expect(updateBoardRequestThreadId).toHaveBeenCalledWith('br-1', 'thread-1');
    expect(updateBoardRequestThreadId).toHaveBeenCalledWith('br-2', 'thread-1');

    // One outbound email message recorded
    expect(insertEmailMessage).toHaveBeenCalledTimes(1);
  });

  it('does not send email when plan has zero board requests', async () => {
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: VALID_PLAN_OUTPUT,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'test-opus',
        durationMs: 2000,
      },
      data: VALID_PLAN_OUTPUT,
    });

    await ceo.weeklyPlan('org-1');

    expect(sendBatchBoardRequestEmail).not.toHaveBeenCalled();
    expect(createThread).not.toHaveBeenCalled();
  });

  it('handles batch email failure gracefully — board requests still in DB', async () => {
    (sendBatchBoardRequestEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Resend down'));
    (createBoardRequest as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'br-1' })
      .mockResolvedValueOnce({ id: 'br-2' });

    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: PLAN_WITH_BOARD_REQUESTS,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'test-opus',
        durationMs: 2000,
      },
      data: PLAN_WITH_BOARD_REQUESTS,
    });

    // Should not throw — error is caught and logged
    await expect(ceo.weeklyPlan('org-1')).resolves.toBeDefined();

    // Board requests were still created in DB before the email failed
    expect(createBoardRequest).toHaveBeenCalledTimes(2);
  });

  describe('handleTaskCompletion', () => {
    const MOCK_TASK = {
      id: 'task-abc-123',
      org_id: 'org-1',
      state: 'ACCEPTED',
      role: 'researcher',
      source: 'owner_directed',
      initiative_id: null,
      revision_count: 0,
      spec: { title: 'Research sensors', description: 'Research sensor hardware in detail' },
      output: { output: 'Found 3 sensor options', key_findings: [] },
    };

    it('invokes CEO and writes message when response is substantive', async () => {
      (getTask as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TASK);
      (getOwnerLastSeen as ReturnType<typeof vi.fn>).mockResolvedValue(new Date());
      (getChatHistory as ReturnType<typeof vi.fn>).mockResolvedValue([
        { role: 'owner', content: 'Please look into sensors' },
      ]);
      mockInvokeAgent.mockResolvedValue({
        content: 'Great news! The sensor research is complete and we found three viable options for the basketball project.',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await ceo.handleTaskCompletion('org-1', 'task-abc-123');

      expect(insertChatMessage).toHaveBeenCalledWith('org-1', 'ceo', expect.any(String), 'task_update');
      expect(logEvent).toHaveBeenCalledWith('org-1', 'ceo.task_completion', 'CEO-1', expect.objectContaining({ wrote_message: true }));
    });

    it('skips message insert when CEO response is short', async () => {
      (getTask as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...MOCK_TASK,
        source: 'planning_cycle',
        state: 'ACCEPTED',
      });
      (getOwnerLastSeen as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (getChatHistory as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      mockInvokeAgent.mockResolvedValue({
        content: 'No action.',
        usage: { promptTokens: 100, completionTokens: 5, totalTokens: 105 },
      });

      await ceo.handleTaskCompletion('org-1', 'task-abc-123');

      expect(insertChatMessage).not.toHaveBeenCalled();
      expect(logEvent).toHaveBeenCalledWith('org-1', 'ceo.task_completion', 'CEO-1', expect.objectContaining({ wrote_message: false }));
    });

    it('passes owner as present when last_seen is within 15 seconds', async () => {
      (getTask as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TASK);
      (getOwnerLastSeen as ReturnType<typeof vi.fn>).mockResolvedValue(new Date(Date.now() - 5_000));
      (getChatHistory as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      mockInvokeAgent.mockResolvedValue({
        content: 'Ok.',
        usage: { promptTokens: 100, completionTokens: 2, totalTokens: 102 },
      });

      await ceo.handleTaskCompletion('org-1', 'task-abc-123');

      expect(mockInvokeAgent).toHaveBeenCalledWith(
        'CEO-1',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Present'),
            }),
          ]),
        }),
      );
    });
  });
});
