---
date: 2026-03-01
project: precept
status: approved
version: "0.1"
---

# PRECEPT V0.1 — Tech Stack

## Architecture

Monorepo with separate services. Shared TypeScript types across frontend and engine.

```
precept/
  packages/
    web/        — Next.js (onboarding UI, Decision Room dashboard)
    engine/     — Standalone TS service (orchestration, scheduling, agents)
    shared/     — Types, Precepts schema, constants
```

## Stack

| Layer | Choice | Cost | Notes |
|---|---|---|---|
| Frontend | Next.js on Vercel | Free | Single-user dashboard + onboarding UI |
| Engine | Standalone TS service on Fly.io (Docker) | Free | Orchestration, scheduling, agent dispatch |
| Database | Supabase (Postgres + pgvector) | Free | Relational data + vector embeddings for role memory |
| AI (all models) | CLIProxy → Claude Max subscription | $200/mo (flat) | All AI calls through one gateway. No per-token costs. |
| Email | AgentMail | Free | Daily briefings + structured reply parsing via webhooks |
| Monorepo tooling | bun workspaces | — | Shared types, single install, native TS execution |

**Total cost: $200/mo (Claude Max subscription). All hosting is free tier.**

### AI Model Routing

All AI calls route through CLIProxy, which proxies the Claude Max subscription via OpenAI-compatible API endpoints.

| Role | Model | Purpose |
|---|---|---|
| CEO | Opus 4.6 | Onboarding interview, strategic planning, initiative decomposition |
| Judge | Opus 4.6 | Outcome evaluation (spec compliance) |
| Reviewer | Opus 4.6 | Craft quality evaluation |
| Dispatcher | Opus 4.6 | Task routing, dependency management, skill selection |
| Board Advisor | Opus 4.6 | Weekly plan review |
| Scribe | Sonnet 4.6 | Context compression for CEO |
| Curator | Sonnet 4.6 | Skill creation and refinement from evaluation patterns (see `skills.md`) |
| Workers | Sonnet 4.6 | Task execution (Researcher, Coder, Writer, Analyst, Ops) |

**CLIProxy source:** https://github.com/router-for-me/CLIProxyAPI

**No OpenRouter in V0.1.** Single AI gateway simplifies auth, trust boundaries, and debugging. OpenRouter becomes relevant in future versions for specialized models or local inference routing.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OWNER (Board)                               │
│                   Reviews, approves, redirects                      │
└──────────┬──────────────────────────────────┬───────────────────────┘
           │ Web UI                           │ Email reply
           ▼                                  ▼
┌─────────────────────┐            ┌─────────────────────┐
│   Next.js Frontend  │            │     AgentMail       │
│   (Vercel — free)   │            │     (free tier)     │
│                     │            │                     │
│ • Onboarding chat   │            │ • Daily briefings   │
│ • Decision Room     │            │ • Reply → JSON      │
│ • Precepts editor   │            │ • Webhook to engine │
└────────┬────────────┘            └──────────┬──────────┘
         │ API calls                          │ Webhooks
         ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PRECEPT ENGINE                                   │
