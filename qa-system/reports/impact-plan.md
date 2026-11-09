# Incremental QA & User Manual Impact Plan

- **Compared Against**: `df1b32d01b1010c8dccc52fb8a13543529192948`
- **Changed Files Detected**: 148
- **OpenAPI Contract Changed**: No
- **i18n Translations Changed**: YES (re-run locale manual snapshots)

## 1. Impacted Unit Specs (`.spec.ts`) to Update/Run
- [Service] `src/app/core/services/engine.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/core/services/game-session-manager.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/core/services/mahjong-session.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/core/services/shell-ui.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/core/services/translate.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/avalon/services/avalon-bot.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/avalon/services/avalon-session.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/balik-kampung/services/balik-kampung-bot.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/balik-kampung/services/balik-kampung-engine.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/balik-kampung/services/balik-kampung-session.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/monopoly/services/monopoly-bot.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/monopoly/services/monopoly-engine.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/monopoly/services/monopoly-session.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/pandemic/services/pandemic-bot.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/pandemic/services/pandemic-engine.service.spec.ts` (Status: **TRIAGED**)
- [Service] `src/app/games/pandemic/services/pandemic-session.service.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/app.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/games/monopoly/components/monopoly-board/monopoly-board.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/layout/header/app-header.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/pages/hub/hub.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/shared/exit-confirm-dialog/exit-confirm-dialog.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/pages/lobby/lobby.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/pages/table/table.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/games/avalon/components/avalon-lobby/avalon-lobby.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/games/avalon/components/avalon-table/avalon-table.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/games/balik-kampung/components/balik-kampung-board/balik-kampung-board.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/games/balik-kampung/components/balik-kampung-lobby/balik-kampung-lobby.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/games/monopoly/components/monopoly-lobby/monopoly-lobby.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/games/pandemic/components/pandemic-board/pandemic-board.component.spec.ts` (Status: **TRIAGED**)
- [Component] `src/app/games/pandemic/components/pandemic-lobby/pandemic-lobby.component.spec.ts` (Status: **TRIAGED**)
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
- [Route `/pandemic/lobby`] E2E: `e2e/journeys/pandemic-lobby.e2e.spec.ts` -> Manual Chapter: `manual-pandemic-lobby`
- [Route `/pandemic/board`] E2E: `e2e/journeys/pandemic-board.e2e.spec.ts` -> Manual Chapter: `manual-pandemic-board`
- [Route `/balik-kampung/lobby`] E2E: `e2e/journeys/balik-kampung-lobby.e2e.spec.ts` -> Manual Chapter: `manual-balik-kampung-lobby`
- [Route `/balik-kampung/board`] E2E: `e2e/journeys/balik-kampung-board.e2e.spec.ts` -> Manual Chapter: `manual-balik-kampung-board`

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
| `pandemic-lobby` | `/pandemic/lobby` | **missing** | n/a |
| `pandemic-board` | `/pandemic/board` | **missing** | n/a |
| `balik-kampung-lobby` | `/balik-kampung/lobby` | **missing** | n/a |
| `balik-kampung-board` | `/balik-kampung/board` | **missing** | n/a |

## 4. Ready-to-Ship Gate Violations (0)
All in-scope components, services, and manual slices have evidence.

### Waived (11)
- Feature slice `balik-kampung-board` (/balik-kampung/board) manual evidence is missing: no manual-steps.json with chapterId "manual-balik-kampung-board" or "balik-kampung-board" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `balik-kampung-lobby` (/balik-kampung/lobby) manual evidence is missing: no manual-steps.json with chapterId "manual-balik-kampung-lobby" or "balik-kampung-lobby" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `pandemic-board` (/pandemic/board) manual evidence is missing: no manual-steps.json with chapterId "manual-pandemic-board" or "pandemic-board" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `pandemic-lobby` (/pandemic/lobby) manual evidence is missing: no manual-steps.json with chapterId "manual-pandemic-lobby" or "pandemic-lobby" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `avalon-table` (/avalon/table) manual evidence is missing: no manual-steps.json with chapterId "manual-avalon-table" or "avalon-table" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `avalon-lobby` (/avalon/lobby) manual evidence is missing: no manual-steps.json with chapterId "manual-avalon-lobby" or "avalon-lobby" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `monopoly-board` (/monopoly/board) manual evidence is missing: no manual-steps.json with chapterId "manual-monopoly-board" or "monopoly-board" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `monopoly-lobby` (/monopoly/lobby) manual evidence is missing: no manual-steps.json with chapterId "manual-monopoly-lobby" or "monopoly-lobby" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `mahjong-table` (/mahjong/table) manual evidence is missing: no manual-steps.json with chapterId "manual-mahjong-table" or "mahjong-table" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `mahjong-lobby` (/mahjong/lobby) manual evidence is missing: no manual-steps.json with chapterId "manual-mahjong-lobby" or "mahjong-lobby" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
- Feature slice `home` (/) manual evidence is missing: no manual-steps.json with chapterId "manual-home" or "home" (run its Playwright journey) — _waived: Living user manual generation intentionally skipped_
