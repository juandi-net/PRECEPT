# Sprint 2 Design — Full Reasoning Loop

**Date:** 2026-03-03
**Status:** Approved
**Scope:** CEO plans → Dispatcher routes → Workers execute → Reviewer evaluates craft → Judge evaluates outcome → results flow back → briefing sent to owner

## Decisions

- **Engine code structure:** Service-per-agent (Approach A). Each agent role gets its own service class with a clear contract. Orchestration engine ties them together sequentially.
- **AI calls during development:** Build real infrastructure first, validate with real CLIProxy calls once plumbing is verified. No mocks.
- **Test vs production data:** Clear delineation via org_id scoping and test endpoints.
- **Embedding model:** EmbeddingGemma 300M, 768-dim, local via `@huggingface/transformers`. No external API.
- **Event handling:** In-process event queue. Engine emits follow-up events after writing state changes. Recovery scan on startup handles restart edge cases.
- **DB listener implementation:** Not needed — engine controls all state changes, so "DB listener" is just in-process method chaining.
- **Retry strategy:** Exponential backoff (3 attempts, 1s/2s/4s) inside `invokeAgent()`. Typed `AgentInvocationError` on exhaustion. Services don't handle transient CLIProxy failures.

---

## Section 1: Database Layer

### Pre-Phase: Multi-Org Migration (`00005_multi_org.sql`)

Create `orgs` table:

```sql
orgs
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  name            TEXT NOT NULL
  slug            TEXT UNIQUE NOT NULL
  owner_id        UUID NOT NULL
  created_at      TIMESTAMPTZ DEFAULT now()
  status          TEXT DEFAULT 'active'  -- active, archived
```

Add `org_id` (UUID, NOT NULL, FK → orgs) to 4 existing Sprint 1 tables:
- `onboarding_sessions`
- `precepts`
- `audit_log`
- `skill_index`

Note: Sprint 1's `precepts_draft` and `onboarding_messages` are JSONB columns on `onboarding_sessions`, not separate tables.

Backfill: Create org record for ROOKIE, set `org_id` on all existing rows.

Update all RLS policies to include `org_id` scoping.

### Phase 1: Sprint 2 Tables (`00006_sprint2_tables.sql`)

10 new tables, all with `org_id NOT NULL REFERENCES orgs(id)`:

- `initiatives` — strategic initiatives (CEO creates)
- `plans` — CEO plans with advisor verdict + owner approval
- `tasks` — atomic work units, the task state machine backbone
- `task_transitions` — every state change recorded (who, why, metadata)
- `agent_profiles` — worker performance profiles
- `decision_log` — CEO reasoning after each planning cycle
- `lesson_artifacts` — post-mortem learnings
- `role_memory` — pgvector semantic knowledge base (`vector(768)`)
- `team_bulletin` — rolling window of recent accepted work
- `messages` — InternalMessage log for agent-to-agent communication

RLS on all tables, scoped by `org_id`.

### pgvector Functions (`00007_pgvector_functions.sql`)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Two RPC functions:

1. `match_role_memory(query_embedding, match_org_id, match_role, match_count)` — cosine similarity search, returns top-K entries, updates `last_retrieved_at` on returned rows.

2. `deduplicate_role_memory(target_org_id, similarity_threshold, target_role)` — self-join on role_memory, identifies entries with cosine similarity > threshold (default 0.95) within same org+role, archives the older entry.

### Task State Transitions (Valid Moves)

Enforced in engine logic via `state-machine.ts`, not DB constraints:

```
PLANNED     → QUEUED        (dependencies met)
QUEUED      → DISPATCHED    (Dispatcher assigns worker)
DISPATCHED  → IN_PROGRESS   (worker starts)
IN_PROGRESS → REVIEW        (worker submits output)
IN_PROGRESS → FAILED        (worker error/timeout)
REVIEW      → POLISH        (Reviewer: needs craft refinement)
REVIEW      → JUDGMENT      (Reviewer: GOOD or EXCELLENT)
POLISH      → REVIEW        (worker resubmits after polish)
JUDGMENT    → ACCEPTED      (Judge: passes)
JUDGMENT    → REVISION      (Judge: spec/strategic feedback)
JUDGMENT    → ESCALATED     (Judge: needs CEO diagnosis)
REVISION    → REVIEW        (worker reworks, goes back through Reviewer)
FAILED      → ESCALATED     (auto-escalate on failure)
ESCALATED   → QUEUED        (CEO re-specs, Dispatcher re-dispatches)
ESCALATED   → PLANNED       (CEO restructures)
```

