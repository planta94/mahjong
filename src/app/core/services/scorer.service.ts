import { Injectable } from '@angular/core';
import {
  EvaluateWinParams,
  FanItem,
  GameMode,
  GameRules,
  MeldLike,
  WaitingTileInfo,
  WinEvalResult,
} from '../models/mahjong.model';
import {
  CODE_INDEX_MAP,
  PLAYABLE_CODES,
  isTerminalIndex,
  isTerminalOrHonorIndex,
  playableIndicesForMode,
  tileCode,
  windLabel,
} from '../utils/tiles.util';

export const DEFAULT_RULES: GameRules = {
  minFan: 5,
  maxFan: 10,
  concealedFan: true,
  sevenPairs: true,
  showHints: true,
};

export const HALF_SPICY_BASE: readonly number[] = [
  1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384,
];

const ORPHAN_INDICES: readonly number[] = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

interface InternalMeld {
  type: 'chow' | 'pong' | 'kong';
  idx: number;
  concealed: boolean;
}

export interface Decomposition {
  pairIdx: number;
  handMelds: InternalMeld[];
}

interface ScoreContext {
  mode: GameMode;
  seatWind: number;
  roundWind: number;
  selfDraw: boolean;
  robbedKong: boolean;
  kongReplacement: boolean;
  lastTile: boolean;
  heavenly: boolean;
  earthly: boolean;
}

function getCount(counts: Map<number, number>, idx: number): number {
  return counts.get(idx) ?? 0;
}

function addCount(counts: Map<number, number>, idx: number, delta: number): void {
  counts.set(idx, (counts.get(idx) ?? 0) + delta);
}

export function scoreBonusTiles(
  bonusIds: readonly string[] = [],
  seatWind = 0,
  mode: GameMode = '4p'
): { items: FanItem[]; fan: number; eightFlowers: boolean } {
  const items: FanItem[] = [];
  const codes = bonusIds.map(tileCode);

  if (codes.length === 0) {
    items.push({ name: '無花', fan: 1 });
    return { items, fan: 1, eightFlowers: false };
  }

  const seasons = new Set(codes.filter((c) => c.startsWith('b')));
  const flowers = new Set(codes.filter((c) => c.startsWith('f') && !c.startsWith('fc')));

  if (seasons.size === 4 && flowers.size === 4) {
    return { items: [{ name: '八仙過海', fan: 13, limit: true }], fan: 13, eightFlowers: true };
  }

  const seatNum = seatWind + 1;
  if (seasons.size === 4) {
    items.push({ name: '一台花 (四季)', fan: 2 });
  } else if (seasons.has(`b${seatNum}`)) {
    items.push({ name: '正花 (四季)', fan: 1 });
  }

  if (flowers.size === 4) {
    items.push({ name: '一台花 (四君子)', fan: 2 });
  } else if (flowers.has(`f${seatNum}`)) {
    items.push({ name: '正花 (四君子)', fan: 1 });
  }

  if (mode === '3p') {
    const animals = new Set(codes.filter((c) => c.startsWith('an')));
    if (animals.size > 0) {
      items.push({
        name: animals.size > 1 ? `動物牌 ×${animals.size}` : '動物牌',
        fan: animals.size,
      });
    }
    if (animals.has('an1') && animals.has('an2')) {
      items.push({ name: '貓捉鼠', fan: 1 });
    }
    if (animals.has('an3') && animals.has('an4')) {
      items.push({ name: '雞食蜈蚣', fan: 1 });
    }

    const faceCount = codes.filter((c) => c.startsWith('fc')).length;
    if (faceCount === 4) {
      items.push({ name: '四人頭', fan: 2 });
    } else if (faceCount >= 2) {
      items.push({ name: '人頭對', fan: 1 });
    }

    const exposedFlys = codes.filter((c) => c === 'jk').length;
    if (exposedFlys > 0) {
      items.push({
        name: exposedFlys > 1 ? `打飛 ×${exposedFlys}` : '打飛',
        fan: exposedFlys,
      });
    }
  }

  const fan = items.reduce((sum, it) => sum + it.fan, 0);
  return { items, fan, eightFlowers: false };
}

