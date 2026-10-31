# TEST_READY: Party Game Pavilion (`桌遊館`)

## 1. Executive Summary

This document certifies that the comprehensive End-to-End (E2E) test suite for the Party Game Pavilion (`桌遊館`) has been fully authored, verified, and integrated into the project's continuous integration test infrastructure.

All tests are authored according to opaque-box, requirement-driven specifications derived from `ORIGINAL_REQUEST.md`, `PROJECT.md`, `TEST_INFRA.md`, and repo invariants in `AGENTS.md`.

### Verification Status
- **Agent Context Gate**: `npm run qa:agent-docs` -> **PASSED** (0 errors).
- **TypeScript Static Analysis**: `npx tsc --noEmit` -> **PASSED** (0 type errors).
- **ESLint Gate**: `npm run lint` -> **PASSED** (0 errors, 0 warnings, 0 `eslint-disable`).
- **Unit & E2E Test Suite**: `npm run test:ci` -> **PASSED** (14/14 test files passed, 105/105 tests passed).
- **V8 Coverage Requirements**:
  - Statements: **82.10%** (target `>= 80%`)
  - Branch Coverage: **70.73%** (target `>= 70%`)
  - Functions: **74.10%**
  - Lines: **84.45%** (target `>= 80%`)
- **Production Build**: `npm run build` -> **PASSED** (480.18 kB initial total).

---

## 2. Test Suite Inventory

| Test File | Target Domain / Module | Tests | Status |
| :--- | :--- | :---: | :---: |
| `src/app/core/e2e-specs/hub-and-shell.e2e.spec.ts` | Game Hub, Universal Routing, Shell Context & SFX | 11 | **PASSED** |
| `src/app/core/e2e-specs/monopoly-rules.e2e.spec.ts` | 40-Space Board, Saidina Rules, Auctions & Tactical AI | 11 | **PASSED** |
| `src/app/core/e2e-specs/avalon-social-deduction.e2e.spec.ts` | 5–10P Matrix, Night-Vision, Lady of Lake, Bayesian AI | 13 | **PASSED** |
| `src/app/core/e2e-specs/p2p-anti-cheat-sanitization.e2e.spec.ts` | P2P Room Transport, View Sanitization & HKMJ Invariants | 14 | **PASSED** |
| `src/app/core/services/p2p-room.transport.spec.ts` | Transport Unit Tests, Reconnect, Broadcast & Handshake | 18 | **PASSED** |
| `src/app/core/services/shell-ui.service.spec.ts` | Shell Service Unit Tests, Audio, Themes & Storage | 11 | **PASSED** |
| `src/app/pages/hub/hub.component.spec.ts` | Hub Page Unit Tests & Interaction Bindings | 7 | **PASSED** |
| `src/app/core/services/bot.service.spec.ts` | Mahjong 5-Fan Tactical AI Simulations | 1 | **PASSED** |
| `src/app/core/services/engine.service.spec.ts` | Mahjong Core Engine State Transitions | 5 | **PASSED** |
| `src/app/core/services/scorer.service.spec.ts` | Hong Kong & Malaysian Mahjong Fan Calculations | 4 | **PASSED** |
| `src/app/core/services/mahjong-session.service.spec.ts` | Mahjong P2P Session Management | 2 | **PASSED** |
| `src/app/core/services/i18n-parity.spec.ts` | Trilingual Dictionary Parity (`en`, `zh`, `ms`) | 4 | **PASSED** |
| `src/app/core/utils/tiles.util.spec.ts` | Mahjong Tile Conversion & Sorting Utilities | 2 | **PASSED** |
| `src/app/app.component.spec.ts` | Application Shell, Table Component & Dialogs | 2 | **PASSED** |
| **Total** | **All 14 Test Suites** | **105** | **100% GREEN** |

---

## 3. Detailed Feature Coverage & Authoritative Derivation

### 3.1 Hub & Shell Architecture (`hub-and-shell.e2e.spec.ts`)
- **Universal Room-Code Resolution**:
  - `M...` prefix resolves to `mahjong` (e.g., `M8X4K` -> `mahjong`).
  - `P...` prefix resolves to `monopoly` (e.g., `P1234` -> `monopoly`).
  - `A...` prefix resolves to `avalon` (e.g., `A9876` -> `avalon`).
  - Legacy unprefixed room codes default to `mahjong` backward compatibility.
- **Deep-Link URL Interception**:
  - Parses `?game=monopoly&room=P1234` and `/` entrypoint, routing directly to `/<game>/lobby` with `{ queryParams: { room: '...' }, replaceUrl: true }`.
  - Fallback parsing for `?room=M1234` without explicit `game` query param.
