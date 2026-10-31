import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app.routes';
import {
  GameAction,
  GameMode,
  PlayerPublicState,
  PlayerView,
  PublicLobby,
  SessionSnapshot,
} from '../../core/models/mahjong.model';
import { MahjongSessionService } from '../../core/services/mahjong-session.service';
import { DEFAULT_RULES } from '../../core/services/scorer.service';
import { TranslateService } from '../../core/services/translate.service';
import { windLabel } from '../../core/utils/tiles.util';
import { SelectionMode, TableComponent } from './table.component';

function buildSeatLobby(mode: GameMode): PublicLobby {
  const count = mode === '3p' ? 3 : 4;
  return {
    mode,
    rules: { ...DEFAULT_RULES },
    started: true,
    seats: Array.from({ length: count }, (_, idx) => ({
      seat: idx,
      kind: idx === 0 ? 'human' : 'bot',
      name: idx === 0 ? 'Hero' : `Bot${idx}`,
      token: null,
      connected: true,
      windLabel: windLabel(idx),
    })),
  };
}

function buildPlayers(mode: GameMode): PlayerPublicState[] {
  const count = mode === '3p' ? 3 : 4;
  return Array.from({ length: count }, (_, idx) => ({
    seat: idx,
    seatWind: idx,
    hand:
      idx === 0
        ? [
            'p1_0',
            'p1_1',
            'p1_2',
            'p2_0',
            'p3_0',
            'p4_0',
            'p5_0',
            'p6_0',
            'p7_0',
            'p8_0',
            'p8_1',
            'p8_2',
            'p9_0',
            'we_0',
          ]
        : null,
    handCount: idx === 0 ? 14 : 13,
    lastDrawnId: idx === 0 ? 'we_0' : null,
    melds: [],
    bonus: [],
    discards: [],
  }));
}

function buildSnapshot(mode: GameMode, overrides?: Partial<PlayerView>, role: 'host' | 'guest' = 'host'): SessionSnapshot {
  const count = mode === '3p' ? 3 : 4;
  const baseView: PlayerView = {
    mode,
    numSeats: count,
    rules: { ...DEFAULT_RULES },
    roundWind: 0,
    dealerSeat: 0,
    dealerStreak: 0,
    handNumber: 1,
    scores: Array.from({ length: count }, () => 1000),
    phase: 'turn',
    wallCount: 40,
    turnSeat: 0,
    lastDiscard: null,
    lastPenalty: null,
    discardPool: [],
    viewerSeat: 0,
    legalActions: {
      phase: 'turn',
      canDiscard: true,
      win: null,
      exposeFly: false,
      retrieveFlys: [],
      concealedKongs: [],
      addedKongs: [],
    },
    players: buildPlayers(mode),
    log: ['开局配牌完成'],
    result: null,
    ...overrides,
  };

  return {
    role,
    online: false,
    roomCode: 'LOCAL',
    status: '就绪',
    error: null,
    mySeat: 0,
    lobby: buildSeatLobby(mode),
    view: baseView,
  };
}

