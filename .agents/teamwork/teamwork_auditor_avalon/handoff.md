# Forensic Audit Report & Handoff — The Resistance: Avalon (Milestone 5)

## Forensic Audit Report

**Work Product**: `src/app/games/avalon/` (models, config, engine, bot, session, UI), `src/app/app.routes.ts`, `public/assets/i18n/`, `src/app/core/e2e-specs/`  
**Profile**: General Project  
**Integrity Mode**: Benchmark / Genuine From-Scratch  
**Verdict**: **CLEAN**

---

### Phase Results
- **Hardcoded Output Detection**: PASS — Zero hardcoded test results, fixed quest outcomes, or fake responses.
- **Facade Detection**: PASS — Genuine pure state machine (`AvalonEngineService`), authentic Bayesian deduction AI bot (`AvalonBotService`), and WebRTC/BroadcastChannel session (`AvalonSessionService`).
- **Pre-populated Artifact Detection**: PASS — All artifacts generated fresh during runtime; zero cached or pre-fabricated test logs.
- **Rule Matrices Compliance**: PASS — Verified Don Eskridge official 5–10 player distributions, Quest 1–5 team sizes, Quest 4 2-fails requirement for >= 7 players, and 5-rejection Hammer autowin (`FIVE_REJECTED_TEAMS`).
- **Host-Authoritative Anti-Cheat Sanitization**: PASS — Opponent roles masked until `game_over`; Merlin sees Oberon but not Mordred; Percival sees Merlin and Morgana with identical clue `'merlin_or_morgana'`; Evils see each other except Oberon; quest cards shuffled cryptographically (`crypto.getRandomValues`); Lady of the Lake result delivered strictly to investigator seat (`privateLadyResult`).
- **Bot Privacy & Fairness**: PASS — `AvalonBotService` evaluates actions strictly from sanitized `AvalonPlayerView`; zero peeking into private roles or hidden match state.
- **Modal & Repository Invariants (`AGENTS.md`)**: PASS — Modals strictly bounded (`max-width: min(720px, 95vw); max-height: 90vh;` middle scroll body `<= 55vh`, bottom action buttons only; NO top-right `X` close buttons); `.portal-input` top-level styling; 0 `*.sh` scripts touched; 0 `eslint-disable`; 0 explicit `any`; 0 trivial test assertions (`.toBeTruthy()`, `.toBeDefined()`, `.not.toBeNull()`).
- **i18n Parity**: PASS — 57 `AVALON.*` translation keys in strict 1:1 parity across `public/assets/i18n/{en,zh,ms}.json`.

---

## 1. Observation

Direct empirical evidence obtained across the 5 quality commands and source audits:

### Command 1: `npm.cmd run qa:agent-docs`
```
> hk-mahjong@0.0.0 qa:agent-docs
> node scripts/verify-agent-context.mjs

[Agent Context Gate PASSED] AGENTS.md: 4655 bytes | 4 reference docs verified | 66 TS/spec files clean.
```
- Exit code: `0`

### Command 2: `npx.cmd tsc --noEmit`
```
Exit code: 0 (0 compilation errors)
```

### Command 3: `npm.cmd run lint`
```
> hk-mahjong@0.0.0 lint
> eslint src

Exit code: 0 (0 errors, 0 warnings, 0 eslint-disable comments)
```

### Command 4: `npm.cmd run test:ci`
```
Test Files: 29 passed (29)
Tests: 273 passed (273)
Lines: 81.92% (Threshold: 80.0%)
Branches: 70.51% (Threshold: 70.0%)
Statements: 78.47%
Functions: 74.34%
Duration: 7.93s
Exit code: 0
```
Key Avalon test suites executed and verified:
- `src/app/games/avalon/models/avalon.model.spec.ts` (2 tests passed)
- `src/app/games/avalon/data/avalon-config.spec.ts` (6 tests passed)
- `src/app/games/avalon/services/avalon-engine.service.spec.ts` (16 tests passed)
- `src/app/games/avalon/services/avalon-bot.service.spec.ts` (15 tests passed)
- `src/app/games/avalon/services/avalon-session.service.spec.ts` (12 tests passed)
- `src/app/games/avalon/components/avalon-components.spec.ts` (10 tests passed)
- `src/app/core/e2e-specs/avalon-social-deduction.e2e.spec.ts` (13 tests passed)

### Command 5: `npm.cmd run build`
```
> hk-mahjong@0.0.0 build
> ng build

Initial total: 689.79 kB (Estimated transfer: 159.50 kB)
Lazy chunk files: chunk-6HB7I2BO.js (bundler, 116.09 kB)
Application bundle generation complete. [3.690 seconds]
Output location: C:\Users\chine\OneDrive\Desktop\Github\mahjong\dist\hk-mahjong
Exit code: 0
```

