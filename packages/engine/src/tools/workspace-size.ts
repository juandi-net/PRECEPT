import { execInOrg } from '../infra/container-manager.js';

/** Get workspace size in bytes by running du -sk inside the org container. */
export async function getWorkspaceSize(dir: string, orgId: string): Promise<number> {
  try {
    const result = await execInOrg(orgId, `du -sk "${dir}"`, {
      timeoutMs: 10_000,
      internal: true,
    });
    if (result.exitCode !== 0) return 0; // fail-open: if du fails, allow the call
    const kb = parseInt(result.stdout.trim().split(/\s/)[0], 10);
    return isNaN(kb) ? 0 : kb * 1024;
  } catch {
    return 0; // fail-open
  }
}
