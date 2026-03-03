import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/tasks.js', () => ({
  updateTaskState: vi.fn(),
  incrementRevisionCount: vi.fn(),
  logTransition: vi.fn(),
  getTask: vi.fn(),
}));

import { validateTransition, applyTransition } from '../state-machine.js';
import { updateTaskState, incrementRevisionCount, logTransition, getTask } from '../../db/tasks.js';
import type { TaskState } from '@precept/shared';

describe('validateTransition', () => {
  const validTransitions: [TaskState, TaskState][] = [
    ['PLANNED', 'QUEUED'],
    ['QUEUED', 'DISPATCHED'],
    ['DISPATCHED', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'REVIEW'],
    ['IN_PROGRESS', 'FAILED'],
    ['REVIEW', 'POLISH'],
    ['REVIEW', 'JUDGMENT'],
    ['POLISH', 'REVIEW'],
    ['JUDGMENT', 'ACCEPTED'],
    ['JUDGMENT', 'REVISION'],
    ['JUDGMENT', 'ESCALATED'],
    ['REVISION', 'REVIEW'],
    ['FAILED', 'ESCALATED'],
    ['ESCALATED', 'QUEUED'],
    ['ESCALATED', 'PLANNED'],
  ];

  it.each(validTransitions)('%s → %s is valid', (from, to) => {
    expect(validateTransition(from, to)).toBe(true);
  });

  const invalidTransitions: [TaskState, TaskState][] = [
    ['PLANNED', 'ACCEPTED'],
    ['PLANNED', 'IN_PROGRESS'],
    ['QUEUED', 'REVIEW'],
    ['ACCEPTED', 'QUEUED'],
    ['REVIEW', 'ACCEPTED'],
    ['IN_PROGRESS', 'JUDGMENT'],
  ];

  it.each(invalidTransitions)('%s → %s is invalid', (from, to) => {
    expect(validateTransition(from, to)).toBe(false);
  });
});

describe('applyTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies valid transition and logs it', async () => {
    vi.mocked(getTask).mockResolvedValue({
      id: 'task-1', org_id: 'org-1', state: 'PLANNED',
      revision_count: 0,
    } as any);

    const result = await applyTransition('task-1', 'QUEUED', 'Dispatcher-1', 'deps met');

    expect(updateTaskState).toHaveBeenCalledWith('task-1', 'QUEUED');
    expect(logTransition).toHaveBeenCalledWith({
      orgId: 'org-1',
      taskId: 'task-1',
      fromState: 'PLANNED',
      toState: 'QUEUED',
      agentId: 'Dispatcher-1',
      reason: 'deps met',
    });
    expect(result).toBe('QUEUED');
  });

  it('throws on invalid transition', async () => {
    vi.mocked(getTask).mockResolvedValue({
      id: 'task-1', org_id: 'org-1', state: 'PLANNED',
      revision_count: 0,
    } as any);

    await expect(
      applyTransition('task-1', 'ACCEPTED', 'Agent-1')
    ).rejects.toThrow('Invalid transition');
  });

  it('JUDGMENT → REVISION with revision_count < 2 proceeds normally', async () => {
    vi.mocked(getTask).mockResolvedValue({
      id: 'task-1', org_id: 'org-1', state: 'JUDGMENT',
      revision_count: 0,
    } as any);
    vi.mocked(incrementRevisionCount).mockResolvedValue(1);

    const result = await applyTransition('task-1', 'REVISION', 'Judge-1', 'needs rework');

    expect(incrementRevisionCount).toHaveBeenCalledWith('task-1');
    expect(updateTaskState).toHaveBeenCalledWith('task-1', 'REVISION');
    expect(result).toBe('REVISION');
  });

  it('JUDGMENT → REVISION with revision_count >= 2 auto-escalates', async () => {
    vi.mocked(getTask).mockResolvedValue({
      id: 'task-1', org_id: 'org-1', state: 'JUDGMENT',
      revision_count: 1,
    } as any);
    vi.mocked(incrementRevisionCount).mockResolvedValue(2);

    const result = await applyTransition('task-1', 'REVISION', 'Judge-1', 'needs rework');

    expect(incrementRevisionCount).toHaveBeenCalledWith('task-1');
    expect(updateTaskState).toHaveBeenCalledWith('task-1', 'ESCALATED');
    expect(result).toBe('ESCALATED');
  });
});
