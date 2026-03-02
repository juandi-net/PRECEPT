import type { PreceptsDraft } from './precepts';
import type { ContextDocument } from './documents';

export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface OnboardingSession {
  id: string;
  status: SessionStatus;
  conversation: ConversationMessage[];
  preceptsDraft: PreceptsDraft;
  extractionTracker: ExtractionTracker;
  contextDocuments: ContextDocument[] | null;
  startedAt: string;
  completedAt: string | null;
}

export interface ConversationMessage {
  role: 'owner' | 'ceo';
  content: string;
  timestamp: string;
}

export interface ExtractionTracker {
  coveredTopics: string[];
  currentPhase: number; // 1-6
  fieldsExtracted: string[];
  fieldsRemaining: string[];
  activeThread: string | null; // what the CEO is currently exploring
}

// API request/response types
export interface StartSessionResponse {
  sessionId: string;
  message: string; // CEO's opening message
}

export interface SendMessageRequest {
  sessionId: string;
  message: string;
}

export interface SendMessageResponse {
  message: string; // CEO's reply
  preceptsDraft: PreceptsDraft;
  phase: number;
}

export interface CompleteSessionRequest {
  sessionId: string;
  finalDraft: PreceptsDraft; // owner-edited draft from confirmation phase
}

export interface CompleteSessionResponse {
  preceptsId: string;
}

export interface SessionStatusResponse {
  session: OnboardingSession;
}
