import { TestBed } from '@angular/core/testing';
import { BotService, chooseBotAction } from './bot.service';
import { applyAction, createMatch, getPlayerView } from './engine.service';

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

    // 6. Complete 3P bot simulation for 40 plies without any wrong-call penalties
    const sim = createMatch({ mode: '3p' });
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
      expect(sim.lastPenalty).toBeNull();
    }
  });
});
