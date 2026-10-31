# Testing & Quality Gate Reference

## 1. Vitest + V8 Coverage + VeriScribe Gate Configuration

- Configured in `angular.json` under `@angular/build:unit-test` with `"coverage": true`, `"coverageReporters": ["text", "lcov", "json"]`, `"reporters": ["default", ["json", { "outputFile": "test-results/vitest-results.json" }]]`, and `"coverageThresholds": { "branches": 70, "lines": 80 }` powered by `@vitest/coverage-v8` (current baseline: **`98.68%` lines / `89.18%` branches**, with every file `>= 92%` lines and `>= 80%` branches).
- **VeriScribe (`veriscribe.config.ts`)**: Enforces co-located `<name>.component.spec.ts` (`14/14` `TRIAGED`) and `<name>.service.spec.ts` (`13/13` `TRIAGED`) AST spec quality, Vitest JSON unit execution (`test-results/vitest-results.json`), and per-file `>= 70%` Branches / `>= 80%` Lines in `coverage/hk-mahjong/lcov.info` via `npm run qa:scan` and `npm run qa:gate` (`npm run qa:verify`).
- **Intentional Route-Slice Waivers (`7 waived`)**: `veriscribe.config.ts` `gate.allowList` waives the 7 route feature slices (`slice:home`, `slice:mahjong-lobby`, `slice:mahjong-table`, `slice:monopoly-lobby`, `slice:monopoly-board`, `slice:avalon-lobby`, `slice:avalon-table`) solely because Playwright living user manual screenshot generation (`manual-steps.json`) was intentionally skipped; zero component or service specs are waived.

## 2. Strict Spec Authoring & P2P Mocking Rules

- **Banned DI Anti-Pattern**: Never call `TestBed.overrideComponent(...)`; configure providers via `TestBed.configureTestingModule({ providers: [...] })`, `TestBed.overrideProvider(...)`, or constructor options such as `peerLoader` on `HostSession` / `GuestSession` / `GenericHostSession` / `GenericGuestSession` for deterministic WebRTC PeerJS simulation.
- **Banned Trivial Assertions**: Never write `.toBeTruthy()`, `.toBeDefined()`, `.not.toBeNull()`, self-comparisons (`expect(x).toBe(x)`), or empty `it(...)` blocks. Assert concrete values, lengths, text, or state transitions (`.toBe(...)`, `.toEqual(...)`, `.toContain(...)`, `.toBeGreaterThan(...)`).
- **No 3rd Timeout Arg & Clean Teardown**: Never pass a numeric timeout as the 3rd argument to `it(name, fn)`, and always clean up manual service instances (`ngOnDestroy()` / `destroy()`) and mocked globals (`AudioContext`, `RTCPeerConnection`, `Math.random`) in `afterEach` or `try/finally`.
