---
date: 2026-03-01
project: precept
status: approved
---

# PRECEPT V1 — Memory Architecture

How the system remembers. Four memory types serving different purposes, audiences, and lifecycles — plus a fifth type (skills) that stores procedural knowledge separately. See `skills.md` for the full skills architecture.

Memory is what makes day 30 fundamentally better than day 1. Without it, agents re-do work, lose accumulated knowledge, and produce contradictions. With it, the system self-learns — every interaction compounds. Memory stores what the system knows. Skills (the fifth type) store how the system works. Together they compound: knowledge + procedure.

## Five Memory Types

This document covers types 1-4. Type 5 (Skills) is covered in `skills.md`.

| # | Type | Purpose | Lifespan | Storage |
|---|---|---|---|---|
| 1 | **Institutional** | What has the organization learned? | Permanent, append-only | Postgres tables |
| 2 | **Role** | What does this role know? | Permanent per role, survives agent swaps | Postgres + pgvector |
| 3 | **Performance** | How capable is this agent? | Per agent, resets on swap | Postgres tables |
| 4 | **Operational** | What's happening right now? | Per initiative, transient | Postgres tables |
| 5 | **Skills** | How should this type of work be done? | Permanent, versioned via git | `.md` files in monorepo + Postgres index |

## Type 1: Institutional Memory

The organization's permanent record. Shared across all agents. Never deleted.

### Audit Log

Append-only record of every action in the system.

- Every task state transition (with timestamp, agent, reasoning)
- Every agent invocation (input summary, output summary, tokens, cost)
- Every CEO decision, Judge verdict, Reviewer evaluation
- Every Dispatcher routing choice
- Every Board Request and owner response
- Every Precepts update (what changed, who initiated)
- Every model swap (which agent replaced, why)

**Who writes:** All agents (automatic, logged by the engine at each orchestration step).
**Who reads:** Scribe (compresses for CEO), Board Advisor (during plan review), Owner (full access via Decision Room).

**Storage:** Postgres table. Append-only — nothing edited or deleted. The audit log itself is classified as RESTRICTED under the security model.

### Decision Log

CEO's strategic choices and reasoning. Provides consistency over time.

```
DECISION: Prioritize outreach over product development
DATE: 2026-03-15
INITIATIVE: Initiative-003
REASONING: 90-day metric requires revenue signals. Product is functional
  enough for demos. Outreach generates pipeline data regardless of close rate.
ALTERNATIVES CONSIDERED: Product polish, content marketing
WHY NOT: Product polish delays market feedback. Content marketing is
  slower to generate signal at this stage.
```

**Who writes:** CEO (after each planning cycle).
**Who reads:** CEO (own past decisions for consistency), Board Advisor (catches repeating failed patterns), Scribe (includes in CEO context when relevant).

### Lesson Artifacts

Structured records of wins and failures. The self-learning loop.

```
LESSON: Cold email value prop needs specificity
DATE: 2026-03-20
INITIATIVE: Initiative-003 (Outreach)
WHAT WE TRIED: Generic value prop in cold emails ("we help with training data")
WHAT HAPPENED: 2% response rate across 50 emails
WHY IT FAILED: Value prop too vague — prospects couldn't see specific relevance
WHAT WE LEARNED: Specificity drives response. "We reduced labeling time by 40%
  for RoboTech's manipulation training" outperforms generic framing.
WHAT TO DO DIFFERENTLY: Always include a specific, quantified result in outreach
NEVER REPEAT: Generic value props in cold outreach
```

**Who writes:** CEO (after post-mortems on failed or successful initiatives).
**Who reads:** CEO (before every planning cycle), Board Advisor (during plan review — catches CEO proposing strategies that match a "NEVER REPEAT"), Scribe (includes recent lessons in CEO context).

### Owner Feedback History

Every approval, rejection, redirect, and preference the owner has expressed.

