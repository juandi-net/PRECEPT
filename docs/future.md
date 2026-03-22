---
date: 2026-03-08
project: precept
status: approved
---

# PRECEPT V0.1 — Future

The world this system is being built for does not yet exist. But it is arriving, and the distance between now and then is shorter than the distance between the first iPhone and now. Every foundational decision in PRECEPT is evaluated against that world — not this one.

This document exists because systems built for the present calcify into the present. Systems built for the trajectory compound into the future. PRECEPT is the second kind or it is nothing.

See `passion.md` for why the owner's conviction is the precondition for everything working, `structure.md` for the organizational hierarchy, `onboarding.md` for how passion is first captured, `skills.md` for how the system learns.

---

## Part I — The World That Is Coming

Three forces are converging. Each one alone would reshape how people work. Together, they dissolve the assumptions that every organizational tool in existence was built on.

### 1. Inference Becomes Free and Local

State-of-the-art models will run on consumer hardware. Not "good-enough" models — the frontier. The trajectory is unambiguous: each generation of model is smaller, faster, and more capable than the last. The gap between cloud-only capability and local capability has closed by years in months. It will close completely.

When that happens:

- **Inference cost drops to zero.** Not "cheap." Zero marginal cost per invocation. The limiting factor becomes wall-clock time, not API bills.
- **Everything is local.** No data leaves the device. The entire security classification model — which data can be sent where, which models can see what — collapses to a single tier. Everything is RESTRICTED-safe because nothing goes anywhere.
- **Context windows become unlimited in practice.** Not 200K tokens. Not 1M. Effectively unbounded for any organizational use case. The Scribe's compression role becomes unnecessary. Raw data goes directly to the CEO.
- **Every agent runs the same model.** The Opus/Sonnet tier split — leadership on the capable model, workers on the cheaper one — becomes meaningless. Every worker is as capable as the CEO. Every evaluator is as capable as the planner.
- **Latency approaches zero.** Sequential operations that take minutes today take seconds. Parallel operations that were limited by API rate limits become limited only by hardware threads.

This is not a prediction to hedge against. It is the engineering trajectory of the industry. A system that assumes expensive, remote, limited models is building on sand.

### 2. Mass Displacement Creates Mass Entrepreneurship

The same technology that makes inference free will displace millions of jobs. This is not an abstraction. It is already beginning — in content creation, in customer service, in data analysis, in legal research, in software development. The roles that disappear first are exactly the roles that required organizational infrastructure to perform: you needed an employer because you needed an office, a team, a workflow, a brand, a distribution channel.

When the infrastructure is AI-native, the employer's organizational overhead is no longer necessary. What remains is the individual's skill, judgment, taste, relationships, and conviction. These are the things that matter — they were always the things that mattered — but they were trapped inside organizational structures that extracted most of their value.

The displacement will create three groups:

**Those who wait.** They will look for new jobs of the same kind and find fewer of them. This is not PRECEPT's audience, and there is nothing this system can do for someone who does not want to build.

**Those who build out of necessity.** A marketing director loses her position and realizes she has fifteen years of relationships, industry knowledge, and professional instinct that no model possesses. She does not need an agency. She needs an organization — one that handles the operational overhead so her expertise can reach clients directly. She needs a CEO that understands her business, workers that execute her strategy, and a system that respects her time.

**Those who build out of calling.** The person who has always wanted to start something but could never afford the organizational overhead. The teacher who wants to build educational tools. The craftsman who wants a direct-to-consumer business. The missionary who wants a nonprofit that actually operates. They have the passion. They have never had the infrastructure. PRECEPT is that infrastructure.

The second and third groups will number in the tens of millions in the next decade. Each one of them needs what PRECEPT provides: an organizational structure that takes their passion seriously, translates it into operational reality, and runs with minimal owner time.

### 3. Data Becomes the Durable Store of Value

When models are commoditized — when anyone can run SOTA on a phone — the model is not the moat. The model is electricity. Everyone has it. No one differentiates on it.

What differentiates is what the organization *knows*. Not what the model knows — models know everything and nothing, because they know it generically. What differentiates is what *this specific organization* has learned through *its specific experience* operating in *its specific domain* for *its specific owner*.

PRECEPT accumulates five types of organizational knowledge (see `memory.md`):

- **Institutional memory** — decisions made, lessons learned, owner feedback. Permanent. Append-only.
- **Role memory** — domain knowledge per role. What the Researcher has discovered about this market. What the Writer has learned about this audience. Permanent per role, survives agent swaps.
- **Performance memory** — what each agent is good at, where it struggles. Per agent, resets on swap.
- **Operational memory** — task chains, initiative state, Team Bulletin. Transient.
- **Skills** — procedures, quality criteria, anti-patterns. The Curator extracts these from evaluation patterns. Permanent, versioned, compounding.

Of these five, **skills are the highest-leverage data asset.** A skill that has been refined through ten cycles of Curator observation contains organizational intelligence that no fresh model instance possesses. It encodes not just "how to do this task" but "how to do this task well *for this specific business*, avoiding the specific failure modes *this specific organization* has encountered."

Two PRECEPT organizations running the same model, with the same structure, in the same industry will produce different results — because their skill libraries are different. Their institutional memories are different. Their Precepts are different. The model is generic. The data is specific. The data is the value.

This has a compounding property. Each execution cycle generates evaluation data. The Curator transforms evaluation data into skills. Better skills produce better worker output. Better output generates richer evaluation signal. The Curator extracts more precise skills. The cycle accelerates. The organization that has been running for six months is not 6x better than the one that started yesterday — it is *qualitatively different*, operating on accumulated intelligence that cannot be replicated by running a better model.

**The implication for PRECEPT:** Every design decision should maximize the rate and quality of data accumulation. Skill events should be logged. Evaluation patterns should be tracked. Memory should be promoted and decayed with care. The data pipeline is not a feature — it is the product's compounding engine.

---

## Part II — Five Permanent Truths

