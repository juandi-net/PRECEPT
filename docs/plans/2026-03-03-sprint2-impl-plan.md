# Sprint 2 — Full Reasoning Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete reasoning loop: CEO plans → Dispatcher routes → Workers execute → Reviewer evaluates craft → Judge evaluates outcome → results flow back → briefing sent to owner.

**Architecture:** Service-per-agent with a sequential orchestration engine. Each agent role gets its own service class. The engine processes events one at a time; only workers run in parallel. All state in Supabase. See `docs/plans/2026-03-03-sprint2-reasoning-loop-design.md` for the full design.

**Tech Stack:** TypeScript (ESM, explicit `.js` imports), Bun runtime, Hono HTTP framework, Supabase (Postgres + pgvector), CLIProxy (OpenAI SDK), EmbeddingGemma 300M (`@huggingface/transformers`), node-cron, AgentMail API.

**Reference Docs:** `docs/structure.md`, `docs/orchestration.md`, `docs/memory.md`, `docs/skills.md`, `docs/security.md`, `docs/interface.md`, `docs/techstack.md`

**Patterns from Sprint 1 (follow these exactly):**
- All imports use explicit `.js` extensions (ESM requirement)
- DB layer maps camelCase ↔ snake_case manually
- Audit logging via `logEvent()` — fire-and-forget, errors go to stderr
- AI calls logged with full token metadata to audit_log
- Services are classes
- `type: "module"` in all package.json files
- Tests use Vitest with `vi.mock()` at module level

**Test commands:**
- Engine tests: `bun run --cwd packages/engine test`
- Shared tests: `bun run --cwd packages/shared test`
- All tests: `bun run test`
- Single test file: `bun run --cwd packages/engine test -- src/path/to/test.ts`

---

## Phase 0: Shared Types + Database Migrations

This phase creates the type contracts and database tables everything else builds on. No engine code yet — just types and SQL.

### Task 0.1: Internal Message Types

Create the InternalMessage schema and all Sprint 2 shared types.

**Files:**
- Create: `packages/shared/src/message.ts`
- Create: `packages/shared/src/tasks.ts` (rename-safe: Sprint 1 has no `tasks.ts` in shared)
- Create: `packages/shared/src/plans.ts`
- Create: `packages/shared/src/evaluation.ts`
- Create: `packages/shared/src/briefing.ts`
- Modify: `packages/shared/src/index.ts` — add re-exports
- Modify: `packages/shared/src/audit.ts` — extend `AuditEventType` with Sprint 2 events

**`packages/shared/src/message.ts`:**

```typescript
export type AgentRole =
  | 'ceo'
  | 'board_advisor'
  | 'dispatcher'
  | 'scribe'
  | 'curator'
  | 'reviewer'
  | 'judge'
  | 'worker';

export type MessageType =
  | 'plan'
  | 'task_spec'
  | 'task_output'
  | 'review_verdict'
  | 'judge_verdict'
  | 'escalation'
  | 'flag'
  | 'context_package'
  | 'advisor_review'
  | 'briefing'
  | 'owner_input'
  | 'dispatch_signal'
  | 'block_report';

export interface InternalMessage {
  id: string;
  org_id: string;
  from_role: AgentRole;
  from_agent_id: string;
  to_role: AgentRole;
  message_type: MessageType;
  payload: Record<string, unknown>;
  reference_id?: string;
  created_at: string;
}
```

**`packages/shared/src/tasks.ts`:**

```typescript
export type TaskState =
  | 'PLANNED'
  | 'QUEUED'
  | 'DISPATCHED'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'POLISH'
  | 'JUDGMENT'
  | 'REVISION'
  | 'ACCEPTED'
  | 'ESCALATED'
  | 'FAILED';

export type TaskRole = 'researcher' | 'coder' | 'writer' | 'analyst' | 'ops';

export type TaskPriority = 'high' | 'medium' | 'low';

export interface TaskSpec {
  description: string;
  acceptance_criteria: string[];
  priority: TaskPriority;
}

export interface WorkerOutput {
  output: string;
  key_findings: string[];
  confidence: 'high' | 'medium' | 'low';
  flag: string | null;
  notes: string | null;
}

export interface Task {
  id: string;
  org_id: string;
  plan_id: string | null;
  initiative_id: string | null;
  phase: number;
  state: TaskState;
  role: TaskRole;
  assigned_worker: string | null;
  spec: TaskSpec;
  output: WorkerOutput | null;
  skills_loaded: string[];
  depends_on: string[];
  revision_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface TaskTransition {
  id: string;
  org_id: string;
  task_id: string;
  from_state: TaskState | null;
  to_state: TaskState;
  agent_id: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
```

**`packages/shared/src/plans.ts`:**

```typescript
export type AdvisorVerdict = 'APPROVED' | 'APPROVED_WITH_CONCERNS' | 'FLAGGED';

export interface PlanTask {
  id: string;
  role: string;
  description: string;
  acceptance_criteria: string[];
  depends_on: string[];
  skills: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface PlanPhase {
  phase_number: number;
  description: string;
  tasks: PlanTask[];
}

export interface PlanInitiative {
  name: string;
  description: string;
  rationale: string;
  phases: PlanPhase[];
}

export interface PlanDecision {
  decision: string;
  reasoning: string;
  alternatives: string;
  why_not: string;
}

export interface BoardRequest {
  request: string;
  context: string;
  urgency: string;
  fallback: string;
}

export interface PlanOutput {
  initiatives: PlanInitiative[];
  decisions: PlanDecision[];
  board_requests: BoardRequest[];
}

export interface Initiative {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  phase_current: number;
  created_at: string;
  updated_at: string | null;
}

export interface Plan {
  id: string;
  org_id: string;
  initiative_id: string | null;
  content: PlanOutput;
  advisor_verdict: AdvisorVerdict | null;
  advisor_notes: string | null;
  owner_approved: boolean;
  created_at: string;
}
```

**`packages/shared/src/evaluation.ts`:**

```typescript
export type ReviewVerdictType = 'POLISH' | 'GOOD' | 'EXCELLENT';

export interface ReviewVerdictPolish {
  verdict: 'POLISH';
  feedback: string;
  areas: string[];
}

export interface ReviewVerdictGood {
  verdict: 'GOOD';
  notes: string;
}

export interface ReviewVerdictExcellent {
  verdict: 'EXCELLENT';
  commendation: string;
  notes: string;
}

export type ReviewVerdict = ReviewVerdictPolish | ReviewVerdictGood | ReviewVerdictExcellent;

export type JudgeVerdictType = 'ACCEPT' | 'REVISE' | 'ESCALATE';

export interface JudgeVerdictAccept {
  verdict: 'ACCEPT';
  assessment: string;
  criteria_met: string[];
}

export interface JudgeVerdictRevise {
  verdict: 'REVISE';
  feedback: string;
  criteria_failed: string[];
}

export type EscalationDiagnosisType = 'spec_problem' | 'capability_problem' | 'strategy_problem' | 'foundation_problem';

export interface JudgeVerdictEscalate {
  verdict: 'ESCALATE';
  reason: string;
  diagnosis_hint: EscalationDiagnosisType;
}

export type JudgeVerdict = JudgeVerdictAccept | JudgeVerdictRevise | JudgeVerdictEscalate;

export interface EscalationDiagnosis {
  type: EscalationDiagnosisType;
  action: Record<string, unknown>;
  reasoning: string;
}
```

**`packages/shared/src/briefing.ts`:**

```typescript
export interface BriefingBoardRequest {
  number: number;
  request: string;
  context: string;
  urgency: string;
  fallback: string;
}

export interface BriefingException {
  description: string;
  severity: 'critical' | 'warning' | 'info';
  initiative: string | null;
}

export interface BriefingInitiativeSummary {
  name: string;
  status: string;
  outcome_summary: string;
}

export interface BriefingResults {
  north_star: string | null;
  initiatives: BriefingInitiativeSummary[];
}

export interface BriefingContent {
  board_requests: BriefingBoardRequest[];
  exceptions: BriefingException[];
  results: BriefingResults;
  forward_look: string;
}

export type OwnerReplyAction =
  | { type: 'approve'; target_id: string }
  | { type: 'hold'; target_id: string }
  | { type: 'pivot'; target_id: string; direction: string }
  | { type: 'free_text'; content: string }
  | { type: 'clarify'; question: string };

export interface OwnerReplyIntent {
  actions: OwnerReplyAction[];
  raw_text: string;
}
```

