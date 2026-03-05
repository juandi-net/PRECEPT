# Org Switcher Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an org switcher dropdown next to the org name in the top-left header, allowing owners to switch between their organizations.

**Architecture:** Cookie-based org persistence with full page reload on switch. Server component reads the cookie to determine active org, fetches all orgs for the dropdown, and passes them to a client component. Plain HTML dropdown, no ShadCN.

**Tech Stack:** Next.js App Router, Supabase, TypeScript, plain CSS

---

### Task 1: Create `<OrgSwitcher>` client component

**Files:**
- Create: `packages/web/src/components/org-switcher.tsx`

**Step 1: Write the component**

```tsx
'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Org {
  id: string
  name: string
}

export function OrgSwitcher({ orgs, activeOrg }: { orgs: Org[]; activeOrg: Org }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  function switchOrg(orgId: string) {
    document.cookie = `active_org_id=${orgId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="org-switcher" ref={ref}>
      <button className="org-switcher-trigger" onClick={() => setOpen(!open)}>
        <strong>{activeOrg.name.toUpperCase()}</strong>
        <span className="org-switcher-chevron">&#9662;</span>
      </button>
      {open && (
        <div className="org-switcher-dropdown">
          {orgs.map((o) => (
            <button
              key={o.id}
              className={`org-switcher-item${o.id === activeOrg.id ? ' org-switcher-item--active' : ''}`}
              onClick={() => switchOrg(o.id)}
            >
              {o.name.toUpperCase()}
            </button>
          ))}
          <div className="org-switcher-divider" />
          <a href="/onboarding" className="org-switcher-item org-switcher-item--add">
            + Add Organization
          </a>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add packages/web/src/components/org-switcher.tsx
git commit -m "feat: add OrgSwitcher client component"
```

---

### Task 2: Add CSS styles for the dropdown

**Files:**
- Modify: `packages/web/src/app/interface/interface.css`

**Step 1: Add styles after the `.interface-header` block**

```css
/* Org switcher */
.org-switcher {
  position: relative;
}

.org-switcher-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: none;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.875rem;
  color: #111;
  cursor: pointer;
  padding: 0;
}

.org-switcher-chevron {
  font-size: 0.65rem;
  line-height: 1;
}

.org-switcher-dropdown {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  min-width: 180px;
  background: #fff;
  border: 1px solid #ddd;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.875rem;
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.org-switcher-item {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  text-align: left;
  background: none;
  border: none;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.875rem;
  color: #111;
  cursor: pointer;
  text-decoration: none;
}

.org-switcher-item:hover {
  background: #f5f5f5;
}

.org-switcher-item--active {
  font-weight: bold;
}

.org-switcher-item--add {
  color: #666;
}

.org-switcher-divider {
  height: 1px;
  background: #ddd;
}
```

**Step 2: Commit**

```bash
git add packages/web/src/app/interface/interface.css
git commit -m "feat: add org switcher dropdown styles"
```

---

### Task 3: Wire up the server component

**Files:**
- Modify: `packages/web/src/app/interface/page.tsx`

**Step 1: Update imports**

Add at top:
```tsx
import { cookies } from 'next/headers'
import { OrgSwitcher } from '@/components/org-switcher'
```

**Step 2: Replace single-org fetch with multi-org fetch + cookie resolution**

Replace the existing org fetch block (lines 31-36):
```tsx
const { data: org } = await supabase
  .from('orgs')
  .select('id, name')
  .single()

if (!org) redirect('/onboarding')
```

With:
```tsx
const { data: orgs } = await supabase
  .from('orgs')
  .select('id, name')
  .order('created_at')

if (!orgs || orgs.length === 0) redirect('/onboarding')

const cookieStore = await cookies()
const savedOrgId = cookieStore.get('active_org_id')?.value
const org = orgs.find((o) => o.id === savedOrgId) ?? orgs[0]
```

**Step 3: Replace the org name span in the header with `<OrgSwitcher>`**

Replace:
```tsx
<span><strong>{org.name.toUpperCase()}</strong></span>
```

With:
```tsx
<OrgSwitcher orgs={orgs} activeOrg={org} />
```

**Step 4: Commit**

```bash
git add packages/web/src/app/interface/page.tsx
git commit -m "feat: wire org switcher into interface page"
```

---

### Task 4: Build verification

**Step 1: Run the build**

```bash
cd packages/web && bun run build
```

Expected: Build succeeds with no errors.

**Step 2: Final commit (squash or amend if needed)**

If build passes, all done. If not, fix any type errors and commit the fix.
