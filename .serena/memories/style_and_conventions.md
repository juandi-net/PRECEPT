# Code Style & Conventions

## TypeScript
- **Strict mode** enabled (`tsconfig.base.json`)
- **ES2022** target, **ESNext** modules, **bundler** module resolution
- **Type imports** preferred: `import type { Foo } from '...'`
- **Explicit `.js` extensions** in imports (ESM requirement): `import { db } from './client.js'`
- No semicolons are inconsistent — some files use them, some don't. Follow existing file convention.

## Naming
- **Files**: kebab-case for multi-word (`ceo-onboarding.ts`), lowercase for single-word (`client.ts`)
- **Variables/functions**: camelCase
- **Classes**: PascalCase (e.g., `OnboardingService`)
- **Types/interfaces**: PascalCase (e.g., `PreceptsDraft`, `CEOResponse`)
- **Constants**: SCREAMING_SNAKE_CASE for module-level (`AGENT_ID`, `PRECEPTS_FIELDS`, `MODELS`)
- **Database columns**: snake_case (mapped in DB layer)

## Frontend (Next.js)
- **React components**: PascalCase files (`ChatPanel.tsx`, `PreceptField.tsx`)
- **ShadCN UI primitives** in `components/ui/` — use these instead of raw HTML form elements
- **Tailwind CSS** for styling
- **`cn()` utility** from `lib/utils.ts` for conditional class merging

## Testing
- **Vitest** for engine tests
- Tests colocated in `__tests__/` directories next to source
- Module-level mocks via `vi.mock()`
- Test file naming: `<module>.test.ts`

## Error Handling
- DB layer throws on errors (except `getSession` returns null for PGRST116 row-not-found)
- Audit logging is fire-and-forget (never throws)
- AI response parsing degrades gracefully on JSON parse failure

## API Design
- Hono routes at `/api/onboarding/*`
- Standard REST: POST to create, GET to read
- JSON request/response bodies
