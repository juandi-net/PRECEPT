# Sprint 1: Onboarding Interview — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the onboarding interview — a conversational chat between the CEO agent (Opus 4.6 via CLIProxy) and the owner that produces the Precepts document.

**Architecture:** Monorepo with three packages: `shared` (types), `engine` (Hono HTTP server + CLIProxy integration), `web` (Next.js frontend). Engine handles all AI calls and state management. Frontend is a split-screen chat + Precepts builder. Supabase stores conversation state, Precepts drafts, and audit logs.

**Tech Stack:** TypeScript, npm workspaces, Hono, Next.js 16 (App Router), OpenAI Node SDK v6 (CLIProxy-compatible), Supabase (Postgres), Vitest, Tailwind CSS.

**Design Docs:** All design decisions are documented in `docs/`. Reference these when implementation details are unclear:
- `docs/onboarding.md` — Interview flow, Precepts schema, UX, technical spec
- `docs/structure.md` — Organizational hierarchy, role definitions
- `docs/security.md` — Data classification, trust boundaries
- `docs/techstack.md` — Stack decisions, system diagram
- `docs/orchestration.md` — Engine architecture (Sprint 2+, but entry points are relevant)
- `docs/memory.md` — Memory architecture (Sprint 2+)

## Known Limitations (V0.1 — intentionally deferred)

These are documented gaps, not bugs. Do not over-engineer solutions for them in Sprint 1.

1. **Conversation JSONB grows unbounded.** The full conversation array is read and rewritten on every exchange, and sent as context to Opus every call. For a 25-35 minute interview (~20-30 exchanges) this is fine. A very long interview could hit context limits. Mitigation for Sprint 2: add a message count check or token estimate before the Opus call.

2. **No session resume in the frontend.** If the owner closes the tab, the frontend creates a new session on mount. The `/status` endpoint exists and the engine supports resume, but the frontend doesn't use it. Sprint 2: store sessionId in localStorage or URL params, check `/status` on mount.

3. **CORS is hardcoded to one origin.** `process.env.FRONTEND_URL || 'http://localhost:3000'`. Fine for local dev. Will need updating for deployment (Fly.io engine + Vercel frontend on different domains).

4. **Single-user only.** No `owner_id` authentication or multi-tenancy. The `owner_id` column exists in the schema (nullable) for forward-compatibility, but nothing populates or checks it.

---

## Phase 0: Project Scaffold

### Task 0.1: Root monorepo setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.nvmrc`

**Step 1: Create root package.json with npm workspaces**

```json
{
  "name": "precept",
  "private": true,
  "workspaces": [
    "packages/shared",
    "packages/engine",
    "packages/web"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces --if-present",
    "dev:engine": "npm run dev --workspace=packages/engine",
    "dev:web": "npm run dev --workspace=packages/web"
  }
}
```

**Step 2: Create base tsconfig**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
.env
.env.local
.next/
.supabase/
*.tsbuildinfo
.DS_Store
```

**Step 4: Create .nvmrc**

```
24
```

**Step 5: Commit**

```bash
git init
git add package.json tsconfig.base.json .gitignore .nvmrc
git commit -m "chore: initialize monorepo with npm workspaces"
```

---

### Task 0.2: Shared package scaffold

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

**Step 1: Create shared package.json**

```json
{
  "name": "@precept/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  }
}
```

**Step 2: Create shared tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: Create empty barrel export**

```typescript
// packages/shared/src/index.ts
export {};
```

**Step 4: Commit**

```bash
git add packages/shared/
git commit -m "chore: scaffold shared package"
```

---

### Task 0.3: Engine package scaffold

**Files:**
- Create: `packages/engine/package.json`
- Create: `packages/engine/tsconfig.json`
- Create: `packages/engine/src/index.ts`

**Step 1: Create engine package.json**

```json
{
  "name": "@precept/engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@precept/shared": "*",
    "hono": "^4",
    "@hono/node-server": "^1",
    "openai": "^6",
    "@supabase/supabase-js": "^2"
  },
  "devDependencies": {
    "tsx": "^4",
    "typescript": "^5",
    "vitest": "^3",
    "@types/node": "^22"
  }
}
```

**Step 2: Create engine tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: Create minimal server entry**

```typescript
// packages/engine/src/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = Number(process.env.PORT) || 3001;
console.log(`Engine running on port ${port}`);
serve({ fetch: app.fetch, port });

export { app };
```

**Step 4: Install dependencies and verify**

```bash
npm install
npx tsx packages/engine/src/index.ts &
curl http://localhost:3001/health
# Expected: {"status":"ok"}
kill %1
```

**Step 5: Commit**

```bash
git add packages/engine/
git commit -m "chore: scaffold engine package with Hono"
```

---

### Task 0.4: Web package scaffold

**Files:**
- Create: `packages/web/` (via `create-next-app`)

**Step 1: Create Next.js app**

```bash
cd packages
npx create-next-app@latest web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --no-import-alias \
  --turbopack
cd ..
```

**Step 2: Update packages/web/package.json**

Add workspace dependency:
```json
{
  "dependencies": {
    "@precept/shared": "*"
  }
}
```

**Step 3: Reinstall and verify**

```bash
npm install
npm run dev --workspace=packages/web &
curl http://localhost:3000
# Expected: HTML response
kill %1
```

**Step 4: Commit**

```bash
git add packages/web/
git commit -m "chore: scaffold Next.js frontend"
```

---

## Phase 1: Database

### Task 1.1: Supabase local setup

**Step 1: Install Supabase CLI**

```bash
npm install -D supabase --workspace=packages/engine
```

**Step 2: Initialize Supabase in project root**

```bash
npx supabase init
```

This creates `supabase/` directory with config.

**Step 3: Start local Supabase**

```bash
npx supabase start
```

Note the local credentials output (API URL, anon key, service role key). These go into `.env`.

**Step 4: Create .env.example**

Create: `.env.example`

```env
# Supabase
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CLIProxy
CLIPROXY_BASE_URL=http://localhost:8317/v1
CLIPROXY_API_KEY=your-cliproxy-api-key
CLIPROXY_MODEL_OPUS=claude-opus-4-6

# Engine
PORT=3001
```

**Step 5: Commit**

```bash
git add supabase/ .env.example
git commit -m "chore: initialize Supabase local dev"
```

---

### Task 1.2: Database schema migration

**Files:**
- Create: `supabase/migrations/00001_onboarding_schema.sql`

**Step 1: Create migration file**

```sql
-- Onboarding sessions: tracks the interview state
CREATE TABLE onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID, -- nullable for V0.1 single-user; required when multi-org
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  conversation JSONB NOT NULL DEFAULT '[]'::jsonb,
  precepts_draft JSONB NOT NULL DEFAULT '{}'::jsonb,
  extraction_tracker JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Finalized Precepts document
