# Original User Request

## Initial Request — 2026-10-31T08:29:58Z

Party Game Pavilion (`桌遊館`) — Multi-Game Shell, Malaysia Monopoly & Avalon

Transform the existing Angular 21 application into a unified Serverless P2P & Offline AI Party Game Pavilion hosting three complete games in one single-page application:
1. HK 4P & Authentic Malaysian 3P Fly Mahjong (3–4 players — migrated cleanly with zero rule regressions, including 打飛 Expose Fly and 換飛 Retrieve Fly)
2. Malaysia Landmarks Monopoly (大馬地標大富翁) (2–6 players — full 40-space 11×11 ring, RM currency, Saidina family house rules)
3. The Resistance: Avalon (阿瓦隆) (5–10 players — full classic role set, optional Lady of the Lake, anti-cheat Night Vision, offline communication)

Earlier conversation context & user Q&A:
- Q1: How should the multi-game shell and individual games (Mahjong, Monopoly, Avalon) be structured and deployed?
  A1: Single Angular SPA with lazy-loaded game routes (/mahjong, /monopoly, /avalon) sharing one core shell, P2P engine, i18n, and GitHub Pages build
- Q2: How would you like to scope our design and implementation roadmap?
  A2: Build everything end-to-end in one go (Shell + Mahjong refactor + playable Monopoly + playable Avalon)
- Q3: How should P2P rooms and invite links work across Mahjong (3–4p), Monopoly (2–6p), and Avalon (5–10p)?
  A3: Per-game rooms with direct deep-link invites (?game=avalon&room=AB12X) backed by a shared P2P transport service — simple, clean seat models per game
- Q4: How should the Game Shell's home experience, branding, and visual theming work?
  A4: Rebrand shell as "Party Game Pavilion / 桌遊館" with a Game Hub home screen, contextual header/rulebook per active game, and tailored table ambiance per game (Jade for Mahjong, Tycoon Gold/Emerald for Monopoly, Arthurian Midnight/Crimson for Avalon)
- Q5: Which board layout and theme would you like for Monopoly?
  A5: full 40 MY landmarks
- Q6: Which gameplay mechanics and win-condition modes should the 40-space Malaysia Monopoly game support?
  A6: Full rules (Houses/Hotels, Mortgage, Player & Bot Trading, configurable Auction toggle) + Lobby choice of "Last Player Standing" or "Round Limit (Net Worth Wins)" so matches can be brisk or marathon
- Q7: For Avalon (5–10 players), should AI Bots be available to fill seats alongside human P2P players?
  A7: Official 5–10 players with AI Bots available — supports Solo play vs AI, hybrid rooms (e.g., 3 friends + 2 bots), and full 5–10 human P2P matches
- Q8: Which character roles and optional Avalon modules should be configurable in the lobby?
  A8: Classic Avalon Roles (Merlin, Percival, Loyal Servant vs Assassin, Morgana, Mordred, Oberon, Minion) + optional "Lady of the Lake" lobby toggle
- Q9: How should Avalon handle player communication and screen privacy during quests and voting?
  A9: offline from the game, the game dun handle communication
- Q10: One last detail on Malaysia Monopoly ("Saidina"-style house rules): how should Free Parking and collecting rent while in Jail work?
  A10: Classic family house rules always on (Taxes/fines go into Free Parking jackpot, no rent collected while in Jail)

All non-negotiable repository invariants in AGENTS.md (HKMJ-P2P-CHECK-01, reading canonical docs/reference/*.md before editing, strict prohibition on reading/touching any *.sh scripts, strict per-seat P2P state sanitization, 0 explicit any, 0 eslint-disable, Map / .at() object-injection safety, .portal-input top-level styling, bounded modals with bottom-only close actions, trilingual zh/en/ms parity, and >= 80% line / >= 70% branch V8 test coverage with zero .toBeTruthy()/.toBeDefined()/.not.toBeNull()/TestBed.overrideComponent) must remain strictly enforced across every module.
