# Handoff Report — Milestone 1 Empirical Challenge: Universal Hub UI & Route Resolution

**Verdict**: **FOUND FLAWS**

---

## 1. Observation

### Verification Suite & Quality Gates
- Created comprehensive empirical challenge suite: `src/app/core/e2e-specs/milestone1-challenge.spec.ts` (13 tests) testing:
  1. Route redirect semantics (`/lobby` -> `/mahjong/lobby`, `/table` -> `/mahjong/table`, query parameter preservation).
  2. Direct CTA navigation (`enterGame` for Mahjong, Monopoly, Avalon; universal room code join with prefixes `M`, `P`, `A`).
  3. Nickname migration (`hkmj_nickname` -> `party_pavilion_nickname`, priority, dual persistence, length clamping, desync).
  4. Theme dataset on `document.body` across games and route transitions.
- All 5 repository verification gates executed successfully:
  - `npm.cmd run qa:agent-docs`: Exit code 0 (`[Agent Context Gate PASSED]`).
  - `npx.cmd tsc --noEmit`: Exit code 0.
  - `npm.cmd run lint`: Exit code 0 (0 errors, 0 warnings, 0 eslint-disable).
  - `npm.cmd run test:ci`: Exit code 0 (16 test files passed, 131 tests passed, 0 failed; Lines: 85.58% >= 80%, Branches: 72.31% >= 70%).
  - `npm.cmd run build`: Exit code 0 (Initial total: 480.18 kB, well within limits).

---

### Detailed Empirical Observations

#### Observation 1: Route Redirect Semantics (`/lobby` and `/table`)
- **Query Parameter Preservation on `/lobby`**:
  - `router.navigateByUrl('/lobby')` -> resolves to `/mahjong/lobby`.
  - `router.navigateByUrl('/lobby?room=M1234')` -> resolves to `/mahjong/lobby?room=M1234`.
  - `router.navigateByUrl('/lobby?room=M5678&mode=3p&test=alpha')` -> resolves to `/mahjong/lobby?room=M5678&mode=3p&test=alpha`.
  - *Observation*: Angular Router preserves query parameters across `redirectTo: 'mahjong/lobby'`. (CONFIRMED CORRECT)
- **Active Session on `/table`**:
  - When `session.snapshot()?.view` is active, navigating to `/table?room=LOCAL` resolves to `/mahjong/table?room=LOCAL`. (CONFIRMED CORRECT)
- **FLAW — Query Parameter Loss on Direct `/table` URL without Session**:
  - In `src/app/pages/table/table.component.ts:76-80`:
    ```ts
    ngOnInit(): void {
      if (!this.session.snapshot()?.view) {
        void this.router.navigate(['/lobby']);
      }
    }
    ```
  - When an unauthenticated visitor navigates directly to `/table?room=M1234`, `TableComponent.ngOnInit()` redirects to `['/lobby']` without passing `queryParams`. The query parameter `?room=M1234` is discarded, landing on `/mahjong/lobby` with no room parameter.

#### Observation 2: Direct CTA Navigation & Universal Room Joining
- **Mahjong CTA & Room Join**:
  - In `src/app/pages/hub/hub.component.html:81-83`, clicking `.mahjong-card .card-primary-btn` invokes `enterGame('mahjong')`, which calls `this.router.navigate(['/mahjong/lobby'])`.
  - Resolves to `/mahjong/lobby`. (CONFIRMED CORRECT)
  - Joining room with `M9999` resolves to `/mahjong/lobby?room=M9999`. (CONFIRMED CORRECT)
- **CRITICAL FLAW — Missing Routes for Monopoly and Avalon**:
  - In `src/app/app.routes.ts:6-19`:
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
  - Notice: No routes are defined for `/monopoly` or `/avalon` (not even stub routes, lazy routes, or coming-soon redirects).
  - Empirical Result:
    1. Clicking "Enter Monopoly" (`enterGame('monopoly')`) calls `this.router.navigate(['/monopoly/lobby'])`. The route matches `{ path: '**', redirectTo: '' }` and redirects immediately back to root `/`. The user never leaves the Hub.
    2. Clicking "Enter Avalon" (`enterGame('avalon')`) calls `this.router.navigate(['/avalon/lobby'])`. The route matches `{ path: '**', redirectTo: '' }` and redirects immediately back to root `/`. The user never leaves the Hub.
    3. Entering a Monopoly room code (e.g. `P1234`) or Avalon room code (e.g. `A5678`) in `HubComponent` calls `router.navigate(['/monopoly/lobby'], { queryParams: { room: 'P1234' } })`. The wildcard route redirects to `/` while preserving query params, landing on `/?room=P1234`.
    4. In `src/app/pages/hub/hub.component.ts:32-45`:
       ```ts
       const params = this.route.snapshot.queryParamMap;
       const roomParam = params.get('room');
       if (roomParam) { ... void this.router.navigate([`/${parsed.game}/lobby`], { queryParams: { room: parsed.roomCode }, replaceUrl: true }); }
       ```
       Because `/?room=P1234` triggers `ngOnInit()`, `HubComponent` attempts to navigate to `/monopoly/lobby` again, creating an immediate redirect bounce / stuck query param loop.
  - *Root Cause in Tests*: Unit tests in `hub.component.spec.ts:92-96` and `hub-and-shell.e2e.spec.ts:222-226` mocked `router.navigate` with dummy recording functions instead of testing against the actual Angular `routes` configuration.

