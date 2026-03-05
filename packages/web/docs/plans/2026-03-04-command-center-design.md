# Command Center Redesign

Replace sidebar + 5 pages with a single full-screen 3-column command center.

## Layout

```
Top Bar: [OrgName + LIVE dot] [mission statement] [theme toggle] [precepts link]

3-column grid (25% / 40% / 35%):

Left Column          Center Column         Right Column
├─ Initiatives       ├─ Activity Feed      ├─ CEO Chat (60%)
│  (cards, click     │  (audit log as       │  (always visible)
│   → slide-out)     │   live feed,         ├─ Board Requests
├─ Structure         │   newest first,      │  (only if pending)
│  (mini org chart)  │   realtime insert)   ├─ Exceptions
│                    │                      │  (only if any)
```

## Key Decisions

- **Initiative drill-down**: slide-out overlay panel (not column resize) — avoids reflowing live feeds
- **Dark mode**: next-themes + Tailwind class strategy, toggle in top bar, default light, persisted in localStorage
- **Precepts page**: moves out of (dashboard) route group, standalone layout without sidebar

## Routes

```
/dashboard    → command center (single page)
/precepts     → standalone viewer (no sidebar)
/login        → unchanged
/onboarding   → unchanged

Removed: /structure, /chat, /audit, /dashboard/[id]
```

## Responsive

- >= 1280px: 3 columns
- 1024-1279px: 2 columns (left+center stacked, right stays)
- < 1024px: single column stacked
- < 768px: hide Structure

## Unchanged

All components reused as-is. All hooks, data fetching, realtime subscriptions, engine API calls unchanged. Only layout/routing changes.

One component modification: `InitiativeCards` opens slide-out panel instead of navigating to `/dashboard/[id]`.
