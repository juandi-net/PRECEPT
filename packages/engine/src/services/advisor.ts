import type { AdvisorVerdict } from '@precept/shared';
import { FIELD_LABELS, PRECEPTS_FIELDS, type PreceptsDraft } from '@precept/shared';
import { invokeAgent } from '../ai/invoke.js';
import { ADVISOR_SYSTEM_PROMPT, buildAdvisorMessage } from '../ai/prompts/advisor.js';
import { getPlan, updateAdvisorVerdict } from '../db/plans.js';
import { getLatestPrecepts } from '../db/precepts.js';
import { getRecentDecisions, getRecentLessons } from '../db/decisions.js';
import { logEvent } from '../db/audit.js';

function preceptsToMarkdown(content: PreceptsDraft): string {
  const sections: string[] = [];
  for (const field of PRECEPTS_FIELDS) {
    const f = content[field];
    if (!f?.content) continue;
    sections.push(`## ${FIELD_LABELS[field]}\n\n${f.content}`);
  }
  return sections.join('\n\n');
}

export class AdvisorService {
  async reviewPlan(planId: string): Promise<{ verdict: AdvisorVerdict; notes: string }> {
    // 1. Load the plan
    const plan = await getPlan(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    // 2. Load Precepts
    const precepts = await getLatestPrecepts(plan.org_id);
    const preceptsMd = precepts ? preceptsToMarkdown(precepts.content) : '(No Precepts found)';

    // 3. Load recent decisions and lessons
    const [decisions, lessons] = await Promise.all([
      getRecentDecisions(plan.org_id, 10),
      getRecentLessons(plan.org_id, 10),
    ]);

    // 4. Build prompt
    const userMessage = buildAdvisorMessage(
      JSON.stringify(plan.content, null, 2),
      preceptsMd,
      decisions.map((d) => ({ decision: d.decision, reasoning: d.reasoning })),
      lessons.map((l) => ({ whatTried: l.whatTried, whatLearned: l.whatLearned })),
    );

    // 5. Invoke Advisor
    const response = await invokeAgent('Advisor-1', {
      model: 'opus',
      systemPrompt: ADVISOR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.6,
      jsonMode: true,
    });

    const parsed = response.parsed as unknown as { verdict: AdvisorVerdict; notes: string };
    if (!parsed?.verdict) {
      throw new Error('Advisor produced invalid response: missing verdict');
    }

    // 6. Write verdict to DB
    await updateAdvisorVerdict(planId, parsed.verdict, parsed.notes);

    logEvent('planning.advisor', 'Advisor-1', {
      planId,
      verdict: parsed.verdict,
    });

    return { verdict: parsed.verdict, notes: parsed.notes };
  }
}
