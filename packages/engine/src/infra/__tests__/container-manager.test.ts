import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExec } = vi.hoisted(() => {
  const mockExec = vi.fn();
  return { mockExec };
});

vi.mock('node:child_process', () => ({
  exec: mockExec,
}));

vi.mock('../../db/orgs.js', () => ({
  getOrgConfig: vi.fn().mockResolvedValue({ orgId: 'org-1', githubOrg: 'test-org' }),
}));

vi.mock('../../db/credentials.js', () => ({
  getCredentialValue: vi.fn().mockResolvedValue(null),
}));

import { initContainerRuntime, isContainerAvailable, ensureOrgContainer, stopOrgContainer, execInOrg } from '../container-manager.js';

describe('container-manager startup', () => {
  beforeEach(() => {
    mockExec.mockReset();
  });

  it('sets containerAvailable=true when all checks pass', async () => {
    // Mock: container --version succeeds
    mockExec.mockImplementation((cmd: string, opts: unknown, cb: Function) => {
      if (cmd === 'container --version') {
        cb(null, 'container version 0.9.0', '');
      } else if (cmd === 'container system status') {
        cb(null, 'running', '');
      } else if (cmd.startsWith('container image ls')) {
        cb(null, 'precept-org  latest  abc123', '');
      } else if (cmd === 'container list') {
        cb(null, 'precept-org-org-1  running\nsome-other-container  running', '');
      } else {
        cb(null, '', '');
      }
    });

    await initContainerRuntime();
    expect(isContainerAvailable()).toBe(true);
  });

  it('sets containerAvailable=false when container CLI is missing', async () => {
    mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: Function) => {
      cb(new Error('command not found: container'), '', '');
    });

    await initContainerRuntime();
    expect(isContainerAvailable()).toBe(false);
  });

  it('sets containerAvailable=false when precept-org image is missing', async () => {
    mockExec.mockImplementation((cmd: string, _opts: unknown, cb: Function) => {
      if (cmd === 'container --version') cb(null, 'container version 0.9.0', '');
      else if (cmd === 'container system status') cb(null, 'running', '');
      else if (cmd.startsWith('container image ls')) cb(null, '', '');
      else cb(null, '', '');
    });

    await initContainerRuntime();
    expect(isContainerAvailable()).toBe(false);
  });
});

describe('container lifecycle', () => {
  beforeEach(() => {
    mockExec.mockReset();
  });

  it('ensureOrgContainer creates network, volume, and container', async () => {
    const commands: string[] = [];
    mockExec.mockImplementation((cmd: string, opts: unknown, cb?: Function) => {
      commands.push(cmd);
      if (typeof opts === 'function') {
        opts(null, '', '');
      } else if (cb) {
        cb(null, '', '');
      }
    });

    await ensureOrgContainer('org-2');

    expect(commands.some(c => c.includes('network create precept-net-org-2'))).toBe(true);
    expect(commands.some(c => c.includes('volume create precept-ws-org-2'))).toBe(true);
    expect(commands.some(c => c.includes('container run'))).toBe(true);
    expect(commands.some(c => c.includes('--name precept-org-org-2'))).toBe(true);
  });

  it('stopOrgContainer stops and deletes container', async () => {
    const commands: string[] = [];
    mockExec.mockImplementation((cmd: string, opts: unknown, cb?: Function) => {
      commands.push(cmd);
      if (typeof opts === 'function') opts(null, '', '');
      else if (cb) cb(null, '', '');
    });

    await stopOrgContainer('org-3');

    expect(commands.some(c => c.includes('container stop precept-org-org-3'))).toBe(true);
    expect(commands.some(c => c.includes('container delete precept-org-org-3'))).toBe(true);
  });
});

describe('execInOrg', () => {
  beforeEach(() => {
    mockExec.mockReset();
  });

  it('constructs correct container exec command with env and cwd', async () => {
    let capturedCmd = '';
    mockExec.mockImplementation((cmd: string, _opts: unknown, cb: Function) => {
      capturedCmd = cmd;
      cb(null, 'output', '');
    });

    // org-1 was already added to runningOrgs by the startup test
    const result = await execInOrg('org-1', 'echo hello', {
      cwd: '/workspace/scratch/task-1',
      env: { TASK_ID: 'task-1', STRIPE_KEY: 'sk_test' },
      timeoutMs: 5000,
    });

    expect(capturedCmd).toContain('container exec precept-org-org-1');
    expect(capturedCmd).toContain('TASK_ID=');
    expect(capturedCmd).toContain('STRIPE_KEY=');
    expect(capturedCmd).toContain('cd');
    expect(capturedCmd).toContain('/workspace/scratch/task-1');
    expect(result.stdout).toBe('output');
  });

  it('wraps command with container-side timeout', async () => {
    let capturedCmd = '';
    mockExec.mockImplementation((cmd: string, _opts: unknown, cb: Function) => {
      capturedCmd = cmd;
      cb(null, '', '');
    });

    await execInOrg('org-1', 'long-running', { timeoutMs: 60_000 });

    expect(capturedCmd).toContain('timeout 60s');
  });

  it('returns exitCode from exec error', async () => {
    mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: Function) => {
      const err = new Error('exit 1') as Error & { code: number };
      err.code = 1;
      cb(err, '', 'some error');
    });

    const result = await execInOrg('org-1', 'false', {});
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('some error');
  });
});
