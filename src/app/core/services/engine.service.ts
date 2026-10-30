import { Injectable } from '@angular/core';
import {
  ChowOption,
  ClaimSeatEntry,
  GameAction,
  GameMode,
  GameRules,
  LegalActions,
  MatchState,
  PenaltyReasonCode,
  PlayerView,
  RobKongSeatEntry,
  WinEvalResult,
} from '../models/mahjong.model';
import {
  CODE_INDEX_MAP,
  PLAYABLE_CODES,
  createDeck,
  isBonusTile,
  sortHandIds,
  tileCode,
  tileSpec,
  windLabel,
} from '../utils/tiles.util';
import { DEFAULT_RULES, HALF_SPICY_BASE, calculatePayout, evaluateWin } from './scorer.service';

export function createMatch({
  mode = '4p',
  rules = {},
  startingScore = 1000,
  rng = Math.random,
}: {
  mode?: GameMode;
  rules?: Partial<GameRules>;
  startingScore?: number;
  rng?: () => number;
} = {}): MatchState {
  const numSeats = mode === '3p' ? 3 : 4;
  const match: MatchState = {
    mode,
    numSeats,
    rules: { ...DEFAULT_RULES, ...rules },
    roundWind: 0,
    dealerSeat: 0,
    dealerStreak: 0,
    handNumber: 0,
    scores: Array<number>(numSeats).fill(startingScore),
    phase: 'lobby',
    wall: [],
    turnSeat: 0,
    canSelfAct: true,
    kongReplacement: false,
    isFirstGoAround: true,
    turnsTaken: Array<number>(numSeats).fill(0),
    lastDiscard: null,
    lastPenalty: null,
    discardPool: [],
    pendingRobKong: null,
    pendingClaims: null,
    players: [],
    log: [],
    result: null,
  };
  startNewHand(match, rng);
  return match;
}

function pushLog(state: MatchState, text: string): void {
  state.log.push(text);
  if (state.log.length > 40) state.log.shift();
}

function seatDistance(fromSeat: number, targetSeat: number, numSeats: number): number {
  return (targetSeat - fromSeat + numSeats) % numSeats;
}

function applyPenalty(
  state: MatchState,
  seat: number,
  actionType: GameAction['type'],
  reasonCode: PenaltyReasonCode,
  rawFan?: number
): void {
  const isFalseWin = actionType === 'win';
  const minFan = state.rules.minFan ?? 5;
  const clampedIdx = Math.min(Math.max(0, minFan), HALF_SPICY_BASE.length - 1);
  const base = HALF_SPICY_BASE.at(clampedIdx) ?? 16;
  const eachGain = isFalseWin ? 2 * base : base;
  const totalLost = eachGain * (state.numSeats - 1);

  state.scores = state.scores.map((sc, s) => (s === seat ? sc - totalLost : sc + eachGain));
  state.lastPenalty = {
    seat,
    actionType,
    isFalseWin,
    reasonCode,
    rawFan,
    minFan,
    eachGain,
    totalLost,
  };

  if (reasonCode === 'FALSE_WIN_FAN') {
    pushLog(
      state,
      `⚠️ 座位 ${seat + 1} 詐糊（僅 ${rawFan ?? 0} 番，未達 ${minFan} 番起糊）！賠各家 ${eachGain} 分（-${totalLost}）`
    );
  } else if (isFalseWin) {
    pushLog(state, `⚠️ 座位 ${seat + 1} 詐糊（牌型不符）！賠各家 ${eachGain} 分（-${totalLost}）`);
  } else {
    pushLog(state, `⚠️ 座位 ${seat + 1} 錯章罰分！賠各家 ${eachGain} 分（-${totalLost}）`);
  }
}

function extractDistinctFromHand(
  hand: readonly string[],
  tileIds: readonly string[],
  expectedLen: number
): string[] | null {
  if (tileIds.length !== expectedLen) return null;
  if (new Set(tileIds).size !== expectedLen) return null;
  for (const id of tileIds) {
    if (!hand.includes(id) || isBonusTile(id)) return null;
  }
  return [...tileIds];
}

function validatePongClaim(
  hand: readonly string[],
  discardId: string,
  tileIds: readonly string[] | undefined,
  mode: GameMode
): { usedIds: string[]; meldCodes: string[] } | null {
  const codeD = tileCode(discardId);
  if (codeD === 'jk' || isBonusTile(discardId) || CODE_INDEX_MAP.get(codeD) === undefined) {
    return null;
  }

  if (tileIds !== undefined) {
    const picked = extractDistinctFromHand(hand, tileIds, 2);
    if (!picked) return null;
    const ok = picked.every((id) => {
      const c = tileCode(id);
      return c === codeD || (mode === '3p' && c === 'jk');
    });
    return ok ? { usedIds: picked, meldCodes: [codeD, codeD, codeD] } : null;
  }

  const matched = hand.filter((id) => tileCode(id) === codeD).slice(0, 2);
  return matched.length === 2 ? { usedIds: matched, meldCodes: [codeD, codeD, codeD] } : null;
}

function validateKongClaim(
  hand: readonly string[],
  discardId: string,
  tileIds: readonly string[] | undefined,
  wallLen: number
): { usedIds: string[]; meldCodes: string[] } | null {
  if (wallLen <= 0) return null;
  const codeD = tileCode(discardId);
  if (codeD === 'jk' || isBonusTile(discardId) || CODE_INDEX_MAP.get(codeD) === undefined) {
    return null;
  }

  if (tileIds !== undefined) {
    const picked = extractDistinctFromHand(hand, tileIds, 3);
    if (!picked) return null;
    return picked.every((id) => tileCode(id) === codeD)
      ? { usedIds: picked, meldCodes: [codeD, codeD, codeD, codeD] }
      : null;
  }

  const matched = hand.filter((id) => tileCode(id) === codeD).slice(0, 3);
  return matched.length === 3
    ? { usedIds: matched, meldCodes: [codeD, codeD, codeD, codeD] }
    : null;
}

