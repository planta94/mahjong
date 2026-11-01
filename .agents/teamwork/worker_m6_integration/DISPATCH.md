## 2026-11-01T04:44:22Z
You are the Milestone 6 Worker for the Tabletop Royale (hk-mahjong) project, responsible for Pavilion Integration, Routes, Hub card, Rulebook tab, i18n key parity, VeriScribe config, documentation, and the final verification gate.

Your Working Directory: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\worker_m6_integration
Your Identity: worker_m6_integration

MANDATORY SPECIFICATION SOURCES:
- Read ORIGINAL_REQUEST.md: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
- Read SCOPE.md: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\orchestrator_1\SCOPE.md
- Read Approved Implementation Plan: C:\Users\chine\.gemini\antigravity\brain\effe94dd-f539-4d36-8797-edcb695c4bde\implementation_plan.md (Section 4: Pavilion Shell, Theme, i18n, Docs & VeriScribe Wiring + Verification Plan)
- Read required canonical references:
  - docs/reference/architecture.md
  - docs/reference/security-and-p2p.md
  - docs/reference/ui-conventions.md
  - docs/reference/testing-and-quality.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP (You may only modify/create these files):
- src/app/app.routes.ts
- src/app/pages/hub/hub.component.ts
- src/app/pages/hub/hub.component.html
- src/app/pages/hub/hub.component.scss
- src/app/pages/hub/hub.component.spec.ts
- src/app/shared/rulebook-dialog/rulebook-dialog.component.ts
- src/app/shared/rulebook-dialog/rulebook-dialog.component.html
- src/app/shared/rulebook-dialog/rulebook-dialog.component.scss
- src/app/shared/rulebook-dialog/rulebook-dialog.component.spec.ts
- src/app/core/services/shell-ui.service.ts
- src/app/core/services/shell-ui.service.spec.ts
- src/app/core/services/game-session-manager.service.ts
- src/app/core/services/game-session-manager.service.spec.ts
- src/app/games/avalon/services/avalon-session.service.ts (safe optional chaining: this.router.url?.includes('/avalon/table'))
- src/app/games/pandemic/services/pandemic-bot.service.spec.ts (ensure all bot specs pass)
- src/styles.scss
- public/assets/i18n/en.json
- public/assets/i18n/zh.json
- veriscribe.config.ts
- AGENTS.md (keep strictly < 20,000 bytes)
- docs/reference/architecture.md
- docs/reference/security-and-p2p.md
- docs/reference/ui-conventions.md
- docs/reference/testing-and-quality.md
- C:\Users\chine\.gemini\antigravity\brain\effe94dd-f539-4d36-8797-edcb695c4bde\walkthrough.md

NON-NEGOTIABLE REQUIREMENTS:
1. NEVER read, inspect, create, edit, overwrite, rename, delete, or execute ANY *.sh script.
2. In `app.routes.ts`: Register `/pandemic/lobby` and `/pandemic/board` routes.
3. In `hub.component.*`: Add 4th Pandemic game card (responsive 2×2 grid on desktop, stacked on mobile) with player count, description, and routing to `/pandemic/lobby`. Update tests in `hub.component.spec.ts`.
4. In `rulebook-dialog.component.*`: Add 4th Pandemic tab with `.desktop-table` on desktop and `.mobile-cards` on mobile for Specialist Roles & Difficulty overview. Update tests in `rulebook-dialog.component.spec.ts`.
5. In `shell-ui.service.ts`: Support `'pandemic'` activeGame, theme accents, header badge, and rulebook context.
6. In `game-session-manager.service.ts`: Inject `PandemicSessionService`, wire `case 'pandemic':` in `resumeSavedGame()`, `canSaveCurrentProgress`, and `getGameLobbyRoute()`.
7. In `src/styles.scss`: Add `body[data-theme='pandemic']` theme styling, keep `.portal-input` strictly top-level, honor `prefers-reduced-motion: reduce`.
8. In `public/assets/i18n/{en,zh}.json`: Maintain 100% strict key parity for all added keys (HEADER.*, EXIT_MODAL.*, MONOPOLY.TRADE_REASON_*, PANDEMIC.*, HUB.*, RULEBOOK.*). Verify with `npx.cmd vitest run src/app/i18n-parity.spec.ts`.
9. In `veriscribe.config.ts`: Add `slice:pandemic-lobby` and `slice:pandemic-board` route-slice manual waivers only (0 component/service spec waivers).
10. In `avalon-session.service.ts`: Change line 86 to `this.router.url?.includes('/avalon/table')` to avoid undefined error in mock test environments.
11. In `pandemic-bot.service.spec.ts`: Fix any expectation discrepancy in the `shareKnowledge` test so all bot tests pass 100%.
12. Update `AGENTS.md` (< 20,000 bytes) and `docs/reference/*.md`.
13. Write `walkthrough.md` in `C:\Users\chine\.gemini\antigravity\brain\effe94dd-f539-4d36-8797-edcb695c4bde\walkthrough.md`.
14. Run the full verification checklist in order:
    - `npm.cmd run qa:agent-docs`
    - `npx.cmd tsc --noEmit`
    - `npm.cmd run lint`
    - `npm.cmd run test:ci`
    - `npm.cmd run qa:scan`
    - `npm.cmd run qa:gate`
    - `npm.cmd run build`