function solveMelds(
  counts: Map<number, number>,
  jLeft: number,
  meldsLeft: number,
  allowedIndices: readonly number[],
  current: InternalMeld[],
  out: InternalMeld[][]
): void {
  if (meldsLeft === 0) {
    out.push([...current]);
    return;
  }

  let idx = -1;
  for (const i of allowedIndices) {
    if (getCount(counts, i) > 0) {
      idx = i;
      break;
    }
  }

  if (idx === -1) {
    if (jLeft >= 3 && meldsLeft === 1) {
      for (const cand of allowedIndices) {
        current.push({ type: 'pong', idx: cand, concealed: true });
        out.push([...current]);
        current.pop();
      }
      if (allowedIndices.includes(9)) {
        current.push({ type: 'chow', idx: 9, concealed: true });
        out.push([...current]);
        current.pop();
      }
    }
    return;
  }

  const takePong = Math.min(3, getCount(counts, idx));
  const needPongJ = 3 - takePong;
  if (needPongJ <= jLeft) {
    addCount(counts, idx, -takePong);
    current.push({ type: 'pong', idx, concealed: true });
    solveMelds(counts, jLeft - needPongJ, meldsLeft - 1, allowedIndices, current, out);
    current.pop();
    addCount(counts, idx, takePong);
  }

  if (idx < 27) {
    const suitBase = Math.floor(idx / 9) * 9;
    const pos = idx - suitBase;

    if (pos <= 6) {
      const t1 = getCount(counts, idx + 1) > 0 ? 1 : 0;
      const t2 = getCount(counts, idx + 2) > 0 ? 1 : 0;
      const needJ = 1 - t1 + (1 - t2);
      if (needJ <= jLeft) {
        addCount(counts, idx, -1);
        addCount(counts, idx + 1, -t1);
        addCount(counts, idx + 2, -t2);
        current.push({ type: 'chow', idx, concealed: true });
        solveMelds(counts, jLeft - needJ, meldsLeft - 1, allowedIndices, current, out);
        current.pop();
        addCount(counts, idx, 1);
        addCount(counts, idx + 1, t1);
        addCount(counts, idx + 2, t2);
      }
    }

    if (pos >= 1 && pos <= 7 && getCount(counts, idx - 1) === 0 && jLeft >= 1) {
      const t2 = getCount(counts, idx + 1) > 0 ? 1 : 0;
      const needJ = 1 + (1 - t2);
      if (needJ <= jLeft) {
        addCount(counts, idx, -1);
        addCount(counts, idx + 1, -t2);
        current.push({ type: 'chow', idx: idx - 1, concealed: true });
        solveMelds(counts, jLeft - needJ, meldsLeft - 1, allowedIndices, current, out);
        current.pop();
        addCount(counts, idx, 1);
        addCount(counts, idx + 1, t2);
      }
    }

    if (pos >= 2 && getCount(counts, idx - 2) === 0 && getCount(counts, idx - 1) === 0 && jLeft >= 2) {
      addCount(counts, idx, -1);
      current.push({ type: 'chow', idx: idx - 2, concealed: true });
      solveMelds(counts, jLeft - 2, meldsLeft - 1, allowedIndices, current, out);
      current.pop();
      addCount(counts, idx, 1);
    }
  }
}

export function findStandardDecompositions(
  counts: Map<number, number>,
  jokers: number,
  meldsNeeded: number,
  mode: GameMode = '4p'
): Decomposition[] {
  const allowedIndices = playableIndicesForMode(mode);
  const results: Decomposition[] = [];

  for (const pairIdx of allowedIndices) {
    const takePair = Math.min(2, getCount(counts, pairIdx));
    const needPairJ = 2 - takePair;
    if (needPairJ > jokers) continue;

    addCount(counts, pairIdx, -takePair);
    const meldSets: InternalMeld[][] = [];
    solveMelds(counts, jokers - needPairJ, meldsNeeded, allowedIndices, [], meldSets);
    addCount(counts, pairIdx, takePair);

    for (const handMelds of meldSets) {
      results.push({ pairIdx, handMelds });
    }
  }
  return results;
}

