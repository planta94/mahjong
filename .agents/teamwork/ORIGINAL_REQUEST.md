# Original User Request

## Approved Task Prompt — 2026-11-01T03:42:20Z

User constraint on Mahjong tabletop:
"no need, as long as u make sure the logic is correct, dun change the action button"
(Leave Mahjong scoring logic and `src/app/pages/table/` tabletop action buttons untouched.)

User request #1 & #2 + `/grill-me`:
"few things I want you to do

1) in the monopoly, the bot does not reposence to my trading offer
2) I want to create another game, called the "Pandemic" board game 

/grill-me"

User's `/grill-me` interview answers:
- Q1 (Monopoly Bot Trade Behavior & UX): "Show a clear Trade Result popup/banner + SFX (Accepted/Declined with the bot's reason), validate inputs before sending, AND update bot AI to accept fair mutual-monopoly swaps & high-premium offers"
- Q2 (Pandemic Map & Setting): "Authentic 48-City Global World Map across 4 disease colors (Blue, Yellow, Black, Red) starting at Atlanta, with classic cross-continent & Pacific wraparound routes"
- Q3 (Pandemic Ruleset & Roles Scope): "Full Classic Base Game: all 7 Specialist Roles (Medic, Scientist, Researcher, Dispatcher, Operations Expert, Quarantine Specialist, Contingency Planner), all 5 Special Event cards (Airlift, Government Grant, One Quiet Night, Forecast, Resilient Population), and 3 Difficulty levels (4 / 5 / 6 Epidemics)"
- Q4 (Solo, AI Bots & Co-op Control): "Support BOTH: Cooperative Tactical AI Bot teammates (for Solo & mixed P2P rooms) AND a 'Solo Commander' toggle in the lobby where 1 player controls all 2–4 Specialist seats directly"
- Q5 (Epidemic Timing, Role Selection & World Map UX):
  - Turn phases: Explicit `4 Actions` → `Draw 2 Player Cards / Epidemic Alert` → `Infect Cities` stepper so players have an Event reaction window after an Epidemic's bottom-card Infect step (before Intensify shuffles `infectionDiscard` onto `infectionDeck`) and before `Infect Cities`.
  - Role selection: Random unique roles by default + optional Lobby Role Picker per seat.
  - Board & Mobile UX: "Interactive CDC Tactical SVG World Map (continents, route lines, Pacific wraparounds, cube/station/pawn badges) with Region Filter / Zoom controls + click-a-city to see & execute valid moves, paired with Mobile App Cards on <= 768px"

User request #3 (`/plan` addition):
"/plan 

add one more thing, check the home button or the exit room button (sometimese they are confusing)"

Approved Implementation Plan (`C:\Users\chine\.gemini\antigravity\brain\effe94dd-f539-4d36-8797-edcb695c4bde\implementation_plan.md` — also write `C:\Users\chine\.gemini\antigravity\brain\effe94dd-f539-4d36-8797-edcb695c4bde\walkthrough.md` upon completion):

1. **Header Navigation, Session Exit & Confirmation Dialog**:
   - Fix Bug 1: `MahjongSessionService` currently ignores `p2p:leave` / `mahjong:leave` dispatched by `ShellUiService.leaveActiveRoom()`, hiding `.leave-btn` while leaving the player stuck in the room/table. Make `MahjongSessionService` handle `p2p:leave` cleanly (terminate session & navigate to `/lobby` if on `/table`, guarding against re-entrant dispatch) and add a `Leave Room` button inside `LobbyComponent` (`src/app/pages/lobby/lobby.component.html`) waiting-room `.cta-row` (do NOT touch `src/app/pages/table/`).
   - Fix Bug 2: `MonopolySessionService` and `AvalonSessionService` set `snapshot(null)` on `p2p:leave` without navigating away from `/monopoly/board` or `/avalon/table`, leaving a blank screen. Navigate cleanly to `/monopoly/lobby` / `/avalon/lobby` (and `/pandemic/lobby` for Pandemic).
   - Clarify UX across `AppHeaderComponent`, `GameSessionManagerService`, and `ExitConfirmDialogComponent`:
     - Rename `.hub-btn` (`HEADER.SWITCH_GAME`) to `"All Games"` / `"游戏大厅"` (always targets Pavilion Hub `/`; goes immediately if idle or in an unstarted waiting room, opens `ExitConfirmDialogComponent` if a match has started).
     - Show `.leave-btn` whenever `shellUi.activeRoomCode() || gameManager.hasActiveProgress()`:
       - In an unstarted waiting room: labeled `HEADER.LEAVE_ROOM` (`"Leave Room"` / `"退出房间"`) → leaves immediately back to current game's `/.../lobby` without a modal.
       - In a started match (Solo OR Online): labeled `HEADER.EXIT_MATCH` (`"Exit Match"` / `"退出对局"`) → opens `ExitConfirmDialogComponent` offering clear bottom-only footer actions: `Stay in Game`, `Back to Game Lobby` (`/.../lobby`), `All Games Hub` (`/`), and `Save & Return to Hub` (when `canSaveCurrentProgress()`).

