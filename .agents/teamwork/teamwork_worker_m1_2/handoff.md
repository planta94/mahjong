# Handoff Report — Milestone 1 Integration Flaw Fixes

**Agent**: `teamwork_worker_m1_2`  
**Roles**: implementer, qa, specialist  
**Status**: COMPLETE / VERIFIED  
**Date**: 2026-10-31  

---

## 1. Observation

### Prior Issues Observed by Reviewer 1 & Challengers 1 & 2
1. **Missing Monopoly & Avalon routes in `src/app/app.routes.ts`**:
   - Navigating via Hub CTA buttons (`enterGame('monopoly')`, `enterGame('avalon')`) or universal room codes (`P1234`, `A5678`) hit the wildcard route `{ path: '**', redirectTo: '' }` and bounced back to root `/` or created redirect loops.
2. **Case sensitivity in `parseUniversalRoomCode()`**:
   - In `src/app/core/services/p2p-room.transport.ts:118-120`, URL query codes (`isUrl === true`) were not converted to uppercase. A URL with `?room=p12345` kept lowercase `p`, missing `PREFIX_TO_GAME_MAP` lookup and erroneously falling back to `mahjong` while registering lowercase PeerJS/BroadcastChannel rooms (`party-bc-p12345`).
3. **Dual-channel duplicate action dispatch in `GenericGuestSession`**:
   - In `src/app/core/services/p2p-room.transport.ts:543-547`, `sendAction()` dispatched unconditionally over both `this.conn.send()` and `this.bc?.postMessage()`, causing duplicate action executions on the Host when both channels were active.
4. **Theme and nickname desynchronization in `LobbyComponent`**:
   - `src/app/pages/lobby/lobby.component.ts` never invoked `this.shellUi.setActiveGame('mahjong')`, leaving `document.body.dataset['theme']` as `'hub'` and header badge as Pavilion when navigating to `/mahjong/lobby`.
   - `LobbyComponent.persistNickname()` loaded and saved only `hkmj_nickname`, ignoring `ShellUiService.setPlayerNickname()` and leaving `party_pavilion_nickname` stale.
5. **Query parameter dropping on session-less Table redirect**:
   - In `src/app/pages/table/table.component.ts:78`, `this.router.navigate(['/lobby'])` dropped query parameters when visited without an active match snapshot.
6. **Template warning NG8102**:
   - In `src/app/pages/table/table.component.html:519`, redundant `?? []` on non-null `res.winningBonus` triggered compiler warning NG8102.

### Direct File Modifications
- `src/app/pages/placeholder/game-placeholder.component.ts`:
  - Created standalone `GamePlaceholderComponent` for Monopoly (`/monopoly/lobby`, `/monopoly/board`) and Avalon (`/avalon/lobby`, `/avalon/table`).
  - Sets contextual themes (`'monopoly'`, `'avalon'`) and provides clean Hub return navigation.
- `src/app/pages/placeholder/game-placeholder.component.spec.ts`:
  - Added unit test suite covering theme assignment, game title rendering, and return navigation.
- `src/app/app.routes.ts:18-33`:
  - Configured child routes for `monopoly` (`lobby`, `board`) and `avalon` (`lobby`, `table`) mapping to `GamePlaceholderComponent`.
- `src/app/core/services/p2p-room.transport.ts:118-122, 543-547, 559-565`:
  - Updated `rawCode = (isUrl ? (roomMatch?.at(1) ?? '') : trimmed.replace(/[^A-Za-z0-9]/g, '')).toUpperCase();`.
  - Updated `sendAction()` and `sendJoin()` to send over active WebRTC connection if open (`if (this.conn?.open)`), else fallback to `this.bc?.postMessage()`.
- `src/app/pages/lobby/lobby.component.ts:19-21, 56-58, 60-62, 71-77`:
  - Implemented `OnInit`, injected `ShellUiService`.
  - Added `ngOnInit(): void { this.shellUi.setActiveGame('mahjong'); }`.
  - Updated `loadInitialNickname(): string { return this.shellUi.playerNickname(); }`.
  - Updated `persistNickname(): string { const clean = this.nickname.trim() || '雀友'; this.nickname = clean; this.shellUi.setPlayerNickname(clean); return clean; }`.
- `src/app/pages/lobby/lobby.component.html:15-16`:
  - Added `(blur)="persistNickname()"` and `(change)="persistNickname()"` to `#nickname-input`.
- `src/app/pages/table/table.component.ts:78`:
  - Updated session-less redirect to `this.router.navigate(['/lobby'], { queryParamsHandling: 'preserve' });`.
