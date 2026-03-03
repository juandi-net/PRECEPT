# Fix Onboarding Field Extraction — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the bug where the CEO agent extracts only the `identity` field during onboarding, ignoring all 9 other Precepts fields despite discussing them.

**Architecture:** Store the raw AI response JSON alongside each CEO conversation message so the conversation history replayed to the model accurately reflects its past field extractions. Currently, all prior CEO messages are reconstructed with `updatedFields: {}`, training the model to never extract fields.

**Tech Stack:** TypeScript, Vitest, Supabase (JSONB — no SQL migration needed)

---

### Task 1: Add `rawResponse` to ConversationMessage type

**Files:**
- Modify: `packages/shared/src/onboarding.ts:17-21`

**Step 1: Add the optional field**

In `ConversationMessage`, add `rawResponse`:

```typescript
export interface ConversationMessage {
  role: 'owner' | 'ceo';
  content: string;
  timestamp: string;
  rawResponse?: string; // Full AI JSON response for CEO messages, used to replay accurate history
}
```

**Step 2: Verify build**

Run: `cd packages/shared && bun run build`
Expected: PASS — optional field is backward-compatible

**Step 3: Commit**

```bash
git add packages/shared/src/onboarding.ts
git commit -m "fix: add rawResponse field to ConversationMessage for accurate history replay"
```

---

### Task 2: Store raw AI response in `startSession()`

**Files:**
- Modify: `packages/engine/src/services/onboarding.ts:27-59` (startSession method)

**Step 1: Write the failing test**

In `packages/engine/src/services/__tests__/onboarding.test.ts`, add inside the `startSession` describe block:

```typescript
it('stores rawResponse on the CEO conversation message', async () => {
  const mockSession = {
    id: 'session-1',
    status: 'in_progress' as const,
    conversation: [],
    preceptsDraft: {} as any,
    extractionTracker: {
      coveredTopics: [],
      currentPhase: 1,
      fieldsExtracted: [],
      fieldsRemaining: [
        'identity', 'product_service', 'stage', 'success_definition',
        'resources', 'constraints', 'competitive_landscape', 'history',
        'active_priorities', 'data_policy',
      ],
      activeThread: null,
    },
    contextDocuments: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };

  const rawJson = JSON.stringify({
    message: "Hello! I'm your new CEO.",
    updatedTracker: mockSession.extractionTracker,
    updatedFields: {},
  });

  vi.mocked(onboardingDb.createSession).mockResolvedValue(mockSession);
  vi.mocked(ai.chat.completions.create).mockResolvedValue({
    choices: [{ message: { content: rawJson }, index: 0, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  } as any);

  await service.startSession();

  const updateCall = vi.mocked(onboardingDb.updateSession).mock.calls[0];
  const savedConversation = updateCall[1].conversation!;
  expect(savedConversation[0].rawResponse).toBe(rawJson);
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && bun run test -- --run -t "stores rawResponse on the CEO conversation message"`
Expected: FAIL — `rawResponse` is undefined

**Step 3: Implement the fix**

In `packages/engine/src/services/onboarding.ts`, modify `startSession()`. The `callCEO` method needs to return the raw content string alongside the parsed response. Change `callCEO` to return both:

First, update the return type. Add a new interface and modify `callCEO`:

```typescript
interface CEOCallResult {
  parsed: CEOResponse;
  rawContent: string;
}
```

Change `callCEO` signature and return:

```typescript
private async callCEO(
  messages: Array<{ role: string; content: string }>,
  currentTracker: ExtractionTracker
): Promise<CEOCallResult> {
```

At the end of `callCEO`, change:
```typescript
return { parsed, rawContent: content };
```

Then update `startSession()` to destructure and store:

```typescript
const { parsed: ceoResponse, rawContent } = await this.callCEO(messages, initialTracker);

const conversation: ConversationMessage[] = [
  { role: 'ceo', content: ceoResponse.message, timestamp: new Date().toISOString(), rawResponse: rawContent },
];
```

And update `sendMessage()` similarly:

```typescript
const { parsed: ceoResponse, rawContent } = await this.callCEO(messages, session.extractionTracker);
```

And where the CEO message is appended:

```typescript
conversation.push({
  role: 'ceo',
  content: ceoResponse.message,
  timestamp: new Date().toISOString(),
  rawResponse: rawContent,
});
```

Also update the audit log call in `callCEO` to use `parsed` instead of `parsed`:

```typescript
await auditDb.logEvent('ai.call', AGENT_ID, {
  model: MODELS.opus,
  purpose: 'onboarding_interview',
  promptMessages: messages,
  responseRaw: content,
  responseParsed: parsed,
  latencyMs,
  tokensIn,
  tokensOut,
}, tokensUsed ?? undefined);
```

**Step 4: Run test to verify it passes**

Run: `cd packages/engine && bun run test -- --run -t "stores rawResponse"`
Expected: PASS

**Step 5: Run all existing tests**

