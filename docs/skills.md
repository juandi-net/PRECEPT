---
date: 2026-03-01
project: precept
status: draft
---

# PRECEPT V1 — Skills Architecture

How agents learn to do things well. Skills are externalized procedural knowledge — loaded on demand, not carried permanently.

Memory is what the system knows. Skills are how the system works. Together they make month 3 fundamentally better than month 1. Memory compounds knowledge. Skills compound capability.

## Why Skills Exist

Every agent has a system prompt. That prompt carries identity, role boundaries, core behavior, and the Precepts values. Without skills, it also carries every procedural instruction the agent might ever need: how to do competitive analysis, how to write cold outreach, how to decompose initiatives, how to format research findings, how to handle edge cases in each task type.

This creates two problems:

**1. Context window bloat.** A Researcher prompt that includes procedures for market research, competitive analysis, prospect identification, technical deep-dives, pricing analysis, and data gathering burns thousands of tokens before the actual task even starts. Most of those procedures are irrelevant to any given task. The worker sees instructions for competitive analysis while doing prospect identification — noise that degrades output quality.

**2. Procedural knowledge can't evolve.** When the Reviewer observes "Researcher outputs improve when given competitor framing upfront," where does that insight go? Into the system prompt? That means prompt edits every time the system learns something. Into Role Memory? That's knowledge, not procedure — the worker sees "competitor framing helps" as a fact, not as a step in a defined process.

Skills solve both problems. The system prompt stays lean — identity and boundaries only. Procedural knowledge lives in structured skill documents, loaded by the Dispatcher when relevant to the current task. The context window carries only what the worker needs right now. And skills can evolve independently of the system prompt — versioned, refined, tested.

## The One-Skill-One-Thing Rule

A skill must be narrow, lean, and surgical. One skill = one specific thing done well. Not a category. Not a broad capability. A precise procedure for a precise type of work.

**Bad:** "research-methodology" — covers market research, competitive analysis, prospect identification, technical deep-dives, and pricing analysis in one document. Bloated. Half the content is irrelevant to any given task. Worker drowns in instructions.

**Good:** "prospect-identification" — covers exactly how to identify and qualify prospects for a defined market segment. Nothing else. 200-400 words of precise procedure. Worker reads it in 30 seconds and knows exactly what to do.

**Bad:** "cold-outreach-email" — covers subject lines, value props, CTAs, follow-up sequences, personalization, formatting, and tone all in one skill. Too much for a single task.

**Good:** "cold-outreach-subject-line" — covers how to write a subject line for cold outreach. Lead with the recipient's pain point. Six words or fewer. No generic framing. Three examples of good and bad. Done.

**The test:** if a skill is longer than ~500 words of procedure, it's probably two skills. Split it. A worker should be able to internalize the skill quickly and execute against it without scrolling back. The whole point is surgical precision — load exactly the instructions needed for this task, nothing more.

This also makes the Dispatcher's job cleaner. Instead of loading one big "research" skill that's 60% irrelevant, it loads two narrow skills that are 100% relevant. Less noise, better output.

## Skill Anatomy

A skill is a self-contained instruction set for a specific type of work. It answers: "When doing THIS type of task, HERE is exactly how to do it well."

