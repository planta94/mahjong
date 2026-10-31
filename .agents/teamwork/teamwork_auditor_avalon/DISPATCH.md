# DISPATCH: Forensic Integrity Audit — The Resistance: Avalon (Milestone 5)

## 2026-10-31T11:16:30Z

You are `teamwork_auditor_avalon`, working in `c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_auditor_avalon\`.

### Mandatory Inputs to Read
1. `c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md` (authoritative user request)
2. `c:\Users\chine\OneDrive\Desktop\Github\mahjong\AGENTS.md` (non-negotiable repository rules & canary HKMJ-P2P-CHECK-01)
3. `c:\Users\chine\OneDrive\Desktop\Github\mahjong\PROJECT.md`
4. `c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_worker_avalon\handoff.md`

### Audit Mandate & Forensic Checks
Perform comprehensive, evidence-based integrity checks across `src/app/games/avalon/` and shared integrations:
1. **Zero Cheating & No Facades**:
   - Inspect `src/app/games/avalon/services/avalon-engine.service.ts` and `avalon-bot.service.ts`.
   - Confirm genuine pure state machine logic (no hardcoded quest outcomes, no fake votes, no fixed bot responses).
2. **Official Game Rules & Matrices Compliance**:
   - Verify Don Eskridge 5–10 player counts & Good/Evil distributions.
   - Verify Quest 1–5 team sizes across 5–10 players.
   - Verify Quest 4 requires 2 Fails to fail when player count >= 7.
   - Verify Hammer 5-rejection track triggers immediate Evil victory (`FIVE_REJECTED_TEAMS`).
3. **Host-Authoritative Anti-Cheat State Sanitization**:
   - Verify `getAvalonPlayerView(state, seatIdx)` and `computeNightVisionClues()`:
     - Merlin never sees Mordred (sees Oberon).
     - Percival sees Merlin and Morgana with identical clue `'merlin_or_morgana'`.
     - Evils see each other except Oberon; Oberon is isolated.
     - Opponent true roles are masked as `null` until `game_over`.
     - Fisher-Yates shuffled quest card reveal (counts only, zero seat attribution).
     - Lady of the Lake result delivered strictly to investigator seat (`privateLadyResult`).
4. **UI & Repository Invariants (`AGENTS.md`)**:
   - No `*.sh` scripts touched or created.
   - 0 explicit `any`, 0 `eslint-disable` comments.
   - Safe `Map<K, V>` and `.at()` indexing (zero dynamic `obj[key]` index access).
   - Modals bounded (`max-width: 95vw; max-height: 90vh;` middle scroll container `<= 55vh`, bottom action buttons only; NO top-right `X` close buttons).
   - Trilingual i18n parity in `public/assets/i18n/{en,zh,ms}.json` under `AVALON`.
   - Zero trivial assertions (`.toBeTruthy()`, `.toBeDefined()`, `.not.toBeNull()`).
5. **Execution Verification**:
   Run:
   `npm run qa:agent-docs`
   `npx tsc --noEmit`
   `npm run lint`
   `npm run test:ci`
   `npm run build`

Deliver your audit verdict (`CLEAN` or `INTEGRITY VIOLATION`) with line-level evidence to:
`c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_auditor_avalon\handoff.md`
and notify orchestrator (`ef1bcb5f-b649-4a2e-b9d7-7951164b25f3`).