│                  (Fly.io — Docker — free)                            │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐               │
│  │  Scheduler   │  │  Webhook    │  │  Task Queue  │               │
│  │  (node-cron) │  │  Handler    │  │  & Dispatch  │               │
│  └──────┬───────┘  └──────┬──────┘  └──────┬───────┘               │
│         │                 │                │                        │
│         ▼                 ▼                ▼                        │
│  ┌──────────────────────────────────────────────┐                  │
│  │           Orchestration Core                  │                  │
│  │                                               │                  │
│  │  • Context assembly (Precepts + state)        │                  │
│  │  • CEO cycle execution                        │                  │
│  │  • Dispatcher task routing                    │                  │
│  │  • Reviewer quality evaluation                │                  │
│  │  • Judge outcome evaluation                   │                  │
│  │  • Board Advisor review (weekly)              │                  │
│  │  • Scribe context compression                 │                  │
│  │  • Curator skill extraction (weekly batch)    │                  │
│  │  • Briefing compilation                       │                  │
│  └──────────────────┬────────────────────────────┘                  │
│                     │                                               │
└─────────────────────┼───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIProxy                                      │
│              (OpenAI-compatible API gateway)                          │
│              Claude Max subscription — $200/mo flat                   │
│                                                                     │
│  ┌───────────────────────────┐  ┌───────────────────────────┐      │
│  │  Opus 4.6                  │  │  Sonnet 4.6                │      │
│  │                            │  │                            │      │
│  │  • CEO                     │  │  • Scribe                  │      │
│  │  • Judge                   │  │  • Workers (all types)     │      │
│  │  • Reviewer                │  │                            │      │
│  │  • Dispatcher              │  │  Fallback: Haiku 4.5       │      │
│  │  • Board Advisor           │  │  (if rate limits hit)      │      │
│  └───────────────────────────┘  └───────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
                      │
                      │ Read/write
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Supabase (free tier)                             │
│                  Postgres + pgvector                                 │
│                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────────────┐ │
│  │  Precepts  │ │  Audit Log │ │ Initiatives│ │  Role Memory    │ │
│  │  (doc)     │ │  (append)  │ │ & Tasks    │ │  (pgvector)     │ │
│  ├────────────┤ ├────────────┤ ├────────────┤ ├─────────────────┤ │
│  │  Decision  │ │  Agent     │ │  Lesson    │ │  Skill Index    │ │
│  │  Log       │ │  Profiles  │ │  Artifacts │ │  (metadata)     │ │
│  ├────────────┤ └────────────┘ └────────────┘ ├─────────────────┤ │
│  │  Team      │                               │  Skill files    │ │
│  │  Bulletin  │                               │  (.md in repo)  │ │
│  └────────────┘                               └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow Summary

1. **Scheduled cycle:** node-cron triggers → Scribe compresses context from Supabase → CEO plans via CLIProxy (Opus) → Dispatcher routes tasks → Workers execute via CLIProxy (Sonnet) → Reviewer evaluates → Judge evaluates → results stored in Supabase → briefing compiled → sent via AgentMail
2. **Owner reply:** owner replies to email → AgentMail parses to JSON → webhook hits engine → engine updates state in Supabase → may trigger CEO cycle
3. **Web interaction:** owner uses Next.js UI → API calls to engine → engine reads/writes Supabase → real-time updates in dashboard

## Key Decisions & Reasoning

### Separate services over single Next.js app
The engine is a long-running orchestration process (scheduled CEO cycles, parallel worker dispatch, webhook processing). This doesn't fit Next.js API routes, which are request-response. Separate processes with shared types via monorepo.

### Postgres + pgvector over standalone vector DB (Chroma)
~90% of data access is relational (audit logs, task tracking, agent profiles, initiative management). Only role memory needs vector search. pgvector handles both in one database. No need for two data stores.

### Supabase over local Postgres
Availability wins at V0.1. The AI CEO must run whether the owner's machine is on or not. Cloud-hosted DB ensures this. Supabase is standard Postgres — `pg_dump` migrates to local when Mac Studio arrives (V2). V0.1 security model excludes RESTRICTED data, so cloud hosting is acceptable.

### CLIProxy + Claude Max over direct API keys or OpenRouter
Claude Max subscription ($200/mo) provides flat-rate access to Opus 4.6 and Sonnet 4.6. CLIProxy exposes these via OpenAI-compatible API endpoints. This eliminates per-token costs entirely and simplifies the architecture to a single AI trust boundary. No OpenRouter needed for V0.1.

### Fly.io over Railway/Render
Always-on free tier (no spindown). Engine needs to receive webhooks reliably and run scheduled CEO cycles. Render free tier spins down after 15 min (breaks webhooks). Railway is $5/mo for equivalent. Fly.io free tier stays on. CEO cycle scheduling via node-cron in the engine.

### AgentMail over Resend
Built-in structured data extraction (email → JSON) handles the hard part: parsing owner's inline replies to briefing emails into actionable decisions. Resend would require building reply parsing from scratch.

## Migration Path (V2 — Mac Studio)

Engine is containerized with Docker from day 1. Migration = `docker-compose up` on local hardware.

- Database: `pg_dump` from Supabase → local Postgres
- Workers: Route to local inference models (via OpenRouter or direct endpoints)
- Leadership tier: May stay on Claude Max/CLIProxy or evaluate local planning models
- RESTRICTED data: Now enters the system via local-only processing
- Cost model shifts: local inference for workers (free compute), API only for leadership calls
