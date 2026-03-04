# Sprint 3 Design — Decision Room UI

**Date:** 2026-03-04
**Status:** Approved
**Scope:** Owner's web interface to the agentic organization. Dashboard, initiative drill-down, CEO chat, live org structure visualization, audit log, and Precepts viewer.
**Depends on:** Sprint 2 (fully validated)

---

## Foundation Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auth | Supabase Auth, single user, RLS on all frontend reads | Right foundation for eventual remote hosting |
| Data fetching | Direct Supabase client for reads + real-time; Engine API for mutations | Enables real-time subscriptions without engine proxy |
| CEO Chat | Non-streaming, typing indicator | Adequate for V0.1; streaming is Sprint 4 |
| Dashboard banner | Mission statement from Precepts (static) | Quantitative North Star metric deferred |
| Board Requests | New `board_requests` table, denormalized from plans | Enables real-time subscriptions, clean response flow |
| Component library | ShadCN/ui (new-york style, already initialized) | ~12 new components added to existing 4 |
| Org visualization | React Flow (`@xyflow/react`) + ELK.js | Auto-layout hierarchical org chart |
| Animations | Motion (framer-motion successor) | Activity indicators, page transitions |
| Real-time | Supabase Realtime subscriptions | No polling |
| Hosting (V0.1) | localhost:3000 | Vercel deployment deferred |

---

## New Dependencies (packages/web)

```
@supabase/supabase-js    — frontend Supabase client + realtime
@xyflow/react            — Structure page org chart
elkjs                    — auto-layout for React Flow
motion                   — animations
date-fns                 — date formatting
```

---

## New Migrations

### `board_requests` table

```sql
CREATE TABLE board_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  plan_id UUID REFERENCES plans(id),
  content TEXT NOT NULL,
  context TEXT,
  urgency TEXT NOT NULL DEFAULT 'low',
  fallback TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'responded', 'expired')),
  owner_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);
```

### `ceo_chat_messages` table

