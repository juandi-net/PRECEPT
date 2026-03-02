# Onboarding Document Upload — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let owners attach context documents (.md, .txt, .pdf) during the onboarding interview so the CEO has background material and asks better questions.

**Architecture:** Files upload to a new Hono multipart endpoint, text is extracted via a shared utility (`@precept/shared`), stored as JSONB on the session, and injected into every CEO prompt. The frontend adds an attach button + file chips to `ChatPanel`.

**Tech Stack:** pdf-parse (text extraction), Hono multipart (upload handling), existing Vitest + ShadCN + Lucide stack.

---

### Task 1: Shared Types — ContextDocument interface

**Files:**
- Modify: `packages/shared/src/documents.ts` (create)
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/onboarding.ts`

**Step 1: Create `packages/shared/src/documents.ts`**

```ts
export interface ContextDocument {
  filename: string;
  mimeType: string;
  content: string;
  uploadedAt: string;
}

export const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
```

**Step 2: Export from barrel**

In `packages/shared/src/index.ts`, add:

```ts
export * from './documents';
```

**Step 3: Add `contextDocuments` to `OnboardingSession`**

In `packages/shared/src/onboarding.ts`, add `ContextDocument` import and a new field to `OnboardingSession`:

```ts
import type { ContextDocument } from './documents';
```

```ts
export interface OnboardingSession {
  id: string;
  status: SessionStatus;
  conversation: ConversationMessage[];
  preceptsDraft: PreceptsDraft;
  extractionTracker: ExtractionTracker;
  contextDocuments: ContextDocument[] | null;
  startedAt: string;
  completedAt: string | null;
}
```

**Step 4: Verify types compile**

Run: `cd packages/shared && bun run typecheck`
Expected: Clean exit, no errors.

**Step 5: Commit**

```bash
git add packages/shared/src/documents.ts packages/shared/src/index.ts packages/shared/src/onboarding.ts
git commit -m "feat(shared): add ContextDocument type and extend OnboardingSession"
```

---

### Task 2: Shared Utility — Text extraction

**Files:**
- Modify: `packages/shared/src/documents.ts`
- Modify: `packages/shared/package.json`

**Step 1: Install pdf-parse in shared package**

```bash
cd packages/shared && bun add pdf-parse && bun add -d @types/pdf-parse
```

Note: `pdf-parse` is pure JS, no native deps. It works with Bun and Node.

**Step 2: Add `extractText` to `packages/shared/src/documents.ts`**

Append to the existing file:

```ts
import pdfParse from 'pdf-parse';

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case 'application/pdf': {
      const result = await pdfParse(buffer);
      return result.text;
    }
    case 'text/plain':
    case 'text/markdown':
      return buffer.toString('utf-8');
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}
```

**Step 3: Write test for extractText**

Create `packages/shared/src/__tests__/documents.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractText, ALLOWED_MIME_TYPES } from '../documents';

describe('extractText', () => {
  it('extracts plain text from a buffer', async () => {
    const buffer = Buffer.from('Hello, world!');
    const result = await extractText(buffer, 'text/plain');
    expect(result).toBe('Hello, world!');
  });

  it('extracts markdown as-is', async () => {
    const buffer = Buffer.from('# Heading\n\nSome **bold** text.');
    const result = await extractText(buffer, 'text/markdown');
    expect(result).toBe('# Heading\n\nSome **bold** text.');
  });

  it('throws on unsupported MIME type', async () => {
    const buffer = Buffer.from('data');
    await expect(extractText(buffer, 'image/png')).rejects.toThrow('Unsupported file type');
  });

  it('extracts text from a PDF buffer', async () => {
    // pdf-parse requires a real PDF buffer. Create a minimal one.
    // This tests that the pdf-parse integration works end-to-end.
    // We use a minimal valid PDF (the simplest possible structure).
    const minimalPdf = Buffer.from(
      '%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n' +
      'xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
      'trailer<</Size 4/Root 1 0 R>>\nstartxref\n206\n%%EOF'
    );
    // This minimal PDF has no text content, so extraction should return empty/whitespace
    const result = await extractText(minimalPdf, 'application/pdf');
    expect(typeof result).toBe('string');
  });
});
```

**Step 4: Add vitest to shared package and run tests**

The shared package doesn't have vitest yet. Add it:

```bash
cd packages/shared && bun add -d vitest
```

Add test script to `packages/shared/package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Run: `cd packages/shared && bun run test`
Expected: All 4 tests pass.