function classifySuitUsage(tileIndices: readonly number[]) {
  const suits = new Set<number>();
  let hasHonors = false;
  let allTerminals = true;
  let allTermOrHonor = true;

  for (const idx of tileIndices) {
    if (idx >= 27) {
      hasHonors = true;
      allTerminals = false;
    } else {
      suits.add(Math.floor(idx / 9));
      if (!isTerminalIndex(idx)) {
        allTerminals = false;
        allTermOrHonor = false;
      }
    }
    if (!isTerminalOrHonorIndex(idx)) {
      allTermOrHonor = false;
    }
  }

  return {
    allHonors: hasHonors && suits.size === 0,
    pureOneSuit: !hasHonors && suits.size === 1,
    mixedOneSuit: hasHonors && suits.size === 1,
    allTerminals: !hasHonors && allTerminals,
    mixedTerminals: hasHonors && suits.size > 0 && allTermOrHonor,
    singleSuitIdx: suits.size === 1 ? ([...suits].at(0) ?? -1) : -1,
  };
}

function addSituationalFans(items: FanItem[], ctx: ScoreContext, skipSelfDraw = false): void {
  if (ctx.selfDraw && !skipSelfDraw) items.push({ name: '自摸', fan: 1 });
  if (ctx.robbedKong) items.push({ name: '搶槓', fan: 1 });
  if (ctx.kongReplacement) items.push({ name: '槓上開花', fan: 1 });
  if (ctx.lastTile) items.push({ name: ctx.selfDraw ? '海底撈月' : '河底撈魚', fan: 1 });
}

