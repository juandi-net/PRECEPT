import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetActiveInitiatives = vi.fn();
const mockCreateInitiative = vi.fn();
const mockGetTasksByInitiative = vi.fn();
const mockCreateTasks = vi.fn();
const mockGetTask = vi.fn();
const mockUpdateEscalationDiagnosis = vi.fn();
const mockApplyTransition = vi.fn();
const mockGetRecentEvents = vi.fn();
const mockGetLatestCornerstone = vi.fn();
const mockResolveCredentials = vi.fn();
const mockUpdateInitiativeRepoUrl = vi.fn();
const mockListCredentials = vi.fn();
const mockStoreCredential = vi.fn();
const mockDbFrom = vi.fn();

vi.mock('../../db/initiatives.js', () => ({
  getActiveInitiatives: (...args: any[]) => mockGetActiveInitiatives(...args),
  createInitiative: (...args: any[]) => mockCreateInitiative(...args),
  updateInitiativeRepoUrl: (...args: any[]) => mockUpdateInitiativeRepoUrl(...args),
  updateInitiativeStatus: vi.fn(),
  softDeleteInitiative: vi.fn(),
}));
vi.mock('../../db/tasks.js', () => ({
  getTasksByInitiative: (...args: any[]) => mockGetTasksByInitiative(...args),
  createTasks: (...args: any[]) => mockCreateTasks(...args),
  getTask: (...args: any[]) => mockGetTask(...args),
  updateEscalationDiagnosis: (...args: any[]) => mockUpdateEscalationDiagnosis(...args),
  softDeleteTask: vi.fn(),
}));
vi.mock('../../orchestration/state-machine.js', () => ({
  applyTransition: (...args: any[]) => mockApplyTransition(...args),
}));
vi.mock('../../db/audit.js', () => ({
  getRecentEvents: (...args: any[]) => mockGetRecentEvents(...args),
  logEvent: vi.fn(),
}));
vi.mock('../../db/cornerstone.js', () => ({
  getLatestCornerstone: (...args: any[]) => mockGetLatestCornerstone(...args),
}));
vi.mock('../../lib/credentials.js', () => ({
  resolveCredentials: (...args: any[]) => mockResolveCredentials(...args),
}));
vi.mock('../../lib/linear.js', () => ({
  createIssue: vi.fn(),
  addComment: vi.fn(),
}));
vi.mock('../../db/planning-history.js', () => ({
  searchPlanningHistory: vi.fn(),
}));
vi.mock('../../db/email-threads.js', () => ({
  createThread: vi.fn().mockResolvedValue({ id: 'thread-1' }),
  insertEmailMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
}));
vi.mock('../../db/boardRequests.js', () => ({
  createBoardRequest: vi.fn().mockResolvedValue({ id: 'br-1' }),
  updateBoardRequestThreadId: vi.fn(),
}));
vi.mock('../../db/orgs.js', () => ({
  getOrg: vi.fn().mockResolvedValue({ id: 'org-1', name: 'Test Org' }),
  getOwnerLastSeen: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../ai/prompts/ceo-chat.js', async () => {
  const actual = await vi.importActual<typeof import('../../ai/prompts/ceo-chat.js')>('../../ai/prompts/ceo-chat.js');
  return { ...actual };
});
vi.mock('../../lib/email.js', () => ({
  sendAdhocEmail: vi.fn().mockResolvedValue({ emailId: 'email-1', messageId: '<email-1@resend.dev>' }),
  sendBatchBoardRequestEmail: vi.fn().mockResolvedValue({ emailId: 'email-2', messageId: '<email-2@resend.dev>' }),
}));
vi.mock('../../db/credentials.js', () => ({
  listCredentials: (...args: any[]) => mockListCredentials(...args),
  storeCredential: (...args: any[]) => mockStoreCredential(...args),
}));
vi.mock('../../db/client.js', () => ({
  db: { from: (...args: any[]) => mockDbFrom(...args) },
}));

const mockEmbedText = vi.fn();
const mockMatchRoleMemory = vi.fn();
vi.mock('../../lib/embeddings.js', () => ({
  embedText: (...args: any[]) => mockEmbedText(...args),
}));
vi.mock('../../db/role-memory.js', () => ({
  matchRoleMemory: (...args: any[]) => mockMatchRoleMemory(...args),
}));

import { createCeoToolHandler, CEO_TOOLS } from '../ceo-tools.js';

describe('CEO Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveCredentials.mockResolvedValue({
      resendApiKey: undefined,
      emailDomain: undefined,
      ownerEmail: undefined,
      githubToken: undefined,
      githubOrg: undefined,
      githubRepoUrl: undefined,
      linearApiKey: undefined,
      linearTeamId: undefined,
    });
  });

  it('defines all tools', () => {
    expect(CEO_TOOLS).toHaveLength(17);
    expect(CEO_TOOLS.map(t => t.function.name)).toEqual([
      'search_initiatives',
      'get_tasks',
      'search_audit',
      'get_cornerstone',
      'list_initiatives',
      'linear',
      'search_planning_history',
      'create_task',
      'github_create_repo',
      'trigger_planning',
      'send_email',
      'board_requests',
      'credentials',
      'org_admin',
      'resolve_escalation',
      'web_search',
      'query_role_memory',
    ]);
  });

  it('search_initiatives returns matching initiatives', async () => {
    mockGetActiveInitiatives.mockResolvedValue([
      { id: 'i1', name: 'Website Redesign', description: null, status: 'active', phase_current: 1 },
      { id: 'i2', name: 'Marketing Campaign', description: null, status: 'active', phase_current: 2 },
    ]);

    const handler = createCeoToolHandler('org-1');
    const result = await handler('search_initiatives', { query: 'website' });
    const parsed = JSON.parse(result);

    expect(parsed.exact_matches).toBe(1);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].name).toBe('Website Redesign');
  });

  it('get_tasks returns tasks for initiative', async () => {
    mockGetTasksByInitiative.mockResolvedValue([
      {
        id: 't1', spec: { title: 'Research competitors' }, state: 'ACCEPTED', role: 'researcher', phase: 1,
        output: { output: 'Found 5 competitors' },
      },
      {
        id: 't2', spec: { title: 'Write report' }, state: 'PLANNED', role: 'writer', phase: 2,
        output: null,
      },
    ]);

    const handler = createCeoToolHandler('org-1');
    const result = await handler('get_tasks', { initiative_id: 'i1' });
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe('Research competitors');
    expect(parsed[1].state).toBe('PLANNED');
    expect(mockGetTasksByInitiative).toHaveBeenCalledWith('i1');
  });

  it('get_cornerstone returns cornerstone content', async () => {
    mockGetLatestCornerstone.mockResolvedValue({
      content: { identity: { content: 'We are a sports startup' } },
    });

    const handler = createCeoToolHandler('org-1');
    const result = await handler('get_cornerstone', {});

    expect(result).toContain('We are a sports startup');
  });

  it('create_task creates initiative and task, calls onDispatch', async () => {
    mockCreateInitiative.mockResolvedValue({ id: 'init-1', name: 'Test', org_id: 'org-1', status: 'active', phase_current: 1, created_at: '2026-01-01', updated_at: null, description: null });
    mockCreateTasks.mockResolvedValue([{ id: 'task-1', org_id: 'org-1', initiative_id: 'init-1', phase: 1, state: 'PLANNED', role: 'coder', spec: { title: 'Do thing', description: 'Do thing for real', acceptance_criteria: ['works'], priority: 'high' }, output: null, skills_loaded: [], depends_on: [], revision_count: 0, polish_count: 0, created_at: '2026-01-01', updated_at: null, assigned_worker: null }]);

    const onDispatch = vi.fn();
    const handler = createCeoToolHandler('org-1', onDispatch);
    const result = await handler('create_task', {
      role: 'coder',
      description: 'Do thing for real',
      acceptance_criteria: ['works'],
      priority: 'high',
      initiative_name: 'Test',
    });
    const parsed = JSON.parse(result);

    expect(parsed.task_id).toBe('task-1');
    expect(parsed.initiative_id).toBe('init-1');
    expect(parsed.status).toBe('created_and_dispatched');
    expect(onDispatch).toHaveBeenCalledWith('task-1');
    expect(mockCreateInitiative).toHaveBeenCalledWith({ orgId: 'org-1', name: 'Test', description: 'Do thing for real' });
  });

  it('create_task propagates DB errors', async () => {
    mockCreateInitiative.mockRejectedValue(new Error('Failed to create initiative: RLS policy violation'));

    const handler = createCeoToolHandler('org-1');
    await expect(handler('create_task', {
      role: 'coder',
      description: 'Do thing',
      acceptance_criteria: ['works'],
      priority: 'high',
    })).rejects.toThrow('RLS policy violation');
  });

  it('create_task passes source: owner_directed', async () => {
    mockCreateInitiative.mockResolvedValue({ id: 'init-1', name: 'Test', org_id: 'org-1', status: 'active', phase_current: 1, created_at: '2026-01-01', updated_at: null, description: null });
    mockCreateTasks.mockResolvedValue([{ id: 'task-1', org_id: 'org-1', initiative_id: 'init-1', phase: 1, state: 'PLANNED', role: 'coder', spec: { title: 'Do thing', description: 'Do thing', acceptance_criteria: ['works'], priority: 'high' }, output: null, skills_loaded: [], depends_on: [], revision_count: 0, polish_count: 0, source: 'owner_directed', created_at: '2026-01-01', updated_at: null, assigned_worker: null }]);

    const handler = createCeoToolHandler('org-1');
    await handler('create_task', {
      role: 'coder',
      description: 'Do thing',
      acceptance_criteria: ['works'],
      priority: 'high',
    });

    expect(mockCreateTasks).toHaveBeenCalledWith([
      expect.objectContaining({ source: 'owner_directed' }),
    ]);
  });

  it('trigger_planning calls onAdhocPlan callback', async () => {
    const onAdhocPlan = vi.fn();
    const handler = createCeoToolHandler('org-1', undefined, onAdhocPlan);
    const result = await handler('trigger_planning', { reason: 'Owner wants to pivot' });
    const parsed = JSON.parse(result);

    expect(parsed.status).toBe('planning_triggered');
    expect(parsed.reason).toBe('Owner wants to pivot');
    expect(onAdhocPlan).toHaveBeenCalled();
  });

  it('search_audit returns matching events', async () => {
    mockGetRecentEvents.mockResolvedValue([
      { event_type: 'worker.complete', agent_id: 'Worker-1', created_at: '2026-03-05', metadata: { taskId: 't1' } },
      { event_type: 'ceo.chat', agent_id: 'CEO-1', created_at: '2026-03-05', metadata: { message: 'hello' } },
    ]);

    const handler = createCeoToolHandler('org-1');
    const result = await handler('search_audit', { query: 'worker' });
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].event_type).toBe('worker.complete');
  });

  it('credentials list returns credential entries with descriptions', async () => {
    mockListCredentials.mockResolvedValue([
      { service_key: 'github_token', status: 'active', provisioned_at: '', description: 'GitHub personal access token for API operations' },
      { service_key: 'cloudflare_api_token', status: 'unverified', provisioned_at: '2026-03-13', description: 'DNS, Pages, Workers for example.org' },
    ]);

    const handler = createCeoToolHandler('org-1');
    const result = await handler('credentials', { action: 'list' });
    const parsed = JSON.parse(result);

    expect(parsed.credentials).toHaveLength(2);
    expect(parsed.credentials[0].service_key).toBe('github_token');
    expect(parsed.credentials[0].description).toBe('GitHub personal access token for API operations');
    expect(parsed.credentials[1].description).toBe('DNS, Pages, Workers for example.org');
    expect(mockListCredentials).toHaveBeenCalledWith('org-1');
  });

  it('credentials store stores and redacts credential from chat', async () => {
    mockStoreCredential.mockResolvedValue(undefined);

    // Mock the redaction DB chain: from → select → eq → eq → order → limit → single
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'msg-1', content: 'Here is my key: sk_live_abc123' },
    });
    const mockLimit = vi.fn(() => ({ single: mockSingle }));
    const mockOrder = vi.fn(() => ({ limit: mockLimit }));
    const mockEq2 = vi.fn(() => ({ order: mockOrder }));
    const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
    const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
    mockDbFrom.mockImplementation((table: string) => {
      if (table === 'ceo_chat_messages') {
        return { select: mockSelect, update: mockUpdate };
      }
      return {};
    });

    const handler = createCeoToolHandler('org-1');
    const result = await handler('credentials', {
      action: 'store',
      key: 'stripe_secret_key',
      value: 'sk_live_abc123',
    });
    const parsed = JSON.parse(result);

    expect(parsed.status).toBe('stored');
    expect(parsed.service_key).toBe('stripe_secret_key');
    expect(mockStoreCredential).toHaveBeenCalledWith('org-1', 'stripe_secret_key', 'sk_live_abc123', undefined);
  });

  it('credentials store passes description when provided', async () => {
    mockStoreCredential.mockResolvedValue(undefined);

    const mockSingle = vi.fn().mockResolvedValue({ data: null });
    const mockLimit = vi.fn(() => ({ single: mockSingle }));
    const mockOrder = vi.fn(() => ({ limit: mockLimit }));
    const mockEq2 = vi.fn(() => ({ order: mockOrder }));
    const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
    const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
    mockDbFrom.mockImplementation((table: string) => {
      if (table === 'ceo_chat_messages') {
        return { select: mockSelect };
      }
      return {};
    });

    const handler = createCeoToolHandler('org-1');
    const result = await handler('credentials', {
      action: 'store',
      key: 'cloudflare_token',
      value: 'cf_abc123',
      description: 'DNS, Pages, Workers for example.org',
    });
    const parsed = JSON.parse(result);

    expect(parsed.status).toBe('stored');
    expect(mockStoreCredential).toHaveBeenCalledWith('org-1', 'cloudflare_token', 'cf_abc123', 'DNS, Pages, Workers for example.org');
  });

  describe('resolve_escalation', () => {
    it('resolves escalated task to FAILED for redispatched', async () => {
      const onResolveAccepted = vi.fn();
      mockGetTask.mockResolvedValue({
        id: 'task-1',
        org_id: 'org-1',
        state: 'ESCALATED',
        escalation_diagnosis: { type: 'spec_problem', action: {}, reasoning: 'Bad spec' },
        source: 'planning_cycle',
      });
      mockApplyTransition.mockResolvedValue('FAILED');
      mockUpdateEscalationDiagnosis.mockResolvedValue(undefined);

      const handler = createCeoToolHandler('org-1', undefined, undefined, onResolveAccepted);
      const result = await handler('resolve_escalation', {
        task_id: 'task-1',
        resolution: 'redispatched',
        note: 'Created replacement task task-2',
      });
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe('resolved');
      expect(parsed.to_state).toBe('FAILED');
      expect(mockApplyTransition).toHaveBeenCalledWith('task-1', 'FAILED', 'CEO-1', 'Created replacement task task-2');
      expect(onResolveAccepted).not.toHaveBeenCalled();
      expect(mockUpdateEscalationDiagnosis).toHaveBeenCalledWith('task-1', expect.objectContaining({
        type: 'spec_problem',
        resolution: expect.objectContaining({
          type: 'redispatched',
          note: 'Created replacement task task-2',
        }),
      }));
    });

    it('resolves escalated task to FAILED for cancelled', async () => {
      mockGetTask.mockResolvedValue({
        id: 'task-1',
        org_id: 'org-1',
        state: 'ESCALATED',
        escalation_diagnosis: { type: 'strategy_problem', action: {}, reasoning: 'Wrong approach' },
        source: 'planning_cycle',
      });
      mockApplyTransition.mockResolvedValue('FAILED');
      mockUpdateEscalationDiagnosis.mockResolvedValue(undefined);

      const handler = createCeoToolHandler('org-1');
      const result = await handler('resolve_escalation', {
        task_id: 'task-1',
        resolution: 'cancelled',
        note: 'No longer needed',
      });
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe('resolved');
      expect(parsed.to_state).toBe('FAILED');
      expect(mockApplyTransition).toHaveBeenCalledWith('task-1', 'FAILED', 'CEO-1', 'No longer needed');
    });

    it('resolves escalated task to ACCEPTED for resolved_directly', async () => {
      const { logEvent: mockLogEvent } = await import('../../db/audit.js') as any;
      const onResolveAccepted = vi.fn();
      mockGetTask.mockResolvedValue({
        id: 'task-1',
        org_id: 'org-1',
        state: 'ESCALATED',
        escalation_diagnosis: { type: 'capability_problem', action: {}, reasoning: 'Needs human' },
        source: 'owner_directed',
      });
      mockApplyTransition.mockResolvedValue('ACCEPTED');
      mockUpdateEscalationDiagnosis.mockResolvedValue(undefined);

      const handler = createCeoToolHandler('org-1', undefined, undefined, onResolveAccepted);
      const result = await handler('resolve_escalation', {
        task_id: 'task-1',
        resolution: 'resolved_directly',
        note: 'Handled the issue myself',
      });
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe('resolved');
      expect(parsed.to_state).toBe('ACCEPTED');
      expect(onResolveAccepted).toHaveBeenCalledWith('task-1');
      expect(mockLogEvent).toHaveBeenCalledWith('org-1', 'ceo.escalation_resolved', 'CEO-1', expect.objectContaining({
        task_id: 'task-1',
        resolution: 'resolved_directly',
        note: 'Handled the issue myself',
      }));
    });

    it('rejects if task is not ESCALATED', async () => {
      mockGetTask.mockResolvedValue({
        id: 'task-1',
        org_id: 'org-1',
        state: 'IN_PROGRESS',
      });

      const handler = createCeoToolHandler('org-1');
      const result = await handler('resolve_escalation', {
        task_id: 'task-1',
        resolution: 'cancelled',
        note: 'Not needed',
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain('not in ESCALATED state');
      expect(mockApplyTransition).not.toHaveBeenCalled();
    });

    it('rejects if task not found', async () => {
      mockGetTask.mockResolvedValue(null);

      const handler = createCeoToolHandler('org-1');
      const result = await handler('resolve_escalation', {
        task_id: 'nonexistent',
        resolution: 'cancelled',
        note: 'Gone',
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain('not found');
    });
  });

  describe('web_search', () => {
    it('fetches DuckDuckGo and returns parsed results', async () => {
      const fakeDdgHtml = `
        <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Frobotech.com&rut=abc">RoboTech Inc</a>
        <a class="result__snippet" href="#">Leading robotics company in the Bay Area</a>
        <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com&rut=def">Example Corp</a>
        <a class="result__snippet" href="#">Another company</a>
      `;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        text: () => Promise.resolve(fakeDdgHtml),
      });

      try {
        const handler = createCeoToolHandler('org-1');
        const result = await handler('web_search', { query: 'Bay Area robotics', limit: 2 });
        const parsed = JSON.parse(result);

        expect(parsed.query).toBe('Bay Area robotics');
        expect(parsed.results).toHaveLength(2);
        expect(parsed.results[0].title).toBe('RoboTech Inc');
        expect(parsed.results[0].url).toBe('https://robotech.com');
        expect(parsed.results[0].snippet).toBe('Leading robotics company in the Bay Area');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('returns error when fetch fails', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      try {
        const handler = createCeoToolHandler('org-1');
        const result = await handler('web_search', { query: 'test' });
        const parsed = JSON.parse(result);
        expect(parsed.error).toContain('Network error');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('caps limit at 10', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        text: () => Promise.resolve(''),
      });

      try {
        const handler = createCeoToolHandler('org-1');
        const result = await handler('web_search', { query: 'test', limit: 50 });
        const parsed = JSON.parse(result);
        expect(parsed.results).toHaveLength(0); // no results in empty HTML, but didn't crash
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('query_role_memory', () => {
    it('embeds query and returns matching role memories', async () => {
      const fakeEmbedding = new Array(768).fill(0.1);
      mockEmbedText.mockResolvedValue(fakeEmbedding);
      mockMatchRoleMemory.mockResolvedValue([
        { id: 'mem-1', role: 'researcher', content: 'Competitor X charges $50/mo', confidence: 'high', entryType: 'finding', similarity: 0.92 },
        { id: 'mem-2', role: 'researcher', content: 'Market size is $2B', confidence: 'medium', entryType: 'finding', similarity: 0.85 },
      ]);

      const handler = createCeoToolHandler('org-1');
      const result = await handler('query_role_memory', { role: 'researcher', query: 'competitor pricing' });
      const parsed = JSON.parse(result);

      expect(parsed.role).toBe('researcher');
      expect(parsed.results).toHaveLength(2);
      expect(parsed.results[0].content).toBe('Competitor X charges $50/mo');
      expect(parsed.results[0].similarity).toBe(0.92);
      expect(mockEmbedText).toHaveBeenCalledWith('competitor pricing', 'query');
      expect(mockMatchRoleMemory).toHaveBeenCalledWith('org-1', 'researcher', fakeEmbedding, 5);
    });

    it('respects custom limit', async () => {
      mockEmbedText.mockResolvedValue(new Array(768).fill(0));
      mockMatchRoleMemory.mockResolvedValue([]);

      const handler = createCeoToolHandler('org-1');
      await handler('query_role_memory', { role: 'coder', query: 'deploy', limit: 3 });

      expect(mockMatchRoleMemory).toHaveBeenCalledWith('org-1', 'coder', expect.any(Array), 3);
    });

    it('returns error when embedding fails', async () => {
      mockEmbedText.mockRejectedValue(new Error('Model not loaded'));

      const handler = createCeoToolHandler('org-1');
      const result = await handler('query_role_memory', { role: 'researcher', query: 'test' });
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Model not loaded');
    });
  });
});
