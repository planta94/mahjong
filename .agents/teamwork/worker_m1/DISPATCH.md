## 2026-11-01T03:47:08Z

You are the Milestone 1 Worker for the Tabletop Royale (hk-mahjong) project.

Your Working Directory: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\worker_m1
Your Identity: worker_m1

MANDATORY SPECIFICATION SOURCES:
- Read ORIGINAL_REQUEST.md: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
- Read SCOPE.md: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\orchestrator_1\SCOPE.md
- Read Approved Implementation Plan: C:\Users\chine\.gemini\antigravity\brain\effe94dd-f539-4d36-8797-edcb695c4bde\implementation_plan.md (Section 1: Header Navigation, Session Exit & Confirmation Dialog)
- Read required canonical references:
  - docs/reference/architecture.md
  - docs/reference/ui-conventions.md
  - docs/reference/testing-and-quality.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP (You may only modify/create these files):
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

NON-NEGOTIABLE CONSTRAINTS:
1. NEVER read, inspect, create, edit, overwrite, rename, delete, or execute ANY *.sh script.
2. DO NOT touch Mahjong scoring logic or src/app/pages/table/ tabletop action buttons.
3. In AppHeaderComponent & ExitConfirmDialogComponent:
   - Rename .hub-btn to "All Games" / "游戏大厅" (always targets Pavilion Hub /; goes immediately if idle or in an unstarted waiting room, opens ExitConfirmDialogComponent if a match has started).
   - Show .leave-btn whenever shellUi.activeRoomCode() || gameManager.hasActiveProgress():
     - In an unstarted waiting room: labeled HEADER.LEAVE_ROOM ("Leave Room" / "退出房间") -> leaves immediately back to current game's /.../lobby without a modal.
     - In a started match (Solo OR Online): labeled HEADER.EXIT_MATCH ("Exit Match" / "退出对局") -> opens ExitConfirmDialogComponent.
   - In ExitConfirmDialogComponent: bottom-only buttons (Stay in Game, Back to Game Lobby, All Games Hub, Save & Return to Hub when canSaveCurrentProgress()).
4. In MahjongSessionService:
   - Listen for p2p:leave (when !detail?.game || detail.game === 'mahjong') to terminate session and navigate to /lobby if currently on /table (guarding against re-entrant event dispatch).
5. In LobbyComponent (src/app/pages/lobby/lobby.component.html):
   - Add a Leave Room button in the waiting-room .cta-row next to Start Match / Wait for Host (do NOT touch table.component.*).
6. In MonopolySessionService & AvalonSessionService:
   - On p2p:leave, after leaveRoom(), if router.url is on /monopoly/board or /avalon/table, navigate cleanly to /monopoly/lobby or /avalon/lobby so screen never goes blank.
7. Coding & Testing rules from AGENTS.md:
   - Angular 22 Signals, Standalone Components.
   - 0 any, 0 eslint-disable.
   - 0 TestBed.overrideComponent(...).
   - 0 trivial test assertions (.toBeTruthy(), .toBeDefined(), .not.toBeNull()).
   - Never pass a 3rd timeout arg to it(...).

COMPLETION CRITERIA:
- All affected unit tests updated and passing:
  `npx.cmd vitest run src/app/layout/header/app-header.component.spec.ts src/app/shared/exit-confirm-dialog/exit-confirm-dialog.component.spec.ts src/app/core/services/game-session-manager.service.spec.ts src/app/core/services/shell-ui.service.spec.ts`
- `npx.cmd tsc --noEmit` succeeds with 0 errors.
- `npm.cmd run lint` succeeds with 0 errors and 0 warnings.
- Write handoff.md in c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\worker_m1\handoff.md detailing:
  - Observation
  - Logic Chain
  - Caveats
  - Conclusion
  - Verification results (exact commands and output)
- Send message back to orchestrator when complete.
