import { TestBed } from '@angular/core/testing';
import { PlayerPublicState, PlayerView } from '../models/mahjong.model';
import { BotService, chooseBotAction } from './bot.service';
import { applyAction, createMatch, getPlayerView } from './engine.service';

function createMockOpponent(seat: number): PlayerPublicState {
  return {
    seat,
    seatWind: seat,
    handCount: 13,
    hand: null,
    lastDrawnId: null,
    melds: [],
    bonus: [],
    discards: [],
  };
}

function createMockView(overrides?: Partial<PlayerView>): PlayerView {
  const defaultPlayer: PlayerPublicState = {
    seat: 0,
    seatWind: 0,
    handCount: 14,
    hand: [
      'p1_0', 'p2_0', 'p3_0',
      'p4_0', 'p5_0', 'p6_0',
      'p7_0', 'p8_0', 'p9_0',
      'p1_1', 'p2_1', 'p3_1',
      'p5_1', 'p5_2',
    ],
    lastDrawnId: 'p5_2',
    melds: [],
    bonus: [],
    discards: [],
  };

  return {
    mode: '4p',
    numSeats: 4,
    rules: { minFan: 5, maxFan: 10, concealedFan: true, sevenPairs: true },
    roundWind: 0,
    dealerSeat: 0,
    dealerStreak: 0,
    handNumber: 0,
    scores: [1000, 1000, 1000, 1000],
    phase: 'turn',
    wallCount: 50,
    turnSeat: 0,
    lastDiscard: null,
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
    players: [defaultPlayer, createMockOpponent(1), createMockOpponent(2), createMockOpponent(3)],
    log: [],
    result: null,
    ...overrides,
  };
}