**Update `packages/shared/src/audit.ts`** — extend `AuditEventType`:

Add to the existing union type:
```typescript
| 'planning.cycle'
| 'planning.scribe'
| 'planning.ceo'
| 'planning.advisor'
| 'planning.approved'
| 'dispatch.plan'
| 'dispatch.task'
| 'worker.start'
| 'worker.complete'
| 'worker.failed'
| 'review.start'
| 'review.verdict'
| 'judge.start'
| 'judge.verdict'
| 'task.transition'
| 'task.escalated'
| 'briefing.compiled'
| 'briefing.sent'
| 'owner.reply'
| 'owner.action'
| 'memory.stored'
| 'memory.queried'
```

**Update `packages/shared/src/index.ts`** — add re-exports:

```typescript
export * from './message.js';
export * from './tasks.js';
export * from './plans.js';
export * from './evaluation.js';
export * from './briefing.js';
```

**Step 1:** Create all 5 new type files with the code above.
**Step 2:** Update `audit.ts` with new event types.
**Step 3:** Update `index.ts` with new exports.
**Step 4:** Run `bun run --cwd packages/shared typecheck` — must pass.
**Step 5:** Commit: `feat: add Sprint 2 shared types — messages, tasks, plans, evaluation, briefing`

---

### Task 0.2: Multi-Org Migration

**Files:**
- Create: `supabase/migrations/00005_multi_org.sql`

**SQL:**

```sql
-- Create orgs table
CREATE TABLE orgs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  owner_id   UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status     TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived'))
);

ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;

-- Add org_id to existing Sprint 1 tables
ALTER TABLE onboarding_sessions
  ADD COLUMN org_id UUID REFERENCES orgs(id);

ALTER TABLE precepts
  ADD COLUMN org_id UUID REFERENCES orgs(id);

ALTER TABLE audit_log
  ADD COLUMN org_id UUID REFERENCES orgs(id);

ALTER TABLE skill_index
  ADD COLUMN org_id UUID REFERENCES orgs(id);

-- Backfill: Create ROOKIE org, set org_id on all existing rows.
-- This runs as a DO block so it's atomic.
DO $$
DECLARE
  rookie_org_id UUID;
BEGIN
  INSERT INTO orgs (name, slug, owner_id)
  VALUES ('ROOKIE', 'rookie', gen_random_uuid())
  RETURNING id INTO rookie_org_id;

  UPDATE onboarding_sessions SET org_id = rookie_org_id WHERE org_id IS NULL;
  UPDATE precepts SET org_id = rookie_org_id WHERE org_id IS NULL;
  UPDATE audit_log SET org_id = rookie_org_id WHERE org_id IS NULL;
  UPDATE skill_index SET org_id = rookie_org_id WHERE org_id IS NULL;
END $$;

-- Now make org_id NOT NULL
ALTER TABLE onboarding_sessions ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE precepts ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE audit_log ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE skill_index ALTER COLUMN org_id SET NOT NULL;

-- Update RLS policies to include org_id scoping
-- (Default deny-all with service_role bypass is still in place from 00004)
-- Add org-scoped policies for future authenticated access:
CREATE POLICY org_isolation_onboarding ON onboarding_sessions
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_precepts ON precepts
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_audit ON audit_log
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_skills ON skill_index
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
```

**Step 1:** Create migration file with the SQL above.
**Step 2:** Commit: `feat: add multi-org schema migration with ROOKIE backfill`

---

### Task 0.3: Sprint 2 Tables Migration

**Files:**
- Create: `supabase/migrations/00006_sprint2_tables.sql`

**SQL — create all 10 new tables:**

```sql
-- Strategic initiatives
CREATE TABLE initiatives (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES orgs(id),
  name          TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  phase_current INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ
);

-- CEO plans
CREATE TABLE plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES orgs(id),
  initiative_id   UUID REFERENCES initiatives(id),
  content         JSONB NOT NULL,
  advisor_verdict TEXT CHECK (advisor_verdict IN ('APPROVED', 'APPROVED_WITH_CONCERNS', 'FLAGGED')),
  advisor_notes   TEXT,
  owner_approved  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks (atomic work units)
CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES orgs(id),
  plan_id         UUID REFERENCES plans(id),
  initiative_id   UUID REFERENCES initiatives(id),
  phase           INTEGER NOT NULL,
  state           TEXT NOT NULL DEFAULT 'PLANNED'
    CHECK (state IN (
      'PLANNED', 'QUEUED', 'DISPATCHED', 'IN_PROGRESS',
      'REVIEW', 'POLISH', 'JUDGMENT', 'REVISION',
      'ACCEPTED', 'ESCALATED', 'FAILED'
    )),
  role            TEXT NOT NULL
    CHECK (role IN ('researcher', 'coder', 'writer', 'analyst', 'ops')),
  assigned_worker TEXT,
  spec            JSONB NOT NULL,
  output          JSONB,
  skills_loaded   TEXT[] DEFAULT '{}',
  depends_on      UUID[] DEFAULT '{}',
  revision_count  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ
);

-- Task state transition log
CREATE TABLE task_transitions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES orgs(id),
  task_id    UUID NOT NULL REFERENCES tasks(id),
  from_state TEXT,
  to_state   TEXT NOT NULL,
  agent_id   TEXT NOT NULL,
  reason     TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent performance profiles
CREATE TABLE agent_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES orgs(id),
  agent_id        TEXT NOT NULL,
  role            TEXT NOT NULL,
  model           TEXT NOT NULL,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  acceptance_rate NUMERIC(5,2),
  recent_trend    TEXT CHECK (recent_trend IN ('improving', 'stable', 'declining')),
  strengths       TEXT[] DEFAULT '{}',
  weaknesses      TEXT[] DEFAULT '{}',
  craft_notes     TEXT,
  trust_level     TEXT NOT NULL DEFAULT 'apprentice'
    CHECK (trust_level IN ('apprentice', 'journeyman', 'master')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ
);

-- Decision log
CREATE TABLE decision_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES orgs(id),
  initiative_id UUID REFERENCES initiatives(id),
  decision      TEXT NOT NULL,
  reasoning     TEXT NOT NULL,
  alternatives  TEXT,
  why_not       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lesson artifacts
CREATE TABLE lesson_artifacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES orgs(id),
  initiative_id UUID REFERENCES initiatives(id),
  what_tried    TEXT NOT NULL,
  what_happened TEXT NOT NULL,
  why           TEXT,
  what_learned  TEXT NOT NULL,
  do_differently TEXT,
  never_repeat  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Role memory (pgvector)
CREATE TABLE role_memory (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES orgs(id),
  role             TEXT NOT NULL,
  domain           TEXT,
  content          TEXT NOT NULL,
  embedding        vector(768) NOT NULL,
  source_task      UUID REFERENCES tasks(id),
  confidence       TEXT NOT NULL DEFAULT 'medium'
    CHECK (confidence IN ('high', 'medium', 'low')),
  entry_type       TEXT NOT NULL DEFAULT 'finding'
    CHECK (entry_type IN ('finding', 'craft_pattern', 'contact')),
  status           TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'stale', 'archived')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_retrieved_at TIMESTAMPTZ
);

-- Team Bulletin
CREATE TABLE team_bulletin (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES orgs(id),
  task_id    UUID REFERENCES tasks(id),
  role       TEXT NOT NULL,
  summary    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Internal messages
CREATE TABLE messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES orgs(id),
  from_role      TEXT NOT NULL,
  from_agent_id  TEXT NOT NULL,
  to_role        TEXT NOT NULL,
  message_type   TEXT NOT NULL,
  payload        JSONB NOT NULL,
  reference_id   UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tasks_plan_id ON tasks(plan_id);
CREATE INDEX idx_tasks_state ON tasks(state);
CREATE INDEX idx_tasks_initiative_id ON tasks(initiative_id);
CREATE INDEX idx_task_transitions_task_id ON task_transitions(task_id);
CREATE INDEX idx_task_transitions_created_at ON task_transitions(created_at);
CREATE INDEX idx_agent_profiles_agent_id ON agent_profiles(agent_id);
CREATE INDEX idx_role_memory_role_status ON role_memory(role, status);
CREATE INDEX idx_messages_reference_id ON messages(reference_id);
CREATE INDEX idx_messages_message_type ON messages(message_type);
CREATE INDEX idx_team_bulletin_created_at ON team_bulletin(created_at);

-- RLS on all new tables
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_bulletin ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
```

