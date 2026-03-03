import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ai, MODELS } from '../ai/client.js';
import { buildMessages, buildOpeningMessages } from '../ai/prompts/ceo-onboarding.js';
import * as onboardingDb from '../db/onboarding.js';
import * as preceptsDb from '../db/precepts.js';
import * as auditDb from '../db/audit.js';
import { SeedSkillService } from './skills.js';
import type {
  StartSessionResponse,
  SendMessageResponse,
  CompleteSessionResponse,
  ConversationMessage,
  ExtractionTracker,
  OnboardingSession,
  ContextDocument,
} from '@precept/shared';
import { PRECEPTS_FIELDS, FIELD_LABELS, extractText, ALLOWED_MIME_TYPES, type PreceptsDraft, type PreceptsField, type PreceptsFieldName } from '@precept/shared';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const MONOREPO_ROOT = join(__dirname, '..', '..', '..', '..');

const AGENT_ID = 'ceo-onboarding';

interface CEOResponse {
  message: string;
  updatedTracker: ExtractionTracker;
  updatedFields: Record<string, PreceptsField>;
}

interface CEOCallResult {
  parsed: CEOResponse;
  rawContent: string;
}

export class OnboardingService {
  async startSession(): Promise<StartSessionResponse> {
    const session = await onboardingDb.createSession();

    const initialTracker: ExtractionTracker = {
      coveredTopics: [],
      currentPhase: 1,
      fieldsExtracted: [],
      fieldsRemaining: [...PRECEPTS_FIELDS],
      activeThread: null,
    };

    const messages = buildOpeningMessages();
    const { parsed: ceoResponse, rawContent } = await this.callCEO(messages, initialTracker);

    // Save CEO's opening message and tracker state
    const conversation: ConversationMessage[] = [
      { role: 'ceo', content: ceoResponse.message, timestamp: new Date().toISOString(), rawResponse: rawContent },
    ];

    await onboardingDb.updateSession(session.id, {
      conversation,
      extractionTracker: ceoResponse.updatedTracker,
    });

    await auditDb.logEvent('onboarding.session_started', AGENT_ID, {
      sessionId: session.id,
    });

    return {
      sessionId: session.id,
      message: ceoResponse.message,
    };
  }

  async sendMessage(sessionId: string, ownerMessage: string): Promise<SendMessageResponse> {
    const session = await onboardingDb.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== 'in_progress') throw new Error(`Session is ${session.status}`);

    // Append owner message to conversation
    const conversation: ConversationMessage[] = [
      ...session.conversation,
      { role: 'owner', content: ownerMessage, timestamp: new Date().toISOString() },
    ];

    // Build prompt with tracker context and call CEO
    const messages = buildMessages(conversation, session.extractionTracker, session.preceptsDraft, session.contextDocuments);
    const { parsed: ceoResponse, rawContent } = await this.callCEO(messages, session.extractionTracker);

    // Merge updated fields into draft
    const updatedDraft = { ...session.preceptsDraft };
    for (const [key, field] of Object.entries(ceoResponse.updatedFields)) {
      updatedDraft[key as keyof PreceptsDraft] = field;
    }

    // Append CEO response to conversation
    conversation.push({
      role: 'ceo',
      content: ceoResponse.message,
      timestamp: new Date().toISOString(),
      rawResponse: rawContent,
    });

    // Persist state
    await onboardingDb.updateSession(sessionId, {
      conversation,
      preceptsDraft: updatedDraft,
      extractionTracker: ceoResponse.updatedTracker,
    });

    await auditDb.logEvent('onboarding.message_sent', AGENT_ID, {
      sessionId,
      phase: ceoResponse.updatedTracker.currentPhase,
    });

