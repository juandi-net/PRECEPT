import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task } from '@precept/shared';

const { mockInvokeAgent } = vi.hoisted(() => ({
  mockInvokeAgent: vi.fn(),
}));

vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: mockInvokeAgent,
}));

const { mockGetTasksByPlan, mockUpdateTaskState, mockUpdateTaskWorker } = vi.hoisted(() => ({
  mockGetTasksByPlan: vi.fn(),
  mockUpdateTaskState: vi.fn(),
  mockUpdateTaskWorker: vi.fn(),
}));

vi.mock('../../db/tasks.js', () => ({
  getTasksByPlan: mockGetTasksByPlan,
  updateTaskState: mockUpdateTaskState,
  updateTaskWorker: mockUpdateTaskWorker,
  updateTaskOutput: vi.fn(),
  getTask: vi.fn(),
}));

vi.mock('../../orchestration/state-machine.js', () => ({
  applyTransition: vi.fn(),
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
}));

vi.mock('../../db/messages.js', () => ({
  logMessage: vi.fn(),
}));

import { DispatcherService } from '../dispatcher.js';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    org_id: 'org-1',
    plan_id: 'plan-1',
    initiative_id: 'init-1',
    phase: 1,
    state: 'PLANNED',
    role: 'researcher',
    assigned_worker: null,
    spec: {
      title: 'Research sensor hardware',
      description: 'Research sensors',
      acceptance_criteria: ['Pin diagram documented'],
      priority: 'high',
    },
    output: null,
    skills_loaded: [],
    depends_on: [],
    revision_count: 0,
    polish_count: 0,
    created_at: new Date().toISOString(),
    updated_at: null,
    ...overrides,
  };
}

describe('DispatcherService', () => {
  let dispatcher: DispatcherService;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatcher = new DispatcherService();
  });

  it('dispatches PLANNED tasks with met dependencies', async () => {
    const tasks: Task[] = [
      makeTask({ id: 'task-1', state: 'PLANNED', depends_on: [] }),
      makeTask({ id: 'task-2', state: 'PLANNED', depends_on: ['task-1'] }),
    ];
    mockGetTasksByPlan.mockResolvedValue(tasks);

    const dispatched = await dispatcher.executePlan('plan-1');

    // Only task-1 should be dispatched (task-2 depends on task-1 which is not ACCEPTED)
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toBe('task-1');
  });

  it('skips tasks with unmet dependencies', async () => {
    const tasks: Task[] = [
      makeTask({ id: 'task-1', state: 'PLANNED', depends_on: ['task-0'] }),
    ];
    mockGetTasksByPlan.mockResolvedValue(tasks);

    const dispatched = await dispatcher.executePlan('plan-1');

    expect(dispatched).toHaveLength(0);
  });

  it('dispatches tasks when all dependencies are ACCEPTED', async () => {
    const tasks: Task[] = [
      makeTask({ id: 'task-0', state: 'ACCEPTED', depends_on: [] }),
      makeTask({ id: 'task-1', state: 'PLANNED', depends_on: ['task-0'] }),
    ];
    mockGetTasksByPlan.mockResolvedValue(tasks);

    const dispatched = await dispatcher.executePlan('plan-1');

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toBe('task-1');
  });

  it('returns empty array when no tasks are dispatchable', async () => {
    mockGetTasksByPlan.mockResolvedValue([]);

    const dispatched = await dispatcher.executePlan('plan-1');

    expect(dispatched).toEqual([]);
  });
});
