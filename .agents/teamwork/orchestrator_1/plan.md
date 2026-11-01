# Execution Plan

## Objectives
1. **Header Navigation & Exit Clarity** (`ShellUiService`, `GameSessionManagerService`, `AppHeaderComponent`, `ExitConfirmDialogComponent`, `MahjongSessionService`, `LobbyComponent`, `MonopolySessionService`, `AvalonSessionService`).
2. **Monopoly Bot Trading & Trade Outcome UX** (`monopoly.model.ts`, `monopoly-bot.service.ts`, `monopoly-engine.service.ts`, `monopoly-session.service.ts`, `monopoly-board.component.*`).
3. **Pandemic Board Game Full Implementation** (`src/app/games/pandemic/`):
   - Models & Authentic 48-city world map data + Roles (7) & Events (5)
   - Deterministic Core Engine (Actions, Epidemic stepper, Outbreak chain, Cure/Eradication, Player/Infection deck sanitization)
   - Tactical Cooperative AI Bot & Session Manager (Solo w/ bots, Solo Commander, P2P D* room codes, save/restore)
   - CDC Bio-Command SVG Board & Interactive Map, Region Zoom/Filter, Action Drawer, Mobile Cards (<=768px), Lobby & Rulebook tab
4. **Pavilion Integration & Quality Gates**:
   - `party.model.ts`, `p2p-room.transport.ts` (D* prefix, ?game=pandemic)
   - `app.routes.ts`, `HubComponent` (4th card), `styles.scss` (data-theme="pandemic")
   - `en.json`, `zh.json` (strict key parity)
   - `veriscribe.config.ts` waivers, `AGENTS.md` (<20k bytes), `docs/reference/*.md`
   - Verification checklist: agent-docs, tsc, lint, test:ci, qa:scan, qa:gate, build
   - Final walkthrough document (`C:\Users\chine\.gemini\antigravity\brain\effe94dd-f539-4d36-8797-edcb695c4bde\walkthrough.md`)

## Milestone Breakdown

### Milestone 1: Navigation & Exit Clarification
- Fix Mahjong p2p:leave handling (terminate & route to /lobby if on /table, no touch to /pages/table/)
- Add Leave Room button to LobbyComponent waiting room .cta-row
- Fix Monopoly & Avalon p2p:leave blank screen by routing to /.../lobby
- Rename header .hub-btn to "All Games" / "游戏大厅" (Hub /)
- Update .leave-btn contextuality: "Leave Room" in unstarted waiting room (leaves directly) vs "Exit Match" in active match (opens ExitConfirmDialog)
- Update ExitConfirmDialog with bottom-only buttons: Stay, Back to Game Lobby, All Games Hub, Save & Return to Hub
- Verify unit specs for header, exit-confirm-dialog, game-session-manager, and shell-ui

### Milestone 2: Monopoly Bot Trading & Outcome UX
- Add TradeReasonKey & TradeOutcome to MonopolyMatchState & MonopolyPlayerView
- Upgrade MonopolyBotService to accept fair mutual-monopoly swaps & high-premium buyouts with explicit reasonKey
- Sanitize cash inputs, reject 0-for-0 trades, inline modal validation, play 'deal'/'fail' SFX
- Add pending trade pill and bounded Trade Outcome Modal (bottom close button only)
- Verify unit specs for monopoly-bot, monopoly-engine, monopoly-session, monopoly-board

### Milestone 3: Pandemic Models, Data & Core Engine
- Create `src/app/games/pandemic/models/pandemic.model.ts`
- Create `src/app/games/pandemic/data/pandemic-cities.data.ts` (48 cities, coordinates, adjacency, Pacific wraparounds)
- Create `src/app/games/pandemic/data/pandemic-roles-events.data.ts` (7 roles, 5 events)
- Create `src/app/games/pandemic/services/pandemic-engine.service.ts`
- Implement 8 core actions, role passives/specials, explicit 4 Actions -> Epidemic Alert -> Discard -> Infect Stepper
- Implement sanitized view (strip decks, hide secret state)
- Write and verify comprehensive unit specs (`pandemic-engine.service.spec.ts`)

### Milestone 4: Pandemic Bot, Session & P2P Transport
- Create `src/app/games/pandemic/services/pandemic-bot.service.ts` (tactical co-op AI)
- Create `src/app/games/pandemic/services/pandemic-session.service.ts` (Solo w/ bots, Solo Commander, D* P2P)
- Wire `party.model.ts` and `p2p-room.transport.ts` for D* room codes and ?game=pandemic
- Write and verify unit specs (`pandemic-bot.service.spec.ts`, `pandemic-session.service.spec.ts`)

### Milestone 5: Pandemic UI Components (Lobby, Board, SVG Map, Modals)
- Create `pandemic-lobby.component.*` (Solo/Solo Commander/Online/Role Picker/Waiting Room)
- Create `pandemic-board.component.*` (CDC Bio-Command theme, HUD, SVG world map, region filter, action drawer, event dock, bounded modals, mobile cards <=768px)
- Write and verify component unit specs (`pandemic-lobby.component.spec.ts`, `pandemic-board.component.spec.ts`)

### Milestone 6: Pavilion Integration, i18n, VeriScribe & Full Verification Gate
- Wire `app.routes.ts`, `HubComponent` (4th card), `styles.scss` (`body[data-theme='pandemic']`)
- Wire `RulebookDialogComponent` (4th tab for Pandemic)
- Full i18n key parity in `en.json` & `zh.json`
- Update `veriscribe.config.ts`, `AGENTS.md` (< 20,000 bytes), `docs/reference/*.md`
- Run full verification suite (qa:agent-docs, tsc, lint, test:ci, qa:scan, qa:gate, build)
- Write `walkthrough.md` in brain directory and report completion to parent
