import { Injectable, inject } from '@angular/core';
import {
  ActionCardId,
  BalikKampungAction,
  BalikKampungMatchState,
  BalikKampungPlayer,
  ReachableMoveOption,
  SimpangCorridor,
  TrackPosition,
} from '../models/balik-kampung.model';
import { BalikKampungEngineService, isSimpangLane } from './balik-kampung-engine.service';

@Injectable({
  providedIn: 'root',
})
export class BalikKampungBotService {
  private readonly engine = inject(BalikKampungEngineService);

  decideBotPlan(
    state: BalikKampungMatchState,
    bot: BalikKampungPlayer
  ): Extract<BalikKampungAction, { type: 'SELECT_PLAN' }> | null {
    const playable = this.engine.getPlayableCards(state, bot);
    if (playable.length === 0) {
      return null;
    }

    // Check if Singgah R&R (0) hits an official R&R or Warung bay
    if (playable.includes(0)) {
      const pitOpt = this.engine.computeReachableOptions(state, bot, 0, false).at(0);
      const isFacilityStop =
        pitOpt?.pitStopKind === 'RNR' || pitOpt?.pitStopKind === 'WARUNG';

      if (playable.length === 1) {
        return { type: 'SELECT_PLAN', cardId: 0, useFuelDump: false };
      }

      if (
        isFacilityStop &&
        (bot.bladder >= 2 || bot.hand.length <= 2 || bot.stress >= 4)
      ) {
        return { type: 'SELECT_PLAN', cardId: 0, useFuelDump: false };
      }
    }

    let bestCard: ActionCardId = playable.at(0) ?? 2;
    let bestFuelDump = false;
    let bestScore = -99999;

    for (const cardId of playable) {
      if (cardId === 0) {
        const pitOpt = this.engine.computeReachableOptions(state, bot, 0, false).at(0);
        const facility =
          pitOpt?.pitStopKind === 'RNR' || pitOpt?.pitStopKind === 'WARUNG';
        const score0 = facility
          ? 6 + bot.bladder * 4 + bot.discardPile.length * 3
          : -12 + bot.discardPile.length * 2;
        if (score0 > bestScore) {
          bestScore = score0;
          bestCard = 0;
          bestFuelDump = false;
        }
        continue;
      }

      const tryFuelVariants =
        bot.drivetrain === 'ICE' &&
        !bot.fuelDumpUsed &&
        (state.simpangTigaDrawn || state.roadDeck.length <= 16)
          ? [false, true]
          : [false];

      for (const fuel of tryFuelVariants) {
        const opts = this.engine.computeReachableOptions(state, bot, cardId, fuel);
        if (opts.length === 0) continue;

        let bestOptScore = -99999;
        for (const opt of opts) {
          const s = this.evaluateMoveOption(state, bot, cardId, opt);
          if (s > bestOptScore) {
            bestOptScore = s;
          }
        }

        let cardAdjust = 0;
        if (cardId === 3) {
          if (bot.bladder >= 3) {
            cardAdjust -= 40; // Avoid Bladder 4 Rupture!
          } else if (bot.bladder === 2) {
            cardAdjust -= 8; // Bladder 3 causes +1 Stress
          } else {
            cardAdjust -= 2;
          }
        }
        if (cardId === 2 && bot.stress > 0) {
          cardAdjust += 3;
        }
        if (fuel) {
          // Conserve Fuel Dump unless gaining significant net value
          cardAdjust -= 4;
        }

        const totalScore = bestOptScore + cardAdjust;
        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestCard = cardId;
          bestFuelDump = fuel;
        }
      }
    }