function validateChowClaim(
  hand: readonly string[],
  discardId: string,
  fromSeat: number,
  claimerSeat: number,
  numSeats: number,
  mode: GameMode,
  tileIds: readonly string[] | undefined,
  chows: readonly ChowOption[],
  chowIndex: number
): { usedIds: string[]; meldCodes: string[]; orderedTileIds: string[] } | null {
  if (seatDistance(fromSeat, claimerSeat, numSeats) !== 1) return null;
  const codeD = tileCode(discardId);
  const idxD = CODE_INDEX_MAP.get(codeD);
  if (codeD === 'jk' || idxD === undefined || idxD >= 27) return null;

  const suitBase = Math.floor(idxD / 9) * 9;
  const posD = idxD - suitBase;

  if (tileIds !== undefined) {
    const picked = extractDistinctFromHand(hand, tileIds, 2);
    if (!picked) return null;

    const jokers: string[] = [];
    const naturals: Array<{ id: string; pos: number }> = [{ id: discardId, pos: posD }];

    for (const id of picked) {
      const c = tileCode(id);
      if (c === 'jk') {
        if (mode !== '3p') return null;
        jokers.push(id);
      } else {
        const idx = CODE_INDEX_MAP.get(c);
        if (idx === undefined || idx >= 27 || Math.floor(idx / 9) * 9 !== suitBase) return null;
        const pos = idx - suitBase;
        if (naturals.some((n) => n.pos === pos)) return null;
        naturals.push({ id, pos });
      }
    }

    let chosenStart = -1;
    for (let start = 0; start <= 6; start++) {
      if (naturals.every((n) => n.pos >= start && n.pos <= start + 2)) {
        chosenStart = start;
      }
    }
    if (chosenStart === -1) return null;

    const meldCodes: string[] = [];
    const orderedTileIds: string[] = [];
    let jCursor = 0;
    for (let offset = 0; offset < 3; offset++) {
      const targetPos = chosenStart + offset;
      const c = PLAYABLE_CODES.at(suitBase + targetPos) ?? codeD;
      meldCodes.push(c);
      const nat = naturals.find((n) => n.pos === targetPos);
      if (nat) {
        orderedTileIds.push(nat.id);
      } else {
        orderedTileIds.push(jokers.at(jCursor) ?? discardId);
        jCursor++;
      }
    }
    return { usedIds: picked, meldCodes, orderedTileIds };
  }

  const chosen = chows.at(chowIndex);
  if (!chosen) return null;
  const needed = [...chosen.partnerCodes];
  const usedIds: string[] = [];
  for (const id of hand) {
    const pos = needed.indexOf(tileCode(id));
    if (pos !== -1) {
      needed.splice(pos, 1);
      usedIds.push(id);
      if (needed.length === 0) break;
    }
  }
  if (usedIds.length !== 2) return null;
  const orderedTileIds = [...usedIds, discardId].sort(
    (a, b) => (CODE_INDEX_MAP.get(tileCode(a)) ?? 0) - (CODE_INDEX_MAP.get(tileCode(b)) ?? 0)
  );
  return { usedIds, meldCodes: [...chosen.meldCodes], orderedTileIds };
}

function finishExhaustiveDraw(state: MatchState): void {
  state.phase = 'handOver';
  state.pendingClaims = null;
  state.pendingRobKong = null;
  state.result = {
    outcome: 'draw',
    winnerSeat: null,
    loserSeat: null,
    selfDraw: false,
    fanResult: null,
    deltas: Array<number>(state.numSeats).fill(0),
  };
  pushLog(state, '牌牆摸盡 — 流局！莊家連莊。');
}

function absorbBonusTiles(state: MatchState, seat: number): { ok: boolean; replacedCount: number } {
  const p = state.players.at(seat);
  if (!p) return { ok: false, replacedCount: 0 };
  let replacedCount = 0;

  while (true) {
    const bonusInHand = p.hand.filter(isBonusTile);
    if (bonusInHand.length === 0) break;

    p.hand = p.hand.filter((id) => !isBonusTile(id));
    for (const bId of bonusInHand) {
      p.bonus.push(bId);
      const rep = state.wall.pop();
      if (!rep) {
        p.hand = sortHandIds(p.hand);
        finishExhaustiveDraw(state);
        return { ok: false, replacedCount };
      }
      p.hand.push(rep);
      p.lastDrawnId = rep;
      replacedCount++;
    }
  }

  p.hand = sortHandIds(p.hand);
  return { ok: true, replacedCount };
}

