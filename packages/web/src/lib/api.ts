import type {
  StartSessionResponse,
  SendMessageResponse,
  CompleteSessionResponse,
  SessionStatusResponse,
  PreceptsDraft,
} from '@precept/shared';

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:3001';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  startSession: () =>
    request<StartSessionResponse>('/api/onboarding/start', { method: 'POST' }),

  sendMessage: (sessionId: string, message: string) =>
    request<SendMessageResponse>('/api/onboarding/message', {
      method: 'POST',
      body: JSON.stringify({ sessionId, message }),
    }),

  completeSession: (sessionId: string, finalDraft: PreceptsDraft) =>
    request<CompleteSessionResponse>('/api/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId, finalDraft }),
    }),

  getSessionStatus: (sessionId: string) =>
    request<SessionStatusResponse>(`/api/onboarding/status?sessionId=${sessionId}`),
};