    return {
      type: 'SELECT_PLAN',
      cardId: bestCard,
      useFuelDump: bestFuelDump,
    };
  }

  decideActiveBotAction(
    state: BalikKampungMatchState,
    bot: BalikKampungPlayer
  ): BalikKampungAction | null {
    if (state.activeSeat !== bot.seat) {
      return null;
    }

    if (state.phase === 'EV_CHARGE_PROMPT') {
      return {
        type: 'CHOOSE_EV_CHARGE',
        mode: bot.stress <= 2 ? 'DC_FAST' : 'AC_SLOW',
      };
    }

    if (state.phase === 'SIMPANG_SCOUT_PROMPT') {
      return {
        type: 'CHOOSE_SCOUTED_SIMPANG',
        branch: this.pickBestSimpangBranch(state, bot),
      };
    }

    if (state.phase === 'RESOLVING') {
      if (state.reachableOptions.length === 0) {
        return null;
      }
      const cardId = bot.revealedCard ?? 2;
      let bestOpt = state.reachableOptions.at(0)!;
      let bestScore = -99999;

      for (const opt of state.reachableOptions) {
        const s = this.evaluateMoveOption(state, bot, cardId, opt);
        if (s > bestScore) {
          bestScore = s;
          bestOpt = opt;
        }
      }

      return {
        type: 'COMMIT_MOVE',
        optionId: bestOpt.optionId,
        spendScoutOnAwas: bot.scoutTokens > 0,
      };
    }

    return null;
  }

  private pickBestSimpangBranch(
    state: BalikKampungMatchState,
    bot: BalikKampungPlayer
  ): SimpangCorridor {
    const rem = state.pendingScoutSteps;
    const speed = state.pendingScoutPlayedSpeed;

    // If enough steps to clear Jalan Utama cleanly (needs 5 steps after slot 0 due to speed bump), zero stress!
    if (rem >= 4) {
      return 'UTAMA';
    }
    // If Kubur finishes immediately (rem >= 2) and bot can afford +2 Stress without Meltdown
    if (rem >= 2 && (speed < 3 || bot.stress <= 2)) {
      return 'KUBUR';
    }
    if (bot.stress >= 4) {
      return 'UTAMA';
    }
    return 'BENDANG';
  }

  private evaluateMoveOption(
    state: BalikKampungMatchState,
    bot: BalikKampungPlayer,
    cardId: ActionCardId,
    opt: ReachableMoveOption
  ): number {
    if (opt.pitStopKind === 'RNR' || opt.pitStopKind === 'WARUNG') {
      return 15 + bot.bladder * 4 + (bot.stress > 0 ? 3 : 0);
    }
    if (opt.pitStopKind === 'SHOULDER') {
      return -5;
    }

    let score = 0;

    if (opt.destination.lane === 'FINISH') {
      score += 120 + opt.overshootSpaces * 3;
    } else if (isSimpangLane(opt.destination.lane)) {
      const branchLen =
        opt.destination.lane === 'KUBUR'
          ? 2
          : opt.destination.lane === 'BENDANG'
            ? 3
            : 4;
      const stepsLeft = branchLen - opt.destination.slot;
      score += 80 - stepsLeft * 6;
    } else {
      const progress = opt.destination.trackOrder * 2 + opt.destination.slot;
      const startProgress = bot.pos.trackOrder * 2 + bot.pos.slot;
      score += (progress - startProgress) * 4;
    }

    if (opt.isScoutFrontier) {
      score += 5 + opt.scoutStepsRemaining * 3;
      if (bot.scoutTokens < 2) {
        score += 3;
      }
    }

    if (opt.slipstreamApplied) {
      score += 5;
    }

    if (opt.crossedAwasOrders.length > 0) {
      if (bot.scoutTokens >= opt.crossedAwasOrders.length) {
        score -= 2 * opt.crossedAwasOrders.length;
      } else {
        score -= 10 * opt.crossedAwasOrders.length;
      }
    }

    if (bot.drivetrain === 'EV' && opt.crossedDownhillOrders.length > 0) {
      score += 5;
    }

    if (cardId === 5 && !opt.passedTarget) {
      score -= 6;
    }

    if (opt.enteringSimpangBranch === 'KUBUR' && opt.totalEffectiveSpeed >= 3) {
      score -= bot.stress >= 4 ? 25 : 8;
    }

    if (opt.enteringSimpangBranch === 'BENDANG') {
      score -= 3; // 1/3 mud trap risk
    }

    // Bonus for positioning within 0-2 spaces behind an R&R or Warung when needing a pit stop next round
    if (
      !state.simpangTigaDrawn &&
      (bot.bladder >= 2 || bot.hand.length <= 2) &&
      (opt.destination.lane === 'LEFT' || opt.destination.lane === 'TRUNK')
    ) {
      if (this.isNearPitFacility(state, opt.destination)) {
        score += 6;
      }
    }

    return score;
  }

  private isNearPitFacility(state: BalikKampungMatchState, pos: TrackPosition): boolean {
    if (pos.lane !== 'LEFT' && pos.lane !== 'TRUNK') {
      return false;
    }
    const target = pos.lane === 'LEFT' ? 'RNR' : 'WARUNG';
    for (let offset = 0; offset <= 1; offset++) {
      const seg = state.visibleTrack.find((s) => s.trackOrder === pos.trackOrder + offset);
      if (!seg || seg.card.kind !== 'STANDARD') continue;
      const arr = pos.lane === 'LEFT' ? seg.card.left : seg.card.trunk;
      if (arr[0] === target || arr[1] === target) {
        return true;
      }
    }
    return false;
  }
}
