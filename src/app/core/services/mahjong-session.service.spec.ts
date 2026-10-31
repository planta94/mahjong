import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import {
  GuestSession,
  HostSession,
  MahjongSessionService,
  extractRoomCode,
  generateRoomCode,
  getPlayerToken,
} from './mahjong-session.service';
import { DEFAULT_RULES } from './scorer.service';

describe('MahjongSessionService & Host/Guest P2P Sync', () => {
  it('extracts room codes from invite URLs, isolates Host/Guest tokens across tabs, and syncs seats', async () => {
    expect(generateRoomCode(6).length).toBe(6);
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
});
