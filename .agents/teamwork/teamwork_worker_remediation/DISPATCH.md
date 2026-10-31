# DISPATCH: Post-Victory Audit Remediation — Deterministic Branch Coverage Hardening

## 2026-10-31T11:32:30Z

You are `teamwork_worker_remediation`, working in `c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_worker_remediation\`.

### Mandatory Inputs to Read
1. `c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md`
2. `c:\Users\chine\OneDrive\Desktop\Github\mahjong\AGENTS.md`
3. `c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\victory_auditor\handoff.md` (full audit findings)

### Problem Statement & Root Cause
The independent post-victory auditor reported that `npm.cmd run test:ci` exhibits non-deterministic branch coverage across consecutive runs (observed 69.63%, 71.43%, 69.90%), causing occasional failure with exit code 1 when it dips below the mandatory 70.0% threshold.

Root Cause:
In `src/app/core/services/bot.service.spec.ts`, lines 136–152 run an unseeded 40-ply simulation with random tile draws (`createMatch({ mode: '3p' })`). When random tile distributions fail to trigger specific bot branches (e.g., chow/pong/kong/win evaluations), `bot.service.ts` branch coverage drops to ~69.51%, causing global branch coverage to fall to ~69.63%–69.90%.

### Assigned Deliverables
1. Inspect `src/app/core/services/bot.service.ts` and `src/app/core/services/bot.service.spec.ts`.
2. Add deterministic, fixed-fixture unit test cases in `src/app/core/services/bot.service.spec.ts` that explicitly test unexercised branches in `bot.service.ts`:
   - Bot discard decision when tiles have isolated terminals vs honor tiles vs pairs
   - Bot reaction to opponents' discards: deterministic Pong claim evaluation
   - Bot reaction to opponents' discards: deterministic Chow claim evaluation
   - Bot reaction to opponents' discards: deterministic Kong claim evaluation
   - Bot reaction to opponents' discards: deterministic Win (Hu) claim evaluation
   - Bot self-drawn Kong / Win evaluations
3. Optionally add targeted deterministic branch test cases in `src/app/core/services/p2p-room.transport.spec.ts` or `src/app/games/monopoly/services/monopoly-engine.service.spec.ts` to push repository-wide branch coverage safely to >= 73% so it can never dip below 70.0% regardless of random variations.
4. Verify repository invariants (`AGENTS.md`):
   - Zero `*.sh` scripts touched or created
   - Zero `eslint-disable` comments
   - Zero explicit `any`
   - Zero trivial assertions (`.toBeTruthy()`, `.toBeDefined()`, `.not.toBeNull()`)
   - Zero `TestBed.overrideComponent`
   - Strict `HKMJ-P2P-CHECK-01` compliance
5. Run the full verification suite multiple times:
   ```bash
   npm.cmd run qa:agent-docs
   npx.cmd tsc --noEmit
   npm.cmd run lint
   npm.cmd run test:ci
   npm.cmd run build
   ```
   Confirm that `npm.cmd run test:ci` passes with exit code 0 consistently across multiple runs with global branch coverage >= 72.0%.
6. Write your report to `c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_worker_remediation\handoff.md` and send_message to orchestrator (`ef1bcb5f-b649-4a2e-b9d7-7951164b25f3`).
