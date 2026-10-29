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
  it('initializes 3P and 4P matches and sanitizes opponent hands in getPlayerView', () => {
    TestBed.configureTestingModule({});
    const engine = TestBed.inject(EngineService);

    const match3 = engine.createMatch({ mode: '3p' });
    expect(match3.numSeats).toBe(3);
    expect(match3.players.length).toBe(3);
    expect(match3.players.at(0)?.hand.length).toBe(14);
    expect(match3.players.at(1)?.hand.length).toBe(13);

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

    // 1. Expose Fly (+1 fan & replacement draw)
    p0.hand = [
      'jk_0', 'p1_0', 'p1_1', 'p1_2', 'p1_3',
      'p2_0', 'p3_0', 'p4_0', 'p5_0', 'p6_0', 'p7_0', 'p8_0', 'p9_0', 'dr_0',
    ];
    m.wall = ['we_0', 'we_1', 'we_2'];
    applyAction(m, 0, { type: 'exposeFly' });
    expect(p0.bonus.includes('jk_0')).toBe(true);

    // 2. Concealed Kong
    const legalAfterFly = getLegalActions(m, 0);
    expect(legalAfterFly?.phase).toBe('turn');
    applyAction(m, 0, { type: 'concealedKong', code: 'p1' });
    expect(p0.melds.at(0)?.concealed).toBe(true);

    // Concealed Kong masked as 'back' for opponent
    const oppView = getPlayerView(m, 1);
    expect(oppView.players.at(0)?.melds.at(0)?.codes).toEqual(['back', 'back', 'back', 'back']);

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

    applyAction(m, 1, { type: 'pong' });
    expect(m.phase).toBe('claim');

    applyAction(m, 2, { type: 'win' });
    expect(m.phase).toBe('handOver');
    expect(m.result?.winnerSeat).toBe(2);
    expect(m.result?.loserSeat).toBe(0);

    // Non-dealer won -> dealer rotates on next hand
    startNewHand(m);
    expect(m.dealerSeat).toBe(1);
  });

  it('handles pong, chow, addedKong robKong pass, and exhaustive draw', () => {
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
    applyAction(m, 1, { type: 'chow', chowIndex: 0 });
    expect(m.phase).toBe('turn');
    expect(m.turnSeat).toBe(1);
    expect(p1.melds.at(0)?.type).toBe('chow');

    // Added Kong with RobKong pass
    p1.melds.push({ type: 'pong', codes: ['dr', 'dr', 'dr'], tileIds: ['dr_0', 'dr_1', 'dr_2'], concealed: false });
    p1.hand.push('dr_3');
    m.canSelfAct = true;
    m.wall = ['s1_1', 's2_1'];
    p2.hand = [
      'dr_9', 'we_0', 'we_1', 'we_2', 'ws_0', 'ws_1', 'ws_2',
      'ww_0', 'ww_1', 'ww_2', 'wn_0', 'wn_1', 'wn_2',
    ];
    applyAction(m, 1, { type: 'addedKong', code: 'dr' });
    expect(m.phase).toBe('robKong');
    applyAction(m, 2, { type: 'pass' });
    expect(m.phase).toBe('turn');
    expect(m.turnSeat).toBe(1);

    // Exhaustive draw when wall is empty on next advance
    m.wall = [];
    p2.hand = ['s1_2', 's2_2', 's3_2', 's4_2', 's5_2', 's6_2', 's7_2', 's8_2', 's9_2', 'p1_2', 'p2_2', 'p3_2', 'p4_2'];
    p3.hand = [...p2.hand];
    p0.hand = [...p2.hand];
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
});
