import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks (available inside vi.mock factories) ---

const {
  mockGetThreadByMessageId,
  mockGetThreadBySubject,
  mockGetLatestBriefingThread,
  mockInsertEmailMessage,
  mockInsertChatMessage,
  mockRespondToBoardRequestByThreadId,
  mockGetOrgIdByEmailDomain,
  mockResolveCredentials,
  mockEnginePush,
  mockResendGet,
} = vi.hoisted(() => ({
  mockGetThreadByMessageId: vi.fn(),
  mockGetThreadBySubject: vi.fn(),
  mockGetLatestBriefingThread: vi.fn(),
  mockInsertEmailMessage: vi.fn(),
  mockInsertChatMessage: vi.fn(),
  mockRespondToBoardRequestByThreadId: vi.fn(),
  mockGetOrgIdByEmailDomain: vi.fn(),
  mockResolveCredentials: vi.fn(),
  mockEnginePush: vi.fn(),
  mockResendGet: vi.fn(),
}));

// --- Module mocks ---

vi.mock('../../ai/client.js', () => ({
  ai: {},
  MODELS: { opus: 'test-opus', sonnet: 'test-sonnet' },
}));

vi.mock('../../ai/invoke.js', () => ({
  invokeAgent: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({
  db: { from: vi.fn() },
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
  getRecentEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/email-threads.js', () => ({
  getThreadByMessageId: mockGetThreadByMessageId,
  getThreadBySubject: mockGetThreadBySubject,
  getLatestBriefingThread: mockGetLatestBriefingThread,
  insertEmailMessage: mockInsertEmailMessage,
}));

vi.mock('../../db/chat.js', () => ({
  insertChatMessage: mockInsertChatMessage,
}));

vi.mock('../../db/boardRequests.js', () => ({
  respondToBoardRequestByThreadId: mockRespondToBoardRequestByThreadId,
}));

vi.mock('../../db/orgs.js', () => ({
  getOrgIdByEmailDomain: mockGetOrgIdByEmailDomain,
}));

vi.mock('../../lib/credentials.js', () => ({
  resolveCredentials: mockResolveCredentials,
}));

vi.mock('../orchestration.js', () => {
  const { Hono } = require('hono');
  return {
    orchestration: new Hono(),
    engine: { push: mockEnginePush },
  };
});

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { receiving: { get: mockResendGet } },
  })),
}));

import { app } from '../../index.js';
import { logEvent } from '../../db/audit.js';

// --- Helpers ---

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'email.received',
    data: {
      email_id: 'email-001',
      message_id: 'msg-inbound-001',
      to: ['ceo@mail.example.com'],
      subject: 'Re: Daily Briefing',
      ...overrides,
    },
  };
}

function setupOrg() {
  mockGetOrgIdByEmailDomain.mockResolvedValue('org-1');
  mockResolveCredentials.mockResolvedValue({ resendApiKey: 'test-key' });
}

function setupResendEmail(headers: Record<string, string> = {}) {
  mockResendGet.mockResolvedValue({
    data: {
      text: 'Owner reply content',
      html: null,
      headers: Object.entries(headers).map(([name, value]) => ({ name, value })),
    },
    error: null,
  });
}

// --- Tests ---

