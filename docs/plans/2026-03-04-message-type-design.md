# Message Type System for CEO Chat

## Problem

The Interface shows the latest CEO message regardless of context. Owner responses and CEO reactive replies persist as the main letter. Need to distinguish proactive letters (briefings, escalations) from reactive responses, and clear the letter once the owner has engaged.

## Design

### Schema

Add `type TEXT NOT NULL DEFAULT 'response'` to `ceo_chat_messages` with `CHECK (type IN ('briefing', 'escalation', 'response', 'owner'))`.

### Write paths

| Writer | role | type |
|---|---|---|
| `compileBriefing` | `ceo` | `briefing` |
| `handleEscalation` (new insert) | `ceo` | `escalation` |
| `handleChatMessage` (owner input) | `owner` | `owner` |
| `handleChatMessage` (CEO reply) | `ceo` | `response` |

### Interface query logic

1. Get latest CEO message where `type IN ('briefing', 'escalation')`
2. Get latest owner message
3. If owner message is newer than CEO letter (or no CEO letter exists) → "Nothing to report."
4. Otherwise → show the CEO letter

### Changes

- Migration: `ALTER TABLE ceo_chat_messages ADD COLUMN type TEXT NOT NULL DEFAULT 'response'`
- `insertChatMessage`: add `type` parameter
- `compileBriefing`: pass `type: 'briefing'`
- `handleChatMessage`: pass `type: 'owner'` and `type: 'response'`
- `handleEscalation`: add `insertChatMessage` call with `type: 'escalation'`
- Interface page: update query logic
