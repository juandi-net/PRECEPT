# Sprint 3: Decision Room UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the owner's web interface — Dashboard, Initiative drill-down, CEO Chat, Structure (live org chart), Audit Log, and Precepts viewer — with Supabase Auth, RLS, and real-time subscriptions.

**Architecture:** Next.js 16 App Router with direct Supabase reads (via `@supabase/supabase-js` + `@supabase/ssr`) for all data + real-time subscriptions. Engine API (`POST` to Hono on :3001) only for mutations requiring business logic (CEO chat, board request responses). Supabase Auth (single user) with RLS policies on all tables. ShadCN/ui components for UI, React Flow + ELK.js for org chart, CSS animations for activity indicators.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, ShadCN (new-york), Supabase JS + SSR, React Flow, ELK.js, Hono

**Design doc:** `docs/plans/2026-03-04-sprint3-decision-room-design.md`

---

## Phase 1: Foundation (Auth + Layout + Dependencies)

### Task 1: Database Migration — `board_requests` + `ceo_chat_messages`

**Files:**
- Create: `supabase/migrations/00010_sprint3_tables.sql`

**Step 1: Write the migration**

```sql
-- Board Requests (denormalized from plans)
CREATE TABLE board_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  plan_id UUID REFERENCES plans(id),
  content TEXT NOT NULL,
  context TEXT,
  urgency TEXT NOT NULL DEFAULT 'low',
  fallback TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'responded', 'expired')),
  owner_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_board_requests_org_status ON board_requests(org_id, status);

-- CEO Chat Messages (bidirectional)
CREATE TABLE ceo_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'ceo')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ceo_chat_org ON ceo_chat_messages(org_id, created_at);

-- Enable realtime on new tables + existing tables needed by frontend
ALTER PUBLICATION supabase_realtime ADD TABLE board_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE ceo_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE initiatives;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
```

**Step 2: Apply migration**

Run: `bunx supabase db push` (or `bunx supabase migration up` if using local Supabase CLI)
Expected: Tables created, realtime enabled.

**Step 3: Commit**

```bash
git add supabase/migrations/00010_sprint3_tables.sql
git commit -m "feat: add board_requests and ceo_chat_messages tables for Sprint 3"
```

---

### Task 2: RLS Policies for Frontend Access

**Files:**
- Create: `supabase/migrations/00011_sprint3_rls.sql`

**Step 1: Write RLS policies**

The frontend uses the Supabase anon key + JWT from Supabase Auth. RLS policies must allow the authenticated owner to read/write their org's data. The engine uses `service_role` key which bypasses RLS.

The `orgs` table has `owner_id UUID` — this links to `auth.uid()`.

```sql
-- Helper function: check if user owns the org
CREATE OR REPLACE FUNCTION user_owns_org(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM orgs WHERE id = check_org_id AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- board_requests
ALTER TABLE board_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_board_requests" ON board_requests
  FOR SELECT USING (user_owns_org(org_id));
CREATE POLICY "owner_update_board_requests" ON board_requests
  FOR UPDATE USING (user_owns_org(org_id));

-- ceo_chat_messages
ALTER TABLE ceo_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_chat" ON ceo_chat_messages
  FOR SELECT USING (user_owns_org(org_id));
CREATE POLICY "owner_insert_chat" ON ceo_chat_messages
  FOR INSERT WITH CHECK (user_owns_org(org_id));

-- initiatives (read-only from frontend)
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_initiatives" ON initiatives
  FOR SELECT USING (user_owns_org(org_id));

-- tasks (read-only from frontend)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_tasks" ON tasks
  FOR SELECT USING (user_owns_org(org_id));

-- task_transitions (read-only)
ALTER TABLE task_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_transitions" ON task_transitions
  FOR SELECT USING (user_owns_org(org_id));

-- audit_log (read-only)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_audit" ON audit_log
  FOR SELECT USING (user_owns_org(org_id));

-- plans (read-only)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_plans" ON plans
  FOR SELECT USING (user_owns_org(org_id));

-- precepts (read-only)
ALTER TABLE precepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_precepts" ON precepts
  FOR SELECT USING (user_owns_org(org_id));

-- agent_profiles (read-only)
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_profiles" ON agent_profiles
  FOR SELECT USING (user_owns_org(org_id));

-- orgs (owner can read their own org)
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_orgs" ON orgs
  FOR SELECT USING (owner_id = auth.uid());
```

**Important:** Check if migration 00004 already enabled RLS on some tables with deny-all policies. If so, this migration needs to DROP those existing policies first before creating the new ones. Read `supabase/migrations/00004_rls.sql` to verify.

**Step 2: Apply migration**

Run: `bunx supabase db push`

**Step 3: Create Supabase Auth user and link to org (HARD GATE)**

**This step is a hard gate. If skipped, every RLS policy returns zero rows and the entire frontend shows empty data with no error.**

1. In Supabase Dashboard → Authentication → Users → "Add user":
   - Email: the owner's email
   - Password: a secure password
   - Copy the generated user UUID

2. Link the auth user to the org:
   ```sql
   UPDATE orgs SET owner_id = '<auth-user-uuid>' WHERE id = '<org-id>';
   ```

3. **Verify the link works** before proceeding:
   ```sql
   SELECT id, name, owner_id FROM orgs WHERE owner_id IS NOT NULL;
   ```
   Expected: One row with the correct `owner_id`. If zero rows, the frontend will return empty results for every query.

**Why this matters:** The RLS function `user_owns_org()` checks `orgs.owner_id = auth.uid()`. If `owner_id` is NULL or doesn't match the auth user's UUID, every `SELECT` through the anon key returns zero rows — silently. There is no error, just empty data everywhere.

**Step 4: Commit**

