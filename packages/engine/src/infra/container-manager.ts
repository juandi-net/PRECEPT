import { exec } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { getOrgConfig } from '../db/orgs.js';
import { getCredentialValue } from '../db/credentials.js';

/** Promisified exec that returns { stdout, stderr }. */
function execAsync(
  command: string,
  options: { timeout?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stdout: stdout ?? '', stderr: stderr ?? '' });
    });
  });
}

// --- Types ---

export interface ExecOpts {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  internal?: boolean; // bypasses bash call counter
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// --- State ---

let containerAvailable = false;
const runningOrgs = new Set<string>();
const orgLocks = new Map<string, Promise<void>>();

export function isContainerAvailable(): boolean {
  return containerAvailable;
}

// --- Shell escape ---

/** Escape a string for use inside single quotes in bash. */
export function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

// --- Startup ---

export async function initContainerRuntime(): Promise<void> {
  try {
    // 1. Check CLI exists
    await execAsync('container --version', { timeout: 5_000 });
  } catch {
    console.error('[container] Apple Container CLI not found. Worker dispatch will be disabled.');
    containerAvailable = false;
    return;
  }

  try {
    // 2. Check system service
    const { stdout: statusOut } = await execAsync('container system status', { timeout: 5_000 });
    if (!statusOut.toLowerCase().includes('running')) {
      console.error('[container] Apple Container system service not running. Run: container system start');
      containerAvailable = false;
      return;
    }
  } catch {
    console.error('[container] Apple Container system service not available. Run: container system start');
    containerAvailable = false;
    return;
  }

  try {
    // 3. Check image exists
    const { stdout: imagesOut } = await execAsync('container image ls', { timeout: 10_000 });
    if (!imagesOut.includes('precept-org')) {
      console.error('[container] precept-org image not found. Run: container build -t precept-org:latest -f Containerfile.org .');
      containerAvailable = false;
      return;
    }
  } catch {
    console.error('[container] Failed to list container images.');
    containerAvailable = false;
    return;
  }

  // 4. Populate running containers cache
  try {
    const { stdout: listOut } = await execAsync('container list', { timeout: 10_000 });
    for (const line of listOut.split('\n')) {
      const match = line.match(/precept-org-([^\s]+)/);
      if (match) {
        runningOrgs.add(match[1]);
      }
    }
    console.log(`[container] found ${runningOrgs.size} running org container(s)`);
  } catch {
    // Non-fatal — cache starts empty
    console.warn('[container] failed to list running containers, cache starts empty');
  }

  containerAvailable = true;
  console.log('[container] Apple Container runtime initialized');
}

// --- Container Lifecycle ---

async function ensureOrgNetwork(orgId: string): Promise<void> {
  const name = `precept-net-${orgId}`;
  try {
    await execAsync(`container network create ${name}`, { timeout: 10_000 });
  } catch (err) {
    // "already exists" is fine — network survives stopOrgContainer
    if (!(err instanceof Error && err.message.includes('already'))) throw err;
  }
}

async function ensureOrgVolume(orgId: string): Promise<void> {
  const name = `precept-ws-${orgId}`;
  try {
    await execAsync(`container volume create ${name}`, { timeout: 10_000 });
  } catch (err) {
    if (!(err instanceof Error && err.message.includes('already'))) throw err;
  }
}

async function writeOrgEnvFile(orgId: string): Promise<string> {
  const [config, resendApiKey, linearApiKey] = await Promise.all([
    getOrgConfig(orgId),
    getCredentialValue(orgId, 'resend_api_key'),
    getCredentialValue(orgId, 'linear_api_key'),
  ]);

  const lines: string[] = [];

  // Config baked into container env at creation time
  if (config?.githubOrg) lines.push(`GITHUB_ORG=${config.githubOrg}`);
  // Credentials from org_credentials (skip revoked sentinels)
  if (resendApiKey && !resendApiKey.startsWith('REVOKED_BY_CEO_')) lines.push(`RESEND_API_KEY=${resendApiKey}`);
  if (linearApiKey && !linearApiKey.startsWith('REVOKED_BY_CEO_')) lines.push(`LINEAR_API_KEY=${linearApiKey}`);

  const suffix = randomBytes(6).toString('hex');
  const envPath = join(tmpdir(), `precept-env-${orgId}-${suffix}`);
  await writeFile(envPath, lines.join('\n'), { mode: 0o600 });
  return envPath;
}

export async function ensureOrgContainer(orgId: string): Promise<void> {
  if (runningOrgs.has(orgId)) return;

  // Per-org mutex: serialize concurrent calls so only one creates the container
  const existing = orgLocks.get(orgId);
  if (existing) {
    await existing;
    return;
  }

  const promise = (async () => {
    if (runningOrgs.has(orgId)) return;

    await ensureOrgNetwork(orgId);
    await ensureOrgVolume(orgId);

    const envPath = await writeOrgEnvFile(orgId);
    try {
      await execAsync([
        'container run',
        '--detach',
        `--name precept-org-${orgId}`,
        `--network precept-net-${orgId}`,
        '--cpus 2',
        '--memory 2g',
        `-v precept-ws-${orgId}:/workspace`,
        `--env-file ${envPath}`,
        'precept-org:latest',
        'sleep infinity',
      ].join(' '), { timeout: 30_000 });

      console.log(`[container] started precept-org-${orgId}`);
    } catch (err) {
      // "already exists" means another path created it — not an error
      if (!(err instanceof Error && err.message.includes('already exists'))) throw err;
      console.log(`[container] precept-org-${orgId} already running`);
    } finally {
      await unlink(envPath).catch(() => {});
    }

    runningOrgs.add(orgId);
  })();

  orgLocks.set(orgId, promise);
  try {
    await promise;
  } finally {
    orgLocks.delete(orgId);
  }
}

export async function stopOrgContainer(orgId: string): Promise<void> {
  try {
    await execAsync(`container stop precept-org-${orgId}`, { timeout: 15_000 });
  } catch {
    // Container may already be stopped
  }
  try {
    await execAsync(`container delete precept-org-${orgId}`, { timeout: 10_000 });
  } catch {
    // Container may already be deleted
  }
  runningOrgs.delete(orgId);
  console.log(`[container] stopped precept-org-${orgId}`);
}

// --- Command Execution ---

/** Run a single command via container exec. Returns ExecResult (never throws). */
function runContainerExec(
  fullCommand: string,
  timeoutMs: number,
): Promise<ExecResult> {
  return new Promise<ExecResult>((resolve) => {
    exec(fullCommand, {
      timeout: timeoutMs + 5_000, // host-side buffer
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        const msg = (stderr || error.message).toLowerCase();
        // Sentinel exitCode -1 = container not found
        if (msg.includes('not found') || msg.includes('no such container') || msg.includes('does not exist')) {
          resolve({ stdout: '', stderr: stderr || error.message, exitCode: -1 });
          return;
        }
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? error.message,
          exitCode: (error as Error & { code?: number }).code ?? 1,
        });
        return;
      }
      resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode: 0 });
    });
  });
}

