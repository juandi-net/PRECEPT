---
date: 2026-03-01
project: precept
status: approved
---

# PRECEPT V0.1 — Onboarding

How the system gets its foundation. The onboarding interview produces the Precepts document — the CEO's persistent strategic context. Everything else depends on this document existing.

See `structure.md` for the organizational hierarchy, `orchestration.md` for the engine that runs after onboarding, `security.md` for data classification rules, `skills.md` for how onboarding seeds the skills system.

## Why Onboarding Is Sprint 1

Nothing works without the Precepts. The CEO can't plan without knowing the business. Workers can't execute without specs derived from strategy. The Judge can't evaluate without acceptance criteria rooted in business goals. Onboarding is the foundation — everything else is downstream.

## The Interview

Not a form. Not a wizard. A real dialogue between the CEO agent (Opus 4.6 via CLIProxy) and the owner. The CEO runs a dedicated onboarding system prompt — same model as strategic planning, different prompt optimized for conversational extraction.

**Target experience:** "I had a 30-minute conversation with my new CEO and now we're aligned."

**Target duration:** 25-35 minutes. Shorter = too shallow. Longer = wandered.

### Six Phases

1. **Identity** — "Tell me about this business. What is it? Why does it exist? What do you care about beyond money?"
2. **Product** — "Walk me through what you're offering. Who buys it? Why would they choose you?"
3. **Reality** — "Where are you right now? What have you tried? What worked? Honest assessment."
4. **Ambition** — "What does success look like to YOU? Not generic — your definition. What would make you say 'this is working' in 90 days?"
5. **Constraints & Data Policy** — "What won't you do? What resources do you have? What data do you consider sensitive — things that should never leave your control?"
6. **Confirmation** — "Here's what I understand." CEO restates everything in its own words. If the owner reads it and thinks "yeah, that's right" — the Precepts is solid.

Phase 6 is essential. The CEO doesn't just parrot back — it synthesizes. This is where misunderstandings surface.

### Two-Layer Prompt Architecture

The interview feels organic but systematically covers everything.

- **Layer 1 — Conversation prompt:** What the CEO says. Warm, curious, adaptive. Open-ended questions, follows threads, digs deeper based on answers. This is what the owner experiences.
- **Layer 2 — Extraction tracker:** Structured Precepts checklist maintained silently in background. Updated after each exchange. The conversation prompt has access to the tracker so it knows what's been covered, what's missing, and what to ask next — without repeating questions.

Result: If the owner mentions constraints while talking about product, the tracker notes it and the CEO skips the constraints question later. The conversation adapts to how the owner thinks, not how the schema is structured.

### Handling "I Don't Know" — Three Gap Types

The interview isn't just extraction — it's co-creation. The CEO helps the owner think through gaps.

**1. Researchable gaps** ("I don't know who my target customer is")
- CEO shifts from interviewer to strategist, walks the owner through thinking
- If still unresolved → marked as **? Research pending** in the Precepts
- Becomes the system's first worker task after Lock & Launch

**2. Inarticulate gut feelings** ("I know there's a market but can't name the pricing")
- CEO draws it out through feel-based questions: "What would feel right to charge? What feels too low?"
- Surfaces answers the owner didn't know they had

**3. Genuine strategic unknowns** ("Should I sell direct or through distributors?")
- CEO frames tradeoffs clearly but doesn't decide (board-level decision)
- May propose a small experiment to generate signal
- Marked as **○ Open question** in Precepts — CEO plans around the uncertainty

**Interview escape hatch:** If the owner is stuck or frustrated, the CEO offers to move on: "We don't need to figure this out right now. I'll mark it and we'll research it. Let's keep moving." The interview should never feel like a test.

### RESTRICTED Data Handling

V0.1 excludes RESTRICTED data from the system (see `security.md`). During the interview, an owner may naturally share financial details, PII, contract terms, or other sensitive information.

The CEO interviewer prompt includes an explicit instruction: if the owner shares RESTRICTED-level material, the CEO acknowledges it but does NOT write it into the Precepts. Instead, it records a reference: "Owner has [type of information] — will be handled via Board Request when relevant tasks arise."

The V0.1 boundary stays clean. No RESTRICTED data enters Supabase, CLIProxy, or any external service.

