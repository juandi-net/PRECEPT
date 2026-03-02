---
date: 2026-03-01
project: precept
status: approved
---

# PRECEPT V1 — Organizational Structure

The structure IS the product. Everything below defines how PRECEPT operates as an agentic organization. Technology implements the structure, not the other way around.

See `orchestration.md` for the engine that implements this structure, `memory.md` for the knowledge architecture, `skills.md` for procedural memory and the Curator role, `security.md` for data classification and access controls, `interface.md` for how the owner interacts with this organization.

## Foundational Principles

Derived from the most enduring organizational structures in history. Each principle maps directly to a structural decision.

| Principle | Source | PRECEPT Application |
|---|---|---|
| Tiered judgment | Exodus 18 | Workers execute, Judge/Reviewer evaluate, CEO strategizes, Board governs |
| Capable AND aligned | Exodus 18 | Opus for leadership roles, best-per-domain for workers, all grounded in Precepts values |
| Free leadership | Acts 6 | CEO doesn't do worker tasks. Owner doesn't do CEO tasks. Each tier owns its level. |
| Reflection before action | Benedictines, Quakers | CEO absorbs full state before planning. Never plans and acts simultaneously. |
| Rhythmic cycles | Benedictines | Weekly strategic planning, daily briefings, continuous execution between. |
| Consultative authority | Benedictines | CEO reads Team Bulletin and worker signals before deciding. |
| Standardized structure | Roman Legion | Precepts changes per business, structure doesn't. Any business slots in. |
| Detailed orders | Roman Legion | CEO decomposes tasks with precise specs. Workers execute faithfully, don't improvise strategy. |
| Merit-based trust | Mongols, Guilds | Autonomy increases with proven performance. Reviewer tracks craft quality over time. |
| Stop cord | Toyota Jidoka | Workers and Judge halt and flag problems, not blind execution. |
| Micro-improvement | Toyota Kaizen | Lesson artifacts from every failure and win. System self-learns. |
| Dual evaluation | Guild System | Judge evaluates outcome (spec compliance). Reviewer evaluates craft (quality). Two independent gates. |
| Model-agnostic roles | Ottoman Devshirme | Best model per role, swap underperformers. Structure survives model changes. |

## Organizational Hierarchy

```
BOARD (Owner / Juandi)
  Mission, values, strategy approval, escalation decisions.
  Interacts via: daily briefing email, Decision Room web UI.
  Time commitment: 30 min/day reviewing briefing + 2-3 decisions.
  │
  ├── BOARD ADVISOR (Opus — weekly)
  │     Reviews CEO's weekly strategic plan before owner sees it.
  │     Adversarial to the CEO's reasoning, not the CEO's authority.
  │     Verdicts: APPROVED / APPROVED WITH CONCERNS / FLAGGED
  │     "Approved with concerns" annotates but doesn't block.
  │     "Flagged" stops the plan — goes to owner with Advisor's concerns.
  │
  └── CEO (Opus — weekly planning + event-driven)
        Strategic brain. Reads Precepts + state, generates initiatives,
        decomposes into phased task plans. Hands plan to Dispatcher.
        Does NOT interact with workers directly.
        │
        ├── REVIEWER (Opus — continuous, first evaluation gate)
        │     Craft quality evaluation. Quality-focused, not adversarial.
        │     Receives: worker output + task spec + domain context.
        │     Question: "Is this work well-crafted?"
        │     Verdicts:
        │       POLISH    → craft feedback, worker refines → back to Reviewer
        │       GOOD      → passes to Judge
        │       EXCELLENT → commendation logged, feeds performance profile → passes to Judge
        │     Builds: performance profiles, craft quality tracking per worker per task type.
        │     Ensures only polished work reaches the Judge for outcome decision.
        │
        ├── JUDGE (Opus — continuous, second evaluation gate)
        │     Outcome evaluation. Adversarial by default.
        │     Receives: Reviewer-approved output + task spec + acceptance criteria.
        │     Does NOT receive: CEO's planning rationale (prevents bias).
        │     Question: "Does this achieve what was asked?"
        │     Verdicts:
        │       ACCEPT    → Dispatcher notified, dispatches dependent tasks
        │       REVISE    → spec/strategic feedback, worker reworks → back to Reviewer
        │       ESCALATE  → to CEO (spec/capability/strategy problem)
        │
        ├── SCRIBE (Sonnet 4.6 — system role, context compression)
        │     Reads raw activity → compresses for CEO context.
        │     Not a worker — does not go through Reviewer/Judge pipeline.
        │     Also surfaces skill changes to CEO during planning cycle.
        │
        ├── CURATOR (Sonnet 4.6 — system role, skill management)
        │     Reads Reviewer/Judge patterns → creates/refines skill files.
        │     The self-learning loop's mechanism. See `skills.md`.
        │     Not a worker — does not go through Reviewer/Judge pipeline.
        │
        └── DISPATCHER (Opus — continuous, execution logistics)
              Receives CEO's phased plan. Translates strategy into organized execution.
              The only role that directly assigns work to workers.
              │
              │  Owns:
              │  • Build and manage dependency graph from CEO's plan
              │  • Route tasks to specific workers (based on performance profiles + strengths)
              │  • Select and load relevant skills into worker context (see `skills.md`)
              │  • Dispatch parallel tasks simultaneously, hold dependent tasks
              │  • Pass output from step N as input context to step N+1 (task chains)
              │  • Monitor for blocks — flag upward if execution stalls
              │  • Tactical adaptation: worker fails → retry, reroute, or restructure sequence
              │
              │  Does NOT:
              │  • Set strategy (CEO's job)
              │  • Evaluate output quality (Judge/Reviewer's job)
              │  • Make strategic decisions when things go wrong (escalates to CEO)
              │
              └── WORKERS (Sonnet 4.6 via CLIProxy — continuous, parallel)
                    Execute atomic tasks with clear specs. Don't make strategic decisions.
                    If they encounter something contradicting strategy, they flag it — don't act on it.
                    │
                    ├── Researcher — market research, data gathering, competitor analysis
                    ├── Coder — code generation, tooling, technical implementation
                    ├── Writer — outreach, content, documentation, communications
                    ├── Analyst — data analysis, financial modeling, metrics
                    ├── Ops — process execution, formatting, coordination tasks
                    │
                    └── [Team Bulletin — ambient cross-worker awareness]
                          One-liner per recent task. Informational only.
                          Workers see team progress. Enables serendipitous connections.
```

