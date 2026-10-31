import { Injectable } from '@angular/core';
import {
  GameAction,
  GameMode,
  Meld,
  PlayerPublicState,
  PlayerView,
  SuitType,
} from '../models/mahjong.model';
import { CODE_INDEX_MAP, PLAYABLE_CODES, tileCode, tileSpec } from '../utils/tiles.util';
import { getWaitingTiles, scoreBonusTiles } from './scorer.service';

function fanHonorValue(code: string, seatWind: number, roundWind: number, mode: GameMode): number {
  const spec = tileSpec(code);
  if (spec.kind !== 'honor') return 0;
  if (spec.suit === 'd') return 1;
  let fan = 0;
  if (spec.wind === seatWind) fan += 1;
  if (spec.wind === roundWind) fan += 1;
  if (mode === '3p' && spec.wind === 3) fan += 1;
  return fan;
}

function isFanHonor(code: string, seatWind: number, roundWind: number, mode: GameMode): boolean {
  return fanHonorValue(code, seatWind, roundWind, mode) > 0;
}

function countSeenTiles(view: PlayerView): Map<string, number> {
  const seen = new Map<string, number>();
  for (const p of view.players) {
    for (const d of p.discards) {
      const c = tileCode(d);
      seen.set(c, (seen.get(c) ?? 0) + 1);
    }
    for (const m of p.melds) {
      const src = m.tileIds ?? m.codes;
      for (const item of src) {
        const c = tileCode(item);
        if (c !== 'back') seen.set(c, (seen.get(c) ?? 0) + 1);
      }
    }
    for (const b of p.bonus) {
      const c = tileCode(b);
      if (c === 'jk') seen.set(c, (seen.get(c) ?? 0) + 1);
    }
  }
  return seen;
}

function discardDanger(code: string, view: PlayerView, seen: Map<string, number>): number {
  if (code === 'jk') return 90;
  const spec = tileSpec(code);
  const seenCnt = seen.get(code) ?? 0;
  let danger = 0;

  if (spec.kind === 'honor' && seenCnt >= 3) return -22;

  for (let idx = 0; idx < view.players.length; idx++) {
    if (idx === view.viewerSeat) continue;
    const opp = view.players.at(idx);
    if (!opp) continue;

    const oppDiscards = new Set(opp.discards.map(tileCode));
    if (oppDiscards.has(code)) {
      danger -= 10;
      continue;
    }

    const threat =
      opp.melds.length >= 3
        ? 2.4
        : opp.melds.length === 2
          ? 1.35
          : view.wallCount <= 18
            ? 1.05
            : 0.35;

    const oppMeldSuits = new Set<SuitType>();
    for (const m of opp.melds) {
      const mc = m.codes.at(0) ?? 'back';
      const ms = tileSpec(mc);
      if (ms.kind === 'suit' && (ms.suit === 'm' || ms.suit === 'p' || ms.suit === 's')) {
        oppMeldSuits.add(ms.suit);
      }
    }

    if (opp.melds.length >= 2 && oppMeldSuits.size <= 1) {
      const flushSuit = [...oppMeldSuits].at(0);
      if (spec.kind === 'suit' && (!flushSuit || spec.suit === flushSuit)) {
        danger += 14 * threat;
      }
      if (spec.kind === 'honor' && seenCnt <= 1) {
        danger += 12 * threat;
      }
    }

    if (spec.kind === 'suit') {
      const n = spec.num ?? 5;
      if (n >= 3 && n <= 7) danger += 6.5 * threat;
      else if (n === 2 || n === 8) danger += 3.5 * threat;
      else danger += 1.2 * threat;
    } else if (spec.kind === 'honor') {
      if (seenCnt === 0) danger += 8 * threat;
      else if (seenCnt === 1) danger += 3 * threat;
      else if (seenCnt === 2) danger -= 5;
    }
  }

  return Math.max(-25, danger);
}

