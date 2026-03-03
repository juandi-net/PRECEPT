# PRECEPTS.md Generation — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate a human-readable `PRECEPTS.md` per organization when onboarding completes, so the org's guiding document is version-controlled and readable without a database query.

**Architecture:** Add a `writePreceptsFile()` function to the onboarding service. Called from `completeSession()` after the Supabase write and before seed skill generation. Uses the same `import.meta.url` monorepo root resolution pattern as skill file writing.

## What Gets Generated

A clean markdown document with one H2 section per Precepts field. Fields use human-readable labels from `FIELD_LABELS`. Non-confirmed fields get an inline state marker (e.g., `*(hypothesis)*`). Null/empty fields are omitted.

Example output:

```markdown
# Precepts

Generated from onboarding session on 2026-03-02.

## Identity

We are a boutique design agency specializing in brand identity for tech startups...

## Product / Service

Our core offering is a 6-week brand sprint that produces...

## Stage *(hypothesis)*

Early growth — we have 12 clients but haven't found repeatable acquisition...
```

## File Location

`data/orgs/{slug}/PRECEPTS.md` — each organization gets its own directory under `data/orgs/`. Not at the repo root (avoids clobbering by workspace tooling) and not in `docs/` (those are system architecture docs; Precepts is the org's document).

## Behavior

- **Generated once** during `completeSession()` in the onboarding flow
- **Overwrites** on re-onboard — git handles version history
- **Idempotent** — safe to call multiple times with the same draft

## What's NOT included

- Field `notes` (internal CEO scratchpad)
- Version tracking in the file itself
- Separate service class
- Configurable output path
