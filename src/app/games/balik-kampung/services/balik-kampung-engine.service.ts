import { Injectable } from '@angular/core';
import {
  ALL_ACTION_CARDS,
  ARRIVAL_BONUS_BY_RANK,
  BASE_TRAFFIC_EVENT_DECK,
  FINISH_ROAD_CARD,
  SIMPANG_TIGA_CARD,
  STANDARD_ROAD_SEGMENTS,
  START_ROAD_CARD,
} from '../data/balik-kampung-cards.data';
import {
  ActionCardId,
  ActiveRoadCard,
  BalikKampungAction,
  BalikKampungInitConfig,
  BalikKampungLogEntry,
  BalikKampungMatchState,
  BalikKampungMoveTrace,
  BalikKampungPlayer,
  BalikKampungPlayerView,
  BalikKampungPublicPlayer,
  FinalStandingEntry,
  ReachableMoveOption,
  RoadCorridor,
  RoadSegmentCard,
  SimpangCorridor,
  SpaceFeature,
  StandardCorridor,
  TrackPosition,
} from '../models/balik-kampung.model';

const MAX_BLADDER = 4;
const MAX_STRESS = 6;
const MAX_SCOUT_TOKENS = 2;
const HORIZON_AHEAD_CARDS = 5;
const MAX_LOGS = 40;

const SIMPANG_BRANCH_LENGTHS: ReadonlyMap<SimpangCorridor, number> = new Map<
  SimpangCorridor,
  number
>([
  ['KUBUR', 2],
  ['BENDANG', 3],
  ['UTAMA', 4],
]);

const LANE_TIE_PRIORITY: ReadonlyMap<RoadCorridor, number> = new Map<RoadCorridor, number>([
  ['FINISH', 100],
  ['KUBUR', 50],
  ['BENDANG', 49],
  ['UTAMA', 48],
  ['RIGHT', 30],
  ['LEFT', 20],
  ['TRUNK', 10],
]);

const POLE_POSITIONS: readonly TrackPosition[] = [
  { trackOrder: 0, lane: 'RIGHT', slot: 1 },
  { trackOrder: 0, lane: 'LEFT', slot: 1 },
  { trackOrder: 0, lane: 'TRUNK', slot: 1 },
  { trackOrder: 0, lane: 'RIGHT', slot: 0 },
  { trackOrder: 0, lane: 'LEFT', slot: 0 },
];

export function shuffleWithRng<T>(items: readonly T[], rng: () => number): T[] {
  const pool = new Map<number, T>();
  items.forEach((item, idx) => pool.set(idx, item));
  const len = items.length;
  for (let i = len - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const vi = pool.get(i);
    const vj = pool.get(j);
    if (vi !== undefined && vj !== undefined) {
      pool.set(i, vj);
      pool.set(j, vi);
    }
  }
  const out: T[] = [];
  for (let i = 0; i < len; i++) {
    const val = pool.get(i);
    if (val !== undefined) {
      out.push(val);
    }
  }
  return out;
}

export function isStandardLane(lane: RoadCorridor): lane is StandardCorridor {
  return lane === 'RIGHT' || lane === 'LEFT' || lane === 'TRUNK';
}

export function isHighwayLane(lane: RoadCorridor): lane is 'RIGHT' | 'LEFT' {
  return lane === 'RIGHT' || lane === 'LEFT';
}

export function isSimpangLane(lane: RoadCorridor): lane is SimpangCorridor {
  return lane === 'KUBUR' || lane === 'BENDANG' || lane === 'UTAMA';
}

export function sameTrackPos(a: TrackPosition, b: TrackPosition): boolean {
  return a.trackOrder === b.trackOrder && a.lane === b.lane && a.slot === b.slot;
}

@Injectable({
  providedIn: 'root',
})
export class BalikKampungEngineService {
  createInitialState(config: BalikKampungInitConfig): BalikKampungMatchState {
    const rng = config.rng ?? Math.random;

    const shuffled45 = shuffleWithRng(STANDARD_ROAD_SEGMENTS, rng);
    const top35 = shuffled45.slice(0, 35);
    const bottom10 = shuffled45.slice(35);
    const bottomWithSimpang = shuffleWithRng([...bottom10, SIMPANG_TIGA_CARD], rng);
    const fullRoadDeck: RoadSegmentCard[] = [...top35, ...bottomWithSimpang];

    const visibleTrack: ActiveRoadCard[] = [
      {
        trackOrder: 0,
        card: START_ROAD_CARD,
        awasDisarmed: false,
        hasHazardCone: false,
      },
    ];

    for (let i = 1; i <= HORIZON_AHEAD_CARDS; i++) {
      const next = fullRoadDeck.shift();
      if (next) {
        visibleTrack.push({
          trackOrder: i,
          card: next,
          awasDisarmed: false,
          hasHazardCone: false,
        });
      }
    }

    const players: BalikKampungPlayer[] = config.seats.map((seatCfg, idx) => {
      const startPos = POLE_POSITIONS.at(idx) ?? { trackOrder: 0, lane: 'TRUNK', slot: 0 };
      return {
        seat: seatCfg.seat,
        name: seatCfg.name,
        isBot: seatCfg.isBot,
        persona: seatCfg.persona,
        drivetrain: seatCfg.drivetrain,
        pos: { ...startPos },
        bladder: 0,
        stress: 0,
        scoutTokens: 0,
        hand: [...ALL_ACTION_CARDS],
        discardPile: [],
        isSkipNext: false,
        skippedThisRound: false,
        fuelDumpUsed: false,
        evInstantTorqueReady: false,
        evInstantTorqueActiveThisRound: false,
        evFastChargeBonusReady: 0,
        evFastChargeBonusActiveThisRound: 0,
        mudTrapped: false,
        plannedCard: null,
        plannedFuelDump: false,
        hasLockedPlan: false,
        revealedCard: null,
        revealedFuelDump: false,
        finishedRank: null,
        finishedRound: null,
        finishedOvershoot: 0,
      };
    });

    const trafficDeck = shuffleWithRng(BASE_TRAFFIC_EVENT_DECK, rng);

    const state: BalikKampungMatchState = {
      phase: 'PLANNING',
      roundNumber: 0,
      players,
      visibleTrack,
      roadDeck: fullRoadDeck,
      finishCard: FINISH_ROAD_CARD,
      trafficDeck,
      trafficDiscard: [],
      activeTrafficEvent: 'SMARTLANE',
      rempit: {
        pos: { trackOrder: 1, lane: 'LEFT', slot: 0 },
        active: false,
      },
      resolutionQueue: [],
      activeSeat: 0,
      reachableOptions: [],
      pendingScoutSteps: 0,
      pendingScoutPlayedSpeed: 0,
      pendingScoutPassedTarget: false,
      simpangTigaDrawn: false,
      rnrBanned: false,
      nextFinishRank: 1,
      lastDiceRoll: null,
      lastCoinFlip: null,
      recentMoves: [],
      standings: [],
      logs: [],
    };

    this.beginNewRound(state, rng);
    return state;
  }

