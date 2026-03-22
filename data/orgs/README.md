# Organization Data

This directory holds per-org private data. Each subdirectory is named after the org's slug and contains files specific to that deployment.

**This directory is gitignored.** Each PRECEPT installation creates its own org data locally. It is never committed to the repository.

## Expected Structure

```
data/orgs/
  <ORG_SLUG>/
    PRECEPTS.md    # The Cornerstone document generated during onboarding
```

## How It Works

When you onboard a new organization through PRECEPT, the system creates a directory here named after the org's slug. The `PRECEPTS.md` file is the Cornerstone — the structured document that captures the owner's identity, product, goals, constraints, and priorities. Every agent reads this document before making decisions.

If you're forking PRECEPT, this directory will be empty. Run the onboarding flow to generate your own Cornerstone.
