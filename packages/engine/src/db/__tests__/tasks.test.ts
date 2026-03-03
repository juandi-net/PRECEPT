import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase client
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('../client.js', () => ({
  db: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  createTask,
  getTask,
  getTasksByState,
  updateTaskState,
  getDependentTasks,
  logTransition,
} from '../tasks.js';

// Helper to build a mock Supabase chain
function mockChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.contains = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(result);
  // For queries that end without single/limit, resolve at eq level
  return chain;
}

const sampleTaskRow = {
  id: 'task-uuid-1',
  org_id: 'org-uuid',
  plan_id: 'plan-uuid',
  initiative_id: 'init-uuid',
  phase: 1,
  state: 'PLANNED',
  role: 'researcher',
  assigned_worker: null,
  spec: { description: 'Research topic', acceptance_criteria: ['Found 3 sources'], priority: 'high' },
  output: null,
  skills_loaded: [],
  depends_on: [],
  revision_count: 0,
  created_at: '2026-03-03T00:00:00Z',
  updated_at: null,
};

describe('db/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTask', () => {
    it('builds correct insert payload with snake_case columns', async () => {
      const chain = mockChain({ data: sampleTaskRow, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await createTask({
        orgId: 'org-uuid',
        planId: 'plan-uuid',
        initiativeId: 'init-uuid',
        phase: 1,
        role: 'researcher',
        spec: { description: 'Research topic', acceptance_criteria: ['Found 3 sources'], priority: 'high' },
        dependsOn: [],
      });

      expect(mockFrom).toHaveBeenCalledWith('tasks');
      expect(chain.insert).toHaveBeenCalledWith({
        org_id: 'org-uuid',
        plan_id: 'plan-uuid',
        initiative_id: 'init-uuid',
        phase: 1,
        role: 'researcher',
        spec: { description: 'Research topic', acceptance_criteria: ['Found 3 sources'], priority: 'high' },
        depends_on: [],
        skills_loaded: [],
      });

      // Verify camelCase mapping in result
      expect(result.id).toBe('task-uuid-1');
      expect(result.org_id).toBe('org-uuid');
      expect(result.plan_id).toBe('plan-uuid');
      expect(result.state).toBe('PLANNED');
    });
  });

  describe('getTasksByState', () => {
    it('passes correct filter params', async () => {
      const chain = mockChain({ data: [sampleTaskRow], error: null });
      // For non-single queries, resolve at eq level
      chain.eq = vi.fn().mockReturnValue(chain);
      // The final call in the chain should resolve the data
      mockFrom.mockReturnValue(chain);

      // getTasksByState doesn't call .single(), it ends with the chain
      // We need to make the last method in the chain return the resolved data
      const mockEq = vi.fn();
      const outerChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: mockEq,
          }),
        }),
      };
      mockEq.mockResolvedValue({ data: [sampleTaskRow], error: null });
      mockFrom.mockReturnValue(outerChain);

      const results = await getTasksByState('org-uuid', 'PLANNED');

      expect(mockFrom).toHaveBeenCalledWith('tasks');
      expect(results).toHaveLength(1);
      expect(results[0].state).toBe('PLANNED');
    });
  });

  describe('updateTaskState', () => {
    it('calls update with correct params', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      mockFrom.mockReturnValue({ update: mockUpdate });

      await updateTaskState('task-uuid-1', 'QUEUED');

      expect(mockFrom).toHaveBeenCalledWith('tasks');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'QUEUED' })
      );
    });
  });

  describe('getDependentTasks', () => {
    it('filters by depends_on array containment', async () => {
      const dependentRow = { ...sampleTaskRow, id: 'task-uuid-2', depends_on: ['task-uuid-1'] };
      const mockContains = vi.fn().mockResolvedValue({ data: [dependentRow], error: null });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          contains: mockContains,
        }),
      });

      const results = await getDependentTasks('task-uuid-1');

      expect(mockContains).toHaveBeenCalledWith('depends_on', ['task-uuid-1']);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('task-uuid-2');
    });
  });

  describe('logTransition', () => {
    it('inserts with snake_case columns', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: mockInsert });

      await logTransition({
        orgId: 'org-uuid',
        taskId: 'task-uuid-1',
        fromState: 'PLANNED',
        toState: 'QUEUED',
        agentId: 'Dispatcher-1',
        reason: 'dependencies met',
      });

      expect(mockFrom).toHaveBeenCalledWith('task_transitions');
      expect(mockInsert).toHaveBeenCalledWith({
        org_id: 'org-uuid',
        task_id: 'task-uuid-1',
        from_state: 'PLANNED',
        to_state: 'QUEUED',
        agent_id: 'Dispatcher-1',
        reason: 'dependencies met',
        metadata: null,
      });
    });
  });
});
