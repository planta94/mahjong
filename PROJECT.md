# Project: Party Game Pavilion (`桌遊館`)

## Architecture
A unified Serverless P2P & Offline AI Party Game Pavilion built with Angular 21 Standalone Components, Signals, SCSS Design System, and WebRTC (PeerJS + BroadcastChannel).
Hosts three full games in a single-page application:
1. **HK 4P & Authentic Malaysian 3P Fly Mahjong** (`/mahjong/lobby`, `/mahjong/table`)
2. **Malaysia Landmarks Monopoly (`大馬地標大富翁`)** (`/monopoly/lobby`, `/monopoly/board`)
3. **The Resistance: Avalon (`阿瓦隆`)** (`/avalon/lobby`, `/avalon/table`)

### Core Architectural Layers
- **Universal Shell & Context (`src/app/core/services/shell-ui.service.ts`)**:
  Manages active game context (`'hub' | 'mahjong' | 'monopoly' | 'avalon'`), header branding, theme styling, sound/BGM synthesis, universal Rulebook modal, and shared player nickname (`localStorage`).
- **Reusable P2P Transport (`src/app/core/services/p2p-room.transport.ts`)**:
  PeerJS + BroadcastChannel dual-transport with room codes (`M...`, `P...`, `A...`), token isolation (`sessionStorage`), reconnection lifecycle, and per-seat state sanitization hook (`buildPlayerView`).
- **Game Hub (`src/app/pages/hub/hub.component.ts`)**:
  Entrypoint at `/` displaying 3 game cards, universal room code parser and joiner, and deep-link invite redirector (`?game=<id>&room=<code>`).
- **Domain Engines (`src/app/games/`)**:
  Pure functional or service-based state machines executing game rules, player actions, AI bots, and sanitization before P2P broadcast.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Universal Game Hub (`HubComponent`) | 3 Game selection cards, player counts, badges, and artwork at `/` | M1 | ORIGINAL_REQUEST §Route Map |
| 2 | Universal Room Code Parser & Join | Single join input routing `M...` to Mahjong, `P...` to Monopoly, `A...` to Avalon | M1 | ORIGINAL_REQUEST §Route Map |
| 3 | Deep-Link Invite Redirector | Reads `?game=<id>&room=<code>` on `/` and navigates to target lobby | M1 | ORIGINAL_REQUEST §Route Map |
| 4 | Multi-Game Shell Context (`ShellUiService`) | Tracks `activeGame`, theme accents, header badge, and player nickname | M1 | ORIGINAL_REQUEST §Shared Core |
| 5 | Universal Header & Navigation | Pavilion branding, active game pill, return to Hub action, audio controls | M1 | ORIGINAL_REQUEST §Shared Core |
| 6 | Contextual Rulebook Modal | Multi-game rulebook dialog with tabbed instructions per active game | M1 | ORIGINAL_REQUEST §Shared Core |
| 7 | Web Audio & Voice Synthesizer | Procedural Web Audio SFX and SpeechSynthesis announcements | M1 | ORIGINAL_REQUEST §Shared Core |
| 8 | Generalized P2P Room Transport | Dual PeerJS/BroadcastChannel transport with room tokens and per-seat view hook | M1 | ORIGINAL_REQUEST §Shared Core |
| 9 | Mahjong Route Migration | Clean migration to `/mahjong/lobby` and `/mahjong/table` with legacy redirects | M2 | ORIGINAL_REQUEST §Route Map |
| 10 | Mahjong Rules Preservation | Zero regression on HK 4P (144 tiles) & MY 3P Fly (84 tiles, 打飛, 換飛) | M2 | ORIGINAL_REQUEST §1 |
| 11 | Full 40-Space Malaysia Board Data | 11×11 ring, RM currency, 22 landmarks in 8 color groups, 4 hubs, 2 utilities, taxes | M3 | ORIGINAL_REQUEST §Game 2 |
| 12 | Authentic Action Decks | 16 Nasib (Chance) & 16 Dana Komuniti (Community Chest) cards routing fines to Pot | M3 | ORIGINAL_REQUEST §Game 2 |
| 13 | Saidina House Rules Engine | Free Parking Jackpot Pot, No Rent in Jail, Even-build houses/hotels, Mortgages | M3 | ORIGINAL_REQUEST §Game 2 |
| 14 | Trading, Auctions & Win Modes | Cash/Property trades, configurable Auction toggle, Last Tycoon vs Round Limit | M3 | ORIGINAL_REQUEST §Game 2 |
| 15 | Monopoly Tactical AI Bot | AI evaluation for purchasing, auction bidding, 3-house focus, distress mortgage, jail exit | M3 | ORIGINAL_REQUEST §Game 2 |
| 16 | Monopoly P2P Session & Sanitization | Host holds shuffled deck; guests receive sanitized `MonopolyPlayerView` | M4 | ORIGINAL_REQUEST §Game 2 |
| 17 | Responsive 11×11 Monopoly Board UI | Desktop 11×11 CSS Grid with center jackpot + mobile cards view (`<= 768px`) | M4 | ORIGINAL_REQUEST §Game 2 |
| 18 | Avalon Player Count & Quest Matrix | 5–10 players, Quest 1–5 team sizes, Quest 4 2-fail rule for 7+ players, Hammer track | M5 | ORIGINAL_REQUEST §Game 3 |
| 19 | Avalon Roles & Night-Vision Matrix | Merlin, Percival, Servant, Assassin, Morgana, Mordred, Oberon, Minion sanitization | M5 | ORIGINAL_REQUEST §Game 3 |
| 20 | Lady of the Lake & CSPRNG Quest Shuffle | Lady of Lake module, secret private result, Fisher-Yates shuffled quest card reveal | M5 | ORIGINAL_REQUEST §Game 3 |
| 21 | Offline-Comms Privacy Shield UI | Zero in-game chat; touch/click-and-hold privacy overlay concealing secret knowledge | M5 | ORIGINAL_REQUEST §Game 3 |
| 22 | Avalon Deduction AI Bot | Bayesian trust model, team proposal heuristics, voting, and Assassin target scoring | M5 | ORIGINAL_REQUEST §Game 3 |
| 23 | Avalon P2P Session & UI Table/Lobby | Avalon lobby with role toggles, table with quest/vote history, assassination modal | M5 | ORIGINAL_REQUEST §Game 3 |
| 24 | Trilingual i18n Dictionary Parity | Parity across `en.json`, `zh.json`, `ms.json` for HUB, MONOPOLY, and AVALON | M1-M5 | AGENTS.md §5 |
| 25 | E2E Testing Suite & Quality Gates | Comprehensive 4-Tier test suite + Tier 5 Adversarial Hardening (>= 80% line / >= 70% branch) | M6 | ORIGINAL_REQUEST §Gate |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Shared Shell, Hub & P2P Transport | `src/app/core/services/shell-ui.service.ts`, `p2p-room.transport.ts`, `HubComponent`, Header refactor, route setup, context script fix | none | DONE |
| 2 | M2: Mahjong Route Migration | Relocate Mahjong to `/mahjong/*`, wire into ShellUiService, verify 0 rule regressions | M1 | DONE |
| 3 | M3: Monopoly Engine, Board & AI Bot | 40-space board data, 32 action cards, rules engine (Saidina rules), tactical AI bot, engine unit specs | M1 | DONE |
| 4 | M4: Monopoly Session & UI Board/Lobby | MonopolySessionService, 11×11 board component, lobby component, modals, i18n | M3 | DONE |
| 5 | M5: Avalon Engine, Roles, Bot & UI | Avalon engine, 5–10P matrices, night vision sanitizer, deduction AI, lobby, table, privacy shield, i18n | M1 | DONE |
| 6 | M6: Final E2E Suite & Hardening | Execute 100% of E2E test suite (Tiers 1–4), Tier 5 adversarial hardening, verification checklist | M2, M4, M5, TEST_READY | DONE |

