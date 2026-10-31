# Malaysia Landmarks Monopoly (大馬地標大富翁) — Comprehensive Domain Survey & Technical Architecture Report

## 1. Observation

### 1.1 Context & Repository Invariants
- **Source of Authority**: `c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md` (lines 9, 21–24, 31–32) specifies:
  - 2–6 players, full 40-space 11×11 ring in Ringgit Malaysia (RM) currency (RM 1,500 starting cash, RM 200 passing Mula/GO).
  - 8 Color Groups: 22 iconic Malaysian Landmarks across Melaka, Penang, Ipoh, Pahang, Sabah, Sarawak, Johor, Genting, Putrajaya, Bukit Bintang, TRX, KLCC.
  - 4 Transit Hubs: KL Sentral, Port Klang, Penang Bridge, KLIA.
  - 2 Utilities: TNB & Air Selangor.
  - Saidina Family House Rule 1: Free Parking Jackpot (taxes, fines, bail accumulate in the pot; landing on Free Parking awards the pot).
  - Saidina House Rule 2: No Rent in Jail (owners currently in jail collect RM 0 rent).
  - Full rules: Houses/Hotels with even-build constraint, Mortgage (50% value) & Unmortgage (55% value), Player & Bot Trading, configurable Auction toggle.
  - Configurable Win Conditions: "Last Tycoon Standing" (elimination) vs "Round Limit: 20 / 30 / 40 rounds (Highest Net Worth wins)".
  - Solo vs AI bots, hybrid rooms, and full P2P human matches.
- **Architecture Invariants**: `docs/reference/architecture.md` (lines 5–16), `docs/reference/security-and-p2p.md` (lines 5–16), and `AGENTS.md` (lines 20–34) require:
  - Host-in-browser authoritative state machine with per-seat `getPlayerView` sanitization.
  - Strict TypeScript 5.9+ with 0 explicit `any`, 0 `eslint-disable`, and `Map<K, V>` / `Array.prototype.at()` object-injection hardening (`security/detect-object-injection`).
  - Trilingual i18n parity across `public/assets/i18n/{en,zh,ms}.json` (`i18n-parity.spec.ts`).
  - Bounded modals (`max-width: min(720px, 95vw); max-height: 90vh; overflow-y: auto;`) with bottom-only action buttons (no top-right `X` close buttons).
  - Responsive layouts: desktop board (`> 768px`) vs `.mobile-cards` (`<= 768px`).

---

## 2. Logic Chain

From the authoritative requirements and repository constraints, we derive the complete technical design across 5 architectural pillars:

### Pillar 1: Full 40-Space Malaysia Board Data Specification (`monopoly-board.data.ts`)

The board forms an 11×11 perimeter ring (indices `0` to `39` clockwise):
- **Bottom Row (East to West)**: Pos 0 (Bottom-Right: Mula) to Pos 10 (Bottom-Left: Penjara / Just Visiting).
- **Left Column (South to North)**: Pos 10 to Pos 20 (Top-Left: Parkir Percuma / Free Parking).
- **Top Row (West to East)**: Pos 20 to Pos 30 (Top-Right: Pergi Ke Penjara / Go To Jail).
- **Right Column (North to South)**: Pos 30 to Pos 39 (and back to 0).

