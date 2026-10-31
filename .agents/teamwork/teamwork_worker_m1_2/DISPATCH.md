## 2026-10-31T09:35:31Z

You are teamwork_worker_m1_2, working in c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_worker_m1_2\.

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\ORIGINAL_REQUEST.md
Also review repo rules in c:\Users\chine\OneDrive\Desktop\Github\mahjong\AGENTS.md and docs/reference/*.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Objective:
Resolve all 5 integration flaws identified by Reviewer 1, Challenger 1, and Challenger 2 during the Milestone 1 Verification Gate.

Concrete Tasks to Fix:
1. Fix `src/app/app.routes.ts`:
   - Add routes for Monopoly (`/monopoly/lobby`, `/monopoly/board`) and Avalon (`/avalon/lobby`, `/avalon/table`). For Milestone 1, they can mount placeholder/hub views or route components so that navigating via Hub CTA buttons or universal room codes (`P...`, `A...`) cleanly reaches the destination without bouncing to `/` or triggering infinite redirects.
2. Fix `src/app/core/services/p2p-room.transport.ts`:
   - In `parseUniversalRoomCode()`: ensure the room code from URL query params or raw string input is normalized to UPPERCASE (e.g., `?room=p1234` -> `P1234`), so that lowercase room codes correctly resolve to monopoly / avalon rather than misrouting.
   - In `GenericGuestSession.sendAction()`: Send via the active WebRTC data connection IF connected; otherwise fallback to BroadcastChannel. DO NOT send over both channels simultaneously, preventing the Host from receiving and processing duplicate actions.
3. Fix `src/app/pages/lobby/lobby.component.ts`:
   - In `ngOnInit()`, call `this.shellUi.setActiveGame('mahjong')` so `document.body.dataset['theme']` becomes `'mahjong'` and the header badge displays Mahjong when navigating directly to `/mahjong/lobby` or `/lobby`.
   - Synchronize nickname: ensure `LobbyComponent` nickname persistence updates `ShellUiService.setPlayerNickname()` and keeps `party_pavilion_nickname` and `hkmj_nickname` in sync.
4. Fix `src/app/pages/table/table.component.ts`:
   - In session-less redirect from table to lobby, preserve query parameters (`{ queryParamsHandling: 'preserve' }`).
5. Ensure all test suites pass, including `src/app/core/e2e-specs/milestone1-challenge.spec.ts` and `src/app/core/services/p2p-room.challenge.spec.ts`.

Verification Required:
`npm.cmd run qa:agent-docs`
`npx.cmd tsc --noEmit`
`npm.cmd run lint`
`npm.cmd run test:ci`
`npm.cmd run build`

Deliver report to `c:\Users\chine\OneDrive\Desktop\Github\mahjong\.agents\teamwork\teamwork_worker_m1_2\handoff.md` and send message to orchestrator.
