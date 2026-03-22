import { db } from './client.js';

export interface Org {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  status: 'active' | 'archived';
}

export interface CreateOrgParams {
  name: string;
  slug: string;
  ownerId: string;
}

function mapOrg(row: Record<string, unknown>): Org {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    ownerId: row.owner_id as string,
    createdAt: row.created_at as string,
    status: row.status as Org['status'],
  };
}

export async function getOrg(orgId: string): Promise<Org | null> {
  const { data, error } = await db
    .from('orgs')
    .select()
    .eq('id', orgId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get org: ${error.message}`);
  }
  return mapOrg(data);
}

export async function getOrgBySlug(slug: string): Promise<Org | null> {
  const { data, error } = await db
    .from('orgs')
    .select()
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get org by slug: ${error.message}`);
  }
  return mapOrg(data);
}

export async function createOrg(params: CreateOrgParams): Promise<Org> {
  const { data, error } = await db
    .from('orgs')
    .insert({
      name: params.name,
      slug: params.slug,
      owner_id: params.ownerId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create org: ${error.message}`);
  return mapOrg(data);
}

export interface OrgConfig {
  orgId: string;
  emailDomain: string | null;
  ownerEmail: string | null;
  githubOrg: string | null;
  githubRepoUrl: string | null;
  linearTeamId: string | null;
}

function mapOrgConfig(row: Record<string, unknown>): OrgConfig {
  return {
    orgId: row.org_id as string,
    emailDomain: row.email_domain as string | null,
    ownerEmail: row.owner_email as string | null,
    githubOrg: row.github_org as string | null,
    githubRepoUrl: row.github_repo_url as string | null,
    linearTeamId: row.linear_team_id as string | null,
  };
}

export async function getOrgConfig(orgId: string): Promise<OrgConfig | null> {
  const { data, error } = await db
    .from('org_config')
    .select()
    .eq('org_id', orgId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get org config: ${error.message}`);
  }
  return mapOrgConfig(data);
}

// --- GitHub App credentials ---

export interface GitHubAppCredentials {
  appId: number;
  slug: string;
  pem: string;
  webhookSecret: string;
  clientId: string;
  clientSecret: string;
  installationId: number | null;
}

/**
 * Fetch GitHub App credentials for an org.
 * Returns null if no app has been created via the manifest flow.
 */
export async function getGitHubAppCredentials(orgId: string): Promise<GitHubAppCredentials | null> {
  const { data, error } = await db
    .from('org_config')
    .select('github_app_id, github_app_slug, github_app_pem, github_app_webhook_secret, github_app_client_id, github_app_client_secret, github_installation_id')
    .eq('org_id', orgId)
    .single();

  if (error || !data?.github_app_id) return null;

  return {
    appId: data.github_app_id as number,
    slug: data.github_app_slug as string,
    pem: data.github_app_pem as string,
    webhookSecret: data.github_app_webhook_secret as string,
    clientId: data.github_app_client_id as string,
    clientSecret: data.github_app_client_secret as string,
    installationId: (data.github_installation_id as number) ?? null,
  };
}

/**
 * Save GitHub App credentials after manifest flow callback.
 */
export async function saveGitHubAppCredentials(
  orgId: string,
  creds: Omit<GitHubAppCredentials, 'installationId'>,
): Promise<void> {
  const { error } = await db
    .from('org_config')
    .update({
      github_app_id: creds.appId,
      github_app_slug: creds.slug,
      github_app_pem: creds.pem,
      github_app_webhook_secret: creds.webhookSecret,
      github_app_client_id: creds.clientId,
      github_app_client_secret: creds.clientSecret,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId);

  if (error) throw new Error(`Failed to save GitHub App credentials: ${error.message}`);
}

/**
 * Save the installation ID after the app is installed on the org's GitHub org.
 */
export async function saveGitHubInstallationId(orgId: string, installationId: number): Promise<void> {
  const { error } = await db
    .from('org_config')
    .update({
      github_installation_id: installationId,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId);

  if (error) throw new Error(`Failed to save GitHub installation ID: ${error.message}`);
}

export async function getOwnerLastSeen(orgId: string): Promise<Date | null> {
  const { data, error } = await db
    .from('orgs')
    .select('owner_last_seen_at')
    .eq('id', orgId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get owner presence: ${error.message}`);
  }
  return data.owner_last_seen_at ? new Date(data.owner_last_seen_at as string) : null;
}

export async function getOrgIdByEmailDomain(domain: string): Promise<string | null> {
  const { data, error } = await db
    .from('org_config')
    .select('org_id')
    .eq('email_domain', domain)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to find org by email domain: ${error.message}`);
  }
  return data.org_id as string;
}