#### Complete 40-Space Registry Table
| Index | Space ID | Name (BM / EN / 中文) | Type | Group / Set | Cost (RM) | Base Rent | Rent (1H/2H/3H/4H/Hotel) | House Cost | Mortgage |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **0** | `mula` | Mula (GO / 起點) | `corner_go` | — | — | — | — | — | — |
| **1** | `melaka_famosa` | Kota A Famosa, Melaka | `property` | `brown` (Melaka) | 60 | 2 | 10 / 30 / 90 / 160 / 250 | 50 | 30 |
| **2** | `dana_1` | Dana Komuniti 1 | `community_chest`| — | — | — | — | — | — |
| **3** | `melaka_jonker` | Jonker Walk, Melaka | `property` | `brown` (Melaka) | 60 | 4 | 20 / 60 / 180 / 320 / 450 | 50 | 30 |
| **4** | `cukai_pendapatan` | Cukai Pendapatan (RM 200) | `tax` | — | 200 | — | (To Jackpot Pot) | — | — |
| **5** | `transit_kl_sentral` | KL Sentral (Stesen Keretapi) | `transit` | `transit` | 200 | 25 | 50 / 100 / 200 (1/2/3/4 Hubs) | — | 100 |
| **6** | `ipoh_kellies` | Kellie's Castle, Batu Gajah | `property` | `light_blue` (Ipoh)| 100 | 6 | 30 / 90 / 270 / 400 / 550 | 50 | 50 |
| **7** | `nasib_1` | Nasib 1 | `chance` | — | — | — | — | — | — |
| **8** | `ipoh_concubine` | Concubine Lane (二奶巷), Ipoh | `property` | `light_blue` (Ipoh)| 100 | 6 | 30 / 90 / 270 / 400 / 550 | 50 | 50 |
| **9** | `ipoh_birch` | Menara Jam Birch, Ipoh | `property` | `light_blue` (Ipoh)| 120 | 8 | 40 / 100 / 300 / 450 / 600 | 50 | 60 |
| **10**| `penjara` | Penjara / Melawat Sahaja | `corner_jail` | — | — | — | — | — | — |
| **11**| `penang_george_town`| Tapak Warisan George Town | `property` | `pink` (Penang) | 140 | 10 | 50 / 150 / 450 / 625 / 750 | 100 | 70 |
| **12**| `utiliti_tnb` | TNB (Tenaga Nasional) | `utility` | `utility` | 150 | 4× dice | 10× dice (if both owned) | — | 75 |
| **13**| `penang_hill` | Bukit Bendera (Penang Hill) | `property` | `pink` (Penang) | 140 | 10 | 50 / 150 / 450 / 625 / 750 | 100 | 70 |
| **14**| `penang_kek_lok_si` | Kuil Kek Lok Si, Penang | `property` | `pink` (Penang) | 160 | 12 | 60 / 180 / 500 / 700 / 900 | 100 | 80 |
| **15**| `transit_port_klang`| Pelabuhan Klang (Port Klang) | `transit` | `transit` | 200 | 25 | 50 / 100 / 200 (1/2/3/4 Hubs) | — | 100 |
| **16**| `pahang_cempedak` | Teluk Cempedak, Kuantan | `property` | `orange` (Pahang)| 180 | 14 | 70 / 200 / 550 / 750 / 950 | 100 | 90 |
| **17**| `dana_2` | Dana Komuniti 2 | `community_chest`| — | — | — | — | — | — |
| **18**| `pahang_taman_negara`| Taman Negara, Pahang | `property` | `orange` (Pahang)| 180 | 14 | 70 / 200 / 550 / 750 / 950 | 100 | 90 |
| **19**| `pahang_cameron` | Cameron Highlands, Pahang | `property` | `orange` (Pahang)| 200 | 16 | 80 / 220 / 600 / 800 / 1000| 100 | 100 |
| **20**| `parkir_percuma` | Parkir Percuma (Jackpot Pot) | `corner_parking`| — | — | — | (Collects entire Jackpot) | — | — |
| **21**| `borneo_kinabalu` | Gunung Kinabalu, Sabah | `property` | `red` (Borneo) | 220 | 18 | 90 / 250 / 700 / 875 / 1050| 150 | 110 |
| **22**| `nasib_2` | Nasib 2 | `chance` | — | — | — | — | — | — |
| **23**| `borneo_sipadan` | Pulau Sipadan, Sabah | `property` | `red` (Borneo) | 220 | 18 | 90 / 250 / 700 / 875 / 1050| 150 | 110 |
| **24**| `borneo_bako` | Taman Negara Bako, Sarawak | `property` | `red` (Borneo) | 240 | 20 | 100 / 300 / 750 / 925 / 1100| 150 | 120 |
| **25**| `transit_penang_bridge`| Jambatan Pulau Pinang | `transit` | `transit` | 200 | 25 | 50 / 100 / 200 (1/2/3/4 Hubs) | — | 100 |
| **26**| `johor_danga_bay` | Danga Bay, Johor Bahru | `property` | `yellow` (Johor)| 260 | 22 | 110 / 330 / 800 / 975 / 1150| 150 | 130 |
| **27**| `johor_desaru` | Desaru Coast, Johor | `property` | `yellow` (Johor)| 260 | 22 | 110 / 330 / 800 / 975 / 1150| 150 | 130 |
| **28**| `utiliti_air_selangor`| Pengurusan Air Selangor | `utility` | `utility` | 150 | 4× dice | 10× dice (if both owned) | — | 75 |
| **29**| `johor_legoland` | Legoland Malaysia, Iskandar | `property` | `yellow` (Johor)| 280 | 24 | 120 / 360 / 850 / 1025 / 1200| 150 | 140 |
| **30**| `pergi_penjara` | Pergi Ke Penjara (Go To Jail)| `corner_gotojail`| — | — | — | (Sent directly to Pos 10) | — | — |
| **31**| `kl_genting` | Genting SkyWorlds | `property` | `green` (KL-Metro)| 300 | 26 | 130 / 390 / 900 / 1100 / 1275| 200 | 150 |
| **32**| `kl_putrajaya` | Dataran Putrajaya | `property` | `green` (KL-Metro)| 300 | 26 | 130 / 390 / 900 / 1100 / 1275| 200 | 150 |
| **33**| `dana_3` | Dana Komuniti 3 | `community_chest`| — | — | — | — | — | — |
| **34**| `kl_bukit_bintang` | Bukit Bintang (Golden Triangle)| `property` | `green` (KL-Metro)| 320 | 28 | 150 / 450 / 1000 / 1200 / 1400| 200 | 160 |
| **35**| `transit_klia` | KLIA (Lapangan Terbang KL) | `transit` | `transit` | 200 | 25 | 50 / 100 / 200 (1/2/3/4 Hubs) | — | 100 |
| **36**| `nasib_3` | Nasib 3 | `chance` | — | — | — | — | — | — |
| **37**| `kl_trx` | Tun Razak Exchange (TRX) | `property` | `dark_blue` (KLCC)| 350 | 35 | 175 / 500 / 1100 / 1300 / 1500| 200 | 175 |
| **38**| `cukai_mewah` | Cukai Mewah (RM 100) | `tax` | — | 100 | — | (To Jackpot Pot) | — | — |
| **39**| `kl_klcc` | Menara Berkembar Petronas (KLCC)| `property`| `dark_blue` (KLCC)| 400 | 50 | 200 / 600 / 1400 / 1700 / 2000| 200 | 200 |

