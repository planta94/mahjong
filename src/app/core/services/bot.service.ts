import { Injectable } from '@angular/core';
import { GameAction, GameMode, PlayerPublicState, PlayerView, SuitType } from '../models/mahjong.model';
import { CODE_INDEX_MAP, PLAYABLE_CODES, tileCode, tileSpec } from '../utils/tiles.util';
import { scoreBonusTiles } from './scorer.service';

function isFanHonor(code: string, seatWind: number, roundWind: number, mode: GameMode): boolean {
  const spec = tileSpec(code);
  if (spec.kind !== 'honor') return false;
  if (spec.suit === 'd') return true;
  if (spec.wind === seatWind || spec.wind === roundWind) return true;
  if (mode === '3p' && spec.wind === 3) return true;
  return false;
}

function countSeenTiles(view: PlayerView): Map<string, number> {
  const seen = new Map<string, number>();
  for (const p of view.players) {
    for (const d of p.discards) {
      const c = tileCode(d);
      seen.set(c, (seen.get(c) ?? 0) + 1);
    }
    for (const m of p.melds) {
      for (const c of m.codes) {
        if (c !== 'back') seen.set(c, (seen.get(c) ?? 0) + 1);
      }
    }
  }
  return seen;
}

function analyzeHandPlan(view: PlayerView, me: PlayerPublicState) {
  const suitCounts = new Map<SuitType, number>([
    ['m', 0],
    ['p', 0],
    ['s', 0],
  ]);
  const openSuits = new Set<SuitType>();
  let hasOpenHonor = false;
  let hasOpenChow = false;
  let openHonorFan = 0;

  for (const m of me.melds) {
    if (m.type === 'chow') hasOpenChow = true;
    const c = m.codes.at(0) ?? 'back';
    if (c === 'back') continue;
    const spec = tileSpec(c);
    if (spec.kind === 'suit' && (spec.suit === 'm' || spec.suit === 'p' || spec.suit === 's')) {
      openSuits.add(spec.suit);
      suitCounts.set(spec.suit, (suitCounts.get(spec.suit) ?? 0) + 3);
    } else if (spec.kind === 'honor') {
      hasOpenHonor = true;
      if (spec.suit === 'd') openHonorFan += 1;
      if (spec.wind === me.seatWind) openHonorFan += 1;
      if (spec.wind === view.roundWind) openHonorFan += 1;
      if (view.mode === '3p' && spec.wind === 3) openHonorFan += 1;
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
    }
  }

  let targetSuit: SuitType = 'p';
  if (view.mode === '4p') {
    const firstOpen = [...openSuits].at(0);
    if (openSuits.size === 1 && firstOpen) {
      targetSuit = firstOpen;
    } else {
      const sortedSuits = (['m', 'p', 's'] as SuitType[]).sort(
        (a, b) => (suitCounts.get(b) ?? 0) - (suitCounts.get(a) ?? 0)
      );
      targetSuit = sortedSuits.at(0) ?? 'p';
    }
  }

  const bonusFan = scoreBonusTiles(me.bonus, me.seatWind, view.mode).fan;
  let handHonorPotential = 0;
  let pairOrTripletCount = me.melds.length;
  for (const [code, cnt] of handCodeCounts.entries()) {
    const spec = tileSpec(code);
    if (cnt >= 2 && (spec.kind === 'honor' || spec.suit === targetSuit)) {
      pairOrTripletCount++;
      if (isFanHonor(code, me.seatWind, view.roundWind, view.mode)) {
        handHonorPotential += spec.wind === me.seatWind && spec.wind === view.roundWind ? 2 : 1;
      }
    }
  }

  const confirmedExtraFan = bonusFan + openHonorFan;
  const projectedExtraFan = confirmedExtraFan + handHonorPotential + (jokers > 0 ? 1 : 0);

  return {
    targetSuit,
    suitCounts,
    openSuits,
    hasOpenHonor,
    hasOpenChow,
    handCodeCounts,
    jokers,
    confirmedExtraFan,
    projectedExtraFan,
    pairOrTripletCount,
  };
}

