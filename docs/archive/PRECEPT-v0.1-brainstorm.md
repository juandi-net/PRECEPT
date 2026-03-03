---
date: 2026-02-28
project: precept
tags:
  - brainstorm
  - asylo
  - rookie
  - ai-agents
  - architecture
---

# PRECEPT — V1 Brainstorm

## Concept

**PRECEPT** — a self-hosted agentic organization interface. An "AI CEO" holds a deep understanding of the business, generates its own priorities, decomposes initiatives into tasks, delegates to parallel worker agents, executes, and reports back to the owner (Juandi) as the board of directors.

**Key distinction from typical agent runners:** The system doesn't wait for task input. It holds a mental model of the business and reasons about what should be done next. The owner approves, redirects, or overrides — not micromanages.

**Values:** This is a God-fearing company. Agents operate under that culture at the identity level — it's not a filter, it's the foundation.

## Architecture — Three Layers

### 1. Command Layer (Owner → System)
- Web UI for task submission, review, approvals
- Email for daily briefings and async decision-making
- Future: iMessage, CLI, mobile

### 2. CEO Layer (Opus — Strategic Brain)
- Receives business context + current state each cycle
- Generates prioritized initiative list with reasoning
- Decomposes approved initiatives into executable tasks
- Assigns tasks to specialized worker agents
- Reviews worker outputs — accepts or sends back for rework
- Compiles daily briefing
- **Model:** Claude Opus 4.6 via CLIProxy + Claude Max subscription (V0.1), local equivalent later

### 3. Worker Layer (Cheaper Models — Execution)
- Specialized agents: Researcher, Coder, Writer, Analyst, Ops
- Run in parallel where tasks are independent
- Sequential where dependencies exist
- **Models:** Claude Sonnet 4.6 via CLIProxy + Claude Max subscription (V0.1), local on Mac Studio later
- Swap is just an endpoint change — same agent definitions

## The Precepts (Precepts)

The CEO's persistent context. Created during onboarding. Structured as:

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

## State & Memory Architecture

Every Opus call is a fresh context window. The system assembles a context package before each CEO cycle:

- **Precepts** — static foundation (updated only when owner changes it)
- **Activity Log** — every task executed, every output, timestamped
- **Initiative Tracker** — in progress, completed, blocked
- **Decision Log** — CEO's choices and reasoning (for consistency over time)
- **Owner Feedback History** — approvals, rejections, redirects (teaches preferences)

**Cost management:** A cheaper model compresses the activity log into a summary before Opus receives it. Only the Precepts + compressed state + current inputs hit the Opus context window.

## Onboarding Flow

The first feature. The CEO runs a structured conversation with the owner — not a form, not a wizard. A real dialogue:

- CEO introduces itself, explains what it needs to understand
- Asks questions conversationally, digs deeper based on answers
- Side panel shows the Precepts building in real-time as the conversation progresses
- At the end, owner reviews the full document, makes edits, locks it in

**Feel:** "I just had a 30-minute conversation with my new CEO and now we're aligned."

## UX Design

### Three Interaction Modes

**1. Morning Briefing (passive, daily — primary interface)**
- Email from the CEO
- What was accomplished yesterday
- What's in progress
- Decisions needed (numbered for easy reply)
- What it plans to do today pending approval
- Owner replies inline: "approved," "hold #2," "pivot #3 to X"
- System parses reply and updates state

**2. Decision Room (active, on-demand — web dashboard)**
- Active initiatives and status
- Task queue: running, queued, done
- Output gallery: actual deliverables produced
- Chat panel: talk to the CEO directly, ask reasoning questions
- **Not** a monitoring dashboard — structured like talking to your exec team

**3. Quick Command (mobile/iMessage — future)**
- "Pause all outreach"
- "Status on pitch deck?"
- Lightweight CEO input channel

### UX Principles
- Never make the owner hunt for information
- Every screen answers: "What do I need to know or decide right now?"
- If nothing needs attention, say so
- If blocked on the owner, lead with that
- Conversational and document-driven, not widget-heavy
- **No:** gantt charts, kanban with 50 cards, notification firehose, settings toggles for every behavior

## Worker Capabilities — Phased

### V1: Output-only
Workers produce documents, plans, drafts, analysis, code. Owner takes real-world action manually (copy-paste, approve).

### V2+: Full action with approval gates
Workers can send emails, post content, create repos, deploy. Each action type has an approval gate that can be loosened over time.

**Design the tool interface in V1** so integrations plug in without refactoring.

## Autonomy Level

**V1: Plan-and-confirm**
- CEO makes plans, presents to owner, owner approves, then workers execute
- Necessary to calibrate trust — see how Opus decomposes before running unsupervised

**V2+: Full auto with guardrails**
- CEO runs within defined limits
- Hard stops on: spending money, sending external comms, deploying to production
- Loosen as trust is earned

## Tech Stack

- **Frontend:** Next.js (web dashboard + onboarding UI)
- **Backend:** Node/TypeScript
- **Model routing:** CLIProxy + Claude Max (V0.1) → local inference endpoints (Mac Studio)
- **State storage:** Database (Postgres or SQLite to start) for Precepts, logs, initiatives
- **Email:** Resend or similar for daily briefings + reply parsing

