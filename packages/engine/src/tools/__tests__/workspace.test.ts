import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../infra/container-manager.js', () => ({
  execInOrg: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
}));

vi.mock('../../lib/github-app.js', () => ({
  resolveGitHubAppToken: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../db/credentials.js', () => ({
  getCredentialValue: vi.fn().mockResolvedValue('ghp_test'),
}));

import { getOrCreateTaskWorkspace, cleanupTaskWorkspace, createCoderWorkspace, cleanupCoderWorkspace } from '../workspace.js';
import { execInOrg } from '../../infra/container-manager.js';

describe('TaskWorkspace (container)', () => {
  beforeEach(() => {
    vi.mocked(execInOrg).mockReset();
    vi.mocked(execInOrg).mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
  });

  it('creates scratch workspace inside container', async () => {
    const ws = await getOrCreateTaskWorkspace('task-1', 'org-1');
    expect(ws.workspaceDir).toBe('/workspace/scratch/task-1');
    expect(vi.mocked(execInOrg)).toHaveBeenCalledWith(
      'org-1',
      'mkdir -p /workspace/scratch/task-1',
      { internal: true },
    );
  });

  it('cleanup removes scratch dir inside container', async () => {
    await getOrCreateTaskWorkspace('task-2', 'org-1');
    await cleanupTaskWorkspace('task-2', 'org-1');
    expect(vi.mocked(execInOrg)).toHaveBeenCalledWith(
      'org-1',
      'rm -rf /workspace/scratch/task-2',
      { internal: true },
    );
  });

  it('createCoderWorkspace extracts repo name and uses container paths', async () => {
    // Mock head check to fail (no existing clone)
    vi.mocked(execInOrg)
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 }) // test -f HEAD fails
      .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }); // all subsequent calls succeed

    const ws = await createCoderWorkspace('org-1', 'task-1', 'https://github.com/test-org/some-repo.git');
    expect(ws.workspaceDir).toBe('/workspace/tasks/task-1');

    const calls = vi.mocked(execInOrg).mock.calls;
    // Should have checked HEAD at /workspace/repos/some-repo/HEAD
    expect(calls[0][1]).toContain('test -f /workspace/repos/some-repo/HEAD');
    // Should have cloned
    expect(calls[1][1]).toContain('git clone --bare');
    expect(calls[1][1]).toContain('some-repo');
  });

  it('cleanupCoderWorkspace removes worktree via git', async () => {
    await cleanupCoderWorkspace('org-1', 'task-1', 'https://github.com/test-org/some-repo.git');
    const calls = vi.mocked(execInOrg).mock.calls;
    expect(calls.some(c => c[1].includes('worktree remove') && c[1].includes('/workspace/tasks/task-1'))).toBe(true);
    expect(calls.some(c => c[1].includes('worktree prune'))).toBe(true);
  });
});