Revision count: increment on each JUDGMENT → REVISION. If revision_count >= 2, auto-ESCALATE instead.

---

## Section 2: Engine Code Structure

Service-per-agent, building on existing `packages/engine/src/` patterns.

```
packages/engine/src/
  ai/
    client.ts                — existing + add invokeAgent()
    prompts/
      ceo-onboarding.ts      — existing (Sprint 1)
      ceo-planning.ts        — NEW: weekly planning cycle
      ceo-briefing.ts        — NEW: daily briefing compilation
      ceo-escalation.ts      — NEW: failure diagnosis
      ceo-reply-parsing.ts   — NEW: owner intent extraction
      scribe.ts              — NEW: context compression
      advisor.ts             — NEW: adversarial plan review
      dispatcher.ts          — NEW: worker selection + skill matching
      worker.ts              — NEW: worker system prompt builder
      reviewer.ts            — NEW: craft evaluation
      judge.ts               — NEW: outcome evaluation
      skill-authoring.ts     — existing (Sprint 1)
  db/
    client.ts                — existing
    onboarding.ts            — existing
    precepts.ts              — existing
    skills.ts                — existing
    audit.ts                 — existing
    orgs.ts                  — NEW: org CRUD
    initiatives.ts           — NEW: initiative CRUD
    plans.ts                 — NEW: plan CRUD + advisor verdict
    tasks.ts                 — NEW: task CRUD, state transitions, dependency queries
    agent-profiles.ts        — NEW: worker performance profiles
    decisions.ts             — NEW: decision log + lesson artifacts
    role-memory.ts           — NEW: vector storage + match_role_memory RPC
    team-bulletin.ts         — NEW: rolling window CRUD
    messages.ts              — NEW: internal message logging
  lib/
    embeddings.ts            — NEW: EmbeddingGemma wrapper
  services/
    onboarding.ts            — existing (untouched)
    skills.ts                — existing (untouched)
    ceo.ts                   — NEW: planning, briefing, escalation, reply parsing
    dispatcher.ts            — NEW: dependency graph, worker assignment, context assembly
    worker.ts                — NEW: invocation, output parsing, flag extraction
    reviewer.ts              — NEW: craft evaluation gate
    judge.ts                 — NEW: outcome evaluation gate
    scribe.ts                — NEW: context compression
    advisor.ts               — NEW: plan review
  orchestration/
    engine.ts                — NEW: sequential event loop
    scheduler.ts             — NEW: node-cron wrapper
    state-machine.ts         — NEW: valid transition map + enforcement
    dependency.ts            — NEW: DAG resolution + phase completion detection
  routes/
    onboarding.ts            — existing (untouched)
    orchestration.ts         — NEW: test/manual trigger endpoints
    webhooks.ts              — NEW: AgentMail reply webhook
```

Patterns carried forward from Sprint 1:
- All imports use explicit `.js` extensions (ESM)
- DB layer maps camelCase ↔ snake_case
- Audit logging is fire-and-forget
- AI calls logged with full token metadata
- Services are classes, instantiated in route files

---

## Section 3: invokeAgent() Contract

Single function in `ai/client.ts` for all CLIProxy calls:

```typescript
interface InvokeAgentOptions {
  model: 'opus' | 'sonnet';
  systemPrompt: string;
  messages: ChatMessage[];
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
}

interface AgentResponse {
  content: string;
  parsed?: Record<string, any>;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
  durationMs: number;
}

async function invokeAgent(
  agentId: string,
  options: InvokeAgentOptions
): Promise<AgentResponse>
```

Internals:
1. Maps `'opus'`/`'sonnet'` to model IDs from env vars
2. Calls `ai.chat.completions.create()`
3. Measures wall clock duration
4. If `jsonMode: true`, 3-tier JSON extraction (strip fences → regex → fallback)
5. Exponential backoff retry: 3 attempts, 1s/2s/4s delays. Typed `AgentInvocationError` on exhaustion.
6. Logs to `audit_log` via fire-and-forget: agent ID, model, tokens, duration
7. Returns structured `AgentResponse`