describe('TableComponent', () => {
  let session: MahjongSessionService;
  let router: Router;
  let translate: TranslateService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [TableComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();

    session = TestBed.inject(MahjongSessionService);
    router = TestBed.inject(Router);
    translate = TestBed.inject(TranslateService);
    translate.use('zh');
  });

  afterEach(() => {
    session.leaveSession();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('redirects to /lobby preserving query params when initialized without an active view', () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    session.snapshot.set(null);

    const fixture = TestBed.createComponent(TableComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(navSpy).toHaveBeenCalledWith(['/lobby'], { queryParamsHandling: 'preserve' });
    expect(comp.seatLayout()).toBeNull();
    expect(comp.discardPool()).toEqual([]);
    expect(comp.myRack()).toEqual({ main: [], drawn: null });
    expect(comp.playerAt(0)).toBeNull();
    expect(comp.seatName(null)).toBe('');
    expect(comp.seatName(-1)).toBe('');
    expect(comp.seatScore(0)).toBe(0);
    expect(comp.seatDelta(0)).toBe(0);
    expect(comp.latestLog()).toBe('');
  });

  it('renders authentic 3P (東/南/西) vs 4P seat layouts, opponent melds/backs, drawn tile gap, and discard pool', () => {
    // 1. 3P layout: strictly 3 seats (東/南/西), no top seat, 3P banner, 3P fly buttons
    session.snapshot.set(buildSnapshot('3p'));
    const fixture = TestBed.createComponent(TableComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const hostEl = fixture.nativeElement as HTMLElement;

    expect(comp.seatLayout()).toEqual({ me: 0, right: 1, top: null, left: 2 });
    expect(hostEl.querySelector('.table-stage')?.classList.contains('mode-3p')).toBe(true);
    expect(hostEl.querySelectorAll('.top-opp-wrap').length).toBe(0);
    expect(hostEl.querySelectorAll('.authentic-3p-pill').length).toBe(1);
    expect(hostEl.querySelector('.empty-river')?.textContent).toContain('尚无弃牌');

    // Verify 14-tile hand splits 13 main + 1 drawn tile
    expect(comp.myRack().main.length).toBe(13);
    expect(comp.myRack().drawn).toBe('we_0');
    expect(hostEl.querySelectorAll('.hand-rack mj-tile').length).toBe(14);

    // 3P action bar in turn phase: Chow, Pong, Kong, Expose Fly, Retrieve Fly, Hu = 6 buttons
    expect(hostEl.querySelectorAll('.action-bar button').length).toBe(6);

    // 2. 4P layout: 4 seats with top opponent, dealer streak badge, opponent melds/bonus, and discard river fallback
    const players4p = buildPlayers('4p');
    const topOpponent: PlayerPublicState = {
      ...players4p.at(2)!,
      melds: [{ type: 'pong', codes: ['dr', 'dr', 'dr'], tileIds: ['dr_0', 'dr_1', 'dr_2'], concealed: false }],
      bonus: ['f1_0'],
      discards: ['m1_0'],
    };
    const rightOpponent: PlayerPublicState = {
      ...players4p.at(1)!,
      hand: ['s1_0', 's2_0'],
      handCount: 2,
      melds: [{ type: 'kong', codes: ['back', 'back', 'back', 'back'], concealed: true }],
      bonus: ['b1_0'],
      discards: ['m9_0'],
    };
    players4p.splice(1, 1, rightOpponent);
    players4p.splice(2, 1, topOpponent);

    session.snapshot.set(
      buildSnapshot('4p', {
        dealerSeat: 2,
        dealerStreak: 2,
        turnSeat: 2,
        players: players4p,
        discardPool: [],
        lastDiscard: { seat: 1, tileId: 'm9_0' },
      })
    );
    fixture.detectChanges();

    expect(comp.seatLayout()).toEqual({ me: 0, right: 1, top: 2, left: 3 });
    expect(hostEl.querySelector('.table-stage')?.classList.contains('mode-3p')).toBe(false);
    expect(hostEl.querySelectorAll('.top-opp-wrap').length).toBe(1);
    expect(hostEl.querySelector('.top-opp-wrap .dealer-badge')?.textContent?.trim()).toBe('庄+2');
    expect(hostEl.querySelectorAll('.top-opp-wrap .opp-exposed .meld-group').length).toBe(1);

    // Fallback discardPool aggregates player discards in seat order (seat 1 -> seat 2) when view.discardPool is empty
    expect(comp.discardPool()).toEqual(['m9_0', 'm1_0']);
    expect(comp.isLastPoolDiscard('m9_0', 0, 2)).toBe(false);
    expect(comp.isLastPoolDiscard('m9_0', 1, 2)).toBe(true);

    // 4P action bar omits 3P-only exposeFly & retrieveFly buttons (Chow, Pong, Kong, Hu = 4)
    expect(hostEl.querySelectorAll('.action-bar button').length).toBe(4);
  });

  it('discards clicked hand tile during active turn and ignores clicks when discard is disallowed', () => {
    const sendSpy = vi.spyOn(session, 'sendAction');
    session.snapshot.set(buildSnapshot('3p'));

    const fixture = TestBed.createComponent(TableComponent);
    fixture.detectChanges();
    const hostEl = fixture.nativeElement as HTMLElement;

    expect(hostEl.querySelector('.self-zone')?.classList.contains('active-turn')).toBe(true);
    expect(hostEl.querySelector('.turn-hint')?.textContent).toContain('轮到你出牌');

    const rackTiles = hostEl.querySelectorAll('.hand-rack mj-tile');
    (rackTiles.item(0) as HTMLElement).click();
    expect(sendSpy).toHaveBeenCalledWith({ type: 'discard', tileId: 'p1_0' });

    // When it is another player's turn and legalActions is null, clicking does not discard
    sendSpy.mockClear();
    session.snapshot.set(buildSnapshot('3p', { turnSeat: 1, legalActions: null }));
    fixture.detectChanges();

    (hostEl.querySelectorAll('.hand-rack mj-tile').item(0) as HTMLElement).click();
    expect(sendSpy).toHaveBeenCalledTimes(0);
  });

  it('handles manual selection modes (chow, pong, kong, exposeFly, retrieveFly), confirm, cancel, and context reset', () => {
    const actionsSent: GameAction[] = [];
    vi.spyOn(session, 'sendAction').mockImplementation((act: GameAction) => {
      actionsSent.push(act);
    });
    session.snapshot.set(buildSnapshot('3p'));

    const fixture = TestBed.createComponent(TableComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const hostEl = fixture.nativeElement as HTMLElement;

    const modeExpectations: Array<{ mode: SelectionMode; keyword: string }> = [
      { mode: 'chow', keyword: '上牌' },
      { mode: 'pong', keyword: '碰牌' },
      { mode: 'kong', keyword: '杠牌' },
      { mode: 'exposeFly', keyword: '补牌' },
      { mode: 'retrieveFly', keyword: '换回副露' },
    ];

    for (const item of modeExpectations) {
      comp.startSelection(item.mode);
      fixture.detectChanges();
      expect(comp.selectionMode()).toBe(item.mode);
      expect(session.selectionPaused()).toBe(true);
      expect(hostEl.querySelector('.selection-prompt')?.textContent).toContain(item.keyword);
    }

    // Clicking the same active mode again toggles/cancels selection
    comp.startSelection('retrieveFly');
    fixture.detectChanges();
    expect(comp.selectionMode()).toBeNull();
    expect(session.selectionPaused()).toBe(false);

    // Enter Pong selection, select 2 tiles, toggle 1 tile off & back on, then Confirm
    comp.startSelection('pong');
    fixture.detectChanges();

    comp.onHandTileClick('p1_0');
    comp.onHandTileClick('p1_1');
    comp.onHandTileClick('p1_1');
    expect(comp.selectedTileIds()).toEqual(['p1_0']);
    comp.onHandTileClick('p1_2');
    fixture.detectChanges();

    expect(comp.isTileSelected('p1_0')).toBe(true);
    expect(comp.isTileSelected('p1_2')).toBe(true);
    expect(hostEl.querySelectorAll('.hand-rack .mj-tile.selected').length).toBe(2);

    const confirmBtn = hostEl.querySelector('.selection-actions .btn-emerald') as HTMLButtonElement;
    confirmBtn.click();
    fixture.detectChanges();

    expect(actionsSent).toEqual([{ type: 'pong', tileIds: ['p1_0', 'p1_2'] }]);
    expect(comp.selectionMode()).toBeNull();
    expect(session.selectionPaused()).toBe(false);
    expect(hostEl.querySelectorAll('.selection-strip').length).toBe(0);

    // Enter Chow selection and click Cancel button
    comp.startSelection('chow');
    comp.onHandTileClick('p2_0');
    fixture.detectChanges();
    const cancelBtn = hostEl.querySelectorAll('.selection-actions button').item(1) as HTMLButtonElement;
    cancelBtn.click();
    fixture.detectChanges();
    expect(comp.selectionMode()).toBeNull();
    expect(comp.selectedTileIds()).toEqual([]);

    // Context change in view (e.g. phase/turnSeat transition) automatically clears active selection via effect()
    comp.startSelection('kong');
    comp.onHandTileClick('p8_0');
    fixture.detectChanges();
    expect(comp.selectionMode()).toBe('kong');

    session.snapshot.set(
      buildSnapshot('3p', {
        phase: 'claim',
        turnSeat: 2,
        legalActions: {
          phase: 'claim',
          tileId: 'p8_3',
          fromSeat: 2,
          win: null,
          canKong: true,
          canPong: true,
          chows: [],
        },
      })
    );
    fixture.detectChanges();
    expect(comp.selectionMode()).toBeNull();
    expect(comp.selectedTileIds()).toEqual([]);
    expect(session.selectionPaused()).toBe(false);
  });

  it('dispatches win and pass in claim and robKong phases and toggles autoPass', () => {
    const actionsSent: GameAction[] = [];
    vi.spyOn(session, 'sendAction').mockImplementation((act: GameAction) => {
      actionsSent.push(act);
    });

    // Claim phase
    session.snapshot.set(
      buildSnapshot('3p', {
        phase: 'claim',
        legalActions: {
          phase: 'claim',
          tileId: 'p9_1',
          fromSeat: 1,
          win: null,
          canKong: false,
          canPong: true,
          chows: [],
        },
      })
    );

    const fixture = TestBed.createComponent(TableComponent);
    fixture.detectChanges();
    const hostEl = fixture.nativeElement as HTMLElement;

    expect(hostEl.querySelector('.claim-prompt')?.textContent).toContain('打出');
    // 3P claim bar: Chow, Pong, Kong, Expose Fly, Retrieve Fly, Hu, Pass = 7 buttons
    const claimBtns = hostEl.querySelectorAll('.action-bar button');
    expect(claimBtns.length).toBe(7);

    // Declare Hu
    (hostEl.querySelector('.btn-crimson') as HTMLButtonElement).click();
    expect(actionsSent.at(-1)).toEqual({ type: 'win' });

    // Pass claim
    (claimBtns.item(6) as HTMLButtonElement).click();
    expect(actionsSent.at(-1)).toEqual({ type: 'pass' });

    // robKong phase prompt
    session.snapshot.set(
      buildSnapshot('3p', {
        phase: 'robKong',
        legalActions: {
          phase: 'robKong',
          tileId: 'p1_3',
          fromSeat: 2,
          win: null,
        },
      })
    );
    fixture.detectChanges();
    expect(hostEl.querySelector('.claim-prompt')?.textContent).toContain('加杠');

    // Toggle autoPass checkbox on and off
    const autoPassCheckbox = hostEl.querySelector('.auto-pass-toggle input') as HTMLInputElement;
    autoPassCheckbox.click();
    fixture.detectChanges();
    expect(session.autoPass()).toBe(true);

    autoPassCheckbox.click();
    fixture.detectChanges();
    expect(session.autoPass()).toBe(false);
  });

  it('renders Tenpai waiting strip across discard-win, self-draw-only, and low-fan pills and respects hintsEnabled', () => {
    const fixture = TestBed.createComponent(TableComponent);
    const hostEl = fixture.nativeElement as HTMLElement;

    // 1. High-fan Pure Flush 13-tile hand -> discard-win pill
    const playersHighFan = buildPlayers('3p');
    playersHighFan.splice(0, 1, {
      ...playersHighFan.at(0)!,
      hand: [
        'p1_0', 'p1_1', 'p1_2',
        'p2_0', 'p3_0', 'p4_0',
        'p5_0', 'p6_0', 'p7_0',
        'p8_0', 'p8_1', 'p8_2',
        'p9_0',
      ],
      handCount: 13,
      lastDrawnId: null,
    });
    session.hintsEnabled.set(true);
    session.snapshot.set(buildSnapshot('3p', { players: playersHighFan }));
    fixture.detectChanges();

    expect(hostEl.querySelectorAll('.tenpai-bar .wait-pill').length).toBeGreaterThanOrEqual(1);
    expect(hostEl.querySelectorAll('.tenpai-bar .wait-pill.self-only').length).toBe(0);

    // Toggling hintsEnabled off hides Tenpai strip
    session.hintsEnabled.set(false);
    fixture.detectChanges();
    expect(hostEl.querySelectorAll('.tenpai-bar').length).toBe(0);
    session.hintsEnabled.set(true);

    // 2. 4P Seven Pairs (4 fan on discard, 5 fan on self-draw with minFan=5, concealedFan=false, non-seat flower) -> self-only pill
    const playersSelfOnly = buildPlayers('4p');
    playersSelfOnly.splice(0, 1, {
      ...playersSelfOnly.at(0)!,
      hand: [
        'm1_0', 'm1_1',
        'm3_0', 'm3_1',
        'p2_0', 'p2_1',
        'p5_0', 'p5_1',
        's4_0', 's4_1',
        's8_0', 's8_1',
        'dr_0',
      ],
      handCount: 13,
      lastDrawnId: null,
      bonus: ['f2_0'],
    });
    session.snapshot.set(
      buildSnapshot('4p', {
        rules: { ...DEFAULT_RULES, minFan: 5, concealedFan: false, sevenPairs: true, showHints: true },
        players: playersSelfOnly,
      })
    );
    fixture.detectChanges();
    expect(hostEl.querySelectorAll('.tenpai-bar .wait-pill.self-only').length).toBe(1);
    expect(hostEl.querySelector('.tenpai-bar .wait-pill.self-only')?.textContent).toContain('仅可自摸');

    // 3. 4P Chicken/Ping-Hu sequence hand (1 fan discard / 2 fan self-draw < 5 minFan) -> low-fan pill
    const playersLowFan = buildPlayers('4p');
    playersLowFan.splice(0, 1, {
      ...playersLowFan.at(0)!,
      hand: [
        'm1_0', 'm2_0', 'm3_0',
        'p2_0', 'p3_0', 'p4_0',
        's5_0', 's6_0', 's7_0',
        'm7_0', 'm8_0', 'm9_0',
        'p9_0',
      ],
      handCount: 13,
      lastDrawnId: null,
      bonus: ['f2_0'],
    });
    session.snapshot.set(
      buildSnapshot('4p', {
        rules: { ...DEFAULT_RULES, minFan: 5, concealedFan: false, sevenPairs: true, showHints: true },
        players: playersLowFan,
      })
    );
    fixture.detectChanges();
    expect(hostEl.querySelectorAll('.tenpai-bar .wait-pill.low-fan').length).toBe(1);
    expect(hostEl.querySelector('.tenpai-bar .wait-pill.low-fan')?.textContent).toContain('未够');
  });

  it('displays penalty alert banners for insufficient-fan false Hu, invalid-shape false Hu, and wrong meld calls', () => {
    const fixture = TestBed.createComponent(TableComponent);
    const hostEl = fixture.nativeElement as HTMLElement;

    // 1. Insufficient fan false Hu
    session.snapshot.set(
      buildSnapshot('3p', {
        lastPenalty: {
          seat: 0,
          actionType: 'win',
          isFalseWin: true,
          reasonCode: 'FALSE_WIN_FAN',
          rawFan: 3,
          minFan: 5,
          eachGain: 48,
          totalLost: 96,
        },
      })
    );
    fixture.detectChanges();
    expect(hostEl.querySelector('.penalty-banner')?.textContent).toContain('仅 3 番');

    // 2. Invalid shape false Hu
    session.snapshot.set(
      buildSnapshot('3p', {
        lastPenalty: {
          seat: 1,
          actionType: 'win',
          isFalseWin: true,
          reasonCode: 'FALSE_WIN_SHAPE',
          minFan: 5,
          eachGain: 48,
          totalLost: 96,
        },
      })
    );
    fixture.detectChanges();
    expect(hostEl.querySelector('.penalty-banner')?.textContent).toContain('牌型不符');

    // 3. Wrong meld call penalty
    session.snapshot.set(
      buildSnapshot('3p', {
        lastPenalty: {
          seat: 2,
          actionType: 'pong',
          isFalseWin: false,
          reasonCode: 'WRONG_PONG',
          minFan: 5,
          eachGain: 24,
          totalLost: 48,
        },
      })
    );
    fixture.detectChanges();
    expect(hostEl.querySelector('.penalty-banner')?.textContent).toContain('错章罚分');
  });

  it('renders handOver settlement modal for win and draw outcomes with desktop table, mobile cards, and footer actions', () => {
    const nextHandSpy = vi.spyOn(session, 'nextHand');
    const returnLobbySpy = vi.spyOn(session, 'returnToLobby');

    const fixture = TestBed.createComponent(TableComponent);
    const hostEl = fixture.nativeElement as HTMLElement;

    // 1. Discarder-pays capped Win settlement as Host
    session.snapshot.set(
      buildSnapshot(
        '3p',
        {
          phase: 'handOver',
          scores: [1384, 616, 1000],
          result: {
            outcome: 'win',
            winnerSeat: 0,
            loserSeat: 1,
            selfDraw: false,
            winningTileId: 'p1_0',
            fanResult: {
              isShapeValid: true,
              canWin: true,
              rawFan: 12,
              cappedFan: 10,
              items: [
                { name: '清一色', fan: 7 },
                { name: '对对胡', fan: 3 },
              ],
            },
            base: 128,
            deltas: [384, -384, 0],
            winningHand: ['p1_0', 'p1_1'],
            winningMelds: [{ type: 'pong', codes: ['p2', 'p2', 'p2'], concealed: false }],
            winningBonus: ['an1_0'],
          },
        },
        'host'
      )
    );
    fixture.detectChanges();

    expect(hostEl.querySelectorAll('.modal-header button').length).toBe(0);
    expect(hostEl.querySelector('#settlement-title')?.textContent).toContain('10 番');
    expect(hostEl.querySelector('#settlement-title')?.textContent).toContain('12 番');
    expect(hostEl.querySelector('.settlement-sub')?.textContent).toContain('点炮包付');
    expect(hostEl.querySelectorAll('.fan-tag').length).toBe(2);
    expect(hostEl.querySelectorAll('.winning-showcase .bonus-row mj-tile').length).toBe(1);
    expect(hostEl.querySelectorAll('.modal-card .desktop-table tbody tr').length).toBe(3);
    expect(hostEl.querySelectorAll('.modal-card .mobile-cards .mobile-app-card').length).toBe(3);
    expect(hostEl.querySelectorAll('.pos-delta').length).toBe(2);
    expect(hostEl.querySelectorAll('.neg-delta').length).toBe(2);

    const hostFooterBtns = hostEl.querySelectorAll('.modal-footer button');
    expect(hostFooterBtns.length).toBe(2);
    (hostFooterBtns.item(0) as HTMLButtonElement).click();
    expect(returnLobbySpy).toHaveBeenCalledTimes(1);

    (hostFooterBtns.item(1) as HTMLButtonElement).click();
    expect(nextHandSpy).toHaveBeenCalledTimes(1);

    // 2. Self-draw win subtitle check
    session.snapshot.set(
      buildSnapshot(
        '3p',
        {
          phase: 'handOver',
          scores: [1256, 872, 872],
          result: {
            outcome: 'win',
            winnerSeat: 0,
            loserSeat: null,
            selfDraw: true,
            winningTileId: 'p9_0',
            fanResult: {
              isShapeValid: true,
              canWin: true,
              rawFan: 7,
              cappedFan: 7,
              items: [{ name: '清一色', fan: 7 }],
            },
            base: 64,
            deltas: [256, -128, -128],
            winningHand: ['p9_0', 'p9_1'],
          },
        },
        'host'
      )
    );
    fixture.detectChanges();
    expect(hostEl.querySelector('.settlement-sub')?.textContent).toContain('自摸');

    // 3. Draw settlement as Guest -> renders draw heading and wait-next-label without host buttons
    session.snapshot.set(
      buildSnapshot(
        '3p',
        {
          phase: 'handOver',
          result: {
            outcome: 'draw',
            winnerSeat: null,
            loserSeat: null,
            selfDraw: false,
            fanResult: null,
            deltas: [0, 0, 0],
          },
        },
        'guest'
      )
    );
    fixture.detectChanges();

    expect(hostEl.querySelector('#settlement-title')?.textContent).toContain('流局');
    expect(hostEl.querySelectorAll('.fan-tag').length).toBe(0);
    expect(hostEl.querySelectorAll('.modal-footer button').length).toBe(0);
    expect(hostEl.querySelector('.wait-next-label')?.textContent).toContain('等待房主');
  });
});
