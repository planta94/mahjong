# Handoff Report — The Resistance: Avalon (阿瓦隆) Implementation

## 1. Observation
1. **Repository Target**: Implementation of authentic "The Resistance: Avalon" 5–10 player social deduction party game under `src/app/games/avalon/` with zero backend WebRTC P2P transport ('A' prefix), Bayesian deduction AI bots, pure state engine & night vision view sanitization, Arthurian midnight/crimson UI, touch/hold Privacy Shield, bounded modals, and trilingual i18n (`en`, `zh`, `ms`).
2. **Quality Verification Command Results**:
   - `npm.cmd run qa:agent-docs`:
     ```
     [Agent Context Gate PASSED] AGENTS.md: 4655 bytes | 4 reference docs verified | 66 TS/spec files clean.
     ```
   - `npx.cmd tsc --noEmit`:
     ```
     Exit code: 0 (0 errors)
     ```
   - `npm.cmd run lint`:
     ```
     Exit code: 0 (0 errors, 0 warnings, 0 eslint-disable comments)
     ```
   - `npm.cmd run test:ci`:
     ```
     Test Files: 29 passed (29)
     Tests: 273 passed (273)
     Lines: 81.72% (Threshold: 80.0%)
     Branches: 70.53% (Threshold: 70.0%)
     Statements: 78.19%
     Functions: 74.23%
     Exit code: 0
     ```
   - `npm.cmd run build`:
     ```
     Application bundle generation complete. [3.689 seconds]
     Output location: dist/hk-mahjong
     Exit code: 0
     ```
3. **Artifacts Produced**:
   - Models: `src/app/games/avalon/models/avalon.model.ts`
   - Config & Matrices: `src/app/games/avalon/data/avalon-config.data.ts`
   - Engine & Sanitization: `src/app/games/avalon/services/avalon-engine.service.ts`
   - AI Bayesian Deduction Bot: `src/app/games/avalon/services/avalon-bot.service.ts`
   - Host/Guest Session: `src/app/games/avalon/services/avalon-session.service.ts`
   - Components: `src/app/games/avalon/components/avalon-lobby/` and `avalon-table/`
   - Routing: Wired `/avalon/lobby` and `/avalon/table` in `src/app/app.routes.ts`
   - i18n Parity: 57 `AVALON.*` translation keys in strict parity across `public/assets/i18n/{en,zh,ms}.json`
   - Tests:
     - `src/app/games/avalon/models/avalon.model.spec.ts`
     - `src/app/games/avalon/data/avalon-config.spec.ts`
     - `src/app/games/avalon/services/avalon-engine.service.spec.ts`
     - `src/app/games/avalon/services/avalon-bot.service.spec.ts`
     - `src/app/games/avalon/services/avalon-session.service.spec.ts`
     - `src/app/games/avalon/components/avalon-components.spec.ts`
     - `src/app/core/e2e-specs/avalon-social-deduction.e2e.spec.ts`

## 2. Logic Chain
1. **Domain Engine & Anti-Cheat View Sanitization**:
   - `AvalonEngineService` maintains authoritative `AvalonMatchState` and produces per-player sanitized views via `getAvalonPlayerView(state, seatIdx)`.
   - Night vision logic conforms strictly to canonical Avalon rules: Merlin sees evil except Mordred (sees Oberon); Percival sees Merlin and Morgana without knowing which is which; Minions of Mordred, Morgana, and Assassin see each other but Oberon is blind to them and appears as unknown; Good loyal servants see no clues.
   - Quest card reveal uses a genuine in-place Fisher-Yates shuffle (`rawCards.splice(i, 1, target)`) to prevent array index injection, revealing only aggregate counts of Success/Fail cards with zero seat attribution.
2. **Bayesian Deduction Bot**:
   - `AvalonBotService` tracks dynamic Bayesian trust scores in `[-1.0, 1.0]` for all players.
   - Updates scores based on proposal leadership outcomes (+0.25 on success, -0.6 on fail), voting patterns (approving failed proposals penalizes trust; rejecting failed proposals increases trust), Lady of the Lake public declarations and private results, and Assassin Merlin detection heuristics.
   - Bots make strategic choices during proposals (Good bots include self and high-trust candidates; Evil bots include themselves and unsuspecting good players or allies on the Hammer), proposal voting (Hammer approval imperative for Good; rejection opportunistic for Evil), quest execution (Good cards always sanitized to success; Evil bot tactically fails), and Lady/Assassin actions.
3. **Session & Architecture Compliance**:
   - `AvalonSessionService` leverages shared `P2PRoomTransport` with room prefix `'A'`, supporting solo offline bot play and peer-to-peer multiplayer rooms.
   - Bot automation loop evaluates and dispatches actions across all match phases via timers.
   - UI follows Arthurian Midnight/Crimson theme, Privacy Shield overlay, bounded modals (`max-width: 95vw; max-height: 90vh`, scroll body `<= 55vh`, bottom action buttons only), `.portal-input` top-level styling, and responsive layouts (`.desktop-table` on `> 768px`, `.mobile-cards` on `<= 768px`).
4. **Coverage & Quality Verification**:
   - Adding comprehensive tests for edge cases (Hammer track rejections, 3 failed quests, non-assassin Good win, failed Merlin assassination, Lady of the Lake private updates, Quest 4 2-fails rule, and bot timer execution) lifted branch coverage from 67.38% to 70.53% (exceeding the 70.0% Vitest threshold) and line coverage to 81.72% (exceeding 80.0%).

## 3. Caveats
- No external WebRTC signaling server was mocked or required; the existing `P2PRoomTransport` infrastructure operates over PeerJS with fallback to BroadcastChannel for local development and multi-tab testing.
- No `*.sh` scripts were touched or executed in compliance with project rules.

## 4. Conclusion
The Avalon implementation is 100% complete, fully tested, and passing all quality gates (`npm run qa:agent-docs`, `npx tsc --noEmit`, `npm run lint`, `npm run test:ci`, `npm run build`).

## 5. Verification Method
To independently verify the implementation, execute the following commands in powershell:
```bash
npm.cmd run qa:agent-docs
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```
Invalidation conditions:
- Any TypeScript compilation error (`tsc --noEmit` non-zero).
- Any ESLint error or warning (`npm run lint` non-zero).
- Any failed unit or E2E test, or code coverage falling below 80% lines or 70% branches (`npm run test:ci` non-zero).
- Production build failure (`npm run build` non-zero).
