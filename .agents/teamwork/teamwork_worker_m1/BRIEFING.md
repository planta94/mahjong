# BRIEFING — 2026-10-31T09:16:00Z

## Mission
Implement Milestone 1 of the Party Game Pavilion multi-game platform transformation: Reusable P2P Room Transport, Shell UI & Audio Infrastructure, Universal Game Hub, Shell & Routes Refactoring, Context Gate Fix, i18n Parity, and thorough unit tests.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_worker_m1\
- Original parent: ef1bcb5f-b649-4a2e-b9d7-7951164b25f3
- Milestone: milestone_1

## 🔒 Key Constraints
- STRICT INTEGRITY MANDATE: Genuine logic only, no hardcoded test values, no facade/dummy code, no circumvention.
- Hard prohibition on `*.sh` scripts (DO NOT read, inspect, create, edit, overwrite, rename, delete, execute `*.sh`).
- Zero `eslint-disable`. Zero explicit `any`. Zero unhandled catch (`catch (e: unknown)`).
- Use `Map<K, V>` and `.at()` instead of dynamic indexing (`security/detect-object-injection`).
- Vitest: isolate true, 0 trivial assertions (`toBeTruthy`, `toBeDefined`, `not.toBeNull` are forbidden). Never pass 3rd timeout arg to `it(...)`.
- Angular 21 Standalone Components & Signals.
- i18n lockstep parity across `en.json`, `zh.json`, `ms.json`.
- Modals: `max-width: 95vw; max-height: 90vh;` with middle scroll (`max-height: 55vh`), bottom action buttons only (NO top-right 'X' close buttons).
- Responsive views: `.desktop-table` on `> 768px`, `.mobile-cards` on `<= 768px`.
- Verification checklist: `npm.cmd run qa:agent-docs`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run test:ci`, `npm.cmd run build`.

## Current Parent
- Conversation ID: ef1bcb5f-b649-4a2e-b9d7-7951164b25f3
- Updated: 2026-10-31T09:16:00Z

## Task Summary
- **What to build**:
  1. `src/app/core/services/p2p-room.transport.ts`: Generic host/guest transport with PeerJS + BroadcastChannel, game-prefixed room codes ('M', 'P', 'A'), session tokens, state sanitization hook, URL hygiene and decoupled reset.
  2. `src/app/core/services/shell-ui.service.ts`: Shell signals, Web Audio synthesizer (click, deal, dice, alert, fanfare, fail), SpeechSynthesis, rulebook modal state, nickname migration.
  3. `src/app/pages/hub/hub.component.{ts,html,scss}`: Universal hub with 3 game selection cards, universal room code router, deep link handler, nickname editor.
  4. Shell refactor & routes (`app.component.*`, `app-header.component.*`, `app.routes.ts`): Rebranded header, decoupled from MahjongSessionService, router updates with redirect compatibility.
  5. Context verification gate fix (`scripts/verify-agent-context.mjs`): Allow `.agents/teamwork/` metadata.
  6. Trilingual i18n parity (`public/assets/i18n/{en,zh,ms}.json`): Add `HUB`, `SHELL`, updated `HEADER`.
  7. Comprehensive unit tests for new services and hub component.
- **Success criteria**: All quality checks pass (qa:agent-docs, tsc, lint, test:ci, build) with genuine implementations.
- **Interface contracts**: PROJECT.md, AGENTS.md, docs/reference/*.md
- **Code layout**: src/app/core/services/, src/app/pages/hub/, src/app/layout/header/

## Key Decisions Made
- Implemented `P2PRoomTransportService` with clean separation between `GenericHostSession` and `GenericGuestSession`.
- `ShellUiService` provides procedural Web Audio synthesis using standard OscillatorNode/GainNode (no external audio assets required).
- Nickname migration reads from legacy `hkmj_nickname` and writes to both `party_pavilion_nickname` and `hkmj_nickname` for dual-compatibility.
- Added comprehensive unit and E2E test suites with 100% adherence to zero-trivial assertions and test coverage rules.

## Artifact Index
- DISPATCH.md — Assignment from orchestrator
- BRIEFING.md — Persistent situational awareness
- progress.md — Liveness heartbeat and status log
- handoff.md — Final 5-component handoff report

## Change Tracker
- **Files modified**:
  - `scripts/verify-agent-context.mjs`: Permitted `.agents/teamwork/` metadata while banning duplicate root instruction files.
  - `src/app/core/models/party.model.ts`: Added Party platform data structures & contracts.
  - `src/app/core/services/p2p-room.transport.ts`: Reusable host/guest P2P transport & universal room parser.
  - `src/app/core/services/shell-ui.service.ts`: Shell audio, active game, nickname, and theme management.
  - `src/styles.scss`: Added theme CSS custom property sets for hub, mahjong, monopoly, avalon.
  - `src/app/pages/hub/hub.component.{ts,html,scss}`: Universal game selection hub.
  - `src/app/app.routes.ts`: Hub as root route, backward-compatible `/lobby` and `/table` redirects.
  - `src/app/layout/header/app-header.component.{ts,html}`: Rebranded shell topbar decoupled from Mahjong service.
  - `src/app/app.component.{ts,html}`: Bound to ShellUiService for global rulebook modal and theme.
  - `src/app/core/services/mahjong-session.service.ts`: Synced sound/bgm/room state with shell UI.
  - `public/assets/i18n/{en,zh,ms}.json`: Trilingual lockstep parity for HUB, SHELL, COMMON, and HEADER.
  - Tests: `shell-ui.service.spec.ts`, `p2p-room.transport.spec.ts`, `hub.component.spec.ts`, `hub-and-shell.e2e.spec.ts`, updated `app.component.spec.ts`.
- **Build status**: All 5 verification steps PASS: qa:agent-docs, tsc, lint, test:ci (105/105 passed, 84.81% lines, 71.13% branches), build.
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (105 tests passed across 14 test suites, 0 failed)
- **Coverage**: Lines 84.81% (>= 80%), Branches 71.13% (>= 70%)
- **Lint status**: 0 errors, 0 warnings, 0 eslint-disable comments
- **Tests added/modified**: 46 new unit/E2E tests covering transport, shell UI, hub, and integrated shell

## Loaded Skills
- None specified by user.
