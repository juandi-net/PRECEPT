import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
}));

vi.mock('../../infra/container-manager.js', () => ({
  execInOrg: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
  isContainerAvailable: vi.fn().mockReturnValue(true),
  initContainerRuntime: vi.fn(),
}));

vi.mock('../workspace-size.js', () => ({
  getWorkspaceSize: vi.fn().mockResolvedValue(0),
}));

import { executeBash, DEFAULT_TIMEOUT_MS, MAX_WORKSPACE_BYTES, MAX_BASH_CALLS_PER_TASK, resetBashCallCounter } from '../bash-execute.js';
import { execInOrg } from '../../infra/container-manager.js';
import { getWorkspaceSize } from '../workspace-size.js';

const TEST_TASK_ID = 'test-bash-' + Date.now();
const WORKSPACE_DIR = '/workspace/scratch/test';

describe('executeBash', () => {
  beforeEach(() => {
    resetBashCallCounter(TEST_TASK_ID);
    vi.mocked(execInOrg).mockReset();
    vi.mocked(execInOrg).mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    vi.mocked(getWorkspaceSize).mockResolvedValue(0);
  });

  it('passes correct cwd to execInOrg', async () => {
    vi.mocked(execInOrg).mockResolvedValue({ stdout: '/workspace/scratch/test\n', stderr: '', exitCode: 0 });
    const result = await executeBash({
      command: 'pwd',
      workspaceDir: WORKSPACE_DIR,
      taskId: TEST_TASK_ID,
      orgId: 'org-1',
    });
    expect(vi.mocked(execInOrg)).toHaveBeenCalledWith(
      'org-1',
      'pwd',
      expect.objectContaining({ cwd: WORKSPACE_DIR }),
    );
    expect(result).toContain('/workspace/scratch/test');
  });

  it('returns stdout on success', async () => {
    vi.mocked(execInOrg).mockResolvedValue({ stdout: 'hello world\n', stderr: '', exitCode: 0 });
    const result = await executeBash({
      command: 'echo "hello world"',
      workspaceDir: WORKSPACE_DIR,
      taskId: TEST_TASK_ID,
      orgId: 'org-1',
    });
    expect(result).toContain('hello world');
  });

  it('returns error on failure', async () => {
    vi.mocked(execInOrg).mockResolvedValue({ stdout: '', stderr: 'No such file', exitCode: 1 });
    const result = await executeBash({
      command: 'cat /nonexistent/file/path',
      workspaceDir: WORKSPACE_DIR,
      taskId: TEST_TASK_ID,
      orgId: 'org-1',
    });
    expect(result).toContain('No such file');
  });

  it('returns timeout error on exit code 124', async () => {
    vi.mocked(execInOrg).mockResolvedValue({ stdout: '', stderr: '', exitCode: 124 });
    const result = await executeBash({
      command: 'sleep 30',
      workspaceDir: WORKSPACE_DIR,
      taskId: TEST_TASK_ID,
      orgId: 'org-1',
      timeoutMs: 500,
    });
    expect(result).toContain('timed out');
  });

  it('injects GITHUB_TOKEN into env when provided', async () => {
    vi.mocked(execInOrg).mockResolvedValue({ stdout: 'ghp_test_token_123\n', stderr: '', exitCode: 0 });
    await executeBash({
      command: 'echo $GITHUB_TOKEN',
      workspaceDir: WORKSPACE_DIR,
      taskId: TEST_TASK_ID,
      orgId: 'org-1',
      githubToken: 'ghp_test_token_123',
    });
    const call = vi.mocked(execInOrg).mock.calls[0];
    const passedEnv = call[2].env ?? {};
    expect(passedEnv.GITHUB_TOKEN).toBe('ghp_test_token_123');
    expect(passedEnv.GH_TOKEN).toBe('ghp_test_token_123');
  });

  it('does not forward engine secrets to execInOrg env', async () => {
    await executeBash({
      command: 'echo test',
      workspaceDir: WORKSPACE_DIR,
      taskId: TEST_TASK_ID,
      orgId: 'org-1',
    });

    const call = vi.mocked(execInOrg).mock.calls[0];
    const passedEnv = call[2].env ?? {};
    expect(passedEnv).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY');
    expect(passedEnv).not.toHaveProperty('CLIPROXY_API_KEY');
    expect(passedEnv).toHaveProperty('TASK_ID');
    expect(passedEnv).toHaveProperty('WORKSPACE_DIR');
  });

  describe('credential env injection', () => {
    it('injects credentials as UPPER_SNAKE_CASE env vars', async () => {
      await executeBash({
        command: 'echo $CLOUDFLARE_API_TOKEN',
        workspaceDir: WORKSPACE_DIR,
        taskId: TEST_TASK_ID,
        orgId: 'org-1',
        credentials: { cloudflare_api_token: 'cf_test_123' },
      });
      const call = vi.mocked(execInOrg).mock.calls[0];
      const passedEnv = call[2].env ?? {};
      expect(passedEnv.CLOUDFLARE_API_TOKEN).toBe('cf_test_123');
    });

    it('injects multiple credentials', async () => {
      await executeBash({
        command: 'echo test',
        workspaceDir: WORKSPACE_DIR,
        taskId: TEST_TASK_ID,
        orgId: 'org-1',
        credentials: {
          stripe_secret_key: 'sk_live_abc',
          vercel_token: 'vtoken_xyz',
        },
      });
      const call = vi.mocked(execInOrg).mock.calls[0];
      const passedEnv = call[2].env ?? {};
      expect(passedEnv.STRIPE_SECRET_KEY).toBe('sk_live_abc');
      expect(passedEnv.VERCEL_TOKEN).toBe('vtoken_xyz');
    });
  });
});

