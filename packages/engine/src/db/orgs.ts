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
