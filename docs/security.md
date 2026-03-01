---
date: 2026-03-01
project: precept
status: approved
---

# PRECEPT V0.1 — Security Model

How data is classified, routed, stored, and protected.

## Data Classification — Three Tiers

Every piece of data in the system is tagged with a classification level. This classification drives routing, storage, and access decisions.

### 🟢 PUBLIC
If a competitor saw it, wouldn't matter. General knowledge, publicly available info, generic templates, open-source code.

### 🟡 INTERNAL
Valuable if leaked but not catastrophic. Business strategy, Precepts content, agent outputs, outreach drafts, competitive analysis, initiative plans, worker outputs, evaluation verdicts.

### 🔴 RESTRICTED
Real damage if exposed. Customer PII, financial data, legal docs, API keys/credentials, proprietary algorithms, personal data, contracts, payment information.

### V0.1 Rule: RESTRICTED Data Does Not Enter the System

In V0.1, the system operates exclusively with 🟢 and 🟡 data. When the CEO encounters a task that would require 🔴 data, it creates a Board Request for the owner to handle manually.

This makes cloud hosting (Supabase, Vercel) and external API routing (CLIProxy → Anthropic servers) acceptable — no RESTRICTED data flows through any external service.

## AI Routing — CLIProxy

All AI calls in V0.1 route through CLIProxy, a local proxy that exposes Claude models via the Claude Max subscription ($200/mo flat).

```
┌──────────────────────────────────────────────────────┐
│                    CLIProxy                           │
│           (OpenAI-compatible API endpoint)            │
│                                                      │
│  Authenticates via OAuth to Claude Max subscription  │
│  All AI calls route through this single gateway      │
│                                                      │
│  ┌─────────────────┐    ┌─────────────────┐         │
│  │  Opus 4.6        │    │  Sonnet 4.6      │         │
│  │                  │    │                  │         │
│  │  CEO             │    │  Scribe          │         │
│  │  Judge           │    │  Workers         │         │
│  │  Reviewer        │    │                  │         │
│  │  Dispatcher      │    │                  │         │
│  │  Advisor         │    │                  │         │
│  └─────────────────┘    └─────────────────┘         │
└──────────────────────────────────────────────────────┘
```

**Source:** https://github.com/router-for-me/CLIProxyAPI

**Key properties:**
- OpenAI-compatible API format — engine calls it like any standard API
- Supports streaming and non-streaming responses
- Supports function calling / tool use
- Multi-account load balancing available if needed
- No per-token costs — covered by Max subscription

**No OpenRouter in V0.1.** All models are Claude (Opus 4.6, Sonnet 4.6). OpenRouter becomes relevant in future versions for specialized models or local inference routing.

## Trust Boundaries

Every external service is a trust boundary where data crosses from PRECEPT's control to a third party.

### V0.1 Trust Map

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  CLIProxy → Anthropic Servers                                    │
│  ┌──────────────────────────────────────┐                       │
│  │ HIGHEST TRUST                         │                       │
│  │                                       │                       │
│  │ Data flowing through:                 │                       │
│  │ • Precepts content (CEO context)      │                       │
│  │ • Strategic plans (CEO output)        │                       │
│  │ • All evaluations (Judge, Reviewer)   │                       │
│  │ • Task specs and worker outputs       │                       │
│  │ • Scribe compressions                │                       │
│  │ • Dispatcher routing decisions        │                       │
│  │                                       │                       │
│  │ Single trust boundary for ALL AI.     │                       │
│  │ Anthropic's data policies apply.      │                       │
│  └──────────────────────────────────────┘                       │
│                                                                  │
│  Supabase                            AgentMail                   │
│  ┌──────────────────────┐           ┌──────────────────────┐    │
│  │ HIGH TRUST            │           │ MEDIUM TRUST          │    │
│  │                       │           │                       │    │
│  │ Stores ALL persistent │           │ Data flowing through: │    │
│  │ state:                │           │ • Daily briefings     │    │
│  │ • Audit log           │           │ • Owner replies       │    │
│  │ • Precepts            │           │ • Board Requests      │    │
│  │ • Decision/lesson logs│           │                       │    │
│  │ • Role memory + embeds│           │ Contains: initiative  │    │
│  │ • Performance profiles│           │ summaries, decisions  │    │
│  │ • Task state          │           │ needed, status updates│    │
│  │                       │           │                       │    │
│  │ Encrypted at rest     │           │ Encrypted in transit  │    │
│  │ + in transit          │           │ SPF/DKIM/DMARC        │    │
│  └──────────────────────┘           └──────────────────────┘    │
│                                                                  │
│  Vercel                                                          │
│  ┌──────────────────────┐                                       │
│  │ LOW SENSITIVITY       │                                       │
│  │ Serves UI. API calls  │                                       │
│  │ to engine, not direct │                                       │
│  │ DB access.            │                                       │
│  └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

**V0.1 simplification:** All AI traffic flows through a single trust boundary (CLIProxy → Anthropic). No OpenRouter means no secondary AI trust boundary. This reduces the attack surface compared to the original multi-provider design.

## Classification Rules

