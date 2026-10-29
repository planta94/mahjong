# Testing & Quality Gate Reference

## 1. Vitest + V8 Coverage Configuration

- Configured in `angular.json` under `@angular/build:unit-test` with `"coverage": true`, `"coverageReporters": ["text", "lcov", "json"]`, and `"coverageThresholds": { "branches": 70, "lines": 80 }` powered by `@vitest/coverage-v8` (Vitest 4 runs isolated per spec file by default).
- Target coverage: **>= 70% Branches** and **>= 80% Lines** across core services, utilities, and components.

## 2. Strict Spec Authoring Rules

- **Banned DI Anti-Pattern**: Never call `TestBed.overrideComponent(...)`; configure providers via `TestBed.configureTestingModule({ providers: [...] })` or `TestBed.overrideProvider(...)`.
- **Banned Trivial Assertions**: Never write `.toBeTruthy()`, `.toBeDefined()`, or `.not.toBeNull()`. Assert concrete values, lengths, text, or state transitions (`.toBe(...)`, `.toEqual(...)`, `.toContain(...)`, `.toBeGreaterThan(...)`).
- **No 3rd Timeout Arg**: Never pass a numeric timeout as the 3rd argument to `it(name, fn)`.
