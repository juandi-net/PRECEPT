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
    web/        — Next.js (onboarding UI, The Interface)
    engine/     — Standalone TS service (orchestration, scheduling, agents)
    shared/     — Types, Precepts schema, constants
```

## Stack

| Layer | Choice | Cost | Notes |
|---|---|---|---|
| Frontend | Next.js on Vercel | Free | The Interface + onboarding UI. No component libraries — plain HTML, CSS (Times New Roman), and a textarea. ShadCN retained only for login page. (See `interface.md` for design philosophy) |
| Engine | Standalone TS service on Mac Mini (local) | Free | Orchestration, scheduling, agent dispatch. Runs as macOS launchd service alongside CLIProxy. |
| Tunnel | Cloudflare Tunnel (cloudflared) | Free | Exposes engine webhook endpoint to internet for Resend inbound emails. Runs as macOS launchd service. |
| Database | Supabase (Postgres + pgvector) | Free | Relational data + vector embeddings for role memory |
| AI (all models) | CLIProxy → Claude Max subscription | $200/mo (flat) | All AI calls through one gateway. No per-token costs. |
| Email | Resend | Free | Daily briefings + inbound reply parsing via webhooks. Free tier: 100 emails/day, 1 custom domain, inbound webhooks. |
| Embeddings | EmbeddingGemma 300M via `@huggingface/transformers` | Free | 768-dim vectors for role memory semantic search. Local, in-process, no external API. |
| Monorepo tooling | bun workspaces | — | Shared types, single install, native TS execution |

**Total cost: ~$200/mo (Claude Max only). Engine hosting is now free (local). Tunnel is free (Cloudflare).**

### AI Model Routing

All AI calls route through CLIProxy, which proxies the Claude Max subscription via OpenAI-compatible API endpoints.

| Role | Model | Purpose |
|---|---|---|
| CEO | Opus 4.6 | Onboarding interview, strategic planning, initiative decomposition |
| Judge | Opus 4.6 | Outcome evaluation (spec compliance) |
| Reviewer | Opus 4.6 | Craft quality evaluation |
| Dispatcher | Opus 4.6 | Task routing, dependency management, skill selection |
| Board Advisor | Opus 4.6 | Weekly plan review |
| Scribe | Sonnet | Context compression for CEO |
| Curator | Sonnet | Skill creation and refinement from evaluation patterns (see `skills.md`) |
| Workers | Sonnet | Task execution (Researcher, Coder, Writer, Analyst, Ops) |

**CLIProxy source:** https://github.com/router-for-me/CLIProxyAPI

**No OpenRouter in V0.1.** Single AI gateway simplifies auth, trust boundaries, and debugging. OpenRouter becomes relevant in future versions for specialized models or local inference routing.

**Note on Dispatcher model tier.** The Dispatcher is assigned Opus 4.6, but its job is logistics — dependency graph management, task routing by performance profile, skill selection by tag matching, and tactical adaptation. These are pattern matching and scheduling tasks, not strategic reasoning (that's the CEO and Judge). Sonnet could potentially handle dispatch if the task state machine and dependency graph are well-structured in Supabase. Not urgent at the $200/mo flat rate, but the Dispatcher is the first role to consider downgrading if rate limits become an issue.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OWNER (Board)                               │
│                   Reviews, approves, redirects                      │
└──────────┬──────────────────────────────────┬───────────────────────┘
           │ Web UI                           │ Email reply
           ▼                                  ▼
┌─────────────────────┐            ┌─────────────────────┐
│   Next.js Frontend  │            │       Resend        │
│   (Vercel — free)   │            │    (free tier)      │
│                     │            │                     │
│ • Onboarding chat   │            │ • Daily briefings   │
│ • The Interface     │            │ • Inbound webhook   │
│ • Precepts editor   │            │   → Tunnel → Engine │
└────────┬────────────┘            └──────────┬──────────┘
         │ API calls via tunnel               │ Webhook via tunnel
         ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     MAC MINI (Local)                                 │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │              Cloudflare Tunnel (cloudflared)              │      │
│  │         dev.rookiesports.org → localhost:3001             │      │
│  └──────────────────────┬───────────────────────────────────┘      │
│                         │                                           │
│  ┌──────────────────────▼───────────────────────────────────┐      │
│  │                  PRECEPT ENGINE                           │      │
│  │              (launchd service — port 3001)                │      │
│  │                                                           │      │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐     │      │
│  │  │  Scheduler   │  │  Webhook    │  │  Task Queue  │     │      │
│  │  │  (node-cron) │  │  Handler    │  │  & Dispatch  │     │      │
│  │  └──────┬───────┘  └──────┬──────┘  └──────┬───────┘     │      │
│  │         └─────────────────┼─────────────────┘             │      │
│  │                           ▼                               │      │
│  │              Agent Services (CEO, Judge, etc.)             │      │
│  │                           │                               │      │
│  └───────────────────────────┼───────────────────────────────┘      │
│                              │ localhost AI calls                    │
│  ┌───────────────────────────▼───────────────────────────────┐      │
│  │                    CLIProxy                                │      │
│  │           Claude Max → Opus 4.6 / Sonnet 4.5              │      │
│  └────────────────────────────────────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │    Supabase     │
                    │  (cloud — free) │
                    │  Postgres +     │
                    │  pgvector       │
                    └─────────────────┘
```

### Data Flow Summary