### Who Classifies

- **CEO** classifies tasks at creation time based on guidelines in its system prompt
- Classification guidelines are defined by the owner during onboarding (part of Precepts)
- CEO can **upgrade** classification (🟢 → 🟡) but **cannot downgrade** (🔴 → 🟡)
- Only the **owner** can set or change classification policies

### Classification Levels

**Precepts level:** Sections classified during onboarding.
- Identity, product, strategy → 🟡 INTERNAL
- Financial details, personal data → 🔴 RESTRICTED (excluded from V0.1)

**Task level:** CEO tags each task at creation.
- Research on public companies → 🟢 PUBLIC
- Outreach draft mentioning pricing strategy → 🟡 INTERNAL
- Task requiring customer contracts → 🔴 RESTRICTED → Board Request

**Routing level:** Engine checks classification before processing.
- 🟢 → processed normally
- 🟡 → processed normally (all V0.1 services are trusted for INTERNAL data)
- 🔴 → **blocked**. Engine creates Board Request to owner. Data does not enter the system.

## Information Compartmentalization

The organizational hierarchy doubles as a security model. Each role sees only what it needs.

| Role | Can Access | Cannot Access |
|---|---|---|
| **Board (Owner)** | Everything | — |
| **CEO** | Precepts, Scribe output, lesson artifacts, owner feedback, decision log, initiative state | Raw audit log detail, Board Advisor memos about its own performance |
| **Board Advisor** | CEO's proposed plan, Precepts, decision log, performance data, lesson artifacts | Worker-level details, task outputs |
| **Dispatcher** | CEO's plan, dependency graph, worker performance profiles, task state | Precepts, strategic rationale, evaluation details |
| **Scribe** | Raw audit log, initiative state, performance data, lesson artifacts | Precepts |
| **Reviewer** | Worker output, task spec, role memory (domain context) | CEO planning, strategic rationale, other workers' outputs |
| **Judge** | Reviewer-approved output, task spec, acceptance criteria | CEO planning rationale (prevents bias) |
| **Workers** | Their own task spec, chain context, relevant role memory, Team Bulletin | Other workers' outputs, evaluations, strategic plans, Precepts |

**Workers never see the full picture.** They get a task spec and relevant context — nothing about strategy, other workers, or evaluations. If a worker's context were leaked, the exposure is limited to one task's scope.

**The Judge never sees CEO reasoning.** This is structural (prevents evaluation bias) and security (limits what any single role can reconstruct about the full decision chain).

## Storage Security

### Supabase Configuration

- **Encryption at rest:** Supabase default (AES-256)
- **Encryption in transit:** TLS for all connections
- **Row-Level Security (RLS):** Enabled. Policies enforce access levels per agent tier. The engine uses scoped service roles.
- **Audit log protection:** Append-only at the database level. INSERT only — no UPDATE or DELETE operations permitted. Enforced via Postgres policies.

### Credential Management

V0.1 has fewer credentials to manage than the original multi-provider design:

| Credential | Stored In | Purpose |
|---|---|---|
| CLIProxy OAuth tokens | Fly.io env vars (encrypted) | All AI model calls |
| Supabase service role key | Fly.io env vars (encrypted) | Database access |
| AgentMail API key | Fly.io env vars (encrypted) | Email send/receive |
| Vercel deploy token | GitHub secrets (encrypted) | Frontend deployment |

**Key rules:**
- Credentials never appear in code, logs, or database records
- Audit log records "API call made to [service]" — never the credential itself
- If a credential is suspected compromised → rotate immediately, audit recent activity
- Rotation cadence: quarterly, or immediately on suspected compromise

### Frontend Security

- Owner authentication to the Decision Room (implementation TBD — session-based auth or passkey for single-user system)
- HTTPS enforced (Vercel default)
- API calls from frontend to engine authenticated via session token
- No direct database access from frontend — all queries go through engine API

## V2 Migration — Local Infrastructure

When the Mac Studio arrives, the security model upgrades to handle RESTRICTED data.

```
V0.1 (current):                    V2 (Mac Studio):
  🟢 → CLIProxy (any model)          🟢 → any route
  🟡 → CLIProxy + Supabase           🟡 → cloud OR local
  🔴 → BLOCKED (Board Request)       🔴 → LOCAL ONLY (never touches cloud)
```

### What Changes in V2

- **Database:** Migrates from Supabase to local Postgres. `pg_dump` → restore.
- **Audit log:** Gets proper RESTRICTED treatment — local only, encrypted with separate key, owner auth required for access.
- **RESTRICTED tasks:** Route to local inference models. Never touch cloud services.
- **Classification routing:** Same three-tier model, just a config change in routing rules.
- **Leadership tier:** May stay on Anthropic API (via CLIProxy or direct) — their data is strategic (🟡), not PII/financial (🔴).

### What Doesn't Change

- The three-tier classification model
- The access levels per role
- Information compartmentalization
- Audit logging behavior
- The organizational structure

The security model is designed to be upgraded, not replaced. V0.1 is the constrained version (no RESTRICTED data). V2 lifts the constraint by adding local processing capability.
