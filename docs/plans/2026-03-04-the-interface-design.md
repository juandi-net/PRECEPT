# The Interface — Design

Replace the multi-column command center dashboard with a minimal letter-based page.

## What It Is

A single page at `/interface` with three elements:

1. **Org name + date** — header
2. **CEO letter** — the most recent `ceo` message from `ceo_chat_messages`, rendered as pre-wrapped text with markdown links parsed to `<a>` tags
3. **Input box** — textarea where the owner types naturally; POSTs to existing `/api/orchestration/ceo-chat`

No sidebar, no cards, no panels, no real-time subscriptions.

## Three States

1. **Letter waiting** — CEO has written something (briefing, response, escalation). Letter is displayed. Input box below.
2. **All clear** — No pending letter or owner already responded. Brief status line. Input box below.
3. **Owner initiates** — Owner types unprompted input. Same layout as All Clear.

## Architecture

### Frontend

**Server component** (`/interface/page.tsx`): Fetches authenticated user's org, queries most recent `ceo_chat_messages` where `role = 'ceo'`, renders letter as HTML. Parses markdown links `[text](url)` into `<a>` tags.

**Client component** (`InputBox`): `<textarea>` + Send button. POSTs to `/api/orchestration/ceo-chat` with `{ orgId, message }`. Calls `router.refresh()` after response to re-render server component.

**No component library on The Interface page.** Plain HTML + plain CSS.

### Login Page

Restyled to match The Interface: Times New Roman, centered, plain CSS. No ShadCN components (`Button`, `Input` removed). Login redirects to `/interface` instead of `/dashboard`.

### Engine Changes

1. **Briefing writes a letter**: In `handleBriefingCycle`, after `compileBriefing` returns, call `insertChatMessage(orgId, 'ceo', letterText)`. The briefing content is reformatted as a plain-text letter (not JSON) before insertion.

2. **CEO briefing prompt rewritten**: The `CEO_BRIEFING_SYSTEM_PROMPT` changes from producing JSON to producing a plain-text letter. The letter is deliverable-first: every sentence either delivers something the owner can click to inspect, or asks for something the CEO needs. No status filler. Uses standard markdown link syntax `[text](url)`.

3. **CEO chat prompt updated**: The `CEO_CHAT_SYSTEM_PROMPT` updated to produce deliverable-first responses with markdown links. Same style as briefing letters.

4. **New letter format prompt** instructs CEO:
   - Lead with deliverables and decisions, not status
   - Use markdown links for anything inspectable: `[the website code](/inspect/task/UUID)`
   - No filler like "progressing normally" or "no decisions needed today"
   - Every sentence delivers or asks

### Briefing Flow Change

Current: `compileBriefing()` returns JSON → `briefingToHtml()` → email via Resend.

New: `compileBriefing()` returns a plain-text letter string → stored in `ceo_chat_messages` → also emailed (if Resend configured). The `BriefingContent` type and `briefingToHtml` are updated accordingly.

## Data Model

No new tables. Reuses `ceo_chat_messages`:
- Latest `role = 'ceo'` message = the letter
- Owner sends via input box → `role = 'owner'` message
- CEO responds → new `role = 'ceo'` message = new letter

Sources: briefing cycle, chat response, escalation notification. All go to same table.

## Styling

```css
body {
  font-family: 'Times New Roman', Times, serif;
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem;
  color: #111;
  background: #fff;
}
```

Full CSS per spec: header with org name + date, letter with 1.125rem/1.75 line-height, textarea with matching font, dark send button. Login page uses same base styling.

## Routes

```
/              → redirect to /interface
/interface     → The Interface (letter + input box)
/login         → Login page (restyled)
/onboarding    → unchanged
/inspect/precepts → precepts viewer (moved from /precepts)
```

Inspect pages for tasks/initiatives/audit deferred to a future pass.

## What Gets Deleted

### Components
- `components/dashboard/*` (CommandCenter, InitiativeCards, BoardRequests, Exceptions, InitiativeSlideout)
- `components/audit/*` (AuditLog)
- `components/chat/*` (CeoChat)
- `components/structure/*` (OrgChart, AgentNode, AnimatedEdge)
- `components/initiative/*` (InitiativeDetail, TaskTable, TaskDetail)
- `components/layout/*` (TopBar)
- Most `components/ui/*` ShadCN components (keep only what onboarding needs)

### Routes
- `app/(dashboard)/` route group and layout
- `app/page.tsx` updated to redirect to `/interface`

### Dependencies (from packages/web/package.json)
- `@xyflow/react`
- `elkjs`
- `motion`
- Unused ShadCN deps (after pruning)

### Other
- `lib/elk-layout.ts`
- `hooks/use-realtime.ts` (no more realtime subscriptions)
- `hooks/use-mobile.tsx` (no responsive layout needed)

## What Stays

- Supabase Auth (login, middleware/proxy.ts, RLS)
- Supabase client setup (`lib/supabase/*`)
- `hooks/use-org.ts` (if needed for org context)
- Engine: all routes, orchestration, services unchanged except briefing letter write + prompt updates
- All database tables and migrations
- Onboarding page (unchanged)
- `date-fns` (date formatting in header)