```bash
git add supabase/migrations/00011_sprint3_rls.sql
git commit -m "feat: add RLS policies for frontend access"
```

---

### Task 3: Install Web Dependencies

**Step 1: Install packages**

```bash
cd packages/web
bun add @supabase/supabase-js @supabase/ssr @xyflow/react elkjs motion date-fns
```

**Step 2: Add ShadCN components**

```bash
cd packages/web
bunx shadcn@latest add card table badge dialog scroll-area tooltip sidebar separator skeleton dropdown-menu
```

Note: `tabs` not needed yet (no multi-view sections in current design). `input` and `button` already exist.

**Step 3: Commit**

```bash
git add packages/web/package.json packages/web/src/components/ui/ bun.lock
git commit -m "feat: add Sprint 3 dependencies and ShadCN components"
```

---

### Task 4: Supabase Client Setup in Web Package

**Files:**
- Create: `packages/web/src/lib/supabase/client.ts` — browser client (for client components)
- Create: `packages/web/src/lib/supabase/server.ts` — server client (for server components + middleware)
- Create: `packages/web/.env.local` — Supabase env vars (gitignored)
- Modify: `.env.example` — document new vars

**Step 1: Create browser client**

```typescript
// packages/web/src/lib/supabase/client.ts
'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 2: Create server client**

```typescript
// packages/web/src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from Server Component — ignore
          }
        },
      },
    }
  )
}
```

**Step 3: Create env file**

```bash
# packages/web/.env.local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-dashboard>
NEXT_PUBLIC_ENGINE_URL=http://localhost:3001
```

**Step 4: Update .env.example**

Add to root `.env.example`:
```
# Web (packages/web/.env.local)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_ENGINE_URL=http://localhost:3001
```

**Step 5: Commit**

```bash
git add packages/web/src/lib/supabase/ .env.example
git commit -m "feat: add Supabase client setup for web package"
```

---

### Task 5: Auth — Login Page + Middleware

**Files:**
- Create: `packages/web/src/app/login/page.tsx`
- Create: `packages/web/src/middleware.ts`
- Modify: `packages/web/src/app/page.tsx` — redirect to /dashboard instead of /onboarding

**Step 1: Create login page**

A simple email + password form using ShadCN `input` and `button`. On submit, call `supabase.auth.signInWithPassword()`. On success, redirect to `/dashboard`.

```tsx
// packages/web/src/app/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Decision Room</h1>
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
```

**Step 2: Create middleware**

```typescript
// packages/web/src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/onboarding')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Step 3: Update root redirect**

Change `packages/web/src/app/page.tsx` to redirect to `/dashboard` instead of `/onboarding`.

**Step 4: Verify**

Run: `cd packages/web && bun run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add packages/web/src/app/login/ packages/web/src/middleware.ts packages/web/src/app/page.tsx
git commit -m "feat: add Supabase Auth login page and middleware"
```

---

### Task 6: App Layout with Sidebar Navigation

**Files:**
- Create: `packages/web/src/components/layout/app-sidebar.tsx`
- Create: `packages/web/src/components/layout/sidebar-provider-wrapper.tsx`
- Create: `packages/web/src/app/(dashboard)/layout.tsx` — route group layout with sidebar
- Create: `packages/web/src/hooks/use-org.ts` — fetch org data (org_id, name)

**Step 1: Create a route group `(dashboard)` for all authenticated pages**

All Decision Room pages share the sidebar layout. The onboarding page does NOT use the sidebar. Use a Next.js route group:

```
app/
  login/page.tsx          — no sidebar
  onboarding/page.tsx     — no sidebar (existing)
  (dashboard)/
    layout.tsx            — sidebar layout
    dashboard/
      page.tsx            — Dashboard home
      [id]/page.tsx       — Initiative drill-down
    structure/page.tsx
    chat/page.tsx
    audit/page.tsx
    precepts/page.tsx
```

**Step 2: Create the sidebar component**

Use the ShadCN `Sidebar` component. The sidebar needs:
- Org name at top (from `precepts` table via server component or hook)
- Nav links: Dashboard, Structure, CEO Chat, Audit Log, Precepts
- Bottom: engine status dot + last planning cycle time

Use `lucide-react` icons: `LayoutDashboard`, `Network`, `MessageSquare`, `ScrollText`, `FileText` for each nav item.

Engine status: subscribe to Supabase realtime connection state. Green dot = connected, red = disconnected. Last cycle time: query `audit_log` for most recent `event_type LIKE 'ceo.planning%'`.

```tsx
// packages/web/src/components/layout/app-sidebar.tsx
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu,
  SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupContent,
} from '@/components/ui/sidebar'
import { LayoutDashboard, Network, MessageSquare, ScrollText, FileText } from 'lucide-react'

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Structure', url: '/structure', icon: Network },
  { title: 'CEO Chat', url: '/chat', icon: MessageSquare },
  { title: 'Audit Log', url: '/audit', icon: ScrollText },
  { title: 'Precepts', url: '/precepts', icon: FileText },
]

export function AppSidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <p className="text-lg font-semibold">{orgName}</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.url)}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        {/* Engine status indicator — implemented in Task 31 */}
        <EngineStatus />
      </SidebarFooter>
    </Sidebar>
  )
}
```

**Step 3: Create the dashboard route group layout**

