import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks ---

const {
  mockGetOrg,
  mockGetOrgConfig,
  mockGetGitHubAppCredentials,
  mockSaveGitHubAppCredentials,
  mockSaveGitHubInstallationId,
  mockLogEvent,
  mockGenerateAppJwt,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetOrg: vi.fn(),
  mockGetOrgConfig: vi.fn(),
  mockGetGitHubAppCredentials: vi.fn(),
  mockSaveGitHubAppCredentials: vi.fn(),
  mockSaveGitHubInstallationId: vi.fn(),
  mockLogEvent: vi.fn(),
  mockGenerateAppJwt: vi.fn().mockReturnValue('mock-jwt'),
  mockFetch: vi.fn(),
}));

// --- Module mocks ---

vi.mock('../../ai/client.js', () => ({
  ai: {},
  MODELS: { opus: 'test-opus', sonnet: 'test-sonnet' },
}));

vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({
  db: { from: vi.fn() },
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: mockLogEvent,
  getRecentEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/orgs.js', () => ({
  getOrg: mockGetOrg,
  getOrgConfig: mockGetOrgConfig,
  getOrgIdByEmailDomain: vi.fn(),
  getGitHubAppCredentials: mockGetGitHubAppCredentials,
  saveGitHubAppCredentials: mockSaveGitHubAppCredentials,
  saveGitHubInstallationId: mockSaveGitHubInstallationId,
}));

vi.mock('../../lib/github-app.js', () => ({
  generateAppJwt: mockGenerateAppJwt,
  getInstallationToken: vi.fn(),
  resolveGitHubAppToken: vi.fn().mockResolvedValue(null),
}));

vi.stubGlobal('fetch', mockFetch);

import { app } from '../../index.js';

// --- Tests ---

describe('GitHub App Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/github/app/setup', () => {
    it('returns 400 without orgId', async () => {
      const res = await app.request('/api/github/app/setup');
      expect(res.status).toBe(400);
    });

    it('returns 404 when org not found', async () => {
      mockGetOrg.mockResolvedValue(null);
      const res = await app.request('/api/github/app/setup?orgId=org-missing');
      expect(res.status).toBe(404);
    });

    it('returns 400 when org has no github_org', async () => {
      mockGetOrg.mockResolvedValue({ id: 'org-1', name: 'Test Org', slug: 'test-org' });
      mockGetOrgConfig.mockResolvedValue({ githubOrg: null });
      const res = await app.request('/api/github/app/setup?orgId=org-1');
      expect(res.status).toBe(400);
    });

    it('returns HTML with manifest form for valid org', async () => {
      mockGetOrg.mockResolvedValue({ id: 'org-1', name: 'Test Org', slug: 'test-org' });
      mockGetOrgConfig.mockResolvedValue({ githubOrg: 'test-org' });

      const res = await app.request('/api/github/app/setup?orgId=org-1');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('github.com/organizations/test-org/settings/apps/new');
      expect(html).toContain('test-worker');
    });
  });

  describe('GET /api/github/app/callback', () => {
    it('returns 400 without code or state', async () => {
      const res = await app.request('/api/github/app/callback');
      expect(res.status).toBe(400);
    });

    it('exchanges code and redirects to install page on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 99999,
          slug: 'test-worker',
          pem: 'pem-data',
          webhook_secret: 'whsec_123',
          client_id: 'Iv1.abc',
          client_secret: 'secret_abc',
          owner: { login: 'test-org' },
          html_url: 'https://github.com/apps/test-worker',
        }),
      });
      mockSaveGitHubAppCredentials.mockResolvedValue(undefined);
      mockLogEvent.mockResolvedValue(undefined);

      const res = await app.request('/api/github/app/callback?code=temp_code&state=org-1');
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('github.com/apps/test-worker/installations/new');
      expect(mockSaveGitHubAppCredentials).toHaveBeenCalledWith('org-1', expect.objectContaining({
        appId: 99999,
        slug: 'test-worker',
      }));
    });

    it('redirects to error page on GitHub API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => 'Code already used',
      });

      const res = await app.request('/api/github/app/callback?code=bad_code&state=org-1');
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('github=error');
    });
  });

  describe('POST /api/github/app/resolve-installation', () => {
    it('returns 400 without orgId', async () => {
      const res = await app.request('/api/github/app/resolve-installation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when no GitHub App configured', async () => {
      mockGetGitHubAppCredentials.mockResolvedValue(null);
      const res = await app.request('/api/github/app/resolve-installation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: 'org-1' }),
      });
      expect(res.status).toBe(404);
    });

    it('returns already_set when installation exists', async () => {
      mockGetGitHubAppCredentials.mockResolvedValue({
        appId: 12345,
        installationId: 67890,
        pem: 'pem',
      });
      const res = await app.request('/api/github/app/resolve-installation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: 'org-1' }),
      });
      const body = await res.json();
      expect(body.status).toBe('already_set');
    });

    it('resolves installation from GitHub API', async () => {
      mockGetGitHubAppCredentials.mockResolvedValue({
        appId: 12345,
        installationId: null,
        pem: 'pem',
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { id: 67890, account: { login: 'test-org' } },
        ]),
      });
      mockSaveGitHubInstallationId.mockResolvedValue(undefined);
      mockLogEvent.mockResolvedValue(undefined);

      const res = await app.request('/api/github/app/resolve-installation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: 'org-1' }),
      });
      const body = await res.json();
      expect(body.status).toBe('resolved');
      expect(body.installationId).toBe(67890);
      expect(mockSaveGitHubInstallationId).toHaveBeenCalledWith('org-1', 67890);
    });
  });
});