function findSequenceCodes(handCodeCounts: Map<string, number>): Set<string> {
  const inSeq = new Set<string>();
  for (const suitBase of [0, 9, 18]) {
    for (let pos = 0; pos <= 6; pos++) {
      const c0 = PLAYABLE_CODES.at(suitBase + pos);
      const c1 = PLAYABLE_CODES.at(suitBase + pos + 1);
      const c2 = PLAYABLE_CODES.at(suitBase + pos + 2);
      if (
        c0 &&
        c1 &&
        c2 &&
        (handCodeCounts.get(c0) ?? 0) >= 1 &&
        (handCodeCounts.get(c1) ?? 0) >= 1 &&
        (handCodeCounts.get(c2) ?? 0) >= 1
      ) {
        inSeq.add(c0);
        inSeq.add(c1);
        inSeq.add(c2);
      }
    }
  }
  return inSeq;
}

function evaluateBestTenpaiDiscard(
  handIds: readonly string[],
  melds: readonly Meld[],
  bonusIds: readonly string[],
  view: PlayerView,
  me: PlayerPublicState,
  seen: Map<string, number>
): {
  bestDiscardId: string | null;
  bestScore: number;
  liveWinOuts: number;
  oneFanShort: boolean;
} {
  if (handIds.length % 3 !== 2) {
    return { bestDiscardId: null, bestScore: -Infinity, liveWinOuts: 0, oneFanShort: false };
  }

  const minFan = view.rules.minFan ?? 5;
  const testedCodes = new Set<string>();
  let bestDiscardId: string | null = null;
  let bestScore = -Infinity;
  let bestLiveOuts = 0;
  let oneFanShort = false;

  for (let i = 0; i < handIds.length; i++) {
    const candId = handIds.at(i);
    if (!candId) continue;
    const candCode = tileCode(candId);
    if (candCode === 'jk' || testedCodes.has(candCode)) continue;
    testedCodes.add(candCode);

    const remHand = handIds.filter((_, idx) => idx !== i);
    const waits = getWaitingTiles({
      handIds: remHand,
      melds: [...melds],
      bonusIds: [...bonusIds],
      mode: view.mode,
      seatWind: me.seatWind,
      roundWind: view.roundWind,
      rules: view.rules,
    });
    if (waits.length === 0) continue;

    const remCounts = new Map<string, number>();
    for (const id of remHand) {
      const c = tileCode(id);
      remCounts.set(c, (remCounts.get(c) ?? 0) + 1);
    }

    let liveOuts = 0;
    let waitValue = 0;
    for (const w of waits) {
      const live = Math.max(0, 4 - (seen.get(w.code) ?? 0) - (remCounts.get(w.code) ?? 0));
      if (w.canDiscardWin) {
        liveOuts += live;
        waitValue += live * (28 + Math.min(10, w.discardFan) * 3.5);
      } else if (w.canSelfDrawWin) {
        liveOuts += live;
        waitValue += live * (11 + Math.min(10, w.selfDrawFan) * 2);
      } else if (live > 0 && w.discardFan >= minFan - 1) {
        oneFanShort = true;
      }
    }

    if (liveOuts === 0) continue;

    const score = waitValue - discardDanger(candCode, view, seen) * 0.55;
    if (score > bestScore) {
      bestScore = score;
      bestDiscardId = candId;
      bestLiveOuts = liveOuts;
    }
  }

  return { bestDiscardId, bestScore, liveWinOuts: bestLiveOuts, oneFanShort };
}

