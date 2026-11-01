<div align="center">
  <img src="public/favicon.svg" alt="Tabletop Royale Sovereign Crest" width="84" height="84" />
  <h1>星冕桌游荟 · Tabletop Royale</h1>
  <p>
    <strong>Zero-Backend WebRTC P2P &amp; Offline AI Tabletop Pavilion — HK 4P &amp; MY 3P Fly Mahjong · Monopoly · The Resistance: Avalon · Pandemic: Global Defenses</strong><br />
    <em>Host-Authoritative Anti-Cheat Sync · Tactical AI Bots · Cross-Game Save/Resume · Bilingual (<code>简中</code> / <code>EN</code>)</em>
  </p>
  <p>
    <a href="https://planta94.github.io/mahjong/">
      <img src="https://img.shields.io/badge/Play_Now-GitHub_Pages-eab308?style=for-the-badge&logo=github" alt="Play on GitHub Pages" />
    </a>
    <img src="https://img.shields.io/badge/Angular-22-dd0031?style=for-the-badge&logo=angular" alt="Angular 22" />
    <img src="https://img.shields.io/badge/Backend-Zero_(WebRTC_P2P)-00d285?style=for-the-badge" alt="Zero Backend" />
    <img src="https://img.shields.io/badge/Coverage-95.6%25_Lines-2563eb?style=for-the-badge" alt="95.6% Line Coverage" />
  </p>
</div>

---

## Highlights

- **Four Complete Party & Tabletop Games in One Pavilion**:
  - **HK 4P & Authentic Malaysian 3P Fly Mahjong (`港马麻将馆`)**:
    - **3P · MY (84-Tile)**: Authentic 3 seats (`東/南/西`), `1–9` Dots (`筒`), Winds, Dragons, **16 Bonus Tiles** (Flowers, Seasons, Animals `貓/鼠/雞/蜈`, Faces `男女頭`), and **4 Flying Jokers (`飛`)** with joker substitution, `打飛`, and `換飛`.
    - **4P · HK (144-Tile)**: 4 seats (`東/南/西/北`), Characters (`萬`), Dots (`筒`), Bamboo (`索`), Winds, Dragons, and 8 Botanical SVG Flowers/Seasons with **5-Fan Minimum (`五番起糊`)**, **10-Fan Cap (`十番封頂`)**, **Discarder-Pays-All (`全銃制・半辣上`)**, and live Tenpai Hints (`聽牌提示`).
  - **Malaysia Landmarks Monopoly (`大马地标大富翁`)**: 40-space `11×11` perimeter board + mobile asset cards, auctions, houses/hotels, mortgages, player & tactical AI cash/deed trading (mutual-monopoly swaps, high-premium buyouts, and localized Trade Outcome feedback), Free Parking jackpot vault, `Nasib` / `Dana` event decks, and round/net-worth win modes.
  - **The Resistance: Avalon (`阿瓦隆：圣杯传奇`)**: 5–10 player Arthurian social deduction with secret Night Vision privacy shield, configurable special roles (`Merlin`, `Percival`, `Morgana`, `Assassin`, `Mordred`, `Oberon`), Quest & Hammer Vote tracks, Lady of the Lake, and end-game Merlin Assassination.
  - **Pandemic: Global Defenses (`瘟疫危机：全球防线`)**: 2–4 player cooperative bio-defense across **48 authentic world cities** and 4 regional disease networks, featuring all **7 Specialist roles** (`Medic`, `Scientist`, `Researcher`, `Dispatcher`, `Operations Expert`, `Quarantine Specialist`, `Contingency Planner`), all **5 Special Event cards**, `4 / 5 / 6` Epidemic difficulties, interactive CDC Bio-Command SVG world map with region filters + mobile cards, **Solo w/ Tactical BFS AI Bots**, **Solo Commander** mode (1 player commands 2–4 seats), and P2P online co-op.
- **Zero-Backend P2P Multiplayer + Offline Solo AI + Save/Resume**:
  - **Universal Room Codes**: Join any table from the Hub or direct URL (`?game=pandemic&room=D12345`) using game-prefixed codes (`M*` Mahjong, `P*` Monopoly, `A*` Avalon, `D*` Pandemic) over WebRTC (`PeerJS`) or same-browser `BroadcastChannel`.
  - **Anti-Cheat Per-Seat Sanitization**: Only the Host holds hidden state (Mahjong walls/hands, Monopoly decks, Avalon roles/night vision, Pandemic unrevealed player & infection draw decks); guests receive strictly sanitized per-seat views with authentication tokens stripped.
  - **Contextual Game Shell & Local Save/Resume**: Top navigation dynamically adopts each active game's lobby emblem, title, theme, `"All Games"` hub launcher, and context-aware `"Leave Room"` / `"Exit Match"` controls with single-slot local save & resume from the Hub banner.
