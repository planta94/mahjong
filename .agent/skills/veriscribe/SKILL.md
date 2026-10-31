---
name: veriscribe
description: Orchestrates the VeriScribe Multi-Dimension AI QA & Living User Manual pipeline, including Phase 0 AST Ledger Scanning, Phase 1 Intent & Bug Triage, Phase 2 DOM/Behavior .spec.ts Upgrading, Phase 3 Playwright E2E + Annotated User Manual Generation, and Phase 4 Git-Diff Incremental Maintenance.
---

# VeriScribe — Multi-Dimension AI QA & Living User Manual Pipeline (v1.5.1)

Use this skill to bootstrap or incrementally maintain 100% functional and non-functional quality verification across an Angular frontend while automatically generating role- and locale-specific User Manuals as a by-product.

## Core Architecture Rules

1. **Never Cement Existing Bugs into Tests**: Before writing tests for unverified components/services, inspect the Angular template, TypeScript logic, and OpenAPI schema. If a branch, validator, or API call looks broken or ambiguous, record it in `qa-system/qa-manifest.json` under `ambiguitiesOrSuspectedBugs` with `"resolution": "OPEN"` and ask the user to resolve it before locking behavior into specs.
2. **Ban Shallow `toBeTruthy()` Stubs**: Every `.spec.ts` file MUST test real behavior:
   - For **Services**: Use `HttpTestingController` to verify HTTP methods, URLs, headers, request payloads, OpenAPI response shapes, and `4xx`/`5xx` error handling.
   - For **Components**: Render the real template, assert every `@if`/`*ngIf`/`@for`/`*ngFor` branch, `@Input()`/`@Output()` and modern signal (`input()`, `output()`, `model()`) emission, Reactive Form validation state, role directive, and subscription cleanup (`takeUntilDestroyed` / `ngOnDestroy`).
3. **Every E2E Journey Produces a User Manual Chapter**: Every route slice in `featureSlices` must have a Playwright E2E spec at its `e2eSpecPath` using `ManualJourneyRecorder` (`import { ManualJourneyRecorder } from 'veriscribe'`; golden reference: `node_modules/veriscribe/qa-system/examples/order-checkout.e2e.spec.ts`) that verifies all quality dimensions and emits `manual-steps.json` + annotated screenshots. The recorder's `chapterId` MUST equal the slice's `manualChapterId` (default `manual-<slice>`) so `finalize()` binds the chapter to the slice's source fingerprint.
4. **Router Mode Awareness**: For applications using SPA hash routing (`withHashLocation()` or `HashRouter`), set `router: { mode: 'hash' }` in `veriscribe.config.ts`. Always use `await manual.goto('/route')` and `await manual.assertCurrentRoute('/route')` to prevent static server fallback failures.
5. **Contextual Accessibility & Print Budgets**:
   - Use `await manual.verifyAccessibility({ preset: 'document-preview' })` for documents, resumes, and print previews to avoid false-positive landmark warnings.
   - Use `await manual.verifyVisualLayout({ media: 'print', pageBudget: { pageSize: 'A4', maxPages: 2 } })` to assert physical print page budgets.
6. **Evidence, Not Status Flags**: `npx veriscribe gate` ignores hand-set `status` values. It re-analyzes specs with the TypeScript AST, checks that each in-scope slice's manuals match the current source fingerprint, and (with `--playwright-report=<json>`) that the slice's E2E spec passed. Never edit statuses or fingerprints to make the gate pass. Produce the evidence instead.
7. **Scaffolds Are Not Tests**: `npx veriscribe scaffold ...` output starts with `// @veriscribe-scaffold`. The gate treats such specs as unfinished. Replace every TODO with real assertions, then delete the marker line.
8. **Tune Checks, Don't Delete Them**: Console-error, i18n-key and visual-layout checks run on every `recordStep`. Silence known noise narrowly with `checks` (config → recorder → step), e.g. `checks: { consoleErrors: { allow: [/ResizeObserver loop/] } }` or `checks: { visualLayout: false }` on a single animated step. Waive gate items only via `gate.allowList` with a written reason.