```
SKILL: competitive-analysis
VERSION: 3
SCOPE: role:researcher
STATUS: active
CREATED: 2026-03-15
LAST UPDATED: 2026-04-02
UPDATED BY: Curator (extracted from Reviewer patterns + CEO refinement)

DESCRIPTION:
  How to conduct competitive analysis for a defined market segment.

WHEN TO USE:
  Tasks tagged as competitive analysis, market positioning, or
  competitor research. Also relevant when a task spec mentions
  competitors, market landscape, or differentiation.

PROCEDURE:
  1. Identify the target segment from the task spec. If ambiguous,
     flag for clarification — do not assume.
  2. Start with the Precepts competitive landscape section as baseline.
     Check Role Memory for prior research on this segment.
  3. For each competitor identified:
     - Company size, funding stage, key customers
     - Product positioning (their words, not ours)
     - Pricing model and range (if discoverable)
     - Strengths we should respect
     - Weaknesses we can exploit
  4. Structure findings as a comparison matrix, not prose.
     Prose buries the signal. Matrix surfaces it.
  5. End with a "So What" section: what does this mean for OUR
     positioning? Not strategy recommendations (CEO's job) —
     just the implications the data suggests.

QUALITY CRITERIA:
  - Every claim about a competitor must cite a source
  - "Strengths we should respect" must be honest, not dismissive
  - Pricing data marked with confidence level (verified / estimated / unknown)
  - Comparison matrix must include at least one dimension where
    competitor is stronger (if none found, research is incomplete)

ANTI-PATTERNS:
  - Generic competitive overviews that don't address the specific segment
  - Dismissing competitors ("they're not a real threat") — the Judge
    will reject this
  - Prose-heavy reports that bury the comparison in paragraphs
  - Missing the "So What" section — data without implications is
    incomplete research

CRAFT NOTES:
  - Reviewer pattern (v2): outputs scored higher when competitor
    framing was presented upfront in findings, not buried at the end
  - Reviewer pattern (v3): adding a "surprise finding" callout for
    unexpected data improved CEO planning quality downstream
  - Judge pattern: acceptance rate dropped when pricing data had no
    confidence markers. Always mark confidence.

REVISION HISTORY:
  v1 (2026-03-15): Initial version, authored by owner
  v2 (2026-03-22): Added competitor framing guidance (Curator,
    extracted from Reviewer craft pattern on Task-031, Task-038)
  v3 (2026-04-02): Added pricing confidence markers, surprise finding
    callout (Curator, extracted from Judge rejection pattern on
    Task-055, Reviewer commendation on Task-061)
```

### Required Fields

Every skill has:

| Field | Purpose |
|---|---|
| **Name** | Unique identifier, kebab-case |
| **Version** | Integer, increments on every update |
| **Scope** | Who can use this skill (see Skill Scopes) |
| **Status** | active, draft, deprecated |
| **Description** | One-liner: what this skill is for |
| **When To Use** | Trigger conditions for the Dispatcher |
| **Procedure** | Step-by-step instructions the worker follows |
| **Quality Criteria** | What "good" looks like — feeds worker self-checking |
| **Anti-Patterns** | What to avoid — common failure modes |

### Optional Fields

| Field | Purpose |
|---|---|
| **Craft Notes** | Reviewer/Judge observations that informed this version |
| **Revision History** | What changed and why, per version |
| **Prerequisites** | Other skills or knowledge this one assumes |
| **Examples** | Example outputs that demonstrate the skill done well |
| **CEO Notes** | Strategic context for why this skill matters (leadership skills only) |

## Skill Scopes

Skills exist at three levels. Scope determines who can use them and who can modify them.

| Scope | Available To | Examples | Who Creates | Who Modifies |
|---|---|---|---|---|
| **Org-wide** | All agents | Communication standards, quality baselines, Precepts interpretation guidelines | Owner, Curator | Curator (proposes), Owner (approves) |
| **Role-specific** | Agents in that role | Researcher: competitive analysis. Writer: cold outreach. Coder: API integration patterns | Curator, Owner | Curator |
| **Leadership-only** | CEO, Board Advisor, Judge, Reviewer, Dispatcher | Strategic planning procedures, post-mortem methodology, Board Request formatting, evaluation rubrics | CEO, Owner | CEO (proposes), Owner (approves) |

### Scope Rules

- **Org-wide skills override role-specific skills** on the same topic. If an org-wide skill says "never use jargon in external communications" and a Writer skill says "use industry terminology," the org-wide skill wins.
- **Leadership-only skills are never visible to workers.** Workers don't see how the CEO plans, how the Judge evaluates, or how the Dispatcher routes. Information compartmentalization (see `security.md`) applies to skills too.
- **Role-specific skills transfer with the role, not the agent.** When Worker-4 (Researcher, Sonnet 4.6) is replaced by Worker-7 (Researcher, new model), Worker-7 inherits all Researcher skills. Same principle as Role Memory — the role's accumulated knowledge and procedures persist across agent swaps.

## Three Sources of Skills

### 1. Authored Skills

Written by the owner or CEO. These encode human judgment and Precepts values into repeatable procedures.

**When:** During onboarding (initial skill set), during weekly planning (CEO identifies a procedural gap), or ad hoc (owner observes a pattern and writes a skill).

**Examples:**
- Owner writes "how to represent Asylo's value proposition" after realizing workers keep getting the framing wrong
- CEO writes "how to decompose a multi-phase outreach initiative" after successfully running one and wanting to replicate the approach
- Owner writes "communication tone" as an org-wide skill rooted in the Precepts values

