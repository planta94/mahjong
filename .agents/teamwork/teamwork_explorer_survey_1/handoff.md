# Survey Findings & Multi-Game Pavilion Architecture Handoff

## 1. Observation

### 1.1 Existing Project State & Tool Verifications
- **TypeScript Compiler**: `npx tsc --noEmit` exited cleanly with code 0 (no type errors).
- **ESLint**: `npm run lint` exited cleanly with code 0 (0 errors, 0 warnings across `src/**/*.ts`). ESLint configuration in `eslint.config.cjs:11-20` enforces `eslint-plugin-security` (`security/detect-object-injection`), `@typescript-eslint/no-explicit-any`, and bans `bypassSecurityTrustHtml/Script/Url`.
- **Vitest Unit Tests & V8 Coverage**:
  - `npm run test:ci` executed 7 test files, 20 tests total: **20 passed (0 failed)**.
  - Overall coverage: **82.42% Statements, 71.20% Branches, 76.19% Functions, 84.62% Lines**.
  - All coverage metrics satisfy `angular.json:85-88` threshold requirements (`branches: 70%`, `lines: 80%`). Note: branch coverage is currently at 71.20%, which is close to the 70% floor, so new game engines and components must maintain >= 75% branch coverage to prevent gating drops.
- **Production Build**: `npm run build` compiled successfully via `@angular/build:application`. Initial chunk: `440.51 kB` (well below 2MB budget in `angular.json:46`).
- **Context Integrity Gate**:
  - Command `node scripts/verify-agent-context.mjs` failed with:
    ```
    [Agent Context Gate FAILED]
      - Duplicate .agents/ exists.
    ```
  - Directly observed in `scripts/verify-agent-context.mjs:92`:
    `assertCondition(!fs.existsSync(path.join(repoRoot, '.agents')), 'Duplicate .agents/ exists.');`
    This check expects no `.agents` directory at the repository root. When the Teamwork orchestrator created `.agents/teamwork/` for agent coordination metadata, this assertion failed. The check was originally meant to ensure agents don't leave stray configuration files outside `AGENTS.md`.

### 1.2 Routing & Component Architecture
- **Current Routes** (`src/app/app.routes.ts:5-10`):
  ```typescript
  export const routes: Routes = [
    { path: '', pathMatch: 'full', component: LobbyComponent },
    { path: 'lobby', component: LobbyComponent },
    { path: 'table', component: TableComponent },
    { path: '**', redirectTo: '' },
  ];
  ```
  Both `/` and `/lobby` directly mount `LobbyComponent` (Mahjong).
- **Current App Shell** (`src/app/app.component.ts:1-17` and `src/app/app.component.html:1-11`):
  - `AppComponent` directly injects `MahjongSessionService`:
    ```typescript
    export class AppComponent {
      readonly session = inject(MahjongSessionService);
    }
    ```
  - App shell template embeds `<app-header />`, `<router-outlet />`, and `@if (session.showRulebook()) { <app-rulebook-dialog /> }`.
- **Current Header** (`src/app/layout/header/app-header.component.ts:15-32` and `html:1-123`):
  - Injects `MahjongSessionService` directly for Mahjong badge (`3p` vs `4p`), fan summary (`minFan` / `maxFan`), room code copy button, rulebook modal toggle, BGM toggle, sound toggle, and leave session button.

### 1.3 Mahjong P2P Networking & State Sanitization
- **Room Code & Tokens** (`src/app/core/services/mahjong-session.service.ts:18-20, 109-159`):
  - `PEER_PREFIX = 'hkmj-v1-room-'`
  - `CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'` (alphanumeric, no confusing characters like 0/O/1/I)
  - `extractRoomCode()` extracts uppercase alphanumeric code (up to 8 chars) from raw string or `?room=...` param.
  - `getGuestToken(roomCode)` isolates guest tokens per room (`hkmj_guest_token_${roomCode}`) in `sessionStorage` to prevent tab collision when opening multiple windows locally.
  - Host token is generated randomly: `host_${randomUUID()}`.
