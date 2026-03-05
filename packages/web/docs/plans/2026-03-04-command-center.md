# Command Center Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace sidebar + 5 separate pages with a single full-screen 3-column command center.

**Architecture:** All existing components reused in new layout. One new page (`CommandCenter`) composes them into a CSS Grid. Theme toggle via minimal custom provider (no new deps). Initiative drill-down via slide-out panel overlay. Precepts moves to standalone route.

**Tech Stack:** Next.js 16 app-router, React 19, Tailwind 4, shadcn/ui, existing Supabase hooks

---

### Task 1: Add theme provider

**Files:**
- Create: `src/components/layout/theme-provider.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create ThemeProvider**

Create `src/components/layout/theme-provider.tsx`:

```tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
})

export const useTheme = () => useContext(ThemeContext)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored) {
      setTheme(stored)
      document.documentElement.classList.toggle('dark', stored === 'dark')
    }
  }, [])

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  return (
    <ThemeContext value={{ theme, toggle }}>
      {children}
    </ThemeContext>
  )
}
```

**Step 2: Wrap root layout with ThemeProvider**

In `src/app/layout.tsx`, import `ThemeProvider` and wrap `{children}` inside `<body>`:

```tsx
import { ThemeProvider } from '@/components/layout/theme-provider'
// ... existing imports

export default function RootLayout({ children }: ...) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

Add `suppressHydrationWarning` to `<html>` to prevent mismatch from `dark` class toggle.

**Step 3: Verify build**

Run: `cd packages/web && bun run build`
Expected: Build succeeds. No runtime changes yet.

**Step 4: Commit**

```bash
git add src/components/layout/theme-provider.tsx src/app/layout.tsx
git commit -m "feat: add theme provider with light/dark toggle"
```

---

### Task 2: Create top bar component

**Files:**
- Create: `src/components/layout/top-bar.tsx`

**Step 1: Create TopBar**

Create `src/components/layout/top-bar.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from './theme-provider'
import { FileText, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TopBarProps {
  orgName: string
  mission: string | null
}

export function TopBar({ orgName, mission }: TopBarProps) {
  const [connected, setConnected] = useState(true)
  const { theme, toggle } = useTheme()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('connection-health').subscribe((status) => {
      setConnected(status === 'SUBSCRIBED')
    })
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b bg-background px-4">
      {/* Left: org name + live indicator */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold uppercase tracking-wide">{orgName}</span>
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-xs text-muted-foreground">
          {connected ? 'LIVE' : 'DISCONNECTED'}
        </span>
      </div>

      {/* Center: mission */}
      {mission && (
        <p className="flex-1 truncate text-center text-sm text-muted-foreground" title={mission}>
          {mission}
        </p>
      )}
      {!mission && <div className="flex-1" />}

      {/* Right: theme toggle + precepts link */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8">
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
        <Link href="/precepts">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <FileText className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </header>
  )
}
```

**Step 2: Verify build**

Run: `cd packages/web && bun run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/layout/top-bar.tsx
git commit -m "feat: add command center top bar with live indicator and theme toggle"
```

---

### Task 3: Create initiative slide-out panel

**Files:**
- Create: `src/components/dashboard/initiative-slideout.tsx`
- Modify: `src/components/dashboard/initiative-cards.tsx`
- Modify: `src/components/initiative/initiative-detail.tsx`

**Step 1: Create InitiativeSlideout**

Create `src/components/dashboard/initiative-slideout.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InitiativeDetail } from '@/components/initiative/initiative-detail'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface InitiativeSlideoutProps {
  initiativeId: string
  onClose: () => void
}

export function InitiativeSlideout({ initiativeId, onClose }: InitiativeSlideoutProps) {
  const [initiative, setInitiative] = useState<{
    id: string; name: string; status: string; phase_current: number; created_at: string
  } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('initiatives')
      .select('*')
      .eq('id', initiativeId)
      .single()
      .then(({ data }) => { if (data) setInitiative(data) })
  }, [initiativeId])

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 left-0 z-50 w-full max-w-2xl overflow-y-auto border-r bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Initiative Detail</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {initiative ? (
          <InitiativeDetail initiative={initiative} embedded />
        ) : (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
      </div>
    </>
  )
}
```