## Execution & Evaluation Flow

The Dispatcher orchestrates execution. Every worker output passes through two independent evaluation gates.

```
CEO produces phased plan
  │
  ▼
DISPATCHER receives plan
  → Builds dependency graph
  → Routes tasks to workers (based on performance profiles + strengths)
  → Dispatches parallel tasks simultaneously
  → Holds dependent tasks until prerequisites complete
  │
  ▼
Worker produces output
  │
  ▼
GATE 1: REVIEWER (Quality)
  "Is this work well-crafted?"
  │
  ├── POLISH → craft feedback → worker refines → back to Reviewer
  │
  └── GOOD / EXCELLENT → passes to Gate 2
        (EXCELLENT also logs commendation, feeds performance profile)
        │
        ▼
GATE 2: JUDGE (Outcome)
  "Does this achieve what was asked?"
  │
  ├── REVISE → spec/strategic feedback → worker reworks → back to Reviewer (Gate 1)
  │              └── 2 revision cycles failed → ESCALATE
  ├── ESCALATE → CEO diagnoses:
  │     Spec problem → CEO rewrites spec, Dispatcher re-dispatches
  │     Capability problem → Dispatcher routes to different worker/model
  │     Strategy problem → CEO pauses initiative
  │
  └── ACCEPT → Dispatcher notified → dispatches dependent tasks
```

**Why Reviewer before Judge (quality before outcome):**
- Present your best work for judgment. Like a restaurant: sous chef checks quality, then head chef decides if it goes to the customer.
- The more common failure mode (cheap models producing rough output) gets caught first, before wasting the Judge's evaluation.
- The Judge only sees polished work. Its ACCEPT means both "well-crafted" AND "achieves the objective."
- When the Judge says REVISE or ESCALATE, it's a strategic/spec issue — not a craft issue. Cleaner signal.

**Why two evaluation gates:**
- The Reviewer is quality-focused — looking for craft and thoroughness.
- The Judge is adversarial — looking for spec failures and strategic misalignment.
- Combining these in one prompt creates conflicting evaluation mindsets.
- The Reviewer builds institutional knowledge about what "good" looks like — the Judge doesn't track this.

**Why a Dispatcher between CEO and Workers:**
- The CEO sets strategy and defines tasks — it shouldn't manage execution logistics (Acts 6: free leadership from ops).
- Workers can't self-coordinate — they only see their individual task.
- The Dispatcher fills the coordination gap: dependency management, worker routing, task chain context passing, tactical adaptation when execution doesn't go as planned.
- Like a Roman centurion — doesn't set the battle plan, doesn't inspect the work, but makes sure the right squad is at the right place at the right time.

## Operating Rhythm

