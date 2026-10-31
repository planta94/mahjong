# Empirical Challenge Report — Milestone 1: P2P Room Transport & Universal Room Code Parser

**Milestone**: Milestone 1 (Reusable P2P Room Transport & Universal Room Code Parser)  
**Agent**: `teamwork_challenger_m1_1` (Role: critic, specialist)  
**Verdict**: **FOUND FLAWS**  
**Date**: 2026-10-31  

---

## 1. Observation

Direct empirical observations obtained by inspecting `src/app/core/services/p2p-room.transport.ts` and executing empirical challenge test harness `src/app/core/services/p2p-room.challenge.spec.ts` (13 test cases):

### Flaw A: URL Query Parameter Case Sensitivity & Game Misrouting
In `src/app/core/services/p2p-room.transport.ts`:
```typescript
118:   const rawCode = isUrl
119:     ? (roomMatch?.at(1) ?? '')
120:     : trimmed.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
121:   const roomCode = rawCode.slice(0, 8);
...
129:   const firstChar = roomCode.charAt(0) as GamePrefix;
130:   const gameFromPrefix = PREFIX_TO_GAME_MAP.get(firstChar);
131:   if (gameFromPrefix) {
132:     return { game: gameFromPrefix, roomCode };
133:   }
134: 
135:   // 3. Backward-compatibility fallback: legacy codes without prefix route to mahjong
136:   return { game: 'mahjong', roomCode };
```
- Direct test observation in `p2p-room.challenge.spec.ts`:
  - `parseUniversalRoomCode('p12345')` returns `{ game: 'monopoly', roomCode: 'P12345' }`.
  - `parseUniversalRoomCode('?room=p12345')` returns `{ game: 'mahjong', roomCode: 'p12345' }`.
  - Because `rawCode` is not converted to uppercase when `isUrl === true`, `firstChar` is `'p'` (lowercase).
  - `PREFIX_TO_GAME_MAP` only contains uppercase `'P'`, `'M'`, `'A'`. Thus `PREFIX_TO_GAME_MAP.get('p')` returns `undefined` and falls through to `'mahjong'`.
  - In addition, `roomCode` remains unnormalized lowercase (`'p12345'`). The Host generates room code `'P12345'` (uppercase) and registers `party-pavilion-v1-P12345` and `party-bc-P12345`. The Guest connecting with `'p12345'` connects to `party-pavilion-v1-p12345` and `party-bc-p12345`. Because PeerJS IDs and BroadcastChannel names are case-sensitive, connection handshake fails permanently.

### Flaw B: Dual-Channel Duplicate Action Dispatch
In `src/app/core/services/p2p-room.transport.ts`, lines 537–547:
```typescript
537:   sendAction(action: TAction): void {
538:     const payload = {
539:       type: 'action',
540:       token: this.myToken,
541:       action,
542:     };
543:     if (this.conn?.open) {
544:       this.conn.send(payload);
545:     }
546:     this.bc?.postMessage(payload);
547:   }
```
And in `GenericHostSession`:
- `this.bc.onmessage` receives the message and invokes `this.handleClientMessage(ev.data, ...)`.
- `conn.on('data')` receives the message and invokes `this.handleClientMessage(rawMsg, ...)`.
- Both calls execute `this.applyActionFn(this.state, seatObj.seat, msg['action'])`.
- Direct test observation in `p2p-room.challenge.spec.ts`:
  - When both `guest.conn.open` and `guest.bc` are active (e.g. cross-tab on same browser), calling `guest.sendAction({ type: 'increment', val: 1 })` once results in `actionExecCount === 2` and state counter incrementing by 2.
  - In contrast, `src/app/core/services/mahjong-session.service.ts` (lines 840–846) strictly sends via `bc` OR via `conn`:
    ```typescript
    if (this.connectedViaBc && this.bc) {
      this.bc.postMessage(payload);
    } else if (this.conn) {
      sendConnSafe(this.conn, payload);
    }
    ```

### Confirmed Correct Components
1. **Concurrent Guest Connections & Room Full Rejections**:
   - Sequential assignment: open seats filled first, bot seats replaced next.
   - 4th guest joining 3-guest room receives `{ type: 'error', message: '房間座位已滿！' }`.
   - Mid-game joins blocked when `lobby.started === true`.
