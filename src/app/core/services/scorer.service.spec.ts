import { TestBed } from '@angular/core/testing';
import {
  ScorerService,
  calculatePayout,
  evaluateWin,
  getWaitingTiles,
  scoreBonusTiles,
} from './scorer.service';

describe('ScorerService & Fan Evaluation', () => {
  it('scores 4P and 3P bonus tiles including animals, faces, eight immortals, and exposed flys', () => {
    expect(scoreBonusTiles([], 0, '4p').fan).toBe(1);
    expect(scoreBonusTiles(['b1_0', 'f1_0'], 0, '4p').fan).toBe(2);
    expect(scoreBonusTiles(['b1_0', 'b2_0', 'b3_0', 'b4_0'], 1, '4p').fan).toBe(2);

    const eight = scoreBonusTiles(
      ['b1_0', 'b2_0', 'b3_0', 'b4_0', 'f1_0', 'f2_0', 'f3_0', 'f4_0'],
      0,
      '4p'
    );
    expect(eight.eightFlowers).toBe(true);
    expect(eight.fan).toBe(13);

    const my3pBonus = scoreBonusTiles(
      ['an1_0', 'an2_0', 'an3_0', 'an4_0', 'fc1_0', 'fc2_0', 'fc3_0', 'fc4_0', 'jk_0', 'jk_1'],
      0,
      '3p'
    );
    expect(my3pBonus.fan).toBe(10);

    const pairFace = scoreBonusTiles(['fc1_0', 'fc3_0'], 0, '3p');
    expect(pairFace.fan).toBe(1);
  });

  it('enforces 5-fan minimum and evaluates standard, flush, dragon, wind, and limit hands', () => {
    const chicken = evaluateWin({
      handIds: [
        'm1_0', 'm2_0', 'm3_0',
        'p4_0', 'p5_0', 'p6_0',
        's7_0', 's8_0', 's9_0',
        'm7_0', 'm8_0', 'm9_0',
        'p2_0', 'p2_1',
      ],
      bonusIds: ['b2_0'],
      mode: '4p',
      rules: { minFan: 5, maxFan: 10 },
    });
    expect(chicken.isShapeValid).toBe(true);
    expect(chicken.canWin).toBe(false);

    const pureFlush = evaluateWin({
      handIds: [
        'p1_0', 'p2_0', 'p3_0',
        'p4_0', 'p5_0', 'p6_0',
        'p7_0', 'p8_0', 'p9_0',
        'p2_1', 'p3_1', 'p4_1',
        'p9_1', 'p9_2',
      ],
      mode: '4p',
    });
    expect(pureFlush.canWin).toBe(true);
    expect(pureFlush.rawFan).toBeGreaterThanOrEqual(8);

    const nineGates = evaluateWin({
      handIds: [
        'm1_0', 'm1_1', 'm1_2',
        'm2_0', 'm3_0', 'm4_0', 'm5_0', 'm6_0', 'm7_0', 'm8_0',
        'm9_0', 'm9_1', 'm9_2', 'm5_1',
      ],
      mode: '4p',
    });
    expect(nineGates.canWin).toBe(true);
    expect(nineGates.items.some((i) => i.name === '九蓮寶燈')).toBe(true);

    const smallDragons = evaluateWin({
      handIds: ['dr_0', 'dr_1', 'dr_2', 'dg_0', 'dg_1', 'dg_2', 'dw_0', 'dw_1', 'p1_0', 'p2_0', 'p3_0'],
      melds: [{ type: 'pong', codes: ['wn', 'wn', 'wn'], concealed: false }],
      mode: '3p',
      seatWind: 0,
      roundWind: 0,
    });
    expect(smallDragons.canWin).toBe(true);
    expect(smallDragons.items.some((i) => i.name === '小三元')).toBe(true);

    const allHonorsBigWinds = evaluateWin({
      handIds: [
        'we_0', 'we_1', 'we_2',
        'ws_0', 'ws_1', 'ws_2',
        'ww_0', 'ww_1', 'ww_2',
        'wn_0', 'wn_1', 'wn_2',
        'dr_0', 'dr_1',
      ],
      selfDraw: true,
      mode: '4p',
    });
    expect(allHonorsBigWinds.cappedFan).toBe(10);
    expect(allHonorsBigWinds.items.some((i) => i.name === '大四喜')).toBe(true);
  });

  it('evaluates Thirteen Orphans, Seven Pairs, Four Flys, Eight Flowers, and Heavenly/Earthly wins', () => {
    const orphans = evaluateWin({
      handIds: [
        'm1_0', 'm9_0', 'p1_0', 'p9_0', 's1_0', 's9_0',
        'we_0', 'ws_0', 'ww_0', 'wn_0', 'dr_0', 'dg_0', 'dw_0', 'dw_1',
      ],
      mode: '4p',
    });
    expect(orphans.shape).toBe('thirteenOrphans');
    expect(orphans.canWin).toBe(true);

    const sevenPairs3p = evaluateWin({
      handIds: [
        'p1_0', 'p1_1', 'p2_0', 'p2_1', 'p3_0', 'p3_1',
        'p4_0', 'p4_1', 'p5_0', 'p5_1', 'p6_0', 'jk_0', 'jk_1', 'jk_2',
      ],
      mode: '3p',
    });
    expect(sevenPairs3p.canWin).toBe(true);

    const fourFlys = evaluateWin({
      handIds: [
        'jk_0', 'jk_1', 'jk_2', 'jk_3',
        'p1_0', 'p2_0', 'p5_0', 'p8_0', 'we_0', 'ws_0', 'ww_0', 'dr_0', 'dg_0', 'dw_0',
      ],
      mode: '3p',
      selfDraw: true,
    });
    expect(fourFlys.shape).toBe('fourFlys');
    expect(fourFlys.cappedFan).toBe(10);

    const eightFlowersWin = evaluateWin({
      handIds: ['m1_0', 'm2_0'],
      bonusIds: ['b1_0', 'b2_0', 'b3_0', 'b4_0', 'f1_0', 'f2_0', 'f3_0', 'f4_0'],
      selfDraw: true,
    });
    expect(eightFlowersWin.shape).toBe('eightFlowers');

    const heavenly = evaluateWin({
      handIds: [
        'm1_0', 'm2_0', 'm3_0', 'p1_0', 'p2_0', 'p3_0',
        's1_0', 's2_0', 's3_0', 'we_0', 'we_1', 'we_2', 'dr_0', 'dr_1',
      ],
      heavenly: true,
    });
    expect(heavenly.items.at(0)?.name).toBe('天糊');
  });

  it('calculates Half-Spicy payouts and waiting tiles via ScorerService', () => {
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(ScorerService);

    const gun4p = svc.calculatePayout({ mode: '4p', cappedFan: 5, winnerSeat: 0, loserSeat: 2 });
    expect(gun4p.deltas).toEqual([96, 0, -96, 0]);

    const tsumo3p = calculatePayout({ mode: '3p', cappedFan: 10, winnerSeat: 1, selfDraw: true });
    expect(tsumo3p.deltas).toEqual([-256, 512, -256]);

    const waits = svc.getWaitingTiles({
      handIds: [
        'p1_0', 'p1_1', 'p1_2',
        'p2_0', 'p3_0', 'p4_0',
        'p5_0', 'p6_0', 'p7_0',
        'p8_0', 'p8_1', 'p8_2',
        'p9_0',
      ],
      mode: '3p',
    });
    expect(waits.some((w) => w.code === 'p9' && w.canDiscardWin)).toBe(true);
    expect(svc.scoreBonusTiles([], 0, '4p').fan).toBe(1);
    expect(svc.evaluateWin({ handIds: ['bad_tile'] }).canWin).toBe(false);
  });
});