- **Shell Context & Migration**:
  - Migrates legacy `hkmj_nickname` into `party_pavilion_nickname` and dual-persists across storage keys.
  - Contextual CSS theme switcher setting `document.body.dataset['theme']` (`hub`, `mahjong`, `monopoly`, `avalon`).
  - Web Audio synthesis triggering procedural sound frequencies (`click`, `deal`, `dice`, `alert`, `fanfare`, `fail`).
  - SpeechSynthesis announcement fallback with multi-locale voice matching.
- **Hub Presentation**:
  - Mounts `HubComponent`, verifies 3 game cards rendered with titles, player counts, descriptions, and feature bullet lists.
  - Interactive nickname edit row with inline Save/Cancel and instant input reactivity.
  - Universal room-join input validation with error banners on empty or invalid codes (`HUB.ERROR_EMPTY_ROOM`, `HUB.ERROR_INVALID_ROOM`).

### 3.2 Malaysia Monopoly Rules & AI Engine (`monopoly-rules.e2e.spec.ts`)
- **40-Space Perimeter Board Matrix**:
  - 11×11 ring with 4 corner spaces: Space 0 (Mula GO, RM 200 pass award), Space 10 (Penjara Jail), Space 20 (Tempat Letak Kereta Percuma Free Parking), Space 30 (Masuk Penjara Go to Jail).
  - 22 Malaysian landmarks across 8 color groups: Brown (Alor Setar, Kangar) to Dark Blue (Batu Ferringhi, KLCC Petronas Towers).
  - 4 Transit Hubs: KL Sentral, Penang Ferry, JB Sentral, Kota Kinabalu Airport (rent escalates RM 25 -> RM 50 -> RM 100 -> RM 200).
  - 2 Utilities: Tenaga Nasional Berhad & Syarikat Bekalan Air Selangor (multiplier ×4 or ×10 on dice sum).
  - Currency representation in Malaysian Ringgit (`RM`).
- **Saidina House Rule 1 (Free Parking Jackpot Pot)**:
  - Space 20 holds an accumulating Jackpot Pot.
  - Income Tax (RM 200), Luxury Tax (RM 100), and RM 50 Jail Bail are routed to the Pot.
  - Landing on Space 20 awards the entire pot to the player and resets the pot to RM 0.
- **Saidina House Rule 2 (No Rent in Jail)**:
  - When the property owner is in Jail (`inJail: true`), landing on their property incurs RM 0 rent.
  - Full rent collection resumes immediately upon the landlord's release.
- **Even-Build & Development Rules**:
  - Houses may only be built once a player owns a full color monopoly.
  - Construction follows the even-build rule: no property in a group can have > 1 house more than any other.
  - 4 houses upgrade to a Hotel.
- **Mortgage & Unmortgage Financials**:
  - Mortgage payout is exactly 50% of property cost.
  - Unmortgage redemption cost is principal + 10% interest (55% of original purchase price: `Math.round(mortgagePayout * 1.1)`).
- **Action Decks**:
  - 16 Nasib (Chance) & 16 Dana Komuniti (Community Chest) cards.
  - Fines pay into the Free Parking Jackpot Pot; awards credit player cash directly.
- **Win Conditions & AI Heuristics**:
  - Last Tycoon Standing: Immediate victory when all opponents declare bankruptcy.
  - Round Limit: Evaluates highest total net worth (liquid cash + unmortgaged property cost + mortgaged 50% + house/hotel investments).
  - Tactical AI: Prioritizes 3-house sweet spot, unowned property purchases, strategic distress mortgages, and aggressive early-game jail exit.

### 3.3 Avalon Social Deduction Engine (`avalon-social-deduction.e2e.spec.ts`)
- **Don Eskridge Player & Quest Matrices**:
  - Validates player ratios for 5 to 10 players (5P: 3 Good/2 Evil; 6P: 4 Good/2 Evil; 7P: 4 Good/3 Evil; 8P: 5 Good/3 Evil; 9P: 6 Good/3 Evil; 10P: 6 Good/4 Evil).
  - Validates quest team sizes across all 5 quests (e.g., 5P: [2, 3, 2, 3, 3]; 7P: [2, 3, 3, 4, 4]; 10P: [3, 4, 4, 5, 5]).
- **Quest 4 Special Two-Fails Rule**:
  - For games with `>= 7` players, Quest 4 requires at least 2 Fail cards to fail. A single Fail results in a Quest Success.
  - For games with `< 7` players, a single Fail fails Quest 4 as normal.
- **Hammer Rejection Track**:
  - 5 consecutive rejected team proposals on the same quest immediately awards victory to Evil.
