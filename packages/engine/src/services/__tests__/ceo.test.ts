import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInvokeAgent } = vi.hoisted(() => ({
  mockInvokeAgent: vi.fn(),
}));

vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: mockInvokeAgent,
}));

vi.mock('../../db/precepts.js', () => ({
  getLatestPrecepts: vi.fn().mockResolvedValue({
    id: 'prec-1',
    content: {
      identity: { content: 'We are ROOKIE.', state: 'confirmed' },
      product: { content: 'Sensor basketball.', state: 'hypothesis' },
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
}));

vi.mock('../../db/plans.js', () => ({
  createPlan: vi.fn().mockResolvedValue({ id: 'plan-1' }),
}));

vi.mock('../../db/tasks.js', () => ({
  createTasks: vi.fn().mockResolvedValue([
    { id: 'uuid-1' },
    { id: 'uuid-2' },
  ]),
}));

vi.mock('../../db/messages.js', () => ({
  logMessage: vi.fn(),
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
  getRecentEvents: vi.fn().mockResolvedValue([]),
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
import { createTasks } from '../../db/tasks.js';
import { logDecision } from '../../db/decisions.js';

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
              description: 'Research sensor hardware',
              acceptance_criteria: ['Pin diagram documented'],
              depends_on: [],
              skills: [],
              priority: 'high',
            },
            {
              id: 'task-2',
              role: 'coder',
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

describe('CEOService', () => {
  let ceo: CEOService;

  beforeEach(() => {
    vi.clearAllMocks();
    ceo = new CEOService();
  });

  it('planningCycle calls invokeAgent with opus and jsonMode', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: VALID_PLAN_OUTPUT,
      usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
      model: 'test-opus',
      durationMs: 2000,
    });

    await ceo.planningCycle('org-1');

    expect(mockInvokeAgent).toHaveBeenCalledWith(
      'CEO-1',
      expect.objectContaining({
        model: 'opus',
        jsonMode: true,
        temperature: 0.7,
      }),
    );
  });

  it('creates initiatives from plan output', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: VALID_PLAN_OUTPUT,
      usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
      model: 'test-opus',
      durationMs: 2000,
    });

    await ceo.planningCycle('org-1');

    expect(createInitiative).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        name: 'Sensor PoC',
      }),
    );
  });

  it('creates tasks with correct phase and spec', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: VALID_PLAN_OUTPUT,
      usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
      model: 'test-opus',
      durationMs: 2000,
    });

    await ceo.planningCycle('org-1');

    expect(createTasks).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          orgId: 'org-1',
          phase: 1,
          role: 'researcher',
        }),
      ]),
    );
  });

  it('logs decisions from plan output', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: VALID_PLAN_OUTPUT,
      usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
      model: 'test-opus',
      durationMs: 2000,
    });

    await ceo.planningCycle('org-1');

    expect(logDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        decision: 'Start with off-the-shelf sensor',
      }),
    );
  });

  it('creates plan with content', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: VALID_PLAN_OUTPUT,
      usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
      model: 'test-opus',
      durationMs: 2000,
    });

    await ceo.planningCycle('org-1');

    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
      }),
    );
  });
});