Model routing per role:

| Role | Model | Temperature | JSON mode |
|---|---|---|---|
| CEO (planning) | Opus | 0.7 | yes |
| CEO (briefing) | Opus | 0.5 | yes |
| CEO (escalation) | Opus | 0.5 | yes |
| CEO (reply parsing) | Opus | 0.3 | yes |
| Board Advisor | Opus | 0.6 | yes |
| Dispatcher | Opus | 0.3 | yes |
| Scribe | Sonnet | 0.3 | yes |
| Reviewer | Opus | 0.5 | yes |
| Judge | Opus | 0.4 | yes |
| Workers | Sonnet | 0.5 | yes |

Existing `callCEO()` in `services/onboarding.ts` stays untouched — different interaction model (conversational vs structured).

---

## Section 4: Orchestration Engine + State Machine

### Event Types

```typescript
type EngineEvent =
  | { type: 'planning_cycle'; orgId: string }
  | { type: 'briefing_cycle'; orgId: string }
  | { type: 'plan_approved'; planId: string }
  | { type: 'task_completed'; taskId: string }
  | { type: 'review_verdict'; taskId: string }
  | { type: 'judge_verdict'; taskId: string }
  | { type: 'escalation'; taskId: string }
  | { type: 'phase_completed'; planId: string; phase: number }
  | { type: 'owner_reply'; orgId: string; content: string }
  | { type: 'memory_cleanup'; orgId: string }
```

### Processing Model

Async queue, processes one event at a time. Events pushed by scheduler, webhook handler, or internally after service completes. Worker dispatches fan out concurrently (semaphore, limit 3-5).

```
Event arrives → engine.handleEvent(event)
  → switch on event.type
  → call appropriate service method
  → service returns result
  → engine applies state transitions + orchestrates consequences
  → engine may push follow-up events
```

### Example Full Cycle

1. `planning_cycle` → Scribe → CEO → Advisor → plan stored
2. `plan_approved` → Dispatcher builds DAG, dispatches ready tasks (concurrent workers)
3. `task_completed` (per worker) → Reviewer invoked
4. `review_verdict` → POLISH loops back to worker, GOOD/EXCELLENT → Judge
5. `judge_verdict` → ACCEPT: engine runs dependency resolution, key finding extraction, team bulletin update. REVISE: loops back. ESCALATE: triggers CEO.
6. `phase_completed` → Scribe → CEO (next-phase decomposition, different from weekly planning)
7. `briefing_cycle` → CEO compiles briefing → AgentMail sends email

### State Machine (`state-machine.ts`)

Pure functions:
- `validateTransition(currentState, targetState) → boolean`
- `applyTransition(taskId, targetState, agentId, reason, metadata)` — validates, writes to `tasks`, logs to `task_transitions`, handles revision counter (increment on JUDGMENT→REVISION, auto-ESCALATE if count ≥ 2)

Every service calls `applyTransition()`. No service writes task state directly.

### Dependency Resolution (`dependency.ts`)

- `buildDependencyGraph(planId) → DAG`
- `getDispatchableTasks(planId) → Task[]` — tasks in PLANNED where all deps are ACCEPTED → move to QUEUED
- `checkPhaseCompletion(planId, phase) → boolean` — all tasks in phase ACCEPTED?

Single authority on task readiness. Dispatcher delegates all "is this ready?" logic here.

### Recovery on Restart

One-time scan on engine startup:
1. Tasks in QUEUED → re-dispatch
2. Tasks in DISPATCHED/IN_PROGRESS → check `task_transitions.created_at` for most recent transition against configurable timeout per task type → FAILED if stale, wait if recent
3. Tasks in REVIEW/JUDGMENT with no verdict → re-invoke evaluator
4. Tasks in POLISH/REVISION → check if worker resubmitted, wait if not

After recovery, normal event-driven operation resumes.

---

## Section 5: Agent Service Contracts

Each service evaluates and returns a result. The engine orchestrates consequences.

### ScribeService

```
Input:  orgId
Reads:  audit_log (since last cycle), initiatives, lesson_artifacts,
        skill_index (recent changes)
Model:  Sonnet
Output: InternalMessage { message_type: 'context_package' }
```

### CEOService — Four Modes