- **State Sanitization (`HKMJ-P2P-CHECK-01`)**:
  - `engine.service.ts:1443-1484` (`getPlayerView`):
    - `wall` is omitted, returning `wallCount: state.wall.length`.
    - Concealed hands: `revealAll = state.phase === 'handOver' || idx === viewerSeat`. If not `revealAll`, `hand` is `null` and only `handCount` is exposed.
    - `lastDrawnId` is exposed only to `idx === viewerSeat`.
    - Concealed Kongs: masked as `['back', 'back', 'back', 'back']` until `handOver`.
    - Legal actions are computed strictly for `viewerSeat`.
  - Outbound P2P sync in `mahjong-session.service.ts:590-621`:
    - `seats: this.lobby.seats.map((s) => ({ ...s, token: null }))` strips auth tokens before broadcast to peers.
    - Data is transmitted via both `PeerJS` DataChannel (`reliable: true`, `serialization: 'json'`) and `BroadcastChannel('hkmj-bc-${roomCode}')` fallback.

### 1.4 i18n Dictionary Structure
- Files: `public/assets/i18n/zh.json`, `en.json`, `ms.json`.
- Enforced by `src/app/core/services/i18n-parity.spec.ts:1-70`:
  - 100% key set parity across all 3 files.
  - Zero empty strings.
  - Nested keys are flattened using dot notation (e.g., `HEADER.BRAND`, `LOBBY.HERO_TITLE`).
  - Active sections currently: `HEADER`, `LOBBY`, `TABLE`, `RULEBOOK`.

---

## 2. Logic Chain

1. **Premise 1**: The application needs to host three games (Mahjong, Monopoly, Avalon) in a unified SPA under `/` (Hub), with dedicated routes for each game (`/mahjong/*`, `/monopoly/*`, `/avalon/*`).
   - *Supported by*: `ORIGINAL_REQUEST.md:7-14`, `Observation 1.2`.
2. **Premise 2**: Existing Mahjong users and bookmarked URLs must not break (`/lobby`, `/table`, `?room=XYZ`).
   - *Supported by*: `app.routes.ts:6-8`, `Observation 1.2`.
   - *Inference*: `/lobby` and `/table` must redirect to `/mahjong/lobby` and `/mahjong/table` while preserving query parameters (`?room=XYZ`).
3. **Premise 3**: Current `AppComponent` and `AppHeaderComponent` are tightly coupled to `MahjongSessionService`.
   - *Supported by*: `app.component.ts:15`, `app-header.component.ts:16`, `Observation 1.2`.
   - *Inference*: A game-agnostic `ShellUiService` is required to mediate between the shell layout (Header, theme, universal audio, active game rulebook, nickname persistence) and game-specific sessions.
4. **Premise 4**: P2P state sanitization, Host/Guest lifecycle, token isolation, and Dual-channel transport (PeerJS + BroadcastChannel) are duplicated if implemented independently per game.
   - *Supported by*: `mahjong-session.service.ts:212-846`, `Observation 1.3`.
   - *Inference*: A generic transport module `p2p-room.transport.ts` should define the core host/guest protocol, channel management, signaling reconnection, and seat token stripping, parameterizable by `<TState, TView, TAction>`. To ensure zero regressions, `MahjongSessionService` can wrap this transport or maintain its exact signature for backward compatibility.
5. **Premise 5**: Adding Monopoly and Avalon adds new UI strings. Any disparity between `en.json`, `zh.json`, and `ms.json` will fail `i18n-parity.spec.ts`.
   - *Supported by*: `i18n-parity.spec.ts:25-35`, `Observation 1.4`.
   - *Inference*: All new keys for Hub, Monopoly, and Avalon must be added simultaneously across all three language dictionaries in lockstep, with identical structures and valid translations.

---

## 3. Caveats

1. **Context Verification Gate Script**:
   `scripts/verify-agent-context.mjs:92` fails when `.agents` exists. Because agent rules strictly prohibit modifying source/scripts unless part of implementation, this survey notes the exact reason for the failure. During implementation, the script should be updated to check `!fs.existsSync(path.join(repoRoot, '.agents/AGENTS.md'))` or ignore `.agents/teamwork/`.
2. **PeerJS Signaling Server**:
   WebRTC connections rely on the public `0.peerjs.com:443` signaling service with fallback to `BroadcastChannel`. In environments without internet access or with strict firewalls, WebRTC signaling gracefully degrades to `BroadcastChannel` (same-browser tabs) or local offline bots, as verified in `mahjong-session.service.ts:375-379`.
3. **Audio Context Autoplay Policy**:
   Browsers restrict Web Audio / HTMLAudio playback until user gesture. Both `MahjongSessionService` and the proposed `ShellUiService` wrap audio instantiation and play calls in `try / catch` blocks to avoid unhandled rejections prior to user interaction.

---

## 4. Conclusion & Architecture Proposal

