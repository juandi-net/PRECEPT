import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../client.js', () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  return {
    db: {
      from: vi.fn(() => mockChain),
      __mockChain: mockChain,
    },
  };
});

import { db } from '../client.js';
import { getThreadByMessageId } from '../email-threads.js';

const mockChain = (db as any).__mockChain;

describe('getThreadByMessageId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the chain so from() returns it
    (db.from as any).mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
  });

  it('returns threadId and threadType when a matching message exists', async () => {
    mockChain.single.mockResolvedValue({
      data: {
        thread_id: 'thread-123',
        email_threads: { thread_type: 'adhoc' },
      },
      error: null,
    });

    const result = await getThreadByMessageId('resend-msg-abc');

    expect(db.from).toHaveBeenCalledWith('email_messages');
    expect(mockChain.select).toHaveBeenCalledWith('thread_id, email_threads(thread_type)');
    expect(mockChain.eq).toHaveBeenCalledWith('resend_message_id', 'resend-msg-abc');
    expect(result).toEqual({ threadId: 'thread-123', threadType: 'adhoc' });
  });

  it('returns null when no matching message is found', async () => {
    mockChain.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    });

    const result = await getThreadByMessageId('nonexistent-msg');
    expect(result).toBeNull();
  });

  it('returns null on any other error', async () => {
    mockChain.single.mockResolvedValue({
      data: null,
      error: { message: 'connection timeout' },
    });

    const result = await getThreadByMessageId('some-msg');
    expect(result).toBeNull();
  });
});