---

## Interface Contracts

### ShellUiService ↔ Game Sessions
- `activeGame: Signal<'hub' | 'mahjong' | 'monopoly' | 'avalon'>`
- `activeRoomCode: Signal<string | null>`
- `openRulebook(game?: 'mahjong' | 'monopoly' | 'avalon'): void`
- `playSfx(type: 'click' | 'deal' | 'dice' | 'alert' | 'fanfare' | 'fail'): void`
- `speak(text: string, lang?: string): void`
- `playerNickname: WritableSignal<string>`

### P2PRoomTransport<TState, TView, TAction>
- `createRoom(gamePrefix: 'M' | 'P' | 'A', customCode?: string): Promise<string>`
- `joinRoom(roomCode: string, guestToken?: string): Promise<boolean>`
- `broadcastAction(action: TAction): void`
- `onViewUpdated: Observable<TView>`
- `buildPlayerView: (state: TState, seatIdx: number) => TView`

### Monopoly Engine Contract
- `createInitialMonopolyState(settings: MonopolyLobbySettings, seats: MonopolySeat[]): MonopolyState`
- `applyMonopolyAction(state: MonopolyState, action: MonopolyAction): MonopolyState`
- `getMonopolyPlayerView(state: MonopolyState, viewerSeatIdx: number): MonopolyPlayerView`
- `evaluateMonopolyBotAction(view: MonopolyPlayerView, botSeatIdx: number): MonopolyAction | null`

### Avalon Engine Contract
- `createInitialAvalonState(settings: AvalonLobbySettings, seats: AvalonSeat[]): AvalonState`
- `applyAvalonAction(state: AvalonState, action: AvalonAction): AvalonState`
- `getAvalonPlayerView(state: AvalonState, viewerSeatIdx: number): AvalonPlayerView`
- `evaluateAvalonBotAction(view: AvalonPlayerView, botSeatIdx: number): AvalonAction | null`

---

## Code Layout
```
src/app/
├── app.component.ts / html / scss
├── app.routes.ts
├── core/
│   └── services/
│       ├── shell-ui.service.ts
│       ├── p2p-room.transport.ts
│       ├── sound.service.ts
│       └── translate.service.ts
├── layout/
│   └── header/
│       └── app-header.component.ts / html / scss
├── pages/
│   ├── hub/
│   │   └── hub.component.ts / html / scss
│   └── mahjong/
│       ├── mahjong-lobby.component.ts / html / scss
│       └── mahjong-table.component.ts / html / scss
├── games/
│   ├── monopoly/
│   │   ├── models/monopoly.model.ts
│   │   ├── data/
│   │   │   ├── monopoly-board.data.ts
│   │   │   └── monopoly-cards.data.ts
│   │   ├── services/
│   │   │   ├── monopoly-engine.service.ts
│   │   │   ├── monopoly-bot.service.ts
│   │   │   └── monopoly-session.service.ts
│   │   └── components/
│   │       ├── monopoly-lobby/
│   │       └── monopoly-board/
│   └── avalon/
│       ├── models/avalon.model.ts
│       ├── data/avalon-config.data.ts
│       ├── services/
│       │   ├── avalon-engine.service.ts
│       │   ├── avalon-bot.service.ts
│       │   └── avalon-session.service.ts
│       └── components/
│           ├── avalon-lobby/
│           └── avalon-table/
```
