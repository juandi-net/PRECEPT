---
date: 2026-03-01
project: precept
status: approved
---

# PRECEPT V0.1 — Orchestration

How the engine runs. Task lifecycle, Dispatcher behavior, context assembly, scheduling, and recovery.

See `structure.md` for the organizational hierarchy and evaluation flow, `skills.md` for procedural memory and the Curator role, `interface.md` for the design philosophy behind briefings, reply parsing, and the Decision Room. This document covers the technical orchestration that implements that structure.

## Engine Architecture

The engine is a standalone TypeScript service running in Docker on Fly.io. It is stateless — all execution state lives in Supabase. The engine can restart at any time without data loss.

Three entry points feed into a single orchestration core:

```
┌─────────────────────────────────────────────────────────────┐
│                      PRECEPT ENGINE                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │  Scheduler    │  │  Webhook     │  │  DB Listener      │ │
│  │  (node-cron)  │  │  Handler     │  │  (task state      │ │
│  │              │  │  (HTTP)      │  │   changes)        │ │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘ │
│         │                 │                    │            │
│         ▼                 ▼                    ▼            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Orchestration Core                      │   │
│  │                                                      │   │
│  │  Routes events to the appropriate agent:             │   │
│  │  • Scheduled CEO cycle → Scribe → CEO               │   │
│  │  • Owner input → CEO                                │   │
│  │  • Task completion → Reviewer → Judge → Dispatcher  │   │
│  │  • Escalation → CEO                                 │   │
│  │  • Phase completion → Scribe → CEO                  │   │
│  │  • Weekly batch → Curator (skill extraction/refine)  │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                 │                    │            │
│         ▼                 ▼                    ▼            │
│  ┌─────────────────────────────┐  ┌──────────────────┐   │
│  │ CLIProxy                    │  │    Supabase      │   │
│  │ (Opus 4.6 + Sonnet 4.6)    │  │    (State)       │   │
│  └─────────────────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Entry points:**
1. **Scheduler (node-cron)** — triggers weekly planning cycle, daily briefing compilation
2. **Webhook handler (HTTP)** — receives AgentMail reply events, Decision Room API calls
3. **DB listener** — watches for task state changes (worker completions, verdict returns)
4. **Onboarding completion** — `/api/onboarding/complete` endpoint triggers the first CEO cycle after Lock & Launch (see `onboarding.md`). The Scribe is skipped for this first invocation — no activity to compress yet. CEO receives Precepts only.

## Task State Machine

Every task lives in Supabase and moves through defined states. The Dispatcher manages transitions.

```
PLANNED ──► QUEUED ──► DISPATCHED ──► IN_PROGRESS ──► REVIEW ──► JUDGMENT ──► ACCEPTED
               ▲                          │    ▲          │          │
               │                          │    │          │          │
               │                          ▼    │          ▼          │
               │                        FAILED │        POLISH       │
               │                          │    │    (back to worker, │
               │                          ▼    │     light rework)   │
               │                      ESCALATED│                     │
               │                     (CEO diag)│                     ▼
               │                               │                  REVISION
               │                               │              (back to worker,
               │                               │               rework → REVIEW)
               │                               │                     │
               └───────────────────────────────┴─────────────────────┘
                        (re-enters pipeline after rework)
```

### State Definitions

| State | Description | Next States |
|---|---|---|
| **PLANNED** | CEO created task as part of a phase. Dependencies unmet. | QUEUED (when deps met) |
| **QUEUED** | All dependencies met. Waiting for Dispatcher to assign worker. | DISPATCHED |
| **DISPATCHED** | Dispatcher assigned to a specific worker. Worker hasn't started. | IN_PROGRESS |
| **IN_PROGRESS** | Worker is actively executing. | REVIEW, FAILED |
| **REVIEW** | Worker submitted output. Reviewer evaluating quality. | POLISH, JUDGMENT |
| **POLISH** | Reviewer sent craft feedback. Worker refining. | REVIEW (resubmit to Reviewer) |
| **JUDGMENT** | Reviewer approved. Judge evaluating outcome. | ACCEPTED, REVISION, ESCALATED |
| **REVISION** | Judge sent spec/strategic feedback. Worker reworking. Max 2 full cycles. | REVIEW (goes back through Reviewer) |
| **ACCEPTED** | Both gates passed. Output logged. Dispatcher checks for dependents to unblock. | — (terminal) |
| **ESCALATED** | Judge escalated or worker failed. Awaiting CEO diagnosis. | QUEUED (re-spec), PLANNED (restructured) |
| **FAILED** | Worker couldn't produce output (error, timeout). | ESCALATED |

Every state transition is logged in the audit log: timestamp, agent involved, reasoning, token count.

## Dispatcher Behavior

The Dispatcher (Opus 4.6 via CLIProxy) is invoked in two scenarios:

### 1. New Plan Received from CEO

```
CEO plan arrives
  │
  ▼
