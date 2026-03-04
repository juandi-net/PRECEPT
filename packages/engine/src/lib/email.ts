import { Resend } from 'resend';
import type { BriefingContent } from '@precept/shared';

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
};

export async function sendBriefing(params: {
  to: string;
  orgName: string;
  date: string;
  htmlContent: string;
}): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — skipping send');
    return;
  }

  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? 'mail.rookiesports.org';

  const { error } = await resend.emails.send({
    from: `CEO <ceo@${fromDomain}>`,
    to: params.to,
    subject: `[${params.orgName}] — Daily Briefing — ${params.date}`,
    html: params.htmlContent,
    replyTo: `ceo@${fromDomain}`,
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}

export function briefingToHtml(content: BriefingContent): string {
  const sections: string[] = [];

  sections.push('<html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">');

  // Board Requests
  if (content.board_requests.length > 0) {
    sections.push('<h2>Board Requests</h2>');
    for (const req of content.board_requests) {
      sections.push(`<div style="border-left: 3px solid #e74c3c; padding-left: 12px; margin-bottom: 12px;">`);
      sections.push(`<strong>#${req.number}: ${req.request}</strong><br/>`);
      sections.push(`<small>Context: ${req.context}</small><br/>`);
      sections.push(`<small>Urgency: ${req.urgency} | Fallback: ${req.fallback}</small>`);
      sections.push('</div>');
    }
  }

  // Exceptions
  if (content.exceptions.length > 0) {
    sections.push('<h2>Exceptions</h2>');
    for (const exc of content.exceptions) {
      const color = exc.severity === 'critical' ? '#e74c3c' : exc.severity === 'warning' ? '#f39c12' : '#27ae60';
      sections.push(`<div style="border-left: 3px solid ${color}; padding-left: 12px; margin-bottom: 12px;">`);
      sections.push(`<strong>[${exc.severity.toUpperCase()}]</strong> ${exc.description}`);
      if (exc.initiative) sections.push(`<br/><small>Initiative: ${exc.initiative}</small>`);
      sections.push('</div>');
    }
  }

  // Results
  sections.push('<h2>Results</h2>');
  if (content.results.north_star) {
    sections.push(`<p><strong>North Star:</strong> ${content.results.north_star}</p>`);
  }
  if (content.results.initiatives.length > 0) {
    sections.push('<table style="width: 100%; border-collapse: collapse;">');
    sections.push('<tr><th style="text-align: left;">Initiative</th><th>Status</th><th>Summary</th></tr>');
    for (const init of content.results.initiatives) {
      sections.push(`<tr>`);
      sections.push(`<td>${init.name}</td>`);
      sections.push(`<td>${init.status}</td>`);
      sections.push(`<td>${init.outcome_summary}</td>`);
      sections.push(`</tr>`);
    }
    sections.push('</table>');
  }

  // Forward Look
  sections.push('<h2>Forward Look</h2>');
  sections.push(`<p>${content.forward_look}</p>`);

  sections.push('</body></html>');
  return sections.join('\n');
}
