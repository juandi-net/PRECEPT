import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom, mockSelect, mockEq, mockSingle, mockUpdate, mockUpdateEq } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockUpdateEq = vi.fn();
  const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect, update: mockUpdate }));
  return { mockFrom, mockSelect, mockEq, mockSingle, mockUpdate, mockUpdateEq };
});

vi.mock('../client.js', () => ({
  db: { from: mockFrom },
}));

import {
  getOrgConfig,
  getOrgIdByEmailDomain,
  getGitHubAppCredentials,
  saveGitHubAppCredentials,
  saveGitHubInstallationId,
} from '../orgs.js';

describe('getOrgConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it('returns mapped config when found', async () => {
    mockSingle.mockResolvedValue({
      data: {
        org_id: 'org-1',
        email_domain: 'example.com',
        owner_email: 'owner@example.com',
        github_org: 'my-org',
        github_repo_url: 'https://github.com/my-org/repo',
        linear_team_id: 'team-1',
      },
      error: null,
    });

    const result = await getOrgConfig('org-1');
    expect(mockFrom).toHaveBeenCalledWith('org_config');
    expect(result).toEqual({
      orgId: 'org-1',
      emailDomain: 'example.com',
      ownerEmail: 'owner@example.com',
      githubOrg: 'my-org',
      githubRepoUrl: 'https://github.com/my-org/repo',
      linearTeamId: 'team-1',
    });
  });

  it('returns null when no config row exists', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });
    const result = await getOrgConfig('org-missing');
    expect(result).toBeNull();
  });
});

describe('getOrgIdByEmailDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it('returns org_id when domain matches', async () => {
    mockSingle.mockResolvedValue({
      data: { org_id: 'org-abc' },
      error: null,
    });
    const result = await getOrgIdByEmailDomain('example.com');
    expect(result).toBe('org-abc');
    expect(mockFrom).toHaveBeenCalledWith('org_config');
  });

  it('returns null when no matching domain', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });
    const result = await getOrgIdByEmailDomain('unknown.com');
    expect(result).toBeNull();
  });
});

describe('getGitHubAppCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it('returns null when no app credentials exist', async () => {
    mockSingle.mockResolvedValue({
      data: { github_app_id: null },
      error: null,
    });
    const result = await getGitHubAppCredentials('org-1');
    expect(result).toBeNull();
  });

  it('returns mapped credentials when app is configured', async () => {
    mockSingle.mockResolvedValue({
      data: {
        github_app_id: 12345,
        github_app_slug: 'test-worker',
        github_app_pem: '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----',
        github_app_webhook_secret: 'whsec_123',
        github_app_client_id: 'Iv1.abc',
        github_app_client_secret: 'secret_abc',
        github_installation_id: 67890,
      },
      error: null,
    });

    const result = await getGitHubAppCredentials('org-1');
    expect(result).toEqual({
      appId: 12345,
      slug: 'test-worker',
      pem: '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----',
      webhookSecret: 'whsec_123',
      clientId: 'Iv1.abc',
      clientSecret: 'secret_abc',
      installationId: 67890,
    });
  });

  it('returns null on DB error', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });
    const result = await getGitHubAppCredentials('org-missing');
    expect(result).toBeNull();
  });
});

describe('saveGitHubAppCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });
  });

  it('updates org_config with app credentials', async () => {
    mockUpdateEq.mockResolvedValue({ error: null });

    await saveGitHubAppCredentials('org-1', {
      appId: 12345,
      slug: 'test-worker',
      pem: 'pem-data',
      webhookSecret: 'whsec_123',
      clientId: 'Iv1.abc',
      clientSecret: 'secret_abc',
    });

    expect(mockFrom).toHaveBeenCalledWith('org_config');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        github_app_id: 12345,
        github_app_slug: 'test-worker',
      }),
    );
    expect(mockUpdateEq).toHaveBeenCalledWith('org_id', 'org-1');
  });

  it('throws on DB error', async () => {
    mockUpdateEq.mockResolvedValue({ error: { message: 'update failed' } });

    await expect(
      saveGitHubAppCredentials('org-1', {
        appId: 12345,
        slug: 'test-worker',
        pem: 'pem-data',
        webhookSecret: 'whsec_123',
        clientId: 'Iv1.abc',
        clientSecret: 'secret_abc',
      }),
    ).rejects.toThrow('Failed to save GitHub App credentials');
  });
});

describe('saveGitHubInstallationId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });
  });

  it('updates installation ID', async () => {
    mockUpdateEq.mockResolvedValue({ error: null });

    await saveGitHubInstallationId('org-1', 67890);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ github_installation_id: 67890 }),
    );
    expect(mockUpdateEq).toHaveBeenCalledWith('org_id', 'org-1');
  });
});