Dispatcher reads phased task specs
  → Builds dependency graph (tasks + their prerequisites)
  → Identifies tasks with no unmet dependencies → PLANNED → QUEUED
  → For each QUEUED task, selects a worker:
      • Role match (Researcher, Coder, Writer, Analyst, Ops)
      • Performance profile (acceptance rate, strengths, recent trend)
      • Current workload (avoid overloading one worker)
  → Selects relevant skills for the task (see `skills.md` — Skill Selection)
  → Moves to DISPATCHED → sends task spec + skills + context to worker via CLIProxy (Sonnet 4.6)
```

### 2. Task State Change (Completion Signal)

```
Task reaches ACCEPTED
  │
  ▼
Dispatcher checks dependency graph
  → Any tasks waiting on this one?
      → If all their dependencies are now ACCEPTED → move to QUEUED → dispatch
  → Is the entire phase complete (all tasks ACCEPTED)?
      → Yes → trigger CEO for next phase decomposition
```

### Dispatcher's Context Package

The Dispatcher receives:
- CEO's plan (task specs, dependencies, phase structure)
- Dependency graph (current state of all tasks in the phase)
- Worker performance profiles (acceptance rates, strengths, weaknesses)
- skill_index (active skills, trigger tags, scopes — for skill selection per task)
- Current task state from Supabase

The Dispatcher does NOT receive Precepts, strategic rationale, or evaluation details. It manages logistics, not strategy.

### Tactical Adaptation

When a task fails or gets escalated, the Dispatcher adapts within its authority:
- **Worker timeout** → mark FAILED, try a different worker for the same task
- **Worker produces error** → mark FAILED, escalate to CEO
- **CEO rewrites spec after escalation** → Dispatcher re-dispatches with new spec
- **CEO routes to different model** → Dispatcher assigns to the specified model

The Dispatcher does NOT make strategic calls. If something is structurally wrong (bad spec, wrong initiative direction), it escalates to the CEO.

## Parallel Execution

Workers run in parallel via concurrent CLIProxy API calls (Sonnet 4.6). The Dispatcher dispatches all QUEUED tasks with met dependencies simultaneously — it doesn't wait for one to finish before starting the next.

**Concurrency limit:** Configurable cap on simultaneous worker calls. Prevents hitting Claude Max rate limits. Start conservative (3-5 parallel), tune up based on observed limits.

## Task Chain Context Passing

For multi-step initiatives (research → analysis → outreach), the Dispatcher handles context chaining:

- CEO defines chains during planning: "Task B uses output of Task A as input"
- Dependency graph encodes this: Task B depends on Task A
- When Task A reaches ACCEPTED and Task B moves to QUEUED, the Dispatcher assembles Task B's context:
  - Task B's spec (from CEO's plan)
  - Relevant skills (selected from skill_index — see `skills.md`)
  - Task A's accepted output (predecessor context)
  - Relevant role memory entries (semantic search via pgvector)
  - Team Bulletin (ambient cross-worker awareness)

For longer chains, the Dispatcher passes the most recent predecessor outputs, not the entire chain history. If the chain is long enough that earlier context matters, the Scribe can summarize the chain history as part of the context package.

## The Scribe

The Scribe (Sonnet 4.6 via CLIProxy) is a dedicated system-level role that prepares the CEO's context. It is not a worker and does not go through the Reviewer/Judge pipeline.

### What the Scribe Does

Runs before every CEO invocation. Reads raw activity data from Supabase and compresses it into the CEO's context layers:

```
Raw data in Supabase:
  • Activity log (every task, verdict, event since last CEO cycle)
  • Initiative state (progress on each active initiative)
  • Performance data (worker stats, acceptance rates)
  • Lesson artifacts (recent wins and failures)
  │
  ▼
