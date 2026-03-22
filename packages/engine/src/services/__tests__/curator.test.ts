import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInvokeAndValidate } = vi.hoisted(() => ({
  mockInvokeAndValidate: vi.fn(),
}));

vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: vi.fn(),
}));

vi.mock('../../ai/validate.js', () => ({
  invokeAndValidate: mockInvokeAndValidate,
  SchemaValidationError: class SchemaValidationError extends Error {
    constructor(public readonly label: string, public readonly firstError: Error) {
      super(`${label}: validation failed. ${firstError.message}`);
      this.name = 'SchemaValidationError';
    }
  },
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
  getRecentEvents: vi.fn().mockResolvedValue([]),
}));

const { mockUpsertSkill, mockGetAllActiveSkillsWithContent } = vi.hoisted(() => ({
  mockUpsertSkill: vi.fn().mockResolvedValue({ id: 'skill-1', name: 'test-skill' }),
  mockGetAllActiveSkillsWithContent: vi.fn().mockResolvedValue([
    { name: 'communication-tone', content: '## When To Use\nWriting external comms.\n\n## Procedure\nUse warm, professional tone.' },
    { name: 'quality-baseline', content: '## When To Use\nAll tasks.\n\n## Procedure\nCheck acceptance criteria.' },
  ]),
}));

vi.mock('../../db/skills.js', () => ({
  upsertSkill: mockUpsertSkill,
  getAllActiveSkillsWithContent: mockGetAllActiveSkillsWithContent,
}));

vi.mock('../../db/decisions.js', () => ({
  getRecentLessons: vi.fn().mockResolvedValue([]),
}));

const { mockGetSkillPerformanceSummary } = vi.hoisted(() => ({
  mockGetSkillPerformanceSummary: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/skill-events.js', () => ({
  logSkillEvent: vi.fn(),
  getSkillPerformanceSummary: mockGetSkillPerformanceSummary,
}));