---

### Pillar 2: Action Decks (Nasib & Dana Komuniti — 16 Cards Each)

All fines, tax payments, medical fees, and repair assessments are strictly routed into `state.jackpotPot` (Saidina House Rule 1).

#### 16 Nasib (Chance) Cards:
1. `CHANCE_ADVANCE_MULA`: Maju ke Mula. Terima RM 200.
2. `CHANCE_ADVANCE_KLCC`: Lawat Menara Berkembar Petronas (KLCC). Jika melepasi Mula, terima RM 200.
3. `CHANCE_ADVANCE_TRX`: Maju ke Tun Razak Exchange (TRX). Jika melepasi Mula, terima RM 200.
4. `CHANCE_ADVANCE_TRANSIT_NEAREST_1`: Maju ke Stesen Transit terdekat. Jika bertuan, bayar pemilik 2× ganda sewa. Jika tiada pemilik, boleh dibeli.
5. `CHANCE_ADVANCE_TRANSIT_NEAREST_2`: Maju ke Stesen Transit terdekat (kedua). Jika bertuan, bayar 2× sewa.
6. `CHANCE_ADVANCE_UTILITY_NEAREST`: Maju ke Utiliti terdekat (TNB / Air Selangor). Jika bertuan, baling dadu dan bayar 10× jumlah dadu.
7. `CHANCE_DIVIDEND_ASB`: Dividen ASB & KWSP dikreditkan! Terima RM 50 dari Bank.
8. `CHANCE_GO_TO_JAIL`: Masuk Penjara! Terus ke Penjara tanpa melalui Mula, jangan kutip RM 200.
9. `CHANCE_GET_OUT_OF_JAIL`: Kad Pelepasan Penjara Percuma. Simpan atau niagakan.
10. `CHANCE_REPAIRS`: Penyelenggaraan Bangunan: Bayar RM 25 setiap rumah dan RM 100 setiap hotel ke Tabung Parkir Percuma.
11. `CHANCE_SPEEDING_FINE`: Saman Trafik Lebuhraya PLUS! Bayar RM 15 ke Tabung Parkir Percuma.
12. `CHANCE_BACK_THREE`: Undur 3 petak ke belakang. Selesaikan petak yang diduduki.
13. `CHANCE_ADVANCE_GEORGE_TOWN`: Lawat Tapak Warisan George Town. Jika melepasi Mula, terima RM 200.
14. `CHANCE_ADVANCE_KL_SENTRAL`: Naik tren di KL Sentral. Jika melepasi Mula, terima RM 200.
15. `CHANCE_CHAIRMAN_BOARD`: Anda dilantik sebagai Pengerusi GLC! Bayar setiap pemain RM 50.
16. `CHANCE_LOAN_MATURES`: Pinjaman Amanah Saham matang! Kutip RM 150 dari Bank.

