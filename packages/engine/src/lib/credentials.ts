import { getOrgConfig } from '../db/orgs.js';
import { getCredentialValue } from '../db/credentials.js';
import { resolveGitHubAppToken } from './github-app.js';

export interface OrgCredentials {
  resendApiKey: string | undefined;
  emailDomain: string | undefined;
  ownerEmail: string | undefined;
  githubToken: string | undefined;
  githubOrg: string | undefined;
  githubRepoUrl: string | undefined;
  linearApiKey: string | undefined;
  linearTeamId: string | undefined;
}

export async function resolveCredentials(orgId: string): Promise<OrgCredentials> {
  const [config, resendApiKey, linearApiKey, githubTokenCred] = await Promise.all([
    getOrgConfig(orgId),
    getCredentialValue(orgId, 'resend_api_key'),
    getCredentialValue(orgId, 'linear_api_key'),
    getCredentialValue(orgId, 'github_token'),
  ]);

  // Prefer GitHub App installation token over static PAT
  const githubToken =
    (await resolveGitHubAppToken(orgId)) ??
    githubTokenCred ??
    process.env.GITHUB_TOKEN;

  return {
    resendApiKey: resendApiKey ?? process.env.RESEND_API_KEY,
    emailDomain: config?.emailDomain ?? process.env.EMAIL_DOMAIN,
    ownerEmail: config?.ownerEmail ?? process.env.OWNER_EMAIL,
    githubToken,
    githubOrg: config?.githubOrg ?? process.env.GITHUB_ORG,
    githubRepoUrl: config?.githubRepoUrl ?? process.env.GITHUB_REPO_URL,
    linearApiKey: linearApiKey ?? process.env.LINEAR_API_KEY,
    linearTeamId: config?.linearTeamId ?? process.env.LINEAR_TEAM_ID,
  };
}
