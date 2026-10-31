## 2026-10-31T08:31:08Z

Working directory: .agents/teamwork/orchestrator/
Authoritative request: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md

Task:
# Party Game Pavilion (`桌遊館`) — Multi-Game Shell, Malaysia Monopoly & Avalon Plan

Transform the existing Angular 21 application into a unified **Serverless P2P & Offline AI Party Game Pavilion** hosting three complete games in one single-page application:

1. **HK 4P & Authentic Malaysian 3P Fly Mahjong** (`3–4` players — migrated cleanly with zero rule regressions, including `打飛` Expose Fly and `換飛` Retrieve Fly)
2. **Malaysia Landmarks Monopoly (`大馬地標大富翁`)** (`2–6` players — full `40`-space `11×11` ring, `RM` currency, Saidina family house rules)
3. **The Resistance: Avalon (`阿瓦隆`)** (`5–10` players — full classic role set, optional Lady of the Lake, anti-cheat Night Vision, offline communication)

All non-negotiable repository invariants in `AGENTS.md` (`HKMJ-P2P-CHECK-01`, reading canonical `docs/reference/*.md` before editing, strict prohibition on reading/touching any `*.sh` scripts, strict per-seat P2P state sanitization, `0` explicit `any`, `0` `eslint-disable`, `Map` / `.at()` object-injection safety, `.portal-input` top-level styling, bounded modals with bottom-only close actions, trilingual `zh`/`en`/`ms` parity, and `>= 80%` line / `>= 70%` branch V8 test coverage with zero `.toBeTruthy()`/`.toBeDefined()`/`.not.toBeNull()`/`TestBed.overrideComponent`) must remain strictly enforced across every module.

## 2026-10-31T11:31:38Z

=== POST-VICTORY AUDIT FINDINGS: VICTORY REJECTED ===

The independent post-victory auditor has completed its 3-phase audit and reported a REJECT verdict due to non-deterministic branch coverage failures on `npm.cmd run test:ci`:

ROOT CAUSE:
In `src/app/core/services/bot.service.spec.ts` lines 136–152, step 6 executes an unseeded 40-ply simulation with random tile draws (`createMatch({ mode: '3p' })`). When random tile distributions fail to trigger specific bot branches (e.g., chow/pong/kong/win evaluations), `bot.service.ts` branch coverage drops to 69.51% (compared to 80.79% when triggered), causing repository-wide branch coverage to fluctuate between 69.63% and 71.43%. Whenever it dips below 70.0%, `npm.cmd run test:ci` fails with exit code 1.

REQUIRED ACTION:
Remediate the branch coverage stability by adding deterministic unit tests for the unexercised branches in `bot.service.ts` (or other core services), ensuring global branch coverage consistently remains safely above 72% across all runs. Re-run local verification commands to confirm 100% pass across multiple runs, then deliver handoff and re-request victory verification.
