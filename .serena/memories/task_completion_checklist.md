# Task Completion Checklist

When a coding task is complete, verify:

1. **Build passes**: `bun run --cwd packages/engine build` (runs `tsc`)
2. **Tests pass**: `bun run --cwd packages/engine test` (runs vitest)
3. **No regressions**: Check that existing functionality still works
4. **Type safety**: Ensure no new TypeScript errors introduced

## Known Pre-existing Issues
- Test file `packages/engine/src/services/__tests__/onboarding.test.ts` has TS errors for `preceptsDraft: {}` mock objects (missing required fields). Tests pass at runtime because vitest doesn't enforce strict types on mocks. This is a known issue, not a regression.

## Commit Conventions
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`
- Keep messages concise (1-2 sentences)
- Co-author line: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

## Git Workflow
- Feature branches off main
- Cherry-pick to main worktree at `/Users/juandi/PRECEPT` for merging
- Push from main worktree: `git -C /Users/juandi/PRECEPT push`
