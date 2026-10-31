# BRIEFING — 2026-10-31T08:38:00Z

## Mission
Survey and design the complete domain model, game engine architecture, AI deduction bot, state sanitization, and UI requirements for The Resistance: Avalon (阿瓦隆) in src/app/games/avalon/.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, architect, synthesizer
- Working directory: c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_explorer_survey_3
- Original parent: ef1bcb5f-b649-4a2e-b9d7-7951164b25f3
- Milestone: Avalon Survey & Design

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code files
- Prohibited from reading, inspecting, creating, editing, renaming, deleting, or executing any *.sh scripts
- Strict compliance with AGENTS.md and docs/reference/*.md invariants
- .agents/teamwork/ must contain only metadata — no source code or tests

## Current Parent
- Conversation ID: ef1bcb5f-b649-4a2e-b9d7-7951164b25f3
- Updated: 2026-10-31T08:38:00Z

## Investigation State
- **Explored paths**:
  - `docs/reference/{architecture,security-and-p2p,ui-conventions,testing-and-quality}.md`
  - `src/app/core/models/mahjong.model.ts`
  - `src/app/core/services/{engine.service.ts,bot.service.ts,mahjong-session.service.ts}`
  - `src/styles/{_variables.scss,_breakpoints.scss,_mixins.scss,styles.scss}`
  - `public/assets/i18n/{zh,en,ms}.json`
- **Key findings**:
  - Exact rule configurations: 5-10 players, Good/Evil ratios, Quest 1-5 team size matrix, Quest 4 2-fail rule for 7+ players, Hammer 5-rejection Evil win.
  - Role knowledge matrix: Merlin, Percival, Loyal Servant, Assassin, Morgana, Mordred, Oberon, Minion.
  - Anti-cheat state sanitization: Host-authoritative `getPlayerView()`, CSPRNG Fisher-Yates shuffle for quest cards, private Lady of the Lake revelation to investigator only.
  - Privacy shield: Tap-to-hold / toggle privacy shield overlay concealing roles during offline/shoulder-surfing sessions.
  - Tactical deduction AI bot: Bayesian trust scoring, proposal generation, voting heuristics, strategic quest play, and Assassin Merlin detection.
- **Unexplored areas**: None. Ready for comprehensive handoff.

## Key Decisions Made
- Designed domain model adhering strictly to `eslint-plugin-security` (using `Map<K, V>`, `Array.prototype.at()`, zero `any`).
- Structured Avalon under `src/app/games/avalon/` with clear separation: `models/`, `data/`, `services/`, `components/`.

## Artifact Index
- DISPATCH.md — incoming dispatch instructions
- progress.md — liveness heartbeat
- BRIEFING.md — situational awareness
- handoff.md — comprehensive 5-component handoff report
