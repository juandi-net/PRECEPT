---
date: 2026-03-01
project: precept
status: approved
---

# PRECEPT V1 — Interface Architecture

How a human being interacts with an agentic organization. This can make or break the whole thing.

The interface isn't a dashboard, an email template, or a notification system. It's the coupling between a person and something that has its own momentum, its own dynamics, its own will. A rider doesn't control a horse — they negotiate through a saddle. A helmsman doesn't control the ocean — they mediate between wind and water through a tiller. The interface is the medium through which human intent meets organizational behavior.

See `structure.md` for the organizational hierarchy, `orchestration.md` for the engine, `memory.md` for how the system remembers.

## Part I — Interface Primitives

Before PRECEPT is a product, it is an interface between a human and a complex system. Eight principles, drawn from the most enduring couplings between humans and things, govern how that interface must work.

### Foundational Principles

| Principle | Source | What It Means |
|---|---|---|
| Transparency | Heidegger's Zuhandenheit | The best interface disappears during skilled use |
| Bidirectional feedback | Horse and rider | Every great interface is a conversation, not a command |
| Fail-safe default | Sailing tiller (weather helm) | When the human lets go, the system degrades toward safety |
| Multiple simultaneous channels | Equestrian aids | The richest interfaces use many channels at once |
| The system has its own dynamics | Boat in water | You're negotiating with something that has momentum |
| Skill-based gradient | Musical instrument mastery | The interface becomes subtler as the human's skill increases |
| Extension and amputation | McLuhan | Every interface extends one capability while numbing another |
| Adaptation to the human | Eisenhower vs Kennedy PDB | The interface shapes itself to the user, not the reverse |

### 1. Transparency — The Interface That Disappears

Heidegger's analysis of tools in *Being and Time* identifies three modes of encountering equipment. Ready-to-hand (Zuhandenheit): the carpenter using a hammer doesn't think about the hammer — they think about the nail. The tool becomes phenomenologically transparent during skilled use. Present-at-hand (Vorhandenheit): only when the hammer breaks does it become conspicuous, an object to be studied rather than used. Un-ready-to-hand: the space between — the tool that's damaged, missing a part, or in the way.

The deepest interface principle: the best interface is one you forget exists. A pianist at mastery doesn't think about keys. A rider at mastery doesn't think about reins. Their attention moves from the proximal (the mechanism) to the distal (the music, the ride, the destination).

**PRECEPT application:** The owner should think about their business, not about PRECEPT. The system, its agents, its orchestration — all of it should be transparent during normal operation. The owner reads a briefing and thinks "my outreach is working" or "we need to pivot," not "the CEO agent generated a plan that passed the Board Advisor gate and the Dispatcher routed tasks to workers." The machinery is invisible. Only when something breaks — an escalation, a Board Request, a stalled initiative — does the interface become conspicuous. And that conspicuousness is the signal to pay attention.

Three modes of breakdown map directly:
- **Conspicuous** (damaged): an initiative is failing, results aren't coming — the system surfaces this as an exception
- **Obtrusive** (missing): the system needs something only the owner can provide — surfaced as a Board Request
- **Obstinate** (in the way): the system's behavior is blocking the owner's intent — surfaced as a Precepts misalignment that the owner corrects

The goal of interface maturity is that the owner reaches a state where PRECEPT is ready-to-hand. They think through it, not about it.

### 2. Bidirectional Feedback — The Conversation, Not the Command

The horse-rider interface is the richest analog. Seven simultaneous channels: seat, legs, hands, voice, breathing, eyes, brain. The rider sends intent through pressure. The horse responds through movement. But the horse also pushes back — through its mouth via the bit, through its back via the saddle, through its gait and rhythm. The rider who only commands and doesn't listen falls off.

Equestrian training literature calls this the "ring of aids" — a continuous feedback loop, second by second, stride by stride. The rider signals, the horse responds, the rider feels the response and adjusts. When it works, two separate beings move as a single rhythm. When it doesn't, the rider's body is in the wrong position and the communication circuit shorts out.

**PRECEPT application:** The interface cannot be one-directional command. The owner doesn't just tell the system what to do — the system tells the owner what it's seeing, what it's learning, what it needs. Every interaction is a loop:

