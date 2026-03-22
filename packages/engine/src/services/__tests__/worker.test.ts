import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task, WorkerOutput } from '@precept/shared';

const { mockInvokeAgent } = vi.hoisted(() => ({
  mockInvokeAgent: vi.fn(),
}));

vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: mockInvokeAgent,
}));

const { mockUpdateTaskOutput, mockUpdateTaskSkillsLoaded } = vi.hoisted(() => ({
  mockUpdateTaskOutput: vi.fn(),
  mockUpdateTaskSkillsLoaded: vi.fn(),
}));

vi.mock('../../db/tasks.js', () => ({
  updateTaskOutput: mockUpdateTaskOutput,
  updateTaskSkillsLoaded: mockUpdateTaskSkillsLoaded,
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
}));

vi.mock('../../db/skill-events.js', () => ({
  logSkillEvent: vi.fn(),
}));

const { mockGetSkillByName, mockGetSkillIndexForWorker } = vi.hoisted(() => ({
  mockGetSkillByName: vi.fn(),
  mockGetSkillIndexForWorker: vi.fn(),
}));

vi.mock('../../db/skills.js', () => ({
  getSkillByName: mockGetSkillByName,
  getSkillIndexForWorker: mockGetSkillIndexForWorker,
}));

const { mockGetAllOrgCredentials } = vi.hoisted(() => ({
  mockGetAllOrgCredentials: vi.fn(),
}));

vi.mock('../../db/credentials.js', () => ({
  getAllOrgCredentials: mockGetAllOrgCredentials,
}));

vi.mock('../../lib/credentials.js', () => ({
  resolveCredentials: vi.fn().mockResolvedValue({
    resendApiKey: undefined,
    emailDomain: undefined,
    ownerEmail: undefined,
    githubToken: undefined,
    githubOrg: undefined,
    githubRepoUrl: undefined,
    linearApiKey: undefined,
    linearTeamId: undefined,
  }),
}));

