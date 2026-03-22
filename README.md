<p align="center">
  <img src="packages/web/public/PRECEPT Logo Transparent.svg" alt="PRECEPT" width="200" />
</p>

<p align="center">
  <em>Precept upon precept, line upon line.</em><br/>
  <sub>Isaiah 28:10</sub>
</p>

---

**Leadership is propagating values at scale.**

PRECEPT is an agentic organization. Not an agent framework, not a chatbot, not a task runner — an organization. It has a CEO that plans, workers that execute, reviewers that evaluate, and an owner (you) who governs.

You lay the Cornerstone through a conversation. PRECEPT surfaces your Root — why you couldn't not build this — then extracts your vision into a structured document capturing your identity, product, goals, constraints, and priorities. From that point forward, the organization operates: planning initiatives, dispatching work, producing deliverables, reviewing quality, learning from results, and reporting back to you.

You give direction and the system acts. Daily briefings keep you informed. The Interface lets you steer — ask questions, give commands, inspect deliverables, redirect work. The organization runs on its own between your inputs, but it's always aimed at your Root.

## The Cornerstone

The first conversation. The CEO agent interviews you — not as a form, but as a real dialogue. It starts with The Root: *"Before we talk about the business, I want to understand you. What is it about this that you couldn't walk away from?"* Then it moves through identity, product, reality, ambition, and constraints. The result is the Cornerstone — the document every agent reads before making a decision.

A shallow Cornerstone produces a misaligned organization. A Cornerstone that captures the real conviction produces an organization aimed at something that matters. This is the highest-leverage moment in the system.

## How It Works

**Planning.** The CEO reads the Cornerstone — Root first — along with current state, past lessons, and your latest input. It produces a phased plan. A Board Advisor reviews for blind spots before execution begins.

**Execution.** Workers (Researcher, Coder, Writer, Analyst, Ops) execute tasks using skills — procedural knowledge bundled with executable scripts. A Dispatcher assigns the right worker and the right skills to each task.

**Evaluation.** Every piece of work passes through two independent gates. The Reviewer checks craft quality. The Judge checks whether it meets the spec. Work that doesn't pass gets reworked or escalated.

**The Interface.** A letter from your CEO. An input box. That's it. You read what happened, give direction, and inspect any deliverable via drill-down links. Tell the CEO to do something and it creates the task immediately. Available as a PWA on your phone.

## Architecture

```
BOARD (You)
  │
  ├── Board Advisor — reviews CEO plans for strategic errors
  │
  └── CEO (Opus) — plans, briefs, escalates, creates tasks on your command
        │
        ├── Reviewer — craft quality gate
        ├── Judge — outcome evaluation gate
        ├── Scribe — compresses operational state for CEO context
        ├── Curator — maintains organizational memory quality
        ├── Dispatcher — assigns workers and skills to tasks
        │
        └── Workers (Sonnet) — Researcher, Coder, Writer, Analyst, Ops
```

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, plain CSS, PWA |
| Engine | Hono (TypeScript), event-driven orchestration |
| Database | Supabase (Postgres + pgvector) |
| AI | Claude Opus + Sonnet via CLIProxy |
| Email | Resend (per-org branded domains) |
| Hosting | Local Mac Mini + Cloudflare Tunnel |

## Multi-Org

PRECEPT runs multiple businesses from one installation. Each org has its own Cornerstone, its own credentials, its own email domain, and its own GitHub organization. The structure doesn't change — only the Cornerstone does.

## Setup

See [`docs/setup.md`](docs/setup.md) for full installation and configuration.

## Getting Started

See [`docs/setup.md`](docs/setup.md) for full installation and configuration. Quick overview:

1. Clone the repo and run `bun install`
2. Copy `.env.example` to `.env` and fill in your credentials (Supabase, Resend, CLIProxy)
3. Run `bun run dev:engine` and `bun run dev:web`
4. Open `http://localhost:3000` and onboard your first organization

## Status

**V0.1** — Active development.

## License

MIT — see [LICENSE](LICENSE).