function scoreDecomposition(
  { pairIdx, handMelds }: Decomposition,
  openMelds: readonly MeldLike[],
  bonusInfo: { items: FanItem[]; fan: number },
  ctx: ScoreContext,
  rules: GameRules
): { items: FanItem[]; rawFan: number } {
  const items: FanItem[] = [];
  if (ctx.heavenly) return { items: [{ name: '天糊', fan: rules.maxFan, limit: true }], rawFan: 13 };
  if (ctx.earthly) return { items: [{ name: '地糊', fan: rules.maxFan, limit: true }], rawFan: 13 };

  const normalizedOpen: InternalMeld[] = openMelds.map((m) => ({
    type: m.type,
    idx: CODE_INDEX_MAP.get(tileCode(m.codes.at(0) ?? '')) ?? 0,
    concealed: Boolean(m.concealed),
  }));
  const allMelds = [...normalizedOpen, ...handMelds];

  const allTileIndices = [pairIdx, pairIdx];
  for (const m of allMelds) {
    if (m.type === 'chow') {
      allTileIndices.push(m.idx, m.idx + 1, m.idx + 2);
    } else {
      allTileIndices.push(m.idx, m.idx, m.idx);
    }
  }

  const suitInfo = classifySuitUsage(allTileIndices);
  const isFullyConcealed = normalizedOpen.every((m) => m.concealed);
  const allPongs = allMelds.every((m) => m.type === 'pong' || m.type === 'kong');
  const allChows = allMelds.every((m) => m.type === 'chow');

  if (normalizedOpen.length === 0 && suitInfo.pureOneSuit) {
    const base = suitInfo.singleSuitIdx * 9;
    const hist = new Map<number, number>();
    for (const idx of allTileIndices) {
      addCount(hist, idx - base, 1);
    }
    if (
      getCount(hist, 0) >= 3 &&
      getCount(hist, 8) >= 3 &&
      getCount(hist, 1) >= 1 &&
      getCount(hist, 2) >= 1 &&
      getCount(hist, 3) >= 1 &&
      getCount(hist, 4) >= 1 &&
      getCount(hist, 5) >= 1 &&
      getCount(hist, 6) >= 1 &&
      getCount(hist, 7) >= 1
    ) {
      items.push({ name: '九蓮寶燈', fan: 10, limit: true });
      items.push(...bonusInfo.items);
      return { items, rawFan: items.reduce((s, x) => s + x.fan, 0) };
    }
  }

  const pongIndices = new Set(allMelds.filter((m) => m.type !== 'chow').map((m) => m.idx));
  const windPongCount = [27, 28, 29, 30].filter((w) => pongIndices.has(w)).length;
  const dragonPongCount = [31, 32, 33].filter((d) => pongIndices.has(d)).length;
  const windPair = pairIdx >= 27 && pairIdx <= 30;
  const dragonPair = pairIdx >= 31 && pairIdx <= 33;

  const bigFourWinds = windPongCount === 4;
  const smallFourWinds = windPongCount === 3 && windPair;
  const bigThreeDragons = dragonPongCount === 3;
  const smallThreeDragons = dragonPongCount === 2 && dragonPair;
  const fourConcealedPongs = allPongs && isFullyConcealed && ctx.selfDraw;

  if (bigFourWinds) items.push({ name: '大四喜', fan: 13, limit: true });
  else if (smallFourWinds) items.push({ name: '小四喜', fan: 6 });

  if (bigThreeDragons) items.push({ name: '大三元', fan: 8 });
  else if (smallThreeDragons) items.push({ name: '小三元', fan: 5 });

  if (suitInfo.allHonors) {
    items.push({ name: '字一色', fan: 10, limit: true });
  } else if (suitInfo.allTerminals) {
    items.push({ name: '清幺九', fan: 10, limit: true });
  } else {
    if (suitInfo.pureOneSuit) items.push({ name: '清一色', fan: 7 });
    else if (suitInfo.mixedOneSuit) items.push({ name: '混一色', fan: 3 });

    if (suitInfo.mixedTerminals) items.push({ name: '混老頭', fan: 4 });
  }

  if (fourConcealedPongs) {
    items.push({ name: '坎坎糊', fan: 8 });
  } else if (allPongs && !bigFourWinds && !suitInfo.allHonors && !suitInfo.allTerminals) {
    items.push({ name: '對對糊', fan: 3 });
  } else if (allChows) {
    items.push({ name: '平糊', fan: 1 });
  }

  if (!bigThreeDragons && !smallThreeDragons) {
    if (pongIndices.has(31)) items.push({ name: '紅中', fan: 1 });
    if (pongIndices.has(32)) items.push({ name: '發財', fan: 1 });
    if (pongIndices.has(33)) items.push({ name: '白板', fan: 1 });
  }

  if (!bigFourWinds && !smallFourWinds) {
    const roundWindIdx = 27 + ctx.roundWind;
    const seatWindIdx = 27 + ctx.seatWind;
    if (pongIndices.has(roundWindIdx)) {
      items.push({ name: `圈風 (${windLabel(ctx.roundWind)})`, fan: 1 });
    }
    if (pongIndices.has(seatWindIdx)) {
      items.push({ name: `門風 (${windLabel(ctx.seatWind)})`, fan: 1 });
    }
    if (ctx.mode === '3p' && pongIndices.has(30)) {
      items.push({ name: '北風刻', fan: 1 });
    }
  }

  if (rules.concealedFan && isFullyConcealed && !fourConcealedPongs) {
    items.push({ name: '門前清', fan: 1 });
  }

  addSituationalFans(items, ctx, fourConcealedPongs);
  items.push(...bonusInfo.items);

  return { items, rawFan: items.reduce((s, x) => s + x.fan, 0) };
}

function tryThirteenOrphans(
  counts: Map<number, number>,
  jokers: number,
  openMelds: readonly MeldLike[],
  bonusInfo: { items: FanItem[] },
  ctx: ScoreContext
): { items: FanItem[]; rawFan: number; shape: string } | null {
  if (ctx.mode !== '4p' || openMelds.length > 0) return null;
  let missing = 0;
  let hasPair = false;
  for (const idx of ORPHAN_INDICES) {
    const cnt = getCount(counts, idx);
    if (cnt === 0) missing++;
    if (cnt >= 2) hasPair = true;
  }
  for (const [idx, cnt] of counts.entries()) {
    if (cnt > 0 && !ORPHAN_INDICES.includes(idx)) return null;
  }
  const needed = missing + (hasPair ? 0 : 1);
  if (needed > jokers) return null;

  const items: FanItem[] = [{ name: '十三么', fan: 13, limit: true }];
  addSituationalFans(items, ctx);
  items.push(...bonusInfo.items);
  return { items, rawFan: items.reduce((s, x) => s + x.fan, 0), shape: 'thirteenOrphans' };
}

