## 2026-10-31T10:32:25Z

You are teamwork_auditor_monopoly, working in c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_auditor_monopoly\.

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
Also review repo rules in c:\Users\chine\OneDrive\Desktop\Github\mahjong\AGENTS.md and docs/reference/*.md.

Conduct a comprehensive Forensic Integrity Audit of the Malaysia Landmarks Monopoly implementation in src/app/games/monopoly/ (handoff at c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_worker_monopoly\handoff.md).

Inspect all files:
- src/app/games/monopoly/models/monopoly.model.ts
- src/app/games/monopoly/data/monopoly-board.data.ts
- src/app/games/monopoly/data/monopoly-cards.data.ts
- src/app/games/monopoly/services/monopoly-engine.service.ts
- src/app/games/monopoly/services/monopoly-bot.service.ts
- src/app/games/monopoly/services/monopoly-session.service.ts
- src/app/games/monopoly/components/monopoly-lobby/
- src/app/games/monopoly/components/monopoly-board/
- All spec files in src/app/games/monopoly/ and src/app/core/e2e-specs/monopoly-rules.e2e.spec.ts

Audit Checklist:
1. Hardcoded test outputs or dummy implementations: Verify all game state logic, property rent schedules, and AI bot evaluations are genuine.
2. Saidina House Rules: Verify Rule 1 (Free Parking pot collects fines/taxes/bail) and Rule 2 (No rent in jail) are authentically enforced in code.
3. Anti-cheat sanitization: Verify getMonopolyPlayerView strips secret deck orders and seat tokens.
4. Repository Invariants: 0 eslint-disable, 0 explicit any, 0 trivial assertions (.toBeTruthy/.toBeDefined/.not.toBeNull), safe Map / .at() indexing, bounded modals with bottom actions only.
5. Verification: run npm run qa:agent-docs, npx tsc --noEmit, npm run lint, npm run test:ci.

Deliver BINARY AUDIT VERDICT: CLEAN or INTEGRITY VIOLATION in handoff.md at c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_auditor_monopoly\handoff.md and notify parent.
