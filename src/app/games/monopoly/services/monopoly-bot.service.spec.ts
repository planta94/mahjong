import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MonopolyBotService } from './monopoly-bot.service';
import { MonopolyEngineService } from './monopoly-engine.service';
import { MonopolyMatchState, MonopolyPlayerView, TradeProposal } from '../models/monopoly.model';

describe('MonopolyBotService & Tactical AI Heuristics', () => {
  function createBot(): MonopolyBotService {
    TestBed.configureTestingModule({});
    return TestBed.inject(MonopolyBotService);
  }

  function createTestView(stateModifier?: (state: MonopolyMatchState) => void): MonopolyPlayerView {
    const engine = TestBed.inject(MonopolyEngineService);
    const state = engine.createInitialMonopolyState();
    if (stateModifier) stateModifier(state);
    return engine.getMonopolyPlayerView(state, 1);
  }

  it('maintains dynamic safety reserve and avoids isolated property purchases if cash is tight', () => {
    const botService = createBot();
    const view = createTestView((state) => {
      state.currentRound = 10;
      state.players[1].cash = 300;
      state.players[1].position = 16; // Teluk Cempedak (cost RM 180)
      state.activeSeat = 1;
      state.phase = 'action';
    });

    // Cost 180 leaves 120 < safety reserve (150 + 10 * 5 = 200) -> should pass
    const action = botService.evaluateMonopolyBotAction(view, 1);
    expect(action).toEqual({ type: 'passProperty' });
  });

  it('overrides safety reserve when purchase completes a color monopoly', () => {
    const botService = createBot();
    const view = createTestView((state) => {
      state.currentRound = 10;
      state.players[1].cash = 250;
      state.players[1].position = 3; // Jonker Walk (cost RM 60)
      // Bot already owns Kota A Famosa (space 1)
      state.properties.get(1)!.ownerSeat = 1;
      state.activeSeat = 1;
      state.phase = 'action';
    });

    // Completes Melaka monopoly! Must buy
    const action = botService.evaluateMonopolyBotAction(view, 1);
    expect(action).toEqual({ type: 'buyProperty' });
  });

  it('bids strategically in auctions based on monopoly equity and passes when overpriced', () => {
    const botService = createBot();

    // Case 1: Affordable auction bid
    const view1 = createTestView((state) => {
      state.phase = 'auction';
      state.players[1].cash = 1000;
      state.activeAuction = {
        spaceIndex: 1, // Cost 60
        currentBid: 20,
        highestBidderSeat: 0,
        activeBidders: [0, 1],
        timerSeconds: 10,
      };
    });

    const action1 = botService.evaluateMonopolyBotAction(view1, 1);
    expect(action1?.type).toBe('bidAuction');

    // Case 2: Outpriced auction -> pass
    const view2 = createTestView((state) => {
      state.phase = 'auction';
      state.players[1].cash = 1000;
      state.activeAuction = {
        spaceIndex: 1, // Cost 60
        currentBid: 300, // Exceeds perceived value
        highestBidderSeat: 0,
        activeBidders: [0, 1],
        timerSeconds: 10,
      };
    });

    const action2 = botService.evaluateMonopolyBotAction(view2, 1);
    expect(action2).toEqual({ type: 'passAuction' });
  });

  it('systematically builds houses on completed color groups focusing on 3 houses', () => {
    const botService = createBot();
    const view = createTestView((state) => {
      state.activeSeat = 1;
      state.phase = 'action';
      state.players[1].cash = 1500;
      // Bot owns Melaka (1 and 3)
      state.properties.get(1)!.ownerSeat = 1;
      state.properties.get(3)!.ownerSeat = 1;
      // No unowned property on bot position
      state.players[1].position = 0;
    });

    const action = botService.evaluateMonopolyBotAction(view, 1);
    expect(action?.type).toBe('buildHouse');
  });

  it('adapts jail strategy to Saidina Rule 2: pays bail in late game if owning high-rent hotels', () => {
    const botService = createBot();

    // Early game: pays bail or uses card
    const earlyView = createTestView((state) => {
      state.currentRound = 3;
      state.activeSeat = 1;
      state.phase = 'roll';
      state.players[1].inJail = true;
      state.players[1].cash = 500;
    });

    const earlyAction = botService.evaluateMonopolyBotAction(earlyView, 1);
    expect(earlyAction).toEqual({ type: 'payJailBail' });

    // Late game with high-rent hotels: pays bail to collect rent!
    const lateViewWithHotels = createTestView((state) => {
      state.currentRound = 22;
      state.activeSeat = 1;
      state.phase = 'roll';
      state.players[1].inJail = true;
      state.players[1].cash = 500;
      // Bot owns KLCC hotel (space 39)
      state.properties.get(39)!.ownerSeat = 1;
      state.properties.get(39)!.houses = 5;
    });

    const lateActionWithHotels = botService.evaluateMonopolyBotAction(lateViewWithHotels, 1);
    expect(lateActionWithHotels).toEqual({ type: 'payJailBail' });

    // Late game without hotels: stays in jail and rolls dice
    const lateViewWithoutHotels = createTestView((state) => {
      state.currentRound = 22;
      state.activeSeat = 1;
      state.phase = 'roll';
      state.players[1].inJail = true;
      state.players[1].cash = 500;
    });

    const lateActionWithoutHotels = botService.evaluateMonopolyBotAction(lateViewWithoutHotels, 1);
    expect(lateActionWithoutHotels).toEqual({ type: 'rollDice' });
  });

  it('evaluates proposed trades: rejects trades that grant opponent uncountered monopoly', () => {
    const botService = createBot();

    // Human (P0) owns space 1 (Kota A Famosa) and requests space 3 (Jonker Walk) from Bot (P1)
    const view = createTestView((state) => {
      state.properties.get(1)!.ownerSeat = 0;
      state.properties.get(3)!.ownerSeat = 1;
      const trade: TradeProposal = {
        fromSeat: 0,
        toSeat: 1,
        offerCash: 100,
        offerProperties: [],
        requestCash: 0,
        requestProperties: [3],
      };
      state.pendingTrade = trade;
    });

    const action = botService.evaluateMonopolyBotAction(view, 1);
    // Would give human a Melaka monopoly! Bot must reject
    expect(action).toEqual({ type: 'rejectTrade' });
  });

  it('uses Get Out of Jail Free card when in jail if available', () => {
    const botService = createBot();
    const view = createTestView((state) => {
      state.currentRound = 5;
      state.activeSeat = 1;
      state.phase = 'roll';
      state.players[1].inJail = true;
      state.players[1].outOfJailCards = 1;
      state.players[1].cash = 500;
    });

    const action = botService.evaluateMonopolyBotAction(view, 1);
    expect(action).toEqual({ type: 'useJailCard' });
  });

  it('liquidates assets in financial distress: sells houses first, then mortgages, then declares bankruptcy', () => {
    const botService = createBot();

    // 1. Bot has houses -> sells house
    const viewHouses = createTestView((state) => {
      state.activeSeat = 1;
      state.phase = 'financialDistress';
      state.debtTarget = { creditorSeat: 0, amountOwed: 200 };
      state.players[1].cash = 10;
      state.properties.get(1)!.ownerSeat = 1;
      state.properties.get(1)!.houses = 2;
    });
    expect(botService.evaluateMonopolyBotAction(viewHouses, 1)).toEqual({
      type: 'sellHouse',
      spaceIndex: 1,
    });

    // 2. Bot has unmortgaged property -> mortgages property
    const viewMortgage = createTestView((state) => {
      state.activeSeat = 1;
      state.phase = 'financialDistress';
      state.debtTarget = { creditorSeat: 0, amountOwed: 200 };
      state.players[1].cash = 10;
      state.properties.get(1)!.ownerSeat = 1;
      state.properties.get(1)!.houses = 0;
      state.properties.get(1)!.isMortgaged = false;
    });
    expect(botService.evaluateMonopolyBotAction(viewMortgage, 1)).toEqual({
      type: 'mortgageProperty',
      spaceIndex: 1,
    });

    // 3. Bot has no properties -> declares bankruptcy
    const viewBankruptcy = createTestView((state) => {
      state.activeSeat = 1;
      state.phase = 'financialDistress';
      state.debtTarget = { creditorSeat: 0, amountOwed: 200 };
      state.players[1].cash = 0;
    });
    expect(botService.evaluateMonopolyBotAction(viewBankruptcy, 1)).toEqual({
      type: 'declareBankruptcy',
    });
  });

  it('unmortgages properties when cash surplus is abundant', () => {
    const botService = createBot();
    const view = createTestView((state) => {
      state.activeSeat = 1;
      state.phase = 'action';
      state.players[1].cash = 1000;
      state.players[1].position = 0; // On Go
      state.properties.get(1)!.ownerSeat = 1;
      state.properties.get(1)!.isMortgaged = true; // Kota A Famosa (cost 60, unmortgage 33)
    });

    const action = botService.evaluateMonopolyBotAction(view, 1);
    expect(action).toEqual({ type: 'unmortgageProperty', spaceIndex: 1 });
  });

  it('accepts trades that grant bot a monopoly or offer positive net asset value', () => {
    const botService = createBot();

    // 1. Trade completes bot monopoly
    const viewMonopoly = createTestView((state) => {
      state.properties.get(1)!.ownerSeat = 1;
      state.properties.get(3)!.ownerSeat = 0;
      state.pendingTrade = {
        fromSeat: 0,
        toSeat: 1,
        offerCash: 0,
        offerProperties: [3],
        requestCash: 50,
        requestProperties: [],
      };
    });
    expect(botService.evaluateMonopolyBotAction(viewMonopoly, 1)).toEqual({
      type: 'acceptTrade',
    });

    // 2. Trade has positive net value
    const viewPositiveValue = createTestView((state) => {
      state.pendingTrade = {
        fromSeat: 0,
        toSeat: 1,
        offerCash: 200,
        offerProperties: [],
        requestCash: 50,
        requestProperties: [],
      };
    });
    expect(botService.evaluateMonopolyBotAction(viewPositiveValue, 1)).toEqual({
      type: 'acceptTrade',
    });
  });

  it('returns null when game is over, bot is bankrupt, or bot is not active player', () => {
    const botService = createBot();

    const gameOverView = createTestView((state) => {
      state.phase = 'gameOver';
    });
    expect(botService.evaluateMonopolyBotAction(gameOverView, 1)).toBeNull();

    const bankruptView = createTestView((state) => {
      state.players[1].bankrupt = true;
    });
    expect(botService.evaluateMonopolyBotAction(bankruptView, 1)).toBeNull();

    const notActiveView = createTestView((state) => {
      state.activeSeat = 0;
      state.phase = 'action';
    });
    expect(botService.evaluateMonopolyBotAction(notActiveView, 1)).toBeNull();
  });

  it('proactively proposes monopoly-completing trades, prioritizes high-ROI groups, mortgages singles before selling houses, and blocks extortionate trades', () => {
    const botService = createBot();

    // 1. Prioritizes Orange (16, 18, 19) over Brown (1, 3) when building houses
    const roiBuildView = createTestView((state) => {
      state.activeSeat = 1;
      state.phase = 'action';
      state.players[1].cash = 1500;
      state.players[1].position = 0;
      state.properties.get(1)!.ownerSeat = 1;
      state.properties.get(3)!.ownerSeat = 1;
      state.properties.get(16)!.ownerSeat = 1;
      state.properties.get(18)!.ownerSeat = 1;
      state.properties.get(19)!.ownerSeat = 1;
    });
    const buildAction = botService.evaluateMonopolyBotAction(roiBuildView, 1);
    expect(buildAction).toEqual({ type: 'buildHouse', spaceIndex: 16 });

    // 2. Mortgages isolated unimproved property (space 5) BEFORE selling 50%-loss houses on Brown (1, 3)
    const smartDistressView = createTestView((state) => {
      state.activeSeat = 1;
      state.phase = 'financialDistress';
      state.debtTarget = { creditorSeat: 0, amountOwed: 120 };
      state.players[1].cash = 20;
      state.properties.get(1)!.ownerSeat = 1;
      state.properties.get(1)!.houses = 2;
      state.properties.get(3)!.ownerSeat = 1;
      state.properties.get(3)!.houses = 2;
      state.properties.get(5)!.ownerSeat = 1; // KL Sentral (isolated transit, 0 houses)
    });
    expect(botService.evaluateMonopolyBotAction(smartDistressView, 1)).toEqual({
      type: 'mortgageProperty',
      spaceIndex: 5,
    });

    // 3. Proactively proposes a monopoly-completing trade on Round 4 when owning 2/3 of Orange
    const proactiveTradeView = createTestView((state) => {
      state.currentRound = 4;
      state.activeSeat = 1;
      state.phase = 'action';
      state.players[1].cash = 1200;
      state.players[1].position = 0;
      state.properties.get(16)!.ownerSeat = 1;
      state.properties.get(18)!.ownerSeat = 1;
      state.properties.get(19)!.ownerSeat = 0; // Seat 0 holds final Orange deed
      state.properties.get(5)!.ownerSeat = 1; // Bot offers isolated KL Sentral + cash sweetener
    });
    const tradeProposalAction = botService.evaluateMonopolyBotAction(proactiveTradeView, 1);
    expect(tradeProposalAction?.type).toBe('proposeTrade');
    if (tradeProposalAction?.type === 'proposeTrade') {
      expect(tradeProposalAction.trade.toSeat).toBe(0);
      expect(tradeProposalAction.trade.requestProperties).toEqual([19]);
      expect(tradeProposalAction.trade.offerProperties).toEqual([5]);
    }

    // 4. Rejects extortionate monopoly-completing trade demanding RM 1000 for RM 60 Jonker Walk
    const extortionView = createTestView((state) => {
      state.players[1].cash = 1200;
      state.properties.get(1)!.ownerSeat = 1;
      state.properties.get(3)!.ownerSeat = 0;
      state.pendingTrade = {
        fromSeat: 0,
        toSeat: 1,
        offerCash: 0,
        offerProperties: [3],
        requestCash: 1000,
        requestProperties: [],
      };
    });
    expect(botService.evaluateMonopolyBotAction(extortionView, 1)).toEqual({
      type: 'rejectTrade',
    });
  });
});