#### Observation 3: Nickname Migration & Storage Persistence
- **ShellUiService Dual Persistence**:
  - `ShellUiService` constructor reads `party_pavilion_nickname ?? hkmj_nickname` and defaults to `'雀友'` if absent or blank.
  - `ShellUiService.setPlayerNickname()` clamps to 16 characters, trims whitespace, and writes to both `party_pavilion_nickname` and `hkmj_nickname`. (CONFIRMED CORRECT)
  - Hub UI in-place editing (Start, Edit, Save, Cancel) correctly updates and dual-persists. (CONFIRMED CORRECT)
- **FLAW — Desynchronization with `LobbyComponent`**:
  - In `src/app/pages/lobby/lobby.component.ts:59-65`:
    ```ts
    private loadInitialNickname(): string {
      try {
        return localStorage.getItem('hkmj_nickname') || '雀神';
      } catch {
        return '雀神';
      }
    }
    ```
    Default is `'雀神'` (God of Mahjong), whereas `ShellUiService` defaults to `'雀友'` (Pavilion Friend).
  - In `src/app/pages/lobby/lobby.component.ts:75-84`:
    ```ts
    private persistNickname(): string {
      const clean = this.nickname.trim() || '雀神';
      this.nickname = clean;
      try {
        localStorage.setItem('hkmj_nickname', clean);
      } catch { ... }
      return clean;
    }
    ```
    `LobbyComponent.persistNickname()` writes ONLY to `hkmj_nickname`. It never updates `party_pavilion_nickname` nor `ShellUiService.playerNickname`.
  - When a user who set their nickname on Hub (e.g. `'Alice'`) later changes their nickname in Mahjong Lobby to `'Bob'`:
    - `localStorage.getItem('hkmj_nickname')` is `'Bob'`.
    - `localStorage.getItem('party_pavilion_nickname')` remains `'Alice'`.
    - Because `ShellUiService.readInitialNickname()` prioritizes `party_pavilion_nickname`, any subsequent session or navigation back to Hub completely ignores `'Bob'` and reverts to `'Alice'`.

#### Observation 4: Theme Dataset Changes on Body Tag
- **ShellUiService Theme Setting**:
  - `shellUi.setActiveGame(game)` correctly sets `document.body.dataset['theme']` to `'hub'`, `'mahjong'`, `'monopoly'`, or `'avalon'`. (CONFIRMED CORRECT)
  - `src/styles.scss:24-46` has palettes for `data-theme='hub'`, `mahjong`, `monopoly`, `avalon`. (CONFIRMED CORRECT)
- **CRITICAL FLAW — Theme Remains `'hub'` When Navigating to `/mahjong/lobby`**:
  - In `src/app/pages/hub/hub.component.ts:28`: `ngOnInit()` sets `this.shellUi.setActiveGame('hub')`.
  - When clicking "Enter Mahjong" or navigating to `/mahjong/lobby`:
    - `app.routes.ts` routes to `LobbyComponent`.
    - `LobbyComponent` does NOT inject `ShellUiService` and does NOT call `setActiveGame('mahjong')`.
    - `MahjongSessionService` only calls `setActiveGame('mahjong')` inside `attach(session)` on line 1046, which is only called AFTER a match is actively created or joined.
  - Empirical verification results upon arriving at `/mahjong/lobby`:
    1. `shellUi.activeGame()` is `'hub'`.
    2. `document.body.dataset['theme']` is `'hub'` (slate/dark palette, NOT the green/jade mahjong felt palette).
    3. In `src/app/layout/header/app-header.component.html:5-20`, the brand badge displays `'HEADER.BADGE_PAVILION'` ("桌遊大廳"), NOT `'HEADER.BADGE_MAHJONG'` ("港馬麻雀").
    4. In `src/app/layout/header/app-header.component.html:24-37`, the "Switch Game / 返回大廳" button (`.hub-btn`) is wrapped in `@if (shellUi.activeGame() !== 'hub')`. Because `activeGame` is still `'hub'`, the "Switch Game" button is NOT rendered, leaving the user with no header navigation back to the Hub.

