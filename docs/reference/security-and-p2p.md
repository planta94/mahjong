# Security & Serverless P2P Reference

## 1. Host-Authoritative Per-Seat State Sanitization

- Only the Host (`HostSession` in Mahjong or `GenericHostSession` in `p2p-room.transport.ts` for Monopoly, Avalon, Pandemic, and Balik Kampung) holds full authoritative state in memory.
- Every guest receives a seat-specific snapshot where seat authentication tokens (`token: null`) and hidden game secrets are stripped prior to serialization:
  - **Mahjong (`getPlayerView`)**: Strips `wall` (`wallCount` integer only), masks opponents' `hand` arrays as `null` + `handCount` until `phase === 'handOver'`, and masks concealed Kongs (`m.concealed`) as `['back', 'back', 'back', 'back']` until `handOver`.
  - **Monopoly (`buildPlayerView`)**: Strips shuffled `nasibDeck` and `danaDeck` arrays so guests cannot predict upcoming event cards.
  - **Avalon (`buildAvalonPlayerView`)**: Strips other players' true `role`/`loyalty` until `game_over` (exposing only legal role-specific Night Vision perceptions and private Lady of the Lake results to the entitled seat) and shuffles submitted quest cards before reveal so individual vote authorship cannot be Fingerprinted.
  - **Pandemic (`buildPlayerView`)**: Strips hidden `playerDeck` and `infectionDeck` draw orders so guests cannot inspect unrevealed player cards or pending epidemics. Discards and public hand contents remain visible for co-op coordination.
  - **Balik Kampung (`buildPlayerView`)**: Strips unrevealed `roadDeck` and `trafficDeck` draw orders (exposing only `roadDeckCount`, `inDangerZone`, and `trafficDeckCount`) and masks opponents' face-down `plannedCard` / `plannedFuelDump` during `PLANNING` until simultaneous reveal.

## 2. Universal Prefixed Transport, Handshake Hygiene & ESLint Security

- **Universal Room Codes**: `parseUniversalRoomCode()` and `generatePrefixedRoomCode()` route prefixed codes (`M*` → Mahjong, `P*` → Monopoly, `A*` → Avalon, `D*` → Pandemic, `B*` → Balik Kampung, legacy unprefixed → Mahjong) while isolating Host (`host_*`) and room-scoped Guest (`hkmj_guest_token_*` / `party_guest_token_*`) tokens in `sessionStorage` to prevent duplicated-tab collisions.
- **WebRTC, Chunking & Timer Lifecycle**: Connects over HTTPS `0.peerjs.com:443` + verified Google/Cloudflare UDP STUN (`buildPeerOptions()` also merges optional user-configured TURN/ICE relays from `localStorage['party_pavilion_ice_servers']` and custom PeerServer overrides from `localStorage['party_pavilion_peer_server']` without dead `openrelay.metered.ca` `192.0.2.1` blackhole endpoints). DataChannel messages above `12,000` UTF-8 bytes are transparently split and reassembled (`sendConnSafe` + `createChunkAssembler`) so large snapshots never hit PeerJS 1.5.5's `16,300`-byte `serialization: 'json'` drop limit, and `clearHandshakeTimers()` tears down retry intervals on first `sync`, `error`, or connection timeout.
- **URL Hygiene & ESLint Hardening**: Clear query strings via `window.history.replaceState()` and dispatch `p2p:leave` + `mahjong:leave` on room exit. Maintain **zero warnings** and **zero `eslint-disable` comments** under `eslint-plugin-security` (`security/detect-object-injection`) by using `Map<K, V>` and `Array.prototype.at()` instead of dynamic `obj[key]` / `arr[idx]` indexing.