#### 16 Dana Komuniti (Community Chest) Cards:
1. `CHEST_ADVANCE_MULA`: Maju ke Mula. Terima RM 200.
2. `CHEST_BANK_ERROR`: Kesilapan Bank memihak kepada anda! Terima RM 200 dari Bank.
3. `CHEST_DOCTOR_FEE`: Rawatan Hospital Kerajaan. Bayar RM 50 ke Tabung Parkir Percuma.
4. `CHEST_STOCK_SALE`: Jualan Saham Bursa Malaysia memberi pulangan! Terima RM 50.
5. `CHEST_GET_OUT_OF_JAIL`: Kad Pelepasan Penjara Percuma. Simpan atau niagakan.
6. `CHEST_GO_TO_JAIL`: Masuk Penjara! Terus ke Penjara tanpa melalui Mula, jangan kutip RM 200.
7. `CHEST_HOLIDAY_FUND`: Dana Percutian Cuti-Cuti Malaysia matang! Terima RM 100.
8. `CHEST_TAX_REFUND`: Bayaran Balik Cukai LHDN! Terima RM 20 dari Bank.
9. `CHEST_BIRTHDAY`: Hari Lahir Anda! Kutip RM 10 daripada setiap pemain.
10. `CHEST_LIFE_INSURANCE`: Insurans Hayat matang! Terima RM 100.
11. `CHEST_HOSPITAL_FEE`: Pemeriksaan Perubatan Swasta. Bayar RM 100 ke Tabung Parkir Percuma.
12. `CHEST_SCHOOL_FEES`: Yuran Persekolahan Anak-Anak. Bayar RM 50 ke Tabung Parkir Percuma.
13. `CHEST_CONSULTANCY`: Bayaran Perundingan Profesional diterima. Kutip RM 25.
14. `CHEST_STREET_REPAIRS`: Pembaikan Jalan Raya: Bayar RM 40 setiap rumah dan RM 115 setiap hotel ke Tabung Parkir Percuma.
15. `CHEST_BEAUTY_CONTEST`: Tempat Kedua Pertandingan Kebudayaan Malaysia! Terima RM 10.
16. `CHEST_INHERITANCE`: Menerima Harta Pusaka Keluarga! Terima RM 100.

---

### Pillar 3: Rules Engine & State Machine (`monopoly-engine.service.ts`)

#### 1. Saidina Family House Rules:
- **Saidina Rule 1 (Free Parking Jackpot)**:
  - `state.jackpotPot` starts at RM 100 (seed).
  - All Income Tax (RM 200), Luxury Tax (RM 100), Chance/Chest fines, and RM 50 Jail Bail are added directly to `state.jackpotPot`.
  - When an active player lands on Space 20 (`parkir_percuma`), they immediately collect `state.jackpotPot`, and the pot resets to RM 100.
