# E2E Test Infra: Party Game Pavilion (`桌遊館`)

## Test Philosophy
- Opaque-box, requirement-driven testing. Derived from user requirements in `ORIGINAL_REQUEST.md` and repository invariants in `AGENTS.md`.
- No dependency on private internal implementation details; exercises public interfaces, routes, engines, state sanitization, and P2P protocols.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial + Real-World Workload Testing.

## Feature Inventory
| # | Feature | Source | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|--------|:------:|:------:|:------:|:------:|
| 1 | Universal Game Hub & Routes | ORIGINAL_REQUEST §Route Map | 5 | 5 | ✓ | ✓ |
| 2 | Room-Code Parser & Deep-Link Invites | ORIGINAL_REQUEST §Route Map | 5 | 5 | ✓ | ✓ |
| 3 | Shell UI & Multi-Game Context | ORIGINAL_REQUEST §Shared Core | 5 | 5 | ✓ | ✓ |
| 4 | Reusable P2P Transport & Sanitization | ORIGINAL_REQUEST §Shared Core | 5 | 5 | ✓ | ✓ |
| 5 | Mahjong HK 4P & MY 3P Fly Zero-Regression | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ | ✓ |
| 6 | Malaysia Monopoly 40-Space Board & Data | ORIGINAL_REQUEST §Game 2 | 5 | 5 | ✓ | ✓ |
| 7 | Saidina House Rules (Free Parking & Jail) | ORIGINAL_REQUEST §Game 2 | 5 | 5 | ✓ | ✓ |
| 8 | Monopoly Trading, Auctions & Win Modes | ORIGINAL_REQUEST §Game 2 | 5 | 5 | ✓ | ✓ |
| 9 | Monopoly Tactical AI Bot | ORIGINAL_REQUEST §Game 2 | 5 | 5 | ✓ | ✓ |
| 10 | Avalon 5–10 Player Ratios & Quests | ORIGINAL_REQUEST §Game 3 | 5 | 5 | ✓ | ✓ |
| 11 | Avalon Roles & Night-Vision Sanitization | ORIGINAL_REQUEST §Game 3 | 5 | 5 | ✓ | ✓ |
| 12 | Lady of the Lake & Shuffled Quest Reveal | ORIGINAL_REQUEST §Game 3 | 5 | 5 | ✓ | ✓ |
| 13 | Avalon Deduction AI Bot | ORIGINAL_REQUEST §Game 3 | 5 | 5 | ✓ | ✓ |
| 14 | Trilingual i18n Dictionary Parity | AGENTS.md §5 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Runner: Vitest via `@angular/build:unit-test` (`npm run test:ci`).
- Coverage Requirements: `>= 80%` Lines, `>= 70%` Branches (V8 coverage).
- Zero-Trivial-Assertion Invariant: Zero `.toBeTruthy()`, `.toBeDefined()`, `.not.toBeNull()`. Exact value, equality, or state assertions only.
- Strict Security & Architecture Compliance: Zero `any`, zero `eslint-disable`, Map / `.at()` object-injection protection.

## Coverage Thresholds
- Tier 1: Feature Coverage (>= 5 test cases per feature = 70+ cases)
- Tier 2: Boundary & Corner Cases (>= 5 test cases per feature = 70+ cases)
- Tier 3: Cross-Feature Combinations (Pairwise matrix of state interactions)
- Tier 4: Real-World Application Scenarios (End-to-end full game match simulations)
- Tier 5: Adversarial Coverage Hardening (Coverage gap audits, stress tests, fuzzing)