---

## Workflow 1: Initial Bootstrap (Feature-Slice Waves)

1. **Step 0 — Check the Environment**:
   ```bash
   npx veriscribe doctor        # add --fix to repair the angular.json build guard
   npx playwright install chromium   # only if doctor reports the browser is missing (--with-deps on Linux)
   ```
2. **Step 1 — Scan the Master Ledger**:
   ```bash
   npx veriscribe scan
   ```
   Review `qa-system/qa-manifest.json` and `qa-system/reports/coverage-audit.md`.
3. **Step 2 — Triage Ambiguities & OpenAPI Contracts**:
   - Compare `services[*].httpEndpoints` against `openapi.json`.
   - Inspect components for missing error states, unsubscribed `.subscribe()` calls, or dead template branches.
   - Present any `OPEN` ambiguities to the user for quick confirmation.
4. **Step 3 — Wave Execution via Parallel Subagents**:
   - **Wave A (Core Services)**: Upgrade all `MISSING` or `SHALLOW_STUB` `*.service.spec.ts` files first (`npx veriscribe scaffold service <file>` for boilerplate) until `npx veriscribe scan` reports them `TRIAGED`.
   - **Wave B (Vertical Feature Slices)**: For each route slice in `featureSlices`:
     1. Upgrade all child component `.spec.ts` files across all component dimensions (using `npx veriscribe scaffold component <file>` for boilerplate).
     2. Create/update deterministic mock fixtures validated against `openapi.json`.
     3. Create/update the Playwright E2E journey using `ManualJourneyRecorder` covering:
        - Hash-aware navigation (`await manual.goto(routePath)`)
        - Happy path steps with visual callout screenshots (`await manual.recordStep(...)`)
        - Degraded/error states (`4xx`/`5xx`, empty states -> `await manual.recordTroubleshootingScenario(...)`)
        - RBAC role access matrix (`admin`, `user`, `guest`)
        - Responsive viewports (`desktop`, `tablet`, `mobile` via `await manual.verifyResponsiveViewports()`)
        - Accessibility (`await manual.verifyAccessibility({ preset: 'full-page' })`)
        - Print media page budget (`await manual.verifyVisualLayout({ media: 'print', pageBudget: { pageSize: 'A4', maxPages: 2 } })` when applicable)
        - i18n untranslated key check (`await manual.assertNoUntranslatedI18nKeys()`)
     4. Run the journey (`npx playwright test <e2eSpecPath>`), then compile and live-preview living manuals:
        ```bash
        npx veriscribe manual --serve
        ```
     5. Confirm the slice passes `npx veriscribe gate` (the evidence table in `qa-system/reports/impact-plan.md` shows Manual Evidence **fresh**).

---

## Workflow 2: Continuous Incremental Maintenance (On Every Code Change / PR)

1. **Step 1 — Run Incremental Impact Analysis**:
   ```bash
   npx veriscribe scan
   npx veriscribe impact
   ```
2. **Step 2 — Inspect Delta**:
   Read `qa-system/reports/impact-plan.md` to see the exact list of impacted services, components, Playwright journeys, and User Manual chapters.
3. **Step 3 — Targeted AI Healing & Manual Refresh**:
   - Update only the impacted `.spec.ts` and Playwright `.e2e.spec.ts` files.
   - Re-run only the impacted unit and Playwright tests (which automatically re-captures fresh annotated screenshots for modified UI steps).
   - Run `npx veriscribe manual` to update localized Markdown and Interactive HTML manuals (`USER_MANUAL.<locale>.md`, `USER_MANUAL.html`).
   - Verify the gate exits with `0`:
     ```bash
     npx playwright test   # json reporter -> playwright-report/results.json
     npx veriscribe gate --changed-only --playwright-report=playwright-report/results.json
     ```
     Stale manuals list the exact `manual-steps.json` files to re-record. On the main branch, run `npx veriscribe gate --update-baseline` to record the verified commit (this replaces hand-editing `lastVerifiedCommit`).
