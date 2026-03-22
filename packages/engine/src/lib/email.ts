import { Resend } from 'resend';

export async function sendBriefing(params: {
  to: string;
  orgName: string;
  date: Date;
  boardRequestCount: number;
  htmlContent: string;
  headers?: Record<string, string>;
  resendApiKey?: string;
  emailDomain?: string;
}): Promise<{ emailId: string; messageId: string } | null> {
  const apiKey = params.resendApiKey ?? process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[email] No Resend API key — skipping send');
    return null;
  }
  const resend = new Resend(apiKey);
  const fromDomain = params.emailDomain
    ?? process.env.RESEND_FROM_DOMAIN
    ?? 'mail.example.com';

  const shortDate = params.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const requestSuffix = params.boardRequestCount > 0
    ? ` — ${params.boardRequestCount} Board Request${params.boardRequestCount === 1 ? '' : 's'}`
    : '';
  const subject = `${params.orgName} — Daily Briefing — ${shortDate}${requestSuffix}`;

  const { data, error } = await resend.emails.send({
    from: `CEO <ceo@${fromDomain}>`,
    to: params.to,
    subject,
    html: params.htmlContent,
    replyTo: `ceo@${fromDomain}`,
    headers: params.headers,
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }

  return {
    emailId: data?.id ?? '',
    messageId: data?.id ? `<${data.id}@resend.dev>` : '',
  };
}

export async function sendEmailReply(params: {
  to: string;
  orgName: string;
  htmlContent: string;
  subject: string;
  inReplyTo: string;
  references: string[];
  resendApiKey?: string;
  emailDomain?: string;
}): Promise<{ emailId: string; messageId: string } | null> {
  const apiKey = params.resendApiKey ?? process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[email] No Resend API key — skipping send');
    return null;
  }
  const resend = new Resend(apiKey);
  const fromDomain = params.emailDomain
    ?? process.env.RESEND_FROM_DOMAIN
    ?? 'mail.example.com';

  const { data, error } = await resend.emails.send({
    from: `CEO <ceo@${fromDomain}>`,
    to: params.to,
    subject: params.subject.startsWith('Re:') ? params.subject : `Re: ${params.subject}`,
    html: params.htmlContent,
    replyTo: `ceo@${fromDomain}`,
    headers: {
      'In-Reply-To': params.inReplyTo,
      'References': [...params.references, params.inReplyTo].join(' '),
    },
  });

  if (error) {
    throw new Error(`Resend reply failed: ${error.message}`);
  }

  return {
    emailId: data?.id ?? '',
    messageId: data?.id ? `<${data.id}@resend.dev>` : '',
  };
}

export async function sendBatchBoardRequestEmail(params: {
  to: string;
  orgName: string;
  requests: Array<{
    id: string;
    request: string;
    context: string;
    urgency: string;
    fallback: string;
  }>;
  appUrl: string;
  resendApiKey?: string;
  emailDomain?: string;
}): Promise<{ emailId: string; messageId: string } | null> {
  const apiKey = params.resendApiKey ?? process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[email] No Resend API key — skipping batch board request email');
    return null;
  }
  const resend = new Resend(apiKey);
  const fromDomain = params.emailDomain
    ?? process.env.RESEND_FROM_DOMAIN
    ?? 'mail.example.com';

  const count = params.requests.length;
  const subject = `${params.orgName} — ${count} Board Request${count === 1 ? '' : 's'}`;

  const requestsHtml = params.requests.map((r) => `
<div style="margin-bottom: 1.5rem;">
  <p style="font-size: 1.125rem; line-height: 1.75; margin: 0 0 0.5rem 0;">
    <a href="${params.appUrl}/inspect/board-request/${r.id}" style="color: #111; text-decoration: underline;">${escapeHtml(r.request)}</a>
  </p>
  <p style="font-size: 1rem; line-height: 1.6; margin: 0 0 0.25rem 0;"><strong>Context:</strong> ${escapeHtml(r.context)}</p>
  <p style="font-size: 1rem; line-height: 1.6; margin: 0 0 0.25rem 0;"><strong>Urgency:</strong> ${escapeHtml(r.urgency)}</p>
  <p style="font-size: 1rem; line-height: 1.6; margin: 0;"><strong>Fallback if no response:</strong> ${escapeHtml(r.fallback)}</p>
</div>`).join('\n<hr style="border: none; border-top: 1px solid #ddd; margin: 1.5rem 0;" />\n');

  const html = `<html><body style="font-family: 'Times New Roman', Times, serif; max-width: 640px; margin: 0 auto; padding: 2rem; color: #111;">
<h2 style="margin-bottom: 1rem;">Board Request${count === 1 ? '' : 's'}</h2>
${requestsHtml}
<hr style="border: none; border-top: 1px solid #ddd; margin: 2rem 0;" />
<p style="font-size: 0.875rem; color: #666;">Use the links above to review and respond to each request.</p>
</body></html>`;

  const { data, error } = await resend.emails.send({
    from: `CEO <ceo@${fromDomain}>`,
    to: params.to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend batch board request send failed: ${error.message}`);
  }

  return {
    emailId: data?.id ?? '',
    messageId: data?.id ? `<${data.id}@resend.dev>` : '',
  };
}

export async function sendAdhocEmail(params: {
  to: string;
  orgName: string;
  subject: string;
  bodyHtml: string;
  resendApiKey?: string;
  emailDomain?: string;
}): Promise<{ emailId: string; messageId: string } | null> {
  const apiKey = params.resendApiKey ?? process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[email] No Resend API key — skipping ad-hoc send');
    return null;
  }
  const resend = new Resend(apiKey);
  const fromDomain = params.emailDomain
    ?? process.env.RESEND_FROM_DOMAIN
    ?? 'mail.example.com';

  const { data, error } = await resend.emails.send({
    from: `CEO <ceo@${fromDomain}>`,
    to: params.to,
    subject: params.subject,
    html: params.bodyHtml,
    replyTo: `ceo@${fromDomain}`,
  });

  if (error) {
    throw new Error(`Resend ad-hoc send failed: ${error.message}`);
  }

  return {
    emailId: data?.id ?? '',
    messageId: data?.id ? `<${data.id}@resend.dev>` : '',
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain HTML for conversational email replies — no centering, no letterhead */
export function replyToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const paragraphs = escaped.split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  return `<html><body style="font-family: sans-serif; color: #111;">${paragraphs}</body></html>`;
}

export function letterToHtml(letter: string, orgName: string): string {
  // HTML-escape first to prevent XSS from LLM output, then convert markdown links
  const withLinks = escapeHtml(letter).replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color: #111; text-decoration: underline;">$1</a>'
  );

  return `<html><body style="font-family: 'Times New Roman', Times, serif; max-width: 640px; margin: 0 auto; padding: 2rem; color: #111;">
<div style="font-size: 1.125rem; line-height: 1.75; white-space: pre-wrap;">${withLinks}</div>
</body></html>`;
}