export function startNewHand(state: MatchState, rng: () => number = Math.random): MatchState {
  if (state.handNumber > 0 && state.result) {
    const dealerKeep =
      state.result.outcome === 'draw' || state.result.winnerSeat === state.dealerSeat;
    if (dealerKeep) {
      state.dealerStreak += 1;
    } else {
      state.dealerStreak = 0;
      state.dealerSeat = (state.dealerSeat + 1) % state.numSeats;
      if (state.dealerSeat === 0) {
        state.roundWind = (state.roundWind + 1) % state.numSeats;
      }
    }
  }

  state.handNumber += 1;
  state.wall = createDeck(state.mode, rng);
  state.turnSeat = state.dealerSeat;
  state.canSelfAct = true;
  state.kongReplacement = false;
  state.isFirstGoAround = true;
  state.turnsTaken = Array<number>(state.numSeats).fill(0);
  state.lastDiscard = null;
  state.lastPenalty = null;
  state.discardPool = [];
  state.pendingRobKong = null;
  state.pendingClaims = null;
  state.result = null;
  state.log = [];

  state.players = Array.from({ length: state.numSeats }, (_, seat) => ({
    seat,
    seatWind: (seat - state.dealerSeat + state.numSeats) % state.numSeats,
    hand: [],
    lastDrawnId: null,
    melds: [],
    bonus: [],
    discards: [],
  }));

  // Authentic block dealing: 3 rounds of 4-tile stacks counter-clockwise from Dealer (12 tiles each)
  for (let round = 0; round < 3; round++) {
    for (let s = 0; s < state.numSeats; s++) {
      const seat = (state.dealerSeat + s) % state.numSeats;
      const target = state.players.at(seat);
      for (let k = 0; k < 4; k++) {
        const drawn = state.wall.shift();
        if (drawn && target) target.hand.push(drawn);
      }
    }
  }

  // Dealer jump-draw (跳牌: 1st and 3rd top wall tiles -> 14 tiles); non-dealers draw 1 tile each (13 tiles)
  const dealerPlayer = state.players.at(state.dealerSeat);
  const dealerFirst = state.wall.shift();
  const dealerJump = state.wall.splice(1, 1).at(0) ?? state.wall.shift();
  if (dealerPlayer) {
    if (dealerFirst) dealerPlayer.hand.push(dealerFirst);
    if (dealerJump) {
      dealerPlayer.hand.push(dealerJump);
      dealerPlayer.lastDrawnId = dealerJump;
    }
  }
  for (let s = 1; s < state.numSeats; s++) {
    const seat = (state.dealerSeat + s) % state.numSeats;
    const drawn = state.wall.shift();
    const target = state.players.at(seat);
    if (drawn && target) target.hand.push(drawn);
  }

  state.phase = 'turn';
  for (let offset = 0; offset < state.numSeats; offset++) {
    const seat = (state.dealerSeat + offset) % state.numSeats;
    const res = absorbBonusTiles(state, seat);
    if (!res.ok) return state;
  }

  pushLog(
    state,
    `第 ${state.handNumber} 局開始（${windLabel(state.roundWind)}圈 · 莊家：座位 ${state.dealerSeat + 1}）`
  );
  return state;
}

export function getLegalActions(state: MatchState, seat: number): LegalActions | null {
  if (state.phase === 'turn' && state.turnSeat === seat) {
    const p = state.players.at(seat);
    if (!p) return null;
    const actions: Extract<LegalActions, { phase: 'turn' }> = {
      phase: 'turn',
      canDiscard: true,
      win: null,
      exposeFly: false,
      concealedKongs: [],
      addedKongs: [],
    };

    if (state.canSelfAct) {
      const seatTurns = state.turnsTaken.at(seat) ?? 0;
      const heavenly = seat === state.dealerSeat && state.isFirstGoAround && seatTurns === 0;
      const earthly = seat !== state.dealerSeat && state.isFirstGoAround && seatTurns === 0;
      const winEval = evaluateWin({
        handIds: p.hand,
        melds: p.melds,
        bonusIds: p.bonus,
        mode: state.mode,
        seatWind: p.seatWind,
        roundWind: state.roundWind,
        selfDraw: true,
        kongReplacement: state.kongReplacement,
        lastTile: state.wall.length === 0,
        heavenly,
        earthly,
        rules: state.rules,
      });
      if (winEval.canWin) actions.win = winEval;

      if (state.wall.length > 0) {
        if (state.mode === '3p') {
          const flyCount = p.hand.filter((id) => tileCode(id) === 'jk').length;
          if (flyCount > 0 && flyCount < 4) actions.exposeFly = true;
        }

        const codeCounts = new Map<string, number>();
        for (const id of p.hand) {
          const c = tileCode(id);
          if (c !== 'jk') codeCounts.set(c, (codeCounts.get(c) ?? 0) + 1);
        }
        for (const [code, cnt] of codeCounts.entries()) {
          if (cnt === 4) actions.concealedKongs.push(code);
        }

        for (const m of p.melds) {
          if (m.type === 'pong' && !(m.tileIds ?? []).some((tid) => tileCode(tid) === 'jk')) {
            const c = tileCode(m.codes.at(0) ?? '');
            if ((codeCounts.get(c) ?? 0) >= 1) actions.addedKongs.push(c);
          }
        }
      }
    }
    return actions;
  }

  if (state.phase === 'claim' && state.pendingClaims) {
    const entry = state.pendingClaims.bySeat.get(seat);
    if (entry && !entry.decision) {
      return {
        phase: 'claim',
        tileId: state.pendingClaims.tileId,
        fromSeat: state.pendingClaims.fromSeat,
        win: entry.winEval?.canWin ? entry.winEval : null,
        canKong: entry.canKong,
        canPong: entry.canPong,
        chows: entry.chows,
      };
    }
  }

  if (state.phase === 'robKong' && state.pendingRobKong) {
    const entry = state.pendingRobKong.bySeat.get(seat);
    if (entry && !entry.decision) {
      return {
        phase: 'robKong',
        tileId: state.pendingRobKong.tileId,
        fromSeat: state.pendingRobKong.seat,
        win: entry.winEval,
      };
    }
  }

  return null;
}

