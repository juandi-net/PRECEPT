# News Ticker Design

## Summary

A fixed-bottom scrolling ticker on The Interface showing recent system activity from `audit_log`. Stock-ticker aesthetic — ambient, always moving, pause on hover, clickable items linking to `/inspect/task/[id]`.

## Component

`packages/web/src/app/interface/news-ticker.tsx` — client component.

- Fixed to viewport bottom, full width, `z-50`
- `border-top: 1px solid #ddd` separator
- White background, Times New Roman, ~13px
- CSS `translateX` keyframe scrolling left continuously
- Content duplicated for seamless loop
- `animation-play-state: paused` on hover
- "System idle" fallback when no recent events

## Data

Supabase query: `audit_log` LEFT JOIN `tasks` ON `detail->>'task_id' = tasks.id`, ordered by `created_at DESC`, limit 15. Filtered to activity event types (worker, review, judge, dispatch, planning, briefing).

Refresh interval: 12 seconds.

## Event Type Mapping

| event_type | Role | Action |
|---|---|---|
| `worker.start` | task.role | working on |
| `worker.complete` | task.role | completed |
| `worker.rework_complete` | task.role | revised |
| `worker.failed` | task.role | failed on |
| `review.start` | Reviewer | evaluating |
| `review.verdict` | Reviewer | reviewed |
| `judge.start` | Judge | evaluating |
| `judge.verdict` | Judge | accepted/revised |
| `dispatch.task` | Dispatcher | assigned |
| `dispatch.plan` | Dispatcher | dispatching plan |
| `planning.cycle` | CEO | planning next cycle |
| `planning.ceo` | CEO | reviewing plan |
| `planning.advisor` | Advisor | consulting |
| `planning.scribe` | Scribe | documenting |
| `briefing.sent` | CEO | sent briefing |
| No task_id | — | human-readable from event_type |

Format: `[Role] [action] [task description]` joined with ` · `.

Each item wrapped in `<a href="/inspect/task/[id]">`.

## Placeholder Route

`/inspect/task/[id]/page.tsx` — minimal page showing task ID, "Coming soon."

## Files Changed

- `packages/web/src/app/interface/news-ticker.tsx` (new)
- `packages/web/src/app/interface/interface.css` (ticker styles)
- `packages/web/src/app/interface/page.tsx` (render ticker)
- `packages/web/src/app/inspect/task/[id]/page.tsx` (new placeholder)
