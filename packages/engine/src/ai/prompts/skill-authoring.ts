import type { PreceptsDraft, PreceptsFieldName, SeedSkillSpec } from '@precept/shared';

export const SKILL_AUTHORING_SYSTEM_PROMPT = `You are a skill author for PRECEPT, an AI-powered business operating system.

You generate behavioral guidelines ("skills") that AI workers follow when executing tasks. Skills are not tasks — they are HOW workers should behave across all tasks.

## Your Task

Given the owner's Precepts (business context extracted during onboarding), generate three org-wide seed skills:

1. **communication-tone** — How the organization communicates: voice, tone, formality, word choice.
2. **data-classification** — What data is sensitive and how workers should handle it.
3. **quality-baseline** — Minimum quality standards for all work output.

## Output Format

Respond with a JSON object. Each key is a skill name, each value is the markdown content for that skill file (everything after the metadata header — start with ## Guidance).

The ## Guidance section is REQUIRED for every skill. It must contain specific, actionable instructions — not vague principles. Workers read this as their operating manual.

The ## Examples and ## Anti-patterns sections are OPTIONAL. Include them only if the Precepts provide enough signal to write concrete, useful examples. Do not generate filler.

\`\`\`json
{
  "communication-tone": "## Guidance\\n\\n...",
  "data-classification": "## Guidance\\n\\n...",
  "quality-baseline": "## Guidance\\n\\n..."
}
\`\`\`

## Rules

- Be specific and actionable. "Use professional language" is bad. "Address prospects by first name, use active voice, avoid jargon unless the recipient is technical" is good.
- Ground every instruction in the Precepts. Don't invent constraints the owner didn't express.
- If a Precepts field is marked as research_pending or open_question, note it as provisional guidance that will be refined.
- Keep each skill under 500 words. Workers need to absorb this quickly.`;

export function buildSkillAuthoringMessages(
  precepts: PreceptsDraft,
  specs: SeedSkillSpec[]
): Array<{ role: 'system' | 'user'; content: string }> {
  // Build a focused view of precepts for skill authoring
  const preceptsContent: Record<string, string> = {};
  const allFields = new Set<PreceptsFieldName>();

  for (const spec of specs) {
    for (const field of spec.preceptsFields) {
      allFields.add(field);
    }
  }

  for (const field of allFields) {
    const value = precepts[field];
    if (value) {
      preceptsContent[field] = `[${value.state}] ${value.content}`;
    }
  }

  const userMessage = `Here are the owner's Precepts (relevant fields only):

${Object.entries(preceptsContent)
  .map(([field, content]) => `### ${field}\n${content}`)
  .join('\n\n')}

Generate the three seed skills. Respond with JSON only.`;

  return [
    { role: 'system', content: SKILL_AUTHORING_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];
}
