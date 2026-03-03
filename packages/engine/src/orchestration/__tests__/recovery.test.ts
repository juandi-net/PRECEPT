import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task } from '@precept/shared';

// Mock all transitive dependencies
vi.mock('../../ai/client.js', () => ({
  ai: {},
  MODELS: { opus: 'test-opus', sonnet: 'test-sonnet' },
}));

vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: vi.fn().mockResolvedValue({
    content: '{}',
    parsed: { output: 'test', key_findings: [], confidence: 'high', flag: null, notes: null },
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    model: 'test',
    durationMs: 100,
  }),
}));

vi.mock('../../db/client.js', () => ({
  db: { from: vi.fn() },
}));

const { mockGetTasksByState, mockGetTask } = vi.hoisted(() => ({
  mockGetTasksByState: vi.fn().mockResolvedValue([]),
  mockGetTask: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../db/tasks.js', () => ({
  getTasksByState: mockGetTasksByState,
  getTask: mockGetTask,
  getTasksByPlan: vi.fn().mockResolvedValue([]),
  updateTaskState: vi.fn(),
  updateTaskWorker: vi.fn(),
  updateTaskOutput: vi.fn(),
  logTransition: vi.fn(),
}));

vi.mock('../../db/plans.js', () => ({
  approvePlan: vi.fn(),
  getUnapprovedPlans: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
  getRecentEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/messages.js', () => ({
  logMessage: vi.fn(),
}));

vi.mock('../../db/owner-feedback.js', () => ({
  logOwnerFeedback: vi.fn(),
}));

vi.mock('../state-machine.js', () => ({
  applyTransition: vi.fn().mockResolvedValue('DISPATCHED'),
}));

import { OrchestrationEngine } from '../engine.js';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    org_id: 'org-1',
    plan_id: 'plan-1',
    initiative_id: 'init-1',
    phase: 1,
    state: 'QUEUED',
    role: 'researcher',
    assigned_worker: null,
    spec: { description: 'Test', acceptance_criteria: ['Done'], priority: 'high' },
    output: null,
    skills_loaded: [],
    depends_on: [],
    revision_count: 0,
    created_at: new Date().toISOString(),
    updated_at: null,
    ...overrides,
  };
}

describe('OrchestrationEngine — recovery', () => {
  let engine: OrchestrationEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new OrchestrationEngine();
    // Mock handleEvent to prevent drain from processing pushed events
    vi.spyOn(engine, 'handleEvent').mockResolvedValue(undefined);
  });

  it('recovers QUEUED tasks by re-dispatching', async () => {
    mockGetTasksByState.mockImplementation(async (_orgId: string, state: string) => {
      if (state === 'QUEUED') return [makeTask({ id: 'q-1', state: 'QUEUED' })];
      return [];
    });

    // Restore handleEvent for recovery but keep push tracked
    vi.spyOn(engine, 'handleEvent').mockResolvedValue(undefined);

    await engine.recoverFromRestart('org-1');

    // Recovery should have attempted to dispatch the QUEUED task
    const { applyTransition } = await import('../state-machine.js');
    expect(applyTransition).toHaveBeenCalled();
  });

  it('marks timed-out IN_PROGRESS tasks as FAILED', async () => {
    const oldDate = new Date(Date.now() - 700000).toISOString(); // 700s ago, past 600s timeout
    mockGetTasksByState.mockImplementation(async (_orgId: string, state: string) => {
      if (state === 'IN_PROGRESS') return [makeTask({ id: 'ip-1', state: 'IN_PROGRESS', updated_at: oldDate })];
      return [];
    });

    await engine.recoverFromRestart('org-1');

    const { applyTransition } = await import('../state-machine.js');
    expect(applyTransition).toHaveBeenCalledWith('ip-1', 'FAILED', 'Engine', 'recovery timeout');
  });

  it('re-queues REVIEW tasks for evaluation', async () => {
    mockGetTasksByState.mockImplementation(async (_orgId: string, state: string) => {
      if (state === 'REVIEW') return [makeTask({ id: 'r-1', state: 'REVIEW' })];
      return [];
    });

    const pushSpy = vi.spyOn(engine, 'push');

    await engine.recoverFromRestart('org-1');

    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'review_verdict', taskId: 'r-1' }),
    );
  });

  it('does nothing for IN_PROGRESS tasks within timeout', async () => {
    const recentDate = new Date().toISOString();
    mockGetTasksByState.mockImplementation(async (_orgId: string, state: string) => {
      if (state === 'IN_PROGRESS') return [makeTask({ id: 'ip-2', state: 'IN_PROGRESS', updated_at: recentDate })];
      return [];
    });

    await engine.recoverFromRestart('org-1');

    const { applyTransition } = await import('../state-machine.js');
    // Should NOT have been called with FAILED for this task
    expect(applyTransition).not.toHaveBeenCalledWith('ip-2', 'FAILED', expect.anything(), expect.anything());
  });
});