- Owner approves a plan → system executes → system reports results → owner adjusts
- System identifies a gap → Board Request → owner responds → system incorporates
- System executes a strategy → results contradict hypothesis → system surfaces the contradiction → owner decides

The daily briefing isn't just a report. It's the horse's response — the pressure the owner feels through the tiller. And the owner's reply isn't just an approval — it's the next set of aids. The conversation is continuous, even if asynchronous. Each cycle's results inform the next cycle's direction.

The system must resist the temptation to become a vending machine. The owner puts in a coin (approval), a product comes out (results). That's command, not conversation. Real conversation means the system pushes back: "You approved this strategy, but the data suggests it's not working. Here's what I'm seeing. Here are options."

### 3. Fail-Safe Default — What Happens When You Let Go

In sailing, slight weather helm (3-5 degrees of tiller pressure toward the wind) is ideal. Not because it's efficient — a perfectly balanced helm would be more efficient. Because of what happens when the helmsman lets go. With weather helm, the boat turns into the wind, spills pressure from the sails, and stops. The unattended system degrades toward safety. With lee helm, the opposite: the boat turns away from the wind, accelerates, and risks an uncontrolled jibe. The unattended system degrades toward catastrophe.

Sailors don't want a perfectly balanced boat. They want a boat that *tells them things through the tiller* and that *fails safe when unattended*.

**PRECEPT application:** The system must degrade toward safety when the owner is absent or unresponsive. Specifically:

- **Unanswered Board Requests:** System does not proceed with assumptions. It activates the fallback plan specified in the request, or pauses the affected initiative. It does not escalate in urgency — it waits.
- **No owner interaction for N days:** CEO continues executing already-approved plans but does not start new initiatives. Autonomy contracts, not expands. The system slows down rather than speeding up.
- **Ambiguous owner input:** CEO requests clarification rather than interpreting liberally. The bias is toward inaction when the owner's intent is unclear.
- **Failed strategies:** When results contradict the plan, the system pauses and reports rather than doubling down. It presents options to the owner rather than autonomously pivoting.

The default behavioral bias is conservative. The system should never be more aggressive than the owner explicitly authorized. Like weather helm: the natural drift is toward safety, and the owner applies pressure to steer.

This also means the system should have the equivalent of tiller pressure — something the owner can feel that indicates the system's state. If the organization is running smoothly, the interface should feel light. If the organization is straining, the owner should feel resistance. If the interface always feels the same regardless of organizational health, the owner is flying blind.

### 4. Multiple Simultaneous Channels — Richness of Coupling

The rider communicates through seven channels simultaneously. No single channel carries the full message. The seat says "slow down." The legs say "but keep energy." The hands say "and bend left." All at once, all coordinated. The horse parses the composite signal. A rider using only reins is a bad rider — they're communicating through one channel when seven are available.

The WWII cockpit studies proved the inverse: when information comes through a single channel (visual-only instruments), cognitive overload causes errors. Rearranging the same information across visual, tactile, and spatial channels — same equipment, different layout — dramatically reduced pilot error. The interface was the bottleneck, not the pilot.

**PRECEPT application:** The owner interface should use multiple channels, each suited to a different kind of information:

| Channel | Modality | Best For | PRECEPT Implementation |
|---|---|---|---|
| **Morning Briefing** | Email (async, text) | Compressed state, decisions needed, progress | Daily email via AgentMail |
| **Decision Room** | Web UI (active, visual) | Deep investigation, initiative review, direct CEO conversation | Next.js dashboard |
| **Board Requests** | Structured prompts within briefing | Specific actions only the owner can take | Top of briefing, clearly marked |
| **Precepts Editor** | Direct document editing (web) | Strategic corrections, constraint changes | In Decision Room |
| **Quick Command** | Short text/message (future) | Urgent overrides, simple approvals | iMessage/mobile (V2+) |

No single channel carries the full interface. The briefing carries the daily rhythm. The Decision Room carries depth. Board Requests carry action items. The Precepts editor carries strategic corrections. Each channel is tuned to a different kind of interaction, just as the rider's seat, legs, and hands are each tuned to a different kind of communication with the horse.

The danger is channel collapse — when everything flows through one channel (e.g., all communication via email). That's like riding with only reins. The interface becomes impoverished, the owner loses dimensional awareness, and the system can't distinguish between the owner wanting to steer, slow down, or investigate.