Scribe compresses into:
  • Initiative-level results summaries ("Research Phase 1: 12 prospects, 4 match ICP")
  • Exception report (escalations, blocks, stalled initiatives)
  • Pattern observations ("Writer revised 3x this week on value props — possible Precepts gap")
  • Skill changes (new/refined skills from Curator since last cycle)
  • Forward context (upcoming deadlines, resource status)
  │
  ▼
CEO context package:
  Precepts (full, always present)
  + Scribe's compressed output
  + Recent lesson artifacts (already structured)
  + Owner input (recent Board feedback, approvals, redirects)
```

### Quality Signal

The Scribe doesn't go through formal evaluation, but its output quality is monitored:
- If the CEO or Board Advisor flags missing context or distorted summaries, that's a signal the Scribe's prompt needs tuning
- The Scribe's output is stored in the audit log — traceable if the CEO makes a decision based on bad context

## Context Assembly per Agent Role

Each agent receives only the context relevant to its function. No agent sees everything.

| Agent | Context Package | Source |
|---|---|---|
| **CEO** | Precepts + Scribe's compressed output + lessons + owner input + skill changes | Supabase → Scribe → CEO |
| **Board Advisor** | CEO's proposed plan + Precepts + recent decision log + performance data + lesson artifacts | Supabase direct |
| **Dispatcher** | CEO's plan + dependency graph + worker performance profiles + skill_index + current task state | Supabase direct |
| **Scribe** | Raw activity log + initiative state + performance data + lesson artifacts + recent skill changes | Supabase direct |
| **Curator** | Reviewer craft patterns + Judge rejection/acceptance patterns + lesson artifacts + existing skill_index | Supabase direct + skill files |
| **Reviewer** | Worker output + task spec + craft-evaluation skill + domain context (role memory via pgvector) | Supabase + pgvector + skill files |
| **Judge** | Reviewer-approved output + task spec + acceptance criteria + outcome-evaluation skill | Passed from Reviewer evaluation + skill files |
| **Workers** | Task spec + skills (selected by Dispatcher) + chain context + role memory + Team Bulletin | Assembled by Dispatcher |

## Operating Rhythm (Technical View)

### Weekly Strategic Cycle

**Trigger:** node-cron, e.g., Sunday 8pm

1. Scribe compresses the week's activity into CEO context
2. CEO invoked (Opus 4.6 via CLIProxy) with full context package
3. CEO produces weekly plan: initiatives with phased task breakdown
4. Board Advisor invoked (Opus) with CEO's plan
5. Advisor verdict:
   - **APPROVED** → plan stored in Supabase, queued for owner approval
   - **APPROVED WITH CONCERNS** → plan + annotations stored, queued for owner
   - **FLAGGED** → plan + Advisor's concerns sent to owner via AgentMail
6. Owner approves (email reply webhook or Decision Room) → Dispatcher receives plan → execution begins

### Daily Briefing

See `interface.md` for the briefing format, information hierarchy, and reply parsing design.

**Trigger:** node-cron, e.g., 7am

1. Scribe compresses yesterday's activity
2. CEO compiles briefing: results, decisions needed, what's in progress, Board Requests
3. Briefing sent to owner via AgentMail
4. Owner replies → AgentMail parses to JSON → webhook → engine updates state:
   - Approvals → relevant tasks/initiatives proceed
   - Holds → Dispatcher pauses specified work
   - Redirects → CEO invoked to replan affected initiatives

### Continuous Execution

Runs between scheduled cycles with no CEO involvement unless triggered.

```
loop:
  Dispatcher monitors task state in Supabase
  Worker completes task → state changes to REVIEW
  Reviewer evaluates quality:
    POLISH → worker refines → back to REVIEW
    GOOD/EXCELLENT → state changes to JUDGMENT
  Judge evaluates outcome:
    REVISION → worker reworks → back to REVIEW
    ESCALATE → CEO invoked (trigger event)
    ACCEPT → state changes to ACCEPTED
  Dispatcher checks dependency graph → dispatches newly unblocked tasks
  Team Bulletin updated with accepted task summary