2. **Monopoly Bot Trading Fix & Trade Result UX (`src/app/games/monopoly/`)**:
   - Add `TradeReasonKey` and `TradeOutcome` (`lastTradeOutcome: TradeOutcome | null`) to `MonopolyMatchState` and `MonopolyPlayerView`; allow optional `reasonKey` on `acceptTrade` / `rejectTrade`.
   - Upgrade `MonopolyBotService.evaluateTradeResponse` so bots accept fair mutual-monopoly swaps (`gainsMonopoly && opponentGainsMonopoly && netDelta >= -60`) and high-premium buyouts (`opponentGainsMonopoly && !gainsMonopoly && offeredValue >= Math.max(200, Math.round(requestedValue * 1.8) + 120)`), while returning clear localized `reasonKey` values (`CASH_RESERVE`, `GRANTS_MONOPOLY`, `LOW_VALUE`, `MUTUAL_SETS`, `PREMIUM_BUYOUT`, `ACCEPTED`).
   - Sanitize cash inputs (`Math.max(0, Math.floor(...))`), reject empty 0-for-0 trades, clear stale `tradeRequestProps` when changing `tradeTargetSeat`, validate inline inside the Trade Modal before closing, play `'deal'`/`'fail'` SFX on trade responses (including bot responses in `MonopolySessionService`), show a pending trade pill while awaiting response, and show a bounded **Trade Outcome Modal** (bottom close button only) for `fromSeat === mySeat`.

3. **Cooperative "Pandemic" Board Game (`src/app/games/pandemic/`) + Pavilion Integration**:
   - Universal P2P room prefix `'D'` (`D*` codes, `?game=pandemic`) in `party.model.ts` and `p2p-room.transport.ts`.
   - 48 authentic cities (`12` per color: `blue`, `yellow`, `black`, `red`, starting at `atlanta`), symmetric adjacency `ReadonlyMap` with Pacific wraparound routes (`san_francisco ↔ tokyo`, `san_francisco ↔ manila`, `los_angeles ↔ sydney`).
   - Full engine (`pandemic-engine.service.ts`): 8 core actions, all 7 Specialist roles (`medic`, `scientist`, `researcher`, `dispatcher`, `operations_expert`, `quarantine_specialist`, `contingency_planner`), all 5 Anytime Event cards (`airlift`, `government_grant`, `one_quiet_night`, `forecast`, `resilient_population`), `4 / 5 / 6` Epidemic stratified setup, 6-station relocation cap, 7-card hand limit, Disease Eradication, chain-reaction Outbreaks (`outbrokenSet` per chain, lose at `8` outbreaks / `< 0` cubes / `< 2` player deck cards on draw; win immediately upon curing all `4` diseases), explicit `actions` → `epidemic` (Event window before `resolveEpidemicIntensify`) → `discard` → `infect` stepper, and anti-cheat `getPandemicPlayerView` stripping `playerDeck` and `infectionDeck` (`forecastCards` exposed only during `'forecast'`).
   - `PandemicBotService` (cooperative tactical BFS AI) + `PandemicSessionService` (Solo w/ Bots, **Solo Commander** mode controlling all `2–4` seats, Online `D*` P2P, Role Picker, Save/Restore).
   - `PandemicLobbyComponent` + `PandemicBoardComponent` (CDC Bio-Command theme `body[data-theme='pandemic']`, interactive SVG world map with Region Filter/Zoom `All/Blue/Yellow/Black/Red` + click-city action drawer, bounded modals with bottom-only close buttons, and responsive `.mobile-cards` on `<= 768px`).
   - Wire into `app.routes.ts`, `HubComponent`, `AppHeaderComponent`, `ShellUiService`, `GameSessionManagerService`, `RulebookDialogComponent` (4th tab with `.desktop-table` + `.mobile-cards`), `public/assets/i18n/{en,zh}.json` (strict key parity), `veriscribe.config.ts` (`slice:pandemic-lobby`, `slice:pandemic-board` manual waivers only — zero component/service spec waivers), `AGENTS.md` (`< 20,000` bytes), and `docs/reference/*.md`.
   - Follow all `AGENTS.md` rules strictly: NEVER read/inspect/create/edit/execute any `*.sh` script; read `docs/reference/*.md` before editing; `0` `any`, `0` `eslint-disable`, `0` `TestBed.overrideComponent`, `0` trivial assertions (`.toBeTruthy()`, `.toBeDefined()`, `.not.toBeNull()`); run `npm.cmd run qa:agent-docs`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run test:ci`, `npm.cmd run qa:scan`, `npm.cmd run qa:gate`, and `npm.cmd run build`.
