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

const { mockGetTasksByState, mockGetTasksByStates, mockGetTask } = vi.hoisted(() => ({
  mockGetTasksByState: vi.fn().mockResolvedValue([]),
  mockGetTasksByStates: vi.fn().mockResolvedValue([]),
  mockGetTask: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../db/tasks.js', () => ({
  getTasksByState: mockGetTasksByState,
  getTasksByStates: mockGetTasksByStates,
  getTask: mockGetTask,
  getTasksByPlan: vi.fn().mockResolvedValue([]),
  updateTaskState: vi.fn(),
  updateTaskWorker: vi.fn(),
  updateTaskOutput: vi.fn(),
  logTransition: vi.fn(),
  incrementRevisionCount: vi.fn().mockResolvedValue(1),
  incrementPolishCount: vi.fn().mockResolvedValue(1),
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
    spec: { title: 'Test task', description: 'Test', acceptance_criteria: ['Done'], priority: 'high' },
    output: null,
    skills_loaded: [],
    depends_on: [],
    revision_count: 0,
    polish_count: 0,
    source: 'planning_cycle' as const,
    created_at: new Date().toISOString(),
    updated_at: null,
    linear_issue_id: null,
    escalation_diagnosis: null,
    owner_read_at: null,
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
    mockGetTasksByStates.mockResolvedValue([makeTask({ id: 'q-1', state: 'QUEUED' })]);

    // Restore handleEvent for recovery but keep push tracked
    vi.spyOn(engine, 'handleEvent').mockResolvedValue(undefined);

    await engine.recoverFromRestart('org-1');

    // Recovery should have attempted to dispatch the QUEUED task
    const { applyTransition } = await import('../state-machine.js');
    expect(applyTransition).toHaveBeenCalled();
  });

  it('resets stuck IN_PROGRESS tasks (>15 min) to QUEUED and re-dispatches', async () => {
    const stuckDate = new Date(Date.now() - 16 * 60 * 1000).toISOString(); // 16 min ago
    const stuckTask = makeTask({ id: 'ip-1', state: 'IN_PROGRESS', updated_at: stuckDate });
    mockGetTasksByStates.mockResolvedValue([stuckTask]);
    mockGetTask.mockResolvedValue(stuckTask);

    const bgSpy = vi.spyOn(engine, 'executeWorkerInBackground').mockImplementation(() => {});

    await engine.recoverFromRestart('org-1');

    const { applyTransition } = await import('../state-machine.js');
    expect(applyTransition).toHaveBeenCalledWith('ip-1', 'QUEUED', 'Engine', 'recovery reset stuck task');
    expect(applyTransition).toHaveBeenCalledWith('ip-1', 'DISPATCHED', 'Engine', 'recovery re-dispatch');
    expect(applyTransition).toHaveBeenCalledWith('ip-1', 'IN_PROGRESS', 'Engine', 'recovery worker starting');
    expect(bgSpy).toHaveBeenCalledWith(stuckTask, 'org-1', { type: 'execute' });
  });

  it('re-queues REVIEW tasks for evaluation', async () => {
    mockGetTasksByStates.mockResolvedValue([makeTask({ id: 'r-1', state: 'REVIEW' })]);

    const pushSpy = vi.spyOn(engine, 'push');

    await engine.recoverFromRestart('org-1');

    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'review_verdict', taskId: 'r-1' }),
    );
  });

  it('recovers POLISH tasks by transitioning to REVIEW', async () => {
    mockGetTasksByStates.mockResolvedValue([makeTask({ id: 'p-1', state: 'POLISH' })]);

    const pushSpy = vi.spyOn(engine, 'push');

    await engine.recoverFromRestart('org-1');

    const { applyTransition } = await import('../state-machine.js');
    expect(applyTransition).toHaveBeenCalledWith('p-1', 'REVIEW', 'Engine', 'recovery from POLISH');
    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'review_verdict', taskId: 'p-1' }),
    );
  });

  it('recovers REVISION tasks by transitioning to REVIEW', async () => {
    mockGetTasksByStates.mockResolvedValue([makeTask({ id: 'rv-1', state: 'REVISION' })]);

    const pushSpy = vi.spyOn(engine, 'push');

    await engine.recoverFromRestart('org-1');

    const { applyTransition } = await import('../state-machine.js');
    expect(applyTransition).toHaveBeenCalledWith('rv-1', 'REVIEW', 'Engine', 'recovery from REVISION');
    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'review_verdict', taskId: 'rv-1' }),
    );
  });

  it('does nothing for IN_PROGRESS tasks within 15 min threshold', async () => {
    const recentDate = new Date().toISOString();
    mockGetTasksByStates.mockResolvedValue([makeTask({ id: 'ip-2', state: 'IN_PROGRESS', updated_at: recentDate })]);

    await engine.recoverFromRestart('org-1');

    const { applyTransition } = await import('../state-machine.js');
    // Should NOT have been reset or failed
    expect(applyTransition).not.toHaveBeenCalledWith('ip-2', 'QUEUED', expect.anything(), expect.anything());
    expect(applyTransition).not.toHaveBeenCalledWith('ip-2', 'FAILED', expect.anything(), expect.anything());
  });
});
