import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GenericLobby, GenericSeat } from '../models/party.model';
import {
  CODE_ALPHABET,
  GenericGuestSession,
  GenericHostSession,
  P2PRoomTransportService,
  generatePrefixedRoomCode,
  parseUniversalRoomCode,
} from './p2p-room.transport';

describe('Milestone 1 Empirical Challenge: P2P Transport & Room Code Parser', () => {
  let transport: P2PRoomTransportService;

  beforeEach(() => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    transport = new P2PRoomTransportService();
  });

  afterEach(() => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  });

  interface StressState {
    counter: number;
    log: string[];
    secretDeck: string[];
  }

  interface StressView {
    counter: number;
    deckSize: number;
  }

  interface StressAction {
    type: 'increment' | 'decrement' | 'custom';
    val?: number;
  }

  function create4PlayerLobby(): GenericLobby {
    const seats: GenericSeat[] = [
      { seat: 0, kind: 'human', name: 'Host 0', token: 'host_secret_token_999', connected: true },
      { seat: 1, kind: 'open', name: 'Seat 1', token: null, connected: false },
      { seat: 2, kind: 'open', name: 'Seat 2', token: null, connected: false },
      { seat: 3, kind: 'bot', name: 'Bot 3', token: 'bot_secret_token_3', connected: true },
    ];
    return { started: false, seats, rules: { roundLimit: 20 } };
  }

  describe('Challenge 1: Universal Room Code Parser Deep-Link & Edge-Case Matrix', () => {
    it('accurately parses standard deep link URLs across all supported games', () => {
      const monopolyDeepLink = parseUniversalRoomCode('https://example.com/play?game=monopoly&room=P12345');
      expect(monopolyDeepLink.game).toBe('monopoly');
      expect(monopolyDeepLink.roomCode).toBe('P12345');

      const avalonDeepLink = parseUniversalRoomCode('https://domain.org/?game=avalon&room=A88888');
      expect(avalonDeepLink.game).toBe('avalon');
      expect(avalonDeepLink.roomCode).toBe('A88888');

      const mahjongDeepLink = parseUniversalRoomCode('https://domain.org/mahjong/table?game=mahjong&room=M99999');
      expect(mahjongDeepLink.game).toBe('mahjong');
      expect(mahjongDeepLink.roomCode).toBe('M99999');
    });

    it('infers game from room prefix when game parameter is omitted', () => {
      const monopolyFromPrefix = parseUniversalRoomCode('?room=P98765');
      expect(monopolyFromPrefix.game).toBe('monopoly');
      expect(monopolyFromPrefix.roomCode).toBe('P98765');

      const avalonFromPrefix = parseUniversalRoomCode('?room=A54321');
      expect(avalonFromPrefix.game).toBe('avalon');
      expect(avalonFromPrefix.roomCode).toBe('A54321');

      const mahjongFromPrefix = parseUniversalRoomCode('?room=M11111');
      expect(mahjongFromPrefix.game).toBe('mahjong');
      expect(mahjongFromPrefix.roomCode).toBe('M11111');
    });

    it('handles raw code entry with mixed case and whitespace', () => {
      expect(parseUniversalRoomCode('p12345')).toEqual({ game: 'monopoly', roomCode: 'P12345' });
      expect(parseUniversalRoomCode('  a88888  ')).toEqual({ game: 'avalon', roomCode: 'A88888' });
      expect(parseUniversalRoomCode('m99999')).toEqual({ game: 'mahjong', roomCode: 'M99999' });
      expect(parseUniversalRoomCode('P 1 2 3 4')).toEqual({ game: 'monopoly', roomCode: 'P1234' });
    });

    it('accurately normalizes lowercase prefix in URL query param to uppercase and resolves game', () => {
      // For raw input 'p12345':
      const rawResult = parseUniversalRoomCode('p12345');
      expect(rawResult.game).toBe('monopoly');
      expect(rawResult.roomCode).toBe('P12345');

      // For URL query param '?room=p12345':
      const urlResult = parseUniversalRoomCode('?room=p12345');
      expect(urlResult.game).toBe('monopoly');
      expect(urlResult.roomCode).toBe('P12345');

      // For URL query param '?room=a55555':
      const avalonUrlResult = parseUniversalRoomCode('?room=a55555');
      expect(avalonUrlResult.game).toBe('avalon');
      expect(avalonUrlResult.roomCode).toBe('A55555');
    });

    it('documents uppercase normalization behavior for lowercase prefix in URL query param', () => {
      const lowercaseUrlParam = parseUniversalRoomCode('?room=p12345');
      expect(lowercaseUrlParam.game).toBe('monopoly');
      expect(lowercaseUrlParam.roomCode).toBe('P12345');
    });

    it('enforces maximum 8-character room code truncation', () => {
      const longCode = parseUniversalRoomCode('P12345678999999');
      expect(longCode.roomCode.length).toBe(8);
      expect(longCode.roomCode).toBe('P1234567');
    });

    it('validates generated room codes adhere to CODE_ALPHABET and prefix', () => {
      for (let i = 0; i < 50; i++) {
        const code = generatePrefixedRoomCode('P', 5);
        expect(code.length).toBe(6);
        expect(code.startsWith('P')).toBe(true);
        for (let c = 1; c < code.length; c++) {
          expect(CODE_ALPHABET.includes(code.charAt(c))).toBe(true);
        }
      }
    });
  });

  describe('Challenge 2: Concurrent Guest Connections & Seat Reassignment', () => {
    it('concurrently connects 3 guests and correctly assigns available seats', () => {
      let state = { counter: 0, log: [], secretDeck: ['card1', 'card2'] };
      const connectionEvents: Array<{ seat: number; connected: boolean }> = [];

      const host = new GenericHostSession<StressState, StressView, StressAction>({
        gamePrefix: 'P',
        online: false,
        initialState: state,
        initialLobby: create4PlayerLobby(),
        buildPlayerView: (s) => ({ counter: s.counter, deckSize: s.secretDeck.length }),
        applyAction: (s, seatIdx, act) => {
          if (act.type === 'increment') s.counter += act.val ?? 1;
        },
        onSeatConnectedChange: (seat, connected) => connectionEvents.push({ seat, connected }),
      });

      const guestReplies: Record<string, unknown[]> = { g1: [], g2: [], g3: [], g4: [] };

      // Concurrent join from Guest 1 and Guest 2
      host.handleClientMessage({ type: 'join', token: 'guest_token_1', name: 'Alice' }, (r) =>
        guestReplies['g1']!.push(r)
      );
      host.handleClientMessage({ type: 'join', token: 'guest_token_2', name: 'Bob' }, (r) =>
        guestReplies['g2']!.push(r)
      );

      // Both open seats (1 and 2) are now occupied
      expect(host.lobby.seats.at(1)?.name).toBe('Alice');
      expect(host.lobby.seats.at(1)?.token).toBe('guest_token_1');
      expect(host.lobby.seats.at(1)?.connected).toBe(true);

      expect(host.lobby.seats.at(2)?.name).toBe('Bob');
      expect(host.lobby.seats.at(2)?.token).toBe('guest_token_2');
      expect(host.lobby.seats.at(2)?.connected).toBe(true);

      // Guest 3 joins -> replaces Seat 3 (Bot)
      host.handleClientMessage({ type: 'join', token: 'guest_token_3', name: 'Charlie' }, (r) =>
        guestReplies['g3']!.push(r)
      );
      expect(host.lobby.seats.at(3)?.name).toBe('Charlie');
      expect(host.lobby.seats.at(3)?.kind).toBe('human');
      expect(host.lobby.seats.at(3)?.connected).toBe(true);

      // Guest 4 joins -> rejected since room is full
      host.handleClientMessage({ type: 'join', token: 'guest_token_4', name: 'Dave' }, (r) =>
        guestReplies['g4']!.push(r)
      );
      expect(guestReplies['g4']!.length).toBe(1);
      expect(guestReplies['g4']!.at(0)).toEqual({ type: 'error', message: '房间座位已满！' });

      // Guest 2 disconnects -> Seat 2 marked disconnected
      const seat2 = host.lobby.seats.at(2);
      if (seat2) {
        seat2.connected = false;
        (host as unknown as { onSeatConnectedChange?: (seat: number, connected: boolean) => void }).onSeatConnectedChange?.(
          2,
          false
        );
      }
      expect(host.lobby.seats.at(2)?.connected).toBe(false);

      // Guest 2 reconnects with same token -> Seat 2 restored
      host.handleClientMessage({ type: 'join', token: 'guest_token_2', name: 'Bob Back' }, (r) =>
        guestReplies['g2']!.push(r)
      );
      expect(host.lobby.seats.at(2)?.connected).toBe(true);
      expect(host.lobby.seats.at(2)?.name).toBe('Bob Back');

      host.destroy();
    });

    it('rejects mid-game joins when match has started', () => {
      const host = new GenericHostSession<StressState, StressView, StressAction>({
        gamePrefix: 'P',
        online: false,
        initialState: { counter: 0, log: [], secretDeck: [] },
        initialLobby: create4PlayerLobby(),
        buildPlayerView: () => ({ counter: 0, deckSize: 0 }),
        applyAction: () => {},
      });

      host.lobby.started = true;
      const replies: unknown[] = [];
      host.handleClientMessage({ type: 'join', token: 'guest_late', name: 'Late' }, (r) => replies.push(r));

      expect(replies.length).toBe(1);
      expect(replies.at(0)).toEqual({
        type: 'error',
        message: '游戏已经开始，无法中途加入新座位。',
      });

      host.destroy();
    });
  });

  describe('Challenge 3: Anti-Cheat Token Sanitization Isolation', () => {
    it('strictly strips tokens to null in all host and guest session snapshots', () => {
      const host = new GenericHostSession<StressState, StressView, StressAction>({
        gamePrefix: 'A',
        online: false,
        token: 'host_super_private_token_xyz',
        initialState: { counter: 10, log: [], secretDeck: ['cardA', 'cardB'] },
        initialLobby: create4PlayerLobby(),
        buildPlayerView: (s, seatIdx) => ({ counter: s.counter, deckSize: s.secretDeck.length }),
        applyAction: () => {},
      });

      // Join guest with private token
      host.handleClientMessage({ type: 'join', token: 'guest_secret_token_123', name: 'Spy' }, () => {});

      // Verify Host Snapshot (Seat 0)
      const hostSnap = host.buildSnapshotForSeat(0);
      expect(hostSnap.role).toBe('host');
      for (const seat of hostSnap.lobby!.seats) {
        expect(seat.token).toBe(null);
      }

      // Verify Guest Snapshot (Seat 1)
      const guestSnap = host.buildSnapshotForSeat(1);
      expect(guestSnap.role).toBe('guest');
      for (const seat of guestSnap.lobby!.seats) {
        expect(seat.token).toBe(null);
      }

      // Verify Guest Snapshot (Seat 2)
      const guest2Snap = host.buildSnapshotForSeat(2);
      expect(guest2Snap.role).toBe('guest');
      for (const seat of guest2Snap.lobby!.seats) {
        expect(seat.token).toBe(null);
      }

      host.destroy();
    });
  });

  describe('Challenge 4: Dual-Channel Message Serialization & Execution Behavior', () => {
    it('analyzes action dispatch behavior when both conn and BroadcastChannel are used', async () => {
      const roomCode = 'P7788';
      let actionExecCount = 0;

      const host = new GenericHostSession<StressState, StressView, StressAction>({
        gamePrefix: 'P',
        roomCode,
        online: true,
        initialState: { counter: 0, log: [], secretDeck: [] },
        initialLobby: create4PlayerLobby(),
        buildPlayerView: (s) => ({ counter: s.counter, deckSize: 0 }),
        applyAction: (s, _seat, act) => {
          actionExecCount++;
          if (act.type === 'increment') s.counter += act.val ?? 1;
        },
      });

      const guest = new GenericGuestSession<StressView, StressAction>({
        roomCode,
        guestName: 'DualChannelTester',
      });

      // Wait for BroadcastChannel join handshake
      await new Promise<void>((r) => setTimeout(r, 80));

      expect(host.lobby.seats.at(1)?.name).toBe('DualChannelTester');

      // Dispatch single action from guest
      guest.sendAction({ type: 'increment', val: 5 });
      await new Promise<void>((r) => setTimeout(r, 80));

      // Over BroadcastChannel alone, action runs exactly once
      expect(actionExecCount).toBe(1);
      expect(host.state.counter).toBe(5);

      guest.destroy();
      host.destroy();
    });

    it('prevents duplicate action execution when both WebRTC conn and BroadcastChannel are active (sends via active conn only)', async () => {
      const roomCode = 'P9900';
      let actionExecCount = 0;

      const host = new GenericHostSession<StressState, StressView, StressAction>({
        gamePrefix: 'P',
        roomCode,
        online: true,
        initialState: { counter: 0, log: [], secretDeck: [] },
        initialLobby: create4PlayerLobby(),
        buildPlayerView: (s) => ({ counter: s.counter, deckSize: 0 }),
        applyAction: (s, _seat, act) => {
          actionExecCount++;
          if (act.type === 'increment') s.counter += act.val ?? 1;
        },
      });

      const guest = new GenericGuestSession<StressView, StressAction>({
        roomCode,
        guestName: 'DualActiveTester',
      });

      // Wait for BroadcastChannel join handshake
      await new Promise<void>((r) => setTimeout(r, 80));

      // Simulate WebRTC connection becoming active on guest
      const fakeConnToHost = {
        open: true,
        send: (payload: unknown) => {
          // WebRTC data packet arriving at Host
          host.handleClientMessage(payload as Record<string, unknown>, () => {});
        },
        on: () => {},
      };

      (guest as unknown as { conn: typeof fakeConnToHost }).conn = fakeConnToHost;

      // Guest sends a SINGLE action
      guest.sendAction({ type: 'increment', val: 1 });
      await new Promise<void>((r) => setTimeout(r, 80));

      // VERIFICATION:
      // Host's applyAction executed exactly ONCE via active conn without duplicate bc message
      expect(actionExecCount).toBe(1);
      expect(host.state.counter).toBe(1);

      guest.destroy();
      host.destroy();
    });

    it('safely handles non-existent or corrupted messages in handleClientMessage', () => {
      const host = new GenericHostSession<StressState, StressView, StressAction>({
        gamePrefix: 'P',
        online: false,
        initialState: { counter: 0, log: [], secretDeck: [] },
        initialLobby: create4PlayerLobby(),
        buildPlayerView: () => ({ counter: 0, deckSize: 0 }),
        applyAction: () => {},
      });

      const replies: unknown[] = [];
      const replyFn = (r: Record<string, unknown>) => replies.push(r);

      // Malformed: missing token
      host.handleClientMessage({ type: 'join', name: 'NoToken' }, replyFn);
      expect(replies.length).toBe(0);

      // Malformed: empty token
      host.handleClientMessage({ type: 'join', token: '', name: 'EmptyToken' }, replyFn);
      expect(replies.length).toBe(0);

      // Malformed: host's own token impersonated
      host.handleClientMessage({ type: 'join', token: host.myToken, name: 'Imposter' }, replyFn);
      expect(replies.length).toBe(0);

      // Malformed: unknown message type
      host.handleClientMessage({ type: 'unknown_type', token: 'random_tok' }, replyFn);
      expect(replies.length).toBe(0);

      // Malformed: action from unknown token (not seated)
      host.handleClientMessage(
        { type: 'action', token: 'unknown_tok', action: { type: 'increment' } },
        replyFn
      );
      expect(replies.length).toBe(0);

      host.destroy();
    });
  });
});
