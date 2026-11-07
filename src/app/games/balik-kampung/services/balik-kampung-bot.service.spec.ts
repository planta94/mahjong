import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BalikKampungBotService } from './balik-kampung-bot.service';
import { BalikKampungEngineService } from './balik-kampung-engine.service';

function makeDeterministicRng(seed = 17): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('BalikKampungBotService', () => {
  let engine: BalikKampungEngineService;
  let botService: BalikKampungBotService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    engine = TestBed.inject(BalikKampungEngineService);
    botService = TestBed.inject(BalikKampungBotService);
  });

  it('selects optimal movement plan, avoids Bladder 4 rupture from Kopi, and prioritizes official R&R pit stop when bladder is high', () => {
    const state = engine.createInitialState({
      rng: makeDeterministicRng(42),
      seats: [
        { seat: 0, name: 'Human', isBot: false, drivetrain: 'ICE', persona: 'red' },
        { seat: 1, name: 'BotEV', isBot: true, drivetrain: 'EV', persona: 'blue' },
        { seat: 2, name: 'BotICE', isBot: true, drivetrain: 'ICE', persona: 'yellow' },
      ],
    });
    state.rempit.active = false;

    const botEv = state.players.at(1)!;
    const botIce = state.players.at(2)!;

    // 1. Avoid Kopi (3) when bladder === 3 and alternative movement card exists
    botEv.bladder = 3;
    botEv.hand = [3, 4, 0];
    botEv.pos = { trackOrder: 1, lane: 'LEFT', slot: 0 };
    const planAvoidRupture = botService.decideBotPlan(state, botEv);
    expect(planAvoidRupture?.cardId).not.toBe(3);

    // 2. Prioritize Singgah R&R (0) when within 2 spaces of R&R bay and bladder >= 2
    for (const seg of state.visibleTrack) {
      if (seg.card.kind === 'STANDARD') {
        seg.card = { ...seg.card, isDownhill: false, left: ['CLEAR', 'CLEAR'] };
      }
    }
    const seg2 = state.visibleTrack.at(2)!;
    seg2.card = { ...seg2.card, isDownhill: false, left: ['CLEAR', 'RNR'] };
    botEv.pos = { trackOrder: 1, lane: 'LEFT', slot: 1 };
    botEv.bladder = 3;
    botEv.hand = [0, 3, 4];
    const planPit = botService.decideBotPlan(state, botEv);
    expect(planPit?.cardId).toBe(0);

    // 3. Only [0] left in hand -> plays 0
    botIce.hand = [0];
    const planOnlyZero = botService.decideBotPlan(state, botIce);
    expect(planOnlyZero?.cardId).toBe(0);

    // 4. Finished bot returns null plan
    botIce.pos = { trackOrder: 99, lane: 'FINISH', slot: 0 };
    expect(botService.decideBotPlan(state, botIce)).toBe(null);
  });

  it('evaluates late-race ICE Fuel Dump, RESOLVING moves, EV_CHARGE_PROMPT, and SIMPANG_SCOUT_PROMPT branches', () => {
    const state = engine.createInitialState({
      rng: makeDeterministicRng(84),
      seats: [
        { seat: 0, name: 'Human', isBot: false, drivetrain: 'ICE', persona: 'red' },
        { seat: 1, name: 'BotEV', isBot: true, drivetrain: 'EV', persona: 'blue' },
        { seat: 2, name: 'BotICE', isBot: true, drivetrain: 'ICE', persona: 'yellow' },
      ],
    });

    const botEv = state.players.at(1)!;
    const botIce = state.players.at(2)!;

    // Late race ICE Fuel Dump check
    state.simpangTigaDrawn = true;
    const latePlan = botService.decideBotPlan(state, botIce);
    expect(latePlan?.type).toBe('SELECT_PLAN');

    // Non-active seat returns null
    state.activeSeat = 0;
    expect(botService.decideActiveBotAction(state, botEv)).toBe(null);

    // EV_CHARGE_PROMPT: low stress chooses DC_FAST; high stress chooses AC_SLOW
    state.phase = 'EV_CHARGE_PROMPT';
    state.activeSeat = 1;
    botEv.stress = 1;
    expect(botService.decideActiveBotAction(state, botEv)).toEqual({
      type: 'CHOOSE_EV_CHARGE',
      mode: 'DC_FAST',
    });

    botEv.stress = 4;
    expect(botService.decideActiveBotAction(state, botEv)).toEqual({
      type: 'CHOOSE_EV_CHARGE',
      mode: 'AC_SLOW',
    });

    // SIMPANG_SCOUT_PROMPT across step/stress thresholds
    state.phase = 'SIMPANG_SCOUT_PROMPT';
    state.pendingScoutSteps = 4;
    state.pendingScoutPlayedSpeed = 5;
    expect(botService.decideActiveBotAction(state, botEv)).toEqual({
      type: 'CHOOSE_SCOUTED_SIMPANG',
      branch: 'UTAMA',
    });

    state.pendingScoutSteps = 2;
    botEv.stress = 1;
    expect(botService.decideActiveBotAction(state, botEv)).toEqual({
      type: 'CHOOSE_SCOUTED_SIMPANG',
      branch: 'KUBUR',
    });

    state.pendingScoutSteps = 1;
    botEv.stress = 5;
    expect(botService.decideActiveBotAction(state, botEv)).toEqual({
      type: 'CHOOSE_SCOUTED_SIMPANG',
      branch: 'UTAMA',
    });

    state.pendingScoutSteps = 1;
    botEv.stress = 1;
    expect(botService.decideActiveBotAction(state, botEv)).toEqual({
      type: 'CHOOSE_SCOUTED_SIMPANG',
      branch: 'BENDANG',
    });

    // RESOLVING move selection
    state.phase = 'RESOLVING';
    state.activeSeat = 1;
    botEv.revealedCard = 4;
    state.reachableOptions = engine.computeReachableOptions(state, botEv, 4, false);
    const moveAct = botService.decideActiveBotAction(state, botEv);
    expect(moveAct?.type).toBe('COMMIT_MOVE');
  });
});