**Step 5: Verify types still compile**

Run: `cd packages/shared && bun run typecheck`
Expected: Clean exit.

**Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add extractText utility with pdf-parse for document text extraction"
```

---

### Task 3: Database Migration — context_documents column

**Files:**
- Create: `supabase/migrations/00002_context_documents.sql`

**Step 1: Create migration file**

```sql
-- Add context_documents column to onboarding_sessions
ALTER TABLE onboarding_sessions
  ADD COLUMN context_documents JSONB DEFAULT NULL;
```

**Step 2: Commit**

```bash
git add supabase/migrations/00002_context_documents.sql
git commit -m "feat(db): add context_documents JSONB column to onboarding_sessions"
```

---

### Task 4: DB Layer — Read/write context_documents

**Files:**
- Modify: `packages/engine/src/db/onboarding.ts`

**Step 1: Update `mapSession` to include contextDocuments**

In `mapSession()`, add:

```ts
contextDocuments: (row.context_documents as ContextDocument[] | null) ?? null,
```

Import `ContextDocument` at the top:

```ts
import type { OnboardingSession, ConversationMessage, ExtractionTracker, ContextDocument } from '@precept/shared';
```

**Step 2: Update `updateSession` to accept contextDocuments**

Add to the `updates` parameter type:

```ts
contextDocuments?: ContextDocument[] | null;
```

Add to the `dbUpdates` mapping:

```ts
if (updates.contextDocuments !== undefined) dbUpdates.context_documents = updates.contextDocuments;
```

**Step 3: Verify engine types compile**

Run: `cd packages/engine && bun run build`
Expected: Clean exit.

**Step 4: Commit**

```bash
git add packages/engine/src/db/onboarding.ts
git commit -m "feat(engine): add contextDocuments to DB layer read/write"
```

---

### Task 5: Engine Routes — Upload and delete documents

**Files:**
- Modify: `packages/engine/src/routes/onboarding.ts`
- Modify: `packages/engine/src/services/onboarding.ts`

**Step 1: Write failing route tests**

Add to `packages/engine/src/routes/__tests__/onboarding.test.ts`:

```ts
// Add mock for the new service methods
// In the vi.mock block at the top, add:
// OnboardingService.prototype.addDocuments = vi.fn();
// OnboardingService.prototype.removeDocument = vi.fn();