### 4.1 Target Architecture Blueprint

```
src/app/
├── app.component.ts / html / scss (Decoupled shell with ShellUiService)
├── app.config.ts
├── app.routes.ts (Hub at '/', redirects for '/lobby' & '/table', child routes per game)
├── layout/
│   └── header/
│       ├── app-header.component.ts / html / scss (Contextual brand, room pill, rulebook per active game)
├── pages/
│   ├── hub/
│   │   ├── hub.component.ts / html / scss (3 Game cards, universal room code parser & joiner)
│   ├── mahjong/
│   │   ├── mahjong-lobby.component.ts / html / scss
│   │   ├── mahjong-table.component.ts / html / scss
│   ├── monopoly/
│   │   ├── monopoly-lobby.component.ts / html / scss
│   │   ├── monopoly-table.component.ts / html / scss
│   │   └── components/ (board, trade-dialog, auction-dialog, property-card)
│   ├── avalon/
│   │   ├── avalon-lobby.component.ts / html / scss
│   │   ├── avalon-table.component.ts / html / scss
│   │   └── components/ (role-card, quest-vote, lady-dialog, night-vision-overlay)
├── core/
│   ├── models/
│   │   ├── party.model.ts (GameId, ShellState, UniversalRoomInfo)
│   │   ├── mahjong.model.ts (Existing unaltered)
│   │   ├── monopoly.model.ts (Spaces, deeds, mortgages, trades, auctions)
│   │   └── avalon.model.ts (Roles, loyalties, quest matrix, vote phases)
│   ├── services/
│   │   ├── shell-ui.service.ts (activeGame, theme, sound, BGM, nickname migration, rulebook modal)
│   │   ├── p2p-room.transport.ts (Generic Host/Guest P2P engine with PeerJS + BroadcastChannel)
│   │   ├── mahjong-session.service.ts (Preserved API, zero regression)
│   │   ├── monopoly-engine.service.ts & monopoly-session.service.ts
│   │   ├── avalon-engine.service.ts & avalon-session.service.ts
│   │   ├── translate.service.ts
│   │   └── bot.service.ts / scorer.service.ts / engine.service.ts (Mahjong untouched)
│   └── utils/
│       ├── tiles.util.ts (Mahjong untouched)
│       ├── monopoly.util.ts (40 spaces, rents, mortgage formulas, bot trade evaluation)
│       └── avalon.util.ts (Role distributions, quest sizing matrix, assassination solver)
└── shared/
    ├── pipes/translate.pipe.ts
    ├── rulebook-dialog/ (Mahjong, Monopoly, Avalon rulebook dialogs)
    └── tile/tile.component.ts (Mahjong SVG tiles)
```

### 4.2 Detailed Component Specifications

#### A. Universal Room-Code & Deep-Link Parser
- **Code Prefixes**:
  - `M...` (e.g. `M8X4K`) -> Mahjong
  - `P...` (e.g. `P9B2Q`) -> Monopoly ('P' for Property / Party Monopoly)
  - `A...` (e.g. `A7R3T`) -> Avalon ('A' for Avalon)
- **Universal Parser Specification**:
  ```typescript
  export type GameId = 'mahjong' | 'monopoly' | 'avalon';

  export function parseUniversalRoomCode(input: string): { game: GameId; roomCode: string } {
    const trimmed = input.trim();
    // 1. Check URL parameters (?game=...&room=... or ?room=...)
    const urlMatch = /[?&]game=([a-z]+)/i.exec(trimmed);
    const roomMatch = /[?&]room=([A-Za-z0-9]+)/i.exec(trimmed);
    const rawCode = roomMatch?.at(1) ?? trimmed.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const code = rawCode.slice(0, 8);

    if (urlMatch?.at(1)) {
      const g = urlMatch.at(1)?.toLowerCase();
      if (g === 'monopoly' || g === 'avalon' || g === 'mahjong') {
        return { game: g, roomCode: code };
      }
    }

    // 2. Prefix-based resolution
    if (code.startsWith('P')) return { game: 'monopoly', roomCode: code };
    if (code.startsWith('A')) return { game: 'avalon', roomCode: code };
    if (code.startsWith('M')) return { game: 'mahjong', roomCode: code };

    // 3. Backward-compatibility fallback: any legacy code or unrecognized code routes to Mahjong
    return { game: 'mahjong', roomCode: code };
  }
  ```

