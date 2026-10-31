## 2026-10-31T08:32:45Z
You are teamwork_explorer_survey_1, working in c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_explorer_survey_1\.

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
Also review repo rules in c:\Users\chine\OneDrive\Desktop\Github\mahjong\AGENTS.md and docs/reference/*.md.

Objective:
Survey the existing Angular 21 codebase layout, shell architecture, routes, P2P transport, i18n, and audio infrastructure to prepare for the multi-game pavilion refactoring.

Scope & Key Areas to Investigate:
1. Current Angular setup, routing (src/app/app.routes.ts), layout (src/app/layout/**), pages (src/app/pages/**), styles (src/styles.scss, src/styles/**).
2. Existing Mahjong P2P networking and state synchronization in src/app/core/ or mahjong-session.service.ts, how getPlayerView sanitization works, and how room codes/peer IDs are structured.
3. How to cleanly architect:
   - HubComponent at `/` with 3 game cards and universal room-code parser (M... -> Mahjong, P... -> Monopoly, A... -> Avalon) and deep-link redirect (?game=<id>&room=<code>).
   - Shell context & audio service (shell-ui.service.ts) handling activeGame, rulebook modal per game, audio effects, and player nickname migration.
   - Generalized P2P transport (p2p-room.transport.ts) supporting host/guest lifecycle, PeerJS + BroadcastChannel fallback, room-scoped guest tokens, and per-seat sanitization across all games.
   - Migration of existing Mahjong routes to /mahjong/lobby and /mahjong/table, preserving backward-compatibility redirects from /lobby and /table, ensuring zero rule regressions for HK 4P and MY 3P Fly (打飛, 換飛).
4. i18n structure in public/assets/i18n/{en,zh,ms}.json and how new game strings will be organized without parity violations.

Constraints:
- READ-ONLY exploration. DO NOT edit or create any source code files. DO NOT run any *.sh scripts (prohibited).
- DO NOT execute builds or tests directly unless needed for exploration.
- Write your comprehensive survey findings and architecture proposal to:
  c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_explorer_survey_1\handoff.md
- Update your progress.md periodically with "Last visited: [timestamp]".
- When complete, send a message back to the parent orchestrator (conversation ID: ef1bcb5f-b649-4a2e-b9d7-7951164b25f3) with your conclusion summary and pointing to handoff.md.