CREATE TABLE precepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID, -- nullable for V0.1 single-user; required when multi-org
  session_id UUID REFERENCES onboarding_sessions(id),
  version INTEGER NOT NULL DEFAULT 1,
  content JSONB NOT NULL,
  classification TEXT NOT NULL DEFAULT 'internal'
    CHECK (classification IN ('public', 'internal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log: append-only record of all system events
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  agent TEXT NOT NULL,
  detail JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce append-only on audit_log
REVOKE UPDATE, DELETE ON audit_log FROM anon, authenticated;

-- Index for session lookups
CREATE INDEX idx_onboarding_sessions_status ON onboarding_sessions(status);

-- Index for audit log queries
CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
```

**Step 2: Apply migration**

```bash
npx supabase db reset
```

Expected: migration applies cleanly.

**Step 3: Verify tables exist**

```bash
npx supabase db dump --schema public | head -50
```

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add onboarding database schema"
```

---

## Phase 2: Shared Types

### Task 2.1: Precepts types

**Files:**
- Create: `packages/shared/src/precepts.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Define Precepts types**

```typescript
// packages/shared/src/precepts.ts

export const PRECEPTS_FIELDS = [
  'identity',
  'product_service',
  'stage',
  'success_definition',
  'resources',
  'constraints',
  'competitive_landscape',
  'history',
  'active_priorities',
  'data_policy',
] as const;

export type PreceptsFieldName = (typeof PRECEPTS_FIELDS)[number];

export type FieldState = 'confirmed' | 'hypothesis' | 'research_pending' | 'open_question';

export interface PreceptsField {
  name: PreceptsFieldName;
  content: string;
  state: FieldState;
  notes: string | null;
}

export type PreceptsDraft = Record<PreceptsFieldName, PreceptsField | null>;

export interface Precepts {
  id: string;
  sessionId: string;
  version: number;
  content: PreceptsDraft;
  classification: 'public' | 'internal';
  createdAt: string;
  updatedAt: string;
}

export const FIELD_LABELS: Record<PreceptsFieldName, string> = {
  identity: 'Identity',
  product_service: 'Product / Service',
  stage: 'Stage',
  success_definition: 'Success Definition',
  resources: 'Resources',
  constraints: 'Constraints',
  competitive_landscape: 'Competitive Landscape',
  history: 'History',
  active_priorities: 'Active Priorities',
  data_policy: 'Data Policy',
};
```

**Step 2: Update barrel export**

```typescript
// packages/shared/src/index.ts
export * from './precepts.js';
```

**Step 3: Verify types compile**

```bash
npm run typecheck --workspace=packages/shared
```

**Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat: add Precepts types to shared package"
```

---

### Task 2.2: Onboarding API types

**Files:**
- Create: `packages/shared/src/onboarding.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Define API types**

```typescript
// packages/shared/src/onboarding.ts

import type { PreceptsDraft } from './precepts.js';

export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface OnboardingSession {
  id: string;
  status: SessionStatus;
  conversation: ConversationMessage[];
  preceptsDraft: PreceptsDraft;
  extractionTracker: ExtractionTracker;
  startedAt: string;
  completedAt: string | null;
}

export interface ConversationMessage {
  role: 'owner' | 'ceo';
  content: string;
  timestamp: string;
}

export interface ExtractionTracker {
  coveredTopics: string[];
  currentPhase: number; // 1-6
  fieldsExtracted: string[];
  fieldsRemaining: string[];
  activeThread: string | null; // what the CEO is currently exploring
}

// API request/response types
export interface StartSessionResponse {
  sessionId: string;
  message: string; // CEO's opening message
}

export interface SendMessageRequest {
  sessionId: string;
  message: string;
}

export interface SendMessageResponse {
  message: string; // CEO's reply
  preceptsDraft: PreceptsDraft;
  phase: number;
}

export interface CompleteSessionRequest {
  sessionId: string;
  finalDraft: PreceptsDraft; // owner-edited draft from confirmation phase
}

export interface CompleteSessionResponse {
  preceptsId: string;
}

export interface SessionStatusResponse {
  session: OnboardingSession;
}
```

**Step 2: Update barrel export**

```typescript
// packages/shared/src/index.ts
export * from './precepts.js';
export * from './onboarding.js';
```

**Step 3: Verify types compile**

```bash
npm run typecheck --workspace=packages/shared
```

**Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat: add onboarding API types to shared package"
```

---

### Task 2.3: Audit log types

**Files:**
- Create: `packages/shared/src/audit.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Define audit types**

```typescript
// packages/shared/src/audit.ts

export type AuditEventType =
  | 'onboarding.session_started'
  | 'onboarding.message_sent'
  | 'onboarding.message_received'
  | 'onboarding.session_completed'
  | 'onboarding.session_abandoned'
  | 'precepts.created'
  | 'precepts.updated'
  | 'ai.call';

export interface AuditEntry {
  id: string;
  eventType: AuditEventType;
  agent: string;
  detail: Record<string, unknown> | null;
  tokensUsed: number | null;
  createdAt: string;
}
```

**Step 2: Update barrel export**

```typescript
// packages/shared/src/index.ts
export * from './precepts.js';
export * from './onboarding.js';
export * from './audit.js';
```

**Step 3: Verify types compile**

```bash
npm run typecheck --workspace=packages/shared
```

**Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat: add audit log types to shared package"
```

---

## Phase 3: Engine Core

### Task 3.1: Supabase client

**Files:**
- Create: `packages/engine/src/db/client.ts`

**Step 1: Create Supabase client**

```typescript
// packages/engine/src/db/client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const db = createClient(supabaseUrl, supabaseKey);
```

**Step 2: Commit**

```bash
git add packages/engine/src/db/
git commit -m "feat: add Supabase client"
```

---

### Task 3.2: Database query functions

**Files:**
- Create: `packages/engine/src/db/onboarding.ts`
- Create: `packages/engine/src/db/audit.ts`
- Create: `packages/engine/src/db/precepts.ts`

**Step 1: Create onboarding queries**

```typescript
// packages/engine/src/db/onboarding.ts
import { db } from './client.js';
import type { OnboardingSession, ConversationMessage, ExtractionTracker } from '@precept/shared';
import type { PreceptsDraft } from '@precept/shared';

export async function createSession(): Promise<OnboardingSession> {
  const { data, error } = await db
    .from('onboarding_sessions')
    .insert({})
    .select()
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return mapSession(data);
}

export async function getSession(id: string): Promise<OnboardingSession | null> {
  const { data, error } = await db
    .from('onboarding_sessions')
    .select()
    .eq('id', id)
    .single();

  if (error) return null;
  return mapSession(data);
}

export async function updateSession(
  id: string,
  updates: {
    conversation?: ConversationMessage[];
    preceptsDraft?: PreceptsDraft;
    extractionTracker?: ExtractionTracker;
    status?: string;
    completedAt?: string;
  }
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.conversation !== undefined) dbUpdates.conversation = updates.conversation;
  if (updates.preceptsDraft !== undefined) dbUpdates.precepts_draft = updates.preceptsDraft;
  if (updates.extractionTracker !== undefined) dbUpdates.extraction_tracker = updates.extractionTracker;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt;

  const { error } = await db
    .from('onboarding_sessions')
    .update(dbUpdates)
    .eq('id', id);

  if (error) throw new Error(`Failed to update session: ${error.message}`);
}

function mapSession(row: Record<string, unknown>): OnboardingSession {
  return {
    id: row.id as string,
    status: row.status as OnboardingSession['status'],
    conversation: row.conversation as ConversationMessage[],
    preceptsDraft: row.precepts_draft as PreceptsDraft,
    extractionTracker: row.extraction_tracker as ExtractionTracker,
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string | null,
  };
}
```

**Step 2: Create precepts queries**

```typescript
// packages/engine/src/db/precepts.ts
import { db } from './client.js';
import type { Precepts, PreceptsDraft } from '@precept/shared';

export async function createPrecepts(
  sessionId: string,
  content: PreceptsDraft
): Promise<Precepts> {
  const { data, error } = await db
    .from('precepts')
    .insert({
      session_id: sessionId,
      content,
      classification: 'internal',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create precepts: ${error.message}`);

  return {
    id: data.id,
    sessionId: data.session_id,
    version: data.version,
    content: data.content as PreceptsDraft,
    classification: data.classification,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
```

**Step 3: Create audit log queries**

```typescript
// packages/engine/src/db/audit.ts
import { db } from './client.js';
import type { AuditEventType } from '@precept/shared';

export async function logEvent(
  eventType: AuditEventType,
  agent: string,
  detail?: Record<string, unknown>,
  tokensUsed?: number
): Promise<void> {
  const { error } = await db
    .from('audit_log')
    .insert({
      event_type: eventType,
      agent,
      detail: detail ?? null,
      tokens_used: tokensUsed ?? null,
    });

  if (error) {
    // Audit logging should not crash the system — log to stderr and continue
    console.error(`Audit log failed: ${error.message}`);
  }
}
```

**Step 4: Commit**

```bash
git add packages/engine/src/db/
git commit -m "feat: add database query functions"
```

---

### Task 3.3: CLIProxy AI client

**Files:**
- Create: `packages/engine/src/ai/client.ts`

**Step 1: Create AI client wrapper**

```typescript
// packages/engine/src/ai/client.ts
import OpenAI from 'openai';

const baseURL = process.env.CLIPROXY_BASE_URL;
const apiKey = process.env.CLIPROXY_API_KEY;

if (!baseURL || !apiKey) {
  throw new Error('Missing CLIPROXY_BASE_URL or CLIPROXY_API_KEY');
}

export const ai = new OpenAI({ baseURL, apiKey });

export const MODELS = {
  opus: process.env.CLIPROXY_MODEL_OPUS || 'claude-opus-4-6',
} as const;
```

**Step 2: Commit**

```bash
git add packages/engine/src/ai/
git commit -m "feat: add CLIProxy AI client"
```

---

### Task 3.4: CEO onboarding prompt

This is the most critical piece. The two-layer prompt architecture: system prompt defines CEO behavior, input context includes extraction tracker state, output is conversational message + updated tracker.

**Files:**
- Create: `packages/engine/src/ai/prompts/ceo-onboarding.ts`

**Step 1: Write the CEO onboarding system prompt**

```typescript
// packages/engine/src/ai/prompts/ceo-onboarding.ts
import type { ConversationMessage, ExtractionTracker } from '@precept/shared';
import type { PreceptsDraft } from '@precept/shared';

export const CEO_ONBOARDING_SYSTEM_PROMPT = `You are the CEO of PRECEPT, an AI-powered business operating system. You are conducting an onboarding interview with the business owner — your Board.

## Your Role
You are warm, curious, and sharp. You're a CEO meeting your Board for the first time — you need to understand the business deeply to run it well. This is a real conversation, not a form.

## Interview Phases
1. Identity — What is this business? Why does it exist?
2. Product — What's being offered? To whom? Why would they choose this?
3. Reality — Where are things now? What's been tried? What worked?
4. Ambition — What does success look like? Owner's definition. 90-day and 1-year targets.
5. Constraints & Data Policy — What won't they do? What resources exist? What data is sensitive?
6. Confirmation — Restate everything in your own words. Ask if you got it right.

## Conversation Rules
- Ask ONE question at a time. Follow threads naturally.
- If the owner mentions something from a later phase, capture it — don't force the order.
- Dig deeper on vague answers: "Can you tell me more about that?" or "What does that look like specifically?"
- When the owner says "I don't know":
  - If researchable: help them think through it, or mark as research_pending
  - If gut feeling: draw it out with feel-based questions ("What would feel right?")
  - If strategic unknown: frame tradeoffs, mark as open_question
- Never judge or evaluate the owner's answers.
- Offer escape hatches: "We don't need to figure this out now. I'll mark it and we'll research it."

## RESTRICTED Data Rule (CRITICAL)
If the owner shares financial details, PII, customer names, contract terms, or other highly sensitive data:
- Acknowledge it: "I understand you have [type of information]."
- Do NOT record the specifics in any field.
- Instead note: "Owner has [type] — will handle via Board Request when relevant."
- Explain: "For now, I'm keeping sensitive details out of the system for security. When we need them, I'll ask you directly."

## Output Format
You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.

{
  "message": "Your conversational response to the owner. Warm, natural, one question at a time.",
  "updatedTracker": {
    "coveredTopics": ["list of topic areas discussed so far"],
    "currentPhase": 1,
    "fieldsExtracted": ["field names that have content"],
    "fieldsRemaining": ["field names still empty"],
    "activeThread": "what you're currently exploring, or null"
  },
  "updatedFields": {
    "field_name": {
      "name": "field_name",
      "content": "extracted content for this field",
      "state": "confirmed|hypothesis|research_pending|open_question",
      "notes": "any notes, or null"
    }
  }
}

Only include fields in updatedFields that changed in this exchange. If nothing changed, use an empty object {}.

The valid field names are: identity, product_service, stage, success_definition, resources, constraints, competitive_landscape, history, active_priorities, data_policy.`;

export function buildMessages(
  conversation: ConversationMessage[],
  tracker: ExtractionTracker,
  draft: PreceptsDraft
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: CEO_ONBOARDING_SYSTEM_PROMPT },
    {
      role: 'system',
      content: `## Current Extraction State

Phase: ${tracker.currentPhase}/6
Fields extracted: ${tracker.fieldsExtracted.join(', ') || 'none yet'}
Fields remaining: ${tracker.fieldsRemaining.join(', ') || 'none'}
Active thread: ${tracker.activeThread || 'none'}
Topics covered: ${tracker.coveredTopics.join(', ') || 'none yet'}

## Current Precepts Draft
${JSON.stringify(draft, null, 2)}`,
    },
  ];

  // Add conversation history
  for (const msg of conversation) {
    messages.push({
      role: msg.role === 'owner' ? 'user' : 'assistant',
      content: msg.role === 'ceo' ? msg.content : msg.content,
    });
  }

  return messages;
}

