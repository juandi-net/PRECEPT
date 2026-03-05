import { Resend } from 'resend';

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
};

export async function sendBriefing(params: {
  to: string;
  orgName: string;
  date: Date;
  htmlContent: string;
}): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — skipping send');
    return;
  }

  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? 'mail.rookiesports.org';

  const shortDate = params.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const subject = `${params.orgName} — ${shortDate}`;

  const { error } = await resend.emails.send({
    from: `CEO <ceo@${fromDomain}>`,
    to: params.to,
    subject,
    html: params.htmlContent,
    replyTo: `ceo@${fromDomain}`,
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}

export function letterToHtml(letter: string, orgName: string): string {
  // Convert markdown links [text](url) to <a> tags
  const withLinks = letter.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color: #111; text-decoration: underline;">$1</a>'
  );

  return `<html><body style="font-family: 'Times New Roman', Times, serif; max-width: 640px; margin: 0 auto; padding: 2rem; color: #111;">
<p style="color: #666; font-size: 0.875rem;">${orgName}</p>
<div style="font-size: 1.125rem; line-height: 1.75; white-space: pre-wrap;">${withLinks}</div>
</body></html>`;
}