```
FEEDBACK: Rejected Initiative-005 proposal
DATE: 2026-03-22
CONTEXT: CEO proposed targeting companies under 50 employees
OWNER RESPONSE: "Too small. Focus on 200+ employee companies with robotics teams."
PATTERN: Owner has now rejected small-company targeting twice.
INFERRED PREFERENCE: Minimum company size = 200 employees for outreach targeting.
```

Over time, this teaches the CEO the owner's judgment patterns. Parsed from email replies (via AgentMail) and Decision Room interactions.

**Who writes:** Engine (automatic parsing of owner responses).
**Who reads:** CEO (learns owner preferences over time), Scribe (includes in CEO context).

## Type 2: Role Memory (Knowledge Base)

Cumulative domain knowledge attached to the **role**, not the agent number. If Worker-4 (Researcher, Qwen 3.5) is replaced by Worker-7 (Researcher, Mistral), Worker-7 inherits the full Researcher knowledge base. Performance profile resets, knowledge doesn't.

### Storage

Postgres + pgvector. Each entry stored as:
- Text content (the knowledge itself)
- Embedding vector (for semantic retrieval)
- Metadata: role, domain, source task, date, confidence level

### Entry Format

```
ROLE: Researcher
ENTRY DATE: 2026-03-15
DOMAIN: Robotics market — Bay Area
FINDINGS: 12 companies identified. 4 match ICP. Top prospects:
  RoboTech (most engaged), NeuralSim, BayBot, SimDrive.
  RoboTech uses Isaac Sim, 50-person robotics team, Series B.
SOURCE TASK: Task-047
CONFIDENCE: High (primary research, verified)
STATUS: Active
```

### How Entries Get Created

Three sources feed role memory:

**1. Workers self-report (primary source)**
Every task output includes a structured "key findings" section. When a task reaches ACCEPTED, the engine extracts this section and stores it as a raw role memory entry with the appropriate role tag.

Workers are prompted: "At the end of your output, include a KEY FINDINGS section listing any facts, contacts, data points, or insights discovered during this task that would be valuable for future work in your role."

**2. Reviewer contributes craft patterns**
The Reviewer evaluates every piece of work for a role. Over time, it identifies craft patterns:
- "Researcher outputs improve when given competitor framing upfront"
- "Writer consistently struggles with concise subject lines"
- "Coder produces cleaner output when given example code in the spec"

These patterns are stored as role memory entries tagged as `craft_pattern`. They inform how the Dispatcher and CEO spec future tasks for that role. They also feed the Curator's weekly skill extraction cycle — recurring patterns become procedural skills (see `skills.md`).

**3. Batch cleanup (daily)**
Raw entries accumulate throughout the day. A daily batch process (run by the Scribe or a scheduled function):
- **Deduplicates** — merges entries about the same topic from different tasks
- **Structures** — normalizes format, fills metadata gaps
- **Flags stale** — marks entries not retrieved in 30+ days for review
- **Archives** — removes confirmed stale entries from active search (preserved in cold storage)

### Retrieval

When the Dispatcher assembles a worker's context for a task:

1. Embed the task description using the same embedding model
2. Run semantic search against the role's knowledge base (pgvector similarity query)
3. Return top-K relevant entries (configurable, start with K=5)
4. Include in worker's context package alongside task spec, selected skills (see `skills.md`), chain context, and Team Bulletin

The worker sees only what's relevant to the current task, not the entire knowledge base. This keeps context focused and prevents confusion from irrelevant domain data.

### Why Semantic Search, Not Full Injection

Role memory grows over time. After 3 months, a Researcher might have hundreds of entries spanning multiple domains and initiatives. Dumping all of it into every task context would:
- Waste tokens on irrelevant information
- Confuse the worker with data from unrelated initiatives
- Hit context window limits

Semantic search solves this: only entries relevant to the current task get injected. A task about "Bay Area robotics prospects" pulls in the RoboTech entry but not entries about East Coast manufacturing companies.

## Type 3: Performance Memory

Individual agent capability tracking. Written by the Reviewer, read by the Dispatcher and CEO.

### Per-Agent Profile