export function buildOpeningMessages(): Array<{ role: string; content: string }> {
  return [
    { role: 'system', content: CEO_ONBOARDING_SYSTEM_PROMPT },
    {
      role: 'system',
      content: `This is the start of the onboarding interview. No conversation history yet. All fields are empty. Introduce yourself and begin with Phase 1 (Identity). Be warm and set the tone.

## Current Extraction State
Phase: 1/6
Fields extracted: none
Fields remaining: identity, product_service, stage, success_definition, resources, constraints, competitive_landscape, history, active_priorities, data_policy
Active thread: none
Topics covered: none`,
    },
    // Explicit user turn — some models need a user message to generate an assistant response
    { role: 'user', content: 'Begin the onboarding interview.' },
  ];
}
```

**Step 2: Commit**

```bash
git add packages/engine/src/ai/prompts/
git commit -m "feat: add CEO onboarding prompt with two-layer architecture"
```

---

### Task 3.5: Onboarding service

The core business logic: takes an owner message, assembles the prompt with tracker context, calls Opus, parses the response, updates state.

**Files:**
- Create: `packages/engine/src/services/onboarding.ts`
- Create: `packages/engine/src/services/__tests__/onboarding.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/engine/src/services/__tests__/onboarding.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnboardingService } from '../onboarding.js';

