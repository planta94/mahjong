# Angular AI QA & Living Manual — Master Coverage Audit

- **Scanned Root**: `src/app`
- **Total Components**: 14 (0 missing or shallow spec)
- **Total Services**: 13 (0 missing or shallow spec)
- **Total Route Feature Slices**: 7

## 1. Services
| Service | Spec Status | Meaningful / Trivial Asserts | HTTP Endpoints | Dependent Components |
| :--- | :--- | :--- | :--- | :--- |
| `bot` | **TRIAGED** | 36 / 0 | 0 | 0 |
| `engine` | **TRIAGED** | 182 / 0 | 0 | 0 |
| `game-session-manager` | **TRIAGED** | 80 / 0 | 0 | 5 |
| `mahjong-session` | **TRIAGED** | 167 / 0 | 0 | 2 |
| `scorer` | **TRIAGED** | 29 / 0 | 0 | 0 |
| `shell-ui` | **TRIAGED** | 91 / 0 | 0 | 11 |
| `translate` | **TRIAGED** | 15 / 0 | 0 | 2 |
| `avalon-bot` | **TRIAGED** | 91 / 0 | 0 | 0 |
| `avalon-engine` | **TRIAGED** | 73 / 0 | 0 | 0 |
| `avalon-session` | **TRIAGED** | 110 / 0 | 0 | 2 |
| `monopoly-bot` | **TRIAGED** | 60 / 0 | 0 | 0 |
| `monopoly-engine` | **TRIAGED** | 307 / 0 | 0 | 1 |
| `monopoly-session` | **TRIAGED** | 97 / 0 | 0 | 2 |

## 2. Components
| Component | Spec Status | Meaningful / Trivial Asserts | Template Branches | Events | Forms | RxJS Subs | Template |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `app` | **TRIAGED** | 52 / 0 | 2 | 1 | 0 | 0 | External |
| `avalon-lobby` | **TRIAGED** | 66 / 0 | 9 | 3 | 0 | 1 | External |
| `avalon-table` | **TRIAGED** | 118 / 0 | 52 | 6 | 0 | 0 | External |
| `monopoly-board` | **TRIAGED** | 175 / 0 | 73 | 2 | 0 | 0 | External |
| `monopoly-lobby` | **TRIAGED** | 59 / 0 | 15 | 1 | 0 | 1 | External |
| `app-header` | **TRIAGED** | 83 / 0 | 10 | 1 | 0 | 0 | External |
| `hub` | **TRIAGED** | 47 / 0 | 9 | 3 | 0 | 0 | External |
| `lobby` | **TRIAGED** | 119 / 0 | 25 | 5 | 0 | 1 | External |
| `game-placeholder` | **TRIAGED** | 9 / 0 | 0 | 1 | 0 | 0 | Inline |
| `table` | **TRIAGED** | 86 / 0 | 82 | 2 | 0 | 0 | External |
| `real-dice` | **TRIAGED** | 45 / 0 | 4 | 0 | 0 | 0 | External |
| `exit-confirm-dialog` | **TRIAGED** | 38 / 0 | 3 | 1 | 0 | 0 | External |
| `rulebook-dialog` | **TRIAGED** | 37 / 0 | 11 | 1 | 0 | 0 | External |
| `tile` | **TRIAGED** | 58 / 0 | 17 | 0 | 0 | 0 | External |

## 3. Feature Slices
| Slice | Route | Status | Components | Services | Manual Chapter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `home` | `/` | **PENDING** | 1 | 3 | `manual-home` |
| `mahjong-lobby` | `/mahjong/lobby` | **PENDING** | 1 | 2 | `manual-mahjong-lobby` |
| `mahjong-table` | `/mahjong/table` | **PENDING** | 2 | 1 | `manual-mahjong-table` |
| `monopoly-lobby` | `/monopoly/lobby` | **PENDING** | 1 | 2 | `manual-monopoly-lobby` |
| `monopoly-board` | `/monopoly/board` | **PENDING** | 2 | 4 | `manual-monopoly-board` |
| `avalon-lobby` | `/avalon/lobby` | **PENDING** | 1 | 2 | `manual-avalon-lobby` |
| `avalon-table` | `/avalon/table` | **PENDING** | 1 | 2 | `manual-avalon-table` |
