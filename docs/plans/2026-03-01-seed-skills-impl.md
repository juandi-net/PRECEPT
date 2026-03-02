# Seed Skills Infrastructure — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add seed skill generation during Lock & Launch so workers have behavioral guidelines from day one.

**Architecture:** Single Sonnet LLM call at onboarding completion generates three org-wide skill files (communication-tone, data-classification, quality-baseline) from Precepts content. Skills are markdown files in `skills/org-wide/`, indexed in a `skill_index` Supabase table. The generation is non-blocking — if it fails, onboarding still completes.

**Tech Stack:** TypeScript, Supabase (Postgres), Hono, OpenAI SDK (CLIProxy → Sonnet 4.6), Vitest, Bun

**Design doc:** `docs/plans/2026-03-01-seed-skills-design.md`

---

### Task 1: Supabase Migration — `skill_index` Table

**Files:**
- Create: `supabase/migrations/00003_skill_index.sql`

**Step 1: Write the migration**

```sql
-- Skill index: tracks all skill files and their metadata
-- See docs/skills.md — Skill Index Schema
CREATE TABLE skill_index (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT UNIQUE NOT NULL,
  scope           TEXT NOT NULL CHECK (scope IN ('org_wide', 'role_specific', 'leadership_only')),
  role            TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  trigger_tags    TEXT[] DEFAULT '{}',
  file_path       TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for Dispatcher skill selection queries
CREATE INDEX idx_skill_index_scope_status ON skill_index (scope, status);
CREATE INDEX idx_skill_index_trigger_tags ON skill_index USING GIN (trigger_tags);
```

**Step 2: Apply the migration**

Run: `cd supabase && supabase db push` (or however migrations are applied locally — check `supabase/config.toml` for local dev setup)

**Step 3: Commit**

```bash
git add supabase/migrations/00003_skill_index.sql
git commit -m "feat: add skill_index table migration"
```

---

### Task 2: Shared Types — Skills

**Files:**
- Create: `packages/shared/src/skills.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/audit.ts`

**Step 1: Create skill types**

Create `packages/shared/src/skills.ts`:

```typescript
import type { PreceptsFieldName } from './precepts';

export type SkillScope = 'org_wide' | 'role_specific' | 'leadership_only';
export type SkillStatus = 'active' | 'deprecated';

export interface SkillIndex {
  id: string;
  name: string;
  scope: SkillScope;
  role: string | null;
  status: SkillStatus;
  triggerTags: string[];
  filePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeedSkillSpec {
  name: string;
  scope: SkillScope;
  tags: string[];
  preceptsFields: PreceptsFieldName[];
  description: string;
}

export const SEED_SKILLS: SeedSkillSpec[] = [
  {
    name: 'communication-tone',
    scope: 'org_wide',
    tags: ['communication', 'writing', 'tone'],
    preceptsFields: ['identity', 'active_priorities', 'constraints'],
    description: 'How the organization communicates — voice, tone, formality level',
  },
  {
    name: 'data-classification',
    scope: 'org_wide',
    tags: ['data', 'security', 'classification'],
    preceptsFields: ['data_policy', 'constraints'],
    description: 'What data is sensitive and how to handle it',
  },
  {
    name: 'quality-baseline',
    scope: 'org_wide',
    tags: ['quality', 'standards', 'baseline'],
    preceptsFields: ['success_definition', 'constraints', 'active_priorities'],
    description: 'Minimum quality standards for all work output',
  },
];
```

**Step 2: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from './skills';
```

**Step 3: Add audit event types for skills**

Add to `packages/shared/src/audit.ts` `AuditEventType` union:

```typescript
| 'skills.seed_generated'
| 'skills.seed_failed'
```

**Step 4: Verify build**

Run: `cd packages/shared && bun run build` (or `tsc --noEmit` if no build script)
Expected: No errors

**Step 5: Commit**

```bash
git add packages/shared/src/skills.ts packages/shared/src/index.ts packages/shared/src/audit.ts
git commit -m "feat: add shared skill types and seed skill specs"
```

---

### Task 3: AI Client — Add Sonnet Model

**Files:**
- Modify: `packages/engine/src/ai/client.ts`

**Step 1: Add Sonnet to MODELS**

Change `MODELS` in `packages/engine/src/ai/client.ts` from:

```typescript
export const MODELS = {
  opus: process.env.CLIPROXY_MODEL_OPUS || 'claude-opus-4-6',
} as const;
```

To:

```typescript
export const MODELS = {
  opus: process.env.CLIPROXY_MODEL_OPUS || 'claude-opus-4-6',
  sonnet: process.env.CLIPROXY_MODEL_SONNET || 'claude-sonnet-4-6',
} as const;
```

**Step 2: Verify build**

Run: `cd packages/engine && bun run build`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/engine/src/ai/client.ts
git commit -m "feat: add Sonnet model to AI client"
```

