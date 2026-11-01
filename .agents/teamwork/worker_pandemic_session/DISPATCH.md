## 2026-11-01T04:08:50Z

You are the Milestone 4 Worker for the Tabletop Royale (hk-mahjong) project, implementing Pandemic AI Bot, Session Service, and P2P Transport.

Your Working Directory: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\worker_pandemic_session
Your Identity: worker_pandemic_session

MANDATORY SPECIFICATION SOURCES:
- Read ORIGINAL_REQUEST.md: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
- Read SCOPE.md: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\orchestrator_1\SCOPE.md
- Read Approved Implementation Plan: C:\Users\chine\.gemini\antigravity\brain\effe94dd-f539-4d36-8797-edcb695c4bde\implementation_plan.md (Section 3: Cooperative Pandemic Game Module - Bot, Session, P2P & Transport)
- Read required canonical references:
  - docs/reference/architecture.md
  - docs/reference/security-and-p2p.md
  - docs/reference/testing-and-quality.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP (You may only modify/create these files):
- src/app/games/pandemic/services/pandemic-bot.service.ts
- src/app/games/pandemic/services/pandemic-bot.service.spec.ts
- src/app/games/pandemic/services/pandemic-session.service.ts
- src/app/games/pandemic/services/pandemic-session.service.spec.ts
- src/app/games/pandemic/services/pandemic-engine.service.ts (only if minor coordination tweak is required)
- src/app/games/pandemic/services/pandemic-engine.service.spec.ts (ensure 100% green)
- src/app/core/models/party.model.ts
- src/app/core/services/p2p-room.transport.ts
- src/app/core/services/p2p-room.transport.spec.ts

DETAILED REQUIREMENTS:
1. `party.model.ts` & `p2p-room.transport.ts`:
   - Extend `GameId = 'mahjong' | 'monopoly' | 'avalon' | 'pandemic'`
   - Extend `GamePrefix = 'M' | 'P' | 'A' | 'D'`
   - Update `PREFIX_TO_GAME_MAP` (`'D'` -> `'pandemic'`), `GAME_TO_PREFIX_MAP` (`'pandemic'` -> `'D'`), and `parseUniversalRoomCode()` to route `D*` codes and `?game=pandemic`.
   - Update unit tests in `p2p-room.transport.spec.ts`.
2. `pandemic-bot.service.ts`:
   - Cooperative Tactical AI (`chooseBotAction(view: PandemicPlayerView, botSeat: number): PandemicAction | null`).
   - Phase handling:
     - `discard`: discard least-needed color card not advancing a cure.
     - `forecast`: reorder 6 cards placing high-threat cities to the back so safe cities draw first.
     - `epidemic`: play `resilient_population` on 3-cube cards in `infectionDiscard` if held, then `resolveEpidemicIntensify`.
     - `infect`: play `one_quiet_night` if >= 2 cities have 3 cubes, then `resolveInfectStep`.
     - `actions`: BFS shortest-path planner prioritizing: (1) `discoverCure`, (2) treating 3-cube hotspots, (3) `shareKnowledge` to complete a cure set, (4) role specials (Contingency Planner reclaim, Operations Expert station flight), (5) moving toward 2-3 cube clusters and treating disease.
3. `pandemic-session.service.ts`:
   - Host & Guest session management (following Monopoly/Avalon session service design).
   - Support Solo with AI Bots.
   - Support **Solo Commander Mode** (`soloCommander: true`, where local Seat 0 commands all 2-4 human Specialist seats without P2P).
   - Support Online P2P (`D*` codes, mix of humans & bots).
   - Support Lobby Role Picker ('random' or specific `SpecialistRole` per seat).
   - Implement `canExportSave()`, `exportSaveData()`, `restoreSaveData()`.
   - Listen to `p2p:leave` events, terminate session, and navigate cleanly to `/pandemic/lobby` if on `/pandemic/board`.
4. Comprehensive Specs:
   - `pandemic-bot.service.spec.ts`
   - `pandemic-session.service.spec.ts`
   - `p2p-room.transport.spec.ts`
   - Check `pandemic-engine.service.spec.ts` and ensure any failing assertion is fixed so all 76+ tests pass.
   - Line coverage >= 80%, branch coverage >= 70%.
   - 0 `any`, 0 `eslint-disable`, 0 `TestBed.overrideComponent`, 0 trivial assertions.

COMPLETION CRITERIA:
- All affected unit tests pass:
  `npx.cmd ng test --watch=false --no-coverage --include=src/app/games/pandemic/services/*.spec.ts --include=src/app/core/services/p2p-room.transport.spec.ts`
- `npx.cmd tsc --noEmit` succeeds with 0 errors.
- `npm.cmd run lint` succeeds with 0 errors and 0 warnings.
- Write handoff report in `c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\worker_pandemic_session\handoff.md`.
- Send message back to orchestrator when complete.
