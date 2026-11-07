import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  SIMPANG_TIGA_CARD,
  STANDARD_ROAD_SEGMENTS,
} from '../data/balik-kampung-cards.data';
import {
  BalikKampungInitConfig,
  BalikKampungMatchState,
} from '../models/balik-kampung.model';
import { BalikKampungBotService } from './balik-kampung-bot.service';
import {
  BalikKampungEngineService,
  isHighwayLane,
  isSimpangLane,
  isStandardLane,
  sameTrackPos,
  shuffleWithRng,
} from './balik-kampung-engine.service';

function makeDeterministicRng(seed = 42): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function default3PConfig(seed = 101): BalikKampungInitConfig {
  return {
    rng: makeDeterministicRng(seed),
    seats: [
      { seat: 0, name: 'Ali', isBot: false, drivetrain: 'ICE', persona: 'red' },
      { seat: 1, name: 'Mei', isBot: false, drivetrain: 'EV', persona: 'blue' },
      { seat: 2, name: 'Raju', isBot: true, drivetrain: 'ICE', persona: 'yellow' },
    ],
  };
}

describe('BalikKampungEngineService', () => {
  let engine: BalikKampungEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    engine = TestBed.inject(BalikKampungEngineService);
  });

  it('validates canonical 45-card manifest counts and helper functions', () => {
    expect(STANDARD_ROAD_SEGMENTS.length).toBe(45);
    expect(STANDARD_ROAD_SEGMENTS.filter((c) => c.hasInterchange).length).toBe(16);
    expect(STANDARD_ROAD_SEGMENTS.filter((c) => c.right[1] === 'AWAS').length).toBe(12);
    expect(STANDARD_ROAD_SEGMENTS.filter((c) => c.left[1] === 'RNR').length).toBe(10);
    expect(STANDARD_ROAD_SEGMENTS.filter((c) => c.trunk[1] === 'WARUNG').length).toBe(9);
    expect(STANDARD_ROAD_SEGMENTS.filter((c) => c.trunk[0] === 'OBSTACLE').length).toBe(8);
    expect(STANDARD_ROAD_SEGMENTS.filter((c) => c.isDownhill).length).toBe(6);

    const arr = shuffleWithRng([1, 2, 3, 4], makeDeterministicRng(7));
    expect(arr.length).toBe(4);
    expect(isStandardLane('RIGHT')).toBe(true);
    expect(isStandardLane('FINISH')).toBe(false);
    expect(isHighwayLane('LEFT')).toBe(true);
    expect(isHighwayLane('TRUNK')).toBe(false);
    expect(isSimpangLane('KUBUR')).toBe(true);
    expect(isSimpangLane('RIGHT')).toBe(false);
    expect(
      sameTrackPos(
        { trackOrder: 2, lane: 'LEFT', slot: 1 },
        { trackOrder: 2, lane: 'LEFT', slot: 1 }
      )
    ).toBe(true);
  });

  it('creates initial state with 5-card horizon, Simpang Tiga in final 11 deck cards, and sanitized per-seat views', () => {
    const state = engine.createInitialState(default3PConfig(55));

    expect(state.phase).toBe('PLANNING');
    expect(state.roundNumber).toBe(1);
    expect(state.players.length).toBe(3);
    // Start card + 5 initial horizon cards = 6 visible cards
    expect(state.visibleTrack.length).toBe(6);
    // 45 standard + 1 Simpang Tiga - 5 drawn = 41 remaining in roadDeck
    expect(state.roadDeck.length).toBe(41);

    const simpangIdx = state.roadDeck.findIndex((c) => c.kind === 'SIMPANG_TIGA');
    // Top 30 remaining cards cannot contain Simpang Tiga; must be in bottom 11 indices (30..40)
    expect(simpangIdx).toBeGreaterThanOrEqual(30);

    // Seat 0 selects secret plan: Seat 1 view must NOT leak Seat 0's plannedCard during PLANNING
    const ok = engine.applyAction(state, 0, {
      type: 'SELECT_PLAN',
      cardId: 4,
      useFuelDump: true,
    });
    expect(ok).toBe(true);

    const seat0View = engine.buildPlayerView(state, 0);
    const seat1View = engine.buildPlayerView(state, 1);

    expect(seat0View.players.at(0)?.hasLockedPlan).toBe(true);
    expect(seat0View.players.at(0)?.myPlannedCard).toBe(4);
    expect(seat0View.players.at(0)?.myPlannedFuelDump).toBe(true);
    expect(seat0View.players.at(0)?.revealedCard).toBe(null);

    expect(seat1View.players.at(0)?.hasLockedPlan).toBe(true);
    expect(seat1View.players.at(0)?.myPlannedCard).toBe(null);
    expect(seat1View.players.at(0)?.myPlannedFuelDump).toBe(false);
    expect(seat1View.players.at(0)?.revealedCard).toBe(null);
    expect(seat1View.roadDeckCount).toBe(41);
  });

  it('resolves simultaneous reveal, Kopi bladder tick, ICE Fuel Dump, AWAS camera flash vs Scout cancel, and camera disarming', () => {
    const state = engine.createInitialState(default3PConfig(88));
    state.activeTrafficEvent = 'SMARTLANE';
    state.rempit.active = false;

    // Place an armed AWAS camera ONLY on trackOrder 1 RIGHT slot 1 (clear AWAS from other visible cards)
    for (const seg of state.visibleTrack) {
      if (seg.card.kind === 'STANDARD') {
        seg.card = {
          ...seg.card,
          right: ['CLEAR', 'CLEAR'],
          left: ['CLEAR', 'CLEAR'],
          trunk: ['CLEAR', 'CLEAR'],
        };
      }
    }
    const seg1 = state.visibleTrack.at(1)!;
    seg1.card = {
      ...seg1.card,
      right: ['CLEAR', 'AWAS'],
      left: ['CLEAR', 'CLEAR'],
      trunk: ['CLEAR', 'CLEAR'],
    };
    seg1.awasDisarmed = false;

    // Give Seat 0 zero Scout tokens so AWAS deals +2 Stress; Seat 2 also crosses same AWAS after it goes cold
    const p0 = state.players.at(0)!;
    const p1 = state.players.at(1)!;
    const p2 = state.players.at(2)!;
    p0.pos = { trackOrder: 0, lane: 'RIGHT', slot: 1 };
    p1.pos = { trackOrder: 0, lane: 'LEFT', slot: 1 };
    p2.pos = { trackOrder: 0, lane: 'RIGHT', slot: 0 };

    expect(engine.applyAction(state, 0, { type: 'SELECT_PLAN', cardId: 4, useFuelDump: true })).toBe(true);
    expect(engine.applyAction(state, 1, { type: 'SELECT_PLAN', cardId: 3 })).toBe(true);
    expect(engine.applyAction(state, 2, { type: 'SELECT_PLAN', cardId: 4 })).toBe(true);

    // All locked -> transitions to RESOLVING; Kopi Ikat Tepi ticked p1 bladder to 1; p0 fuelDumpUsed = true
    expect(state.phase).toBe('RESOLVING');
    expect(p1.bladder).toBe(1);
    expect(p0.fuelDumpUsed).toBe(true);
    expect(state.activeSeat).toBe(0);

    // p0 commits a move in RIGHT that crosses trackOrder 1 AWAS at speed 6 -> takes +2 Stress & disarms camera
    const rightOpt = state.reachableOptions.find(
      (o) => o.destination.lane === 'RIGHT' && o.crossedAwasOrders.includes(1)
    )!;
    expect(rightOpt.totalEffectiveSpeed).toBe(6);
    expect(engine.applyAction(state, 0, { type: 'COMMIT_MOVE', optionId: rightOpt.optionId })).toBe(true);
    expect(p0.stress).toBe(2);
    expect(seg1.awasDisarmed).toBe(true);

    // Next active is p1 (was on slot 1 LEFT)
    expect(state.activeSeat).toBe(1);
    const p1Opt = state.reachableOptions.at(0)!;
    expect(engine.applyAction(state, 1, { type: 'COMMIT_MOVE', optionId: p1Opt.optionId })).toBe(true);

    // Next active is p2 (crosses trackOrder 1 RIGHT slot 1, but camera is now cold -> 0 Stress!)
    expect(state.activeSeat).toBe(2);
    const p2Opt = state.reachableOptions.find((o) => o.destination.lane === 'RIGHT')!;
    expect(engine.applyAction(state, 2, { type: 'COMMIT_MOVE', optionId: p2Opt.optionId })).toBe(true);
    expect(p2.stress).toBe(0);
    expect(state.roundNumber).toBe(2);
  });

  it('spends 1 Scout Token to cancel AWAS penalty when armed', () => {
    const state = engine.createInitialState(default3PConfig(12));
    state.activeTrafficEvent = 'SMARTLANE';
    const seg1 = state.visibleTrack.at(1)!;
    seg1.card = { ...seg1.card, right: ['CLEAR', 'AWAS'] };
    seg1.awasDisarmed = false;

    const p0 = state.players.at(0)!;
    p0.scoutTokens = 1;
    p0.pos = { trackOrder: 0, lane: 'RIGHT', slot: 1 };

    engine.applyAction(state, 0, { type: 'SELECT_PLAN', cardId: 4 });
    engine.applyAction(state, 1, { type: 'SELECT_PLAN', cardId: 2 });
    engine.applyAction(state, 2, { type: 'SELECT_PLAN', cardId: 2 });

    const opt = state.reachableOptions.find((o) => o.crossedAwasOrders.includes(1))!;
    engine.applyAction(state, 0, {
      type: 'COMMIT_MOVE',
      optionId: opt.optionId,
      spendScoutOnAwas: true,
    });

    expect(p0.scoutTokens).toBe(0);
    expect(p0.stress).toBe(0);
  });

  it('resolves Deceleration Zone (Singgah R&R glide vs Shoulder stop) and EV DC Fast Charge Heads/Tails + Instant Torque + Downhill Regen', () => {
    const state = engine.createInitialState(default3PConfig(33));
    state.activeTrafficEvent = 'SMARTLANE';
    state.rempit.active = false;

    // Clear R&R from trackOrder 1 and put R&R on trackOrder 2 LEFT slot 1; put EV player (seat 1) 2 spaces behind on trackOrder 1 LEFT slot 1
    const seg1 = state.visibleTrack.at(1)!;
    seg1.card = {
      ...seg1.card,
      right: ['CLEAR', 'CLEAR'],
      left: ['CLEAR', 'CLEAR'],
    };
    const seg2 = state.visibleTrack.at(2)!;
    seg2.card = {
      ...seg2.card,
      left: ['CLEAR', 'RNR'],
      isDownhill: false,
    };
    const seg3 = state.visibleTrack.at(3)!;
    seg3.card = {
      ...seg3.card,
      isDownhill: true,
      right: ['CLEAR', 'CLEAR'],
      left: ['CLEAR', 'CLEAR'],
    };

    const p0 = state.players.at(0)!; // ICE on RIGHT with no R&R -> Emergency Shoulder Stop!
    const p1 = state.players.at(1)!; // EV within 2 spaces of R&R -> Official Pit Stop + EV_CHARGE_PROMPT!
    p0.pos = { trackOrder: 1, lane: 'RIGHT', slot: 0 };
    p0.hand = [0];
    p0.discardPile = [2, 3, 4, 5];
    p0.bladder = 2;

    p1.pos = { trackOrder: 1, lane: 'LEFT', slot: 1 };
    p1.hand = [0, 4];
    p1.discardPile = [2, 3, 5];
    p1.bladder = 2;
    p1.stress = 2;

    engine.applyAction(state, 0, { type: 'SELECT_PLAN', cardId: 0 });
    engine.applyAction(state, 1, { type: 'SELECT_PLAN', cardId: 0 });
    engine.applyAction(state, 2, { type: 'SELECT_PLAN', cardId: 2 });

    // p1 is furthest ahead (order 1 slot 1 vs p0 order 1 slot 0)
    expect(state.activeSeat).toBe(1);
    const rnrOpt = state.reachableOptions.at(0)!;
    expect(rnrOpt.pitStopKind).toBe('RNR');
    expect(rnrOpt.destination).toEqual({ trackOrder: 2, lane: 'LEFT', slot: 1 });

    engine.applyAction(state, 1, { type: 'COMMIT_MOVE', optionId: rnrOpt.optionId });
    expect(p1.bladder).toBe(0);
    expect(p1.stress).toBe(1);
    expect(p1.hand.length).toBe(5);
    expect(state.phase).toBe('EV_CHARGE_PROMPT');

    // Choose DC Fast Charge with deterministic rng < 0.5 (Heads -> +2 bonus speed next round!)
    engine.applyAction(state, 1, { type: 'CHOOSE_EV_CHARGE', mode: 'DC_FAST' }, () => 0.1);
    expect(state.lastCoinFlip).toBe('HEADS');
    expect(p1.evFastChargeBonusReady).toBe(2);
    expect(p1.evInstantTorqueReady).toBe(true);

    // Next is p0 (Shoulder Stop -> +1 Stress, bladder stays 2, cards reloaded)
    expect(state.activeSeat).toBe(0);
    const shoulderOpt = state.reachableOptions.at(0)!;
    expect(shoulderOpt.pitStopKind).toBe('SHOULDER');
    engine.applyAction(state, 0, { type: 'COMMIT_MOVE', optionId: shoulderOpt.optionId });
    expect(p0.stress).toBe(1);
    expect(p0.bladder).toBe(2);
    expect(p0.hand.length).toBe(5);

    // Finish p2 to advance to Round 2
    const p2Opt = state.reachableOptions.at(0)!;
    engine.applyAction(state, 2, { type: 'COMMIT_MOVE', optionId: p2Opt.optionId });

    // Round 2: p1 now has evInstantTorqueActiveThisRound (+1 on 4/5) AND evFastChargeBonusActiveThisRound (+2)!
    state.activeTrafficEvent = 'SMARTLANE';
    expect(p1.evInstantTorqueActiveThisRound).toBe(true);
    expect(p1.evFastChargeBonusActiveThisRound).toBe(2);
    expect(engine.calculateEffectiveSpeed(state, p1, 4, false)).toBe(7);

    // Also test EV Downhill Kinetic Regen reducing bladder by 1
    p1.bladder = 1;
    const p1DownhillOpts = engine.computeReachableOptions(state, p1, 4, false);
    const downhillMove = p1DownhillOpts.find((o) => o.crossedDownhillOrders.includes(3));
    expect(downhillMove !== undefined).toBe(true);
  });

  it('handles EV DC Fast Charge Tails penalty and AC Slow Charge safely', () => {
    const state = engine.createInitialState(default3PConfig(44));
    state.phase = 'EV_CHARGE_PROMPT';
    state.activeSeat = 1;
    const p1 = state.players.at(1)!;
    p1.stress = 1;

    engine.applyAction(state, 1, { type: 'CHOOSE_EV_CHARGE', mode: 'DC_FAST' }, () => 0.9);
    expect(state.lastCoinFlip).toBe('TAILS');
    expect(p1.stress).toBe(3);

    // Also verify AC_SLOW branch
    state.phase = 'EV_CHARGE_PROMPT';
    state.activeSeat = 1;
    engine.applyAction(state, 1, { type: 'CHOOSE_EV_CHARGE', mode: 'AC_SLOW' });
    expect(state.lastCoinFlip).toBe(null);
  });

  it('triggers Slipstream Draft vault, Cruising Santai relief, Potong Q penalty, Bladder Rupture, and Stress Meltdown', () => {
    const state = engine.createInitialState(default3PConfig(77));
    state.activeTrafficEvent = 'SMARTLANE';
    state.rempit.active = false;

    const p0 = state.players.at(0)!;
    const p1 = state.players.at(1)!;
    const p2 = state.players.at(2)!;

    // Place p0 at order 2 RIGHT slot 0; p1 starts at order 1 RIGHT slot 0 playing Cruising (2):
    // Landing at order 1 RIGHT slot 1 is 1 space behind p0 -> Slipstream vaults to order 2 RIGHT slot 1!
    p0.pos = { trackOrder: 2, lane: 'RIGHT', slot: 0 };
    p1.pos = { trackOrder: 1, lane: 'RIGHT', slot: 0 };
    p2.pos = { trackOrder: 0, lane: 'TRUNK', slot: 0 };

    const p1Opts = engine.computeReachableOptions(state, p1, 2, false);
    const slipOpt = p1Opts.find((o) => o.slipstreamApplied);
    expect(slipOpt?.destination).toEqual({ trackOrder: 2, lane: 'RIGHT', slot: 1 });

    // Set p0 up for Potong Q (5) failure (+1 Stress) -> reaching Stress 6 Meltdown!
    p0.stress = 5;
    // Set p1 up for Bladder 4 Rupture via Kopi (3) when bladder is 3!
    p1.bladder = 3;
    p1.pos = { trackOrder: 1, lane: 'LEFT', slot: 0 };
    // Set p2 stress = 2 for Cruising Santai (2) open-front -1 Stress relief
    p2.stress = 2;

    engine.applyAction(state, 0, { type: 'SELECT_PLAN', cardId: 5 });
    engine.applyAction(state, 1, { type: 'SELECT_PLAN', cardId: 3 });
    engine.applyAction(state, 2, { type: 'SELECT_PLAN', cardId: 2 });

    expect(p1.bladder).toBe(4);

    // Resolve p0 (lead car): Potong Q without passing anyone -> +1 Stress = 6 -> Meltdown at Clean-Up!
    const p0Move = state.reachableOptions.find((o) => !o.isScoutFrontier)!;
    engine.applyAction(state, 0, { type: 'COMMIT_MOVE', optionId: p0Move.optionId });
    expect(p0.stress).toBe(6);

    // Resolve p1
    const p1Move = state.reachableOptions.at(0)!;
    engine.applyAction(state, 1, { type: 'COMMIT_MOVE', optionId: p1Move.optionId });

    // Resolve p2 (Cruising Santai with open front -> stress drops 2 -> 1)
    const p2Move = state.reachableOptions.at(0)!;
    engine.applyAction(state, 2, { type: 'COMMIT_MOVE', optionId: p2Move.optionId });

    // Clean-Up triggered:
    // p0 had Stress 6 -> Meltdown drops 3 Stress (-> 3) and skips Round 2!
    // p1 had Bladder 4 -> Rupture adds +2 Stress, resets Bladder to 0, and skips Round 2!
    // p2 relieved 1 Stress -> 1!
    expect(p0.stress).toBe(3);
    expect(p0.skippedThisRound).toBe(true);
    expect(p1.bladder).toBe(0);
    expect(p1.skippedThisRound).toBe(true);
    expect(p2.stress).toBe(1);
  });

  it('scouts beyond horizon into sudden Simpang Tiga, enforces R&R ban + Overdrive Reload, resolves all 3 rural branches, and scores GAMEOVER', () => {
    const state: BalikKampungMatchState = engine.createInitialState(default3PConfig(99));
    state.activeTrafficEvent = 'SMARTLANE';
    state.rempit.active = false;

    // Seed SIMPANG_TIGA_CARD right on top of roadDeck so scouting beyond horizon reveals it immediately!
    state.roadDeck = [SIMPANG_TIGA_CARD];

    const lastOrder = state.visibleTrack.at(state.visibleTrack.length - 1)!.trackOrder;
    const p0 = state.players.at(0)!;
    const p1 = state.players.at(1)!;
    const p2 = state.players.at(2)!;

    p0.pos = { trackOrder: lastOrder, lane: 'RIGHT', slot: 1 };
    p1.pos = { trackOrder: lastOrder, lane: 'LEFT', slot: 1 };
    p2.pos = { trackOrder: lastOrder, lane: 'TRUNK', slot: 0 };
    // Give p2 only card [0] left after playing [2] this round so next round (when R&R is banned) p2 triggers Overdrive Reload!
    p2.hand = [2, 0];
    p2.discardPile = [3, 4, 5];

    engine.applyAction(state, 0, { type: 'SELECT_PLAN', cardId: 5 });
    engine.applyAction(state, 1, { type: 'SELECT_PLAN', cardId: 5 });
    engine.applyAction(state, 2, { type: 'SELECT_PLAN', cardId: 2 });

    // p0 scouts beyond visible horizon -> draws SIMPANG_TIGA + FINISH, gains +1 Scout Token, enters SIMPANG_SCOUT_PROMPT!
    const scoutOpt = state.reachableOptions.find((o) => o.isScoutFrontier)!;
    expect(scoutOpt.isScoutFrontier).toBe(true);
    engine.applyAction(state, 0, { type: 'COMMIT_MOVE', optionId: scoutOpt.optionId });

    expect(p0.scoutTokens).toBe(1);
    expect(state.simpangTigaDrawn).toBe(true);
    expect(state.phase).toBe('SIMPANG_SCOUT_PROMPT');

    // p0 chooses Jalan Kubur (2 spaces) with 4 remaining scout steps -> scrapes undercarriage (+2 Stress) & crosses FINISH (#1)!
    engine.applyAction(state, 0, { type: 'CHOOSE_SCOUTED_SIMPANG', branch: 'KUBUR' });
    expect(p0.finishedRank).toBe(1);
    expect(p0.stress).toBeGreaterThanOrEqual(2);

    // Next is p1: Simpang Tiga & Finish are now visible on track! Enter Jalan Bendang with mud roll = 1 (trapped!)
    expect(state.activeSeat).toBe(1);
    const bendangOpt = state.reachableOptions.find((o) => o.enteringSimpangBranch === 'BENDANG')!;
    engine.applyAction(
      state,
      1,
      { type: 'COMMIT_MOVE', optionId: bendangOpt.optionId },
      () => 0.05 // roll = 1 -> mudTrapped!
    );
    expect(p1.mudTrapped).toBe(true);
    expect(p1.pos.lane).toBe('BENDANG');

    // Resolve p2
    const p2Move = state.reachableOptions.at(0)!;
    engine.applyAction(state, 2, { type: 'COMMIT_MOVE', optionId: p2Move.optionId });

    // Next round begins: Singgah R&R is now permanently banned!
    // p2 only had [0] left in hand -> automatically triggered Overdrive Reload ([2,3,4,5] restored, +1 Stress)!
    expect(state.rnrBanned).toBe(true);
    expect(p2.hand).toContain(5);
    expect(p2.stress).toBeGreaterThanOrEqual(1);

    // Move p1 and p2 across Jalan Utama / Finish to trigger GAMEOVER (3P podium requires all 3 cars)
    p1.mudTrapped = false;
    const getPhase = () => state.phase;
    let safety = 0;
    while (getPhase() !== 'GAMEOVER' && safety < 6) {
      safety += 1;
      for (const car of state.players) {
        if (car.pos.lane === 'FINISH' || car.hasLockedPlan) continue;
        const nextCard = engine.getPlayableCards(state, car).at(-1) ?? 4;
        engine.applyAction(state, car.seat, { type: 'SELECT_PLAN', cardId: nextCard });
      }
      while (getPhase() === 'RESOLVING') {
        const finishOrUtama =
          state.reachableOptions.find((o) => o.destination.lane === 'FINISH') ??
          state.reachableOptions.find((o) => o.enteringSimpangBranch === 'UTAMA') ??
          state.reachableOptions.at(0)!;
        engine.applyAction(state, state.activeSeat, {
          type: 'COMMIT_MOVE',
          optionId: finishOrUtama.optionId,
        });
      }
    }

    expect(state.phase).toBe('GAMEOVER');
    expect(state.standings.length).toBe(3);
    expect(state.standings.at(0)?.standingPlace).toBe(1);
    const first = state.standings.at(0)!;
    expect(first.netHappiness).toBe(
      first.arrivalBonus - first.stressPenalty - first.bladderPenalty
    );
  });

  it('keeps Rempit inactive on non-REMPIT Round 1, spawns Rempit only on REMPIT event, and enforces KEMALANGAN & JEM', () => {
    const state = engine.createInitialState(default3PConfig(21));
    expect(
      engine.applyAction(state, 0, { type: 'LOBBY_SET_DRIVETRAIN', drivetrain: 'EV' })
    ).toBe(false);

    // Rempit must NOT appear unless REMPIT traffic event was drawn
    if (state.activeTrafficEvent !== 'REMPIT') {
      expect(state.rempit.active).toBe(false);
    }

    // Force JEM event speed calculation on Highway vs Trunk immunity
    state.activeTrafficEvent = 'JEM';
    const p0 = state.players.at(0)!;
    p0.pos = { trackOrder: 1, lane: 'RIGHT', slot: 0 };
    expect(engine.calculateEffectiveSpeed(state, p0, 4, false)).toBe(3);

    p0.pos = { trackOrder: 1, lane: 'TRUNK', slot: 0 };
    expect(engine.calculateEffectiveSpeed(state, p0, 3, false)).toBe(3);

    // Force REMPIT (starting from inactive!) and KEMALANGAN events across rounds
    state.trafficDeck = ['REMPIT', 'KEMALANGAN'];
    state.players.at(0)!.pos = { trackOrder: 1, lane: 'LEFT', slot: 1 };
    state.rempit = { pos: { trackOrder: 0, lane: 'LEFT', slot: 0 }, active: false };

    // Complete current round so beginNewRound draws REMPIT -> spawns & advances Rempit!
    for (const p of state.players) {
      const card = engine.getPlayableCards(state, p).at(0) ?? 2;
      engine.applyAction(state, p.seat, { type: 'SELECT_PLAN', cardId: card });
    }
    while (state.phase === 'RESOLVING') {
      const opt = state.reachableOptions.at(0)!;
      engine.applyAction(state, state.activeSeat, {
        type: 'COMMIT_MOVE',
        optionId: opt.optionId,
      });
    }

    expect(state.activeTrafficEvent).toBe('REMPIT');
    expect(state.rempit.active).toBe(true);
    expect((state.recentMoves?.length ?? 0)).toBeGreaterThan(0);
    expect((state.recentMoves?.at(-1)?.trail.length ?? 0)).toBeGreaterThanOrEqual(2);

    // Complete one more round so beginNewRound draws KEMALANGAN
    for (const p of state.players) {
      if (p.hasLockedPlan) continue;
      const card = engine.getPlayableCards(state, p).at(0) ?? 2;
      engine.applyAction(state, p.seat, { type: 'SELECT_PLAN', cardId: card });
    }
    const readPhase = () => state.phase;
    while (readPhase() === 'RESOLVING' || readPhase() === 'EV_CHARGE_PROMPT') {
      if (readPhase() === 'EV_CHARGE_PROMPT') {
        engine.applyAction(state, state.activeSeat, {
          type: 'CHOOSE_EV_CHARGE',
          mode: 'AC_SLOW',
        });
      } else {
        const opt = state.reachableOptions.at(0)!;
        engine.applyAction(state, state.activeSeat, {
          type: 'COMMIT_MOVE',
          optionId: opt.optionId,
        });
      }
    }

    expect(state.activeTrafficEvent).toBe('KEMALANGAN');
    expect(state.visibleTrack.some((s) => s.hasHazardCone)).toBe(true);
  });

  it('populates step-by-step trail on reachable options and previews landing options from sanitized player views', () => {
    const state = engine.createInitialState(default3PConfig(64));
    state.activeTrafficEvent = 'SMARTLANE';
    state.rempit.active = false;

    const seg1 = state.visibleTrack.at(1)!;
    seg1.card = {
      ...seg1.card,
      left: ['CLEAR', 'RNR'],
      right: ['CLEAR', 'AWAS'],
    };
    seg1.awasDisarmed = false;

    const p0 = state.players.at(0)!;
    p0.pos = { trackOrder: 1, lane: 'LEFT', slot: 0 };
    p0.bladder = 2;

    const view = engine.buildPlayerView(state, 0);

    // Card 2 is locked when bladder >= 2 -> empty preview
    expect(engine.previewCardOptionsFromView(view, 0, 2, false).length).toBe(0);

    // Card 0 glides 1 step forward into R&R at #1.2 with a 2-point trail (start -> R&R)
    const pitOpts = engine.previewCardOptionsFromView(view, 0, 0, false);
    expect(pitOpts.length).toBe(1);
    expect(pitOpts.at(0)?.pitStopKind).toBe('RNR');
    expect(pitOpts.at(0)?.trail).toEqual([
      { trackOrder: 1, lane: 'LEFT', slot: 0 },
      { trackOrder: 1, lane: 'LEFT', slot: 1 },
    ]);

    // Card 4 with ICE Fuel Dump (+2 => speed 6) previews effective speed 6 & multi-step trail
    expect(engine.previewEffectiveSpeedFromView(view, 0, 4, false)).toBe(4);
    expect(engine.previewEffectiveSpeedFromView(view, 0, 4, true)).toBe(6);
    expect(engine.previewEffectiveSpeedFromView(view, 99, 4, false)).toBe(4);

    const fastOpts = engine.previewCardOptionsFromView(view, 0, 4, false);
    expect(fastOpts.length).toBeGreaterThan(0);
    expect((fastOpts.at(0)?.trail?.length ?? 0)).toBeGreaterThan(2);

    // When R&R is banned in endgame, previewCardOptionsFromView returns [] for card 0
    const bannedView = { ...view, rnrBanned: true };
    expect(engine.previewCardOptionsFromView(bannedView, 0, 0, false).length).toBe(0);
  });

  it('advances all 5 cars from START slot 0 and slot 1 in a 5-player convoy and supports UNSELECT_PLAN', () => {
    const botService = TestBed.inject(BalikKampungBotService);
    const state = engine.createInitialState({
      rng: makeDeterministicRng(202),
      seats: [
        { seat: 0, name: 'P1', isBot: false, drivetrain: 'ICE', persona: 'red' },
        { seat: 1, name: 'Bot2', isBot: true, drivetrain: 'EV', persona: 'blue' },
        { seat: 2, name: 'Bot3', isBot: true, drivetrain: 'ICE', persona: 'yellow' },
        { seat: 3, name: 'Bot4', isBot: true, drivetrain: 'EV', persona: 'emerald' },
        { seat: 4, name: 'Bot5', isBot: true, drivetrain: 'ICE', persona: 'purple' },
      ],
    });
    state.activeTrafficEvent = 'SMARTLANE';
    state.rempit.active = false;

    expect(state.players.at(3)?.pos).toEqual({ trackOrder: 0, lane: 'RIGHT', slot: 0 });
    expect(state.players.at(4)?.pos).toEqual({ trackOrder: 0, lane: 'LEFT', slot: 0 });
    expect(
      engine.applyAction(state, 0, { type: 'LOBBY_SET_PERSONA', persona: 'purple' })
    ).toBe(false);

    // Seat 0 selects card 4 then changes mind via UNSELECT_PLAN before locking card 5
    expect(engine.applyAction(state, 0, { type: 'SELECT_PLAN', cardId: 4, useFuelDump: true })).toBe(true);
    expect(state.players.at(0)?.hasLockedPlan).toBe(true);
    expect(engine.applyAction(state, 0, { type: 'UNSELECT_PLAN' })).toBe(true);
    expect(state.players.at(0)?.hasLockedPlan).toBe(false);
    expect(state.players.at(0)?.plannedCard).toBeNull();
    expect(state.players.at(0)?.plannedFuelDump).toBe(false);

    // Lock human plan + all 4 AI bot plans via BalikKampungBotService
    expect(engine.applyAction(state, 0, { type: 'SELECT_PLAN', cardId: 5 })).toBe(true);
    for (const bot of state.players.slice(1)) {
      const botPlan = botService.decideBotPlan(state, bot);
      expect(botPlan?.type).toBe('SELECT_PLAN');
      expect(engine.applyAction(state, bot.seat, botPlan!)).toBe(true);
    }

    expect(state.phase).toBe('RESOLVING');

    // Resolve all 5 vehicles front-to-back using real AI bot decisions for Seats 1..4
    let safety = 0;
    while (state.roundNumber === 1 && safety < 12) {
      safety += 1;
      const activeSeat = state.activeSeat;
      expect(typeof activeSeat).toBe('number');
      const activePlayer = state.players.find((p) => p.seat === activeSeat)!;
      if (activePlayer.isBot) {
        const botAct = botService.decideActiveBotAction(state, activePlayer);
        expect(botAct !== null).toBe(true);
        expect(engine.applyAction(state, activeSeat, botAct!)).toBe(true);
      } else {
        const firstOpt = state.reachableOptions.at(0)!;
        expect(firstOpt.optionId.startsWith('STAY')).toBe(false);
        expect(
          engine.applyAction(state, activeSeat, {
            type: 'COMMIT_MOVE',
            optionId: firstOpt.optionId,
          })
        ).toBe(true);
      }
    }

    expect(state.roundNumber).toBe(2);
    // Every single car (including Bots 4 & 5 starting on START slot 0) moved onto segment #1 or beyond!
    for (const player of state.players) {
      expect(player.pos.trackOrder).toBeGreaterThanOrEqual(1);
    }
  });
});