**Step 1:** Create migration file.
**Step 2:** Commit: `feat: add Sprint 2 tables — initiatives, plans, tasks, evaluations, memory`

---

### Task 0.4: pgvector Functions Migration

**Files:**
- Create: `supabase/migrations/00007_pgvector_functions.sql`

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Create ivfflat index for fast similarity search
CREATE INDEX idx_role_memory_embedding ON role_memory
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Semantic search: returns top-K role memory entries by cosine similarity.
-- Also updates last_retrieved_at on returned rows.
CREATE OR REPLACE FUNCTION match_role_memory(
  query_embedding vector(768),
  match_org_id UUID,
  match_role TEXT,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  role TEXT,
  domain TEXT,
  content TEXT,
  confidence TEXT,
  entry_type TEXT,
  source_task UUID,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  matched_ids UUID[];
BEGIN
  -- Find matches
  RETURN QUERY
  SELECT
    rm.id,
    rm.role,
    rm.domain,
    rm.content,
    rm.confidence,
    rm.entry_type,
    rm.source_task,
    1 - (rm.embedding <=> query_embedding) AS similarity
  FROM role_memory rm
  WHERE rm.org_id = match_org_id
    AND rm.role = match_role
    AND rm.status = 'active'
  ORDER BY rm.embedding <=> query_embedding
  LIMIT match_count;

  -- Update last_retrieved_at on matched rows
  SELECT array_agg(sub.id) INTO matched_ids
  FROM (
    SELECT rm.id
    FROM role_memory rm
    WHERE rm.org_id = match_org_id
      AND rm.role = match_role
      AND rm.status = 'active'
    ORDER BY rm.embedding <=> query_embedding
    LIMIT match_count
  ) sub;

  IF matched_ids IS NOT NULL THEN
    UPDATE role_memory SET last_retrieved_at = now()
    WHERE role_memory.id = ANY(matched_ids);
  END IF;
END;
$$;

-- Deduplication: archives older entries when two entries in the same
-- org+role have cosine similarity above threshold.
CREATE OR REPLACE FUNCTION deduplicate_role_memory(
  target_org_id UUID,
  similarity_threshold FLOAT DEFAULT 0.95,
  target_role TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  archived_count INT := 0;
BEGIN
  WITH duplicates AS (
    SELECT
      a.id AS keep_id,
      b.id AS archive_id
    FROM role_memory a
    JOIN role_memory b ON a.org_id = b.org_id
      AND a.role = b.role
      AND a.id < b.id
      AND a.status = 'active'
      AND b.status = 'active'
    WHERE a.org_id = target_org_id
      AND (target_role IS NULL OR a.role = target_role)
      AND 1 - (a.embedding <=> b.embedding) > similarity_threshold
  )
  UPDATE role_memory SET status = 'archived'
  WHERE id IN (SELECT archive_id FROM duplicates);

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$;
```

**Step 1:** Create migration file.
**Step 2:** Commit: `feat: add pgvector extension, similarity search, and dedup functions`

---

### Task 0.5: DB Layer — Core Tables

Create the DB access functions for the new tables. Follow the existing pattern from `db/onboarding.ts` and `db/audit.ts`.

**Files:**
- Create: `packages/engine/src/db/orgs.ts`
- Create: `packages/engine/src/db/initiatives.ts`
- Create: `packages/engine/src/db/plans.ts`
- Create: `packages/engine/src/db/tasks.ts`
- Create: `packages/engine/src/db/agent-profiles.ts`
- Create: `packages/engine/src/db/decisions.ts`
- Create: `packages/engine/src/db/role-memory.ts`
- Create: `packages/engine/src/db/team-bulletin.ts`
- Create: `packages/engine/src/db/messages.ts`
- Create: `packages/engine/src/db/__tests__/tasks.test.ts`

Each DB module exports CRUD functions using the existing `db` client from `db/client.ts`. All functions accept `orgId` as a required parameter. Map camelCase ↔ snake_case manually (no ORM).

**Key function signatures:**

`db/orgs.ts`:
- `getOrg(orgId: string): Promise<Org | null>`
- `getOrgBySlug(slug: string): Promise<Org | null>`
- `createOrg(params: CreateOrgParams): Promise<Org>`

`db/tasks.ts` (most complex — central to everything):
- `createTask(params: CreateTaskParams): Promise<Task>`
- `createTasks(params: CreateTaskParams[]): Promise<Task[]>` — bulk insert from plan
- `getTask(taskId: string): Promise<Task | null>`
- `getTasksByPlan(planId: string): Promise<Task[]>`
- `getTasksByState(orgId: string, state: TaskState): Promise<Task[]>`
- `getTasksByPhase(planId: string, phase: number): Promise<Task[]>`
- `updateTaskState(taskId: string, state: TaskState): Promise<void>`
- `updateTaskOutput(taskId: string, output: WorkerOutput): Promise<void>`
- `updateTaskWorker(taskId: string, workerId: string, skills: string[]): Promise<void>`
- `incrementRevisionCount(taskId: string): Promise<number>` — returns new count
- `getDependentTasks(taskId: string): Promise<Task[]>` — tasks that depend on this one

`db/plans.ts`:
- `createPlan(params: CreatePlanParams): Promise<Plan>`
- `getPlan(planId: string): Promise<Plan | null>`
- `updateAdvisorVerdict(planId: string, verdict: AdvisorVerdict, notes: string): Promise<void>`
- `approvePlan(planId: string): Promise<void>`
- `getUnapprovedPlans(orgId: string): Promise<Plan[]>`

`db/role-memory.ts`:
- `storeRoleMemory(params: StoreRoleMemoryParams): Promise<void>` — insert with embedding
- `matchRoleMemory(orgId: string, role: string, embedding: number[], count?: number): Promise<RoleMemoryMatch[]>` — calls `match_role_memory` RPC
- `deduplicateRoleMemory(orgId: string, threshold?: number, role?: string): Promise<number>` — calls `deduplicate_role_memory` RPC

`db/messages.ts`:
- `logMessage(msg: Omit<InternalMessage, 'id' | 'created_at'>): Promise<void>` — fire-and-forget like audit

`db/agent-profiles.ts`:
- `getProfile(orgId: string, agentId: string): Promise<AgentProfile | null>`
- `getProfilesByRole(orgId: string, role: string): Promise<AgentProfile[]>`
- `upsertProfile(params: UpsertProfileParams): Promise<void>`
- `incrementTaskCount(agentId: string, orgId: string): Promise<void>`

`db/team-bulletin.ts`:
- `addBulletinEntry(params: BulletinParams): Promise<void>`
- `getRecentBulletin(orgId: string, limit?: number): Promise<BulletinEntry[]>` — default 10

`db/decisions.ts`:
- `logDecision(params: DecisionParams): Promise<void>`
- `getRecentDecisions(orgId: string, limit?: number): Promise<Decision[]>`
- `logLesson(params: LessonParams): Promise<void>`
- `getRecentLessons(orgId: string, limit?: number): Promise<Lesson[]>`

`db/initiatives.ts`:
- `createInitiative(params: CreateInitiativeParams): Promise<Initiative>`
- `getInitiative(id: string): Promise<Initiative | null>`
- `getActiveInitiatives(orgId: string): Promise<Initiative[]>`
- `updateInitiativeStatus(id: string, status: string): Promise<void>`
- `updateInitiativePhase(id: string, phase: number): Promise<void>`

**Test file** (`db/__tests__/tasks.test.ts`):

Write unit tests for the camelCase ↔ snake_case mapping functions. Mock the Supabase client. Test:
- `createTask` builds correct insert payload
- `getTasksByState` passes correct filter
- `updateTaskState` calls update with correct params
- `getDependentTasks` filters by `depends_on` array containment

**Step 1:** Create all 9 DB module files.
**Step 2:** Create `db/__tests__/tasks.test.ts`.
**Step 3:** Run tests: `bun run --cwd packages/engine test -- src/db/__tests__/tasks.test.ts`
**Step 4:** Run typecheck: `bun run --cwd packages/engine build`
**Step 5:** Commit: `feat: add Sprint 2 DB layer — orgs, tasks, plans, memory, messages`

---

## Phase 1: Engine Infrastructure

The orchestration core, state machine, dependency resolver, and `invokeAgent()`.

### Task 1.1: invokeAgent() + Retry Logic

**Files:**
- Modify: `packages/engine/src/ai/client.ts` — add `invokeAgent()`, keep existing exports
- Create: `packages/engine/src/ai/__tests__/client.test.ts`

**Add to `ai/client.ts`:**

```typescript
import { logEvent } from '../db/audit.js';
import type { AuditEventType } from '@precept/shared';

export interface InvokeAgentOptions {
  model: 'opus' | 'sonnet';
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
}

export interface AgentResponse {
  content: string;
  parsed?: Record<string, unknown>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  durationMs: number;
}

export class AgentInvocationError extends Error {
  constructor(
    public readonly agentId: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(`Agent ${agentId} failed after ${attempts} attempts: ${lastError.message}`);
    this.name = 'AgentInvocationError';
  }
}

const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

export async function invokeAgent(
  agentId: string,
  options: InvokeAgentOptions
): Promise<AgentResponse> {
  const modelId = MODELS[options.model];
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 0; attempt < RETRY_DELAYS.length + 1; attempt++) {
    try {
      const startMs = Date.now();

      const response = await ai.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: options.systemPrompt },
          ...options.messages,
        ],
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      });

      const durationMs = Date.now() - startMs;
      const content = response.choices[0]?.message?.content ?? '';
      const usage = {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      };

      let parsed: Record<string, unknown> | undefined;
      if (options.jsonMode) {
        parsed = extractJSON(content);
      }

      // Fire-and-forget audit log
      logEvent('ai.call' as AuditEventType, agentId, {
        model: modelId,
        durationMs,
        tokens: usage,
        jsonMode: options.jsonMode ?? false,
        parsed: parsed !== undefined,
      }, usage.totalTokens);

      return { content, parsed, usage, model: modelId, durationMs };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < RETRY_DELAYS.length) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
      }
    }
  }

  throw new AgentInvocationError(agentId, RETRY_DELAYS.length + 1, lastError);
}

