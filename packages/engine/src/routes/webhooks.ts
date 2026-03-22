import { Hono } from 'hono';
import { Resend } from 'resend';
import { engine } from './orchestration.js';
import { getLatestBriefingThread, getThreadByMessageId, getThreadBySubject, getThreadMessageIds, insertEmailMessage } from '../db/email-threads.js';
import { getOrgIdByEmailDomain, getOrg } from '../db/orgs.js';
import { resolveCredentials } from '../lib/credentials.js';
import { respondToBoardRequestByThreadId } from '../db/boardRequests.js';
import { logEvent } from '../db/audit.js';
import { CEOService } from '../services/ceo.js';
import { sendEmailReply, replyToHtml } from '../lib/email.js';

export const webhooks = new Hono();

/** Extract base domain from "ceo@mail.example.com" -> "example.com" */
function extractBaseDomain(emailAddress: string): string | null {
  const match = emailAddress.match(/@(?:mail\.)?(.+)$/i);
  return match?.[1] ?? null;
}

/** Extract a named header from the Resend email headers (handles array or object format) */
function extractHeader(headers: unknown, name: string): string | null {
  if (!headers) return null;

  // Array format: [{ name: "In-Reply-To", value: "<msg-id>" }]
  if (Array.isArray(headers)) {
    const header = headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
    return header?.value ?? null;
  }

  // Object format: { "In-Reply-To": "<msg-id>" }
  if (typeof headers === 'object') {
    const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
    return key ? (headers as Record<string, string>)[key] : null;
  }

  return null;
}

webhooks.post('/resend', async (c) => {
  const payload = await c.req.json();

  if (payload?.type !== 'email.received') {
    return c.json({ status: 'ignored', type: payload?.type });
  }

  const emailId = payload?.data?.email_id;
  if (!emailId) {
    return c.json({ error: 'No email_id in payload' }, 400);
  }

  // Route by recipient domain
  const toAddress: string = payload?.data?.to?.[0] ?? '';
  const baseDomain = extractBaseDomain(toAddress);
  let orgId: string | null = null;

  if (baseDomain) {
    orgId = await getOrgIdByEmailDomain(baseDomain);
    if (!orgId) {
      console.warn(`[webhook] No org for domain "${baseDomain}" — using DEFAULT_ORG_ID`);
    }
  }

  if (!orgId) {
    orgId = process.env.DEFAULT_ORG_ID ?? 'org-1';
  }

  // Use org-specific Resend key
  const creds = await resolveCredentials(orgId);
  const resendApiKey = creds.resendApiKey;

  if (!resendApiKey) {
    console.error('[webhook] No Resend API key for org', orgId);
    return c.json({ error: 'No Resend API key configured' }, 500);
  }

  const resend = new Resend(resendApiKey);
  const { data: email, error } = await resend.emails.receiving.get(emailId);
  if (error || !email) {
    console.error('[webhook] Resend fetch error:', JSON.stringify(error), 'emailId:', emailId);
    return c.json({ error: 'Failed to fetch email content' }, 500);
  }

  const content = email.text ?? email.html ?? '';
  if (!content) {
    return c.json({ error: 'No reply content found' }, 400);
  }

  // --- Thread-aware matching ---
  let threadId: string | null = null;
  let threadType: string | null = null;
  let matchMethod: 'in_reply_to' | 'subject_match' | 'fallback_briefing' = 'fallback_briefing';

  const inReplyTo = extractHeader((email as any).headers, 'In-Reply-To');

  if (inReplyTo) {
    const match = await getThreadByMessageId(inReplyTo);
    if (match) {
      threadId = match.threadId;
      threadType = match.threadType;
      matchMethod = 'in_reply_to';
    }
  }

  // Fallback: subject-based matching (handles SES Message-ID mismatch)
  if (!threadId) {
    const subject: string = payload?.data?.subject ?? '';
    if (subject) {
      const match = await getThreadBySubject(orgId, subject);
      if (match) {
        threadId = match.threadId;
        threadType = match.threadType;
        matchMethod = 'subject_match';
      }
    }
  }

  // Fallback: existing briefing behavior
  if (!threadId) {
    const latestThread = await getLatestBriefingThread(orgId);
    if (latestThread) {
      threadId = latestThread.thread.id;
      threadType = 'briefing';
    }
  }

  try {
    // Store inbound message
    if (threadId) {
      await insertEmailMessage({
        threadId, orgId, direction: 'inbound', senderRole: 'owner',
        content, resendEmailId: emailId, resendMessageId: payload?.data?.message_id ?? null,
      });
    }

    // Route by thread type
    switch (threadType) {
      case 'briefing':
        engine.push({
          type: 'owner_reply', orgId,
          briefingId: payload?.data?.subject ?? 'unknown',
          content, threadId: threadId ?? null,
        });
        break;

      case 'adhoc':
      case 'escalation':
      case 'board_request': {
        // Board requests: update status
        if (threadType === 'board_request' && threadId) {
          await respondToBoardRequestByThreadId(threadId, content);
        }

        // Full CEO invocation — same tools and authority as chat
        if (threadId) {
          const ceo = new CEOService();
          const replyText = await ceo.handleEmailReply(orgId, content);

          const org = await getOrg(orgId);
          const orgName = org?.name ?? orgId;
          const messageIds = await getThreadMessageIds(threadId);
          const lastMessageId = messageIds[messageIds.length - 1] ?? '';
          const subject: string = payload?.data?.subject ?? '';

          const sendResult = await sendEmailReply({
            to: creds.ownerEmail ?? 'owner@org',
            orgName,
            htmlContent: replyToHtml(replyText),
            subject,
            inReplyTo: lastMessageId,
            references: messageIds,
            resendApiKey: creds.resendApiKey,
            emailDomain: creds.emailDomain,
          });

          if (sendResult) {
            await insertEmailMessage({
              threadId, orgId,
              direction: 'outbound',
              senderRole: 'ceo',
              content: replyText,
              resendEmailId: sendResult.emailId,
              resendMessageId: sendResult.messageId,
            });
            console.log(`[webhook] CEO reply sent in ${threadType} thread ${threadId.slice(0, 8)}`);
          }
        }
        break;
      }

      default:
        // No thread matched at all — push as owner_reply anyway
        engine.push({
          type: 'owner_reply', orgId,
          briefingId: payload?.data?.subject ?? 'unknown',
          content, threadId: null,
        });
        break;
    }
  } catch (err) {
    console.error('[webhook] Routing error:', err, { orgId, threadId, threadType, emailId });
    return c.json({ error: 'Failed to process inbound email' }, 500);
  }

  // Audit log
  await logEvent(orgId, 'email.inbound', 'webhook', {
    threadId, threadType, matchMethod, emailId,
  });

  return c.json({ status: 'received', event: 'email.inbound', orgId, threadType, matchMethod });
});