**Step 2: Add `embedded` prop to InitiativeDetail**

In `src/components/initiative/initiative-detail.tsx`, add an `embedded` prop that hides the "Back to Dashboard" link:

Change the component signature:
```tsx
export function InitiativeDetail({ initiative, embedded = false }: { initiative: Initiative; embedded?: boolean }) {
```

Wrap the back-link in a condition:
```tsx
{!embedded && (
  <Link href="/dashboard">
    <Button variant="ghost" size="sm" className="gap-1">
      <ArrowLeft className="h-4 w-4" />
      Back to Dashboard
    </Button>
  </Link>
)}
```

**Step 3: Add `onSelect` prop to InitiativeCards**

In `src/components/dashboard/initiative-cards.tsx`:

Change the component signature:
```tsx
export function InitiativeCards({ orgId, onSelect }: { orgId: string; onSelect?: (id: string) => void }) {
```

Replace the `<Link>` wrapper around each card (line 68) with a `<button>` or conditional:
```tsx
<div key={init.id} onClick={() => onSelect?.(init.id)} className="cursor-pointer">
  <Card className="transition-shadow hover:shadow-md">
    {/* ... existing card content, remove Link wrapper ... */}
  </Card>
</div>
```

Remove the `Link` import from `next/link` if no longer used.

**Step 4: Verify build**

Run: `cd packages/web && bun run build`

**Step 5: Commit**

```bash
git add src/components/dashboard/initiative-slideout.tsx \
  src/components/dashboard/initiative-cards.tsx \
  src/components/initiative/initiative-detail.tsx
git commit -m "feat: add initiative slide-out panel and onSelect callback"
```

---

### Task 4: Adapt CeoChat and OrgChart for embedded use

**Files:**
- Modify: `src/components/chat/ceo-chat.tsx`
- Modify: `src/components/structure/org-chart.tsx`

**Step 1: Make CeoChat height flexible**

In `src/components/chat/ceo-chat.tsx` line 87, change:
```tsx
<div className="flex h-[calc(100vh-10rem)] flex-col">
```
to:
```tsx
<div className="flex h-full flex-col">
```

The parent container in the command center grid will set the height.

**Step 2: Make OrgChart accept compact prop**

In `src/components/structure/org-chart.tsx`, change:

Component signature:
```tsx
export function OrgChart({ orgId, compact = false }: { orgId: string; compact?: boolean }) {
```

Loading state (line 179):
```tsx
return <div className={`flex ${compact ? 'h-full' : 'h-[600px]'} items-center justify-center text-muted-foreground`}>Loading org chart...</div>
```

Container (line 183):
```tsx
<div className={`${compact ? 'h-full' : 'h-[600px]'} w-full rounded-lg border`}>
```

When compact, hide Controls:
```tsx
{!compact && <Controls />}
```

**Step 3: Verify build**

Run: `cd packages/web && bun run build`

**Step 4: Commit**

```bash
git add src/components/chat/ceo-chat.tsx src/components/structure/org-chart.tsx
git commit -m "feat: make CeoChat and OrgChart flexible for embedded layout"
```

---

### Task 5: Build command center page and update dashboard layout

**Files:**
- Create: `src/components/dashboard/command-center.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Create CommandCenter client component**

Create `src/components/dashboard/command-center.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { InitiativeCards } from './initiative-cards'
import { BoardRequests } from './board-requests'
import { Exceptions } from './exceptions'
import { InitiativeSlideout } from './initiative-slideout'
import { AuditLog } from '@/components/audit/audit-log'
import { CeoChat } from '@/components/chat/ceo-chat'
import { OrgChart } from '@/components/structure/org-chart'

