# Scope: Navigation Clarity, Monopoly Trading & Pandemic Board Game

## Architecture
- **Header Navigation & Session Management**:
  - `ShellUiService` + `GameSessionManagerService` unified exit destination handling ('hub' vs 'gameLobby').
  - `AppHeaderComponent`: `.hub-btn` -> "All Games" (`/`), `.leave-btn` -> context-aware "Leave Room" (waiting room, leaves immediately) vs "Exit Match" (started match, opens modal).
  - `ExitConfirmDialogComponent`: contextual title + bottom-only actions (Stay, Back to Game Lobby, All Games Hub, Save & Return to Hub).
  - P2P session cleanup: `MahjongSessionService` listens to `p2p:leave` (routes to `/lobby` if on `/table`, leaves `/pages/table/` untouched); `MonopolySessionService` & `AvalonSessionService` route to `/monopoly/lobby` and `/avalon/lobby` on `p2p:leave` instead of blank screen.
  - `LobbyComponent`: Add `Leave Room` button in waiting-room `.cta-row`.
- **Monopoly Bot Trading & Outcome UX**:
  - `monopoly.model.ts`: `TradeReasonKey`, `TradeOutcome`, `lastTradeOutcome` on match state & player view, optional `reasonKey` on accept/reject actions.
  - `monopoly-bot.service.ts`: accept fair mutual-monopoly swaps and high-premium buyouts with explicit reason keys.
  - `monopoly-engine.service.ts` & `monopoly-session.service.ts`: sanitize cash, reject 0-for-0, populate outcome, trigger 'deal'/'fail' SFX.
  - `monopoly-board.component.*`: input validation, pending trade pill, bounded Trade Outcome Modal (bottom close button only).
- **Pandemic Board Game Module (`src/app/games/pandemic/`)**:
  - Models (`pandemic.model.ts`): 4 disease colors, 7 roles, 5 events, 3 difficulties, turn phase stepper (`actions` -> `epidemic` -> `discard` -> `infect`), player view sanitizer.
  - Data (`pandemic-cities.data.ts`, `pandemic-roles-events.data.ts`): 48 global cities, SVG coordinates, bidirectional adjacency, Pacific wraparounds (`san_francisco ↔ tokyo`, `san_francisco ↔ manila`, `los_angeles ↔ sydney`), role/event specifications.
  - Engine (`pandemic-engine.service.ts`): initial setup, 8 actions, role specials, stratified epidemic shuffle, bottom card infection + 3 cubes, intensify shuffle onto infection deck, chain outbreaks, eradication, win/loss.
  - Bot (`pandemic-bot.service.ts`): cooperative tactical BFS AI planner.
  - Session (`pandemic-session.service.ts`): Solo w/ bots, Solo Commander mode (1 player commands 2-4 seats), Online P2P (`D*`), save/restore.
  - UI (`pandemic-lobby.component.*`, `pandemic-board.component.*`): CDC Bio-Command theme, HUD counters, interactive SVG world map with region filter/zoom, action drawer, team hand dock, modals (bottom close only), mobile cards (<=768px).
- **Pavilion Integration**:
  - `party.model.ts` & `p2p-room.transport.ts`: `D*` universal room code prefix, `?game=pandemic`.
  - `app.routes.ts`: `/pandemic/lobby`, `/pandemic/board`.
  - `HubComponent`: 4th Pandemic game card.
  - `RulebookDialogComponent`: 4th Pandemic rulebook tab.
  - `src/styles.scss`: `body[data-theme='pandemic']`.
  - `public/assets/i18n/{en,zh}.json`: full key parity.
  - `veriscribe.config.ts`, `AGENTS.md`, `docs/reference/*.md`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Navigation & Session Exit Fix | Context-aware "All Games" vs "Leave Room" / "Exit Match", modal bottom actions, session cleanup | M1 | ORIGINAL_REQUEST §1 |
| 2 | Monopoly Bot Trading & Outcome UX | Mutual swaps, high-premium buyouts, TradeOutcome, SFX, bounded modal | M2 | ORIGINAL_REQUEST §2 |
| 3 | Pandemic Core Engine & 48-City Data | 48 cities, 7 roles, 5 events, 8 actions, epidemic stepper, outbreaks, cures | M3 | ORIGINAL_REQUEST §3 |
| 4 | Pandemic AI Bot & Session Transport | Tactical co-op bot, Solo Commander mode, P2P D* transport, save/restore | M4 | ORIGINAL_REQUEST §3 |
| 5 | Pandemic Interactive UI & SVG Map | CDC Bio-Command SVG map, region zoom, action drawer, modals, mobile cards | M5 | ORIGINAL_REQUEST §3 |
| 6 | Pavilion Integration & Quality Gate | Routes, Hub card, Rulebook tab, i18n parity, veriscribe, verification checklist | M6 | AGENTS.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Navigation & Exit Clarification | Header, SessionManager, ExitConfirmDialog, Mahjong/Monopoly/Avalon session leave fixes | none | PLANNED |
| 2 | M2: Monopoly Bot Trading & Outcome UX | Monopoly models, bot trade evaluation, engine outcome, board modal & validation | none | PLANNED |
| 3 | M3: Pandemic Models, Data & Core Engine | Pandemic models, 48-city data, roles/events data, engine service & unit specs | none | PLANNED |
| 4 | M4: Pandemic Bot, Session & P2P | Pandemic bot service, session service, party.model, p2p transport D* | M3 | PLANNED |
| 5 | M5: Pandemic UI Components | Pandemic lobby, board, SVG map, modals, SCSS, component unit specs | M3, M4 | PLANNED |
| 6 | M6: Pavilion Integration & QA Gates | Routes, Hub, Rulebook, i18n, veriscribe, full verification suite, walkthrough.md | M1, M2, M5 | PLANNED |