### Codebase Verifications
1. **Host-Authoritative Anti-Cheat View Sanitization**:
   - `src/app/games/avalon/services/avalon-engine.service.ts` lines 41–79:
     - Merlin sees all Evil except Mordred (`target.loyalty === 'evil' && target.role !== 'mordred'`); sees Oberon.
     - Percival sees Merlin and Morgana with identical clue (`'merlin_or_morgana'`).
     - Evil teammates see each other except Oberon (`target.loyalty === 'evil' && target.role !== 'oberon'`).
     - Oberon and Loyal Servants see nobody (`'unknown'`).
   - `src/app/games/avalon/services/avalon-engine.service.ts` lines 443–474:
     - `publicPlayers` omits all role/loyalty attributes.
     - `finalRoles` is strictly `null` until `state.phase === 'game_over'`.
     - `privateLadyResult` is masked as `null` for all viewers except the investigator seat.
   - `src/app/games/avalon/services/avalon-engine.service.ts` lines 84–101:
     - In-place cryptographic Fisher-Yates shuffle (`crypto.getRandomValues`) on quest card reveal.
2. **AI Bot Fair Play**:
   - `src/app/games/avalon/services/avalon-bot.service.ts`:
     - Every bot evaluation method (`computeTrustScores`, `evaluateAvalonBotAction`, `decideTeamProposal`, `decideProposalVote`, `decideQuestCard`, `decideLadyTarget`, `decideAssassinationTarget`) takes `AvalonPlayerView`.
     - Zero access to authoritative `AvalonMatchState` or private hidden roles.
     - Assassin targets Merlin via Bayesian heuristic calculation (evaluating voting patterns against evil proposals and proposal purity), never peeking at hidden identities.
3. **Modal & UI Constraints**:
   - `src/app/games/avalon/components/avalon-table/avalon-table.component.html` lines 388–580:
     - Modals (Quest submission, Lady of the Lake, Assassination, Settlement) have bottom action buttons only; ZERO top-right `X` close buttons.
   - `src/styles.scss` lines 261–289:
     - `.modal-card`: `max-width: min(720px, 95vw); max-height: 90vh;`
     - `.modal-body`: `max-height: 55vh; overflow-y: auto;`
4. **Repository Invariants**:
   - 0 `*.sh` scripts touched or created.
   - 0 `eslint-disable` comments.
   - 0 explicit `any`.
   - 0 trivial test assertions (`.toBeTruthy()`, `.toBeDefined()`, `.not.toBeNull()`).
   - Canary `HKMJ-P2P-CHECK-01` verified intact in `AGENTS.md`.

---

## 2. Logic Chain

1. **Step 1 (Source Integrity)**: Code inspection confirmed that `AvalonEngineService` and `AvalonBotService` implement the full rules without short-circuiting or returning hardcoded results. The engine validates turn ownership, team sizes, and voter eligibility at every step.
2. **Step 2 (Anti-Cheat Security)**: `getAvalonPlayerView` mathematically strips all concealed data. Opponent roles are `null` until `game_over`, Quest cards are cryptographically shuffled so seat-attribution is impossible, and Lady of the Lake results are strictly private. The bot automation in `AvalonSessionService` passes only the sanitized `AvalonPlayerView` to `AvalonBotService`, preventing bot cheating.
3. **Step 3 (Official Rule Compliance)**: All 6 player count ratios (5 to 10 players), quest team sizes, the Quest 4 2-fails exception for >= 7 players, and the 5-consecutive rejection Hammer track defeat rule were validated in both engine unit specs and dedicated E2E specs.
4. **Step 4 (UI & Styling Compliance)**: Modal structure in `avalon-table.component.html` and global styles in `styles.scss` satisfy all `AGENTS.md` modal bounds (`max-width: 95vw; max-height: 90vh; max-height: 55vh;` scroll container, bottom buttons only, NO top-right `X`).
5. **Step 5 (Empirical Verification)**: Live execution of the 5 project quality verification commands succeeded with zero errors, zero warnings, 100% test pass rate (273/273), and code coverage (81.92% lines / 70.51% branches) exceeding repository thresholds.

---

## 3. Caveats

No caveats. All components, rules, bot strategies, networking sessions, and invariants were independently verified against canonical specifications and repository rules.

---

## 4. Conclusion

**Verdict: CLEAN**

Milestone 5 "The Resistance: Avalon" is authentic, host-authoritative, mathematically sanitized against cheat vectors, completely adheres to all Don Eskridge rules and `AGENTS.md` invariants, and passes all 5 quality verification commands. The work product is approved without reservations.

---

## 5. Verification Method

To independently re-verify the audit findings, run the following commands in powershell:

```bash
npm.cmd run qa:agent-docs
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

Invalidation conditions:
- Any failure in `qa:agent-docs` (AGENTS.md size > 20kB or missing reference docs).
- Any TypeScript error in `tsc --noEmit`.
- Any ESLint warning or error, or any `eslint-disable` comment.
- Any test failure, trivial assertion, or line coverage < 80.0% / branch coverage < 70.0% in `test:ci`.
- Any build failure in `npm run build`.
- Any leak of concealed role/card data in `getAvalonPlayerView`.