```tsx
// packages/web/src/app/(dashboard)/layout.tsx
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // Fetch org name from precepts
  const { data: org } = await supabase
    .from('orgs')
    .select('id, name')
    .single()

  return (
    <SidebarProvider>
      <AppSidebar orgName={org?.name ?? 'PRECEPT'} />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

**Step 4: Create `use-org` hook for client components needing org_id**

```typescript
// packages/web/src/hooks/use-org.ts
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useOrg() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('orgs').select('id, name').single().then(({ data }) => {
      if (data) {
        setOrgId(data.id)
        setOrgName(data.name)
      }
    })
  }, [])

  return { orgId, orgName }
}
```

**Step 5: Verify build**

Run: `cd packages/web && bun run build`
Expected: Build succeeds (pages may show placeholder content).

**Step 6: Commit**

```bash
git add packages/web/src/app/\(dashboard\)/ packages/web/src/components/layout/ packages/web/src/hooks/
git commit -m "feat: add sidebar navigation and dashboard route group layout"
```

---

## Phase 2: Dashboard

### Task 7: Dashboard Page — Mission Banner + Empty State

**Files:**
- Create: `packages/web/src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Create dashboard page**

Server component that fetches precepts (for mission statement) and renders the banner + placeholder sections.

```tsx
// packages/web/src/app/(dashboard)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: precepts } = await supabase
    .from('precepts')
    .select('content')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const mission = precepts?.content?.identity?.mission_statement ?? null

  // Fetch org_id for client component
  const { data: org } = await supabase.from('orgs').select('id').single()

  return <DashboardClient mission={mission} orgId={org?.id ?? ''} />
}
```

**Step 2: Create dashboard client component**

```tsx
// packages/web/src/components/dashboard/dashboard-client.tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { BoardRequests } from './board-requests'
import { InitiativeCards } from './initiative-cards'
import { Exceptions } from './exceptions'

interface DashboardClientProps {
  mission: string | null
  orgId: string
}

export function DashboardClient({ mission, orgId }: DashboardClientProps) {
  return (
    <div className="space-y-8">
      {/* Mission Banner */}
      {mission && (
        <Card className="border-none bg-muted/50">
          <CardContent className="py-4">
            <p className="text-center text-lg font-medium text-muted-foreground">{mission}</p>
          </CardContent>
        </Card>
      )}

      <BoardRequests orgId={orgId} />
      <InitiativeCards orgId={orgId} />
      <Exceptions orgId={orgId} />
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add packages/web/src/app/\(dashboard\)/dashboard/ packages/web/src/components/dashboard/
git commit -m "feat: add dashboard page with mission banner"
```

---

### Task 8: Board Requests Section

**Files:**
- Create: `packages/web/src/components/dashboard/board-requests.tsx`
- Create: `packages/web/src/hooks/use-realtime.ts` — reusable realtime subscription hook

**Step 1: Create reusable realtime hook**

```typescript
// packages/web/src/hooks/use-realtime.ts
'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface UseRealtimeOptions {
  table: string
  filter?: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  onPayload: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
}

export function useRealtime({ table, filter, event = '*', onPayload }: UseRealtimeOptions) {
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`${table}-realtime`)
      .on(
        'postgres_changes',
        { event, schema: 'public', table, filter },
        onPayload
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [table, filter, event]) // onPayload intentionally excluded — wrap in useCallback at call site
}
```

**Step 2: Create board requests component**

Shows pending board requests as cards. "Respond" button opens a Dialog. Response is sent via engine API (`POST /api/orchestration/board-requests/:id/respond`).

Subscribe to `board_requests` table for real-time updates.

Fetch pattern: `supabase.from('board_requests').select().eq('org_id', orgId).eq('status', 'pending').order('created_at')`

Use ShadCN `Card`, `Badge` (for urgency), `Dialog`, `Button`, `Textarea`.

**Step 3: Commit**

```bash
git add packages/web/src/components/dashboard/board-requests.tsx packages/web/src/hooks/use-realtime.ts
git commit -m "feat: add board requests section with real-time"
```

---

### Task 9: Initiative Cards with Health Color Logic

**Files:**
- Create: `packages/web/src/components/dashboard/initiative-cards.tsx`
- Create: `packages/web/src/lib/health.ts` — pure function for health color calculation
- Create: `packages/web/src/lib/__tests__/health.test.ts`

**Step 1: Write failing test for health color logic**

```typescript
// packages/web/src/lib/__tests__/health.test.ts
import { describe, test, expect } from 'bun:test'
import { getInitiativeHealth } from '../health'

describe('getInitiativeHealth', () => {
  test('returns green when all tasks progressing normally', () => {
    const tasks = [
      { state: 'ACCEPTED' }, { state: 'IN_PROGRESS' }, { state: 'PLANNED' }
    ]
    expect(getInitiativeHealth(tasks)).toBe('green')
  })

  test('returns yellow when any task in POLISH or REVISION', () => {
    const tasks = [
      { state: 'ACCEPTED' }, { state: 'POLISH' }
    ]
    expect(getInitiativeHealth(tasks)).toBe('yellow')
  })

  test('returns red when any task ESCALATED or FAILED', () => {
    const tasks = [
      { state: 'ACCEPTED' }, { state: 'ESCALATED' }
    ]
    expect(getInitiativeHealth(tasks)).toBe('red')
  })

  test('returns red when initiative is paused', () => {
    expect(getInitiativeHealth([], 'paused')).toBe('red')
  })

  test('returns green when no tasks', () => {
    expect(getInitiativeHealth([])).toBe('green')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd packages/web && bun test src/lib/__tests__/health.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement health logic**

```typescript
// packages/web/src/lib/health.ts
type HealthColor = 'green' | 'yellow' | 'red'

