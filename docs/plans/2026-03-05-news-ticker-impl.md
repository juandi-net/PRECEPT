# News Ticker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a scrolling news ticker to the bottom of The Interface showing recent system activity from audit_log.

**Architecture:** Client component polling Supabase every 12s, CSS translateX animation for smooth scroll, LEFT JOIN tasks for descriptions, event_type mapping to human-readable text.

**Tech Stack:** Next.js (client component), Supabase browser client, CSS keyframe animations

---

### Task 1: Add ticker CSS styles to interface.css

**Files:**
- Modify: `packages/web/src/app/interface/interface.css`

**Step 1: Add ticker styles to the end of interface.css**

Append after the existing `.interface-error` rule:

```css
/* News ticker */
.ticker-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 32px;
  background: #fff;
  border-top: 1px solid #ddd;
  overflow: hidden;
  z-index: 50;
  font-family: 'Times New Roman', Times, serif;
  font-size: 13px;
  color: #555;
}

.ticker-bar:hover .ticker-track {
  animation-play-state: paused;
}

.ticker-track {
  display: inline-flex;
  align-items: center;
  height: 100%;
  white-space: nowrap;
  animation: ticker-scroll var(--ticker-duration, 30s) linear infinite;
}

.ticker-item {
  color: #555;
  text-decoration: none;
  padding: 0 0.75rem;
}

.ticker-item:hover {
  color: #111;
}

.ticker-separator {
  color: #ccc;
  user-select: none;
}

.ticker-idle {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #bbb;
  font-style: italic;
}

@keyframes ticker-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
```

**Step 2: Add bottom padding to interface-page so ticker doesn't overlap content**

In `.interface-page`, add `padding-bottom: 32px;`.

**Step 3: Verify the CSS is syntactically valid**

Run: `cd packages/web && npx next lint`
Expected: No CSS errors

**Step 4: Commit**

```bash
git add packages/web/src/app/interface/interface.css
git commit -m "feat: add news ticker CSS styles"
```

---

### Task 2: Create the NewsTicker client component

**Files:**
- Create: `packages/web/src/app/interface/news-ticker.tsx`

**Step 1: Create the component file**

```tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TickerItem {
  id: string
  text: string
  taskId: string | null
}

const EVENT_MAP: Record<string, { role: string; action: string }> = {
  'worker.start': { role: '', action: 'working on' },
  'worker.complete': { role: '', action: 'completed' },
  'worker.rework_complete': { role: '', action: 'revised' },
  'worker.failed': { role: '', action: 'failed on' },
  'review.start': { role: 'Reviewer', action: 'evaluating' },
  'review.verdict': { role: 'Reviewer', action: 'reviewed' },
  'judge.start': { role: 'Judge', action: 'evaluating' },
  'judge.verdict': { role: 'Judge', action: '' },
  'dispatch.task': { role: 'Dispatcher', action: 'assigned' },
  'dispatch.plan': { role: 'Dispatcher', action: 'dispatching plan' },
  'planning.cycle': { role: 'CEO', action: 'planning next cycle' },
  'planning.ceo': { role: 'CEO', action: 'reviewing plan' },
  'planning.advisor': { role: 'Advisor', action: 'consulting' },
  'planning.scribe': { role: 'Scribe', action: 'documenting' },
  'planning.approved': { role: 'CEO', action: 'approved plan' },
  'briefing.compiled': { role: 'CEO', action: 'compiling briefing' },
  'briefing.sent': { role: 'CEO', action: 'sent briefing' },
}

const TICKER_EVENT_TYPES = Object.keys(EVENT_MAP)

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatEvent(
  eventType: string,
  detail: Record<string, unknown> | null,
  taskDescription: string | null,
  taskRole: string | null
): string {
  const mapping = EVENT_MAP[eventType]
  if (!mapping) {
    // Fallback: humanize event_type
    return eventType.replace(/[._]/g, ' ')
  }

  // For worker events, use the task's role (Coder, Researcher, etc.)
  let role = mapping.role
  if (!role && taskRole) {
    role = capitalizeFirst(taskRole)
  } else if (!role) {
    role = 'Worker'
  }

  // For judge.verdict, derive action from detail
  let action = mapping.action
  if (eventType === 'judge.verdict' && detail) {
    const verdict = (detail.verdict as string) ?? 'evaluated'
    action = verdict === 'ACCEPTED' ? 'accepted' : 'revised'
  }

  if (taskDescription) {
    return `${role} ${action} ${taskDescription}`
  }

  return `${role} ${action}`
}

async function fetchTickerItems(orgId: string): Promise<TickerItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('audit_log')
    .select(`
      id,
      event_type,
      detail,
      created_at,
      tasks!audit_log_detail_task_id_fkey (
        id,
        role,
        spec
      )
    `)
    .eq('org_id', orgId)
    .in('event_type', TICKER_EVENT_TYPES)
    .order('created_at', { ascending: false })
    .limit(15)

  if (error) {
    // Can't join via JSONB — fall back to two-step approach
    return fetchTickerItemsFallback(orgId)
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const task = row.tasks as { id: string; role: string; spec: { description?: string } } | null
    const detail = row.detail as Record<string, unknown> | null
    return {
      id: row.id as string,
      text: formatEvent(
        row.event_type as string,
        detail,
        task?.spec?.description ?? null,
        task?.role ?? null
      ),
      taskId: task?.id ?? (detail?.task_id as string) ?? null,
    }
  })
}

async function fetchTickerItemsFallback(orgId: string): Promise<TickerItem[]> {
  const supabase = createClient()

  const { data: events } = await supabase
    .from('audit_log')
    .select('id, event_type, detail')
    .eq('org_id', orgId)
    .in('event_type', TICKER_EVENT_TYPES)
    .order('created_at', { ascending: false })
    .limit(15)

  if (!events?.length) return []

  // Collect task IDs from detail JSONB
  const taskIds = events
    .map((e: Record<string, unknown>) => {
      const detail = e.detail as Record<string, unknown> | null
      return detail?.task_id as string | undefined
    })
    .filter((id): id is string => !!id)

  let taskMap: Record<string, { role: string; description: string }> = {}

  if (taskIds.length > 0) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, role, spec')
      .in('id', [...new Set(taskIds)])

    taskMap = Object.fromEntries(
      (tasks ?? []).map((t: Record<string, unknown>) => {
        const spec = t.spec as { description?: string }
        return [t.id as string, { role: t.role as string, description: spec?.description ?? '' }]
      })
    )
  }

  return events.map((row: Record<string, unknown>) => {
    const detail = row.detail as Record<string, unknown> | null
    const taskId = detail?.task_id as string | undefined
    const task = taskId ? taskMap[taskId] : undefined
    return {
      id: row.id as string,
      text: formatEvent(
        row.event_type as string,
        detail,
        task?.description ?? null,
        task?.role ?? null
      ),
      taskId: taskId ?? null,
    }
  })
}

export function NewsTicker({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<TickerItem[]>([])

  useEffect(() => {
    fetchTickerItemsFallback(orgId).then(setItems)

    const interval = setInterval(() => {
      fetchTickerItemsFallback(orgId).then(setItems)
    }, 12_000)

    return () => clearInterval(interval)
  }, [orgId])

  // Duplicate items for seamless loop
  const tickerContent = useMemo(() => [...items, ...items], [items])

  // Scale duration by number of items for consistent speed
  const duration = Math.max(items.length * 4, 20)

  if (items.length === 0) {
    return (
      <div className="ticker-bar">
        <div className="ticker-idle">System idle</div>
      </div>
    )
  }

  return (
    <div className="ticker-bar">
      <div
        className="ticker-track"
        style={{ '--ticker-duration': `${duration}s` } as React.CSSProperties}
      >
        {tickerContent.map((item, i) => (
          <span key={`${item.id}-${i}`}>
            {i > 0 && <span className="ticker-separator"> · </span>}
            {item.taskId ? (
              <a href={`/inspect/task/${item.taskId}`} className="ticker-item">
                {item.text}
              </a>
            ) : (
              <span className="ticker-item">{item.text}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Verify the component compiles**

Run: `cd packages/web && npx next build --no-lint 2>&1 | head -30`
Expected: No TypeScript errors in news-ticker.tsx

**Step 3: Commit**

```bash
git add packages/web/src/app/interface/news-ticker.tsx
git commit -m "feat: create NewsTicker client component"
```

---

### Task 3: Wire the ticker into the Interface page

**Files:**
- Modify: `packages/web/src/app/interface/page.tsx:4,98`

**Step 1: Add the import**

After line 4 (`import './interface.css'`), add:

```tsx
import { NewsTicker } from './news-ticker'
```

**Step 2: Render the ticker**

Inside the return JSX, add `<NewsTicker orgId={org.id} />` just before the closing `</div>` of `.interface-page` (line 98). The result:

```tsx
      </div>
      <NewsTicker orgId={org.id} />
    </div>
```

**Step 3: Verify the page renders without errors**

Run: `cd packages/web && npx next build --no-lint 2>&1 | tail -10`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/web/src/app/interface/page.tsx
git commit -m "feat: render news ticker on interface page"
```

---

### Task 4: Create placeholder /inspect/task/[id] route

**Files:**
- Create: `packages/web/src/app/inspect/task/[id]/page.tsx`

**Step 1: Create the placeholder page**

```tsx
export default async function InspectTaskPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div style={{
      fontFamily: "'Times New Roman', Times, serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      color: '#111',
    }}>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Task {id}</h1>
      <p style={{ color: '#999' }}>Task inspection coming soon.</p>
      <a href="/interface" style={{ marginTop: '1rem', color: '#111' }}>Back to Interface</a>
    </div>
  )
}
```

**Step 2: Verify the route resolves**

Run: `cd packages/web && npx next build --no-lint 2>&1 | tail -10`
Expected: Build succeeds, `/inspect/task/[id]` appears in routes

**Step 3: Commit**

```bash
git add packages/web/src/app/inspect/task/\[id\]/page.tsx
git commit -m "feat: add placeholder inspect task page"
```

---

### Task 5: Final verification

**Step 1: Full build check**

Run: `cd packages/web && npx next build`
Expected: Clean build, no errors

**Step 2: Final commit (if any lint/type fixes needed)**

```bash
git add -A && git commit -m "fix: address lint/type issues from ticker"
```