- `src/app/pages/table/table.component.html:519`:
  - Removed redundant `?? []` operator from `@for (b of res.winningBonus; track b)`.
- `public/assets/i18n/{en,zh,ms}.json`:
  - Added `"DEV_NOTICE"` key across all 3 language files maintaining 100% parity.
- `src/app/core/e2e-specs/milestone1-challenge.spec.ts`:
  - Updated test assertions to verify correct routing to `/monopoly/lobby` and `/avalon/lobby`, query param preservation on session-less table redirect, nickname dual synchronization, and theme switching to `'mahjong'`.
- `src/app/core/services/p2p-room.challenge.spec.ts`:
  - Updated Challenge 1 tests to verify uppercase normalization of lowercase URL room codes (`?room=p12345` -> `P12345`, `monopoly`).
  - Updated Challenge 4 test to verify single action execution when WebRTC connection is active without duplicate BroadcastChannel execution.

---

## 2. Logic Chain

1. **Routing Resolution**:
   - `GamePlaceholderComponent` registered at `/monopoly/lobby`, `/monopoly/board`, `/avalon/lobby`, `/avalon/table`.
   - Navigations from Hub CTA buttons or universal room codes now match explicit route paths and resolve with HTTP 200 / valid component tree rather than bouncing to root `/`.
2. **P2P Transport Robustness**:
   - Wrapping `rawCode` in `.toUpperCase()` ensures that both URL query params (`?room=p1234`) and raw text (`p1234`) resolve to uppercase `P1234`.
   - `PREFIX_TO_GAME_MAP.get('P')` matches `monopoly`, and PeerJS / BroadcastChannel room identifiers match the host's uppercase registration.
   - Guarding action dispatch with `if (this.conn?.open) { conn.send(); } else if (this.bc) { bc.postMessage(); }` ensures actions and join requests travel through exactly one channel, eliminating double-execution of gameplay actions on the Host.
3. **Shell Context & Ambiance Consistency**:
   - Invoking `shellUi.setActiveGame('mahjong')` in `LobbyComponent.ngOnInit()` immediately sets `document.body.dataset['theme'] = 'mahjong'` upon route arrival, activates `HEADER.BADGE_MAHJONG` in `AppHeaderComponent`, and makes the "Switch Game" button visible.
   - Integrating `ShellUiService.setPlayerNickname()` into `LobbyComponent.persistNickname()` ensures changes to nickname in either Lobby or Hub update both `party_pavilion_nickname` and `hkmj_nickname` in localStorage simultaneously.
4. **Deep-Link State Preservation**:
   - Passing `{ queryParamsHandling: 'preserve' }` in `TableComponent.ngOnInit()` ensures that visitors landing on `/table?room=M1234` without a session arrive at `/mahjong/lobby?room=M1234` with the room invite intact.
5. **Quality Verification**:
   - All 17 test files and 134 unit/E2E tests pass cleanly with zero failures.
   - V8 coverage stands at 84.8% lines (>= 80% threshold) and 70.84% branches (>= 70% threshold).
   - Zero ESLint warnings, zero `eslint-disable` comments, zero explicit `any`, zero compiler warnings.

---

## 3. Caveats

- **No caveats**: All 5 requested integration items and the extended template warning were resolved cleanly with zero workarounds, zero mock facades, and complete test coverage.

---

## 4. Conclusion

All 5 Milestone 1 integration flaws identified during the Verification Gate have been completely resolved. The Universal Hub, P2P Room Transport, Mahjong Lobby theming, and route navigation are verified and operational across all test suites.

---

## 5. Verification Method

Execute the full repository verification checklist:

```bash
npm.cmd run qa:agent-docs
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

### Verification Results Recorded:
1. `npm.cmd run qa:agent-docs`:
   - `[Agent Context Gate PASSED] AGENTS.md: 4655 bytes | 4 reference docs verified | 39 TS/spec files clean.`
2. `npx.cmd tsc --noEmit`:
   - Exit code: 0 (clean).
3. `npm.cmd run lint`:
   - Exit code: 0 (0 errors, 0 warnings).
4. `npm.cmd run test:ci`:
   - `Test Files: 17 passed (17)`
   - `Tests: 134 passed (134)`
   - `Coverage: Lines: 84.8% (>= 80%), Branches: 70.84% (>= 70%)`
5. `npm.cmd run build`:
   - Exit code: 0 (Initial total: 482.82 kB, 0 warnings).

**Invalidation conditions**:
- Any command exit code != 0.
- Any test failure in `milestone1-challenge.spec.ts` or `p2p-room.challenge.spec.ts`.
- Any presence of explicit `any` or `eslint-disable`.