function settleWin(
  state: MatchState,
  {
    winnerSeat,
    loserSeat,
    selfDraw,
    winningTileId,
    fanResult,
  }: {
    winnerSeat: number;
    loserSeat: number | null;
    selfDraw: boolean;
    winningTileId: string;
    fanResult: WinEvalResult;
  }
): void {
  const { deltas, base } = calculatePayout({
    mode: state.mode,
    cappedFan: fanResult.cappedFan,
    winnerSeat,
    loserSeat,
    selfDraw,
  });

  state.scores = state.scores.map((sc, s) => sc + (deltas.at(s) ?? 0));

  const winner = state.players.at(winnerSeat);
  if (!winner) return;
  const fullHand = selfDraw ? [...winner.hand] : sortHandIds([...winner.hand, winningTileId]);

  state.phase = 'handOver';
  state.pendingClaims = null;
  state.pendingRobKong = null;
  state.result = {
    outcome: 'win',
    winnerSeat,
    loserSeat,
    selfDraw,
    winningTileId,
    fanResult,
    base,
    deltas,
    winningHand: fullHand,
    winningMelds: winner.melds,
    winningBonus: winner.bonus,
  };

  const how = selfDraw ? '自摸' : `食糊（座位 ${(loserSeat ?? 0) + 1} 出銃）`;
  pushLog(state, `座位 ${winnerSeat + 1} ${how} — ${fanResult.cappedFan} 番！`);
}

function advanceToSeatAndDraw(state: MatchState, nextSeat: number): void {
  const drawn = state.wall.shift();
  const p = state.players.at(nextSeat);
  if (!drawn || !p) {
    finishExhaustiveDraw(state);
    return;
  }

  state.phase = 'turn';
  state.turnSeat = nextSeat;
  state.canSelfAct = true;
  state.kongReplacement = false;

  p.hand.push(drawn);
  p.lastDrawnId = drawn;

  const bonusRes = absorbBonusTiles(state, nextSeat);
  if (!bonusRes.ok) return;
  if (bonusRes.replacedCount > 0) {
    state.kongReplacement = true;
  }
}

function buildClaimsForDiscard(
  state: MatchState,
  fromSeat: number,
  tileId: string
): MatchState['pendingClaims'] {
  const code = tileCode(tileId);
  const idx = CODE_INDEX_MAP.get(code);
  const bySeat = new Map<number, ClaimSeatEntry>();

  for (let offset = 1; offset < state.numSeats; offset++) {
    const s = (fromSeat + offset) % state.numSeats;
    const p = state.players.at(s);
    if (!p) continue;

    if (code === 'jk' || idx === undefined) {
      bySeat.set(s, {
        winEval: null,
        canKong: false,
        canPong: false,
        chows: [],
        decision: null,
      });
      continue;
    }

    const winEval = evaluateWin({
      handIds: [...p.hand, tileId],
      melds: p.melds,
      bonusIds: p.bonus,
      mode: state.mode,
      seatWind: p.seatWind,
      roundWind: state.roundWind,
      selfDraw: false,
      lastTile: state.wall.length === 0,
      rules: state.rules,
    });

    const sameCount = p.hand.filter((id) => tileCode(id) === code).length;
    const canKong = state.wall.length > 0 && sameCount === 3;
    const canPong = sameCount >= 2;

    const chows: ChowOption[] = [];
    if (offset === 1 && idx < 27) {
      const suitBase = Math.floor(idx / 9) * 9;
      const pos = idx - suitBase;
      const handCodes = new Set(p.hand.map(tileCode));
      const patterns: ReadonlyArray<readonly [number, number]> = [
        [-2, -1],
        [-1, 1],
        [1, 2],
      ];
      for (const [d1, d2] of patterns) {
        const p1 = pos + d1;
        const p2 = pos + d2;
        if (p1 >= 0 && p1 <= 8 && p2 >= 0 && p2 <= 8) {
          const c1 = PLAYABLE_CODES.at(suitBase + p1);
          const c2 = PLAYABLE_CODES.at(suitBase + p2);
          if (c1 && c2 && handCodes.has(c1) && handCodes.has(c2)) {
            const sortedCodes = [code, c1, c2].sort(
              (a, b) => (CODE_INDEX_MAP.get(a) ?? 0) - (CODE_INDEX_MAP.get(b) ?? 0)
            );
            chows.push({ partnerCodes: [c1, c2], meldCodes: sortedCodes });
          }
        }
      }
    }

    bySeat.set(s, {
      winEval: winEval.canWin ? winEval : null,
      canKong,
      canPong,
      chows,
      decision: null,
    });
  }

  return bySeat.size > 0 ? { fromSeat, tileId, bySeat } : null;
}

function claimRank(type: string, fromSeat: number, seat: number, numSeats: number): number {
  if (type === 'win') return 100 - seatDistance(fromSeat, seat, numSeats);
  if (type === 'kong' || type === 'pong') return 50 - seatDistance(fromSeat, seat, numSeats);
  if (type === 'chow') return 20;
  return 0;
}