```
AGENT: Worker-4 (Researcher, Qwen 3.5)
TRUST LEVEL: Journeyman
TASKS COMPLETED: 34
REVIEW STATS:
  Reviewer: 30 GOOD, 3 EXCELLENT, 1 POLISH
  Judge: 29 ACCEPT, 4 REVISION, 1 ESCALATE
ACCEPTANCE RATE: 85%
RECENT TREND: Improving (last 10: 90%)
STRENGTHS: Market research, competitor analysis, prospect identification
WEAKNESSES: Technical deep-dives (3 failures), long-form synthesis
CRAFT NOTES: Strong data gathering, needs work on organizing findings hierarchically
CURRENT STATUS: Active
```

### Who Writes

**The Reviewer** — after every evaluation, updates the agent's profile:
- Increment task count
- Update acceptance/revision/polish rates
- Add craft observations to strengths/weaknesses
- Recalculate recent trend

### Who Reads

**Dispatcher** — routes tasks based on performance profiles:
- Match task type to agent strengths
- Avoid known weaknesses unless no alternative
- Prefer agents with improving trends for stretch assignments

**CEO** — sees aggregate team capability during planning:
- "Research capability strong (90% acceptance). Writing weak (70% acceptance). Plan accordingly or request model upgrade for Writer role."
- Informs worker requisition decisions (need a stronger Writer? Different model?)

**Agents themselves** — each worker's system prompt includes their stats:
- "You have completed 34 tasks with 85% acceptance rate. Recent trend: improving. You are trusted with independent research tasks."
- Prompt framing with real performance data measurably affects output quality

### Lifecycle

- Performance profiles are **per agent number** — Worker-4's profile belongs to Worker-4
- When a model is swapped (Worker-4 replaced by Worker-7), performance profile **resets**
- Role memory (knowledge base) **persists** — the new agent inherits domain knowledge
- This matches the Guild system: a new journeyman doesn't get credit for the previous journeyman's track record, but they do get access to the guild's accumulated knowledge

## Type 4: Operational Memory

Short-lived memory that exists while work is active. Managed by the Dispatcher and engine.

### Task Chain Context

For multi-step initiatives (research → analysis → outreach), the Dispatcher manages context passing:

- CEO defines chains during planning: "Task B uses output of Task A as input"
- The dependency graph encodes this relationship
- When Task A reaches ACCEPTED and Task B moves to QUEUED:
  - Dispatcher includes Task A's accepted output in Task B's context
  - For longer chains, includes the most recent 2-3 predecessor outputs
  - If the full chain history exceeds reasonable context size, the Scribe summarizes earlier steps

**Lifecycle:** Exists only while the initiative is active. When an initiative completes or is abandoned, chain context is no longer needed. Valuable findings have already been extracted into role memory via the worker self-report mechanism.

### Team Bulletin

Condensed summary of recent activity across all workers. One-liner per accepted task.

```
RECENT TEAM ACTIVITY:
- Researcher: Identified 12 robotics companies in Bay Area. 4 match ICP.
- Writer: Cold outreach email v2 accepted. Judge noted strong value prop.
- Coder: CSV parser for prospect ingestion. Accepted first pass.
- Analyst: Competitive pricing analysis. 3 competitors, $2k-8k/mo range.
```

**Generated from:** Recent ACCEPTED entries in the audit log. No LLM needed for V1 — formatted log of task titles + verdicts.