## Build Order

| Sprint | What | Why |
|---|---|---|
| **1** | Onboarding interview chat + Precepts generation | Everything depends on this document existing |
| **2** | Strategic reasoning loop — Opus reads Precepts, proposes priorities | CEO needs to think before it acts |
| **3** | Worker execution layer — parallel agents via CLIProxy | Now it can do work |
| **4** | Daily email briefing + reply parsing | Primary ongoing interface |
| **5** | Decision Room dashboard | Deeper visibility when needed |

## Businesses Served

Designed as a general-purpose structure — any business slides into the same framework via its own Precepts.

**First deployment:** Asylo
**Second:** ROOKIE
**Future:** Any venture

## Hardware Roadmap

| Phase | Inference | Cost Model |
|---|---|---|
| **V0.1 (now)** | All via CLIProxy + Claude Max | $200/mo flat |
| **V2 (Mac Studio)** | Workers run locally, CEO stays on Opus API | Only pay for planning calls |
| **V3 (mature)** | Evaluate local planning models as they improve | Minimize API dependency |

## Why This Structure — Failure Modes It Solves

**Failure Mode 1: Echo chamber.** Same agent plans and evaluates → grades its own test → anchored on its own decisions → accepts mediocre output. Fix: CEO-Judge-Reviewer separation. Judge evaluates outcome (spec compliance), Reviewer evaluates craft quality. Neither has loyalty to the plan.

**Failure Mode 2: Workers making strategic decisions.** Cheap models don't have context for good strategic calls. If a Researcher finds data contradicting the Precepts strategy, it flags it — doesn't act on it. CEO-Judge decides. Hierarchy matches model capability to decision authority.

**Failure Mode 3: Owner as bottleneck.** Flat structure = every decision flows through owner. CEO layer absorbs coordination overhead. Owner makes 3-5 decisions/day, CEO makes 50, workers execute hundreds of atomic tasks with zero decisions. Scales without owner getting busier.

### Known Weaknesses + Mitigations

**Weakness 1: Single point of failure at CEO layer.**
- Bad CEO prompt = everything downstream inherits the error
- Judge catches bad worker output, but nothing catches bad CEO planning except owner review
- **Mitigation: Board Advisor** — a second Opus call that reviews the CEO's plan before execution, looking for strategic errors, missed opportunities, Precepts misalignment. Run weekly (not every cycle) to manage cost. ✓ APPROVED FOR V1

**Weakness 2: Workers can't learn from each other.**
- Military model = workers isolated. Researcher doesn't know what Writer produced. Loses serendipity.
- **Mitigation: Team Bulletin** — condensed summary of recent outputs across all workers. Each worker gets it as optional context. Not agent-to-agent chat, just ambient awareness. Low cost, high potential value. Also serves as morale/momentum signal — workers see team progress. ✓ APPROVED FOR V1

**Weakness 3: Feudal multi-business layer assumes independence.**
- Asylo learnings might inform ROOKIE strategy. Feudal structure doesn't enable that.
- **Mitigation: Board Intelligence Brief** — periodic cross-business synthesis. Each CEO gets it as supplementary context. Preserves independence, enables knowledge transfer. → V2+

### Updated Hierarchy

```
Board (Juandi) — mission, values, strategy approval, escalation decisions
  │
  ├── Board Advisor (Opus, weekly) — reviews CEO plans for strategic errors
  │
  └── CEO (Opus) — strategic planning, task decomposition, initiative management
        │
        ├── Reviewer (Opus) — craft quality evaluation (first gate, sees all worker output)
        │     Is the work well-crafted? Thorough? Clear? Professional?
        │     Verdicts: POLISH (refine) / GOOD (pass to Judge) / EXCELLENT (commend + pass to Judge)
        │     Builds performance profiles, tracks craft quality per worker per task type
        │
        ├── Judge (Opus) — adversarial outcome evaluation (second gate, sees Reviewer-approved work only)
        │     Does this achieve what was asked? Factual errors? Logical gaps? Spec compliance?
        │     Verdicts: ACCEPT / REVISE / ESCALATE
        │
        └── Dispatcher (Opus) — execution logistics, task routing, dependency management
              Receives CEO's plan, builds dependency graph, assigns tasks to workers.
              Routes based on worker performance profiles + strengths.
              Manages task chains (output → input). Tactical adaptation on failure.
              The only role that directly assigns work to workers.
              │
              └── Workers (Sonnet 4.6, parallel)
                    ├── Researcher
                    ├── Coder
                    ├── Writer
                    ├── Analyst
                    ├── Ops
                    └── [shared Team Bulletin — ambient cross-worker awareness]
```

**Evaluation flow:**
```
Worker produces output
  → Judge evaluates OUTCOME (spec compliance)
      REVISE    → back to worker with feedback (max 2x)
      ESCALATE  → to CEO (capability/spec problem)
      ACCEPT    → Reviewer evaluates QUALITY (craft)
          GOOD      → logged, move on
          POLISH    → specific feedback, worker refines (light touch)
          EXCELLENT → logged with commendation, feeds performance profile
```