describe('bash guards', () => {
  const GUARD_TASK_ID = 'test-guard-' + Date.now();

  beforeEach(() => {
    resetBashCallCounter(GUARD_TASK_ID);
    vi.mocked(execInOrg).mockReset();
    vi.mocked(execInOrg).mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    vi.mocked(getWorkspaceSize).mockResolvedValue(0);
  });

  it('exports DEFAULT_TIMEOUT_MS as 120 seconds', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(120_000);
  });

  it('exports MAX_WORKSPACE_BYTES as 1GB', () => {
    expect(MAX_WORKSPACE_BYTES).toBe(1024 * 1024 * 1024);
  });

  it('exports MAX_BASH_CALLS_PER_TASK as 50', () => {
    expect(MAX_BASH_CALLS_PER_TASK).toBe(50);
  });

  it('refuses call when workspace exceeds MAX_WORKSPACE_BYTES', async () => {
    vi.mocked(getWorkspaceSize).mockResolvedValueOnce(2 * 1024 * 1024 * 1024); // 2GB

    const result = await executeBash({
      command: 'echo hello',
      workspaceDir: WORKSPACE_DIR,
      taskId: GUARD_TASK_ID,
      orgId: 'org-1',
    });

    expect(result).toContain('Workspace size exceeded');
    expect(result).toContain('1GB limit');
  });

  it('refuses call when tool call counter exceeds MAX_BASH_CALLS_PER_TASK', async () => {
    // Exhaust the counter
    for (let i = 0; i < MAX_BASH_CALLS_PER_TASK; i++) {
      await executeBash({
        command: 'true',
        workspaceDir: WORKSPACE_DIR,
        taskId: GUARD_TASK_ID,
        orgId: 'org-1',
      });
    }

    // Next call should be refused
    const result = await executeBash({
      command: 'echo should not run',
      workspaceDir: WORKSPACE_DIR,
      taskId: GUARD_TASK_ID,
      orgId: 'org-1',
    });

    expect(result).toContain('Tool call limit reached');
  });

  it('resets call counter per task', async () => {
    // Make some calls
    for (let i = 0; i < 5; i++) {
      await executeBash({ command: 'true', workspaceDir: WORKSPACE_DIR, taskId: GUARD_TASK_ID, orgId: 'org-1' });
    }

    // Reset
    resetBashCallCounter(GUARD_TASK_ID);

    vi.mocked(execInOrg).mockResolvedValue({ stdout: 'works\n', stderr: '', exitCode: 0 });
    const result = await executeBash({
      command: 'echo works',
      workspaceDir: WORKSPACE_DIR,
      taskId: GUARD_TASK_ID,
      orgId: 'org-1',
    });

    expect(result).toContain('works');
  });

  it('blocks email commands', async () => {
    const result = await executeBash({
      command: 'mail -s "test" user@example.com',
      workspaceDir: WORKSPACE_DIR,
      taskId: GUARD_TASK_ID,
      orgId: 'org-1',
    });
    expect(result).toContain('Email commands');
  });
});