function analyzeHandPlan(view: PlayerView, me: PlayerPublicState) {
  const suitCounts = new Map<SuitType, number>([
    ['m', 0],
    ['p', 0],
    ['s', 0],
  ]);
  const suitSetScore = new Map<SuitType, number>([
    ['m', 0],
    ['p', 0],
    ['s', 0],
  ]);
  const openSuits = new Set<SuitType>();
  let hasOpenHonor = false;
  let hasOpenChow = false;
  let openHonorFan = 0;
  let pongKongMelds = 0;

  for (const m of me.melds) {
    if (m.type === 'chow') hasOpenChow = true;
    else pongKongMelds++;
    const c = m.codes.at(0) ?? 'back';
    if (c === 'back') continue;
    const spec = tileSpec(c);
    if (spec.kind === 'suit' && (spec.suit === 'm' || spec.suit === 'p' || spec.suit === 's')) {
      openSuits.add(spec.suit);
      suitCounts.set(spec.suit, (suitCounts.get(spec.suit) ?? 0) + 3);
      suitSetScore.set(spec.suit, (suitSetScore.get(spec.suit) ?? 0) + 4);
    } else if (spec.kind === 'honor') {
      hasOpenHonor = true;
      openHonorFan += fanHonorValue(c, me.seatWind, view.roundWind, view.mode);
    }
  }

  const handCodeCounts = new Map<string, number>();
  let jokers = 0;
  for (const id of me.hand ?? []) {
    const c = tileCode(id);
    if (c === 'jk') {
      jokers++;
      continue;
    }
    handCodeCounts.set(c, (handCodeCounts.get(c) ?? 0) + 1);
    const spec = tileSpec(c);
    if (spec.kind === 'suit' && (spec.suit === 'm' || spec.suit === 'p' || spec.suit === 's')) {
      suitCounts.set(spec.suit, (suitCounts.get(spec.suit) ?? 0) + 1);
      suitSetScore.set(spec.suit, (suitSetScore.get(spec.suit) ?? 0) + 1);
    }
  }

  const sequenceCodes = findSequenceCodes(handCodeCounts);
  let distinctPairs = 0;
  let handPairsOrTrips = 0;
  let handHonorPotential = 0;

  for (const [code, cnt] of handCodeCounts.entries()) {
    const spec = tileSpec(code);
    if (cnt >= 2) {
      distinctPairs++;
      handPairsOrTrips++;
      if (spec.kind === 'suit' && (spec.suit === 'm' || spec.suit === 'p' || spec.suit === 's')) {
        suitSetScore.set(spec.suit, (suitSetScore.get(spec.suit) ?? 0) + (cnt >= 3 ? 2.5 : 1));
      }
      if (spec.kind === 'honor') {
        handHonorPotential += fanHonorValue(code, me.seatWind, view.roundWind, view.mode);
      }
    }
  }

  for (const sc of sequenceCodes) {
    const spec = tileSpec(sc);
    if (spec.kind === 'suit' && (spec.suit === 'm' || spec.suit === 'p' || spec.suit === 's')) {
      suitSetScore.set(spec.suit, (suitSetScore.get(spec.suit) ?? 0) + 0.6);
    }
  }

  let targetSuit: SuitType = 'p';
  if (view.mode === '4p') {
    const firstOpen = [...openSuits].at(0);
    if (openSuits.size === 1 && firstOpen) {
      targetSuit = firstOpen;
    } else {
      const sortedSuits = (['m', 'p', 's'] as SuitType[]).sort(
        (a, b) => (suitSetScore.get(b) ?? 0) - (suitSetScore.get(a) ?? 0)
      );
      targetSuit = sortedSuits.at(0) ?? 'p';
    }
  }

  const minFan = view.rules.minFan ?? 5;
  const bonusFan = scoreBonusTiles(me.bonus, me.seatWind, view.mode).fan;
  const confirmedExtraFan = bonusFan + openHonorFan;
  const projectedExtraFan = confirmedExtraFan + handHonorPotential + (jokers > 0 ? 1 : 0);
  const totalPairOrTriplet = pongKongMelds + handPairsOrTrips + jokers;
  const targetSuitCount = (suitCounts.get(targetSuit) ?? 0) + jokers;

  const goSevenPairs =
    Boolean(view.rules.sevenPairs) &&
    me.melds.length === 0 &&
    distinctPairs + jokers >= 5 &&
    pongKongMelds === 0;

  const goAllPongs =
    !hasOpenChow &&
    !goSevenPairs &&
    totalPairOrTriplet >= 4 &&
    (3 + projectedExtraFan >= minFan || openSuits.size <= 1 || totalPairOrTriplet >= 5);

  const goFlush =
    view.mode === '3p' ||
    openSuits.size === 1 ||
    (openSuits.size === 0 &&
      !goSevenPairs &&
      (targetSuitCount >= 7 || (!goAllPongs && projectedExtraFan < minFan)));

  const goPureFlush =
    goFlush && !hasOpenHonor && targetSuitCount >= 10 && 3 + projectedExtraFan < minFan;

  return {
    targetSuit,
    targetSuitCount,
    suitCounts,
    openSuits,
    hasOpenHonor,
    hasOpenChow,
    handCodeCounts,
    sequenceCodes,
    jokers,
    distinctPairs,
    totalPairOrTriplet,
    confirmedExtraFan,
    projectedExtraFan,
    goSevenPairs,
    goAllPongs,
    goFlush,
    goPureFlush,
  };
}

