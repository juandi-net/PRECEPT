import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks ---

const { mockJwtSign, mockFetch } = vi.hoisted(() => ({
  mockJwtSign: vi.fn().mockReturnValue('mock-jwt'),
  mockFetch: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: { sign: mockJwtSign },
}));

// Replace global fetch
vi.stubGlobal('fetch', mockFetch);

import { generateAppJwt, getInstallationToken } from '../github-app.js';

const FAKE_PEM = '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----';

describe('generateAppJwt', () => {
  beforeEach(() => vi.clearAllMocks());

  it('signs a JWT with RS256 and correct claims', () => {
    const jwt = generateAppJwt({ appId: 12345, privateKey: FAKE_PEM });
    expect(jwt).toBe('mock-jwt');
    expect(mockJwtSign).toHaveBeenCalledWith(
      expect.objectContaining({ iss: 12345 }),
      FAKE_PEM,
      { algorithm: 'RS256' },
    );
  });
});

describe('getInstallationToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches a fresh token from GitHub', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'ghs_test_token',
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      }),
    });

    const token = await getInstallationToken({
      appId: 12345,
      privateKey: FAKE_PEM,
      installationId: 67890,
    });
    expect(token).toBe('ghs_test_token');
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/app/installations/67890/access_tokens',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('mints a fresh token on every call (no caching)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'ghs_first',
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'ghs_second',
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        }),
      });

    const token1 = await getInstallationToken({
      appId: 12345,
      privateKey: FAKE_PEM,
      installationId: 67890,
    });
    const token2 = await getInstallationToken({
      appId: 12345,
      privateKey: FAKE_PEM,
      installationId: 67890,
    });

    expect(token1).toBe('ghs_first');
    expect(token2).toBe('ghs_second');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on GitHub API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Bad credentials',
    });

    await expect(
      getInstallationToken({
        appId: 12345,
        privateKey: FAKE_PEM,
        installationId: 67890,
      }),
    ).rejects.toThrow('GitHub installation token request failed');
  });
});