vi.mock('../../config/role-registry.js', () => ({
  roleRegistry: {
    getModel: vi.fn().mockResolvedValue('sonnet'),
    getEndpoint: vi.fn().mockResolvedValue(null),
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../db/role-memory.js', () => ({
  getActiveRoleMemoryEntries: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/role-summaries.js', () => ({
  upsertRoleSummary: vi.fn().mockResolvedValue(undefined),
}));

import { CuratorService } from '../curator.js';

describe('CuratorService', () => {
  let curator: CuratorService;

  beforeEach(() => {
    vi.clearAllMocks();
    curator = new CuratorService();
  });

  it('invokes Sonnet with curator prompt', async () => {
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: { actions: [], reasoning: 'No patterns detected.' },
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        model: 'test-sonnet',
        durationMs: 2000,
      },
      data: { actions: [], reasoning: 'No patterns detected.' },
    });

    await curator.extractSkills('org-1');

    expect(mockInvokeAndValidate).toHaveBeenCalledWith(
      'Curator-1',
      expect.objectContaining({
        model: 'sonnet',
        jsonMode: true,
      }),
      expect.anything(), // CuratorOutputSchema
      'curator output',
    );
  });

  it('processes new skill actions from Curator output', async () => {
    const data = {
      actions: [{
        type: 'create' as const,
        name: 'error-handling',
        scope: 'org_wide' as const,
        role: null,
        tags: ['quality', 'errors'],
        content: '# error-handling\n\n## Guidance\n\nAlways handle errors gracefully.',
      }],
      reasoning: 'Pattern observed: multiple workers failing to handle API errors.',
    };

    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: data,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'test-sonnet',
        durationMs: 2000,
      },
      data,
    });

    const result = await curator.extractSkills('org-1');

    expect(result.created).toBe(1);
    expect(result.refined).toBe(0);
    expect(result.deprecated).toBe(0);
  });

  it('propagates SchemaValidationError', async () => {
    const { SchemaValidationError } = await import('../../ai/validate.js');
    mockInvokeAndValidate.mockRejectedValue(
      new SchemaValidationError('curator output', new Error('missing reasoning') as any),
    );

    await expect(curator.extractSkills('org-1')).rejects.toThrow('curator output: validation failed');
  });

  it('passes content to upsertSkill without writing files', async () => {
    const skillContent = '# error-handling\n\n## Guidance\n\nAlways handle errors gracefully.';
    const data = {
      actions: [{
        type: 'create' as const,
        name: 'error-handling',
        scope: 'org_wide' as const,
        role: null,
        tags: ['quality', 'errors'],
        content: skillContent,
      }],
      reasoning: 'Pattern observed.',
    };

    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: data,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'test-sonnet',
        durationMs: 2000,
      },
      data,
    });

    await curator.extractSkills('org-1');

    expect(mockUpsertSkill).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org-1',
      name: 'error-handling',
      content: skillContent,
      scope: 'org_wide',
      status: 'active',
    }));
  });

  it('fetches skill performance and includes it in Curator message', async () => {
    mockGetSkillPerformanceSummary.mockResolvedValue([
      { skillName: 'cold-outreach', timesLoaded: 6, accepts: 2, rejects: 4 },
      { skillName: 'competitive-analysis', timesLoaded: 5, accepts: 5, rejects: 0 },
    ]);

    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: { actions: [], reasoning: 'cold-outreach needs work.' },
        usage: { promptTokens: 600, completionTokens: 200, totalTokens: 800 },
        model: 'test-sonnet',
        durationMs: 2000,
      },
      data: { actions: [], reasoning: 'cold-outreach needs work.' },
    });

    await curator.extractSkills('org-1');

    expect(mockGetSkillPerformanceSummary).toHaveBeenCalledWith('org-1');

    const userMessage = mockInvokeAndValidate.mock.calls[0][1].messages[0].content;
    expect(userMessage).toContain('## Skill Performance (last 7 days)');
    expect(userMessage).toContain('cold-outreach: loaded 6 times, 2 accepted, 4 rejected (33% acceptance)');
    expect(userMessage).toContain('competitive-analysis: loaded 5 times, 5 accepted, 0 rejected (100% acceptance)');
  });

  it('shows empty skill performance message when no data exists', async () => {
    mockGetSkillPerformanceSummary.mockResolvedValue([]);

    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: { actions: [], reasoning: 'No patterns.' },
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        model: 'test-sonnet',
        durationMs: 2000,
      },
      data: { actions: [], reasoning: 'No patterns.' },
    });

    await curator.extractSkills('org-1');

    const userMessage = mockInvokeAndValidate.mock.calls[0][1].messages[0].content;
    expect(userMessage).toContain('No skill usage data since last cycle.');
  });

  it('includes full skill content in Curator message for existing skills', async () => {
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: { actions: [], reasoning: 'Skills look solid.' },
        usage: { promptTokens: 800, completionTokens: 200, totalTokens: 1000 },
        model: 'test-sonnet',
        durationMs: 2000,
      },
      data: { actions: [], reasoning: 'Skills look solid.' },
    });

    await curator.extractSkills('org-1');

    const userMessage = mockInvokeAndValidate.mock.calls[0][1].messages[0].content;
    expect(userMessage).toContain('### communication-tone');
    expect(userMessage).toContain('Use warm, professional tone.');
    expect(userMessage).toContain('### quality-baseline');
    expect(userMessage).toContain('Check acceptance criteria.');
  });

  it('system prompt prioritizes failure signals', async () => {
    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: { actions: [], reasoning: 'No patterns.' },
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        model: 'test-sonnet',
        durationMs: 2000,
      },
      data: { actions: [], reasoning: 'No patterns.' },
    });

    await curator.extractSkills('org-1');

    const systemPrompt = mockInvokeAndValidate.mock.calls[0][1].systemPrompt;
    expect(systemPrompt).toContain('PRIORITY ORDER');
    expect(systemPrompt).toContain('Skill performance data');
    expect(systemPrompt).toContain('<50% acceptance rate');
  });

  it('deprecates skill without overwriting content', async () => {
    const data = {
      actions: [{
        type: 'deprecate' as const,
        name: 'old-skill',
        scope: 'org_wide' as const,
        role: null,
        tags: ['legacy'],
      }],
      reasoning: 'Skill no longer relevant.',
    };

    mockInvokeAndValidate.mockResolvedValue({
      response: {
        content: '{}',
        parsed: data,
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        model: 'test-sonnet',
        durationMs: 1500,
      },
      data,
    });

    await curator.extractSkills('org-1');

    expect(mockUpsertSkill).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org-1',
      name: 'old-skill',
      status: 'deprecated',
    }));
    // content should NOT be in the call (undefined = preserve existing)
    const call = mockUpsertSkill.mock.calls[0][0];
    expect(call).not.toHaveProperty('content');
  });
});