```

### CEO Trigger Events

Between scheduled cycles, the CEO is invoked for:

1. **Judge escalation** — worker output failed twice, needs diagnosis
2. **Phase completion** — all tasks in a phase ACCEPTED, CEO decomposes next phase
3. **Owner input** — reply to briefing or message in Decision Room (highest priority)
4. **Initiative signal** — Dispatcher flags stalled initiative (no progress despite active work)

Each trigger invocation runs the Scribe first to ensure the CEO has fresh context.

### Daily Role Memory Cleanup

**Trigger:** node-cron, e.g., 2am (off-peak, before daily briefing)

A scheduled batch process maintains role memory hygiene (see `memory.md` — Role Memory for the full specification):

1. **Deduplicates** — merges entries about the same topic from different tasks
2. **Structures** — normalizes format, fills metadata gaps
3. **Flags stale** — marks entries not retrieved in 30+ days for review
4. **Archives** — removes confirmed stale entries from active search (preserved in cold storage)

This runs as a Supabase function or Scribe invocation — no CEO involvement. The Dispatcher benefits on its next task assignment because role memory is cleaner and more relevant.

## Recovery After Restart

All execution state is in Supabase. The engine is stateless. On restart:

1. **Scheduler** re-initializes cron jobs (next scheduled event fires at the right time)
2. **Webhook handler** starts listening for AgentMail and Decision Room events
3. **Dispatcher** queries current state from Supabase:
   - Tasks in QUEUED → dispatch them
   - Tasks in DISPATCHED/IN_PROGRESS → check against configurable timeout per task type
     - Timed out → mark FAILED → escalate
     - Recent → wait for completion (worker may still be running)
   - Tasks in REVIEW/JUDGMENT → re-invoke Reviewer/Judge if no verdict recorded
   - Tasks in POLISH/REVISION → check if worker has resubmitted; if not, wait
4. **No data loss.** Supabase is the source of truth. The engine resumes exactly where it left off.

## Concurrency Model

```
Engine Process
  │
  ├── Scheduler thread (node-cron)
  │     └── Fires events at configured times
  │
  ├── HTTP server (webhook + API)
  │     └── Receives external events, routes to orchestration core
  │
  └── Orchestration core (event-driven)
        ├── Processes events sequentially (no concurrent CEO/Dispatcher calls)
        │   This prevents contradictory decisions
        │
        └── Worker calls dispatched concurrently (up to concurrency limit)
            Workers are the only parallel execution path
```

Events are processed sequentially through the orchestration core. This is intentional — if the CEO and Dispatcher could run simultaneously, they might make contradictory decisions. Workers are the only agents that run in parallel, because they're executing independent tasks with no shared state.

## Open Questions

Items identified during V0.1 review. Deferred to Sprint 2-3.

**Worker flag channel (#4).** The task state machine has no path for "I completed the task but found something the CEO needs to know." Workers can only produce output (→ REVIEW) or fail (→ FAILED). Structure.md's "stop cord" principle (Toyota Jidoka) requires a channel for workers to flag problems. Options: add a FLAGGED state to the task state machine, or add a structured `flags` field to worker output that the engine routes to the CEO.

**CEO invocation modes (#7).** The CEO is invoked daily for briefing compilation and weekly for strategic planning, plus on trigger events. These are different cognitive modes — "summarize what happened" vs "what should we do next" — but the current spec doesn't distinguish between them. The CEO needs different prompts, different context weight, and possibly a mode flag to know which role it's playing.

**Worker requisition (#8).** The brainstorm (lines 761-774) specifies a mechanism for CEO worker requisition — business case, expected impact, cost estimate, owner approval. This is how the organization grows. Currently there is no structured requisition format, no approval flow, and no impact on the Dispatcher's routing. The CEO can mention it in a Board Request, but this should be a first-class workflow.

**Trust level thresholds (#9).** Memory.md's performance profile includes `TRUST LEVEL: Journeyman` but no doc defines what trust levels mean operationally. The brainstorm defines Apprentice → Journeyman → Master with concrete structural rewards: less oversight, more complex tasks, more context, more autonomy. Needs: threshold definitions, what changes at each level, how it affects Dispatcher behavior.

**Dual CEO prompts (#10).** The brainstorm's synthesis table includes "Dual executive tension" (Roman Republic / Spartan dual kingship) — dual CEO prompts for major decisions (analytical vs values-driven). The Board Advisor partially fills this role but reviews the plan, not individual decisions. Intentionally deferred — the Board Advisor mechanism may be sufficient. Revisit if CEO decision quality proves to be a bottleneck.
