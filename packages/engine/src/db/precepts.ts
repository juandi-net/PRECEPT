import { db } from './client.js';
import type { Precepts, PreceptsDraft } from '@precept/shared';

export async function createPrecepts(
  sessionId: string,
  content: PreceptsDraft
): Promise<Precepts> {
  const { data, error } = await db
    .from('precepts')
    .insert({
      session_id: sessionId,
      content,
      classification: 'internal',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create precepts: ${error.message}`);

  return {
    id: data.id,
    sessionId: data.session_id,
    version: data.version,
    content: data.content as PreceptsDraft,
    classification: data.classification,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
