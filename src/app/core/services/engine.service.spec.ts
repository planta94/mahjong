import { TestBed } from '@angular/core/testing';
import {
  EngineService,
  applyAction,
  createMatch,
  getLegalActions,
  getPlayerView,
  startNewHand,
} from './engine.service';

describe('EngineService & Match State Machine', () => {
  it('initializes 3P and 4P matches with block dealing and sanitizes opponent hands in getPlayerView', () => {
    TestBed.configureTestingModule({});
    const engine = TestBed.inject(EngineService);

    const match3 = engine.createMatch({ mode: '3p' });
    expect(match3.numSeats).toBe(3);
    expect(match3.players.length).toBe(3);
    expect(match3.players.at(0)?.hand.length).toBe(14);
    expect(match3.players.at(1)?.hand.length).toBe(13);
    expect(match3.players.at(2)?.hand.length).toBe(13);

    const view1 = engine.getPlayerView(match3, 1);
    expect(view1.players.at(1)?.hand?.length).toBe(13);
    expect(view1.players.at(0)?.hand).toBeNull();
    expect(view1.players.at(0)?.handCount).toBe(14);
  });

  it('supports exposeFly, concealedKong, addedKong, robKong win, and claim priority resolution', () => {
    const m = createMatch({ mode: '3p' });
    const p0 = m.players.at(0)!;
    const p1 = m.players.at(1)!;
    const p2 = m.players.at(2)!;

    // 1. Expose Fly via manual tileIds (+1 fan & replacement draw)
    p0.hand = [
      'jk_0', 'p1_0', 'p1_1', 'p1_2', 'p1_3',
      'p2_0', 'p3_0', 'p4_0', 'p5_0', 'p6_0', 'p7_0', 'p8_0', 'p9_0', 'dr_0',
    ];
    m.wall = ['we_0', 'we_1', 'we_2'];
    applyAction(m, 0, { type: 'exposeFly', tileIds: ['jk_0'] });
    expect(p0.bonus.includes('jk_0')).toBe(true);

    // 2. Concealed Kong via manual 4-tile tileIds
    const legalAfterFly = getLegalActions(m, 0);
    expect(legalAfterFly?.phase).toBe('turn');
    applyAction(m, 0, { type: 'kong', tileIds: ['p1_0', 'p1_1', 'p1_2', 'p1_3'] });
    expect(p0.melds.at(0)?.concealed).toBe(true);

    // Concealed Kong masked as 'back' (and tileIds stripped) for opponent
    const oppView = getPlayerView(m, 1);
    expect(oppView.players.at(0)?.melds.at(0)?.codes).toEqual(['back', 'back', 'back', 'back']);
    expect(oppView.players.at(0)?.melds.at(0)?.tileIds).toBeUndefined();

    // 3. Claim Priority: Seat 2 Win beats Seat 1 Pong
    p0.melds = [];
    p0.hand = [
      'p9_0', 'p2_0', 'p3_0', 'p4_0', 'p5_0', 'p6_0', 'p7_0',
      'we_0', 'ws_0', 'ww_0', 'wn_0', 'dr_0', 'dg_0', 'dw_0',
    ];
    p1.hand = [
      'p9_1', 'p9_2', 'p1_0', 'p2_1', 'p3_1', 'p4_1', 'p5_1',
      'we_1', 'ws_1', 'ww_1', 'wn_1', 'dr_1', 'dg_1',
    ];
    p2.hand = [
      'p1_1', 'p2_2', 'p3_2', 'p4_2', 'p5_2', 'p6_2',
      'p7_2', 'p8_2', 'p9_3', 'p2_3', 'p3_3', 'p4_3', 'p9_4',
    ];
    p2.bonus = [];

    applyAction(m, 0, { type: 'discard', tileId: 'p9_0' });
    expect(m.phase).toBe('claim');

    applyAction(m, 1, { type: 'pong', tileIds: ['p9_1', 'p9_2'] });
    expect(m.phase).toBe('claim');

    applyAction(m, 2, { type: 'win' });
    expect(m.phase).toBe('handOver');
    expect(m.result?.winnerSeat).toBe(2);
    expect(m.result?.loserSeat).toBe(0);

    // Non-dealer won -> dealer rotates on next hand
    startNewHand(m);
    expect(m.dealerSeat).toBe(1);
  });

  it('handles pong, chow, addedKong robKong pass across all seats, and exhaustive draw', () => {
    const m = createMatch({ mode: '4p' });
    const p0 = m.players.at(0)!;
    const p1 = m.players.at(1)!;
    const p2 = m.players.at(2)!;
    const p3 = m.players.at(3)!;

    p0.hand = [
      'm2_0', 'm5_0', 'm6_0', 'p1_0', 'p2_0', 'p3_0', 's1_0',
      's2_0', 's3_0', 'we_0', 'ws_0', 'ww_0', 'wn_0', 'dr_0',
    ];
    p1.hand = [
      'm1_0', 'm3_0', 'p4_0', 'p5_0', 'p6_0', 's4_0', 's5_0',
      's6_0', 'we_1', 'ws_1', 'ww_1', 'wn_1', 'dr_1',
    ];
    p2.hand = ['p7_0', 'p8_0', 'p9_0', 's7_0', 's8_0', 's9_0', 'we_2', 'ws_2', 'ww_2', 'wn_2', 'dr_2', 'dg_0', 'dw_0'];
    p3.hand = ['m7_0', 'm8_0', 'm9_0', 'p7_1', 'p8_1', 'p9_1', 'we_3', 'ws_3', 'ww_3', 'wn_3', 'dr_3', 'dg_1', 'dw_1'];

    applyAction(m, 0, { type: 'discard', tileId: 'm2_0' });
    expect(m.phase).toBe('claim');
    applyAction(m, 1, { type: 'chow', tileIds: ['m1_0', 'm3_0'] });
    applyAction(m, 2, { type: 'pass' });
    applyAction(m, 3, { type: 'pass' });
    expect(m.phase).toBe('turn');
    expect(m.turnSeat).toBe(1);
    expect(p1.melds.at(0)?.type).toBe('chow');

    // Added Kong via manual 1-tile tileIds with RobKong pass from all other seats
    p1.melds.push({
      type: 'pong',
      codes: ['dr', 'dr', 'dr'],
      tileIds: ['dr_0', 'dr_1', 'dr_2'],
      concealed: false,
    });
    p1.hand.push('dr_3');
    m.canSelfAct = true;
    m.wall = ['s1_1', 's2_1'];
    applyAction(m, 1, { type: 'kong', tileIds: ['dr_3'] });
    expect(m.phase).toBe('robKong');
    applyAction(m, 0, { type: 'pass' });
    applyAction(m, 2, { type: 'pass' });
    applyAction(m, 3, { type: 'pass' });
    expect(m.phase).toBe('turn');
    expect(m.turnSeat).toBe(1);

    // Exhaustive draw when wall is empty on next advance
    m.wall = [];
    const discardCandidate = p1.hand.at(0)!;
    applyAction(m, 1, { type: 'discard', tileId: discardCandidate });
    if (m.phase === 'claim' && m.pendingClaims) {
      for (const s of m.pendingClaims.bySeat.keys()) {
        applyAction(m, s, { type: 'pass' });
      }
    }
    expect(m.phase).toBe('handOver');
    expect(m.result?.outcome).toBe('draw');
  });

  it('supports 3P Fly wildcard Pong/Chow and penalizes False Hu and Wrong Calls', () => {
    const m = createMatch({ mode: '3p', startingScore: 1000 });
    const p0 = m.players.at(0)!;
    const p1 = m.players.at(1)!;
    const p2 = m.players.at(2)!;

    // 1. Out-of-turn wrong Pong by Seat 2 during Seat 0's turn -> base(5)=24 each (-48)
    applyAction(m, 2, { type: 'pong', tileIds: [] });
    expect(m.scores).toEqual([1024, 1024, 952]);
    expect(m.lastPenalty?.reasonCode).toBe('OUT_OF_TURN');

    // 2. False Self-Draw Win (invalid shape) by Seat 0 -> 2*base(5)=48 each (-96)
    p0.hand = [
      'p3_0', 'p5_0', 'p7_0', 'p9_0', 'we_0', 'ws_0', 'ww_0',
      'wn_0', 'dr_0', 'dg_0', 'dw_0', 'p1_0', 'p2_0', 'p8_0',
    ];
    applyAction(m, 0, { type: 'win' });
    expect(m.scores).toEqual([928, 1072, 1000]);
    expect(m.lastPenalty?.isFalseWin).toBe(true);
    expect(m.lastPenalty?.reasonCode).toBe('FALSE_WIN_SHAPE');

    // 3. Seat 0 discards p3_0; Seat 1 calls Chow using p1_1 + jk_0 wildcard; Seat 2 makes wrong Pong
    p1.hand = [
      'p1_1', 'jk_0', 'p5_1', 'p5_2', 'p6_1', 'p7_1', 'p8_1',
      'we_1', 'ws_1', 'ww_1', 'dr_1', 'dg_1', 'dw_1',
    ];
    p2.hand = [
      'p4_1', 'p6_2', 'p7_2', 'p8_2', 'p9_2', 'we_2', 'ws_2',
      'ww_2', 'wn_2', 'dr_2', 'dg_2', 'dw_2', 'p2_2',
    ];
    applyAction(m, 0, { type: 'discard', tileId: 'p3_0' });
    expect(m.phase).toBe('claim');

    // Seat 2 tries wrong Pong with non-matching tiles -> penalized -48 and auto-converted to pass
    applyAction(m, 2, { type: 'pong', tileIds: ['p4_1', 'p6_2'] });
    expect(m.lastPenalty?.reasonCode).toBe('WRONG_PONG');
    expect(m.scores).toEqual([952, 1096, 952]);

    // Seat 1 completes valid wildcard Chow (p1_1 + jk_0 + p3_0 -> p1,p2,p3)
    applyAction(m, 1, { type: 'chow', tileIds: ['p1_1', 'jk_0'] });
    expect(m.phase).toBe('turn');
    expect(m.turnSeat).toBe(1);
    expect(p1.melds.at(0)?.codes).toEqual(['p1', 'p2', 'p3']);
    expect(p1.melds.at(0)?.tileIds).toEqual(['p1_1', 'jk_0', 'p3_0']);

    // 4. Seat 1 discards p8_1; Seat 2 calls valid wildcard Pong if holding jk + p8
    p2.hand = [
      'p8_2', 'jk_1', 'p4_1', 'p6_2', 'p7_2', 'p9_2', 'we_2',
      'ws_2', 'ww_2', 'wn_2', 'dr_2', 'dg_2', 'dw_2',
    ];
    applyAction(m, 1, { type: 'discard', tileId: 'p8_1' });
    applyAction(m, 0, { type: 'pass' });
    applyAction(m, 2, { type: 'pong', tileIds: ['p8_2', 'jk_1'] });
    expect(m.phase).toBe('turn');
    expect(m.turnSeat).toBe(2);
    expect(p2.melds.at(0)?.codes).toEqual(['p8', 'p8', 'p8']);

    // 5. Immediately after Pong (canSelfAct === false), retrieveFly is penalized as WRONG_FLY
    p2.hand.splice(0, 1, 'p8_0');
    applyAction(m, 2, { type: 'retrieveFly', tileIds: ['p8_0'] });
    expect(m.lastPenalty?.reasonCode).toBe('WRONG_FLY');

    // 6. On a normal self-draw turn (canSelfAct === true), Seat 2 retrieves jk_1 from Pong using p8_0,
    //    which turns the Pong into 3 real p8 tiles and unlocks Added Kong when holding 4th p8_3!
    m.canSelfAct = true;
    m.wall = ['we_3', 'ws_3', 'ww_3'];
    p2.hand = [
      'p8_0', 'p8_3', 'p6_2', 'p7_2', 'p9_2', 'we_2',
      'ws_2', 'ww_2', 'wn_2', 'dr_2', 'dw_2',
    ];
    const p2LegalBefore = getLegalActions(m, 2);
    expect(p2LegalBefore?.phase).toBe('turn');
    if (p2LegalBefore?.phase === 'turn') {
      expect(p2LegalBefore.retrieveFlys).toEqual(['p8']);
      expect(p2LegalBefore.addedKongs).toEqual([]);
    }

    // Wrong tile for retrieveFly triggers WRONG_FLY
    applyAction(m, 2, { type: 'retrieveFly', tileIds: ['we_2'] });
    expect(m.lastPenalty?.reasonCode).toBe('WRONG_FLY');

    // Valid retrieveFly swaps p8_0 into the Pong and returns jk_1 to hand
    applyAction(m, 2, { type: 'retrieveFly', tileIds: ['p8_0'] });
    expect(m.lastPenalty).toBeNull();
    expect(p2.melds.at(0)?.tileIds).toEqual(['p8_2', 'p8_0', 'p8_1']);
    expect(p2.hand.includes('jk_1')).toBe(true);
    expect(p2.hand.includes('p8_0')).toBe(false);
    expect(p2.hand.length).toBe(11);

    // Now the natural Pong [p8,p8,p8] can be upgraded to Added Kong with p8_3!
    const p2LegalAfter = getLegalActions(m, 2);
    if (p2LegalAfter?.phase === 'turn') {
      expect(p2LegalAfter.addedKongs).toEqual(['p8']);
    }
    applyAction(m, 2, { type: 'kong', tileIds: ['p8_3'] });
    if (m.phase === 'robKong') {
      applyAction(m, 0, { type: 'pass' });
      applyAction(m, 1, { type: 'pass' });
    }
    expect(p2.melds.at(0)?.type).toBe('kong');
    expect(p2.melds.at(0)?.codes).toEqual(['p8', 'p8', 'p8', 'p8']);

    // 7. Retrieve Fly from open-ended wildcard Chow ([p4, p5, jk] + p3 -> [p3, p4, p5]) and 2-joker Chow
    p1.melds = [
      {
        type: 'chow',
        codes: ['p4', 'p5', 'p6'],
        tileIds: ['p4_0', 'p5_0', 'jk_0'],
        concealed: false,
        fromSeat: 0,
      },
      {
        type: 'chow',
        codes: ['p5', 'p6', 'p7'],
        tileIds: ['p5_1', 'jk_2', 'jk_3'],
        concealed: false,
        fromSeat: 0,
      },
    ];
    m.phase = 'turn';
    m.turnSeat = 1;
    m.canSelfAct = true;
    p1.hand = ['p3_1', 'p7_3', 'dr_1', 'dr_2', 'dg_1', 'dg_2', 'dw_1', 'dw_2'];
    applyAction(m, 1, { type: 'retrieveFly', tileIds: ['p3_1'] });
    expect(p1.melds.at(0)?.codes).toEqual(['p3', 'p4', 'p5']);
    expect(p1.melds.at(0)?.tileIds).toEqual(['p3_1', 'p4_0', 'p5_0']);
    expect(p1.hand.includes('jk_0')).toBe(true);

    applyAction(m, 1, { type: 'retrieveFly', code: 'p7' });
    expect(p1.melds.at(1)?.codes).toEqual(['p5', 'p6', 'p7']);
    expect(p1.melds.at(1)?.tileIds).toEqual(['p5_1', 'jk_3', 'p7_3']);
    expect(p1.hand.includes('jk_2')).toBe(true);
  });

  it('covers chicken-hand FALSE_WIN_FAN, open Kong claim, robKong win, and wrong Kong/Chow/Fly penalties', () => {
    const m = createMatch({ mode: '4p', startingScore: 1000 });
    const p0 = m.players.at(0)!;
    const p1 = m.players.at(1)!;
    const p2 = m.players.at(2)!;
    const p3 = m.players.at(3)!;

    // 1. Chicken hand (< 5 Fan) on turn triggers FALSE_WIN_FAN
    m.isFirstGoAround = false;
    p0.bonus = ['f2_0']; // off-seat flower -> 0 bonus fan
    p0.melds = [{ type: 'chow', codes: ['m1', 'm2', 'm3'], concealed: false, fromSeat: 3 }];
    p0.hand = [
      'p2_0', 'p3_0', 'p4_0',
      's5_0', 's6_0', 's7_0',
      'm7_0', 'm8_0', 'm9_0',
      'ws_0', 'ws_1',
    ];
    applyAction(m, 0, { type: 'win' });
    expect(m.lastPenalty?.reasonCode).toBe('FALSE_WIN_FAN');
    expect(m.lastPenalty?.rawFan).toBe(2);

    // Wrong turn calls (pong, chow, exposeFly in 4p, bad kong)
    applyAction(m, 0, { type: 'pong' });
    expect(m.lastPenalty?.reasonCode).toBe('WRONG_PONG');
    applyAction(m, 0, { type: 'chow' });
    expect(m.lastPenalty?.reasonCode).toBe('WRONG_CHOW');
    applyAction(m, 0, { type: 'exposeFly' });
    expect(m.lastPenalty?.reasonCode).toBe('WRONG_FLY');
    applyAction(m, 0, { type: 'retrieveFly' });
    expect(m.lastPenalty?.reasonCode).toBe('WRONG_FLY');
    applyAction(m, 0, { type: 'kong', tileIds: ['p2_0', 'p3_0'] });
    expect(m.lastPenalty?.reasonCode).toBe('WRONG_KONG');

    // 2. Open Kong claim by Seat 2 (3 matching tiles in hand) + wrong chow/kong by Seat 1 & Seat 3
    p1.hand = ['m4_0', 'm6_0', 'p1_0', 'p2_1', 'p3_1', 's1_0', 's2_0', 's3_0', 'we_0', 'ws_2', 'ww_0', 'wn_0', 'dg_0'];
    p2.hand = ['p4_1', 'p4_2', 'p4_3', 's4_0', 's5_1', 's6_1', 'we_1', 'ws_3', 'ww_1', 'wn_1', 'dr_0', 'dg_1', 'dw_0'];
    p3.hand = ['m1_1', 'm2_1', 'm3_1', 'p7_0', 'p8_0', 'p9_0', 'we_2', 'ww_2', 'wn_2', 'dr_1', 'dr_2', 'dg_2', 'dw_1'];
    m.wall = ['s9_0', 's9_1', 's9_2'];

    applyAction(m, 0, { type: 'discard', tileId: 'p4_0' });
    expect(m.phase).toBe('claim');
    applyAction(m, 1, { type: 'chow', tileIds: ['m4_0', 'm6_0'] });
    expect(m.lastPenalty?.reasonCode).toBe('WRONG_CHOW');
    applyAction(m, 3, { type: 'kong', tileIds: ['m1_1', 'm2_1', 'm3_1'] });
    expect(m.lastPenalty?.reasonCode).toBe('WRONG_KONG');
    applyAction(m, 2, { type: 'kong', tileIds: ['p4_1', 'p4_2', 'p4_3'] });
    expect(m.phase).toBe('turn');
    expect(m.turnSeat).toBe(2);
    expect(p2.melds.at(0)?.type).toBe('kong');

    // 3. Added Kong robbed by Seat 3 (Robbing the Kong Pure One Suit win!)
    p2.melds.push({
      type: 'pong',
      codes: ['p1', 'p1', 'p1'],
      tileIds: ['p1_1', 'p1_2', 'p1_3'],
      concealed: false,
    });
    p2.hand.push('p1_0');
    p3.bonus = [];
    p3.melds = [];
    p3.hand = [
      'p1_9', 'p2_2', 'p3_2',
      'p4_9', 'p5_2', 'p6_2',
      'p7_2', 'p8_2', 'p9_2',
      'p2_3', 'p3_3', 'p4_8',
      'p5_3',
    ];
    // Wait: p3 needs p1 to complete pair of p1 (already has p1_9 + 4 sequences = 7 Fan Pure One Suit + 1 Rob Kong!)
    p3.hand = [
      'p1_9',
      'p2_2', 'p3_2', 'p4_8',
      'p2_3', 'p3_3', 'p4_9',
      'p5_2', 'p6_2', 'p7_2',
      'p7_3', 'p8_2', 'p9_2',
    ];
    applyAction(m, 2, { type: 'addedKong', code: 'p1' });
    expect(m.phase).toBe('robKong');

    // Seat 0 makes wrong pong during robKong -> penalized + treated as pass
    applyAction(m, 0, { type: 'pong', tileIds: [] });
    expect(m.lastPenalty?.reasonCode).toBe('WRONG_PONG');
    // Seat 1 makes false win during robKong -> penalized + treated as pass
    applyAction(m, 1, { type: 'win' });
    expect(m.lastPenalty?.isFalseWin).toBe(true);
    // Seat 3 robs the Kong to win!
    applyAction(m, 3, { type: 'win' });
    expect(m.phase).toBe('handOver');
    expect(m.result?.winnerSeat).toBe(3);
    expect(m.result?.loserSeat).toBe(2);
  });
});