  buildPlayerView(state: BalikKampungMatchState, viewerSeat: number): BalikKampungPlayerView {
    const publicPlayers: BalikKampungPublicPlayer[] = state.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      isBot: p.isBot,
      persona: p.persona,
      drivetrain: p.drivetrain,
      pos: { ...p.pos },
      bladder: p.bladder,
      stress: p.stress,
      scoutTokens: p.scoutTokens,
      hand: [...p.hand],
      discardPile: [...p.discardPile],
      isSkipNext: p.isSkipNext,
      skippedThisRound: p.skippedThisRound,
      fuelDumpUsed: p.fuelDumpUsed,
      evInstantTorqueReady: p.evInstantTorqueReady,
      evInstantTorqueActiveThisRound: p.evInstantTorqueActiveThisRound,
      evFastChargeBonusReady: p.evFastChargeBonusReady,
      evFastChargeBonusActiveThisRound: p.evFastChargeBonusActiveThisRound,
      mudTrapped: p.mudTrapped,
      hasLockedPlan: p.hasLockedPlan,
      myPlannedCard: p.seat === viewerSeat ? p.plannedCard : null,
      myPlannedFuelDump: p.seat === viewerSeat ? p.plannedFuelDump : false,
      revealedCard: state.phase === 'PLANNING' ? null : p.revealedCard,
      revealedFuelDump: state.phase === 'PLANNING' ? false : p.revealedFuelDump,
      finishedRank: p.finishedRank,
      finishedRound: p.finishedRound,
      finishedOvershoot: p.finishedOvershoot,
    }));

    const viewerPlayer = state.players.find((p) => p.seat === viewerSeat);
    const playableCards =
      state.phase === 'PLANNING' && viewerPlayer && !viewerPlayer.hasLockedPlan
        ? this.getPlayableCards(state, viewerPlayer)
        : [];

    return {
      phase: state.phase,
      roundNumber: state.roundNumber,
      players: publicPlayers,
      visibleTrack: state.visibleTrack.map((seg) => ({
        trackOrder: seg.trackOrder,
        card: seg.card,
        awasDisarmed: seg.awasDisarmed,
        hasHazardCone: seg.hasHazardCone,
      })),
      roadDeckCount: state.roadDeck.length,
      inDangerZone: !state.simpangTigaDrawn && state.roadDeck.length <= 11,
      trafficDeckCount: state.trafficDeck.length,
      activeTrafficEvent: state.activeTrafficEvent,
      rempit: {
        pos: { ...state.rempit.pos },
        active: state.rempit.active,
      },
      resolutionQueue: [...state.resolutionQueue],
      activeSeat: state.activeSeat,
      reachableOptions: state.reachableOptions.map((opt) => ({
        ...opt,
        destination: { ...opt.destination },
        trail: (opt.trail ?? []).map((pos) => ({ ...pos })),
        crossedAwasOrders: [...opt.crossedAwasOrders],
        crossedDownhillOrders: [...opt.crossedDownhillOrders],
      })),
      playableCards,
      simpangTigaDrawn: state.simpangTigaDrawn,
      rnrBanned: state.rnrBanned,
      lastDiceRoll: state.lastDiceRoll,
      lastCoinFlip: state.lastCoinFlip,
      recentMoves: (state.recentMoves ?? []).map((m) => ({
        moveSeq: m.moveSeq,
        seat: m.seat,
        trail: m.trail.map((p) => ({ ...p })),
      })),
      standings: state.standings.map((s) => ({ ...s })),
      logs: state.logs.map((l) => ({ ...l })),
    };
  }

  applyAction(
    state: BalikKampungMatchState,
    seat: number,
    action: BalikKampungAction,
    rng: () => number = Math.random
  ): boolean {
    if (state.phase === 'GAMEOVER') {
      return false;
    }

    switch (action.type) {
      case 'LOBBY_SET_DRIVETRAIN':
      case 'LOBBY_SET_PERSONA':
        return false;
      case 'SELECT_PLAN':
        return this.handleSelectPlan(state, seat, action.cardId, Boolean(action.useFuelDump), rng);
      case 'UNSELECT_PLAN':
        return this.handleUnselectPlan(state, seat);
      case 'COMMIT_MOVE':
        return this.handleCommitMove(
          state,
          seat,
          action.optionId,
          action.spendScoutOnAwas ?? true,
          rng
        );
      case 'CHOOSE_EV_CHARGE':
        return this.handleChooseEvCharge(state, seat, action.mode, rng);
      case 'CHOOSE_SCOUTED_SIMPANG':
        return this.handleChooseScoutedSimpang(state, seat, action.branch, rng);
    }
  }

  getPlayableCards(state: BalikKampungMatchState, player: BalikKampungPlayer): ActionCardId[] {
    if (player.pos.lane === 'FINISH' || player.skippedThisRound) {
      return [];
    }

    const candidates: ActionCardId[] = [];
    for (const cardId of player.hand) {
      if (cardId === 0 && state.rnrBanned) {
        continue;
      }
      if (cardId === 2 && player.bladder >= 2) {
        continue;
      }
      if (cardId === 0) {
        candidates.push(0);
        continue;
      }
      const opts = this.computeReachableOptions(state, player, cardId, false);
      if (opts.length > 0) {
        candidates.push(cardId);
      }
    }
    return candidates;
  }

  computeReachableOptions(
    state: BalikKampungMatchState,
    player: BalikKampungPlayer,
    cardId: ActionCardId,
    useFuelDump: boolean
  ): ReachableMoveOption[] {
    if (player.pos.lane === 'FINISH') {
      return [];
    }

    if (cardId === 0) {
      return [this.computePitStopOption(state, player)];
    }

    const totalSpeed = this.calculateEffectiveSpeed(state, player, cardId, useFuelDump);
    const optionsMap = new Map<string, ReachableMoveOption>();

    interface SearchNode {
      pos: TrackPosition;
      stepsLeft: number;
      trail: TrackPosition[];
      crossedAwas: number[];
      crossedDownhills: number[];
      evRegenUsed: boolean;
      enteredSimpang: SimpangCorridor | null;
      stepsInTrunk: number;
      stepsInLeft: number;
      swappedOnCurrentSlot: boolean;
    }

    const startNode: SearchNode = {
      pos: { ...player.pos },
      stepsLeft: totalSpeed,
      trail: [{ ...player.pos }],
      crossedAwas: [],
      crossedDownhills: [],
      evRegenUsed: false,
      enteredSimpang: null,
      stepsInTrunk: 0,
      stepsInLeft: 0,
      swappedOnCurrentSlot: false,
    };

    const queue: SearchNode[] = [startNode];
    const visitedBest = new Map<string, number>();

    const recordLandingCandidate = (
      node: SearchNode,
      isScoutFrontier: boolean,
      scoutRemaining: number,
      overshoot: number
    ): void => {
      if (isScoutFrontier) {
        if (!this.isCardDestinationLaneAllowed(cardId, node.pos.lane)) {
          return;
        }
        const key = `SCOUT:${node.pos.trackOrder}:${node.pos.lane}:${node.pos.slot}`;
        const existing = optionsMap.get(key);
        if (!existing || scoutRemaining > existing.scoutStepsRemaining) {
          optionsMap.set(key, {
            optionId: key,
            destination: { ...node.pos },
            trail: node.trail.map((pos) => ({ ...pos })),
            isScoutFrontier: true,
            scoutStepsRemaining: scoutRemaining,
            crossedAwasOrders: [...node.crossedAwas],
            crossedDownhillOrders: [...node.crossedDownhills],
            passedTarget: this.didPassAnyTarget(state, player.seat, player.pos, node.pos),
            slipstreamApplied: false,
            pitStopKind: 'NONE',
            enteringSimpangBranch: null,
            overshootSpaces: 0,
            totalEffectiveSpeed: totalSpeed,
          });
        }
        return;
      }

      if (node.pos.lane === 'FINISH') {
        const key = `FINISH:${node.enteredSimpang ?? 'ANY'}`;
        const existing = optionsMap.get(key);
        if (!existing || overshoot > existing.overshootSpaces) {
          optionsMap.set(key, {
            optionId: key,
            destination: { ...node.pos },
            trail: node.trail.map((pos) => ({ ...pos })),
            isScoutFrontier: false,
            scoutStepsRemaining: 0,
            crossedAwasOrders: [...node.crossedAwas],
            crossedDownhillOrders: [...node.crossedDownhills],
            passedTarget: this.didPassAnyTarget(state, player.seat, player.pos, node.pos),
            slipstreamApplied: false,
            pitStopKind: 'NONE',
            enteringSimpangBranch: node.enteredSimpang,
            overshootSpaces: overshoot,
            totalEffectiveSpeed: totalSpeed,
          });
        }
        return;
      }

      // Enforce Space Exclusivity by backing up along trail if final slot is occupied
      let resolvedPos: TrackPosition | null = null;
      let resolvedIdx = -1;
      for (let idx = node.trail.length - 1; idx >= 0; idx--) {
        const candidate = node.trail.at(idx);
        if (!candidate) continue;
        if (sameTrackPos(candidate, player.pos)) {
          continue;
        }
        if (
          !this.isSpaceOccupiedByOther(state, candidate, player.seat) &&
          !this.isSpaceBlockedByCone(state, candidate) &&
          this.isCardDestinationLaneAllowed(cardId, candidate.lane)
        ) {
          resolvedPos = candidate;
          resolvedIdx = idx;
          break;
        }
      }

      if (!resolvedPos) {
        return;
      }

      const leftCap = state.activeTrafficEvent === 'SMARTLANE' ? 4 : 3;
      if (resolvedPos.lane === 'LEFT' && cardId !== 5 && node.stepsInLeft > leftCap) {
        return;
      }

      const resolvedTrail = node.trail
        .slice(0, resolvedIdx + 1)
        .map((pos) => ({ ...pos }));

      const baseKey = `MOVE:${resolvedPos.trackOrder}:${resolvedPos.lane}:${resolvedPos.slot}:0`;
      if (!optionsMap.has(baseKey)) {
        optionsMap.set(baseKey, {
          optionId: baseKey,
          destination: { ...resolvedPos },
          trail: resolvedTrail,
          isScoutFrontier: false,
          scoutStepsRemaining: 0,
          crossedAwasOrders: [...node.crossedAwas],
          crossedDownhillOrders: [...node.crossedDownhills],
          passedTarget: this.didPassAnyTarget(state, player.seat, player.pos, resolvedPos),
          slipstreamApplied: false,
          pitStopKind: 'NONE',
          enteringSimpangBranch: node.enteredSimpang,
          overshootSpaces: 0,
          totalEffectiveSpeed: totalSpeed,
        });
      }

      // Check Highway Slipstream Draft (+1 space ahead of car directly in front)
      if (isHighwayLane(resolvedPos.lane)) {
        const ahead1 = this.stepForwardStandard(state, resolvedPos);
        if (
          ahead1 &&
          !ahead1.beyondHorizon &&
          (ahead1.nextCard.card.kind === 'STANDARD' || ahead1.nextCard.card.kind === 'START') &&
          this.isSpaceOccupiedByCarOnly(state, ahead1.nextPos, player.seat)
        ) {
          const ahead2 = this.stepForwardStandard(state, ahead1.nextPos);
          if (
            ahead2 &&
            !ahead2.beyondHorizon &&
            (ahead2.nextCard.card.kind === 'STANDARD' || ahead2.nextCard.card.kind === 'START') &&
            !this.isSpaceOccupiedByOther(state, ahead2.nextPos, player.seat) &&
            !this.isSpaceBlockedByCone(state, ahead2.nextPos)
          ) {
            const slipKey = `SLIP:${ahead2.nextPos.trackOrder}:${ahead2.nextPos.lane}:${ahead2.nextPos.slot}:1`;
            if (!optionsMap.has(slipKey)) {
              const extraAwas = [...node.crossedAwas];
              if (
                ahead2.nextPos.lane === 'RIGHT' &&
                ahead2.nextPos.slot === 1 &&
                ahead2.nextCard.card.right[1] === 'AWAS' &&
                !ahead2.nextCard.awasDisarmed &&
                totalSpeed >= 4 &&
                !extraAwas.includes(ahead2.nextCard.trackOrder)
              ) {
                extraAwas.push(ahead2.nextCard.trackOrder);
              }
              optionsMap.set(slipKey, {
                optionId: slipKey,
                destination: { ...ahead2.nextPos },
                trail: [
                  ...resolvedTrail,
                  { ...ahead1.nextPos },
                  { ...ahead2.nextPos },
                ],
                isScoutFrontier: false,
                scoutStepsRemaining: 0,
                crossedAwasOrders: extraAwas,
                crossedDownhillOrders: [...node.crossedDownhills],
                passedTarget: true,
                slipstreamApplied: true,
                pitStopKind: 'NONE',
                enteringSimpangBranch: null,
                overshootSpaces: 0,
                totalEffectiveSpeed: totalSpeed,
              });
            }
          }
        }
      }
    };

    while (queue.length > 0) {
      const curr = queue.shift();
      if (!curr) break;

      const stateSig = `${curr.pos.trackOrder}:${curr.pos.lane}:${curr.pos.slot}:${curr.swappedOnCurrentSlot ? 1 : 0}:${curr.enteredSimpang ?? '-'}`;
      const bestSeen = visitedBest.get(stateSig);
      if (bestSeen !== undefined && bestSeen > curr.stepsLeft) {
        continue;
      }
      visitedBest.set(stateSig, curr.stepsLeft);

      if (curr.stepsLeft <= 0) {
        recordLandingCandidate(curr, false, 0, 0);
        continue;
      }

      let progressedForward = false;

      // 1. Forward step(s)
      if (isStandardLane(curr.pos.lane)) {
        const fwd = this.stepForwardStandard(state, curr.pos);
        if (!fwd) {
          recordLandingCandidate(curr, false, 0, 0);
          continue;
        }

        if (fwd.beyondHorizon) {
          // Moving past the last visible card triggers Scouting!
          progressedForward = true;
          recordLandingCandidate(
            {
              ...curr,
              pos: fwd.nextPos,
              stepsLeft: 0,
              trail: [...curr.trail, fwd.nextPos],
            },
            true,
            curr.stepsLeft - 1,
            0
          );
        } else if (fwd.nextCard.card.kind === 'SIMPANG_TIGA') {
          const branches: readonly SimpangCorridor[] = ['KUBUR', 'BENDANG', 'UTAMA'];
          for (const branch of branches) {
            const branchStart: TrackPosition = {
              trackOrder: fwd.nextCard.trackOrder,
              lane: branch,
              slot: 0,
            };
            if (
              branch === 'KUBUR' &&
              this.isSpaceOccupiedByOther(state, branchStart, player.seat)
            ) {
              continue;
            }
            progressedForward = true;
            // On Bendang entry, 1d6 mud roll resolves on commit, so stop preview on Bendang entry or continue optimistically?
            // Stopping only if stepsLeft - 1 === 0; otherwise let preview trace full branch (mud roll 1-2 clamps on commit!)
            queue.push({
              pos: branchStart,
              stepsLeft: curr.stepsLeft - 1,
              trail: [...curr.trail, branchStart],
              crossedAwas: [...curr.crossedAwas],
              crossedDownhills: [...curr.crossedDownhills],
              evRegenUsed: curr.evRegenUsed,
              enteredSimpang: branch,
              stepsInTrunk: curr.stepsInTrunk,
              stepsInLeft: curr.stepsInLeft,
              swappedOnCurrentSlot: false,
            });
          }
        } else if (
          (fwd.nextCard.card.kind === 'STANDARD' || fwd.nextCard.card.kind === 'START') &&
          isStandardLane(fwd.nextPos.lane)
        ) {
          if (!this.isSpaceBlockedByCone(state, fwd.nextPos)) {
            const feat = this.getFeatureAt(fwd.nextCard.card, fwd.nextPos.lane, fwd.nextPos.slot);
            const stepCost = fwd.nextPos.lane === 'TRUNK' && feat === 'OBSTACLE' ? 2 : 1;

            if (curr.stepsLeft >= stepCost) {
              const nextStepsInTrunk =
                fwd.nextPos.lane === 'TRUNK' ? curr.stepsInTrunk + stepCost : curr.stepsInTrunk;
              const nextStepsInLeft =
                fwd.nextPos.lane === 'LEFT' ? curr.stepsInLeft + 1 : curr.stepsInLeft;

              const leftCap = state.activeTrafficEvent === 'SMARTLANE' ? 4 : 3;
              const trunkExceeded = fwd.nextPos.lane === 'TRUNK' && nextStepsInTrunk > 3;
              const leftExceeded =
                fwd.nextPos.lane === 'LEFT' && cardId !== 5 && nextStepsInLeft > leftCap;

              if (!trunkExceeded && !leftExceeded) {
                progressedForward = true;
                let remAfter = curr.stepsLeft - stepCost;
                if (fwd.nextPos.lane === 'TRUNK') {
                  remAfter = Math.min(remAfter, Math.max(0, 3 - nextStepsInTrunk));
                }

                const nextAwas = [...curr.crossedAwas];
                if (
                  fwd.nextPos.lane === 'RIGHT' &&
                  fwd.nextPos.slot === 1 &&
                  fwd.nextCard.card.right[1] === 'AWAS' &&
                  !fwd.nextCard.awasDisarmed &&
                  totalSpeed >= 4 &&
                  !nextAwas.includes(fwd.nextCard.trackOrder)
                ) {
                  nextAwas.push(fwd.nextCard.trackOrder);
                }

                const nextDownhills = [...curr.crossedDownhills];
                let nextEvRegen = curr.evRegenUsed;
                if (fwd.nextCard.card.isDownhill) {
                  if (!nextDownhills.includes(fwd.nextCard.trackOrder)) {
                    nextDownhills.push(fwd.nextCard.trackOrder);
                  }
                  if (player.drivetrain === 'EV' && !nextEvRegen) {
                    nextEvRegen = true;
                    remAfter += 1;
                  }
                }

                queue.push({
                  pos: fwd.nextPos,
                  stepsLeft: remAfter,
                  trail: [...curr.trail, fwd.nextPos],
                  crossedAwas: nextAwas,
                  crossedDownhills: nextDownhills,
                  evRegenUsed: nextEvRegen,
                  enteredSimpang: curr.enteredSimpang,
                  stepsInTrunk: nextStepsInTrunk,
                  stepsInLeft: nextStepsInLeft,
                  swappedOnCurrentSlot: false,
                });
              }
            }
          }
        }
      } else if (isSimpangLane(curr.pos.lane)) {
        const branchLen = SIMPANG_BRANCH_LENGTHS.get(curr.pos.lane) ?? 2;
        const nextSlot = curr.pos.slot + 1;
        if (nextSlot >= branchLen) {
          const finishSeg = state.visibleTrack.find((s) => s.card.kind === 'FINISH');
          const finishOrder = finishSeg ? finishSeg.trackOrder : curr.pos.trackOrder + 1;
          const finishPos: TrackPosition = {
            trackOrder: finishOrder,
            lane: 'FINISH',
            slot: 0,
          };
          progressedForward = true;
          recordLandingCandidate(
            {
              ...curr,
              pos: finishPos,
              stepsLeft: 0,
              trail: [...curr.trail, finishPos],
            },
            false,
            0,
            curr.stepsLeft - 1
          );
        } else {
          const nextBranchPos: TrackPosition = {
            trackOrder: curr.pos.trackOrder,
            lane: curr.pos.lane,
            slot: nextSlot,
          };
          const singleFileBlocked =
            curr.pos.lane === 'KUBUR' &&
            this.isSpaceOccupiedByOther(state, nextBranchPos, player.seat);
          const stepCost = curr.pos.lane === 'UTAMA' && nextSlot === 1 ? 2 : 1;

          if (!singleFileBlocked && curr.stepsLeft >= stepCost) {
            progressedForward = true;
            queue.push({
              pos: nextBranchPos,
              stepsLeft: curr.stepsLeft - stepCost,
              trail: [...curr.trail, nextBranchPos],
              crossedAwas: [...curr.crossedAwas],
              crossedDownhills: [...curr.crossedDownhills],
              evRegenUsed: curr.evRegenUsed,
              enteredSimpang: curr.enteredSimpang,
              stepsInTrunk: curr.stepsInTrunk,
              stepsInLeft: curr.stepsInLeft,
              swappedOnCurrentSlot: false,
            });
          }
        }
      }

      // 2. Sideways Lane Change on START / STANDARD cards
      if (isStandardLane(curr.pos.lane) && !curr.swappedOnCurrentSlot) {
        const currentSeg = state.visibleTrack.find((s) => s.trackOrder === curr.pos.trackOrder);
        if (
          currentSeg &&
          (currentSeg.card.kind === 'START' || currentSeg.card.kind === 'STANDARD')
        ) {
          const adjacentLanes: Array<{ lane: StandardCorridor; baseCost: number }> = [];
          const hwySwapCost = state.activeTrafficEvent === 'SMARTLANE' ? 0 : 1;

          if (curr.pos.lane === 'RIGHT') {
            adjacentLanes.push({ lane: 'LEFT', baseCost: hwySwapCost });
          } else if (curr.pos.lane === 'LEFT') {
            adjacentLanes.push({ lane: 'RIGHT', baseCost: hwySwapCost });
            if (currentSeg.card.hasInterchange) {
              adjacentLanes.push({ lane: 'TRUNK', baseCost: 1 });
            }
          } else if (curr.pos.lane === 'TRUNK' && currentSeg.card.hasInterchange) {
            adjacentLanes.push({ lane: 'LEFT', baseCost: 1 });
          }

          for (const adj of adjacentLanes) {
            const swapPos: TrackPosition = {
              trackOrder: curr.pos.trackOrder,
              lane: adj.lane,
              slot: curr.pos.slot,
            };
            if (this.isSpaceBlockedByCone(state, swapPos)) {
              continue;
            }
            const alreadyVisitedSlot = curr.trail.some((t) => sameTrackPos(t, swapPos));
            if (alreadyVisitedSlot) {
              continue;
            }

            const feat = this.getFeatureAt(currentSeg.card, adj.lane, swapPos.slot);
            const extraObstacleCost = adj.lane === 'TRUNK' && feat === 'OBSTACLE' ? 1 : 0;
            const totalSwapCost = adj.baseCost + extraObstacleCost;

            if (curr.stepsLeft >= totalSwapCost) {
              let remAfter = curr.stepsLeft - totalSwapCost;
              const nextStepsInTrunk =
                adj.lane === 'TRUNK' ? curr.stepsInTrunk + totalSwapCost : curr.stepsInTrunk;
              if (adj.lane === 'TRUNK') {
                remAfter = Math.min(remAfter, Math.max(0, 3 - nextStepsInTrunk));
              }

              const nextAwas = [...curr.crossedAwas];
              if (
                adj.lane === 'RIGHT' &&
                swapPos.slot === 1 &&
                currentSeg.card.right[1] === 'AWAS' &&
                !currentSeg.awasDisarmed &&
                totalSpeed >= 4 &&
                !nextAwas.includes(currentSeg.trackOrder)
              ) {
                nextAwas.push(currentSeg.trackOrder);
              }

              queue.push({
                pos: swapPos,
                stepsLeft: remAfter,
                trail: [...curr.trail, swapPos],
                crossedAwas: nextAwas,
                crossedDownhills: [...curr.crossedDownhills],
                evRegenUsed: curr.evRegenUsed,
                enteredSimpang: curr.enteredSimpang,
                stepsInTrunk: nextStepsInTrunk,
                stepsInLeft: curr.stepsInLeft,
                swappedOnCurrentSlot: adj.baseCost === 0,
              });
            }
          }
        }
      }

      // If blocked from advancing (e.g. 2-cost obstacle/bump with 1 step left, or Trunk cap reached), allow stopping here
      if (!progressedForward) {
        recordLandingCandidate(curr, false, 0, 0);
      }
    }

    const result = Array.from(optionsMap.values()).sort((a, b) => {
      if (a.destination.lane === 'FINISH' && b.destination.lane !== 'FINISH') return -1;
      if (b.destination.lane === 'FINISH' && a.destination.lane !== 'FINISH') return 1;
      if (a.isScoutFrontier !== b.isScoutFrontier) {
        return a.isScoutFrontier ? -1 : 1;
      }
      const progA = a.destination.trackOrder * 10 + a.destination.slot;
      const progB = b.destination.trackOrder * 10 + b.destination.slot;
      if (progA !== progB) {
        return progB - progA;
      }
      if (a.crossedAwasOrders.length !== b.crossedAwasOrders.length) {
        return a.crossedAwasOrders.length - b.crossedAwasOrders.length;
      }
      const sameLaneA = a.destination.lane === player.pos.lane ? 0 : 1;
      const sameLaneB = b.destination.lane === player.pos.lane ? 0 : 1;
      return sameLaneA - sameLaneB;
    });

    // Safe fallback if completely boxed in by 4 other cars on a valid lane
    if (
      result.length === 0 &&
      this.isCardDestinationLaneAllowed(cardId, player.pos.lane)
    ) {
      result.push({
        optionId: `STAY:${player.pos.trackOrder}:${player.pos.lane}:${player.pos.slot}`,
        destination: { ...player.pos },
        trail: [{ ...player.pos }],
        isScoutFrontier: false,
        scoutStepsRemaining: 0,
        crossedAwasOrders: [],
        crossedDownhillOrders: [],
        passedTarget: false,
        slipstreamApplied: false,
        pitStopKind: 'NONE',
        enteringSimpangBranch: null,
        overshootSpaces: 0,
        totalEffectiveSpeed: totalSpeed,
      });
    }

    return result;
  }

  calculateEffectiveSpeed(
    state: BalikKampungMatchState,
    player: BalikKampungPlayer,
    cardId: ActionCardId,
    useFuelDump: boolean
  ): number {
    if (cardId === 0) {
      return 0;
    }

    let speed: number = cardId;

    if (
      useFuelDump &&
      player.drivetrain === 'ICE' &&
      (!player.fuelDumpUsed || player.revealedFuelDump)
    ) {
      speed += 2;
    }
    if (
      player.drivetrain === 'EV' &&
      player.evInstantTorqueActiveThisRound &&
      (cardId === 4 || cardId === 5)
    ) {
      speed += 1;
    }
    if (player.drivetrain === 'EV' && player.evFastChargeBonusActiveThisRound > 0) {
      speed += player.evFastChargeBonusActiveThisRound;
    }
    if (state.activeTrafficEvent === 'JEM' && isHighwayLane(player.pos.lane)) {
      speed = Math.max(1, speed - 1);
    }
    if (player.pos.lane === 'TRUNK') {
      speed = Math.min(3, speed);
    }
    if (player.pos.lane === 'BENDANG' && player.mudTrapped) {
      speed = Math.min(1, speed);
    }

    return speed;
  }

  previewCardOptionsFromView(
    view: BalikKampungPlayerView,
    seat: number,
    cardId: ActionCardId,
    useFuelDump: boolean
  ): ReachableMoveOption[] {
    if (cardId === 0 && view.rnrBanned) {
      return [];
    }
    const synthetic = this.buildSyntheticStateFromView(view);
    const targetPlayer = synthetic.players.find((p) => p.seat === seat);
    if (
      !targetPlayer ||
      targetPlayer.pos.lane === 'FINISH' ||
      targetPlayer.skippedThisRound ||
      !targetPlayer.hand.includes(cardId) ||
      (cardId === 2 && targetPlayer.bladder >= 2)
    ) {
      return [];
    }
    return this.computeReachableOptions(synthetic, targetPlayer, cardId, useFuelDump);
  }

  previewEffectiveSpeedFromView(
    view: BalikKampungPlayerView,
    seat: number,
    cardId: ActionCardId,
    useFuelDump: boolean
  ): number {
    const synthetic = this.buildSyntheticStateFromView(view);
    const targetPlayer = synthetic.players.find((p) => p.seat === seat);
    if (!targetPlayer) {
      return cardId;
    }
    return this.calculateEffectiveSpeed(synthetic, targetPlayer, cardId, useFuelDump);
  }

  private buildSyntheticStateFromView(
    view: BalikKampungPlayerView
  ): BalikKampungMatchState {
    const players: BalikKampungPlayer[] = view.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      isBot: p.isBot,
      persona: p.persona,
      drivetrain: p.drivetrain,
      pos: { ...p.pos },
      bladder: p.bladder,
      stress: p.stress,
      scoutTokens: p.scoutTokens,
      hand: [...p.hand],
      discardPile: [...p.discardPile],
      isSkipNext: p.isSkipNext,
      skippedThisRound: p.skippedThisRound,
      fuelDumpUsed: p.fuelDumpUsed,
      evInstantTorqueReady: p.evInstantTorqueReady,
      evInstantTorqueActiveThisRound: p.evInstantTorqueActiveThisRound,
      evFastChargeBonusReady: p.evFastChargeBonusReady,
      evFastChargeBonusActiveThisRound: p.evFastChargeBonusActiveThisRound,
      mudTrapped: p.mudTrapped,
      plannedCard: p.myPlannedCard,
      plannedFuelDump: p.myPlannedFuelDump,
      hasLockedPlan: p.hasLockedPlan,
      revealedCard: p.revealedCard,
      revealedFuelDump: p.revealedFuelDump,
      finishedRank: p.finishedRank,
      finishedRound: p.finishedRound,
      finishedOvershoot: p.finishedOvershoot,
    }));

    return {
      phase: view.phase,
      roundNumber: view.roundNumber,
      players,
      visibleTrack: view.visibleTrack.map((seg) => ({
        trackOrder: seg.trackOrder,
        card: seg.card,
        awasDisarmed: seg.awasDisarmed,
        hasHazardCone: seg.hasHazardCone,
      })),
      roadDeck: [],
      finishCard: FINISH_ROAD_CARD,
      trafficDeck: [],
      trafficDiscard: [],
      activeTrafficEvent: view.activeTrafficEvent,
      rempit: {
        pos: { ...view.rempit.pos },
        active: view.rempit.active,
      },
      resolutionQueue: [...view.resolutionQueue],
      activeSeat: view.activeSeat,
      reachableOptions: [],
      pendingScoutSteps: 0,
      pendingScoutPlayedSpeed: 0,
      pendingScoutPassedTarget: false,
      simpangTigaDrawn: view.simpangTigaDrawn,
      rnrBanned: view.rnrBanned,
      nextFinishRank: 1,
      lastDiceRoll: view.lastDiceRoll,
      lastCoinFlip: view.lastCoinFlip,
      recentMoves: [],
      standings: [],
      logs: [],
    };
  }

  // --- Internal Turn & Phase Handlers ---

  private handleSelectPlan(
    state: BalikKampungMatchState,
    seat: number,
    cardId: ActionCardId,
    useFuelDump: boolean,
    rng: () => number
  ): boolean {
    if (state.phase !== 'PLANNING') {
      return false;
    }
    const player = state.players.find((p) => p.seat === seat);
    if (!player || player.hasLockedPlan || player.skippedThisRound || player.pos.lane === 'FINISH') {
      return false;
    }

    const playable = this.getPlayableCards(state, player);
    if (!playable.includes(cardId)) {
      return false;
    }

    const validFuelDump =
      useFuelDump && cardId !== 0 && player.drivetrain === 'ICE' && !player.fuelDumpUsed;

    player.plannedCard = cardId;
    player.plannedFuelDump = validFuelDump;
    player.hasLockedPlan = true;

    const allReady = state.players.every(
      (p) => p.pos.lane === 'FINISH' || p.hasLockedPlan
    );

    if (allReady) {
      this.revealAllPlansAndStartResolution(state, rng);
    }
    return true;
  }

  private handleUnselectPlan(state: BalikKampungMatchState, seat: number): boolean {
    if (state.phase !== 'PLANNING') {
      return false;
    }
    const player = state.players.find((p) => p.seat === seat);
    if (!player || !player.hasLockedPlan || player.skippedThisRound || player.pos.lane === 'FINISH') {
      return false;
    }
    player.plannedCard = null;
    player.plannedFuelDump = false;
    player.hasLockedPlan = false;
    return true;
  }

  private revealAllPlansAndStartResolution(
    state: BalikKampungMatchState,
    rng: () => number
  ): void {
    state.lastDiceRoll = null;
    state.lastCoinFlip = null;

    for (const p of state.players) {
      if (p.pos.lane === 'FINISH' || p.skippedThisRound || p.plannedCard === null) {
        continue;
      }
      const chosen = p.plannedCard;
      p.revealedCard = chosen;
      p.revealedFuelDump = p.plannedFuelDump;

      // Move played card from hand to discardPile (Singgah R&R recovers all during its resolution)
      p.hand = p.hand.filter((c) => c !== chosen);
      p.discardPile.push(chosen);

      if (p.revealedFuelDump) {
        p.fuelDumpUsed = true;
        this.pushLog(state, 'BK.LOG_FUEL_DUMP', { name: p.name }, 'warn');
      }

      // Kopi Ikat Tepi (3) immediately increases Bladder +1 when revealed
      if (chosen === 3) {
        p.bladder = Math.min(MAX_BLADDER, p.bladder + 1);
        this.pushLog(state, 'BK.LOG_KOPI_BLADDER', { name: p.name, bladder: p.bladder }, 'info');
      }
    }

    // Build front-to-back resolution order among active cars this round
    const movers = state.players.filter(
      (p) => p.pos.lane !== 'FINISH' && !p.skippedThisRound && p.revealedCard !== null
    );
    movers.sort((a, b) => this.compareTrackProgressDesc(state, a.pos, b.pos));

    state.resolutionQueue = movers.map((m) => m.seat);
    this.advanceResolutionQueue(state, rng);
  }

  private advanceResolutionQueue(state: BalikKampungMatchState, rng: () => number): void {
    while (state.resolutionQueue.length > 0) {
      const nextSeat = state.resolutionQueue.shift();
      if (nextSeat === undefined) break;
      const player = state.players.find((p) => p.seat === nextSeat);
      if (!player || player.pos.lane === 'FINISH' || player.revealedCard === null) {
        continue;
      }

      state.activeSeat = player.seat;
      const options = this.computeReachableOptions(
        state,
        player,
        player.revealedCard,
        player.revealedFuelDump
      );

      if (options.length === 0) {
        // Completely blocked edge fallback: Potong Q check if card 5
        if (player.revealedCard === 5) {
          player.stress = Math.min(MAX_STRESS, player.stress + 1);
        }
        continue;
      }

      state.phase = 'RESOLVING';
      state.reachableOptions = options;
      return;
    }

    // All cars resolved -> Phase 4 Physiological & Clean-Up
    this.runPhysiologicalAndCleanUpPhase(state, rng);
  }

  private handleCommitMove(
    state: BalikKampungMatchState,
    seat: number,
    optionId: string,
    spendScoutOnAwas: boolean,
    rng: () => number
  ): boolean {
    if (state.phase !== 'RESOLVING' || state.activeSeat !== seat) {
      return false;
    }

    const player = state.players.find((p) => p.seat === seat);
    const option = state.reachableOptions.find((o) => o.optionId === optionId);
    if (!player || !option || player.revealedCard === null) {
      return false;
    }

    const cardId = player.revealedCard;

    // 1. Handle Singgah R&R (0)
    if (cardId === 0) {
      player.hand = [...ALL_ACTION_CARDS];
      player.discardPile = [];

      if (option.pitStopKind === 'RNR' || option.pitStopKind === 'WARUNG') {
        const glideTrail =
          option.trail && option.trail.length > 0
            ? option.trail
            : [{ ...player.pos }, { ...option.destination }];
        this.recordMoveTrace(state, player.seat, glideTrail);
        player.pos = { ...option.destination };
        player.bladder = 0;
        player.stress = Math.max(0, player.stress - 1);
        this.pushLog(
          state,
          option.pitStopKind === 'RNR' ? 'BK.LOG_PIT_RNR' : 'BK.LOG_PIT_WARUNG',
          { name: player.name },
          'good'
        );

        if (player.drivetrain === 'EV' && option.pitStopKind === 'RNR') {
          player.evInstantTorqueReady = true;
          state.phase = 'EV_CHARGE_PROMPT';
          state.reachableOptions = [];
          return true;
        }
      } else {
        // Emergency Shoulder Stop
        player.stress = Math.min(MAX_STRESS, player.stress + 1);
        this.pushLog(state, 'BK.LOG_PIT_SHOULDER', { name: player.name }, 'warn');
      }

      this.advanceResolutionQueue(state, rng);
      return true;
    }

    // 2. Handle Scouting Beyond Visible Horizon
    if (option.isScoutFrontier) {
      return this.executeScoutFrontierMove(state, player, option, spendScoutOnAwas, rng);
    }

    // 3. Standard / Simpang Tiga / Finish Move Execution
    this.applyStandardMoveEffects(state, player, cardId, option, spendScoutOnAwas, rng);
    this.advanceResolutionQueue(state, rng);
    return true;
  }

  private executeScoutFrontierMove(
    state: BalikKampungMatchState,
    player: BalikKampungPlayer,
    option: ReachableMoveOption,
    spendScoutOnAwas: boolean,
    rng: () => number
  ): boolean {
    const cardId = player.revealedCard ?? 2;

    // Resolve any AWAS or Downhills crossed BEFORE reaching the frontier
    this.resolveCrossedHazards(
      state,
      player,
      option.crossedAwasOrders,
      option.crossedDownhillOrders,
      spendScoutOnAwas
    );

    // Draw the new card onto visibleTrack & grant +1 Scout Token (Max 2)
    const drawnSeg = this.drawNextRoadCardOntoTrack(state);
    if (player.scoutTokens < MAX_SCOUT_TOKENS) {
      player.scoutTokens += 1;
    }
    this.pushLog(
      state,
      'BK.LOG_SCOUT_HORIZON',
      { name: player.name, scouts: player.scoutTokens },
      'good'
    );

    if (!drawnSeg) {
      if (cardId === 5 && !option.passedTarget) {
        player.stress = Math.min(MAX_STRESS, player.stress + 1);
      }
      this.advanceResolutionQueue(state, rng);
      return true;
    }

    // If the newly drawn card is SIMPANG_TIGA!
    if (drawnSeg.card.kind === 'SIMPANG_TIGA') {
      const preSimpangTrail = (option.trail ?? [{ ...player.pos }]).slice(0, -1);
      if (preSimpangTrail.length >= 2) {
        const stopBeforeFork = preSimpangTrail.at(-1);
        if (stopBeforeFork) {
          player.pos = { ...stopBeforeFork };
        }
        this.recordMoveTrace(state, player.seat, preSimpangTrail);
      }
      state.pendingScoutSteps = option.scoutStepsRemaining;
      state.pendingScoutPlayedSpeed = option.totalEffectiveSpeed;
      state.pendingScoutPassedTarget = option.passedTarget;
      state.phase = 'SIMPANG_SCOUT_PROMPT';
      state.reachableOptions = [];
      return true;
    }

    // Otherwise drawnSeg is a STANDARD card -> continue straight forward along option.destination.lane
    const targetLane = isStandardLane(option.destination.lane)
      ? option.destination.lane
      : 'LEFT';
    let currentPos: TrackPosition = {
      trackOrder: drawnSeg.trackOrder,
      lane: targetLane,
      slot: 0,
    };
    const fullScoutTrail: TrackPosition[] = [
      ...(option.trail ?? [{ ...player.pos }]).slice(0, -1),
      { ...currentPos },
    ];
    let stepsRem = option.scoutStepsRemaining;
    if (targetLane === 'TRUNK') {
      stepsRem = Math.min(stepsRem, 2);
    }

    const newDownhills: number[] = [];
    const newAwas: number[] = [];

    if (drawnSeg.card.isDownhill) {
      newDownhills.push(drawnSeg.trackOrder);
      if (player.drivetrain === 'EV' && option.crossedDownhillOrders.length === 0) {
        stepsRem += 1;
      }
    }

    while (stepsRem > 0) {
      const currSeg = state.visibleTrack.find((s) => s.trackOrder === currentPos.trackOrder);
      if (!currSeg) break;

      if (currentPos.slot === 0) {
        const nextSlotPos: TrackPosition = {
          trackOrder: currentPos.trackOrder,
          lane: targetLane,
          slot: 1,
        };
        const feat = this.getFeatureAt(currSeg.card, targetLane, 1);
        const cost = targetLane === 'TRUNK' && feat === 'OBSTACLE' ? 2 : 1;
        if (stepsRem < cost) break;
        currentPos = nextSlotPos;
        fullScoutTrail.push({ ...currentPos });
        stepsRem -= cost;

        if (
          targetLane === 'RIGHT' &&
          currSeg.card.right[1] === 'AWAS' &&
          !currSeg.awasDisarmed &&
          option.totalEffectiveSpeed >= 4
        ) {
          newAwas.push(currSeg.trackOrder);
        }
      } else {
        // Need another card beyond drawnSeg!
        const extraSeg = this.drawNextRoadCardOntoTrack(state);
        if (!extraSeg) break;
        if (extraSeg.card.kind === 'SIMPANG_TIGA') {
          const passedSoFar =
            option.passedTarget ||
            this.didPassAnyTarget(state, player.seat, player.pos, currentPos);
          this.recordMoveTrace(state, player.seat, fullScoutTrail);
          player.pos = currentPos;
          this.resolveCrossedHazards(state, player, newAwas, newDownhills, spendScoutOnAwas);
          state.pendingScoutSteps = stepsRem - 1;
          state.pendingScoutPlayedSpeed = option.totalEffectiveSpeed;
          state.pendingScoutPassedTarget = passedSoFar;
          state.phase = 'SIMPANG_SCOUT_PROMPT';
          state.reachableOptions = [];
          return true;
        }
        const feat0 = this.getFeatureAt(extraSeg.card, targetLane, 0);
        const cost0 = targetLane === 'TRUNK' && feat0 === 'OBSTACLE' ? 2 : 1;
        if (stepsRem < cost0) break;
        currentPos = {
          trackOrder: extraSeg.trackOrder,
          lane: targetLane,
          slot: 0,
        };
        fullScoutTrail.push({ ...currentPos });
        stepsRem -= cost0;
        if (extraSeg.card.isDownhill && !newDownhills.includes(extraSeg.trackOrder)) {
          newDownhills.push(extraSeg.trackOrder);
        }
      }
    }

    this.resolveCrossedHazards(state, player, newAwas, newDownhills, spendScoutOnAwas);

    const passedNow =
      option.passedTarget ||
      this.didPassAnyTarget(state, player.seat, player.pos, currentPos);
    this.recordMoveTrace(state, player.seat, fullScoutTrail);
    player.pos = currentPos;

    this.applyPostLandingCardChecks(state, player, cardId, passedNow);
    this.advanceResolutionQueue(state, rng);
    return true;
  }

  private handleChooseEvCharge(
    state: BalikKampungMatchState,
    seat: number,
    mode: 'AC_SLOW' | 'DC_FAST',
    rng: () => number
  ): boolean {
    if (state.phase !== 'EV_CHARGE_PROMPT' || state.activeSeat !== seat) {
      return false;
    }
    const player = state.players.find((p) => p.seat === seat);
    if (!player) {
      return false;
    }

    if (mode === 'AC_SLOW') {
      state.lastCoinFlip = null;
      this.pushLog(state, 'BK.LOG_EV_AC_SAFE', { name: player.name }, 'info');
    } else {
      const isHeads = rng() < 0.5;
      state.lastCoinFlip = isHeads ? 'HEADS' : 'TAILS';
      if (isHeads) {
        player.evFastChargeBonusReady = 2;
        this.pushLog(state, 'BK.LOG_EV_DC_HEADS', { name: player.name }, 'good');
      } else {
        player.stress = Math.min(MAX_STRESS, player.stress + 2);
        this.pushLog(state, 'BK.LOG_EV_DC_TAILS', { name: player.name }, 'danger');
      }
    }

    this.advanceResolutionQueue(state, rng);
    return true;
  }

  private handleChooseScoutedSimpang(
    state: BalikKampungMatchState,
    seat: number,
    branch: SimpangCorridor,
    rng: () => number
  ): boolean {
    if (state.phase !== 'SIMPANG_SCOUT_PROMPT' || state.activeSeat !== seat) {
      return false;
    }
    const player = state.players.find((p) => p.seat === seat);
    const simpangSeg = state.visibleTrack.find((s) => s.card.kind === 'SIMPANG_TIGA');
    if (!player || !simpangSeg) {
      return false;
    }

    const cardId = player.revealedCard ?? 2;
    const playedSpeed = state.pendingScoutPlayedSpeed;
    let stepsRem = state.pendingScoutSteps;

    // Entry penalties for Simpang Tiga branches
    if (branch === 'KUBUR' && playedSpeed >= 3) {
      player.stress = Math.min(MAX_STRESS, player.stress + 2);
      this.pushLog(state, 'BK.LOG_KUBUR_SCRAPE', { name: player.name }, 'danger');
    }

    if (branch === 'BENDANG') {
      const roll = Math.floor(rng() * 6) + 1;
      state.lastDiceRoll = roll;
      if (roll <= 2) {
        player.mudTrapped = true;
        stepsRem = 0;
        this.pushLog(state, 'BK.LOG_BENDANG_TRAPPED', { name: player.name, roll }, 'warn');
      } else {
        this.pushLog(state, 'BK.LOG_BENDANG_CLEAR', { name: player.name, roll }, 'good');
      }
    }

    const branchLen = SIMPANG_BRANCH_LENGTHS.get(branch) ?? 2;
    let slot = 0;
    let finished = false;
    let overshoot = 0;

    while (stepsRem > 0) {
      const nextSlot = slot + 1;
      if (nextSlot >= branchLen) {
        finished = true;
        overshoot = stepsRem - 1;
        break;
      }
      const stepCost = branch === 'UTAMA' && nextSlot === 1 ? 2 : 1;
      if (stepsRem < stepCost) {
        break;
      }
      const nextPos: TrackPosition = {
        trackOrder: simpangSeg.trackOrder,
        lane: branch,
        slot: nextSlot,
      };
      if (branch === 'KUBUR' && this.isSpaceOccupiedByOther(state, nextPos, player.seat)) {
        break;
      }
      slot = nextSlot;
      stepsRem -= stepCost;
    }

    if (finished) {
      const finishSeg = state.visibleTrack.find((s) => s.card.kind === 'FINISH');
      const finishOrder = finishSeg ? finishSeg.trackOrder : 999;
      const branchTrail: TrackPosition[] = [{ ...player.pos }];
      for (let s = 0; s < branchLen; s++) {
        branchTrail.push({ trackOrder: simpangSeg.trackOrder, lane: branch, slot: s });
      }
      branchTrail.push({ trackOrder: finishOrder, lane: 'FINISH', slot: 0 });
      this.recordMoveTrace(state, player.seat, branchTrail);
      this.markPlayerFinished(state, player, overshoot);
    } else {
      let landingSlot = slot;
      while (
        landingSlot > 0 &&
        this.isSpaceOccupiedByOther(
          state,
          { trackOrder: simpangSeg.trackOrder, lane: branch, slot: landingSlot },
          player.seat
        )
      ) {
        landingSlot -= 1;
      }
      const branchTrail: TrackPosition[] = [{ ...player.pos }];
      for (let s = 0; s <= landingSlot; s++) {
        branchTrail.push({ trackOrder: simpangSeg.trackOrder, lane: branch, slot: s });
      }
      this.recordMoveTrace(state, player.seat, branchTrail);
      player.pos = {
        trackOrder: simpangSeg.trackOrder,
        lane: branch,
        slot: landingSlot,
      };
    }

    if (cardId === 5 && !state.pendingScoutPassedTarget) {
      player.stress = Math.min(MAX_STRESS, player.stress + 1);
      this.pushLog(state, 'BK.LOG_POTONG_FAIL', { name: player.name }, 'warn');
    }

    this.advanceResolutionQueue(state, rng);
    return true;
  }

  private applyStandardMoveEffects(
    state: BalikKampungMatchState,
    player: BalikKampungPlayer,
    cardId: ActionCardId,
    option: ReachableMoveOption,
    spendScoutOnAwas: boolean,
    rng: () => number
  ): void {
    this.resolveCrossedHazards(
      state,
      player,
      option.crossedAwasOrders,
      option.crossedDownhillOrders,
      spendScoutOnAwas
    );

    // Check Simpang Tiga Branch Entry triggers (Kubur scrape & Bendang 1d6 mud roll)
    if (option.enteringSimpangBranch === 'KUBUR' && option.totalEffectiveSpeed >= 3) {
      player.stress = Math.min(MAX_STRESS, player.stress + 2);
      this.pushLog(state, 'BK.LOG_KUBUR_SCRAPE', { name: player.name }, 'danger');
    }

    if (option.enteringSimpangBranch === 'BENDANG') {
      const roll = Math.floor(rng() * 6) + 1;
      state.lastDiceRoll = roll;
      if (roll <= 2) {
        player.mudTrapped = true;
        this.pushLog(state, 'BK.LOG_BENDANG_TRAPPED', { name: player.name, roll }, 'warn');
        const simpangSeg = state.visibleTrack.find((s) => s.card.kind === 'SIMPANG_TIGA');
        if (simpangSeg) {
          const entrySlot: TrackPosition = {
            trackOrder: simpangSeg.trackOrder,
            lane: 'BENDANG',
            slot: 0,
          };
          if (!this.isSpaceOccupiedByOther(state, entrySlot, player.seat)) {
            const rawTrail = option.trail ?? [{ ...player.pos }, entrySlot];
            const entryIdx = rawTrail.findIndex((t) => sameTrackPos(t, entrySlot));
            const mudTrail =
              entryIdx >= 0 ? rawTrail.slice(0, entryIdx + 1) : [{ ...player.pos }, entrySlot];
            this.recordMoveTrace(state, player.seat, mudTrail);
            player.pos = entrySlot;
            this.applyPostLandingCardChecks(state, player, cardId, option.passedTarget);
            return;
          }
        }
      } else {
        this.pushLog(state, 'BK.LOG_BENDANG_CLEAR', { name: player.name, roll }, 'good');
      }
    }

    const stdTrail =
      option.trail && option.trail.length > 0
        ? option.trail
        : [{ ...player.pos }, { ...option.destination }];

    if (option.destination.lane === 'FINISH') {
      this.recordMoveTrace(state, player.seat, stdTrail);
      this.markPlayerFinished(state, player, option.overshootSpaces);
      if (cardId === 5 && !option.passedTarget) {
        player.stress = Math.min(MAX_STRESS, player.stress + 1);
        this.pushLog(state, 'BK.LOG_POTONG_FAIL', { name: player.name }, 'warn');
      }
      return;
    }

    this.recordMoveTrace(state, player.seat, stdTrail);
    player.pos = { ...option.destination };

    if (option.slipstreamApplied) {
      this.pushLog(state, 'BK.LOG_SLIPSTREAM', { name: player.name }, 'good');
    }

    this.applyPostLandingCardChecks(state, player, cardId, option.passedTarget);
  }

  private resolveCrossedHazards(
    state: BalikKampungMatchState,
    player: BalikKampungPlayer,
    crossedAwasOrders: readonly number[],
    crossedDownhillOrders: readonly number[],
    spendScoutOnAwas: boolean
  ): void {
    // EV Kinetic Regen Bladder reduction (-1 Bladder on downhill)
    if (player.drivetrain === 'EV' && crossedDownhillOrders.length > 0) {
      player.bladder = Math.max(0, player.bladder - 1);
      this.pushLog(state, 'BK.LOG_EV_REGEN', { name: player.name }, 'good');
    }

    // AWAS Speed Camera Trigger
    for (const order of crossedAwasOrders) {
      const seg = state.visibleTrack.find((s) => s.trackOrder === order);
      if (!seg || seg.awasDisarmed) {
        continue;
      }
      seg.awasDisarmed = true;
      if (spendScoutOnAwas && player.scoutTokens > 0) {
        player.scoutTokens -= 1;
        this.pushLog(state, 'BK.LOG_AWAS_SCOUT_SAVED', { name: player.name }, 'good');
      } else {
        player.stress = Math.min(MAX_STRESS, player.stress + 2);
        this.pushLog(state, 'BK.LOG_AWAS_FLASHED', { name: player.name }, 'danger');
      }
    }
  }

  private applyPostLandingCardChecks(
    state: BalikKampungMatchState,
    player: BalikKampungPlayer,
    cardId: ActionCardId,
    passedTarget: boolean
  ): void {
    // Cruising Santai (2): If front space is open, remove -1 Stress
    if (cardId === 2 && player.stress > 0) {
      if (this.isFrontSpaceOpen(state, player.pos, player.seat)) {
        player.stress = Math.max(0, player.stress - 1);
        this.pushLog(state, 'BK.LOG_CRUISING_RELIEF', { name: player.name }, 'good');
      }
    }

    // Potong Q (5): Must pass >= 1 vehicle/Rempit or take +1 Stress
    if (cardId === 5 && !passedTarget) {
      player.stress = Math.min(MAX_STRESS, player.stress + 1);
      this.pushLog(state, 'BK.LOG_POTONG_FAIL', { name: player.name }, 'warn');
    }
  }

  private markPlayerFinished(
    state: BalikKampungMatchState,
    player: BalikKampungPlayer,
    overshoot: number
  ): void {
    const finishSeg = state.visibleTrack.find((s) => s.card.kind === 'FINISH');
    const finishOrder = finishSeg ? finishSeg.trackOrder : 999;

    player.pos = {
      trackOrder: finishOrder,
      lane: 'FINISH',
      slot: 0,
    };
    player.finishedRound = state.roundNumber;
    player.finishedOvershoot = overshoot;
    // Provisional rank; re-sorted among same-round finishers by overshoot at round end!
    player.finishedRank = state.nextFinishRank;
    state.nextFinishRank += 1;

    this.pushLog(
      state,
      'BK.LOG_PLAYER_FINISHED',
      { name: player.name, rank: player.finishedRank },
      'good'
    );
  }

  private runPhysiologicalAndCleanUpPhase(
    state: BalikKampungMatchState,
    rng: () => number
  ): void {
    // 1. Re-rank any cars that crossed Finish in THIS round by furthest overshoot past Finish
    const finishedThisRound = state.players.filter(
      (p) => p.pos.lane === 'FINISH' && p.finishedRound === state.roundNumber
    );
    if (finishedThisRound.length > 1) {
      const minRank = Math.min(
        ...finishedThisRound.map((p) => p.finishedRank ?? state.nextFinishRank)
      );
      finishedThisRound.sort((a, b) => b.finishedOvershoot - a.finishedOvershoot);
      finishedThisRound.forEach((p, idx) => {
        p.finishedRank = minRank + idx;
      });
    }

    // 2. Physiological & Catastrophe Triggers for non-finished, non-skipping cars
    for (const p of state.players) {
      if (p.pos.lane === 'FINISH' || p.skippedThisRound) {
        continue;
      }

      if (p.bladder === 3) {
        p.stress = Math.min(MAX_STRESS, p.stress + 1);
        this.pushLog(state, 'BK.LOG_BLADDER_3_STRESS', { name: p.name }, 'warn');
      }

      if (p.bladder >= MAX_BLADDER) {
        p.stress = Math.min(MAX_STRESS, p.stress + 2);
        p.bladder = 0;
        p.isSkipNext = true;
        this.pushLog(state, 'BK.LOG_BLADDER_RUPTURE', { name: p.name }, 'danger');
      }

      if (p.stress >= MAX_STRESS) {
        p.stress = Math.max(0, p.stress - 3);
        p.isSkipNext = true;
        this.pushLog(state, 'BK.LOG_STRESS_MELTDOWN', { name: p.name }, 'danger');
      }
    }

    // 3. Check Podium Completion (up to 3rd place, or all cars in 2P/3P)
    const podiumTarget = Math.min(state.players.length, 3);
    const finishedCount = state.players.filter((p) => p.pos.lane === 'FINISH').length;

    if (finishedCount >= podiumTarget) {
      this.finalizeGameOverStandings(state);
      return;
    }

    // 4. Simpang Tiga permanently bans Singgah R&R starting next round
    if (state.simpangTigaDrawn && !state.rnrBanned) {
      state.rnrBanned = true;
      this.pushLog(state, 'BK.LOG_RNR_BANNED', {}, 'warn');
    }

    // 5. Trim cleared trailing cards & maintain 5-card horizon ahead of trailing vehicle
    this.maintainTrackHorizon(state);

    // 6. Start next round
    this.beginNewRound(state, rng);
  }

  private beginNewRound(state: BalikKampungMatchState, rng: () => number): void {
    state.roundNumber += 1;
    state.reachableOptions = [];

    for (const seg of state.visibleTrack) {
      seg.awasDisarmed = false;
      seg.hasHazardCone = false;
    }

    // Flip top Traffic Event Card (reshuffle discard when empty)
    if (state.trafficDeck.length === 0 && state.trafficDiscard.length > 0) {
      state.trafficDeck = shuffleWithRng(state.trafficDiscard, rng);
      state.trafficDiscard = [];
    }
    const nextEvent = state.trafficDeck.shift() ?? 'SMARTLANE';
    state.activeTrafficEvent = nextEvent;
    state.trafficDiscard.push(nextEvent);

    this.pushLog(state, `BK.LOG_EVENT_${nextEvent}`, { round: state.roundNumber }, 'info');

    this.applyRoundStartTrafficEvent(state);

    // Prepare player round state
    for (const p of state.players) {
      p.plannedCard = null;
      p.plannedFuelDump = false;
      p.revealedCard = null;
      p.revealedFuelDump = false;

      if (p.pos.lane === 'FINISH') {
        p.hasLockedPlan = true;
        p.skippedThisRound = false;
        continue;
      }

      p.evInstantTorqueActiveThisRound = p.evInstantTorqueReady;
      p.evInstantTorqueReady = false;
      p.evFastChargeBonusActiveThisRound = p.evFastChargeBonusReady;
      p.evFastChargeBonusReady = 0;

      if (p.isSkipNext) {
        p.isSkipNext = false;
        p.skippedThisRound = true;
        p.hasLockedPlan = true;
        this.pushLog(state, 'BK.LOG_SKIPPING_TURN', { name: p.name }, 'warn');
        continue;
      }

      p.skippedThisRound = false;
      p.hasLockedPlan = false;

      // Prevent soft-lock if 0 playable cards remain (e.g. after Simpang Tiga bans Singgah R&R)
      const playable = this.getPlayableCards(state, p);
      if (playable.length === 0) {
        const movementCards: ActionCardId[] = [2, 3, 4, 5];
        for (const mc of movementCards) {
          if (!p.hand.includes(mc)) {
            p.hand.push(mc);
          }
        }
        p.discardPile = p.discardPile.filter((d) => d === 0);
        p.stress = Math.min(MAX_STRESS, p.stress + 1);
        this.pushLog(state, 'BK.LOG_OVERDRIVE_RELOAD', { name: p.name }, 'warn');
      }
    }

    state.phase = 'PLANNING';
    const firstHumanOrOpen = state.players.find((p) => !p.hasLockedPlan);
    state.activeSeat = firstHumanOrOpen ? firstHumanOrOpen.seat : 0;

    // Edge case: if every single active car is skipping this round, auto-advance!
    const allLocked = state.players.every((p) => p.pos.lane === 'FINISH' || p.hasLockedPlan);
    if (allLocked) {
      this.runPhysiologicalAndCleanUpPhase(state, rng);
    }
  }

  private applyRoundStartTrafficEvent(state: BalikKampungMatchState): void {
    if (state.activeTrafficEvent === 'REMPIT') {
      if (!state.rempit.active) {
        const activeCars = state.players.filter((p) => p.pos.lane !== 'FINISH');
        const minCarOrder =
          activeCars.length > 0
            ? Math.min(...activeCars.map((c) => c.pos.trackOrder))
            : 0;
        const spawnSeg = state.visibleTrack.find(
          (s) => s.trackOrder >= Math.max(1, minCarOrder) && s.card.kind === 'STANDARD'
        );
        if (spawnSeg) {
          state.rempit = {
            pos: { trackOrder: spawnSeg.trackOrder, lane: 'LEFT', slot: 0 },
            active: true,
          };
        }
      }

      if (state.rempit.active) {
        let steps = 3;
        while (steps > 0 && state.rempit.active) {
          const fwd = this.stepForwardStandard(state, state.rempit.pos);
          if (
            !fwd ||
            fwd.beyondHorizon ||
            (fwd.nextCard.card.kind !== 'STANDARD' && fwd.nextCard.card.kind !== 'START')
          ) {
            state.rempit.active = false;
            break;
          }
          state.rempit.pos = fwd.nextPos;
          steps -= 1;

          // Any Highway car buzzed/overtaken on this space takes +1 Stress!
          for (const car of state.players) {
            if (car.pos.lane !== 'FINISH' && sameTrackPos(car.pos, state.rempit.pos)) {
              car.stress = Math.min(MAX_STRESS, car.stress + 1);
              this.pushLog(state, 'BK.LOG_REMPIT_BUZZED', { name: car.name }, 'warn');
            }
          }
        }

        // Ensure Rempit does not rest on top of an occupied car space
        while (
          state.rempit.active &&
          state.players.some((c) => c.pos.lane !== 'FINISH' && sameTrackPos(c.pos, state.rempit.pos))
        ) {
          const altLane: 'RIGHT' | 'LEFT' = state.rempit.pos.lane === 'LEFT' ? 'RIGHT' : 'LEFT';
          const altPos: TrackPosition = {
            trackOrder: state.rempit.pos.trackOrder,
            lane: altLane,
            slot: state.rempit.pos.slot,
          };
          if (
            !state.players.some((c) => c.pos.lane !== 'FINISH' && sameTrackPos(c.pos, altPos))
          ) {
            state.rempit.pos = altPos;
            break;
          }
          const fwdNext = this.stepForwardStandard(state, state.rempit.pos);
          if (
            !fwdNext ||
            fwdNext.beyondHorizon ||
            (fwdNext.nextCard.card.kind !== 'STANDARD' && fwdNext.nextCard.card.kind !== 'START')
          ) {
            state.rempit.active = false;
            break;
          }
          state.rempit.pos = fwdNext.nextPos;
        }
      }
    }

    if (state.activeTrafficEvent === 'KEMALANGAN') {
      const hwyPlayers = state.players.filter(
        (p) => p.pos.lane === 'RIGHT' || p.pos.lane === 'LEFT'
      );
      if (hwyPlayers.length > 0) {
        hwyPlayers.sort((a, b) => this.compareTrackProgressDesc(state, a.pos, b.pos));
        const leadOrder = hwyPlayers.at(0)?.pos.trackOrder ?? 0;
        const coneTarget =
          state.visibleTrack.find(
            (seg) =>
              seg.trackOrder > leadOrder &&
              seg.card.kind === 'STANDARD' &&
              !(state.rempit.active && state.rempit.pos.trackOrder === seg.trackOrder) &&
              !this.isSpaceOccupiedByOther(
                state,
                { trackOrder: seg.trackOrder, lane: 'RIGHT', slot: 0 },
                -1
              )
          ) ??
          state.visibleTrack.find(
            (seg) =>
              seg.trackOrder > leadOrder &&
              seg.card.kind === 'STANDARD' &&
              !this.isSpaceOccupiedByOther(
                state,
                { trackOrder: seg.trackOrder, lane: 'RIGHT', slot: 0 },
                -1
              )
          );
        if (coneTarget) {
          coneTarget.hasHazardCone = true;
        }
      }
    }
  }

  private drawNextRoadCardOntoTrack(state: BalikKampungMatchState): ActiveRoadCard | null {
    const finishAlreadyVisible = state.visibleTrack.some((s) => s.card.kind === 'FINISH');
    if (finishAlreadyVisible) {
      return null;
    }

    const lastOrder =
      state.visibleTrack.at(state.visibleTrack.length - 1)?.trackOrder ?? 0;

    if (state.simpangTigaDrawn) {
      const finishActive: ActiveRoadCard = {
        trackOrder: lastOrder + 1,
        card: state.finishCard,
        awasDisarmed: false,
        hasHazardCone: false,
      };
      state.visibleTrack.push(finishActive);
      return finishActive;
    }

    const nextCard = state.roadDeck.shift();
    if (!nextCard) {
      state.simpangTigaDrawn = true;
      const simpangActive: ActiveRoadCard = {
        trackOrder: lastOrder + 1,
        card: SIMPANG_TIGA_CARD,
        awasDisarmed: false,
        hasHazardCone: false,
      };
      const finishActive: ActiveRoadCard = {
        trackOrder: lastOrder + 2,
        card: state.finishCard,
        awasDisarmed: false,
        hasHazardCone: false,
      };
      state.visibleTrack.push(simpangActive, finishActive);
      return simpangActive;
    }

    const activeSeg: ActiveRoadCard = {
      trackOrder: lastOrder + 1,
      card: nextCard,
      awasDisarmed: false,
      hasHazardCone: false,
    };
    state.visibleTrack.push(activeSeg);

    if (nextCard.kind === 'SIMPANG_TIGA') {
      state.simpangTigaDrawn = true;
      // Sudden Finish: attach Tok Wan's Kampung Compound immediately after Simpang Tiga!
      state.roadDeck = [];
      state.visibleTrack.push({
        trackOrder: lastOrder + 2,
        card: state.finishCard,
        awasDisarmed: false,
        hasHazardCone: false,
      });
      this.pushLog(state, 'BK.LOG_SIMPANG_REVEALED', {}, 'warn');
    }

    return activeSeg;
  }

  private maintainTrackHorizon(state: BalikKampungMatchState): void {
    const activeCars = state.players.filter((p) => p.pos.lane !== 'FINISH');
    if (activeCars.length === 0) {
      return;
    }

    const minCarOrder = Math.min(...activeCars.map((c) => c.pos.trackOrder));
    const keepFromOrder = Math.max(0, minCarOrder - 1);
    state.visibleTrack = state.visibleTrack.filter((seg) => seg.trackOrder >= keepFromOrder);

    if (state.rempit.active && state.rempit.pos.trackOrder < keepFromOrder) {
      state.rempit.active = false;
    }

    // Ensure 5 cards visible ahead of trailing vehicle (until Finish is revealed)
    while (!state.visibleTrack.some((s) => s.card.kind === 'FINISH')) {
      const maxVisibleOrder =
        state.visibleTrack.at(state.visibleTrack.length - 1)?.trackOrder ?? minCarOrder;
      if (maxVisibleOrder - minCarOrder >= HORIZON_AHEAD_CARDS) {
        break;
      }
      const drawn = this.drawNextRoadCardOntoTrack(state);
      if (!drawn) {
        break;
      }
    }
  }

  private finalizeGameOverStandings(state: BalikKampungMatchState): void {
    state.phase = 'GAMEOVER';
    state.reachableOptions = [];

    const entries: FinalStandingEntry[] = state.players.map((p) => {
      const arrivalBonus =
        p.finishedRank !== null ? (ARRIVAL_BONUS_BY_RANK.get(p.finishedRank) ?? 0) : 0;
      const stressPenalty = p.stress;
      const bladderPenalty = p.bladder;
      const netHappiness = arrivalBonus - stressPenalty - bladderPenalty;
      return {
        seat: p.seat,
        name: p.name,
        persona: p.persona,
        drivetrain: p.drivetrain,
        standingPlace: 1,
        finishedRank: p.finishedRank,
        arrivalBonus,
        stressPenalty,
        bladderPenalty,
        netHappiness,
      };
    });

    entries.sort((a, b) => {
      if (b.netHappiness !== a.netHappiness) {
        return b.netHappiness - a.netHappiness;
      }
      const rankA = a.finishedRank ?? 99;
      const rankB = b.finishedRank ?? 99;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      const pA = state.players.find((p) => p.seat === a.seat);
      const pB = state.players.find((p) => p.seat === b.seat);
      if (pA && pB) {
        return this.compareTrackProgressDesc(state, pA.pos, pB.pos);
      }
      return a.seat - b.seat;
    });

    entries.forEach((entry, idx) => {
      entry.standingPlace = idx + 1;
    });

    state.standings = entries;
    const winner = entries.at(0);
    if (winner) {
      this.pushLog(
        state,
        'BK.LOG_GAME_WINNER',
        { name: winner.name, score: winner.netHappiness },
        'good'
      );
    }
  }

  // --- Geometry & Track Lookup Helpers ---

  private computePitStopOption(
    state: BalikKampungMatchState,
    player: BalikKampungPlayer
  ): ReachableMoveOption {
    const lane = player.pos.lane;
    if (lane === 'LEFT' || lane === 'TRUNK') {
      const targetFeature: SpaceFeature = lane === 'LEFT' ? 'RNR' : 'WARUNG';
      let probePos: TrackPosition = { ...player.pos };
      const glideTrail: TrackPosition[] = [{ ...probePos }];

      for (let dist = 0; dist <= 2; dist++) {
        const seg = state.visibleTrack.find((s) => s.trackOrder === probePos.trackOrder);
        if (!seg || seg.card.kind !== 'STANDARD') {
          if (seg?.card.kind === 'START') {
            const stepNext = this.stepForwardStandard(state, probePos);
            if (!stepNext || stepNext.beyondHorizon) break;
            probePos = stepNext.nextPos;
            glideTrail.push({ ...probePos });
            continue;
          }
          break;
        }

        const feat = this.getFeatureAt(seg.card, lane, probePos.slot);
        const blocked =
          dist > 0 && this.isSpaceOccupiedByOther(state, probePos, player.seat);

        if (feat === targetFeature && !blocked) {
          return {
            optionId: `PIT:${probePos.trackOrder}:${lane}:${probePos.slot}`,
            destination: { ...probePos },
            trail: glideTrail,
            isScoutFrontier: false,
            scoutStepsRemaining: 0,
            crossedAwasOrders: [],
            crossedDownhillOrders: [],
            passedTarget: false,
            slipstreamApplied: false,
            pitStopKind: lane === 'LEFT' ? 'RNR' : 'WARUNG',
            enteringSimpangBranch: null,
            overshootSpaces: 0,
            totalEffectiveSpeed: 0,
          };
        }

        const stepNext = this.stepForwardStandard(state, probePos);
        if (!stepNext || stepNext.beyondHorizon) {
          break;
        }
        probePos = stepNext.nextPos;
        glideTrail.push({ ...probePos });
      }
    }

    return {
      optionId: `SHOULDER:${player.pos.trackOrder}:${player.pos.lane}:${player.pos.slot}`,
      destination: { ...player.pos },
      trail: [{ ...player.pos }],
      isScoutFrontier: false,
      scoutStepsRemaining: 0,
      crossedAwasOrders: [],
      crossedDownhillOrders: [],
      passedTarget: false,
      slipstreamApplied: false,
      pitStopKind: 'SHOULDER',
      enteringSimpangBranch: null,
      overshootSpaces: 0,
      totalEffectiveSpeed: 0,
    };
  }

  private stepForwardStandard(
    state: BalikKampungMatchState,
    pos: TrackPosition
  ): {
    nextPos: TrackPosition;
    nextCard: ActiveRoadCard;
    beyondHorizon: boolean;
  } | null {
    if (!isStandardLane(pos.lane)) {
      return null;
    }

    const currentSeg = state.visibleTrack.find((s) => s.trackOrder === pos.trackOrder);
    if (!currentSeg) {
      return null;
    }

    if (pos.slot === 0) {
      return {
        nextPos: {
          trackOrder: pos.trackOrder,
          lane: pos.lane,
          slot: 1,
        },
        nextCard: currentSeg,
        beyondHorizon: false,
      };
    }

    const nextOrder = pos.trackOrder + 1;
    const nextSeg = state.visibleTrack.find((s) => s.trackOrder === nextOrder);
    if (!nextSeg) {
      return {
        nextPos: {
          trackOrder: nextOrder,
          lane: pos.lane,
          slot: 0,
        },
        nextCard: currentSeg,
        beyondHorizon: true,
      };
    }

    return {
      nextPos: {
        trackOrder: nextOrder,
        lane: pos.lane,
        slot: 0,
      },
      nextCard: nextSeg,
      beyondHorizon: false,
    };
  }

  private getFeatureAt(
    card: RoadSegmentCard,
    lane: StandardCorridor,
    slot: number
  ): SpaceFeature {
    const idx = slot === 1 ? 1 : 0;
    if (lane === 'RIGHT') {
      return card.right.at(idx) ?? 'CLEAR';
    }
    if (lane === 'LEFT') {
      return card.left.at(idx) ?? 'CLEAR';
    }
    return card.trunk.at(idx) ?? 'CLEAR';
  }

  private isCardDestinationLaneAllowed(cardId: ActionCardId, lane: RoadCorridor): boolean {
    if (isSimpangLane(lane) || lane === 'FINISH') {
      return true;
    }
    if (cardId === 3) {
      return lane === 'LEFT' || lane === 'TRUNK';
    }
    if (cardId === 4) {
      return lane === 'RIGHT';
    }
    return true;
  }

  private isSpaceOccupiedByOther(
    state: BalikKampungMatchState,
    pos: TrackPosition,
    moverSeat: number
  ): boolean {
    if (pos.lane === 'FINISH') {
      return false;
    }
    if (state.rempit.active && sameTrackPos(state.rempit.pos, pos)) {
      return true;
    }
    return state.players.some(
      (p) => p.seat !== moverSeat && p.pos.lane !== 'FINISH' && sameTrackPos(p.pos, pos)
    );
  }

  private isSpaceOccupiedByCarOnly(
    state: BalikKampungMatchState,
    pos: TrackPosition,
    moverSeat: number
  ): boolean {
    if (pos.lane === 'FINISH') {
      return false;
    }
    return state.players.some(
      (p) => p.seat !== moverSeat && p.pos.lane !== 'FINISH' && sameTrackPos(p.pos, pos)
    );
  }

  private isSpaceBlockedByCone(state: BalikKampungMatchState, pos: TrackPosition): boolean {
    if (pos.lane !== 'RIGHT' || pos.slot !== 0) {
      return false;
    }
    const seg = state.visibleTrack.find((s) => s.trackOrder === pos.trackOrder);
    return Boolean(seg?.hasHazardCone);
  }

  private isFrontSpaceOpen(
    state: BalikKampungMatchState,
    pos: TrackPosition,
    moverSeat: number
  ): boolean {
    if (isStandardLane(pos.lane)) {
      const fwd = this.stepForwardStandard(state, pos);
      if (!fwd || fwd.beyondHorizon) {
        return true;
      }
      if (fwd.nextCard.card.kind !== 'STANDARD' && fwd.nextCard.card.kind !== 'START') {
        return true;
      }
      return (
        !this.isSpaceOccupiedByOther(state, fwd.nextPos, moverSeat) &&
        !this.isSpaceBlockedByCone(state, fwd.nextPos)
      );
    }

    if (isSimpangLane(pos.lane)) {
      const branchLen = SIMPANG_BRANCH_LENGTHS.get(pos.lane) ?? 2;
      if (pos.slot + 1 >= branchLen) {
        return true;
      }
      const nextPos: TrackPosition = {
        trackOrder: pos.trackOrder,
        lane: pos.lane,
        slot: pos.slot + 1,
      };
      return !this.isSpaceOccupiedByOther(state, nextPos, moverSeat);
    }

    return true;
  }

  private computeLinearProgressScore(state: BalikKampungMatchState, pos: TrackPosition): number {
    if (pos.lane === 'FINISH') {
      return 10000;
    }
    if (isSimpangLane(pos.lane)) {
      const branchLen = SIMPANG_BRANCH_LENGTHS.get(pos.lane) ?? 2;
      const stepsRemainingToFinish = branchLen - pos.slot;
      return 5000 - stepsRemainingToFinish;
    }
    return pos.trackOrder * 2 + pos.slot;
  }

  compareTrackProgressDesc(
    state: BalikKampungMatchState,
    a: TrackPosition,
    b: TrackPosition
  ): number {
    const scoreA = this.computeLinearProgressScore(state, a);
    const scoreB = this.computeLinearProgressScore(state, b);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    const prioA = LANE_TIE_PRIORITY.get(a.lane) ?? 0;
    const prioB = LANE_TIE_PRIORITY.get(b.lane) ?? 0;
    return prioB - prioA;
  }

  private didPassAnyTarget(
    state: BalikKampungMatchState,
    moverSeat: number,
    fromPos: TrackPosition,
    toPos: TrackPosition
  ): boolean {
    const startScore = this.computeLinearProgressScore(state, fromPos);
    const endScore = this.computeLinearProgressScore(state, toPos);
    if (endScore <= startScore) {
      return false;
    }

    for (const other of state.players) {
      if (other.seat === moverSeat || other.pos.lane === 'FINISH') {
        continue;
      }
      const otherScore = this.computeLinearProgressScore(state, other.pos);
      if (otherScore >= startScore && otherScore < endScore) {
        return true;
      }
    }

    if (state.rempit.active) {
      const rempitScore = this.computeLinearProgressScore(state, state.rempit.pos);
      if (rempitScore >= startScore && rempitScore < endScore) {
        return true;
      }
    }

    return false;
  }

  private recordMoveTrace(
    state: BalikKampungMatchState,
    seat: number,
    trail: readonly TrackPosition[]
  ): void {
    if (trail.length < 2) {
      return;
    }
    const currentList = state.recentMoves ?? [];
    const lastSeq = currentList.at(-1)?.moveSeq ?? 0;
    const nextTrace: BalikKampungMoveTrace = {
      moveSeq: lastSeq + 1,
      seat,
      trail: trail.map((p) => ({ ...p })),
    };
    const updated = [...currentList, nextTrace];
    if (updated.length > 8) {
      updated.splice(0, updated.length - 8);
    }
    state.recentMoves = updated;
  }

  private pushLog(
    state: BalikKampungMatchState,
    key: string,
    params: Record<string, string | number>,
    tone: BalikKampungLogEntry['tone']
  ): void {
    state.logs.unshift({
      round: state.roundNumber,
      key,
      params,
      tone,
    });
    if (state.logs.length > MAX_LOGS) {
      state.logs.length = MAX_LOGS;
    }
  }
}
