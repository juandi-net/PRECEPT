# The Interface Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the multi-column command center dashboard with a minimal letter-based interface at `/interface`.

**Architecture:** Server component fetches latest CEO letter from `ceo_chat_messages`, renders it with markdown links parsed to `<a>` tags. Client component handles textarea input, POSTs to existing `/api/orchestration/ceo-chat`. Engine briefing prompt changes from structured JSON to plain-text letter output. Login page restyled to match.

**Tech Stack:** Next.js 16 (App Router), Supabase, Hono engine, plain CSS (no component library on Interface/login pages)

---

### Task 1: Update CEO Prompts — Briefing Letter Format

The CEO briefing prompt currently produces structured JSON (`BriefingContent`). Change it to produce a plain-text letter with markdown links. This is the foundation — everything downstream depends on the new output format.

**Files:**
- Modify: `packages/engine/src/ai/prompts/ceo-briefing.ts`
- Modify: `packages/shared/src/briefing.ts`
- Modify: `packages/engine/src/services/ceo.ts` (compileBriefing return type)
- Modify: `packages/engine/src/lib/email.ts` (briefingToHtml → letterToHtml)
- Modify: `packages/engine/src/orchestration/engine.ts` (handleBriefingCycle)
- Test: `packages/engine/src/services/__tests__/ceo.test.ts`

**Step 1: Update shared types**

Replace the structured `BriefingContent` interface with a simple string type alias in `packages/shared/src/briefing.ts`. Keep `OwnerReplyIntent` and its types unchanged. Remove `BriefingBoardRequest`, `BriefingException`, `BriefingInitiativeSummary`, `BriefingResults`, and `BriefingContent`.

```typescript
// packages/shared/src/briefing.ts
// Remove all Briefing* interfaces. Replace with:

/** The CEO's letter — plain text with markdown links. */
export type BriefingLetter = string;

// Keep OwnerReplyAction and OwnerReplyIntent unchanged.
```

**Step 2: Rewrite CEO briefing prompt**

Replace `CEO_BRIEFING_SYSTEM_PROMPT` in `packages/engine/src/ai/prompts/ceo-briefing.ts`. The new prompt instructs the CEO to write a plain-text letter (not JSON) that is deliverable-first with markdown links.

```typescript
export const CEO_BRIEFING_SYSTEM_PROMPT = `You are the CEO of an AI-powered organization, writing a letter to the owner.

This letter is their only window into the organization. Write it as a competent executive writing to their board member — direct, no filler.

Rules:
- Every sentence either delivers something or asks for something. No status filler.
- BAD: "The digital presence initiative is progressing normally. No decisions needed."
- GOOD: "The website code is ready ([review](/inspect/task/UUID)). The competitive analysis is complete ([read](/inspect/task/UUID))."
- Use markdown links for anything the owner can inspect: [visible text](/inspect/task/ID) or [visible text](/inspect/initiative/ID)
- If a task failed or needs owner input, say what happened and what you need
- If everything is running fine, say what was delivered — don't say "no decisions needed"
- Keep it under 300 words. The owner is busy.
- Do NOT use JSON. Write plain text with markdown links.
- Do NOT use headers, bullet points, or structured formatting. Write prose paragraphs like a letter.`;

// buildBriefingMessage stays the same — it assembles context for the CEO.
// The CEO now produces plain text instead of JSON.
```

**Step 3: Update compileBriefing in CEOService**

Change `compileBriefing` to return `string` instead of `BriefingContent`. Remove `jsonMode: true` from the invokeAgent call. The CEO now returns plain text.

In `packages/engine/src/services/ceo.ts`:
- Change return type: `async compileBriefing(orgId: string): Promise<string>`
- Remove `jsonMode: true` from the invokeAgent call
- Remove the `response.parsed as unknown as BriefingContent` cast
- Return `response.content` directly (the plain text letter)
- After getting the letter, call `insertChatMessage(orgId, 'ceo', response.content)` to store it

