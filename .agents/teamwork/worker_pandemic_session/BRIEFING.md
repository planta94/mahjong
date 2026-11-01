# BRIEFING — 2026-11-01T04:26:30Z

## Mission
Implement Pandemic AI Bot (`pandemic-bot.service.ts`), Session Service (`pandemic-session.service.ts`), P2P Transport extension (`party.model.ts`, `p2p-room.transport.ts`), and their comprehensive unit tests with full compliance to Tabletop Royale rules.

## 🔒 My Identity
- Archetype: implementer / qa / specialist
- Roles: [implementer, qa, specialist]
- Working directory: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\worker_pandemic_session
- Original parent: e6208b09-06b6-4b27-8fa3-e5ee3c6b6cc0
- Milestone: Milestone 4 - Cooperative Pandemic Game Module - Bot, Session, P2P & Transport

## 🔒 Key Constraints
- Exclusive write ownership:
  - src/app/games/pandemic/services/pandemic-bot.service.ts
  - src/app/games/pandemic/services/pandemic-bot.service.spec.ts
  - src/app/games/pandemic/services/pandemic-session.service.ts
  - src/app/games/pandemic/services/pandemic-session.service.spec.ts
  - src/app/games/pandemic/services/pandemic-engine.service.ts (only if minor coordination tweak is required)
  - src/app/games/pandemic/services/pandemic-engine.service.spec.ts (ensure 100% green)
  - src/app/core/models/party.model.ts
  - src/app/core/services/p2p-room.transport.ts
  - src/app/core/services/p2p-room.transport.spec.ts
- NO CHEATING: all implementations genuine, maintain real state, produce real behavior, zero hardcoded test outputs.
- No `*.sh` scripts (prohibited to view, edit, or run).
- Zero `any`, zero `eslint-disable`, zero `TestBed.overrideComponent`, zero trivial assertions (`.toBeTruthy()`, `.toBeDefined()`, `.not.toBeNull()`).
- All affected unit tests must pass; `tsc --noEmit` clean; `lint` clean.

## Current Parent
- Conversation ID: e6208b09-06b6-4b27-8fa3-e5ee3c6b6cc0
- Updated: 2026-11-01T04:26:30Z

## Task Summary
- **What to build**:
  - Extended `party.model.ts` and `p2p-room.transport.ts` for GameId `'pandemic'` and Prefix `'D'`, `?game=pandemic`.
  - Implemented `PandemicBotService` with cooperative tactical AI (discard, forecast, epidemic, infect, BFS shortest path actions).
  - Implemented `PandemicSessionService` with Host/Guest management, Solo Bots, Solo Commander Mode, P2P networking, save/restore.
  - Comprehensive unit test suites (>80% lines, >70% branches) for bot, session, and transport updates. Fixed flakiness in engine specs (148 tests pass).
- **Success criteria**:
  - `npx.cmd ng test --watch=false --no-coverage --include=src/app/games/pandemic/services/*.spec.ts --include=src/app/core/services/p2p-room.transport.spec.ts` passes (148/148 passed).
  - `npx.cmd tsc --noEmit` passes with 0 errors.
  - `eslint` passes on all owned files with 0 errors and 0 warnings.
- **Interface contracts**:
  - docs/reference/architecture.md
  - docs/reference/security-and-p2p.md
  - docs/reference/testing-and-quality.md

## Key Decisions Made
- `party.model.ts`: Extended `GameId`, `ShellGameId`, `GamePrefix`, and maps with `'pandemic'` and `'D'`.
- `p2p-room.transport.ts`: Added `'pandemic'` to `parseUniversalRoomCode` query param matcher and updated prefix mapping.
- `pandemic-bot.service.ts`: Implemented cooperative tactical decision engine with in-city prioritized actions (discoverCure, treat 3-cube, shareKnowledge, role specials) and multi-hop BFS pathfinding exploring drive/ferry, shuttle flight, direct flight, and operations expert flight.
- `pandemic-session.service.ts`: Implemented full host/guest lifecycle with Solo bots, Solo Commander mode (local Seat 0 controls all human seats without bot automation), P2P `D*` transport, save/restore serialization of Maps to entries, and `p2p:leave` routing to `/pandemic/lobby`.

## Artifact Index
- DISPATCH.md — Task assignment from orchestrator
- BRIEFING.md — Situational awareness and state
- progress.md — Progress tracker and liveness heartbeat
- handoff.md — 5-component handoff report

## Change Tracker
- **Files modified**:
  - `src/app/core/models/party.model.ts`: Extended GameId, ShellGameId, GamePrefix, PREFIX_TO_GAME_MAP, GAME_TO_PREFIX_MAP.
  - `src/app/core/services/p2p-room.transport.ts`: Added 'pandemic' query parsing and D prefix resolution.
  - `src/app/core/services/p2p-room.transport.spec.ts`: Added tests for D prefix and ?game=pandemic URL parsing.
  - `src/app/games/pandemic/services/pandemic-bot.service.ts`: Tactical BFS bot AI service.
  - `src/app/games/pandemic/services/pandemic-bot.service.spec.ts`: 31 tests covering all bot phases & BFS paths.
  - `src/app/games/pandemic/services/pandemic-session.service.ts`: Host/Guest session service with Solo Commander.
  - `src/app/games/pandemic/services/pandemic-session.service.spec.ts`: 17 tests covering lifecycle, save/restore, bots.
  - `src/app/games/pandemic/services/pandemic-engine.service.ts`: Allowed getLegalActions to take PandemicPlayerView.
  - `src/app/games/pandemic/services/pandemic-engine.service.spec.ts`: Resolved non-deterministic test setups (all 76 tests pass).
- **Build status**: Pass (`tsc --noEmit` clean, 148 tests pass)
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pass (148 passed across 4 test suites)
- **Coverage**:
  - `party.model.ts`: 100% lines / 100% branches
  - `p2p-room.transport.ts`: 97.62% lines / 77.52% branches
  - `pandemic-bot.service.ts`: 89.23% lines / 74.47% branches
  - `pandemic-session.service.ts`: 95.25% lines / 72.41% branches
  - `pandemic-engine.service.ts`: 96.32% lines / 84.78% branches
- **Lint status**: 0 errors, 0 warnings on all owned files
- **Tests added/modified**: 48 new tests (31 bot + 17 session) + 2 transport tests + 76 engine tests verified

## Loaded Skills
- None
