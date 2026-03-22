import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSearchPlanningHistory = vi.fn();

vi.mock('../../db/planning-history.js', () => ({
  searchPlanningHistory: (...args: any[]) => mockSearchPlanningHistory(...args),
}));

// Mock all other dependencies that ceo-tools.ts imports
vi.mock('../../db/initiatives.js', () => ({
  getActiveInitiatives: vi.fn(),
  createInitiative: vi.fn(),
  updateInitiativeRepoUrl: vi.fn(),
}));
vi.mock('../../db/tasks.js', () => ({
  getTasksByInitiative: vi.fn(),
  createTasks: vi.fn(),
}));
vi.mock('../../db/audit.js', () => ({
  getRecentEvents: vi.fn(),
  logEvent: vi.fn(),
}));
vi.mock('../../db/cornerstone.js', () => ({
  getLatestCornerstone: vi.fn(),
}));
vi.mock('../../lib/credentials.js', () => ({
  resolveCredentials: vi.fn(),
}));
vi.mock('../../lib/linear.js', () => ({
  createIssue: vi.fn(),
  addComment: vi.fn(),
}));

import { createCeoToolHandler } from '../ceo-tools.js';

describe('search_planning_history tool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ranked results from audit and decision logs', async () => {
    mockSearchPlanningHistory.mockResolvedValue([
      {
        source: 'decision_log',
        id: 'd1',
        created_at: '2026-03-01T00:00:00Z',
        event_type: null,
        decision_type: 'Created digital presence initiative',
        agent_id: null,
        summary: 'Created digital presence initiative to establish web presence',
        rank: 0.8,
      },
      {
        source: 'audit_log',
        id: 'a1',
        created_at: '2026-03-05T00:00:00Z',
        event_type: 'planning.ceo',
        decision_type: null,
        agent_id: 'CEO-1',
        summary: 'Planned website redesign phase 2',
        rank: 0.6,
      },
    ]);

    const handler = createCeoToolHandler('org-1');
    const result = await handler('search_planning_history', { query: 'website strategy' });
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].source).toBe('decision_log');
    expect(parsed[0].type).toBe('Created digital presence initiative');
    expect(parsed[1].source).toBe('audit_log');
    expect(parsed[1].type).toBe('planning.ceo');
    expect(parsed[1].agent).toBe('CEO-1');
    expect(mockSearchPlanningHistory).toHaveBeenCalledWith('org-1', 'website strategy', 20);
  });

  it('passes custom limit', async () => {
    mockSearchPlanningHistory.mockResolvedValue([]);

    const handler = createCeoToolHandler('org-1');
    await handler('search_planning_history', { query: 'test', limit: 5 });

    expect(mockSearchPlanningHistory).toHaveBeenCalledWith('org-1', 'test', 5);
  });

  it('returns empty array when no matches', async () => {
    mockSearchPlanningHistory.mockResolvedValue([]);

    const handler = createCeoToolHandler('org-1');
    const result = await handler('search_planning_history', { query: 'nonexistent topic' });

    expect(JSON.parse(result)).toEqual([]);
  });
});
