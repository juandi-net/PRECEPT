import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null }),
    },
  })),
}));

import { sendBriefing, sendEmailReply, sendBatchBoardRequestEmail, letterToHtml } from '../email.js';

describe('sendBriefing', () => {
  const origKey = process.env.RESEND_API_KEY;
  const origDomain = process.env.RESEND_FROM_DOMAIN;

  afterEach(() => {
    if (origKey) process.env.RESEND_API_KEY = origKey; else delete process.env.RESEND_API_KEY;
    if (origDomain) process.env.RESEND_FROM_DOMAIN = origDomain; else delete process.env.RESEND_FROM_DOMAIN;
  });

  it('uses provided resendApiKey and emailDomain', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_DOMAIN;

    const result = await sendBriefing({
      to: 'owner@test.com', orgName: 'Test Org', date: new Date('2026-03-07'),
      boardRequestCount: 0, htmlContent: '<p>Hello</p>',
      resendApiKey: 'test-key-123', emailDomain: 'test.com',
    });
    expect(result).not.toBeNull();
  });

  it('falls back to env vars when credentials not provided', async () => {
    process.env.RESEND_API_KEY = 'env-key';

    const result = await sendBriefing({
      to: 'owner@test.com', orgName: 'Test Org', date: new Date('2026-03-07'),
      boardRequestCount: 0, htmlContent: '<p>Hello</p>',
    });
    expect(result).not.toBeNull();
  });

  it('returns null when no API key from either source', async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendBriefing({
      to: 'owner@test.com', orgName: 'Test Org', date: new Date('2026-03-07'),
      boardRequestCount: 0, htmlContent: '<p>Hello</p>',
    });
    expect(result).toBeNull();
  });
});

describe('sendEmailReply', () => {
  afterEach(() => { delete process.env.RESEND_API_KEY; });

  it('uses provided credentials', async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendEmailReply({
      to: 'owner@test.com', orgName: 'Test Org', htmlContent: '<p>Reply</p>',
      subject: 'Re: Briefing', inReplyTo: '<msg-1@resend.dev>', references: [],
      resendApiKey: 'test-key', emailDomain: 'test.com',
    });
    expect(result).not.toBeNull();
  });
});

describe('sendBatchBoardRequestEmail', () => {
  afterEach(() => { delete process.env.RESEND_API_KEY; });

  it('sends one email listing all board requests', async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendBatchBoardRequestEmail({
      to: 'owner@test.com',
      orgName: 'Test Org',
      requests: [
        { id: 'br-1', request: 'Hire a designer?', context: 'Design blocking launch', urgency: 'high', fallback: 'Proceed without' },
        { id: 'br-2', request: 'Increase budget?', context: 'Running low', urgency: 'medium', fallback: 'Cut features' },
      ],
      appUrl: 'https://app.example.com',
      resendApiKey: 'test-key',
      emailDomain: 'test.com',
    });
    expect(result).not.toBeNull();
    expect(result?.emailId).toBe('email-123');
  });

  it('returns null when no API key', async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendBatchBoardRequestEmail({
      to: 'owner@test.com',
      orgName: 'Test Org',
      requests: [
        { id: 'br-1', request: 'Test', context: 'ctx', urgency: 'low', fallback: 'skip' },
      ],
      appUrl: 'https://app.example.com',
    });
    expect(result).toBeNull();
  });

  it('handles singular board request in subject', async () => {
    const result = await sendBatchBoardRequestEmail({
      to: 'owner@test.com',
      orgName: 'Test Org',
      requests: [
        { id: 'br-1', request: 'Single request', context: 'ctx', urgency: 'low', fallback: 'skip' },
      ],
      appUrl: 'https://app.example.com',
      resendApiKey: 'test-key',
      emailDomain: 'test.com',
    });
    expect(result).not.toBeNull();
  });
});

describe('letterToHtml', () => {
  it('wraps letter in styled HTML', () => {
    const html = letterToHtml('Hello, this is your CEO.', 'Acme Corp');
    expect(html).toContain('Hello, this is your CEO.');
    expect(html).toContain("font-family: 'Times New Roman'");
  });

  it('converts markdown links to <a> tags', () => {
    const html = letterToHtml('The report is ready ([view](/inspect/task/abc123)).', 'Acme Corp');
    expect(html).toContain('<a href="/inspect/task/abc123"');
    expect(html).toContain('>view</a>');
  });

  it('handles multiple links', () => {
    const html = letterToHtml('See [report](/inspect/task/1) and [plan](/inspect/initiative/2).', 'Test Org');
    expect(html).toContain('<a href="/inspect/task/1"');
    expect(html).toContain('<a href="/inspect/initiative/2"');
  });

  it('handles letter with no links', () => {
    const html = letterToHtml('Everything is running smoothly.', 'Test Org');
    expect(html).not.toContain('<a ');
    expect(html).toContain('Everything is running smoothly.');
  });
});