### 5. The System Has Its Own Dynamics — Negotiation, Not Control

A boat in water has momentum. It doesn't stop when you release the tiller — it keeps moving. It responds to wind and current whether the helmsman is paying attention or not. The helmsman doesn't control the ocean. They adjust their relationship to forces that exist independently of them.

Similarly, the horse has its own will, its own fear responses, its own preferences. The rider works *with* the horse's nature, not against it. You don't force a horse into collection — you create the conditions where collection is the horse's natural response.

**PRECEPT application:** The agentic organization has dynamics that continue between owner interactions. The CEO plans. Workers execute. The Dispatcher manages dependencies. Evaluations happen. All of this runs whether the owner is watching or not.

The owner is not piloting the system moment-to-moment. They are setting conditions: approving strategies, establishing Precepts, redirecting when results diverge from expectations. Between those interactions, the system moves under its own momentum.

This means the interface must communicate not just current state but trajectory. "We're on track" is less useful than "We're on track and accelerating" or "We're on track but the trend is flattening." The owner needs to feel where the system is going, not just where it is. Like the helmsman reading the pressure building or easing on the tiller — it's the rate of change that matters.

And sometimes the right move is to do nothing. The system has momentum. A new initiative is building. The owner's job might be to leave the tiller alone and let the boat sail. The interface should make this visible: "Everything is executing within parameters. No decisions needed today."

### 6. Skill-Based Gradient — The Interface That Grows With You

A beginning rider uses large, obvious aids — strong leg pressure, wide rein movements, vocal commands. An advanced rider communicates through shifts of weight imperceptible to observers. The horse responds to subtler signals as trust builds between rider and horse. The FN (German Equestrian Federation) training progression makes this explicit: first learn balance, then learn to coordinate aids, then learn to make aids invisible.

A beginning pianist thinks about each finger. An advanced pianist thinks about phrases. A master thinks about the arc of the entire piece. The interface between human and instrument becomes subtler, richer, and more expressive with mastery — not more complex, but more economical. Less effort, more precision.

**PRECEPT application:** The interface must accommodate both the day-one owner who needs to understand everything the system is doing, and the month-six owner who just needs the exceptions.

**Day 1-30 (Onboarding and Calibration):**
- Briefings are longer, more explanatory. CEO explains its reasoning.
- Owner sees more of the machinery: "I'm assigning this task to the Researcher because..."
- More Board Requests as the system learns the owner's preferences.
- The interface is somewhat conspicuous — the owner is learning to ride.

**Day 30-90 (Building Trust):**
- Briefings compress. Reasoning is available on drill-down but not in the summary.
- Board Requests decrease as the system internalizes owner preferences from feedback history.
- The owner starts thinking about their business, not about the system.
- The interface begins to become transparent.

**Day 90+ (Ready-to-Hand):**
- Briefings are minimal unless exceptions exist. "All clear" is a valid briefing.
- The system handles routine decisions within established parameters.
- Owner intervention is strategic: redirecting, approving new initiatives, responding to Board Escalations.
- The interface is transparent. The owner thinks through the system, not about it.

This gradient isn't automatic — it's earned through demonstrated system competence and owner trust. The system doesn't assume trust; it earns it through accurate predictions, good judgment, and honest reporting of failures.

### 7. Extension and Amputation — What You Gain and What You Lose

McLuhan argued that every technology extends a human faculty while simultaneously amputating another. The wheel extends the foot but amputates direct contact with terrain. Clothing extends the skin but amputates sensation. Electric technology extends the nervous system but creates numbness through overstimulation. Freud called humans "prosthetic gods" — magnificent with our auxiliary organs, but those organs still give us trouble.

This isn't pessimism. It's physics. Every extension has a cost.

**PRECEPT application:** PRECEPT extends the owner's organizational capacity. One person can run an entire business operation — research, analysis, outreach, operations — through an agentic organization. That's the extension.

The amputation: direct contact with the work. The owner no longer writes the outreach emails, conducts the research, builds the analysis. They lose the texture, the serendipitous discoveries, the muscle memory of doing the work themselves. They gain leverage but lose intimacy.

The interface must compensate for this amputation. Specifically:

- **Output gallery in Decision Room:** The owner can see actual deliverables — not just summaries of what was produced, but the artifacts themselves. This maintains connection to the work product.
- **Lesson artifacts in briefings:** The owner receives the *learning*, not just the results. "We discovered that robotics companies respond better to specificity" keeps the owner in contact with the texture of the market.
- **Chain reasoning visibility:** When the owner drills into any decision, they can trace the full chain — CEO's reasoning, worker's output, Judge's evaluation. The machinery is transparent by default but visible on demand.
- **Periodic immersion:** The system should occasionally surface raw material — an actual prospect email, an actual research finding, an actual competitive analysis — not just the compressed summary. This is the equivalent of a CEO who sometimes walks the factory floor. It prevents the numbness McLuhan warned about.

The system must also be honest about what it amputates. If the owner used to have intuitive market feel from doing their own outreach, and now the system does outreach, the owner has lost that feel. The system should compensate by feeding market signal through the briefing in a way that maintains the owner's intuition, not just their information.

### 8. Adaptation to the Human — The Interface That Shapes Itself

The President's Daily Brief changed format for every president. Kennedy wanted a compact checklist — the PICL (pronounced "pickle"). Johnson wanted a full booklet. Bush attended in-person briefings six days a week. Obama read electronically. The content was the same intelligence. The interface adapted to how the leader processed information. Not one format was objectively better — each served the human it was designed for.

Similarly: Eisenhower ran rigorous formal NSC meetings every Thursday for eight years. Kennedy ran informal pickup-game seminars. Both were effective presidents. The organizational interface adapted to the leader's cognitive style, not the reverse.

**PRECEPT application:** The system must learn the owner's style and adapt. During onboarding and the first weeks of operation, the system should observe and calibrate:

- **Briefing density:** Does the owner read every word or scan for exceptions? Compress accordingly.
- **Decision speed:** Does the owner decide immediately or sleep on it? Adjust urgency framing.
- **Detail appetite:** Does the owner drill into the Decision Room daily or trust the briefing? Weight channels accordingly.
- **Communication style:** Does the owner reply with terse approvals or detailed redirects? Match the grain.
- **Intervention pattern:** Does the owner steer frequently or set direction and trust? Adjust Board Request frequency.

This calibration comes from the Owner Feedback History (see `memory.md`). Over time, the CEO learns the owner's judgment patterns and adapts the interface to match. The owner who replies "approved" to everything gets shorter decision sections. The owner who always asks "what's the reasoning?" gets proactive reasoning in the briefing. The owner who edits the Precepts directly gets fewer Board Requests about strategy and more about execution.

The system never locks into one interface style. Owners change. Situations change. A calm week might need minimal briefings; a crisis week needs detail. Adaptation is continuous.

## Part II — Leadership Interface Patterns

The primitives above apply to any interface between a human and a complex system. The patterns below apply specifically to the case PRECEPT implements: a leader interfacing with an organization.

### Historical Patterns

| Pattern | Source | Period | PRECEPT Application |
|---|---|---|---|
| Compressed intelligence delivery | President's Daily Brief | 1946–present | Scribe → CEO → daily briefing to owner |
| Exception-based action routing | British Red Box | 1560s–present | Board Requests at top of briefing, only items requiring owner action |
| Orient before Decide | Boyd's OODA Loop | 1970s | CEO assembles context and presents decision points with framing, not raw data |
| Forced compression | Military Two-Minute Drill | US Army doctrine | Briefing answers "what changed, what broke, what needs a decision" in minimal space |
| Deviation-only escalation | Management by Exception (Taylor) | 1903 | Owner sees deviations from plan, not status updates on routine execution |
| Advisory filtering | Privy Council | 13th century–present | CEO handles routine; owner consulted only on what requires owner judgment |
| Three rights of governance | Bagehot's Constitutional Theory | 1867 | Owner's rights: to be consulted, to encourage, to warn. Not to execute. |

### The President's Daily Brief — Compressed Intelligence

The closest historical analog to PRECEPT's daily briefing. Since 1946, the US intelligence community has compressed the output of multiple agencies into a document the President can absorb in minutes. The PDB has been called "the world's most highly classified daily newspaper" — smallest circulation, highest classification, best informed.

The critical lesson isn't the content — it's the compression ratio. Thousands of intelligence analysts, dozens of agencies, global collection systems → a few pages. The President doesn't want raw intelligence. They want the meaning of the intelligence, the implications, and the decision points.