**Step 4: Update handleBriefingCycle in engine**

In `packages/engine/src/orchestration/engine.ts`, the `handleBriefingCycle` method:
- `content` is now a string (the letter), not `BriefingContent`
- Replace `briefingToHtml(content)` with `letterToHtml(content, orgName)`
- Remove `content.board_requests.length` from `boardRequestCount` param — just pass 0 or remove the param

**Step 5: Replace briefingToHtml with letterToHtml**

In `packages/engine/src/lib/email.ts`:
- Remove the `BriefingContent` import
- Replace `briefingToHtml(content: BriefingContent)` with `letterToHtml(letter: string, orgName: string)`
- The new function wraps the plain text in minimal HTML with Times New Roman styling, converting markdown links to `<a>` tags
- Update `sendBriefing` params: remove `boardRequestCount`, add letter as the content source

```typescript
export function letterToHtml(letter: string, orgName: string): string {
  // Convert markdown links [text](url) to <a> tags
  const withLinks = letter.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color: #111; text-decoration: underline;">$1</a>'
  );

  return `<html><body style="font-family: 'Times New Roman', Times, serif; max-width: 640px; margin: 0 auto; padding: 2rem; color: #111;">
<p style="color: #666; font-size: 0.875rem;">${orgName}</p>
<div style="font-size: 1.125rem; line-height: 1.75; white-space: pre-wrap;">${withLinks}</div>
</body></html>`;
}
```

**Step 6: Update tests**

Update `packages/engine/src/services/__tests__/ceo.test.ts` — the `compileBriefing` test should expect a string return, not `BriefingContent`.

Update `packages/engine/src/lib/__tests__/email.test.ts` — test `letterToHtml` instead of `briefingToHtml`.

**Step 7: Build and verify**

Run: `cd packages/engine && bun run build`
Run: `cd packages/engine && bun test`

**Step 8: Commit**

```bash
git add packages/shared/src/briefing.ts packages/engine/src/ai/prompts/ceo-briefing.ts packages/engine/src/services/ceo.ts packages/engine/src/orchestration/engine.ts packages/engine/src/lib/email.ts packages/engine/src/services/__tests__/ceo.test.ts packages/engine/src/lib/__tests__/email.test.ts
git commit -m "refactor: CEO briefing produces plain-text letter instead of JSON

The CEO now writes a deliverable-first letter with markdown links.
Same letter goes to ceo_chat_messages and email. Kills BriefingContent
JSON type and briefingToHtml structured formatter."
```

---

### Task 2: Update CEO Chat Prompt — Deliverable-First Style

Update the chat prompt to match the letter style. The CEO should respond with deliverable-first prose and markdown links, not generic chatbot answers.

**Files:**
- Modify: `packages/engine/src/ai/prompts/ceo-chat.ts`

**Step 1: Rewrite CEO_CHAT_SYSTEM_PROMPT**

```typescript
export const CEO_CHAT_SYSTEM_PROMPT = `You are the CEO of this organization. The owner is communicating with you directly.

Your role:
- Answer questions, acknowledge direction, explain decisions
- Be direct, honest, and concise — a competent executive, not a chatbot

Style rules:
- Every sentence either delivers something or asks for something. No filler.
- Use markdown links for anything inspectable: [visible text](/inspect/task/ID) or [visible text](/inspect/initiative/ID)
- When referencing work products, link to them so the owner can click and see
- When acknowledging direction, confirm what will change in the next planning cycle
- Do NOT use JSON. Write plain text with markdown links.
- Do NOT use headers, bullet points, or structured formatting unless listing specific items.

Important constraints:
- You do NOT execute commands in real-time. Direction is incorporated in the next planning cycle.
- You have full context about the organization's current state.
- Draw on the Precepts (strategic foundation) when discussing strategy.`;
```

**Step 2: Build and verify**

Run: `cd packages/engine && bun run build`

**Step 3: Commit**