### Weekly Strategic Cycle
- **When:** Scheduled (e.g., Sunday night)
- **Who:** CEO (Opus) + Board Advisor (Opus) + Owner approval
- **What:** CEO reads full Precepts + compressed state + performance data + lesson artifacts. Generates the week's initiatives with phased task breakdown. Board Advisor reviews for strategic errors before owner sees it.
- **Output:** Approved weekly plan with Phase 1 fully decomposed and later phases outlined.

### Daily Briefing
- **When:** Scheduled (e.g., 7am)
- **Who:** CEO compiles, sent via AgentMail
- **What:** Not a planning call — a reporting call. Summarizes yesterday's activity, decisions needed, what's in progress, what's next.
- **Output:** Email to owner. Owner replies inline with approvals/redirects/holds.

### Continuous Execution
- **When:** Always running between scheduled cycles
- **Who:** Workers + Judge + Reviewer (autonomous). CEO invoked only on triggers.
- **What:** Tasks dispatch automatically from the weekly plan based on dependencies. Judge and Reviewer evaluate. Routine work flows without CEO involvement.

### CEO Trigger Events (between scheduled cycles)
The CEO is always *available*, not always *processing*. It gets invoked for:
1. **Judge escalation** — worker output failed twice, needs diagnosis
2. **Phase completion** — initiative phase done, CEO decomposes next phase with fresh data
3. **Owner input** — reply to briefing or message in Decision Room (highest priority)
4. **Initiative-level signal** — results aren't matching the hypothesis, needs strategic review

Everything else runs on autopilot within the boundaries the CEO set during weekly planning.

## CEO Context Assembly

The CEO's job is to think about the future and evaluate results. It does not process operational detail. Context is assembled in layers before every CEO invocation.

### What the CEO sees:

| Layer | Content | Purpose |
|---|---|---|
| **Precepts** | Full document, always present | Strategic foundation — identity, product, success definition, constraints |
| **Results** | Initiative-level outcome summaries, north star metric movement | "Are we winning? Where are we gaining/losing ground?" |
| **Lessons** | Recent lesson artifacts (wins and failures) | "What did we learn? What should we never repeat?" |
| **Exceptions** | Escalations, blocked initiatives, unresolved problems | "What needs my attention right now?" |
| **Owner Input** | Recent Board feedback, approvals, redirects, Board Requests responses | "What did the Board say?" |
| **Forward Context** | Market signals, upcoming deadlines, resource status, open questions | "What's coming? What's changing?" |

### What the CEO does NOT see:
- Individual task completions (Judge/Reviewer domain)
- Worker-level operational details (drafts, revision cycles, routine verdicts)
- The raw activity log (hundreds of atomic events)

### The Scribe (Sonnet 4.6 via CLIProxy)

A dedicated system-level role that prepares the CEO's context. Not a worker — does not go through the Reviewer/Judge pipeline. Runs before every CEO invocation.

```
Raw activity log (every task, verdict, event)
  │
  ▼
Scribe (Sonnet 4.6) distills into:
  • Initiative-level results summaries
  • Exception report (escalations, blocks, failures)
  • Pattern observations (recurring issues, emerging trends)
  • Skill changes (new/refined skills from Curator since last cycle)
  • Forward context (upcoming deadlines, resource status)
  │
  ▼
CEO context package assembled:
  Precepts + Scribe's output + Lesson artifacts + Owner Input
```

This keeps the CEO focused on what only a CEO can do — absorb results, learn from them, and decide what the organization should do next. Operational detail stays at the operational tier.

See `orchestration.md` for full Scribe behavior and context assembly details.

## Tiered Execution Model

The hierarchy determines what each tier owns. Violating tier boundaries degrades the system.

| Tier | Owns | Does NOT do |
|---|---|---|
| **Board (Owner)** | Mission, values, strategy approval, escalation decisions (see `interface.md` for how the owner interacts with this hierarchy) | Operational tasks, worker management, day-to-day coordination |
| **Board Advisor** | CEO plan review, strategic error detection | Task assignment, worker evaluation, direct worker interaction |
| **CEO** | Strategic planning, initiative decomposition, task specs, escalation diagnosis, briefing compilation | Worker output evaluation (Judge's job), craft assessment (Reviewer's job) |
| **Judge** | Outcome evaluation (spec compliance), accept/revise/escalate verdicts | Strategic decisions, quality assessment, task assignment, dispatch |
| **Reviewer** | Craft quality evaluation, performance profiling, quality tracking | Outcome evaluation, strategic decisions, task assignment, dispatch |
| **Scribe** | Context compression for CEO, surfacing skill changes and pattern observations | Strategy, evaluation, task assignment, direct worker interaction |
| **Curator** | Skill creation and refinement from Reviewer/Judge patterns (see `skills.md`) | Strategy, evaluation, task assignment, direct worker interaction |
| **Dispatcher** | Dependency graph, task routing, worker assignment, skill selection, task chain context, tactical adaptation | Strategy, evaluation, quality assessment — escalates to CEO when blocked |
| **Workers** | Faithful task execution within provided specs | Strategic decisions, self-evaluation, initiative planning, self-coordination |