---

## 2. Logic Chain

1. *Requirement 1 (Route Redirects)*:
   - `/lobby` redirects to `mahjong/lobby` preserving query parameters via Angular router's standard route definition.
   - However, when entering `/table?room=...` without an active session view, `TableComponent.ngOnInit` performs an imperative navigation to `['/lobby']` without passing `queryParams`, dropping room parameters.
2. *Requirement 2 (CTA Navigation)*:
   - `HubComponent` has CTAs for Monopoly and Avalon that call `router.navigate(['/monopoly/lobby'])` and `router.navigate(['/avalon/lobby'])`.
   - `app.routes.ts` defines no matching routes for `/monopoly` or `/avalon`.
   - In Angular, any unmatched path falls through to the wildcard route `{ path: '**', redirectTo: '' }`.
   - Therefore, clicking either CTA or entering prefixed room codes for Monopoly/Avalon immediately bounces back to root `/`, rendering those CTAs completely inoperative and causing deep links to bounce in a loop.
3. *Requirement 3 (Nickname Migration & Persistence)*:
   - `ShellUiService` successfully handles dual-key read priority and dual-key writes when used through `ShellUiService`.
   - However, `LobbyComponent` was left unintegrated: it continues to load from and save exclusively to `hkmj_nickname`.
   - Because `ShellUiService` gives precedence to `party_pavilion_nickname`, any nickname changes made by users in `LobbyComponent` are shadowed and ignored by the shell and hub.
4. *Requirement 4 (Theme Dataset Changes on Body Tag)*:
   - Theme changes are driven by `ShellUiService.setActiveGame()`.
   - `LobbyComponent` does not call `setActiveGame('mahjong')` on initialization.
   - Therefore, navigating from the Hub to `/mahjong/lobby` does not change `activeGame` or `theme`; both remain `'hub'`.
   - As a direct consequence, the theme palette fails to switch to Mahjong jade, the header badge shows Pavilion instead of Mahjong, and the "Switch Game" button fails to render.

---

## 3. Caveats

- Unit tests in `p2p-room.transport.spec.ts` and `shell-ui.service.spec.ts` were well-written in isolation; the flaws discovered stem from route-level and component-level integration gaps (`app.routes.ts`, `LobbyComponent`, `TableComponent`).
- Monopoly and Avalon gameplay logic are scheduled for Milestones 2 and 3; however, the route architecture and hub CTAs for Milestone 1 must resolve cleanly (e.g. to stub/coming-soon views or modal notifications) rather than silently bouncing to root.

---

## 4. Conclusion

Empirical challenge verdict: **FOUND FLAWS**.

### Required Action Items for Fix Agent:
1. **Define Routes for All Games in `src/app/app.routes.ts`**:
   - Add routes for `/monopoly` (e.g., child route `lobby`) and `/avalon` (e.g., child route `lobby`), resolving either to lightweight placeholder/stub components or routing guards, so `router.navigate(['/monopoly/lobby'])` does not hit the wildcard redirect.
2. **Forward Query Params in `TableComponent.ngOnInit`**:
   - In `src/app/pages/table/table.component.ts`, when redirecting to `/lobby` if no view is present, pass `queryParamsHandling: 'preserve'` or forward current query params.
3. **Synchronize Theme in `LobbyComponent`**:
   - Inject `ShellUiService` into `LobbyComponent` and call `this.shellUi.setActiveGame('mahjong')` in `ngOnInit` (or constructor) so navigating to `/mahjong/lobby` immediately switches theme to `'mahjong'`, activates the Mahjong header badge, and displays the "Switch Game" button.
4. **Synchronize Nickname in `LobbyComponent`**:
   - In `LobbyComponent`, use `ShellUiService.playerNickname()` or update both `party_pavilion_nickname` and `hkmj_nickname` when `persistNickname()` runs, and align initial default names.

---

## 5. Verification Method

To independently verify these findings:
```bash
npm.cmd run qa:agent-docs
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```
Inspect the empirical challenge tests in:
- `src/app/core/e2e-specs/milestone1-challenge.spec.ts`
Key failure cases documented in:
- `Challenge 1: drops query parameters when /table is visited without an active session`
- `Challenge 2: verifies CTA navigation: Mahjong resolves to /mahjong/lobby, while Monopoly and Avalon redirect to / due to missing route definitions`
- `Challenge 2: verifies universal room input routing: Mahjong resolves to /mahjong/lobby?room=..., while Monopoly/Avalon bounce back to /`
- `Challenge 3: reveals nickname desynchronization: LobbyComponent updates only hkmj_nickname while party_pavilion_nickname retains old value`
- `Challenge 4: reveals theme flaw: navigating to /mahjong/lobby leaves theme as "hub" instead of "mahjong"`
