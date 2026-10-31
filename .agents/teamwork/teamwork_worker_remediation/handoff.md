# Handoff Report — Remediation of Non-Deterministic Branch Coverage & Quality Verification

## 1. Observation

1. **Initial Victory Auditor Finding**:
   - `bot.service.spec.ts` had an unseeded simulation test with `Math.random` loops leading to jitter in global branch coverage (hovering around ~70.3% against a mandatory 70.0% threshold).
   - In `src/app/games/monopoly/components/monopoly-components.spec.ts:241:34`, `expect(playersOnGo.length).toBe(3)` intermittently failed when a dice roll caused Player 0 to land on Chance/Dana and draw an "Advance to Mula" card, returning player 0 to space 0 (`AssertionError: expected 4 to be 3`).
   - In `monopoly-components.spec.ts:288`, `isUnownedLanding()` failed because Space 3 (`Jonker Walk`) could be randomly purchased by an AI bot during prior turns if the dice rolled 3 (`ownerSeat !== null`).

2. **Branch Coverage Baseline & Incremental Measurement**:
   - Initial run of `bot.service.spec.ts` baseline: `bot.service.ts` branch coverage was 69.51%, global branch coverage was 70.3%.
   - After adding deterministic AI decision fixtures in `bot.service.spec.ts` (LCG RNG seed, null phase guards, Seven Pairs claim guards, pure flush chow waits, All-Pongs threshold, added kong danger deferral, 3P fly exposure), `bot.service.ts` branch coverage reached 85.38% (Statements: 96.64%, Lines: 98.22%).
   - Global branch coverage reached 71.86%.
   - After adding deterministic protocol & error handling specs in `p2p-room.transport.spec.ts` (host seat reconnect, missing/self token guard, room started/full error reply, client invalid action dispatch), and action validation specs in `monopoly-engine.service.spec.ts` (unmortgage, demolition, trade proposal constraints, human creditor property transfer with houses preserved), branch coverage reached 72.78%.
   - After adding deterministic unit tests in `src/app/core/services/mahjong-session.service.spec.ts` (HostSession message dispatch, GuestSession broadcast channel message handling, MahjongSessionService audio callout log variations `⚠️ 詐糊`, `自摸`, `食糊`, `槓`, `碰`, `上 `, `打飛`, `換飛` and claim autoPass timer) and `monopoly-session.service.spec.ts` (modal signals, guest action dispatch, seat 0 boundary guards), `mahjong-session.service.ts` branch coverage rose from 45.32% to 55.08% and `monopoly-session.service.ts` from 65.93% to 71.42%.
   - Global branch coverage reached **73.1%** (All files: Stmts 79.66%, Branch 73.10%, Funcs 75.32%, Lines 83.14%), safely above the 73.0% target and the 70.0% mandatory threshold.
   - 301 out of 301 tests pass across 29 test files deterministically.

3. **5-Command Quality Verification Results**:
   - `npm.cmd run qa:agent-docs`:
     ```
     [Agent Context Gate PASSED] AGENTS.md: 4655 bytes | 4 reference docs verified | 66 TS/spec files clean.
     Exit code: 0
     ```
   - `npx.cmd tsc --noEmit`:
     ```
     Exit code: 0 (0 errors)
     ```
   - `npm.cmd run lint`:
     ```
     eslint src
     Exit code: 0 (0 errors, 0 warnings, 0 eslint-disable comments)
     ```
   - `npm.cmd run test:ci` (Run 1 & Run 2):
     ```
     Test Files  29 passed (29)
          Tests  301 passed (301)
     All files branch coverage: 73.1% (>= 73.0% target)
     Exit code: 0
     ```
   - `npm.cmd run build`:
     ```
     Application bundle generation complete. [3.730 seconds]
     Output location: C:\Users\chine\OneDrive\Desktop\Github\mahjong\dist\hk-mahjong
     Exit code: 0
     ```

## 2. Logic Chain

1. **Root Cause Analysis (Observations 1 & 2)**:
   - Branch flakiness was caused by: (a) non-deterministic random match loops in bot specs where branch paths depended on random tile draw sequences, and (b) test fixture state pollution where Space 3 was randomly acquired by previous simulated dice turns in monopoly component specs.
2. **Remediation Strategy (Observation 2)**:
   - Instead of relying on long random simulations, deterministic fixed-state hand scenarios were constructed with exact tile arrays, phase states, and legal action shapes.
   - For random simulation step 6 in `bot.service.spec.ts`, a deterministic 32-bit Linear Congruential Generator (`(seed * 1664525 + 1013904223) >>> 0`) replaced `Math.random()`.
   - In `monopoly-components.spec.ts`, the mock board snapshot explicitly sets `properties.get(3).ownerSeat = null`, eliminating reliance on earlier dice outcomes.
   - In `mahjong-session.service.spec.ts` and `monopoly-session.service.spec.ts`, direct unit tests for protocol errors (room full, match started, missing token) and audio callouts ensure branch coverage is anchored deterministically without relying on runtime timers or WebRTC network state.
3. **Threshold Margin (Observation 2 & 3)**:
   - Raising global branch coverage to 73.1% provides a comfortable 3.1% buffer above the 70.0% threshold in `angular.json`, ensuring zero regressions or build breakage during CI runs.

## 3. Caveats

- WebRTC signaling and actual P2P network handshakes rely on browser transport mocks (`BroadcastChannel` and synthetic `MessageEvent`) in the headless Vitest environment; real PeerJS cloud signaling servers are bypassed during unit test execution as per architecture design.
- No production application logic was altered; all changes were strictly fixes to test fixtures, deterministic test suite additions, and test assertions.

## 4. Conclusion

The non-deterministic branch coverage fluctuation and intermittent spec failures have been remediated. Global branch coverage is stabilized at **73.1%** (above the 73.0% target and 70.0% mandatory floor). All 301 unit tests across all 29 test files pass deterministically with exit code 0. All 5 quality checks (`qa:agent-docs`, `tsc`, `lint`, `test:ci`, `build`) pass with 0 errors and 0 warnings.

## 5. Verification Method

To independently reproduce and verify this outcome, run the 5 mandatory quality commands in sequence:

```powershell
npm.cmd run qa:agent-docs
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

Expected output:
- `Test Files: 29 passed (29)`
- `Tests: 301 passed (301)`
- `All files % Branch: >= 73.0%`
- All commands exit with code 0.
