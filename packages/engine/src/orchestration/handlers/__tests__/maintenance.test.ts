import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../db/role-memory.js', () => ({
  deduplicateRoleMemory: vi.fn(),
  flagStaleRoleMemory: vi.fn(),
}));
vi.mock('../../../db/tasks.js', () => ({
  getTasksByState: vi.fn().mockResolvedValue([]),
  getTasksByStates: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../db/audit.js', () => ({
  logEvent: vi.fn(),
}));
vi.mock('../../state-machine.js', () => ({
  applyTransition: vi.fn(),
}));

import { MaintenanceHandlers } from '../maintenance.js';
import { deduplicateRoleMemory, flagStaleRoleMemory } from '../../../db/role-memory.js';

describe('MaintenanceHandlers.handleMemoryCleanup', () => {
  let handler: MaintenanceHandlers;
  const mockCtx = {
    push: vi.fn(),
    runWorker: vi.fn(),
    dispatchReadyTasks: vi.fn(),
    cleanupWorkspaceIfNeeded: vi.fn(),
  };
  const mockCurator = { extractSkills: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new MaintenanceHandlers(mockCtx as any, mockCurator as any);
  });

  it('runs dedup then staleness flag', async () => {
    vi.mocked(deduplicateRoleMemory).mockResolvedValue(5);
    vi.mocked(flagStaleRoleMemory).mockResolvedValue(2);

    await handler.handleMemoryCleanup('org-1');

    expect(deduplicateRoleMemory).toHaveBeenCalledWith('org-1', 0.95);
    expect(flagStaleRoleMemory).toHaveBeenCalledWith('org-1', 30);
  });

  it('does not throw on success', async () => {
    vi.mocked(deduplicateRoleMemory).mockResolvedValue(0);
    vi.mocked(flagStaleRoleMemory).mockResolvedValue(0);

    await expect(handler.handleMemoryCleanup('org-1')).resolves.toBeUndefined();
  });

  it('catches and logs errors without rethrowing', async () => {
    vi.mocked(deduplicateRoleMemory).mockRejectedValue(new Error('db down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(handler.handleMemoryCleanup('org-1')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('memory cleanup failed'),
      expect.any(String),
    );

    consoleSpy.mockRestore();
  });
});