```bash
git add packages/engine/src/ai/prompts/ceo-chat.ts
git commit -m "refactor: CEO chat prompt produces deliverable-first responses with markdown links"
```

---

### Task 3: Build The Interface Page

Create the new `/interface` route — server component for the letter, client component for the input box.

**Files:**
- Create: `packages/web/src/app/interface/page.tsx`
- Create: `packages/web/src/app/interface/input-box.tsx`
- Create: `packages/web/src/app/interface/interface.css`
- Modify: `packages/web/src/app/page.tsx` (redirect to /interface)

**Step 1: Create the CSS file**

Create `packages/web/src/app/interface/interface.css` with the exact styling from the spec:

```css
.interface-page {
  font-family: 'Times New Roman', Times, serif;
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem;
  color: #111;
  background: #fff;
}

.interface-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
  font-size: 0.875rem;
  color: #666;
}

.interface-letter {
  font-size: 1.125rem;
  line-height: 1.75;
  white-space: pre-wrap;
}

.interface-letter a {
  color: #111;
  text-decoration: underline;
}

.interface-textarea {
  width: 100%;
  min-height: 120px;
  padding: 1rem;
  font-family: 'Times New Roman', Times, serif;
  font-size: 1.125rem;
  border: 1px solid #ddd;
  resize: vertical;
  margin-top: 2rem;
  outline: none;
  box-sizing: border-box;
}

.interface-textarea:focus {
  border-color: #999;
}

.interface-send {
  float: right;
  margin-top: 0.5rem;
  padding: 0.5rem 1.5rem;
  font-family: 'Times New Roman', Times, serif;
  font-size: 1rem;
  background: #111;
  color: #fff;
  border: none;
  cursor: pointer;
}

.interface-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.interface-error {
  color: #c00;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}
```

**Step 2: Create the server component page**

Create `packages/web/src/app/interface/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { InputBox } from './input-box'
import './interface.css'

function parseMarkdownLinks(text: string): string {
  return text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>'
  )
}

export default async function InterfacePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('orgs')
    .select('id, name')
    .single()

  if (!org) redirect('/onboarding')

  const { data: latestMessage } = await supabase
    .from('ceo_chat_messages')
    .select('content, created_at')
    .eq('org_id', org.id)
    .eq('role', 'ceo')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const letterHtml = latestMessage
    ? parseMarkdownLinks(latestMessage.content)
    : 'No letters yet. Send a message to get started.'

  const dateStr = format(new Date(), 'MMMM d, yyyy')

  return (
    <div className="interface-page">
      <div className="interface-header">
        <span>{org.name.toUpperCase()}</span>
        <span>{dateStr}</span>
      </div>
      <div
        className="interface-letter"
        dangerouslySetInnerHTML={{ __html: letterHtml }}
      />
      <InputBox orgId={org.id} />
    </div>
  )
}
```

**Step 3: Create the client input box**

Create `packages/web/src/app/interface/input-box.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function InputBox({ orgId }: { orgId: string }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || sending) return

    setSending(true)
    setError('')

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENGINE_URL}/api/orchestration/ceo-chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId, message: message.trim() }),
        }
      )

      if (!res.ok) throw new Error('Failed to send message')

      setMessage('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSend}>
      <textarea
        className="interface-textarea"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder=""
        disabled={sending}
      />
      {error && <p className="interface-error">{error}</p>}
      <button
        type="submit"
        className="interface-send"
        disabled={sending || !message.trim()}
      >
        {sending ? 'Sending...' : 'Send'}
      </button>
    </form>
  )
}
```

**Step 4: Update root redirect**

Change `packages/web/src/app/page.tsx` from `redirect('/dashboard')` to `redirect('/interface')`.

**Step 5: Build and verify**

Run: `cd packages/web && bun run build`

**Step 6: Commit**

