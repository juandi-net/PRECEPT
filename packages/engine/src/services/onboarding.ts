import { ai, MODELS } from '../ai/client.js';
import { buildMessages, buildOpeningMessages } from '../ai/prompts/ceo-onboarding.js';
import * as onboardingDb from '../db/onboarding.js';
import * as preceptsDb from '../db/precepts.js';
import * as auditDb from '../db/audit.js';
import type {
  StartSessionResponse,
  SendMessageResponse,
  CompleteSessionResponse,
  ConversationMessage,
  ExtractionTracker,
  OnboardingSession,
} from '@precept/shared';
import { PRECEPTS_FIELDS, type PreceptsDraft, type PreceptsField, type PreceptsFieldName } from '@precept/shared';

const AGENT_ID = 'ceo-onboarding';

interface CEOResponse {
  message: string;
  updatedTracker: ExtractionTracker;
  updatedFields: Record<string, PreceptsField>;
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
    const ceoResponse = await this.callCEO(messages, initialTracker);

    // Save CEO's opening message and tracker state
    const conversation: ConversationMessage[] = [
      { role: 'ceo', content: ceoResponse.message, timestamp: new Date().toISOString() },
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
    const messages = buildMessages(conversation, session.extractionTracker, session.preceptsDraft);
    const ceoResponse = await this.callCEO(messages, session.extractionTracker);

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

    return { preceptsId: precepts.id };
  }

  async getSessionStatus(sessionId: string): Promise<OnboardingSession | null> {
    return onboardingDb.getSession(sessionId);
  }

  private async callCEO(
    messages: Array<{ role: string; content: string }>,
    currentTracker: ExtractionTracker
  ): Promise<CEOResponse> {
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

    let parsed: CEOResponse;
    try {
      parsed = JSON.parse(content) as CEOResponse;
    } catch {
      // If CEO didn't return valid JSON, wrap the raw text but preserve
      // the current tracker so accumulated interview progress isn't wiped
      parsed = {
        message: content,
        updatedTracker: currentTracker,
        updatedFields: {},
      };
    }

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

    return parsed;
  }
}