## The Precepts Schema

The structured document that emerges from the interview. Stored in Supabase as 🟡 INTERNAL.

### Fields

| Section | Purpose |
|---|---|
| **Identity** | What the business is, founding thesis, one-liner, values/culture |
| **Product/Service** | What's being sold, to whom, how it works |
| **Stage** | Current status (pre-revenue, MVP, fundraising, etc.) |
| **Success Definition** | Owner's words, owner's metrics — 90-day and 1-year targets |
| **Resources** | Money, time, tools, existing assets, relationships |
| **Constraints** | What's unavailable, what's off-limits, hard limits |
| **Competitive Landscape** | Who else is playing, differentiation |
| **History** | What's been tried, what worked, what didn't |
| **Active Priorities** | What the owner says matters right now |
| **Data Policy** | What the owner considers sensitive, classification guidelines, what should never enter cloud services |

The Data Policy field feeds the CEO's data classification behavior during task creation (see `security.md` — Classification Rules).

### Field States

Every field in the Precepts carries a state indicator:

| State | Meaning | CEO Behavior |
|---|---|---|
| ✓ **Confirmed** | Owner stated clearly, CEO verified | Treats as ground truth |
| ~ **Working hypothesis** | Best current thinking, subject to change | Tests through initiatives, doesn't commit heavily |
| ? **Research pending** | Gap identified, needs investigation | Generates worker research task in first planning cycle |
| ○ **Open question** | Strategic decision owner hasn't made | Plans around the uncertainty, may propose experiments to generate signal |

These states drive downstream behavior. Hypotheses get tested, not treated as gospel. Open questions trigger experiments, not commitments. Research-pending fields become the system's first work.

### Precepts Updates After Onboarding

The Precepts is a living document, but the owner is the final authority on its contents. No autonomous mutation.

**Update flow:**
1. CEO identifies a reason to update (research findings, strategy shift, new information)
2. CEO proposes the update as a Board Request to the owner
3. Owner reviews and approves, modifies, or rejects
4. If approved → Precepts updated in Supabase, change logged in audit log

**Research-pending resolution:**
1. "? Research pending" field → CEO generates worker research task in first planning cycle
2. Worker researches → output passes through Reviewer → Judge pipeline
3. Once ACCEPTED, CEO proposes a Precepts update based on findings
4. Proposal goes to owner as a Board Request
5. Owner approves → field state changes (? → ✓ or ~)

This keeps the Precepts under owner control while allowing the system to actively fill gaps.

## Front-End UX

### Layout

Split screen. Left = conversation chat. Right = Precepts building in real-time.

### During the Interview

- Fields populate on the right panel as questions are answered
- Each field shows its state indicator (✓ ~ ? ○)
- Owner can click any field to edit directly without interrupting the conversation
- When the CEO is helping work through a gap, the right panel shows the exploration in progress
- Real-time updates via Supabase realtime subscriptions — as the engine extracts fields from the conversation, the Precepts panel reflects changes immediately

### Confirmation Phase (Phase 6) UX

- Chat pauses, right panel expands to full width
- Complete Precepts visible with all field states color-coded:
  - Green = ✓ Confirmed
  - Yellow = ~ Working hypothesis
  - Orange = ? Research pending
  - Red = ○ Open question
- CEO narrates: "Green is what we're confident about. Yellow I'll test. Orange I'll research. Red is up to you to decide."
- Owner can:
  - Click any field to edit inline
  - Change field states (promote hypothesis to confirmed, etc.)
  - Add notes ("don't spend money testing this yet")
  - Flag things the CEO missed
- **"Lock & Launch" button** — ends the interview, triggers the system's first cycle

### Lock & Launch

"Lock & Launch" means the interview is concluded and the system starts running. It does NOT mean every field is complete. Incomplete fields (? Research pending, ○ Open question) are expected — they become the system's first work.

**What happens when the owner clicks Lock & Launch:**

