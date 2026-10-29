<div align="center">
  <img src="public/favicon.svg" alt="HK &amp; MY Mahjong Pavilion Crest" width="84" height="84" />
  <h1>港馬麻雀館 · HK &amp; MY Mahjong Pavilion</h1>
  <p>
    <strong>Zero-Backend Hong Kong 4-Player (144-Tile) &amp; Authentic Malaysian 3-Player Fly Mahjong (84-Tile)</strong><br />
    <em>5-Fan Minimum (<code>5番起糊</code>) · WebRTC P2P Multiplayer · Heuristic 5-Fan AI Bots · Trilingual (<code>繁中</code> / <code>EN</code> / <code>BM</code>)</em>
  </p>
  <p>
    <a href="https://planta94.github.io/mahjong/">
      <img src="https://img.shields.io/badge/Play_Now-GitHub_Pages-eab308?style=for-the-badge&logo=github" alt="Play on GitHub Pages" />
    </a>
    <img src="https://img.shields.io/badge/Angular-21-dd0031?style=for-the-badge&logo=angular" alt="Angular 21" />
    <img src="https://img.shields.io/badge/Backend-Zero_(WebRTC_P2P)-00d285?style=for-the-badge" alt="Zero Backend" />
  </p>
</div>

---

## Highlights

- **Two Authentic Regional Rulesets**:
  - **3P · MY — Authentic Malaysian 84-Tile Fly Mahjong (`大馬三人飛麻`)**: Exact 3 seats (East, South, West · `東南西`), `1–9` Dots (`筒子`), Winds, Dragons, **16 Bonus Tiles** (8 Botanical SVG Flowers/Seasons + 4 Animals `貓鼠雞蜈` + 4 Faces `小丑/女小丑`), and **4 Flying Jokers (`飛`)** that substitute any tile in melds/hands or can be discarded (`打飛`) for `+1 Fan`. Chow (`上`) enabled.
  - **4P · HK — Standard Hong Kong 144-Tile Mahjong (`香港四人麻雀`)**: 4 seats (East, South, West, North · `東南西北`), Characters (`萬`), Dots (`筒`), Bamboo (`索`), Winds, Dragons, and 8 Botanical SVG Flowers/Seasons with **Discarder-Pays-All (`出銃包自摸制`)** settlement.
- **5-Fan Minimum Engine & Optional Tenpai Helper**:
  - Full backtracking + Seven Pairs (`七對子`) + Thirteen Orphans (`十三幺`) evaluator with joker substitution.
  - Configurable Minimum Fan (`3 / 5 / 7 / 8`) and Cap (`8 / 10 / 13`), plus an optional **Tenpai Hints (`聽牌提示`)** toggle when creating or joining a room.
- **Zero-Backend P2P Multiplayer + Instant Solo Mode**:
  - **Solo vs AI**: Play offline immediately against heuristic 5-Fan AI bots that pursue Half/Full Flush, All Pongs, Honors, and Bonus Fan targets.
  - **Online Room Codes**: Host a table and share a 1-click invite link (`?room=CODE`) over WebRTC (`PeerJS`) or across local browser tabs (`BroadcastChannel`). Host-authoritative state sanitizes every broadcast so opponents' concealed hands are never sent over the network.
- **Immersive Audio & Trilingual Responsive UI**:
  - Instant switching between **Traditional Chinese (`繁中`)**, **English (`EN`)**, and **Bahasa Melayu (`BM`)**.
  - Looping Cantonese Mahjong BGM (`打雀英雄传`) during matches, synthesized tile clacks, and Cantonese voice callouts (`碰`, `上`, `槓`, `食糊`, `自摸`, `打飛`) with independent header mute toggles.
  - Wide `1680px` desktop arena + compact single-screen (`100dvh`) mobile tabletop with a unified central discard pool.

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

Open `http://localhost:4200/` in your browser. Open a second browser tab with the room invite link (`?room=CODE`) to test P2P multiplayer locally.

### Quality Gates & Tests

```bash
npm run qa:agent-docs   # Verify architecture/context docs & clean specs
npm run lint            # ESLint + eslint-plugin-security
npm run test:ci         # Vitest unit tests + V8 coverage (>=80% lines, >=70% branches)
npm run build           # Production bundle check
```

---

## Publishing to GitHub Pages

This repository includes an automated GitHub Actions workflow at [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) configured for `https://planta94.github.io/mahjong/`.

1. In your GitHub repository (**`planta94/mahjong`**), go to **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Commit and push to `main`:
   ```bash
   git add .
   git commit -m "feat: polish mobile UI, brand favicon, and GitHub Pages deployment"
   git push origin main
   ```
4. Once the **Deploy to GitHub Pages** action finishes (~1 minute), your game will be live at:
   **https://planta94.github.io/mahjong/**

To test the exact GitHub Pages production bundle locally:

```bash
npm run build:gh-pages
```

---

## Project Structure

```text
mahjong/
├── .github/workflows/
│   └── deploy-pages.yml          # Automated GitHub Pages CI/CD pipeline
├── public/
│   ├── favicon.svg               # Royal Jade & Gold Red Dragon (紅中) brand crest
│   ├── favicon.ico               # Multi-browser ICO fallback
│   └── assets/
│       ├── audio/bgm.mp3         # Match background music
│       └── i18n/{zh,en,ms}.json  # Trilingual translation dictionaries
└── src/
    ├── styles/                   # Design tokens, breakpoints & mixins
    └── app/
        ├── core/                 # Mahjong engine, 5-Fan scorer, AI bot, P2P session & i18n
        ├── layout/header/        # Responsive single-bar header with brand crest & audio toggles
        ├── pages/lobby/          # Mode selection, rules configurator & P2P waiting room
        ├── pages/table/          # 3P/4P responsive tabletop & settlement modal
        └── shared/               # Custom SVG Mahjong tiles, rulebook modal & translate pipe
```
