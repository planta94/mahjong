## 2026-10-31T09:52:03Z

You are teamwork_worker_monopoly, working in c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_worker_monopoly\.

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
Also review repo rules in c:\Users\chine\OneDrive\Desktop\Github\mahjong\AGENTS.md, docs/reference/*.md, and c:\Users\chine\OneDrive\Desktop\Github\mahjong\PROJECT.md.
Review Explorer 2's comprehensive domain blueprint at:
c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_explorer_survey_2\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Assigned Deliverables for Malaysia Landmarks Monopoly (大馬地標大富翁):
1. Domain Models (`src/app/games/monopoly/models/monopoly.model.ts`):
   - Full data types for spaces, properties, groups, cards, action types, player state, lobby settings, and sanitized player view.
2. Full 40-Space Malaysia Board Data (`src/app/games/monopoly/data/monopoly-board.data.ts`):
   - 11x11 perimeter ring in RM currency (RM 1,500 starting cash, RM 200 passing Mula/GO).
   - 22 Landmarks in 8 Color Groups: Melaka, Ipoh, Penang, Pahang, Sabah/Sarawak, Johor, Genting/Putrajaya/Bukit Bintang, TRX/KLCC with authentic prices (RM 60–400), rent schedules (base, 1–4 houses, hotel), house costs (RM 50–200), and mortgage/unmortgage values (50% / 55%).
   - 4 Transit Hubs: KL Sentral, Port Klang, Penang Bridge, KLIA (rents: RM 25, 50, 100, 200).
   - 2 Utilities: TNB & Air Selangor (4x/10x dice roll multipliers).
   - Taxes: Cukai Pendapatan (RM 200) & Cukai Mewah (RM 100).
   - Corners: Mula (0), Penjara (10), Parkir Percuma (20), Pergi Ke Penjara (30).
3. Authentic Malaysian Action Decks (`src/app/games/monopoly/data/monopoly-cards.data.ts`):
   - 16 Nasib (Chance) & 16 Dana Komuniti (Community Chest) cards. All fines/taxes route cash into Free Parking Jackpot Pot.
4. Rules Engine & Saidina Family House Rules (`src/app/games/monopoly/services/monopoly-engine.service.ts`):
   - Saidina House Rule 1: Free Parking Jackpot Pot (taxes, fines, bail accumulate; landing on Free Parking awards entire pot).
   - Saidina House Rule 2: Owners in jail collect RM 0 rent.
   - Turn lifecycle: dice roll, doubles streak (3 doubles -> Jail), movement, landing resolution, bankruptcy.
   - Even-build constraint for Houses (1-4) & Hotels across color groups.
   - Mortgages (50%) & Unmortgaging (55%), debt liquidation.
   - Cash + property trading between players and bots.
   - Configurable lobby options: Auction toggle, Win Mode ("Last Tycoon Standing" vs "Round Limit: 20/30/40 rounds").
   - Host-authoritative anti-cheat state sanitization (`getMonopolyPlayerView`).
5. Tactical Monopoly AI Bot (`src/app/games/monopoly/services/monopoly-bot.service.ts`):
   - Heuristics for property purchases, auction bidding, 3-house focus, distress mortgage, jail exit, trade evaluation.
6. Monopoly P2P Session (`src/app/games/monopoly/services/monopoly-session.service.ts`):
   - 2–6 seats, bot filling, room codes ('P' prefix), WebRTC + BroadcastChannel using `P2PRoomTransport`.
7. Responsive UI (`src/app/games/monopoly/components/`):
   - `monopoly-lobby`: seat picker (2-6), bot toggle, room code copy, settings.
   - `monopoly-board`: desktop 11x11 CSS grid (> 768px) with center hub (animated dice, jackpot display, turn actions), and responsive `.mobile-cards` view (<= 768px).
   - Bounded modals: Property Deed, Trade, Auction, Bankruptcy/Results (bottom action buttons only, max-height 90vh, < 32 kB SCSS).
8. Routing & i18n:
   - Wire `/monopoly/lobby` and `/monopoly/board` into `src/app/app.routes.ts`.
   - Update `public/assets/i18n/{en,zh,ms}.json` under `MONOPOLY` in 100% parity.
9. Verification:
   Run:
   `npm run qa:agent-docs`
   `npx tsc --noEmit`
   `npm run lint`
   `npm run test:ci` (ensure `monopoly-rules.e2e.spec.ts` and all unit specs pass!)
   `npm run build`

## 2026-10-31T10:28:21Z

**Context**: Monopoly Implementation (Milestone 3 & 4)
**Content**: Please provide a brief status update on your Step 10 verification and handoff report.
**Action**: Report current status and estimated completion.