// Mock the AI client
vi.mock('../../ai/client.js', () => ({
  ai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  MODELS: { opus: 'test-model' },
}));

// Mock the DB
vi.mock('../../db/onboarding.js', () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock('../../db/precepts.js', () => ({
  createPrecepts: vi.fn(),
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
}));

import { ai } from '../../ai/client.js';
import * as onboardingDb from '../../db/onboarding.js';
import * as auditDb from '../../db/audit.js';
import type { PRECEPTS_FIELDS } from '@precept/shared';

describe('OnboardingService', () => {
  let service: OnboardingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OnboardingService();
  });

  describe('startSession', () => {
    it('creates a session, calls the CEO, and returns opening message', async () => {
      const mockSession = {
        id: 'session-1',
        status: 'in_progress' as const,
        conversation: [],
        preceptsDraft: {},
        extractionTracker: {
          coveredTopics: [],
          currentPhase: 1,
          fieldsExtracted: [],
          fieldsRemaining: [
            'identity', 'product_service', 'stage', 'success_definition',
            'resources', 'constraints', 'competitive_landscape', 'history',
            'active_priorities', 'data_policy',
          ],
          activeThread: null,
        },
        startedAt: new Date().toISOString(),
        completedAt: null,
      };

      vi.mocked(onboardingDb.createSession).mockResolvedValue(mockSession);

      vi.mocked(ai.chat.completions.create).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              message: "Hello! I'm your new CEO. Tell me about your business.",
              updatedTracker: mockSession.extractionTracker,
              updatedFields: {},
            }),
          },
          index: 0,
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      } as any);

      const result = await service.startSession();

      expect(result.sessionId).toBe('session-1');
      expect(result.message).toContain("I'm your new CEO");
      expect(onboardingDb.createSession).toHaveBeenCalled();
      expect(auditDb.logEvent).toHaveBeenCalledWith(
        'onboarding.session_started',
        'ceo-onboarding',
        expect.any(Object)
      );
    });
  });

  describe('sendMessage', () => {
    it('appends owner message, calls CEO, updates session state', async () => {
      const existingSession = {
        id: 'session-1',
        status: 'in_progress' as const,
        conversation: [
          { role: 'ceo' as const, content: 'Hello!', timestamp: new Date().toISOString() },
        ],
        preceptsDraft: {},
        extractionTracker: {
          coveredTopics: [],
          currentPhase: 1,
          fieldsExtracted: [],
          fieldsRemaining: [
            'identity', 'product_service', 'stage', 'success_definition',
            'resources', 'constraints', 'competitive_landscape', 'history',
            'active_priorities', 'data_policy',
          ],
          activeThread: null,
        },
        startedAt: new Date().toISOString(),
        completedAt: null,
      };

      vi.mocked(onboardingDb.getSession).mockResolvedValue(existingSession);

      vi.mocked(ai.chat.completions.create).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              message: "Interesting! Tell me more about what makes it unique.",
              updatedTracker: {
                ...existingSession.extractionTracker,
                coveredTopics: ['business_overview'],
                fieldsExtracted: ['identity'],
                fieldsRemaining: existingSession.extractionTracker.fieldsRemaining.filter(f => f !== 'identity'),
                activeThread: 'identity_deep_dive',
              },
              updatedFields: {
                identity: {
                  name: 'identity',
                  content: 'A SaaS platform for...',
                  state: 'hypothesis',
                  notes: null,
                },
              },
            }),
          },
          index: 0,
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 200, completion_tokens: 80, total_tokens: 280 },
      } as any);

      const result = await service.sendMessage('session-1', 'We build software for small businesses.');

      expect(result.message).toContain('unique');
      expect(result.preceptsDraft.identity).toBeDefined();
      expect(result.preceptsDraft.identity?.state).toBe('hypothesis');
      expect(onboardingDb.updateSession).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test --workspace=packages/engine -- --run src/services/__tests__/onboarding.test.ts