#### B. HubComponent (`/`)
- **Route**: `{ path: '', pathMatch: 'full', component: HubComponent }`
- **Features**:
  - Deep-link interceptor: If query parameters `?game=...&room=...` or `?room=...` are detected on arrival at `/`, `HubComponent` parses them using `parseUniversalRoomCode` and immediately redirects to `/${game}/lobby?room=${roomCode}` via `replaceUrl: true`.
  - Universal Room Joiner: Top-level `.portal-input` accepting any code or invite URL. A single "Join Room / 加入房間" button parses the target game and navigates accordingly.
  - Three Rich Feature Cards:
    1. **HK & Authentic Malaysian 3P Fly Mahjong (港馬麻雀館)**:
       - 3–4 players, 84/144 tiles, 5-fan min / 10-fan cap, Half-Spicy, Discarder-Pays-All, 飛牌 wildcards (打飛, 換飛).
       - CTA: "Enter Mahjong / 進入麻雀館" -> `/mahjong/lobby`.
    2. **Malaysia Landmarks Monopoly (大馬地標大富翁)**:
       - 2–6 players, full 40-space 11×11 ring, RM currency, Malaysian landmarks (KLCC, Penang Bridge, Kinabalu, etc.), Houses/Hotels, Mortgages, Bot & Player Trading, Auctions, Free Parking jackpot & Jail rules. Play modes: "Last Player Standing" or "Round Limit (Net Worth Wins)".
       - CTA: "Enter Monopoly / 進入大富翁" -> `/monopoly/lobby`.
    3. **The Resistance: Avalon (阿瓦隆)**:
       - 5–10 players, official role matrix + AI Bots, Merlin, Percival, Assassin, Morgana, Mordred, Oberon, Loyal Servants, optional Lady of the Lake, anti-cheat Night Vision screen privacy, offline communications.
       - CTA: "Enter Avalon / 進入阿瓦隆" -> `/avalon/lobby`.

#### C. ShellUiService (`shell-ui.service.ts`)
- Manages global pavilion context:
  - `activeGame: signal<GameId | null>` (dynamically updated from router events or set by feature pages).
  - `nickname: signal<string>` (migrated from `localStorage.getItem('party_nickname') || localStorage.getItem('hkmj_nickname') || '雀神'`). Any save persists to both `party_nickname` and `hkmj_nickname` for complete backward compatibility.
  - `soundEnabled: signal<boolean>` and `bgmEnabled: signal<boolean>`.
  - Web Audio synthesizers:
    - Mahjong tile clack (`playClack(freq)`)
    - Penalty buzzer (`playPenaltyBuzzer()`)
    - Monopoly dice roll & cash register chime (`playCashChime()`, `playDiceRoll()`)
    - Avalon quest victory trumpet & fail chord (`playQuestSuccess()`, `playQuestFail()`)
    - Button click & UI interaction pings
  - Contextual theming:
    - Sets `document.body.dataset['theme'] = activeGame() ?? 'hub'`
    - CSS variable overrides:
      - Mahjong: Jade Felt (`--felt-center: #125842; --felt-edge: #07281e;`)
      - Monopoly: Tycoon Emerald & Gold (`--felt-center: #134e3f; --felt-edge: #06231a; --accent-color: #eab308;`)
      - Avalon: Arthurian Midnight & Crimson (`--felt-center: #1e1b4b; --felt-edge: #0a091e; --accent-color: #dc2626;`)
      - Hub: Velvet Slate (`--felt-center: #0f172a; --felt-edge: #020617;`)
  - Rulebook Modal dispatcher:
    - `showRulebook: signal<boolean>`
    - Displays `MahjongRulebook`, `MonopolyRulebook`, or `AvalonRulebook` inside a standard compliant modal (`max-width: min(720px, 95vw); max-height: 90vh; max-height: 55vh; overflow-y: auto;` with bottom-only close action).

#### D. Generalized P2P Transport (`p2p-room.transport.ts`)
- Generic abstraction:
  ```typescript
  export interface P2pRoomConfig<TState, TView, TAction> {
    gameId: GameId;
    roomCode: string;
    peerPrefix: string;
    buildPlayerView: (state: TState, seatIdx: number) => TView;
    applyAction: (state: TState, seatIdx: number, action: TAction) => void;
  }
  ```
- **HostSession**:
  - Authoritative holder of `TState`.
  - Generates seat-sanitized views: `buildPlayerView(this.state, seatIdx)`.
  - Strips `seat.token` in all broadcast snapshots (`token: null`).
  - Manages dual-channel communication (`PeerJS` DataChannel + `BroadcastChannel`).
  - Implements auto-reconnect signaling for mobile sleep / tab visibility changes.