vi.mock('../../config/role-registry.js', () => ({
  roleRegistry: {
    getModel: vi.fn().mockResolvedValue('sonnet'),
    getEndpoint: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../tools/workspace.js', () => ({
  getOrCreateTaskWorkspace: vi.fn().mockResolvedValue({
    taskId: 'task-1',
    rootDir: '/tmp/precept/tasks/task-1',
    workspaceDir: '/tmp/precept/tasks/task-1/workspace',
    outputDir: '/tmp/precept/tasks/task-1/output',
  }),
  cleanupTaskWorkspace: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../tools/bash-execute.js', () => ({
  executeBash: vi.fn().mockResolvedValue('script output'),
}));

vi.mock('../../lib/embeddings.js', () => ({
  embedText: vi.fn().mockResolvedValue(new Array(768).fill(0)),
}));

vi.mock('../../db/role-memory.js', () => ({
  matchRoleMemory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/role-summaries.js', () => ({
  getRoleSummary: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../db/agent-profiles.js', () => ({
  getProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../db/team-bulletin.js', () => ({
  getRecentBulletin: vi.fn().mockResolvedValue([]),
}));

import { WorkerService } from '../worker.js';

const VALID_OUTPUT: WorkerOutput = {
  output: 'IMU sensor pin diagram documented with SPI interface details.',
  key_findings: ['SPI interface at 4MHz', 'Requires 3.3V regulator'],
  confidence: 'high',
  flag: null,
  notes: null,
  field_signals: [],
};

function makeTask(overrides?: Partial<Task>): Task {
  return {
    id: 'task-1',
    org_id: 'org-1',
    plan_id: 'plan-1',
    initiative_id: 'init-1',
    phase: 1,
    state: 'IN_PROGRESS',
    role: 'researcher',
    assigned_worker: 'Worker-researcher-1',
    spec: {
      title: 'Research IMU sensor hardware',
      description: 'Research IMU sensor hardware',
      acceptance_criteria: ['Pin diagram documented'],
      priority: 'high',
    },
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

describe('WorkerService', () => {
  let worker: WorkerService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSkillByName.mockResolvedValue(null);
    mockGetSkillIndexForWorker.mockResolvedValue([]);
    mockGetAllOrgCredentials.mockResolvedValue({});
    worker = new WorkerService();
  });

  it('calls invokeAgent with sonnet and jsonMode', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: VALID_OUTPUT,
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    await worker.execute(makeTask());

    expect(mockInvokeAgent).toHaveBeenCalledWith(
      'Worker-researcher-1',
      expect.objectContaining({
        model: 'sonnet',
        jsonMode: true,
        temperature: 0.5,
      }),
    );
  });

  it('returns parsed WorkerOutput', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: VALID_OUTPUT,
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    const result = await worker.execute(makeTask());

    expect(result.output).toBe(VALID_OUTPUT.output);
    expect(result.confidence).toBe('high');
    expect(result.key_findings).toEqual(['SPI interface at 4MHz', 'Requires 3.3V regulator']);
  });

  it('stores output in task via updateTaskOutput', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: VALID_OUTPUT,
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    await worker.execute(makeTask());

    expect(mockUpdateTaskOutput).toHaveBeenCalledWith('task-1', VALID_OUTPUT);
  });

  it('returns output with flag when worker flags something', async () => {
    const flaggedOutput: WorkerOutput = {
      ...VALID_OUTPUT,
      flag: 'Sensor requires import license — may delay timeline',
    };

    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: flaggedOutput,
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    const result = await worker.execute(makeTask());

    expect(result.flag).toBe('Sensor requires import license — may delay timeline');
  });

  it('falls back to largest string field when output field is missing', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: { result: 'Detailed analysis of the sensor hardware' },
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    const result = await worker.execute(makeTask());

    expect(result.output).toBe('Detailed analysis of the sensor hardware');
    expect(result.confidence).toBe('low');
  });

  it('falls back to raw content when JSON parsing fails', async () => {
    const rawContent = 'Here is a detailed analysis of the sensor hardware with SPI interface specifications and pin diagrams.';
    mockInvokeAgent.mockResolvedValue({
      content: rawContent,
      parsed: undefined,
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    const result = await worker.execute(makeTask());

    expect(result.output).toBe(rawContent);
    expect(result.confidence).toBe('low');
    expect(result.notes).toContain('raw LLM response');
  });

  it('throws when no fallback content is available', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '',
      parsed: { count: 42 },
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    await expect(worker.execute(makeTask())).rejects.toThrow('missing output field');
  });

  it('always provisions load_skill and bash_execute tools', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: VALID_OUTPUT,
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    await worker.execute(makeTask());

    const callArgs = mockInvokeAgent.mock.calls[0][1];
    const toolNames = callArgs.tools.map((t: any) => t.function.name);
    expect(toolNames).toContain('load_skill');
    expect(toolNames).toContain('bash_execute');
  });

  it('includes skill index in system prompt', async () => {
    mockGetSkillIndexForWorker.mockResolvedValue([
      { name: 'web-research', description: 'Search the web for information' },
    ]);
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: VALID_OUTPUT,
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    await worker.execute(makeTask());

    const callArgs = mockInvokeAgent.mock.calls[0][1];
    expect(callArgs.systemPrompt).toContain('web-research');
    expect(callArgs.systemPrompt).toContain('Search the web for information');
    expect(callArgs.systemPrompt).toContain('load_skill');
  });

  it('fetches skill index for the worker role', async () => {
    mockInvokeAgent.mockResolvedValue({
      content: '{}',
      parsed: VALID_OUTPUT,
      usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
      model: 'test-sonnet',
      durationMs: 1000,
    });

    await worker.execute(makeTask());

    expect(mockGetSkillIndexForWorker).toHaveBeenCalledWith('org-1', 'researcher');
  });

  describe('rework', () => {
    it('invokes agent with rework context from reviewer', async () => {
      mockInvokeAgent.mockResolvedValue({
        content: '{}',
        parsed: VALID_OUTPUT,
        usage: { promptTokens: 400, completionTokens: 200, totalTokens: 600 },
        model: 'test-sonnet',
        durationMs: 1500,
      });

      const task = makeTask({ output: { ...VALID_OUTPUT, output: 'Original work' } });
      await worker.rework(task, 'Needs more detail on pin layout', 'reviewer');

      expect(mockInvokeAgent).toHaveBeenCalledWith(
        'Worker-researcher-1',
        expect.objectContaining({
          model: 'sonnet',
          jsonMode: true,
        }),
      );

      // Verify rework message includes feedback
      const callArgs = mockInvokeAgent.mock.calls[0][1];
      expect(callArgs.messages[0].content).toContain('Rework Required');
      expect(callArgs.messages[0].content).toContain('Needs more detail on pin layout');
      expect(callArgs.messages[0].content).toContain('Original work');
    });

    it('stores revised output via updateTaskOutput', async () => {
      const revisedOutput: WorkerOutput = { ...VALID_OUTPUT, output: 'Revised work product' };
      mockInvokeAgent.mockResolvedValue({
        content: '{}',
        parsed: revisedOutput,
        usage: { promptTokens: 400, completionTokens: 200, totalTokens: 600 },
        model: 'test-sonnet',
        durationMs: 1500,
      });

      const task = makeTask();
      await worker.rework(task, 'Fix the analysis', 'judge');

      expect(mockUpdateTaskOutput).toHaveBeenCalledWith('task-1', revisedOutput);
    });
  });

  describe('credential resolution', () => {
    it('injects all org_credentials into worker env via toolHandler', async () => {
      mockGetAllOrgCredentials.mockResolvedValue({
        github_app: 'ghs_abc123',
        cloudflare_api_token: 'cf_test_123',
      });

      let capturedCredentials: Record<string, string> | undefined;
      mockInvokeAgent.mockImplementation(async (_agentId: string, opts: any) => {
        // Simulate the AI calling bash_execute to capture what credentials are passed
        const { executeBash: mockExecBash } = await import('../../tools/bash-execute.js');
        await opts.toolHandler!('bash_execute', { command: 'echo test' });
        // Grab the credentials arg from the executeBash call
        capturedCredentials = (mockExecBash as any).mock.calls[0]?.[0]?.credentials;

        return {
          content: '{}',
          parsed: VALID_OUTPUT,
          usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
          model: 'test-sonnet',
          durationMs: 1000,
        };
      });

      await worker.execute(makeTask());

      expect(capturedCredentials).toEqual({
        github_app: 'ghs_abc123',
        cloudflare_api_token: 'cf_test_123',
      });
    });

  });

  describe('handleLoadSkill', () => {
    it('returns skill content from database', async () => {
      mockGetSkillByName.mockResolvedValue({
        id: 'skill-1',
        name: 'web-research',
        description: 'Search the web',
        scope: 'org_wide',
        role: null,
        status: 'active',
        triggerTags: ['research'],
        filePath: null,
        content: '# Web Research\n\nSearch the web for information.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      mockInvokeAgent.mockImplementation(async (_agentId, opts) => {
        const result = await opts.toolHandler!('load_skill', { name: 'web-research' });
        expect(result).toBe('# Web Research\n\nSearch the web for information.');

        return {
          content: '{}',
          parsed: VALID_OUTPUT,
          usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
          model: 'test-sonnet',
          durationMs: 1000,
        };
      });

      await worker.execute(makeTask());
      expect(mockGetSkillByName).toHaveBeenCalledWith('org-1', 'web-research');
    });

    it('returns "Skill not found." when content is null', async () => {
      mockGetSkillByName.mockResolvedValue({
        id: 'skill-1',
        name: 'broken-skill',
        description: '',
        scope: 'org_wide',
        role: null,
        status: 'active',
        triggerTags: [],
        filePath: 'skills/org-wide/broken.md',
        content: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      mockInvokeAgent.mockImplementation(async (_agentId, opts) => {
        const result = await opts.toolHandler!('load_skill', { name: 'broken-skill' });
        expect(result).toBe('Skill not found.');

        return {
          content: '{}',
          parsed: VALID_OUTPUT,
          usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
          model: 'test-sonnet',
          durationMs: 1000,
        };
      });

      await worker.execute(makeTask());
    });

    it('returns "Skill not found." when skill does not exist', async () => {
      mockGetSkillByName.mockResolvedValue(null);

      mockInvokeAgent.mockImplementation(async (_agentId, opts) => {
        const result = await opts.toolHandler!('load_skill', { name: 'nonexistent' });
        expect(result).toBe('Skill not found.');

        return {
          content: '{}',
          parsed: VALID_OUTPUT,
          usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 },
          model: 'test-sonnet',
          durationMs: 1000,
        };
      });

      await worker.execute(makeTask());
    });
  });
});