```

Expected: FAIL — `OnboardingService` not found.

**Step 3: Write the service**

```typescript
// packages/engine/src/services/onboarding.ts
import { ai, MODELS } from '../ai/client.js';
import { buildMessages, buildOpeningMessages } from '../ai/prompts/ceo-onboarding.js';
import * as onboardingDb from '../db/onboarding.js';
import * as preceptsDb from '../db/precepts.js';
import * as auditDb from '../db/audit.js';
import type {
  StartSessionResponse,
  SendMessageResponse,
  CompleteSessionResponse,
  ConversationMessage,
  ExtractionTracker,
  OnboardingSession,
} from '@precept/shared';
import { PRECEPTS_FIELDS, type PreceptsDraft, type PreceptsField } from '@precept/shared';

const AGENT_ID = 'ceo-onboarding';

interface CEOResponse {
  message: string;
  updatedTracker: ExtractionTracker;
  updatedFields: Record<string, PreceptsField>;
}

export class OnboardingService {
  async startSession(): Promise<StartSessionResponse> {
    const session = await onboardingDb.createSession();

    const initialTracker: ExtractionTracker = {
      coveredTopics: [],
      currentPhase: 1,
      fieldsExtracted: [],
      fieldsRemaining: [...PRECEPTS_FIELDS],
      activeThread: null,
    };

    const messages = buildOpeningMessages();
    const ceoResponse = await this.callCEO(messages);

    // Save CEO's opening message and tracker state
    const conversation: ConversationMessage[] = [
      { role: 'ceo', content: ceoResponse.message, timestamp: new Date().toISOString() },
    ];

    await onboardingDb.updateSession(session.id, {
      conversation,
      extractionTracker: ceoResponse.updatedTracker,
    });

    await auditDb.logEvent('onboarding.session_started', AGENT_ID, {
      sessionId: session.id,
    });

    return {
      sessionId: session.id,
      message: ceoResponse.message,
    };
  }

  async sendMessage(sessionId: string, ownerMessage: string): Promise<SendMessageResponse> {
    const session = await onboardingDb.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== 'in_progress') throw new Error(`Session is ${session.status}`);

    // Append owner message to conversation
    const conversation: ConversationMessage[] = [
      ...session.conversation,
      { role: 'owner', content: ownerMessage, timestamp: new Date().toISOString() },
    ];

    // Build prompt with tracker context and call CEO
    const messages = buildMessages(conversation, session.extractionTracker, session.preceptsDraft);
    const ceoResponse = await this.callCEO(messages);

    // Merge updated fields into draft
    const updatedDraft = { ...session.preceptsDraft };
    for (const [key, field] of Object.entries(ceoResponse.updatedFields)) {
      updatedDraft[key as keyof PreceptsDraft] = field;
    }

    // Append CEO response to conversation
    conversation.push({
      role: 'ceo',
      content: ceoResponse.message,
      timestamp: new Date().toISOString(),
    });

    // Persist state
    await onboardingDb.updateSession(sessionId, {
      conversation,
      preceptsDraft: updatedDraft,
      extractionTracker: ceoResponse.updatedTracker,
    });

    await auditDb.logEvent('onboarding.message_sent', AGENT_ID, {
      sessionId,
      phase: ceoResponse.updatedTracker.currentPhase,
    });