These do not change regardless of model capability, hardware trajectory, or market conditions. They are the load-bearing walls of PRECEPT's design. Everything else is scaffolding that will eventually be removed.

### 1. Adversarial Evaluation Gets More Valuable, Not Less

A more capable model produces more subtle errors. Plans that are more plausible, more internally consistent, and harder to detect when wrong. The CEO-Judge separation exists because planning and evaluation create bias when combined — the planner anchors on its own decisions and accepts mediocre output because it produced the plan that led to it. This bias does not decrease with capability. It gets better camouflaged.

A single-model system with SOTA-on-iPhone will produce sophisticated, coherent, and *confidently wrong* output with no structural mechanism to catch it. The dual-gate evaluation model (Reviewer for craft, Judge for outcome) provides multiplicative error-catching that scales super-linearly with per-model improvement.

**This is permanent.** No model improvement eliminates the anchoring bias of self-evaluation. The structure is the fix.

### 2. Alignment Scales Super-Linearly with Capability

A model that can do 10 things has a limited action space. A model that can do 10,000 things has a focusing problem. The Precepts are the constraint surface that collapses action space to what actually matters for this business.

Weak Precepts + weak model = limited but vaguely aimed. Tolerable.
Weak Precepts + strong model = capable but unfocused. Dangerous — it will execute brilliantly on the wrong things.
Strong Precepts + strong model = capable AND precisely aimed. This is where disproportionate value lives.

The value of the Precepts — the quality of the Cornerstone interview, the depth of the root, the precision of the success definition — scales super-linearly with model capability. As models improve, the Precepts become *more* important, not less. This makes the Cornerstone interview the single highest-leverage event in the entire system lifecycle. Thirty minutes that shape every decision for months or years.

**This is permanent.** Capability without alignment is power without direction. The Precepts are direction.

### 3. Owner Time Is the Only Non-Scaling Resource

Everything else scales. Inference scales to zero cost. Context scales to unlimited. Worker count scales to whatever the task requires. Evaluation scales with model improvement. Skill accumulation scales with operational cycles.

Owner time does not scale. The owner has 24 hours in a day. They need to sleep, eat, live, worship, care for their families, and exist as a human being. The time they spend with PRECEPT is time they are not spending on the craft they love, the relationships they value, or the rest they require.

The system's job is to maximize the return on every minute the owner invests. This means:

- **Batch decisions.** Never send three Board Requests that could be one.
- **Front-load consequences.** The most important decision goes first in every briefing.
- **Earn autonomy.** The CEO that needs fewer owner decisions to execute well is the CEO that respects the owner's life.
- **Protect attention.** If something can be resolved without the owner, resolve it. The owner should see only what genuinely requires their judgment, values, or relationships.
- **Be honest about time cost.** If a Sign-Off will take 15 minutes of context to evaluate, say so upfront.
- **Improve leverage over time.** Month 1, the owner spends 30 minutes per day. Month 6, the owner should spend 30 minutes per day and get 5x more organizational output per minute. Month 12, 10x. The time stays constant. The leverage increases.

The CEO must treat owner time the way a CFO treats cash: spend it only where the return justifies it, track it, and never waste it. Every other AI system treats the human's time as free. PRECEPT should be the one that doesn't.

**This is permanent.** No technology extends the hours in a day.

### 4. Passion Cannot Be Generated

`passion.md` establishes this at length. The system exists to serve what the owner already has — the conviction, the calling, the compulsion. PRECEPT cannot create a reason to build. It can only multiply the effect of a reason that already exists.

When millions of people are displaced from employment and considering entrepreneurship, many of them will not have passion. They will have financial pressure. Financial pressure produces functional businesses — businesses that exist to generate income. These businesses can use PRECEPT. But the businesses that *matter*, the ones that endure, are the ones where the owner is building something they cannot not build.

The Cornerstone interview must distinguish between the two. Not to reject the person without passion — PRECEPT serves anyone willing to build — but to capture the passion when it exists, because that is where the system's value is highest. A passionate owner with strong Precepts in a self-learning system produces an organization that improves faster, aims more precisely, and endures longer than any other combination.

**This is permanent.** No model generates human conviction.

### 5. The Self-Learning Loop Is the Moat

When inference is free, any person can spin up an AI agent to do a task. That is not a moat. That is a commodity. What PRECEPT builds — the organizational knowledge that accumulates across cycles, the skills that compound, the institutional memory that prevents repeating mistakes, the performance profiles that improve routing — is not replicable by starting fresh.

An organization that has run for a year has:
- Hundreds of refined skills encoding "how we do things well here"
- Thousands of evaluation data points informing what quality looks like
- Institutional memory that prevents strategic errors from being repeated
- A Precepts document that has been validated and updated against reality
- Performance profiles that enable precise worker routing

A competitor starting from scratch with the same model has: the model. Nothing else.

The self-learning loop is not a feature. It is the compounding engine that makes PRECEPT's value increase faster than linearly with time. Every design decision should feed this loop. Every cycle should make the next cycle better.

**This is permanent.** Accumulated organizational knowledge cannot be replicated by running a better model.

---

## Part III — The Entrepreneur's Infrastructure

PRECEPT's position in the coming world is specific: **it is the organizational infrastructure for people who build businesses alone.**

Not a chatbot. Not a task runner. Not an automation tool. An *organization* — with a strategic brain that plans, workers that execute, evaluators that maintain quality, and a memory that compounds. The thing that used to require ten employees, an office, and a $50K monthly payroll now requires one person with conviction and 30 minutes per day.

### What the Owner Provides

The owner provides what no model can:

- **Vision** — what this business should become. Not a metric. A picture of the future.
- **Values** — what the business will not do. Where the line is. This is where conviction lives, in the things they protect.
- **Relationships** — the customers, partners, mentors, and community that trust the owner personally. No model has social capital.
- **Taste** — the judgment about quality, relevance, and fit that comes from years of domain experience. The model has knowledge. The owner has taste.
- **Signature** — the human approval that makes a commitment real. When the organization sends an email, signs a contract, or publishes content, the owner's name is on it.