/** 3-tier JSON extraction: strip fences → regex → undefined */
function extractJSON(content: string): Record<string, unknown> | undefined {
  // Tier 1: strip markdown fences
  const stripped = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
  try {
    return JSON.parse(stripped);
  } catch { /* continue */ }

  // Tier 2: regex find first { ... }
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch { /* continue */ }
  }

  return undefined;
}
```

**Tests** — mock the OpenAI client, verify:
- Successful call returns AgentResponse with correct fields
- JSON extraction works for all 3 tiers
- Retry on 500: mock first 2 calls to throw, third succeeds → returns result
- Retry exhaustion: all calls throw → throws AgentInvocationError
- Audit logging called with correct metadata

**Step 1:** Write test file.
**Step 2:** Run tests, verify they fail.
**Step 3:** Add `invokeAgent()` to `client.ts`.
**Step 4:** Run tests, verify they pass.
**Step 5:** Commit: `feat: add invokeAgent() with retry, JSON extraction, and audit logging`

---

### Task 1.2: State Machine

**Files:**
- Create: `packages/engine/src/orchestration/state-machine.ts`
- Create: `packages/engine/src/orchestration/__tests__/state-machine.test.ts`

**Implementation:**

```typescript
import type { TaskState } from '@precept/shared';

// Valid transition map: from_state → Set<to_state>
const VALID_TRANSITIONS: Record<TaskState, Set<TaskState>> = {
  PLANNED:     new Set(['QUEUED']),
  QUEUED:      new Set(['DISPATCHED']),
  DISPATCHED:  new Set(['IN_PROGRESS']),
  IN_PROGRESS: new Set(['REVIEW', 'FAILED']),
  REVIEW:      new Set(['POLISH', 'JUDGMENT']),
  POLISH:      new Set(['REVIEW']),
  JUDGMENT:    new Set(['ACCEPTED', 'REVISION', 'ESCALATED']),
  REVISION:    new Set(['REVIEW']),
  FAILED:      new Set(['ESCALATED']),
  ESCALATED:   new Set(['QUEUED', 'PLANNED']),
  ACCEPTED:    new Set([]), // terminal
};

export function validateTransition(from: TaskState, to: TaskState): boolean {
  return VALID_TRANSITIONS[from]?.has(to) ?? false;
}
```

Plus `applyTransition()` which:
1. Calls `validateTransition()` — throws if invalid
2. If JUDGMENT → REVISION: calls `incrementRevisionCount()`, if count >= 2 → auto-ESCALATE instead
3. Writes new state to `tasks` table via `db/tasks.ts`
4. Logs to `task_transitions` table
5. Returns the actual target state (may differ from requested if auto-escalated)

**Tests:**
- Every valid transition returns true
- Every invalid transition returns false (e.g., PLANNED → ACCEPTED)
- `applyTransition` with JUDGMENT → REVISION when revision_count < 2 → REVISION
- `applyTransition` with JUDGMENT → REVISION when revision_count >= 2 → auto-ESCALATED
- `applyTransition` with invalid transition → throws

**Step 1:** Write tests.
**Step 2:** Run tests, verify fail.
**Step 3:** Implement state machine.
**Step 4:** Run tests, verify pass.
**Step 5:** Commit: `feat: add task state machine with transition validation and auto-escalation`

---

### Task 1.3: Dependency Resolution

**Files:**
- Create: `packages/engine/src/orchestration/dependency.ts`
- Create: `packages/engine/src/orchestration/__tests__/dependency.test.ts`

**Implementation:**

```typescript
export function getDispatchableTasks(tasks: Task[]): Task[]
// Returns tasks in PLANNED state where every task ID in depends_on
// refers to a task in ACCEPTED state.

export function checkPhaseCompletion(tasks: Task[], phase: number): boolean
// Returns true if every task with task.phase === phase is in ACCEPTED state.

export function buildDependencyGraph(tasks: Task[]): Map<string, string[]>
// Returns adjacency list: taskId → [taskIds that depend on it]
// Used for visualization / debugging. Not needed for core dispatch logic.
```

These are pure functions — no DB calls. They take task arrays and return results. The engine fetches tasks from DB and passes them in.

**Tests:**
- `getDispatchableTasks`: task with no deps in PLANNED → returned. Task with unmet dep → not returned. Task with all deps ACCEPTED → returned. Task already QUEUED → not returned.
- `checkPhaseCompletion`: all tasks in phase ACCEPTED → true. One task not ACCEPTED → false. Empty phase → true.
- `buildDependencyGraph`: correct adjacency list from depends_on arrays.

**Step 1:** Write tests with concrete task arrays.
**Step 2:** Run, verify fail.
**Step 3:** Implement pure functions.
**Step 4:** Run, verify pass.
**Step 5:** Commit: `feat: add dependency resolution — dispatchable tasks and phase completion`

---

### Task 1.4: Orchestration Engine (Event Loop)

**Files:**
- Create: `packages/engine/src/orchestration/engine.ts`
- Create: `packages/engine/src/orchestration/__tests__/engine.test.ts`

**Implementation:**

The engine is a class with an async event queue:

```typescript
import type { TaskState } from '@precept/shared';

