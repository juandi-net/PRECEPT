import { execInOrg } from '../infra/container-manager.js';
import { resolveGitHubAppToken } from '../lib/github-app.js';
import { getCredentialValue } from '../db/credentials.js';

export interface TaskWorkspace {
  taskId: string;
  workspaceDir: string;
}

// Non-coder tasks still get a simple scratch dir (no git)
const simpleDirs = new Map<string, TaskWorkspace>();

/** Extract repo name from a GitHub URL. e.g. "https://github.com/org/repo.git" -> "repo" */
function extractRepoName(repoUrl: string): string {
  const parts = repoUrl.replace(/\.git$/, '').split('/');
  return parts[parts.length - 1];
}

export async function getOrCreateTaskWorkspace(taskId: string, orgId: string): Promise<TaskWorkspace> {
  const existing = simpleDirs.get(taskId);
  if (existing) return existing;

  const dir = `/workspace/scratch/${taskId}`;
  await execInOrg(orgId, `mkdir -p ${dir}`, { internal: true });
  const ws = { taskId, workspaceDir: dir };
  simpleDirs.set(taskId, ws);
  return ws;
}

/**
 * Create a git worktree for a coder task inside the org container.
 * 1. Ensures bare clone exists at /workspace/repos/{repoName}/
 * 2. Fetches latest
 * 3. Creates worktree at /workspace/tasks/{taskId}/
 */
export async function createCoderWorkspace(
  orgId: string,
  taskId: string,
  repoUrl: string,
): Promise<TaskWorkspace> {
  const repoName = extractRepoName(repoUrl);
  const repoDir = `/workspace/repos/${repoName}`;
  const taskDir = `/workspace/tasks/${taskId}`;

  // Resolve GitHub token for authenticated clone (Tier 2 — fresh per-call)
  const githubToken = (await resolveGitHubAppToken(orgId)) ?? (await getCredentialValue(orgId, 'github_token')) ?? undefined;
  const tokenEnv: Record<string, string> = {};
  if (githubToken) {
    tokenEnv.GITHUB_TOKEN = githubToken;
    tokenEnv.GH_TOKEN = githubToken;
  }

  // Ensure bare clone exists
  const headCheck = await execInOrg(orgId, `test -f ${repoDir}/HEAD`, { internal: true });
  if (headCheck.exitCode !== 0) {
    // Clone — use $GITHUB_TOKEN from env
    const cloneCmd = `git clone --bare "https://x-access-token:\${GITHUB_TOKEN}@github.com/${repoUrl.replace('https://github.com/', '').replace(/\.git$/, '')}.git" "${repoDir}"`;
    const cloneResult = await execInOrg(orgId, cloneCmd, {
      env: tokenEnv,
      timeoutMs: 120_000,
      internal: true,
    });
    if (cloneResult.exitCode !== 0) {
      throw new Error(`git clone failed: ${cloneResult.stderr}`);
    }
    console.log(`[workspace] cloned ${repoUrl} -> ${repoDir}`);
  }

  // Fetch latest
  await execInOrg(orgId, `git -C "${repoDir}" fetch origin`, {
    env: tokenEnv,
    timeoutMs: 60_000,
    internal: true,
  });

  // Create worktree
  const branch = `task/${taskId.slice(0, 8)}`;
  await execInOrg(orgId, `mkdir -p /workspace/tasks`, { internal: true });
  const wtResult = await execInOrg(orgId, `git -C "${repoDir}" worktree add "${taskDir}" -b "${branch}" origin/main`, {
    timeoutMs: 30_000,
    internal: true,
  });
  if (wtResult.exitCode !== 0) {
    throw new Error(`git worktree add failed: ${wtResult.stderr}`);
  }

  console.log(`[workspace] created worktree for task ${taskId.slice(0, 8)} at ${taskDir}`);
  return { taskId, workspaceDir: taskDir };
}

/**
 * Cleanup a coder worktree after terminal state.
 */
export async function cleanupCoderWorkspace(orgId: string, taskId: string, repoUrl: string = ''): Promise<void> {
  if (!repoUrl) {
    console.warn(`[workspace] cleanup skipped for task ${taskId.slice(0, 8)}: no repoUrl provided`);
    // Fall back to rm -rf as best-effort cleanup
    await execInOrg(orgId, `rm -rf /workspace/tasks/${taskId}`, { internal: true });
    return;
  }

  const repoName = extractRepoName(repoUrl);
  const repoDir = `/workspace/repos/${repoName}`;
  const taskDir = `/workspace/tasks/${taskId}`;

  try {
    await execInOrg(orgId, `git -C "${repoDir}" worktree remove "${taskDir}" --force`, {
      timeoutMs: 15_000,
      internal: true,
    });
    await execInOrg(orgId, `git -C "${repoDir}" worktree prune`, {
      timeoutMs: 10_000,
      internal: true,
    });
    console.log(`[workspace] cleaned up worktree for task ${taskId.slice(0, 8)}`);
  } catch (err) {
    console.error(`[workspace] cleanup failed for task ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Cleanup simple (non-git) workspace.
 */
export async function cleanupTaskWorkspace(taskId: string, orgId: string): Promise<void> {
  simpleDirs.delete(taskId);
  await execInOrg(orgId, `rm -rf /workspace/scratch/${taskId}`, { internal: true });
}