```bash
git add packages/web/src/app/interface/ packages/web/src/app/page.tsx
git commit -m "feat: add The Interface page — letter + input box

Server component fetches latest CEO letter from ceo_chat_messages.
Client component handles textarea input, POSTs to ceo-chat endpoint.
Root redirect changed from /dashboard to /interface."
```

---

### Task 4: Restyle Login Page

Replace ShadCN components with plain HTML + CSS matching The Interface styling. Update redirect target.

**Files:**
- Modify: `packages/web/src/app/login/page.tsx`

**Step 1: Rewrite login page**

Replace the entire login page. Remove `Button` and `Input` imports from ShadCN. Use plain `<input>` and `<button>` elements with inline styles matching The Interface aesthetic (Times New Roman, minimal).

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

    router.push('/interface')
    router.refresh()
  }

  return (
    <div style={{
      fontFamily: "'Times New Roman', Times, serif",
      maxWidth: 640,
      margin: '0 auto',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: '100vh',
    }}>
      <form onSubmit={handleLogin} style={{ maxWidth: 320 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'normal', marginBottom: '2rem', color: '#111' }}>
          Sign in
        </h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: '1.125rem',
            border: '1px solid #ddd',
            marginBottom: '1rem',
            outline: 'none',
            boxSizing: 'border-box',
            color: '#111',
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: '1.125rem',
            border: '1px solid #ddd',
            marginBottom: '1rem',
            outline: 'none',
            boxSizing: 'border-box',
            color: '#111',
          }}
        />
        {error && <p style={{ color: '#c00', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem 1.5rem',
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: '1rem',
            background: '#111',
            color: '#fff',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
```

**Step 2: Build and verify**

Run: `cd packages/web && bun run build`

**Step 3: Commit**

```bash
git add packages/web/src/app/login/page.tsx
git commit -m "refactor: restyle login page to match The Interface — plain CSS, Times New Roman"
```

---

### Task 5: Clean Up Root Layout

Remove ThemeProvider, dark mode script, and Geist fonts from root layout. The Interface is light-only with Times New Roman.

**Files:**
- Modify: `packages/web/src/app/layout.tsx`
- Modify: `packages/web/src/app/globals.css` (strip dark mode, sidebar vars, animations)

**Step 1: Simplify root layout**

Remove `ThemeProvider` import and wrapper. Remove Geist font imports. Remove dark mode script. Keep the layout minimal — just `<html>`, `<body>`, `{children}`. Keep `globals.css` import (onboarding still needs Tailwind).

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRECEPT",
  description: "AI-powered organization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**Step 2: Clean globals.css**

Keep the Tailwind imports (onboarding needs them). Remove `.dark` block, sidebar CSS variables, animation keyframes. Keep `:root` variables that onboarding/ShadCN components need.

Remove from globals.css:
- The entire `.dark { ... }` block
- All `--sidebar-*` variables from `:root`
- All `--chart-*` variables from `:root`
- The `@keyframes fade-in` and `.animate-fade-in` blocks
- The `@keyframes pulse-glow` block

**Step 3: Build and verify**

Run: `cd packages/web && bun run build`

**Step 4: Commit**

```bash
git add packages/web/src/app/layout.tsx packages/web/src/app/globals.css
git commit -m "refactor: simplify root layout — remove ThemeProvider, dark mode, Geist fonts"
```

---

### Task 6: Delete Dashboard Components and Routes

Remove all command center components, the dashboard route group, and unused hooks/utils.

**Files:**
- Delete: `packages/web/src/app/(dashboard)/` (entire directory)
- Delete: `packages/web/src/components/dashboard/` (entire directory)
- Delete: `packages/web/src/components/audit/` (entire directory)
- Delete: `packages/web/src/components/chat/` (entire directory)
- Delete: `packages/web/src/components/structure/` (entire directory)
- Delete: `packages/web/src/components/initiative/` (entire directory)
- Delete: `packages/web/src/components/layout/top-bar.tsx`
- Delete: `packages/web/src/components/layout/theme-provider.tsx`
- Delete: `packages/web/src/hooks/use-realtime.ts`
- Delete: `packages/web/src/hooks/use-mobile.tsx`
- Delete: `packages/web/src/lib/elk-layout.ts`

**Step 1: Verify onboarding doesn't import any of these**

Run: `grep -r "use-realtime\|use-mobile\|elk-layout\|top-bar\|theme-provider\|components/dashboard\|components/audit\|components/chat\|components/structure\|components/initiative" packages/web/src/app/onboarding/`

Expected: No matches (already verified — onboarding uses none of these).

**Step 2: Delete all files**

```bash
rm -rf packages/web/src/app/\(dashboard\)/
rm -rf packages/web/src/components/dashboard/
rm -rf packages/web/src/components/audit/
rm -rf packages/web/src/components/chat/
rm -rf packages/web/src/components/structure/
rm -rf packages/web/src/components/initiative/
rm packages/web/src/components/layout/top-bar.tsx
rm packages/web/src/components/layout/theme-provider.tsx
rm packages/web/src/hooks/use-realtime.ts
rm packages/web/src/hooks/use-mobile.tsx
rm packages/web/src/lib/elk-layout.ts
```

**Step 3: Build and verify**

Run: `cd packages/web && bun run build`

Fix any import errors — there may be stale references.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete command center dashboard, all dashboard components, unused hooks

Removes: CommandCenter, InitiativeCards, BoardRequests, Exceptions,
CeoChat, OrgChart, AgentNode, AnimatedEdge, AuditLog, TopBar,
ThemeProvider, InitiativeSlideout, InitiativeDetail, TaskTable,
TaskDetail, use-realtime, use-mobile, elk-layout."
```

---

### Task 7: Remove Heavy Dependencies

Remove `@xyflow/react`, `elkjs`, and `motion` from `package.json`.

**Files:**
- Modify: `packages/web/package.json`

**Step 1: Remove dependencies**

```bash
cd packages/web && bun remove @xyflow/react elkjs motion
```

**Step 2: Build and verify**

Run: `cd packages/web && bun run build`

**Step 3: Commit**

```bash
git add packages/web/package.json packages/web/bun.lockb
git commit -m "chore: remove @xyflow/react, elkjs, motion dependencies"
```

---

### Task 8: Update Proxy Middleware Redirect

The auth middleware in `proxy.ts` may redirect to `/dashboard`. Update it to redirect to `/interface`.

**Files:**
- Modify: `packages/web/src/proxy.ts`

**Step 1: Check and update redirect target**

Read `proxy.ts`. If it contains any reference to `/dashboard`, change it to `/interface`. The middleware should redirect authenticated users without a valid path to `/interface`.

**Step 2: Build and verify**

Run: `cd packages/web && bun run build`

**Step 3: Commit**

```bash
git add packages/web/src/proxy.ts
git commit -m "refactor: update middleware redirect from /dashboard to /interface"
```

---

### Task 9: Final Verification

End-to-end verification that everything builds and the old dashboard is fully gone.

**Step 1: Full build**

```bash
cd packages/shared && bun run build
cd packages/engine && bun run build && bun test
cd packages/web && bun run build
```

**Step 2: Verify no stale references**

```bash
grep -r "dashboard" packages/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"
grep -r "Decision Room" packages/web/src/ --include="*.ts" --include="*.tsx"
grep -r "CommandCenter\|command-center" packages/web/src/ --include="*.ts" --include="*.tsx"
```

Expected: No matches (or only comments/docs).

**Step 3: Verify no broken imports**

```bash
grep -r "from.*components/dashboard\|from.*components/audit\|from.*components/chat\|from.*components/structure\|from.*components/initiative\|from.*elk-layout\|from.*use-realtime\|from.*use-mobile\|from.*theme-provider\|from.*top-bar" packages/web/src/ --include="*.ts" --include="*.tsx"
```

Expected: No matches.

**Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: clean up stale references from dashboard removal"
```
