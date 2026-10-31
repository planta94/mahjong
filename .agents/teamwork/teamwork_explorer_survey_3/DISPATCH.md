## 2026-10-31T08:33:11Z
From: ef1bcb5f-b649-4a2e-b9d7-7951164b25f3 (parent orchestrator)
Priority: MESSAGE_PRIORITY_HIGH

You are teamwork_explorer_survey_3, working in c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_explorer_survey_3\.

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
Also review repo rules in c:\Users\chine\OneDrive\Desktop\Github\mahjong\AGENTS.md and docs/reference/*.md.

Objective:
Survey and design the complete domain model, game engine architecture, AI bot, and UI requirements for The Resistance: Avalon (阿瓦隆) in src/app/games/avalon/.

Scope & Key Areas to Investigate:
1. Official Game Rules & Configurations:
   - Seats: 5 to 10 players.
   - Good vs Evil ratio per player count (5p: 3G/2E, 6p: 4G/2E, 7p: 4G/3E, 8p: 5G/3E, 9p: 6G/3E, 10p: 6G/4E).
   - Quest team size matrix for Quests 1 to 5 across all player counts (5-10).
   - Special Rule: Quest 4 requires 2 Fails to fail when player count >= 7.
   - Vote track: 5 rejected team proposals leads to automatic Evil victory (Hammer track).
2. Roles & Optional Modules:
   - Loyal Servants of Arthur & Minions of Mordred.
   - Special Roles: Merlin (knows evil except Mordred), Percival (sees Merlin & Morgana without knowing who is who), Assassin (assassinates Merlin if Good wins 3 quests), Morgana (appears as Merlin to Percival), Mordred (invisible to Merlin), Oberon (evil but does not see other evils and other evils do not see him).
   - Optional Module: Lady of the Lake (usable after Quest 2, 3, 4 by previous holder to investigate loyalty of another player; loyalty is revealed secretly to holder only; target becomes next holder).
   - Endgame Phase: If Good succeeds on 3 quests, Evil enters Assassinate Merlin phase. Assassin (with Evil team consultation) selects one Good player. If Merlin is hit, Evil wins!
3. Anti-Cheat State Sanitization & Offline-Comms UX:
   - Zero in-game chat (communication is conducted offline / verbally as requested by user).
   - Per-seat state sanitization: Host masks all private roles and only provides sanitized Night-Vision clues appropriate for each player's specific role.
   - Private Lady of the Lake result: sent ONLY to the investigator.
   - Shuffled quest cards: Fisher-Yates CSPRNG shuffle before revealing Quest outcomes (counts of Success / Fail only, never revealing who played what).
   - Hold / Toggle-to-Peek Privacy Shield: A secure UI overlay that conceals role card and night-vision knowledge until pressed/held, preventing shoulder surfing during offline play.
   - Public Vote & Quest History Table / Mobile Cards: transparent tracking of who proposed what team, public votes (Approve/Reject per player), and quest outcomes.
4. Deduction AI Bot (avalon-bot.service.ts):
   - AI logic for team proposal (as Good or Evil).
   - Voting heuristic on proposed teams (trust scores, known roles, proposal history).
   - Quest card play heuristic (Good must play Success; Evil chooses Success or Fail strategically to avoid suspicion or trigger failure).
   - Lady of the Lake target selection & claimed claim.
   - Evil assassination heuristic (Merlin identification scoring based on proposal & voting patterns).
   - Supports Solo vs 4-9 AI bots, hybrid human+bot rooms, and full P2P human matches.
5. Component & UI Architecture:
   - AvalonLobbyComponent (player count 5-10, role toggles, Lady of the Lake toggle, bot slot filling).
   - AvalonTableComponent (Quest board, vote track, current leader/team proposer, team selection UI, public vote reveal, secret quest execution modal, privacy shield role viewer, Assassination phase modal).

Constraints:
- READ-ONLY exploration. DO NOT edit or create any source code files. DO NOT run any *.sh scripts (prohibited).
- DO NOT execute builds or tests directly unless needed for exploration.
- Write your comprehensive domain model, data structures, and architecture plan to:
  c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_explorer_survey_3\handoff.md
- Update your progress.md periodically with "Last visited: [timestamp]".
- When complete, send a message back to the parent orchestrator (conversation ID: ef1bcb5f-b649-4a2e-b9d7-7951164b25f3) with your conclusion summary and pointing to handoff.md.
