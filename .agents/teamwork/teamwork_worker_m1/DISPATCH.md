## 2026-10-31T08:42:49Z
You are teamwork_worker_m1, working in c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_worker_m1\.

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
Also review repo rules in c:\Users\chine\OneDrive\Desktop\Github\mahjong\AGENTS.md, docs/reference/*.md, and the master plan in c:\Users\chine\OneDrive\Desktop\Github\mahjong\PROJECT.md.
Review Explorer 1's detailed handoff report at:
c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_explorer_survey_1\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Assigned Deliverables for Milestone 1:
1. Reusable P2P Room Transport (`src/app/core/services/p2p-room.transport.ts`):
   - Generalized host/guest session protocol across PeerJS (`0.peerjs.com:443` + `openrelay.metered.ca` STUN/TURN) and `BroadcastChannel` fallback.
   - Game-prefixed room codes: 'M' (Mahjong), 'P' (Monopoly), 'A' (Avalon) + 5 alphanumeric characters.
   - Room-scoped guest tokens in `sessionStorage` (`party_guest_token_${roomCode}`), host token generation.
   - Per-seat `buildPlayerView(state, seatIdx)` state sanitization hook ensuring host secrets and seat tokens are stripped.
   - URL hygiene via `window.history.replaceState()` and decoupled reset via `p2p:leave` event.
2. Shell UI & Audio Infrastructure (`src/app/core/services/shell-ui.service.ts`):
   - Signals: `activeGame` ('hub' | 'mahjong' | 'monopoly' | 'avalon'), `activeRoomCode`, `playerNickname` (with migration from `hkmj_nickname` to `party_pavilion_nickname`), `soundEnabled`, `bgmEnabled`, `showRulebookModal`.
   - Web Audio synthesizer for procedural sound effects (click, deal, dice, alert, fanfare, fail) and SpeechSynthesis voice callouts.
   - Contextual game rulebook dialog state management.
3. Universal Game Hub (`src/app/pages/hub/hub.component.ts`, `.html`, `.scss`):
   - Standalone component mounted at `/`.
   - 3 Game Selection Cards (Mahjong, Monopoly, Avalon) with player counts, badges, and descriptions.
   - Universal room-code join input: auto-routing `M...` to Mahjong, `P...` to Monopoly, `A...` to Avalon.
   - Deep-link / invite link handler: reads `?game=<id>&room=<code>` on init and redirects to the target game lobby.
   - Nickname editor modal or inline field.
4. Shell Refactor & App Routes (`src/app/app.component.*`, `src/app/layout/header/app-header.component.*`, `src/app/app.routes.ts`):
   - Header rebranded to "Party Game Pavilion / 桌遊館 / Astaka Permainan" with contextual badge, sound/BGM toggles, active room pill, rulebook toggle, and "Switch Game / 返回大廳" button when not in an active room.
   - Routes: `/` -> `HubComponent`, legacy `/lobby` -> redirect to `/mahjong/lobby` with query params preserved, `/table` -> redirect to `/mahjong/table` with query params preserved.
   - Decouple `AppComponent` and `AppHeaderComponent` from `MahjongSessionService` so they rely on `ShellUiService`.
5. Context Verification Gate Fix (`scripts/verify-agent-context.mjs`):
   - Update `assertCondition(!fs.existsSync(path.join(repoRoot, '.agents')), ...)` to allow `.agents/teamwork/` metadata while forbidding stray config files.
6. Trilingual i18n Dictionary Parity (`public/assets/i18n/{en,zh,ms}.json`):
   - Add new keys for `HUB`, `SHELL`, and updated `HEADER` across all three files in strict lockstep.
7. Unit Tests:
   - Add unit specs for `shell-ui.service.spec.ts`, `p2p-room.transport.spec.ts`, `hub.component.spec.ts`.
