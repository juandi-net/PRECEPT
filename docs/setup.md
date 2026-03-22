---
date: 2026-03-03
project: precept
status: approved
---

# PRECEPT V0.1 — Setup Guide

This document walks through local development and production setup for a PRECEPT instance running on macOS.

See `techstack.md` for architecture decisions and model routing, `security.md` for data classification and trust boundaries, `orchestration.md` for engine internals and agent services, `interface.md` for briefing format and owner interaction, `onboarding.md` for the initial org interview flow.

---

## 1. Prerequisites

Everything that must be installed or available before starting:

| Dependency | Notes |
|---|---|
| **macOS** | Tested on Mac Mini M-series |
| **Node.js 24+** | Runtime for production engine |
| **Bun** | Package manager and build tool |
| **Git** | Repo access |
| **Cloudflare account** | Free tier — DNS management and tunnel |
| **Resend account** | Free tier — email send/receive (one account per org) |
| **Supabase account** | Free tier — Postgres + pgvector database |
| **Claude Max subscription** | $200/mo — flat-rate AI access |
| **CLIProxy** | Local proxy for Claude Max, exposes OpenAI-compatible API. See [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) |

---

## 2. Clone and Install

```bash
git clone <repo-url>
cd precept
bun install
```

`bun install` resolves the full monorepo workspace: `packages/shared`, `packages/engine`, `packages/web`.

---

## 3. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Enable the pgvector extension — run in the SQL editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Link the project and push migrations:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   This applies all migration files in `supabase/migrations/` (onboarding schema, context documents, skill index, RLS policies, multi-org support, pgvector functions, etc.)
4. Copy the **Supabase URL** and **service role key** from Project Settings > API for use in env vars

V0.1 excludes RESTRICTED data, so cloud-hosted Supabase is acceptable. See `security.md` for the data classification model.

---

## 4. CLIProxy Setup

1. Clone the CLIProxy repo:
   ```bash
   git clone https://github.com/router-for-me/CLIProxyAPI
   cd CLIProxyAPI
   ```
2. Follow the repo's setup instructions to configure with Claude Max session credentials
3. Start CLIProxy — it runs on port **8317** by default
4. Verify:
   ```bash
   curl http://localhost:8317/v1/models
   ```
   This should return a list of available models.
5. The engine expects these model IDs (configured in `packages/engine/src/ai/client.ts`):
   - `claude-opus-4-6` — CEO and leadership roles
   - `claude-sonnet-4-5-20250929` — workers, Scribe, Curator

   Both are overridable via `CLIPROXY_MODEL_OPUS` and `CLIPROXY_MODEL_SONNET` env vars. See `techstack.md` for the full model routing table.

---

## 5. Resend Setup (Email)

Each PRECEPT org uses its own free Resend account with its own domain. The `resend_api_key` and `email_domain` are stored per-org in the `orgs` table. See `techstack.md` for the rationale.

