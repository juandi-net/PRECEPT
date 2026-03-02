import { db } from './client.js';
import type { OnboardingSession, ConversationMessage, ExtractionTracker, ContextDocument } from '@precept/shared';
import type { PreceptsDraft } from '@precept/shared';

export async function createSession(): Promise<OnboardingSession> {
  const { data, error } = await db
    .from('onboarding_sessions')
    .insert({})
    .select()
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return mapSession(data);
}

export async function getSession(id: string): Promise<OnboardingSession | null> {
  const { data, error } = await db
    .from('onboarding_sessions')
    .select()
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get session: ${error.message}`);
  }
  return mapSession(data);
}

export async function updateSession(
  id: string,
  updates: {
    conversation?: ConversationMessage[];
    preceptsDraft?: PreceptsDraft;
    extractionTracker?: ExtractionTracker;
    status?: string;
    completedAt?: string;
    contextDocuments?: ContextDocument[] | null;
  }
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.conversation !== undefined) dbUpdates.conversation = updates.conversation;
  if (updates.preceptsDraft !== undefined) dbUpdates.precepts_draft = updates.preceptsDraft;
  if (updates.extractionTracker !== undefined) dbUpdates.extraction_tracker = updates.extractionTracker;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt;
  if (updates.contextDocuments !== undefined) dbUpdates.context_documents = updates.contextDocuments;

  const { error } = await db
    .from('onboarding_sessions')
    .update(dbUpdates)
    .eq('id', id);

  if (error) throw new Error(`Failed to update session: ${error.message}`);
}

function mapSession(row: Record<string, unknown>): OnboardingSession {
  return {
    id: row.id as string,
    status: row.status as OnboardingSession['status'],
    conversation: row.conversation as ConversationMessage[],
    preceptsDraft: row.precepts_draft as PreceptsDraft,
    extractionTracker: row.extraction_tracker as ExtractionTracker,
    contextDocuments: (row.context_documents as ContextDocument[] | null) ?? null,
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string | null,
  };
}