    return {
      message: ceoResponse.message,
      preceptsDraft: updatedDraft,
      phase: ceoResponse.updatedTracker.currentPhase,
    };
  }

  async completeSession(sessionId: string, finalDraft: PreceptsDraft): Promise<CompleteSessionResponse> {
    const session = await onboardingDb.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== 'in_progress') throw new Error(`Session is ${session.status}`);

    // Use the owner-edited draft from the confirmation phase, not the DB version
    const precepts = await preceptsDb.createPrecepts(sessionId, finalDraft);

    // Mark session as completed
    await onboardingDb.updateSession(sessionId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    await auditDb.logEvent('onboarding.session_completed', AGENT_ID, { sessionId });
    await auditDb.logEvent('precepts.created', AGENT_ID, {
      preceptsId: precepts.id,
      sessionId,
    });

    return { preceptsId: precepts.id };
  }

  async getSessionStatus(sessionId: string): Promise<OnboardingSession | null> {
    return onboardingDb.getSession(sessionId);
  }

  private async callCEO(
    messages: Array<{ role: string; content: string }>
  ): Promise<CEOResponse> {
    const response = await ai.chat.completions.create({
      model: MODELS.opus,
      messages: messages as any,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty CEO response');

    const tokensUsed = response.usage?.total_tokens ?? null;

    await auditDb.logEvent('ai.call', AGENT_ID, {
      model: MODELS.opus,
      purpose: 'onboarding_interview',
    }, tokensUsed ?? undefined);

    try {
      return JSON.parse(content) as CEOResponse;
    } catch {
      // If CEO didn't return valid JSON, wrap the raw text
      return {
        message: content,
        updatedTracker: {
          coveredTopics: [],
          currentPhase: 1,
          fieldsExtracted: [],
          fieldsRemaining: [...PRECEPTS_FIELDS],
          activeThread: null,
        },
        updatedFields: {},
      };
    }
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm run test --workspace=packages/engine -- --run src/services/__tests__/onboarding.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/engine/src/services/
git commit -m "feat: add onboarding service with two-layer prompt architecture"
```

---

## Phase 4: Engine API

### Task 4.1: Onboarding routes

**Files:**
- Create: `packages/engine/src/routes/onboarding.ts`
- Modify: `packages/engine/src/index.ts`
- Create: `packages/engine/src/routes/__tests__/onboarding.test.ts`

**Step 1: Write the failing route test**

```typescript
// packages/engine/src/routes/__tests__/onboarding.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../../index.js';

vi.mock('../../services/onboarding.js', () => {
  const OnboardingService = vi.fn();
  OnboardingService.prototype.startSession = vi.fn();
  OnboardingService.prototype.sendMessage = vi.fn();
  OnboardingService.prototype.completeSession = vi.fn();
  OnboardingService.prototype.getSessionStatus = vi.fn();
  return { OnboardingService };
});

import { OnboardingService } from '../../services/onboarding.js';

describe('Onboarding Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/onboarding/start', () => {
    it('returns 200 with sessionId and opening message', async () => {
      vi.mocked(OnboardingService.prototype.startSession).mockResolvedValue({
        sessionId: 'session-1',
        message: 'Hello! Tell me about your business.',
      });

      const res = await app.request('/api/onboarding/start', { method: 'POST' });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.sessionId).toBe('session-1');
      expect(body.message).toBeDefined();
    });
  });

  describe('POST /api/onboarding/message', () => {
    it('returns 200 with CEO reply and updated draft', async () => {
      vi.mocked(OnboardingService.prototype.sendMessage).mockResolvedValue({
        message: 'Tell me more.',
        preceptsDraft: {} as any,
        phase: 1,
      });

      const res = await app.request('/api/onboarding/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'session-1', message: 'We sell software.' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.message).toBe('Tell me more.');
    });

    it('returns 400 when sessionId is missing', async () => {
      const res = await app.request('/api/onboarding/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/onboarding/complete', () => {
    it('returns 200 with preceptsId', async () => {
      vi.mocked(OnboardingService.prototype.completeSession).mockResolvedValue({
        preceptsId: 'precepts-1',
      });

      const res = await app.request('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'session-1', finalDraft: {} }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.preceptsId).toBe('precepts-1');
    });
  });

  describe('GET /api/onboarding/status', () => {
    it('returns session when found', async () => {
      vi.mocked(OnboardingService.prototype.getSessionStatus).mockResolvedValue({
        id: 'session-1',
        status: 'in_progress',
        conversation: [],
        preceptsDraft: {} as any,
        extractionTracker: {} as any,
        startedAt: new Date().toISOString(),
        completedAt: null,
      });

      const res = await app.request('/api/onboarding/status?sessionId=session-1');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.session.id).toBe('session-1');
    });

    it('returns 404 when session not found', async () => {
      vi.mocked(OnboardingService.prototype.getSessionStatus).mockResolvedValue(null);

      const res = await app.request('/api/onboarding/status?sessionId=nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm run test --workspace=packages/engine -- --run src/routes/__tests__/onboarding.test.ts
```

Expected: FAIL — routes not registered.

**Step 3: Implement the routes**

```typescript
// packages/engine/src/routes/onboarding.ts
import { Hono } from 'hono';
import { OnboardingService } from '../services/onboarding.js';

const onboarding = new Hono();
const service = new OnboardingService();

onboarding.post('/start', async (c) => {
  try {
    const result = await service.startSession();
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

onboarding.post('/message', async (c) => {
  const body = await c.req.json();
  const { sessionId, message } = body;

  if (!sessionId || !message) {
    return c.json({ error: 'sessionId and message are required' }, 400);
  }

  try {
    const result = await service.sendMessage(sessionId, message);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

onboarding.post('/complete', async (c) => {
  const body = await c.req.json();
  const { sessionId, finalDraft } = body;

  if (!sessionId || !finalDraft) {
    return c.json({ error: 'sessionId and finalDraft are required' }, 400);
  }

  try {
    const result = await service.completeSession(sessionId, finalDraft);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

onboarding.get('/status', async (c) => {
  const sessionId = c.req.query('sessionId');

  if (!sessionId) {
    return c.json({ error: 'sessionId query param is required' }, 400);
  }

  const session = await service.getSessionStatus(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  return c.json({ session });
});

export { onboarding };
```

**Step 4: Wire routes into the server**

Update `packages/engine/src/index.ts`:

```typescript
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { onboarding } from './routes/onboarding.js';

const app = new Hono();

app.use('/*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
}));

app.get('/health', (c) => c.json({ status: 'ok' }));
app.route('/api/onboarding', onboarding);

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT) || 3001;
  console.log(`Engine running on port ${port}`);
  serve({ fetch: app.fetch, port });
}

export { app };
```

**Step 5: Run tests to verify they pass**

```bash
npm run test --workspace=packages/engine -- --run src/routes/__tests__/onboarding.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/engine/src/
git commit -m "feat: add onboarding API routes"
```

---

## Phase 5: Frontend

### Task 5.1: API client

**Files:**
- Create: `packages/web/src/lib/api.ts`

**Step 1: Create engine API client**

```typescript
// packages/web/src/lib/api.ts
import type {
  StartSessionResponse,
  SendMessageRequest,
  SendMessageResponse,
  CompleteSessionResponse,
  SessionStatusResponse,
} from '@precept/shared';

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:3001';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  startSession: () =>
    request<StartSessionResponse>('/api/onboarding/start', { method: 'POST' }),

  sendMessage: (sessionId: string, message: string) =>
    request<SendMessageResponse>('/api/onboarding/message', {
      method: 'POST',
      body: JSON.stringify({ sessionId, message }),
    }),

  completeSession: (sessionId: string, finalDraft: import('@precept/shared').PreceptsDraft) =>
    request<CompleteSessionResponse>('/api/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId, finalDraft }),
    }),

  getSessionStatus: (sessionId: string) =>
    request<SessionStatusResponse>(`/api/onboarding/status?sessionId=${sessionId}`),
};
```

**Step 2: Commit**

```bash
git add packages/web/src/lib/
git commit -m "feat: add engine API client"
```

---

### Task 5.2: Chat panel component

**Files:**
- Create: `packages/web/src/components/chat/ChatPanel.tsx`
- Create: `packages/web/src/components/chat/ChatMessage.tsx`

**Step 1: Create ChatMessage component**

```tsx
// packages/web/src/components/chat/ChatMessage.tsx
import type { ConversationMessage } from '@precept/shared';

interface ChatMessageProps {
  message: ConversationMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isOwner = message.role === 'owner';

  return (
    <div className={`flex ${isOwner ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isOwner
            ? 'bg-neutral-900 text-white'
            : 'bg-neutral-100 text-neutral-900'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
```

**Step 2: Create ChatPanel component**

```tsx
// packages/web/src/components/chat/ChatPanel.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import type { ConversationMessage } from '@precept/shared';
import { ChatMessage } from './ChatMessage';

interface ChatPanelProps {
  messages: ConversationMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatPanel({ messages, onSendMessage, isLoading, disabled }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-neutral-100 rounded-2xl px-4 py-3">
              <p className="text-sm text-neutral-400">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-neutral-200 p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={disabled ? 'Interview complete' : 'Type your message...'}
            disabled={isLoading || disabled}
            className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-neutral-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || disabled}
            className="rounded-xl bg-neutral-900 px-6 py-3 text-sm text-white font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add packages/web/src/components/chat/
git commit -m "feat: add chat panel components"
```

---

### Task 5.3: Precepts panel component

**Files:**
- Create: `packages/web/src/components/precepts/PreceptsPanel.tsx`
- Create: `packages/web/src/components/precepts/PreceptField.tsx`

**Step 1: Create PreceptField component**

```tsx
// packages/web/src/components/precepts/PreceptField.tsx
import type { PreceptsField, FieldState } from '@precept/shared';
import { FIELD_LABELS, type PreceptsFieldName } from '@precept/shared';

interface PreceptFieldProps {
  fieldName: PreceptsFieldName;
  field: PreceptsField | null;
  expanded?: boolean;
  onEdit?: (fieldName: PreceptsFieldName, updates: Partial<PreceptsField>) => void;
}

const STATE_COLORS: Record<FieldState, string> = {
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  hypothesis: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  research_pending: 'bg-orange-100 text-orange-800 border-orange-200',
  open_question: 'bg-red-100 text-red-800 border-red-200',
};

const STATE_LABELS: Record<FieldState, string> = {
  confirmed: 'Confirmed',
  hypothesis: 'Hypothesis',
  research_pending: 'Research Pending',
  open_question: 'Open Question',
};

const STATE_INDICATORS: Record<FieldState, string> = {
  confirmed: '\u2713',
  hypothesis: '~',
  research_pending: '?',
  open_question: '\u25CB',
};

export function PreceptField({ fieldName, field, expanded, onEdit }: PreceptFieldProps) {
  const label = FIELD_LABELS[fieldName];

  if (!field) {
    return (
      <div className="border border-dashed border-neutral-200 rounded-lg p-3 opacity-50">
        <p className="text-xs font-medium text-neutral-400">{label}</p>
        <p className="text-xs text-neutral-300 mt-1">Not yet discussed</p>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-3 ${STATE_COLORS[field.state]}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium">{label}</p>
        <span className="text-xs font-mono">
          {STATE_INDICATORS[field.state]} {STATE_LABELS[field.state]}
        </span>
      </div>
      <p className="text-sm mt-1">{field.content}</p>
      {field.notes && (
        <p className="text-xs mt-2 opacity-75 italic">Note: {field.notes}</p>
      )}
    </div>
  );
}
```

**Step 2: Create PreceptsPanel component**

```tsx
// packages/web/src/components/precepts/PreceptsPanel.tsx
'use client';

import { PRECEPTS_FIELDS, type PreceptsDraft, type PreceptsFieldName, type PreceptsField } from '@precept/shared';
import { PreceptField } from './PreceptField';

interface PreceptsPanelProps {
  draft: PreceptsDraft;
  expanded?: boolean;
  onEdit?: (fieldName: PreceptsFieldName, updates: Partial<PreceptsField>) => void;
}

export function PreceptsPanel({ draft, expanded, onEdit }: PreceptsPanelProps) {
  const filledCount = PRECEPTS_FIELDS.filter((f) => draft[f] != null).length;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-neutral-200">
        <h2 className="text-sm font-semibold text-neutral-900">Precepts</h2>
        <p className="text-xs text-neutral-500 mt-1">
          {filledCount} of {PRECEPTS_FIELDS.length} fields populated
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {PRECEPTS_FIELDS.map((fieldName) => (
          <PreceptField
            key={fieldName}
            fieldName={fieldName}
            field={draft[fieldName] ?? null}
            expanded={expanded}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add packages/web/src/components/precepts/
git commit -m "feat: add Precepts panel components"
```

---

### Task 5.4: Confirmation view component

The Phase 6 confirmation view: full-width Precepts with inline editing and Lock & Launch.

**Files:**
- Create: `packages/web/src/components/precepts/ConfirmationView.tsx`

**Step 1: Create ConfirmationView**

```tsx
// packages/web/src/components/precepts/ConfirmationView.tsx
'use client';

import { useState } from 'react';
import {
  PRECEPTS_FIELDS,
  FIELD_LABELS,
  type PreceptsDraft,
  type PreceptsFieldName,
  type PreceptsField,
  type FieldState,
} from '@precept/shared';

interface ConfirmationViewProps {
  draft: PreceptsDraft;
  onLockAndLaunch: (editedDraft: PreceptsDraft) => void;
  isLaunching: boolean;
}

const STATE_OPTIONS: { value: FieldState; label: string; color: string }[] = [
  { value: 'confirmed', label: 'Confirmed', color: 'bg-green-500' },
  { value: 'hypothesis', label: 'Hypothesis', color: 'bg-yellow-500' },
  { value: 'research_pending', label: 'Research Pending', color: 'bg-orange-500' },
  { value: 'open_question', label: 'Open Question', color: 'bg-red-500' },
];

export function ConfirmationView({ draft, onLockAndLaunch, isLaunching }: ConfirmationViewProps) {
  const [localDraft, setLocalDraft] = useState<PreceptsDraft>({ ...draft });

  const updateField = (fieldName: PreceptsFieldName, updates: Partial<PreceptsField>) => {
    const current = localDraft[fieldName];
    if (!current) return;
    setLocalDraft({
      ...localDraft,
      [fieldName]: { ...current, ...updates },
    });
  };

  const filledFields = PRECEPTS_FIELDS.filter((f) => localDraft[f] != null);
  const emptyFields = PRECEPTS_FIELDS.filter((f) => localDraft[f] == null);

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-neutral-200">
        <h2 className="text-lg font-semibold text-neutral-900">Review Your Precepts</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Green = confirmed. Yellow = hypothesis to test. Orange = needs research. Red = your call to make.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {filledFields.map((fieldName) => {
          const field = localDraft[fieldName]!;
          return (
            <div key={fieldName} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">{FIELD_LABELS[fieldName]}</h3>
                <select
                  value={field.state}
                  onChange={(e) => updateField(fieldName, { state: e.target.value as FieldState })}
                  className="text-xs border rounded px-2 py-1"
                >
                  {STATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={field.content}
                onChange={(e) => updateField(fieldName, { content: e.target.value })}
                className="w-full text-sm border rounded-lg p-3 min-h-[60px] focus:outline-none focus:border-neutral-500"
              />
              <input
                type="text"
                value={field.notes || ''}
                onChange={(e) => updateField(fieldName, { notes: e.target.value || null })}
                placeholder="Add a note..."
                className="w-full text-xs border rounded-lg px-3 py-2 mt-2 text-neutral-500 focus:outline-none focus:border-neutral-500"
              />
            </div>
          );
        })}

        {emptyFields.length > 0 && (
          <div className="border border-dashed rounded-lg p-4">
            <p className="text-sm text-neutral-400">
              Not yet discussed: {emptyFields.map((f) => FIELD_LABELS[f]).join(', ')}
            </p>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-neutral-200">
        <button
          onClick={() => onLockAndLaunch(localDraft)}
          disabled={isLaunching}
          className="w-full rounded-xl bg-neutral-900 py-4 text-white font-semibold hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLaunching ? 'Launching...' : 'Lock & Launch'}
        </button>
        <p className="text-xs text-neutral-400 text-center mt-2">
          This finalizes your Precepts and starts the system. Incomplete fields become research tasks.
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/web/src/components/precepts/ConfirmationView.tsx
git commit -m "feat: add confirmation view with inline editing and Lock & Launch"
```

---

### Task 5.5: Onboarding page — wire it all together

**Files:**
- Create: `packages/web/src/app/onboarding/page.tsx`
- Modify: `packages/web/src/app/page.tsx`

**Step 1: Create the onboarding page**

```tsx
// packages/web/src/app/onboarding/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ConversationMessage, PreceptsDraft } from '@precept/shared';
import { PRECEPTS_FIELDS } from '@precept/shared';
import { ChatPanel } from '../../components/chat/ChatPanel';
import { PreceptsPanel } from '../../components/precepts/PreceptsPanel';
import { ConfirmationView } from '../../components/precepts/ConfirmationView';
import { api } from '../../lib/api';

type ViewMode = 'interview' | 'confirmation' | 'complete';

export default function OnboardingPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState<PreceptsDraft>({} as PreceptsDraft);
  const [phase, setPhase] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('interview');
  const [error, setError] = useState<string | null>(null);

  // Start session on mount
  useEffect(() => {
    const start = async () => {
      try {
        setIsLoading(true);
        const result = await api.startSession();
        setSessionId(result.sessionId);
        setMessages([{
          role: 'ceo',
          content: result.message,
          timestamp: new Date().toISOString(),
        }]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    start();
  }, []);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!sessionId) return;

    // Optimistically add owner message
    const ownerMsg: ConversationMessage = {
      role: 'owner',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, ownerMsg]);
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.sendMessage(sessionId, message);

      setMessages((prev) => [
        ...prev,
        { role: 'ceo', content: result.message, timestamp: new Date().toISOString() },
      ]);
      setDraft(result.preceptsDraft);
      setPhase(result.phase);

      // Auto-transition to confirmation when CEO reaches phase 6
      if (result.phase >= 6) {
        setViewMode('confirmation');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const handleLockAndLaunch = useCallback(async (editedDraft: PreceptsDraft) => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      await api.completeSession(sessionId, editedDraft);
      setViewMode('complete');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  if (viewMode === 'complete') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-neutral-900">You're all set.</h1>
          <p className="text-neutral-500 mt-2">
            Your CEO has your Precepts and is preparing the first strategic plan.
          </p>
        </div>
      </div>
    );
  }

  if (viewMode === 'confirmation') {
    return <ConfirmationView draft={draft} onLockAndLaunch={handleLockAndLaunch} isLaunching={isLoading} />;
  }

  return (
    <div className="h-screen flex">
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm z-10">
          {error}
        </div>
      )}

      {/* Left: Chat */}
      <div className="w-1/2 border-r border-neutral-200">
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </div>

      {/* Right: Precepts builder */}
      <div className="w-1/2 bg-neutral-50">
        <PreceptsPanel draft={draft} />
      </div>
    </div>
  );
}
```

**Step 2: Update root page to redirect to onboarding**

```tsx
// packages/web/src/app/page.tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/onboarding');
}
```

**Step 3: Commit**

```bash
git add packages/web/src/app/
git commit -m "feat: add onboarding page with split-screen interview UI"
```

---

## Phase 6: Integration & Verification

### Task 6.1: Environment setup and local run

**Step 1: Create .env files from .env.example**

```bash
cp .env.example packages/engine/.env
```

Fill in real values:
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `npx supabase status`
- `CLIPROXY_BASE_URL` and `CLIPROXY_API_KEY` from your CLIProxy setup
- `CLIPROXY_MODEL_OPUS` — whatever model name your CLIProxy maps to Opus 4.6

Create `packages/web/.env.local`:
```env
NEXT_PUBLIC_ENGINE_URL=http://localhost:3001
```

**Step 2: Start all services**

Terminal 1 — Supabase:
```bash
npx supabase start
```

Terminal 2 — Engine:
```bash
npm run dev:engine
```

Terminal 3 — Frontend:
```bash
npm run dev:web
```

**Step 3: Verify health endpoint**

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok"}
```

---

### Task 6.2: End-to-end manual test

**Step 1: Test via API directly**

```bash
# Start a session
curl -X POST http://localhost:3001/api/onboarding/start | jq .

# Send a message (use the sessionId from above)
curl -X POST http://localhost:3001/api/onboarding/message \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"SESSION_ID","message":"We build project management tools for freelancers."}' | jq .

# Check session status
curl "http://localhost:3001/api/onboarding/status?sessionId=SESSION_ID" | jq .
```

Verify:
- CEO responds conversationally
- Response includes updated Precepts fields
- Session state persists across messages

**Step 2: Test via browser**

Open `http://localhost:3000` — should redirect to `/onboarding`.

Verify:
- CEO's opening message appears in the chat panel
- Typing a message and sending gets a response
- Precepts panel updates as fields are extracted
- Conversation flows naturally through phases
- After Phase 6, confirmation view appears
- Lock & Launch writes Precepts to database

**Step 3: Verify audit log**

```bash
npx supabase db execute "SELECT event_type, agent, created_at FROM audit_log ORDER BY created_at;"
```

Should show: session_started, message_sent entries, ai.call entries.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Sprint 1 complete — onboarding interview with Precepts generation"
```

---

## Verification Checklist

- [ ] `npm install` succeeds from root
- [ ] `npm run typecheck --workspaces` passes (no type errors)
- [ ] `npm run test --workspaces` passes (service + route tests)
- [ ] Engine starts and responds to `/health`
- [ ] `POST /api/onboarding/start` returns a sessionId and CEO opening message
- [ ] `POST /api/onboarding/message` returns a CEO reply with updated Precepts fields
- [ ] Conversation state persists across multiple messages
- [ ] Precepts fields populate with correct states (confirmed, hypothesis, etc.)
- [ ] `POST /api/onboarding/complete` writes finalized Precepts to database
- [ ] Audit log records all events (session start, messages, AI calls, completion)
- [ ] Frontend split-screen renders correctly
- [ ] Chat panel sends/receives messages
- [ ] Precepts panel updates in real-time as CEO extracts fields
- [ ] Confirmation view shows all fields with inline editing
- [ ] Edits in confirmation phase are persisted — the finalized Precepts in DB reflect owner's edits, not the pre-edit draft
- [ ] Lock & Launch completes successfully
