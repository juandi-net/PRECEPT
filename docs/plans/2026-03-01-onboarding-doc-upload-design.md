# Onboarding Document Upload — Design

**Date:** 2026-03-01
**Status:** Approved
**Branch:** aboutorca/onboarding-doc-upload

## Problem

During the CEO onboarding interview, the owner may already have context documents (business plans, pitch decks, strategy notes) that cover topics the CEO would otherwise ask about from scratch. Without document upload, the CEO re-covers ground the owner has already articulated, wasting time and producing a worse interview.

## Solution

Add optional document upload to the onboarding chat. The owner attaches files (.md, .txt, .pdf) via the chat input. File content is extracted to plain text, stored on the session, and included in every subsequent CEO prompt call so the CEO can skip covered topics, ask deeper follow-ups, and pre-populate the extraction tracker.

## Data Model

New nullable JSONB column on `onboarding_sessions`:

```sql
context_documents JSONB DEFAULT NULL
```

Shape:

```ts
interface ContextDocument {
  filename: string;       // original filename
  mimeType: string;       // "text/plain" | "text/markdown" | "application/pdf"
  content: string;        // extracted plain text
  uploadedAt: string;     // ISO timestamp
}
// context_documents column holds ContextDocument[]
```

No raw file bytes stored — only extracted text + metadata.

## Shared Package — Types & Extraction

**`packages/shared/src/documents.ts`**:
- `ContextDocument` interface
- `extractText(buffer: Buffer, mimeType: string): string` — dispatches to PDF/markdown/plain text
- PDF extraction via `pdf-parse` (pure JS, no native deps)
- Markdown/plain text returned as-is
- Exported from `packages/shared/src/index.ts` barrel

## API Layer

**`POST /onboarding/:sessionId/documents`** — multipart form upload
- Accepts one or more files (.md, .txt, .pdf)
- Validates MIME type against allowlist
- Calls `extractText()` from `@precept/shared`
- Appends to session's `context_documents` array in DB
- Returns updated document list

**`DELETE /onboarding/:sessionId/documents/:index`** — remove a document
- Removes by array index, updates DB
- Returns updated list
- Note: index-based deletion has a race condition under concurrent access, acceptable for single-user v0.1

No changes to `sendMessage` or `completeSession` signatures — the engine reads `context_documents` from the session row when building the CEO prompt.

## CEO Prompt Integration

In `buildMessages()`, when `context_documents` is non-empty, inject a system message before the conversation history:

```
## Background Documents
The owner has provided the following documents for context. Use them to:
- Skip topics already clearly covered
- Ask deeper follow-up questions instead of surface-level ones
- Pre-populate the extraction tracker with information these documents provide

### [filename]
[extracted text content]
```

## Frontend — Chat Input

Modify `ChatPanel.tsx`:
- Paperclip/attach icon button left of the text input
- Opens hidden `<input type="file" accept=".md,.txt,.pdf" multiple />`
- Files upload immediately to `POST /onboarding/:sessionId/documents`
- Uploaded filenames shown as dismissible chips above the input area
- X button on chips calls `DELETE /onboarding/:sessionId/documents/:index`
- Chips reflect session-level documents (fetched on load, updated on upload/remove)
- No change to `onSendMessage` prop — documents are on the session before any message is sent

## Not In Scope

- Drag-and-drop
- File previews or content display
- Upload progress bars
- Supabase Storage (text goes straight to JSONB)
- Streaming changes
- Concurrent access safety on DELETE
