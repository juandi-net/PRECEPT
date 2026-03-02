# Seed Skills Infrastructure — Design

**Date:** 2026-03-01
**Status:** Approved
**Context:** docs/skills.md (Bootstrapping section), docs/onboarding.md (Lock & Launch step 3)

## Problem

The docs specify that seed skill files are generated from Precepts content during Lock & Launch (onboarding completion). The codebase has none of the required infrastructure: no `skill_index` table, no `skills/` directory, no generation logic in the engine.

## Approach

LLM-generated seed skills with guardrails. At Lock & Launch, a single Sonnet call reads the finalized Precepts and composes three org-wide seed skills. Output is validated, written as markdown files, and indexed in Supabase.

## Components

### 1. Supabase Migration — `00003_skill_index.sql`

```sql
CREATE TABLE skill_index (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT UNIQUE NOT NULL,
  scope           TEXT NOT NULL CHECK (scope IN ('org_wide', 'role_specific', 'leadership_only')),
  role            TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  trigger_tags    TEXT[] DEFAULT '{}',
  file_path       TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

### 2. Skill File Structure

```
skills/
  org-wide/
    communication-tone.md
    data-classification.md
    quality-baseline.md
```

Only `org-wide/` is created at Sprint 1. Role-specific directories are created when the Curator comes online in Sprint 3.

Each skill file follows this format:

```markdown
# skill-name

**Scope:** org-wide
**Source:** Generated from Precepts at onboarding
**Tags:** [comma-separated tags]

## Guidance

[Actionable instructions derived from Precepts content — required]

## Examples

[Concrete examples of correct behavior — included only if Precepts provide enough signal]

## Anti-patterns

[What to avoid — included only if Precepts provide enough signal]
```

### 3. Shared Types — `@precept/shared`

New file: `packages/shared/src/skills.ts`

- `SkillScope`: `'org_wide' | 'role_specific' | 'leadership_only'`
- `SkillStatus`: `'active' | 'deprecated'`
- `SkillIndex` interface matching the table schema
- `SEED_SKILLS` constant: array of `{ name, scope, tags, preceptsFields, description }` for the three seed skills

### 4. AI Client Update

Add Sonnet model to `packages/engine/src/ai/client.ts`:

```typescript
export const MODELS = {
  opus: process.env.CLIPROXY_MODEL_OPUS || 'claude-opus-4-6',
  sonnet: process.env.CLIPROXY_MODEL_SONNET || 'claude-sonnet-4-6',
} as const;
```

### 5. Skill Authoring Prompt — `packages/engine/src/ai/prompts/skill-authoring.ts`

Single system prompt instructs Sonnet to generate all three seed skills in one call. Output is a JSON object with three keys, each containing the skill markdown content.

The prompt instructs Sonnet to:
- Read specific Precepts fields per skill
- Compose actionable guidance (not vague principles)
- Include Examples and Anti-patterns only when Precepts provide enough signal
- Output structured JSON with markdown content per skill

Per-skill field mapping:

| Seed Skill | Source Precepts Fields |
|---|---|
| `communication-tone` | `identity`, `active_priorities`, `constraints` |
| `data-classification` | `data_policy`, `constraints` |
| `quality-baseline` | `success_definition`, `constraints`, `active_priorities` |

### 6. Seed Skill Service — `packages/engine/src/services/skills.ts`

`SeedSkillService` class:
- `generateSeedSkills(precepts: PreceptsDraft): Promise<SkillIndex[]>`
- Single Sonnet call generates all three skills
- Validates response has required Guidance section per skill
- Writes markdown files to `skills/org-wide/{name}.md`
- Inserts records into `skill_index` table
- Audit log entry per generated skill

### 7. DB Module — `packages/engine/src/db/skills.ts`

- `insertSkill(skill: Omit<SkillIndex, 'id' | 'createdAt' | 'updatedAt'>): Promise<SkillIndex>`

### 8. Wire into Lock & Launch

In `OnboardingService.completeSession()`, after Precepts creation:

```typescript
const skillService = new SeedSkillService();
await skillService.generateSeedSkills(finalDraft);
```

No change to `CompleteSessionResponse` — the frontend doesn't display skills in V0.1.

## Error Handling

- If the Sonnet call fails, log the error and complete onboarding without seed skills. Skills are valuable but not blocking.
- If individual skill file write fails, log the error and skip that skill's `skill_index` insert. No partial records without files.

## What This Does NOT Include

- Curator agent (Sprint 3)
- Skill refinement / versioning workflows
- Dispatcher skill loading into worker context (depends on Dispatcher implementation)
- Role-specific skills (come from execution patterns, not onboarding)
- Role subdirectories (created when Curator comes online)

## First-Principles Review

**Deleted:** `precepts_id` column (in-case multi-owner), role subdirectories (empty for Sprint 1), `draft` status (useless without file), `CompleteSessionResponse` extension (frontend doesn't need it).

**Simplified:** 3 LLM calls → 1 Sonnet call. Examples/Anti-patterns sections optional (sparse Precepts shouldn't produce filler).