interface CommandCenterProps {
  orgId: string
}

export function CommandCenter({ orgId }: CommandCenterProps) {
  const [selectedInitiative, setSelectedInitiative] = useState<string | null>(null)

  return (
    <>
      <div className="grid h-full grid-cols-1 xl:grid-cols-[1fr_1.6fr_1.4fr]">
        {/* Left Column */}
        <div className="flex flex-col gap-0 overflow-y-auto border-r p-4 xl:order-none order-3">
          <InitiativeCards orgId={orgId} onSelect={setSelectedInitiative} />
          <div className="mt-4 hidden xl:block min-h-[300px] flex-1">
            <OrgChart orgId={orgId} compact />
          </div>
        </div>

        {/* Center Column */}
        <div className="flex flex-col overflow-hidden border-r xl:order-none order-4">
          <div className="flex-1 overflow-y-auto p-4">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Activity Feed
            </h2>
            <AuditLog orgId={orgId} />
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col overflow-hidden xl:order-none order-1">
          {/* CEO Chat — takes majority of right column */}
          <div className="flex-1 min-h-0">
            <CeoChat orgId={orgId} />
          </div>

          {/* Board Requests + Exceptions — compact, only if present */}
          <div className="shrink-0 space-y-4 border-t p-4">
            <BoardRequests orgId={orgId} />
            <Exceptions orgId={orgId} />
          </div>
        </div>
      </div>

      {/* Initiative slide-out */}
      {selectedInitiative && (
        <InitiativeSlideout
          initiativeId={selectedInitiative}
          onClose={() => setSelectedInitiative(null)}
        />
      )}
    </>
  )
}
```

**Step 2: Rewrite dashboard layout (remove sidebar)**

Replace `src/app/(dashboard)/layout.tsx` entirely:

```tsx
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/top-bar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('orgs')
    .select('id, name')
    .single()

  const { data: precepts } = await supabase
    .from('precepts')
    .select('content')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const mission = (precepts?.content as Record<string, Record<string, string>> | null)
    ?.identity?.mission_statement ?? null

  return (
    <div className="flex h-screen flex-col">
      <TopBar orgName={org?.name ?? 'PRECEPT'} mission={mission} />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
```

**Step 3: Rewrite dashboard page**

Replace `src/app/(dashboard)/dashboard/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { CommandCenter } from '@/components/dashboard/command-center'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: org } = await supabase.from('orgs').select('id').single()

  return <CommandCenter orgId={org?.id ?? ''} />
}
```

**Step 4: Verify build**

Run: `cd packages/web && bun run build`

**Step 5: Commit**

```bash
git add src/components/dashboard/command-center.tsx \
  src/app/\(dashboard\)/layout.tsx \
  src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: build command center 3-column layout"
```

---

### Task 6: Move precepts to standalone route and delete old pages

**Files:**
- Create: `src/app/precepts/page.tsx`
- Create: `src/app/precepts/layout.tsx`
- Delete: `src/app/(dashboard)/precepts/page.tsx`
- Delete: `src/app/(dashboard)/structure/page.tsx`
- Delete: `src/app/(dashboard)/chat/page.tsx`
- Delete: `src/app/(dashboard)/audit/page.tsx`
- Delete: `src/app/(dashboard)/dashboard/[id]/page.tsx`
- Delete: `src/components/layout/app-sidebar.tsx`
- Delete: `src/components/dashboard/dashboard-client.tsx`

**Step 1: Create standalone precepts route**

Create `src/app/precepts/layout.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/top-bar'

