import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom, mockInsert, mockSelect, mockEq, mockSingle, mockUpdate, mockUpsert } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockUpdate = vi.fn(() => ({ eq: mockEq }));
  const mockUpsert = vi.fn(() => ({ select: mockSelect }));
  const mockInsert = vi.fn(() => ({ select: mockSelect }));
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    upsert: mockUpsert,
    update: mockUpdate,
  }));
  return { mockFrom, mockInsert, mockSelect, mockEq, mockSingle, mockUpdate, mockUpsert };
});

vi.mock('../client.js', () => ({
  db: { from: mockFrom },
}));

const { mockGetOrgConfig, mockGetGitHubAppCredentials } = vi.hoisted(() => ({
  mockGetOrgConfig: vi.fn(),
  mockGetGitHubAppCredentials: vi.fn(),
}));

vi.mock('../orgs.js', () => ({
  getOrgConfig: mockGetOrgConfig,
  getGitHubAppCredentials: mockGetGitHubAppCredentials,
}));

import { storeCredential, getCredentialValue, markCredentialVerified, listCredentials, getAllOrgCredentials } from '../credentials.js';

describe('storeCredential', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts into org_credentials', async () => {
    mockFrom.mockReturnValue({ upsert: mockUpsert } as any);
    mockUpsert.mockReturnValue({ select: mockSelect } as any);
    mockSelect.mockReturnValue({ single: mockSingle } as any);
    mockSingle.mockResolvedValue({ data: { id: 'cred-1', service_key: 'stripe_secret_key' }, error: null });

    await storeCredential('org-1', 'stripe_secret_key', 'sk_live_abc');

    expect(mockFrom).toHaveBeenCalledWith('org_credentials');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        service_key: 'stripe_secret_key',
        credential_value: 'sk_live_abc',
      }),
      { onConflict: 'org_id,service_key' },
    );
  });

  it('includes description when provided', async () => {
    mockFrom.mockReturnValue({ upsert: mockUpsert } as any);
    mockUpsert.mockReturnValue({ select: mockSelect } as any);
    mockSelect.mockReturnValue({ single: mockSingle } as any);
    mockSingle.mockResolvedValue({ data: { id: 'cred-1', service_key: 'cloudflare_token' }, error: null });

    await storeCredential('org-1', 'cloudflare_token', 'cf_abc', 'DNS, Pages, Workers for example.org');

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        service_key: 'cloudflare_token',
        credential_value: 'cf_abc',
        description: 'DNS, Pages, Workers for example.org',
      }),
      { onConflict: 'org_id,service_key' },
    );
  });

  it('omits description key when not provided', async () => {
    mockFrom.mockReturnValue({ upsert: mockUpsert } as any);
    mockUpsert.mockReturnValue({ select: mockSelect } as any);
    mockSelect.mockReturnValue({ single: mockSingle } as any);
    mockSingle.mockResolvedValue({ data: { id: 'cred-1', service_key: 'stripe_key' }, error: null });

    await storeCredential('org-1', 'stripe_key', 'sk_abc');

    const upsertArg = (mockUpsert.mock.calls as any[][])[0][0];
    expect(upsertArg).not.toHaveProperty('description');
  });
});

describe('getCredentialValue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns value from org_credentials', async () => {
    mockFrom.mockReturnValue({ select: mockSelect } as any);
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValueOnce({ eq: vi.fn(() => ({ single: mockSingle })) } as any);
    mockSingle.mockResolvedValue({ data: { credential_value: 'sk_live_abc' }, error: null });

    const value = await getCredentialValue('org-1', 'stripe_secret_key');
    expect(value).toBe('sk_live_abc');
  });

  it('returns null when credential not found', async () => {
    mockFrom.mockReturnValue({ select: mockSelect } as any);
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValueOnce({ eq: vi.fn(() => ({ single: mockSingle })) } as any);
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } });

    const value = await getCredentialValue('org-1', 'nonexistent');
    expect(value).toBeNull();
  });
});

describe('markCredentialVerified', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets verified_at on the credential', async () => {
    mockFrom.mockReturnValue({ update: mockUpdate } as any);
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ error: null }) } as any);

    await markCredentialVerified('org-1', 'stripe_secret_key');

    expect(mockFrom).toHaveBeenCalledWith('org_credentials');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ verified_at: expect.any(String) }),
    );
  });
});

describe('getAllOrgCredentials', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all non-revoked credentials as key-value map', async () => {
    mockFrom.mockReturnValue({ select: mockSelect } as any);
    mockSelect.mockReturnValue({ eq: mockEq });
    (mockEq as any).mockResolvedValue({
      data: [
        { service_key: 'github_app', credential_value: 'ghs_abc123' },
        { service_key: 'cloudflare_api_token', credential_value: 'cf_test_456' },
      ],
      error: null,
    });

    const result = await getAllOrgCredentials('org-1');
    expect(result).toEqual({
      github_app: 'ghs_abc123',
      cloudflare_api_token: 'cf_test_456',
    });
  });

  it('excludes revoked credentials', async () => {
    mockFrom.mockReturnValue({ select: mockSelect } as any);
    mockSelect.mockReturnValue({ eq: mockEq });
    (mockEq as any).mockResolvedValue({
      data: [
        { service_key: 'github_app', credential_value: 'ghs_abc123' },
        { service_key: 'stripe_key', credential_value: 'REVOKED_BY_CEO_2026-03-18T00:00:00.000Z' },
      ],
      error: null,
    });

    const result = await getAllOrgCredentials('org-1');
    expect(result).toEqual({ github_app: 'ghs_abc123' });
    expect(result).not.toHaveProperty('stripe_key');
  });

  it('returns empty object when no credentials exist', async () => {
    mockFrom.mockReturnValue({ select: mockSelect } as any);
    mockSelect.mockReturnValue({ eq: mockEq });
    (mockEq as any).mockResolvedValue({ data: [], error: null });

    const result = await getAllOrgCredentials('org-1');
    expect(result).toEqual({});
  });
});

