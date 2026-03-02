'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ConversationMessage, PreceptsDraft } from '@precept/shared';
import { ChatPanel } from '../../components/chat/ChatPanel';
import { PreceptsPanel } from '../../components/precepts/PreceptsPanel';
import { ConfirmationView } from '../../components/precepts/ConfirmationView';
import { api } from '../../lib/api';

type ViewMode = 'interview' | 'confirmation' | 'complete';

export default function OnboardingPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState<PreceptsDraft>({} as PreceptsDraft);
  const [phase, setPhase] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('interview');
  const [error, setError] = useState<string | null>(null);

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
      setDraft(result.preceptsDraft);
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

  const handleLockAndLaunch = useCallback(async (editedDraft: PreceptsDraft) => {
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

  if (viewMode === 'complete') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-neutral-900">You're all set.</h1>
          <p className="text-neutral-500 mt-2">
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
    <div className="h-screen flex">
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm z-10">
          {error}
        </div>
      )}

      {/* Left: Chat */}
      <div className="w-1/2 border-r border-neutral-200">
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </div>

      {/* Right: Precepts builder */}
      <div className="w-1/2 bg-neutral-50">
        <PreceptsPanel draft={draft} />
      </div>
    </div>
  );
}
