# Authoritative Agent Rules & Handover Index (`hk-mahjong`)

This file is the always-on rulebook for AI coding agents and engineers working on `hk-mahjong` (Hong Kong 4-Player 144-Tile & Authentic Malaysian 3-Player 84-Tile Fly Mahjong). Keep this file **under `20,000` bytes** (`npm run qa:agent-docs`) so Antigravity never truncates `<user_rules>`. Detailed specifications live in `docs/reference/`.

---

## 1. Project Identity & Stack

- **Application**: Serverless P2P & Offline AI Mahjong Pavilion (`4p` Hong Kong 144-Tile + `3p` Authentic Malaysian 84-Tile `飛牌三人麻將`)
- **Framework & Language**: **Angular 21** (Standalone Components & Signals) + **TypeScript 5.9+**
- **Styling & i18n**: **SCSS Design System** (`src/styles/`) + Signal-backed `TranslateService` / `TranslatePipe` (`public/assets/i18n/{en,zh,ms}.json`)
- **Networking**: **Zero Backend** — Host-in-browser authoritative state machine over WebRTC (`peerjs`) + same-browser `BroadcastChannel` fallback
- **Unit Testing**: **Vitest 4.1+** via `@angular/build:unit-test` (`isolate: true`, `@vitest/coverage-v8`, `0` trivial assertions)
- **Linter**: **ESLint 9+** + `typescript-eslint` + `eslint-plugin-security` (`0` errors, `0` warnings, `0` `eslint-disable`)

---

## 2. Progressive-Disclosure Reference Map (Read Before Editing)

Before modifying files in any area below, **MUST** `read_file` the corresponding canonical reference document first:

| Task / Target Files | Required Canonical Reference |
| :--- | :--- |
| App shell (`src/app/layout/**`), routes (`src/app/pages/**`), game engine & scorer | [docs/reference/architecture.md](./docs/reference/architecture.md) |
| P2P session (`mahjong-session.service.ts`), state sanitization, ESLint security rules | [docs/reference/security-and-p2p.md](./docs/reference/security-and-p2p.md) |
| `*.html`, `*.scss`, `src/styles.scss`, modals, `public/assets/i18n/*.json` | [docs/reference/ui-conventions.md](./docs/reference/ui-conventions.md) |
| `src/**/*.spec.ts`, Vitest V8 coverage, assertion & DI mocking rules | [docs/reference/testing-and-quality.md](./docs/reference/testing-and-quality.md) |

---

## 3. Non-Negotiable Domain & Security Invariants (`HKMJ-P2P-CHECK-01`)

- **Canary Identifier**: `HKMJ-P2P-CHECK-01`
- **Authentic 3-Player Mode (`3p`)**: Strictly **3 seats (`東/南/西`)** — **never** pad a 3P game with a 4th filler bot. Uses the 84-tile Malaysian Fly deck (`1–9筒` Dots, Winds, Dragons, 16 Bonus tiles including Animals `貓/鼠/雞/蜈` & Faces `男女頭`, and 4 `飛` `jk` wildcards).
- **Scoring & Payouts**: Default **5-Fan Minimum (`五番起糊`)**, **10-Fan Cap (`十番封頂`)**, and **Discarder-Pays-All (`全銃制・半辣上`)**.
- **Anti-Cheat Per-Seat View Sanitization**: Host never broadcasts `MatchState` directly to guests. `getPlayerView(state, seatIdx)` strips `wall`, conceals opponents' `hand` arrays (`null` + `handCount`), masks concealed Kongs as `'back'` until `handOver`, and strips `LobbySeat.token` before P2P sync.
- **URL Hygiene & Decoupled Reset**: Strip room parameters via `window.history.replaceState()` and dispatch `new CustomEvent('mahjong:leave')` on leave.

---

## 4. Hard Prohibition on `*.sh` Scripts

- AI agents **MUST NEVER** read, inspect, create, edit, overwrite, rename, delete, or execute **any `*.sh` script**.

---

## 5. UI, SCSS, i18n & Code Quality Rules

- **Inputs & Modals**: Keep `.portal-input` (`38px`, `#0d1117`, `#00d285` focus) top-level in `src/styles.scss` (never nested). Render modals with `max-width: 95vw; max-height: 90vh;`, middle scroll container (`max-height: 55vh`), and **bottom action buttons only** (never render top-right `X` close buttons).
- **Responsive Views**: Render `.desktop-table` on `> 768px` and `.mobile-cards` Modern App Cards on `<= 768px`. Keep component SCSS shallow (`1–2` levels, grouped `@media` at bottom, `< 32 kB`).
- **i18n Parity**: Use `TranslatePipe` (`| translate`) for user-facing strings and update `public/assets/i18n/{en,zh,ms}.json` in lockstep (`i18n-parity.spec.ts`).
- **TypeScript & ESLint**: Zero explicit `any`; `catch (e: unknown)`; use `Map<K, V>` and `.at()` instead of dynamic `obj[key]` / `arr[idx]` indexing (`security/detect-object-injection`); **zero `eslint-disable` comments**.
- **Unit Specs**: **Never** call `TestBed.overrideComponent(...)`, never write trivial existence assertions (`.toBeTruthy()`, `.toBeDefined()`, `.not.toBeNull()`), and never pass a 3rd timeout arg to `it(...)`.

---

## 6. Local Quality Verification Checklist

```bash
npm.cmd run qa:agent-docs
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```