export type EngineEvent =
  | { type: 'planning_cycle'; orgId: string }
  | { type: 'briefing_cycle'; orgId: string }
  | { type: 'plan_approved'; planId: string }
  | { type: 'task_completed'; taskId: string }
  | { type: 'review_verdict'; taskId: string; verdict: string }
  | { type: 'judge_verdict'; taskId: string; verdict: string }
  | { type: 'escalation'; taskId: string }
  | { type: 'phase_completed'; planId: string; phase: number }
  | { type: 'owner_reply'; orgId: string; content: string }
  | { type: 'memory_cleanup'; orgId: string };

export class OrchestrationEngine {
  private queue: EngineEvent[] = [];
  private processing = false;

  push(event: EngineEvent): void { ... }

  private async processQueue(): Promise<void> {
    // Process events one at a time, sequentially
    // Each handler may push follow-up events
  }

  async handleEvent(event: EngineEvent): Promise<void> {
    // Switch on event.type, call the appropriate service
    // This is the central routing table
  }

  // Called once on startup for recovery
  async recoverFromRestart(): Promise<void> { ... }
}
```

For now, the handler methods will be stubs that log the event. Services get wired in during Phases 2-5.

**Tests:**
- Events pushed to queue are processed sequentially
- Events pushed during processing are queued, not dropped
- Multiple concurrent pushes don't cause parallel processing

**Step 1:** Write tests.
**Step 2:** Run, verify fail.
**Step 3:** Implement engine with stub handlers.
**Step 4:** Run, verify pass.
**Step 5:** Commit: `feat: add orchestration engine with sequential event loop`

---

### Task 1.5: Scheduler

**Files:**
- Create: `packages/engine/src/orchestration/scheduler.ts`
- Modify: `packages/engine/package.json` — add `node-cron` dependency

**Implementation:**

```typescript
import cron from 'node-cron';
import type { OrchestrationEngine } from './engine.js';

export class Scheduler {
  private jobs: cron.ScheduledTask[] = [];

  constructor(private engine: OrchestrationEngine, private orgId: string) {}

  start(): void {
    // Weekly planning: Sunday 8pm
    this.jobs.push(cron.schedule('0 20 * * 0', () => {
      this.engine.push({ type: 'planning_cycle', orgId: this.orgId });
    }));

    // Daily briefing: 7am
    this.jobs.push(cron.schedule('0 7 * * *', () => {
      this.engine.push({ type: 'briefing_cycle', orgId: this.orgId });
    }));
  }

  stop(): void {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
  }
}
```

Note: `orgId` is hardcoded for single-org Sprint 2. Multi-org iteration would register schedules per org.

**Step 1:** `bun add --cwd packages/engine node-cron && bun add --cwd packages/engine -d @types/node-cron`
**Step 2:** Create scheduler.
**Step 3:** Commit: `feat: add node-cron scheduler for planning and briefing cycles`

---

### Task 1.6: EmbeddingGemma Wrapper

**Files:**
- Create: `packages/engine/src/lib/embeddings.ts`
- Create: `packages/engine/src/lib/__tests__/embeddings.test.ts`
- Modify: `packages/engine/package.json` — add `@huggingface/transformers`

**Implementation:** Use the exact code from the embedding reference doc (attached by user). The file is `lib/embeddings.ts` with `embedText()` and `embedTexts()` functions.

**Tests:** Mock `@huggingface/transformers` pipeline. Verify:
- `embedText` with `'query'` uses the correct prompt prefix
- `embedText` with `'document'` uses the correct prompt prefix
- `embedTexts` returns array of correct length
- Singleton: `getEmbedder()` only creates pipeline once

**Step 1:** `bun add --cwd packages/engine @huggingface/transformers`
**Step 2:** Write tests.
**Step 3:** Run, verify fail.
**Step 4:** Create `embeddings.ts`.
**Step 5:** Run, verify pass.
**Step 6:** Commit: `feat: add EmbeddingGemma 768-dim wrapper for role memory`

---

### Task 1.7: Route Groups + Engine Wiring

**Files:**
- Create: `packages/engine/src/routes/orchestration.ts`
- Create: `packages/engine/src/routes/webhooks.ts`
- Modify: `packages/engine/src/index.ts` — add new route groups
- Modify: `.env.example` — add new env vars

**`routes/orchestration.ts`** — test/manual trigger endpoints:

```typescript
import { Hono } from 'hono';

export const orchestration = new Hono();

orchestration.post('/trigger-planning', async (c) => { ... });
orchestration.post('/trigger-briefing', async (c) => { ... });
orchestration.post('/approve-plan/:planId', async (c) => { ... });
orchestration.post('/owner-reply', async (c) => { ... });
orchestration.get('/tasks/:planId', async (c) => { ... });
orchestration.get('/health', async (c) => { ... });
```

**`routes/webhooks.ts`** — AgentMail webhook:

```typescript
import { Hono } from 'hono';

export const webhooks = new Hono();

webhooks.post('/agentmail', async (c) => { ... });
```

**Update `index.ts`:**

```typescript
import { orchestration } from './routes/orchestration.js';
import { webhooks } from './routes/webhooks.js';

