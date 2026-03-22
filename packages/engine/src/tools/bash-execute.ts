import { execInOrg } from '../infra/container-manager.js';
import { logEvent } from '../db/audit.js';
import { getWorkspaceSize } from './workspace-size.js';

// --- Configurable limits ---
export const DEFAULT_TIMEOUT_MS = 120_000;              // 2 minutes
export const MAX_WORKSPACE_BYTES = 1024 * 1024 * 1024;  // 1 GB
export const MAX_BASH_CALLS_PER_TASK = 50;

// --- Per-task call counter ---
const callCounts = new Map<string, number>();

/** Reset counter for a task — exported for tests. */
export function resetBashCallCounter(taskId: string): void {
  callCounts.delete(taskId);
}

export interface BashExecuteParams {
  command: string;
  workspaceDir: string;
  taskId: string;
  orgId: string;
  timeoutMs?: number;
  githubToken?: string;
  credentials?: Record<string, string>;
}

export async function executeBash(params: BashExecuteParams): Promise<string> {
  const { command, workspaceDir, taskId, orgId, timeoutMs = DEFAULT_TIMEOUT_MS, githubToken, credentials } = params;

  // Guard 1: Per-task call counter
  const count = (callCounts.get(taskId) ?? 0) + 1;
  callCounts.set(taskId, count);
  if (count > MAX_BASH_CALLS_PER_TASK) {
    const msg = `Tool call limit reached (${MAX_BASH_CALLS_PER_TASK}). Return your output now.`;
    console.warn(`[bash] ${msg} task=${taskId.slice(0, 8)}`);
    logEvent(orgId, 'worker.bash_limit', `Worker-task-${taskId.slice(0, 8)}`, { taskId, limit: 'call_count', count });
    return `[ERROR] ${msg}`;
  }

  // Guard 2: Workspace disk check (runs inside container via execInOrg with internal flag)
  const sizeBytes = await getWorkspaceSize(workspaceDir, orgId);
  if (sizeBytes > MAX_WORKSPACE_BYTES) {
    const sizeMB = Math.round(sizeBytes / (1024 * 1024));
    const msg = `Workspace size exceeded 1GB limit (${sizeMB}MB). Clean up files or complete the task.`;
    console.warn(`[bash] ${msg} task=${taskId.slice(0, 8)}`);
    logEvent(orgId, 'worker.bash_limit', `Worker-task-${taskId.slice(0, 8)}`, { taskId, limit: 'disk_size', sizeBytes });
    return `[ERROR] ${msg}`;
  }

  // Guard 3: Block commands that fake email delivery
  if (/(?:^|[|;&]\s*)(?:mail|mailx|sendmail|mutt)\b/.test(command.trimStart())) {
    const msg = 'Email commands (mail, sendmail, mutt) are not available. Email is handled by the organization\'s email system.';
    console.warn(`[bash] blocked email command task=${taskId.slice(0, 8)}: ${command.slice(0, 100)}`);
    logEvent(orgId, 'worker.bash_blocked', `Worker-task-${taskId.slice(0, 8)}`, { taskId, command: command.slice(0, 200), reason: 'email_command' });
    return `[ERROR] ${msg}`;
  }

  // Guard 4: Hard timeout (enforced via execInOrg + container-side timeout)
  const startMs = Date.now();

  // Tier 2 per-call env — no PATH/HOME/TMPDIR (container has its own)
  const env: Record<string, string> = {
    TASK_ID: taskId,
    TASK_TIMEOUT_MS: String(timeoutMs),
    WORKSPACE_DIR: workspaceDir,
  };
  // GITHUB_TOKEN is Tier 2: resolved fresh per-call
  if (githubToken) {
    env.GITHUB_TOKEN = githubToken;
    env.GH_TOKEN = githubToken;
  }
  if (credentials) {
    for (const [key, value] of Object.entries(credentials)) {
      env[key.toUpperCase()] = value;
    }
  }

  const result = await execInOrg(orgId, command, {
    cwd: workspaceDir,
    env,
    timeoutMs,
  });

  const durationMs = Date.now() - startMs;

  // Fire-and-forget audit
  logEvent(orgId, 'worker.script_execution', `Worker-task-${taskId.slice(0, 8)}`, {
    taskId,
    command: command.slice(0, 200),
    durationMs,
    exitCode: result.exitCode,
    timedOut: result.exitCode === 124, // timeout command exits 124
    stdout: result.stdout?.slice(0, 500),
    stderr: result.stderr?.slice(0, 500),
  });

  // timeout command uses exit code 124
  if (result.exitCode === 124) {
    console.warn(`[bash] command timed out after ${timeoutMs}ms task=${taskId.slice(0, 8)}`);
    return `[ERROR] Command timed out after ${timeoutMs}ms: ${command.slice(0, 100)}`;
  }

  if (result.exitCode !== 0) {
    return `[ERROR] ${result.stderr || 'Command failed'}`;
  }

  return result.stdout;
}