describe('listCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgConfig.mockResolvedValue(null);
    mockGetGitHubAppCredentials.mockResolvedValue(null);
  });

  it('lists credentials from org_credentials with descriptions', async () => {
    mockFrom.mockReturnValue({ select: mockSelect } as any);
    mockSelect.mockReturnValue({ eq: mockEq });
    (mockEq as any).mockResolvedValue({
      data: [
        { service_key: 'resend_api_key', credential_value: 'key-1', provisioned_at: '2026-03-13', verified_at: null, description: 'Email send/receive via Resend' },
        { service_key: 'cloudflare_api_token', credential_value: 'cf_abc', provisioned_at: '2026-03-13', verified_at: null, description: 'DNS, Pages for example.org' },
      ],
      error: null,
    });

    const result = await listCredentials('org-1');

    expect(result).toContainEqual(expect.objectContaining({ service_key: 'resend_api_key', status: 'unverified', description: 'Email send/receive via Resend' }));
    expect(result).toContainEqual(expect.objectContaining({ service_key: 'cloudflare_api_token', status: 'unverified', description: 'DNS, Pages for example.org' }));
    // No github_org → no github_app entry
    expect(result).not.toContainEqual(expect.objectContaining({ service_key: 'github_app' }));
  });

  it('shows github_app as active with description when app + installation are configured', async () => {
    mockFrom.mockReturnValue({ select: mockSelect } as any);
    mockSelect.mockReturnValue({ eq: mockEq });
    (mockEq as any).mockResolvedValue({ data: [], error: null });
    mockGetOrgConfig.mockResolvedValue({ githubOrg: 'test-org' });
    mockGetGitHubAppCredentials.mockResolvedValue({ appId: 123, installationId: 456 });

    const result = await listCredentials('org-1');
    expect(result).toContainEqual(expect.objectContaining({
      service_key: 'github_app',
      status: 'active',
      description: 'GitHub App installation for repo access, PRs, issues, and Actions',
    }));
  });

  it('shows github_app as created_not_installed when app exists but no installation', async () => {
    mockFrom.mockReturnValue({ select: mockSelect } as any);
    mockSelect.mockReturnValue({ eq: mockEq });
    (mockEq as any).mockResolvedValue({ data: [], error: null });
    mockGetOrgConfig.mockResolvedValue({ githubOrg: 'test-org' });
    mockGetGitHubAppCredentials.mockResolvedValue({ appId: 123, installationId: null });

    const result = await listCredentials('org-1');
    expect(result).toContainEqual(expect.objectContaining({ service_key: 'github_app', status: 'created_not_installed' }));
  });

  it('shows github_app as not_configured when github_org set but no app', async () => {
    mockFrom.mockReturnValue({ select: mockSelect } as any);
    mockSelect.mockReturnValue({ eq: mockEq });
    (mockEq as any).mockResolvedValue({ data: [], error: null });
    mockGetOrgConfig.mockResolvedValue({ githubOrg: 'test-org' });
    mockGetGitHubAppCredentials.mockResolvedValue(null);

    const result = await listCredentials('org-1');
    const entry = result.find(e => e.service_key === 'github_app');
    expect(entry).toBeDefined();
    expect(entry!.status).toBe('not_configured');
    expect(entry!.setup_url).toContain('/api/github/app/setup?orgId=org-1');
  });

  it('omits github_app when github_org is not set', async () => {
    mockFrom.mockReturnValue({ select: mockSelect } as any);
    mockSelect.mockReturnValue({ eq: mockEq });
    (mockEq as any).mockResolvedValue({ data: [], error: null });
    mockGetOrgConfig.mockResolvedValue({ githubOrg: null });
    mockGetGitHubAppCredentials.mockResolvedValue(null);

    const result = await listCredentials('org-1');
    expect(result).not.toContainEqual(expect.objectContaining({ service_key: 'github_app' }));
  });

  it('shows revoked org_credentials as revoked', async () => {
    mockFrom.mockReturnValue({ select: mockSelect } as any);
    mockSelect.mockReturnValue({ eq: mockEq });
    (mockEq as any).mockResolvedValue({
      data: [
        { service_key: 'stripe_key', credential_value: 'REVOKED_BY_CEO_2026-03-18T00:00:00.000Z', provisioned_at: '2026-03-13', verified_at: '2026-03-14', description: 'Payment processing' },
        { service_key: 'cloudflare_api_token', credential_value: 'cf_abc', provisioned_at: '2026-03-13', verified_at: null, description: null },
      ],
      error: null,
    });

    const result = await listCredentials('org-1');
    expect(result).toContainEqual(expect.objectContaining({ service_key: 'stripe_key', status: 'revoked', description: 'Payment processing' }));
    expect(result).toContainEqual(expect.objectContaining({ service_key: 'cloudflare_api_token', status: 'unverified' }));
  });
});