app.route('/api/orchestration', orchestration);
app.route('/api/webhooks', webhooks);
```

**Update `.env.example`:**

```
# AgentMail
AGENTMAIL_API_KEY=your-agentmail-api-key
AGENTMAIL_FROM_ADDRESS=briefing@yourdomain.com
```

Route handlers initially return placeholder responses. Real logic gets wired when services are built.

**Step 1:** Create route files with placeholder handlers.
**Step 2:** Update `index.ts`.
**Step 3:** Update `.env.example`.
**Step 4:** Run `bun run --cwd packages/engine build` — must pass.
**Step 5:** Commit: `feat: add orchestration routes, webhook routes, and engine wiring`

---

## Phase 2: CEO Planning Cycle

Scribe → CEO → Board Advisor → plan stored. Each service gets a prompt file and a service class.

### Task 2.1: Scribe Service

**Files:**
- Create: `packages/engine/src/ai/prompts/scribe.ts`
- Create: `packages/engine/src/services/scribe.ts`
- Create: `packages/engine/src/services/__tests__/scribe.test.ts`

**Prompt** (`ai/prompts/scribe.ts`): Instruct Sonnet to compress activity into a structured context package. Input: raw audit entries, initiative states, lesson artifacts, skill changes. Output: JSON matching InternalMessage schema with `message_type: 'context_package'`. Emphasize: summarize at initiative level (not task level), surface exceptions and patterns, note skill changes.

**Service** (`services/scribe.ts`): `ScribeService` class with `compressContext(orgId: string): Promise<InternalMessage>`. Reads from DB, builds prompt, calls `invokeAgent('Scribe-1', { model: 'sonnet', temperature: 0.3, jsonMode: true })`, returns parsed context package.

**Tests:** Mock `invokeAgent`, mock DB queries. Verify the service assembles correct prompt inputs and returns structured output.

**Step 1:** Write tests.
**Step 2:** Create prompt file.
**Step 3:** Create service file.
**Step 4:** Run tests, verify pass.
**Step 5:** Commit: `feat: add Scribe service for context compression`

---

### Task 2.2: CEO Planning Service

**Files:**
- Create: `packages/engine/src/ai/prompts/ceo-planning.ts`
- Create: `packages/engine/src/services/ceo.ts`
- Create: `packages/engine/src/services/__tests__/ceo.test.ts`

**Prompt** (`ai/prompts/ceo-planning.ts`): The CEO receives Precepts, Scribe context, lesson artifacts, owner input, leadership skills. Must produce machine-parseable JSON matching `PlanOutput` schema. Include 1-2 examples in the prompt. Validate output before storing.

**Service** (`services/ceo.ts`): `CEOService` class with:
- `planningCycle(orgId: string): Promise<Plan>` — Scribe → CEO → store plan + initiatives + tasks + decisions
- `handleEscalation(taskId: string): Promise<EscalationDiagnosis>` — stub for now, implement in Phase 4
- `compileBriefing(orgId: string): Promise<BriefingContent>` — stub for now, implement in Phase 5
- `handleOwnerReply(orgId: string, content: string): Promise<OwnerReplyIntent>` — stub for now, implement in Phase 5

`planningCycle` flow:
1. Read Precepts from DB
2. Call ScribeService.compressContext()
3. Read recent lesson artifacts, owner input
4. Read leadership skills from disk (skills/leadership/ or skills/org-wide/)
5. Build CEO prompt with all context
6. Call `invokeAgent('CEO-1', { model: 'opus', temperature: 0.7, jsonMode: true })`
7. Parse PlanOutput from response
8. Create `initiatives` rows, `tasks` rows (with proper depends_on mapping), `decision_log` rows
9. Create `plans` row
10. Return the plan

**Tests:** Mock `invokeAgent` to return a valid PlanOutput JSON. Verify:
- Correct prompt assembly (Precepts present, context package present)
- Plan parsed and stored correctly
- Initiatives created from plan
- Tasks created with correct phase, depends_on, spec
- Decisions logged

**Step 1:** Write tests.
**Step 2:** Create prompt file.
**Step 3:** Create service file.
**Step 4:** Run tests, verify pass.
**Step 5:** Commit: `feat: add CEO planning service with plan parsing and DB storage`

---

### Task 2.3: Board Advisor Service

**Files:**
- Create: `packages/engine/src/ai/prompts/advisor.ts`
- Create: `packages/engine/src/services/advisor.ts`
- Create: `packages/engine/src/services/__tests__/advisor.test.ts`

**Prompt** (`ai/prompts/advisor.ts`): Adversarial to CEO reasoning. Look for logical gaps, Precepts misalignment, resource overcommitment, ignored lessons. Receives: CEO plan, Precepts, recent decision log (10), lesson artifacts, aggregate performance data.

**Service** (`services/advisor.ts`): `AdvisorService` class with `reviewPlan(planId: string): Promise<{ verdict: AdvisorVerdict; notes: string }>`. Calls `invokeAgent('Advisor-1', { model: 'opus', temperature: 0.6, jsonMode: true })`. Writes verdict + notes to `plans` table.

**Tests:** Mock `invokeAgent` with each verdict type. Verify DB writes.

**Step 1:** Write tests.
**Step 2:** Create prompt and service.
**Step 3:** Run tests, verify pass.
**Step 4:** Commit: `feat: add Board Advisor service for adversarial plan review`

---

### Task 2.4: Wire Planning Cycle into Engine

**Files:**
- Modify: `packages/engine/src/orchestration/engine.ts` — wire `planning_cycle` handler
- Modify: `packages/engine/src/routes/orchestration.ts` — wire `trigger-planning` endpoint

**Implementation:**

`planning_cycle` handler:
1. Call `ceoService.planningCycle(orgId)` → returns plan
2. Call `advisorService.reviewPlan(planId)` → returns verdict
3. If verdict is FLAGGED → log, don't auto-approve (wait for owner)
4. If APPROVED or APPROVED_WITH_CONCERNS → depending on auto-approve config, either push `plan_approved` event or wait for owner

`trigger-planning` endpoint:
- Accepts `{ orgId }` body
- Pushes `planning_cycle` event to engine
- Returns `{ status: 'triggered' }`

**Step 1:** Wire the handler.
**Step 2:** Wire the endpoint.
**Step 3:** Run existing tests to ensure nothing breaks.
**Step 4:** Commit: `feat: wire planning cycle into orchestration engine`

---

## Phase 3: Dispatcher + Worker Execution

### Task 3.1: Dispatcher Service

**Files:**
- Create: `packages/engine/src/ai/prompts/dispatcher.ts`
- Create: `packages/engine/src/services/dispatcher.ts`
- Create: `packages/engine/src/services/__tests__/dispatcher.test.ts`

**Prompt** (`ai/prompts/dispatcher.ts`): Worker selection and skill matching. Input: available workers (from agent_profiles), task spec, skill_index. Output: JSON with worker assignment and skill selection per task.

**Service** (`services/dispatcher.ts`): `DispatcherService` class with:

- `executePlan(planId: string): Promise<void>` — main entry point
  1. Get all tasks for plan
  2. Call `dependency.getDispatchableTasks()` for ready tasks
  3. Move ready tasks PLANNED → QUEUED
  4. For each QUEUED task: call `invokeAgent` for worker selection (or deterministic logic for simple cases)
  5. Select skills: CEO explicit first, then trigger_tag match, max 3
  6. Assemble worker context (see below)
  7. Call `workerService.execute()` concurrently (semaphore-limited)

- `assembleWorkerContext(task: Task): Promise<WorkerContext>` — builds the 6-part context package:
  1. System prompt (role identity, boundaries, performance profile, Precepts values, stop cord)
  2. Task spec + acceptance criteria
  3. Skills (read .md files from disk, 0-3)
  4. Role memory (embedText query → match_role_memory RPC, top-5)
  5. Chain context (accepted output from predecessor tasks)
  6. Team Bulletin (last 10 entries)

**Concurrency:** Use a simple semaphore pattern:

```typescript
class Semaphore {
  private current = 0;
  private queue: (() => void)[] = [];

  constructor(private limit: number) {}

