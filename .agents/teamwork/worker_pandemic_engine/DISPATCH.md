## 2026-11-01T03:47:34Z
You are the Milestone 3 Worker for the Tabletop Royale (hk-mahjong) project, implementing the core Pandemic game engine, data, and models.

Your Working Directory: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\worker_pandemic_engine
Your Identity: worker_pandemic_engine

MANDATORY SPECIFICATION SOURCES:
- Read ORIGINAL_REQUEST.md: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
- Read SCOPE.md: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\orchestrator_1\SCOPE.md
- Read Approved Implementation Plan: C:\Users\chine\.gemini\antigravity\brain\effe94dd-f539-4d36-8797-edcb695c4bde\implementation_plan.md (Section 3: Cooperative "Pandemic" Game Module)
- Read required canonical references:
  - docs/reference/architecture.md
  - docs/reference/security-and-p2p.md
  - docs/reference/testing-and-quality.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP (You may only modify/create these files):
- src/app/games/pandemic/models/pandemic.model.ts
- src/app/games/pandemic/data/pandemic-cities.data.ts
- src/app/games/pandemic/data/pandemic-roles-events.data.ts
- src/app/games/pandemic/services/pandemic-engine.service.ts
- src/app/games/pandemic/services/pandemic-engine.service.spec.ts

NON-NEGOTIABLE REQUIREMENTS:
1. NEVER read, inspect, create, edit, overwrite, rename, delete, or execute ANY *.sh script.
2. Models (pandemic.model.ts):
   - Strict TypeScript types, 0 `any`, `Map`-friendly serializable records.
   - DiseaseColor: 'blue' | 'yellow' | 'black' | 'red'
   - CureStatus: 'uncured' | 'cured' | 'eradicated'
   - SpecialistRole: all 7 roles (medic, scientist, researcher, dispatcher, operations_expert, quarantine_specialist, contingency_planner)
   - EventCardId: all 5 events (airlift, government_grant, one_quiet_night, forecast, resilient_population)
   - DifficultyLevel: 'introductory' | 'standard' | 'heroic' (4 / 5 / 6 Epidemics)
   - PandemicPhase: 'actions' | 'epidemic' | 'forecast' | 'discard' | 'infect' | 'game_over'
   - Complete PandemicAction discriminated union and PandemicMatchState vs PandemicPlayerView.
3. City & Role/Event Data:
   - 48 authentic cities (12 blue, 12 yellow, 12 black, 12 red) with normalized SVG (x, y) coords (1000x520 viewBox).
   - Bidirectional symmetrical CITY_ADJACENCY_MAP.
   - Pacific wraparound routes (san_francisco ↔ tokyo, san_francisco ↔ manila, los_angeles ↔ sydney).
   - ROLE_SPEC_MAP (7 roles) and EVENT_SPEC_MAP (5 events).
4. Core Engine (pandemic-engine.service.ts):
   - Injectable `rng: () => number` for deterministic unit testing.
   - Complete initial setup (Atlanta station + pawns, 3x3, 3x2, 3x1 initial infection = 18 cubes, stratified 4/5/6 Epidemic deck).
   - All 8 standard actions: Drive/Ferry, Direct Flight, Charter Flight, Shuttle Flight, Build Station (6 station cap with relocateFromCityId), Treat Disease (1 cube, or all cubes if cured or medic; auto-transition to eradicated if cured + 0 cubes on board), Share Knowledge (exact match or researcher flexibility), Discover Cure (5 cards at station, or 4 for scientist).
   - Role passives & specials:
     - Medic: auto-cleans cured disease cubes upon entering a city or upon cure discovery.
     - Quarantine Specialist: prevents cube placement and outbreaks in current city and all adjacent cities.
     - Dispatcher: moves other pawns as own action, moves any pawn to another pawn's city.
     - Operations Expert: builds station without discarding card; once per turn moves from station to any city by discarding any city card.
     - Contingency Planner: reclaims Event card from playerDiscard onto storedEventCard (exiled when played).
   - All 5 Event cards playable anytime: Airlift, Government Grant, One Quiet Night, Forecast (reorders top 6 infection cards), Resilient Population (removes 1 card from infectionDiscard from the game).
   - Explicit Turn Stepper:
     - 4 Actions -> Draw 2 Player Cards (defeat if playerDeck < 2).
     - Epidemic drawn: +1 infection rate, bottom card drawn + 3 cubes placed (may outbreak unless quarantined/eradicated), placed into infectionDiscard, pause in phase='epidemic' for event reaction window before resolveEpidemicIntensify shuffles infectionDiscard onto top of infectionDeck.
     - Hand limit 7 cards: phase='discard' if any hand > 7.
     - Infect step: if oneQuietNightActive skip; else draw infectionRate cards, chain-reaction outbreaks with per-step outbrokenSet (no city outbreaks twice in same chain). Defeat at 8 outbreaks or cube exhaustion.
     - Immediate victory when all 4 cures are discovered.
   - Anti-cheat view sanitizer getPandemicPlayerView: strips playerDeck and infectionDeck, exposes forecastCards only during 'forecast', exposes pendingEpidemicCityId during 'epidemic'.
5. Quality & Test Standards:
   - 0 `any`, 0 `eslint-disable`.
   - Comprehensive Vitest specs in `pandemic-engine.service.spec.ts`.
   - 0 trivial assertions (.toBeTruthy(), .toBeDefined(), .not.toBeNull()).
   - 0 TestBed.overrideComponent(...).
   - Line coverage >= 80%, branch coverage >= 70%.

COMPLETION CRITERIA:
- `npx.cmd vitest run src/app/games/pandemic/services/pandemic-engine.service.spec.ts` passes with 100% green.
- `npx.cmd tsc --noEmit` succeeds with 0 errors.
- `npm.cmd run lint` succeeds with 0 errors and 0 warnings.
- Write handoff.md in c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\worker_pandemic_engine\handoff.md with full results and verification commands.
- Send message back to orchestrator when complete.
