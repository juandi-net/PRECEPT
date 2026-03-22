import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task } from '@precept/shared';
import type { EngineContext } from '../handlers/types.js';

const { mockLogEvent, mockGetTask, mockGetTransitions } = vi.hoisted(() => ({
  mockLogEvent: vi.fn(),
  mockGetTask: vi.fn(),
  mockGetTransitions: vi.fn(),
}));

// Mock transitive dependencies
vi.mock('../../ai/client.js', () => ({
  ai: {},
  MODELS: { opus: 'test-opus', sonnet: 'test-sonnet' },
}));

vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({
  db: { from: vi.fn() },
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: mockLogEvent,
  getRecentEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/tasks.js', () => ({
  getTask: mockGetTask,
  incrementPolishCount: vi.fn(),
  getTransitions: mockGetTransitions,
}));

vi.mock('../state-machine.js', () => ({
  applyTransition: vi.fn(),
}));

vi.mock('../../db/messages.js', () => ({
  logMessage: vi.fn(),
}));

vi.mock('../../db/skill-events.js', () => ({
  logSkillEvent: vi.fn(),
}));

vi.mock('../../lib/embeddings.js', () => ({
  embedText: vi.fn().mockResolvedValue(new Array(768).fill(0)),
  embedTexts: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/role-memory.js', () => ({
  storeRoleMemory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../db/agent-profiles.js', () => ({
  updateProfileAfterReview: vi.fn().mockResolvedValue(undefined),
  getProfile: vi.fn().mockResolvedValue(null),
  getProfilesByRole: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/team-bulletin.js', () => ({
  addBulletinEntry: vi.fn().mockResolvedValue(undefined),
  getRecentBulletin: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/decisions.js', () => ({
  logLesson: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config/role-registry.js', () => ({
  roleRegistry: {
    getModel: vi.fn().mockResolvedValue('test-model'),
    getEndpoint: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
  },
}));

import { EvaluationHandlers } from '../handlers/evaluation.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1234-5678',
    org_id: 'org-1',
    plan_id: 'plan-1',
    title: 'Test task',
    description: 'A test task',
    role: 'developer',
    status: 'ESCALATED',
    priority: 'medium',
    source: 'planned',
    assigned_worker: null,
    spec: { steps: [], deliverables: [], context: '' },
    output: null,
    skills_loaded: ['skill-A'],
    depends_on: [],
    revision_count: 0,
    polish_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    field_signals: [],
    ...overrides,
  } as Task;
}

describe('EvaluationHandlers — Curator fast-path', () => {
  let handlers: EvaluationHandlers;
  let mockCtx: EngineContext;
  let mockCeo: { handleEscalation: ReturnType<typeof vi.fn>; sendOwnerFollowUp: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetTask.mockReset();
    mockLogEvent.mockReset();
    mockGetTransitions.mockReset();
    mockGetTransitions.mockResolvedValue([]);

    mockCtx = {
      push: vi.fn(),
      runWorker: vi.fn(),
      executeWorkerInBackground: vi.fn(),
      dispatchReadyTasks: vi.fn(),
      cleanupWorkspaceIfNeeded: vi.fn(),
    };

    mockCeo = {
      handleEscalation: vi.fn().mockResolvedValue({
        type: 'spec_problem',
        action: {},
        reasoning: 'bad spec',
      }),
      sendOwnerFollowUp: vi.fn().mockResolvedValue(undefined),
    };

    handlers = new EvaluationHandlers(
      mockCtx,
      {} as any, // reviewer — not used in handleEscalation
      {} as any, // judge — not used in handleEscalation
      mockCeo as any,
    );
  });

  it('triggers curator_cycle when spec_problem with loaded skills', async () => {
    mockGetTask.mockResolvedValue(makeTask({ skills_loaded: ['skill-A'] }));

    await handlers.handleEscalation('org-1', 'task-1234-5678');

    expect(mockCtx.push).toHaveBeenCalledWith({ type: 'curator_cycle', orgId: 'org-1' });
    expect(mockLogEvent).toHaveBeenCalledWith('org-1', 'curator.fast_path', 'Engine', {
      taskId: 'task-1234-5678',
      diagnosis: 'spec_problem',
      skills: ['skill-A'],
    });
  });

  it('does not trigger when diagnosis is not spec_problem', async () => {
    mockCeo.handleEscalation.mockResolvedValue({
      type: 'capability_problem',
      action: {},
      reasoning: 'capability issue',
    });
    mockGetTask.mockResolvedValue(makeTask({ skills_loaded: ['skill-A'] }));

    await handlers.handleEscalation('org-1', 'task-1234-5678');

    expect(mockCtx.push).not.toHaveBeenCalled();
    expect(mockLogEvent).not.toHaveBeenCalledWith(
      expect.anything(),
      'curator.fast_path',
      expect.anything(),
      expect.anything(),
    );
  });

  it('does not trigger when no skills loaded', async () => {
    mockGetTask.mockResolvedValue(makeTask({ skills_loaded: [] }));

    await handlers.handleEscalation('org-1', 'task-1234-5678');

    expect(mockCtx.push).not.toHaveBeenCalled();
    expect(mockLogEvent).not.toHaveBeenCalledWith(
      expect.anything(),
      'curator.fast_path',
      expect.anything(),
      expect.anything(),
    );
  });

  it('respects 4-hour cooldown per skill combination', async () => {
    mockGetTask.mockResolvedValue(makeTask({ skills_loaded: ['skill-A'] }));

    // First call — should trigger
    await handlers.handleEscalation('org-1', 'task-1234-5678');
    expect(mockCtx.push).toHaveBeenCalledTimes(1);
    expect(mockCtx.push).toHaveBeenCalledWith({ type: 'curator_cycle', orgId: 'org-1' });

    (mockCtx.push as ReturnType<typeof vi.fn>).mockClear();
    mockLogEvent.mockClear();
    mockCeo.handleEscalation.mockResolvedValue({
      type: 'spec_problem',
      action: {},
      reasoning: 'bad spec again',
    });
    mockGetTask.mockResolvedValue(makeTask({ skills_loaded: ['skill-A'] }));

    // Second call — same skill combo, should NOT trigger (cooldown)
    await handlers.handleEscalation('org-1', 'task-1234-5678');
    expect(mockCtx.push).not.toHaveBeenCalled();
    expect(mockLogEvent).not.toHaveBeenCalledWith(
      expect.anything(),
      'curator.fast_path',
      expect.anything(),
      expect.anything(),
    );
  });
});
