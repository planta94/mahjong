## 2026-11-01T04:08:32Z
You are the Milestone 2 Worker for the Tabletop Royale (hk-mahjong) project, implementing the Monopoly Bot Trading Fix & Trade Result UX.

Your Working Directory: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\worker_monopoly_trading
Your Identity: worker_monopoly_trading

MANDATORY SPECIFICATION SOURCES:
- Read ORIGINAL_REQUEST.md: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
- Read SCOPE.md: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\orchestrator_1\SCOPE.md
- Read Approved Implementation Plan: C:\Users\chine\.gemini\antigravity\brain\effe94dd-f539-4d36-8797-edcb695c4bde\implementation_plan.md (Section 2: Monopoly Bot Trading Fix & Trade Result UX)
- Read required canonical references:
  - docs/reference/architecture.md
  - docs/reference/ui-conventions.md
  - docs/reference/testing-and-quality.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP (You may only modify/create these files):
- src/app/games/monopoly/models/monopoly.model.ts
- src/app/games/monopoly/services/monopoly-bot.service.ts
- src/app/games/monopoly/services/monopoly-bot.service.spec.ts
- src/app/games/monopoly/services/monopoly-engine.service.ts
- src/app/games/monopoly/services/monopoly-engine.service.spec.ts
- src/app/games/monopoly/services/monopoly-session.service.ts
- src/app/games/monopoly/services/monopoly-session.service.spec.ts
- src/app/games/monopoly/components/monopoly-board/monopoly-board.component.ts
- src/app/games/monopoly/components/monopoly-board/monopoly-board.component.html
- src/app/games/monopoly/components/monopoly-board/monopoly-board.component.scss
- src/app/games/monopoly/components/monopoly-board/monopoly-board.component.spec.ts

DETAILED IMPLEMENTATION REQUIREMENTS:
1. `monopoly.model.ts`:
   - Add `TradeReasonKey`:
     'MONOPOLY.TRADE_REASON_ACCEPTED' | 'MONOPOLY.TRADE_REASON_MUTUAL_SETS' | 'MONOPOLY.TRADE_REASON_PREMIUM_BUYOUT' | 'MONOPOLY.TRADE_REASON_CASH_RESERVE' | 'MONOPOLY.TRADE_REASON_GRANTS_MONOPOLY' | 'MONOPOLY.TRADE_REASON_LOW_VALUE' | 'MONOPOLY.TRADE_REASON_DECLINED_PLAYER'
   - Add `TradeOutcome` interface:
     { id: number; fromSeat: number; toSeat: number; accepted: boolean; reasonKey: TradeReasonKey; offerCash: number; requestCash: number; offerProperties: number[]; requestProperties: number[]; }
   - Add `lastTradeOutcome: TradeOutcome | null` to both `MonopolyMatchState` and `MonopolyPlayerView`.
   - Update `MonopolyAction` for acceptTrade and rejectTrade to accept optional `reasonKey?: TradeReasonKey`.
2. `monopoly-bot.service.ts`:
   - Replace the unconditional reject on `opponentGainsMonopoly` in `evaluateTradeResponse`:
     - Calculate `minReserve = gainsMonopoly ? 50 : 100`.
     - If `trade.requestCash > bot.cash || bot.cash - trade.requestCash + trade.offerCash < minReserve` -> reject with `'MONOPOLY.TRADE_REASON_CASH_RESERVE'`.
     - Mutual monopoly swap: if `gainsMonopoly && opponentGainsMonopoly`, accept if `netDelta >= -60` with `'MONOPOLY.TRADE_REASON_MUTUAL_SETS'`, else reject with `'MONOPOLY.TRADE_REASON_LOW_VALUE'`.
     - High premium buyout: if `opponentGainsMonopoly && !gainsMonopoly`, calculate `buyoutThreshold = Math.max(200, Math.round(requestedValue * 1.8) + 120)`. Accept if `offeredValue >= buyoutThreshold` with `'MONOPOLY.TRADE_REASON_PREMIUM_BUYOUT'`, else reject with `'MONOPOLY.TRADE_REASON_GRANTS_MONOPOLY'`.
     - If `gainsMonopoly && netDelta >= -80` -> accept with `'MONOPOLY.TRADE_REASON_ACCEPTED'`.
     - Default: accept if `netDelta >= 10` with `'MONOPOLY.TRADE_REASON_ACCEPTED'`, else reject with `'MONOPOLY.TRADE_REASON_LOW_VALUE'`.
3. `monopoly-engine.service.ts`:
   - Sanitize `offerCash` and `requestCash` with `Math.max(0, Math.floor(Number(...) || 0))`.
   - Reject empty (0-for-0) trades.
   - Set `state.lastTradeOutcome` with auto-incrementing `id` in `handleAcceptTrade` and `handleRejectTrade`.
4. `monopoly-session.service.ts`:
   - Play `'deal'` SFX on `acceptTrade` and `'fail'` SFX on `rejectTrade` (including bot response execution).
5. `monopoly-board.component.*`:
   - Clear `tradeRequestProps = []` and `tradeErrorKey` when `onTradeTargetChange()` is called.
   - Validate inputs inline inside `proposeTrade()` before sending; display `.trade-validation-error` inside modal if invalid (never close silently on validation error).
   - Show pending trade indicator while `view.pendingTrade?.fromSeat === session.mySeat()`.
   - Show a bounded **Trade Outcome Modal** (bottom close button only, max-width: 95vw, max-height: 90vh, no top-right X button) for `view.lastTradeOutcome` when `fromSeat === session.mySeat()` and outcome id has not been dismissed.
6. Quality & Unit Tests:
   - 0 `any`, 0 `eslint-disable`.
   - 0 `TestBed.overrideComponent`, 0 trivial assertions (.toBeTruthy, .toBeDefined, .not.toBeNull).
   - Update tests in all affected spec files.
   - Line coverage >= 80%, branch coverage >= 70%.

COMPLETION CRITERIA:
- All monopoly unit tests pass:
  `npx.cmd ng test --watch=false --no-coverage --include=src/app/games/monopoly/**/*.spec.ts`
- `npx.cmd tsc --noEmit` succeeds with 0 errors.
- `npm.cmd run lint` succeeds with 0 errors and 0 warnings.
- Write handoff report in `c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\worker_monopoly_trading\handoff.md`.
- Send message back to orchestrator when complete.


## 2026-11-01T04:32:18Z
**Context**: Monopoly Bot Trading Fix & Compilation Fix
**Content**: You are hereby authorized to update `src/app/core/services/game-session-manager.service.ts` to add `default: return false;` to the `switch (record.game)` in `resumeSavedGame()`. Please apply this change, run your tests and lint checks, and complete your handoff.
**Action**: Apply the fix in `game-session-manager.service.ts`, verify Monopoly specs (`npx ng test --watch=false --no-coverage --include=src/app/games/monopoly/**/*.spec.ts`), check `tsc --noEmit` and `npm run lint`, and submit your handoff report.
