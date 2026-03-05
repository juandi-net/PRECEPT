# InputBox: CEO Response Display & Animated Thinking Dots

**Date:** 2026-03-05
**Status:** Approved
**Files:** `packages/web/src/app/interface/input-box.tsx`, `packages/web/src/app/interface/interface.css`

## Fix 1 — Display CEO reactive response

Add `response` state to InputBox. After successful POST, read `{ response }` from JSON and set state. Render above textarea in `interface-letter` styled div with same `escapeHtml` + `parseMarkdownLinks` pipeline (copied from page.tsx). Ephemeral — clears on reload. Also clears when user starts typing a new message.

## Fix 2 — Animated thinking dots

Add `dotCount` state (1→2→3→1) driven by `setInterval(500ms)` while `sending` is true. Button text: `` `Thinking${'.'.repeat(dotCount)}` ``. Fixed `min-width` on button to prevent jitter.