- **GuestSession**:
  - Connects to room via `BroadcastChannel` (first 120ms fast path for same-browser tabs) and `PeerJS` (WebRTC).
  - Stores room-scoped token `party_guest_${gameId}_${roomCode}` in `sessionStorage` (preventing seat collisions across duplicate tabs).
  - Exposes `onUpdate((snapshot: SessionSnapshot<TView>) => void)` and `sendAction(action: TAction)`.

#### E. Routing & Backward-Compatibility Strategy
- `src/app/app.routes.ts`:
  ```typescript
  export const routes: Routes = [
    { path: '', pathMatch: 'full', component: HubComponent },
    // Backward compatibility redirects for existing links:
    { path: 'lobby', redirectTo: 'mahjong/lobby' },
    { path: 'table', redirectTo: 'mahjong/table' },
    // Mahjong module
    {
      path: 'mahjong',
      children: [
        { path: '', pathMatch: 'full', redirectTo: 'lobby' },
        { path: 'lobby', component: MahjongLobbyComponent },
        { path: 'table', component: MahjongTableComponent },
      ],
    },
    // Monopoly module
    {
      path: 'monopoly',
      children: [
        { path: '', pathMatch: 'full', redirectTo: 'lobby' },
        { path: 'lobby', component: MonopolyLobbyComponent },
        { path: 'table', component: MonopolyTableComponent },
      ],
    },
    // Avalon module
    {
      path: 'avalon',
      children: [
        { path: '', pathMatch: 'full', redirectTo: 'lobby' },
        { path: 'lobby', component: AvalonLobbyComponent },
        { path: 'table', component: AvalonTableComponent },
      ],
    },
    { path: '**', redirectTo: '' },
  ];
  ```

#### F. Malaysia Landmarks Monopoly Architecture
- **Board Layout**: Full 40-space 11×11 ring matching authentic Saidina/Monopoly track:
  - 22 Street properties across 8 color groups (Brown, Light Blue, Pink, Orange, Red, Yellow, Green, Dark Blue) featuring Malaysian landmarks (Alor Setar Tower, Ipoh Station, Jonker St, Kuching Waterfront, Cameron Highlands, Batu Caves, Mount Kinabalu, Penang Hill, A Famosa, Redang Island, KLCC Petronas Towers, Merdeka 118, etc.).
  - 4 Transportation spaces (KL Sentral, Penang Sentral, JB Sentral, ECRL).
  - 2 Utilities (TNB Tenaga Nasional, Air Selangor).
  - 4 Corners: GO (Collect RM200), Jail (Just Visiting / In Jail), Free Parking (Jackpot), Go To Jail.
  - Event spaces: Chance & Community Chest cards (RM rewards/penalties, travel cards, repairs).
  - Tax spaces: Income Tax (RM200) and Super Tax (RM100).
- **Core Mechanics**:
  - Currency: RM (Ringgit Malaysia).
  - Starting cash: RM1,500.
  - Dice roll: 2d6 with doubles logic (roll again on double, 3 doubles in a row goes to Jail).
  - Free Parking Jackpot: All taxes, bails, and penalty fees accumulate into Free Parking. Landing on Free Parking collects the jackpot.
  - Jail House Rule: Players in Jail do NOT collect rent.
  - Houses & Hotels: Up to 4 houses + 1 hotel per property when monopoly color set is owned.
  - Mortgages: 50% mortgage payout; 55% (50% + 10% fee) to unmortgage.
  - Player & Bot Trading: Cash and properties exchange with AI utility evaluation.
  - Auctions: Configurable toggle in lobby. If player passes on unowned property, auction begins with RM10 min bid.
  - Win Modes: "Last Player Standing" or "Round Limit (Net Worth Wins)".

#### G. The Resistance: Avalon Architecture
- **Player Count**: 5 to 10 players (Solo vs Bots, Hybrid P2P + Bots, or Full P2P).
- **Official Quest Matrix**:
  - 5p: Q1(2), Q2(3), Q3(2), Q4(3), Q5(1) — 3 Good, 2 Evil
  - 6p: Q1(2), Q2(3), Q3(4), Q4(3), Q5(4) — 4 Good, 2 Evil
  - 7p: Q1(2), Q2(3), Q3(3), Q4(4*), Q5(4) — 4 Good, 3 Evil (*2 fails required on Q4)
  - 8p: Q1(3), Q2(4), Q3(4), Q4(5*), Q5(5) — 5 Good, 3 Evil (*2 fails required on Q4)
  - 9p: Q1(3), Q2(4), Q3(4), Q4(5*), Q5(5) — 6 Good, 3 Evil (*2 fails required on Q4)
  - 10p: Q1(3), Q2(4), Q3(4), Q4(5*), Q5(5) — 6 Good, 4 Evil (*2 fails required on Q4)
