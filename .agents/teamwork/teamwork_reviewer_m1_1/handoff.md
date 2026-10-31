# Review & Adversarial Challenge Report — Milestone 1

**Reviewer / Critic**: `teamwork_reviewer_m1_1`
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### Verification Commands & Results

1. `npm.cmd run qa:agent-docs`
   - Command: `node scripts/verify-agent-context.mjs`
   - Output: `[Agent Context Gate PASSED] AGENTS.md: 4655 bytes | 4 reference docs verified | 35 TS/spec files clean.`
   - Exit code: `0`

2. `npx.cmd tsc --noEmit`
   - Output: Clean (no errors)
   - Exit code: `0`

3. `npm.cmd run lint`
   - Output: `eslint src` clean (0 errors, 0 warnings, 0 eslint-disable)
   - Exit code: `0`

4. `npm.cmd run test:ci`
   - Command: `ng test --watch=false`
   - Output:
     ```text
     FAIL   hk-mahjong  src/app/core/e2e-specs/milestone1-challenge.spec.ts > Empirical Challenge Suite — Milestone 1: Universal Hub & Route Resolution > Challenge 2: Direct CTA Navigation to Target Lobbies > provides clickable CTA buttons for all 3 games in HubComponent DOM
     AssertionError: expected '/' to be '/monopoly/lobby' // Object.is equality
     Expected: "/monopoly/lobby"
     Received: "/"
      ❯ src/app/core/e2e-specs/milestone1-challenge.spec.ts:138:26

     FAIL   hk-mahjong  src/app/core/e2e-specs/milestone1-challenge.spec.ts > Empirical Challenge Suite — Milestone 1: Universal Hub & Route Resolution > Challenge 2: Direct CTA Navigation to Target Lobbies > navigates to target lobbies via universal room input with prefixed codes
     AssertionError: expected '/?room=P1234' to be '/monopoly/lobby?room=P1234' // Object.is equality
     Expected: "/monopoly/lobby?room=P1234"
     Received: "/?room=P1234"
      ❯ src/app/core/e2e-specs/milestone1-challenge.spec.ts:177:26

      Test Files  1 failed | 15 passed (16)
           Tests  2 failed | 125 passed (127)
     ```
   - Exit code: `1`

5. `npm.cmd run build`
   - Command: `ng build`
   - Output:
     ```text
     Initial chunk files | Names  |  Raw size | Estimated transfer size
     main-AUUGZ7SV.js    | main   | 473.24 kB |               116.34 kB
     styles-JPOOBOHW.css | styles |   5.94 kB |                 1.75 kB
     ```
   - Exit code: `0`

---

### Specific Code Observations

#### A. Missing Routes in `app.routes.ts`
- File: `src/app/app.routes.ts:6-19`:
  ```ts
  export const routes: Routes = [
    { path: '', pathMatch: 'full', component: HubComponent },
    { path: 'lobby', redirectTo: 'mahjong/lobby' },
    { path: 'table', redirectTo: 'mahjong/table' },
    {
      path: 'mahjong',
      children: [
        { path: '', pathMatch: 'full', redirectTo: 'lobby' },
        { path: 'lobby', component: LobbyComponent },
        { path: 'table', component: TableComponent },
      ],
    },
    { path: '**', redirectTo: '' },
  ];
  ```
- Contrast with `src/app/pages/hub/hub.component.ts:40-43, 91-94, 98`:
  ```ts
  // Line 40: Deep link entry
  void this.router.navigate([`/${parsed.game}/lobby`], {
    queryParams: { room: parsed.roomCode },
    replaceUrl: true,
  });
  // Line 91: Join room button
  void this.router.navigate([`/${parsed.game}/lobby`], {
    queryParams: { room: parsed.roomCode },
  });
  // Line 98: Enter Game CTA button
  void this.router.navigate([`/${game}/lobby`]);
  ```
- When `parsed.game` or `game` is `'monopoly'` or `'avalon'`, Angular router matches no configured path and falls through to `{ path: '**', redirectTo: '' }`, silently redirecting the user back to `/`.

#### B. Lobby Theme and Header Desynchronization
- File: `src/app/pages/lobby/lobby.component.ts:19-58`:
  - `LobbyComponent` injects `MahjongSessionService`, but never injects `ShellUiService` or calls `shellUi.setActiveGame('mahjong')` during component initialization (`ngOnInit` / constructor).
  - File: `src/app/core/services/shell-ui.service.ts:18, 38-41`:
    - `activeGame` defaults to `'hub'`.
    - File: `src/app/core/services/mahjong-session.service.ts:1046`:
      - `this.shellUi.setActiveGame('mahjong')` is only invoked inside `this.session.onUpdate(...)` when a session snapshot is emitted.
  - As observed in `src/app/core/e2e-specs/milestone1-challenge.spec.ts:364`:
    `[Empirical Observation] On /mahjong/lobby: activeGame = "hub", theme = "hub"`
  - Visiting `/mahjong/lobby` displays the generic blue hub theme and `HEADER.BADGE_PAVILION` ("桌遊大廳") instead of the jade Mahjong theme and `HEADER.BADGE_MAHJONG` ("港馬麻雀").

