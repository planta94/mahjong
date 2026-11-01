# Milestone 3 Handoff Report: Pandemic Models, Data & Core Engine

## 1. Observation

- **Exclusive Write Ownership Files**:
  1. `src/app/games/pandemic/models/pandemic.model.ts`:
     - Contains strict domain types: `DiseaseColor`, `CureStatus`, `SpecialistRole` (all 7), `EventCardId` (all 5), `DifficultyLevel`, `PandemicPhase` (`'actions' | 'epidemic' | 'forecast' | 'discard' | 'infect' | 'game_over'`), `PlayerCard`, `InfectionCard`, `CityCubes`, `PandemicPlayerState`, `PandemicAction`, `PandemicMatchState`, `PandemicPlayerView`, `createSerializableMap`, `coerceToMap`, and `hydratePandemicPlayerView`.
  2. `src/app/games/pandemic/data/pandemic-cities.data.ts`:
     - Contains authentic 48 cities (12 blue, 12 yellow, 12 black, 12 red) with normalized SVG coordinates in `1000 × 520` viewBox.
     - `PACIFIC_WRAPAROUND_ROUTES`: `san_francisco ↔ tokyo`, `san_francisco ↔ manila`, `los_angeles ↔ sydney`.
     - `CITY_ADJACENCY_MAP` is 100% bidirectional and symmetrical across all 48 cities.
  3. `src/app/games/pandemic/data/pandemic-roles-events.data.ts`:
     - Contains metadata specifications for all 7 specialist roles (`ROLE_SPEC_MAP`) and all 5 anytime events (`EVENT_SPEC_MAP`).
  4. `src/app/games/pandemic/services/pandemic-engine.service.ts`:
     - Deterministic rules engine with injectable `rng?: () => number`.
     - Initial setup: Atlanta station + all pawns at Atlanta, 3x3, 3x2, 3x1 initial infections (18 cubes), stratified 4/5/6 epidemic card deck.
     - 8 core movement and station actions (Drive/Ferry, Direct Flight, Charter Flight, Shuttle Flight, Build Station with 6 station cap & relocation, Treat Disease with eradication auto-transition, Share Knowledge, Discover Cure).
     - Role specials & passives:
       - Medic: treats all cubes in 1 action even if uncured; auto-cleans cured cubes upon entering city or upon cure discovery; prevents placement of cured cubes.
       - Quarantine Specialist: blocks cube placement and outbreaks in current city and all adjacent cities.
       - Dispatcher: moves other pawns as own action; moves any pawn to another pawn's city.
       - Operations Expert: builds station without card; once per turn discards any city card while at station to fly anywhere.
       - Contingency Planner: reclaims event card from playerDiscard onto storedEventCard; exiles card when played.
       - Scientist: discovers cure with 4 matching cards.
       - Researcher: can give any city card in hand to someone in the same city.
     - 5 Anytime Event Cards: Airlift, Government Grant, One Quiet Night, Forecast, Resilient Population.
     - Turn Stepper:
       - 4 actions (or endActionsEarly) -> draws 2 player cards (defeat DECK_EXHAUSTED if < 2).
       - Epidemic card drawn: +1 infection rate, bottom card drawn + 3 cubes placed, pauses in phase='epidemic' for event reaction window, resolveEpidemicIntensify shuffles infectionDiscard onto top of infectionDeck.
       - Hand limit >7: pauses in phase='discard', discardCard discards down.
       - Infect step: if oneQuietNightActive skips; else draws infectionRate cards, chain-reaction outbreaks with per-step outbrokenSet (prevents city outbreaking twice in same chain). Defeat at 8 outbreaks or out of cubes.
       - Immediate victory when all 4 cures are discovered.
     - Anti-cheat view sanitizer: `getPandemicPlayerView` strips `playerDeck` and `infectionDeck`, exposes `playerDeckCount` and `infectionDeckCount`, exposes `forecastCards` only during 'forecast', exposes `pendingEpidemicCityId` only during 'epidemic'.
  5. `src/app/games/pandemic/services/pandemic-engine.service.spec.ts`:
     - 76 comprehensive tests covering graph symmetry, Pacific wraparounds, setup, all 8 actions, all 7 roles, all 5 events, stepper, epidemics, outbreaks, eradication, win/loss, view sanitization, and legal actions.