- **Saidina Rule 2 (No Rent in Jail)**:
  - If a player lands on an owned property whose owner has `inJail === true`, the calculated rent is **strictly RM 0**.
  - Log records: `[Player X landed on Property Y, but Owner Z is currently in Jail — RM 0 rent collected!]`.

#### 2. Turn Lifecycle & Dice Mechanics:
- `phase: 'roll' | 'action' | 'auction' | 'trade' | 'financialDistress' | 'gameOver'`.
- Rolling 2 dice (`die1`, `die2` ∈ [1, 6]):
  - If `die1 === die2` (`isDouble`): `doublesStreak++`.
  - If `doublesStreak === 3`: Player is caught speeding and sent to Jail immediately (`position = 10`, `inJail = true`, `doublesStreak = 0`, phase advances to next player).
  - Movement: `(oldPos + die1 + die2) % 40`. If wrapped past 0, award RM 200 salary.
  - After resolving landing space: if `isDouble` and not sent to jail, player gets an extra roll!

#### 3. Unowned Properties & Auction System:
- When landing on an unowned property:
  - Active player may choose `buyProperty()`.
  - If player chooses `passProperty()`:
    - If `lobbyRules.auctionEnabled === true`: An **Auction** begins immediately. All active non-bankrupt players can place bids in RM 10 increments starting from RM 10. A 10-second timer resets per bid. When all pass or timer expires, highest bidder receives deed and pays bid amount.
    - If `lobbyRules.auctionEnabled === false`: Property remains in the bank unowned.

#### 4. Building Rules & Even-Build Constraint:
- A player may only build houses/hotels on a color group if they own all properties in that group, and none are mortgaged.
- `evenBuildConstraint`: `maxHousesInGroup - minHousesInGroup <= 1`.
- A 5th house is replaced by 1 hotel. Sells back to bank for 50% purchase price.

#### 5. Financial Distress & Debt Liquidation:
- When owing money exceeding `player.cash`:
  - Player enters `phase: 'financialDistress'` with `debtTarget: { creditorSeat: number | 'bank' | 'jackpot', amountOwed: number }`.
  - Player can mortgage unimproved properties (receives 50% face value).
  - Player can sell houses/hotels (receives 50% cost).
  - Player can trade properties to solvent players for cash.
  - If unable to satisfy debt: `declareBankruptcy()`.
  - Liquidation transfers all remaining assets to creditor (or auctions them if bank is creditor).

#### 6. Win Conditions:
- **Last Tycoon Standing**: Standard knockout until 1 solvent player remains.
- **Round Limit (20 / 30 / 40 rounds)**:
  - Game ends when `state.currentRound > maxRounds`.
  - `netWorth = cash + propertiesValue + buildingsValue + getOutOfJailCardsValue`.
  - Player with highest Net Worth wins!

#### 7. Anti-Cheat State Sanitization (`getPlayerView`):
- Authoritative Host retains full `MonopolyMatchState` (including secret shuffled deck arrays `nasibDeck` and `danaDeck`).
- Guests receive `MonopolyPlayerView`:
  - Decks are replaced with counts: `nasibCount: number`, `danaCount: number`.
  - `LobbySeat.token` stripped to `null`.
  - All public board elements, deeds, cash, positions, and active bids are synchronized transparently.

---

### Pillar 4: Tactical AI Bot (`monopoly-bot.service.ts`)

The AI bot executes smart heuristics to avoid stalling and provide exciting competition:
1. **Purchase Decisions**:
   - Maintains a safety cash reserve: `safetyReserve = RM 150 + (roundNumber * 5)`.
   - Always purchases if completing a color monopoly or blocking an opponent from completing one.
   - For isolated properties, buys if `cash - price >= safetyReserve`.
