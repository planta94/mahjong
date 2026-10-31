<div align="center">
  <img src="public/favicon.svg" alt="HK &amp; MY Mahjong &amp; Party Pavilion Crest" width="84" height="84" />
  <h1>港馬麻雀館 &amp; 派對遊藝廳 · Party Game Pavilion</h1>
  <p>
    <strong>Zero-Backend WebRTC P2P &amp; Offline AI Tabletop Pavilion — HK 4P &amp; MY 3P Fly Mahjong · Monopoly · The Resistance: Avalon</strong><br />
    <em>Host-Authoritative Anti-Cheat Sync · Tactical AI Bots · Cross-Game Save/Resume · Bilingual (<code>简中</code> / <code>EN</code>)</em>
  </p>
  <p>
    <a href="https://planta94.github.io/mahjong/">
      <img src="https://img.shields.io/badge/Play_Now-GitHub_Pages-eab308?style=for-the-badge&logo=github" alt="Play on GitHub Pages" />
    </a>
    <img src="https://img.shields.io/badge/Angular-22-dd0031?style=for-the-badge&logo=angular" alt="Angular 22" />
    <img src="https://img.shields.io/badge/Backend-Zero_(WebRTC_P2P)-00d285?style=for-the-badge" alt="Zero Backend" />
    <img src="https://img.shields.io/badge/Coverage-98.6%25_Lines-2563eb?style=for-the-badge" alt="98.6% Line Coverage" />
  </p>
</div>

---

## Highlights

- **Three Complete Party & Tabletop Games in One Pavilion**:
  - **HK 4P & Authentic Malaysian 3P Fly Mahjong (`香港四人麻雀` / `大馬飛牌三人麻將`)**:
    - **3P · MY (84-Tile)**: Authentic 3 seats (`東/南/西`), `1–9` Dots (`筒`), Winds, Dragons, **16 Bonus Tiles** (Flowers, Seasons, Animals `貓/鼠/雞/蜈`, Faces `男女頭`), and **4 Flying Jokers (`飛`)** with joker substitution, `打飛`, and `換飛`.
    - **4P · HK (144-Tile)**: 4 seats (`東/南/西/北`), Characters (`萬`), Dots (`筒`), Bamboo (`索`), Winds, Dragons, and 8 Botanical SVG Flowers/Seasons with **5-Fan Minimum (`五番起糊`)**, **10-Fan Cap (`十番封頂`)**, **Discarder-Pays-All (`全銃制・半辣上`)**, and live Tenpai Hints (`聽牌提示`).
  - **Monopoly (`大富翁`)**: 40-space `11×11` perimeter board + mobile asset cards, auctions, houses/hotels, mortgages, player-to-player cash & deed trading, Free Parking jackpot vault, `Nasib` / `Dana` event decks, and round/net-worth win modes.
  - **The Resistance: Avalon (`阿瓦隆`)**: 5–10 player Arthurian social deduction with secret Night Vision privacy shield, configurable special roles (`Merlin`, `Percival`, `Morgana`, `Assassin`, `Mordred`, `Oberon`), Quest & Hammer Vote tracks, Lady of the Lake, and end-game Merlin Assassination.
- **Zero-Backend P2P Multiplayer + Offline Solo AI + Save/Resume**:
  - **Universal Room Codes**: Join any table from the Hub or direct URL (`?game=monopoly&room=P12345`) using game-prefixed codes (`M*` Mahjong, `P*` Monopoly, `A*` Avalon) over WebRTC (`PeerJS`) or same-browser `BroadcastChannel`.
  - **Anti-Cheat Per-Seat Sanitization**: Only the Host holds hidden state (Mahjong walls/hands, Monopoly decks, Avalon roles/night vision); guests receive strictly sanitized per-seat views with authentication tokens stripped.
  - **Cross-Game Local Save & Resume**: Pause any solo match via the Exit Confirmation dialog and resume right from the Hub banner.
- **Mobile-Friendly & Battery-Conscious UX**:
  - Zoneless Angular Signals + inline SVG tiles (`mj-tile`) and dice (`app-real-dice`) with zero 60 FPS canvas loops, `#0d1117` OLED dark theme, bounded CSS turn pulses + `prefers-reduced-motion` support, and auto-suspending Web Audio / `visibilitychange` BGM pause on backgrounded tabs.
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
npm run test:ci         # Vitest unit/DOM suites + V8 coverage + JSON report
npm run qa:scan         # VeriScribe AST manifest & meaningful-assertion audit
npm run qa:gate         # VeriScribe CI gate (TRIAGED specs + >=80% lines / >=70% branches)
npm run build           # Production Angular bundle check
```

*(Or run `npm run qa:verify` to chain `test:ci` + `qa:scan` + `qa:gate` in one step.)*

---

## Publishing to GitHub Pages

Automated deployment is configured in [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) alongside continuous QA verification in [`.github/workflows/veriscribe-qa.yml`](.github/workflows/veriscribe-qa.yml).

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
│   ├── favicon.svg               # Royal Jade & Gold Red Dragon (紅中) brand crest
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
        │   └── monopoly/         # Monopoly engine, tycoon AI bot, P2P session, lobby & 11x11 board
        ├── layout/header/        # Contextual header with language switcher, invite copy & audio toggles
        ├── pages/
        │   ├── hub/              # Party Pavilion Hub, universal room join & saved-game resume banner
        │   ├── lobby/            # Mahjong 3P/4P lobby & P2P waiting room
        │   └── table/            # Mahjong 3P/4P tabletop, Tenpai helper & settlement modal
        └── shared/               # SVG Mahjong tiles, SVG dice, contextual rulebook, exit modal & i18n pipe
```