function executeClaimWinner(
  state: MatchState,
  best: {
    seat: number;
    decision: NonNullable<ClaimSeatEntry['decision']>;
    entry: ClaimSeatEntry;
  }
): void {
  const pc = state.pendingClaims;
  if (!pc) return;
  const { fromSeat, tileId } = pc;
  const code = tileCode(tileId);
  const claimer = state.players.at(best.seat);
  const fromPlayer = state.players.at(fromSeat);
  if (!claimer || !fromPlayer) return;

  if (fromPlayer.discards.at(-1) === tileId) {
    fromPlayer.discards.pop();
  }
  if (state.discardPool.at(-1) === tileId) {
    state.discardPool.pop();
  }

  if (best.decision.type === 'win' && best.entry.winEval) {
    settleWin(state, {
      winnerSeat: best.seat,
      loserSeat: fromSeat,
      selfDraw: false,
      winningTileId: tileId,
      fanResult: best.entry.winEval,
    });
    return;
  }

  state.isFirstGoAround = false;
  state.pendingClaims = null;
  state.lastDiscard = null;

  if (best.decision.type === 'kong') {
    const used = best.decision.tileIds ?? [];
    const removeSet = new Set(used);
    claimer.hand = claimer.hand.filter((id) => !removeSet.has(id));
    claimer.melds.push({
      type: 'kong',
      codes: best.decision.meldCodes ?? [code, code, code, code],
      tileIds: [...used, tileId],
      concealed: false,
      fromSeat,
    });
    pushLog(state, `座位 ${best.seat + 1} 明槓 ${tileSpec(code).name}`);

    const rep = state.wall.pop();
    if (!rep) {
      finishExhaustiveDraw(state);
      return;
    }
    claimer.hand.push(rep);
    claimer.lastDrawnId = rep;
    const bonusRes = absorbBonusTiles(state, best.seat);
    if (!bonusRes.ok) return;

    state.phase = 'turn';
    state.turnSeat = best.seat;
    state.canSelfAct = true;
    state.kongReplacement = true;
    return;
  }

  if (best.decision.type === 'pong') {
    const used = best.decision.tileIds ?? [];
    const removeSet = new Set(used);
    claimer.hand = sortHandIds(claimer.hand.filter((id) => !removeSet.has(id)));
    claimer.lastDrawnId = null;
    claimer.melds.push({
      type: 'pong',
      codes: best.decision.meldCodes ?? [code, code, code],
      tileIds: [...used, tileId],
      concealed: false,
      fromSeat,
    });
    pushLog(state, `座位 ${best.seat + 1} 碰 ${tileSpec(code).name}`);

    state.phase = 'turn';
    state.turnSeat = best.seat;
    state.canSelfAct = false;
    state.kongReplacement = false;
    return;
  }

  if (best.decision.type === 'chow') {
    const used = best.decision.tileIds ?? [];
    const meldCodes = best.decision.meldCodes ?? [];
    const removeSet = new Set(used);
    claimer.hand = sortHandIds(claimer.hand.filter((id) => !removeSet.has(id)));
    claimer.lastDrawnId = null;
    const pool = [...used, tileId];
    const orderedIds = meldCodes.map((mc) => {
      const exactIdx = pool.findIndex((id) => tileCode(id) === mc);
      if (exactIdx !== -1) return pool.splice(exactIdx, 1).at(0) ?? tileId;
      const jkIdx = pool.findIndex((id) => tileCode(id) === 'jk');
      return (jkIdx !== -1 ? pool.splice(jkIdx, 1).at(0) : pool.shift()) ?? tileId;
    });
    claimer.melds.push({
      type: 'chow',
      codes: meldCodes,
      tileIds: orderedIds,
      concealed: false,
      fromSeat,
    });
    pushLog(
      state,
      `座位 ${best.seat + 1} 上 ${meldCodes.map((c) => tileSpec(c).name).join('')}`
    );

    state.phase = 'turn';
    state.turnSeat = best.seat;
    state.canSelfAct = false;
    state.kongReplacement = false;
  }
}

function resolveClaimsIfReady(state: MatchState): void {
  const pc = state.pendingClaims;
  if (!pc) return;

  let best: {
    rank: number;
    seat: number;
    decision: NonNullable<ClaimSeatEntry['decision']>;
    entry: ClaimSeatEntry | null;
  } = { rank: 0, seat: -1, decision: { type: 'pass', chowIndex: 0 }, entry: null };
  let maxUndecided = -1;

  for (const [s, entry] of pc.bySeat.entries()) {
    if (!entry.decision) {
      maxUndecided = Math.max(maxUndecided, claimRank('win', pc.fromSeat, s, state.numSeats));
    } else {
      const r = claimRank(entry.decision.type, pc.fromSeat, s, state.numSeats);
      if (r > best.rank) {
        best = { rank: r, seat: s, decision: entry.decision, entry };
      }
    }
  }

  if (maxUndecided > best.rank) return;

  if (best.rank === 0 || !best.entry) {
    const nextSeat = (pc.fromSeat + 1) % state.numSeats;
    state.pendingClaims = null;
    advanceToSeatAndDraw(state, nextSeat);
  } else {
    executeClaimWinner(state, { seat: best.seat, decision: best.decision, entry: best.entry });
  }
}

function finishAddedKong(state: MatchState, seat: number, meldIdx: number, tileId: string): void {
  const p = state.players.at(seat);
  const m = p?.melds.at(meldIdx);
  if (!p || !m) return;
  const code = tileCode(tileId);
  m.type = 'kong';
  m.codes.push(code);
  m.tileIds?.push(tileId);
  pushLog(state, `座位 ${seat + 1} 加槓 ${tileSpec(code).name}`);

  const rep = state.wall.pop();
  if (!rep) {
    finishExhaustiveDraw(state);
    return;
  }
  p.hand.push(rep);
  p.lastDrawnId = rep;
  const bonusRes = absorbBonusTiles(state, seat);
  if (!bonusRes.ok) return;

  state.phase = 'turn';
  state.turnSeat = seat;
  state.canSelfAct = true;
  state.kongReplacement = true;
}

function resolveRobKongIfReady(state: MatchState): void {
  const rk = state.pendingRobKong;
  if (!rk) return;

  let bestRobber = -1;
  let bestDist = 99;
  let canBeat = false;
  for (const [s, e] of rk.bySeat.entries()) {
    const dist = seatDistance(rk.seat, s, state.numSeats);
    if (e.decision?.type === 'win' && e.winEval && dist < bestDist) {
      bestDist = dist;
      bestRobber = s;
    }
    if (!e.decision && dist < bestDist) {
      canBeat = true;
    }
  }

  if (canBeat) return;

  const robberEntry = rk.bySeat.get(bestRobber);
  if (bestRobber !== -1 && robberEntry?.winEval) {
    settleWin(state, {
      winnerSeat: bestRobber,
      loserSeat: rk.seat,
      selfDraw: false,
      winningTileId: rk.tileId,
      fanResult: robberEntry.winEval,
    });
  } else {
    state.pendingRobKong = null;
    finishAddedKong(state, rk.seat, rk.meldIdx, rk.tileId);
  }
}

