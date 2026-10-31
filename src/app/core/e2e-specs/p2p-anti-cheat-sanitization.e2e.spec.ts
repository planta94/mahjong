// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET,
  GenericHostSession,
  P2PRoomTransportService,
  clearBrowserUrlRoom,
  createRandomToken,
  dispatchP2pLeaveEvent,
  generatePrefixedRoomCode,
  getPartyGuestToken,
  parseUniversalRoomCode,
  updateBrowserUrlWithRoom,
} from '../services/p2p-room.transport';
import { createMatch, getPlayerView } from '../services/engine.service';
import { GenericLobby, GenericSeat } from '../models/party.model';
import { Meld } from '../models/mahjong.model';

describe('E2E: P2P Anti-Cheat & State Sanitization Suite', () => {
  const p2pService = new P2PRoomTransportService();

  describe('1. Universal Room Codes & Prefixes', () => {
    it('generates 6-character room codes with correct game prefixes', () => {
      const mahjongCode = p2pService.generateCode('M');
      const monopolyCode = p2pService.generateCode('P');
      const avalonCode = p2pService.generateCode('A');

      expect(mahjongCode.length).toBe(6);
      expect(mahjongCode.charAt(0)).toBe('M');
      expect(monopolyCode.length).toBe(6);
      expect(monopolyCode.charAt(0)).toBe('P');
      expect(avalonCode.length).toBe(6);
      expect(avalonCode.charAt(0)).toBe('A');

      // Verify alphabet characters strictly belong to CODE_ALPHABET
      for (let i = 1; i < mahjongCode.length; i++) {
        expect(CODE_ALPHABET.includes(mahjongCode.charAt(i))).toBe(true);
      }
      for (let i = 1; i < monopolyCode.length; i++) {
        expect(CODE_ALPHABET.includes(monopolyCode.charAt(i))).toBe(true);
      }
      for (let i = 1; i < avalonCode.length; i++) {
        expect(CODE_ALPHABET.includes(avalonCode.charAt(i))).toBe(true);
      }
    });

    it('parses universal room codes and query string parameters across all three games', () => {
      const mahjongParsed = p2pService.parseRoomCode('M9X7Q');
      expect(mahjongParsed.game).toBe('mahjong');
      expect(mahjongParsed.roomCode).toBe('M9X7Q');

      const monopolyParsed = p2pService.parseRoomCode('P4K2M');
      expect(monopolyParsed.game).toBe('monopoly');
      expect(monopolyParsed.roomCode).toBe('P4K2M');

      const avalonParsed = p2pService.parseRoomCode('A3R8L');
      expect(avalonParsed.game).toBe('avalon');
      expect(avalonParsed.roomCode).toBe('A3R8L');

      const deepLinkMonopoly = p2pService.parseRoomCode('https://domain.com/?game=monopoly&room=P1234');
      expect(deepLinkMonopoly.game).toBe('monopoly');
      expect(deepLinkMonopoly.roomCode).toBe('P1234');

      const deepLinkAvalon = p2pService.parseRoomCode('https://domain.com/?game=avalon&room=A8888');
      expect(deepLinkAvalon.game).toBe('avalon');
      expect(deepLinkAvalon.roomCode).toBe('A8888');

      const deepLinkMahjong = p2pService.parseRoomCode('https://domain.com/?room=M5555');
      expect(deepLinkMahjong.game).toBe('mahjong');
      expect(deepLinkMahjong.roomCode).toBe('M5555');

      const legacyFallback = p2pService.parseRoomCode('LEGACY88');
      expect(legacyFallback.game).toBe('mahjong');
      expect(legacyFallback.roomCode).toBe('LEGACY88');

      const emptyFallback = p2pService.parseRoomCode('   ');
      expect(emptyFallback.game).toBe('mahjong');
      expect(emptyFallback.roomCode).toBe('');
    });
  });

  describe('2. Guest Token Storage & Isolation', () => {
    it('isolates guest tokens in sessionStorage per room code without collision', () => {
      const tok1 = p2pService.getGuestToken('P1111');
      const tok2 = p2pService.getGuestToken('A2222');

      expect(typeof tok1).toBe('string');
      expect(tok1.length).toBeGreaterThan(10);
      expect(typeof tok2).toBe('string');
      expect(tok2.length).toBeGreaterThan(10);
      expect(tok1 === tok2).toBe(false);

      // Re-retrieval for same room code returns identical cached token
      const tok1Repeat = p2pService.getGuestToken('P1111');
      expect(tok1Repeat).toBe(tok1);
    });

    it('generates cryptographically distinct tokens with specified prefixes', () => {
      const hostTok = createRandomToken('host');
      const guestTok = createRandomToken('guest');

      expect(hostTok.startsWith('host_')).toBe(true);
      expect(guestTok.startsWith('guest_')).toBe(true);
      expect(hostTok === guestTok).toBe(false);
    });
  });

  describe('3. P2P URL Hygiene & Decoupled Reset', () => {
    it('updates and clears URL room parameters without page refresh', () => {
      p2pService.updateUrl('P7890', 'monopoly');
      expect(window.location.search).toContain('game=monopoly');
      expect(window.location.search).toContain('room=P7890');

      p2pService.clearUrl();
      expect(window.location.search).toBe('');
    });

    it('dispatches decoupled p2p:leave and mahjong:leave events upon departure', () => {
      let p2pLeaveFired = false;
      let mahjongLeaveFired = false;
      let receivedRoom = '';

      const p2pHandler = (evt: Event) => {
        p2pLeaveFired = true;
        const custom = evt as CustomEvent<{ roomCode: string; game: string }>;
        receivedRoom = custom.detail.roomCode;
      };
      const mjHandler = () => {
        mahjongLeaveFired = true;
      };

      window.addEventListener('p2p:leave', p2pHandler);
      window.addEventListener('mahjong:leave', mjHandler);

      p2pService.dispatchLeave('M4321', 'mahjong');

      window.removeEventListener('p2p:leave', p2pHandler);
      window.removeEventListener('mahjong:leave', mjHandler);

      expect(p2pLeaveFired).toBe(true);
      expect(mahjongLeaveFired).toBe(true);
      expect(receivedRoom).toBe('M4321');
    });
  });

  describe('4. Generic Host Transport Token Sanitization Contract', () => {
    interface DummyGameState {
      secretDeck: string[];
      counter: number;
    }
    interface DummyPlayerView {
      viewerSeat: number;
      counter: number;
      deckRemaining: number;
    }
    interface DummyAction {
      type: 'increment';
    }

    it('strictly strips all seat tokens (token: null) across all outbound snapshots for Monopoly, Avalon, and Mahjong', () => {
      const seats: GenericSeat[] = [
        { seat: 0, kind: 'human', name: 'Host Player', token: 'secret_host_tok_123', connected: true },
        { seat: 1, kind: 'human', name: 'Guest Player 1', token: 'secret_guest_tok_456', connected: true },
        { seat: 2, kind: 'bot', name: 'AI Bot', token: null, connected: true },
        { seat: 3, kind: 'open', name: 'Open Slot', token: null, connected: false },
      ];

      const dummyLobby: GenericLobby<GenericSeat> = {
        started: true,
        seats,
      };

      const hostSession = new GenericHostSession<DummyGameState, DummyPlayerView, DummyAction>({
        gamePrefix: 'P',
        roomCode: 'P9999',
        hostName: 'Host Player',
        online: false,
        token: 'secret_host_tok_123',
        initialState: { secretDeck: ['CardA', 'CardB', 'CardC'], counter: 42 },
        initialLobby: dummyLobby,
        buildPlayerView: (state, seatIdx) => ({
          viewerSeat: seatIdx,
          counter: state.counter,
          deckRemaining: state.secretDeck.length,
        }),
        applyAction: (state, _seat, action) => {
          if (action.type === 'increment') state.counter++;
        },
      });

      // 1. Host snapshot inspection (seat 0)
      const hostSnap = hostSession.buildSnapshotForSeat(0);
      expect(hostSnap.role).toBe('host');
      expect(hostSnap.mySeat).toBe(0);
      expect(hostSnap.lobby?.seats.length).toBe(4);

      // Verify every single seat token is stripped to null
      for (const seat of hostSnap.lobby?.seats ?? []) {
        expect(seat.token).toBe(null);
      }

      // 2. Guest snapshot inspection (seat 1)
      const guestSnap = hostSession.buildSnapshotForSeat(1);
      expect(guestSnap.role).toBe('guest');
      expect(guestSnap.mySeat).toBe(1);
      expect(guestSnap.error).toBe(null);

      for (const seat of guestSnap.lobby?.seats ?? []) {
        expect(seat.token).toBe(null);
      }

      // 3. Verify internal state held by host is unchanged
      expect(hostSession.lobby.seats.at(0)?.token).toBe('secret_host_tok_123');
      expect(hostSession.lobby.seats.at(1)?.token).toBe('secret_guest_tok_456');

      hostSession.destroy();
    });

    it('handles client join requests, reconnections, full-room rejections, and game-started rejections', () => {
      let seatConnectedChangeCalled = false;
      let changedSeat = -1;
      let changedConnected = false;

      const hostSession = new GenericHostSession<DummyGameState, DummyPlayerView, DummyAction>({
        gamePrefix: 'A',
        roomCode: 'A7777',
        hostName: 'Host King',
        online: false,
        token: 'host_tok_777',
        initialState: { secretDeck: [], counter: 0 },
        initialLobby: {
          started: false,
          seats: [
            { seat: 0, kind: 'human', name: 'Host King', token: 'host_tok_777', connected: true },
            { seat: 1, kind: 'open', name: 'Open 1', token: null, connected: false },
            { seat: 2, kind: 'bot', name: 'Bot 2', token: null, connected: true },
          ],
        },
        buildPlayerView: (state, seatIdx) => ({
          viewerSeat: seatIdx,
          counter: state.counter,
          deckRemaining: state.secretDeck.length,
        }),
        applyAction: () => {},
        onSeatConnectedChange: (seatIdx, connected) => {
          seatConnectedChangeCalled = true;
          changedSeat = seatIdx;
          changedConnected = connected;
        },
      });

      // 1. Message with host token is ignored
      let reply: Record<string, unknown> | null = null;
      hostSession.handleClientMessage({ type: 'join', token: 'host_tok_777', name: 'Imposter' }, (r) => {
        reply = r;
      });
      expect(reply).toBe(null);

      // 2. Guest 1 joins an open seat
      hostSession.handleClientMessage({ type: 'join', token: 'guest_tok_1', name: 'Knight Percival' }, (r) => {
        reply = r;
      });
      expect(reply).toBe(null);
      expect(hostSession.lobby.seats.at(1)?.kind).toBe('human');
      expect(hostSession.lobby.seats.at(1)?.name).toBe('Knight Percival');
      expect(hostSession.lobby.seats.at(1)?.token).toBe('guest_tok_1');
      expect(seatConnectedChangeCalled).toBe(true);
      expect(changedSeat).toBe(1);
      expect(changedConnected).toBe(true);

      // 3. Guest 1 reconnects with updated name
      hostSession.handleClientMessage({ type: 'join', token: 'guest_tok_1', name: 'Sir Percival' }, () => {});
      expect(hostSession.lobby.seats.at(1)?.name).toBe('Sir Percival');

      // 4. Guest 2 joins, taking over bot slot
      hostSession.handleClientMessage({ type: 'join', token: 'guest_tok_2', name: 'Sir Gawain' }, () => {});
      expect(hostSession.lobby.seats.at(2)?.kind).toBe('human');
      expect(hostSession.lobby.seats.at(2)?.name).toBe('Sir Gawain');

      // 5. Room is now full (3/3 seats). 4th player is rejected with '房间座位已满！'
      let errorReply: Record<string, unknown> | null = null;
      hostSession.handleClientMessage({ type: 'join', token: 'guest_tok_3', name: 'Sir Lancelot' }, (r) => {
        errorReply = r;
      });
      expect(errorReply?.['type']).toBe('error');
      expect(errorReply?.['message']).toBe('房间座位已满！');

      // 6. When game starts, new joins are rejected
      hostSession.lobby.started = true;
      let startedReply: Record<string, unknown> | null = null;
      hostSession.handleClientMessage({ type: 'join', token: 'guest_tok_4', name: 'Sir Galahad' }, (r) => {
        startedReply = r;
      });
      expect(startedReply?.['type']).toBe('error');
      expect(startedReply?.['message']).toBe('游戏已经开始，无法中途加入新座位。');

      hostSession.destroy();
    });

    it('handles client action execution, failure cascading, and host error capture', () => {
      const hostSession = new GenericHostSession<DummyGameState, DummyPlayerView, DummyAction>({
        gamePrefix: 'M',
        roomCode: 'M1234',
        hostName: 'Host Master',
        online: false,
        initialState: { secretDeck: [], counter: 10 },
        initialLobby: {
          started: true,
          seats: [
            { seat: 0, kind: 'human', name: 'Host Master', token: 'host_tok', connected: true },
            { seat: 1, kind: 'human', name: 'Player 2', token: 'guest_tok_p2', connected: true },
          ],
        },
        buildPlayerView: (state, seatIdx) => ({
          viewerSeat: seatIdx,
          counter: state.counter,
          deckRemaining: 0,
        }),
        applyAction: (state, seat, action) => {
          if (seat === 1 && state.counter >= 15) {
            throw new Error('動作已達上限！');
          }
          if (action.type === 'increment') {
            state.counter += 5;
          }
        },
      });

      // 1. Client action successfully increments counter
      hostSession.handleClientMessage({
        type: 'action',
        token: 'guest_tok_p2',
        action: { type: 'increment' },
      }, () => {});

      expect(hostSession.state.counter).toBe(15);

      // 2. Client action throws error -> error reply is dispatched back
      let actionErrorReply: Record<string, unknown> | null = null;
      hostSession.handleClientMessage({
        type: 'action',
        token: 'guest_tok_p2',
        action: { type: 'increment' },
      }, (r) => {
        actionErrorReply = r;
      });
      expect(actionErrorReply?.['type']).toBe('error');
      expect(actionErrorReply?.['message']).toBe('動作已達上限！');

      // 3. Unknown token action is safely ignored
      hostSession.handleClientMessage({
        type: 'action',
        token: 'unknown_token_999',
        action: { type: 'increment' },
      }, () => {});
      expect(hostSession.state.counter).toBe(15);

      // 4. Host dispatches action that throws -> sets hostSession.error
      hostSession.dispatchHostAction({ type: 'increment' });
      expect(hostSession.state.counter).toBe(20);

      // 5. Host updateState modifier
      hostSession.updateState((s) => {
        s.counter = 100;
      });
      expect(hostSession.state.counter).toBe(100);

      hostSession.destroy();
    });

    it('handles non-Error exception cascades and listener unsubscribe', () => {
      const hostSession = p2pService.createHost<DummyGameState, DummyPlayerView, DummyAction>({
        gamePrefix: 'M',
        initialState: { secretDeck: [], counter: 0 },
        initialLobby: {
          started: true,
          seats: [
            { seat: 0, kind: 'human', name: '', token: 'h_tok', connected: true },
            { seat: 1, kind: 'human', name: 'Guest 2', token: 'g_tok_2', connected: true },
          ],
        },
        buildPlayerView: (state, seatIdx) => ({
          viewerSeat: seatIdx,
          counter: state.counter,
          deckRemaining: 0,
        }),
        applyAction: (_state, _seat, _act) => {
          throw 'Non-Error exception string';
        },
      });

      // Host name fallback to 房主
      expect(hostSession.lobby.seats.at(0)?.name).toBe('房主');

      // Host action throws non-Error -> sets error to '操作无效'
      hostSession.dispatchHostAction({ type: 'increment' });
      expect(hostSession.error).toBe('操作无效');

      // Client action throws non-Error -> replies with '非法操作'
      let clientReply: Record<string, unknown> | null = null;
      hostSession.handleClientMessage({
        type: 'action',
        token: 'g_tok_2',
        action: { type: 'increment' },
      }, (r) => {
        clientReply = r;
      });
      expect(clientReply?.['type']).toBe('error');
      expect(clientReply?.['message']).toBe('非法操作');

      // Listener subscribe and unsubscribe
      let listenerCalls = 0;
      const unsub = hostSession.onUpdate(() => {
        listenerCalls++;
      });
      expect(listenerCalls).toBeGreaterThan(0);
      unsub();

      hostSession.destroy();
    });

    it('exercises GenericGuestSession lifecycle, server message parsing, and action dispatching', () => {
      const guest = p2pService.createGuest<{ counter: number }, { type: 'inc' }>({
        roomCode: 'P8888',
        guestName: 'Guest Tester',
        token: 'custom_guest_tok_888',
      });

      expect(guest.role).toBe('guest');
      expect(guest.roomCode).toBe('P8888');
      expect(guest.myToken).toBe('custom_guest_tok_888');

      let updateCount = 0;
      const unsub = guest.onUpdate(() => {
        updateCount++;
      });
      expect(updateCount).toBeGreaterThan(0);

      // 1. Handle server error message
      guest.handleServerMessage({ type: 'error', message: '房間不可用' });

      // 2. Handle server sync message
      guest.handleServerMessage({
        type: 'sync',
        snapshot: {
          role: 'guest',
          online: true,
          roomCode: 'P8888',
          status: '同步完成',
          error: null,
          mySeat: 1,
          lobby: { started: true, seats: [] },
          view: { counter: 99 },
        },
      });

      // 3. Handle invalid/non-record server messages
      guest.handleServerMessage('invalid_string');
      guest.handleServerMessage(null);

      // 4. Dispatch action
      expect(() => guest.sendAction({ type: 'inc' })).not.toThrow();

      unsub();
      guest.destroy();
    });
  });

  describe('5. Authentic Mahjong HKMJ-P2P-CHECK-01 Invariants', () => {
    it('enforces strictly 3 seats for Authentic Malaysian 3P Fly Mahjong — never pads a 4th filler bot', () => {
      const match3P = createMatch({ mode: '3p' });

      expect(match3P.mode).toBe('3p');
      expect(match3P.numSeats).toBe(3);
      expect(match3P.players.length).toBe(3);

      // Verify seats correspond strictly to East, South, West (0, 1, 2)
      expect(match3P.players.at(0)?.seat).toBe(0);
      expect(match3P.players.at(1)?.seat).toBe(1);
      expect(match3P.players.at(2)?.seat).toBe(2);
      expect(match3P.players.at(3)).toBe(undefined);

      // Verify total 3P Malaysian Fly Mahjong deck consists of exactly 84 tiles
      // Hand tiles + bonus tiles + meld tiles + wall
      const totalTilesInPlay =
        match3P.wall.length +
        match3P.players.reduce((acc, p) => acc + p.hand.length + p.bonus.length, 0);
      expect(totalTilesInPlay).toBe(84);
    });

    it('enforces full 144-tile deck and 4 seats for HK 4P Mahjong', () => {
      const match4P = createMatch({ mode: '4p' });

      expect(match4P.mode).toBe('4p');
      expect(match4P.numSeats).toBe(4);
      expect(match4P.players.length).toBe(4);

      const totalTilesInPlay =
        match4P.wall.length +
        match4P.players.reduce((acc, p) => acc + p.hand.length + p.bonus.length, 0);
      expect(totalTilesInPlay).toBe(144);
    });

    it('sanitizes Mahjong match state: conceals wall, masks opponent hands, and conceals Kongs until handOver', () => {
      const match = createMatch({ mode: '3p' });

      // Add a concealed kong to seat 1 for testing
      const seat1 = match.players.at(1);
      if (seat1) {
        const concealedKong: Meld = {
          type: 'kong',
          codes: ['p1', 'p1', 'p1', 'p1'],
          tileIds: ['p1_0', 'p1_1', 'p1_2', 'p1_3'],
          concealed: true,
          fromSeat: 1,
        };
        seat1.melds.push(concealedKong);
      }

      // Viewer is Seat 0
      const view0 = getPlayerView(match, 0);

      // 1. Wall array is stripped, only wallCount is exposed
      expect('wall' in view0).toBe(false);
      expect(view0.wallCount).toBe(match.wall.length);
      expect(view0.wallCount).toBeGreaterThan(0);

      // 2. Viewer (seat 0) sees own hand tiles
      expect(Array.isArray(view0.players.at(0)?.hand)).toBe(true);
      expect(view0.players.at(0)?.hand?.length).toBeGreaterThan(0);

      // 3. Opponent hands (seats 1 and 2) are strictly concealed as null
      expect(view0.players.at(1)?.hand).toBe(null);
      expect(view0.players.at(2)?.hand).toBe(null);
      expect(view0.players.at(1)?.handCount).toBeGreaterThan(0);
      expect(view0.players.at(2)?.handCount).toBeGreaterThan(0);

      // 4. Opponent's concealed kong is masked as ['back', 'back', 'back', 'back']
      const opponentMeld = view0.players.at(1)?.melds.at(0);
      expect(opponentMeld?.type).toBe('kong');
      expect(opponentMeld?.codes).toEqual(['back', 'back', 'back', 'back']);

      // 5. When handOver, all hands and concealed kongs are revealed
      const endedState = {
        ...match,
        phase: 'handOver' as const,
      };
      const endView0 = getPlayerView(endedState, 0);
      expect(Array.isArray(endView0.players.at(1)?.hand)).toBe(true);
      const revealedMeld = endView0.players.at(1)?.melds.at(0);
      expect(revealedMeld?.codes).toEqual(['p1', 'p1', 'p1', 'p1']);
    });
  });
});