- **Role System**:
  - Good: Merlin, Percival, Loyal Servants of Arthur.
  - Evil: Assassin, Morgana, Mordred, Oberon, Minions of Mordred.
  - Optional Module: Lady of the Lake (7+ players).
- **Privacy & Anti-Cheat**:
  - Night Vision Screen Privacy: "Hold to Reveal" privacy curtain overlay for viewing secret role card and private alignments, protecting against shoulder surfing in physical rooms.
  - Quest Voting: Secret submission (Good must submit Success; Evil may submit Success or Fail). Cards are shuffled before revealing outcome.
  - Team Nomination Voting: Simultaneous public reveal (Approve / Reject).
  - Offline Communication: Game engine handles state, nominations, voting, and resolution without in-app chat.
  - Assassination Phase: If Good wins 3 quests, Assassin enters target selection to shoot Merlin. If correct, Evil wins.

#### H. i18n Strategy & Lockstep Parity
- Add comprehensive translations across `public/assets/i18n/{en,zh,ms}.json`:
  - `HUB`: Hero title, game cards, descriptions, universal join placeholders.
  - `MONOPOLY`: Board spaces, deed cards, action buttons, trading modal, auction modal, bankruptcy, rulebook.
  - `AVALON`: Roles, descriptions, quest phases, team voting, night vision prompts, lady of the lake, assassination, rulebook.
- Run `i18n-parity.spec.ts` to ensure 0 extra or missing keys and 100% non-empty values.

---

## 5. Verification Method

### 5.1 Quality Gate Commands
To verify the implementation independently at any stage, run:

1. **Verify TypeScript compilation**:
   ```bash
   npx.cmd tsc --noEmit
   ```
   *Expected outcome*: Exit code 0, 0 type errors.

2. **Verify ESLint & Security Invariants**:
   ```bash
   npm.cmd run lint
   ```
   *Expected outcome*: Exit code 0, 0 errors, 0 warnings, zero `eslint-disable`.

3. **Verify Unit Tests & V8 Coverage**:
   ```bash
   npm.cmd run test:ci
   ```
   *Expected outcome*: 100% passing tests across all spec files, with branch coverage >= 70% and line coverage >= 80%.

4. **Verify Production Build**:
   ```bash
   npm.cmd run build
   ```
   *Expected outcome*: Production bundle generation under 2MB total and component styles under 32kB.

### 5.2 Specific Files to Inspect
- `src/app/app.routes.ts`: Verify `/` maps to `HubComponent`, `/lobby` and `/table` redirect to `/mahjong/lobby` and `/mahjong/table`.
- `src/app/core/services/shell-ui.service.ts`: Verify game-agnostic signals, theming, audio synthesis, and rulebook coordination.
- `src/app/core/services/p2p-room.transport.ts`: Verify generic host/guest lifecycle, token stripping, and fallback channels.
- `src/app/core/services/i18n-parity.spec.ts`: Verify identical key counts and zero missing translations across `en.json`, `zh.json`, and `ms.json`.
- `src/app/pages/mahjong/`: Verify Mahjong game rules, 3P Fly mechanics (`打飛`, `換飛`), and bot AI operate with zero regressions.

### 5.3 Invalidation Conditions
The architecture or implementation is considered invalidated if:
- Any Mahjong test in `mahjong-session.service.spec.ts`, `engine.service.spec.ts`, `scorer.service.spec.ts`, or `bot.service.spec.ts` fails or changes existing rule semantics.
- Any 3P Mahjong game pads a 4th seat (violating `HKMJ-P2P-CHECK-01`).
- Opponent hands or concealed Kongs leak over P2P before `handOver`.
- `i18n-parity.spec.ts` detects any mismatched or empty keys.
- Modal dialogs contain top-right close `X` buttons or fail to enforce bottom action dismiss buttons.
- Any `.portal-input` is nested inside wrapper classes in component SCSS.
- Any `*.sh` script is inspected, created, modified, or executed.