### What PRECEPT Provides

PRECEPT provides what the owner cannot scale:

- **Strategic planning** — the CEO reads the owner's Precepts and the organization's state, then generates the highest-impact initiatives. The owner approves. The CEO coordinates.
- **Parallel execution** — workers research, write, analyze, build, and operate simultaneously. One person cannot do five things at once. The organization can.
- **Quality control** — the Reviewer and Judge maintain standards that a solo operator cannot. When you're doing everything yourself, quality is the first casualty. The dual-gate evaluation model ensures craft and outcome quality are independent.
- **Institutional memory** — the organization remembers what worked, what didn't, and why. Solo operators make the same mistakes repeatedly because they're too busy to reflect. The system reflects automatically.
- **Sustained rhythm** — daily briefings, weekly plans, continuous execution. Solo operators oscillate between frantic activity and paralysis. The organizational rhythm provides steady forward motion.

### The Trust Gradient

The relationship between the owner and the organization evolves over time:

**Month 1 — Operator.** The owner is deeply involved. Approving every plan. Reviewing every output. Providing feedback on every task. This is necessary — the system is calibrating to the owner's standards, values, and taste.

**Month 3 — Approver.** The owner reviews plans and signs off on milestones. The CEO has demonstrated reliable judgment. Workers produce output that consistently passes the dual-gate evaluation. The owner's daily briefing takes 15 minutes instead of 30.

**Month 6 — Strategist.** The owner sets direction and evaluates outcomes. The organization handles everything between. Board Requests are infrequent because the CEO has internalized the Precepts deeply enough to make most decisions autonomously. The owner spends their time on relationships, vision, and the craft they love.

**Month 12+ — Visionary.** The owner shapes long-term direction. The organization is self-sustaining within the Precepts. The skill library is mature. The institutional memory is rich. The owner's 30 minutes per day are spent on the highest-leverage activity: deciding what the business should become next.

