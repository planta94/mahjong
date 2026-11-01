# UI, SCSS & i18n Conventions Reference

## 1. Global SCSS & `.portal-input`

- `src/styles.scss` imports `src/styles/_variables.scss`, `_breakpoints.scss`, and `_mixins.scss`.
- `.portal-input` (`height: 38px`, background `var(--bg-base)` `#0d1117`, focus border `#00d285`) **must remain top-level** in `src/styles.scss` and never be nested inside wrapper classes.
- Keep component `.scss` files shallow (`1–2` selector levels max, grouped `@media` blocks at the bottom of the file, `< 32 kB`).

## 2. Bounded Modals & Bottom-Only Close Actions

- Modals (`RulebookDialogComponent`, `ExitConfirmDialogComponent`, Mahjong Settlement, Monopoly Deed/Trade/Trade-Outcome/Auction dialogs, and Pandemic Forecast/Discard/Infection/Airlift/Defeat dialogs) enforce `max-width: min(720px, 95vw); max-height: 90vh;` with fixed `.modal-header` / `.modal-footer` (`flex-shrink: 0`) and a middle `.modal-body` (`max-height: 55vh; overflow-y: auto;`).
- **Never** place a top-right `X` close button inside modal headers; all dismiss/action buttons belong exclusively in `.modal-footer`.
- Keep active-game header emblems (`AppHeaderComponent` `.brand-emblem`) visually and structurally identical (`viewBox="0 0 64 64"` SVG + radial-gradient `.emblem-*` badges) to the game launcher emblems in `HubComponent` (`.tile-emblem`).

## 3. Desktop Table vs. Mobile Modern App Cards

- Scoreboards, payout schedules, Avalon quest matrices, and Pandemic specialist roles/difficulty tables render `<table class="desktop-table">` above `768px` and `<div class="mobile-cards">` (`mobile-app-card`) at `<= 768px`.

## 4. Bilingual i18n Parity (`en`, `zh` Simplified Chinese)

- All user-facing copy lives in `public/assets/i18n/{en,zh}.json` and renders via `TranslatePipe` (`| translate`).
- `src/app/core/services/i18n-parity.spec.ts` enforces identical flattened key sets and non-empty string values across both dictionaries.

## 5. Mobile Battery & Reduced-Motion Hygiene

- Bound decorative CSS attention animations (such as Monopoly `tokenPulse`, Avalon `hammerPulsate`, and Pandemic `bioPulse`) to finite iteration counts (`4` cycles) rather than `infinite` so `1Hz–120Hz` LTPO phone displays can drop to idle refresh rates between turns.
- Always honor `@media (prefers-reduced-motion: reduce)` in `src/styles.scss` and animated component stylesheets for OS Low Power / Battery Saver modes.
