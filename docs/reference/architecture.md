# Architecture & Domain Services Reference

## 1. Directory Structure

Following `ocpi-hub-portal` conventions:

- `src/app/core/models/mahjong.model.ts`: Strict TypeScript domain interfaces (`TileSpec`, `GameRules`, `MatchState`, `PlayerView`, `SessionSnapshot`).
- `src/app/core/utils/tiles.util.ts`: `Map`-backed 144-tile (`4p`) and 84-tile (`3p`) deck builders, tile metadata, and hand sorting.
- `src/app/core/services/scorer.service.ts`: Exact backtracking meld/pair + `飛` wildcard solver, special hands (`十三么`, `七對子`, `九蓮寶燈`, `八仙過海`, `四飛爆胡`), Tenpai waiting-tile analyzer, and Half-Spicy (`半辣上`) payout calculator.
- `src/app/core/services/engine.service.ts`: Authoritative state machine (`turn`, `claim`, `robKong`, `handOver`), automatic flower/animal replacement (`補花`), claim priority (`食糊 > 槓/碰 > 上`), and dealer streak/wind rotation.
- `src/app/core/services/bot.service.ts`: 5-Fan-aware AI agent planning toward Pure/Mixed One Suit, All Pongs, Seven Pairs, or Honor/Flower combinations.
- `src/app/core/services/mahjong-session.service.ts`: Signal store (`snapshot`, `waitingTiles`), `HostSession`, `GuestSession`, Web Audio tile clack synthesis, SpeechSynthesis Cantonese callouts, and Router transitions (`/lobby` ↔ `/table`).
- `src/app/layout/header/`: Top navigation bar with `繁中 / EN / BM` switcher, room invite copy pill, rulebook trigger, and sound toggle.
- `src/app/pages/lobby/` & `src/app/pages/table/`: Standalone routed feature pages.
- `src/app/shared/`: `TileComponent` (`mj-tile` SVG renderer), `RulebookDialogComponent`, and `TranslatePipe`.