function chooseDiscard(
  view: PlayerView,
  me: PlayerPublicState,
  plan: ReturnType<typeof analyzeHandPlan>
): string {
  // ponytail: greedy single-ply tile value heuristic; upgrade to shanten/ukeire Monte Carlo if tournament AI needed
  const hand = me.hand ?? [];
  const seen = countSeenTiles(view);
  const dangerMode = view.players.some((p, idx) => idx !== view.viewerSeat && p.melds.length >= 3);
  const targetSuitCount = plan.suitCounts.get(plan.targetSuit) ?? 0;

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
    let keep = 0;

    if (spec.kind === 'suit') {
      if (spec.suit !== plan.targetSuit) {
        keep -= 110 - cnt * 15;
      } else {
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

        if (cPrev1 > 0) keep += 18;
        if (cNext1 > 0) keep += 18;
        if (cPrev2 > 0) keep += 7;
        if (cNext2 > 0) keep += 7;
        if (pos >= 2 && pos <= 6) keep += 4;
      }
    } else if (spec.kind === 'honor') {
      const fanHonor = isFanHonor(code, me.seatWind, view.roundWind, view.mode);
      const goingPureSuit = !plan.hasOpenHonor && targetSuitCount >= 10 && cnt === 1;
      if (goingPureSuit) {
        keep -= 55;
      } else if (cnt === 1) {
        if (totalSeen >= 3) {
          keep -= 65;
        } else if (fanHonor) {
          keep += totalSeen === 2 ? -10 : 12;
        } else {
          keep -= 45;
        }
      } else if (fanHonor) {
        keep += 22;
      }
    }

    if (cnt === 2) keep += 36;
    if (cnt >= 3) keep += 82;

    if (dangerMode && cnt === 1) {
      if (seenCnt >= 2) keep -= 20;
      else if (seenCnt === 0 && spec.kind === 'suit') keep += 12;
    }

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

  const plan = analyzeHandPlan(view, me);
  const minFan = view.rules.minFan ?? 5;
  const targetSuitCount = plan.suitCounts.get(plan.targetSuit) ?? 0;

  if (legal.phase === 'claim') {
    const code = tileCode(legal.tileId);
    const spec = tileSpec(code);
    const suitConsistent =
      plan.openSuits.size === 0 ||
      (plan.openSuits.size === 1 &&
        (spec.kind === 'honor' ||
          (spec.suit !== undefined && plan.openSuits.has(spec.suit as SuitType))));

    if (!suitConsistent) return { type: 'pass' };

    const pairCount = [...plan.handCodeCounts.values()].filter((c) => c >= 2).length;
    if (view.rules.sevenPairs && me.melds.length === 0 && pairCount >= 5 && !legal.canKong) {
      return { type: 'pass' };
    }

    if (legal.canKong || legal.canPong) {
      const claimType = legal.canKong ? 'kong' : 'pong';
      const fanHonor = isFanHonor(code, me.seatWind, view.roundWind, view.mode);

      if (fanHonor && !(targetSuitCount >= 11 && !plan.hasOpenHonor)) {
        return { type: claimType };
      }

      if (spec.kind === 'suit' && spec.suit === plan.targetSuit) {
        const purePath = !plan.hasOpenHonor && targetSuitCount >= 8;
        const allPongsMixedPath = !plan.hasOpenChow && plan.pairOrTripletCount >= 3;
        const mixedPlusBonusPath = plan.projectedExtraFan >= minFan - 3;
        if (purePath || allPongsMixedPath || mixedPlusBonusPath) {
          return { type: claimType };
        }
      }

      if (spec.kind === 'honor' && !plan.hasOpenChow && plan.pairOrTripletCount >= 4) {
        return { type: claimType };
      }
    }

    if (legal.chows.length > 0 && spec.kind === 'suit' && spec.suit === plan.targetSuit) {
      const purePath = !plan.hasOpenHonor && targetSuitCount >= 9;
      const mixedConfirmedPath = plan.confirmedExtraFan >= minFan - 3 && targetSuitCount >= 7;

      if (purePath || mixedConfirmedPath) {
        let bestIdx = 0;
        let bestPenalty = Infinity;
        legal.chows.forEach((ch, idx) => {
          let pen = 0;
          for (const pc of ch.partnerCodes) {
            const cCnt = plan.handCodeCounts.get(pc) ?? 0;
            if (cCnt >= 3) pen += 10;
            if (cCnt === 2) pen += 3;
          }
          if (pen < bestPenalty) {
            bestPenalty = pen;
            bestIdx = idx;
          }
        });
        if (bestPenalty < 10) {
          return { type: 'chow', chowIndex: bestIdx };
        }
      }
    }

    return { type: 'pass' };
  }

  if (legal.phase === 'turn') {
    for (const kCode of legal.concealedKongs) {
      const spec = tileSpec(kCode);
      if (spec.kind === 'honor' || spec.suit === plan.targetSuit) {
        return { type: 'concealedKong', code: kCode };
      }
    }
    for (const kCode of legal.addedKongs) {
      return { type: 'addedKong', code: kCode };
    }

    const discardId = chooseDiscard(view, me, plan);
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
