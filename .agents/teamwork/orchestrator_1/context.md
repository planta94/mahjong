# Context Index

## Repository & Stack
- Repository: `hk-mahjong` (Tabletop Royale / Party Game Pavilion)
- Framework: Angular 22 (Zoneless signals, standalone components)
- Language: TypeScript 6.0+
- Styling: SCSS Design System (`src/styles.scss`, `src/styles/`), CSS variables, scoped component styles
- Routing: `@angular/router`
- i18n: Signal-backed `TranslateService` / `TranslatePipe` with `public/assets/i18n/{en,zh}.json`
- Tests: Vitest 5.0+ with `@angular/build:unit-test` (`@vitest/coverage-v8`), VeriScribe 1.5+ (`qa:scan`, `qa:gate`)
- Linter: ESLint 10+ (`0` errors, `0` warnings, `0` `eslint-disable`)

## Key Constraints
- Mahjong Tabletop: DO NOT touch Mahjong scoring logic or `src/app/pages/table/` tabletop action buttons.
- No `*.sh` scripts: Never read, execute, edit, or create any `*.sh` script.
- No direct coding by orchestrator: DISPATCH-ONLY. Delegate all exploration, coding, testing, review, auditing to subagents.
- Hard audit veto: Forensic auditor must pass with CLEAN verdict.
- Zero trivial test assertions (`.toBeTruthy()`, `.toBeDefined()`, `.not.toBeNull()`).
- Zero `TestBed.overrideComponent(...)`.
- Zero `any` types.
- Strict `< 20,000` byte limit on `AGENTS.md`.

## Reference Documents
- `docs/reference/architecture.md`
- `docs/reference/security-and-p2p.md`
- `docs/reference/ui-conventions.md`
- `docs/reference/testing-and-quality.md`
- `C:\Users\chine\.gemini\antigravity\brain\effe94dd-f539-4d36-8797-edcb695c4bde\implementation_plan.md`
- `.agents/teamwork/ORIGINAL_REQUEST.md`