function chooseDiscard(
  view: PlayerView,
  me: PlayerPublicState,
  plan: ReturnType<typeof analyzeHandPlan>,
  seen: Map<string, number>
): string {
  const hand = me.hand ?? [];
  const highAlert = view.players.some(
    (p, idx) => idx !== view.viewerSeat && (p.melds.length >= 3 || view.wallCount <= 16)
  );

  let bestTileId = hand.at(0) ?? '';
  let lowestKeep = Infinity;

  for (const tileId of hand) {
    const code = tileCode(tileId);
    if (code === 'jk') {
      if (lowestKeep === Infinity) bestTileId = tileId;
      continue;
    }

    const spec = tileSpec(code);
    const cnt = plan.handCodeCounts.get(code) ?? 1;
    const seenCnt = seen.get(code) ?? 0;
    const totalSeen = seenCnt + cnt;
    const inSeq = plan.sequenceCodes.has(code);
    let keep = 0;

    if (plan.goSevenPairs) {
      if (cnt === 2) keep += 85;
      else if (cnt >= 3) keep += 35;
      else keep += totalSeen >= 3 ? -55 : (4 - totalSeen) * 8;
    } else if (spec.kind === 'suit') {
      const idx = CODE_INDEX_MAP.get(code) ?? 0;
      const suitBase = Math.floor(idx / 9) * 9;
      const pos = idx - suitBase;
      const prev1Code = pos >= 1 ? PLAYABLE_CODES.at(idx - 1) : undefined;
      const next1Code = pos <= 7 ? PLAYABLE_CODES.at(idx + 1) : undefined;
      const prev2Code = pos >= 2 ? PLAYABLE_CODES.at(idx - 2) : undefined;
      const next2Code = pos <= 6 ? PLAYABLE_CODES.at(idx + 2) : undefined;

      const cPrev1 = prev1Code ? (plan.handCodeCounts.get(prev1Code) ?? 0) : 0;
      const cNext1 = next1Code ? (plan.handCodeCounts.get(next1Code) ?? 0) : 0;
      const cPrev2 = prev2Code ? (plan.handCodeCounts.get(prev2Code) ?? 0) : 0;
      const cNext2 = next2Code ? (plan.handCodeCounts.get(next2Code) ?? 0) : 0;

      let shapeVal = 0;
      if (inSeq) shapeVal += 54;
      if (!plan.goAllPongs) {
        if (cPrev1 > 0) shapeVal += pos >= 1 && pos <= 7 ? 20 : 12;
        if (cNext1 > 0) shapeVal += pos >= 1 && pos <= 7 ? 20 : 12;
        if (cPrev2 > 0) shapeVal += 8;
        if (cNext2 > 0) shapeVal += 8;
        if (pos >= 2 && pos <= 6) shapeVal += 5;
      }

      if (cnt >= 3) shapeVal += 96;
      else if (cnt === 2) shapeVal += plan.goAllPongs ? 72 : 40;

      if (spec.suit !== plan.targetSuit && plan.goFlush) {
        const flushPenalty = plan.goPureFlush ? 125 : plan.openSuits.size === 1 ? 105 : 72;
        keep += shapeVal * 0.45 - flushPenalty;
      } else {
        keep += shapeVal + (spec.suit === plan.targetSuit ? 14 : 0);
      }
    } else if (spec.kind === 'honor') {
      const fanVal = fanHonorValue(code, me.seatWind, view.roundWind, view.mode);
      if (plan.goPureFlush && cnt < 3) {
        keep -= cnt === 2 ? 35 : 70;
      } else if (cnt >= 3) {
        keep += 105 + fanVal * 20;
      } else if (cnt === 2) {
        const liveLeft = 4 - totalSeen;
        keep += (liveLeft > 0 ? 56 : 24) + fanVal * 26 + (plan.goAllPongs ? 22 : 0);
      } else {
        if (totalSeen >= 3) keep -= 68;
        else if (fanVal > 0) keep += totalSeen === 2 ? -14 : 10 + fanVal * 6;
        else keep -= 48;
      }
    }

    const danger = discardDanger(code, view, seen);
    keep += danger * (highAlert ? 1.35 : 0.45);

    if (keep < lowestKeep) {
      lowestKeep = keep;
      bestTileId = tileId;
    }
  }

  return bestTileId;
}

