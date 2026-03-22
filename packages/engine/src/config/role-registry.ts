import type { RoleConfig } from '@precept/shared';
import { db } from '../db/client.js';

function mapRow(row: Record<string, unknown>): RoleConfig {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    role: row.role as string,
    tier: row.tier as RoleConfig['tier'],
    modelTier: row.model_tier as string,
    modelOverride: (row.model_override as string) ?? null,
    endpointOverride: (row.endpoint_override as string) ?? null,
    contextIncludes: (row.context_includes as string[]) ?? [],
    contextExcludes: (row.context_excludes as string[]) ?? [],
    evaluationPath: (row.evaluation_path as string) ?? null,
    escalationTarget: (row.escalation_target as string) ?? null,
    separationPolicy: row.separation_policy as RoleConfig['separationPolicy'],
    trustAutonomy: row.trust_autonomy as RoleConfig['trustAutonomy'],
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? null,
  };
}

export class RoleRegistry {
  private cache: Map<string, RoleConfig[]> = new Map();

  /** Load all role configs for an org. Cached per org. */
  async getAll(orgId: string): Promise<RoleConfig[]> {
    const cached = this.cache.get(orgId);
    if (cached) return cached;

    const { data, error } = await db
      .from('role_config')
      .select()
      .eq('org_id', orgId);

    if (error) throw new Error(`Failed to load role config: ${error.message}`);
    const configs = (data ?? []).map(mapRow);
    this.cache.set(orgId, configs);
    return configs;
  }

  /** Get config for a specific role. */
  async get(orgId: string, role: string): Promise<RoleConfig | null> {
    const all = await this.getAll(orgId);
    return all.find(c => c.role === role) ?? null;
  }

  /** Get model tier for a role, with override support. */
  async getModel(orgId: string, role: string): Promise<string> {
    const config = await this.get(orgId, role);
    return config?.modelOverride ?? config?.modelTier ?? 'sonnet'; // safe default
  }

  /** Get endpoint override for a role, or null to use default CLIProxy. */
  async getEndpoint(orgId: string, role: string): Promise<string | null> {
    const config = await this.get(orgId, role);
    return config?.endpointOverride ?? null;
  }

  /** Check if a context key is excluded for a role. */
  async isExcluded(orgId: string, role: string, contextKey: string): Promise<boolean> {
    const config = await this.get(orgId, role);
    return config?.contextExcludes.includes(contextKey) ?? false;
  }

  /** Invalidate cache (call on config update). */
  invalidate(orgId?: string): void {
    if (orgId) {
      this.cache.delete(orgId);
    } else {
      this.cache.clear();
    }
  }
}

// Singleton
export const roleRegistry = new RoleRegistry();
