# Security & Serverless P2P Reference

## 1. Host-Authoritative Per-Seat State Sanitization

- Only the Host (`HostSession` in Mahjong or `GenericHostSession` in `p2p-room.transport.ts` for Monopoly/Avalon) holds full authoritative state in memory.
- Every guest receives a seat-specific snapshot where seat authentication tokens (`token: null`) and hidden game secrets are stripped prior to serialization:
  - **Mahjong (`getPlayerView`)**: Strips `wall` (`wallCount` integer only), masks opponents' `hand` arrays as `null` + `handCount` until `phase === 'handOver'`, and masks concealed Kongs (`m.concealed`) as `['back', 'back', 'back', 'back']` until `handOver`.
  - **Monopoly (`buildPlayerView`)**: Strips shuffled `nasibDeck` and `danaDeck` arrays so guests cannot predict upcoming event cards.
  - **Avalon (`buildAvalonPlayerView`)**: Strips other players' true `role`/`loyalty` until `game_over` (exposing only legal role-specific Night Vision perceptions and private Lady of the Lake results to the entitled seat) and shuffles submitted quest cards before reveal so individual vote authorship cannot be Fingerprinted.

## 2. Universal Prefixed Transport, Handshake Hygiene & ESLint Security

- **Universal Room Codes**: `parseUniversalRoomCode()` and `generatePrefixedRoomCode()` route prefixed codes (`M*` → Mahjong, `P*` → Monopoly, `A*` → Avalon, legacy unprefixed → Mahjong) while isolating Host (`host_*`) and room-scoped Guest (`hkmj_guest_token_*` / `party_guest_token_*`) tokens in `sessionStorage` to prevent duplicated-tab collisions.
- **WebRTC & Timer Lifecycle**: Connects over HTTPS `0.peerjs.com:443` + STUN/TURN (`openrelay.metered.ca` 80/443 TCP/TLS) with JSON DataChannel serialization, optional `peerLoader` constructor injection for deterministic unit testing, and automatic `clearHandshakeTimers()` teardown on first `sync`, `error`, or connection timeout so guest retry intervals never leak on mobile devices.
- **URL Hygiene & ESLint Hardening**: Clear query strings via `window.history.replaceState()` and dispatch `p2p:leave` + `mahjong:leave` on room exit. Maintain **zero warnings** and **zero `eslint-disable` comments** under `eslint-plugin-security` (`security/detect-object-injection`) by using `Map<K, V>` and `Array.prototype.at()` instead of dynamic `obj[key]` / `arr[idx]` indexing.