    return {
      message: ceoResponse.message,
      preceptsDraft: updatedDraft,
      phase: ceoResponse.updatedTracker.currentPhase,
    };
  }

  async completeSession(sessionId: string, finalDraft: PreceptsDraft): Promise<CompleteSessionResponse> {
    const session = await onboardingDb.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== 'in_progress') throw new Error(`Session is ${session.status}`);

    // Diff CEO draft vs owner-edited draft for audit
    const ceoDraft = session.preceptsDraft;
    const contentChanges: string[] = [];
    const stateChanges: string[] = [];

    for (const fieldName of PRECEPTS_FIELDS) {
      const ceoField = ceoDraft[fieldName];
      const ownerField = finalDraft[fieldName];

      // Skip if both null
      if (!ceoField && !ownerField) continue;

      // Field added or removed
      if (!ceoField || !ownerField) {
        contentChanges.push(fieldName);
        continue;
      }

      if (ceoField.content !== ownerField.content) {
        contentChanges.push(fieldName);
      }
      if (ceoField.state !== ownerField.state) {
        stateChanges.push(fieldName);
      }
    }

    await auditDb.logEvent('onboarding.confirmation_edits', AGENT_ID, {
      sessionId,
      contentChanges,
      stateChanges,
    });

    // Use the owner-edited draft from the confirmation phase, not the DB version
    const precepts = await preceptsDb.createPrecepts(sessionId, finalDraft);

    // Mark session as completed
    await onboardingDb.updateSession(sessionId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    await auditDb.logEvent('onboarding.session_completed', AGENT_ID, { sessionId });
    await auditDb.logEvent('precepts.created', AGENT_ID, {
      preceptsId: precepts.id,
      sessionId,
    });

    // Write PRECEPTS.md to org-scoped path: data/orgs/{slug}/PRECEPTS.md
    await writePreceptsFile(finalDraft, 'ROOKIE');

    // Generate seed skill files from Precepts content
    const skillService = new SeedSkillService();
    await skillService.generateSeedSkills(finalDraft);

    return { preceptsId: precepts.id };
  }

  async getSessionStatus(sessionId: string): Promise<OnboardingSession | null> {
    return onboardingDb.getSession(sessionId);
  }

  async addDocuments(
    sessionId: string,
    files: Array<{ buffer: Buffer; filename: string; mimeType: string }>
  ): Promise<ContextDocument[]> {
    const session = await onboardingDb.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== 'in_progress') throw new Error(`Session is ${session.status}`);

    const newDocs: ContextDocument[] = [];
    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.mimeType as any)) {
        throw new Error(`Unsupported file type: ${file.mimeType}`);
      }
      const content = await extractText(file.buffer, file.mimeType);
      newDocs.push({
        filename: file.filename,
        mimeType: file.mimeType,
        content,
        uploadedAt: new Date().toISOString(),
      });
    }

    const updated = [...(session.contextDocuments ?? []), ...newDocs];
    await onboardingDb.updateSession(sessionId, { contextDocuments: updated });

    await auditDb.logEvent('onboarding.documents_added', AGENT_ID, {
      sessionId,
      filenames: newDocs.map((d) => d.filename),
    });

    return updated;
  }

  async removeDocument(sessionId: string, index: number): Promise<ContextDocument[]> {
    const session = await onboardingDb.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== 'in_progress') throw new Error(`Session is ${session.status}`);

    const docs = session.contextDocuments ?? [];
    if (index < 0 || index >= docs.length) throw new Error(`Invalid document index: ${index}`);

    const removed = docs[index];
    const updated = docs.filter((_, i) => i !== index);
    await onboardingDb.updateSession(sessionId, {
      contextDocuments: updated.length > 0 ? updated : null,
    });

    await auditDb.logEvent('onboarding.document_removed', AGENT_ID, {
      sessionId,
      filename: removed.filename,
    });

    return updated;
  }

  private async callCEO(
    messages: Array<{ role: string; content: string }>,
    currentTracker: ExtractionTracker
  ): Promise<CEOCallResult> {
    const startMs = Date.now();

    const response = await ai.chat.completions.create({
      model: MODELS.opus,
      messages: messages as any,
      temperature: 0.7,
    });

    const latencyMs = Date.now() - startMs;

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty CEO response');

    const tokensIn = response.usage?.prompt_tokens ?? null;
    const tokensOut = response.usage?.completion_tokens ?? null;
    const tokensUsed = response.usage?.total_tokens ?? null;

    // Extract JSON from the LLM response, handling:
    // 1. Clean JSON
    // 2. JSON wrapped in markdown fences
    // 3. JSON preceded/followed by prose text
    const parsed = this.extractCEOResponse(content, currentTracker);

    await auditDb.logEvent('ai.call', AGENT_ID, {
      model: MODELS.opus,
      purpose: 'onboarding_interview',
      promptMessages: messages,
      responseRaw: content,
      responseParsed: parsed,
      latencyMs,
      tokensIn,
      tokensOut,
    }, tokensUsed ?? undefined);

    return { parsed, rawContent: content };
  }

  private extractCEOResponse(content: string, currentTracker: ExtractionTracker): CEOResponse {
    // Try 1: Strip markdown fences and parse
    const fenceStripped = content
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    try {
      return JSON.parse(fenceStripped) as CEOResponse;
    } catch {
      // continue to next strategy
    }

    // Try 2: Find the outermost JSON object in the response (handles prose wrapping)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as CEOResponse;
      } catch {
        // continue to fallback
      }
    }

    // Fallback: treat the whole response as the conversational message
    return {
      message: content,
      updatedTracker: currentTracker,
      updatedFields: {},
    };
  }
}

async function writePreceptsFile(draft: PreceptsDraft, orgSlug: string): Promise<void> {
  const sections: string[] = [];

  for (const fieldName of PRECEPTS_FIELDS) {
    const field = draft[fieldName];
    if (!field || !field.content) continue;

    const label = FIELD_LABELS[fieldName];
    const stateMarker = field.state !== 'confirmed' ? ` *(${field.state.replace('_', ' ')})*` : '';
    sections.push(`## ${label}${stateMarker}\n\n${field.content}`);
  }

  const date = new Date().toISOString().split('T')[0];
  const markdown = `# Precepts\n\nGenerated from onboarding session on ${date}.\n\n${sections.join('\n\n')}\n`;

  const orgDir = join(MONOREPO_ROOT, 'data', 'orgs', orgSlug);
  await mkdir(orgDir, { recursive: true });
  await writeFile(join(orgDir, 'PRECEPTS.md'), markdown, 'utf-8');
}
