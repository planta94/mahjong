## 2026-10-31T08:32:56Z
You are teamwork_explorer_survey_2, working in c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_explorer_survey_2\.

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
Also review repo rules in c:\Users\chine\OneDrive\Desktop\Github\mahjong\AGENTS.md and docs/reference/*.md.

Objective:
Survey and design the complete domain model, game engine architecture, AI bot, and UI requirements for Malaysia Landmarks Monopoly (大馬地標大富翁) in src/app/games/monopoly/.

Scope & Key Areas to Investigate:
1. Full 40-Space Malaysia Board (monopoly-board.data.ts):
   - 11x11 perimeter ring in RM currency (RM 1,500 starting cash, RM 200 passing Mula / GO).
   - 8 Color Groups: 22 iconic Malaysian Landmarks across Melaka, Penang, Ipoh, Pahang, Sabah, Sarawak, Johor, Genting, Putrajaya, Bukit Bintang, TRX, KLCC. Determine prices, rents (base, 1-4 houses, hotel), house costs, mortgage values.
   - 4 Transit Hubs: KL Sentral, KLIA, Penang Bridge, Port Klang.
   - 2 Utilities: TNB & Air Selangor (dice-multiplier rents).
   - Corner spaces: Mula (GO), Penjara (Jail / Just Visiting), Parkir Percuma (Free Parking), Pergi Ke Penjara (Go To Jail).
   - Taxes: Cukai Pendapatan (RM 200) & Cukai Mewah (RM 100).
   - Action Decks: Nasib (Chance - 16 cards) and Dana Komuniti (Community Chest - 16 cards).
2. Rules Engine & Saidina Family House Rules (monopoly-engine.service.ts):
   - Saidina House Rule 1: Free Parking Jackpot Pot (all taxes, luxury tax, fines, and RM 50 jail bail accumulate in the pot; landing on Free Parking awards the pot).
   - Saidina House Rule 2: No Rent in Jail (owners currently in jail collect RM 0 rent).
   - Turn lifecycle: roll 2 dice (detect doubles; 3 consecutive doubles -> Go To Jail), movement, landing resolution (unowned property purchase/auction, owned property rent, taxes, chance/chest draw, jail).
   - Building rules: even-build constraint for Houses (1-4) & Hotels across color groups.
   - Financial distress: mortgage (50% value) & unmortgage (55% value), selling buildings, bankruptcy liquidation to creditor or bank.
   - Trading system: cash + property offers between players & bots.
   - Configurable lobby options: Auction toggle (on/off), Win Mode ("Last Tycoon Standing" vs "Round Limit: 20 / 30 / 40 rounds - highest net worth wins").
   - Anti-cheat state sanitization: Host holds shuffled deck state; guests receive sanitized player view.
3. Tactical AI Bot (monopoly-bot.service.ts):
   - Decision heuristics: property purchases, bidding in auctions, building houses/hotels, mortgage management under cash crunch, jail exit strategy, trade evaluation.
4. Component & UI Architecture:
   - MonopolyLobbyComponent (player count 2-6, seat selection, bot configuration, lobby settings).
   - MonopolyBoardComponent: responsive 11x11 CSS grid layout on > 768px with center hub (dice, jackpot display, log, action buttons), and .mobile-cards view on <= 768px.
   - Modals: Property Deed modal, Trade modal, Auction modal, Bankruptcy/Results modal.
