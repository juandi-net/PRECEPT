---
date: 2026-03-01
updated: 2026-03-06
project: precept
status: approved
---

# PRECEPT V0.1 — The Cornerstone

How the system gets its foundation. The Cornerstone is the process by which the owner lays the first stone — the Cornerstone — that every other part of the organization aligns to. Without it, nothing works. With a shallow version of it, everything that follows is misaligned.

See `passion.md` for the philosophical foundation behind why the Cornerstone matters. See `structure.md` for the organizational hierarchy, `orchestration.md` for the engine that runs after the Cornerstone is set, `security.md` for data classification rules, `skills.md` for how the Cornerstone seeds the skills system, `interface.md` for the design philosophy behind all owner interactions, `techstack.md` for implementation details.

## Why The Cornerstone Is Sprint 1

Nothing works without the Cornerstone. The CEO can't plan without knowing the business. Workers can't execute without specs derived from strategy. The Judge can't evaluate without acceptance criteria rooted in business goals. But more fundamentally — the system has no soul without The Root behind it. The Cornerstone is not just data collection. It is the translation of the owner's passion into a form the organization can act on.

Everything downstream is only as good as this document. Shallow Cornerstone = misaligned system. A Cornerstone that captures the operational plan but not The Root will direct the organization toward a cleaned-up abstraction that the owner doesn't actually care about. This is the most expensive failure mode in the system because it runs silently for weeks before becoming visible.

## The Cornerstone Session

Not a form. Not a wizard. A real dialogue between the CEO agent (Opus 4.6 via CLIProxy) and the owner. The CEO runs a dedicated Cornerstone system prompt — same model as strategic planning, different prompt optimized for Root surfacing and conversational extraction.

**Target experience:** "I had a 30-minute conversation with my new CEO and now they understand not just what I'm building — but why I couldn't not build it."

**Target duration:** 25-35 minutes. Shorter = too shallow. Longer = wandered.

### Six Phases

1. **The Root** — "Before we talk about the business, I want to understand you. What is it about this that you couldn't walk away from? Not what the market opportunity is — why you, why this, why now?" This phase is new and comes before everything else. It surfaces the owner's *Root* — the animating why. Vague answers are not a completion signal here. The CEO keeps asking until something real surfaces.

2. **Identity** — "Tell me about this business. What is it? Why does it exist beyond making money?" The mission and values emerge from The Root already surfaced.

3. **Product** — "Walk me through what you're offering. Who buys it? Why would they choose you over everything else available to them?"

4. **Reality** — "Where are you right now? What have you tried? What worked? Honest assessment."

5. **Ambition** — "What does success look like to YOU specifically? Not to an investor — your definition. What would make you say 'this was worth it' in 90 days? In a year?"

6. **Constraints & Data Policy** — "What won't you do even if it would help the numbers? What resources do you have? What data do you consider sensitive — things that should never leave your control?"

7. **Confirmation** — "Here's what I understand." CEO restates everything in its own words, starting with The Root. If the owner reads it and thinks "yeah, that's right" — and specifically if the Root section reads like a person and not a pitch deck — the Cornerstone is solid.

Phase 7 is essential. The CEO doesn't just parrot back — it synthesizes. The Root should read as the owner's real voice, not a mission statement template. If it sounds generic, the CEO goes back.

### The Completion Signal

The Cornerstone session is not complete when all fields are filled. It is complete when the **Root is visible in the document**. A Precepts with every field confirmed but a Root that reads like a LinkedIn bio is incomplete. A Precepts with several research-pending fields but a Root that reads like a person who couldn't not build this is ready to launch.

The CEO's final question before Confirmation: *"If I read your Root field to a stranger, would they understand why you personally are the one building this?"* If the answer is no — go deeper.

### Two-Layer Prompt Architecture

The session feels organic but systematically covers everything.

- **Layer 1 — Conversation prompt:** What the CEO says. Warm, curious, adaptive. Open-ended questions, follows threads, digs deeper based on answers. This is what the owner experiences.
- **Layer 2 — Extraction tracker:** Structured Precepts checklist maintained silently in background. Updated after each exchange. The conversation prompt has access to the tracker so it knows what's been covered, what's missing, and what to ask next — without repeating questions.

The tracker's primary signal is not "are all fields filled" but "is The Root real." This distinction shapes how the CEO decides when to move forward vs. keep digging.

## The Precepts Document

The Cornerstone session produces the Cornerstone — the CEO's persistent strategic context and the organization's foundational document.

### Fields

| Field | What It Captures | Completion Signal |
|---|---|---|
| `root` | Why the owner couldn't not build this. The animating passion behind the business. | Reads like a person, not a pitch |
| `mission_statement` | One punchy sentence — the business's core mission distilled | Clear enough to evaluate decisions against |
| `identity` | What the business is and why it exists | Distinct from product description |
| `product_service` | What's offered, to whom, why they'd choose it | Specific enough to generate tasks from |
| `stage` | Where the business is now, honestly | No inflation |
| `success_definition` | What winning looks like to the owner personally | Owner's words, not investor language |
| `resources` | What's available — time, money, people, relationships | Honest constraints acknowledged |
| `constraints` | What won't be compromised | Where the line is |
| `competitive_landscape` | The market context | Enough to inform strategy |
| `history` | What's been tried, what worked | Honest accounting |
| `active_priorities` | What matters most right now | Ranked, not just listed |
| `data_policy` | What data is sensitive, how it's classified | Specific enough to route decisions |

### Field States

Every field carries a confidence indicator:

- `✓` **confirmed** — owner stated clearly and directly
- `~` **hypothesis** — reasonable inference, needs testing
- `?` **research_pending** — CEO will assign a research task in the first planning cycle
- `○` **open_question** — requires owner's judgment, can't be researched away

The `root` field should almost always be `confirmed` before Lock & Launch. If it's still `?` or `○`, the session isn't done.

## The Precepts Update Flow

Precepts are not frozen at launch — they deepen as the organization learns. But the owner controls all changes.

**Update flow:**
1. CEO identifies a reason to update (research findings, strategy shift, new information)
2. CEO proposes the update as a Sign-Off to the owner
3. Owner reviews and approves, modifies, or rejects
4. If approved → Precepts updated in Supabase, change logged in audit log

**Research-pending resolution:**
1. `?` Research pending field → CEO generates worker research task in first planning cycle
2. Worker researches → output passes through Reviewer → Judge pipeline
3. Once ACCEPTED, CEO proposes a Precepts update based on findings
4. Proposal goes to owner as a Sign-Off
5. Owner approves → field state changes (`?` → `✓` or `~`)

This keeps the Cornerstone under owner control while allowing the system to actively fill gaps.

## Front-End UX

### Layout

Split screen. Left = conversation chat. Right = Precepts building in real-time.

### During The Session

- Fields populate on the right panel as the conversation surfaces them
- Each field shows its state indicator (✓ ~ ? ○)
- The `root` field appears at the top of the right panel — it is the most important field and should be visible throughout
- Owner can click any field to edit directly without interrupting the conversation
- When the CEO is helping work through a gap, the right panel shows the exploration in progress
- Real-time updates via Supabase realtime subscriptions

### Confirmation Phase UX

- Chat pauses, right panel expands to full width
- Complete Precepts visible with all field states color-coded:
  - Green = ✓ Confirmed
  - Yellow = ~ Working hypothesis
  - Orange = ? Research pending
  - Red = ○ Open question
- `root` field is displayed first, prominently
- CEO narrates: "Green is what we're confident about. Yellow I'll test. Orange I'll research. Red is up to you to decide. But most importantly — read your Root. Does it sound like you?"
- Owner can:
  - Click any field to edit inline
  - Change field states
  - Add notes
  - Flag things the CEO missed

### Lock & Launch

"Lock & Launch" means the Cornerstone session is concluded and the organization starts running. It does NOT mean every field is complete. Incomplete fields (`?` Research pending, `○` Open question) are expected — they become the system's first work.

**Minimum viable Precepts for Lock & Launch:** `root` (confirmed) + `identity` + `product_service` + `success_definition`. If The Root isn't confirmed, the CEO does not offer Lock & Launch. Everything else can be filled by the organization. The Root can only be filled by the owner.

**What happens when the owner clicks Lock & Launch:**

1. Frontend POSTs to engine API endpoint (`/api/onboarding/complete`)
2. Engine writes the finalized Cornerstone to Supabase (classification: 🟡 INTERNAL)
3. Engine generates seed skill files from Precepts content — communication-tone from values/culture, data-classification from Data Policy, quality-baseline from quality expectations (see `skills.md` — Bootstrapping)
4. Engine triggers the first CEO planning cycle directly — this is event-driven, not cron-scheduled
5. First CEO cycle receives a simplified context: just the Cornerstone + owner notes from confirmation. The Scribe does not run (no activity to compress yet). Normal Scribe behavior kicks in from the second CEO invocation onward.
6. CEO produces the first weekly plan — first tasks will typically be filling research-pending gaps and identifying skill gaps
7. Board Advisor reviews the plan
8. Owner approves → Dispatcher starts execution

The `/api/onboarding/complete` endpoint is a fourth engine entry point alongside the Scheduler, Webhook Handler, and DB Listener. It exists only for this transition — once the Cornerstone is set, the system runs through the standard orchestration flow described in `orchestration.md`.

### Edge Cases

**Owner abandons mid-session:**
- Conversation state and partial Precepts saved in Supabase automatically
- Owner can return later — the CEO resumes from where they left off
- The extraction tracker knows what's been covered
- No timeout — the session waits indefinitely

**Owner wants to redo the session:**
- Before Lock & Launch: owner can restart at any time. Previous Precepts draft is discarded.
- After Lock & Launch: owner uses the Cornerstone editor (an inspect page accessible from The Interface) to make changes. Major rewrites trigger a Sign-Off to the CEO for strategic replanning.

**Owner provides very little information:**
- The CEO adapts — but does not offer Lock & Launch without a confirmed Root
- Other fields can be sparse — the organization will fill them
- The CEO should not accept "I don't know" on the Root question. It should keep asking from different angles until something real surfaces, or explicitly name that this is the one field that must come from the owner themselves

## Technical Implementation

### Conversation State

The Cornerstone conversation is managed by the engine, not called directly from the browser.

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
  field_name      TEXT
  content         TEXT
  state           ENUM (confirmed, hypothesis, research_pending, open_question)
  owner_notes     TEXT (nullable)
  updated_at      TIMESTAMP

precepts (finalized — written on Lock & Launch)
  id              UUID
  owner_id        UUID
  version         INTEGER (starts at 1, increments on updates)
  content         JSONB (full Cornerstone with field states)
  classification  ENUM (public, internal) — always 'internal' for V0.1
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
```

### Engine Endpoints for The Cornerstone

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/onboarding/start` | POST | Creates a new Cornerstone session, returns CEO's opening message |
| `/api/onboarding/message` | POST | Sends owner message, returns CEO response + updated fields |
| `/api/onboarding/complete` | POST | Lock & Launch — finalizes Precepts, triggers first CEO cycle |
| `/api/onboarding/status` | GET | Returns current session state (for resume after abandonment) |
