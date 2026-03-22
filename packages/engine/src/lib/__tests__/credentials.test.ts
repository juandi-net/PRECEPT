import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGetOrgConfig, mockResolveGitHubAppToken, mockGetCredentialValue } = vi.hoisted(() => ({
  mockGetOrgConfig: vi.fn(),
  mockResolveGitHubAppToken: vi.fn(),
  mockGetCredentialValue: vi.fn(),
}));

vi.mock('../../db/orgs.js', () => ({
  getOrgConfig: mockGetOrgConfig,
}));

vi.mock('../../db/credentials.js', () => ({
  getCredentialValue: mockGetCredentialValue,
}));

vi.mock('../github-app.js', () => ({
  resolveGitHubAppToken: mockResolveGitHubAppToken,
}));

import { resolveCredentials } from '../credentials.js';

describe('resolveCredentials', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no GitHub App token (falls back to static PAT)
    mockResolveGitHubAppToken.mockResolvedValue(null);
    // Default: no credentials in org_credentials
    mockGetCredentialValue.mockResolvedValue(null);
    // Clear relevant env vars
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_DOMAIN;
    delete process.env.OWNER_EMAIL;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_ORG;
    delete process.env.GITHUB_REPO_URL;
    delete process.env.LINEAR_API_KEY;
    delete process.env.LINEAR_TEAM_ID;
  });

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
  });

  it('returns org config and credentials when they exist', async () => {
    mockGetOrgConfig.mockResolvedValue({
      orgId: 'org-1',
      emailDomain: 'org.example.com',
      ownerEmail: 'owner@org.example.com',
      githubOrg: 'my-org',
      githubRepoUrl: 'https://github.com/my-org/repo',
      linearTeamId: 'team-org',
    });
    mockGetCredentialValue.mockImplementation((_orgId: string, key: string) => {
      const values: Record<string, string> = {
        resend_api_key: 'org-resend-key',
        linear_api_key: 'lin_orgkey',
        github_token: 'ghp_orgtoken',
      };
      return Promise.resolve(values[key] ?? null);
    });

    const creds = await resolveCredentials('org-1');

    expect(creds.resendApiKey).toBe('org-resend-key');
    expect(creds.emailDomain).toBe('org.example.com');
    expect(creds.ownerEmail).toBe('owner@org.example.com');
    expect(creds.githubToken).toBe('ghp_orgtoken');
    expect(creds.githubOrg).toBe('my-org');
    expect(creds.githubRepoUrl).toBe('https://github.com/my-org/repo');
    expect(creds.linearApiKey).toBe('lin_orgkey');
    expect(creds.linearTeamId).toBe('team-org');
  });

  it('falls back to env vars when org config and credentials are null', async () => {
    mockGetOrgConfig.mockResolvedValue(null);
    process.env.RESEND_API_KEY = 'env-resend-key';
    process.env.EMAIL_DOMAIN = 'env.example.com';
    process.env.OWNER_EMAIL = 'owner@env.example.com';
    process.env.GITHUB_TOKEN = 'ghp_envtoken';
    process.env.GITHUB_ORG = 'env-org';
    process.env.GITHUB_REPO_URL = 'https://github.com/env-org/repo';
    process.env.LINEAR_API_KEY = 'lin_envkey';
    process.env.LINEAR_TEAM_ID = 'team-env';

    const creds = await resolveCredentials('org-1');

    expect(creds.resendApiKey).toBe('env-resend-key');
    expect(creds.emailDomain).toBe('env.example.com');
    expect(creds.ownerEmail).toBe('owner@env.example.com');
    expect(creds.githubToken).toBe('ghp_envtoken');
    expect(creds.githubOrg).toBe('env-org');
    expect(creds.githubRepoUrl).toBe('https://github.com/env-org/repo');
    expect(creds.linearApiKey).toBe('lin_envkey');
    expect(creds.linearTeamId).toBe('team-env');
  });

  it('falls back to env vars for individual null fields', async () => {
    mockGetOrgConfig.mockResolvedValue({
      orgId: 'org-1',
      emailDomain: null,
      ownerEmail: null,
      githubOrg: null,
      githubRepoUrl: null,
      linearTeamId: null,
    });
    mockGetCredentialValue.mockImplementation((_orgId: string, key: string) => {
      if (key === 'resend_api_key') return Promise.resolve('org-resend-key');
      if (key === 'github_token') return Promise.resolve('ghp_orgtoken');
      return Promise.resolve(null);
    });
    process.env.EMAIL_DOMAIN = 'env.example.com';
    process.env.OWNER_EMAIL = 'owner@env.example.com';
    process.env.GITHUB_ORG = 'env-org';

    const creds = await resolveCredentials('org-1');

    expect(creds.resendApiKey).toBe('org-resend-key');
    expect(creds.emailDomain).toBe('env.example.com');
    expect(creds.ownerEmail).toBe('owner@env.example.com');
    expect(creds.githubToken).toBe('ghp_orgtoken');
    expect(creds.githubOrg).toBe('env-org');
    expect(creds.githubRepoUrl).toBeUndefined();
    expect(creds.linearApiKey).toBeUndefined();
    expect(creds.linearTeamId).toBeUndefined();
  });

  it('returns undefined for all fields when no config, no credentials, and no env vars', async () => {
    mockGetOrgConfig.mockResolvedValue(null);

    const creds = await resolveCredentials('org-1');

    expect(creds.resendApiKey).toBeUndefined();
    expect(creds.emailDomain).toBeUndefined();
    expect(creds.ownerEmail).toBeUndefined();
    expect(creds.githubToken).toBeUndefined();
    expect(creds.githubOrg).toBeUndefined();
    expect(creds.githubRepoUrl).toBeUndefined();
    expect(creds.linearApiKey).toBeUndefined();
    expect(creds.linearTeamId).toBeUndefined();
  });

  it('calls getOrgConfig with the provided orgId', async () => {
    mockGetOrgConfig.mockResolvedValue(null);

    await resolveCredentials('org-42');

    expect(mockGetOrgConfig).toHaveBeenCalledWith('org-42');
  });

  it('prefers GitHub App token over static PAT', async () => {
    mockResolveGitHubAppToken.mockResolvedValue('ghs_app_token');
    mockGetOrgConfig.mockResolvedValue(null);
    mockGetCredentialValue.mockImplementation((_orgId: string, key: string) => {
      if (key === 'github_token') return Promise.resolve('ghp_static_pat');
      return Promise.resolve(null);
    });

    const creds = await resolveCredentials('org-1');

    expect(creds.githubToken).toBe('ghs_app_token');
  });

  it('falls back to static PAT when GitHub App token unavailable', async () => {
    mockResolveGitHubAppToken.mockResolvedValue(null);
    mockGetOrgConfig.mockResolvedValue(null);
    mockGetCredentialValue.mockImplementation((_orgId: string, key: string) => {
      if (key === 'github_token') return Promise.resolve('ghp_static_pat');
      return Promise.resolve(null);
    });

    const creds = await resolveCredentials('org-1');

    expect(creds.githubToken).toBe('ghp_static_pat');
  });
});