2. **Seat Disconnect & Reconnect**:
   - Connection drop marks `connected = false` and preserves seat ownership and token.
   - Returning guest reconnecting with identical token successfully restores `connected = true`.
3. **Anti-Cheat Token Sanitization**:
   - `buildSnapshotForSeat(0)` (Host) and `buildSnapshotForSeat(seatIdx)` (Guests) strictly sanitize all seats to `token: null`.
4. **Room Code Generation**:
   - Follows `CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'`.
   - Length is 6 characters (`prefix + 5 random chars`), truncated to 8 characters max.

---

## 2. Logic Chain

1. *Flaw A (URL query param case sensitivity)*:
   - Observation: Line 118 assigns `rawCode = isUrl ? (roomMatch?.at(1) ?? '') : trimmed.replace(/[^A-Za-z0-9]/g, '').toUpperCase()`.
   - Observation: When `input = '?room=p12345'`, `isUrl` is true, so `rawCode` is `'p12345'` without `.toUpperCase()`.
   - Observation: Line 129 takes `roomCode.charAt(0)` -> `'p'`.
   - Observation: `PREFIX_TO_GAME_MAP` has keys `['M', 'P', 'A']`. Key `'p'` does not exist.
   - Deduction: Game lookup fails; line 136 falls back to `game: 'mahjong'`. A Monopoly deep link with lowercase code is erroneously routed to Mahjong, and fails P2P connection due to case mismatch (`party-bc-p12345` vs `party-bc-P12345`).
   - Mitigation: Update line 118:
     ```typescript
     const rawCode = (
       isUrl
         ? (roomMatch?.at(1) ?? '')
         : trimmed.replace(/[^A-Za-z0-9]/g, '')
     ).toUpperCase();
     ```

2. *Flaw B (Dual-channel duplicate action dispatch)*:
   - Observation: Line 543 checks `if (this.conn?.open) this.conn.send(payload);`, and line 546 unconditionally executes `this.bc?.postMessage(payload);`.
   - Observation: Host registers listeners on both `conn.on('data')` and `bc.onmessage`.
   - Observation: In any scenario where both WebRTC data channel and BroadcastChannel are connected to the same host instance (e.g., cross-tab testing or same-origin play), both callbacks fire.
   - Deduction: `applyActionFn` executes twice for every user action. In turn-based games (Mahjong discard, Monopoly roll/buy, Avalon vote), this causes invalid double-plays or state desynchronization.
   - Mitigation: Prioritize active channel:
     ```typescript
     if (this.conn?.open) {
       this.conn.send(payload);
     } else if (this.bc) {
       this.bc.postMessage(payload);
     }
     ```
     Apply identical exclusive branching to `sendJoin()`.

---

## 3. Caveats

- In pure cross-network WebRTC play (different machines/browsers), `BroadcastChannel` messages do not cross browser boundaries, so Flaw B only triggers in local/multi-tab environments or when both channels exist. However, local cross-tab play is a primary advertised capability of the platform ("支援同瀏覽器多分頁或電腦對戰").
- PeerJS public cloud signaling (`0.peerjs.com`) was not tested with actual WAN packet drop injection in this unit/integration test run, as external network access is blocked in sandbox mode; all P2P connection tests utilized mocked/local instances.

---

## 4. Conclusion

**Verdict: FOUND FLAWS**

While core concurrency, seat reconnection, token sanitization, and room code generation are implemented cleanly and verified correct, two functional flaws must be addressed:
1. `parseUniversalRoomCode()` fails to normalize URL query parameter codes to uppercase, causing lowercase deep links (`?room=p12345`, `?room=a5555`) to misroute to Mahjong and fail P2P room discovery.
2. `GenericGuestSession.sendAction()` dispatches to both `conn` and `bc` concurrently, resulting in duplicate action execution on the Host when both channels are active.

---

## 5. Verification Method

To independently reproduce and verify:
```bash
# 1. Run empirical challenge test suite (includes reproduction of both flaws)
npx vitest run src/app/core/services/p2p-room.challenge.spec.ts

# 2. Run standard verification checklist
npm.cmd run qa:agent-docs
npx.cmd tsc --noEmit
npm.cmd run lint
```
Files to inspect:
- `src/app/core/services/p2p-room.challenge.spec.ts` (test cases for Flaw A and Flaw B)
- `src/app/core/services/p2p-room.transport.ts` (lines 118–121, 543–547)
