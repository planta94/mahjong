## 2026-10-31T10:40:49Z

You are teamwork_worker_avalon, working in c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_worker_avalon\.

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
Also review repo rules in c:\Users\chine\OneDrive\Desktop\Github\mahjong\AGENTS.md, docs/reference/*.md, and c:\Users\chine\OneDrive\Desktop\Github\mahjong\PROJECT.md.
Review Explorer 3's comprehensive domain blueprint at:
c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_explorer_survey_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Assigned Deliverables for The Resistance: Avalon (阿瓦隆):
1. Domain Models (`src/app/games/avalon/models/avalon.model.ts`):
   - Role types: Merlin, Percival, Servant, Assassin, Morgana, Mordred, Oberon, Minion.
   - Loyalty types: Good, Evil.
   - Game state, seats, lobby settings, quest records, public vote records, Lady of the Lake states, and sanitized player view.
2. Official Game Matrices & Config (`src/app/games/avalon/data/avalon-config.data.ts`):
   - Don Eskridge 5–10 player counts & Good/Evil distributions.
   - Quest 1–5 team size matrices across 5–10 players.
   - Special Rule: Quest 4 requires 2 Fails to fail when player count >= 7.
   - Vote track: 5 rejected proposals Hammer track -> Evil victory.
3. Authoritative Rules Engine & Sanitization (`src/app/games/avalon/services/avalon-engine.service.ts`):
   - Pure state machine for team proposals, voting, quest card submission, Lady of the Lake investigation, and Assassinate Merlin endgame phase.
   - Anti-cheat state sanitization: `getAvalonPlayerView` with mathematical night-vision matrix (`getNightVisionClues`):
     - Merlin sees all evil EXCEPT Mordred; sees Oberon.
     - Percival sees Merlin and Morgana as ambiguous candidate Merlins.
     - Evils see each other EXCEPT Oberon (who is unknown to evils).
     - Oberon is isolated.
     - Opponent true roles masked as null until game over.
     - Lady of the Lake private result delivered strictly to investigator seat.
     - CSPRNG Fisher-Yates shuffled quest card reveal (counts only, zero seat attribution).
4. Deduction AI Bot (`src/app/games/avalon/services/avalon-bot.service.ts`):
   - Dynamic Bayesian trust model (`trustScores: Map<number, number>`).
   - Team proposal heuristics (Good allies vs Evil infiltration).
   - Proposal voting heuristics (Hammer preservation, trust thresholding).
   - Quest card play heuristics (Good always Success; Evil strategic pass or fail).
   - Lady of the Lake target selection & claimed loyalty.
   - Assassin Merlin identification scoring analyzing proposal & voting patterns.
5. Avalon P2P Session (`src/app/games/avalon/services/avalon-session.service.ts`):
   - 5–10 seats, bot slot filling, room codes ('A' prefix), WebRTC + BroadcastChannel using `P2PRoomTransport`.
6. Responsive UI Components (`src/app/games/avalon/components/`):
   - `avalon-lobby`: 5-10 seats picker, bot slot filling, role toggles, Lady of the Lake toggle, deep links.
   - `avalon-table`:
     - Arthurian Midnight/Crimson ambiance (`body[data-theme='avalon']`).
     - Zero in-game chat (all communication is offline/verbal as dictated by user).
     - Touch/click-and-hold Privacy Shield overlay concealing role cards and night-vision clues.
     - Public Vote & Quest History Table / Mobile Cards (`desktop-table` > 768px, `.mobile-cards` <= 768px).
     - Bounded modals (Quest Card execution, Lady of the Lake, Assassinate Merlin) with bottom action buttons only (`max-height: 90vh`).
7. Routing & Trilingual i18n:
   - Wire `/avalon/lobby` and `/avalon/table` into `src/app/app.routes.ts`.
   - Update `public/assets/i18n/{en,zh,ms}.json` under `AVALON` in 100% lockstep parity.
8. Verification:
   Run:
   `npm run qa:agent-docs`
   `npx tsc --noEmit`
   `npm run lint`
   `npm run test:ci` (ensure `avalon-social-deduction.e2e.spec.ts` and all unit specs pass!)
   `npm run build`

## 2026-10-31T11:06:13Z

**Context**: Avalon Implementation (Milestone 5)
**Content**: Please provide a brief status update on your test execution and handoff preparation.
**Action**: Report current status and estimated completion.
