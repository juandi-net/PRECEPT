export const CURATOR_SYSTEM_PROMPT = `You are the Curator for an AI-powered organization. Your job is to extract procedural skills from evaluation patterns.

You analyze:
1. Reviewer craft feedback — recurring quality issues workers face
2. Judge verdicts — patterns in accepted vs rejected work
3. Lesson artifacts — organizational learnings from successes and failures
4. Existing skills — what procedures already exist

Your output is a list of skill actions: create new skills, refine existing ones, or deprecate obsolete ones.

Respond with JSON:
{
  "actions": [
    {
      "type": "create" | "refine" | "deprecate",
      "name": "skill-name",
      "scope": "org_wide" | "role_specific",
      "role": "researcher" | "coder" | "writer" | "analyst" | null,
      "tags": ["tag1", "tag2"],
      "content": "Full SKILL.md content (for create/refine only)"
    }
  ],
  "reasoning": "Why these actions were chosen"
}

Rules:
- One skill = one procedure (max ~500 words)
- Only create a skill if you see a PATTERN (not a one-off)
- Refine > Create: improve existing skills before creating new ones
- Deprecate skills that are no longer relevant or have been superseded
- Every skill must have: ## When To Use, ## Procedure, ## Quality Criteria, ## Anti-Patterns`;

export function buildCuratorMessage(params: {
  reviewPatterns: Array<{ verdict: string; feedback: string; role: string }>;
  judgePatterns: Array<{ verdict: string; assessment: string; role: string }>;
  lessons: Array<{ whatTried: string; whatLearned: string }>;
  existingSkills: string[];
}): string {
  const parts: string[] = [];

  parts.push('# Evaluation Patterns Since Last Cycle\n');

  parts.push('## Reviewer Feedback');
  if (params.reviewPatterns.length === 0) {
    parts.push('No review feedback since last cycle.');
  } else {
    for (const r of params.reviewPatterns) {
      parts.push(`- [${r.role}] ${r.verdict}: ${r.feedback}`);
    }
  }

  parts.push('\n## Judge Verdicts');
  if (params.judgePatterns.length === 0) {
    parts.push('No judge verdicts since last cycle.');
  } else {
    for (const j of params.judgePatterns) {
      parts.push(`- [${j.role}] ${j.verdict}: ${j.assessment}`);
    }
  }

  parts.push('\n## Lesson Artifacts');
  if (params.lessons.length === 0) {
    parts.push('No lessons since last cycle.');
  } else {
    for (const l of params.lessons) {
      parts.push(`- Tried: ${l.whatTried} → Learned: ${l.whatLearned}`);
    }
  }

  parts.push('\n## Existing Active Skills');
  if (params.existingSkills.length === 0) {
    parts.push('No skills exist yet.');
  } else {
    for (const s of params.existingSkills) {
      parts.push(`- ${s}`);
    }
  }

  return parts.join('\n');
}