function startAddedKongFlow(state: MatchState, seat: number, meldIdx: number, tileId: string): void {
  const robBySeat = new Map<number, RobKongSeatEntry>();
  for (let offset = 1; offset < state.numSeats; offset++) {
    const s = (seat + offset) % state.numSeats;
    const opp = state.players.at(s);
    if (!opp) continue;
    const winEval = evaluateWin({
      handIds: [...opp.hand, tileId],
      melds: opp.melds,
      bonusIds: opp.bonus,
      mode: state.mode,
      seatWind: opp.seatWind,
      roundWind: state.roundWind,
      selfDraw: false,
      robbedKong: true,
      rules: state.rules,
    });
    robBySeat.set(s, { winEval: winEval.canWin ? winEval : null, decision: null });
  }

  if (robBySeat.size > 0) {
    state.phase = 'robKong';
    state.pendingRobKong = { seat, meldIdx, tileId, bySeat: robBySeat };
    return;
  }

  finishAddedKong(state, seat, meldIdx, tileId);
}

export function applyAction(state: MatchState, seat: number, action: GameAction): MatchState {
  if (state.phase === 'turn') {
    const p = state.players.at(seat);
    if (!p) throw new Error('Invalid seat');

    if (seat !== state.turnSeat) {
      if (action.type === 'discard' || action.type === 'pass') {
        throw new Error('Not this seat turn');
      }
      applyPenalty(
        state,
        seat,
        action.type,
        action.type === 'win' ? 'FALSE_WIN_SHAPE' : 'OUT_OF_TURN'
      );
      return state;
    }

    const legal = getLegalActions(state, seat);
    if (!legal || legal.phase !== 'turn') throw new Error('No turn actions available');

    if (action.type === 'win') {
      if (!legal.win) {
        const seatTurns = state.turnsTaken.at(seat) ?? 0;
        const ev = evaluateWin({
          handIds: p.hand,
          melds: p.melds,
          bonusIds: p.bonus,
          mode: state.mode,
          seatWind: p.seatWind,
          roundWind: state.roundWind,
          selfDraw: true,
          kongReplacement: state.kongReplacement,
          lastTile: state.wall.length === 0,
          heavenly: seat === state.dealerSeat && state.isFirstGoAround && seatTurns === 0,
          earthly: seat !== state.dealerSeat && state.isFirstGoAround && seatTurns === 0,
          rules: state.rules,
        });
        applyPenalty(
          state,
          seat,
          'win',
          state.canSelfAct && ev.isShapeValid ? 'FALSE_WIN_FAN' : 'FALSE_WIN_SHAPE',
          ev.rawFan
        );
        return state;
      }
      state.lastPenalty = null;
      settleWin(state, {
        winnerSeat: seat,
        loserSeat: null,
        selfDraw: true,
        winningTileId: p.lastDrawnId ?? p.hand.at(-1) ?? '',
        fanResult: legal.win,
      });
      return state;
    }

    if (action.type === 'pong') {
      applyPenalty(state, seat, 'pong', 'WRONG_PONG');
      return state;
    }

    if (action.type === 'chow') {
      applyPenalty(state, seat, 'chow', 'WRONG_CHOW');
      return state;
    }

    if (action.type === 'exposeFly') {
      const candidateFlyIds =
        action.tileIds ??
        (legal.exposeFly ? p.hand.filter((id) => tileCode(id) === 'jk').slice(0, 1) : []);
      const picked =
        state.canSelfAct && state.wall.length > 0 && state.mode === '3p'
          ? extractDistinctFromHand(p.hand, candidateFlyIds, 1)
          : null;
      const flyId = picked?.at(0);
      if (!flyId || tileCode(flyId) !== 'jk') {
        applyPenalty(state, seat, 'exposeFly', 'WRONG_FLY');
        return state;
      }

      p.hand.splice(p.hand.indexOf(flyId), 1);
      state.lastPenalty = null;
      p.bonus.push(flyId);
      pushLog(state, `座位 ${seat + 1} 打飛 (+1番)`);

      const rep = state.wall.pop();
      if (!rep) {
        finishExhaustiveDraw(state);
        return state;
      }
      p.hand.push(rep);
      p.lastDrawnId = rep;
      const bonusRes = absorbBonusTiles(state, seat);
      if (!bonusRes.ok) return state;
      state.kongReplacement = true;
      state.canSelfAct = true;
      return state;
    }

    if (
      action.type === 'concealedKong' ||
      action.type === 'addedKong' ||
      action.type === 'kong'
    ) {
      if (!state.canSelfAct || state.wall.length === 0) {
        applyPenalty(state, seat, 'kong', 'WRONG_KONG');
        return state;
      }

      const candidateIds =
        action.tileIds ??
        (action.type === 'concealedKong' && action.code && legal.concealedKongs.includes(action.code)
          ? p.hand.filter((id) => tileCode(id) === action.code).slice(0, 4)
          : action.type === 'addedKong' && action.code && legal.addedKongs.includes(action.code)
            ? p.hand.filter((id) => tileCode(id) === action.code).slice(0, 1)
            : []);

      if (candidateIds.length === 4 && action.type !== 'addedKong') {
        const picked4 = extractDistinctFromHand(p.hand, candidateIds, 4);
        const firstCode = tileCode(picked4?.at(0) ?? '');
        if (
          !picked4 ||
          !firstCode ||
          firstCode === 'jk' ||
          CODE_INDEX_MAP.get(firstCode) === undefined ||
          !picked4.every((id) => tileCode(id) === firstCode)
        ) {
          applyPenalty(state, seat, 'kong', 'WRONG_KONG');
          return state;
        }
        state.lastPenalty = null;
        const removeSet = new Set(picked4);
        p.hand = p.hand.filter((id) => !removeSet.has(id));
        p.melds.push({
          type: 'kong',
          codes: [firstCode, firstCode, firstCode, firstCode],
          tileIds: picked4,
          concealed: true,
        });
        state.isFirstGoAround = false;
        pushLog(state, `座位 ${seat + 1} 暗槓 ${tileSpec(firstCode).name}`);

        const rep = state.wall.pop();
        if (!rep) {
          finishExhaustiveDraw(state);
          return state;
        }
        p.hand.push(rep);
        p.lastDrawnId = rep;
        const bonusRes = absorbBonusTiles(state, seat);
        if (!bonusRes.ok) return state;
        state.kongReplacement = true;
        state.canSelfAct = true;
        return state;
      }

      if (candidateIds.length === 1 && action.type !== 'concealedKong') {
        const picked1 = extractDistinctFromHand(p.hand, candidateIds, 1);
        const tileId = picked1?.at(0);
        const code = tileId ? tileCode(tileId) : '';
        const meldIdx = code
          ? p.melds.findIndex(
              (m) =>
                m.type === 'pong' &&
                tileCode(m.codes.at(0) ?? '') === code &&
                !(m.tileIds ?? []).some((tid) => tileCode(tid) === 'jk')
            )
          : -1;
        if (!tileId || code === 'jk' || meldIdx === -1) {
          applyPenalty(state, seat, 'kong', 'WRONG_KONG');
          return state;
        }
        state.lastPenalty = null;
        p.hand.splice(p.hand.indexOf(tileId), 1);
        p.hand = sortHandIds(p.hand);
        state.isFirstGoAround = false;
        startAddedKongFlow(state, seat, meldIdx, tileId);
        return state;
      }

      applyPenalty(state, seat, 'kong', 'WRONG_KONG');
      return state;
    }

    if (action.type === 'discard') {
      const tileId = action.tileId ?? '';
      const idx = p.hand.indexOf(tileId);
      if (idx === -1) throw new Error('Tile not in hand');
      state.lastPenalty = null;
      p.hand.splice(idx, 1);
      p.hand = sortHandIds(p.hand);
      p.lastDrawnId = null;
      p.discards.push(tileId);
      state.discardPool.push(tileId);
      state.turnsTaken = state.turnsTaken.map((t, s) => (s === seat ? t + 1 : t));
      if (state.turnsTaken.every((t) => t >= 1)) state.isFirstGoAround = false;
      state.kongReplacement = false;
      state.lastDiscard = { seat, tileId };

      const claims = buildClaimsForDiscard(state, seat, tileId);
      if (claims) {
        state.phase = 'claim';
        state.pendingClaims = claims;
      } else {
        advanceToSeatAndDraw(state, (seat + 1) % state.numSeats);
      }
      return state;
    }
  }

  if (state.phase === 'claim') {
    const pc = state.pendingClaims;
    const p = state.players.at(seat);
    const entry = pc?.bySeat.get(seat);
    if (!pc || !p) throw new Error('Invalid claim state');

    if (!entry || entry.decision) {
      if (action.type === 'pass') return state;
      applyPenalty(
        state,
        seat,
        action.type,
        action.type === 'win' ? 'FALSE_WIN_SHAPE' : 'OUT_OF_TURN'
      );
      return state;
    }

    const { type, chowIndex = 0 } = action;
    if (type === 'pass') {
      entry.decision = { type: 'pass', chowIndex: 0 };
      resolveClaimsIfReady(state);
      return state;
    }

    if (type === 'win') {
      if (!entry.winEval) {
        const ev = evaluateWin({
          handIds: [...p.hand, pc.tileId],
          melds: p.melds,
          bonusIds: p.bonus,
          mode: state.mode,
          seatWind: p.seatWind,
          roundWind: state.roundWind,
          selfDraw: false,
          lastTile: state.wall.length === 0,
          rules: state.rules,
        });
        applyPenalty(
          state,
          seat,
          'win',
          ev.isShapeValid ? 'FALSE_WIN_FAN' : 'FALSE_WIN_SHAPE',
          ev.rawFan
        );
        entry.decision = { type: 'pass', chowIndex: 0 };
        resolveClaimsIfReady(state);
        return state;
      }
      state.lastPenalty = null;
      entry.decision = { type: 'win', chowIndex: 0 };
      resolveClaimsIfReady(state);
      return state;
    }

    if (type === 'pong') {
      const valid = validatePongClaim(p.hand, pc.tileId, action.tileIds, state.mode);
      if (!valid) {
        applyPenalty(state, seat, 'pong', 'WRONG_PONG');
        entry.decision = { type: 'pass', chowIndex: 0 };
        resolveClaimsIfReady(state);
        return state;
      }
      state.lastPenalty = null;
      entry.decision = {
        type: 'pong',
        chowIndex: 0,
        tileIds: valid.usedIds,
        meldCodes: valid.meldCodes,
      };
      resolveClaimsIfReady(state);
      return state;
    }

    if (type === 'kong' || type === 'concealedKong' || type === 'addedKong') {
      const valid = validateKongClaim(p.hand, pc.tileId, action.tileIds, state.wall.length);
      if (!valid) {
        applyPenalty(state, seat, 'kong', 'WRONG_KONG');
        entry.decision = { type: 'pass', chowIndex: 0 };
        resolveClaimsIfReady(state);
        return state;
      }
      state.lastPenalty = null;
      entry.decision = {
        type: 'kong',
        chowIndex: 0,
        tileIds: valid.usedIds,
        meldCodes: valid.meldCodes,
      };
      resolveClaimsIfReady(state);
      return state;
    }

    if (type === 'chow') {
      const valid = validateChowClaim(
        p.hand,
        pc.tileId,
        pc.fromSeat,
        seat,
        state.numSeats,
        state.mode,
        action.tileIds,
        entry.chows,
        chowIndex
      );
      if (!valid) {
        applyPenalty(state, seat, 'chow', 'WRONG_CHOW');
        entry.decision = { type: 'pass', chowIndex: 0 };
        resolveClaimsIfReady(state);
        return state;
      }
      state.lastPenalty = null;
      entry.decision = {
        type: 'chow',
        chowIndex,
        tileIds: valid.usedIds,
        meldCodes: valid.meldCodes,
      };
      resolveClaimsIfReady(state);
      return state;
    }

    if (type === 'exposeFly') {
      applyPenalty(state, seat, 'exposeFly', 'WRONG_FLY');
      entry.decision = { type: 'pass', chowIndex: 0 };
      resolveClaimsIfReady(state);
      return state;
    }

    throw new Error('Unknown claim');
  }

  if (state.phase === 'robKong') {
    const rk = state.pendingRobKong;
    const p = state.players.at(seat);
    const entry = rk?.bySeat.get(seat);
    if (!rk || !p) throw new Error('Invalid rob-kong state');

    if (!entry || entry.decision) {
      if (action.type === 'pass') return state;
      applyPenalty(
        state,
        seat,
        action.type,
        action.type === 'win' ? 'FALSE_WIN_SHAPE' : 'OUT_OF_TURN'
      );
      return state;
    }

    if (action.type === 'pass') {
      entry.decision = { type: 'pass' };
      resolveRobKongIfReady(state);
      return state;
    }

    if (action.type === 'win') {
      if (!entry.winEval) {
        const ev = evaluateWin({
          handIds: [...p.hand, rk.tileId],
          melds: p.melds,
          bonusIds: p.bonus,
          mode: state.mode,
          seatWind: p.seatWind,
          roundWind: state.roundWind,
          selfDraw: false,
          robbedKong: true,
          rules: state.rules,
        });
        applyPenalty(
          state,
          seat,
          'win',
          ev.isShapeValid ? 'FALSE_WIN_FAN' : 'FALSE_WIN_SHAPE',
          ev.rawFan
        );
        entry.decision = { type: 'pass' };
        resolveRobKongIfReady(state);
        return state;
      }
      state.lastPenalty = null;
      entry.decision = { type: 'win' };
      resolveRobKongIfReady(state);
      return state;
    }

    const reasonMap = new Map<GameAction['type'], PenaltyReasonCode>([
      ['pong', 'WRONG_PONG'],
      ['kong', 'WRONG_KONG'],
      ['concealedKong', 'WRONG_KONG'],
      ['addedKong', 'WRONG_KONG'],
      ['chow', 'WRONG_CHOW'],
      ['exposeFly', 'WRONG_FLY'],
    ]);
    applyPenalty(state, seat, action.type, reasonMap.get(action.type) ?? 'OUT_OF_TURN');
    entry.decision = { type: 'pass' };
    resolveRobKongIfReady(state);
    return state;
  }

  throw new Error(`Cannot apply action in phase ${state.phase}`);
}

