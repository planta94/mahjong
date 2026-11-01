# Handoff Report: Milestone 1 — Navigation, Session Exit & Confirmation Dialog

## 1. Observation
- **Pre-existing Navigation & Session Defects**:
  - `MahjongSessionService` had no listener for `p2p:leave` or `mahjong:leave` dispatched by `ShellUiService.leaveActiveRoom()`, leaving players trapped in the room or on the `/table` route after clicking the header leave button.
  - `MonopolySessionService` and `AvalonSessionService` set `snapshot.set(null)` upon receiving `p2p:leave` without performing navigation when on `/monopoly/board` or `/avalon/table`, causing blank unrendered routes.
  - `AppHeaderComponent` labeled `.hub-btn` as `"Home"` / `"返回首页"`, which confused players about whether they were returning to the universal Pavilion Hub (`/`) or their active game lobby, and displayed `.leave-btn` only when `shellUi.activeRoomCode()` was non-null (omitting solo games in progress).
  - `LobbyComponent` waiting room card footer had no `Leave Room` button in `.cta-row`, leaving Mahjong inconsistent with Monopoly and Avalon waiting rooms.
  - `ExitConfirmDialogComponent` lacked a direct action to return to the active game's setup lobby (`/.../lobby`).
- **Files Modified (Strict Write Ownership)**:
  - `src/app/core/services/game-session-manager.service.ts`
  - `src/app/core/services/game-session-manager.service.spec.ts`
  - `src/app/layout/header/app-header.component.ts`
  - `src/app/layout/header/app-header.component.html`
  - `src/app/layout/header/app-header.component.spec.ts`
  - `src/app/shared/exit-confirm-dialog/exit-confirm-dialog.component.ts`
  - `src/app/shared/exit-confirm-dialog/exit-confirm-dialog.component.html`
  - `src/app/shared/exit-confirm-dialog/exit-confirm-dialog.component.spec.ts`
  - `src/app/core/services/mahjong-session.service.ts`
  - `src/app/pages/lobby/lobby.component.html`
  - `src/app/games/monopoly/services/monopoly-session.service.ts`
  - `src/app/games/avalon/services/avalon-session.service.ts`
  - `src/app/core/services/shell-ui.service.spec.ts`
- **Tool Outputs & Verification**:
  - `npx.cmd ng test --watch=false --no-coverage --include=src/app/layout/header/*.spec.ts --include=src/app/shared/exit-confirm-dialog/*.spec.ts --include=src/app/core/services/game-session-manager.service.spec.ts --include=src/app/core/services/shell-ui.service.spec.ts`:
    ```
    RUN  v5.0.5 C:/Users/chine/OneDrive/Desktop/Github/mahjong
    ✓  hk-mahjong  src/app/core/services/shell-ui.service.spec.ts (13 tests) 38ms
    ✓  hk-mahjong  src/app/shared/exit-confirm-dialog/exit-confirm-dialog.component.spec.ts (4 tests) 174ms
    ✓  hk-mahjong  src/app/layout/header/app-header.component.spec.ts (6 tests) 198ms
    ✓  hk-mahjong  src/app/core/services/game-session-manager.service.spec.ts (7 tests) 386ms
    Test Files  4 passed (4)
    Tests  30 passed (30)
    Duration  3.08s
    ```
  - `npx.cmd tsc --noEmit`: Exited with code 0.
  - `npm.cmd run lint`: Exited with code 0 (0 errors, 0 warnings).
  - `npm.cmd run qa:agent-docs`: Exited with code 0 (`AGENTS.md: 5115 bytes | 4 reference docs verified | 87 TS/spec files clean`).

