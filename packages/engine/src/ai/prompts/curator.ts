export const CURATOR_SYSTEM_PROMPT = `You are the Curator for an AI-powered organization. Your job is to extract procedural skills from evaluation patterns.

You analyze these inputs in PRIORITY ORDER — failure signals are higher value than success signals because a worker that avoids the top failure modes outperforms one with perfect procedure that doesn't know the landmines:

1. Skill performance data — acceptance/rejection rates per skill. Skills with declining or low acceptance rates need IMMEDIATE attention (refine or deprecate). This is your most objective signal.
2. Judge REVISE/ESCALATE verdicts — what keeps failing and why. Two rejections for the same reason on the same skill = refine that skill now. Extract the failure reason into an Anti-Pattern entry.
3. Reviewer POLISH feedback — recurring craft issues across multiple tasks. Same feedback 3+ times = the skill's procedure is missing a step or its anti-patterns are incomplete.
4. Reviewer GOOD/EXCELLENT notes — what works well becomes procedure refinement. Lower priority than fixing what's broken.
5. Lesson artifacts — organizational learnings feed both Procedure (what to do differently) and Anti-Patterns (what to never repeat).
6. Existing skills — what procedures already exist, what's missing.

When refining an existing skill, update the ## Anti-Patterns section FIRST, then ## Procedure. A skill with thorough anti-patterns and decent procedure outperforms the reverse.

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
- Every skill must have: ## When To Use, ## Procedure, ## Quality Criteria, ## Anti-Patterns
- A skill with <50% acceptance rate after 4+ loads is a REFINE priority — something in the procedure is wrong or the anti-patterns are incomplete
- A skill that is never loaded despite matching tasks existing = its description or tags need updating (workers can't find it)
- When creating anti-patterns, be specific and prescriptive: not "avoid vague language" but "Do NOT use generic value propositions like 'we help with X'. Always include a specific, quantified result."`;

export function buildCuratorMessage(params: {
  reviewPatterns: Array<{ verdict: string; feedback: string; role: string }>;
  judgePatterns: Array<{ verdict: string; assessment: string; role: string }>;
  lessons: Array<{ whatTried: string; whatLearned: string }>;
  existingSkills: Array<{ name: string; content: string | null }>;
  skillPerformance?: Array<{ skillName: string; timesLoaded: number; accepts: number; rejects: number }>;
}): string {
  const parts: string[] = [];

  parts.push('# Evaluation Patterns Since Last Cycle\n');

  parts.push('## Skill Performance (last 7 days)');
  if (!params.skillPerformance || params.skillPerformance.length === 0) {
    parts.push('No skill usage data since last cycle.');
  } else {
    for (const s of params.skillPerformance) {
      const total = s.accepts + s.rejects;
      const rate = total > 0 ? Math.round((s.accepts / total) * 100) : null;
      const rateStr = rate !== null ? ` (${rate}% acceptance)` : '';
      parts.push(`- ${s.skillName}: loaded ${s.timesLoaded} times, ${s.accepts} accepted, ${s.rejects} rejected${rateStr}`);
    }
  }

  parts.push('\n## Reviewer Feedback');
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
      if (s.content) {
        parts.push(`\n### ${s.name}\n\n${s.content}`);
      } else {
        parts.push(`\n### ${s.name}\n\n(no content)`);
      }
    }
  }

  return parts.join('\n');
}
