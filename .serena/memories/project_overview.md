# PRECEPT — Project Overview

## Purpose
PRECEPT is an AI-powered CEO/executive operating system. It uses a structured onboarding interview to extract company knowledge into "precepts" — 10 structured fields that define how the business operates. These precepts then inform an autonomous agent system (CEO, Dispatcher, Workers, Reviewer, Judge) that runs daily operating cycles.

## Current State (Sprint 1 — March 2026)
Sprint 1 implements the **CEO onboarding interview** flow:
- Backend: Hono REST API with AI-powered conversational interview
- Frontend: Next.js split-screen UI (chat panel + live precepts panel)
- Database: Supabase (cloud, project ref `ucueafydyuxcyrjwxudz`)
- AI: Claude via CLIProxy (OpenAI-compatible SDK)

## Repository
- GitHub: `aboutorca/PRECEPT`
- Main branch: `main`
- Deployed frontend: Vercel (planned)
- Engine hosting: Fly.io (planned)

## Environment
- `.env` at repo root (gitignored) contains: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CLIPROXY_BASE_URL`, `CLIPROXY_API_KEY`, `CLIPROXY_MODEL`
- Conductor workspaces symlink `.env` from `$CONDUCTOR_ROOT_PATH`