export function getInitiativeHealth(
  tasks: Array<{ state: string }>,
  initiativeStatus?: string
): HealthColor {
  if (initiativeStatus === 'paused' || initiativeStatus === 'abandoned') return 'red'

  const states = tasks.map(t => t.state)

  if (states.includes('ESCALATED') || states.includes('FAILED')) return 'red'
  if (states.includes('POLISH') || states.includes('REVISION')) return 'yellow'

  return 'green'
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/web && bun test src/lib/__tests__/health.test.ts`
Expected: PASS

**Step 5: Create initiative cards component**

Fetches initiatives + task counts from Supabase. Each card shows: name, phase progress bar, health dot, task count summary. Click navigates to `/dashboard/[initiative_id]`.

Fetch pattern:
```typescript
const { data: initiatives } = await supabase.from('initiatives').select('*').eq('org_id', orgId).eq('status', 'active')
// For each initiative, get task counts:
const { data: tasks } = await supabase.from('tasks').select('id, state, initiative_id').eq('org_id', orgId)
```

Subscribe to `tasks` and `initiatives` for real-time updates.

Use ShadCN `Card`. Health dot is a `<span>` with `bg-green-500`, `bg-yellow-500`, or `bg-red-500` + `rounded-full w-2.5 h-2.5`.

**Step 6: Commit**

```bash
git add packages/web/src/components/dashboard/initiative-cards.tsx packages/web/src/lib/health.ts packages/web/src/lib/__tests__/
git commit -m "feat: add initiative cards with health color logic"
```

---

### Task 10: Exceptions Section

**Files:**
- Create: `packages/web/src/components/dashboard/exceptions.tsx`

**Step 1: Create exceptions component**

Queries tasks where `state IN ('ESCALATED', 'FAILED')` for the org. If none, render nothing (silence = success). If some exist, show them as a list of warning/info lines.

Real-time subscription on `tasks` (reuse the same subscription from initiative cards — or use a shared state provider at the dashboard level).

Use `lucide-react` icons: `AlertTriangle` for escalated, `Info` for failed.

**Step 2: Commit**

```bash
git add packages/web/src/components/dashboard/exceptions.tsx
git commit -m "feat: add exceptions section to dashboard"
```

---

## Phase 3: Initiative Drill-Down

### Task 11: Initiative Detail Page

**Files:**
- Create: `packages/web/src/app/(dashboard)/dashboard/[id]/page.tsx`
- Create: `packages/web/src/components/initiative/initiative-detail.tsx`
- Create: `packages/web/src/components/initiative/task-table.tsx`
- Create: `packages/web/src/components/initiative/task-detail.tsx`

**Step 1: Create the page (server component)**

```tsx
// packages/web/src/app/(dashboard)/dashboard/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { InitiativeDetail } from '@/components/initiative/initiative-detail'
import { notFound } from 'next/navigation'

export default async function InitiativePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: initiative } = await supabase
    .from('initiatives')
    .select('*')
    .eq('id', id)
    .single()

  if (!initiative) notFound()

  return <InitiativeDetail initiative={initiative} />
}
```

**Step 2: Create initiative detail client component**

Shows:
- Back link to `/dashboard`
- Initiative header: name, status, health dot, created date
- Link to view CEO planning reasoning (fetch from `plans` table on demand)
- Phase sections: group tasks by `phase` field, one collapsible section per phase
- Task table within each phase

**Step 3: Create task table component**

Columns: description (from `spec.description`), state badge, latest verdict, assigned worker. Clickable row.

State badge colors match the org chart role colors — but for task states:
- PLANNED/QUEUED: muted gray
- DISPATCHED/IN_PROGRESS: blue
- REVIEW/JUDGMENT: teal
- POLISH/REVISION: yellow
- ACCEPTED: green
- ESCALATED/FAILED: red

**Step 4: Create task detail component**

Expanded view when a task row is clicked. Fetches on expand:
- Full spec (from `tasks.spec` JSONB)
- Worker output (from `tasks.output` JSONB)
- Review history: query `audit_log` filtered by task_id, event types containing 'reviewer' or 'judge'
- State transitions: query `task_transitions` filtered by task_id, ordered by created_at

Display as a structured panel with labeled sections.

**Step 5: Add real-time subscription on tasks for this initiative**

Filter: `initiative_id=eq.${initiative.id}`

**Step 6: Commit**

```bash
git add packages/web/src/app/\(dashboard\)/dashboard/\[id\]/ packages/web/src/components/initiative/
git commit -m "feat: add initiative drill-down page with task detail"
```

---

## Phase 4: CEO Chat

### Task 12: Shared Types + Engine DB Functions for CEO Chat

**Files:**
- Modify: `packages/shared/src/index.ts` — export new chat types
- Create or modify: `packages/engine/src/db/chat.ts` — DB functions for ceo_chat_messages

**Step 1: Add shared types**

```typescript
// Add to packages/shared/src/index.ts or a new chat.ts file
export interface CeoChatMessage {
  id: string
  org_id: string
  role: 'owner' | 'ceo'
  content: string
  created_at: string
}
```

**Step 2: Add DB functions in engine**

```typescript
// packages/engine/src/db/chat.ts
import { db } from './client.js'

export async function insertChatMessage(orgId: string, role: 'owner' | 'ceo', content: string) {
  const { data, error } = await db
    .from('ceo_chat_messages')
    .insert({ org_id: orgId, role, content })
    .select()
    .single()
  if (error) throw new Error(`Failed to insert chat message: ${error.message}`)
  return data
}