```
planningCycle(orgId):
  Input:  Scribe context, Precepts, lesson artifacts, owner input, leadership skills
  Model:  Opus
  Output: Parsed plan JSON → creates initiatives, tasks, decision_log rows
  Then:   Engine invokes AdvisorService

handleEscalation(taskId):
  Input:  Task spec, worker output, judge verdict, escalation context
  Model:  Opus
  Output: Diagnosis { type: 'spec'|'capability'|'strategy'|'foundation', action }
  Then:   Engine routes based on diagnosis

compileBriefing(orgId):
  Input:  Scribe context, initiative states, board requests, escalations
  Model:  Opus
  Output: Briefing JSON (board_requests, exceptions, results, forward_look)
  Then:   Engine formats to HTML, sends via AgentMail

handleOwnerReply(orgId, content):
  Input:  Raw reply text, initiative states, pending board requests
  Model:  Opus
  Output: Structured actions (approve, hold, pivot, clarify, free text)
  Then:   Engine applies state changes
```

### AdvisorService

```
Input:  CEO's plan, Precepts, recent decision_log (10), lesson_artifacts,
        aggregate performance data
Model:  Opus
Output: { verdict: 'APPROVED'|'APPROVED_WITH_CONCERNS'|'FLAGGED', notes }
Writes: verdict + notes to plans table
```

### DispatcherService

```
executePlan(planId):
  Input:  Approved plan, task states, agent_profiles, skill_index
  Steps:
    1. dependency.getDispatchableTasks() for ready tasks
    2. Select worker per task (role match + performance profile)
    3. Select skills (CEO explicit → trigger_tag match, max 3)
    4. Assemble context per worker:
       - System prompt (role, boundaries, performance, Precepts values, stop cord)
       - Task spec + acceptance criteria
       - Skills (0-3 .md file contents)
       - Role memory (top-5 via embedText query → match_role_memory RPC)
       - Chain context (accepted predecessor outputs)
       - Team Bulletin (last 10 entries)
    5. Invoke WorkerService (concurrent, semaphore-limited)
```

### WorkerService

```
Input:  Assembled context package
Model:  Sonnet
Output: Parsed { output, key_findings, confidence, flag, notes }
Writes: tasks.output
Then:   Engine transitions to REVIEW
        If flag != null: engine logs InternalMessage { type: 'flag' } for CEO
        If error/timeout: engine transitions to FAILED → ESCALATED
```

### ReviewerService

```
Input:  Worker output, task spec, craft-evaluation skill, domain role memory
Does NOT receive: CEO rationale, other workers' outputs
Model:  Opus
Output: { verdict: 'POLISH'|'GOOD'|'EXCELLENT', feedback/commendation/notes }
Then:   Engine transitions task state
        Engine updates agent_profiles for the worker
```

### JudgeService

```
Input:  Reviewer-approved output, task spec + acceptance criteria,
        outcome-evaluation skill
Does NOT receive: CEO planning rationale, Reviewer quality notes
Model:  Opus
Output: { verdict: 'ACCEPT'|'REVISE'|'ESCALATE', assessment/feedback/reason }
Then:   Engine handles all consequences (see Section 4)
```

Information compartmentalization enforced at the service level — each service only queries the data its agent role is allowed to see per security.md.

---

## Section 6: Internal Messages + Briefing Delivery

### InternalMessage Schema

Defined in `packages/shared/src/message.ts`. Logged at agent boundary crossings:
- Scribe → CEO
- CEO → Advisor
- Dispatcher → Worker
- Worker → Reviewer
- Reviewer → Judge
- Judge → Engine (verdict)
- CEO → Owner (briefing)
- Owner → CEO (reply)

### Briefing Delivery

```
CEO compileBriefing(orgId)
  → Structured JSON: { board_requests[], exceptions[], results, forward_look }
  → Engine formats to HTML email
  → AgentMail API: POST with subject "[Org Name] — Daily Briefing — [Date]"
```

### AgentMail Reply Webhook

```
POST /api/webhooks/agentmail
  → Parse AgentMail reply JSON
  → Push owner_reply event to engine
  → CEO reply parsing: intent extraction against current state
  → State changes applied to Supabase
```

### Test Endpoints (`routes/orchestration.ts`)