**Applied in PRECEPT:** The Scribe performs the PDB function. It compresses the raw audit log, initiative state, performance data, and lesson artifacts into a context package the CEO can process. The CEO then compresses further into the owner's daily briefing. Two stages of compression: raw activity → CEO context → owner briefing. Each stage loses detail and gains meaning.

### The British Red Box — Exception-Based Action

Every day except Christmas and Easter, a red leather dispatch box arrives for the British sovereign containing papers requiring attention. Documents requiring signature are clearly marked. The monarch reads, signs, returns. Walter Bagehot defined the monarch's constitutional role as three rights: the right to be consulted, the right to encourage, the right to warn.

The Red Box doesn't deliver everything the government does. It delivers what requires the monarch's specific attention. Everything else proceeds without royal involvement.

**Applied in PRECEPT:** The daily briefing is the Red Box. Board Requests are the documents requiring signature. The briefing clearly marks what needs owner action versus what is information-only. The owner's role mirrors Bagehot's three rights:

- **To be consulted:** The system presents plans before executing them. The owner sees the weekly plan before the Dispatcher starts work.
- **To encourage:** The owner approves, adjusts, and provides direction. "Approved." "Hold #2." "Pivot #3 to X."
- **To warn:** The owner can flag risks the system hasn't seen, correct Precepts misalignment, and veto strategies. "Don't spend money testing this yet."

### Boyd's OODA Loop — Orient Before Decide

John Boyd's OODA loop (Observe → Orient → Decide → Act) is often misread as being about speed. Boyd's actual insight was that Orient is the critical phase. Orientation — making sense of observations through the lens of culture, experience, and analysis — determines whether decisions are good. A fast bad decision is worse than a slightly slower good one.