- **Mobile-Friendly & Battery-Conscious UX**:
  - Zoneless Angular Signals + inline SVG tiles (`mj-tile`), world map, and dice (`app-real-dice`) with zero 60 FPS canvas loops, `#0d1117` OLED dark theme, bounded CSS turn pulses + `prefers-reduced-motion` support, and auto-suspending Web Audio / `visibilitychange` BGM pause on backgrounded tabs.
  - Instant switching between **Simplified Chinese (`简中`)** and **English (`EN`)** with enforced dictionary key parity.

---

## Quick Start

### Prerequisites

- **Node.js** `>= 20` (Node `22` LTS recommended)
- **npm** `>= 10`

### Local Development

```bash
npm install
npm start
```

Open `http://localhost:4200/` in your browser. Open a second browser tab with an invite link (`?game=...&room=CODE`) to test P2P multiplayer locally.

### Quality Gates & Verification (`VeriScribe` + `Vitest V8`)

```bash
npm run qa:agent-docs   # Verify AGENTS.md, reference links & spec hygiene
npx tsc --noEmit        # Strict TypeScript 6 type check
npm run lint            # ESLint 10 + eslint-plugin-security (0 warnings, 0 eslint-disable)
npm run test:ci         # Vitest unit/DOM suites + V8 coverage + JSON report (593 tests)
npm run qa:scan         # VeriScribe AST manifest & meaningful-assertion audit
npm run qa:gate         # VeriScribe CI gate (16/16 components & 16/16 services TRIAGED)
npm run build           # Production Angular bundle check
```

*(Or run `npm run qa:verify` to chain `test:ci` + `qa:scan` + `qa:gate` in one step.)*

---

## Publishing to GitHub Pages

Automated deployment is configured in [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) alongside continuous QA verification in [`.github/workflows/veriscribe-qa.yml`](.github/workflows/veriscribe-qa.yml). Pushing to `main` builds the production SPA with `--base-href /mahjong/`, generates `404.html` + `.nojekyll` for deep-link routing, and publishes to GitHub Pages.

To build the GitHub Pages production bundle locally:

```bash
npm run build:gh-pages
```

---

## Project Structure

```text
mahjong/
├── .github/workflows/
│   ├── deploy-pages.yml          # Automated GitHub Pages CI/CD pipeline
│   └── veriscribe-qa.yml         # VeriScribe AST + Vitest V8 coverage CI gate
├── docs/reference/               # Canonical architecture, P2P security, UI & QA specs
├── public/
│   ├── favicon.svg               # Tabletop Royale sovereign crown, tile & dice crest
│   └── assets/
│       ├── audio/                # Per-game looping BGM tracks (muted by default)
│       └── i18n/{en,zh}.json     # Bilingual English & Simplified Chinese dictionaries
├── qa-system/                    # VeriScribe QA manifest, JSON schema & audit reports
├── veriscribe.config.ts          # VeriScribe gate & coverage configuration
└── src/
    ├── styles/                   # Design tokens, breakpoints & mixins
    └── app/
        ├── core/                 # Mahjong engine/scorer/AI, universal P2P transport, shell & save manager
        ├── games/
        │   ├── avalon/           # Avalon engine, deduction AI bot, P2P session, lobby & table
        │   ├── monopoly/         # Monopoly engine, trade AI bot, P2P session, lobby & 11x11 board
        │   └── pandemic/         # Pandemic 48-city co-op engine, BFS AI bot, Solo Commander, lobby & SVG map
        ├── layout/header/        # Contextual game emblem header, All Games nav, invite copy & audio toggles
        ├── pages/
        │   ├── hub/              # Tabletop Royale Hub, 4 game launchers, room join & saved-game banner
        │   ├── lobby/            # Mahjong 3P/4P lobby & P2P waiting room
        │   └── table/            # Mahjong 3P/4P tabletop, Tenpai helper & settlement modal
        └── shared/               # SVG Mahjong tiles, SVG dice, 4-game rulebook, exit modal & i18n pipe
```
