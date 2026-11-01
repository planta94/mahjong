import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../../app.routes';
import {
  GenericHostSession,
  P2PRoomTransportService,
} from '../../../core/services/p2p-room.transport';
import { ShellUiService } from '../../../core/services/shell-ui.service';
import {
  MonopolyAction,
  MonopolyMatchState,
  MonopolyPlayerView,
} from '../models/monopoly.model';
import { MonopolyBotService } from './monopoly-bot.service';
import { MonopolySessionService, SerializedMonopolySave } from './monopoly-session.service';

describe('MonopolySessionService & Host/Guest Sync', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setupService(): { session: MonopolySessionService; router: Router; shellUi: ShellUiService } {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
    const session = TestBed.inject(MonopolySessionService);
    const router = TestBed.inject(Router);
    const shellUi = TestBed.inject(ShellUiService);
    return { session, router, shellUi };
  }

  it('creates solo match with AI bots and navigates to /monopoly/board', () => {
    const { session, shellUi } = setupService();

    session.createSoloMatch(4);

    expect(session.isHost()).toBe(true);
    expect(session.mySeat()).toBe(0);
    expect(session.isMyTurn()).toBe(true);
    expect(shellUi.activeGame()).toBe('monopoly');
    expect(shellUi.activeRoomCode()).toBe(null);

    const snap = session.snapshot();
    expect(snap?.lobby?.seats.length).toBe(4);
    expect(snap?.lobby?.seats.at(0)?.kind).toBe('human');
    expect(snap?.lobby?.seats.at(1)?.kind).toBe('bot');
    expect(snap?.lobby?.started).toBe(true);
    expect(snap?.view?.players.length).toBe(4);

    session.leaveRoom();
  });

  it('generates P-prefixed room code when creating multiplayer room', () => {
    const { session, shellUi } = setupService();

    const roomCode = session.createMultiplayerRoom(4);

    expect(roomCode.startsWith('P')).toBe(true);
    expect(roomCode.length).toBeGreaterThanOrEqual(5);
    expect(shellUi.activeRoomCode()).toBe(roomCode);

    const snap = session.snapshot();
    expect(snap?.role).toBe('host');
    expect(snap?.lobby?.started).toBe(false);
    expect(snap?.lobby?.seats.at(1)?.kind).toBe('open');
    expect(session.currentLobby()?.seats.length).toBe(4);

    session.leaveRoom();
  });

  it('toggles seat between open and bot in lobby', () => {
    const { session } = setupService();
    session.createMultiplayerRoom(4);

    expect(session.snapshot()?.lobby?.seats.at(1)?.kind).toBe('open');

    session.toggleSeatKind(1);
    expect(session.snapshot()?.lobby?.seats.at(1)?.kind).toBe('bot');

    session.toggleSeatKind(1);
    expect(session.snapshot()?.lobby?.seats.at(1)?.kind).toBe('open');

    session.leaveRoom();
  });

  it('starts match from lobby and fills remaining open seats with bots', () => {
    const { session } = setupService();
    session.createMultiplayerRoom(4);

    session.startMatchFromLobby();

    const snap = session.snapshot();
    expect(snap?.lobby?.started).toBe(true);
    for (let i = 1; i < 4; i++) {
      expect(snap?.lobby?.seats.at(i)?.kind).toBe('bot');
    }

    session.leaveRoom();
  });

  it('opens and closes deed inspector modal', () => {
    const { session } = setupService();
    session.createSoloMatch(2);

    session.inspectSpace(1);
    expect(session.selectedSpaceIndex()).toBe(1);
    expect(session.showDeedModal()).toBe(true);

    session.closeDeedModal();
    expect(session.showDeedModal()).toBe(false);

    session.leaveRoom();
  });

  it('cleans up session and resets signals on leaveRoom()', () => {
    const { session } = setupService();
    session.createSoloMatch(4);

    session.leaveRoom();

    expect(session.snapshot()).toBeNull();
    expect(session.mySeat()).toBe(-1);
    expect(session.isHost()).toBe(false);
    expect(session.isMyTurn()).toBe(false);
    expect(session.selectedSpaceIndex()).toBeNull();
  });

  it('joins multiplayer room as guest and initializes guest transport', () => {
    const { session, shellUi } = setupService();

    session.joinMultiplayerRoom('PTEST9');

    expect(shellUi.activeGame()).toBe('monopoly');
    expect(shellUi.activeRoomCode()).toBe('PTEST9');
    expect(session.snapshot()?.role).toBe('guest');

    session.leaveRoom();
  });

  it('routes action dispatches with corresponding SFX triggers', () => {
    const { session, shellUi } = setupService();
    const sfxSpy = vi.spyOn(shellUi, 'playSfx');
    session.createSoloMatch(2);
    sfxSpy.mockClear();

    session.dispatchAction({ type: 'rollDice' });
    expect(sfxSpy).toHaveBeenCalledWith('dice');

    session.dispatchAction({ type: 'buyProperty' });
    expect(sfxSpy).toHaveBeenCalledWith('click');

    session.dispatchAction({ type: 'buildHouse', spaceIndex: 1 });
    session.dispatchAction({ type: 'declareBankruptcy' });
    expect(sfxSpy).toHaveBeenCalledWith('fail');

    session.leaveRoom();
  });

  it('responds to global p2p:leave CustomEvent selectively for monopoly or generic events', () => {
    const { session } = setupService();
    session.createSoloMatch(2);
    expect(session.isHost()).toBe(true);

    // Other game leave event should not tear down monopoly session
    window.dispatchEvent(new CustomEvent('p2p:leave', { detail: { game: 'avalon' } }));
    expect(session.isHost()).toBe(true);

    // Monopoly leave event resets room
    window.dispatchEvent(new CustomEvent('p2p:leave', { detail: { game: 'monopoly' } }));
    expect(session.snapshot()).toBeNull();
  });

  it('triggers bot actions via timer for active bot turns, auctions, and pending trades', () => {
    vi.useFakeTimers();
    try {
      const { session } = setupService();
      session.createSoloMatch(2);

      // 1. Pending trade targeting bot seat 1 triggers bot response timer
      const snap = session.snapshot();
      expect(snap !== null).toBe(true);
      if (snap?.view) {
        session.dispatchAction({
          type: 'proposeTrade',
          trade: {
            fromSeat: 0,
            toSeat: 1,
            offerCash: 50,
            offerProperties: [],
            requestCash: 0,
            requestProperties: [],
          },
        });
        vi.advanceTimersByTime(700);
        expect(session.currentView()?.pendingTrade).toBeNull();
      }

      // 2. Advance to seat 1 (bot) turn and run timer
      session.dispatchAction({ type: 'rollDice' });
      session.dispatchAction({ type: 'passProperty' });
      session.dispatchAction({ type: 'endTurn' });
      vi.advanceTimersByTime(2500);

      expect(session.snapshot()?.view?.players.length).toBe(2);

      session.leaveRoom();
    } finally {
      vi.useRealTimers();
    }
  });

  it('exports and restores serialized save data while stripping seat tokens', () => {
    const { session } = setupService();

    // Cannot export when idle or in unstarted lobby
    expect(session.canExportSave()).toBe(false);
    expect(session.exportSaveData()).toBeNull();

    session.createMultiplayerRoom(3);
    expect(session.canExportSave()).toBe(false);

    // Active solo match exports cleanly with stripped tokens
    session.createSoloMatch(3);
    expect(session.canExportSave()).toBe(true);
    const saved = session.exportSaveData();
    expect(saved !== null).toBe(true);
    expect(saved?.lobby.seats.length).toBe(3);
    expect(saved?.lobby.seats.at(0)?.token).toBeNull();
    expect(Array.isArray(saved?.state.propertiesEntries)).toBe(true);

    // Invalid restore guard
    expect(session.restoreSaveData({} as never)).toBe(false);

    // Valid restore reconstructs Map properties and host session
    session.leaveRoom();
    const restored = session.restoreSaveData(saved!);
    expect(restored).toBe(true);
    expect(session.isHost()).toBe(true);
    expect(session.currentView()?.players.length).toBe(3);

    session.leaveRoom();
  });

  it('covers modal visibility signals, guest action dispatch, and seat toggle guards', () => {
    const { session } = setupService();

    session.toggleSeatKind(1);
    session.startMatchFromLobby();
    expect(session.snapshot()).toBeNull();

    session.showTradeModal.set(true);
    session.showAuctionModal.set(true);
    session.showBankruptcyModal.set(true);
    expect(session.showTradeModal()).toBe(true);
    expect(session.showAuctionModal()).toBe(true);
    expect(session.showBankruptcyModal()).toBe(true);

    session.joinMultiplayerRoom('PTEST9');
    session.dispatchAction({ type: 'rollDice' });

    session.leaveRoom();
    expect(session.showTradeModal()).toBe(false);
    expect(session.showAuctionModal()).toBe(false);
    expect(session.showBankruptcyModal()).toBe(false);

    session.createMultiplayerRoom(3);
    session.toggleSeatKind(0);
    expect(session.snapshot()?.lobby?.seats.at(0)?.kind).toBe('human');

    session.toggleSeatKind(99);
    expect(session.snapshot()?.lobby?.seats.length).toBe(3);

    session.leaveRoom();
  });

  it('dispatches actions in multiplayer-hosted sessions, handles empty nickname fallbacks, and ignores idle dispatches', () => {
    const { session, router, shellUi } = setupService();
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const sfxSpy = vi.spyOn(shellUi, 'playSfx');

    shellUi.playerNickname.set('');

    session.createSoloMatch(2, { auctionEnabled: false });
    expect(session.snapshot()?.lobby?.seats.at(0)?.name).toBe('Host');

    const roomCode = session.createMultiplayerRoom(3, {
      auctionEnabled: false,
      winCondition: 'roundLimit',
      maxRounds: 20,
    });
    expect(session.snapshot()?.lobby?.seats.at(0)?.name).toBe('Host');
    expect(session.snapshot()?.lobby?.rules?.winCondition).toBe('roundLimit');

    session.startMatchFromLobby();
    sfxSpy.mockClear();
    session.dispatchAction({ type: 'rollDice' });
    expect(sfxSpy).toHaveBeenCalledWith('dice');

    session.joinMultiplayerRoom(roomCode);
    expect(session.snapshot()?.roomCode).toBe(roomCode);

    session.leaveRoom();
    expect(session.currentView()).toBeNull();
    expect(session.currentLobby()).toBeNull();

    session.dispatchAction({ type: 'rollDice' });
    expect(session.snapshot()).toBeNull();

    shellUi.setPlayerNickname('雀友');
  });

  it('restores save data with missing seat names and colors, blocks export on gameOver, and dispatches actions on restored session', () => {
    const { session, router, shellUi } = setupService();
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    session.createSoloMatch(2, { auctionEnabled: false });
    const baseSave = session.exportSaveData()!;
    expect(session.restoreSaveData({ lobby: baseSave.lobby } as never)).toBe(false);

    shellUi.setPlayerNickname('TycoonNick');
    const unnamedSave: SerializedMonopolySave = {
      ...baseSave,
      lobby: {
        ...baseSave.lobby,
        seats: baseSave.lobby.seats.map((s) => ({
          ...s,
          name: '',
          color: '',
        })),
      },
    };

    expect(session.restoreSaveData(unnamedSave)).toBe(true);
    expect(session.snapshot()?.lobby?.seats.at(0)?.name).toBe('TycoonNick');
    expect(session.snapshot()?.lobby?.seats.at(1)?.name).toBe('KL Tycoon (Bot)');
    expect(session.snapshot()?.lobby?.seats.at(0)?.color).toBe('#e63946');
    expect(session.snapshot()?.lobby?.seats.at(1)?.color).toBe('#457b9d');

    const sfxSpy = vi.spyOn(shellUi, 'playSfx');
    session.dispatchAction({ type: 'rollDice' });
    expect(sfxSpy).toHaveBeenCalledWith('dice');

    // Empty playerNickname falls back to 'Host' on restore
    shellUi.playerNickname.set('');
    expect(session.restoreSaveData(unnamedSave)).toBe(true);
    expect(session.snapshot()?.lobby?.seats.at(0)?.name).toBe('Host');
    shellUi.setPlayerNickname('雀友');

    // GameOver state disables save export and skips bot scheduling
    const gameOverSave: SerializedMonopolySave = {
      ...baseSave,
      state: {
        ...baseSave.state,
        phase: 'gameOver',
        winnerSeat: 0,
        gameOverReason: 'All rivals bankrupt.',
      },
    };
    expect(session.restoreSaveData(gameOverSave)).toBe(true);
    expect(session.canExportSave()).toBe(false);
    expect(session.exportSaveData()).toBeNull();

    session.leaveRoom();
  });

  it('schedules AI bot turns across active bot seat, auctions with or without bots, human-targeted trades, and null bot decisions', () => {
    vi.useFakeTimers();
    const { session, router } = setupService();
    const bot = TestBed.inject(MonopolyBotService);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    session.createSoloMatch(3, { auctionEnabled: true });
    const baseSave = session.exportSaveData()!;

    // 1. Active bot seat (seat 1) executes scheduled turn after 700ms
    session.restoreSaveData({
      ...baseSave,
      state: { ...baseSave.state, activeSeat: 1, phase: 'roll' },
    });
    vi.advanceTimersByTime(700);
    expect(session.currentView()?.logs.length ?? 0).toBeGreaterThan(baseSave.state.logs.length);

    // 2. Active bot seat handles null bot decision gracefully
    vi.spyOn(bot, 'evaluateMonopolyBotAction').mockReturnValueOnce(null);
    session.restoreSaveData({
      ...baseSave,
      state: { ...baseSave.state, activeSeat: 1, phase: 'roll' },
    });
    vi.advanceTimersByTime(700);
    expect(session.currentView()?.phase).toBe('roll');

    // 3. Pending trade targeting human seat (seat 0) pauses bot turn scheduling
    session.restoreSaveData({
      ...baseSave,
      state: {
        ...baseSave.state,
        activeSeat: 1,
        phase: 'action',
        pendingTrade: {
          fromSeat: 1,
          toSeat: 0,
          offerCash: 100,
          offerProperties: [],
          requestCash: 0,
          requestProperties: [],
        },
      },
    });
    vi.advanceTimersByTime(1000);
    expect(session.currentView()?.pendingTrade?.toSeat).toBe(0);

    // 4. Pending trade targeting bot seat handles null bot decision gracefully
    vi.spyOn(bot, 'evaluateMonopolyBotAction').mockReturnValueOnce(null);
    session.restoreSaveData({
      ...baseSave,
      state: {
        ...baseSave.state,
        activeSeat: 0,
        phase: 'action',
        pendingTrade: {
          fromSeat: 0,
          toSeat: 1,
          offerCash: 50,
          offerProperties: [],
          requestCash: 0,
          requestProperties: [],
        },
      },
    });
    vi.advanceTimersByTime(600);
    expect(session.currentView()?.pendingTrade?.toSeat).toBe(1);

    // 5. Auction with only human activeBidders does not schedule bot auction bid
    session.restoreSaveData({
      ...baseSave,
      state: {
        ...baseSave.state,
        activeSeat: 0,
        phase: 'auction',
        activeAuction: {
          spaceIndex: 1,
          currentBid: 60,
          highestBidderSeat: 0,
          activeBidders: [0],
          timerSeconds: 15,
        },
      },
    });
    vi.advanceTimersByTime(900);
    expect(session.currentView()?.activeAuction?.currentBid).toBe(60);

    // 6. Auction with bot bidder executes after 800ms and also handles null bot decision
    session.restoreSaveData({
      ...baseSave,
      state: {
        ...baseSave.state,
        activeSeat: 0,
        phase: 'auction',
        activeAuction: {
          spaceIndex: 1,
          currentBid: 10,
          highestBidderSeat: 0,
          activeBidders: [0, 1],
          timerSeconds: 15,
        },
      },
    });
    vi.advanceTimersByTime(800);
    expect(session.currentView()?.logs.length ?? 0).toBeGreaterThan(baseSave.state.logs.length);

    vi.spyOn(bot, 'evaluateMonopolyBotAction').mockReturnValueOnce(null);
    session.restoreSaveData({
      ...baseSave,
      state: {
        ...baseSave.state,
        activeSeat: 0,
        phase: 'auction',
        activeAuction: {
          spaceIndex: 1,
          currentBid: 10,
          highestBidderSeat: 0,
          activeBidders: [0, 1],
          timerSeconds: 15,
        },
      },
    });
    vi.advanceTimersByTime(800);
    expect(session.currentView()?.activeAuction?.currentBid).toBe(10);

    session.leaveRoom();
  });

  it('auto-navigates from /monopoly/lobby on started snapshot, preserves human guest seat on toggleSeatKind, and handles detail-less p2p:leave', () => {
    const { session, router } = setupService();
    const transport = TestBed.inject(P2PRoomTransportService);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/monopoly/lobby');

    let capturedHost: GenericHostSession<
      MonopolyMatchState,
      MonopolyPlayerView,
      MonopolyAction
    > | null = null;
    const realCreateHost = transport.createHost.bind(transport);
    vi.spyOn(transport, 'createHost').mockImplementation((opts) => {
      const created = realCreateHost(opts);
      capturedHost = created as unknown as GenericHostSession<
        MonopolyMatchState,
        MonopolyPlayerView,
        MonopolyAction
      >;
      return created;
    });

    session.createMultiplayerRoom(3);
    expect(capturedHost !== null).toBe(true);

    // Human guest joins seat 1; toggleSeatKind leaves human seat untouched
    capturedHost!.handleClientMessage(
      { type: 'join', token: 'guest_tok_1', name: 'GuestBob' },
      () => {}
    );
    expect(session.snapshot()?.lobby?.seats.at(1)?.kind).toBe('human');
    expect(session.snapshot()?.lobby?.seats.at(1)?.name).toBe('GuestBob');

    session.toggleSeatKind(1);
    expect(session.snapshot()?.lobby?.seats.at(1)?.kind).toBe('human');

    // Undefined lobby.rules falls back to DEFAULT_MONOPOLY_SETTINGS & triggers board navigation from /monopoly/lobby
    capturedHost!.lobby.rules = undefined;
    navSpy.mockClear();
    session.startMatchFromLobby();
    expect(navSpy).toHaveBeenCalledWith(['/monopoly/board']);
    expect(session.currentView()?.maxRounds).toBe(30);

    // Detail-less p2p:leave event resets session
    window.dispatchEvent(new CustomEvent('p2p:leave'));
    expect(session.snapshot()).toBeNull();
  });

  it('plays deal SFX on acceptTrade and fail SFX on rejectTrade including bot response execution', () => {
    vi.useFakeTimers();
    const { session, shellUi } = setupService();
    const sfxSpy = vi.spyOn(shellUi, 'playSfx');

    session.createSoloMatch(2, { auctionEnabled: false });

    // Host dispatches acceptTrade -> plays 'deal'
    sfxSpy.mockClear();
    session.dispatchAction({ type: 'acceptTrade' });
    expect(sfxSpy).toHaveBeenCalledWith('deal');

    // Host dispatches rejectTrade -> plays 'fail'
    sfxSpy.mockClear();
    session.dispatchAction({ type: 'rejectTrade' });
    expect(sfxSpy).toHaveBeenCalledWith('fail');

    // Propose trade to bot (seat 1) that will be accepted
    const bot = TestBed.inject(MonopolyBotService);
    vi.spyOn(bot, 'evaluateMonopolyBotAction').mockReturnValue({
      type: 'acceptTrade',
      reasonKey: 'MONOPOLY.TRADE_REASON_ACCEPTED',
    });

    sfxSpy.mockClear();
    session.dispatchAction({
      type: 'proposeTrade',
      trade: {
        fromSeat: 0,
        toSeat: 1,
        offerCash: 100,
        offerProperties: [],
        requestCash: 0,
        requestProperties: [],
      },
    });

    // Advance timers by 600ms for bot response timer
    vi.advanceTimersByTime(700);
    expect(sfxSpy).toHaveBeenCalledWith('deal');

    // Propose trade to bot that will be rejected
    vi.spyOn(bot, 'evaluateMonopolyBotAction').mockReturnValue({
      type: 'rejectTrade',
      reasonKey: 'MONOPOLY.TRADE_REASON_LOW_VALUE',
    });

    sfxSpy.mockClear();
    session.dispatchAction({
      type: 'proposeTrade',
      trade: {
        fromSeat: 0,
        toSeat: 1,
        offerCash: 10,
        offerProperties: [],
        requestCash: 0,
        requestProperties: [],
      },
    });

    vi.advanceTimersByTime(700);
    expect(sfxSpy).toHaveBeenCalledWith('fail');

    session.leaveRoom();
  });
});
