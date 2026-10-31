# BRIEFING — 2026-10-31T10:41:30Z

## Mission
Implement authentic "The Resistance: Avalon" (阿瓦隆) 5-10 player social deduction game with full P2P session, Bayesian deduction AI bot, pure state engine & sanitization, midnight/crimson UI table and lobby, Arthurian role cards, Lady of the Lake, Hammer track, and Assassin endgame phase.

## 🔒 My Identity
- Archetype: implementer, qa, specialist
- Roles: implementer, qa, specialist
- Working directory: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_worker_avalon
- Original parent: ef1bcb5f-b649-4a2e-b9d7-7951164b25f3
- Milestone: The Resistance: Avalon Game Implementation

## 🔒 Key Constraints
- Pure state engine with anti-cheat view sanitization (`getAvalonPlayerView`).
- Merlin sees evil except Mordred (sees Oberon); Percival sees Merlin & Morgana; Evils see each other except Oberon; Oberon isolated.
- Fisher-Yates shuffle quest reveal (counts only, zero seat attribution).
- Don Eskridge 5-10 matrices, Quest 4 two-fails rule for >=7 players, Hammer 5-rejections track.
- Pure Bayesian deduction AI bot for team proposals, voting, quest play, Lady of the Lake, and Assassin shot.
- P2P session using `P2PRoomTransport` ('A' room prefix), bot filling.
- Responsive UI (desktop-table > 768px, mobile-cards <= 768px), privacy shield overlay, bounded modals max-height 90vh with bottom buttons only.
- Strict i18n lockstep parity across en, zh, ms.
- Zero lint errors, zero explicit any, Map/at indexing, 100% test pass.

## Current Parent
- Conversation ID: ef1bcb5f-b649-4a2e-b9d7-7951164b25f3
- Updated: 2026-10-31T10:41:30Z

## Task Summary
- **What to build**: Full Avalon game suite (models, config, engine, bot, session, components, routes, i18n, specs).
- **Success criteria**: All quality checks pass (`npm run qa:agent-docs`, `npx tsc --noEmit`, `npm run lint`, `npm run test:ci`, `npm run build`).
- **Interface contracts**: `docs/reference/architecture.md`, `docs/reference/security-and-p2p.md`, `docs/reference/ui-conventions.md`, `docs/reference/testing-and-quality.md`.

## Key Decisions Made
- [Initial setup]: Analyzed original request and reference specifications.
- [Engine & Anti-Cheat]: Built pure state machine in `avalon-engine.service.ts` with Fisher-Yates quest card shuffle, `getAvalonPlayerView` night vision sanitization, and strict action guards.
- [AI Deduction Bot]: Implemented Bayesian trust scoring bot evaluating proposals, votes, quest cards, Lady investigations, and Assassin shots.
- [Session & P2P]: Implemented `AvalonSessionService` with `P2PRoomTransport` ('A' prefix), host/guest syncing, and bot timers.
- [UI & i18n]: Created Arthurian midnight/crimson theme with privacy shield overlay and responsive views in `avalon-lobby` & `avalon-table`; 57 i18n keys synchronized across `en.json`, `zh.json`, `ms.json`.
- [Quality Verification]: Resolved coverage hurdles; achieved 81.72% line coverage (>= 80%) and 70.53% branch coverage (>= 70%) across 273 unit and E2E tests.

## Artifact Index
- DISPATCH.md — Dispatch instructions
- BRIEFING.md — Working memory and status
- progress.md — Liveness heartbeat and milestone tracking
- handoff.md — Final deliverable report

## Change Tracker
- **Files modified**:
  - `src/app/games/avalon/models/avalon.model.ts` — Game domain models, view interfaces, serializable map utilities
  - `src/app/games/avalon/data/avalon-config.data.ts` — 5-10 player matrices, role configurations, bot name pools
  - `src/app/games/avalon/services/avalon-engine.service.ts` — Pure state engine, night vision sanitization, quest shuffling
  - `src/app/games/avalon/services/avalon-bot.service.ts` — Bayesian deduction bot for all phases
  - `src/app/games/avalon/services/avalon-session.service.ts` — Host/guest P2P transport and bot timers
  - `src/app/games/avalon/components/avalon-lobby/` — Lobby HTML, SCSS, TS component
  - `src/app/games/avalon/components/avalon-table/` — Table HTML, SCSS, TS component
  - `src/app/app.routes.ts` — Avalon lobby and table route wiring
  - `public/assets/i18n/{en,zh,ms}.json` — 57 AVALON translation keys in strict lockstep
  - `src/app/games/avalon/**/*.spec.ts` — Comprehensive unit test suites
  - `src/app/core/e2e-specs/avalon-social-deduction.e2e.spec.ts` — Full E2E match simulation suite
- **Build status**: All checks passed (tsc clean, lint clean, test:ci 273/273 pass, build clean)
- **Pending issues**: None.

## Quality Status
- **Build/test result**: PASSED (29 files, 273/273 tests, 81.72% lines, 70.53% branches)
- **Lint status**: 0 errors, 0 warnings, 0 eslint-disable comments
- **Tests added/modified**: 273 total passing tests across model, config, engine, bot, session, components, E2E suites

