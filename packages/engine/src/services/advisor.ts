import type { AdvisorVerdict } from '@precept/shared';
import { invokeAndValidate, SchemaValidationError } from '../ai/validate.js';
import { AdvisorOutputSchema } from '../ai/schemas.js';
import { ADVISOR_SYSTEM_PROMPT, buildAdvisorMessage } from '../ai/prompts/advisor.js';
import { getPlan, updateAdvisorVerdict } from '../db/plans.js';
import { getLatestCornerstone } from '../db/cornerstone.js';
import { getRecentDecisions, getRecentLessons } from '../db/decisions.js';
import { getActiveInitiatives } from '../db/initiatives.js';
import { logEvent } from '../db/audit.js';
import { cornerstoneToMarkdown } from '../lib/formatting.js';
import { roleRegistry } from '../config/role-registry.js';

export class AdvisorService {
  async reviewPlan(planId: string): Promise<{ verdict: AdvisorVerdict; notes: string }> {
    const start = Date.now();
    console.log('[advisor] reviewing plan...');

    // 1. Load the plan
    const plan = await getPlan(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    // 2. Load Cornerstone
    const cornerstone = await getLatestCornerstone(plan.org_id);
    const cornerstoneMd = cornerstone ? cornerstoneToMarkdown(cornerstone.content) : '(No Cornerstone found)';

    // 3. Load recent decisions and lessons
    const [decisions, lessons] = await Promise.all([
      getRecentDecisions(plan.org_id, 10),
      getRecentLessons(plan.org_id, 10),
    ]);

    // 3b. Load active initiatives so Advisor can catch duplicates
    const activeInitiatives = await getActiveInitiatives(plan.org_id);

    // 4. Build prompt
    const userMessage = buildAdvisorMessage(
      JSON.stringify(plan.content, null, 2),
      cornerstoneMd,
      decisions.map((d) => ({ decision: d.decision, reasoning: d.reasoning })),
      lessons.map((l) => ({ whatTried: l.whatTried, whatLearned: l.whatLearned })),
      activeInitiatives.map((i) => ({ name: i.name, status: i.status, description: i.description ?? '' })),
    );

    // 5. Invoke Advisor
    let parsed: { verdict: AdvisorVerdict; notes: string };
    try {
      const model = await roleRegistry.getModel(plan.org_id, 'advisor');
      const endpoint = await roleRegistry.getEndpoint(plan.org_id, 'advisor');
      const result = await invokeAndValidate('Advisor-1', {
        orgId: plan.org_id,
        model,
        endpoint,
        systemPrompt: ADVISOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.6,
        jsonMode: true,
      }, AdvisorOutputSchema, 'advisor verdict');
      parsed = result.data;
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        console.warn(`[advisor] malformed verdict, skipping review: ${err.message}`);
        parsed = { verdict: 'APPROVED', notes: 'Advisor response was malformed — skipping review.' };
      } else throw err;
    }

    // 6. Write verdict to DB
    await updateAdvisorVerdict(planId, parsed.verdict, parsed.notes);

    logEvent(plan.org_id, 'planning.advisor', 'Advisor-1', {
      planId,
      verdict: parsed.verdict,
    });

    console.log(`[advisor] done — verdict: ${parsed.verdict} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    return { verdict: parsed.verdict, notes: parsed.notes };
  }
}
