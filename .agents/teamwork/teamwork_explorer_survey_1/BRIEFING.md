# BRIEFING — 2026-10-31T08:33:00Z

## Mission
Survey the existing Angular 21 codebase layout, shell architecture, routes, P2P transport, i18n, and audio infrastructure to prepare for the multi-game pavilion refactoring.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, synthesizer
- Working directory: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_explorer_survey_1
- Original parent: ef1bcb5f-b649-4a2e-b9d7-7951164b25f3
- Milestone: Multi-game pavilion exploration and architecture design

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code
- Strictly NO *.sh scripts reading, creating, modifying, or executing
- All outputs within agent directory (.agents/teamwork/teamwork_explorer_survey_1/)
- Zero regressions on HK 4P & MY 3P Fly Mahjong logic and rules

## Current Parent
- Conversation ID: ef1bcb5f-b649-4a2e-b9d7-7951164b25f3
- Updated: 2026-10-31T08:33:00Z

## Investigation State
- **Explored paths**: ORIGINAL_REQUEST.md, AGENTS.md, docs/reference/*.md, package.json, angular.json, tsconfig.json, eslint.config.cjs, scripts/verify-agent-context.mjs, src/styles.scss, src/styles/**, src/app/app.routes.ts, src/app/app.component.*, src/app/layout/header/*, src/app/core/services/*, src/app/pages/*, public/assets/i18n/*.json
- **Key findings**:
  1. Base test suite is healthy (20/20 Vitest tests pass, branch coverage 71.2% >= 70%, line coverage 84.6% >= 80%).
  2. ESLint clean (0 errors, 0 warnings, zero eslint-disable, detect-object-injection active).
  3. `verify-agent-context.mjs` has line 92 `assertCondition(!fs.existsSync(path.join(repoRoot, '.agents')))` which fails due to `.agents/teamwork` metadata dir.
  4. Current routing mounts LobbyComponent at `/`, `lobby`, and TableComponent at `table`. Needs backward-compatible redirect structure.
  5. Current AppHeaderComponent and AppComponent are tightly coupled to MahjongSessionService; needs ShellUiService decoupling.
  6. P2P state sanitization in getPlayerView and session snapshot must be generalized via p2p-room.transport.ts.
- **Unexplored areas**: None, survey investigation complete. Ready to produce handoff.md.

## Key Decisions Made
- Architecture strategy: Introduce `ShellUiService` and generic `P2pHostTransport`/`P2pGuestTransport` while preserving MahjongSessionService interface for zero regression.
- Room code parser: Universal prefix detection (M: Mahjong, P: Monopoly, A: Avalon) with fallback to Mahjong.
- Theming strategy: CSS variables and theme classes on shell/body without modifying top-level .portal-input styling.

## Artifact Index
- DISPATCH.md — record of incoming dispatch messages
- BRIEFING.md — persistent working memory
- progress.md — liveness heartbeat
- handoff.md — comprehensive survey report and architecture proposal