---

### Task 4: Skill Authoring Prompt

**Files:**
- Create: `packages/engine/src/ai/prompts/skill-authoring.ts`

**Step 1: Create the prompt module**

Create `packages/engine/src/ai/prompts/skill-authoring.ts`:

```typescript
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
```

**Step 2: Verify build**

Run: `cd packages/engine && bun run build`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/engine/src/ai/prompts/skill-authoring.ts
git commit -m "feat: add skill authoring prompt for seed skill generation"
```

---

### Task 5: DB Module — Skills

**Files:**
- Create: `packages/engine/src/db/skills.ts`

**Step 1: Create the DB module**

Create `packages/engine/src/db/skills.ts`:

```typescript
import { db } from './client.js';
import type { SkillIndex, SkillScope, SkillStatus } from '@precept/shared';

export interface InsertSkillParams {
  name: string;
  scope: SkillScope;
  role: string | null;
  status: SkillStatus;
  triggerTags: string[];
  filePath: string;
}

export async function insertSkill(params: InsertSkillParams): Promise<SkillIndex> {
  const { data, error } = await db
    .from('skill_index')
    .insert({
      name: params.name,
      scope: params.scope,
      role: params.role,
      status: params.status,
      trigger_tags: params.triggerTags,
      file_path: params.filePath,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to insert skill: ${error.message}`);

  return {
    id: data.id,
    name: data.name,
    scope: data.scope,
    role: data.role,
    status: data.status,
    triggerTags: data.trigger_tags,
    filePath: data.file_path,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
```

**Step 2: Verify build**

Run: `cd packages/engine && bun run build`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/engine/src/db/skills.ts
git commit -m "feat: add skills DB module"
```

---

### Task 6: Seed Skill Service

**Files:**
- Create: `packages/engine/src/services/skills.ts`

**Step 1: Create the service**

Create `packages/engine/src/services/skills.ts`:

```typescript
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { ai, MODELS } from '../ai/client.js';
import { buildSkillAuthoringMessages } from '../ai/prompts/skill-authoring.js';
import * as skillsDb from '../db/skills.js';
import * as auditDb from '../db/audit.js';
import { SEED_SKILLS } from '@precept/shared';
import type { PreceptsDraft, SkillIndex, SeedSkillSpec } from '@precept/shared';

const AGENT_ID = 'seed-skill-generator';
const SKILLS_DIR = join(process.cwd(), 'skills');

export class SeedSkillService {
  async generateSeedSkills(precepts: PreceptsDraft): Promise<SkillIndex[]> {
    const messages = buildSkillAuthoringMessages(precepts, SEED_SKILLS);
    const startMs = Date.now();

    let rawContent: string;
    try {
      const response = await ai.chat.completions.create({
        model: MODELS.sonnet,
        messages: messages as any,
        temperature: 0.4,
      });

      rawContent = response.choices[0]?.message?.content ?? '';
      const latencyMs = Date.now() - startMs;

      await auditDb.logEvent('ai.call', AGENT_ID, {
        model: MODELS.sonnet,
        purpose: 'seed_skill_generation',
        latencyMs,
        tokensIn: response.usage?.prompt_tokens ?? null,
        tokensOut: response.usage?.completion_tokens ?? null,
      }, response.usage?.total_tokens ?? undefined);
    } catch (err: any) {
      await auditDb.logEvent('skills.seed_failed', AGENT_ID, {
        error: err.message,
        stage: 'llm_call',
      });
      console.error(`Seed skill generation failed (LLM call): ${err.message}`);
      return [];
    }

    // Parse the LLM response
    let skillContents: Record<string, string>;
    try {
      skillContents = this.parseResponse(rawContent);
    } catch (err: any) {
      await auditDb.logEvent('skills.seed_failed', AGENT_ID, {
        error: err.message,
        stage: 'parse',
        rawContent,
      });
      console.error(`Seed skill generation failed (parse): ${err.message}`);
      return [];
    }

    // Write files and insert DB records
    const created: SkillIndex[] = [];
    for (const spec of SEED_SKILLS) {
      const content = skillContents[spec.name];
      if (!content) {
        console.error(`Seed skill "${spec.name}" missing from LLM response`);
        continue;
      }

      try {
        const skill = await this.writeSkill(spec, content);
        created.push(skill);

        await auditDb.logEvent('skills.seed_generated', AGENT_ID, {
          skillName: spec.name,
          filePath: skill.filePath,
        });
      } catch (err: any) {
        await auditDb.logEvent('skills.seed_failed', AGENT_ID, {
          error: err.message,
          stage: 'write',
          skillName: spec.name,
        });
        console.error(`Seed skill "${spec.name}" write failed: ${err.message}`);
      }
    }

    return created;
  }

  private parseResponse(raw: string): Record<string, string> {
    // Strip markdown fences if present
    const stripped = raw
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      // Try to find JSON object in prose
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON object found in LLM response');
      parsed = JSON.parse(match[0]);
    }

    // Validate: each seed skill must have content with a Guidance section
    for (const spec of SEED_SKILLS) {
      const content = parsed[spec.name];
      if (typeof content !== 'string') {
        throw new Error(`Missing or invalid content for skill "${spec.name}"`);
      }
      if (!content.includes('## Guidance')) {
        throw new Error(`Skill "${spec.name}" missing required ## Guidance section`);
      }
    }

    return parsed;
  }

  private async writeSkill(spec: SeedSkillSpec, content: string): Promise<SkillIndex> {
    const scopeDir = spec.scope === 'org_wide' ? 'org-wide' : spec.role ?? spec.scope;
    const relativePath = `skills/${scopeDir}/${spec.name}.md`;
    const absolutePath = join(SKILLS_DIR, scopeDir, `${spec.name}.md`);

    // Build the full skill file
    const fileContent = `# ${spec.name}

**Scope:** ${spec.scope.replace('_', '-')}
**Source:** Generated from Precepts at onboarding
**Tags:** ${spec.tags.join(', ')}

${content}
`;

    // Ensure directory exists and write file
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, fileContent, 'utf-8');

    // Insert into skill_index
    return skillsDb.insertSkill({
      name: spec.name,
      scope: spec.scope,
      role: null,
      status: 'active',
      triggerTags: spec.tags,
      filePath: relativePath,
    });
  }
}
```

**Step 2: Verify build**

Run: `cd packages/engine && bun run build`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/engine/src/services/skills.ts
git commit -m "feat: add SeedSkillService for generating skills at Lock & Launch"
```

---

### Task 7: Wire into Lock & Launch

**Files:**
- Modify: `packages/engine/src/services/onboarding.ts`

**Step 1: Import and call SeedSkillService in completeSession**

Add import at top of `packages/engine/src/services/onboarding.ts`:

```typescript
import { SeedSkillService } from './skills.js';
```

In `completeSession()`, after the audit log entry for `precepts.created` (after line 157), add:

```typescript
    // Step 3 from onboarding.md Lock & Launch sequence:
    // Generate seed skill files from Precepts content
    const skillService = new SeedSkillService();
    await skillService.generateSeedSkills(finalDraft);
```

**Step 2: Verify build**

Run: `cd packages/engine && bun run build`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/engine/src/services/onboarding.ts
git commit -m "feat: wire seed skill generation into Lock & Launch"
```

---

### Task 8: Create `skills/` Directory with `.gitkeep`

**Files:**
- Create: `skills/org-wide/.gitkeep`

**Step 1: Create directory**

```bash
mkdir -p skills/org-wide
touch skills/org-wide/.gitkeep
```

**Step 2: Commit**

```bash
git add skills/org-wide/.gitkeep
git commit -m "feat: add skills directory structure"
```

---

### Task 9: Verify Full Build

**Step 1: Build shared package**

Run: `cd packages/shared && bun run build`
Expected: No errors

**Step 2: Build engine package**

Run: `cd packages/engine && bun run build`
Expected: No errors

**Step 3: Run existing tests**

Run: `cd packages/shared && bun run test` and `cd packages/engine && bun run test`
Expected: All existing tests pass (no regressions)