function trySevenPairs(
  counts: Map<number, number>,
  jokers: number,
  openMelds: readonly MeldLike[],
  bonusInfo: { items: FanItem[] },
  ctx: ScoreContext,
  rules: GameRules
): { items: FanItem[]; rawFan: number; shape: string } | null {
  if (!rules.sevenPairs || openMelds.length > 0) return null;

  let oddCount = 0;
  const presentIndices: number[] = [];
  for (let i = 0; i < 34; i++) {
    const cnt = getCount(counts, i);
    if (cnt > 0) {
      presentIndices.push(i);
      if (cnt % 2 === 1) oddCount++;
    }
  }
  if (oddCount > jokers || (jokers - oddCount) % 2 !== 0) return null;

  const extraPairs = (jokers - oddCount) / 2;
  const candidateTargets = extraPairs > 0 ? (ctx.mode === '3p' ? [9, 31] : [0, 9, 18, 31]) : [-1];

  let best: { items: FanItem[]; rawFan: number; shape: string } | null = null;
  for (const target of candidateTargets) {
    const tileList = [...presentIndices];
    if (target !== -1) tileList.push(target);
    const suitInfo = classifySuitUsage(tileList);
    const items: FanItem[] = [{ name: '七對子', fan: 4 }];

    if (suitInfo.allHonors) items.push({ name: '字一色', fan: 10, limit: true });
    else if (suitInfo.allTerminals) items.push({ name: '清幺九', fan: 10, limit: true });
    else {
      if (suitInfo.pureOneSuit) items.push({ name: '清一色', fan: 7 });
      else if (suitInfo.mixedOneSuit) items.push({ name: '混一色', fan: 3 });
      if (suitInfo.mixedTerminals) items.push({ name: '混老頭', fan: 4 });
    }

    addSituationalFans(items, ctx);
    items.push(...bonusInfo.items);
    const rawFan = items.reduce((s, x) => s + x.fan, 0);
    if (!best || rawFan > best.rawFan) {
      best = { items, rawFan, shape: 'sevenPairs' };
    }
  }
  return best;
}

export function evaluateWin({
  handIds,
  melds = [],
  bonusIds = [],
  mode = '4p',
  seatWind = 0,
  roundWind = 0,
  selfDraw = false,
  robbedKong = false,
  kongReplacement = false,
  lastTile = false,
  heavenly = false,
  earthly = false,
  rules = DEFAULT_RULES,
}: EvaluateWinParams): WinEvalResult {
  const activeRules: GameRules = { ...DEFAULT_RULES, ...rules };
  const ctx: ScoreContext = {
    mode,
    seatWind,
    roundWind,
    selfDraw,
    robbedKong,
    kongReplacement,
    lastTile,
    heavenly,
    earthly,
  };
  const bonusInfo = scoreBonusTiles(bonusIds, seatWind, mode);

  if (selfDraw && bonusInfo.eightFlowers) {
    return {
      isShapeValid: true,
      canWin: true,
      rawFan: 13,
      cappedFan: activeRules.maxFan,
      items: bonusInfo.items,
      shape: 'eightFlowers',
    };
  }

  let jokers = 0;
  const counts = new Map<number, number>();
  for (const id of handIds) {
    const code = tileCode(id);
    if (code === 'jk') {
      jokers++;
    } else {
      const idx = CODE_INDEX_MAP.get(code);
      if (idx === undefined) {
        return { isShapeValid: false, canWin: false, rawFan: 0, cappedFan: 0, items: [] };
      }
      addCount(counts, idx, 1);
    }
  }

  if (mode === '3p' && selfDraw && jokers === 4) {
    return {
      isShapeValid: true,
      canWin: true,
      rawFan: activeRules.maxFan,
      cappedFan: activeRules.maxFan,
      items: [{ name: '四飛爆胡', fan: activeRules.maxFan, limit: true }],
      shape: 'fourFlys',
    };
  }

  const meldsNeeded = 4 - melds.length;
  if (meldsNeeded < 0 || handIds.length !== meldsNeeded * 3 + 2) {
    return { isShapeValid: false, canWin: false, rawFan: 0, cappedFan: 0, items: [] };
  }

  const candidates: Array<{ items: FanItem[]; rawFan: number; shape: string }> = [];

  const orphans = tryThirteenOrphans(counts, jokers, melds, bonusInfo, ctx);
  if (orphans) candidates.push(orphans);

  const sevenP = trySevenPairs(counts, jokers, melds, bonusInfo, ctx, activeRules);
  if (sevenP) candidates.push(sevenP);

  const decompositions = findStandardDecompositions(counts, jokers, meldsNeeded, mode);
  for (const decomp of decompositions) {
    const scored = scoreDecomposition(decomp, melds, bonusInfo, ctx, activeRules);
    candidates.push({ ...scored, shape: 'standard' });
  }

  const best = candidates.sort((a, b) => b.rawFan - a.rawFan).at(0);
  if (!best) {
    return { isShapeValid: false, canWin: false, rawFan: 0, cappedFan: 0, items: [] };
  }

  const cappedFan = Math.min(best.rawFan, activeRules.maxFan);
  return {
    isShapeValid: true,
    canWin: best.rawFan >= activeRules.minFan,
    rawFan: best.rawFan,
    cappedFan,
    items: best.items,
    shape: best.shape,
  };
}

