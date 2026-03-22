import { db } from './client.js';
import { getGitHubAppCredentials, getOrgConfig } from './orgs.js';

export interface CredentialEntry {
  service_key: string;
  status: 'verified' | 'unverified' | 'active' | 'revoked' | 'not_configured' | 'created_not_installed';
  provisioned_at: string;
  description?: string;
  setup_url?: string;
}

const GITHUB_APP_DESCRIPTION = 'GitHub App installation for repo access, PRs, issues, and Actions';

export async function storeCredential(orgId: string, serviceKey: string, value: string, description?: string): Promise<void> {
  const row: Record<string, string> = { org_id: orgId, service_key: serviceKey, credential_value: value };
  if (description !== undefined) row.description = description;

  const { error } = await db
    .from('org_credentials')
    .upsert(row, { onConflict: 'org_id,service_key' })
    .select()
    .single();

  if (error) throw new Error(`Failed to store credential: ${error.message}`);
}

export async function getCredentialValue(orgId: string, serviceKey: string): Promise<string | null> {
  const { data, error } = await db
    .from('org_credentials')
    .select('credential_value')
    .eq('org_id', orgId)
    .eq('service_key', serviceKey)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get credential: ${error.message}`);
  }
  return data?.credential_value ?? null;
}

export async function markCredentialVerified(orgId: string, serviceKey: string): Promise<void> {
  const { error } = await db
    .from('org_credentials')
    .update({ verified_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('service_key', serviceKey);

  if (error) throw new Error(`Failed to mark credential verified: ${error.message}`);
}

/**
 * Fetch all non-revoked credentials from org_credentials.
 * Used by the worker to inject all dynamic credentials into the task env.
 */
export async function getAllOrgCredentials(orgId: string): Promise<Record<string, string>> {
  const { data, error } = await db
    .from('org_credentials')
    .select('service_key, credential_value')
    .eq('org_id', orgId);

  if (error) throw new Error(`Failed to fetch org credentials: ${error.message}`);

  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    if ((row.credential_value as string).startsWith('REVOKED_BY_CEO_')) continue;
    result[row.service_key as string] = row.credential_value as string;
  }
  return result;
}

export async function listCredentials(orgId: string): Promise<CredentialEntry[]> {
  const { data: rows, error } = await db
    .from('org_credentials')
    .select('service_key, credential_value, provisioned_at, verified_at, description')
    .eq('org_id', orgId);

  if (error) throw new Error(`Failed to list credentials: ${error.message}`);

  const entries: CredentialEntry[] = (rows ?? []).map((row: { service_key: string; credential_value: string; provisioned_at: string; verified_at: string | null; description: string | null }) => {
    if (row.credential_value.startsWith('REVOKED_BY_CEO_')) {
      return { service_key: row.service_key, status: 'revoked' as const, provisioned_at: row.provisioned_at, ...(row.description ? { description: row.description } : {}) };
    }
    return {
      service_key: row.service_key,
      status: row.verified_at ? 'verified' as const : 'unverified' as const,
      provisioned_at: row.provisioned_at,
      ...(row.description ? { description: row.description } : {}),
    };
  });

  // GitHub App status — only shown when github_org is configured
  const config = await getOrgConfig(orgId);
  if (config?.githubOrg) {
    const appCreds = await getGitHubAppCredentials(orgId);
    if (appCreds?.installationId) {
      entries.push({ service_key: 'github_app', status: 'active', provisioned_at: '', description: GITHUB_APP_DESCRIPTION });
    } else if (appCreds) {
      entries.push({ service_key: 'github_app', status: 'created_not_installed', provisioned_at: '', description: GITHUB_APP_DESCRIPTION });
    } else {
      const engineUrl = process.env.ENGINE_PUBLIC_URL ?? 'http://localhost:3001';
      entries.push({
        service_key: 'github_app',
        status: 'not_configured',
        provisioned_at: '',
        description: GITHUB_APP_DESCRIPTION,
        setup_url: `${engineUrl}/api/github/app/setup?orgId=${orgId}`,
      });
    }
  }

  return entries;
}