export async function getChatHistory(orgId: string, limit = 50) {
  const { data, error } = await db
    .from('ceo_chat_messages')
    .select()
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`Failed to get chat history: ${error.message}`)
  return data ?? []
}
```

**Step 3: Commit**

```bash
git add packages/shared/src/ packages/engine/src/db/chat.ts
git commit -m "feat: add CEO chat types and DB functions"
```

---

### Task 13: CEO Chat Engine Endpoint + Service Method

**Files:**
- Modify: `packages/engine/src/services/ceo.ts` — add `handleChatMessage`
- Modify: `packages/engine/src/routes/orchestration.ts` — add `/ceo-chat` route

**Step 1: Add CEO chat prompt**

Create a new system prompt for the CEO chat mode. The CEO should:
- Have access to current org state (active initiatives, recent activity)
- Answer questions about organizational decisions
- Acknowledge direction-setting from the owner
- NOT execute commands directly — acknowledge and incorporate in next cycle

Store the prompt as a constant in `packages/engine/src/prompts/` or inline in the CEO service.

**Step 2: Add `handleChatMessage` to CEOService**

Follow the `handleOwnerReply` pattern:

```typescript
async handleChatMessage(orgId: string, message: string): Promise<string> {
  // Store owner message
  await insertChatMessage(orgId, 'owner', message)

  // Gather context
  const initiatives = await getActiveInitiatives(orgId)
  const recentAudit = await getRecentAuditEvents(orgId, 20)
  const precepts = await getPrecepts(orgId)

  // Invoke CEO
  const response = await invokeAgent('CEO-1', {
    orgId,
    model: 'opus',
    systemPrompt: CEO_CHAT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildChatMessage({ message, initiatives, recentAudit, precepts }) }],
    temperature: 0.4,
  })

  // Store CEO response
  await insertChatMessage(orgId, 'ceo', response.content)

  logEvent(orgId, 'ceo.chat', 'CEO-1', { ownerMessage: message.substring(0, 100) })
  return response.content
}
```

**Step 3: Add route**

```typescript
// In packages/engine/src/routes/orchestration.ts
orchestration.post('/ceo-chat', async (c) => {
  const body = await c.req.json<{ orgId: string; message: string }>()
  if (!body?.orgId || !body?.message) {
    return c.json({ error: 'orgId and message required' }, 400)
  }

  try {
    const response = await ceo.handleChatMessage(body.orgId, body.message)
    return c.json({ response })
  } catch (err) {
    console.error('[ceo-chat] Error:', err)
    return c.json({ error: 'CEO chat failed' }, 500)
  }
})
```

Note: This route is synchronous (waits for CEO response) unlike other routes that push events. This is intentional — CEO Chat is a direct conversation, not an async event.

**Step 4: Verify engine builds**

Run: `cd packages/engine && bun run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add packages/engine/src/services/ceo.ts packages/engine/src/routes/orchestration.ts packages/engine/src/db/chat.ts
git commit -m "feat: add CEO chat endpoint and service method"
```

---

### Task 14: CEO Chat Page UI

**Files:**
- Create: `packages/web/src/app/(dashboard)/chat/page.tsx`
- Create: `packages/web/src/components/chat/ceo-chat.tsx`

**Step 1: Create chat page**

Reuse patterns from existing `components/chat/ChatPanel.tsx` and `ChatMessage.tsx` (Sprint 1 onboarding chat). The CEO Chat has the same basic shape — message list + input — but reads from `ceo_chat_messages` via Supabase instead of the engine's onboarding API.

Key differences from onboarding chat:
- Messages loaded from `ceo_chat_messages` table via Supabase on mount
- New messages sent via `POST /api/orchestration/ceo-chat` (engine API)
- Real-time subscription on `ceo_chat_messages` for new message appearance
- Typing indicator shown while waiting for CEO response (track with local `isThinking` state)
- No file upload
- Owner messages on right (same as onboarding), CEO messages on left

**Step 2: Message flow**

1. Load history: `supabase.from('ceo_chat_messages').select().eq('org_id', orgId).order('created_at')`
2. Owner sends message: `POST` to engine, set `isThinking = true`
3. Engine stores both messages in DB, returns CEO response
4. Real-time subscription fires for the new messages, adds them to the list
5. Set `isThinking = false`

Alternative: Don't wait for the POST response to update UI — let the real-time subscription handle it. The POST just triggers the flow. This is cleaner and avoids duplicate message rendering.

**Step 3: Commit**

```bash
git add packages/web/src/app/\(dashboard\)/chat/ packages/web/src/components/chat/ceo-chat.tsx
git commit -m "feat: add CEO chat page"
```

---

## Phase 5: Audit Log

### Task 15: Audit Log Page

**Files:**
- Create: `packages/web/src/app/(dashboard)/audit/page.tsx`
- Create: `packages/web/src/components/audit/audit-log.tsx`
- Create: `packages/web/src/components/audit/audit-filters.tsx`

**Step 1: Create audit log client component**

Features:
- Filterable table using ShadCN `Table`
- Filter bar: role dropdown (`DropdownMenu` or `Select`), event type dropdown, date range (two `Input[type=date]`), free text search (`Input`)
- Paginated: fetch 50 at a time, "Load more" button
- Query: `supabase.from('audit_log').select().eq('org_id', orgId).order('created_at', { ascending: false }).range(offset, offset + 49)`
- Apply filters via `.ilike('agent', role)`, `.ilike('event_type', eventType)`, `.gte('created_at', startDate)`, `.lte('created_at', endDate)`, `.or(\`event_type.ilike.%${search}%,detail.cs.{"${search}"}\`)`
- Click row to expand: show full `detail` JSONB formatted as pretty-printed JSON or structured key-value pairs

Role badge colors (same as Structure page):
```typescript
const ROLE_COLORS: Record<string, string> = {
  CEO: 'bg-blue-100 text-blue-800',
  Advisor: 'bg-purple-100 text-purple-800',
  Scribe: 'bg-gray-100 text-gray-800',
  Curator: 'bg-gray-100 text-gray-800',
  Dispatcher: 'bg-orange-100 text-orange-800',
  Reviewer: 'bg-teal-100 text-teal-800',
  Judge: 'bg-red-100 text-red-800',
  Worker: 'bg-green-100 text-green-800',
}
```

**Step 2: Add real-time subscription**

Subscribe to `audit_log` INSERT events. New events prepend to the list with a CSS fade-in animation:

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Step 3: Commit**

```bash
git add packages/web/src/app/\(dashboard\)/audit/ packages/web/src/components/audit/
git commit -m "feat: add audit log page with filters and real-time"
```

---

## Phase 6: Precepts Viewer

### Task 16: Precepts Viewer Page

**Files:**
- Create: `packages/web/src/app/(dashboard)/precepts/page.tsx`
- Create: `packages/web/src/components/precepts/precepts-viewer.tsx`

**Step 1: Create precepts viewer**

Server-rendered page (no real-time needed). Fetches `precepts.content` JSONB and renders as structured document.

Reuse patterns from existing `components/precepts/PreceptField.tsx` and `PreceptsPanel.tsx` — these already render fields with state color coding (green/yellow/orange/red for confirmed/hypothesis/research_pending/open_question).

Reference `packages/shared/src/precepts.ts` for `PRECEPTS_FIELDS` (the 10 fields), `FIELD_LABELS`, and `FieldState` type.

Sections (matching onboarding phases):
1. Identity — mission_statement, core_values, operating_principles
2. Product — primary_product, target_customers, competitive_advantage
3. Reality — current_resources, key_constraints
4. Ambition — success_definition, time_horizon

Each field shows: label, state indicator (✓ ~ ? ○), value.

State indicator mapping:
- `confirmed` → ✓ (green)
- `hypothesis` → ~ (yellow)
- `research_pending` → ? (orange)
- `open_question` → ○ (red/empty)

**Step 2: Commit**

```bash
git add packages/web/src/app/\(dashboard\)/precepts/ packages/web/src/components/precepts/precepts-viewer.tsx
git commit -m "feat: add precepts viewer page"
```

---

## Phase 7: Structure Page (Live Org Chart)

### Task 17: React Flow Setup + ELK Layout

**Files:**
- Create: `packages/web/src/app/(dashboard)/structure/page.tsx`
- Create: `packages/web/src/components/structure/org-chart.tsx`
- Create: `packages/web/src/lib/elk-layout.ts` — ELK.js layout calculation

**Step 1: Create ELK layout helper**

```typescript
// packages/web/src/lib/elk-layout.ts
import ELK from 'elkjs/lib/elk.bundled.js'

const elk = new ELK()

interface LayoutNode { id: string; width: number; height: number }
interface LayoutEdge { id: string; sources: string[]; targets: string[] }

export async function getLayoutedElements(
  nodes: LayoutNode[],
  edges: LayoutEdge[]
): Promise<Map<string, { x: number; y: number }>> {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
    },
    children: nodes.map(n => ({ id: n.id, width: n.width, height: n.height })),
    edges: edges.map(e => ({ id: e.id, sources: e.sources, targets: e.targets })),
  }

  const laid = await elk.layout(graph)
  const positions = new Map<string, { x: number; y: number }>()
  for (const child of laid.children ?? []) {
    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 })
  }
  return positions
}
```

**Step 2: Define org structure data**

The hierarchy is fixed (from `structure.md`). Define nodes and edges as constants:

```typescript
const ORG_NODES = [
  { id: 'board', role: 'Board', label: 'Board (Owner)', model: '—' },
  { id: 'ceo', role: 'CEO', label: 'CEO', model: 'Opus 4.6' },
  { id: 'advisor', role: 'Advisor', label: 'Advisor', model: 'Opus 4.6' },
  { id: 'scribe', role: 'Scribe', label: 'Scribe', model: 'Sonnet 4.6' },
  { id: 'reviewer', role: 'Reviewer', label: 'Reviewer', model: 'Sonnet 4.6' },
  { id: 'judge', role: 'Judge', label: 'Judge', model: 'Opus 4.6' },
  { id: 'curator', role: 'Curator', label: 'Curator', model: 'Sonnet 4.6' },
  { id: 'dispatcher', role: 'Dispatcher', label: 'Dispatcher', model: 'Sonnet 4.6' },
]

const ORG_EDGES = [
  { id: 'board-ceo', source: 'board', target: 'ceo' },
  { id: 'board-advisor', source: 'board', target: 'advisor' },
  { id: 'ceo-scribe', source: 'ceo', target: 'scribe' },
  { id: 'ceo-reviewer', source: 'ceo', target: 'reviewer' },
  { id: 'ceo-judge', source: 'ceo', target: 'judge' },
  { id: 'ceo-curator', source: 'ceo', target: 'curator' },
  { id: 'ceo-dispatcher', source: 'ceo', target: 'dispatcher' },
  // Worker edges added dynamically based on active tasks
]
```

**Step 3: Create org chart component**

```tsx
// packages/web/src/components/structure/org-chart.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { ReactFlow, Background, Controls, useNodesState, useEdgesState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AgentNode } from './agent-node'
import { AnimatedEdge } from './animated-edge'
import { getLayoutedElements } from '@/lib/elk-layout'

const nodeTypes = { agent: AgentNode }
const edgeTypes = { animated: AnimatedEdge }

export function OrgChart({ orgId }: { orgId: string }) {
  // Build React Flow nodes and edges from ORG_NODES + dynamic workers
  // Call getLayoutedElements() on mount to compute positions
  // Subscribe to audit_log for real-time node state updates
  // ...
}
```

**Step 4: Commit**

```bash
git add packages/web/src/app/\(dashboard\)/structure/ packages/web/src/components/structure/ packages/web/src/lib/elk-layout.ts
git commit -m "feat: add structure page with React Flow and ELK layout"
```

---

### Task 18: Custom Agent Node Component

**Files:**
- Create: `packages/web/src/components/structure/agent-node.tsx`

**Step 1: Create custom node**

```tsx
// packages/web/src/components/structure/agent-node.tsx
'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

const ROLE_COLORS: Record<string, string> = {
  Board: 'border-yellow-500',
  CEO: 'border-blue-500',
  Advisor: 'border-purple-500',
  Scribe: 'border-gray-400',
  Curator: 'border-gray-400',
  Dispatcher: 'border-orange-500',
  Reviewer: 'border-teal-500',
  Judge: 'border-red-500',
  Worker: 'border-green-500',
}

const ROLE_BG: Record<string, string> = {
  Board: 'bg-yellow-50',
  CEO: 'bg-blue-50',
  // ... same pattern
}

export interface AgentNodeData {
  role: string
  label: string
  model: string
  status: 'idle' | 'active' | 'waiting'
  currentTask?: string
}

export const AgentNode = memo(function AgentNode({ data }: NodeProps) {
  const d = data as AgentNodeData
  const borderColor = ROLE_COLORS[d.role] ?? 'border-gray-300'

  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div
        className={`rounded-lg border-2 px-4 py-3 shadow-sm transition-all ${borderColor} ${
          d.status === 'idle' ? 'opacity-50' : ''
        } ${
          d.status === 'active' ? 'shadow-md' : ''
        } ${
          d.status === 'waiting' ? 'border-dashed' : ''
        }`}
        style={d.status === 'active' ? {
          animation: 'pulse-glow 2s ease-in-out infinite',
        } : undefined}
      >
        <p className="font-semibold text-sm">{d.label}</p>
        <p className="text-xs text-muted-foreground">{d.model}</p>
        {d.currentTask && (
          <p className="text-xs mt-1 truncate max-w-[140px]">{d.currentTask}</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </>
  )
})
```

**Step 2: Add pulse-glow CSS animation to globals.css**

```css
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  50% { box-shadow: 0 0 12px 4px rgba(59, 130, 246, 0.3); }
}
```

**Step 3: Commit**

```bash
git add packages/web/src/components/structure/agent-node.tsx packages/web/src/app/globals.css
git commit -m "feat: add custom agent node component for org chart"
```

---

### Task 19: Animated Edge Component

**Files:**
- Create: `packages/web/src/components/structure/animated-edge.tsx`

**Step 1: Create animated edge**

Custom React Flow edge with an SVG circle that travels along the path when `animated` is true.

```tsx
// packages/web/src/components/structure/animated-edge.tsx
'use client'

import { memo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

export const AnimatedEdge = memo(function AnimatedEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })

  const isAnimated = (data as { animated?: boolean })?.animated ?? false

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: isAnimated ? '#3b82f6' : '#d1d5db',
          strokeWidth: isAnimated ? 2 : 1,
          transition: 'stroke 0.3s, stroke-width 0.3s',
        }}
        {...props}
      />
      {isAnimated && (
        <circle r="4" fill="#3b82f6">
          <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
    </>
  )
})
```

**Step 2: Commit**

```bash
git add packages/web/src/components/structure/animated-edge.tsx
git commit -m "feat: add animated edge component for org chart"
```

---

### Task 20: Real-Time Audit Event → Node State Mapping

**Files:**
- Modify: `packages/web/src/components/structure/org-chart.tsx` — add real-time subscription
- Create: `packages/web/src/lib/audit-to-node.ts` — map audit events to node state changes

**Step 1: Create mapping logic**

```typescript
// packages/web/src/lib/audit-to-node.ts
export function auditEventToNodeId(eventType: string): string | null {
  if (eventType.startsWith('ceo.')) return 'ceo'
  if (eventType.startsWith('advisor.')) return 'advisor'
  if (eventType.startsWith('scribe.')) return 'scribe'
  if (eventType.startsWith('curator.')) return 'curator'
  if (eventType.startsWith('dispatcher.')) return 'dispatcher'
  if (eventType.startsWith('reviewer.')) return 'reviewer'
  if (eventType.startsWith('judge.')) return 'judge'
  if (eventType.startsWith('worker.')) return null // handled by agent_id → dynamic worker node
  return null
}

export function auditEventToEdge(eventType: string): string | null {
  // Map audit events to edge IDs to animate
  if (eventType === 'ceo.briefing') return 'board-ceo'
  if (eventType === 'owner.reply') return 'board-ceo'
  if (eventType.startsWith('dispatcher.')) return 'ceo-dispatcher'
  if (eventType.startsWith('reviewer.')) return 'ceo-reviewer'
  if (eventType.startsWith('judge.verdict')) return 'ceo-judge'
  if (eventType.startsWith('judge.escalation')) return 'ceo-judge'
  return null
}
```

**Step 2: Wire into org chart**

Subscribe to `audit_log` INSERT events. On each event:
1. Map event_type to node ID → set that node to `active`
2. Map event_type to edge ID → set that edge to `animated`
3. After 3 seconds, revert node to `idle` and edge to static

Use `setTimeout` for the revert. Track active timers to clear them if a new event comes in for the same node.

**Step 3: Add dynamic worker nodes**

Query active workers: `SELECT DISTINCT assigned_worker, role FROM tasks WHERE org_id = ? AND state IN ('DISPATCHED', 'IN_PROGRESS', 'REVIEW', 'JUDGMENT', 'REVISION', 'POLISH')`

Add worker nodes under the dispatcher with edges `dispatcher → worker-{id}`.

**Step 4: Add node click behavior**

On node click, show a panel (or use ShadCN `Tooltip` / `Dialog`) with:
- Role name and model
- Current status
- Performance stats from `agent_profiles` table
- Last activity timestamp from most recent `audit_log` entry for that agent

**Step 5: Commit**

```bash
git add packages/web/src/components/structure/ packages/web/src/lib/audit-to-node.ts
git commit -m "feat: add real-time audit event mapping and node interactions"
```

---

## Phase 8: Engine Integration

### Task 21: Board Request Generation During Planning/Briefing

**Files:**
- Modify: `packages/engine/src/services/ceo.ts` — after planning cycle creates board requests, write to `board_requests` table
- Create: `packages/engine/src/db/boardRequests.ts` — DB functions for board_requests table

**Step 1: Add DB functions**

```typescript
// packages/engine/src/db/boardRequests.ts
import { db } from './client.js'

export async function createBoardRequest(
  orgId: string,
  planId: string,
  request: { request: string; context: string; urgency: string; fallback: string }
) {
  const { error } = await db.from('board_requests').insert({
    org_id: orgId,
    plan_id: planId,
    content: request.request,
    context: request.context,
    urgency: request.urgency,
    fallback: request.fallback,
  })
  if (error) throw new Error(`Failed to create board request: ${error.message}`)
}

export async function respondToBoardRequest(id: string, response: string) {
  const { error } = await db.from('board_requests').update({
    status: 'responded',
    owner_response: response,
    responded_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw new Error(`Failed to respond to board request: ${error.message}`)
}
```

**Step 2: Wire into CEO planning cycle**

In `CEOService.planningCycle()`, after the CEO generates a plan with `board_requests`, iterate and call `createBoardRequest()` for each one. Find the exact location in `ceo.ts` where `plan.content.board_requests` is available and add the writes there.

**Step 3: Add board request response endpoint**

```typescript
// In packages/engine/src/routes/orchestration.ts
orchestration.post('/board-requests/:id/respond', async (c) => {
  const { id } = c.req.param()
  const body = await c.req.json<{ orgId: string; response: string }>()
  if (!body?.orgId || !body?.response) {
    return c.json({ error: 'orgId and response required' }, 400)
  }

  await respondToBoardRequest(id, body.response)

  // Also push as owner_reply event so the engine processes it
  engine.push({
    type: 'owner_reply',
    orgId: body.orgId,
    briefingId: 'board_request',
    content: body.response,
  })

  return c.json({ status: 'responded' })
})
```

**Step 4: Verify engine builds**

Run: `cd packages/engine && bun run build`

**Step 5: Commit**

```bash
git add packages/engine/src/db/boardRequests.ts packages/engine/src/services/ceo.ts packages/engine/src/routes/orchestration.ts
git commit -m "feat: add board request generation and response endpoint"
```

---

## Phase 9: Polish + Wiring

### Task 22: Engine Status Indicator in Sidebar

**Files:**
- Create: `packages/web/src/components/layout/engine-status.tsx`
- Modify: `packages/web/src/components/layout/app-sidebar.tsx` — import and render EngineStatus

**Step 1: Create engine status component**

Monitors Supabase realtime connection health. Also queries the most recent `audit_log` entry with `event_type LIKE 'ceo.planning%'` to show "Last cycle: X ago".

```tsx
// packages/web/src/components/layout/engine-status.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'

export function EngineStatus() {
  const [connected, setConnected] = useState(true)
  const [lastCycle, setLastCycle] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Monitor connection health via a heartbeat channel
    const channel = supabase.channel('connection-health')
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    // Fetch last planning cycle
    supabase
      .from('audit_log')
      .select('created_at')
      .like('event_type', 'ceo.planning%')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setLastCycle(data.created_at)
      })

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span>Engine: {connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      {lastCycle && (
        <p>Last cycle: {formatDistanceToNow(new Date(lastCycle), { addSuffix: true })}</p>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add packages/web/src/components/layout/engine-status.tsx packages/web/src/components/layout/app-sidebar.tsx
git commit -m "feat: add engine status indicator to sidebar"
```

---

### Task 23: Root Redirect + Final Wiring

**Files:**
- Modify: `packages/web/src/app/page.tsx` — redirect to /dashboard
- Verify all pages render without errors

**Step 1: Update root redirect**

```tsx
// packages/web/src/app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

**Step 2: Full build verification**

Run: `cd packages/web && bun run build`
Expected: All pages build successfully.

Run: `cd packages/engine && bun run build`
Expected: Engine builds successfully.

**Step 3: Manual smoke test**

1. Start Supabase: `bunx supabase start`
2. Apply migrations: `bunx supabase db push`
3. Start engine: `bun run dev:engine`
4. Start web: `bun run dev:web`
5. Navigate to `localhost:3000` → should redirect to `/login`
6. Login → should redirect to `/dashboard`
7. Verify each page loads without errors

**Step 4: Commit**

```bash
git add packages/web/src/app/page.tsx
git commit -m "feat: wire root redirect and finalize Sprint 3 routing"
```

---

## Dependency Graph

```
Task 1 (migration)  ──┐
Task 2 (RLS)  ────────┤
Task 3 (deps)  ────────┼── Task 6 (sidebar layout) ──┬── Task 7-10 (Dashboard)
Task 4 (supabase)  ────┤                              ├── Task 11 (Drill-down)
Task 5 (auth)  ────────┘                              ├── Task 14 (CEO Chat UI)
                                                      ├── Task 15 (Audit Log)
Task 12-13 (Chat engine) ─── Task 14 (Chat UI)       ├── Task 16 (Precepts)
                                                      ├── Task 17-20 (Structure)
Task 21 (Board Request engine) ── Task 8 (Board Req UI)
Task 22 (Engine status) ── Task 6 (sidebar)
Task 23 (root redirect) ── all pages
```

Phase 1 (Tasks 1-6) must complete first. After that, Phases 2-7 can be built in any order. Phase 8 (engine integration) can be done in parallel with frontend phases. Phase 9 is final wiring.
