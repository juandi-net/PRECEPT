import jwt from 'jsonwebtoken';

interface AppCredentials {
  appId: number;
  privateKey: string;
}

interface InstallationCredentials extends AppCredentials {
  installationId: number;
}

/**
 * Generate a JWT for authenticating as the GitHub App.
 * JWTs are short-lived (10 minutes max per GitHub docs).
 */
export function generateAppJwt({ appId, privateKey }: AppCredentials): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iat: now - 60, // 60s clock drift allowance
      exp: now + 600, // 10 minutes
      iss: appId,
    },
    privateKey,
    { algorithm: 'RS256' },
  );
}

/**
 * Get an installation access token for a GitHub App installation.
 * Mints a fresh token each invocation — tokens are short-lived by design.
 */
export async function getInstallationToken(creds: InstallationCredentials): Promise<string> {
  const appJwt = generateAppJwt(creds);

  const response = await fetch(
    `https://api.github.com/app/installations/${creds.installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub installation token request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { token: string; expires_at: string };

  return data.token;
}

/**
 * Resolve a GitHub token for an org via its GitHub App installation.
 * Returns null if the org has no app or no installation configured.
 */
export async function resolveGitHubAppToken(orgId: string): Promise<string | null> {
  const { getGitHubAppCredentials } = await import('../db/orgs.js');

  const appCreds = await getGitHubAppCredentials(orgId);
  if (!appCreds?.installationId) return null;

  try {
    return await getInstallationToken({
      appId: appCreds.appId,
      privateKey: appCreds.pem,
      installationId: appCreds.installationId,
    });
  } catch (err) {
    console.error(`[github-app] Installation token failed for org ${orgId}, falling back to PAT:`, err);
    return null;
  }
}
