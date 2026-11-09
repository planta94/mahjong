# Angular AI QA & Living Manual — Master Coverage Audit

- **Scanned Root**: `src/app`
- **Total Components**: 18 (0 missing or shallow spec)
- **Total Services**: 19 (0 missing or shallow spec)
- **Total Route Feature Slices**: 11

## 1. Services
| Service | Spec Status | Meaningful / Trivial Asserts | HTTP Endpoints | Dependent Components |
| :--- | :--- | :--- | :--- | :--- |
| `bot` | **TRIAGED** | 36 / 0 | 0 | 0 |
| `engine` | **TRIAGED** | 182 / 0 | 0 | 0 |
| `game-session-manager` | **TRIAGED** | 121 / 0 | 0 | 5 |
| `mahjong-session` | **TRIAGED** | 169 / 0 | 0 | 2 |
| `scorer` | **TRIAGED** | 29 / 0 | 0 | 0 |
| `shell-ui` | **TRIAGED** | 99 / 0 | 0 | 15 |
| `translate` | **TRIAGED** | 15 / 0 | 0 | 5 |
| `avalon-bot` | **TRIAGED** | 91 / 0 | 0 | 0 |
| `avalon-engine` | **TRIAGED** | 73 / 0 | 0 | 0 |
| `avalon-session` | **TRIAGED** | 110 / 0 | 0 | 2 |
| `balik-kampung-bot` | **TRIAGED** | 13 / 0 | 0 | 0 |
| `balik-kampung-engine` | **TRIAGED** | 136 / 0 | 0 | 1 |
| `balik-kampung-session` | **TRIAGED** | 54 / 0 | 0 | 2 |
| `monopoly-bot` | **TRIAGED** | 66 / 0 | 0 | 0 |
| `monopoly-engine` | **TRIAGED** | 318 / 0 | 0 | 1 |
| `monopoly-session` | **TRIAGED** | 101 / 0 | 0 | 2 |
| `pandemic-bot` | **TRIAGED** | 39 / 0 | 0 | 0 |
| `pandemic-engine` | **TRIAGED** | 249 / 0 | 0 | 1 |
| `pandemic-session` | **TRIAGED** | 90 / 0 | 0 | 2 |

## 2. Components
| Component | Spec Status | Meaningful / Trivial Asserts | Template Branches | Events | Forms | RxJS Subs | Template |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `app` | **TRIAGED** | 52 / 0 | 2 | 1 | 0 | 0 | External |
| `avalon-lobby` | **TRIAGED** | 66 / 0 | 9 | 3 | 0 | 1 | External |
| `avalon-table` | **TRIAGED** | 118 / 0 | 52 | 6 | 0 | 0 | External |
| `balik-kampung-board` | **TRIAGED** | 123 / 0 | 139 | 5 | 0 | 0 | External |
| `balik-kampung-lobby` | **TRIAGED** | 55 / 0 | 16 | 3 | 0 | 1 | External |
| `monopoly-board` | **TRIAGED** | 214 / 0 | 85 | 3 | 0 | 0 | External |
| `monopoly-lobby` | **TRIAGED** | 59 / 0 | 15 | 1 | 0 | 1 | External |
| `pandemic-board` | **TRIAGED** | 116 / 0 | 87 | 10 | 0 | 0 | External |
| `pandemic-lobby` | **TRIAGED** | 44 / 0 | 21 | 2 | 0 | 1 | External |
| `app-header` | **TRIAGED** | 113 / 0 | 10 | 1 | 0 | 0 | External |
| `hub` | **TRIAGED** | 53 / 0 | 9 | 3 | 0 | 0 | External |
| `lobby` | **TRIAGED** | 119 / 0 | 25 | 5 | 0 | 1 | External |
| `game-placeholder` | **TRIAGED** | 9 / 0 | 0 | 1 | 0 | 0 | Inline |
| `table` | **TRIAGED** | 86 / 0 | 82 | 2 | 0 | 0 | External |
| `real-dice` | **TRIAGED** | 45 / 0 | 4 | 0 | 0 | 0 | External |
| `exit-confirm-dialog` | **TRIAGED** | 56 / 0 | 6 | 1 | 0 | 0 | External |
| `rulebook-dialog` | **TRIAGED** | 49 / 0 | 18 | 1 | 0 | 0 | External |
| `tile` | **TRIAGED** | 58 / 0 | 17 | 0 | 0 | 0 | External |

## 3. Feature Slices
| Slice | Route | Status | Components | Services | Manual Chapter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `home` | `/` | **PENDING** | 1 | 3 | `manual-home` |
| `mahjong-lobby` | `/mahjong/lobby` | **PENDING** | 1 | 2 | `manual-mahjong-lobby` |
| `mahjong-table` | `/mahjong/table` | **PENDING** | 2 | 1 | `manual-mahjong-table` |
| `monopoly-lobby` | `/monopoly/lobby` | **PENDING** | 1 | 2 | `manual-monopoly-lobby` |
| `monopoly-board` | `/monopoly/board` | **PENDING** | 2 | 5 | `manual-monopoly-board` |
| `avalon-lobby` | `/avalon/lobby` | **PENDING** | 1 | 2 | `manual-avalon-lobby` |
| `avalon-table` | `/avalon/table` | **PENDING** | 1 | 2 | `manual-avalon-table` |
| `pandemic-lobby` | `/pandemic/lobby` | **PENDING** | 1 | 2 | `manual-pandemic-lobby` |
| `pandemic-board` | `/pandemic/board` | **PENDING** | 1 | 3 | `manual-pandemic-board` |
| `balik-kampung-lobby` | `/balik-kampung/lobby` | **PENDING** | 1 | 2 | `manual-balik-kampung-lobby` |
| `balik-kampung-board` | `/balik-kampung/board` | **PENDING** | 1 | 4 | `manual-balik-kampung-board` |