#### C. Case-Sensitivity in Universal Room Code Parser
- File: `src/app/core/services/p2p-room.transport.ts:118-132`:
  ```ts
  const rawCode = isUrl
    ? (roomMatch?.at(1) ?? '')
    : trimmed.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const roomCode = rawCode.slice(0, 8);
  ...
  const firstChar = roomCode.charAt(0) as GamePrefix;
  const gameFromPrefix = PREFIX_TO_GAME_MAP.get(firstChar);
  ```
  - `PREFIX_TO_GAME_MAP` has keys `['M', 'P', 'A']` (all uppercase).
  - In URL query parameters (`isUrl === true`), `rawCode` is not converted to uppercase.
  - If a user opens `?room=p12345`, `firstChar` is `'p'`, which fails `PREFIX_TO_GAME_MAP.get('p')` and incorrectly falls back to `'mahjong'`.

#### D. Repository Invariants Verification
- **Explicit `any`**: Grep across `src/` found `0` instances.
- **`eslint-disable`**: Grep across `src/` found `0` instances.
- **Safe indexing**: All array and map accesses use `Map` and `.at()`.
- **Modals**: Bounded to `max-width: min(720px, 95vw); max-height: 90vh;` with bottom-only close buttons. Zero `X` close buttons in headers.
- **`.portal-input`**: Top-level in `src/styles.scss` (`38px`, `#00d285` focus).
- **Trilingual Parity**: 100% key parity and non-empty strings across `en.json`, `zh.json`, `ms.json` (`i18n-parity.spec.ts` passed 4/4 tests).
- **Prohibited `*.sh` scripts**: Zero inspected, modified, or executed.

---

## 2. Logic Chain

1. **Gate Invariant**: The repository's standard quality gate requires `npm.cmd run test:ci` to complete cleanly with exit code `0` before any milestone can be approved.
2. **Failure Trace**:
   - `src/app/core/e2e-specs/milestone1-challenge.spec.ts` was added to stress-test Milestone 1 routing.
   - Test 1 (`provides clickable CTA buttons for all 3 games in HubComponent DOM`) and Test 2 (`navigates to target lobbies via universal room input with prefixed codes`) fail because clicking Monopoly/Avalon CTAs or entering Monopoly/Avalon room codes routes to `/monopoly/lobby` and `/avalon/lobby`.
   - `src/app/app.routes.ts` does not contain route entries for `monopoly` or `avalon`.
   - The wildcard route `{ path: '**', redirectTo: '' }` intercepts these navigations and silently bounces back to `/`.
   - Consequently, `npm.cmd run test:ci` exits with code `1`.
3. **UX & Architectural Inconsistency**:
   - `HubComponent` allows players to click "Enter Monopoly" / "Enter Avalon" and enter `P...` / `A...` room codes, but the application silently does nothing (redirects to root `/`).
   - `LobbyComponent` fails to switch `shellUi.activeGame` to `'mahjong'`, creating a visual and state mismatch (Hub theme and Pavilion badge displayed while sitting in the Mahjong Lobby).
4. **Parser Edge-Case**:
   - A lowercase room parameter (`?room=p12345`) incorrectly resolves to `mahjong` instead of `monopoly` due to missing `.toUpperCase()` normalization in the URL parser branch.
5. **Conclusion from Chain**: Because tests fail and user-facing routing is broken for Monopoly and Avalon deep links and CTAs, the Milestone 1 deliverable cannot be approved in its current state.

---

## 3. Caveats

- Milestone 1 was designated as Shell, Transport, and Hub infrastructure; full Monopoly gameplay rules and Avalon AI deduction mechanics are officially scheduled for Milestones 2 and 3.
- However, the Hub component explicitly provides active navigation triggers and universal room routing targeting `/monopoly/lobby` and `/avalon/lobby`. A foundational shell must either configure route stubs/placeholders in `app.routes.ts` that resolve cleanly without redirecting to `/`, or handle upcoming game navigation gracefully so the test suite passes.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

### Required Action Items for Worker (`teamwork_worker_m1`):

1. **[CRITICAL] Add Route Stubs in `app.routes.ts`**:
   - Add routes for `monopoly` and `avalon` in `src/app/app.routes.ts` (e.g. stub lobby components or lazy child routes) so that navigation to `/monopoly/lobby` and `/avalon/lobby` succeeds, preserves route parameters, and satisfies `milestone1-challenge.spec.ts`.
2. **[MAJOR] Synchronize `activeGame` in `LobbyComponent`**:
   - In `src/app/pages/lobby/lobby.component.ts`, inject `ShellUiService` and set `this.shellUi.setActiveGame('mahjong')` on initialization (and clean up on leave if appropriate), ensuring the jade ambiance and `HEADER.BADGE_MAHJONG` are displayed.
3. **[MINOR] Normalize URL Query Room Codes in `p2p-room.transport.ts`**:
   - In `parseUniversalRoomCode()`, apply `.toUpperCase()` to `rawCode` when extracting from URL query parameters so `?room=p1234` correctly maps to `monopoly`.
4. **[MINOR] Clean Up Extended Diagnostics Template Warning**:
   - Remove redundant `?? []` on `res.winningBonus` in `src/app/pages/table/table.component.html:519`.

---

## 5. Verification Method

Once changes are made, run the complete 5-point verification suite to confirm all tests pass:

```bash
npm.cmd run qa:agent-docs
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

**Invalidation conditions**:
- Any exit code != 0.
- Any failed test in `src/app/core/e2e-specs/milestone1-challenge.spec.ts` or `src/app/core/e2e-specs/hub-and-shell.e2e.spec.ts`.
- Any presence of explicit `any` or `eslint-disable`.
