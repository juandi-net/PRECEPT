import { describe, it, expect } from 'vitest';
import { getDispatchableTasks, checkPhaseCompletion, buildDependencyGraph } from '../dependency.js';
import type { Task } from '@precept/shared';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    org_id: 'org-1',
    plan_id: 'plan-1',
    initiative_id: 'init-1',
    phase: 1,
    state: 'PLANNED',
    role: 'researcher',
    assigned_worker: null,
    spec: { description: 'test', acceptance_criteria: [], priority: 'medium' },
    output: null,
    skills_loaded: [],
    depends_on: [],
    revision_count: 0,
    polish_count: 0,
    created_at: '2026-01-01',
    updated_at: null,
    ...overrides,
  };
}

describe('getDispatchableTasks', () => {
  it('returns PLANNED tasks with no dependencies', () => {
    const tasks = [makeTask({ id: 'a', state: 'PLANNED', depends_on: [] })];
    expect(getDispatchableTasks(tasks)).toHaveLength(1);
    expect(getDispatchableTasks(tasks)[0].id).toBe('a');
  });

  it('returns PLANNED tasks with all deps ACCEPTED', () => {
    const tasks = [
      makeTask({ id: 'a', state: 'ACCEPTED' }),
      makeTask({ id: 'b', state: 'PLANNED', depends_on: ['a'] }),
    ];
    expect(getDispatchableTasks(tasks)).toHaveLength(1);
    expect(getDispatchableTasks(tasks)[0].id).toBe('b');
  });

  it('does not return tasks with unmet dependencies', () => {
    const tasks = [
      makeTask({ id: 'a', state: 'IN_PROGRESS' }),
      makeTask({ id: 'b', state: 'PLANNED', depends_on: ['a'] }),
    ];
    expect(getDispatchableTasks(tasks)).toHaveLength(0);
  });

  it('does not return tasks already past PLANNED', () => {
    const tasks = [makeTask({ id: 'a', state: 'QUEUED', depends_on: [] })];
    expect(getDispatchableTasks(tasks)).toHaveLength(0);
  });
});

describe('checkPhaseCompletion', () => {
  it('returns true when all tasks in phase are ACCEPTED', () => {
    const tasks = [
      makeTask({ id: 'a', phase: 1, state: 'ACCEPTED' }),
      makeTask({ id: 'b', phase: 1, state: 'ACCEPTED' }),
      makeTask({ id: 'c', phase: 2, state: 'PLANNED' }),
    ];
    expect(checkPhaseCompletion(tasks, 1)).toBe(true);
  });

  it('returns false when one task in phase is not ACCEPTED', () => {
    const tasks = [
      makeTask({ id: 'a', phase: 1, state: 'ACCEPTED' }),
      makeTask({ id: 'b', phase: 1, state: 'IN_PROGRESS' }),
    ];
    expect(checkPhaseCompletion(tasks, 1)).toBe(false);
  });

  it('returns true for empty phase', () => {
    const tasks = [makeTask({ id: 'a', phase: 2, state: 'PLANNED' })];
    expect(checkPhaseCompletion(tasks, 1)).toBe(true);
  });
});

describe('buildDependencyGraph', () => {
  it('builds correct adjacency list', () => {
    const tasks = [
      makeTask({ id: 'a', depends_on: [] }),
      makeTask({ id: 'b', depends_on: ['a'] }),
      makeTask({ id: 'c', depends_on: ['a'] }),
      makeTask({ id: 'd', depends_on: ['b', 'c'] }),
    ];
    const graph = buildDependencyGraph(tasks);
    expect(graph.get('a')).toEqual(expect.arrayContaining(['b', 'c']));
    expect(graph.get('b')).toEqual(['d']);
    expect(graph.get('c')).toEqual(['d']);
    expect(graph.has('d')).toBe(false);
  });
});