export async function execInOrg(
  orgId: string,
  command: string,
  opts: ExecOpts,
): Promise<ExecResult> {
  // Fast path: skip ensureOrgContainer if we know it's running
  if (!runningOrgs.has(orgId)) {
    await ensureOrgContainer(orgId);
  }

  const timeoutMs = opts.timeoutMs ?? 120_000;
  const timeoutSec = Math.ceil(timeoutMs / 1000);

  // Build env prefix — validate keys to prevent shell injection
  const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const envParts: string[] = [];
  if (opts.env) {
    for (const [key, value] of Object.entries(opts.env)) {
      if (!ENV_KEY_PATTERN.test(key)) {
        console.error(`[container] rejected invalid env key: ${key.slice(0, 50)}`);
        continue;
      }
      envParts.push(`${key}=${shellEscape(value)}`);
    }
  }
  const envPrefix = envParts.length > 0 ? `env ${envParts.join(' ')} ` : '';

  // Build inner command with cwd and container-side timeout
  const cdPrefix = opts.cwd ? `cd ${shellEscape(opts.cwd)} && ` : '';
  const innerCommand = `${cdPrefix}${command}`;
  const wrappedCommand = `timeout ${timeoutSec}s bash -c ${shellEscape(innerCommand)}`;

  const fullCommand = `container exec precept-org-${orgId} ${envPrefix}${wrappedCommand}`;

  // First attempt
  const result = await runContainerExec(fullCommand, timeoutMs);

  // Recovery: container disappeared — recreate and retry once
  if (result.exitCode === -1) {
    runningOrgs.delete(orgId);
    await ensureOrgContainer(orgId);
    return runContainerExec(fullCommand, timeoutMs);
  }

  return result;
}
