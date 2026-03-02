# Suggested Commands

## Package Manager
This project uses **bun**. Detected by `bun.lock`. Never use npm or pnpm.

## Development
```bash
# Install dependencies (from repo root)
bun install

# Run engine (Hono API on port 3001)
bun run dev:engine

# Run web frontend (Next.js on port 3000)
bun run dev:web

# Run both (Conductor-style)
bun run dev:engine & bun run dev:web --port $CONDUCTOR_PORT
```

## Testing
```bash
# Run all engine tests (vitest)
bun run --cwd packages/engine test

# Watch mode
bun run --cwd packages/engine test:watch

# Or from root
bun run test
```

## Building
```bash
# Build all packages
bun run build

# Build engine only
bun run --cwd packages/engine build
# This runs `tsc` — strict mode, ESNext modules
```

## Supabase
```bash
# Link to cloud project
npx supabase link --project-ref ucueafydyuxcyrjwxudz

# Push migrations
npx supabase db push

# Get API keys
npx supabase projects api-keys --project-ref ucueafydyuxcyrjwxudz

# Generate types (if needed)
npx supabase gen types typescript --project-id ucueafydyuxcyrjwxudz
```

## Git
```bash
# Main worktree for this repo is at /Users/juandi/PRECEPT
# Conductor workspace is at /Users/juandi/conductor/workspaces/PRECEPT/madison
# To operate on main branch: git -C /Users/juandi/PRECEPT <command>
```

## System (macOS Darwin)
Standard unix commands: `git`, `ls`, `grep`, `find`, etc.
Use `brew` for package management.
