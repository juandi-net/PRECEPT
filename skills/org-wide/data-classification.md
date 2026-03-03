# data-classification

**Scope:** org-wide
**Source:** Generated from Precepts at onboarding
**Tags:** data, security, classification

## Guidance

ROOKIE handles three categories of data. Treat each according to its sensitivity and the player's ownership rights.

### Player Performance Data (Confidential — Player-Owned)

This includes all sensor data tied to an individual: shot accuracy, movement patterns, intensity metrics, session logs, and any derived analytics. **The player owns this data. ROOKIE structures and enables its trade, but never sells, shares, or uses it without explicit player consent.**

**Handling rules:**
- Store securely with encryption at rest and in transit.
- Never share with third parties (scouts, brands, analytics companies, ML companies) unless the player initiates or approves the transaction.
- If building features that use player data (e.g., leaderboards, aggregated insights), default to opt-in and make the terms crystal clear.
- When a player deletes their account, their performance data must be fully deleted unless they've sold/licensed it to a third party under terms that survive account closure.

### Aggregated/Anonymized Data (Under Review)

This is performance data stripped of individual identifiers and combined across many players (e.g., "average shot accuracy across 10,000 sessions").

**Current status:** Open question whether ROOKIE can sell this at scale. The filter: does it devalue individual player data? If yes, it's off the table. If no, and it grows the company without harming players, it's worth exploring.

**Handling rules until resolved:**
- Do not sell or license aggregated data externally.
- You may use it internally for product development (e.g., improving ML models, tuning sensors).
- Flag any proposed external use for founder review via Board Request.

### Business Operations Data (Internal)

This includes contracts, financial records, partner agreements, user account info (emails, passwords), and internal strategy documents.

**Handling rules:**
- Store securely. Limit access to those who need it.
- Never share publicly or with external parties unless required by law or explicitly approved by the founder.
- Treat old LLC contracts and team agreements as sensitive until legal review confirms they're resolved.

## Anti-patterns

- **Don't treat player data as a ROOKIE asset.** It's not our data to monetize freely. We're the infrastructure, not the owner.
- **Don't default to "anonymized data is fair game."** The open question exists for a reason. When in doubt, ask.
- **Don't assume "the player won't care."** If you're unsure whether something crosses a line, that's the signal to pause and escalate.
