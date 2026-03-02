import type {
  StartSessionResponse,
  SendMessageResponse,
  CompleteSessionResponse,
  SessionStatusResponse,
  PreceptsDraft,
  ContextDocument,
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

  uploadDocuments: async (sessionId: string, files: File[]): Promise<{ documents: ContextDocument[] }> => {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    const res = await fetch(`${ENGINE_URL}/api/onboarding/${sessionId}/documents`, {
      method: 'POST',
      body: formData,
      // Note: do NOT set Content-Type header — browser sets it with boundary for multipart
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `API error: ${res.status}`);
    }

    return res.json();
  },

  removeDocument: async (sessionId: string, index: number): Promise<{ documents: ContextDocument[] }> => {
    const res = await fetch(`${ENGINE_URL}/api/onboarding/${sessionId}/documents/${index}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `API error: ${res.status}`);
    }

    return res.json();
  },
};
