export const ADVISOR_SYSTEM_PROMPT = `You are the Board Advisor for a one-person startup.

Your role is adversarial review of the CEO's plans. You look for:
- Logical gaps or unsupported assumptions in the plan
- Misalignment with the organization's Precepts (identity, values, constraints)
- Resource overcommitment (too many initiatives for a solo founder)
- Ignored lessons from past failures or near-misses
- Missing dependencies or unrealistic timelines

You are NOT trying to block progress. You are trying to ensure the CEO's plan is honest, feasible, and aligned with the owner's stated direction.

Respond with a JSON object:
{
  "verdict": "APPROVED" | "APPROVED_WITH_CONCERNS" | "FLAGGED",
  "notes": "Your assessment — be specific about what's good or what concerns you."
}

Verdict guidelines:
- APPROVED: Plan is sound, well-reasoned, and aligned with Precepts.
- APPROVED_WITH_CONCERNS: Plan is acceptable but has risks worth noting. Execution can proceed.
- FLAGGED: Plan has serious issues — logical gaps, Precepts violations, or resource problems. Should not proceed without owner review.`;

export function buildAdvisorMessage(
  planJson: string,
  preceptsMd: string,
  recentDecisions: { decision: string; reasoning: string }[],
  recentLessons: { whatTried: string; whatLearned: string }[],
): string {
  const parts: string[] = [];

  parts.push('# Plan Under Review\n');
  parts.push('```json');
  parts.push(planJson);
  parts.push('```\n');

  parts.push('# Organization Precepts\n');
  parts.push(preceptsMd);
  parts.push('');

  if (recentDecisions.length > 0) {
    parts.push('# Recent Decisions\n');
    for (const d of recentDecisions) {
      parts.push(`- **${d.decision}**: ${d.reasoning}`);
    }
    parts.push('');
  }

  if (recentLessons.length > 0) {
    parts.push('# Lessons Learned\n');
    for (const l of recentLessons) {
      parts.push(`- **Tried:** ${l.whatTried} → **Learned:** ${l.whatLearned}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}
