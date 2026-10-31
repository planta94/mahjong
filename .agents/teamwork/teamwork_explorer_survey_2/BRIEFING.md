# BRIEFING — 2026-10-31T08:37:30Z

## Mission
Survey and design the complete domain model, game engine architecture, AI bot, and UI requirements for Malaysia Landmarks Monopoly (大馬地標大富翁) in src/app/games/monopoly/.

## 🔒 My Identity
- Archetype: explorer
- Roles: survey, domain modeling, game engine architecture, AI bot design, UI requirements specification
- Working directory: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_explorer_survey_2
- Original parent: ef1bcb5f-b649-4a2e-b9d7-7951164b25f3
- Milestone: Multi-Game Pavilion - Monopoly Survey & Technical Design

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify project source code
- Strictly NO execution, creation, inspection, or editing of *.sh scripts
- Adhere to AGENTS.md and docs/reference/*.md
- Anti-cheat state sanitization (Host holds authoritative state and secret deck order; Guests receive sanitized view)
- 0 explicit any, 0 eslint-disable, Map/.at() object injection safety, Angular 21 Signals, i18n parity
- Saidina family house rules: Free Parking Jackpot (taxes, fines, bail accumulate) & No rent collected while in jail

## Current Parent
- Conversation ID: ef1bcb5f-b649-4a2e-b9d7-7951164b25f3
- Updated: not yet

## Investigation State
- **Explored paths**: .agents/teamwork/ORIGINAL_REQUEST.md, docs/reference/*.md, src/app/core/models/mahjong.model.ts, src/styles.scss, src/styles/_variables.scss, public/assets/i18n/en.json.
- **Key findings**: Complete 40-space Malaysia board data specification, 22 landmarks in 8 color groups, 4 transit hubs, 2 utilities, 2 taxes, 4 corners, 16 Nasib & 16 Dana Komuniti action cards in RM currency; Saidina family house rules (Free Parking Jackpot & No Rent in Jail); turn lifecycle with doubles streak; even-build constraint; mortgages & distress liquidation; trading; configurable auctions & win conditions; tactical AI bot heuristics; responsive 11×11 CSS Grid + mobile cards UI architecture; bounded modal designs.
- **Unexplored areas**: None. Domain model and architectural design complete.

## Key Decisions Made
- Fully specified complete 40-space board registry with calibrated rents and RM prices.
- Designed 16 Nasib and 16 Dana Komuniti cards with authentic Malaysian themes routing fines into the Free Parking Jackpot.
- Formalized Saidina House Rules 1 and 2 directly into state transition logic.
- Established tactical AI heuristics for bidding, development, and jail exit.
- Defined responsive UI contracts conforming to AGENTS.md and UI guidelines.

## Artifact Index
- handoff.md — Comprehensive domain model and architectural design report.
- progress.md — Liveness heartbeat.
- DISPATCH.md — Initial dispatch message.
