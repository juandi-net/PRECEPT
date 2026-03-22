import { db } from './client.js';
import type { Cornerstone, CornerstoneDraft } from '@precept/shared';

export async function createCornerstone(
  sessionId: string,
  content: CornerstoneDraft
): Promise<Cornerstone> {
  const { data, error } = await db
    .from('cornerstone')
    .insert({
      session_id: sessionId,
      content,
      classification: 'internal',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create cornerstone: ${error.message}`);

  return {
    id: data.id,
    sessionId: data.session_id,
    version: data.version,
    content: data.content as CornerstoneDraft,
    classification: data.classification,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getLatestCornerstone(orgId: string): Promise<Cornerstone | null> {
  const { data, error } = await db
    .from('cornerstone')
    .select()
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get cornerstone: ${error.message}`);
  }

  return {
    id: data.id,
    sessionId: data.session_id,
    version: data.version,
    content: data.content as CornerstoneDraft,
    classification: data.classification,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