2. **Auction Bidding**:
   - Perceived value: `baseValue * (completesMonopoly ? 1.6 : blocksOpponent ? 1.25 : 0.85)`.
   - Max bid: `min(perceivedValue, cash - safetyReserve)`.
   - Bids if current highest bid is below max bid; folds otherwise.
3. **House / Hotel Development**:
   - Evaluates owned full color groups.
   - Requires cash buffer of `RM 200 + maxOpponentRent`.
   - Systematically builds up to 3 houses first (maximum ROI inflection point in Monopoly economics), then hotels.
4. **Distress Liquidation**:
   - When facing debt: Mortgages isolated properties with lowest landing probability first. Never demolishes houses or mortgages monopoly sets unless facing imminent bankruptcy.
5. **Jail Strategy**:
   - Early game: Uses card or pays RM 50 bail immediately on turn 1 to maximize property acquisition.
   - Late game: If opponent has hotels and bot owns few properties, stays in jail (rolls for doubles). If bot owns high-rent hotels, pays bail to leave jail and start collecting rent again (due to Saidina Rule 2).
6. **Trade Evaluation**:
   - Assesses proposed trades via net worth delta + monopoly equity multiplier (rejects trades that hand human an uncountered monopoly).

---

### Pillar 5: Component & UI Architecture (`src/app/games/monopoly/`)

```
src/app/games/monopoly/
├── models/
│   ├── monopoly.model.ts              // MatchState, PlayerView, SpaceSpec, Deed, Card, Action
│   ├── monopoly-board.data.ts         // 40 spaces registry with full rent schedules & RM values
│   └── monopoly-cards.data.ts         // 16 Nasib + 16 Dana Komuniti card definitions
├── services/
│   ├── monopoly-engine.service.ts     // Authoritative rules engine, state transitions, Saidina rules
│   ├── monopoly-bot.service.ts        // Tactical AI bot heuristics (buy, bid, build, trade, jail)
│   └── monopoly-session.service.ts    // Signal store, WebRTC/BroadcastChannel sync, audio triggers
├── lobby/
│   ├── monopoly-lobby.component.ts    // 2-6 player setup, bot slots, auction toggle, round limit
│   ├── monopoly-lobby.component.html
│   └── monopoly-lobby.component.scss
├── table/
│   ├── monopoly-table.component.ts    // Orchestrating table view (board, player HUD, log, modals)
│   ├── monopoly-table.component.html
│   └── monopoly-table.component.scss
├── components/
│   ├── board/
│   │   ├── monopoly-board.component.ts // 11×11 CSS Grid perimeter ring + Center Hub
│   │   ├── monopoly-board.component.html
│   │   └── monopoly-board.component.scss
│   ├── space/
│   │   ├── monopoly-space.component.ts // Space tile renderer (deed stripe, tokens, houses/hotels)
│   │   ├── monopoly-space.component.html
│   │   └── monopoly-space.component.scss
│   ├── center-hub/
│   │   ├── center-hub.component.ts     // Dice roll arena, Free Parking jackpot meter, action buttons
│   │   ├── center-hub.component.html
│   │   └── center-hub.component.scss
│   └── player-strip/
│       ├── player-strip.component.ts   // Desktop HUD & Mobile Cards player asset view
│       ├── player-strip.component.html
│       └── player-strip.component.scss
└── modals/
    ├── deed-dialog/                   // Bounded property deed card inspector
    ├── trade-dialog/                  // Cash & property trading negotiation modal
    ├── auction-dialog/                // Real-time ticking auction bidding interface
    └── bankruptcy-dialog/             // Liquidation & victory podium modal
```

#### UI & Styling Directives:
- **Desktop Table (`> 768px`)**:
  - `display: grid; grid-template-columns: repeat(11, 1fr); grid-template-rows: repeat(11, 1fr);`
  - Aspect ratio: `1 / 1; max-width: min(90vh, 900px);`
  - Center hub: `grid-column: 2 / 11; grid-row: 2 / 11;` with emerald/tycoon gold felt styling (`#0a3d2e` to `#041c14` radial gradient).
- **Mobile Cards (`<= 768px`)**:
  - Responsive `.mobile-cards` layout displaying the active player card, current landing property card, quick action buttons, and scrollable mini-tracker.