Run: `cd packages/engine && bun run test`
Expected: All tests PASS (existing tests need `callCEO` mock updates — see step 6)

**Step 6: Fix existing tests if needed**

The existing `startSession` and `sendMessage` tests should still pass because the mock structure hasn't changed — `callCEO` is a private method that calls `ai.chat.completions.create`, and the mock for that returns the same shape. The destructuring change is internal.

**Step 7: Commit**

```bash
git add packages/engine/src/services/onboarding.ts packages/engine/src/services/__tests__/onboarding.test.ts
git commit -m "fix: store raw AI response in conversation messages"
```

---

### Task 3: Use `rawResponse` in `buildMessages()` for accurate history replay

**Files:**
- Modify: `packages/engine/src/ai/prompts/ceo-onboarding.ts:101-116`

**Step 1: Write the failing test**

Create `packages/engine/src/ai/prompts/__tests__/ceo-onboarding.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildMessages } from '../ceo-onboarding.js';
import type { ConversationMessage, ExtractionTracker, PreceptsDraft } from '@precept/shared';

describe('buildMessages', () => {
  const tracker: ExtractionTracker = {
    coveredTopics: ['identity'],
    currentPhase: 2,
    fieldsExtracted: ['identity'],
    fieldsRemaining: ['product_service', 'stage', 'success_definition', 'resources', 'constraints', 'competitive_landscape', 'history', 'active_priorities', 'data_policy'],
    activeThread: 'product_overview',
  };

  const draft: PreceptsDraft = {
    identity: { name: 'identity', content: 'A SaaS company', state: 'confirmed', notes: null },
    product_service: null, stage: null, success_definition: null, resources: null,
    constraints: null, competitive_landscape: null, history: null,
    active_priorities: null, data_policy: null,
  };

  it('uses rawResponse for CEO messages when available', () => {
    const rawResponse = JSON.stringify({
      message: 'Tell me about your product.',
      updatedTracker: { ...tracker, currentPhase: 1, fieldsExtracted: ['identity'] },
      updatedFields: {
        identity: { name: 'identity', content: 'A SaaS company', state: 'confirmed', notes: null },
      },
    });

    const conversation: ConversationMessage[] = [
      { role: 'ceo', content: 'Tell me about your product.', timestamp: '2026-03-02T00:00:00Z', rawResponse },
      { role: 'owner', content: 'We sell widgets.', timestamp: '2026-03-02T00:01:00Z' },
    ];

    const messages = buildMessages(conversation, tracker, draft);

    // The assistant message should use the raw response, not a reconstructed one
    const assistantMsg = messages.find(m => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();

    const parsed = JSON.parse(assistantMsg!.content);
    expect(parsed.updatedFields).toHaveProperty('identity');
    expect(parsed.updatedFields.identity.content).toBe('A SaaS company');
  });

  it('falls back to reconstructed response when rawResponse is absent', () => {
    const conversation: ConversationMessage[] = [
      { role: 'ceo', content: 'Tell me about your product.', timestamp: '2026-03-02T00:00:00Z' },
      { role: 'owner', content: 'We sell widgets.', timestamp: '2026-03-02T00:01:00Z' },
    ];

    const messages = buildMessages(conversation, tracker, draft);
    const assistantMsg = messages.find(m => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();

    const parsed = JSON.parse(assistantMsg!.content);
    // Fallback still uses empty updatedFields (backward compat)
    expect(parsed.updatedFields).toEqual({});
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && bun run test -- --run src/ai/prompts/__tests__/ceo-onboarding.test.ts`
Expected: First test FAILS — `updatedFields` is `{}` instead of containing `identity`

**Step 3: Implement the fix**

In `packages/engine/src/ai/prompts/ceo-onboarding.ts`, replace lines 101-113:

```typescript
// Add conversation history
for (const msg of conversation) {
  if (msg.role === 'ceo') {
    // Use stored raw response for accurate history; fall back to reconstruction for old sessions
    const content = msg.rawResponse
      ?? JSON.stringify({ message: msg.content, updatedTracker: tracker, updatedFields: {} });
    messages.push({ role: 'assistant', content });
  } else {
    messages.push({ role: 'user', content: msg.content });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/engine && bun run test -- --run src/ai/prompts/__tests__/ceo-onboarding.test.ts`
Expected: PASS

**Step 5: Run all tests**

Run: `cd packages/engine && bun run test`
Expected: All PASS

**Step 6: Commit**

```bash
git add packages/engine/src/ai/prompts/ceo-onboarding.ts packages/engine/src/ai/prompts/__tests__/ceo-onboarding.test.ts
git commit -m "fix: replay accurate AI history in onboarding conversation"
```

---

### Task 4: Verify full build

**Step 1: Build all packages**

Run: `cd /Users/juandi/conductor/workspaces/PRECEPT/louisville && bun run build` (or build each package)
Expected: PASS

**Step 2: Run all tests**

Run: `cd packages/engine && bun run test`
Expected: All PASS

**Step 3: Final commit if any remaining changes**

No additional changes expected.
