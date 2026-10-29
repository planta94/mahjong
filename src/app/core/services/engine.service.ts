import { Injectable } from '@angular/core';
import {
  ChowOption,
  ClaimSeatEntry,
  GameAction,
  GameMode,
  GameRules,
  LegalActions,
  MatchState,
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
import { DEFAULT_RULES, calculatePayout, evaluateWin } from './scorer.service';

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

  for (let i = 0; i < 13; i++) {
    for (let s = 0; s < state.numSeats; s++) {
      const seat = (state.dealerSeat + s) % state.numSeats;
      const drawn = state.wall.shift();
      const target = state.players.at(seat);
      if (drawn && target) target.hand.push(drawn);
    }
  }
  const dealerExtra = state.wall.shift();
  const dealerPlayer = state.players.at(state.dealerSeat);
  if (dealerExtra && dealerPlayer) {
    dealerPlayer.hand.push(dealerExtra);
    dealerPlayer.lastDrawnId = dealerExtra;
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
          if (m.type === 'pong') {
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
  if (code === 'jk' || idx === undefined) return null;

  const bySeat = new Map<number, ClaimSeatEntry>();

  for (let offset = 1; offset < state.numSeats; offset++) {
    const s = (fromSeat + offset) % state.numSeats;
    const p = state.players.at(s);
    if (!p) continue;

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

    if (winEval.canWin || canKong || canPong || chows.length > 0) {
      bySeat.set(s, {
        winEval: winEval.canWin ? winEval : null,
        canKong,
        canPong,
        chows,
        decision: null,
      });
    }
  }

  return bySeat.size > 0 ? { fromSeat, tileId, bySeat } : null;
}

function claimRank(type: string, fromSeat: number, seat: number, numSeats: number): number {
  if (type === 'win') return 100 - seatDistance(fromSeat, seat, numSeats);
  if (type === 'kong' || type === 'pong') return 50 - seatDistance(fromSeat, seat, numSeats);
  if (type === 'chow') return 20;
  return 0;
}

function maxPotentialRank(
  entry: ClaimSeatEntry,
  fromSeat: number,
  seat: number,
  numSeats: number
): number {
  if (entry.winEval) return claimRank('win', fromSeat, seat, numSeats);
  if (entry.canKong || entry.canPong) return claimRank('pong', fromSeat, seat, numSeats);
  if (entry.chows.length > 0) return claimRank('chow', fromSeat, seat, numSeats);
  return 0;
}

function executeClaimWinner(
  state: MatchState,
  best: { seat: number; decision: { type: GameAction['type']; chowIndex: number }; entry: ClaimSeatEntry }
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
    const used: string[] = [];
    claimer.hand = claimer.hand.filter((id) => {
      if (tileCode(id) === code && used.length < 3) {
        used.push(id);
        return false;
      }
      return true;
    });
    claimer.melds.push({
      type: 'kong',
      codes: [code, code, code, code],
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
    const used: string[] = [];
    claimer.hand = claimer.hand.filter((id) => {
      if (tileCode(id) === code && used.length < 2) {
        used.push(id);
        return false;
      }
      return true;
    });
    claimer.hand = sortHandIds(claimer.hand);
    claimer.lastDrawnId = null;
    claimer.melds.push({
      type: 'pong',
      codes: [code, code, code],
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
    const chosen = best.entry.chows.at(best.decision.chowIndex) ?? best.entry.chows.at(0);
    if (!chosen) return;
    const needed: string[] = [...chosen.partnerCodes];
    const used: string[] = [];
    claimer.hand = claimer.hand.filter((id) => {
      const c = tileCode(id);
      const pos = needed.indexOf(c);
      if (pos !== -1) {
        needed.splice(pos, 1);
        used.push(id);
        return false;
      }
      return true;
    });
    claimer.hand = sortHandIds(claimer.hand);
    claimer.lastDrawnId = null;
    const sortedTileIds = [...used, tileId].sort(
      (a, b) => (CODE_INDEX_MAP.get(tileCode(a)) ?? 0) - (CODE_INDEX_MAP.get(tileCode(b)) ?? 0)
    );
    claimer.melds.push({
      type: 'chow',
      codes: chosen.meldCodes,
      tileIds: sortedTileIds,
      concealed: false,
      fromSeat,
    });
    pushLog(
      state,
      `座位 ${best.seat + 1} 上 ${chosen.meldCodes.map((c) => tileSpec(c).name).join('')}`
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
    decision: { type: GameAction['type']; chowIndex: number };
    entry: ClaimSeatEntry | null;
  } = { rank: 0, seat: -1, decision: { type: 'pass', chowIndex: 0 }, entry: null };
  let maxUndecided = -1;

  for (const [s, entry] of pc.bySeat.entries()) {
    if (!entry.decision) {
      maxUndecided = Math.max(maxUndecided, maxPotentialRank(entry, pc.fromSeat, s, state.numSeats));
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

export function applyAction(state: MatchState, seat: number, action: GameAction): MatchState {
  if (state.phase === 'turn') {
    if (seat !== state.turnSeat) throw new Error('Not this seat turn');
    const legal = getLegalActions(state, seat);
    if (!legal || legal.phase !== 'turn') throw new Error('No turn actions available');
    const p = state.players.at(seat);
    if (!p) throw new Error('Invalid seat');

    if (action.type === 'win') {
      if (!legal.win) throw new Error('Self-draw win not legal');
      settleWin(state, {
        winnerSeat: seat,
        loserSeat: null,
        selfDraw: true,
        winningTileId: p.lastDrawnId ?? p.hand.at(-1) ?? '',
        fanResult: legal.win,
      });
      return state;
    }

    if (action.type === 'exposeFly') {
      if (!legal.exposeFly) throw new Error('Expose Fly not legal');
      const flyIdx = p.hand.findIndex((id) => tileCode(id) === 'jk');
      const [flyId] = p.hand.splice(flyIdx, 1);
      if (flyId) p.bonus.push(flyId);
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

    if (action.type === 'concealedKong') {
      const code = action.code ?? '';
      if (!legal.concealedKongs.includes(code)) throw new Error('Concealed kong not legal');
      const used: string[] = [];
      p.hand = p.hand.filter((id) => {
        if (tileCode(id) === code && used.length < 4) {
          used.push(id);
          return false;
        }
        return true;
      });
      p.melds.push({
        type: 'kong',
        codes: [code, code, code, code],
        tileIds: used,
        concealed: true,
      });
      state.isFirstGoAround = false;
      pushLog(state, `座位 ${seat + 1} 暗槓 ${tileSpec(code).name}`);

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

    if (action.type === 'addedKong') {
      const code = action.code ?? '';
      if (!legal.addedKongs.includes(code)) throw new Error('Added kong not legal');
      const tilePos = p.hand.findIndex((id) => tileCode(id) === code);
      const [tileId] = p.hand.splice(tilePos, 1);
      if (!tileId) throw new Error('Missing kong tile');
      p.hand = sortHandIds(p.hand);
      const meldIdx = p.melds.findIndex((m) => m.type === 'pong' && tileCode(m.codes.at(0) ?? '') === code);
      state.isFirstGoAround = false;

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
        if (winEval.canWin) {
          robBySeat.set(s, { winEval, decision: null });
        }
      }

      if (robBySeat.size > 0) {
        state.phase = 'robKong';
        state.pendingRobKong = { seat, meldIdx, tileId, bySeat: robBySeat };
        return state;
      }

      finishAddedKong(state, seat, meldIdx, tileId);
      return state;
    }

    if (action.type === 'discard') {
      const tileId = action.tileId ?? '';
      const idx = p.hand.indexOf(tileId);
      if (idx === -1) throw new Error('Tile not in hand');
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
    const entry = state.pendingClaims?.bySeat.get(seat);
    if (!entry || entry.decision) throw new Error('No pending claim for this seat');

    const { type, chowIndex = 0 } = action;
    if (type === 'win' && !entry.winEval) throw new Error('Win claim not legal');
    if (type === 'kong' && !entry.canKong) throw new Error('Kong claim not legal');
    if (type === 'pong' && !entry.canPong) throw new Error('Pong claim not legal');
    if (type === 'chow' && !entry.chows.at(chowIndex)) throw new Error('Chow claim not legal');
    if (!['win', 'kong', 'pong', 'chow', 'pass'].includes(type)) throw new Error('Unknown claim');

    entry.decision = { type, chowIndex };
    resolveClaimsIfReady(state);
    return state;
  }

  if (state.phase === 'robKong') {
    const rk = state.pendingRobKong;
    const entry = rk?.bySeat.get(seat);
    if (!rk || !entry || entry.decision) throw new Error('No rob-kong option for this seat');
    if (action.type !== 'win' && action.type !== 'pass') throw new Error('Invalid rob-kong response');

    entry.decision = { type: action.type };

    let bestRobber = -1;
    let bestDist = 99;
    let canBeat = false;
    for (const [s, e] of rk.bySeat.entries()) {
      const dist = seatDistance(rk.seat, s, state.numSeats);
      if (e.decision?.type === 'win' && dist < bestDist) {
        bestDist = dist;
        bestRobber = s;
      }
      if (!e.decision && dist < bestDist) {
        canBeat = true;
      }
    }

    if (canBeat) return state;

    const robberEntry = rk.bySeat.get(bestRobber);
    if (bestRobber !== -1 && robberEntry) {
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