**Quality:** High from day 1 — these carry human intent. But they may be incomplete (missing edge cases the system hasn't encountered yet).

### 2. Extracted Skills

The Curator transforms observations from the Reviewer, Judge, and lesson artifacts into structured procedural skills. This is the system's primary self-learning mechanism for capability.

**Source data:**
- Reviewer craft patterns: "Writer consistently struggles with concise subject lines" → becomes a procedure for writing subject lines
- Judge rejection patterns: "Analyst pricing reports rejected 3x for missing confidence markers" → becomes a quality criterion in the analysis skill
- Reviewer commendation patterns: "Researcher output scored EXCELLENT when findings included a surprise callout" → becomes a step in the research skill
- Lesson artifacts: "Cold email value prop needs specificity" → refines the outreach skill with concrete guidance

**When:** The Curator runs as a batch process (see The Curator section). Extraction happens when enough signal accumulates — not after every single review, but when patterns emerge across multiple tasks.

**Quality:** Dependent on the Curator's ability to synthesize observations into actionable procedures. Starts rough, improves as the Curator's own prompt is refined.

### 3. Refined Skills

Existing skills updated based on new evidence. A skill is never "done" — it's the system's best current understanding of how to do a type of work well.

**Triggers for refinement:**
- Reviewer flags a recurring quality issue on tasks where the skill was loaded → skill's procedure or anti-patterns need updating
- Judge acceptance rate drops for a task type that has an active skill → skill may be teaching the wrong approach
- CEO identifies a strategic shift that changes how a task type should be executed → skill needs realignment with new strategy
- Owner feedback contradicts a skill's guidance → skill needs correction

**Versioning:** Every refinement increments the version number. The revision history captures what changed and why. Old versions are archived, not deleted — if a refinement makes things worse, the Curator or CEO can roll back.

## The Curator

A dedicated system-level role that creates and refines skills. Not a worker — does not go through the Reviewer/Judge pipeline. Analogous to the Scribe (context compression) but for procedural knowledge.

**Model:** Sonnet 4.6 via CLIProxy.

**Name rationale:** Curates the skill library — selects what belongs, maintains quality, removes what's stale, organizes the collection. The Reviewer observes quality. The Judge evaluates outcomes. The Curator turns those observations into teachable, repeatable procedures.

### What the Curator Reads

| Input | Source | Purpose |
|---|---|---|
| Reviewer craft patterns | Performance Memory | "What quality patterns has the Reviewer observed?" |
| Judge rejection/acceptance patterns | Audit Log | "What keeps failing? What keeps succeeding?" |
| Lesson artifacts | Institutional Memory | "What has the organization learned?" |
| Existing skills | Skills table | "What procedures already exist? What's missing?" |
| CEO planning notes | Decision Log | "Has the CEO identified procedural gaps?" |

### What the Curator Produces

- **New skills** when a pattern emerges that no existing skill covers
- **Skill refinements** when evidence shows an existing skill is incomplete or wrong
- **Deprecation recommendations** when a skill becomes irrelevant (market changed, strategy shifted)

### When the Curator Runs

**Batch process, not continuous.** The Curator runs on a schedule — weekly, aligned with the CEO's planning cycle but independent of it. Running after every review would produce noisy, low-confidence skills. Patterns need time to emerge.

```
Weekly Curator cycle:
  │
  ▼
Read inputs:
  • Reviewer craft patterns since last cycle
  • Judge rejection/acceptance data since last cycle
  • New lesson artifacts since last cycle
  • Existing active skills
  │
  ▼
Identify signals:
  • Recurring quality issues (same feedback 3+ times)
  • Task types with declining acceptance rates
  • Task types with NO skill coverage
  • Existing skills contradicted by recent evidence
  │
  ▼
Produce outputs:
  • New skill .md files (immediately active)
  • Refinements to existing skill files (new commit)
  • Deprecation of obsolete skills
  │
  ▼
Escalation (only when needed):
  • Skill contradicts the Precepts → escalate to CEO
  • Skill touches org-wide scope and the Curator is uncertain → escalate to CEO
  • CEO decides whether to handle it or bring it to the owner as a Board Request
  • Default: Curator creates and refines autonomously. That's its job.
```

**Why autonomous?** The Curator's output is low-risk. A bad skill doesn't break anything — workers who receive it produce output that goes through the Reviewer and Judge. If a skill is wrong, the evaluation flow catches it. The signal feeds back to the Curator, and the skill gets refined next cycle. The self-correcting loop makes heavy approval gates unnecessary.

The CEO sees all new and modified skills during its weekly planning cycle (the Scribe includes skill changes in the CEO's context). If something looks off, the CEO can flag it. But the default is: Curator creates, system validates through results.

### Curator Prompt Design

The Curator's prompt must be precise about the transformation it performs. It's not summarizing — it's converting observations into procedures.

**Input:** "Reviewer observed that Researcher outputs scored higher when competitor framing was presented upfront in findings, not buried at the end."

**Bad output (observation, not skill):** "Competitor framing should be upfront."

**Good output (procedural skill entry):** "Step 4 in competitive analysis: Structure findings with competitor framing as the opening context. Lead with who the competitors are and how they position, THEN present your research findings within that frame. Do not bury competitor context in a later section — the reader needs the competitive frame to interpret the data."

The Curator transforms *what was observed* into *what to do*. Observations are descriptive. Skills are prescriptive.

### Quality Control

The Curator doesn't go through the Reviewer/Judge pipeline (it's a system role, not a worker). But its output quality is monitored:

- **Acceptance rate tracking:** If workers using a Curator-created skill have lower acceptance rates than workers using authored skills, the Curator's extraction quality needs improvement.
- **CEO review:** The CEO sees new skills and refinements during the planning cycle. If a skill misrepresents a lesson or creates a bad procedure, the CEO corrects it.
- **Owner visibility:** All org-wide skill changes appear in the daily briefing. The owner can override any skill.
- **A/B signal:** Over time, compare performance on tasks with Curator-refined skills vs. original authored skills. If refinements consistently improve acceptance rates, the Curator is earning its keep.

## Skill Selection (Dispatcher)

The Dispatcher already assembles each worker's context package: task spec + chain context + role memory + Team Bulletin. Skills are a fifth component.

### Selection Method

Three mechanisms, checked in order:

**1. CEO explicit assignment (highest priority)**
When the CEO creates a task spec, it can specify: "Use skill: competitive-analysis." This is common for leadership-only skills and for tasks where the CEO knows exactly which procedure applies.

```
TASK: Analyze Bay Area robotics competitors
ROLE: Researcher
SKILLS: competitive-analysis
ACCEPTANCE CRITERIA: ...
```

**2. Task type tag matching**
The CEO tags tasks with types during planning (research, outreach, analysis, coding, etc.). Skills declare their trigger conditions in the "When To Use" field. The Dispatcher matches task tags to skill triggers.

```
Task tagged: [competitive-analysis, market-research]
  → Matches skills: competitive-analysis, market-research-methodology
  → Both loaded into worker context
```

**3. Dispatcher judgment (lowest priority, fallback)**
If no explicit assignment and no tag match, the Dispatcher can select skills based on the task description and available skills for that role. The Dispatcher already reads worker performance profiles for routing — it reads the skill registry for the same reason.

### Context Assembly with Skills

```
Worker context package:
  │
  ├── System prompt (identity, role, boundaries — LEAN)
  │
  ├── Task spec (what to do — from CEO)
  │
  ├── Skills (how to do it — from Dispatcher selection)
  │     Injected as: "The following skill guides apply to this task.
  │     Follow their procedures and quality criteria."
  │     [skill content]
  │
  ├── Role Memory (what you already know — semantic search)
  │     Top-K relevant entries for this task
  │
  ├── Chain context (what happened before — predecessor outputs)
  │
  └── Team Bulletin (what the team is doing — ambient awareness)
```

### Skill Loading Limits

A worker should never receive more than 2-3 skills per task. More than that creates conflicting instructions and bloats context. If more than 3 skills match:
- CEO explicit assignments take priority
- Tag matches ranked by relevance (exact match > partial match)
- Dispatcher drops the least relevant

## Skill Categories

Initial skill categories, organized by role. Not exhaustive — grows organically as the system encounters new task types.

### Org-Wide Skills

| Skill | Purpose |
|---|---|
| communication-tone | How agents communicate externally and in Board Requests. Rooted in Precepts values. |
| quality-baseline | Minimum standards for any output. Applies across all roles. |
| data-classification | How to handle 🟢 🟡 🔴 data. Mirrors `security.md` rules in procedural form. |
| precepts-interpretation | How to read and apply the Precepts document. What "working hypothesis" means operationally vs. "confirmed." |

### Role-Specific Skills (Examples)

**Researcher:**
- competitive-analysis
- market-research-methodology
- prospect-identification
- technical-deep-dive

**Writer:**
- cold-outreach-email
- content-creation
- internal-documentation
- value-proposition-framing

**Coder:**
- api-integration-patterns
- data-pipeline-construction
- code-review-standards
- tooling-and-automation

**Analyst:**
- pricing-analysis
- metrics-dashboard-design
- financial-modeling
- data-visualization

**Ops:**
- process-documentation
- coordination-task-execution
- formatting-standards

### Leadership-Only Skills

| Skill | Used By | Purpose |
|---|---|---|
| strategic-planning | CEO | How to run a weekly planning cycle. Read state → assess → prioritize → decompose. |
| post-mortem | CEO | How to analyze initiative failures. Structured lesson extraction. |
| board-request-composition | CEO | How to write effective Board Requests. What justifies a human action request. |
| initiative-decomposition | CEO | How to break a strategic goal into phased task sequences. |
| task-spec-writing | CEO | How to write clear, executable task specs with good acceptance criteria. |
| plan-review | Board Advisor | How to stress-test a CEO plan. What to look for, what to flag. |
| craft-evaluation | Reviewer | How to evaluate quality. Rubric per task type. |
| outcome-evaluation | Judge | How to evaluate spec compliance. Adversarial checklist. |
| worker-routing | Dispatcher | How to match tasks to workers. Performance profile interpretation. |
| context-assembly | Dispatcher | How to assemble worker context packages. What to include, what to omit. |

## Skill Lifecycle

```
                    ┌─────────────┐
                    │   SIGNAL    │
                    │             │
                    │ Reviewer    │
                    │ Judge       │
                    │ Lesson      │
                    │ CEO/Owner   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ CURATOR   │
                    │             │
                    │ Extracts    │
                    │ Structures  │
                    │ Proposes    │
                    └──────┬──────┘
                           │
                           ▼
              ┌────────────────────────┐
              │        DRAFT           │
              │  Proposed skill or     │
              │  refinement. Not yet   │
              │  available to workers. │
              └────────────┬───────────┘
                           │
                    Review gate
                    (CEO / Owner)
                           │
                           ▼
              ┌────────────────────────┐
              │        ACTIVE          │
              │  Available for         │
              │  Dispatcher selection. │◄────── Refinement
              │  Workers can receive   │        (new version,
              │  this skill.           │         Curator proposes,
              └────────────┬───────────┘         review gate)
                           │
                    Evidence of
                    obsolescence
                           │
                           ▼
              ┌────────────────────────┐
              │      DEPRECATED        │
              │  No longer selected    │
              │  by Dispatcher.        │
              │  Archived, not deleted.│
              └────────────────────────┘
```

### Deprecation Triggers

- Strategy pivot makes the skill irrelevant (outreach skills deprecated if CEO shifts to inbound)
- Skill consistently associated with poor outcomes despite refinements
- Role eliminated or restructured
- Superseded by a more comprehensive skill

Deprecated skills are preserved in the audit log. If the strategy pivots back, they can be restored and refined rather than recreated from scratch.

## Storage

### File-Based with Postgres Index

Skills are markdown files. The actual content — procedures, quality criteria, anti-patterns — lives as `.md` files in the monorepo. Postgres holds a lightweight index for the Dispatcher to query against.

**File structure:**

```
precept/
  skills/
    org-wide/
      communication-tone.md
      quality-baseline.md
      data-classification.md
      precepts-interpretation.md
    researcher/
      competitive-analysis.md
      prospect-identification.md
      market-segment-sizing.md
      funding-stage-research.md
    writer/
      cold-outreach-subject-line.md
      cold-outreach-value-prop.md
      internal-status-update.md
    coder/
      api-integration-patterns.md
      csv-data-pipeline.md
    analyst/
      pricing-confidence-marking.md
      competitor-pricing-comparison.md
    ops/
      formatting-standards.md
    leadership/
      strategic-planning.md
      post-mortem.md
      board-request-composition.md
      initiative-decomposition.md
      task-spec-writing.md
      plan-review.md
      craft-evaluation.md
      outcome-evaluation.md
      worker-routing.md
      context-assembly.md
```

Each `.md` file IS the skill. The Curator creates new files. Git handles versioning — every commit to a skill file is a version. Owner reviews via normal workflow.

**Postgres index (Supabase):**

```
skill_index
  id              UUID
  name            TEXT (unique, kebab-case — matches filename)
  scope           ENUM (org_wide, role_specific, leadership_only)
  role            TEXT (nullable — folder name for role_specific/leadership)
  status          ENUM (active, deprecated)
  trigger_tags    TEXT[] (task type tags that trigger this skill)
  file_path       TEXT (relative path to .md file)
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
```

The index is what the Dispatcher queries: "Give me active skills for role:researcher with trigger tags matching [competitive-analysis]." The Dispatcher then reads the `.md` file content and injects it into the worker's context.

**Why files, not database content?**
- Skills are authored and read as documents — markdown is natural
- Git versioning is free and better than a custom version table
- Easy to author: create a file, write procedures, done
- Easy to review: diff a file, see what changed
- The Curator writes files, same as any other agent producing output
- Postgres index stays tiny — just metadata for querying

**Why not pgvector for skills?** Skills are a small, curated set. Tag matching and explicit assignment handle selection cleanly. Semantic search is for large, growing knowledge bases (Role Memory). Skills are structured and intentional — you pick them by type, not by similarity.

## Integration with Existing Architecture

### Skills + Role Memory

Distinct and complementary. Both injected into worker context by the Dispatcher, but serving different purposes.

| | Role Memory | Skills |
|---|---|---|
| **Contains** | Facts, findings, data, contacts | Procedures, steps, quality criteria |
| **Answers** | "What do I know about this?" | "How should I do this?" |
| **Grows by** | Worker self-report on every task | Curator extraction from patterns |
| **Retrieval** | Semantic search (pgvector) | Tag matching + explicit assignment |
| **Volume** | Hundreds of entries over months | Dozens of skills, curated |
| **Example** | "RoboTech: 50-person team, Series B, uses Isaac Sim" | "When researching prospects, always check funding stage, team size, and tech stack" |

### Skills + Performance Memory

Performance profiles tell the Dispatcher what a worker is good at. Skills tell the worker how to be good at it. Connected:

- Worker-4 has low acceptance rate on competitive analysis tasks → Dispatcher loads the competitive-analysis skill with extra emphasis on anti-patterns
- Worker-4 has high acceptance rate on prospect identification → Dispatcher may load the prospect-identification skill in "reference" mode (lighter context weight) since the worker already performs well
- Over time, if a skill consistently improves acceptance rates for workers who receive it, that's evidence the skill is good. If not, it needs refinement.

### Skills + Evaluation Flow

The Reviewer and Judge are both skill consumers and skill feeders.

**As consumers:** The Reviewer can load the craft-evaluation skill. The Judge can load the outcome-evaluation skill. These leadership-only skills make evaluation consistent and improvable — the rubric itself is a skill that can be refined.

**As feeders:** Every Reviewer craft pattern and Judge rejection pattern is raw material for the Curator. The evaluation flow generates the signal. The Curator transforms the signal into skills. The skills improve future worker output. The evaluation flow generates new signal. The loop compounds.

```
Worker output
  → Reviewer evaluates (using craft-evaluation skill)
  → Judge evaluates (using outcome-evaluation skill)
  → Patterns accumulate in Performance Memory + Audit Log
  → Curator reads patterns → creates/refines skills
  → Dispatcher loads refined skills into future worker context
  → Worker output improves
  → Reviewer/Judge see improvement → new, higher-bar patterns
  → Curator refines skills again
  → Loop compounds
```

### Skills + CEO Planning

The CEO is also a skill consumer. Leadership-only skills structure how the CEO approaches different types of strategic work:

- **Weekly planning cycle:** CEO loads strategic-planning skill. Ensures consistent planning methodology across weeks.
- **Post-mortem:** CEO loads post-mortem skill. Ensures structured lesson extraction, not ad hoc reflection.
- **Board Request:** CEO loads board-request-composition skill. Ensures requests are specific, justified, and include fallbacks.
- **Initiative decomposition:** CEO loads initiative-decomposition skill. Ensures phased task breakdowns follow proven patterns.

The CEO can also author skills. When the CEO successfully runs a type of initiative (outreach campaign, product development sprint), it can propose a new skill capturing the approach for future reuse. This goes through the standard review gate.

### Skills + Onboarding

During onboarding (see `onboarding.md`), the owner can author initial skills as part of the Precepts. The Data Policy section already captures classification guidelines — those become the data-classification org-wide skill. Communication preferences become the communication-tone skill. Quality expectations become the quality-baseline skill.

Post-onboarding, the CEO's first planning cycle may identify skill gaps: "We need a prospect-identification skill but don't have one yet." This becomes either an authored skill (CEO writes it) or a research task (worker researches best practices → Curator structures the findings into a skill).

## Updated Organizational Hierarchy

The Curator slots in as a system-level role alongside the Scribe:

```
BOARD (Owner / Juandi)
  │
  ├── Board Advisor (Opus — weekly)
  │
  └── CEO (Opus)
        │
        ├── Reviewer (Opus — continuous, first evaluation gate)
        │
        ├── Judge (Opus — continuous, second evaluation gate)
        │
        ├── Scribe (Sonnet 4.6 — system role, context compression)
        │     Reads raw activity → compresses for CEO
        │
        ├── Curator (Sonnet 4.6 — system role, skill management)
        │     Reads patterns → creates/refines skills
        │
        └── Dispatcher (Opus — continuous, execution logistics)
              │
              │  Now also: selects relevant skills for each task
              │  and includes them in worker context packages
              │
              └── Workers (Sonnet 4.6, parallel)
                    Receive: task spec + skills + role memory +
                    chain context + Team Bulletin
```

Both system-level roles (Scribe, Curator) share key properties:
- Not workers — don't go through Reviewer/Judge pipeline
- Sonnet 4.6 — don't need Opus-level reasoning for their tasks
- Batch-oriented — run on schedule, not continuously
- Their output quality is monitored indirectly through downstream impact

## Bootstrapping (V0.1)

The Curator doesn't exist in Sprint 1. Skills start as authored documents — the owner writes them based on experience and judgment.

**Sprint 1-2:** No skills system. All procedural knowledge lives in system prompts.

**Sprint 3:** Introduce skills table in Supabase. Migrate procedural instructions from system prompts into authored skills. Dispatcher begins loading skills into worker context. CEO begins using leadership-only skills.

**Sprint 4:** Introduce the Curator. Start extracting skills from Reviewer/Judge patterns. First refined skills appear. The self-learning loop begins.

The owner should author 3-5 foundational skills before Sprint 3:
- communication-tone (org-wide, rooted in Precepts values)
- quality-baseline (org-wide, minimum standards)
- At least 1-2 role-specific skills for the most common task types

These seed skills give the Curator a reference point for the quality and narrowness it should aim for.

## Retention Policy

| Type | Retention | Cleanup |
|---|---|---|
| Active skills | Permanent, versioned | None — active skills are the system's operational knowledge |
| Skill versions | Permanent | None — revision history is valuable for understanding capability evolution |
| Draft skills | 30 days | Drafts not promoted to active within 30 days are archived with a note |
| Deprecated skills | Permanent (archived) | Moved to archive table, restorable |

## All Storage in Supabase

Like all other PRECEPT data, skills live in Postgres (Supabase). No separate file system, no external skill registry. One database, one backup strategy, one source of truth.

Estimated storage for V1 (first 6 months):
- Skills table: <1MB (dozens of skills, text-heavy but small volume)
- Skill versions: <2MB (each version is a JSONB snapshot)

Negligible compared to audit log and role memory.

## Relationship to Memory Architecture

Skills are the fifth memory type — or more precisely, they're the procedural complement to the four memory types defined in `memory.md`:

| Memory Type | What it stores | Skills relationship |
|---|---|---|
| **Institutional** | What happened, what was decided, what was learned | Lesson artifacts feed the Curator → become skills |
| **Role** | What this role knows (facts, data, findings) | Role Memory and skills are co-loaded by the Dispatcher. Knowledge + procedure. |
| **Performance** | How capable is this agent | Performance data signals which skills need refinement |
| **Operational** | What's happening right now | Task chain context may reference which skills were used on predecessor tasks |
| **Skills** | How to do specific types of work well | Loaded on demand, not permanent context. The "how" to memory's "what." |

Memory without skills: the system knows things but doesn't know how to apply them consistently.
Skills without memory: the system has procedures but no domain knowledge to execute them against.
Together: compounding capability. Every cycle makes the system better at doing the right things the right way.
