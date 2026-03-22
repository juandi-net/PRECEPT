import { describe, it, expect, vi } from 'vitest';
import { db } from '../client.js';

vi.mock('../client.js', () => ({
  db: { rpc: vi.fn() },
}));

import { flagStaleRoleMemory } from '../role-memory.js';

describe('flagStaleRoleMemory', () => {
  it('calls the RPC with correct parameters', async () => {
    vi.mocked(db.rpc).mockResolvedValueOnce({ data: 3, error: null } as any);

    const count = await flagStaleRoleMemory('org-1');

    expect(db.rpc).toHaveBeenCalledWith('flag_stale_role_memory', {
      target_org_id: 'org-1',
      stale_days: 30,
    });
    expect(count).toBe(3);
  });

  it('passes custom stale_days', async () => {
    vi.mocked(db.rpc).mockResolvedValueOnce({ data: 0, error: null } as any);

    await flagStaleRoleMemory('org-1', 60);

    expect(db.rpc).toHaveBeenCalledWith('flag_stale_role_memory', {
      target_org_id: 'org-1',
      stale_days: 60,
    });
  });

  it('throws on RPC error', async () => {
    vi.mocked(db.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'connection refused' },
    } as any);

    await expect(flagStaleRoleMemory('org-1')).rejects.toThrow('connection refused');
  });
});