1. Frontend POSTs to engine API endpoint (`/api/onboarding/complete`)
2. Engine writes the finalized Precepts to Supabase (classification: 🟡 INTERNAL)
3. Engine generates seed skill files from Precepts content — communication-tone from values/culture, data-classification from Data Policy, quality-baseline from quality expectations (see `skills.md` — Bootstrapping)
4. Engine triggers the first CEO planning cycle directly — this is event-driven, not cron-scheduled
4. First CEO cycle receives a simplified context: just the Precepts + owner notes from confirmation. The Scribe does not run (no activity to compress yet). Normal Scribe behavior kicks in from the second CEO invocation onward.
5. CEO produces the first weekly plan — first tasks will likely be filling research-pending gaps and identifying skill gaps ("We need a prospect-identification skill but don't have one yet")
6. Board Advisor reviews the plan
7. Owner approves → Dispatcher starts execution

The `/api/onboarding/complete` endpoint is a fourth engine entry point alongside the Scheduler, Webhook Handler, and DB Listener. It exists only for this transition — once onboarding is done, the system runs through the standard orchestration flow described in `orchestration.md`.

### Edge Cases

**Owner abandons mid-interview:**
- Conversation state and partial Precepts saved in Supabase automatically
- Owner can return later — the CEO resumes from where they left off
- The extraction tracker knows what's been covered
- No timeout — the interview waits indefinitely

**Owner wants to redo the interview:**
- Before Lock & Launch: owner can restart the conversation at any time. Previous Precepts draft is discarded.
- After Lock & Launch: owner uses the Precepts editor in the Decision Room to make changes. Major rewrites trigger a Board Request to the CEO for strategic replanning.

**Owner provides very little information:**
- The CEO adapts — shorter interview, more fields marked as ? or ○
- The system still launches. It will just spend its first cycles doing more research and asking more Board Requests.
- Minimum viable Precepts: Identity + Product/Service + Success Definition. If the owner can't articulate at least these three, the CEO flags it: "I need to understand at least what the business is, what it offers, and what success looks like to get started."

## Technical Implementation

### Conversation State

The interview conversation is managed by the engine, not called directly from the browser.

```
Owner types message in chat UI
  │
  ▼
Frontend POSTs to engine API (/api/onboarding/message)
  │
  ▼
Engine appends to conversation history in Supabase
  → Sends full conversation + extraction tracker to CEO (Opus 4.6 via CLIProxy)
  → CEO responds with:
      • Next message to owner (Layer 1 — conversation)
      • Updated extraction tracker state (Layer 2 — silent)
  │
  ▼
Engine writes:
  → CEO's message to conversation history (Supabase)
  → Updated Precepts draft fields (Supabase)
  │
  ▼
Frontend receives:
  → CEO's message (displays in chat)
  → Updated Precepts fields (displays in right panel via Supabase realtime)
```

### Data Model

```
onboarding_sessions
  id              UUID
  owner_id        UUID
  status          ENUM (in_progress, completed, abandoned)
  started_at      TIMESTAMP
  completed_at    TIMESTAMP (null until Lock & Launch)

onboarding_messages
  id              UUID
  session_id      UUID (FK → onboarding_sessions)
  role            ENUM (owner, ceo)
  content         TEXT
  created_at      TIMESTAMP

precepts_draft
  id              UUID
  session_id      UUID (FK → onboarding_sessions)
  field_name      TEXT (Identity, Product/Service, etc.)
  content         TEXT
  state           ENUM (confirmed, hypothesis, research_pending, open_question)
  owner_notes     TEXT (nullable)
  updated_at      TIMESTAMP

precepts (finalized — written on Lock & Launch)
  id              UUID
  owner_id        UUID
  version         INTEGER (starts at 1, increments on updates)
  content         JSONB (full Precepts document with field states)
  classification  ENUM (public, internal) — always 'internal' for V0.1
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
```

The `precepts_draft` table exists only during onboarding. On Lock & Launch, the draft is assembled into the finalized `precepts` JSONB record and the draft rows are archived.

### Engine Endpoints for Onboarding

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/onboarding/start` | POST | Creates a new onboarding session, returns CEO's opening message |
| `/api/onboarding/message` | POST | Sends owner message, returns CEO response + updated fields |
| `/api/onboarding/complete` | POST | Lock & Launch — finalizes Precepts, triggers first CEO cycle |
| `/api/onboarding/status` | GET | Returns current session state (for resume after abandonment) |

All endpoints authenticated via the owner's session token (see `security.md` — Frontend Security).
