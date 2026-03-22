import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/role-memory.js', () => ({
  getActiveRoleMemoryEntries: vi.fn(),
  storeRoleMemory: vi.fn(),
  matchRoleMemory: vi.fn(),
  deduplicateRoleMemory: vi.fn(),
  flagStaleRoleMemory: vi.fn(),
}));
vi.mock('../../db/role-summaries.js', () => ({
  getRoleSummary: vi.fn(),
  upsertRoleSummary: vi.fn(),
}));
vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: vi.fn(),
}));
vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
  getRecentEvents: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../config/role-registry.js', () => ({
  roleRegistry: {
    getAll: vi.fn(),
    get: vi.fn(),
    getModel: vi.fn().mockResolvedValue('sonnet'),
    getEndpoint: vi.fn().mockResolvedValue(null),
  },
}));
vi.mock('../../db/skills.js', () => ({
  upsertSkill: vi.fn(),
  getAllActiveSkillNames: vi.fn().mockResolvedValue([]),
  getSkillByName: vi.fn(),
  getSkillIndexForWorker: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../db/decisions.js', () => ({
  getRecentLessons: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../db/skill-events.js', () => ({
  logSkillEvent: vi.fn(),
}));
vi.mock('../../ai/validate.js', () => ({
  invokeAndValidate: vi.fn(),
}));

import { CuratorService } from '../curator.js';
import { getActiveRoleMemoryEntries } from '../../db/role-memory.js';
import { upsertRoleSummary } from '../../db/role-summaries.js';
import { invokeAgent } from '../../ai/invoke.js';
import { roleRegistry } from '../../config/role-registry.js';

describe('CuratorService.generateRoleSummaries', () => {
  const orgId = 'org-1';
  let curator: CuratorService;

  beforeEach(() => {
    vi.clearAllMocks();
    curator = new CuratorService();
  });

  it('skips roles with no memory entries', async () => {
    vi.mocked(roleRegistry.getAll).mockResolvedValue([
      { role: 'researcher', tier: 'execution' } as any,
    ]);
    vi.mocked(getActiveRoleMemoryEntries).mockResolvedValue([]);

    const count = await curator.generateRoleSummaries(orgId);

    expect(count).toBe(0);
    expect(upsertRoleSummary).not.toHaveBeenCalled();
  });

  it('generates and upserts summary for roles with entries', async () => {
    vi.mocked(roleRegistry.getAll).mockResolvedValue([
      { role: 'researcher', tier: 'execution' } as any,
    ]);
    vi.mocked(getActiveRoleMemoryEntries).mockResolvedValue([
      { content: 'finding 1', entryType: 'finding', confidence: 'high', created_at: '2026-01-01', last_retrieved_at: null },
    ]);
    vi.mocked(invokeAgent).mockResolvedValue({ content: 'Summary of researcher knowledge.', parsed: undefined, usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }, model: 'test-sonnet', durationMs: 500 });

    const count = await curator.generateRoleSummaries(orgId);

    expect(count).toBe(1);
    expect(invokeAgent).toHaveBeenCalledOnce();
    expect(upsertRoleSummary).toHaveBeenCalledWith(orgId, 'researcher', 'Summary of researcher knowledge.', expect.any(Number));
  });

  it('skips non-execution tier roles', async () => {
    vi.mocked(roleRegistry.getAll).mockResolvedValue([
      { role: 'ceo', tier: 'board' } as any,
    ]);

    const count = await curator.generateRoleSummaries(orgId);

    expect(count).toBe(0);
    expect(getActiveRoleMemoryEntries).not.toHaveBeenCalled();
  });
});