| Endpoint | Purpose |
|---|---|
| `POST /api/orchestration/trigger-planning` | Manually fire planning cycle |
| `POST /api/orchestration/trigger-briefing` | Manually fire briefing cycle |
| `POST /api/orchestration/approve-plan/:planId` | Approve a plan |
| `POST /api/orchestration/owner-reply` | Simulate owner reply |
| `GET /api/orchestration/tasks/:planId` | View task states |
| `GET /api/orchestration/health` | Engine state + queue depth |

---

## Section 7: Embedding Integration + Role Memory Lifecycle

### Model

EmbeddingGemma 300M via `@huggingface/transformers`. 768-dim vectors. Local, in-process, singleton pattern. ONNX files cached at `~/.cache/huggingface/transformers/`.

### Storing (post-ACCEPT, in engine's judge_verdict handler)

```
Task ACCEPTED
  → Extract key_findings[] from worker output
  → Per finding: embedText(finding, 'document') → store in role_memory
      { org_id, role, content, embedding, source_task, confidence, entry_type: 'finding' }
  → Reviewer craft observations stored as entry_type: 'craft_pattern'
      (only after final ACCEPT, not during POLISH loops)
```

### Querying (Dispatcher context assembly)

```
embedText(taskDescription, 'query') → 768-dim vector
  → supabase.rpc('match_role_memory', { query_embedding, org_id, role, count: 5 })
  → RPC also updates last_retrieved_at on returned rows
  → Top-5 entries injected into worker context
```

### Daily Memory Cleanup (Deferred)

The `deduplicate_role_memory` RPC function is created in the migration (SQL, costs nothing to have). But the daily `memory_cleanup` cron job is **not scheduled in Sprint 2** — it operates on entries 30+ days old, and Sprint 2 won't have entries that old. Add the scheduled job when there's meaningful data to clean (Sprint 3 or later).

When activated, the job will:
1. Flag entries where `last_retrieved_at` is 30+ days ago → `status: 'stale'`
2. Deduplicate via `deduplicate_role_memory` RPC (Postgres self-join, cosine similarity > 0.95, archive older entry)
3. No re-embedding needed — staleness is metadata, dedup is a vector operation in Postgres

### Deferred to Sprint 3

- Curator skill extraction from `craft_pattern` entries
- Confidence decay
- Memory promotion

---

## Section 8: Doc Updates

### Changes Required

| Doc | Change |
|---|---|
| `docs/memory.md` line 373 | "text + 1536-dim vectors" → "text + 768-dim vectors" |
| `docs/memory.md` line 155 | Note: embedding model is EmbeddingGemma 300M |
| `docs/techstack.md` stack table | Add row: Embeddings \| EmbeddingGemma 300M via @huggingface/transformers \| Free \| 768-dim vectors for role memory semantic search |
| `docs/archive/brainstorm.md` line 828 | Mark resolved: pgvector + EmbeddingGemma 300M |

### No Changes

- `docs/structure.md` — Sprint 2 implements what's described
- `docs/orchestration.md` — faithful implementation, no deviations
- `docs/skills.md` — reads skills, doesn't change the system
- `docs/security.md` — follows compartmentalization as designed
- `docs/interface.md` — implements the briefing format described
- `docs/onboarding.md` — org_id added to tables, flow untouched

### Sprint 1 Code Boundaries

**Untouched:**
- `services/onboarding.ts`, `services/skills.ts`
- `routes/onboarding.ts` (all 6 endpoints)
- `ai/prompts/ceo-onboarding.ts`, `ai/prompts/skill-authoring.ts`
- `packages/web/` (entire frontend)

**Modified:**
- `ai/client.ts` — add `invokeAgent()` alongside existing exports
- `packages/engine/src/index.ts` — add route groups for orchestration + webhooks
- `packages/shared/src/index.ts` — export new types

### New Shared Types (`packages/shared/`)

```
src/
  message.ts     — InternalMessage, AgentRole, MessageType
  tasks.ts       — TaskState, TaskSpec, TaskOutput, WorkerOutput
  plans.ts       — PlanOutput, Initiative, BoardRequest, Decision
  evaluation.ts  — ReviewVerdict, JudgeVerdict, EscalationDiagnosis
  briefing.ts    — BriefingContent, OwnerReplyIntent
  index.ts       — re-export all
```