This gradient is not automatic. It is earned through the system demonstrating trustworthy judgment. And it is never complete — the owner maintains contact with the work (passion.md's principle) and can pull back to the Operator level at any time. The sign-off model ensures this.

The `trust_autonomy` spectrum in the role_config table (`execute_only` → `flag_and_execute` → `propose` → `autonomous_bounded`) is the structural expression of this gradient. Each role's autonomy level can be increased independently as trust is established.

### The Middle-Manager Anti-Pattern

There is a specific failure mode that PRECEPT must structurally prevent, not just discourage: **turning the owner into a middle manager for AI agents.**

The pattern is described precisely by practitioners who have deployed agent systems: when you manage a team of agents, they constantly ping you because they finished their work. Your calendar fills with one-on-ones. You're giving little prompts to agents you're ordering around. You have become a middle manager — except your reports never sleep, never take breaks, and generate work for you 24 hours a day. The work never stops because the agents never stop.

This is the opposite of what PRECEPT exists to do. The owner is not a manager. The owner is the Board. The CEO manages the agents. The owner manages the CEO. And even that should be as lightweight as possible.

**The structural protections:**

**The owner's interaction is PULL, not PUSH.** The organization operates on its own rhythm — daily, weekly, continuously. The briefing is *available* when the owner wants it. It is not a summons. If the owner doesn't read Tuesday's briefing, Wednesday's briefing absorbs Tuesday's content seamlessly. No backlog accumulates. No guilt. The system does not punish absence — it continues approved work and waits. The owner pops in when they choose, pops out when they choose.

**Board Requests have a hard ceiling.** The CEO may include a maximum of two Board Requests per briefing cycle. If it has more pending questions, it must prioritize the two most consequential and resolve the rest autonomously, defer them, or consolidate them. A CEO that generates five Board Requests per day is a CEO that is making the owner do its job. That is a prompt failure, not an operational feature.

**Escalations are absorbed, not forwarded.** Three of the four escalation types (`spec_problem`, `capability_problem`, `strategy_problem`) are CEO-resolvable. Only `foundation_problem` — something that touches the Precepts, the values, or the owner's core constraints — reaches the owner. The CEO's job is to handle problems so the owner doesn't have to. An escalation that reaches the owner should feel rare and significant, not routine.

**Sign-Offs are batched into briefings.** Sign-offs are not separate events that interrupt the owner's day. They appear as items within the daily briefing letter. The owner encounters them during their chosen review time, alongside context, alongside other decisions. No separate notification channel. No interrupt.

**The system measures its own demand on the owner.** The CEO tracks how many owner-minutes it consumed this week — Board Requests sent, Sign-Offs requested, escalations forwarded. The CEO's planning prompt includes the instruction: "Your effectiveness is measured partly by how *little* owner attention you required this cycle while still advancing the mission. Trend downward. Earn autonomy."

**The organization runs when the owner is absent.** This is already in the design (fail-safe default, continued execution of approved work), but it deserves emphasis as the defining characteristic that separates PRECEPT from agent-management tools. The owner can disappear for a week. When they return, the briefing catches them up in 10 minutes. Work continued. Quality was maintained. Decisions within the CEO's authority were made. The owner's absence did not stop the organization — it just deferred the decisions that genuinely require the owner's judgment.

The litmus test: **if using PRECEPT feels like managing a team, something is broken.** Using PRECEPT should feel like having a chief of staff who handles everything, respects your time, and only knocks on your door when the building is on fire or the strategy needs your eyes. Pop in. Scan the letter. Make a decision or two. Pop out. Go live your life. The organization is working.

---

## Part IV — Data as Durable Value

When models are commoditized, three assets determine an organization's value:

### 1. The Precepts Document

The Precepts are the most important single document in the system. They encode:
- Who the business is and why it exists (identity + root)
- What it's building and for whom (product)
- What success looks like in the owner's own words (success definition)
- What's off-limits (constraints + values)
- What the competitive landscape looks like (reality)
- What has been tried and what happened (history)

Two people starting identical businesses on the same day with the same model will produce different results based entirely on the quality of their Precepts. The one who went through a Cornerstone interview that surfaced the real conviction — not the elevator pitch, not the investor narrative, but the actual why — will build a more coherent, more resilient, more personally meaningful business. Because every downstream decision inherits the quality of this document.

The Precepts are not static. They are updated as the business evolves — as the CEO discovers contradictions between assumptions and reality, as the owner's understanding of their own vision deepens, as the market shifts. Each update makes the Precepts more precise. This is a compounding asset.

### 2. The Skill Library

Skills are organizational IP. A skill that has been refined through ten Curator cycles is a codified procedure that no fresh model instance possesses. It contains:
- What to do (procedure)
- What "good" looks like (quality criteria)
- What to avoid (anti-patterns)
- Why this version exists (revision history from real failures and successes)

The skill library is portable — it survives model swaps, hardware changes, and platform migrations. If PRECEPT's entire codebase were rewritten tomorrow but the skill library and Precepts were preserved, the new system would operate at the same quality level within one cycle.

**The agentskills.io open standard.** PRECEPT's skill format aligns with the agentskills.io specification — the industry open standard adopted by Claude Code, Codex, Cursor, GitHub Copilot, and others. A skill is a directory containing a `SKILL.md` file with YAML frontmatter and markdown body, plus optional `scripts/` and `references/` directories. PRECEPT-specific fields (scope, role, status, trigger tags, quality criteria, anti-patterns) live in the YAML `metadata` block. The markdown body is freeform and contains the procedure, criteria, and anti-patterns the Dispatcher loads into worker context.

This alignment has three consequences:

First, **community skills become installable.** The agentskills.io ecosystem (skills.sh, community registries) contains hundreds of skills for common tasks — web research, code review, data analysis, deployment. A PRECEPT org can install a community skill with zero format translation. The Dispatcher loads it the same way it loads any other skill.

Second, **Curator output becomes publishable.** When the Curator extracts a skill from Reviewer/Judge patterns, that skill is automatically in a format any agentskills.io-compatible agent can use. A skill refined through ten cycles in one PRECEPT org can be published to skills.sh (the community distribution hub — `npx skills add <owner/repo>` to install) and used by any other organization. The Curator's work becomes a shareable asset, not a locked-in procedure.

Third, **network effects compound across orgs.** When tens of millions of people are building businesses with AI infrastructure, skill sharing becomes a distribution channel. An outreach skill refined by a marketing consultant's PRECEPT org can be published, installed by a nonprofit's PRECEPT org, and further refined by their Curator for their specific audience. Each installation creates a branch. Each branch produces refinements. The best refinements propagate back. The skill ecosystem grows faster than any single Curator could produce.

The agentskills.io spec introduces one key mechanism PRECEPT should adopt: **the description field is the sole trigger surface.** Agents use progressive disclosure — they load only the `name` and `description` of each skill at startup, and read the full `SKILL.md` only when the description matches a task. This means the quality of the description determines whether the skill is ever used. The Curator should treat description optimization as part of its refinement cycle, not just procedure refinement. The agentskills.io docs include a full description optimization methodology: design eval queries (should-trigger / should-not-trigger), test trigger rates across multiple runs, iterate the description wording, avoid overfitting with train/validation splits. This is another instance of the experiment pattern — the same A/B testing framework the Curator uses for skill procedures applies to skill descriptions.

Within the feudal multi-org model, this extends naturally. Patterns discovered in one organization can inform skills in another (with appropriate abstraction and data isolation). The Board Intelligence Brief (V2+) enables cross-org learning without violating data boundaries. The agentskills.io standard makes this possible beyond PRECEPT's own ecosystem — skills flow between PRECEPT orgs, between PRECEPT and Claude Code, between PRECEPT and any compatible agent system.

**Community skills are dependencies, not gifts.** The same ecosystem that enables skill sharing creates a security surface. A community skill is a prompt injection vector. A malicious `SKILL.md` could instruct a worker to exfiltrate data via `bash_execute`, subtly sabotage output quality, or encode procedures that look reasonable but produce harmful results. Skills with `scripts/` directories are worse — that's executable code from an unknown source entering the system.

PRECEPT's dual-gate evaluation catches bad *output* from a bad skill (the Judge rejects it). It does NOT catch side effects — data exfiltration, script execution, subtle bias. The eval pipeline is a quality gate, not a security gate. Community skills need a separate trust model.

The Curator should search community registries (skills.sh, agentskills.io) before creating a skill from scratch — there's no reason to reinvent what the community has already refined. But it should never install a community skill autonomously. The flow:

1. **Curator identifies a skill gap** during its weekly cycle.
2. **Curator searches skills.sh** (the community distribution hub, with install counts and security audits at skills.sh/audits) for existing skills that match the gap. Read-only discovery. Finds candidate skills, reads their content.
3. **Curator proposes, does not install.** It creates a recommendation for the CEO: "Found community skill 'competitive-analysis' v2.3 by @marketingpro. Covers 80% of what our extracted skill would. Full content attached for review."
4. **CEO evaluates** the full `SKILL.md` content against the Precepts and security policy.
5. **Trust gate based on content type:**

| Skill type | Gate | Rationale |
|-----------|------|-----------|
| Instructions-only (no `scripts/`) | CEO approves for low-stakes domains. Owner sign-off for high-stakes (external comms, financial, customer data). | Prompt injection risk exists but no code execution. Output quality is caught by the eval pipeline. |
| Contains `scripts/` directory | **Owner must approve.** Always. No exceptions. CEO cannot approve executable code from external sources. | Executable code can have side effects the eval pipeline cannot catch — exfiltration, persistence, system modification. |

6. **Probationary period.** The first N tasks (default 5) using any community skill get mandatory full dual-gate evaluation — no `separation_policy` relaxation, no Reviewer skip, regardless of task stakes. If acceptance rate meets threshold after the probation period, the skill becomes trusted. If not, the Curator refines it or discards it.
7. **Installed community skills are marked.** The `skill_index` table records `source: 'community'` with the original registry, author, and version. The Curator can refine community skills the same way it refines any other — the refined version becomes an org-specific fork with full provenance.

This trust gradient reflects a broader principle: **the system should be more cautious about community skills than Curator-generated skills.** Curator-generated skills have organizational provenance — they were extracted from output that the Reviewer and Judge validated. Community skills have zero provenance within the organization. They haven't been through the eval pipeline. They haven't been validated against this specific business's standards. Trust must be earned through the probationary period, not assumed from a download count.

**Memory management as a skill domain.** Skills don't just encode *how to do external tasks*. They encode *how the organization manages itself*. Memory retrieval strategies, staleness policies, storage criteria, context management approaches — these are all procedures that the Curator can observe, extract, and refine. A skill like `memory-retrieval-strategy` contains organizational wisdom about what to retrieve before planning, how many entries to pull, and when to store new assumptions. This skill domain is where the AgeMem research (learned memory policies via tool-based operations) meets PRECEPT's Curator loop — the Curator learns memory management policies through the same observation → extraction → refinement cycle it uses for any other skill domain. The model decides how to manage memory. The Curator decides whether the model's decisions were good. The skill encodes the best practices that emerge.

### 3. Institutional Memory

The decisions made, the lessons learned, the owner's feedback over months and years — this is the organization's judgment. A fresh system makes mistakes that the experienced system has already made, diagnosed, and coded into lessons and skills.

Institutional memory has a quality that no model training can replicate: it is *specific to this business*. The model knows generally how marketing works. The institutional memory knows that *this specific audience* responds to *this specific framing* because *this specific A/B test* in *this specific quarter* produced *this specific result*. Specificity is the difference between knowledge and wisdom.

---

## Part V — Autonomous Optimization

PRECEPT must get better at its own job without the owner engineering the improvement. The owner builds a business. The system improves itself.

Two layers of optimization exist. One is available now. The other becomes available when local compute arrives. Both serve the same purpose — tightening the feedback loop between "what the system tried" and "how the system behaves next" — but they operate at different levels and at different speeds.

### Layer 1: Experimentation as a First-Class Task (Now)

The Curator currently learns by passive observation: it watches Reviewer and Judge patterns across a week's worth of tasks, then extracts or refines skills. This works, but it's slow. A skill refinement takes a week to produce and another week to validate. Two weeks per iteration.

The faster approach: the CEO commissions explicit, controlled experiments. An experiment is not a research initiative. It is a deliberate A/B test on an internal system parameter — a skill variant, a prompt approach, a memory policy — with a defined metric and sample size.

The pattern:

```
CEO identifies: "Writer acceptance rate dropped from 80% to 50%"
  → CEO creates experiment:
      hypothesis: "Subject line approach in outreach skill is too formal"
      variants: [current-skill, variant-with-conversational-opener]
      metric: acceptance_rate
      sample_size: 3 tasks per variant
  → Dispatcher routes: 3 tasks to variant A, 3 to variant B
  → Judge evaluates all 6 tasks
  → Curator compares acceptance rates
  → Winner becomes the active skill
  → Losing variant + results logged to skill_events
```

This takes 3 days instead of 2 weeks. The improvement is not in the sophistication of the optimization — it's in the cycle time. Twelve experiments per month instead of two. The system compounds faster.

Experimentation applies to any optimizable parameter:

- **Skills:** Which procedure produces higher acceptance rates?
- **Memory policies:** Does retrieving 3 vs. 7 role memory entries improve plan quality?
- **Prompts:** Does the briefing format with estimated-time headers reduce owner decision time?
- **CEO planning templates:** Does phased decomposition outperform flat task lists for research initiatives?

The experiment task type makes this structural:

```
ExperimentSpec {
  hypothesis: string
  variants: string[]
  metric: string            // acceptance_rate, owner_time_cost, memory_quality
  sample_size: number       // tasks per variant
  success_threshold: number // minimum improvement to keep winner
}
```

The CEO plans experiments. Workers execute variants. The Judge measures outcomes. The Curator promotes winners. The entire self-learning loop gets faster without any new infrastructure — just a new task type and Dispatcher support for variant routing.

This is the pattern from autonomous research systems applied to organizational optimization: **modify → run → measure → keep/discard → repeat.** The "modification" is a skill or prompt variant. The "run" is task execution. The "measurement" is Judge evaluation. The "keep/discard" is Curator promotion. PRECEPT doesn't need gradient descent to optimize itself. It needs controlled experimentation with fast feedback.

### Layer 2: Weight-Level Optimization via Local RL (Mac Studio)

When the Mac Studio arrives, local open-source models become available for fine-tuning. This opens a second optimization layer that operates on model weights, not prompts.

The honest framing: **Layer 2 is a bet, not a certainty.**

**The case for local RL:**

Research demonstrates that smaller models fine-tuned with RL for specific agent behaviors outperform larger models with hand-written rules on those specific behaviors. A 4B parameter model trained with reinforcement learning on memory management decisions beat much larger models that relied on prompt-based memory policies. The fine-tuned specialist outperformed the prompted generalist.

This suggests that PRECEPT's worker tier — the execution layer where specific behavioral patterns matter more than general reasoning — is a natural candidate for RL fine-tuning. Workers do narrower tasks (research, writing, coding), execute at high volume (generating abundant training signal), and their target behaviors are well-defined (follow skills, produce field signals, manage context). A worker model fine-tuned on "how to follow this organization's specific skills and memory policies" could outperform a generic frontier model prompted with the same skills.

The implementation mirrors autonomous research — the Coder worker modifies training configurations, the engine runs fixed-time training experiments on the Mac Studio, the Judge evaluates whether the fine-tuned model produces better task output, and the CEO decides whether to deploy the new weights.

**The case against (the sunk cost risk):**

Frontier models advance fast. By the time local RL infrastructure is built and a fine-tuned local model is producing good results (3-6 months of iteration), the next generation of frontier API models may have closed the gap by being natively better at agent behaviors without fine-tuning. The RL investment window may be 12-18 months before commodity models match or exceed the fine-tuned specialist.

Additionally, fine-tuning creates a maintenance burden. Every time the base model is updated, RL training must be re-run. Every time skills change significantly, the fine-tuned model's behavior may diverge from the new procedures. The specialist advantage comes with specialist brittleness.

**The resolution: dual-layer with shared infrastructure.**

The two layers are not either/or. They operate in parallel on different system tiers:

| Layer | Target | Mechanism | Speed | Risk |
|-------|--------|-----------|-------|------|
| Layer 1 (prompt-level) | All roles — CEO, Judge, Reviewer, Workers | Controlled experiments via Curator | 3-day cycles | Low — no infrastructure investment |
| Layer 2 (weight-level) | Worker tier only | RL fine-tuning on local models | Hours per training run | Medium — may be obsoleted by frontier advances |

Leadership roles (CEO, Judge, Reviewer, Advisor) stay on frontier API models permanently. Their judgment quality is the system's highest-leverage parameter, and general reasoning ability matters more than specialized behavior for these roles.

Worker roles get the dual treatment: prompt-level optimization via skills (Layer 1) *plus* optional weight-level optimization via local RL (Layer 2). If the RL-fine-tuned local model outperforms the prompted frontier model for a specific worker role, use it. If it doesn't, discard it and keep the frontier model. The role_config table's `model_override` and `endpoint_override` fields make this a config change, not a migration.

**The data is never wasted.** Even if RL fine-tuning proves to be a sunk cost, the infrastructure built for it serves Layer 1 permanently. The experiment task type, the variant routing in the Dispatcher, the evaluation metrics, the skill_events logging — all of this feeds the Curator's prompt-level optimization regardless of whether weight-level optimization produces value. And the organizational data accumulated during the RL period (training signal, reward distributions, behavioral patterns) becomes institutional memory that informs future optimization decisions.

### The Optimization Trajectory

The system's optimization capability evolves through three phases:

**Phase 1 (Now — Sprint 5):** Curator observes evaluation patterns weekly, refines skills in batch. Slow but functional. The self-learning loop exists.

**Phase 2 (Sprint 6+):** CEO commissions explicit experiments. Curator runs A/B tests with 3-day cycles. The self-learning loop accelerates 4x.

**Phase 3 (Mac Studio):** Dual-layer optimization. Prompt-level experiments on all roles via Curator. Weight-level RL on worker models via local training. The prompt layer provides the hypotheses. The RL layer tests whether weight-level changes outperform prompt-level changes. Both layers feed the same evaluation metrics and skill_events pipeline.

The discipline: **never invest in Layer 2 infrastructure that doesn't also serve Layer 1.** The experiment task type serves both. The evaluation metrics serve both. The skill_events logging serves both. If Layer 2 turns out to be a sunk cost, Layer 1 still benefited from every piece of infrastructure built. If Layer 2 produces durable value, Layer 1 produced the hypotheses that made Layer 2 efficient.

---

## Part VI — Design Implications

Each observation maps to a constraint on PRECEPT's design. These are not aspirations. They are requirements.

| Truth | Implication | Structural Expression |
|---|---|---|
| Inference becomes free | Never couple architecture to model cost. No "use cheaper model for X." Role assignments are capability-based, not cost-based. | `role_config.model_tier` is a string, not a cost tier. `endpoint_override` enables multi-device routing. |
| Context becomes unlimited | The Scribe's role evolves from compression to synthesis to passthrough. Don't build systems that depend on compression. | `ScribeMode: 'compress' \| 'synthesize' \| 'passthrough'` — the mode flag controls the transition. |
| Every agent is maximally capable | Workers can originate strategic insight. The "workers don't make strategy" rule must be relaxable. | `trust_autonomy` spectrum: `execute_only` → `autonomous_bounded`. Field signals provide the upward channel. |
| Mass entrepreneurship | The system serves a single owner with no technical staff. Every interaction must be 30-minutes-or-less accessible. | The Interface: one textarea, one briefing, inspect links for depth. Never build a dashboard that requires a team to interpret. |
| Data compounds | Every execution cycle must feed the self-learning loop. Lost data is lost compound interest. | `skill_events` table logs every skill lifecycle event. Evaluation metrics track catch rates. Institutional memory is append-only. |
| Owner time is finite | The CEO must maximize return per minute of owner attention. Never waste the owner's time. | `OwnerTimeBudget` type. CEO prompt reframe from compute budget to time budget. Briefing contract: 10 minutes or less. |
| Passion drives everything | The Cornerstone interview quality is the highest-leverage event in the system lifecycle. | Root surfacing before business details. Precepts quality as upstream dependency for all downstream performance. |
| Alignment scales super-linearly | Better models need better Precepts more, not less. The Precepts quality bar increases with capability. | Periodic Precepts review — the CEO proposes updates based on operational evidence. Owner approves. |
| Adversarial eval is permanent | Never combine planning and evaluation, regardless of model capability. | `separation_policy` defaults to `'always'` for high-stakes. The dual-gate structure survives model upgrades. |
| The skill library is IP | Skills must be portable, versioned, and durable. They are the organization's competitive advantage. | Skills in monorepo (git-versioned). Curator autonomy for refinement. Skill history preserved permanently. |
| Never a middle manager | The owner is the Board, not a manager. PULL not PUSH. Pop in, pop out. The system runs without them. | Board Request ceiling (max 2 per cycle). Escalation absorption (only foundation_problem reaches owner). Briefings absorb missed days. No backlog. No guilt. CEO tracks its own owner-attention cost and trends downward. |
| Optimize autonomously | The system improves itself without the owner engineering the improvement. Fast experimentation beats slow observation. | Experiment task type. Curator A/B tests with 3-day cycles. Layer 1 (prompt) now, Layer 2 (weights) when local compute arrives. Never build Layer 2 infra that doesn't also serve Layer 1. |
| Skills are an ecosystem | Skill format follows agentskills.io open standard. Community skills installable. Curator output publishable. Network effects compound across orgs. | YAML frontmatter follows spec. PRECEPT-specific fields in `metadata`. Skills portable to/from any agentskills.io-compatible agent. |
| Memory policies are learned | Hand-written memory rules (fixed thresholds, cron schedules) are scaffolding. The trajectory is agent-decided memory operations refined by the Curator. | Memory management as a skill domain. CEO memory tools (store, update, deprecate, retrieve). Curator refines memory-management skills from evaluation patterns. Staleness thresholds, retrieval strategies, and storage criteria emerge from organizational experience. |
| Dedicated hardware, never shared | The org has `bash_execute`. Workers run arbitrary shell. The owner's personal machine must never be the org's machine. Network boundary, not filesystem boundary. | Mac Mini = org machine. Owner accesses via `app.precept.so` from separate personal machine. No VPS — local hardware is load-bearing for the inference and security trajectory. |

---

## Part VII — What This Means for Each Document

### For `structure.md`

Add two foundational principles:

**"Owner time is the permanent scarce resource."** The entire hierarchy exists to maximize the return on the owner's 30 minutes per day. The CEO's effectiveness is measured not by task throughput but by how much organizational value is produced per minute of owner attention consumed.

**"The owner is the Board, never the manager."** If using PRECEPT feels like managing a team, something is broken. The CEO layer exists to absorb all coordination overhead. The owner approves strategy, provides judgment on values questions, and maintains contact with the work. The owner does not field escalations, answer agent questions, or manage workflow. The structural protections (Board Request ceiling, escalation absorption, briefing absorption, PULL-not-PUSH interaction model) are not features — they are the organizational boundary between the Board tier and everything below it.

The `trust_autonomy` gradient should be described as the structural mechanism by which the owner's role evolves from Operator to Visionary. This is not a convenience feature — it is the system's primary value proposition over time.

### For `orchestration.md`

Replace all "compute budget" language with "owner time budget." The CEO plans against the owner's attention budget, not an API bill. The Advisor evaluates plans partly on owner time cost — a plan that produces excellent results but requires 2 hours of daily owner attention is worse than a plan that produces good results with 20 minutes.

Add the middle-manager structural protections: Board Request hard ceiling (max 2 per briefing cycle — enforced in the CEO planning prompt and validated by the engine), escalation absorption rules (only `foundation_problem` escalations reach the owner; the CEO resolves `spec_problem`, `capability_problem`, and `strategy_problem` autonomously), and briefing absorption (if the owner misses a briefing, the next briefing incorporates the missed content — no backlog accumulates).

Add the `experiment` task type to the task lifecycle. Experiments have two or more variants, a defined metric, a sample size, and a success threshold. The Dispatcher routes tasks to variants. The Judge evaluates. The Curator promotes winners. The engine tracks experiment state alongside initiative state.

The engine's concurrency model should be documented as configurable, with defaults matching current behavior. When inference is free, the engine configuration should support multi-draft workers, speculative evaluation, and parallel planning paths — all controlled by flags, not code changes.

### For `onboarding.md`

The Cornerstone interview becomes even more critical when capability is commoditized. The document should note that in a world where every person has access to the same SOTA model, the quality of the Cornerstone is the *only* differentiator between organizations. Two founders in the same market, same model, same structure — the one whose Cornerstone captured real conviction builds a coherent organization. The one whose Cornerstone captured a business plan builds a functional one. The difference compounds over months.

### For `skills.md`

**Adopt the agentskills.io open standard.** Migrate PRECEPT's skill frontmatter to the agentskills.io YAML format. The `name` and `description` fields become top-level. PRECEPT-specific fields (`scope`, `role`, `status`, trigger tags, quality criteria, anti-patterns) move into a `metadata` block. The markdown body (procedure, criteria, anti-patterns) remains freeform — no changes needed. This makes every skill installable by any agentskills.io-compatible agent and makes the Curator's output publishable to community registries.

Add a section on skills as organizational IP. The skill library is portable, versioned, and the primary non-commoditized asset in the system. Describe the compounding loop explicitly: better skills → better output → richer evaluation signal → more precise skill refinement → better skills. The rate of this loop is the system's long-term growth rate.

The Curator's autonomy is critical in this frame — skills that require owner approval for every refinement accumulate too slowly. The Curator creates and refines autonomously; the evaluation pipeline catches bad skills through downstream results.

Add the experimentation loop as a Curator capability. The Curator doesn't just passively observe patterns and refine skills weekly. It actively creates skill variants, requests the CEO to commission experiments, and promotes winners based on measured outcomes. This transforms the Curator from an observer into an optimizer. Add "memory management" as an explicit skill domain — the Curator refines not just how workers do tasks, but how the organization manages its own memory (retrieval strategies, staleness thresholds, storage criteria).

### For `orchestration.md` (Sprint 6 additions)

Add CEO `search_planning_history` tool — on-demand full-text search across the audit log and decision log using Postgres native FTS (`tsvector`, `ts_query`). The CEO currently reads whatever the Scribe compresses for it; it cannot search its own planning history flexibly. The CEO calls this tool when it needs to recall a past decision, check whether a strategy was tried before, or find the context behind a previous initiative. This follows the "memory as tools, not hidden infrastructure" principle — the CEO decides when it needs to look back and what to search for.

Add Curator escalation fast-path. When a task escalates and the CEO diagnoses it as a `spec_problem` rooted in a loaded skill, the Curator gets a synchronous signal — not a batch observation. The Curator can propose an immediate skill patch (through the experiment/variant system, not a blind rewrite) rather than waiting for the weekly cycle. This tightens the feedback loop from "a week later, one data point among many" to "hours after the failure, targeted patch." The escalation diagnosis from the CEO is the signal. The Curator acts on that signal faster but still through the proper quality pipeline.

### For `memory.md`

Reframe all hard-coded memory policies (30-day staleness, top-5 retrieval, cosine 0.95 dedup) as *initial policies* subject to Curator refinement. These are starting points, not final answers. The Curator will learn domain-specific policies through the memory-management skill domain.

Add **bounded role summaries** as a new memory artifact. Currently, workers receive top-K role memory entries by cosine similarity per task — this requires a retrieval step, adds latency, and introduces retrieval quality risk (wrong entries surfaced). The role summary is a compressed, bounded text block (~1000 tokens) that captures the most important domain knowledge for each worker role. It goes directly into the worker's system prompt as baseline context — no retrieval needed. The full role memory remains searchable for task-specific supplementation.

The Curator produces role summaries periodically (weekly, aligned with its batch cycle). It reads the full role memory for a given role, identifies the highest-value entries (most retrieved, most correlated with accepted output), and distills them into a dense summary. The summary is versioned and stored alongside the role memory. When the Dispatcher assembles a worker's context package, it includes the role summary as baseline + task-specific retrieved entries as supplement. The summary replaces the need for retrieval on generic domain knowledge; retrieval handles task-specific recall.

This pattern comes from observing bounded memory systems that prioritize *always-present curated knowledge* over *searchable-but-absent knowledge*. A worker that always knows the 10 most important things about its domain is more reliable than a worker that might retrieve 5 relevant things or might retrieve 5 irrelevant things, depending on embedding quality and query phrasing.

Add Sprint 6 items: CEO `search_planning_history` tool (Postgres native FTS on audit log and decision log). Curator escalation fast-path (synchronous skill review on escalation diagnosis).

### For `interface.md`

The Interface is designed for a person who has 30 minutes per day. Every screen answers: "What do I need to know or decide right now?" — this principle becomes load-bearing when the person using it is a solo entrepreneur, not a manager with a team.

Add the "Estimated review time" contract to the briefing format. The CEO's daily letter should state upfront how many minutes it will take and how many decisions it requires. If the briefing would take more than 15 minutes to review, the CEO is including too much.

### For `security.md`

When everything runs locally, the three-tier classification model collapses. Document this transition: V0.1 (cloud, three tiers) → V2 (local, simplified). The security model's durable contribution is data isolation between orgs in the feudal model, not classification routing.

Add the dedicated hardware boundary as a security requirement: **"The engine runs on dedicated hardware. The owner does not share a machine with the org."** Workers have `bash_execute` — they run arbitrary shell commands. Even with workspace isolation (`/tmp/precept/tasks/`), that's process-level sandboxing, not real isolation. A buggy or malicious skill script could read files outside the workspace, access environment variables containing API keys, or consume unbounded resources. The owner's personal files, communications, browser sessions, and credentials must never exist on the same machine as the org's execution environment. The owner interacts with the org through The Interface (`app.precept.so`) and email — a network boundary, not a filesystem boundary. The Mac Mini is the org's machine. The owner's personal machine is separate. When the Mac Studio arrives, it becomes the org's compute upgrade. The separation is permanent.

### For `passion.md`

Add a section: **"Owner time as sacred resource."** The system's respect for the owner's time is an expression of the same principle as the sign-off model. The owner is building something — not spectating. Wasting their time is wasting their building hours. The 30-minute daily commitment is not a minimum to demand. It is a maximum to protect.

### For `techstack.md`

Remove any language about cost-per-token as a planning constraint. Add multi-endpoint routing description. Note that model routing is driven by `role_config` table, not hard-coded in service files. The stack should be described in a way that makes the SOTA-on-iPhone transition visible — when local inference arrives, the changes are: point `endpoint_override` at local server, set all `model_tier` to the same value, set Scribe to `'passthrough'`. Three config changes, not a migration.

Add to the infrastructure section: **"The org runs on dedicated hardware."** No VPS — the local hardware path is load-bearing for the `future.md` trajectory (zero-cost inference, RESTRICTED data on-device, no cloud dependency). The Mac Mini is the org's machine. Owner accesses via `app.precept.so` from a separate personal machine. Hardware roadmap: Mac Mini (V0.1) → Mac Studio joins as compute upgrade (V2) → Mac Mini becomes secondary node or repurposed. The owner's machine is never in this chain.

Add a section on the Mac Studio as the RL compute tier. When it arrives, the hardware roadmap gains a new capability: RL fine-tuning of local open-source models for worker-tier roles. The training infrastructure (experiment task type, evaluation metrics, skill_events logging) is already built for Layer 1 (prompt-level) optimization. Layer 2 (weight-level) adds: a training script managed by the Coder worker, a fixed-time training budget (mirroring the autonomous research pattern), and Judge evaluation of fine-tuned model output vs. frontier model output. The `role_config.endpoint_override` field routes specific worker roles to the fine-tuned local model. If the local model underperforms the frontier, discard and keep the frontier. The infrastructure serves Layer 1 regardless.

---

## Part VIII — The Limit of This Document

This document describes a future that has not arrived. It will be wrong in specifics. The timeline may be faster or slower. The devices may be different. The market dynamics may surprise.

What will not be wrong:

Models will get better, cheaper, and more local. People will be displaced from employment. Some of them will build. They will need infrastructure. The infrastructure that serves them best will be the one that takes their time seriously, takes their passion seriously, and compounds their organizational knowledge over time.

PRECEPT is being built for those people. Not for the world as it is now — for the world as it will be when they need it.

The decisions made today — the types that are flexible enough, the configs that are wide enough, the prompts that optimize for the right scarce resource — determine whether PRECEPT is ready for them when they arrive. Building for the present is easier. Building for the trajectory is the only kind of building that compounds.

Isaiah 28:10 again: *precept upon precept, line upon line.* Each line built today is a foundation for lines that don't exist yet. The discipline is to lay them straight, knowing they will bear weight we cannot fully anticipate.

By God's grace, the foundation will hold.
