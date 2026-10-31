## 2026-10-31T08:43:04Z
You are teamwork_test_writer_e2e_1, working in c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_test_writer_e2e_1\.

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
Also review repo rules in c:\Users\chine\OneDrive\Desktop\Github\mahjong\AGENTS.md, docs/reference/testing-and-quality.md, and c:\Users\chine\OneDrive\Desktop\Github\mahjong\TEST_INFRA.md.

Objective:
Create the comprehensive E2E test suite for the Party Game Pavilion based on user requirements and TEST_INFRA.md.

Scope & Key Test Suites to Create:
1. `src/app/core/e2e-specs/hub-and-shell.e2e.spec.ts`:
   - Hub component routing, 3 game cards presentation.
   - Universal room-code parser tests (M... -> mahjong, P... -> monopoly, A... -> avalon).
   - Invite deep-link handling (?game=monopoly&room=P1234 -> redirects to /monopoly/lobby).
   - ShellUiService nickname migration, theme accent switching, audio triggers.
2. `src/app/core/e2e-specs/monopoly-rules.e2e.spec.ts`:
   - 40-space board perimeter layout verification (RM currency, Mula GO RM 200, 22 landmarks in 8 color groups, 4 transit hubs, 2 utilities, taxes).
   - Saidina House Rule 1: Free Parking Jackpot Pot accumulation (taxes, luxury tax, RM 50 jail bail) and pot collection on landing.
   - Saidina House Rule 2: No rent collected while in jail (RM 0 rent paid to jailed landlord).
   - Even-build rules (1-4 houses, hotel), mortgage/unmortgage calculations (50% / 55%).
   - Action decks: 16 Nasib & 16 Dana Komuniti card effects.
   - Win condition evaluation: Last Tycoon Standing vs Round Limit (20/30/40 rounds - highest net worth).
   - Tactical AI bot heuristics and property trading logic.
3. `src/app/core/e2e-specs/avalon-social-deduction.e2e.spec.ts`:
   - Don Eskridge 5-10 player matrices (Good/Evil counts, Quest 1-5 team size matrices).
   - Special rule: Quest 4 requires 2 Fails for >= 7 players.
   - Vote track ("Hammer"): 5 rejected proposals -> immediate Evil victory.
   - Mathematical Night-Vision sanitization matrix (Merlin sees evil except Mordred; Percival sees Merlin & Morgana; Evils see each other except Oberon; Oberon isolated).
   - Lady of the Lake: private investigation result, secret delivery to investigator only.
   - CSPRNG Fisher-Yates shuffled quest card reveal (shuffled counts, no seat attribution).
   - Endgame phase: Assassinate Merlin logic.
   - Deduction AI bot Bayesian trust update and Merlin assassination scoring.
4. `src/app/core/e2e-specs/p2p-anti-cheat-sanitization.e2e.spec.ts`:
   - Reusable P2P room transport sanitization contract: host secrets and seat tokens are stripped across all 3 games.
   - HKMJ-P2P-CHECK-01 compliance for Mahjong.

Repository Invariants:
- All test files must compile and run via Vitest (`npm run test:ci`).
- ZERO trivial assertions: NO `.toBeTruthy()`, `.toBeDefined()`, `.not.toBeNull()`. Assert exact values (`.toBe()`, `.toEqual()`, `.toBeGreaterThan()`, etc.).
- ZERO explicit `any`, ZERO `eslint-disable`.
- Map / `.at()` safe indexing.

Deliverable:
When all test suites are written and passing, generate and write `c:\Users\chine\OneDrive\Desktop\Github\mahjong\TEST_READY.md` matching the template in PROJECT.md / TEST_INFRA.md, write your handoff report to `c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_test_writer_e2e_1\handoff.md`, and notify the parent orchestrator via send_message.

## 2026-10-31T09:17:25Z
**Context**: E2E Test Suite Creation
**Content**: The 4 comprehensive E2E spec files have been detected in src/app/core/e2e-specs/. Please verify all tests pass via npm run test:ci, generate TEST_READY.md at project root per TEST_INFRA.md, write your handoff.md, and send your completion report.
**Action**: Finalize TEST_READY.md and handoff.md, and reply with completion.
