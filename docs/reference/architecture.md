# Architecture & Domain Services Reference

## 1. Directory Structure

Following `ocpi-hub-portal` conventions:

- `src/app/core/models/mahjong.model.ts`: Strict TypeScript domain interfaces (`TileSpec`, `GameRules`, `MatchState`, `PlayerView`, `SessionSnapshot`).
- `src/app/core/utils/tiles.util.ts`: `Map`-backed 144-tile (`4p`) and 84-tile (`3p`) deck builders with CSPRNG 3-pass wash (`洗牌`), 3d6 dice wall cut (`擲骰開門`), tile metadata, and hand sorting.
- `src/app/core/services/scorer.service.ts`: Exact backtracking meld/pair + `飛` wildcard solver, special hands (`十三么`, `七對子`, `九蓮寶燈`, `八仙過海`, `四飛爆胡`), Tenpai waiting-tile analyzer, and Half-Spicy (`半辣上`) payout calculator.
- `src/app/core/services/engine.service.ts`: Authoritative state machine (`turn`, `claim`, `robKong`, `handOver`), authentic 4-tile block dealing (`四張一棟`) + dealer jump-draw (`跳牌`), dead-wall flower replacement (`補花`), manual `tileIds` meld validation (including `3p` `飛` wildcards), wrong-call / false-Hu (`詐糊` / `錯章`) point penalties, and claim priority (`食糊 > 槓/碰 > 上`).
- `src/app/core/services/bot.service.ts`: Tactical 5-Fan AI with exact 1-ply Tenpai ukeire search, multi-archetype planning (All Pongs, Seven Pairs, Pure/Mixed Flush, Honor Power), sequence/triplet preservation, and defensive danger reading.
- `src/app/core/services/mahjong-session.service.ts`: Signal store (`snapshot`, `waitingTiles`, `autoPass`), `HostSession`, `GuestSession`, Web Audio tile clack + penalty buzzer synthesis, SpeechSynthesis Cantonese callouts, and query-preserving Router transitions (`/lobby` ↔ `/table`).
- `src/app/layout/header/`: Top navigation bar with `简中 / EN` switcher, room invite copy pill, rulebook trigger, and sound toggle.
- `src/app/pages/lobby/` & `src/app/pages/table/`: Standalone routed feature pages.
- `src/app/shared/`: `TileComponent` (`mj-tile` SVG renderer), `RulebookDialogComponent`, and `TranslatePipe`.
