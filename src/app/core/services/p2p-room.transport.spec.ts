import { TestBed } from '@angular/core/testing';
import { GenericLobby, GenericSeat } from '../models/party.model';
import {
  CODE_ALPHABET,
  GenericGuestSession,
  GenericHostSession,
  P2PRoomTransportService,
  clearBrowserUrlRoom,
  createRandomToken,
  dispatchP2pLeaveEvent,
  generatePrefixedRoomCode,
  getPartyGuestToken,
  parseUniversalRoomCode,
  sendConnSafe,
  updateBrowserUrlWithRoom,
} from './p2p-room.transport';

describe('P2PRoomTransport & Universal Transport Protocol', () => {
  let transportService: P2PRoomTransportService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [P2PRoomTransportService],
    });
    transportService = TestBed.inject(P2PRoomTransportService);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  interface TestState {
    pot: number;
    secretDeck: string[];
    playerHands: Record<number, string[]>;
  }
  interface TestView {
    pot: number;
    hand: string[];
    deckCount: number;
  }
  interface TestAction {
    type: 'bid' | 'draw';
    amount?: number;
  }

  function createTestLobby(): GenericLobby {
    const seats: GenericSeat[] = [
      { seat: 0, kind: 'human', name: 'Host Player', token: 'host_initial', connected: true },
      { seat: 1, kind: 'open', name: 'Open Seat', token: null, connected: false },
      { seat: 2, kind: 'bot', name: 'Bot Player', token: 'bot_2', connected: true },
    ];
    return { started: false, seats, rules: { roundLimit: 50 } };
  }

  describe('1. Room Code Generation & Universal Parser', () => {
    it('generates game-prefixed room codes from alphabet', () => {
      const mahjongCode = generatePrefixedRoomCode('M', 5);
      expect(mahjongCode.length).toBe(6);
      expect(mahjongCode.startsWith('M')).toBe(true);

      const monopolyCode = generatePrefixedRoomCode('P', 5);
      expect(monopolyCode.length).toBe(6);
      expect(monopolyCode.startsWith('P')).toBe(true);

      const avalonCode = generatePrefixedRoomCode('A', 5);
      expect(avalonCode.length).toBe(6);
      expect(avalonCode.startsWith('A')).toBe(true);

      for (let i = 1; i < mahjongCode.length; i++) {
        expect(CODE_ALPHABET.includes(mahjongCode.charAt(i))).toBe(true);
      }
    });

    it('resolves universal room codes via prefix matching', () => {
      expect(parseUniversalRoomCode('P12345')).toEqual({ game: 'monopoly', roomCode: 'P12345' });
      expect(parseUniversalRoomCode('A88888')).toEqual({ game: 'avalon', roomCode: 'A88888' });
      expect(parseUniversalRoomCode('M99999')).toEqual({ game: 'mahjong', roomCode: 'M99999' });
    });

    it('resolves universal room codes from query parameters and full URLs', () => {
      expect(parseUniversalRoomCode('?room=P4567')).toEqual({ game: 'monopoly', roomCode: 'P4567' });
      expect(parseUniversalRoomCode('?game=avalon&room=XYZ12')).toEqual({ game: 'avalon', roomCode: 'XYZ12' });
      expect(parseUniversalRoomCode('https://domain.com/table?game=monopoly&room=P333')).toEqual({
        game: 'monopoly',
        roomCode: 'P333',
      });
      expect(parseUniversalRoomCode('https://domain.com/?room=M555')).toEqual({
        game: 'mahjong',
        roomCode: 'M555',
      });
    });

    it('falls back to mahjong for legacy codes without prefix and handles empty strings', () => {
      expect(parseUniversalRoomCode('98765')).toEqual({ game: 'mahjong', roomCode: '98765' });
      expect(parseUniversalRoomCode('')).toEqual({ game: 'mahjong', roomCode: '' });
      expect(parseUniversalRoomCode('   ')).toEqual({ game: 'mahjong', roomCode: '' });
    });
  });

  describe('2. Token Isolation & URL Hygiene', () => {
    it('creates random tokens with specified prefix', () => {
      const tok = createRandomToken('host');
      expect(tok.startsWith('host_')).toBe(true);
      expect(tok.length).toBeGreaterThan(8);
    });

    it('isolates guest tokens per room code in sessionStorage', () => {
      const tok1 = getPartyGuestToken('P1111');
      const tok1Repeat = getPartyGuestToken('P1111');
      expect(tok1).toBe(tok1Repeat);

      const tok2 = getPartyGuestToken('P2222');
      expect(tok1 !== tok2).toBe(true);
      expect(sessionStorage.getItem('party_guest_token_P1111')).toBe(tok1);
      expect(sessionStorage.getItem('party_guest_token_P2222')).toBe(tok2);
    });

    it('updates browser URL with room parameters and clears cleanly', () => {
      updateBrowserUrlWithRoom('P7777', 'monopoly');
      expect(window.location.search).toContain('game=monopoly');
      expect(window.location.search).toContain('room=P7777');

      clearBrowserUrlRoom();
      expect(window.location.search).toBe('');
    });

    it('dispatches p2p:leave and mahjong:leave events with details', () => {
      const p2pEvents: Array<{ roomCode: string; game: string }> = [];
      let mahjongFired = false;

      const p2pListener = (ev: Event) => {
        p2pEvents.push((ev as CustomEvent<{ roomCode: string; game: string }>).detail);
      };
      const mjListener = () => {
        mahjongFired = true;
      };

      window.addEventListener('p2p:leave', p2pListener);
      window.addEventListener('mahjong:leave', mjListener);

      try {
        dispatchP2pLeaveEvent('A5555', 'avalon');
        expect(p2pEvents.length).toBe(1);
        expect(mahjongFired).toBe(true);
        expect(p2pEvents.at(0)?.roomCode).toBe('A5555');
        expect(p2pEvents.at(0)?.game).toBe('avalon');
      } finally {
        window.removeEventListener('p2p:leave', p2pListener);
        window.removeEventListener('mahjong:leave', mjListener);
      }
    });
  });

  describe('3. GenericHostSession State Sanitization & Lifecycle', () => {
    it('initializes host session and strips seat tokens in snapshots', () => {
      const initialState: TestState = {
        pot: 100,
        secretDeck: ['card1', 'card2', 'card3'],
        playerHands: { 0: ['h0'], 1: ['h1'] },
      };

      const host = new GenericHostSession<TestState, TestView, TestAction>({
        gamePrefix: 'P',
        hostName: 'TycoonHost',
        online: false,
        initialState,
        initialLobby: createTestLobby(),
        buildPlayerView: (state, seatIdx) => ({
          pot: state.pot,
          hand: state.playerHands[seatIdx] ?? [],
          deckCount: state.secretDeck.length,
        }),
        applyAction: (state, seatIdx, action) => {
          if (action.type === 'bid') {
            state.pot += action.amount ?? 10;
          }
        },
      });

      expect(host.role).toBe('host');
      expect(host.roomCode).toBe('LOCAL');
      expect(host.mySeat).toBe(0);

      // Verify state sanitization
      const snap0 = host.buildSnapshotForSeat(0);
      expect(snap0.role).toBe('host');
      expect(snap0.view?.pot).toBe(100);
      expect(snap0.view?.hand).toEqual(['h0']);
      expect(snap0.view?.deckCount).toBe(3);

      // Verify all seat tokens are stripped to null
      for (const seat of snap0.lobby!.seats) {
        expect(seat.token).toBe(null);
      }

      // Guest view sanitization
      const snap1 = host.buildSnapshotForSeat(1);
      expect(snap1.role).toBe('guest');
      expect(snap1.view?.hand).toEqual(['h1']);

      host.destroy();
    });

    it('handles host action dispatch and state modifications', () => {
      const initialState: TestState = {
        pot: 50,
        secretDeck: ['c1'],
        playerHands: { 0: [] },
      };

      const host = new GenericHostSession<TestState, TestView, TestAction>({
        gamePrefix: 'P',
        online: false,
        initialState,
        initialLobby: createTestLobby(),
        buildPlayerView: (state) => ({ pot: state.pot, hand: [], deckCount: state.secretDeck.length }),
        applyAction: (state, seatIdx, action) => {
          if (action.type === 'bid' && action.amount) {
            state.pot += action.amount;
          } else {
            throw new Error('Invalid bid action');
          }
        },
      });

      host.dispatchHostAction({ type: 'bid', amount: 35 });
      expect(host.state.pot).toBe(85);
      expect(host.buildSnapshotForSeat(0).view?.pot).toBe(85);

      // Thrown error in action handler is captured gracefully
      host.dispatchHostAction({ type: 'bid', amount: 0 });
      expect(host.error).toBe('Invalid bid action');

      host.updateState((s) => {
        s.pot = 500;
      });
      expect(host.state.pot).toBe(500);

      host.destroy();
    });

    it('handles client messages: join, reconnect, full room, already started, and actions', () => {
      const initialState: TestState = {
        pot: 50,
        secretDeck: ['c1'],
        playerHands: { 0: [], 1: ['cardA'] },
      };
      const seatsChanged: Array<{ seat: number; connected: boolean }> = [];

      const host = new GenericHostSession<TestState, TestView, TestAction>({
        gamePrefix: 'P',
        online: false,
        initialState,
        initialLobby: createTestLobby(),
        buildPlayerView: (state) => ({ pot: state.pot, hand: [], deckCount: state.secretDeck.length }),
        applyAction: (state, seatIdx, action) => {
          if (action.type === 'bid' && action.amount) {
            state.pot += action.amount;
          } else {
            throw new Error('Action rejected');
          }
        },
        onSeatConnectedChange: (seat, connected) => {
          seatsChanged.push({ seat, connected });
        },
      });

      const replies: Array<Record<string, unknown>> = [];
      const replyFn = (r: Record<string, unknown>) => replies.push(r);

      // 1. Client joins open seat
      host.handleClientMessage({ type: 'join', token: 'guest_111', name: 'Alice' }, replyFn);
      expect(host.lobby.seats.at(1)?.kind).toBe('human');
      expect(host.lobby.seats.at(1)?.name).toBe('Alice');
      expect(host.lobby.seats.at(1)?.connected).toBe(true);
      expect(seatsChanged.at(0)).toEqual({ seat: 1, connected: true });

      // 2. Client reconnects with same token
      host.handleClientMessage({ type: 'join', token: 'guest_111', name: 'Alice Renamed' }, replyFn);
      expect(host.lobby.seats.at(1)?.name).toBe('Alice Renamed');

      // 3. Client joins remaining bot seat
      host.handleClientMessage({ type: 'join', token: 'guest_222', name: 'Bob' }, replyFn);
      expect(host.lobby.seats.at(2)?.kind).toBe('human');
      expect(host.lobby.seats.at(2)?.name).toBe('Bob');

      // 4. Room is now full -> joining fails
      host.handleClientMessage({ type: 'join', token: 'guest_333', name: 'Charlie' }, replyFn);
      expect(replies.at(0)?.['type']).toBe('error');
      expect(replies.at(0)?.['message']).toBe('房间座位已满！');

      // 5. Game action from valid seated player
      host.handleClientMessage(
        { type: 'action', token: 'guest_111', action: { type: 'bid', amount: 40 } },
        replyFn
      );
      expect(host.state.pot).toBe(90);

      // 6. Illegal action from player triggers error reply
      host.handleClientMessage(
        { type: 'action', token: 'guest_111', action: { type: 'bid', amount: 0 } },
        replyFn
      );
      expect(replies.at(1)?.['type']).toBe('error');
      expect(replies.at(1)?.['message']).toBe('Action rejected');

      // 7. Started game blocks new joins
      host.lobby.started = true;
      host.handleClientMessage({ type: 'join', token: 'guest_444', name: 'LateComer' }, replyFn);
      expect(replies.at(2)?.['type']).toBe('error');

      // 8. Messages with invalid token or host's own token are safely ignored
      host.handleClientMessage({ type: 'join', token: host.myToken, name: 'Imposter' }, replyFn);
      host.handleClientMessage({ type: 'join', token: '', name: 'Empty' }, replyFn);

      host.destroy();
    });
  });

  describe('4. GenericGuestSession Protocol & Transport Service', () => {
    it('initializes guest session with parsed room code and token', () => {
      const guest = new GenericGuestSession<unknown, unknown>({
        roomCode: 'P9876',
        guestName: 'GuestAlice',
      });

      expect(guest.role).toBe('guest');
      expect(guest.online).toBe(true);
      expect(guest.roomCode).toBe('P9876');
      expect(guest.myToken.startsWith('guest_')).toBe(true);

      let snapReceived = false;
      const unsubscribe = guest.onUpdate((snap) => {
        if (snap.roomCode === 'P9876') snapReceived = true;
      });
      expect(snapReceived).toBe(true);

      unsubscribe();
      guest.destroy();
    });

    it('handles guest server messages: sync, error, and action dispatch', () => {
      const guest = new GenericGuestSession<TestView, TestAction>({
        roomCode: 'P8888',
        guestName: 'GuestBob',
      });

      let latestStatus = '';
      let latestError: string | null = null;
      let latestPot = 0;

      guest.onUpdate((snap) => {
        latestStatus = snap.status;
        latestError = snap.error;
        latestPot = snap.view?.pot ?? 0;
      });

      // Handle server error message
      guest.handleServerMessage({ type: 'error', message: 'Room expired' });
      expect(latestError).toBe('Room expired');

      // Handle server sync message
      guest.handleServerMessage({
        type: 'sync',
        snapshot: {
          role: 'guest',
          online: true,
          roomCode: 'P8888',
          status: 'Playing',
          error: null,
          mySeat: 1,
          lobby: { started: true, seats: [] },
          view: { pot: 120, hand: ['c1'], deckCount: 5 },
        },
      });
      expect(latestStatus).toBe('Playing');
      expect(latestPot).toBe(120);

      // Ignored messages
      guest.handleServerMessage(null);
      guest.handleServerMessage('random string');
      guest.handleServerMessage({ type: 'other' });

      guest.sendAction({ type: 'bid', amount: 15 });
      guest.destroy();
    });

    it('creates host and guest instances via P2PRoomTransportService factory methods', () => {
      const host = transportService.createHost<TestState, TestView, TestAction>({
        gamePrefix: 'A',
        online: false,
        initialState: { pot: 0, secretDeck: [], playerHands: {} },
        initialLobby: createTestLobby(),
        buildPlayerView: () => ({ pot: 0, hand: [], deckCount: 0 }),
        applyAction: () => {},
      });
      expect(host.role).toBe('host');
      host.destroy();

      const guest = transportService.createGuest<TestView, TestAction>({
        roomCode: 'A1234',
        guestName: 'MerlinPlayer',
      });
      expect(guest.role).toBe('guest');
      guest.destroy();
    });

    it('exposes transport service wrappers correctly', () => {
      expect(transportService.parseRoomCode('A1234').game).toBe('avalon');
      expect(transportService.generateCode('M').startsWith('M')).toBe(true);
      expect(transportService.getGuestToken('P5555').startsWith('guest_')).toBe(true);

      transportService.updateUrl('P5555', 'monopoly');
      expect(window.location.search).toContain('P5555');

      transportService.clearUrl();
      expect(window.location.search).toBe('');

      let leaveCalled = false;
      const onLeave = () => {
        leaveCalled = true;
      };
      window.addEventListener('p2p:leave', onLeave);
      transportService.dispatchLeave('P5555', 'monopoly');
      expect(leaveCalled).toBe(true);
      window.removeEventListener('p2p:leave', onLeave);
    });
  });

  describe('5. Safe P2P Connection & Reconnection Resilience', () => {
    it('sendConnSafe sends immediately when open and queues for open event when closed', () => {
      const openSent: unknown[] = [];
      const openConn = {
        open: true,
        send: (payload: unknown) => openSent.push(payload),
        on: () => {},
      };
      sendConnSafe(openConn, { type: 'ping' });
      expect(openSent.length).toBe(1);
      expect(openSent.at(0)).toEqual({ type: 'ping' });

      const queuedSent: unknown[] = [];
      const listeners = new Map<string, Array<() => void>>();
      const closedConn = {
        open: false,
        send: (payload: unknown) => queuedSent.push(payload),
        on: (ev: string, fn: (data?: unknown) => void) => {
          const arr = listeners.get(ev) ?? [];
          arr.push(fn);
          listeners.set(ev, arr);
        },
      };

      sendConnSafe(closedConn, { type: 'queued_msg' });
      expect(queuedSent.length).toBe(0);

      // Fire 'open' handler
      const openFns = listeners.get('open') ?? [];
      expect(openFns.length).toBe(1);
      openFns.at(0)?.();
      expect(queuedSent.length).toBe(1);
      expect(queuedSent.at(0)).toEqual({ type: 'queued_msg' });

      // Ensure open event does not trigger a duplicate send
      openFns.at(0)?.();
      expect(queuedSent.length).toBe(1);
    });

    it('manages signaling reconnection, visibility changes, and client connection closures', () => {
      let seatChanges = 0;
      const host = new GenericHostSession<TestState, TestView, TestAction>({
        gamePrefix: 'P',
        online: false,
        initialState: { pot: 10, secretDeck: [], playerHands: {} },
        initialLobby: createTestLobby(),
        buildPlayerView: () => ({ pot: 10, hand: [], deckCount: 0 }),
        applyAction: () => {},
        onSeatConnectedChange: () => {
          seatChanges++;
        },
      });

      // Exercise tryReconnectSignaling branches
      const hostAccess = host as unknown as {
        tryReconnectSignaling: () => void;
        peer: {
          destroyed?: boolean;
          disconnected?: boolean;
          reconnect?: () => void;
          destroy?: () => void;
        } | null;
        destroyed: boolean;
        peerConns: Map<string, { open?: boolean; send: (data: unknown) => void }>;
        broadcastAll: () => void;
      };

      // 1. No peer -> returns safely
      hostAccess.tryReconnectSignaling();

      // 2. Peer destroyed -> returns safely
      hostAccess.peer = { destroyed: true };
      hostAccess.tryReconnectSignaling();

      // 3. Peer disconnected with throwing reconnect
      let reconnectCalls = 0;
      hostAccess.peer = {
        destroyed: false,
        disconnected: true,
        reconnect: () => {
          reconnectCalls++;
          throw new Error('Signaling network down');
        },
        destroy: () => {},
      };
      hostAccess.tryReconnectSignaling();
      expect(reconnectCalls).toBe(1);

      // 4. Host destroyed -> returns safely
      hostAccess.destroyed = true;
      hostAccess.tryReconnectSignaling();
      hostAccess.destroyed = false;

      // 5. Test broadcastAll with open peer connection
      const sentPeerData: unknown[] = [];
      const dummyConn = {
        open: true,
        send: (d: unknown) => sentPeerData.push(d),
      };
      // Seat 1 is human with token 'guest_token_1'
      host.lobby.seats[1] = {
        seat: 1,
        kind: 'human',
        name: 'Guest 1',
        token: 'guest_token_1',
        connected: true,
      };
      hostAccess.peerConns.set('guest_token_1', dummyConn);
      hostAccess.broadcastAll();
      expect(sentPeerData.length).toBe(1);

      expect(seatChanges).toBe(0);
      hostAccess.peer = null;
      host.destroy();
    });

    it('exchanges messages and actions over BroadcastChannel between Host and Guest', async () => {
      const roomCode = 'P3333';
      const host = new GenericHostSession<TestState, TestView, TestAction>({
        gamePrefix: 'P',
        roomCode,
        online: true,
        initialState: { pot: 100, secretDeck: ['card1'], playerHands: {} },
        initialLobby: createTestLobby(),
        buildPlayerView: (state) => ({ pot: state.pot, hand: [], deckCount: state.secretDeck.length }),
        applyAction: (state, _seat, act) => {
          if (act.type === 'bid' && act.amount) state.pot += act.amount;
        },
      });

      const guest = new GenericGuestSession<TestView, TestAction>({
        roomCode,
        guestName: 'BcTester',
      });

      let guestLobbyPresent = false;
      let latestGuestPot = 0;
      guest.onUpdate((snap) => {
        if (snap.lobby) guestLobbyPresent = true;
        if (snap.view) latestGuestPot = snap.view.pot;
      });

      // Wait for BroadcastChannel join and sync handshake
      await new Promise<void>((r) => setTimeout(r, 80));

      expect(host.lobby.seats.at(1)?.name).toBe('BcTester');
      expect(host.lobby.seats.at(1)?.connected).toBe(true);
      expect(guestLobbyPresent).toBe(true);

      // Guest sends action over BC
      guest.sendAction({ type: 'bid', amount: 50 });
      await new Promise<void>((r) => setTimeout(r, 80));

      expect(host.state.pot).toBe(150);
      expect(latestGuestPot).toBe(150);

      guest.destroy();
      host.destroy();
    });
  });

  describe('5. Deterministic Client/Server Message Handling & Protocol Edge Cases', () => {
    it('handles host handleClientMessage join rejections (started match, room full, reconnect)', () => {
      let seatChanges = 0;
      const host = new GenericHostSession<TestState, TestView, TestAction>({
        gamePrefix: 'P',
        roomCode: 'P8888',
        online: false,
        initialState: { pot: 100, secretDeck: ['card1'], playerHands: {} },
        initialLobby: createTestLobby(),
        buildPlayerView: (state) => ({ pot: state.pot, hand: [], deckCount: state.secretDeck.length }),
        applyAction: (state, _seat, act) => {
          if (act.type === 'bid' && act.amount) state.pot += act.amount;
        },
        onSeatConnectedChange: () => {
          seatChanges++;
        },
      });

      // 1. Missing or self token -> ignored
      let replied: Record<string, unknown> | null = null;
      host.handleClientMessage({ type: 'join', token: '' }, (r) => {
        replied = r;
      });
      expect(replied).toBe(null);
      host.handleClientMessage({ type: 'join', token: host.myToken }, (r) => {
        replied = r;
      });
      expect(replied).toBe(null);

      // 2. Room started -> rejects new join
      host.lobby.started = true;
      host.handleClientMessage({ type: 'join', token: 'tok_guest_new', name: 'LateComer' }, (r) => {
        replied = r;
      });
      expect(replied).toEqual({ type: 'error', message: '游戏已经开始，无法中途加入新座位。' });
      host.lobby.started = false;

      // 3. Normal join takes open seat
      replied = null;
      host.handleClientMessage({ type: 'join', token: 'tok_seat1', name: 'SeatOne' }, (r) => {
        replied = r;
      });
      expect(host.lobby.seats.at(1)?.token).toBe('tok_seat1');
      expect(host.lobby.seats.at(1)?.name).toBe('SeatOne');
      expect(seatChanges).toBe(1);

      // 4. Reconnect with updated name
      host.handleClientMessage({ type: 'join', token: 'tok_seat1', name: 'SeatOneRenamed' }, (r) => {
        replied = r;
      });
      expect(host.lobby.seats.at(1)?.name).toBe('SeatOneRenamed');
      expect(seatChanges).toBe(2);

      // 5. Fill remaining bot seat
      host.handleClientMessage({ type: 'join', token: 'tok_seat2', name: 'SeatTwo' }, (r) => {
        replied = r;
      });
      expect(host.lobby.seats.at(2)?.token).toBe('tok_seat2');

      // 6. Room full -> rejects join
      replied = null;
      host.handleClientMessage({ type: 'join', token: 'tok_overflow', name: 'Overflow' }, (r) => {
        replied = r;
      });
      expect(replied).toEqual({ type: 'error', message: '房间座位已满！' });

      host.destroy();
    });

    it('handles action dispatch errors and state updates on host', () => {
      const host = new GenericHostSession<TestState, TestView, TestAction>({
        gamePrefix: 'P',
        roomCode: 'P9999',
        online: false,
        initialState: { pot: 100, secretDeck: ['card1'], playerHands: {} },
        initialLobby: createTestLobby(),
        buildPlayerView: (state) => ({ pot: state.pot, hand: [], deckCount: state.secretDeck.length }),
        applyAction: (_state, _seat, act) => {
          if (act.type === 'bid' && (act.amount ?? 0) < 0) {
            throw new Error('Bid amount cannot be negative');
          }
        },
      });

      // Host action dispatch error
      host.dispatchHostAction({ type: 'bid', amount: -50 });
      expect(host.error).toBe('Bid amount cannot be negative');

      // Host updateState
      host.updateState((st) => {
        st.pot = 500;
      });
      expect(host.state.pot).toBe(500);

      // Client message action from non-existent seat token -> ignored
      let replied: Record<string, unknown> | null = null;
      host.handleClientMessage({ type: 'action', token: 'tok_unknown', action: { type: 'bid', amount: 10 } }, (r) => {
        replied = r;
      });
      expect(replied).toBe(null);

      // Client message action throwing error -> replies with error
      host.lobby.seats.at(1)!.kind = 'human';
      host.lobby.seats.at(1)!.token = 'tok_human_seat1';
      host.handleClientMessage({ type: 'action', token: 'tok_human_seat1', action: { type: 'bid', amount: -100 } }, (r) => {
        replied = r;
      });
      expect(replied).toEqual({ type: 'error', message: 'Bid amount cannot be negative' });

      host.destroy();
    });

    it('handles guest handleServerMessage (error packets, non-object packets, and sync)', () => {
      const guest = new GenericGuestSession<TestView, TestAction>({
        roomCode: 'P7777',
        guestName: 'GuestTester',
      });

      // Non-object ignored
      guest.handleServerMessage('invalid string');
      guest.handleServerMessage(null);

      // Error message updates snapshot error
      guest.handleServerMessage({ type: 'error', message: 'Custom room error' });
      let currentError = '';
      guest.onUpdate((snap) => {
        currentError = snap.error ?? '';
      });
      expect(currentError).toBe('Custom room error');

      // Sync message updates snapshot
      guest.handleServerMessage({
        type: 'sync',
        snapshot: {
          role: 'host',
          roomCode: 'P7777',
          online: true,
          status: 'Synced',
          error: null,
          lobby: createTestLobby(),
          view: { pot: 333, hand: ['tile1'], deckCount: 5 },
        },
      });

      let syncedPot = 0;
      guest.onUpdate((snap) => {
        syncedPot = snap.view?.pot ?? 0;
      });
      expect(syncedPot).toBe(333);

      guest.destroy();
    });
  });
});


