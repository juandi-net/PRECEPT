import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInvokeAgent } = vi.hoisted(() => ({
  mockInvokeAgent: vi.fn(),
}));

vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: mockInvokeAgent,
}));

vi.mock('../../db/audit.js', () => ({
  getRecentEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/initiatives.js', () => ({
  getActiveInitiatives: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/decisions.js', () => ({
  getRecentLessons: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/tasks.js', () => ({
  getTasksByInitiative: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/messages.js', () => ({
  logMessage: vi.fn(),
}));

vi.mock('../../config/role-registry.js', () => ({
  roleRegistry: {
    getModel: vi.fn().mockResolvedValue('sonnet'),
    getEndpoint: vi.fn().mockResolvedValue(null),
  },
}));

import { ScribeService } from '../scribe.js';
import { getRecentEvents } from '../../db/audit.js';
import { getActiveInitiatives } from '../../db/initiatives.js';
import { getRecentLessons } from '../../db/decisions.js';
import { getTasksByInitiative } from '../../db/tasks.js';

describe('ScribeService', () => {
  let scribe: ScribeService;

  beforeEach(() => {
    vi.clearAllMocks();
    scribe = new ScribeService();
  });

  it('compressContext calls invokeAgent with sonnet and jsonMode', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: {
        summary: 'No significant activity this cycle.',
        initiative_states: [],
        exceptions: [],
        patterns: [],
        skill_changes: [],
      },
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'test-sonnet',
      durationMs: 500,
    });

    const result = await scribe.compressContext('org-1');

    expect(mockInvokeAgent).toHaveBeenCalledWith(
      'Scribe-1',
      expect.objectContaining({
        model: 'sonnet',
        jsonMode: true,
        temperature: 0.3,
      }),
    );
    expect(result.from_role).toBe('scribe');
    expect(result.message_type).toBe('context_package');
    expect(result.org_id).toBe('org-1');
  });

  it('reads audit events, initiatives, and lessons for context', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: {
        summary: 'Activity detected.',
        initiative_states: [],
        exceptions: [],
        patterns: [],
        skill_changes: [],
      },
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'test-sonnet',
      durationMs: 500,
    });

    await scribe.compressContext('org-1');

    expect(getRecentEvents).toHaveBeenCalledWith('org-1', expect.any(Number));
    expect(getActiveInitiatives).toHaveBeenCalledWith('org-1');
    expect(getRecentLessons).toHaveBeenCalledWith('org-1', expect.any(Number));
  });

  it('includes task health summary per initiative in scribe message', async () => {
    const mockInitiatives = [
      { id: 'init-1', org_id: 'org-1', name: 'Legal Cleanup', description: null, github_repo_url: null, status: 'active' as const, phase_current: 1, created_at: '', updated_at: null },
    ];
    vi.mocked(getActiveInitiatives).mockResolvedValueOnce(mockInitiatives);
    vi.mocked(getTasksByInitiative).mockResolvedValueOnce([
      { id: 't1', org_id: 'org-1', plan_id: null, initiative_id: 'init-1', phase: 1, state: 'FAILED', role: 'researcher', assigned_worker: null, spec: { title: 'T1', description: '', acceptance_criteria: [], priority: 'high' }, output: null, skills_loaded: [], depends_on: [], revision_count: 0, polish_count: 0, source: 'planning_cycle', created_at: '', updated_at: null, linear_issue_id: null, escalation_diagnosis: null, owner_read_at: null },
      { id: 't2', org_id: 'org-1', plan_id: null, initiative_id: 'init-1', phase: 1, state: 'FAILED', role: 'researcher', assigned_worker: null, spec: { title: 'T2', description: '', acceptance_criteria: [], priority: 'high' }, output: null, skills_loaded: [], depends_on: [], revision_count: 0, polish_count: 0, source: 'planning_cycle', created_at: '', updated_at: null, linear_issue_id: null, escalation_diagnosis: null, owner_read_at: null },
      { id: 't3', org_id: 'org-1', plan_id: null, initiative_id: 'init-1', phase: 1, state: 'ACCEPTED', role: 'writer', assigned_worker: null, spec: { title: 'T3', description: '', acceptance_criteria: [], priority: 'medium' }, output: null, skills_loaded: [], depends_on: [], revision_count: 0, polish_count: 0, source: 'planning_cycle', created_at: '', updated_at: null, linear_issue_id: null, escalation_diagnosis: null, owner_read_at: null },
    ]);

    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: { summary: 'test', initiative_states: [], exceptions: [], patterns: [], skill_changes: [] },
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'test-sonnet',
      durationMs: 500,
    });

    await scribe.compressContext('org-1');

    const userMessage = mockInvokeAgent.mock.calls[0][1].messages[0].content as string;
    expect(userMessage).toContain('Legal Cleanup');
    expect(userMessage).toContain('2 FAILED');
    expect(userMessage).toContain('1 ACCEPTED');
  });

  it('returns InternalMessage with context_package payload', async () => {
    const payload = {
      summary: 'Test Org completed research.',
      initiative_states: [{ name: 'Sensor PoC', status: 'active', progress: '30%' }],
      exceptions: [],
      patterns: ['Research tasks trending high acceptance'],
      skill_changes: [],
    };

    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: payload,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'test-sonnet',
      durationMs: 500,
    });

    const result = await scribe.compressContext('org-1');

    expect(result.payload).toEqual(payload);
    expect(result.to_role).toBe('ceo');
  });
});