export function calculatePayout({
  mode = '4p',
  cappedFan,
  winnerSeat,
  loserSeat = null,
  selfDraw = false,
}: {
  mode?: GameMode;
  cappedFan: number;
  winnerSeat: number;
  loserSeat?: number | null;
  selfDraw?: boolean;
}): { base: number; deltas: number[] } {
  const numSeats = mode === '3p' ? 3 : 4;
  const clampedIdx = Math.min(Math.max(0, cappedFan), HALF_SPICY_BASE.length - 1);
  const base = HALF_SPICY_BASE.at(clampedIdx) ?? 1;

  if (selfDraw || loserSeat === null) {
    const eachPay = 2 * base;
    const deltas = Array.from({ length: numSeats }, (_, s) =>
      s === winnerSeat ? eachPay * (numSeats - 1) : -eachPay
    );
    return { base, deltas };
  }

  const gunPay = numSeats * base;
  const deltas = Array.from({ length: numSeats }, (_, s) => {
    if (s === winnerSeat) return gunPay;
    if (s === loserSeat) return -gunPay;
    return 0;
  });
  return { base, deltas };
}

export function getWaitingTiles({
  handIds,
  melds = [],
  bonusIds = [],
  mode = '4p',
  seatWind = 0,
  roundWind = 0,
  rules = DEFAULT_RULES,
}: {
  handIds: string[];
  melds?: MeldLike[];
  bonusIds?: string[];
  mode?: GameMode;
  seatWind?: number;
  roundWind?: number;
  rules?: Partial<GameRules>;
}): WaitingTileInfo[] {
  const meldsNeeded = 4 - melds.length;
  if (meldsNeeded < 0 || handIds.length !== meldsNeeded * 3 + 1) return [];

  const waits: WaitingTileInfo[] = [];
  for (const idx of playableIndicesForMode(mode)) {
    const code = PLAYABLE_CODES.at(idx);
    if (!code) continue;
    const testHand = [...handIds, `${code}_v`];
    const onDiscard = evaluateWin({
      handIds: testHand,
      melds,
      bonusIds,
      mode,
      seatWind,
      roundWind,
      selfDraw: false,
      rules,
    });
    if (!onDiscard.isShapeValid) continue;

    const onSelfDraw = evaluateWin({
      handIds: testHand,
      melds,
      bonusIds,
      mode,
      seatWind,
      roundWind,
      selfDraw: true,
      rules,
    });

    waits.push({
      code,
      canDiscardWin: onDiscard.canWin,
      discardFan: onDiscard.rawFan,
      canSelfDrawWin: onSelfDraw.canWin,
      selfDrawFan: onSelfDraw.rawFan,
    });
  }
  return waits;
}

@Injectable({ providedIn: 'root' })
export class ScorerService {
  scoreBonusTiles(bonusIds: readonly string[], seatWind = 0, mode: GameMode = '4p') {
    return scoreBonusTiles(bonusIds, seatWind, mode);
  }

  evaluateWin(params: EvaluateWinParams): WinEvalResult {
    return evaluateWin(params);
  }

  calculatePayout(params: Parameters<typeof calculatePayout>[0]) {
    return calculatePayout(params);
  }

  getWaitingTiles(params: Parameters<typeof getWaitingTiles>[0]): WaitingTileInfo[] {
    return getWaitingTiles(params);
  }
}