- **Verification Output**:
  - `npx.cmd ng test --watch=false --include=src/app/games/pandemic/services/pandemic-engine.service.spec.ts`:
    ```
    ✓  hk-mahjong  src/app/games/pandemic/services/pandemic-engine.service.spec.ts (76 tests) 113ms
    Test Files  1 passed (1)
    Tests  76 passed (76)
    Coverage:
    All files: 95.41% Stmts | 84.48% Branch | 96.62% Funcs | 96.54% Lines
    data/pandemic-cities.data.ts: 100% Lines | 100% Branch
    data/pandemic-roles-events.data.ts: 100% Lines | 100% Branch
    models/pandemic.model.ts: 100% Lines | 100% Branch
    services/pandemic-engine.service.ts: 96.32% Lines | 83.99% Branch
    ```
  - `npx.cmd tsc --noEmit`: 0 errors.
  - `npm.cmd run lint`: 0 errors, 0 warnings under ESLint 10+ and eslint-plugin-security.
  - Script restriction: 0 `*.sh` scripts inspected, edited, or executed.
  - Anti-patterns: 0 `any`, 0 `eslint-disable`, 0 `TestBed.overrideComponent`, 0 trivial assertions (`.toBeTruthy`, `.toBeDefined`, `.not.toBeNull`).

## 2. Logic Chain

1. Starting from the dispatch requirements and implementation plan for Milestone 3, models were created with strict TypeScript types, discriminated union actions, and serializable records.
2. The 48-city world graph was defined with exact coordinates and symmetrical edges, including all 3 Pacific wraparounds (`san_francisco ↔ tokyo`, `san_francisco ↔ manila`, `los_angeles ↔ sydney`).
3. The deterministic rules engine was built to handle all movements, station limits, treatment/eradication, role passives/specials, anytime events, and the multi-phase turn stepper.
4. To satisfy `eslint-plugin-security` without `eslint-disable`, array element swapping used `.splice` and functional mapping rather than index assignment, and color cube access used type-safe static property access.
5. Comprehensive unit tests were written covering both happy paths and edge cases (e.g. outbrokenSet cycle prevention, multiple epidemics, hand limit discard queue, eradication auto-transition, view deck stripping).
6. Execution of Angular unit tests with V8 coverage confirmed all 76 tests pass with 96.54% line coverage (well above >= 80% threshold) and 84.48% branch coverage (well above >= 70% threshold).
7. `npx.cmd tsc --noEmit` and `npm.cmd run lint` both passed with 0 errors and 0 warnings.

## 3. Caveats

- Milestone 3 covers core models, data, and the deterministic engine service with unit specs.
- Milestone 4 (`worker_m4`) will implement `PandemicBotService`, `PandemicSessionService`, `party.model.ts` room codes, and WebRTC transport.
- Milestone 5 (`worker_m5`) will implement `PandemicLobbyComponent`, `PandemicBoardComponent`, SVG map rendering, and UI modals.

## 4. Conclusion

Milestone 3 is complete, fully verified, and ready for downstream integration by Milestone 4 and Milestone 5 workers.

## 5. Verification Method

To independently verify the implementation:
```powershell
npx.cmd ng test --watch=false --include=src/app/games/pandemic/services/pandemic-engine.service.spec.ts
npx.cmd tsc --noEmit
npm.cmd run lint
```
Inspect files:
- `src/app/games/pandemic/models/pandemic.model.ts`
- `src/app/games/pandemic/data/pandemic-cities.data.ts`
- `src/app/games/pandemic/data/pandemic-roles-events.data.ts`
- `src/app/games/pandemic/services/pandemic-engine.service.ts`
- `src/app/games/pandemic/services/pandemic-engine.service.spec.ts`