export function chooseBotAction(view: PlayerView): GameAction | null {
  const legal = view.legalActions;
  const me = view.players.at(view.viewerSeat);
  if (!legal || !me) return null;

  if (legal.win) return { type: 'win' };
  if (legal.phase === 'robKong') return { type: 'pass' };

  const seen = countSeenTiles(view);
  const plan = analyzeHandPlan(view, me);
  const minFan = view.rules.minFan ?? 5;

  if (legal.phase === 'claim') {
    if (plan.goSevenPairs && !legal.canKong) return { type: 'pass' };

    const code = tileCode(legal.tileId);
    const spec = tileSpec(code);
    const hand = me.hand ?? [];
    const suitConsistent =
      plan.openSuits.size === 0 ||
      (plan.openSuits.size === 1 &&
        (spec.kind === 'honor' ||
          (spec.suit !== undefined && plan.openSuits.has(spec.suit as SuitType)))) ||
      plan.confirmedExtraFan >= minFan ||
      (plan.goAllPongs && 3 + plan.projectedExtraFan >= minFan);

    if (!suitConsistent) return { type: 'pass' };

    if (legal.canKong || legal.canPong) {
      const claimType = legal.canKong ? 'kong' : 'pong';
      const fanHonor = isFanHonor(code, me.seatWind, view.roundWind, view.mode);

      if (!legal.canKong) {
        let removed = 0;
        const simHand = hand.filter((id) => {
          if (tileCode(id) === code && removed < 2) {
            removed++;
            return false;
          }
          return true;
        });
        const simMelds: Meld[] = [
          ...me.melds,
          { type: 'pong', codes: [code, code, code], concealed: false, fromSeat: legal.fromSeat },
        ];
        const simTenpai = evaluateBestTenpaiDiscard(simHand, simMelds, me.bonus, view, me, seen);
        if (simTenpai.liveWinOuts > 0) {
          return { type: 'pong' };
        }
      }

      if (fanHonor && !plan.goPureFlush) {
        return { type: claimType };
      }

      if (plan.goAllPongs && (spec.kind === 'honor' || !plan.goFlush || spec.suit === plan.targetSuit)) {
        return { type: claimType };
      }

      if (spec.kind === 'suit' && spec.suit === plan.targetSuit) {
        const purePath = !plan.hasOpenHonor && plan.targetSuitCount >= 8;
        const mixedPath = 3 + plan.projectedExtraFan >= minFan && plan.targetSuitCount >= 6;
        if (purePath || mixedPath) {
          return { type: claimType };
        }
      }
    }

    if (legal.chows.length > 0 && spec.kind === 'suit') {
      let bestChowIdx = -1;
      let bestChowTenpaiOuts = 0;
      let bestHeuristicIdx = -1;
      let bestPenalty = Infinity;

      legal.chows.forEach((ch, idx) => {
        const needed = [...ch.partnerCodes];
        const simHand = hand.filter((id) => {
          const pos = needed.indexOf(tileCode(id));
          if (pos !== -1) {
            needed.splice(pos, 1);
            return false;
          }
          return true;
        });
        const simMelds: Meld[] = [
          ...me.melds,
          { type: 'chow', codes: [...ch.meldCodes], concealed: false, fromSeat: legal.fromSeat },
        ];
        const simTenpai = evaluateBestTenpaiDiscard(simHand, simMelds, me.bonus, view, me, seen);
        if (simTenpai.liveWinOuts > bestChowTenpaiOuts) {
          bestChowTenpaiOuts = simTenpai.liveWinOuts;
          bestChowIdx = idx;
        }

        let pen = 0;
        for (const pc of ch.partnerCodes) {
          const cCnt = plan.handCodeCounts.get(pc) ?? 0;
          if (cCnt >= 3) pen += 12;
          else if (cCnt === 2) pen += 4;
          if (plan.sequenceCodes.has(pc) && cCnt === 1) pen += 6;
        }
        if (pen < bestPenalty) {
          bestPenalty = pen;
          bestHeuristicIdx = idx;
        }
      });

      if (bestChowIdx !== -1 && bestChowTenpaiOuts > 0) {
        return { type: 'chow', chowIndex: bestChowIdx };
      }

      if (spec.suit === plan.targetSuit && !plan.goAllPongs && bestPenalty < 8) {
        const purePath = !plan.hasOpenHonor && plan.targetSuitCount >= 9 && 7 >= minFan;
        const mixedConfirmedPath = 3 + plan.confirmedExtraFan >= minFan && plan.targetSuitCount >= 7;
        const honorLockedPath = plan.confirmedExtraFan >= minFan;
        if ((purePath || mixedConfirmedPath || honorLockedPath) && bestHeuristicIdx !== -1) {
          return { type: 'chow', chowIndex: bestHeuristicIdx };
        }
      }
    }

    return { type: 'pass' };
  }

  if (legal.phase === 'turn') {
    if (legal.retrieveFlys.length > 0) {
      return { type: 'retrieveFly', code: legal.retrieveFlys.at(0) };
    }

    const hand = me.hand ?? [];
    const tenpai = evaluateBestTenpaiDiscard(hand, me.melds, me.bonus, view, me, seen);

    if (
      legal.exposeFly &&
      tenpai.liveWinOuts === 0 &&
      (tenpai.oneFanShort || (plan.jokers >= 2 && 3 + plan.projectedExtraFan < minFan))
    ) {
      return { type: 'exposeFly' };
    }

    for (const kCode of legal.concealedKongs) {
      const spec = tileSpec(kCode);
      const keepsTenpai =
        tenpai.liveWinOuts === 0 || tileCode(tenpai.bestDiscardId ?? '') === kCode;
      if (keepsTenpai && (spec.kind === 'honor' || !plan.goFlush || spec.suit === plan.targetSuit)) {
        return { type: 'concealedKong', code: kCode };
      }
    }
    for (const kCode of legal.addedKongs) {
      if (discardDanger(kCode, view, seen) < 28) {
        return { type: 'addedKong', code: kCode };
      }
    }

    if (tenpai.bestDiscardId && tenpai.liveWinOuts > 0) {
      return { type: 'discard', tileId: tenpai.bestDiscardId };
    }

    const discardId = chooseDiscard(view, me, plan, seen);
    return { type: 'discard', tileId: discardId };
  }

  return null;
}

@Injectable({ providedIn: 'root' })
export class BotService {
  chooseAction(view: PlayerView): GameAction | null {
    return chooseBotAction(view);
  }
}