  async acquire(): Promise<void> { ... }
  release(): void { ... }
}
```

Default limit: 3 concurrent workers (configurable via env `MAX_CONCURRENT_WORKERS`).

**Tests:**
- `executePlan` with tasks that have met dependencies → dispatches them
- `executePlan` with tasks that have unmet dependencies → skips them
- Skill selection: CEO explicit takes priority, then trigger_tag match
- Semaphore: verify concurrent worker limit is respected
- `assembleWorkerContext` includes all 6 parts

**Step 1:** Write tests.
**Step 2:** Create prompt and service.
**Step 3:** Run tests, verify pass.
**Step 4:** Commit: `feat: add Dispatcher service with dependency-aware dispatch and context assembly`

---

### Task 3.2: Worker Service

**Files:**
- Create: `packages/engine/src/ai/prompts/worker.ts`
- Create: `packages/engine/src/services/worker.ts`
- Create: `packages/engine/src/services/__tests__/worker.test.ts`

**Prompt** (`ai/prompts/worker.ts`): Dynamic prompt builder. Takes role, performance profile, Precepts values, stop cord instruction. Outputs the system prompt string. Worker output format enforced: `{ output, key_findings, confidence, flag, notes }`.

**Service** (`services/worker.ts`): `WorkerService` class with:

- `execute(task: Task, context: WorkerContext): Promise<WorkerOutput>` — the main function
  1. Build system prompt from context
  2. Call `invokeAgent('Worker-N', { model: 'sonnet', temperature: 0.5, jsonMode: true })`
  3. Parse WorkerOutput from response
  4. Store output in `tasks.output`
  5. Return the output

The engine handles state transitions after this returns — the worker service just invokes and parses.

**Tests:**
- Successful invocation returns parsed WorkerOutput
- Flag extraction: output with non-null flag is returned correctly
- JSON parse failure: returns error (engine will mark task FAILED)
- System prompt includes all context parts

**Step 1:** Write tests.
**Step 2:** Create prompt builder and service.
**Step 3:** Run tests, verify pass.
**Step 4:** Commit: `feat: add Worker service with dynamic prompt builder and output parsing`

---

### Task 3.3: Wire Dispatch into Engine

**Files:**
- Modify: `packages/engine/src/orchestration/engine.ts` — wire `plan_approved` and `task_completed` handlers
- Modify: `packages/engine/src/routes/orchestration.ts` — wire `approve-plan` endpoint

**`plan_approved` handler:**
1. Call `dispatcherService.executePlan(planId)`
2. For each dispatched worker result:
   - If success: store output, push `task_completed` event
   - If error/timeout: `applyTransition(taskId, 'FAILED', ...)`

**`task_completed` handler:**
1. Get task from DB
2. If task has flag → log InternalMessage { type: 'flag' } for CEO
3. `applyTransition(taskId, 'REVIEW', workerAgentId, 'worker submitted output')`
4. Push `review_verdict` event (after Reviewer runs — next phase)

Actually, `task_completed` transitions to REVIEW, then the engine needs to invoke the Reviewer. Since the Reviewer isn't built yet, this handler pushes a `review_verdict` event that will be handled in Phase 4. For now, log that review is needed.

**Step 1:** Wire handlers.
**Step 2:** Wire endpoint.
**Step 3:** Run tests.
**Step 4:** Commit: `feat: wire dispatch and worker execution into orchestration engine`

---

## Phase 4: Evaluation Gates

### Task 4.1: Reviewer Service

**Files:**
- Create: `packages/engine/src/ai/prompts/reviewer.ts`
- Create: `packages/engine/src/services/reviewer.ts`
- Create: `packages/engine/src/services/__tests__/reviewer.test.ts`

**Prompt** (`ai/prompts/reviewer.ts`): Quality-focused, not adversarial. "Is this work well-crafted?" Receives: worker output, task spec, craft-evaluation skill, domain role memory. Does NOT receive CEO rationale or other workers' outputs.

**Service** (`services/reviewer.ts`): `ReviewerService` class with:

- `evaluate(taskId: string): Promise<ReviewVerdict>`
  1. Read task from DB (output + spec)
  2. Read craft-evaluation skill from disk (if exists)
  3. Query role memory for domain context
  4. Build prompt — compartmentalized inputs only
  5. Call `invokeAgent('Reviewer-1', { model: 'opus', temperature: 0.5, jsonMode: true })`
  6. Parse ReviewVerdict
  7. Update agent_profiles (increment task count, append craft notes, commendation if EXCELLENT)
  8. Return verdict

**Tests:**
- POLISH verdict: returns feedback + areas
- GOOD verdict: returns notes
- EXCELLENT verdict: returns commendation, agent_profiles updated with commendation
- Compartmentalization: verify prompt does NOT include CEO rationale

**Step 1:** Write tests.
**Step 2:** Create prompt and service.
**Step 3:** Run tests, verify pass.
**Step 4:** Commit: `feat: add Reviewer service for craft quality evaluation`

---

### Task 4.2: Judge Service

**Files:**
- Create: `packages/engine/src/ai/prompts/judge.ts`
- Create: `packages/engine/src/services/judge.ts`
- Create: `packages/engine/src/services/__tests__/judge.test.ts`

**Prompt** (`ai/prompts/judge.ts`): Adversarial by default. "Does this achieve what was asked?" Goes through acceptance criteria one by one. Receives: reviewer-approved output, task spec + acceptance criteria, outcome-evaluation skill. Does NOT receive CEO planning rationale or Reviewer quality notes.

**Service** (`services/judge.ts`): `JudgeService` class with:

- `evaluate(taskId: string): Promise<JudgeVerdict>`
  1. Read task from DB (output + spec with acceptance criteria)
  2. Read outcome-evaluation skill from disk (if exists)
  3. Build prompt — compartmentalized
  4. Call `invokeAgent('Judge-1', { model: 'opus', temperature: 0.4, jsonMode: true })`
  5. Parse JudgeVerdict
  6. Return verdict (engine handles consequences)

**Tests:**
- ACCEPT verdict: returns assessment + criteria_met
- REVISE verdict: returns feedback + criteria_failed
- ESCALATE verdict: returns reason + diagnosis_hint
- Compartmentalization: verify prompt does NOT include CEO rationale or Reviewer notes

**Step 1:** Write tests.
**Step 2:** Create prompt and service.
**Step 3:** Run tests, verify pass.
**Step 4:** Commit: `feat: add Judge service for outcome evaluation`

---

### Task 4.3: Wire Evaluation Gates into Engine

**Files:**
- Modify: `packages/engine/src/orchestration/engine.ts` — wire review + judge handlers

**`task_completed` handler (update from Phase 3):**
1. `applyTransition(taskId, 'REVIEW', ...)`
2. Call `reviewerService.evaluate(taskId)` → verdict
3. Log InternalMessage { type: 'review_verdict' }
4. If POLISH: `applyTransition(taskId, 'POLISH', ...)`, re-dispatch to worker with feedback, on resubmission → back to step 1
5. If GOOD/EXCELLENT: `applyTransition(taskId, 'JUDGMENT', ...)`, call judge

**After Reviewer passes (GOOD/EXCELLENT):**
1. Call `judgeService.evaluate(taskId)` → verdict
2. Log InternalMessage { type: 'judge_verdict' }
3. If ACCEPT:
   - `applyTransition(taskId, 'ACCEPTED', ...)`
   - Extract key_findings → embedText('document') → store in role_memory
   - Write team_bulletin entry
   - Call `dependency.getDispatchableTasks()` → dispatch newly unblocked tasks
   - Call `dependency.checkPhaseCompletion()` → if complete, push `phase_completed` event
4. If REVISE:
   - Check revision_count — `applyTransition` handles auto-ESCALATE if >= 2
   - If REVISION: re-dispatch to worker with Judge feedback → back through Reviewer
5. If ESCALATE:
   - `applyTransition(taskId, 'ESCALATED', ...)`
   - Push `escalation` event

**`escalation` handler:**
1. Call `ceoService.handleEscalation(taskId)` → diagnosis
2. Route based on diagnosis type

**`phase_completed` handler:**
1. Call `scribeService.compressContext()` for fresh context
2. Call `ceoService.planningCycle()` with phase-completion focus
3. New tasks created → push `plan_approved` event

**Step 1:** Wire all evaluation handlers.
**Step 2:** Run all tests.
**Step 3:** Commit: `feat: wire evaluation gates, post-ACCEPT consequences, and escalation into engine`

---

## Phase 5: Loop Completion + Briefing

### Task 5.1: CEO Escalation + Reply Parsing Prompts

**Files:**
- Create: `packages/engine/src/ai/prompts/ceo-escalation.ts`
- Create: `packages/engine/src/ai/prompts/ceo-reply-parsing.ts`
- Create: `packages/engine/src/ai/prompts/ceo-briefing.ts`

**Implement the three remaining CEO modes:**

`ceo-escalation.ts`: Receives task spec, worker output, judge verdict, escalation context. Produces diagnosis: `{ type: 'spec_problem'|'capability_problem'|'strategy_problem'|'foundation_problem', action, reasoning }`.

`ceo-reply-parsing.ts`: Receives raw reply text, current initiative states, pending board requests. Produces `OwnerReplyIntent` with structured actions.

`ceo-briefing.ts`: Receives Scribe context, initiative states, board requests, escalations. Produces `BriefingContent` JSON matching interface.md format.

**Step 1:** Create all 3 prompt files.
**Step 2:** Commit: `feat: add CEO escalation, reply parsing, and briefing prompts`

---

### Task 5.2: CEO Service — Remaining Modes

**Files:**
- Modify: `packages/engine/src/services/ceo.ts` — implement `handleEscalation`, `compileBriefing`, `handleOwnerReply`
- Create: `packages/engine/src/services/__tests__/ceo-escalation.test.ts`
- Create: `packages/engine/src/services/__tests__/ceo-briefing.test.ts`

**`handleEscalation(taskId)`:**
1. Read task, worker output, judge verdict from DB
2. Build escalation prompt
3. Call `invokeAgent('CEO-1', { model: 'opus', temperature: 0.5, jsonMode: true })`
4. Parse EscalationDiagnosis
5. Return diagnosis (engine routes based on type)

**`compileBriefing(orgId)`:**
1. Call `scribeService.compressContext(orgId)`
2. Read initiative states, pending board requests, escalations
3. Build briefing prompt
4. Call `invokeAgent('CEO-1', { model: 'opus', temperature: 0.5, jsonMode: true })`
5. Parse BriefingContent
6. Return content

**`handleOwnerReply(orgId, content)`:**
1. Read current initiative states, pending board requests
2. Build reply parsing prompt
3. Call `invokeAgent('CEO-1', { model: 'opus', temperature: 0.3, jsonMode: true })`
4. Parse OwnerReplyIntent
5. Return intent (engine applies state changes)

**Tests:** Mock `invokeAgent` for each mode. Verify correct prompt assembly, correct parsing.

**Step 1:** Write tests.
**Step 2:** Implement the 3 methods.
**Step 3:** Run tests, verify pass.
**Step 4:** Commit: `feat: implement CEO escalation, briefing, and reply parsing modes`

---

### Task 5.3: Briefing Delivery + AgentMail Webhook

**Files:**
- Create: `packages/engine/src/lib/agentmail.ts`
- Modify: `packages/engine/src/routes/webhooks.ts` — implement AgentMail webhook handler
- Modify: `packages/engine/src/routes/orchestration.ts` — implement `owner-reply` endpoint
- Create: `packages/engine/src/lib/__tests__/agentmail.test.ts`

**`lib/agentmail.ts`:**

```typescript
export async function sendBriefing(params: {
  to: string;
  orgName: string;
  date: string;
  htmlContent: string;
}): Promise<void> {
  // POST to AgentMail API
  // Subject: "[orgName] — Daily Briefing — [date]"
  // Body: htmlContent
}

