import type { BriefingContent } from '@precept/shared';

export async function sendBriefing(params: {
  to: string;
  orgName: string;
  date: string;
  htmlContent: string;
}): Promise<void> {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey) {
    console.log('[agentmail] AGENTMAIL_API_KEY not set — skipping send');
    return;
  }

  const fromAddress = process.env.AGENTMAIL_FROM_ADDRESS ?? 'briefing@precept.ai';

  const response = await fetch('https://api.agentmail.to/v0/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: params.to,
      subject: `[${params.orgName}] — Daily Briefing — ${params.date}`,
      html: params.htmlContent,
    }),
  });

  if (!response.ok) {
    throw new Error(`AgentMail send failed: ${response.status} ${response.statusText}`);
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