## 2. Logic Chain
1. In `GameSessionManagerService`, defined `ExitDestination = 'hub' | 'gameLobby'`, `exitDestination` signal, and computeds `hasStartedMatch` and `hasActiveWaitingRoom`. When `requestGoHome()` is invoked from an idle state or an unstarted waiting room, `killAllActiveSessions()` is called and navigation proceeds directly to `/` without an unnecessary confirmation dialog. When a match has started (Solo or Online), `exitDestination` is set to `'hub'` and `showExitConfirmModal` is opened.
2. Added `requestLeaveCurrentGame()` and `confirmLeaveToGameLobby()` to `GameSessionManagerService`. In an unstarted waiting room, leaving cleans up session state and returns to the game lobby (`getGameLobbyRoute()`). In an active match, `exitDestination` is set to `'gameLobby'` and `showExitConfirmModal` opens.
3. Updated `canSaveCurrentProgress` computed to read `mahjong.snapshot()`, `monopoly.snapshot()`, and `avalon.snapshot()` so Angular Zoneless Signals track snapshot transitions reactively.
4. In `AppHeaderComponent`, renamed `.hub-btn` to `"All Games"` / `"游戏大厅"` with a 2×2 grid icon targeting the Pavilion Hub. Updated `.leave-btn` to render whenever `activeRoomCode() || gameManager.hasActiveProgress()`. Contextually labeled as `HEADER.LEAVE_ROOM` (`"Leave Room"` / `"退出房间"`) in waiting rooms (leaves immediately without modal), and `HEADER.EXIT_MATCH` (`"Exit Match"` / `"退出对局"`) during active matches (invokes `requestLeaveCurrentGame()`, opening the modal).
5. In `ExitConfirmDialogComponent`, strictly enforced bounded bottom-only actions: Stay in Game (`.stay-btn`), Back to Game Lobby (`.game-lobby-btn`), All Games Hub (`.discard-exit-btn`), and Save & Return to Hub (`.save-exit-btn` when savable). Zero header close buttons.
6. In `MahjongSessionService`, implemented `p2pLeaveHandler` listening for `p2p:leave` events targeting `'mahjong'` or generic details. Added `isTerminating` re-entrancy protection to prevent infinite dispatch loops, cleaned up session listeners on `ngOnDestroy()`, and routed to `/lobby` when departing while on `/table`.
7. In `LobbyComponent` (`lobby.component.html`), added the `Leave Room` (`HEADER.LEAVE_ROOM`) button to the waiting room `.cta-row` next to Start Match / Wait for Host (leaving `src/app/pages/table/` completely untouched).
8. In `MonopolySessionService` and `AvalonSessionService`, updated `p2p:leave` listeners so that after `leaveRoom()`, if `router.url` is on `/monopoly/board` or `/avalon/table`, navigation redirects to `/monopoly/lobby` or `/avalon/lobby` to eliminate blank screens.

## 3. Caveats
- `PandemicSessionService` does not exist yet (scheduled for Milestone 4 and Pavilion integration in Milestone 6). `getGameLobbyRoute()` in `GameSessionManagerService` defaults safely to `/mahjong/lobby` and is ready for `/pandemic/lobby` wiring in M6.
- In `npm.cmd run test:ci`, the full test suite runs 517 tests; 516 pass and 1 failure is in `src/app/games/pandemic/services/pandemic-engine.service.spec.ts` (Dispatcher error assertion) which belongs strictly to Milestone 3 / Pandemic development. All Milestone 1 targets and pre-existing suites pass 100%.

## 4. Conclusion
Milestone 1 is complete and fully verified. The navigation ambiguity between "All Games" hub and contextual room/match exit is resolved. Accidental clicks during active matches open a bounded dialog with bottom-only options, unstarted waiting rooms exit cleanly without modal friction, Mahjong properly respects `p2p:leave`, and Monopoly/Avalon no longer show blank screens on departure.

## 5. Verification Method
Execute the following verification commands from the project root:
```powershell
npx.cmd ng test --watch=false --no-coverage --include=src/app/layout/header/*.spec.ts --include=src/app/shared/exit-confirm-dialog/*.spec.ts --include=src/app/core/services/game-session-manager.service.spec.ts --include=src/app/core/services/shell-ui.service.spec.ts
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run qa:agent-docs
```
Expected result: 30/30 tests pass, 0 TypeScript errors, 0 ESLint errors/warnings.