1. **Scheduled cycle:** node-cron triggers → Scribe compresses context from Supabase → CEO plans via CLIProxy (Opus) → Dispatcher routes tasks → Workers execute via CLIProxy (Sonnet) → Reviewer evaluates → Judge evaluates → results stored in Supabase → briefing compiled → sent via Resend
2. **Owner reply:** owner replies to email → Resend sends `email.received` webhook with metadata → engine calls `resend.emails.get(emailId)` to fetch body → engine updates state in Supabase → may trigger CEO cycle
3. **Web interaction:** owner uses The Interface → API calls via tunnel to engine → engine reads/writes Supabase → real-time updates

### Local Services (V0.1)

Three processes run as macOS launchd services on the Mac Mini:

1. **CLIProxy** — AI gateway. Proxies Claude Max subscription via OpenAI-compatible endpoints. Already running.
2. **PRECEPT Engine** — Orchestration, scheduling, agent dispatch. `node packages/engine/dist/index.js` on port 3001.
3. **cloudflared** — Cloudflare Tunnel. Exposes port 3001 at `dev.rookiesports.org` for Resend webhooks and Vercel frontend API calls.

All three auto-start on boot, restart on crash. Engine and CLIProxy communicate via localhost — zero network latency on AI calls.

### Engine Dockerfile (Cloud Migration Path)

3-stage build in repo root `Dockerfile`:
1. **deps** — Bun installs monorepo dependencies from lockfile
2. **build** — `tsc` compiles `packages/shared` then `packages/engine`
3. **runtime** — Node 24 slim runs `dist/index.js` (no Bun at runtime)

Production image contains only compiled JS + production `node_modules`. No source code, no dev dependencies. `PORT=8080` (Fly.io default).

When AI calls move from CLIProxy to direct API, deploy with `fly deploy` from repo root. Only env var changes required — `CLIPROXY_BASE_URL` becomes `ANTHROPIC_API_KEY` + direct SDK calls.

## Key Decisions & Reasoning

### Separate services over single Next.js app
The engine is a long-running orchestration process (scheduled CEO cycles, parallel worker dispatch, webhook processing). This doesn't fit Next.js API routes, which are request-response. Separate processes with shared types via monorepo.

### Postgres + pgvector over standalone vector DB (Chroma)
~90% of data access is relational (audit logs, task tracking, agent profiles, initiative management). Only role memory needs vector search. pgvector handles both in one database. No need for two data stores.

### Supabase over local Postgres
The engine runs locally but the database stays in the cloud — the web UI on Vercel needs direct DB access, and Supabase's free tier eliminates infrastructure management. Supabase is standard Postgres — `pg_dump` migrates to local when Mac Studio arrives (V2). V0.1 security model excludes RESTRICTED data, so cloud hosting is acceptable.

### CLIProxy + Claude Max over direct API keys or OpenRouter
Claude Max subscription ($200/mo) provides flat-rate access to Opus 4.6 and Sonnet 4.5. CLIProxy exposes these via OpenAI-compatible API endpoints. This eliminates per-token costs entirely and simplifies the architecture to a single AI trust boundary. No OpenRouter needed for V0.1.

**Actual model IDs** (as reported by CLIProxy `/v1/models`): `claude-opus-4-6` for CEO/Opus roles, `claude-sonnet-4-5-20250929` for Workers/Scribe/Curator. These are configured in `packages/engine/src/ai/client.ts` and overridable via `CLIPROXY_MODEL_OPUS` / `CLIPROXY_MODEL_SONNET` env vars.

### Local engine over cloud hosting (V0.1)

All AI calls route through CLIProxy on the owner's Mac Mini. Cloud-hosting the engine creates a hard dependency on the Mac being online anyway — the engine is useless without CLIProxy. Running the engine locally eliminates network latency on AI calls and removes a paid hosting dependency.

Cloudflare Tunnel exposes the engine's webhook endpoint (for Resend inbound emails) via a public URL on the org's subdomain (e.g., `dev.rookiesports.org`). The tunnel runs as a macOS launchd service alongside the engine and CLIProxy.

**Cloud migration path (V2+):** When AI calls move from CLIProxy to direct Anthropic API or local inference (Mac Studio), the engine can move to Fly.io or equivalent. The Dockerfile exists in the repo root — migration is `fly deploy` + env var changes. The Dockerfile is a 3-stage build: Bun installs dependencies, `tsc` compiles, Node 24 slim runs production. No code changes required for the migration — only the AI client base URL changes from `localhost` to the cloud inference endpoint.

### Why Resend
Each PRECEPT org needs branded email — `ceo@mail.asylo.com`, `ceo@mail.rookiesports.org` — not a generic platform address. Resend's free tier includes 1 custom domain, inbound email via webhooks, and 100 emails/day. In the multi-org model, each org owner creates their own free Resend account with their own domain, so PRECEPT scales to unlimited orgs at zero email cost. Reply parsing is handled by the CEO via LLM-based intent extraction rather than a built-in email-to-JSON service.

## Migration Path (V2 — Mac Studio / Cloud)

Engine already runs locally. Future migration paths:

- **Cloud hosting (V2+):** Move engine to Fly.io when AI calls use direct Anthropic API instead of CLIProxy. `fly deploy` from repo root — Dockerfile is ready.
- **Database:** `pg_dump` from Supabase → local Postgres
- **Workers:** Route to local inference models (via OpenRouter or direct endpoints)
- **Leadership tier:** May stay on Claude Max/CLIProxy or evaluate local planning models
- **RESTRICTED data:** Now enters the system via local-only processing
- **Cost model shifts:** local inference for workers (free compute), API only for leadership calls
