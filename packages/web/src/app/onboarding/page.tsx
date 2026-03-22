'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ConversationMessage, CornerstoneDraft, ContextDocument } from '@precept/shared';
import { ChatPanel } from '../../components/chat/ChatPanel';
import { CornerstonePanel } from '../../components/cornerstone/CornerstonePanel';
import { ConfirmationView } from '../../components/cornerstone/ConfirmationView';
import { api } from '../../lib/api';
import './onboarding.css';

type ViewMode = 'interview' | 'confirmation' | 'complete';

export default function OnboardingPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState<CornerstoneDraft>({} as CornerstoneDraft);
  const [phase, setPhase] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('interview');
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ContextDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Start session on mount
  useEffect(() => {
    const start = async () => {
      try {
        setIsLoading(true);
        const result = await api.startSession();
        setSessionId(result.sessionId);
        setMessages([{
          role: 'ceo',
          content: result.message,
          timestamp: new Date().toISOString(),
        }]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    start();
  }, []);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!sessionId) return;

    // Optimistically add owner message
    const ownerMsg: ConversationMessage = {
      role: 'owner',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, ownerMsg]);
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.sendMessage(sessionId, message);

      setMessages((prev) => [
        ...prev,
        { role: 'ceo', content: result.message, timestamp: new Date().toISOString() },
      ]);
      setDraft(result.cornerstoneDraft);
      setPhase(result.phase);

      // Auto-transition to confirmation when CEO reaches phase 6
      if (result.phase >= 6) {
        setViewMode('confirmation');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const handleLockAndLaunch = useCallback(async (editedDraft: CornerstoneDraft) => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      await api.completeSession(sessionId, editedDraft);
      setViewMode('complete');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const handleUploadFiles = useCallback(async (files: File[]) => {
    if (!sessionId) return;
    setIsUploading(true);
    try {
      const result = await api.uploadDocuments(sessionId, files);
      setDocuments(result.documents);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  }, [sessionId]);

  const handleRemoveDocument = useCallback(async (index: number) => {
    if (!sessionId) return;
    try {
      const result = await api.removeDocument(sessionId, index);
      setDocuments(result.documents);
    } catch (err: any) {
      setError(err.message);
    }
  }, [sessionId]);

  if (viewMode === 'complete') {
    return (
      <div className="complete-page">
        <div>
          <h1 className="complete-title">You're all set.</h1>
          <p className="complete-subtitle">
            Your CEO has your Precepts and is preparing the first strategic plan.
          </p>
        </div>
      </div>
    );
  }

  if (viewMode === 'confirmation') {
    return <ConfirmationView draft={draft} onLockAndLaunch={handleLockAndLaunch} isLaunching={isLoading} />;
  }

  return (
    <div className="onboarding-page">
      {error && <div className="onboarding-error">{error}</div>}

      <div className="onboarding-chat-pane">
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          documents={documents}
          onUploadFiles={handleUploadFiles}
          onRemoveDocument={handleRemoveDocument}
          isUploading={isUploading}
        />
      </div>

      <div className="onboarding-precepts-pane">
        <CornerstonePanel draft={draft} />
      </div>
    </div>
  );
}