**Who reads:** All workers (appended to task context as ambient awareness). Workers see team progress, enabling serendipitous connections (Writer sees Analyst's pricing data, naturally incorporates it).

**System prompt framing:** "Recent work by other team members. Use for context if relevant to your current task. Do not act on it — informational only."

**Lifecycle:** Regenerated periodically from audit log. Not stored permanently — it's a rolling window of recent activity.

### Initiative State

Progress tracking for each active initiative.

- Which phase (Phase 1, Phase 2, etc.)
- Tasks per phase: completed, in progress, queued, blocked, escalated
- Timeline: when started, expected completion
- Dependencies between initiatives (if any)

**Who writes:** Dispatcher (updates as tasks move through states).
**Who reads:** Dispatcher (execution management), Scribe (compresses for CEO), CEO (during planning cycles).

**Lifecycle:** Active while initiative is running. Archived (not deleted) when initiative completes. Archived initiative state feeds lesson artifacts and post-mortems.

## Memory Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INSTITUTIONAL MEMORY                             │
│                     (Permanent, shared)                              │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  ┌────────────┐ │
│  │  Audit Log  │  │  Decision   │  │  Lesson    │  │  Owner     │ │
│  │  (all agents│  │  Log        │  │  Artifacts │  │  Feedback  │ │
│  │   write)    │  │  (CEO)      │  │  (CEO)     │  │  (engine)  │ │
│  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  └─────┬──────┘ │
│         │                │               │                │        │
└─────────┼────────────────┼───────────────┼────────────────┼────────┘
          │                │               │                │
          ▼                ▼               ▼                ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  SCRIBE (Sonnet 4.6)                                        │
   │  Reads institutional memory → compresses → CEO context      │
   │  Also surfaces skill changes from Curator                   │
   └──────────────────────────────────┬───────────────────────────┘
                                      │
                                      ▼
                               ┌──────────────┐
                               │  CEO (Opus)   │
                               └──────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     ROLE MEMORY                                      │
│                     (Permanent, per role)                             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Knowledge Base (Postgres + pgvector)                     │      │
│  │                                                           │      │
│  │  Written by: Workers (self-report), Reviewer (craft)      │      │
│  │  Cleaned by: Daily batch process                          │      │
│  │  Read by: Workers (via Dispatcher semantic search),        │      │
│  │           Curator (craft patterns → skill extraction)      │      │
│  └──────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     PERFORMANCE MEMORY                                │
│                     (Per agent, resets on swap)                       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Agent Profiles                                           │      │
│  │                                                           │      │
│  │  Written by: Reviewer (after every evaluation)            │      │
│  │  Read by: Dispatcher (routing), CEO (planning),           │      │
│  │           Agents (self-awareness in system prompt)         │      │
│  └──────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     OPERATIONAL MEMORY                                │
│                     (Transient, per initiative)                       │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐      │
│  │  Task Chain    │  │  Team Bulletin  │  │  Initiative      │      │
│  │  Context       │  │  (rolling)      │  │  State           │      │
│  │  (Dispatcher)  │  │  (engine)       │  │  (Dispatcher)    │      │
│  └────────────────┘  └────────────────┘  └──────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

## Retention Policy

| Memory Type | Retention | Cleanup |
|---|---|---|
| Audit Log | Permanent. Never deleted. | None — append-only. Archive old entries to cold storage if DB size becomes a concern. |
| Decision Log | Permanent. | None. |
| Lesson Artifacts | Permanent. | None — these compound in value over time. |
| Owner Feedback | Permanent. | None — preference patterns become more accurate with more data. |
| Role Memory | Active entries permanent. Stale entries archived. | Daily batch: flag entries not retrieved in 30+ days. Archive after review. Preserved in cold storage, restorable. |
| Performance Memory | Per agent lifetime. Reset on swap. | Automatic — old agent profiles archived when agent is replaced. |
| Task Chain Context | Per initiative lifetime. | Cleaned when initiative completes. Valuable findings already extracted to role memory. |
| Team Bulletin | Rolling window. | Regenerated periodically. No permanent storage needed. |
| Initiative State | Per initiative lifetime. | Archived (not deleted) on completion. Feeds post-mortems. |

## All Storage in Supabase

All four memory types live in Postgres (Supabase). Role memory embeddings use pgvector. No separate vector database, no external memory service. One database, one backup strategy, one source of truth.

Estimated storage breakdown for V1 (first 3 months of operation):
- Audit log: ~50-100MB (text-heavy, grows with activity)
- Role memory + embeddings: ~10-20MB (text + 1536-dim vectors)
- Everything else: <5MB (structured data, small volume)

Well within Supabase free tier (500MB).