describe('POST /api/onboarding/:sessionId/documents', () => {
  it('returns 200 with updated document list', async () => {
    vi.mocked(OnboardingService.prototype.addDocuments).mockResolvedValue([
      { filename: 'plan.txt', mimeType: 'text/plain', content: 'My plan', uploadedAt: '2026-03-01T00:00:00Z' },
    ]);

    const formData = new FormData();
    formData.append('files', new File(['My plan'], 'plan.txt', { type: 'text/plain' }));

    const res = await app.request('/api/onboarding/session-1/documents', {
      method: 'POST',
      body: formData,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.documents).toHaveLength(1);
    expect(body.documents[0].filename).toBe('plan.txt');
  });
});

describe('DELETE /api/onboarding/:sessionId/documents/:index', () => {
  it('returns 200 with updated document list', async () => {
    vi.mocked(OnboardingService.prototype.removeDocument).mockResolvedValue([]);

    const res = await app.request('/api/onboarding/session-1/documents/0', {
      method: 'DELETE',
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.documents).toEqual([]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/engine && bun run test`
Expected: FAIL — `addDocuments` and `removeDocument` don't exist yet.

**Step 3: Add service methods**

In `packages/engine/src/services/onboarding.ts`, add two methods to `OnboardingService`:

```ts
import { extractText, type ContextDocument, ALLOWED_MIME_TYPES } from '@precept/shared';
```

```ts
async addDocuments(sessionId: string, files: Array<{ buffer: Buffer; filename: string; mimeType: string }>): Promise<ContextDocument[]> {
  const session = await onboardingDb.getSession(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);
  if (session.status !== 'in_progress') throw new Error(`Session is ${session.status}`);

  const newDocs: ContextDocument[] = [];
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimeType as any)) {
      throw new Error(`Unsupported file type: ${file.mimeType}`);
    }
    const content = await extractText(file.buffer, file.mimeType);
    newDocs.push({
      filename: file.filename,
      mimeType: file.mimeType,
      content,
      uploadedAt: new Date().toISOString(),
    });
  }

  const updated = [...(session.contextDocuments ?? []), ...newDocs];
  await onboardingDb.updateSession(sessionId, { contextDocuments: updated });

  await auditDb.logEvent('onboarding.documents_added', AGENT_ID, {
    sessionId,
    filenames: newDocs.map(d => d.filename),
  });

  return updated;
}

async removeDocument(sessionId: string, index: number): Promise<ContextDocument[]> {
  const session = await onboardingDb.getSession(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);
  if (session.status !== 'in_progress') throw new Error(`Session is ${session.status}`);

  const docs = session.contextDocuments ?? [];
  if (index < 0 || index >= docs.length) throw new Error(`Invalid document index: ${index}`);

  const removed = docs[index];
  const updated = docs.filter((_, i) => i !== index);
  await onboardingDb.updateSession(sessionId, {
    contextDocuments: updated.length > 0 ? updated : null,
  });

  await auditDb.logEvent('onboarding.document_removed', AGENT_ID, {
    sessionId,
    filename: removed.filename,
  });

  return updated;
}
```

**Step 4: Add routes**

In `packages/engine/src/routes/onboarding.ts`, add the two routes:

```ts
onboarding.post('/:sessionId/documents', async (c) => {
  const sessionId = c.req.param('sessionId');

  try {
    const body = await c.req.parseBody({ all: true });
    const rawFiles = body['files'];
    const fileList = Array.isArray(rawFiles) ? rawFiles : rawFiles ? [rawFiles] : [];

    const files: Array<{ buffer: Buffer; filename: string; mimeType: string }> = [];
    for (const f of fileList) {
      if (!(f instanceof File)) continue;
      const arrayBuffer = await f.arrayBuffer();
      files.push({
        buffer: Buffer.from(arrayBuffer),
        filename: f.name,
        mimeType: f.type,
      });
    }

    if (files.length === 0) {
      return c.json({ error: 'No files provided' }, 400);
    }

    const documents = await service.addDocuments(sessionId, files);
    return c.json({ documents });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

onboarding.delete('/:sessionId/documents/:index', async (c) => {
  const sessionId = c.req.param('sessionId');
  const index = parseInt(c.req.param('index'), 10);

  if (isNaN(index)) {
    return c.json({ error: 'Invalid index' }, 400);
  }

  try {
    const documents = await service.removeDocument(sessionId, index);
    return c.json({ documents });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
```

**Step 5: Run tests**

Run: `cd packages/engine && bun run test`
Expected: All tests pass (old and new).

**Step 6: Commit**

```bash
git add packages/engine/src/routes/onboarding.ts packages/engine/src/services/onboarding.ts packages/engine/src/routes/__tests__/onboarding.test.ts
git commit -m "feat(engine): add document upload and delete endpoints"
```

---

### Task 6: Engine Service Tests — addDocuments and removeDocument

**Files:**
- Modify: `packages/engine/src/services/__tests__/onboarding.test.ts`

**Step 1: Add extractText mock**

At the top of the test file, add:

```ts
vi.mock('@precept/shared', async () => {
  const actual = await vi.importActual('@precept/shared');
  return {
    ...actual,
    extractText: vi.fn().mockResolvedValue('extracted text content'),
  };
});
```

**Step 2: Write addDocuments test**

```ts
describe('addDocuments', () => {
  it('extracts text from files and appends to session', async () => {
    const session = {
      id: 'session-1',
      status: 'in_progress' as const,
      conversation: [],
      preceptsDraft: {},
      extractionTracker: {
        coveredTopics: [],
        currentPhase: 1,
        fieldsExtracted: [],
        fieldsRemaining: ['identity'],
        activeThread: null,
      },
      contextDocuments: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

    vi.mocked(onboardingDb.getSession).mockResolvedValue(session);

    const result = await service.addDocuments('session-1', [
      { buffer: Buffer.from('My business plan'), filename: 'plan.txt', mimeType: 'text/plain' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('plan.txt');
    expect(result[0].content).toBe('extracted text content');
    expect(onboardingDb.updateSession).toHaveBeenCalledWith('session-1', {
      contextDocuments: expect.arrayContaining([
        expect.objectContaining({ filename: 'plan.txt' }),
      ]),
    });
  });

  it('throws on unsupported MIME type', async () => {
    const { extractText } = await import('@precept/shared');
    vi.mocked(extractText).mockRejectedValueOnce(new Error('Unsupported file type: image/png'));

    vi.mocked(onboardingDb.getSession).mockResolvedValue({
      id: 'session-1',
      status: 'in_progress',
      conversation: [],
      preceptsDraft: {},
      extractionTracker: { coveredTopics: [], currentPhase: 1, fieldsExtracted: [], fieldsRemaining: [], activeThread: null },
      contextDocuments: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    await expect(
      service.addDocuments('session-1', [
        { buffer: Buffer.from('data'), filename: 'photo.png', mimeType: 'image/png' },
      ])
    ).rejects.toThrow('Unsupported file type');
  });
});
```

**Step 3: Write removeDocument test**

```ts
describe('removeDocument', () => {
  it('removes document at index and updates session', async () => {
    vi.mocked(onboardingDb.getSession).mockResolvedValue({
      id: 'session-1',
      status: 'in_progress',
      conversation: [],
      preceptsDraft: {},
      extractionTracker: { coveredTopics: [], currentPhase: 1, fieldsExtracted: [], fieldsRemaining: [], activeThread: null },
      contextDocuments: [
        { filename: 'plan.txt', mimeType: 'text/plain', content: 'plan content', uploadedAt: '2026-03-01T00:00:00Z' },
        { filename: 'notes.md', mimeType: 'text/markdown', content: 'notes content', uploadedAt: '2026-03-01T00:00:00Z' },
      ],
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    const result = await service.removeDocument('session-1', 0);

    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('notes.md');
  });

  it('throws on invalid index', async () => {
    vi.mocked(onboardingDb.getSession).mockResolvedValue({
      id: 'session-1',
      status: 'in_progress',
      conversation: [],
      preceptsDraft: {},
      extractionTracker: { coveredTopics: [], currentPhase: 1, fieldsExtracted: [], fieldsRemaining: [], activeThread: null },
      contextDocuments: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    await expect(service.removeDocument('session-1', 5)).rejects.toThrow('Invalid document index');
  });
});
```

**Step 4: Run tests**

Run: `cd packages/engine && bun run test`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add packages/engine/src/services/__tests__/onboarding.test.ts
git commit -m "test(engine): add service tests for addDocuments and removeDocument"
```

---

### Task 7: CEO Prompt — Inject document context

**Files:**
- Modify: `packages/engine/src/ai/prompts/ceo-onboarding.ts`

**Step 1: Update `buildMessages` signature and inject documents**

Add a fourth parameter `contextDocuments` to `buildMessages`:

```ts
import type { ContextDocument } from '@precept/shared';
```

Update the function signature:

```ts
export function buildMessages(
  conversation: ConversationMessage[],
  tracker: ExtractionTracker,
  draft: PreceptsDraft,
  contextDocuments?: ContextDocument[] | null,
): Array<{ role: string; content: string }> {
```

After the extraction state system message and before the conversation history loop, add:

```ts
  if (contextDocuments && contextDocuments.length > 0) {
    const docsContent = contextDocuments
      .map((doc) => `### ${doc.filename}\n${doc.content}`)
      .join('\n\n');

    messages.push({
      role: 'system',
      content: `## Background Documents
The owner has provided the following documents for context. Use them to:
- Skip topics already clearly covered in these documents
- Ask deeper follow-up questions instead of surface-level ones
- Pre-populate the extraction tracker with information these documents provide

${docsContent}`,
    });
  }
```

**Step 2: Update the caller in `OnboardingService.sendMessage`**

In `packages/engine/src/services/onboarding.ts`, update the `buildMessages` call in `sendMessage`:

```ts
const messages = buildMessages(conversation, session.extractionTracker, session.preceptsDraft, session.contextDocuments);
```

**Step 3: Verify existing tests still pass**

Run: `cd packages/engine && bun run test`
Expected: All tests pass. The fourth parameter is optional, so existing calls still work.

**Step 4: Commit**

```bash
git add packages/engine/src/ai/prompts/ceo-onboarding.ts packages/engine/src/services/onboarding.ts
git commit -m "feat(engine): inject context documents into CEO prompt"
```

---

### Task 8: Frontend API Client — Upload and delete methods

**Files:**
- Modify: `packages/web/src/lib/api.ts`

**Step 1: Add upload and delete methods**

Import `ContextDocument` and add two new methods to the `api` object:

```ts
import type { ContextDocument } from '@precept/shared';
```

```ts
uploadDocuments: async (sessionId: string, files: File[]): Promise<{ documents: ContextDocument[] }> => {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }

  const res = await fetch(`${ENGINE_URL}/api/onboarding/${sessionId}/documents`, {
    method: 'POST',
    body: formData,
    // Note: do NOT set Content-Type header — browser sets it with boundary for multipart
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json();
},

removeDocument: async (sessionId: string, index: number): Promise<{ documents: ContextDocument[] }> => {
  const res = await fetch(`${ENGINE_URL}/api/onboarding/${sessionId}/documents/${index}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json();
},
```

Note: `uploadDocuments` does NOT use the `request()` helper because it needs `FormData` (no `Content-Type: application/json` header).

**Step 2: Verify types compile**

Run: `cd packages/web && bun run build`
Expected: Clean exit. (Next.js build validates types.)

**Step 3: Commit**

```bash
git add packages/web/src/lib/api.ts
git commit -m "feat(web): add uploadDocuments and removeDocument API methods"
```

---

### Task 9: Frontend UI — Attach button and file chips in ChatPanel

**Files:**
- Modify: `packages/web/src/components/chat/ChatPanel.tsx`

**Step 1: Update ChatPanel props**

Add new props for document management:

```ts
import type { ConversationMessage, ContextDocument } from '@precept/shared';
import { Paperclip, X } from 'lucide-react';
```

```ts
interface ChatPanelProps {
  messages: ConversationMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  documents: ContextDocument[];
  onUploadFiles: (files: File[]) => void;
  onRemoveDocument: (index: number) => void;
  isUploading?: boolean;
}
```

**Step 2: Add file input ref and handler**

Inside the component, add:

```ts
const fileInputRef = useRef<HTMLInputElement>(null);

const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files ?? []);
  if (files.length > 0) {
    onUploadFiles(files);
  }
  // Reset so the same file can be re-selected
  e.target.value = '';
};
```

**Step 3: Update the JSX**

Replace the entire `<form>` section with:

```tsx
{/* Input */}
<div className="border-t border-neutral-200 p-4">
  {/* Document chips */}
  {documents.length > 0 && (
    <div className="flex flex-wrap gap-2 mb-3">
      {documents.map((doc, i) => (
        <span
          key={`${doc.filename}-${i}`}
          className="inline-flex items-center gap-1.5 bg-neutral-100 text-neutral-700 text-xs font-medium px-2.5 py-1 rounded-lg"
        >
          <Paperclip className="h-3 w-3" />
          {doc.filename}
          <button
            type="button"
            onClick={() => onRemoveDocument(i)}
            className="text-neutral-400 hover:text-neutral-600 ml-0.5"
            aria-label={`Remove ${doc.filename}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )}

  <form onSubmit={handleSubmit} className="flex gap-3">
    <input
      ref={fileInputRef}
      type="file"
      accept=".md,.txt,.pdf"
      multiple
      onChange={handleFileSelect}
      className="hidden"
    />
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => fileInputRef.current?.click()}
      disabled={isLoading || disabled || isUploading}
      className="shrink-0 text-neutral-400 hover:text-neutral-600"
      aria-label="Attach files"
    >
      <Paperclip className="h-5 w-5" />
    </Button>
    <Input
      type="text"
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder={disabled ? 'Interview complete' : 'Type your message...'}
      disabled={isLoading || disabled}
      className="flex-1 rounded-xl px-4 py-3 h-auto"
    />
    <Button
      type="submit"
      disabled={!input.trim() || isLoading || disabled}
      size="lg"
      className="rounded-xl px-6"
    >
      Send
    </Button>
  </form>
</div>
```

**Step 4: Verify it compiles**

Run: `cd packages/web && bun run build`
Expected: Build will fail because `OnboardingPage` doesn't pass the new required props yet. That's expected — we fix it in Task 10.

**Step 5: Commit**

```bash
git add packages/web/src/components/chat/ChatPanel.tsx
git commit -m "feat(web): add document attach button and file chips to ChatPanel"
```

---

### Task 10: Frontend — Wire up OnboardingPage

**Files:**
- Modify: `packages/web/src/app/onboarding/page.tsx`

**Step 1: Add document state and handlers**

Add imports and state:

```ts
import type { ConversationMessage, PreceptsDraft, ContextDocument } from '@precept/shared';
```

```ts
const [documents, setDocuments] = useState<ContextDocument[]>([]);
const [isUploading, setIsUploading] = useState(false);
```

Add handlers:

```ts
const handleUploadFiles = useCallback(async (files: File[]) => {
  if (!sessionId) return;
  setIsUploading(true);
  try {
    const result = await api.uploadDocuments(sessionId, files);
    setDocuments(result.documents);
  } catch (err: any) {
    setError(err.message);
  } finally {
    setIsUploading(false);
  }
}, [sessionId]);

const handleRemoveDocument = useCallback(async (index: number) => {
  if (!sessionId) return;
  try {
    const result = await api.removeDocument(sessionId, index);
    setDocuments(result.documents);
  } catch (err: any) {
    setError(err.message);
  }
}, [sessionId]);
```

**Step 2: Pass new props to ChatPanel**

Update the ChatPanel usage:

```tsx
<ChatPanel
  messages={messages}
  onSendMessage={handleSendMessage}
  isLoading={isLoading}
  documents={documents}
  onUploadFiles={handleUploadFiles}
  onRemoveDocument={handleRemoveDocument}
  isUploading={isUploading}
/>
```

**Step 3: Verify full build**

Run: `cd packages/web && bun run build`
Expected: Clean build, no type errors.

**Step 4: Run all engine tests**

Run: `cd packages/engine && bun run test`
Expected: All pass.

**Step 5: Run shared tests**

Run: `cd packages/shared && bun run test`
Expected: All pass.

**Step 6: Commit**

```bash
git add packages/web/src/app/onboarding/page.tsx
git commit -m "feat(web): wire document upload/remove into OnboardingPage"
```

---

### Task 11: Final Verification

**Step 1: Full build across all packages**

```bash
bun run build
```

Expected: Clean exit.

**Step 2: All tests**

```bash
bun run test
cd packages/shared && bun run test
```

Expected: All pass.

**Step 3: Commit any remaining changes and verify clean git status**

```bash
git status
```

Expected: Clean working tree (nothing unstaged).
