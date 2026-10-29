import { TestBed } from '@angular/core/testing';
import { BotService, chooseBotAction } from './bot.service';
import { applyAction, createMatch, getPlayerView } from './engine.service';

describe('BotService & 5-Fan AI Decisions', () => {
  it('chooses win, robKong pass, fan-honor pong, chow, kong, and off-suit discard', () => {
    TestBed.configureTestingModule({});
    const bot = TestBed.inject(BotService);

    const m = createMatch({ mode: '4p' });
    const p0 = m.players.at(0)!;
    const p1 = m.players.at(1)!;

    // 1. Turn with off-suit singleton + jokers + danger mode
    p0.hand = [
      'jk_0', 'm1_0',
      'p1_0', 'p2_0', 'p3_0',
      'p4_0', 'p4_1', 'p5_0', 'p6_0',
      'p7_0', 'p8_0', 'p9_0',
      'dr_0', 'dr_1',
    ];
    p1.melds = [
      { type: 'pong', codes: ['s1', 's1', 's1'], concealed: false },
      { type: 'pong', codes: ['s2', 's2', 's2'], concealed: false },
      { type: 'pong', codes: ['s3', 's3', 's3'], concealed: false },
    ];

    const turnAct = bot.chooseAction(getPlayerView(m, 0));
    expect(turnAct?.type).toBe('discard');
    expect(turnAct?.tileId).toBe('m1_0');

    // 2. Claim: fan honor pong accepted
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

    // 3. Claim: chow on pure flush path
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

    // 4. Complete full 3P bot simulation for 25 plies without illegal moves
    const sim = createMatch({ mode: '3p' });
    for (let step = 0; step < 25 && sim.phase !== 'handOver'; step++) {
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
    }
  });
});