- **Bounded Modals**:
  - `max-width: min(720px, 95vw); max-height: 90vh;` with middle `.modal-body` (`max-height: 55vh; overflow-y: auto;`) and bottom-only action buttons.
- **Trilingual Parity**:
  - Top-level key `MONOPOLY` added identically to `en.json`, `zh.json`, and `ms.json`.

---

## 3. Caveats

1. **Card Pile Reshuffling**: When the 16 Nasib or Dana Komuniti cards are exhausted, discarded cards (excluding currently held "Kad Pelepasan Penjara" cards) must be reshuffled using CSPRNG (`crypto.getRandomValues`).
2. **Double Dice Rule in Jail**: When rolling to escape jail, rolling doubles allows exit and movement immediately, but does NOT grant an additional roll (preventing infinite loops in jail escape).
3. **Mortgage Rent**: Mortgaged properties collect RM 0 rent and do not prevent other properties in the same color set from charging normal improved/unimproved rent (though no houses can be built while any property in the group is mortgaged).
4. **Auction Pass Synchronization**: In P2P multiplayer auctions, every active guest must have an opportunity to bid or pass. A 10-second countdown timer ensures disconnected or idle guests do not lock up the auction.

---

## 4. Conclusion

The domain model and technical architecture for Malaysia Landmarks Monopoly (大馬地標大富翁) are fully specified and completely aligned with all repository standards:
1. **Board & Cards**: Complete 40-space data array with 22 landmarks in 8 color groups, 4 transit hubs, 2 utilities, 2 taxes, 4 corners, and 32 authentic Malaysian chance/chest cards in RM currency.
2. **Rules Engine**: Incorporates authentic Saidina family house rules (Free Parking Jackpot Pot and No Rent in Jail), dice doubles streak, even-build constraint, mortgage/liquidation, trading, and dual win conditions.
3. **AI Bot**: Multi-stage tactical bot evaluating cash reserve, monopoly equity, auction thresholds, smart development, and jail evasion.
4. **UI & Quality**: Responsive 11×11 CSS Grid + mobile cards view, bounded modals with bottom actions, host-authoritative state sanitization, and full trilingual i18n parity.

---

## 5. Verification Method

To independently verify this design during and after implementation:
1. **Rulebook & Board Data Integrity**:
   - Verify all 40 spaces (`0` to `39`) exist with unique IDs, correct prices, and exact rent arrays in `monopoly-board.data.ts`.
   - Verify both action decks contain exactly 16 cards in `monopoly-cards.data.ts`.
2. **Unit Tests & V8 Coverage Target (>= 80% Lines / >= 70% Branches)**:
   - `monopoly-board.spec.ts`: Test space sequence, corner positions (0, 10, 20, 30), color group memberships, and transit/utility rent calculations.
   - `monopoly-engine.service.spec.ts`:
     - Test Passing Mula awards RM 200.
     - Test Saidina Rule 1: Taxes & fines increment `jackpotPot`, landing on Space 20 awards pot and resets to seed.
     - Test Saidina Rule 2: Owner in jail collects RM 0 rent.
     - Test 3 consecutive doubles sends player to jail.
     - Test even-build constraint and mortgage/unmortgage math (50% / 55%).
     - Test bankruptcy liquidation and win condition evaluation (Last Tycoon vs Net Worth at round limit).
   - `monopoly-bot.service.spec.ts`: Test bot property purchases, auction bidding limits, development decisions, and trading logic.
   - `monopoly-session.service.spec.ts`: Test `getPlayerView` sanitization (card order concealed, seat tokens stripped to null).
   - `i18n-parity.spec.ts`: Run `npm.cmd run test:ci` to ensure `MONOPOLY` translation keys match across `en.json`, `zh.json`, and `ms.json`.
3. **Repo Verification Checklist**:
   ```bash
   npm.cmd run qa:agent-docs
   npx.cmd tsc --noEmit
   npm.cmd run lint
   npm.cmd run test:ci
   npm.cmd run build
   ```
