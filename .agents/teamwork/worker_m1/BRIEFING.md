# BRIEFING — 2026-11-01T04:07:00Z

## Mission
Milestone 1: Header Navigation, Session Exit & Confirmation Dialog (Tabletop Royale / hk-mahjong)

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\worker_m1
- Original parent: e6208b09-06b6-4b27-8fa3-e5ee3c6b6cc0
- Milestone: Milestone 1 (Header Navigation, Session Exit & Confirmation Dialog)

## 🔒 Key Constraints
- NEVER read, inspect, create, edit, overwrite, rename, delete, or execute ANY *.sh script.
- DO NOT touch Mahjong scoring logic or src/app/pages/table/ tabletop action buttons.
- Exclusive write ownership limited strictly to specified files:
  - src/app/core/services/game-session-manager.service.ts
  - src/app/core/services/game-session-manager.service.spec.ts
  - src/app/layout/header/app-header.component.ts
  - src/app/layout/header/app-header.component.html
  - src/app/layout/header/app-header.component.spec.ts
  - src/app/shared/exit-confirm-dialog/exit-confirm-dialog.component.ts
  - src/app/shared/exit-confirm-dialog/exit-confirm-dialog.component.html
  - src/app/shared/exit-confirm-dialog/exit-confirm-dialog.component.spec.ts
  - src/app/core/services/mahjong-session.service.ts
  - src/app/pages/lobby/lobby.component.html
  - src/app/games/monopoly/services/monopoly-session.service.ts
  - src/app/games/avalon/services/avalon-session.service.ts
  - src/app/core/services/shell-ui.service.spec.ts
- Angular 22 Signals, Standalone Components.
- 0 any, 0 eslint-disable.
- 0 TestBed.overrideComponent(...).
- 0 trivial test assertions (.toBeTruthy(), .toBeDefined(), .not.toBeNull()).
- Never pass a 3rd timeout arg to it(...).

## Current Parent
- Conversation ID: e6208b09-06b6-4b27-8fa3-e5ee3c6b6cc0
- Updated: 2026-11-01T04:07:00Z

## Task Summary
- **What to build**: Header navigation updates, Session Exit & Confirmation Dialog, Mahjong/Monopoly/Avalon session cleanup & routing on exit, waiting room leave button.
- **Success criteria**: All affected unit tests pass, tsc passes, lint passes with 0 errors/0 warnings, handoff.md written.
- **Interface contracts**: SCOPE.md and implementation_plan.md Section 1.
- **Code layout**: src/app/

## Key Decisions Made
- Added `ExitDestination = 'hub' | 'gameLobby'` signal and `hasStartedMatch` / `hasActiveWaitingRoom` computeds to `GameSessionManagerService`.
- Contextual header navigation: `.hub-btn` renamed to "All Games" / "游戏大厅" (goes immediately to `/` if idle or waiting room; opens modal if started match).
- `.leave-btn` shows whenever `activeRoomCode()` or `hasActiveProgress()`: labeled "Leave Room" / "退出房间" in waiting rooms (leaves immediately to game lobby); labeled "Exit Match" / "退出对局" in started matches (opens modal).
- `ExitConfirmDialogComponent`: contextual header title (`EXIT_MODAL.TITLE` vs match title) and bottom-only actions (Stay in Game, Back to Game Lobby, All Games Hub, Save & Return to Hub when savable).
- `MahjongSessionService`: added `p2p:leave` listener with `isTerminating` re-entrancy protection, tearing down session and routing to `/lobby` if currently on `/table`.
- `LobbyComponent`: added Leave Room button in waiting-room `.cta-row` next to Start Match / Wait for Host.
- `MonopolySessionService` & `AvalonSessionService`: on `p2p:leave`, route away from `/board` or `/table` to `/lobby` so screen never goes blank.

## Artifact Index
- DISPATCH.md — assignment from orchestrator
- BRIEFING.md — persistent state memory
- progress.md — liveness heartbeat
- handoff.md — final handoff report

## Change Tracker
- **Files modified**:
  - `src/app/core/services/game-session-manager.service.ts`: added exit destination, matching state computeds, and route resolution.
  - `src/app/core/services/game-session-manager.service.spec.ts`: updated waiting room vs match lifecycle and added suite 4 p2p:leave recovery.
  - `src/app/layout/header/app-header.component.ts`: added onLeaveClick invoking requestLeaveCurrentGame.
  - `src/app/layout/header/app-header.component.html`: 2x2 grid hub icon, All Games label, contextual leave button.
  - `src/app/layout/header/app-header.component.spec.ts`: verified All Games / 游戏大厅 labels and contextual leave match modal.
  - `src/app/shared/exit-confirm-dialog/exit-confirm-dialog.component.ts`: added exitToGameLobby.
  - `src/app/shared/exit-confirm-dialog/exit-confirm-dialog.component.html`: bottom-only actions with Back to Game Lobby and contextual title.
  - `src/app/shared/exit-confirm-dialog/exit-confirm-dialog.component.spec.ts`: verified 3 and 4 button states, backdrop dismiss, and lobby exit.
  - `src/app/core/services/mahjong-session.service.ts`: added p2p:leave handler with re-entrancy protection.
  - `src/app/pages/lobby/lobby.component.html`: added Leave Room button to waiting room cta-row.
  - `src/app/games/monopoly/services/monopoly-session.service.ts`: added navigation to /monopoly/lobby on p2p:leave.
  - `src/app/games/avalon/services/avalon-session.service.ts`: added navigation to /avalon/lobby on p2p:leave.
  - `src/app/core/services/shell-ui.service.spec.ts`: verified all 13 tests pass.

## Quality Status
- **Build/test result**: All 30 unit tests across affected suites PASS (exit-confirm: 4/4, header: 6/6, session-manager: 7/7, shell-ui: 13/13).
- **Type check status**: `tsc --noEmit` PASS (0 errors).
- **Lint status**: `eslint src` PASS (0 errors, 0 warnings).
- **Docs gate**: `qa:agent-docs` PASS.

## Loaded Skills
- None