- **Mathematical Night-Vision Sanitization Matrix**:
  - **Merlin**: Sees all Evil players (Assassin, Morgana, Minions) EXCEPT Mordred; sees Good players as anonymous.
  - **Percival**: Sees Merlin and Morgana as ambiguous candidate Merlins; cannot distinguish between them.
  - **Evil Teammates**: See each other EXCEPT Oberon (who is completely isolated and unknown to Evil).
  - **Oberon**: Sees nobody; no Evil sees Oberon.
  - **Loyal Servants of Arthur**: See nobody (completely blind to all roles).
- **Lady of the Lake Verification**:
  - Private investigation result delivered strictly to the investigator seat; concealed from all other players.
  - Loyalty is reported purely as Good or Evil (not specific character identity).
- **CSPRNG Fisher-Yates Shuffled Quest Reveal**:
  - Quest outcome cards (Success / Fail) are thoroughly shuffled before broadcast.
  - Total counts of Success/Fail are published; individual voter identity is completely decoupled.
- **Assassination Phase**:
  - If Good wins 3 quests, Evil enters the Assassinate Merlin phase.
  - Correct assassination of Merlin inverts the outcome to an Evil victory.
- **Bayesian AI Trust Heuristics**:
  - Evaluates team composition voting patterns, quest fail counts, and assassination target probabilities.

### 3.4 P2P Anti-Cheat Sanitization & Security (`p2p-anti-cheat-sanitization.e2e.spec.ts`)
- **Universal Room Protocol**:
  - Room codes generated with game prefix (`M...`, `P...`, `A...`).
  - Tokens isolated per seat using session-scoped storage (`sessionStorage`).
- **State Sanitization Pipeline**:
  - Host acts as authoritative server; never broadcasts raw `MatchState` to clients.
  - `GenericHostSession` strips secret `token` properties from `LobbySeat` arrays prior to broadcast.
  - `GenericGuestSession` verifies client state sanitization and rejects unauthenticated remote messages.
- **HKMJ-P2P-CHECK-01 Invariants**:
  - **Strict 3-Player Fly Mahjong**: Exactly 3 seats (`東/南/西`) — never padded with a 4th dummy bot.
  - **Deck Integrity**: Exactly 84 tiles for Malaysian Fly (Dots `1–9筒`, Winds, Dragons, 16 Bonus tiles, and 4 `jk` wildcards).
  - **Hand Masking**: Opponents' hand arrays are replaced with `null` + `handCount`.
  - **Concealed Kongs**: Masked as `'back'` tiles until `handOver` settlement.
- **URL Hygiene & Decoupled Reset**:
  - Removes room and token parameters from browser URL bar via `window.history.replaceState()`.
  - Dispatches decoupled `mahjong:leave` and `p2p:leave` events on departure.

---

## 4. Verification Checklist & Execution Commands

### 1. Agent Context & Rule Verification
```bash
npm.cmd run qa:agent-docs
```
*Result: PASSED (AGENTS.md under 20,000 bytes; 4 reference docs verified; 35 TS/spec files clean).*

### 2. TypeScript Static Compilation
```bash
npx.cmd tsc --noEmit
```
*Result: PASSED (0 type errors, strict TypeScript 5.9+ compiler compliance).*

### 3. ESLint Static Analysis & Security Auditing
```bash
npm.cmd run lint
```
*Result: PASSED (0 errors, 0 warnings across all source and test files, zero `eslint-disable`).*

### 4. Vitest Unit & E2E Test Execution
```bash
npm.cmd run test:ci
```
*Result: PASSED (14 test files passed, 105 tests passed, V8 statement coverage 82.10%, branch coverage 70.73%).*

### 5. Production Build
```bash
npm.cmd run build
```
*Result: PASSED (Application bundle generation complete, zero compile errors).*

---

## 5. Architectural Invariants Compliance

- **Zero Trivial Assertions**: Verified across all 105 tests. Zero instances of `.toBeTruthy()`, `.toBeDefined()`, or `.not.toBeNull()`. Exact property values, arrays, numerical thresholds, or explicit boolean states are strictly verified.
- **Zero Explicit `any`**: All test files use strict TypeScript types, interface contracts, and type-safe mocks.
- **Safe Object/Array Indexing**: Dynamic indexing is avoided in favor of `Map<K, V>` and `.at()` safe indexing to prevent prototype pollution and object-injection risks.
- **No `*.sh` Scripts**: No shell scripts were accessed, inspected, edited, or executed.
- **Metadata Isolation**: Agent teamwork data is strictly confined to `.agents/teamwork/`; no tests or code reside in agent metadata directories.