Feudal wrapper (V2+): Each business gets own CEO-Judge-Reviewer + workers + Precepts. Board Advisor spans all businesses. Board Intelligence Brief enables cross-business learning.

### Board Advisor — Deep Design

**Purpose:** Stress-test the CEO's plans before execution. Separate Opus call, separate prompt optimized for critical analysis (not creative strategy).

**Advisor asks:**
- Does this plan move the needle on the 90-day success metric or is it busy work?
- Is the CEO overcommitting resources? If all tasks fail, what did we waste?
- Is there an obvious simpler move the CEO missed?
- Does the plan silently violate owner's stated constraints?
- Is the CEO repeating a pattern that hasn't worked? (requires decision log)

**Output:** Short memo, not a rewrite. Example: "Plan looks sound except: initiative #3 assumes landing page exists, which it doesn't. Recommend swap. Also 6 outreach tasks is ambitious given current response data — cut to 3, measure first."

**Flow:**
```
CEO generates weekly plan
  → Board Advisor reviews (separate Opus call)
    → Approved: CEO proceeds
    → Approved with concerns: CEO reads memo, adjusts, proceeds
    → Flagged: Plan goes to owner with Advisor's concerns attached
```

"Approved with concerns" is key — Advisor annotates, doesn't block. Only "flagged" stops the process. Prevents Advisor from becoming a bottleneck.

**Cost:** ~$0.30-0.50/week. One Opus call. Trivial vs cost of executing a bad plan for a full week.

**Skip trigger:** Don't run Advisor when CEO's plan is a continuation of already-approved strategy with no new initiatives. Only trigger on new initiatives or significant reprioritization.

### Team Bulletin — Deep Design

**What it is:** After each work cycle, a brief summary of what every worker produced. One-liner per task.

```
RECENT TEAM ACTIVITY:
- Researcher: Identified 12 robotics companies in Bay Area. 4 match ICP.
- Writer: Cold outreach email v1 drafted. Judge requested revision on value prop.
- Coder: CSV parser for prospect ingestion. Accepted.
- Analyst: Competitive pricing analysis. 3 competitors, $2k-8k/mo range.
```

**How workers use it:** Appended to worker context as background. System prompt: "Recent work by other team members. Use for context if relevant. Do not act on it — informational only."

**What it enables:** Writer sees competitor pricing, naturally incorporates it. Coder sees Researcher's data structure, builds accordingly. Workers also see team momentum — shared progress signal.

**Morale angle:** LLMs do respond to context about team progress and shared mission. Framing the Bulletin as "here's what your team accomplished" rather than just a data dump may improve worker output quality. Worth testing.

**Who generates it:** V1 = no LLM needed. Just formatted log of task titles + Judge verdicts. Future: cheap model summary if richer context helps.

**Cost:** Essentially zero. ~200-300 extra tokens per worker context.

**Long-term value:** Bulletin becomes team memory. CEO references it for planning. Workers avoid duplication. Board Advisor spots patterns ("Writer revised 3x on value prop this week — maybe Precepts value prop section needs updating, not the Writer").

### Board Requests — CEO → Owner Communication

**Problem:** The CEO will hit situations where it needs something only a human can do. The system needs a structured upward request channel.

