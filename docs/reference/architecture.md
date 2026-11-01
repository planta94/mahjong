# Architecture & Domain Services Reference

## 1. Core Shell, Routing & Shared Transport (`src/app/core/`)

- `src/app/pages/hub/`: `HubComponent` — Pavilion landing page with 4 game launchers, nickname editor, universal P2P room join bar, and local saved-game resume/delete banner.
- `src/app/layout/header/`: `AppHeaderComponent` — Contextual top navigation bar rendering the active game's lobby-matching SVG emblem (or `favicon.svg` on Hub), localized game title (`document.title` synced per game), game badge, `"All Games"` hub launcher, context-aware `"Leave Room"` / `"Exit Match"` trigger, `简中 / EN` language switcher, room invite copy pill, contextual rulebook trigger, and SFX/BGM toggles.
- `src/app/core/services/shell-ui.service.ts`: `ShellUiService` — Root signal store for active game theming (`data-theme`), nickname/audio preferences, synthesized Web Audio SFX (auto-suspending `AudioContext` `1500ms` after playback and on mute), and `document` `visibilitychange` BGM/audio power management.
- `src/app/core/services/game-session-manager.service.ts`: `GameSessionManagerService` — Cross-game `localStorage` (`party_saved_game_v1`) serialization, hydration, and `ExitConfirmDialogComponent` coordination across Mahjong, Monopoly, Avalon, and Pandemic.
- `src/app/core/services/p2p-room.transport.ts`: `P2PRoomTransportService`, `GenericHostSession`, and `GenericGuestSession` — Universal game-prefixed room code parser/generator (`M*` Mahjong, `P*` Monopoly, `A*` Avalon, `D*` Pandemic), WebRTC (`peerjs`) + `BroadcastChannel` transport, and sanitized per-seat snapshot broadcasting.

## 2. Mahjong Module (`src/app/core/` & `src/app/pages/{lobby,table}/`)

- `src/app/core/models/mahjong.model.ts` & `src/app/core/utils/tiles.util.ts`: Strict domain types and `Map`-backed 144-tile (`4p`) & 84-tile (`3p`) CSPRNG deck builders, 3-pass wash (`洗牌`), and 3d6 wall cut (`擲骰開門`).
- `src/app/core/services/scorer.service.ts`: Exact backtracking meld/pair + `飛` wildcard solver, special hands (`十三么`, `七對子`, `九蓮寶燈`, `八仙過海`, `四飛爆胡`), Tenpai waiting-tile analyzer, and Half-Spicy (`半辣上`) payout calculator.
- `src/app/core/services/engine.service.ts`: Authoritative state machine (`turn`, `claim`, `robKong`, `handOver`), 4-tile block dealing (`四張一棟`), dead-wall flower replacement (`補花`), manual `tileIds` meld validation, wrong-call / false-Hu (`詐糊` / `錯章`) point penalties, and claim priority (`食糊 > 槓/碰 > 上`).
- `src/app/core/services/bot.service.ts` & `src/app/core/services/mahjong-session.service.ts`: Tactical 5-Fan AI (`BotService`) and signal session store (`MahjongSessionService`, `HostSession`, `GuestSession`) with idle-suspending Web Audio tile clacks and Cantonese TTS callouts.
- `src/app/pages/lobby/` & `src/app/pages/table/`: Standalone routed Mahjong lobby and 3P/4P tabletop components.

## 3. Monopoly, Avalon & Pandemic Modules (`src/app/games/` & `src/app/shared/`)

- `src/app/games/monopoly/`: 40-space board & `Nasib`/`Dana` card data, `MonopolyEngineService` (movement, jail, rent, houses/hotels, mortgages, auctions, bilateral cash/deed trades with localized `TradeOutcome` reasons, bankruptcy, Free Parking jackpot), `MonopolyBotService` (including mutual-monopoly swap & high-premium buyout evaluation), `MonopolySessionService`, `MonopolyLobbyComponent`, and `MonopolyBoardComponent` (`11×11` perimeter grid + mobile cards).
- `src/app/games/avalon/`: 5–10 player quest/ratio configuration, `AvalonEngineService` (role assignment, Night Vision knowledge builder, team proposals, Hammer vote track, Quest 4 two-fails rule, Lady of the Lake, Merlin assassination), `AvalonBotService` (Bayesian-style trust matrix & role-specific bluffing/deduction), `AvalonSessionService`, `AvalonLobbyComponent`, and `AvalonTableComponent`.
- `src/app/games/pandemic/`: 48-city world network & 7 specialist roles / 5 event cards, `PandemicEngineService` (authoritative turn machine, 4 actions/turn, movement flights, research stations, curing, outbreaks & chain reactions, epidemic resolution, infection stage), `PandemicBotService` (BFS heuristic co-op planner & role-aware priority engine), `PandemicSessionService` (Solo w/ Bots, 2–4 seat Solo Commander mode, and `D*` P2P co-op), `PandemicLobbyComponent`, and `PandemicBoardComponent`.
- `src/app/shared/`: `TileComponent` (`mj-tile` inline SVG), `RealDiceComponent` (`app-real-dice` inline SVG), `RulebookDialogComponent` (contextual 4-game rulebook), `ExitConfirmDialogComponent`, and `TranslatePipe`.
