import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import {
  GuestSession,
  HostSession,
  MahjongSessionService,
  PeerConnectionLike,
  PeerConstructorLike,
  PeerInstanceLike,
  extractRoomCode,
  generateRoomCode,
  getPlayerToken,
} from './mahjong-session.service';
import { DEFAULT_RULES } from './scorer.service';

function restoreProp(target: object, key: string, desc: PropertyDescriptor | undefined): void {
  if (desc) {
    Object.defineProperty(target, key, desc);
  } else {
    Reflect.deleteProperty(target, key);
  }
}

describe('MahjongSessionService & Host/Guest P2P Sync', () => {
  it('extracts room codes from invite URLs, isolates Host/Guest tokens across tabs, and syncs seats', async () => {
    expect(generateRoomCode(6).length).toBe(6);
    expect(generateRoomCode().startsWith('M')).toBe(true);
    expect(getPlayerToken().length).toBeGreaterThan(3);
    expect(extractRoomCode('  hk8x4 ')).toBe('HK8X4');
    expect(extractRoomCode('https://planta94.github.io/mahjong/?room=ab92z')).toBe('AB92Z');
    expect(extractRoomCode('https://planta94.github.io/mahjong/lobby?foo=1&room=xy77k')).toBe(
      'XY77K'
    );

    // Simulate duplicated tab where sessionStorage already has hkmj_player_token
    sessionStorage.setItem('hkmj_player_token', 'shared_tab_token');

    const host = new HostSession({
      hostName: 'HostA',
      mode: '3p',
      online: true,
      fillBots: false,
    });
    expect(host.myToken).not.toBe('shared_tab_token');

    // Open seats prevent startGame
    expect(host.startGame()).toBe(false);
    expect(host.error?.includes('空位')).toBe(true);

    // Toggle seat 2 to bot, leave seat 1 open for guest
    host.toggleSeatBot(2);
    expect(host.lobby.seats.at(2)?.kind).toBe('bot');

    // Guest joins without explicit token (uses room-scoped guest token, never colliding with host)
    const guest = new GuestSession({
      roomCode: `https://planta94.github.io/mahjong/?room=${host.roomCode}`,
      guestName: 'FriendB',
    });

    await new Promise<void>((r) => setTimeout(r, 80));
    expect(host.lobby.seats.at(1)?.name).toBe('FriendB');

    // A second guest can even replace a Bot seat before match start
    const guest2 = new GuestSession({
      roomCode: host.roomCode,
      guestName: 'FriendC',
      token: 'tok_guest_2',
    });
    await new Promise<void>((r) => setTimeout(r, 80));
    expect(host.lobby.seats.at(2)?.name).toBe('FriendC');

    // Mode switching preserves seated human guests
    host.setMode('4p');
    expect(host.lobby.seats.length).toBe(4);
    expect(host.lobby.seats.at(1)?.name).toBe('FriendB');
    expect(host.lobby.seats.at(2)?.name).toBe('FriendC');
    host.toggleSeatBot(3);

    host.updateRules({ minFan: 7, maxFan: 5 });
    expect(host.lobby.rules.maxFan).toBe(7);

    // Start game and verify guest receives sanitized view
    let guestSeatSeen = -1;
    guest.onUpdate((snap) => {
      guestSeatSeen = snap.mySeat;
    });
    expect(host.startGame()).toBe(true);
    await new Promise<void>((r) => setTimeout(r, 80));
    expect(guestSeatSeen).toBe(1);

    // Return to lobby
    host.returnToLobby();
    expect(host.lobby.started).toBe(false);

    guest2.destroy();
    guest.destroy();
    host.destroy();
  });

  it('manages solo & online sessions, autoPass, penalty buzzer, and dispatches mahjong:leave', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
    const svc = TestBed.inject(MahjongSessionService);

    let leaveFired = false;
    const listener = () => {
      leaveFired = true;
    };
    window.addEventListener('mahjong:leave', listener);

    svc.startSolo('Tester', '3p', DEFAULT_RULES);
    expect(svc.snapshot()?.lobby?.seats.length).toBe(3);
    expect(svc.snapshot()?.view?.numSeats).toBe(3);

    svc.toggleAutoPass(true);
    expect(svc.autoPass()).toBe(true);
    svc.toggleAutoPass(false);
    expect(svc.autoPass()).toBe(false);
    svc.playPenaltyBuzzer();

    const firstTile = svc.snapshot()?.view?.players.at(0)?.hand?.at(0) ?? '';
    svc.sendAction({ type: 'discard', tileId: firstTile });
    expect(svc.snapshot()?.view?.players.at(0)?.discards.length).toBeGreaterThanOrEqual(0);

    svc.leaveSession();
    expect(svc.snapshot()).toBeNull();
    expect(leaveFired).toBe(true);

    svc.createOnlineRoom('HostUser', '4p', DEFAULT_RULES);
    expect(svc.snapshot()?.lobby?.seats.length).toBe(4);
    svc.setLobbyMode('3p');
    expect(svc.snapshot()?.lobby?.seats.length).toBe(3);
    svc.updateLobbyRules({ minFan: 3, concealedFan: false });
    expect(svc.snapshot()?.lobby?.rules.minFan).toBe(3);
    svc.toggleSeatBot(1);
    svc.toggleSeatBot(2);
    expect(svc.snapshot()?.lobby?.seats.at(1)?.kind).toBe('bot');
    svc.startMatch();
    expect(svc.snapshot()?.view?.phase).toBe('turn');

    svc.speakCallout('碰');
    void svc.copyInviteLink();
    svc.returnToLobby();
    expect(svc.snapshot()?.view).toBeNull();
    svc.leaveSession();

    svc.joinOnlineRoom('https://planta94.github.io/mahjong/?room=ROOM9', 'GuestTester');
    expect(svc.snapshot()?.roomCode).toBe('ROOM9');
    svc.leaveSession();

    window.removeEventListener('mahjong:leave', listener);
  });

  it('covers HostSession client message protocol, error handling, rule clamping, and hand transitions', () => {
    const host = new HostSession({
      hostName: 'HostPlayer',
      mode: '3p',
      online: true,
      fillBots: false,
      rules: { minFan: 3, maxFan: 10 },
    });

    const privHost = host as unknown as {
      handleClientMessage: (
        msg: Record<string, unknown>,
        replyFn: (reply: Record<string, unknown>) => void
      ) => void;
      match: { phase: string } | null;
      buildSnapshotForSeat: (seatIdx: number) => unknown;
    };

    let replyMsg: Record<string, unknown> | null = null;
    const replyFn = (reply: Record<string, unknown>) => {
      replyMsg = reply;
    };

    // 1. Missing token or self-token
    privHost.handleClientMessage({ type: 'join' }, replyFn);
    expect(replyMsg).toBeNull();

    privHost.handleClientMessage({ type: 'join', token: host.myToken }, replyFn);
    expect(replyMsg).toBeNull();

    // 2. Client join filling open seat 1
    privHost.handleClientMessage({ type: 'join', token: 'guest_seat_1', name: 'GuestOne' }, replyFn);
    expect(host.lobby.seats.at(1)?.name).toBe('GuestOne');
    expect(host.lobby.seats.at(1)?.connected).toBe(true);

    // 3. Client join with existing token updates name and reconnects
    privHost.handleClientMessage({ type: 'join', token: 'guest_seat_1', name: 'GuestOneRenamed' }, replyFn);
    expect(host.lobby.seats.at(1)?.name).toBe('GuestOneRenamed');

    // 4. Client join filling bot/open seat 2
    host.toggleSeatBot(2);
    expect(host.lobby.seats.at(2)?.kind).toBe('bot');
    privHost.handleClientMessage({ type: 'join', token: 'guest_seat_2', name: 'GuestTwo' }, replyFn);
    expect(host.lobby.seats.at(2)?.kind).toBe('human');
    expect(host.lobby.seats.at(2)?.name).toBe('GuestTwo');

    // 5. Client join when room is full (all 3 seats occupied by humans)
    replyMsg = null;
    privHost.handleClientMessage({ type: 'join', token: 'guest_extra', name: 'Latecomer' }, replyFn);
    expect(replyMsg).toEqual({ type: 'error', message: '房间座位已满！请房主释放座位。' });

    // 6. Start game and test late join rejection
    expect(host.startGame()).toBe(true);
    replyMsg = null;
    privHost.handleClientMessage({ type: 'join', token: 'guest_during_game', name: 'Stranger' }, replyFn);
    expect(replyMsg).toEqual({ type: 'error', message: '牌局已经开始，无法中途加入新座位。' });

    // 7. Client action from unrecognized token
    replyMsg = null;
    privHost.handleClientMessage(
      { type: 'action', token: 'unrecognized_tok', action: { type: 'pass' } },
      replyFn
    );
    expect(replyMsg).toBeNull();

    // 8. Client action throwing invalid action error
    privHost.handleClientMessage(
      { type: 'action', token: 'guest_seat_1', action: { type: 'discard', tileId: 'nonexistent_tile' } },
      replyFn
    );
    const errReply = replyMsg as { type?: string; message?: string } | null;
    expect(typeof errReply?.message).toBe('string');

    // 9. Host sendAction failure
    host.sendAction({ type: 'discard', tileId: 'invalid_host_tile' });
    expect(typeof host.error).toBe('string');

    // 10. toggleSeatBot edge cases
    host.toggleSeatBot(0);
    expect(host.lobby.seats.at(0)?.kind).toBe('human');
    host.toggleSeatBot(1);
    expect(host.lobby.seats.at(1)?.kind).toBe('human');
    host.toggleSeatBot(99);

    // 11. setMode & updateRules when match is started
    host.setMode('4p');
    expect(host.lobby.mode).toBe('3p');
    host.updateRules({ minFan: 10 });
    expect(host.lobby.rules.minFan).toBe(3);

    // 12. nextHand transition
    host.nextHand();
    expect(host.match?.phase).toBe('turn');

    if (privHost.match) {
      privHost.match.phase = 'handOver';
      host.nextHand();
      expect(host.match?.phase).toBe('turn');
    }

    // 13. returnToLobby and rule maxFan clamping
    host.returnToLobby();
    expect(host.lobby.started).toBe(false);
    expect(host.match).toBeNull();

    host.updateRules({ minFan: 8, maxFan: 3 });
    expect(host.lobby.rules.maxFan).toBe(8);

    host.destroy();
  });

  it('handles GuestSession broadcast messages, action payloads, and MahjongSessionService helpers', async () => {
    const guest = new GuestSession({
      roomCode: 'TEST99',
      guestName: 'GuestAlice',
      token: 'tok_alice_123',
    });

    const privGuest = guest as unknown as {
      bc: { onmessage?: (ev: MessageEvent) => void } | null;
      snapshot: { error: string | null; status: string; mySeat: number };
    };

    // 1. Send action posts to broadcast channel
    guest.sendAction({ type: 'pass' });

    // 2. Simulate BC message not for guest
    privGuest.bc?.onmessage?.(new MessageEvent('message', { data: { to: 'host' } }));
    expect(privGuest.snapshot.error).toBeNull();

    // 3. Simulate BC message targeting different token
    privGuest.bc?.onmessage?.(
      new MessageEvent('message', {
        data: { to: 'guest', targetToken: 'different_token', type: 'error', message: '錯' },
      })
    );
    expect(privGuest.snapshot.error).toBeNull();

    // 4. Simulate BC error message targeting this guest
    privGuest.bc?.onmessage?.(
      new MessageEvent('message', {
        data: {
          to: 'guest',
          targetToken: 'tok_alice_123',
          type: 'error',
          message: '房間座位已滿！',
        },
      })
    );
    expect(privGuest.snapshot.error).toBe('房間座位已滿！');

    // 5. Simulate BC sync message updating snapshot
    privGuest.bc?.onmessage?.(
      new MessageEvent('message', {
        data: {
          to: 'guest',
          targetToken: 'tok_alice_123',
          type: 'sync',
          snapshot: {
            role: 'guest',
            online: true,
            roomCode: 'TEST99',
            status: '已連線至房間 TEST99',
            error: null,
            mySeat: 2,
            lobby: null,
            view: null,
          },
        },
      })
    );
    expect(privGuest.snapshot.mySeat).toBe(2);
    expect(privGuest.snapshot.error).toBeNull();

    guest.destroy();

    // MahjongSessionService helpers
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
    const svc = TestBed.inject(MahjongSessionService);

    svc.startSolo('SoloTester', '3p', DEFAULT_RULES);
    expect(svc.waitingTiles().length).toBeGreaterThanOrEqual(0);

    svc.playClack(500);
    svc.toggleBgm();
    svc.toggleBgm();
    svc.speakCallout('自摸');
    svc.speakCallout('錯章');

    await svc.copyInviteLink();
    svc.nextHand();
    svc.leaveSession();
  });

  it('triggers audio cues on log changes and autoPass timer on claim phase', () => {
    vi.useFakeTimers();
    try {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter(routes)],
      });
      const svc = TestBed.inject(MahjongSessionService);

      let lastAction: unknown = null;
      const listenerRef: { current?: (snap: unknown) => void } = {};
      const fakeSession = {
        role: 'host' as const,
        online: false,
        roomCode: 'LOCAL',
        mySeat: 0,
        destroy: vi.fn(),
        onUpdate: (fn: (snap: unknown) => void) => {
          listenerRef.current = fn;
          return () => undefined;
        },
        sendAction: (act: unknown) => {
          lastAction = act;
        },
      };

      const privSvc = svc as unknown as {
        attach: (session: unknown) => void;
      };
      privSvc.attach(fakeSession);

      svc.toggleAutoPass(true);
      expect(svc.autoPass()).toBe(true);

      const logsToTest = [
        '⚠️ 詐糊 扣分',
        '⚠️ 錯章 罰分',
        '自摸！大三元',
        '食糊！清一色',
        '暗槓 筒子',
        '碰 一筒',
        '上 二三四筒',
        '打飛 萬能牌',
        '換飛 成功',
        '普通摸牌',
      ];

      for (const logMsg of logsToTest) {
        listenerRef.current?.({
          role: 'host',
          online: false,
          roomCode: 'LOCAL',
          mySeat: 0,
          lobby: null,
          view: {
            phase: 'turn',
            viewerSeat: 0,
            numSeats: 3,
            players: [],
            log: [logMsg],
            legalActions: null,
          },
        });
      }

      // Claim phase triggers autoPass timer
      listenerRef.current?.({
        role: 'host',
        online: false,
        roomCode: 'LOCAL',
        mySeat: 0,
        lobby: null,
        view: {
          phase: 'claim',
          viewerSeat: 0,
          numSeats: 3,
          players: [],
          log: ['進張'],
          legalActions: { phase: 'claim', pass: true, claims: [] },
        },
      });

      vi.advanceTimersByTime(200);
      expect(lastAction).toEqual({ type: 'pass' });

      // handOver resets autoPass and selectionPaused
      listenerRef.current?.({
        role: 'host',
        online: false,
        roomCode: 'LOCAL',
        mySeat: 0,
        lobby: null,
        view: {
          phase: 'handOver',
          viewerSeat: 0,
          numSeats: 3,
          players: [],
          log: ['手牌結算'],
          legalActions: null,
        },
      });
      expect(svc.autoPass()).toBe(false);

      svc.leaveSession();
    } finally {
      vi.useRealTimers();
    }
  });

  it('exercises HostSession WebRTC peerConns, sendConnSafe queueing, signaling reconnect, visibility cleanup, and BroadcastChannel replies', async () => {
    expect(extractRoomCode('   ')).toBe('');

    const storageSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('storage blocked');
    });
    const fallbackTok = getPlayerToken();
    expect(fallbackTok.startsWith('tok_')).toBe(true);
    storageSpy.mockRestore();

    const defaultHost = new HostSession({ hostName: '' });
    expect(defaultHost.lobby.seats.at(0)?.name).toBe('房主');
    expect(defaultHost.lobby.mode).toBe('4p');
    defaultHost.sendAction({ type: 'pass' });
    expect(defaultHost.match).toBeNull();

    // Toggle seat 1 open -> bot -> open
    defaultHost.toggleSeatBot(1);
    expect(defaultHost.lobby.seats.at(1)?.kind).toBe('bot');
    defaultHost.toggleSeatBot(1);
    expect(defaultHost.lobby.seats.at(1)?.kind).toBe('open');

    // Mode switch when all non-host seats are bots preserves bot fill
    for (let i = 1; i < 4; i++) defaultHost.toggleSeatBot(i);
    defaultHost.setMode('3p');
    expect(defaultHost.lobby.seats.every((s, idx) => (idx === 0 ? s.kind === 'human' : s.kind === 'bot'))).toBe(true);
    defaultHost.setMode('4p');
    expect(defaultHost.lobby.seats.at(3)?.kind).toBe('bot');

    // Mode switch 4p -> 3p when 3 human guests were seated truncates cleanly to 2 guest slots
    const privDefaultHost = defaultHost as unknown as {
      handleClientMessage: (
        msg: Record<string, unknown>,
        replyFn: (reply: Record<string, unknown>) => void
      ) => void;
    };
    privDefaultHost.handleClientMessage({ type: 'join', token: 'h1', name: '   ' }, () => undefined);
    expect(defaultHost.lobby.seats.at(1)?.name).toBe('雀友 2');
    privDefaultHost.handleClientMessage({ type: 'join', token: 'h1', name: '   ' }, () => undefined);
    expect(defaultHost.lobby.seats.at(1)?.name).toBe('雀友 2');
    privDefaultHost.handleClientMessage({ type: 'join', token: 'h2', name: 'Human2' }, () => undefined);
    privDefaultHost.handleClientMessage({ type: 'join', token: 'h3', name: 'Human3' }, () => undefined);
    defaultHost.setMode('3p');
    expect(defaultHost.lobby.seats.length).toBe(3);
    defaultHost.destroy();

    // Online HostSession with BroadcastChannel error reply, peerConns (open + queued), and reconnect/visibility
    const onlineHost = new HostSession({
      hostName: 'OnlineMaster',
      mode: '3p',
      online: true,
      fillBots: true,
    });
    await new Promise<void>((r) => setTimeout(r, 30));

    const openSent: unknown[] = [];
    const queuedSent: unknown[] = [];
    const queuedOpenCbs: Array<() => void> = [];

    interface MockPeerConn {
      open: boolean;
      send: (payload: unknown) => void;
      on: (ev: string, cb: () => void) => void;
    }

    const openConn: MockPeerConn = {
      open: true,
      send: (payload: unknown) => {
        openSent.push(payload);
      },
      on: () => undefined,
    };
    const closedConn: MockPeerConn = {
      open: false,
      send: (payload: unknown) => {
        queuedSent.push(payload);
      },
      on: (ev: string, cb: () => void) => {
        if (ev === 'open') queuedOpenCbs.push(cb);
      },
    };

    const privOnline = onlineHost as unknown as {
      peerConns: Map<string, MockPeerConn>;
      broadcastAll: () => void;
      tryReconnectSignaling: () => void;
      visibilityHandler: (() => void) | null;
      peer: {
        destroyed?: boolean;
        disconnected?: boolean;
        reconnect?: () => void;
        destroy: () => void;
      } | null;
      destroyed: boolean;
    };

    onlineHost.lobby.seats.splice(1, 1, {
      seat: 1,
      kind: 'human',
      name: 'PeerOpen',
      token: 'tok_peer_open',
      connected: true,
      windLabel: '南',
    });
    onlineHost.lobby.seats.splice(2, 1, {
      seat: 2,
      kind: 'human',
      name: 'PeerQueued',
      token: 'tok_peer_queued',
      connected: true,
      windLabel: '西',
    });
    privOnline.peerConns.set('tok_peer_open', openConn);
    privOnline.peerConns.set('tok_peer_queued', closedConn);

    privOnline.broadcastAll();
    expect(openSent.length).toBe(1);
    expect(queuedSent.length).toBe(0);
    expect(queuedOpenCbs.length).toBe(1);

    queuedOpenCbs.at(0)?.();
    queuedOpenCbs.at(0)?.();
    expect(queuedSent.length).toBe(1);

    // Start match and verify BroadcastChannel replyFn sends late-join error to guest
    expect(onlineHost.startGame()).toBe(true);
    const guestBc = new BroadcastChannel(`hkmj-bc-${onlineHost.roomCode}`);
    let bcReply: Record<string, unknown> | null = null;
    guestBc.onmessage = (ev: MessageEvent) => {
      const data = ev.data as Record<string, unknown>;
      if (data['to'] === 'guest' && data['targetToken'] === 'late_bc_guest') {
        bcReply = data;
      }
    };
    guestBc.postMessage({ type: 'join', token: 'late_bc_guest', name: 'LateBC' });
    await new Promise<void>((r) => setTimeout(r, 40));
    expect(bcReply?.['type']).toBe('error');
    guestBc.close();

    // Exercise tryReconnectSignaling and visibilitychange cleanup on destroy
    privOnline.tryReconnectSignaling();
    privOnline.peer = { destroyed: true, destroy: () => undefined };
    privOnline.tryReconnectSignaling();

    let reconnectAttempts = 0;
    privOnline.peer = {
      destroyed: false,
      disconnected: true,
      reconnect: () => {
        reconnectAttempts++;
        if (reconnectAttempts === 2) throw new Error('transient signaling error');
      },
      destroy: () => undefined,
    };
    privOnline.tryReconnectSignaling();
    privOnline.tryReconnectSignaling();
    expect(reconnectAttempts).toBe(2);

    let visCalls = 0;
    const visFn = () => {
      visCalls++;
    };
    privOnline.visibilityHandler = visFn;
    document.addEventListener('visibilitychange', visFn);

    onlineHost.destroy();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(visCalls).toBe(0);
    expect(privOnline.visibilityHandler).toBeNull();
  });

  it('drives HostSession scheduleBots across bot turn, pass-only claim, winning claim, and robKong timers', () => {
    vi.useFakeTimers();
    try {
      const host = new HostSession({
        hostName: 'SoloDriver',
        mode: '3p',
        online: false,
        fillBots: true,
      });
      expect(host.startGame()).toBe(true);

      const privHost = host as unknown as {
        scheduleBots: () => void;
      };

      // 1. Turn mismatch guard before bot turn timer fires
      const match = host.match!;
      match.phase = 'turn';
      match.turnSeat = 1;
      match.canSelfAct = false;
      const p1 = match.players.at(1)!;
      if (p1.hand.length % 3 !== 2) {
        p1.hand.push('we_3');
      }
      privHost.scheduleBots();
      match.turnSeat = 0;
      vi.advanceTimersByTime(400);
      expect(match.turnSeat).toBe(0);

      // 2. Real bot turn discard execution after 380ms
      match.turnSeat = 1;
      const discardsBefore = p1.discards.length;
      privHost.scheduleBots();
      vi.advanceTimersByTime(400);
      expect(p1.discards.length).toBe(discardsBefore + 1);

      // 3. Bot claim phase where all bots pass (90ms fast delay)
      match.phase = 'claim';
      match.lastDiscard = { seat: 0, tileId: 'we_0' };
      match.pendingClaims = {
        fromSeat: 0,
        tileId: 'we_0',
        bySeat: new Map([
          [1, { winEval: null, canKong: false, canPong: false, chows: [], decision: null }],
          [2, { winEval: null, canKong: false, canPong: false, chows: [], decision: null }],
        ]),
      };
      privHost.scheduleBots();
      vi.advanceTimersByTime(110);
      expect(match.pendingClaims).toBeNull();

      // 4. Bot claim phase where seat 1 bot has a valid 5+ fan winning claim (340ms claim delay)
      p1.melds = [];
      p1.bonus = [];
      p1.hand = [
        'p1_0', 'p1_1', 'p1_2',
        'p2_0', 'p3_0', 'p4_0',
        'p5_0', 'p6_0', 'p7_0',
        'p8_0', 'p8_1', 'p8_2',
        'p9_0',
      ];
      match.phase = 'claim';
      match.lastDiscard = { seat: 0, tileId: 'p9_1' };
      match.pendingClaims = {
        fromSeat: 0,
        tileId: 'p9_1',
        bySeat: new Map([
          [
            1,
            {
              winEval: {
                isShapeValid: true,
                canWin: true,
                rawFan: 8,
                cappedFan: 8,
                items: [{ name: '清一色', fan: 7 }, { name: '無花', fan: 1 }],
              },
              canKong: false,
              canPong: false,
              chows: [],
              decision: null,
            },
          ],
        ]),
      };
      privHost.scheduleBots();
      vi.advanceTimersByTime(360);
      expect(match.phase).toBe('handOver');
      expect(match.result?.winnerSeat).toBe(1);

      // 5. Start next hand and drive bot robKong reaction
      host.nextHand();
      const nextMatch = host.match!;
      nextMatch.players.at(0)!.melds = [
        { type: 'pong', codes: ['p2', 'p2', 'p2'], tileIds: ['p2_0', 'p2_1', 'p2_2'], concealed: false },
      ];
      nextMatch.phase = 'robKong';
      nextMatch.pendingRobKong = {
        seat: 0,
        meldIdx: 0,
        tileId: 'p2_3',
        bySeat: new Map([[1, { winEval: null, decision: null }]]),
      };
      privHost.scheduleBots();
      vi.advanceTimersByTime(120);
      expect(nextMatch.pendingRobKong).toBeNull();

      host.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('covers GuestSession openHostConnection lifecycle, retry intervals, WebRTC sync/error/close events, and sendAction routing', () => {
    vi.useFakeTimers();
    try {
      const storageSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('restricted');
      });
      const guestFallback = new GuestSession({ roomCode: 'FALLBK', guestName: '   ' });
      expect(guestFallback.myToken.startsWith('guest_')).toBe(true);
      guestFallback.destroy();
      storageSpy.mockRestore();

      const guest = new GuestSession({
        roomCode: 'WEBRTC8',
        guestName: '   ',
        token: 'tok_rtc_guest',
      });

      const stateBox: { status: string; error: string | null; seat: number } = {
        status: '',
        error: null,
        seat: -1,
      };
      const unsub = guest.onUpdate((snap) => {
        stateBox.status = snap.status;
        stateBox.error = snap.error;
        stateBox.seat = snap.mySeat;
      });
      expect(stateBox.seat).toBe(-1);

      const sentPayloads: unknown[] = [];
      let closeCalls = 0;
      const connHandlers = new Map<string, (arg?: unknown) => void>();

      const mockConn = {
        open: true,
        send: (data: unknown) => sentPayloads.push(data),
        on: (ev: string, cb: (arg?: unknown) => void) => {
          connHandlers.set(ev, cb);
        },
        close: () => {
          closeCalls++;
        },
      };

      const mockPeer = {
        connect: () => mockConn,
        on: () => undefined,
        destroy: () => undefined,
      };

      const privGuest = guest as unknown as {
        openHostConnection: (peer: typeof mockPeer) => void;
        bc: { onmessage?: (ev: MessageEvent) => void; postMessage: (msg: unknown) => void } | null;
        emit: () => void;
      };

      privGuest.openHostConnection(mockPeer);
      connHandlers.get('open')?.();
      expect(sentPayloads.length).toBe(1);
      expect(sentPayloads.at(0)).toEqual({ type: 'join', token: 'tok_rtc_guest', name: '雀友' });

      // Advance through all 6 join retries and confirm interval clears on attempt 7
      vi.advanceTimersByTime(1400 * 8);
      expect(sentPayloads.length).toBe(7);

      // Re-opening connection closes previous conn cleanly
      privGuest.openHostConnection(mockPeer);
      expect(closeCalls).toBe(1);

      // sendAction before BC sync routes through WebRTC conn
      guest.sendAction({ type: 'pass' });
      expect(sentPayloads.at(-1)).toEqual({
        type: 'action',
        token: 'tok_rtc_guest',
        action: { type: 'pass' },
      });

      // Handle non-record data, default error, explicit error, and sync snapshot over WebRTC conn
      connHandlers.get('data')?.('non-record');
      connHandlers.get('data')?.({ type: 'error' });
      expect(stateBox.error).toBe('连接错误');

      connHandlers.get('data')?.({ type: 'error', message: '房号不存在' });
      expect(stateBox.error).toBe('房号不存在');

      connHandlers.get('data')?.({
        type: 'sync',
        snapshot: {
          role: 'guest',
          online: true,
          roomCode: 'WEBRTC8',
          status: 'ok',
          error: null,
          mySeat: 2,
          lobby: null,
          view: null,
        },
      });
      expect(stateBox.seat).toBe(2);
      expect(stateBox.error).toBeNull();
      expect(stateBox.status).toContain('WEBRTC8');

      // WebRTC conn error and close handlers
      connHandlers.get('error')?.();
      expect(stateBox.error).toContain('WEBRTC8');

      connHandlers.get('close')?.();
      expect(stateBox.status).toBe('与房主连接中断，请刷新页面重连。');

      // BroadcastChannel fallback error without message string, then BC sync + BC sendAction
      privGuest.bc?.onmessage?.(
        new MessageEvent('message', {
          data: { to: 'guest', targetToken: 'tok_rtc_guest', type: 'error' },
        })
      );
      expect(stateBox.error).toBe('连接错误');

      let bcPosted: unknown = null;
      if (privGuest.bc) {
        const origPost = privGuest.bc.postMessage.bind(privGuest.bc);
        privGuest.bc.postMessage = (msg: unknown) => {
          bcPosted = msg;
          origPost(msg);
        };
      }
      privGuest.bc?.onmessage?.(
        new MessageEvent('message', {
          data: {
            to: 'guest',
            targetToken: 'tok_rtc_guest',
            type: 'sync',
            snapshot: {
              role: 'guest',
              online: true,
              roomCode: 'WEBRTC8',
              status: 'bc',
              error: null,
              mySeat: 1,
              lobby: null,
              view: null,
            },
          },
        })
      );
      guest.sendAction({ type: 'win' });
      expect(bcPosted).toEqual({
        type: 'action',
        token: 'tok_rtc_guest',
        action: { type: 'win' },
      });

      unsub();
      guest.destroy();
      privGuest.emit();
      expect(stateBox.seat).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('synthesizes Web Audio clack and penalty buzzer, selects Cantonese TTS voices, and handles clipboard/prompt invite links', async () => {
    vi.useFakeTimers();
    const audioCtxDesc = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
    const speechDesc = Object.getOwnPropertyDescriptor(globalThis, 'speechSynthesis');
    const utteranceDesc = Object.getOwnPropertyDescriptor(globalThis, 'SpeechSynthesisUtterance');
    const clipboardDesc = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const hiddenDesc = Object.getOwnPropertyDescriptor(document, 'hidden');

    try {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter(routes)],
      });
      const svc = TestBed.inject(MahjongSessionService);

      const oscTypes: string[] = [];
      let throwOsc = false;
      const mockGain = {
        gain: {
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
        },
        connect: () => mockGain,
      };
      let ctxState: AudioContextState = 'running';
      let suspendCount = 0;
      let resumeCount = 0;
      const mockCtx = {
        get state() {
          return ctxState;
        },
        currentTime: 5,
        destination: {},
        suspend: () => {
          suspendCount += 1;
          ctxState = 'suspended';
          return Promise.resolve();
        },
        resume: () => {
          resumeCount += 1;
          ctxState = 'running';
          return Promise.resolve();
        },
        createGain: () => mockGain,
        createOscillator: () => {
          if (throwOsc) throw new Error('audio blocked');
          const osc = {
            type: 'sine',
            frequency: {
              setValueAtTime: () => undefined,
              exponentialRampToValueAtTime: () => undefined,
              linearRampToValueAtTime: () => undefined,
            },
            connect: () => mockGain,
            start: () => {
              oscTypes.push(osc.type);
            },
            stop: () => undefined,
          };
          return osc;
        },
      };

      Object.defineProperty(globalThis, 'AudioContext', {
        configurable: true,
        writable: true,
        value: function () {
          return mockCtx;
        },
      });

      svc.soundEnabled.set(true);
      svc.playClack(660);
      svc.playClack();
      svc.playPenaltyBuzzer();
      expect(oscTypes).toEqual(['triangle', 'triangle', 'sawtooth']);

      vi.advanceTimersByTime(1600);
      expect(suspendCount).toBe(1);
      expect(ctxState).toBe('suspended');

      svc.playClack(600);
      expect(resumeCount).toBe(1);
      expect(ctxState).toBe('running');
      expect(oscTypes.length).toBe(4);

      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(suspendCount).toBe(2);
      restoreProp(document, 'hidden', hiddenDesc);

      throwOsc = true;
      svc.playClack(500);
      svc.playPenaltyBuzzer();
      expect(oscTypes.length).toBe(4);

      svc.soundEnabled.set(false);
      svc.playClack(500);
      svc.playPenaltyBuzzer();
      svc.speakCallout('碰');
      svc.soundEnabled.set(true);

      // Cantonese & Mandarin fallback SpeechSynthesis voice selection
      let voicesList: Array<{ lang: string; name: string }> = [
        { lang: 'zh-HK', name: 'HK Voice' },
      ];
      const spokenItems: Array<{ text: string; voice: { lang: string } | null }> = [];
      let throwSpeak = false;

      Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
        configurable: true,
        writable: true,
        value: function (text: string) {
          return { text, voice: null, lang: '', rate: 1 };
        },
      });
      Object.defineProperty(globalThis, 'speechSynthesis', {
        configurable: true,
        writable: true,
        value: {
          cancel: () => undefined,
          getVoices: () => voicesList,
          speak: (u: { text: string; voice: { lang: string } | null }) => {
            if (throwSpeak) throw new Error('tts error');
            spokenItems.push(u);
          },
        },
      });

      svc.speakCallout('食糊');
      expect(spokenItems.at(0)?.voice?.lang).toBe('zh-HK');

      voicesList = [{ lang: 'zh-CN', name: 'Mandarin' }];
      svc.speakCallout('槓');
      expect(spokenItems.at(1)?.voice?.lang).toBe('zh-CN');

      voicesList = [{ lang: 'en-US', name: 'English' }];
      svc.speakCallout('上');
      expect(spokenItems.at(2)?.voice).toBeNull();

      throwSpeak = true;
      svc.speakCallout('自摸');
      expect(spokenItems.length).toBe(3);

      // copyInviteLink: idle no-op, clipboard success + toast auto-clear, and prompt fallback
      let copiedText = '';
      let rejectClipboard = false;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        writable: true,
        value: {
          writeText: (val: string) => {
            if (rejectClipboard) return Promise.reject(new Error('denied'));
            copiedText = val;
            return Promise.resolve();
          },
        },
      });
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);

      await svc.copyInviteLink();
      expect(copiedText).toBe('');

      svc.createOnlineRoom('LinkHost', '3p', DEFAULT_RULES);
      await svc.copyInviteLink();
      expect(copiedText).toContain(`?room=${svc.snapshot()?.roomCode ?? ''}`);
      expect(copiedText).toContain('&game=mahjong');
      expect(svc.copiedToast()).toBe(true);
      vi.advanceTimersByTime(1900);
      expect(svc.copiedToast()).toBe(false);

      rejectClipboard = true;
      await svc.copyInviteLink();
      expect(promptSpy).toHaveBeenCalledTimes(1);

      promptSpy.mockRestore();
      svc.leaveSession();
    } finally {
      restoreProp(globalThis, 'AudioContext', audioCtxDesc);
      restoreProp(globalThis, 'speechSynthesis', speechDesc);
      restoreProp(globalThis, 'SpeechSynthesisUtterance', utteranceDesc);
      restoreProp(navigator, 'clipboard', clipboardDesc);
      restoreProp(document, 'hidden', hiddenDesc);
      vi.useRealTimers();
    }
  });

  it('exports and restores full Mahjong saves including pendingRobKong, pendingClaims, Tenpai hints, and non-host guards', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
    const svc = TestBed.inject(MahjongSessionService);

    // Idle / non-host guards
    expect(svc.canExportSave()).toBe(false);
    expect(svc.exportSaveData()).toBeNull();
    expect(svc.restoreSaveData({} as never)).toBe(false);

    svc.joinOnlineRoom('   ', 'BlankCodeGuest');
    expect(svc.snapshot()).toBeNull();

    svc.setLobbyMode('4p');
    svc.toggleSeatBot(1);
    svc.updateLobbyRules({ minFan: 7 });
    svc.startMatch();
    svc.nextHand();
    svc.returnToLobby();
    expect(svc.snapshot()).toBeNull();

    // Parameterless toggleAutoPass
    svc.toggleAutoPass();
    expect(svc.autoPass()).toBe(true);
    svc.toggleAutoPass();
    expect(svc.autoPass()).toBe(false);

    // Start solo 3P match and populate rich state (lastDiscard, lastPenalty, pendingRobKong, pendingClaims, 13-tile Tenpai hand)
    svc.startSolo('SaveArchitect', '3p', DEFAULT_RULES);
    expect(svc.canExportSave()).toBe(true);

    const privSvc = svc as unknown as { session: HostSession | null };
    const host = privSvc.session!;
    const match = host.match!;

    match.players.at(0)!.hand = [
      'p1_0', 'p1_1', 'p1_2',
      'p2_0', 'p3_0', 'p4_0',
      'p5_0', 'p6_0', 'p7_0',
      'p8_0', 'p8_1', 'p8_2',
      'p9_0',
    ];
    match.players.at(0)!.lastDrawnId = null;
    match.lastDiscard = { seat: 1, tileId: 'p9_1' };
    match.lastPenalty = {
      seat: 2,
      actionType: 'pong',
      isFalseWin: false,
      reasonCode: 'WRONG_PONG',
      minFan: 5,
      eachGain: 24,
      totalLost: 48,
    };
    match.pendingRobKong = {
      seat: 1,
      meldIdx: 0,
      tileId: 'p2_3',
      bySeat: new Map([[0, { winEval: null, decision: null }]]),
    };
    match.pendingClaims = {
      fromSeat: 1,
      tileId: 'p9_1',
      bySeat: new Map([
        [0, { winEval: null, canKong: false, canPong: true, chows: [], decision: null }],
      ]),
    };

    // Refresh snapshot and verify Tenpai waitingTiles + hintsEnabled toggle
    host.resumeRestoredMatch(host.lobby, match);
    expect(svc.waitingTiles().length).toBeGreaterThanOrEqual(1);
    svc.hintsEnabled.set(false);
    expect(svc.waitingTiles()).toEqual([]);
    svc.hintsEnabled.set(true);

    const exported = svc.exportSaveData();
    expect(exported?.lobby.seats.every((s) => s.token === null)).toBe(true);
    expect(exported?.match.lastDiscard?.tileId).toBe('p9_1');
    expect(exported?.match.lastPenalty?.reasonCode).toBe('WRONG_PONG');
    expect(exported?.match.pendingRobKong?.bySeatEntries.length).toBe(1);
    expect(exported?.match.pendingClaims?.bySeatEntries.length).toBe(1);

    // Clear seat names and windLabels in saved payload to verify restoreSaveData fallback defaults
    const modifiedSave = exported!;
    for (const s of modifiedSave.lobby.seats) {
      s.name = '';
      s.windLabel = '';
    }

    expect(svc.restoreSaveData(modifiedSave)).toBe(true);
    expect(svc.snapshot()?.view?.numSeats).toBe(3);
    expect(svc.snapshot()?.lobby?.seats.at(0)?.windLabel).toBe('東');
    expect(svc.snapshot()?.lobby?.seats.at(1)?.kind).toBe('bot');

    const restoredHost = privSvc.session!;
    expect(restoredHost.match?.pendingRobKong?.bySeat instanceof Map).toBe(true);
    expect(restoredHost.match?.pendingClaims?.bySeat instanceof Map).toBe(true);

    svc.leaveSession();
    expect(svc.snapshot()).toBeNull();
  });

  it('covers HostSession and GuestSession WebRTC PeerJS transport, reconnects, retries, and timeouts', async () => {
    vi.useFakeTimers();
    const rtcDesc = Object.getOwnPropertyDescriptor(globalThis, 'RTCPeerConnection');
    Object.defineProperty(globalThis, 'RTCPeerConnection', {
      configurable: true,
      writable: true,
      value: function () {
        return {};
      },
    });

    class FakeMjConn implements PeerConnectionLike {
      open = false;
      closed = false;
      sent: unknown[] = [];
      private readonly handlers = new Map<string, Array<(arg?: unknown) => void>>();
      send(data: unknown): void {
        this.sent.push(data);
      }
      on(event: string, cb: (arg?: unknown) => void): void {
        const list = this.handlers.get(event) ?? [];
        list.push(cb);
        this.handlers.set(event, list);
      }
      emit(event: string, arg?: unknown): void {
        for (const cb of this.handlers.get(event) ?? []) cb(arg);
      }
      close(): void {
        this.closed = true;
        this.open = false;
      }
    }

    class FakeMjPeer implements PeerInstanceLike {
      disconnected = false;
      destroyed = false;
      reconnectCalls = 0;
      conns: FakeMjConn[] = [];
      private readonly handlers = new Map<string, Array<(arg?: unknown) => void>>();
      connect(): PeerConnectionLike {
        const c = new FakeMjConn();
        this.conns.push(c);
        return c;
      }
      on(event: string, cb: (arg?: unknown) => void): void {
        const list = this.handlers.get(event) ?? [];
        list.push(cb);
        this.handlers.set(event, list);
      }
      emit(event: string, arg?: unknown): void {
        for (const cb of this.handlers.get(event) ?? []) cb(arg);
      }
      reconnect(): void {
        this.reconnectCalls += 1;
      }
      destroy(): void {
        this.destroyed = true;
      }
    }

    const createdPeers: FakeMjPeer[] = [];
    const FakePeerCtor: PeerConstructorLike = function () {
      const p = new FakeMjPeer();
      createdPeers.push(p);
      return p;
    } as unknown as PeerConstructorLike;

    try {
      // 1. HostSession WebRTC PeerJS lifecycle
      const host = new HostSession({
        hostName: 'WebRtcHost',
        mode: '3p',
        online: true,
        fillBots: false,
        peerLoader: () => Promise.resolve(FakePeerCtor),
      });
      await Promise.resolve();
      await Promise.resolve();

      const hostPeer = createdPeers.at(0)!;
      hostPeer.emit('open');
      expect(host.status).toContain('WebRTC P2P 就绪');

      hostPeer.disconnected = true;
      hostPeer.emit('disconnected');
      vi.advanceTimersByTime(650);
      expect(hostPeer.reconnectCalls).toBe(1);

      document.dispatchEvent(new Event('visibilitychange'));
      expect(hostPeer.reconnectCalls).toBe(2);

      hostPeer.emit('error', { type: 'network' });
      vi.advanceTimersByTime(850);
      expect(hostPeer.reconnectCalls).toBe(3);

      hostPeer.emit('error', { type: 'server-error' });
      expect(host.status).toContain('server-error');

      const inboundConn = new FakeMjConn();
      inboundConn.open = true;
      hostPeer.emit('connection', inboundConn);
      inboundConn.emit('data', { type: 'join', token: 'mj_rtc_g1', name: 'RtcGuestOne' });
      expect(host.lobby.seats.at(1)?.name).toBe('RtcGuestOne');
      expect(host.lobby.seats.at(1)?.connected).toBe(true);

      inboundConn.emit('close');
      expect(host.lobby.seats.at(1)?.connected).toBe(false);

      // Host peerLoader error fallback
      const fallbackHost = new HostSession({
        hostName: 'FallbackHost',
        mode: '3p',
        online: true,
        peerLoader: () => Promise.reject(new Error('no peerjs')),
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(fallbackHost.status).toContain('离线局域模式');
      fallbackHost.destroy();

      // 2. GuestSession WebRTC PeerJS connection (no matching BC host -> advances past 120ms wait)
      const guestPeerIdx = createdPeers.length;
      const guest = new GuestSession({
        roomCode: 'MJRTC9',
        guestName: 'MjWebRtcGuest',
        peerLoader: () => Promise.resolve(FakePeerCtor),
      });
      vi.advanceTimersByTime(150);
      await Promise.resolve();
      await Promise.resolve();

      const guestPeer = createdPeers.at(guestPeerIdx)!;
      guestPeer.emit('open');
      const gConn = guestPeer.conns.at(0)!;
      gConn.open = true;
      gConn.emit('open');
      // Advance joinRetryTimer once while still unseated
      vi.advanceTimersByTime(1500);
      expect(gConn.sent.length).toBeGreaterThanOrEqual(2);

      // Send action over WebRTC conn (connectedViaBc is false)
      guest.sendAction({ type: 'pass' });
      expect(gConn.sent.length).toBeGreaterThanOrEqual(3);

      // Receive error then sync over WebRTC conn
      let latestSnapErr: string | null = null;
      let latestSnapSeat = -1;
      let latestSnapStatus = '';
      guest.onUpdate((s) => {
        latestSnapErr = s.error;
        latestSnapSeat = s.mySeat;
        latestSnapStatus = s.status;
      });

      gConn.emit('data', { type: 'error', message: 'Room temporarily locked' });
      expect(latestSnapErr).toBe('Room temporarily locked');

      gConn.emit('data', {
        type: 'sync',
        snapshot: {
          role: 'guest',
          online: true,
          roomCode: 'MJRTC9',
          status: 'ok',
          error: null,
          mySeat: 1,
          lobby: host.lobby,
          view: null,
        },
      });
      expect(latestSnapSeat).toBe(1);
      expect(latestSnapErr).toBeNull();

      gConn.emit('error');
      expect(latestSnapErr).toContain('WebRTC 通道失败');

      gConn.emit('close');
      expect(latestSnapStatus).toContain('与房主连接中断');
      guest.destroy();

      // 3. GuestSession peer-unavailable retries, 15s timeout, and peerLoader failure
      const retryPeerIdx = createdPeers.length;
      const retryGuest = new GuestSession({
        roomCode: 'MJRET1',
        guestName: 'RetryMjGuest',
        peerLoader: () => Promise.resolve(FakePeerCtor),
      });
      vi.advanceTimersByTime(150);
      await Promise.resolve();
      await Promise.resolve();

      const rPeer = createdPeers.at(retryPeerIdx)!;
      rPeer.emit('open');
      rPeer.emit('error', { type: 'peer-unavailable' });
      vi.advanceTimersByTime(1600);
      rPeer.emit('error', { type: 'peer-unavailable' });
      vi.advanceTimersByTime(1600);
      // 3rd peer-unavailable exceeds 2 retries -> sets fatal error
      rPeer.emit('error', { type: 'peer-unavailable' });

      let retryErr: string | null = null;
      retryGuest.onUpdate((s) => {
        retryErr = s.error;
      });
      expect(retryErr).toContain('MJRET1');
      retryGuest.destroy();

      // 4. GuestSession 15000ms connection timeout
      const timeoutGuest = new GuestSession({
        roomCode: 'MJTIM1',
        guestName: 'TimeoutMjGuest',
        peerLoader: () => new Promise<PeerConstructorLike>(() => {}),
      });
      vi.advanceTimersByTime(150);
      await Promise.resolve();
      vi.advanceTimersByTime(15200);
      let timeoutErr: string | null = null;
      timeoutGuest.onUpdate((s) => {
        timeoutErr = s.error;
      });
      expect(timeoutErr).toContain('连接超时');
      timeoutGuest.destroy();

      // 5. GuestSession peerLoader failure
      const brokenGuest = new GuestSession({
        roomCode: 'MJERR1',
        guestName: 'BrokenGuest',
        peerLoader: () => Promise.reject(new Error('bundle missing')),
      });
      vi.advanceTimersByTime(150);
      await Promise.resolve();
      await Promise.resolve();
      let brokenErr: string | null = null;
      brokenGuest.onUpdate((s) => {
        brokenErr = s.error;
      });
      expect(brokenErr).toContain('加载 P2P 连接模块失败');
      brokenGuest.destroy();

      host.destroy();
    } finally {
      restoreProp(globalThis, 'RTCPeerConnection', rtcDesc);
      vi.useRealTimers();
    }
  });
});