export default async function PreceptsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('orgs')
    .select('id, name')
    .single()

  const { data: precepts } = await supabase
    .from('precepts')
    .select('content')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const mission = (precepts?.content as Record<string, Record<string, string>> | null)
    ?.identity?.mission_statement ?? null

  return (
    <div className="flex h-screen flex-col">
      <TopBar orgName={org?.name ?? 'PRECEPT'} mission={mission} />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
```

Create `src/app/precepts/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { PreceptsViewer } from '@/components/precepts/precepts-viewer'

export default async function PreceptsPage() {
  const supabase = await createClient()

  const { data: precepts } = await supabase
    .from('precepts')
    .select('content')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Precepts</h1>
      <PreceptsViewer content={precepts?.content ?? null} />
    </div>
  )
}
```

**Step 2: Delete old pages and components**

```bash
rm src/app/\(dashboard\)/precepts/page.tsx
rmdir src/app/\(dashboard\)/precepts
rm src/app/\(dashboard\)/structure/page.tsx
rmdir src/app/\(dashboard\)/structure
rm src/app/\(dashboard\)/chat/page.tsx
rmdir src/app/\(dashboard\)/chat
rm src/app/\(dashboard\)/audit/page.tsx
rmdir src/app/\(dashboard\)/audit
rm src/app/\(dashboard\)/dashboard/\[id\]/page.tsx
rmdir src/app/\(dashboard\)/dashboard/\[id\]
rm src/components/layout/app-sidebar.tsx
rm src/components/dashboard/dashboard-client.tsx
```

**Step 3: Verify build**

Run: `cd packages/web && bun run build`
Expected: Build succeeds. No remaining references to deleted files.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move precepts to standalone route, delete old sidebar pages"
```

---

### Task 7: Add responsive layout and polish

**Files:**
- Modify: `src/components/dashboard/command-center.tsx`

**Step 1: Add responsive breakpoints**

Update the grid in `command-center.tsx`:

The `xl:grid-cols-[1fr_1.6fr_1.4fr]` already falls back to `grid-cols-1` on smaller screens. Refine with `lg` breakpoint for 2-column:

```tsx
<div className="grid h-full grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1fr_1.6fr_1.4fr]">
```

For the left column OrgChart, it's already hidden on non-xl via `hidden xl:block`. Add a `md:hidden` to hide the OrgChart section on very small screens:

Update the Structure wrapper:
```tsx
<div className="mt-4 hidden xl:block min-h-[300px] flex-1">
```

This already hides it on < xl (1280px). Since we only show the org chart on xl+, it's automatically hidden on < 768px too.

Add responsive mobile ordering so board requests + exceptions show first:
- Right column `order-1` on mobile (priority info first)
- Left column `order-3` on mobile
- Center column `order-4` on mobile
- All reset to natural order on `xl:`

These are already in the Step 5 code. Verify they're correct.

**Step 2: Verify build**

Run: `cd packages/web && bun run build`

**Step 3: Commit**

```bash
git add src/components/dashboard/command-center.tsx
git commit -m "feat: add responsive layout breakpoints"
```

---

### Task 8: Final verification and squash commit

**Step 1: Run dev server and test**

Run: `cd packages/web && bun run dev`

Manual verification checklist:
- [ ] `/dashboard` shows 3-column layout on desktop
- [ ] Top bar shows org name, LIVE dot, mission, theme toggle, precepts link
- [ ] Theme toggle switches between light and dark, persists on refresh
- [ ] Left column: initiative cards visible, clicking one opens slide-out panel
- [ ] Slide-out panel shows initiative detail, close button works, backdrop click closes
- [ ] Left column: org chart visible (compact, no Controls)
- [ ] Center column: activity feed with real-time events, filter bar, expand detail
- [ ] Right column: CEO chat always visible, input works
- [ ] Right column: board requests and exceptions show only when data exists
- [ ] `/precepts` works as standalone page with top bar (no sidebar)
- [ ] `/login` unchanged
- [ ] Responsive: shrink to < 1280px, check 2-column layout
- [ ] Responsive: shrink to < 1024px, check single column with correct order
- [ ] Old routes (`/structure`, `/chat`, `/audit`, `/dashboard/[id]`) return 404

**Step 2: Squash commits**

```bash
git rebase -i HEAD~7
# squash all into one commit with message:
# refactor: redesign Decision Room from multi-page sidebar to single-page command center
```
