import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { invokeAgent } from '../ai/invoke.js';
import type { AgentResponse } from '../ai/invoke.js';
import { buildMessages, buildOpeningMessages } from '../ai/prompts/ceo-onboarding.js';
import * as onboardingDb from '../db/onboarding.js';
import * as cornerstoneDb from '../db/cornerstone.js';
import * as auditDb from '../db/audit.js';
import { getOrg } from '../db/orgs.js';
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
import { CORNERSTONE_FIELDS, FIELD_LABELS, extractText, ALLOWED_MIME_TYPES, type CornerstoneDraft, type CornerstoneField, type CornerstoneFieldName } from '@precept/shared';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const MONOREPO_ROOT = join(__dirname, '..', '..', '..', '..');

const AGENT_ID = 'ceo-onboarding';
const ORG_ID = process.env.DEFAULT_ORG_ID ?? 'onboarding';

interface CEOResponse {
  message: string;
  updatedTracker: ExtractionTracker;
  updatedFields: Record<string, CornerstoneField>;
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
      fieldsRemaining: [...CORNERSTONE_FIELDS],
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

    await auditDb.logEvent(ORG_ID, 'onboarding.session_started', AGENT_ID, {
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
    const messages = buildMessages(conversation, session.extractionTracker, session.cornerstoneDraft, session.contextDocuments);
    const { parsed: ceoResponse, rawContent } = await this.callCEO(messages, session.extractionTracker);

    // Merge updated fields into draft
    const updatedDraft = { ...session.cornerstoneDraft };
    for (const [key, field] of Object.entries(ceoResponse.updatedFields)) {
      updatedDraft[key as keyof CornerstoneDraft] = field;
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
      cornerstoneDraft: updatedDraft,
      extractionTracker: ceoResponse.updatedTracker,
    });

    await auditDb.logEvent(ORG_ID, 'onboarding.message_sent', AGENT_ID, {
      sessionId,
      phase: ceoResponse.updatedTracker.currentPhase,
    });

    return {
      message: ceoResponse.message,
      cornerstoneDraft: updatedDraft,
      phase: ceoResponse.updatedTracker.currentPhase,
    };
  }

  async completeSession(sessionId: string, finalDraft: CornerstoneDraft): Promise<CompleteSessionResponse> {
    const session = await onboardingDb.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== 'in_progress') throw new Error(`Session is ${session.status}`);

    // Diff CEO draft vs owner-edited draft for audit
    const ceoDraft = session.cornerstoneDraft;
    const contentChanges: string[] = [];
    const stateChanges: string[] = [];

    for (const fieldName of CORNERSTONE_FIELDS) {
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

    await auditDb.logEvent(ORG_ID, 'onboarding.confirmation_edits', AGENT_ID, {
      sessionId,
      contentChanges,
      stateChanges,
    });

    // Use the owner-edited draft from the confirmation phase, not the DB version
    const cornerstone = await cornerstoneDb.createCornerstone(sessionId, finalDraft);

    // Mark session as completed
    await onboardingDb.updateSession(sessionId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    await auditDb.logEvent(ORG_ID, 'onboarding.session_completed', AGENT_ID, { sessionId });
    await auditDb.logEvent(ORG_ID, 'cornerstone.created', AGENT_ID, {
      cornerstoneId: cornerstone.id,
      sessionId,
    });

    // Write CORNERSTONE.md to org-scoped path: data/orgs/{slug}/CORNERSTONE.md
    const org = await getOrg(ORG_ID);
    await writeCornerstoneFile(finalDraft, org?.slug ?? 'default');

    // Generate seed skill files from Cornerstone content
    const skillService = new SeedSkillService();
    await skillService.generateSeedSkills(finalDraft);

    return { cornerstoneId: cornerstone.id };
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

    await auditDb.logEvent(ORG_ID, 'onboarding.documents_added', AGENT_ID, {
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

    await auditDb.logEvent(ORG_ID, 'onboarding.document_removed', AGENT_ID, {
      sessionId,
      filename: removed.filename,
    });

    return updated;
  }

  private async callCEO(
    messages: Array<{ role: string; content: string }>,
    currentTracker: ExtractionTracker
  ): Promise<CEOCallResult> {
    // Partition: system messages → systemPrompt, user/assistant → messages array
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const systemPrompt = systemMessages.map(m => m.content).join('\n\n');

    const response = await invokeAgent(AGENT_ID, {
      orgId: ORG_ID,
      model: 'opus',
      systemPrompt,
      messages: conversationMessages,
      temperature: 0.7,
      jsonMode: true,
    });

    // Parse response — invokeAgent already handles JSON extraction
    const parsed = this.parseOnboardingResponse(response, currentTracker);

    return { parsed, rawContent: response.content };
  }

  private parseOnboardingResponse(response: AgentResponse, currentTracker: ExtractionTracker): CEOResponse {
    // invokeAgent with jsonMode already extracts JSON (fence stripping + regex)
    if (response.parsed?.message) {
      return response.parsed as unknown as CEOResponse;
    }

    // Fallback: treat raw content as the conversational message
    return {
      message: response.content,
      updatedTracker: currentTracker,
      updatedFields: {},
    };
  }
}

async function writeCornerstoneFile(draft: CornerstoneDraft, orgSlug: string): Promise<void> {
  const sections: string[] = [];

  for (const fieldName of CORNERSTONE_FIELDS) {
    const field = draft[fieldName];
    if (!field || !field.content) continue;

    const label = FIELD_LABELS[fieldName];
    const stateMarker = field.state !== 'confirmed' ? ` *(${field.state.replace('_', ' ')})*` : '';
    sections.push(`## ${label}${stateMarker}\n\n${field.content}`);
  }

  const date = new Date().toISOString().split('T')[0];
  const markdown = `# Cornerstone\n\nGenerated from onboarding session on ${date}.\n\n${sections.join('\n\n')}\n`;

  const orgDir = join(MONOREPO_ROOT, 'data', 'orgs', orgSlug);
  await mkdir(orgDir, { recursive: true });
  await writeFile(join(orgDir, 'CORNERSTONE.md'), markdown, 'utf-8');
}
