## 2026-11-01T04:27:00Z
You are the Milestone 5 Worker for the Tabletop Royale (hk-mahjong) project, implementing the Pandemic Lobby and Board UI components with interactive SVG World Map.

Your Working Directory: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\worker_pandemic_ui
Your Identity: worker_pandemic_ui

MANDATORY SPECIFICATION SOURCES:
- Read ORIGINAL_REQUEST.md: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
- Read SCOPE.md: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\orchestrator_1\SCOPE.md
- Read Approved Implementation Plan: C:\Users\chine\.gemini\antigravity\brain\effe94dd-f539-4d36-8797-edcb695c4bde\implementation_plan.md (Section 3: Cooperative Pandemic Game Module - UI Components)
- Read required canonical references:
  - docs/reference/architecture.md
  - docs/reference/ui-conventions.md
  - docs/reference/testing-and-quality.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP (You may only modify/create these files):
- src/app/games/pandemic/components/pandemic-lobby/pandemic-lobby.component.ts
- src/app/games/pandemic/components/pandemic-lobby/pandemic-lobby.component.html
- src/app/games/pandemic/components/pandemic-lobby/pandemic-lobby.component.scss
- src/app/games/pandemic/components/pandemic-lobby/pandemic-lobby.component.spec.ts
- src/app/games/pandemic/components/pandemic-board/pandemic-board.component.ts
- src/app/games/pandemic/components/pandemic-board/pandemic-board.component.html
- src/app/games/pandemic/components/pandemic-board/pandemic-board.component.scss
- src/app/games/pandemic/components/pandemic-board/pandemic-board.component.spec.ts

DETAILED UI & COMPONENT REQUIREMENTS:
1. `PandemicLobbyComponent`:
   - Support Solo with AI Bots, Solo Commander mode (`soloCommander: true`, 1 player controls 2–4 Specialist seats locally), Create Online Room (`D*`), Join Room by code.
   - Difficulty selector (`4 / 5 / 6` Epidemics).
   - Per-seat Role Picker (`Random` or specific role: Medic, Scientist, Researcher, Dispatcher, Operations Expert, Quarantine Specialist, Contingency Planner).
   - Waiting room with `Leave Room` (`HEADER.LEAVE_ROOM`) footer button.
2. `PandemicBoardComponent`:
   - CDC Bio-Command Theme Tabletop:
     - HUD: 4 Cure/Eradicated status vials, Outbreak meter (0/8), Infection Rate track (2,2,2,3,3,4,4), Cube supply counters (24 each), Player/Infection deck counts, and Turn Phase Stepper (Actions -> Epidemic Alert -> Discard -> Infect).
     - Interactive SVG World Map (viewBox 1000x520):
       - Continent vectors, 48 cities positioned at normalized coordinates, route lines, Pacific wraparound arcs (`san_francisco ↔ tokyo`, `san_francisco ↔ manila`, `los_angeles ↔ sydney`).
       - Research Station icons, color-coded disease cube indicators, Specialist pawn badges.
       - Region Filter / Zoom pills: All / Blue / Yellow / Black / Red.
       - Click-a-city to open Action Drawer showing legal actions (Drive/Ferry, Direct Flight, Charter Flight, Shuttle Flight, Treat Disease, Build Station, Share Knowledge, Discover Cure, Role Specials).
     - Team Specialist Hands & Anytime Event Dock:
       - Open co-op hands display and anytime event triggers.
     - Bounded Modals (Bottom Actions Only, NO top-right X close button):
       - `max-width: 95vw; max-height: 90vh;` with middle scroll container `max-height: 55vh`.
       - Forecast modal, Hand-limit Discard modal, Resilient Population modal, Victory/Defeat modal.
     - Responsive Views:
       - `.desktop-table` on `> 768px` and `.mobile-cards` on `<= 768px`.
       - Scoped SCSS < 32 kB, shallow (1-2 levels), honor `prefers-reduced-motion: reduce`.
3. Quality & Tests:
   - 0 `any`, 0 `eslint-disable`.
   - 0 `TestBed.overrideComponent(...)`.
   - 0 trivial assertions (.toBeTruthy, .toBeDefined, .not.toBeNull).
   - Comprehensive component unit specs in `pandemic-lobby.component.spec.ts` and `pandemic-board.component.spec.ts`.
   - Line coverage >= 80%, branch coverage >= 70%.

COMPLETION CRITERIA:
- `npx.cmd ng test --watch=false --no-coverage --include=src/app/games/pandemic/components/**/*.spec.ts` passes with 100% green.
- `npx.cmd tsc --noEmit` succeeds with 0 errors.
- `npm.cmd run lint` succeeds with 0 errors and 0 warnings.
- Write handoff report in `c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\worker_pandemic_ui\handoff.md`.
- Send message back to orchestrator when complete.