The interface's job isn't to show the owner raw data (that's Observe). It's to help the owner understand what they're seeing (Orient), present clear decision points (Decide), and enable action with minimal friction (Act).

**Applied in PRECEPT:**

- **Observe:** Scribe collects raw activity data from Supabase
- **Orient:** CEO assembles context, identifies patterns, frames implications → briefing is oriented, not raw
- **Decide:** Board Requests present specific decision points with options, tradeoffs, and fallbacks
- **Act:** Owner's reply mechanisms (email reply, Decision Room) enable action with minimal friction — approve, hold, redirect, all in one response

The briefing should never present raw data for the owner to interpret. That forces the owner to do their own Orient phase. The CEO has already oriented — the briefing presents the CEO's orientation with enough transparency for the owner to verify or override it.

### The Two-Minute Drill — Forced Compression

US Army doctrine: the commander should be able to receive a complete operational picture from any staff section in two minutes. This isn't a suggestion — it's a forcing function. It requires staff to pre-compress, prioritize, and hierarchy their information before briefing. Lead with what changed, what's broken, what needs a decision. Everything else is background available on request.

**Applied in PRECEPT:** The daily briefing follows a strict information hierarchy:

1. **Board Requests** — "Here is what I need from you." (Action required)
2. **Exceptions** — "Here is what deviated from the plan." (Awareness required)
3. **Results** — "Here is what we accomplished." (Context)
4. **Forward Look** — "Here is what's coming." (Anticipation)

Board Requests lead because they're the only thing that blocks the system. Exceptions lead over results because deviations are more decision-relevant than status. Results come third because they're context, not action. The forward look comes last because it's anticipation, not urgency.

If the owner reads only the Board Requests and exceptions, they have enough to make every decision the system needs. The rest is context for owners who want it.

### Management by Exception — Deviation-Only Escalation

Frederick Taylor formalized Management by Exception in 1903, but the principle is ancient. The Privy Council met three times a week to handle business so the English monarch didn't have to attend every session. The council filtered, prepared, and presented only what required royal attention. Routine business was handled at the council level.

The principle: only deviations from expected norms escalate upward. Routine operations proceed without management intervention. This is the only way a 30-minute-per-day owner time commitment works.

**Applied in PRECEPT:** The entire system is an MBE architecture:

- **CEO** handles all strategic and operational decisions within approved plan parameters
- **Judge/Reviewer** handle all quality and outcome evaluation
- **Dispatcher** handles all execution logistics
- **Owner** sees only what deviates from expectations or requires owner-specific action

"Everything is on track" is a valid briefing. If the system is executing within parameters, the briefing should be short. Length correlates with deviation, not with activity. A busy week where everything went according to plan should produce a shorter briefing than a quiet week where something broke.

This is counterintuitive for people used to dashboards where more activity = more data = more to look at. In PRECEPT, the absence of information in the briefing *is* information — it means the plan is executing as expected.

## Part III — The Three Interaction Modes

### Mode 1: Morning Briefing (Daily, Asynchronous — Primary Interface)

The owner's main touchpoint. Email from the CEO via AgentMail. Read in 5-10 minutes over coffee.

**Structure:**

```
FROM: CEO (PRECEPT)
TO: Owner
SUBJECT: [Org Name] — Daily Briefing — [Date]

BOARD REQUESTS (if any)
  #1: [Specific action needed]
      Context: [Why this matters now]
      Urgency: [When it matters by]
      Fallback: [What happens if you can't do this]
      → Reply "approved #1" / "hold #1" / your notes

EXCEPTIONS (if any)
  • [Initiative X]: [What deviated from plan, what it means]
  • [Worker capability]: [Pattern observed, recommendation]

RESULTS
  [North star metric]: [current → target, trajectory]
  [Initiative summaries]: [1-2 sentences each, outcomes not activities]

FORWARD LOOK
  [What's planned for this week]
  [Upcoming milestones or deadlines]
  [Open questions being researched]

---
Reply inline to approve, hold, or redirect any item.
Full details: [Decision Room link]
```

**Design principles:**
- Board Requests are numbered for easy inline reply ("approved #1, hold #2")
- Exceptions are only meaningful deviations, not routine revision cycles
- Results lead with the north star metric — the one number the owner cares about most
- Initiative summaries describe outcomes, not activities ("Identified 4 matching prospects" not "Researcher completed Task-047")
- Forward Look is brief — the owner knows what's coming without needing to monitor
- Inline reply parsing via AgentMail JSON extraction handles the owner's response

**Reply parsing:**
The owner replies to the email naturally. AgentMail extracts structured data:
- "Approved" / "approved #1" → approval signal for specified items
- "Hold #2" → pause specified initiative or task
- "Pivot #3 to X" → CEO receives redirect, replans affected initiative
- Free-text responses → CEO receives as owner input, factors into next cycle

The parsing must be forgiving. Owners won't reply in structured format. "Looks good, go ahead but hold off on the cold emails until we have better pricing data" must be interpretable. If ambiguous, the CEO requests clarification in the next briefing rather than guessing.

### Mode 2: Decision Room (On-Demand, Active — Depth Interface)

Web dashboard for when the owner wants to go deeper than the briefing. Not a monitoring screen — structured like talking to your executive team.

**Sections:**

**Active Initiatives**
- Each initiative: status, current phase, progress against plan, key results
- Click into any initiative for full chain: CEO's reasoning → task specs → worker outputs → evaluations → outcomes
- Color-coded health: green (on track), yellow (behind or at risk), red (stalled or failing)

**Output Gallery**
- Actual deliverables produced by workers: research reports, outreach drafts, code, analysis
- The owner sees the work product, not just summaries
- Compensates for the McLuhan amputation — maintains the owner's connection to the texture of the work

**CEO Chat**
- Direct conversation with the CEO agent
- Ask reasoning questions: "Why did you prioritize outreach over product development?"
- Give direction: "I want to focus on enterprise customers, not SMBs"
- Request analysis: "Show me the competitive landscape data"
- Not a general chatbot — conversations with the CEO about the business

**Precepts Editor**
- Current Precepts document with all field states (✓ ~ ? ○)
- Owner can edit any field directly
- Changes logged in audit log, CEO receives updated Precepts in next cycle
- Major changes trigger a Board Request from the CEO for strategic replanning

**Performance View**
- Agent performance profiles (acceptance rates, strengths, weaknesses)
- Aggregate team capability view
- Initiative-level success rates
- Intended for periodic review, not daily monitoring

**Design principles:**
- Decision Room answers: "What do I need to know or decide right now?"
- If nothing needs attention, say so. An empty Decision Room is a good Decision Room.
- No gantt charts. No kanban with 50 cards. No notification firehose. No settings toggles for every behavior.
- Conversational and document-driven, not widget-heavy.
- Every screen should feel like sitting across from a competent executive, not staring at a control panel.

### Mode 3: Quick Command (Future, V2+ — Override Interface)

Lightweight mobile channel for urgent input.

- "Pause all outreach"
- "Status on pitch deck?"
- "Approved" (in response to a pushed Board Request)

Minimal interface. Maximum authority. Like a one-word command to the horse: "Whoa."

Not built in V0.1. Designed for in V0.1 — the engine's webhook handler and reply parsing already support this input modality. When iMessage or push notifications are added, they plug into the existing command flow.

## Part IV — Information Architecture

### What Surfaces When

The interface exists at three depths. The owner moves between them as needed, like a pilot scanning instruments at different distances.

| Depth | What's Visible | When the Owner Is Here | Frequency |
|---|---|---|---|
| **Surface** | Morning Briefing email | Daily glance — decisions, exceptions, results | Every day |
| **Working** | Decision Room — initiatives, outputs, CEO chat | Active investigation — something needs attention or the owner wants to dig in | A few times per week |
| **Deep** | Audit trail, full chain reasoning, performance data, raw outputs | Diagnostic — understanding why something happened or reviewing system health | Occasionally, or during monthly post-mortems |

Information flows upward by compression. The deep layer contains everything. The working layer contains what's relevant to active initiatives. The surface layer contains only what requires the owner's attention or awareness.

Information never flows downward by demand. The owner never has to request a briefing or ask the system to report. The system pushes proactively at the rhythm established in the operating cycle.

### The Tiller Principle — Pressure as Signal

In sailing, slight weather helm means the helmsman feels constant light pressure on the tiller. Changes in that pressure signal changes in the wind before the helmsman sees them in the sails. A sudden increase in pressure means a puff hit. A decrease means the wind dropped. The pressure *is* the instrument.

The PRECEPT interface should have equivalent pressure signals — ambient indicators that communicate organizational health without requiring the owner to read a report:

- **Briefing length** is a pressure signal. Short briefing = everything on track. Long briefing = deviations to process. The owner feels this as they read.
- **Board Request frequency** is a pressure signal. Increasing requests = the system is hitting more situations it can't handle alone. Decreasing requests = the system is learning and operating more autonomously.
- **Exception density** is a pressure signal. More exceptions = more deviation from plan. Fewer exceptions = plan is executing as expected.
- **North star trajectory** is the deepest pressure signal. Is the number moving? Flat? Declining? This is the one number that tells the owner whether the whole system is working.

These aren't dashboard widgets. They're ambient properties of the existing interface. The owner doesn't look at a "health meter" — they feel the health through the natural properties of the communication they already receive.

### The Common Operating Picture

Military command systems work toward a "Common Operating Picture" — a shared, real-time view of the operational environment that every level of command can reference. The COP doesn't show everything to everyone. Each level sees the COP at their appropriate resolution.

PRECEPT's equivalent:

- **Owner's COP:** North star metric, initiative health status, pending Board Requests, exceptions. Available at the top of the Decision Room and summarized in every briefing.
- **CEO's COP:** Full Precepts + Scribe's compressed output + lessons + owner input. Assembled before every CEO invocation.
- **Dispatcher's COP:** Dependency graph, task states, worker availability. Real-time from Supabase.

The owner's COP should be glanceable — one screen, no scrolling, answers "is my organization healthy right now?" in under 10 seconds.

## Part V — Control Surfaces

Where the owner can steer. Mapped to the organizational hierarchy.

| Control Surface | What It Changes | How It's Accessed | Effect Scope |
|---|---|---|---|
| **Precepts Editor** | Strategic foundation — identity, product, success definition, constraints | Decision Room | Everything downstream. Precepts changes cascade to CEO planning, task specs, evaluation criteria. |
| **Briefing Reply** | Tactical approvals, holds, redirects | Email reply | Active initiatives. Affects current cycle execution. |
| **CEO Chat** | Direction, priorities, reasoning queries | Decision Room | Next CEO planning cycle. CEO incorporates as owner input. |
| **Board Escalation Response** | Fundamental strategic decisions — pivot, restructure, redefine success | Email or Decision Room (prompted by CEO) | Potentially everything. May trigger Precepts rewrite. |
| **Quick Command** | Immediate overrides — pause, resume, approve | Mobile/iMessage (future) | Targeted. Affects specific initiatives or the system as a whole (e.g., "pause all"). |

### Steering Authority Hierarchy

Not every control surface has equal authority. They're ordered by impact:

1. **Precepts edits** — change the foundation. Everything recalibrates. (Rare)
2. **Board Escalation responses** — change the direction. Strategy pivots. (Uncommon)
3. **CEO Chat direction** — change priorities within current strategy. (Periodic)
4. **Briefing replies** — approve, hold, redirect within current plan. (Daily)
5. **Quick Commands** — immediate tactical adjustments. (As needed)

The owner should reach for the lightest touch first. Most days, a briefing reply is all that's needed. Precepts edits are the heaviest intervention — reserved for when something fundamental has changed.

## Part VI — Trust Through Transparency

### Reasoning Visibility

Every CEO decision, every Judge verdict, every Board Advisor review — all carry reasoning that the owner can inspect on demand. This isn't for daily consumption. It's for the moments when the owner thinks "why did the system do that?"

The audit log (see `memory.md`) stores full reasoning chains. The Decision Room makes them accessible without requiring the owner to query a database. Click an initiative → see the CEO's plan → see the Dispatcher's assignments → see worker outputs → see Judge verdicts → see the reasoning at every step.

This is the organizational equivalent of the glass cockpit — instruments are there when you need them, invisible when you don't.

### Honest Failure Reporting

The system must never hide failure. Lesson artifacts surface in briefings. Failed initiatives get post-mortems that the owner sees. The Judge's ESCALATE verdicts reach the CEO, and escalation patterns reach the owner.

If the system is struggling — if the CEO is producing bad plans, if workers are consistently failing on a task type, if the Board Advisor keeps flagging the same pattern — the interface must make this visible. The system is not trying to impress the owner. It's trying to inform the owner.

The CEO's briefing should include a line like: "Researcher capability is strong (90% acceptance). Writer capability is weaker (70% acceptance). I'm compensating by breaking writing tasks into smaller pieces, but we may need a different model for the Writer role." That's honest organizational reporting.

### The "Nothing to Report" Report

One of the most important things the interface can communicate is that nothing needs the owner's attention. A briefing that says "All initiatives executing within parameters. No Board Requests. North star metric on trajectory. No exceptions." — that's a powerful report. It means the system is working.

The temptation is to fill empty briefings with activity noise — "Worker completed 12 tasks, Researcher processed 3 sources, Writer drafted 2 emails." That's not signal, it's busywork reporting. It adds volume without adding value. It trains the owner to skim, which means they'll skim when something actually matters.

The briefing should have the confidence to be short when there's nothing to say.

## Appendix: V0.1 Implementation Scope

### What's Built in V0.1
- Morning Briefing via AgentMail (email send + structured reply parsing)
- Onboarding UI (split-screen interview chat + live Precepts builder) — see `onboarding.md`
- Decision Room: Active Initiatives, Output Gallery, Precepts Editor, CEO Chat
- Briefing reply parsing (approval/hold/redirect extraction)
- Owner authentication (session-based, single-user)

### What's Deferred to V2+
- Quick Command (iMessage/push notification channel)
- Owner style adaptation (automatic briefing density calibration)
- Mobile-native Decision Room
- Multi-owner support (feudal layer — separate orgs, separate owners)

### Interface Implementation Notes

**Briefing generation:** The CEO compiles the briefing as the final step of its daily cycle. The briefing is a structured output (sections, Board Requests, exceptions, results, forward look) that the engine formats into email HTML and sends via AgentMail.

**Reply parsing:** AgentMail extracts JSON from the owner's email reply. The engine maps extracted intent to state changes: approvals → proceed signals, holds → pause signals, redirects → CEO input for next cycle. Ambiguous replies → CEO requests clarification in next briefing.

**Decision Room real-time updates:** Supabase realtime subscriptions push state changes to the Next.js frontend. When a task moves from REVIEW to ACCEPTED, the initiative view updates immediately. The owner never needs to refresh.

**Precepts edit flow:** Owner edits in the Decision Room → Supabase update → audit log entry → CEO receives updated Precepts in next invocation. Major edits (changing Success Definition, Identity, or Constraints) trigger a Board Request from the CEO for strategic replanning confirmation.