1. Create a free account at [resend.com](https://resend.com)
2. Add your org's domain (e.g., `mail.example.com`) — use a subdomain so root domain email isn't affected
3. Add DNS records:
   - If domain is on **Cloudflare**: use Resend's "Auto configure" to add DNS records automatically
   - Otherwise: manually add the DKIM (TXT), SPF (TXT), and MX records Resend provides
4. Wait for domain verification (usually < 2 minutes with Cloudflare)
5. Create an API key: Dashboard > API Keys > Create
6. Set up inbound webhook: Dashboard > Webhooks > Add Webhook
   - Event: `email.received`
   - Endpoint URL: `https://<your-tunnel-domain>/api/webhooks/resend` (set up in next section)
7. Enable inbound receiving: Dashboard → Domains → your domain → toggle "Enable Receiving"
   - This adds MX records for inbound email delivery
   - If on Cloudflare, click "Auto configure" to add MX records automatically
   - Without this, replies to briefing emails will bounce with "address not found"
   - The inbound webhook (configured in step 6) only works after receiving is enabled

Steps 1–5 configure **outbound** sending (briefings from CEO to owner). Steps 6–7 configure **inbound** receiving (owner replies back to CEO). Both are required for the full briefing loop.

Resend webhooks deliver metadata only. The engine calls `resend.emails.get(emailId)` to fetch the full email body.

---

## 6. Cloudflare Tunnel Setup

Install and authenticate:

```bash
brew install cloudflared

# Opens browser — select your domain's zone
cloudflared tunnel login

# Create tunnel — save the tunnel ID from the output
cloudflared tunnel create precept-engine

# Create CNAMEs automatically in Cloudflare
cloudflared tunnel route dns precept-engine api.precept.so
cloudflared tunnel route dns precept-engine app.precept.so
```

Create the config file at `~/.cloudflared/config.yml`:

```yaml
tunnel: <tunnel-id>
credentials-file: /Users/<username>/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: api.precept.so
    service: http://localhost:3001
  - hostname: app.precept.so
    service: http://localhost:3000
  - service: http_status:404
```

Test manually:

```bash
# Terminal 1: start engine
cd precept && node packages/engine/dist/index.js

# Terminal 2: start tunnel
cloudflared tunnel run precept-engine
```

Verify: `curl https://api.precept.so/health` should return `{"status":"ok"}`.

Install as system service so the tunnel starts on boot and restarts on crash:

```bash
sudo cloudflared service install
```

This creates a launchd plist automatically.

---

## 7. Engine Environment Variables

| Variable | Example | Required | Description |
|---|---|---|---|
| `PORT` | `3001` | Yes | Engine HTTP port |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Yes | Supabase service role key (not anon key) |
| `CLIPROXY_BASE_URL` | `http://localhost:8317/v1` | Yes | CLIProxy OpenAI-compatible endpoint |
| `CLIPROXY_API_KEY` | `sk-...` | Yes | CLIProxy API key |
| `CLIPROXY_MODEL_OPUS` | `claude-opus-4-6` | No | Override Opus model ID (default: `claude-opus-4-6`) |
| `CLIPROXY_MODEL_SONNET` | `claude-sonnet-4-5-20250929` | No | Override Sonnet model ID (default: `claude-sonnet-4-5-20250929`) |
| `RESEND_API_KEY` | `re_xxx` | Yes | Resend API key for email send/receive |
| `RESEND_FROM_DOMAIN` | `mail.example.com` | Yes | Domain for sending briefings |
| `RESEND_WEBHOOK_SECRET` | `whsec_xxx` | No | Webhook signature verification secret |
| `OWNER_EMAIL` | `owner@example.com` | Yes | Owner's email for daily briefings |
| `DEFAULT_ORG_ID` | `uuid` | Yes | Default org UUID (from Supabase `orgs` table) |
| `TASK_TIMEOUT_MS` | `600000` | No | Worker timeout in ms (default: 10 min) |

Create a `.env` file at the repo root:

```bash
cp .env.example .env
# Fill in values
```

`.env` is gitignored. Never commit secrets. See `security.md` for the trust boundary model.

The engine loads env vars via Bun's `--env-file` flag during development. In production (Node.js runtime), env vars must be set in the shell or via a wrapper script (see section 9).

---

## 8. Build and Run

```bash
# Build shared types + engine
bun run --cwd packages/shared build
bun run --cwd packages/engine build

# Start engine (production)
cd packages/engine
node dist/index.js
```

For development with hot reload:

```bash
bun run --cwd packages/engine dev
```

This runs `bun --env-file=../../.env --watch src/index.ts` — Bun executes TypeScript directly and reloads on file changes.

Verify:

```bash
curl http://localhost:3001/health
# {"status":"ok"}
```

---

## 9. Engine as macOS launchd Service

Create a wrapper script to load env vars (launchd doesn't source `.env` files natively):

```bash
#!/bin/bash
# /path/to/precept/scripts/start-engine.sh
set -a
source /path/to/precept/.env
set +a
exec node /path/to/precept/packages/engine/dist/index.js
```

Make it executable:

```bash
chmod +x /path/to/precept/scripts/start-engine.sh
```

Create the plist at `~/Library/LaunchAgents/com.precept.engine.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.precept.engine</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/precept/scripts/start-engine.sh</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/precept/packages/engine</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/usr/local/var/log/precept-engine.log</string>
    <key>StandardErrorPath</key>
    <string>/usr/local/var/log/precept-engine.error.log</string>
</dict>
</plist>
```

Replace `/path/to/precept` with the actual absolute path to the repo. Use `which node` to verify the Node.js binary path if needed.

Install and load:

```bash
cp com.precept.engine.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.precept.engine.plist
```

Verify:

```bash
launchctl list | grep precept
```

---

## Background Services (macOS)

The engine and web server can be run as persistent launchd services that start on login and restart on crash. The `scripts/` directory in the repo root contains the shell scripts and plist files.

The engine runs in dev mode (`bun run dev`), which uses `--watch` for automatic reload on file changes.

```bash
# Make scripts executable
chmod +x scripts/start-engine.sh scripts/start-web.sh

# Copy plists to LaunchAgents
cp scripts/com.precept.engine.plist ~/Library/LaunchAgents/
cp scripts/com.precept.web.plist ~/Library/LaunchAgents/

# Load services
launchctl load ~/Library/LaunchAgents/com.precept.engine.plist
launchctl load ~/Library/LaunchAgents/com.precept.web.plist

# Verify
launchctl list | grep precept
```

Logs are written to `/usr/local/var/log/precept-engine.log`, `/usr/local/var/log/precept-engine.error.log`, `/usr/local/var/log/precept-web.log`, and `/usr/local/var/log/precept-web.error.log`. Create the log directory if it doesn't exist: `sudo mkdir -p /usr/local/var/log`.

To unload a service: `launchctl unload ~/Library/LaunchAgents/com.precept.engine.plist`.

---

## Deploy

A single command rebuilds everything and restarts all services:

```bash
deploy
```

This runs `scripts/deploy.sh`, which does four things in order:

1. **Build** — compiles `packages/shared` and `packages/engine` via `bun run build`
2. **Restart engine** — kicks the launchd service; KeepAlive relaunches it with the new build
3. **Restart web** — kicks the launchd service; the start script runs `bun run build && bun run start` on relaunch
4. **Rebuild container** — rebuilds the `precept-org:latest` image from `Containerfile.org`, then stops and deletes all running org containers. They auto-recreate on the next worker dispatch with fresh env vars from the database.

The `deploy` alias is set in `~/.zshrc` and works from any directory.

---

## Skill Sync

When you add a skill file by hand (under `skills/`), it exists on disk but isn't in the `skill_index` database table — workers won't see it in their system prompt until it's synced.

Run the sync script to scan all skill files and upsert their metadata into Supabase:

```bash
scripts/sync-skills.sh
```

This uses `DEFAULT_ORG_ID` from your `.env` to set `org_id` on each record. The script:

- Scans `skills/org-wide/*.md` and `skills/role-specific/<role>/<name>/SKILL.md` recursively
- Parses `**Scope:**`, `**Role:**`, `**Status:**`, and `**Tags:**` from each file's header
- Extracts description from `## When To Use` or `## Context`
- Upserts into `skill_index` with `ON CONFLICT (org_id, name) DO UPDATE`
- Logs each synced skill and a final count

**When to run:** After adding, renaming, or changing metadata on a hand-authored skill file. Not needed for Curator-generated skills (Sprint 5+) — the Curator handles its own DB inserts.

---

## 10. Verification Checklist

Confirm everything is operational:

- [ ] `curl http://localhost:8317/v1/models` — CLIProxy responds with model list
- [ ] `curl http://localhost:3001/health` — Engine responds with `{"status":"ok"}`
- [ ] `curl https://dev.<your-domain>/health` — Tunnel routes correctly
- [ ] Resend dashboard: domain status is **Verified**
- [ ] Resend webhook configured with tunnel URL (`https://dev.<your-domain>/api/webhooks/resend`)
- [ ] Send test email to `ceo@<your-email-domain>` — check Resend dashboard for inbound event
- [ ] `POST /api/orchestration/trigger-planning` — planning cycle fires, check `plans` table in Supabase
- [ ] `POST /api/orchestration/trigger-briefing` — briefing email arrives at owner's inbox
- [ ] Reply to briefing email — webhook fires, `owner_feedback_history` gets an entry

---

## 11. Cloud Migration Path (Future)

When the AI gateway moves from CLIProxy to direct Anthropic API calls or local inference (Mac Studio), the engine can move to cloud hosting:

- A Dockerfile exists in the repo root (3-stage build: Bun install > tsc compile > Node 24 slim runtime)
- Deploy with `fly deploy` or equivalent — Fly.io uses port 8080 by default
- Only env var changes required: swap `CLIPROXY_BASE_URL` and `CLIPROXY_API_KEY` for `ANTHROPIC_API_KEY` + direct SDK calls
- Cloudflare Tunnel no longer needed (cloud host has its own public URL)

See `techstack.md` for the hardware roadmap.

---

## 12. Troubleshooting

**Engine can't reach CLIProxy:** Check CLIProxy is running, verify `CLIPROXY_BASE_URL` in `.env`, test with `curl http://localhost:8317/v1/models`.

**Resend webhook not firing:** Check tunnel is running (`cloudflared tunnel run`), verify webhook URL in Resend dashboard matches tunnel hostname, check `cloudflared` logs.

**Briefing email not arriving:** Check `RESEND_API_KEY` and `OWNER_EMAIL` in `.env`, check Resend dashboard for send logs, check spam folder.

**Engine crashes on startup:** Check all required env vars are set, verify Supabase connection (`curl $SUPABASE_URL`), confirm migrations have run (`npx supabase db push`).

**Tunnel not accessible:** Check `cloudflared tunnel run` is active, verify DNS propagation with `dig dev.<your-domain>`, confirm `config.yml` points to `http://localhost:3001`.