export function getPlayerView(state: MatchState, viewerSeat: number): PlayerView {
  return {
    mode: state.mode,
    numSeats: state.numSeats,
    rules: state.rules,
    roundWind: state.roundWind,
    dealerSeat: state.dealerSeat,
    dealerStreak: state.dealerStreak,
    handNumber: state.handNumber,
    scores: [...state.scores],
    phase: state.phase,
    wallCount: state.wall.length,
    turnSeat: state.turnSeat,
    lastDiscard: state.lastDiscard,
    lastPenalty: state.lastPenalty ?? null,
    discardPool: [...state.discardPool],
    viewerSeat,
    legalActions: viewerSeat >= 0 ? getLegalActions(state, viewerSeat) : null,
    players: state.players.map((p, idx) => {
      const revealAll = state.phase === 'handOver' || idx === viewerSeat;
      return {
        seat: p.seat,
        seatWind: p.seatWind,
        hand: revealAll ? [...p.hand] : null,
        handCount: p.hand.length,
        lastDrawnId: idx === viewerSeat ? p.lastDrawnId : null,
        melds: p.melds.map((m) => ({
          type: m.type,
          codes: m.concealed && !revealAll ? m.codes.map(() => 'back') : [...m.codes],
          tileIds:
            m.concealed && !revealAll ? undefined : m.tileIds ? [...m.tileIds] : undefined,
          concealed: m.concealed,
          fromSeat: m.fromSeat ?? null,
        })),
        bonus: [...p.bonus],
        discards: [...p.discards],
      };
    }),
    log: [...state.log],
    result: state.result,
  };
}

@Injectable({ providedIn: 'root' })
export class EngineService {
  createMatch(params?: Parameters<typeof createMatch>[0]): MatchState {
    return createMatch(params);
  }

  startNewHand(state: MatchState, rng?: () => number): MatchState {
    return startNewHand(state, rng);
  }

  applyAction(state: MatchState, seat: number, action: GameAction): MatchState {
    return applyAction(state, seat, action);
  }

  getPlayerView(state: MatchState, viewerSeat: number): PlayerView {
    return getPlayerView(state, viewerSeat);
  }
}