## Agent Identity

Every agent has a numbered identity: CEO-1, Judge-1, Reviewer-1, Worker-1, etc. When a model is swapped, the new agent gets the next number. History stays attached to the number. Role knowledge persists across agent swaps.

Each agent's system prompt includes:
- The full organizational structure and their place in it
- Why their role exists
- What they're responsible for
- What they're explicitly NOT responsible for
- Their performance profile (tasks completed, acceptance rate, trend)
- The Precepts values as foundational identity

## Communication Channels

```
Board ◄──► CEO            : Briefing email (daily), Decision Room (on-demand), Board Requests (CEO → Board)
CEO ──► Dispatcher         : Phased plan with task specs (one-way command)
Dispatcher ──► Workers     : Task assignments with specs + context (one-way command)
Workers ──► Reviewer       : Output submission (one-way)
Reviewer ──► Workers       : POLISH feedback (one-way)
Reviewer ──► Judge         : Quality-approved outputs (one-way)
Judge ──► Workers          : REVISE feedback (one-way, rework goes back through Reviewer)
Judge ──► CEO              : ESCALATE (exception channel)
Judge ──► Dispatcher       : ACCEPT signal (triggers dependent dispatch)
Dispatcher ──► CEO         : Block/stall reports (exception channel)
Workers ──► All Workers    : Team Bulletin (ambient, read-only)
Advisor ──► CEO            : Weekly plan review memo (one-way)
Advisor ──► Board          : FLAGGED plans (exception channel)
```

No lateral communication between workers. No upward decision-making from workers. The CEO does not interact with workers directly — the Dispatcher manages all task assignment. Information flows through defined channels only.

## Failure Handling — Three Levels

### Level 1: Worker Failure (task output rejected)
Most common, least serious. Judge catches, sends back for revision (max 2x). If still fails, Judge escalates to CEO. CEO diagnoses:
- **Spec problem** → CEO rewrites task spec, retries
- **Foundation problem** → CEO flags Precepts section needing update, Board Request to owner
- **Strategy problem** → CEO pauses initiative, includes in next weekly review
- **Capability problem** → route to different model or flag for owner

### Level 2: Initiative Failure (strategy didn't produce results)
Workers executed fine but results didn't come. CEO runs a post-mortem with structured lesson artifact. Post-mortem logged in Decision Log. Board Advisor reads it — catches CEO if it proposes same failing strategy again.

### Level 3: Systemic Failure (business isn't progressing)
North star metric hasn't moved after sustained effort. Triggers Board Escalation — structured strategic conversation with the owner. May result in Precepts rewrite, pivot, or fundamental restructuring.

## Memory Architecture

Five memory types. See `memory.md` for types 1-4 in detail, `skills.md` for type 5.

### Organizational Memory (shared)
Decision Log, lesson artifacts, Team Bulletin. Answers: "What has the organization learned?"

### Role Memory (per role, persists across agent swaps)
Cumulative domain knowledge attached to the ROLE, not the agent number. Semantic search retrieval — only relevant entries injected per task. Answers: "What does this role know?"

### Task Chain Memory (per initiative, temporary)
Multi-step initiative context. CEO defines chains, execution engine passes output from step N as input to step N+1. Answers: "What happened earlier in this project?"

### Skills (procedural memory, per role + org-wide)
Externalized procedures, quality criteria, and anti-patterns stored as `.md` files in the monorepo. Loaded on demand by the Dispatcher — not carried permanently in system prompts. Created by the owner, CEO, or Curator. Answers: "How should this type of work be done?"

## Structural Success Metrics

Structure is evaluated by results, not elegance. Monthly structural post-mortem.

- **Mission alignment:** What % of completed initiatives directly advanced a stated goal?
- **Goal velocity:** Are we closer to the 90-day target than last week?
- **Owner leverage:** Is the owner doing less operational work over time?
- **Self-learning:** Are lesson artifacts making future performance measurably better?
- **Vision coherence:** Does cumulative work tell a coherent narrative toward the long-term vision?
