# Codebase Structure

## Monorepo Layout
```
precept/
├── packages/
│   ├── shared/        — TypeScript types (Precepts, Onboarding, Audit)
│   │   └── src/
│   │       ├── index.ts          — barrel export
│   │       ├── precepts.ts       — PreceptsDraft, PreceptsField, PRECEPTS_FIELDS
│   │       ├── onboarding.ts     — OnboardingSession, ConversationMessage, ExtractionTracker
│   │       └── audit.ts          — AuditEvent types
│   ├── engine/        — Hono REST API + AI orchestration
│   │   └── src/
│   │       ├── index.ts                — Hono app, CORS, health check
│   │       ├── ai/
│   │       │   ├── client.ts           — OpenAI SDK configured for CLIProxy
│   │       │   └── prompts/
│   │       │       └── ceo-onboarding.ts — System/user prompt builders
│   │       ├── db/
│   │       │   ├── client.ts           — Supabase client
│   │       │   ├── onboarding.ts       — Session CRUD (snake_case mapping)
│   │       │   ├── precepts.ts         — Precepts table writes
│   │       │   └── audit.ts            — Fire-and-forget audit logging
│   │       ├── routes/
│   │       │   ├── onboarding.ts       — 4 REST endpoints
│   │       │   └── __tests__/
│   │       └── services/
│   │           ├── onboarding.ts       — OnboardingService class (core business logic)
│   │           └── __tests__/
│   └── web/           — Next.js frontend
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── page.tsx            — Landing/redirect
│           │   ├── globals.css
│           │   └── onboarding/
│           │       └── page.tsx        — 3-view state machine (chat → confirm → done)
│           ├── components/
│           │   ├── ui/                 — ShadCN primitives (Button, Input, Textarea, Select)
│           │   ├── chat/               — ChatPanel, ChatMessage
│           │   └── precepts/           — PreceptsPanel, PreceptField, ConfirmationView
│           └── lib/
│               ├── api.ts              — Engine API client
│               └── utils.ts            — cn() helper
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 00001_onboarding_schema.sql — 3 tables: sessions, precepts, audit_events
├── docs/
│   └── techstack.md                    — Full architecture & decisions doc
├── conductor.json                      — Conductor workspace config
├── package.json                        — Bun workspace root
├── tsconfig.base.json                  — Shared TS config
└── .env.example
```

## Key Architectural Patterns
- **Shared package** points directly to TS source (`"main": "src/index.ts"`) — no build step for consumers
- **Engine** conditionally starts server (`NODE_ENV !== 'test'`) for test isolation
- **DB layer** maps camelCase ↔ snake_case between TS types and Postgres columns
- **Audit logging** is fire-and-forget: failures go to stderr, never thrown
- **AI client** uses OpenAI SDK pointed at CLIProxy's base URL
- **CORS** reflects any origin (`origin: (origin) => origin`) for Conductor dynamic ports
