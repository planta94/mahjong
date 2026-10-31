# Incremental QA & User Manual Impact Plan

- **Compared Against**: `df1b32d01b1010c8dccc52fb8a13543529192948`
- **Changed Files Detected**: 48
- **OpenAPI Contract Changed**: No
- **i18n Translations Changed**: No

## 1. Impacted Unit Specs (`.spec.ts`) to Update/Run
- [Service] `src/app/core/services/engine.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/core/services/game-session-manager.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/core/services/mahjong-session.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/core/services/shell-ui.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/core/services/translate.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/avalon/services/avalon-bot.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/avalon/services/avalon-session.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/monopoly/services/monopoly-bot.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/monopoly/services/monopoly-engine.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/monopoly/services/monopoly-session.service.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/app.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/games/monopoly/components/monopoly-board/monopoly-board.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/layout/header/app-header.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/pages/hub/hub.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/shared/exit-confirm-dialog/exit-confirm-dialog.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/pages/lobby/lobby.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/pages/table/table.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/games/avalon/components/avalon-lobby/avalon-lobby.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/games/avalon/components/avalon-table/avalon-table.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/games/monopoly/components/monopoly-lobby/monopoly-lobby.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/pages/placeholder/game-placeholder.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/shared/rulebook-dialog/rulebook-dialog.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/shared/dice/real-dice.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/shared/tile/tile.component.spec.ts` (Status: **TRIAGED**)

## 2. Impacted Playwright E2E Journeys & Manual Chapters
- [Route `/`] E2E: `e2e/journeys/home.e2e.spec.ts` -> Manual Chapter: `manual-home`
- [Route `/mahjong/lobby`] E2E: `e2e/journeys/mahjong-lobby.e2e.spec.ts` -> Manual Chapter: `manual-mahjong-lobby`
- [Route `/mahjong/table`] E2E: `e2e/journeys/mahjong-table.e2e.spec.ts` -> Manual Chapter: `manual-mahjong-table`
- [Route `/monopoly/lobby`] E2E: `e2e/journeys/monopoly-lobby.e2e.spec.ts` -> Manual Chapter: `manual-monopoly-lobby`
- [Route `/monopoly/board`] E2E: `e2e/journeys/monopoly-board.e2e.spec.ts` -> Manual Chapter: `manual-monopoly-board`
- [Route `/avalon/lobby`] E2E: `e2e/journeys/avalon-lobby.e2e.spec.ts` -> Manual Chapter: `manual-avalon-lobby`
- [Route `/avalon/table`] E2E: `e2e/journeys/avalon-table.e2e.spec.ts` -> Manual Chapter: `manual-avalon-table`

## 3. Evidence
| Slice | Route | Manual Evidence | Playwright |
| :--- | :--- | :--- | :--- |
| `home` | `/` | **missing** | n/a |
| `mahjong-lobby` | `/mahjong/lobby` | **missing** | n/a |
| `mahjong-table` | `/mahjong/table` | **missing** | n/a |
| `monopoly-lobby` | `/monopoly/lobby` | **missing** | n/a |
| `monopoly-board` | `/monopoly/board` | **missing** | n/a |
| `avalon-lobby` | `/avalon/lobby` | **missing** | n/a |
| `avalon-table` | `/avalon/table` | **missing** | n/a |

## 4. Ready-to-Ship Gate Violations (0)
All in-scope components, services, and manual slices have evidence.

### Waived (7)
- Feature slice `avalon-table` (/avalon/table) manual evidence is missing: no manual-steps.json with chapterId "manual-avalon-table" or "avalon-table" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `avalon-lobby` (/avalon/lobby) manual evidence is missing: no manual-steps.json with chapterId "manual-avalon-lobby" or "avalon-lobby" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `monopoly-board` (/monopoly/board) manual evidence is missing: no manual-steps.json with chapterId "manual-monopoly-board" or "monopoly-board" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `monopoly-lobby` (/monopoly/lobby) manual evidence is missing: no manual-steps.json with chapterId "manual-monopoly-lobby" or "monopoly-lobby" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `mahjong-table` (/mahjong/table) manual evidence is missing: no manual-steps.json with chapterId "manual-mahjong-table" or "mahjong-table" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `mahjong-lobby` (/mahjong/lobby) manual evidence is missing: no manual-steps.json with chapterId "manual-mahjong-lobby" or "mahjong-lobby" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `home` (/) manual evidence is missing: no manual-steps.json with chapterId "manual-home" or "home" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