describe('POST /api/webhooks/resend — thread-aware routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupOrg();
    mockInsertEmailMessage.mockResolvedValue({ id: 'em-1' });
    mockInsertChatMessage.mockResolvedValue({ id: 'cm-1' });
    mockGetThreadBySubject.mockResolvedValue(null);
  });

  it('routes to briefing path via In-Reply-To match', async () => {
    setupResendEmail({ 'In-Reply-To': '<outbound-msg-1>' });
    mockGetThreadByMessageId.mockResolvedValue({
      threadId: 'thread-briefing',
      threadType: 'briefing',
    });

    const res = await app.request('/api/webhooks/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makePayload()),
    });

    expect(res.status).toBe(200);
    expect(mockGetThreadByMessageId).toHaveBeenCalledWith('<outbound-msg-1>');
    expect(mockGetLatestBriefingThread).not.toHaveBeenCalled();
    expect(mockEnginePush).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'owner_reply',
        orgId: 'org-1',
        content: 'Owner reply content',
        threadId: 'thread-briefing',
      })
    );
    expect(mockInsertEmailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: 'thread-briefing',
        direction: 'inbound',
        senderRole: 'owner',
      })
    );
  });

  it('routes adhoc reply to chat message (not engine)', async () => {
    setupResendEmail({ 'In-Reply-To': '<outbound-msg-2>' });
    mockGetThreadByMessageId.mockResolvedValue({
      threadId: 'thread-adhoc',
      threadType: 'adhoc',
    });

    const res = await app.request('/api/webhooks/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makePayload()),
    });

    expect(res.status).toBe(200);
    expect(mockInsertChatMessage).toHaveBeenCalledWith('org-1', 'owner', 'Owner reply content', 'owner');
    expect(mockEnginePush).not.toHaveBeenCalled();
  });

  it('routes escalation reply to chat message (not engine)', async () => {
    setupResendEmail({ 'In-Reply-To': '<outbound-msg-3>' });
    mockGetThreadByMessageId.mockResolvedValue({
      threadId: 'thread-esc',
      threadType: 'escalation',
    });

    const res = await app.request('/api/webhooks/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makePayload()),
    });

    expect(res.status).toBe(200);
    expect(mockInsertChatMessage).toHaveBeenCalledWith('org-1', 'owner', 'Owner reply content', 'owner');
    expect(mockEnginePush).not.toHaveBeenCalled();
  });

  it('routes board_request reply: updates board request + chat message', async () => {
    setupResendEmail({ 'In-Reply-To': '<outbound-msg-4>' });
    mockGetThreadByMessageId.mockResolvedValue({
      threadId: 'thread-br',
      threadType: 'board_request',
    });
    mockRespondToBoardRequestByThreadId.mockResolvedValue(true);

    const res = await app.request('/api/webhooks/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makePayload()),
    });

    expect(res.status).toBe(200);
    expect(mockRespondToBoardRequestByThreadId).toHaveBeenCalledWith('thread-br', 'Owner reply content');
    expect(mockInsertChatMessage).toHaveBeenCalledWith('org-1', 'owner', 'Owner reply content', 'owner');
    expect(mockEnginePush).not.toHaveBeenCalled();
  });

  it('falls back to getLatestBriefingThread when no In-Reply-To header', async () => {
    setupResendEmail({}); // no In-Reply-To
    mockGetLatestBriefingThread.mockResolvedValue({
      thread: { id: 'thread-fallback', thread_type: 'briefing' },
      messages: [],
    });

    const res = await app.request('/api/webhooks/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makePayload()),
    });

    expect(res.status).toBe(200);
    expect(mockGetThreadByMessageId).not.toHaveBeenCalled();
    expect(mockGetLatestBriefingThread).toHaveBeenCalledWith('org-1');
    expect(mockEnginePush).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'owner_reply', threadId: 'thread-fallback' })
    );
  });

  it('falls back when In-Reply-To present but no DB match', async () => {
    setupResendEmail({ 'In-Reply-To': '<unknown-msg>' });
    mockGetThreadByMessageId.mockResolvedValue(null);
    mockGetLatestBriefingThread.mockResolvedValue({
      thread: { id: 'thread-fallback-2', thread_type: 'briefing' },
      messages: [],
    });

    const res = await app.request('/api/webhooks/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makePayload()),
    });

    expect(res.status).toBe(200);
    expect(mockGetLatestBriefingThread).toHaveBeenCalledWith('org-1');
    expect(mockEnginePush).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'owner_reply', threadId: 'thread-fallback-2' })
    );
  });

  it('falls back to subject matching when In-Reply-To has no DB match', async () => {
    setupResendEmail({ 'In-Reply-To': '<ses-msg-id@email.amazonses.com>' });
    mockGetThreadByMessageId.mockResolvedValue(null); // SES ID doesn't match
    mockGetThreadBySubject.mockResolvedValue({
      threadId: 'thread-subj',
      threadType: 'adhoc',
    });

    const res = await app.request('/api/webhooks/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makePayload({ subject: 'Re: Sensor Purchase Links' })),
    });

    expect(res.status).toBe(200);
    expect(mockGetThreadBySubject).toHaveBeenCalledWith('org-1', 'Re: Sensor Purchase Links');
    expect(mockInsertChatMessage).toHaveBeenCalledWith('org-1', 'owner', 'Owner reply content', 'owner');
    expect(mockGetLatestBriefingThread).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      'org-1', 'email.inbound', 'webhook',
      expect.objectContaining({ matchMethod: 'subject_match' })
    );
  });

  it('extracts In-Reply-To from object-format headers', async () => {
    // Resend may return headers as { "In-Reply-To": "<msg>" } instead of array
    mockResendGet.mockResolvedValue({
      data: {
        text: 'Owner reply content',
        html: null,
        headers: { 'In-Reply-To': '<outbound-msg-obj>' },
      },
      error: null,
    });
    mockGetThreadByMessageId.mockResolvedValue({
      threadId: 'thread-obj',
      threadType: 'adhoc',
    });

    const res = await app.request('/api/webhooks/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makePayload()),
    });

    expect(res.status).toBe(200);
    expect(mockGetThreadByMessageId).toHaveBeenCalledWith('<outbound-msg-obj>');
    expect(mockInsertChatMessage).toHaveBeenCalledWith('org-1', 'owner', 'Owner reply content', 'owner');
  });

  it('logs email.inbound audit event with match method', async () => {
    setupResendEmail({ 'In-Reply-To': '<outbound-msg-5>' });
    mockGetThreadByMessageId.mockResolvedValue({
      threadId: 'thread-log',
      threadType: 'adhoc',
    });

    await app.request('/api/webhooks/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makePayload()),
    });

    expect(logEvent).toHaveBeenCalledWith(
      'org-1',
      'email.inbound',
      'webhook',
      expect.objectContaining({
        threadId: 'thread-log',
        threadType: 'adhoc',
        matchMethod: 'in_reply_to',
      })
    );
  });
});