export function briefingToHtml(content: BriefingContent): string {
  // Convert structured BriefingContent to HTML email
  // Sections: Board Requests, Exceptions, Results, Forward Look
}
```

**Webhook handler** (`routes/webhooks.ts`):
1. Parse incoming AgentMail reply JSON
2. Push `owner_reply` event to engine with content

**`owner-reply` endpoint** (`routes/orchestration.ts`):
- Same payload format as webhook — lets you test without AgentMail
- Pushes `owner_reply` event to engine

**Tests:** Verify HTML generation, verify webhook parsing.

**Step 1:** Write tests.
**Step 2:** Implement agentmail lib, webhook, and endpoint.
**Step 3:** Run tests, verify pass.
**Step 4:** Commit: `feat: add AgentMail briefing delivery and reply webhook`

---

### Task 5.4: Wire Briefing + Replies into Engine

**Files:**
- Modify: `packages/engine/src/orchestration/engine.ts` — wire remaining handlers

**`briefing_cycle` handler:**
1. Call `ceoService.compileBriefing(orgId)`
2. Call `briefingToHtml(content)`
3. Call `sendBriefing(...)` (or log if AgentMail not configured)
4. Log audit event `briefing.sent`

**`owner_reply` handler:**
1. Call `ceoService.handleOwnerReply(orgId, content)`
2. For each action in intent:
   - `approve` → `approvePlan(targetId)`, push `plan_approved` event
   - `hold` → pause initiative/task
   - `pivot` → store as input for next CEO cycle
   - `free_text` → store as owner_input
   - `clarify` → CEO adds clarification request to next briefing
3. Log audit events

**Step 1:** Wire handlers.
**Step 2:** Run all tests.
**Step 3:** Commit: `feat: wire briefing delivery and owner reply handling into engine`

---

### Task 5.5: Recovery Scan

**Files:**
- Modify: `packages/engine/src/orchestration/engine.ts` — implement `recoverFromRestart()`
- Create: `packages/engine/src/orchestration/__tests__/recovery.test.ts`

**Implementation:**

```typescript
async recoverFromRestart(): Promise<void> {
  // 1. QUEUED tasks → push plan_approved to re-dispatch
  // 2. DISPATCHED/IN_PROGRESS → check task_transitions.created_at
  //    vs configurable timeout → FAILED if stale
  // 3. REVIEW/JUDGMENT with no subsequent transition → re-invoke evaluator
  // 4. POLISH/REVISION → check if worker has resubmitted (newer transition exists)
}
```

Configurable timeout via `TASK_TIMEOUT_MS` env var (default: 10 minutes for workers).

**Tests:**
- Task in QUEUED → recovery pushes event
- Task in IN_PROGRESS within timeout → no action
- Task in IN_PROGRESS past timeout → marked FAILED
- Task in REVIEW with no verdict transition → re-queued for evaluation

**Step 1:** Write tests.
**Step 2:** Implement recovery.
**Step 3:** Run tests, verify pass.
**Step 4:** Commit: `feat: add engine recovery scan for restart resilience`

---

### Task 5.6: Engine Startup Wiring

**Files:**
- Modify: `packages/engine/src/index.ts` — initialize engine, scheduler, and run recovery on startup

**Implementation:**

```typescript
if (process.env.NODE_ENV !== 'test') {
  const engine = new OrchestrationEngine(/* services */);
  const scheduler = new Scheduler(engine, process.env.DEFAULT_ORG_ID || '');

  // Run recovery scan
  await engine.recoverFromRestart();

  // Start scheduler
  scheduler.start();

  // Start HTTP server
  serve({ fetch: app.fetch, port });
}
```

**Step 1:** Wire startup.
**Step 2:** Run `bun run --cwd packages/engine build` — must pass.
**Step 3:** Commit: `feat: wire engine startup with recovery scan and scheduler`

---

## Phase 6: Doc Updates + Final Verification

### Task 6.1: Verify Build

**Step 1:** `bun run build` — full monorepo build must pass.
**Step 2:** `bun run test` — all tests must pass.
**Step 3:** Fix any issues.
**Step 4:** Commit fixes if needed.

---

### Task 6.2: Update .env.example

**Files:**
- Modify: `.env.example`

Add all new env vars used by Sprint 2:

```
# Orchestration
DEFAULT_ORG_ID=your-org-uuid
MAX_CONCURRENT_WORKERS=3
TASK_TIMEOUT_MS=600000

# AgentMail
AGENTMAIL_API_KEY=your-agentmail-api-key
AGENTMAIL_FROM_ADDRESS=briefing@yourdomain.com
AGENTMAIL_OWNER_EMAIL=owner@example.com
```

**Step 1:** Update file.
**Step 2:** Commit: `chore: update .env.example with Sprint 2 config vars`

---

## Dependency Graph

```
Phase 0 (types + migrations)
  └── Phase 1 (infrastructure)
        ├── Task 1.1 (invokeAgent) ← all services depend on this
        ├── Task 1.2 (state machine) ← engine depends on this
        ├── Task 1.3 (dependency) ← dispatcher + engine depend on this
        ├── Task 1.4 (engine) ← everything wires into this
        ├── Task 1.5 (scheduler) ← engine startup
        ├── Task 1.6 (embeddings) ← dispatcher context assembly
        └── Task 1.7 (routes) ← endpoints
              └── Phase 2 (CEO planning)
                    ├── Task 2.1 (Scribe) ← CEO depends on this
                    ├── Task 2.2 (CEO planning)
                    ├── Task 2.3 (Advisor) ← depends on CEO plan output
                    └── Task 2.4 (wire planning)
                          └── Phase 3 (Dispatcher + Workers)
                                ├── Task 3.1 (Dispatcher)
                                ├── Task 3.2 (Worker)
                                └── Task 3.3 (wire dispatch)
                                      └── Phase 4 (Evaluation)
                                            ├── Task 4.1 (Reviewer)
                                            ├── Task 4.2 (Judge)
                                            └── Task 4.3 (wire evaluation)
                                                  └── Phase 5 (Loop completion)
                                                        ├── Task 5.1 (CEO remaining prompts)
                                                        ├── Task 5.2 (CEO remaining modes)
                                                        ├── Task 5.3 (AgentMail)
                                                        ├── Task 5.4 (wire briefing)
                                                        ├── Task 5.5 (recovery)
                                                        └── Task 5.6 (startup wiring)
                                                              └── Phase 6 (verification)
```

Tasks within each phase can be done in the listed order. Each phase is independently testable per the spec's testing strategy.