**What only the owner can do:**
- Physical world actions (take meetings, phone calls, show up)
- Leverage relationships (introductions, favors, trust built over years)
- Legal authority (sign contracts, authorize payments, binding commitments)
- High-stakes irreversible judgment (firing a client, pivoting, saying no to money)
- Taste (which brand positioning *feels* right)
- Uncaptured context (yesterday's conversation, gut feelings, relationship dynamics)

**Board Request structure:**
- **What:** Specific action needed
- **Why:** How it connects to the current plan
- **Urgency:** When it matters by
- **Fallback:** What happens if owner can't/won't do it
- **Deliverable:** What info/outcome the CEO needs back

**How it reaches the owner:** Priority placement at top of daily briefing email. Flagged: "ACTION NEEDED FROM YOU." High urgency → future iMessage/push notification.

**How owner responds:**
- Reports outcome → CEO incorporates into next cycle
- "Can't do this today" → CEO activates fallback
- "I'm not doing this, here's why" → CEO learns owner's judgment, factors into future

**Critical constraint:** CEO prompt includes: "Board Requests are expensive. The owner has limited time. Only request human action when no agent alternative exists and the impact justifies the ask. Batch when possible." If the CEO is constantly asking for help, it signals the system isn't working — the owner should lose trust in the CEO's ability, and the Board Advisor should flag this pattern.

### Failure Handling — Three Levels

Core principle: Every interaction is data. Every failure produces a lesson artifact. The system self-learns — day 30 is fundamentally better than day 1. Data is the moat.

**Level 1: Worker Failure (task didn't produce usable output)**

Most common, least serious. Judge catches, sends back for revision (max 2x), then escalates. But repeated worker failure is a symptom. After 2 escalations on the same task type, CEO runs a **failure diagnosis** (separate Opus call):

- **Spec problem** → CEO rewrites task with clearer instructions, retries
- **Foundation problem** → CEO flags Precepts section needing update, Board Request to owner
- **Strategy problem** → CEO pauses initiative, includes in next weekly plan review
- **Capability problem** → Route to different model or flag for owner ("needs human or better model")

**Level 2: Initiative Failure (strategy didn't produce results)**

Workers executed fine but results didn't come. CEO runs a **post-mortem:**

- What was the hypothesis?
- What actually happened? (with numbers)
- Where specifically did it break? (identify the breakpoint in the funnel)
- What did we learn?
- What should we try next? (2-3 options)
- What should we NEVER repeat? (proven not to work)

Post-mortem logged in Decision Log alongside original plan. Board Advisor reads it — catches CEO if it proposes same failing strategy again.

**Level 3: Systemic Failure (business isn't progressing despite multiple initiatives)**

North star metric hasn't moved after sustained effort. Something structural is wrong. Triggers **Board Escalation** — different from a Board Request. This is a strategic conversation:

- **Situation:** North star trajectory (flat/declining)
- **Efforts:** All initiatives categorized by outcome
- **Patterns:** What worked shares X, what failed shares Y
- **Honest assessment:** "I believe the core issue is [PMF / wrong customer / insufficient resources / unclear value prop]. Here's my evidence."
- **Options:** 2-3 paths forward (pivot / double down / pause and research)
- **What I need:** Decision on direction, potentially rewritten Precepts

After this conversation, the Precepts might change. Success definition might change. System recalibrates.

### Lesson Artifact Format (stored in Decision Log)

```
LESSON: [short title]
DATE: [when]
INITIATIVE: [which one]
WHAT WE TRIED: [action taken]
WHAT HAPPENED: [actual result]
WHY IT FAILED/SUCCEEDED: [diagnosis]
WHAT WE LEARNED: [insight]
WHAT TO DO DIFFERENTLY: [specific change]
NEVER REPEAT: [proven not to work] (failures only)
REPLICATE: [what made this work] (wins only)
```

CEO reads recent lessons before every planning cycle. Board Advisor reads them during plan review. Over time = institutional knowledge that compounds. This is the self-learning loop — the system gets smarter about THIS specific business with every cycle.

## Historical Structural Analysis

Principles extracted from the most enduring organizational structures in history, mapped to agent system design.

**Jethro's Counsel (Exodus 18):** Tiered judgment — decisions at the lowest competent level. Leaders must be capable AND aligned with values (not just competent). Free leadership to do what only leadership can do.

**Early Church (Acts 6):** Don't let urgent ops crowd out leadership work. Workers can be operational AND excellent (Stephen). Cheap ≠ incompetent — best model per domain.

**Roman Legion:** Standardized structure — any org slots in. Atomic functional units (contubernium), not isolated individuals.

**Catholic Institutional Structure:** Shared doctrine as arbiter (Precepts resolves conflicts). Subsidiarity. Studied for structural longevity, not as theological model — the Catholic Church is not "the Church."

**Benedictine Rule:** Rhythmic cycles (daily/weekly/monthly). Consultative authority (Abbot consults youngest monks). Reflection before action — ora et labora.

**Mongol Empire:** Merit-based trust escalation. Communication speed is critical (Yam system).

**Quaker Meeting:** Silence before action — CEO reads state before planning, not simultaneously.

**Roman Republic / Spartan Dual Kingship:** Dual executive for strategic tension. Consider dual CEO prompts for major decisions (analytical vs values-driven).

**Guild System:** Apprentice → Journeyman → Master. Trust/autonomy based on demonstrated performance, evaluated by peers (Judge). Per-model-per-task-type, not global.

**Toyota Production System:** Jidoka — workers can pull the stop cord on quality issues. Kaizen — continuous micro-improvement from every level.

**Ottoman Devshirme:** Best model for each role regardless of provider loyalty. System is model-agnostic.

### Synthesis Table

| Principle | Source | Application |
|---|---|---|
| Tiered judgment | Exodus 18, Subsidiarity | Workers → execution, CEO → strategy, Board → mission |
| Capable AND aligned | Exodus 18 | Model selection: competence + Precepts values alignment |
| Free leadership | Acts 6 | CEO doesn't do worker tasks. Owner doesn't do CEO tasks |
| Operational excellence | Acts 6 | Best model per domain, not just cheapest |
| Standardized structure | Roman Legion | Precepts changes, structure doesn't |
| Functional units | Roman Legion | Worker pods, not isolated individuals |
| Shared doctrine | Catholic structure | Precepts resolves conflicts |
| Rhythmic cycles | Benedictines | Daily briefing, weekly plan, monthly post-mortem |
| Reflection before action | Benedictines, Quakers | CEO absorbs state THEN plans |
| Consultative authority | Benedictines | CEO reads worker signal (Bulletin) before deciding |
| Merit-based trust | Mongols, Guilds | Autonomy increases with proven performance |
| Communication speed | Mongol Yam | Bulletin + Board Requests = fast and lightweight |
| Dual executive tension | Rome, Sparta | Dual CEO prompts for major decisions (analytical vs values) |
| Stop cord | Toyota Jidoka | Workers halt and flag, not blind execution |
| Micro-improvement | Toyota Kaizen | Worker process notes, lesson artifacts |
| Model-agnostic roles | Ottoman Devshirme | Best model per role, swap underperformers |
| Self-learning | All | Data is the moat. Every interaction compounds |

## Reward, Incentive & Consequence System

LLMs don't feel ambition or fear. But prompt framing measurably affects output quality, and structural consequences create functional incentives.

**Prompt framing effects:**
- "World-class researcher trusted with critical work" → better output than "basic assistant"
- "Your output will be reviewed by an expert evaluator" → more self-checking
- "Your acceptance rate is 88% and trending upward" → more confident, precise execution
- Team Bulletin showing team progress → motivational context, not just data

**Structural rewards (for consistent performance):**
- Less oversight (Judge spot-checks instead of full review)
- More complex tasks (CEO routes harder work to proven agents)
- More context (fuller Precepts context, not just task specs)
- More autonomy (goal-based tasks instead of step-by-step instructions)

**Structural consequences (for consistent failure):**
- More oversight (every output reviewed)
- Simpler tasks (broken into smaller pieces)
- Model replacement (route task type to a different model)
- The system doesn't keep underperformers out of loyalty

**CEO-level consequences:** Frequent Board Advisor flags, failing initiatives, frequent Board Escalations → CEO prompt rewrite, model upgrade, or Precepts realignment.

### Agent Numbering & Performance Profiles

Every agent is numbered: CEO-1, Judge-1, Advisor-1, Worker-1, Worker-2, etc. When a model is swapped, the new one gets the next number (Worker-3 replaces Worker-2, doesn't inherit its number). History stays attached to the number.

```
AGENT: Worker-4 (Researcher, Sonnet 4.6)
TRUST LEVEL: Journeyman
TASKS COMPLETED: 34
ACCEPTANCE RATE: 88%
RECENT TREND: Improving (last 10: 90%)
STRENGTHS: Market research, competitor analysis
WEAKNESSES: Technical deep-dives (3 failures)
CURRENT STATUS: Active
```

Profile used in two places:
1. **CEO sees it** when assigning tasks → route to strengths, avoid weaknesses
2. **Agent sees a version** in its system prompt → "You have completed 34 tasks with 88% acceptance rate. Recent trend: improving."

CEO also sees **aggregate team performance** → informs planning: "Research capability strong, writing weak. Plan accordingly or request model upgrade for Writer role."

### Agent Self-Awareness Prompts

Each agent's system prompt includes: the full structure, their place in it, why their role exists, what they're responsible for, and what they're explicitly NOT responsible for. Prevents role drift.

(Full prompt templates in earlier section — CEO, Judge, Workers, Board Advisor)

## Defining Structural Success

Success = the sustained achievement of an organization's mission, goals, and vision. Not task throughput. Not speed. Not cost efficiency. Those are operational metrics, not success metrics.

**Mission alignment:** What % of completed initiatives directly advanced a stated goal? Busy ≠ productive.

**Goal velocity:** Are we closer to the 90-day target than last week? North star metric trajectory matters more than task count.

**Sustained operation:** Does the system improve over months? Are lesson artifacts making future performance better? Is CEO planning quality increasing cycle over cycle?

**Vision coherence:** Does 3 months of cumulative work tell a coherent narrative pointing toward the long-term vision? Or is the system thrashing between disconnected initiatives?

**Owner leverage:** Is the owner doing less operational work over time while organizational output increases? Ultimate measure: from 4 hours/day to 30 minutes reviewing briefing + 2-3 decisions.

**Structure is evaluated by results, not elegance.** Monthly structural post-mortem: "Is this structure working? Evidence? What should change?" The system should be willing to restructure itself based on results.

## Leverage Hierarchy (Where to Spend Design Energy)

80% of design effort goes into these two things. Everything else is plumbing.

### 1. CEO-Judge-Reviewer Prompt Triad (Highest Leverage)

Three Opus roles, three separate calls, three separate system prompts. Never combine planning, outcome evaluation, and quality evaluation — each creates bias in the others.

**CEO / Planning Prompt:**
- Receives: Precepts + compressed state + owner input
- Job: Assess business state vs success definition → identify highest-impact moves → decompose into tasks with acceptance criteria → assign to worker types → explain reasoning
- Key quality: Ambitious but resource-aware. Plans within compute budget. Weekly strategic cycles, phased initiative decomposition.
- Does NOT evaluate its own plans after execution

**Reviewer / Quality Evaluation Prompt (Gate 1):**
- Receives: Worker output + task spec + domain context
- Job: Evaluate craft quality. Not adversarial — quality-focused.
  - Is the work thorough for its domain? (research depth, code cleanliness, writing clarity)
  - Does it meet professional standards, not just spec minimums?
  - What specifically could improve it?
- Returns one of three verdicts:
  - **POLISH** → specific craft feedback, worker refines → back to Reviewer
  - **GOOD** → passes to Judge for outcome evaluation
  - **EXCELLENT** → logged with commendation, feeds performance profile → passes to Judge
- Builds institutional craft knowledge: tracks quality patterns per worker per task type
- Feeds performance profiles that inform Dispatcher's worker routing decisions
- Ensures the Judge only ever sees polished, quality-approved work

**Judge / Outcome Evaluation Prompt (Gate 2):**
- Receives: Reviewer-approved output + task spec + acceptance criteria
- Does NOT receive: CEO's planning rationale (intentional — prevents bias)
- Job: Find problems. Adversarial by default.
  - Does this achieve what the task spec asked for?
  - Factual errors, logical gaps, missing pieces?
  - Would this embarrass the company if sent externally?
- Returns one of three verdicts:
  - **ACCEPT** → Dispatcher notified, dispatches dependent tasks
  - **REVISE** → spec/strategic feedback sent to worker, rework goes back through Reviewer (max 2 full cycles)
  - **ESCALATE** → flagged for CEO (spec/capability/strategy problem)

**Execution flow:**
```
CEO reads state → generates phased plan → owner approves →
  Dispatcher receives plan → builds dependency graph →
    Dispatcher assigns Phase 1 tasks to workers →
      worker produces output →
        Reviewer evaluates QUALITY →
          POLISH → craft feedback, worker refines → back to Reviewer
          GOOD/EXCELLENT → passes to Judge
        Judge evaluates OUTCOME →
          REVISE → spec/strategic feedback, worker reworks → back to Reviewer
          ESCALATE → CEO diagnoses (spec/capability/strategy problem)
          ACCEPT → Dispatcher notified → dispatches dependent tasks
    Phase 1 completes → CEO decomposes Phase 2 with fresh data →
      Dispatcher receives Phase 2 → builds updated graph → cycle continues...
```

The two-gate evaluation (Judge then Reviewer) ensures both spec compliance AND craft quality. The escalation path + hard revision limit prevents infinite loops.

### 2. Precepts (Second Highest Leverage)

Structure: Hybrid prose + structured metadata. Machine-readable for the CEO prompt, human-readable for owner review.

```markdown
## Identity
name: "..."
one_liner: "..."
founding_thesis: "..."
culture: "God-fearing company. Integrity over profit. Long-term over shortcuts."
[Prose paragraph from founder — the soul of the business]

## Product
type: "..."
target_customer: "..."
value_proposition: "..."
current_state: "MVP / concept / launched / scaling"
[Prose paragraph — what this actually is and how it works]

## Success Definition
90_day_target: "..."
1_year_target: "..."
north_star_metric: "..."
owner_definition: "..."
[Prose from founder — what winning actually looks like to YOU]

## Resources
[What exists: money, time, tools, assets, relationships]

## Constraints
[What's off-limits, what's unavailable, hard limits]

## Competitive Landscape
[Who else is playing, differentiation]

## History
[What's been tried, what worked, what didn't]

## Active Priorities
[What the owner says matters right now]
```

Prose matters because the CEO prompt needs nuance. "$10k/mo revenue" is a metric. "I want Asylo to be the first name robotics companies think of for training data" is strategic intent that shapes every decision differently. The Precepts needs both.

### 3. Hierarchy Clarity (Third Highest Leverage)

Workers don't question strategy. CEO-Judge doesn't ask the board for permission on subtasks. Board only intervenes on strategy and values. This clarity prevents paralysis (too many check-ins) and runaway execution (no check-ins).

### Onboarding Interview Phases

The interview that produces the Precepts. Not a form. A real dialogue.

1. **Identity** — "Tell me about this business. What is it? Why does it exist? What do you care about beyond money?"
2. **Product** — "Walk me through what you're offering. Who buys it? Why would they choose you?"
3. **Reality** — "Where are you right now? What have you tried? What worked? Honest assessment."
4. **Ambition** — "What does success look like to YOU? Not generic — your definition. What would make you say 'this is working' in 90 days?"
5. **Constraints** — "What won't you do? What resources do you have? Budget for running this system?"
6. **Confirmation** — "Here's what I understand. [Shows Precepts.] What did I get wrong?"

Phase 6 is essential. CEO restates everything in its own words. If you read it and think "yeah, that's right" — the Precepts is solid.

### Onboarding Deep Dive

**Core principle:** The interview isn't just extraction — it's co-creation. The CEO helps the owner think through gaps, not just record answers. Leverage the model's reasoning to 100x the owner's output.

**Two-layer prompt architecture:**
- **Layer 1 — Conversation prompt:** What the CEO says. Warm, curious, adaptive. Open-ended questions, follows threads.
- **Layer 2 — Extraction tracker:** Structured Precepts checklist maintained silently in background. Updated after each exchange. Conversation prompt has access so it knows what to ask next without repeating.

Result: Interview feels organic but systematically covers everything. If you mention constraints while talking about product, it notes that and skips the constraints question later.

**Handling "I don't know" — Three Gap Types:**

1. **Researchable gaps** ("I don't know who my target customer is")
   - CEO shifts from interviewer to strategist, walks you through thinking
   - If still unresolved → marked as **research task**, assigned to worker agent as first post-onboarding initiative
   - The gap becomes the system's first job

2. **Inarticulate gut feelings** ("I know there's a market but can't name the pricing")
   - CEO draws it out through feel-based questions: "What would feel right to charge? What feels too low?"
   - Surfaces answers the owner didn't know they had

3. **Genuine strategic unknowns** ("Should I sell direct or through distributors?")
   - CEO frames tradeoffs clearly but doesn't decide (board-level decision)
   - May propose a small experiment to generate signal
   - Marked as **open question** in Precepts — CEO plans around uncertainty

**Precepts Field States:**
- ✓ **Confirmed** — Owner stated clearly, CEO verified
- ~ **Working hypothesis** — Best current thinking, subject to change
- ? **Research pending** — Gap identified, worker task assigned
- ○ **Open question** — Strategic decision owner hasn't made, CEO plans around it

These states change how the CEO prompt treats the information downstream. Hypotheses get tested, not treated as gospel. Open questions trigger experiments, not commitments.

**Interview escape hatch:** If the owner is stuck or frustrated, the CEO offers to move on: "We don't need to figure this out right now. I'll mark it and research it. Let's keep moving." Interview should never feel like a test.

**Total interview time:** 25-35 min. Shorter = too shallow. Longer = wandered.

### Onboarding Front-End UX

**Layout:** Split screen. Left = conversation chat. Right = Precepts building in real-time.

**During the interview:**
- Fields populate on the right as questions are answered
- Each field shows its state indicator (✓ ~ ? ○)
- Owner can click any field to edit directly without interrupting conversation
- When CEO is helping work through a gap, right panel shows exploration in progress

**Confirmation phase (Phase 6) UX:**
- Chat pauses, right panel expands to full width
- Complete Precepts visible with all field states color-coded
- CEO narrates: "Green = confident. Yellow = hypothesis I'll test. Orange = need to research. Red = only you can decide."
- Owner can:
  - Click any field to edit inline
  - Change field states (promote hypothesis to confirmed, etc.)
  - Add notes ("don't spend money testing this yet")
  - Flag things the CEO missed
- **"Lock & Launch" button** — ends onboarding, triggers CEO's first cycle
- First cycle tasks will likely be filling research-pending gaps

## Security Model & Data Classification

### Data Classification — Three Tiers

Every piece of data in the system is tagged with a classification level. This becomes the routing logic when local inference is available.

**🟢 PUBLIC — can go anywhere**
General knowledge, publicly available info. If a competitor saw it, wouldn't matter.
Examples: general market research, public company info, generic templates, open-source code

**🟡 INTERNAL — trusted APIs (CLIProxy → Anthropic) but not stored externally**
Org strategy, Precepts content, worker outputs, customer research. Valuable if leaked but not catastrophic.
Examples: Precepts doc, initiative plans, outreach drafts, competitive analysis, Bulletin, most worker outputs

**🔴 RESTRICTED — local processing only**
Proprietary methods, customer PII, financial data, legal docs, API keys. Real damage if exposed.
Examples: customer contracts, payment info, proprietary algorithms, credentials, personal data
- V1 (no local models): restricted data doesn't enter the system. CEO creates Board Request for owner to handle manually.
- V2 (Mac Studio): restricted tasks route to local models only.

### Classification Rules

**Who classifies:** CEO classifies tasks at creation time based on guidelines in its system prompt. Guidelines defined by owner during onboarding as part of the Precepts.
- CEO can upgrade classification (🟢 → 🟡) but CANNOT downgrade (🔴 → 🟡)
- Only the owner can set or change classification policies

**At each layer:**
- **Precepts level:** Sections classified during onboarding
- **Task level:** CEO tags each task at creation
- **Routing level:** Execution layer checks classification before processing
  - 🟢 → any model via CLIProxy
  - 🟡 → CLIProxy, strip unnecessary context from prompts
  - 🔴 → V1: block + Board Request. V2: local model only
- **Storage level:**
  - 🟢 → standard storage, standard encryption
  - 🟡 → encrypted at rest, access logged
  - 🔴 → encrypted at rest with separate key, owner auth required, never synced to cloud

**Long-term:** Classification = routing logic. When Mac Studio arrives, flip one config: 🔴 routes to local instead of blocked. 🟡 can overflow to CLIProxy/cloud when local is busy.

## Observability & Audit Log

Custom-built, not Langfuse or LangSmith. No framework dependencies. Fits PRECEPT hierarchy natively, keeps data local.

**Decision rationale:** Off-the-shelf tools don't understand CEO-1, Worker-4, Initiative-007, or data classifications. Configuring them would take as much effort as building custom. Add Langfuse later via trace IDs if waterfall visualization is needed.

**Implementation:** One function call at each orchestration step:
```typescript
await auditLog.record({
  timestamp: new Date(),
  agent: "CEO-1",
  action: "task_assigned",
  target: "Worker-4",
  taskId: "Task-052",
  initiative: "Initiative-007",
  classification: "INTERNAL",
  tokensIn: 2400,
  tokensOut: 1200,
  cost: 0.034,
  input: truncatedInput,
  output: truncatedOutput
})
```

**Storage:** Append-only table in Postgres/SQLite. Nothing edited or deleted. The audit log itself is 🔴 RESTRICTED — local only, encrypted at rest.

**What gets logged:**
- Every CEO planning decision (proposed + approved)
- Every Board Advisor review (memo + verdict)
- Every task assignment (agent, spec, context provided)
- Every worker execution (input, output, tokens, time)
- Every Judge evaluation (verdict, feedback, reasoning)
- Every Board Request and owner response
- Every Board Escalation
- Every memory extraction (role knowledge base additions)
- Every model swap (which agent replaced, why)
- Every Precepts update (what changed, who initiated)

**Access levels:**
- Board (owner): Full access to everything
- CEO: Own decisions + all worker/judge activity. Cannot see Board Advisor memos about its own performance
- Workers: Own task history only

**Query capabilities:**
- Trace any output to full chain: initiative → CEO plan → task spec → worker → Judge verdict
- Filter by agent, initiative, cost, date, classification
- Anomaly detection (future): flag unusual patterns

## CEO Worker Requisition

The CEO can request new workers but must justify it with a business case. This prevents unchecked org bloat and ensures every agent exists for a reason.

**Requisition format:**
- **Role needed:** What type of worker (new Researcher, second Coder, etc.)
- **Business case:** Why the current team can't handle this (capacity? capability gap? new domain?)
- **Expected impact:** What initiatives this unblocks or accelerates
- **Cost:** Estimated token spend per cycle for this new worker
- **Duration:** Permanent addition or temporary (for a specific initiative)

**Approval:** Board (owner) approves or denies. The CEO can't hire on its own. This mirrors real orgs — department heads propose headcount, the board approves budget.

**What this enables:** The org grows organically based on need. If the CEO keeps requesting Writers because outreach is scaling, that's signal the org is growing in a specific direction. If a request gets denied, the CEO adapts — maybe it restructures work across existing workers instead.

## Agent Memory Architecture

Three types of memory serving different purposes. This is a critical system component — without it, agents re-do work, lose accumulated knowledge, and produce contradictions.

### Type 1: Organizational Memory (already designed)
Decision Log, lesson artifacts, Team Bulletin. Shared across all agents. Answers: "What has the organization learned?"

### Type 2: Role Memory (knowledge base per role)
Cumulative domain knowledge attached to the ROLE, not the agent number. If Worker-4 (Researcher, Sonnet 4.6) is replaced by Worker-7 (Researcher, local model), Worker-7 inherits the full Researcher knowledge base. Performance profile resets, knowledge doesn't.

**Knowledge entry format:**
```
ROLE: Researcher
ENTRY: 2026-03-05
DOMAIN: Robotics market - Bay Area
FINDINGS: 12 companies identified. 4 match ICP. Top prospects:
  RoboTech, NeuralSim, BayBot, SimDrive. RoboTech most engaged.
SOURCE TASK: Task-047
CONFIDENCE: High (primary research, verified)
```

**Extraction method: Hybrid** ✓ APPROVED
- Workers self-report key findings at end of every task (cheap, fast)
- Dedicated Memory Agent cleans up, deduplicates, and structures entries in batches (specialized prompt, better quality)

**Retrieval: Semantic search, not full injection.**
Role memory grows over time — can't dump everything into every task context. At task assignment, system embeds the task description and matches against the role's knowledge base. Only relevant entries get injected.

Storage: Vector database (SQLite + embeddings for V1). Each knowledge entry embedded for semantic retrieval.

### Type 3: Task Chain Memory (project continuity)
Some tasks are part of a chain: research → prospect list → contact finding → personalized outreach. Each step needs the output of previous steps.

CEO tags tasks as a chain when creating multi-step initiatives. Execution layer automatically passes previous task output(s) as input context to the next task in the chain. CEO defines the chain, system handles context passing.

Task chain memory is project-specific and temporary. Role memory is cumulative and permanent.

### Why Memory Matters for Agents
- Workers with prior domain context produce more targeted, less redundant output
- Saves tokens/cost — no re-discovering known information
- Prevents contradictions (won't deprioritize a prospect already established as top candidate)
- Compounds over time — role knowledge bases become increasingly valuable

## Open Questions for Future Sessions

- [x] What specific models to use for each worker type → All Sonnet 4.6 via CLIProxy for V0.1
- [ ] Database schema for Precepts, activity logs, initiative tracker
- [ ] How to handle multi-business context switching (separate Preceptss, shared worker pool?)
- [ ] Reply parsing strategy for email briefings (structured format vs NLP)
- [x] Cost budget per business per month → $200/mo flat (Claude Max subscription), no per-token costs
- [x] Security model — see docs/security.md. All AI through CLIProxy → Anthropic. 🔴 data excluded from V0.1.
- [ ] How the CEO handles conflicting priorities across organizations when multi-org is live
- [x] Vector DB choice for role memory → pgvector (Supabase) + EmbeddingGemma 300M (768-dim, local ONNX via @huggingface/transformers)
- [ ] Memory Agent prompt design — how to extract, deduplicate, and structure knowledge entries
- [ ] Role memory retention policy — when to archive stale entries
- [ ] How task chain context scales when chains are long (summarization strategy)