```sql
CREATE TABLE ceo_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'ceo')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Both tables get RLS policies: authenticated user can read/write where `org_id` matches their org.

---

## Auth Setup

- One user created in Supabase Auth (owner)
- Login page at `/login` — email + password form
- Supabase session stored client-side via `@supabase/supabase-js`
- Next.js middleware protects all routes except `/login`
- RLS policies on all tables: `auth.uid() = (SELECT owner_id FROM orgs WHERE id = org_id)`
- Engine continues using `service_role` key (bypasses RLS)

---

## Pages

### 1. Dashboard (`/dashboard`) — Home

- **Mission banner** at top — from `precepts.content` → identity.mission_statement
- **Board Requests** — cards from `board_requests` where status = 'pending'. "Respond" button opens dialog, response updates `board_requests` table + pushes `owner_reply` event to engine
- **Initiative Cards** — from `initiatives` + aggregated task counts per initiative. Health color:
  - Green: all active tasks progressing, no escalations
  - Yellow: any task in rework (POLISH/REVISION), escalation pending, or behind timeline
  - Red: any task FAILED or ESCALATED with CEO diagnosis, or initiative paused/blocked
- **Exceptions** — tasks where state = 'ESCALATED' or 'FAILED'
- **Empty state**: "All initiatives executing within parameters. No decisions needed."
- Real-time: Supabase subscriptions on `board_requests`, `tasks`, `initiatives`

### 2. Initiative Drill-Down (`/dashboard/[id]`) — Working depth

- Initiative header: name, status, health dot, creation date, link to CEO planning reasoning
- Phase sections (collapsible): one per phase, completion status in header
- Task table: description, state badge, latest verdict, assigned worker
- Expandable task detail: full spec, worker output (the actual deliverable), review history (chronological reviewer/judge verdicts with reasoning), state transitions from `task_transitions`
- Real-time on `tasks` filtered by initiative_id

### 3. Structure (`/structure`) — Live org chart

- React Flow canvas with ELK.js hierarchical auto-layout
- Custom node components per role:
  - Board/Owner: gold | CEO: blue | Advisor: purple | Scribe/Curator: gray | Dispatcher: orange | Reviewer: teal | Judge: red | Workers: green
- Three visual states (Motion animations):
  - Idle: dimmed, subtle border
  - Active: bright, colored border, gentle pulse glow
  - Waiting: normal brightness, dotted border
- Animated edges: SVG dot traveling along bezier path when messages pass between roles
- Real-time driven by `audit_log` INSERT events (map event_type prefix to node activation)
- Node click: side panel with role name, model, current task, performance stats, last activity
- Dynamic worker nodes: query active task assignments, show/hide based on current dispatch

### 4. CEO Chat (`/chat`) — Direct conversation

- Standard chat layout: message list + input field
- `POST /api/orchestration/ceo-chat` — new engine endpoint
- Engine calls `ceoService.handleChatMessage(orgId, message)` with org state context
- Both owner messages and CEO responses stored in `ceo_chat_messages` table
- Typing indicator ("CEO is thinking...") during 10-30s Opus response
- Full conversation history loaded on page mount from `ceo_chat_messages` ordered by `created_at`
- Real-time subscription on `ceo_chat_messages` for new message appearance
- CEO reads recent chat messages during next planning cycle as owner input

### 5. Audit Log (`/audit`) — Deep diagnostic

- Filterable table: role dropdown, event type dropdown, date range picker, free text search
- Paginated: 50 per page, newest first, "Load more" button
- Click row to expand full event detail (payload JSONB)
- Real-time: new events appear at top via `audit_log` INSERT subscription, Motion fade-in
- Role badges use same colors as Structure page

### 6. Precepts (`/precepts`) — Read-only viewer (V0.1)

- Structured document rendering of `precepts.content` JSONB
- Sections: Identity, Product, Reality, Ambition, Constraints, Data Policy
- Field state indicators: ✓ confirmed, ~ approximate, ? unknown, ○ empty
- Server-rendered (no real-time needed)
- Editor deferred to Sprint 4

---

## Sidebar Navigation

Persistent sidebar (ShadCN Sidebar component) across all pages:

- Org name (from precepts)
- Nav links: Dashboard, Structure, CEO Chat, Audit Log, Precepts
- Active page highlighted
- Bottom section:
  - Engine connection status: green dot (Supabase realtime connected) / red dot (disconnected)
  - Time since last planning cycle (from most recent `audit_log` where event_type = 'ceo.planning_cycle')
- Collapsed on smaller screens, expanded on desktop

---

## New Engine Endpoints

| Endpoint | Method | Body | Purpose |
|---|---|---|---|
| `/api/orchestration/ceo-chat` | POST | `{ orgId, message }` | Owner message → CEO response |
| `/api/orchestration/board-requests/:id/respond` | POST | `{ orgId, response }` | Owner responds to Board Request |

All reads (initiatives, tasks, audit log, board requests, precepts, chat history) go directly to Supabase from the frontend.

---

## Engine Changes

- **CEO chat handler**: new `ceoService.handleChatMessage(orgId, message)` — invokes CEO agent with chat-specific prompt, stores both messages in `ceo_chat_messages`, returns response
- **Board Request generation**: when CEO creates board requests during planning/briefing, write to both `plans.content` JSONB and `board_requests` table
- **Board Request response**: `board-requests/:id/respond` endpoint updates `board_requests` table (status → 'responded', owner_response, responded_at) and pushes `owner_reply` event to engine

---

## Supabase Realtime Configuration

Enable realtime on:

| Table | Events | Used By |
|---|---|---|
| `tasks` | INSERT, UPDATE | Dashboard, Initiative drill-down, Structure |
| `initiatives` | INSERT, UPDATE | Dashboard |
| `audit_log` | INSERT | Audit Log, Structure (agent activity) |
| `board_requests` | INSERT, UPDATE | Dashboard |
| `ceo_chat_messages` | INSERT | CEO Chat |

---

## Deferred to Later Sprints

| Feature | When |
|---|---|
| North Star quantitative metric (value/target/trend) | When defined |
| CEO Chat streaming responses | Sprint 4 |
| Precepts Editor (inline editing) | Sprint 4 |
| Performance View (agent profiles, acceptance rates) | Sprint 4+ |
| Owner style adaptation | V2 |
| Quick Command (mobile/iMessage) | V2 |
| PWA manifest | Post-Sprint 3 |

---

## Design Principles (from `interface.md`)

1. "Is my organization healthy?" in under 10 seconds — Dashboard answers this
2. No gantt charts, no kanban, no notification firehose — conversational and document-driven
3. Every screen feels like sitting across from a competent executive
4. The Tiller Principle — ambient signals (engine status dot, empty state messaging)
5. Three depths: Surface (email briefing), Working (Decision Room), Deep (audit trail)
6. Exception-based, not activity-based — show deviations, silence means success