describe('BotService & Tactical 5-Fan AI Decisions', () => {
  it('locks onto exact 5-Fan Tenpai discards, preserves All-Pongs, exposes 3P Fly strategically, and completes simulations', () => {
    TestBed.configureTestingModule({});
    const bot = TestBed.inject(BotService);

    // 1. Exact 1-ply Tenpai search: discards off-suit m9_0 to maintain Pure One Suit Tenpai
    const m = createMatch({ mode: '4p' });
    const p0 = m.players.at(0)!;
    const p1 = m.players.at(1)!;
    p0.bonus = [];
    p0.hand = [
      'm9_0',
      'p1_0', 'p2_0', 'p3_0',
      'p4_0', 'p5_0', 'p6_0',
      'p7_0', 'p8_0', 'p9_0',
      'p2_1', 'p3_1',
      'p5_1', 'p5_2',
    ];
    const tenpaiAct = bot.chooseAction(getPlayerView(m, 0));
    expect(tenpaiAct).toEqual({ type: 'discard', tileId: 'm9_0' });

    // 2. Multi-suit All-Pongs + Dragon pairs: discards isolated singleton instead of breaking off-suit triplets!
    const mPongs = createMatch({ mode: '4p' });
    const mp0 = mPongs.players.at(0)!;
    mp0.hand = [
      'm2_0', 'm2_1', 'm2_2',
      'p6_0', 'p6_1', 'p6_2',
      's8_0', 's8_1',
      'dr_0', 'dr_1',
      'dg_0', 'dg_1',
      'm9_0', 'ws_0',
    ];
    const pongPlanAct = chooseBotAction(getPlayerView(mPongs, 0));
    expect(pongPlanAct?.type).toBe('discard');
    expect(['m9_0', 'ws_0'].includes(pongPlanAct?.tileId ?? '')).toBe(true);

    // 3. Claim: fan honor pong accepted
    p0.hand = [
      'dr_0', 'p1_0', 'p2_0', 'p3_0', 'p4_0', 'p5_0', 'p6_0',
      'p7_0', 'p8_0', 'p9_0', 's1_0', 's2_0', 's3_0', 's4_0',
    ];
    p1.melds = [];
    p1.hand = [
      'dr_1', 'dr_2', 'p1_1', 'p2_1', 'p4_1', 'p5_1', 'p7_1',
      'p8_1', 'p9_1', 's1_1', 's5_1', 'we_0', 'we_1',
    ];
    applyAction(m, 0, { type: 'discard', tileId: 'dr_0' });
    const claimPong = chooseBotAction(getPlayerView(m, 1));
    expect(claimPong?.type).toBe('pong');

    // 4. Claim: chow on pure flush path
    const m2 = createMatch({ mode: '4p' });
    m2.players.at(0)!.hand = [
      'p3_0', 'm1_0', 'm2_0', 'm3_0', 's1_0', 's2_0', 's3_0',
      'we_0', 'ws_0', 'ww_0', 'wn_0', 'dr_0', 'dg_0', 'dw_0',
    ];
    m2.players.at(1)!.hand = [
      'p1_0', 'p2_0', 'p4_0', 'p5_0', 'p6_0', 'p7_0', 'p8_0',
      'p9_0', 'p9_1', 'p2_1', 'p5_1', 'we_1', 'ws_1',
    ];
    applyAction(m2, 0, { type: 'discard', tileId: 'p3_0' });
    const claimChow = chooseBotAction(getPlayerView(m2, 1));
    expect(claimChow?.type).toBe('chow');

    // 5. 3P retrieveFly when holding natural tile matching exposed Fly meld, then exposeFly
    const m3 = createMatch({ mode: '3p' });
    const m3p0 = m3.players.at(0)!;
    m3p0.bonus = ['f2_0'];
    m3p0.melds = [
      {
        type: 'chow',
        codes: ['p1', 'p2', 'p3'],
        tileIds: ['p1_0', 'jk_2', 'p3_0'],
        concealed: false,
        fromSeat: 2,
      },
    ];
    m3p0.hand = [
      'jk_0', 'p2_0', 'p4_0', 'p5_0', 'p7_0', 'p9_0',
      'ws_0', 'ww_0', 'dr_0', 'dg_0', 'dw_0',
    ];
    const retrieveAct = chooseBotAction(getPlayerView(m3, 0));
    expect(retrieveAct).toEqual({ type: 'retrieveFly', code: 'p2' });
    applyAction(m3, 0, retrieveAct!);
    expect(m3p0.hand.includes('jk_2')).toBe(true);

    const flyAct = chooseBotAction(getPlayerView(m3, 0));
    expect(flyAct?.type).toBe('exposeFly');

    // 5b. Seven Pairs preservation + Concealed Kong + Added Kong + RobKong Pass + Self Win
    const m7 = createMatch({ mode: '4p' });
    const p7 = m7.players.at(0)!;
    p7.hand = [
      'm1_0', 'm1_1', 'm5_0', 'm5_1', 'p2_0', 'p2_1',
      'p8_0', 'p8_1', 's4_0', 's4_1', 'dr_0', 'dr_1',
      'we_0', 'wn_0',
    ];
    const sevenAct = chooseBotAction(getPlayerView(m7, 0));
    expect(sevenAct?.type).toBe('discard');
    expect(['we_0', 'wn_0'].includes(sevenAct?.tileId ?? '')).toBe(true);

    // Concealed Kong on turn
    p7.hand = [
      'dr_0', 'dr_1', 'dr_2', 'dr_3',
      'p1_0', 'p2_0', 'p3_0', 'p5_0', 'p6_0', 'p8_0',
      's2_0', 's5_0', 'we_0', 'ws_0',
    ];
    expect(chooseBotAction(getPlayerView(m7, 0))).toEqual({ type: 'concealedKong', code: 'dr' });

    // Added Kong on turn + opponent robKong pass
    p7.melds = [{ type: 'pong', codes: ['dg', 'dg', 'dg'], tileIds: ['dg_0', 'dg_1', 'dg_2'], concealed: false }];
    p7.hand = [
      'dg_3', 'p1_0', 'p2_0', 'p3_0', 'p5_0', 'p6_0', 'p8_0',
      's2_0', 's5_0', 'we_0', 'ws_0',
    ];
    expect(chooseBotAction(getPlayerView(m7, 0))).toEqual({ type: 'addedKong', code: 'dg' });
    applyAction(m7, 0, { type: 'addedKong', code: 'dg' });
    expect(chooseBotAction(getPlayerView(m7, 1))).toEqual({ type: 'pass' });

    // Self-draw Win immediately taken
    const mWin = createMatch({ mode: '3p' });
    mWin.players.at(0)!.bonus = [];
    mWin.players.at(0)!.hand = [
      'p1_0', 'p2_0', 'p3_0',
      'p4_0', 'p5_0', 'p6_0',
      'p7_0', 'p8_0', 'p9_0',
      'p2_1', 'p3_1', 'p4_1',
      'p9_1', 'p9_2',
    ];
    expect(chooseBotAction(getPlayerView(mWin, 0))).toEqual({ type: 'win' });

    // 6. Complete 3P bot simulation for 40 plies with deterministic RNG
    let seed = 123456789;
    const lcgRng = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const sim = createMatch({ mode: '3p', rng: lcgRng });
    for (let step = 0; step < 40 && sim.phase !== 'handOver'; step++) {
      let progressed = false;
      for (let s = 0; s < sim.numSeats; s++) {
        const v = getPlayerView(sim, s);
        const a = chooseBotAction(v);
        if (a) {
          applyAction(sim, s, a);
          progressed = true;
          break;
        }
      }
      expect(progressed).toBe(true);
      expect(sim.lastPenalty).toBe(null);
    }
  });

  describe('Deterministic Null & Phase Guards', () => {
    it('returns null when legalActions or viewer is missing', () => {
      const v = createMockView();
      expect(chooseBotAction({ ...v, legalActions: null })).toBe(null);
      expect(chooseBotAction({ ...v, viewerSeat: 99 })).toBe(null);
      expect(
        chooseBotAction({
          ...v,
          legalActions: { ...v.legalActions!, phase: 'setup' } as unknown as typeof v.legalActions,
        })
      ).toBe(null);
    });

    it('returns pass on robKong phase', () => {
      const v = createMockView({
        legalActions: {
          phase: 'robKong',
          tileId: 'dr_0',
          fromSeat: 1,
          win: null,
        },
      });
      expect(chooseBotAction(v)).toEqual({ type: 'pass' });
    });

    it('returns win immediately whenever legalActions.win is present', () => {
      const winEval = {
        isShapeValid: true,
        canWin: true,
        rawFan: 5,
        cappedFan: 5,
        items: [{ name: '清一色', fan: 7 }],
      };
      const v = createMockView({
        legalActions: {
          phase: 'claim',
          tileId: 'p9_0',
          fromSeat: 1,
          win: winEval,
          canKong: false,
          canPong: false,
          chows: [],
        },
      });
      expect(chooseBotAction(v)).toEqual({ type: 'win' });
    });
  });

  describe('Deterministic Claim Decisions (Pong, Kong, Chow, Pass)', () => {
    it('passes during claim phase when committed to Seven Pairs without Kong', () => {
      const v = createMockView({
        players: [
          {
            seat: 0,
            seatWind: 0,
            handCount: 13,
            hand: [
              'm1_0', 'm1_1', 'm2_0', 'm2_1', 'm3_0', 'm3_1',
              'm4_0', 'm4_1', 'm5_0', 'm5_1', 's1_0', 's2_0', 's3_0',
            ],
            lastDrawnId: null,
            melds: [],
            bonus: [],
            discards: [],
          },
          createMockOpponent(1),
          createMockOpponent(2),
          createMockOpponent(3),
        ],
        legalActions: {
          phase: 'claim',
          tileId: 's1_1',
          fromSeat: 3,
          win: null,
          canKong: false,
          canPong: true,
          chows: [],
        },
      });
      expect(chooseBotAction(v)).toEqual({ type: 'pass' });
    });

    it('passes claim when discard suit is inconsistent with open flush suit', () => {
      const v = createMockView({
        players: [
          {
            seat: 0,
            seatWind: 0,
            handCount: 10,
            hand: [
              'm2_0', 'm2_1',
              'p1_0', 'p2_0', 'p3_0',
              'p4_0', 'p5_0', 'p6_0',
              'p7_0', 'p8_0',
            ],
            lastDrawnId: null,
            melds: [
              { type: 'chow', codes: ['p1', 'p2', 'p3'], tileIds: ['p1_1', 'p2_1', 'p3_1'], concealed: false },
            ],
            bonus: [],
            discards: [],
          },
          createMockOpponent(1),
          createMockOpponent(2),
          createMockOpponent(3),
        ],
        legalActions: {
          phase: 'claim',
          tileId: 'm2_2',
          fromSeat: 1,
          win: null,
          canKong: false,
          canPong: true,
          chows: [],
        },
      });
      expect(chooseBotAction(v)).toEqual({ type: 'pass' });
    });

    it('claims Kong deterministically when holding matching triplet', () => {
      const v = createMockView({
        players: [
          {
            seat: 0,
            seatWind: 0,
            handCount: 13,
            hand: [
              'dr_0', 'dr_1', 'dr_2',
              'p1_0', 'p2_0', 'p3_0',
              'p4_0', 'p5_0', 'p6_0',
              'p7_0', 'p8_0', 'p9_0', 'p9_1',
            ],
            lastDrawnId: null,
            melds: [],
            bonus: [],
            discards: [],
          },
          createMockOpponent(1),
          createMockOpponent(2),
          createMockOpponent(3),
        ],
        legalActions: {
          phase: 'claim',
          tileId: 'dr_3',
          fromSeat: 1,
          win: null,
          canKong: true,
          canPong: true,
          chows: [],
        },
      });
      expect(chooseBotAction(v)).toEqual({ type: 'kong' });
    });

    it('claims Pong deterministically when pong leads directly to Tenpai', () => {
      const v = createMockView({
        players: [
          {
            seat: 0,
            seatWind: 0,
            handCount: 13,
            hand: [
              'p5_0', 'p5_1',
              'p1_0', 'p2_0', 'p3_0',
              'p4_0', 'p5_2', 'p6_0',
              'p7_0', 'p8_0', 'p9_0',
              's1_0', 's1_1',
            ],
            lastDrawnId: null,
            melds: [],
            bonus: [],
            discards: [],
          },
          createMockOpponent(1),
          createMockOpponent(2),
          createMockOpponent(3),
        ],
        legalActions: {
          phase: 'claim',
          tileId: 'p5_3',
          fromSeat: 1,
          win: null,
          canKong: false,
          canPong: true,
          chows: [],
        },
      });
      const action = chooseBotAction(v);
      expect(action?.type).toBe('pong');
    });

    it('claims Pong deterministically on All-Pongs plan', () => {
      const v = createMockView({
        rules: { minFan: 5, maxFan: 10, concealedFan: true, sevenPairs: false },
        players: [
          {
            seat: 0,
            seatWind: 0,
            handCount: 13,
            hand: [
              'p2_0', 'p2_1',
              'p4_0', 'p4_1', 'p4_2',
              's3_0', 's3_1', 's3_2',
              'dr_0', 'dr_1',
              'dg_0', 'dg_1', 'dw_0',
            ],
            lastDrawnId: null,
            melds: [],
            bonus: [],
            discards: [],
          },
          createMockOpponent(1),
          createMockOpponent(2),
          createMockOpponent(3),
        ],
        legalActions: {
          phase: 'claim',
          tileId: 'p2_2',
          fromSeat: 1,
          win: null,
          canKong: false,
          canPong: true,
          chows: [],
        },
      });
      expect(chooseBotAction(v)).toEqual({ type: 'pong' });
    });

    it('claims Chow leading directly to Tenpai', () => {
      const v = createMockView({
        players: [
          {
            seat: 0,
            seatWind: 0,
            handCount: 13,
            hand: [
              'p2_0', 'p3_0',
              'p4_0', 'p5_0', 'p6_0',
              'p7_0', 'p8_0', 'p9_0',
              'p9_1', 'p9_2', 'p9_3',
              'p5_1', 'p5_2',
            ],
            lastDrawnId: null,
            melds: [],
            bonus: [],
            discards: [],
          },
          createMockOpponent(1),
          createMockOpponent(2),
          createMockOpponent(3),
        ],
        legalActions: {
          phase: 'claim',
          tileId: 'p1_0',
          fromSeat: 3,
          win: null,
          canKong: false,
          canPong: false,
          chows: [
            { partnerCodes: ['p2', 'p3'], meldCodes: ['p1', 'p2', 'p3'] },
          ],
        },
      });
      const action = chooseBotAction(v);
      expect(action?.type).toBe('chow');
    });

    it('passes Chow when penalty is too high due to breaking triplets', () => {
      const v = createMockView({
        players: [
          {
            seat: 0,
            seatWind: 0,
            handCount: 13,
            hand: [
              'p2_0', 'p2_1', 'p2_2',
              'p3_0', 'p3_1', 'p3_2',
              's1_0', 's2_0', 's3_0',
              'm1_0', 'm2_0', 'm3_0', 'm9_0',
            ],
            lastDrawnId: null,
            melds: [],
            bonus: [],
            discards: [],
          },
          createMockOpponent(1),
          createMockOpponent(2),
          createMockOpponent(3),
        ],
        legalActions: {
          phase: 'claim',
          tileId: 'p1_0',
          fromSeat: 3,
          win: null,
          canKong: false,
          canPong: false,
          chows: [
            { partnerCodes: ['p2', 'p3'], meldCodes: ['p1', 'p2', 'p3'] },
          ],
        },
      });
      expect(chooseBotAction(v)).toEqual({ type: 'pass' });
    });
  });

  describe('Deterministic Turn & Discard Decisions (Kongs, 3P Fly, Heuristics, Defense)', () => {
    it('executes Concealed Kong when holding four matching tiles', () => {
      const v = createMockView({
        players: [
          {
            seat: 0,
            seatWind: 0,
            handCount: 14,
            hand: [
              'dr_0', 'dr_1', 'dr_2', 'dr_3',
              'p1_0', 'p2_0', 'p3_0',
              'p4_0', 'p5_0', 'p6_0',
              'p7_0', 'p8_0', 'p9_0', 's1_0',
            ],
            lastDrawnId: 'dr_3',
            melds: [],
            bonus: [],
            discards: [],
          },
          createMockOpponent(1),
          createMockOpponent(2),
          createMockOpponent(3),
        ],
        legalActions: {
          phase: 'turn',
          canDiscard: true,
          win: null,
          exposeFly: false,
          retrieveFlys: [],
          concealedKongs: ['dr'],
          addedKongs: [],
        },
      });
      expect(chooseBotAction(v)).toEqual({ type: 'concealedKong', code: 'dr' });
    });

    it('executes Added Kong when discard danger is low', () => {
      const v = createMockView({
        players: [
          {
            seat: 0,
            seatWind: 0,
            handCount: 11,
            hand: [
              'p2_3',
              'p4_0', 'p5_0', 'p6_0',
              'p7_0', 'p8_0', 'p9_0',
              's1_0', 's2_0', 's3_0', 's4_0',
            ],
            lastDrawnId: 'p2_3',
            melds: [
              { type: 'pong', codes: ['p2', 'p2', 'p2'], tileIds: ['p2_0', 'p2_1', 'p2_2'], concealed: false },
            ],
            bonus: [],
            discards: [],
          },
          createMockOpponent(1),
          createMockOpponent(2),
          createMockOpponent(3),
        ],
        legalActions: {
          phase: 'turn',
          canDiscard: true,
          win: null,
          exposeFly: false,
          retrieveFlys: [],
          concealedKongs: [],
          addedKongs: ['p2'],
        },
      });
      expect(chooseBotAction(v)).toEqual({ type: 'addedKong', code: 'p2' });
    });

    it('avoids Added Kong when tile danger is elevated (>= 28) and discards safe tile', () => {
      const opp1: PlayerPublicState = {
        seat: 1,
        seatWind: 1,
        handCount: 4,
        hand: null,
        lastDrawnId: null,
        melds: [
          { type: 'pong', codes: ['p1', 'p1', 'p1'], tileIds: ['p1_0', 'p1_1', 'p1_2'], concealed: false },
          { type: 'pong', codes: ['p3', 'p3', 'p3'], tileIds: ['p3_0', 'p3_1', 'p3_2'], concealed: false },
          { type: 'pong', codes: ['p7', 'p7', 'p7'], tileIds: ['p7_0', 'p7_1', 'p7_2'], concealed: false },
        ],
        bonus: [],
        discards: ['m1_0', 'm9_0'],
      };

      const v = createMockView({
        players: [
          {
            seat: 0,
            seatWind: 0,
            handCount: 11,
            hand: [
              'p5_3',
              's1_0', 's2_0', 's3_0',
              's4_0', 's5_0', 's6_0',
              's7_0', 's8_0', 's9_0', 'm1_1',
            ],
            lastDrawnId: 'p5_3',
            melds: [
              { type: 'pong', codes: ['p5', 'p5', 'p5'], tileIds: ['p5_0', 'p5_1', 'p5_2'], concealed: false },
            ],
            bonus: [],
            discards: [],
          },
          opp1,
          createMockOpponent(2),
          createMockOpponent(3),
        ],
        legalActions: {
          phase: 'turn',
          canDiscard: true,
          win: null,
          exposeFly: false,
          retrieveFlys: [],
          concealedKongs: [],
          addedKongs: ['p5'],
        },
      });

      const act = chooseBotAction(v);
      expect(act?.type).toBe('discard');
    });

    it('exposes Fly in 3P mode when tenpai is one fan short or projected fan is insufficient', () => {
      const m = createMatch({ mode: '3p' });
      const p0 = m.players.at(0)!;
      p0.bonus = ['f2_0'];
      p0.melds = [
        {
          type: 'chow',
          codes: ['p1', 'p2', 'p3'],
          tileIds: ['p1_0', 'jk_2', 'p3_0'],
          concealed: false,
          fromSeat: 2,
        },
      ];
      p0.hand = [
        'jk_0', 'p2_0', 'p4_0', 'p5_0', 'p7_0', 'p9_0',
        'ws_0', 'ww_0', 'dr_0', 'dg_0', 'dw_0',
      ];
      applyAction(m, 0, { type: 'retrieveFly', code: 'p2' });
      const view = getPlayerView(m, 0);
      expect(chooseBotAction(view)).toEqual({ type: 'exposeFly' });
    });

    it('selects defensive discard under high alert when opponent shows 3 melds', () => {
      const opp1: PlayerPublicState = {
        seat: 1,
        seatWind: 1,
        handCount: 4,
        hand: null,
        lastDrawnId: null,
        melds: [
          { type: 'pong', codes: ['p1', 'p1', 'p1'], tileIds: ['p1_0', 'p1_1', 'p1_2'], concealed: false },
          { type: 'pong', codes: ['p2', 'p2', 'p2'], tileIds: ['p2_0', 'p2_1', 'p2_2'], concealed: false },
          { type: 'pong', codes: ['p3', 'p3', 'p3'], tileIds: ['p3_0', 'p3_1', 'p3_2'], concealed: false },
        ],
        bonus: [],
        discards: ['m1_0'],
      };

      const v = createMockView({
        players: [
          {
            seat: 0,
            seatWind: 0,
            handCount: 14,
            hand: [
              'm1_1',
              'p5_0',
              'p5_1',
              's1_0', 's2_0', 's3_0',
              's4_0', 's5_0', 's6_0',
              's7_0', 's8_0', 's9_0',
              'dr_0', 'dg_0',
            ],
            lastDrawnId: 'm1_1',
            melds: [],
            bonus: [],
            discards: [],
          },
          opp1,
          createMockOpponent(2),
          createMockOpponent(3),
        ],
      });

      const act = chooseBotAction(v);
      expect(act?.type).toBe('discard');
      expect(act?.tileId).toBe('m1_1');
    });

    it('prioritizes dead tiles (seen >= 3) when discarding from Seven Pairs hand', () => {
      const opp1: PlayerPublicState = {
        seat: 1,
        seatWind: 1,
        handCount: 13,
        hand: null,
        lastDrawnId: null,
        melds: [],
        bonus: [],
        discards: ['we_1', 'we_2'],
      };
      const opp2: PlayerPublicState = {
        seat: 2,
        seatWind: 2,
        handCount: 13,
        hand: null,
        lastDrawnId: null,
        melds: [],
        bonus: [],
        discards: ['we_3'],
      };

      const v = createMockView({
        players: [
          {
            seat: 0,
            seatWind: 0,
            handCount: 14,
            hand: [
              'm1_0', 'm1_1',
              'm2_0', 'm2_1',
              'p3_0', 'p3_1',
              'p4_0', 'p4_1',
              's5_0', 's5_1',
              'dr_0', 'dr_1',
              'we_0', 'wn_0',
            ],
            lastDrawnId: 'wn_0',
            melds: [],
            bonus: [],
            discards: [],
          },
          opp1,
          opp2,
          createMockOpponent(3),
        ],
      });

      const act = chooseBotAction(v);
      expect(act?.type).toBe('discard');
      expect(act?.tileId).toBe('we_0');
    });
  });
});

