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

  describe('Expanded Tactical Coverage: Auctions, Trades, Jail, Building & Distress', () => {
    it('returns null when inactive in auction, waiting on counterparty trade, or in non-actionable phase', () => {
      const botService = createBot();

      // 1. Auction active, but bot is not in activeBidders
      const passedAuctionView = createTestView((state) => {
        state.phase = 'auction';
        state.activeAuction = {
          spaceIndex: 1,
          currentBid: 30,
          highestBidderSeat: 0,
          activeBidders: [0],
          timerSeconds: 8,
        };
      });
      expect(botService.evaluateMonopolyBotAction(passedAuctionView, 1)).toBeNull();

      // 2. Pending trade addressed to another seat (bot is proposer waiting on seat 0)
      const waitingTradeView = createTestView((state) => {
        state.activeSeat = 1;
        state.phase = 'action';
        state.pendingTrade = {
          fromSeat: 1,
          toSeat: 0,
          offerCash: 100,
          offerProperties: [],
          requestCash: 0,
          requestProperties: [1],
        };
      });
      expect(botService.evaluateMonopolyBotAction(waitingTradeView, 1)).toBeNull();

      // 3. Roll phase when bot is not in jail
      const normalRollView = createTestView((state) => {
        state.activeSeat = 1;
        state.phase = 'roll';
        state.players[1].inJail = false;
      });
      expect(botService.evaluateMonopolyBotAction(normalRollView, 1)).toEqual({ type: 'rollDice' });

      // 4. Non-actionable phase ('trade' with no pendingTrade)
      const tradePhaseView = createTestView((state) => {
        state.activeSeat = 1;
        state.phase = 'trade';
      });
      expect(botService.evaluateMonopolyBotAction(tradePhaseView, 1)).toBeNull();
    });

    it('ends turn cleanly when no property purchase, build, trade, or unmortgage applies', () => {
      const botService = createBot();

      // Low cash (< 600) skips unmortgage early and ends turn
      const lowCashIdleView = createTestView((state) => {
        state.activeSeat = 1;
        state.phase = 'action';
        state.players[1].position = 0;
        state.players[1].cash = 400;
      });
      expect(botService.evaluateMonopolyBotAction(lowCashIdleView, 1)).toEqual({ type: 'endTurn' });

      // High cash (>= 600) with no mortgaged bot properties finishes unmortgage scan and ends turn
      const highCashIdleView = createTestView((state) => {
        state.activeSeat = 1;
        state.phase = 'action';
        state.players[1].position = 0;
        state.players[1].cash = 900;
        state.properties.get(1)!.ownerSeat = 0;
        state.properties.get(1)!.isMortgaged = true;
        state.properties.get(3)!.ownerSeat = 1;
        state.properties.get(3)!.isMortgaged = false;
      });
      expect(botService.evaluateMonopolyBotAction(highCashIdleView, 1)).toEqual({ type: 'endTurn' });
    });

    it('covers early and late-game jail edge cases with cards, insufficient bail cash, and low-rent buildings', () => {
      const botService = createBot();

      // Early game in jail with < RM 50 cash and 0 cards -> must rollDice
      const earlyBrokeJailView = createTestView((state) => {
        state.currentRound = 4;
        state.activeSeat = 1;
        state.phase = 'roll';
        state.players[1].inJail = true;
        state.players[1].outOfJailCards = 0;
        state.players[1].cash = 20;
      });
      expect(botService.evaluateMonopolyBotAction(earlyBrokeJailView, 1)).toEqual({
        type: 'rollDice',
      });

      // Late game owning high-rent hotel + jail card -> uses jail card
      const lateHotelCardView = createTestView((state) => {
        state.currentRound = 18;
        state.activeSeat = 1;
        state.phase = 'roll';
        state.players[1].inJail = true;
        state.players[1].outOfJailCards = 1;
        state.players[1].cash = 500;
        state.properties.get(39)!.ownerSeat = 1;
        state.properties.get(39)!.houses = 5;
      });
      expect(botService.evaluateMonopolyBotAction(lateHotelCardView, 1)).toEqual({
        type: 'useJailCard',
      });

      // Late game owning high-rent hotel, 0 cards, and < RM 50 cash -> falls back to rollDice
      const lateHotelBrokeView = createTestView((state) => {
        state.currentRound = 18;
        state.activeSeat = 1;
        state.phase = 'roll';
        state.players[1].inJail = true;
        state.players[1].outOfJailCards = 0;
        state.players[1].cash = 25;
        state.properties.get(39)!.ownerSeat = 1;
        state.properties.get(39)!.houses = 5;
      });
      expect(botService.evaluateMonopolyBotAction(lateHotelBrokeView, 1)).toEqual({
        type: 'rollDice',
      });

      // Late game owning only low-baseRent hotel (A Famosa baseRent = 2 < 18) -> rolls dice to stay safe
      const lateLowRentHotelView = createTestView((state) => {
        state.currentRound = 18;
        state.activeSeat = 1;
        state.phase = 'roll';
        state.players[1].inJail = true;
        state.players[1].cash = 500;
        state.properties.get(1)!.ownerSeat = 1;
        state.properties.get(1)!.houses = 5;
      });
      expect(botService.evaluateMonopolyBotAction(lateLowRentHotelView, 1)).toEqual({
        type: 'rollDice',
      });
    });

    it('evaluates property buying for insufficient cash, blocking opponent monopoly, and transit synergy', () => {
      const botService = createBot();

      // 1. Insufficient cash to afford space cost -> passProperty
      const brokeBuyView = createTestView((state) => {
        state.activeSeat = 1;
        state.phase = 'action';
        state.players[1].position = 39; // KLCC cost 400
        state.players[1].cash = 150;
      });
      expect(botService.evaluateMonopolyBotAction(brokeBuyView, 1)).toEqual({
        type: 'passProperty',
      });

      // 2. Opponent owns only 1 of 3 in Light Blue (not about to complete monopoly) and cash is tight -> passProperty
      const nonBlockingView = createTestView((state) => {
        state.currentRound = 10;
        state.activeSeat = 1;
        state.phase = 'action';
        state.players[1].position = 8; // Concubine Lane (cost 100)
        state.players[1].cash = 150; // 150 - 100 = 50 < safetyReserve 200
        state.properties.get(6)!.ownerSeat = 0; // P0 only has 1 of 3 Light Blue
      });
      expect(botService.evaluateMonopolyBotAction(nonBlockingView, 1)).toEqual({
        type: 'passProperty',
      });

      // 3. Opponent owns 2 of 3 in Light Blue -> blocks opponent monopoly despite tight cash!
      const blockingBuyView = createTestView((state) => {
        state.currentRound = 10;
        state.activeSeat = 1;
        state.phase = 'action';
        state.players[1].position = 9; // Birch Clock Tower (cost 120)
        state.players[1].cash = 150; // Below normal safety reserve, but >= 120
        state.properties.get(6)!.ownerSeat = 0;
        state.properties.get(8)!.ownerSeat = 0;
      });
      expect(botService.evaluateMonopolyBotAction(blockingBuyView, 1)).toEqual({
        type: 'buyProperty',
      });

      // 4. Transit synergy: bot already owns 1 transit (space 5) and lands on space 15 (cost 200)
      const transitBuyView = createTestView((state) => {
        state.currentRound = 10;
        state.activeSeat = 1;
        state.phase = 'action';
        state.players[1].position = 15; // Port Klang (cost 200)
        state.players[1].cash = 310; // 310 - 200 = 110 >= 100 transit buffer (though < 200 general reserve)
        state.properties.get(5)!.ownerSeat = 1;
        state.properties.get(1)!.ownerSeat = 1;
      });
      expect(botService.evaluateMonopolyBotAction(transitBuyView, 1)).toEqual({
        type: 'buyProperty',
      });

      // 5. Transit synergy rejected when post-purchase cash drops below RM 100
      const transitTightView = createTestView((state) => {
        state.currentRound = 10;
        state.activeSeat = 1;
        state.phase = 'action';
        state.players[1].position = 15;
        state.players[1].cash = 250; // 250 - 200 = 50 < 100
        state.properties.get(5)!.ownerSeat = 1;
      });
      expect(botService.evaluateMonopolyBotAction(transitTightView, 1)).toEqual({
        type: 'passProperty',
      });
    });

    it('calculates auction bid multipliers for monopoly completion, blocking, transit synergy, utilities, and invalid spaces', () => {
      const botService = createBot();

      // 1. Invalid/non-cost space in auction -> passAuction
      const invalidAuctionView = createTestView((state) => {
        state.phase = 'auction';
        state.activeAuction = {
          spaceIndex: 0, // GO has no cost
          currentBid: 0,
          highestBidderSeat: null,
          activeBidders: [0, 1],
          timerSeconds: 10,
        };
      });
      expect(botService.evaluateMonopolyBotAction(invalidAuctionView, 1)).toEqual({
        type: 'passAuction',
      });

      // 2. Completes monopoly (1.65x multiplier: Jonker Walk cost 60 -> perceivedValue 99)
      const completeAuctionView = createTestView((state) => {
        state.currentRound = 1;
        state.phase = 'auction';
        state.players[1].cash = 600;
        state.properties.get(1)!.ownerSeat = 1;
        state.activeAuction = {
          spaceIndex: 3,
          currentBid: 80, // nextBid 90 <= 99 (would pass at 0.85x = 51)
          highestBidderSeat: 0,
          activeBidders: [0, 1],
          timerSeconds: 10,
        };
      });
      expect(botService.evaluateMonopolyBotAction(completeAuctionView, 1)).toEqual({
        type: 'bidAuction',
        amount: 90,
      });

      // 3. Blocks opponent monopoly (1.3x multiplier: Jonker Walk cost 60 -> perceivedValue 78)
      const blockAuctionView = createTestView((state) => {
        state.currentRound = 1;
        state.phase = 'auction';
        state.players[1].cash = 600;
        state.properties.get(1)!.ownerSeat = 0;
        state.activeAuction = {
          spaceIndex: 3,
          currentBid: 60, // nextBid 70 <= 78
          highestBidderSeat: 0,
          activeBidders: [0, 1],
          timerSeconds: 10,
        };
      });
      expect(botService.evaluateMonopolyBotAction(blockAuctionView, 1)).toEqual({
        type: 'bidAuction',
        amount: 70,
      });

      // 4. Transit synergy >= 2 (1.4x multiplier: Penang Bridge cost 200 -> perceivedValue 280)
      const twoTransitAuctionView = createTestView((state) => {
        state.currentRound = 1;
        state.phase = 'auction';
        state.players[1].cash = 600;
        state.properties.get(5)!.ownerSeat = 1;
        state.properties.get(15)!.ownerSeat = 1;
        state.activeAuction = {
          spaceIndex: 25,
          currentBid: 250, // nextBid 260 <= 280
          highestBidderSeat: 0,
          activeBidders: [0, 1],
          timerSeconds: 10,
        };
      });
      expect(botService.evaluateMonopolyBotAction(twoTransitAuctionView, 1)).toEqual({
        type: 'bidAuction',
        amount: 260,
      });

      // 5. Transit synergy === 1 (1.15x multiplier: Port Klang cost 200 -> perceivedValue 230)
      const oneTransitAuctionView = createTestView((state) => {
        state.currentRound = 1;
        state.phase = 'auction';
        state.players[1].cash = 600;
        state.properties.get(5)!.ownerSeat = 1;
        state.activeAuction = {
          spaceIndex: 15,
          currentBid: 210, // nextBid 220 <= 230
          highestBidderSeat: 0,
          activeBidders: [0, 1],
          timerSeconds: 10,
        };
      });
      expect(botService.evaluateMonopolyBotAction(oneTransitAuctionView, 1)).toEqual({
        type: 'bidAuction',
        amount: 220,
      });

      // 6. Utility auction (no colorGroup, 0.85x multiplier: TNB cost 150 -> perceivedValue 127)
      const utilityAuctionView = createTestView((state) => {
        state.currentRound = 1;
        state.phase = 'auction';
        state.players[1].cash = 600;
        state.activeAuction = {
          spaceIndex: 12,
          currentBid: 100, // nextBid 110 <= 127
          highestBidderSeat: 0,
          activeBidders: [0, 1],
          timerSeconds: 10,
        };
      });
      expect(botService.evaluateMonopolyBotAction(utilityAuctionView, 1)).toEqual({
        type: 'bidAuction',
        amount: 110,
      });
    });

    it('respects even-build ordering, second-pass hotel upgrades, and cash safety buffers when building', () => {
      const botService = createBot();

      // 1. Even-build: space 1 has 1 house, space 3 has 0 -> builds on space 3
      const evenBuildView = createTestView((state) => {
        state.activeSeat = 1;
        state.phase = 'action';
        state.players[1].position = 0;
        state.players[1].cash = 1000;
        state.properties.get(1)!.ownerSeat = 1;
        state.properties.get(1)!.houses = 1;
        state.properties.get(3)!.ownerSeat = 1;
        state.properties.get(3)!.houses = 0;
      });
      expect(botService.evaluateMonopolyBotAction(evenBuildView, 1)).toEqual({
        type: 'buildHouse',
        spaceIndex: 3,
      });

      // 2. Second pass (3H -> 4H/Hotel): both Brown spaces already at 3 houses -> upgrades to 4th house
      const passTwoBuildView = createTestView((state) => {
        state.activeSeat = 1;
        state.phase = 'action';
        state.players[1].position = 0;
        state.players[1].cash = 1000;
        state.properties.get(1)!.ownerSeat = 1;
        state.properties.get(1)!.houses = 3;
        state.properties.get(3)!.ownerSeat = 1;
        state.properties.get(3)!.houses = 3;
      });
      expect(botService.evaluateMonopolyBotAction(passTwoBuildView, 1)).toEqual({
        type: 'buildHouse',
        spaceIndex: 1,
      });

      // 3. Cash below building safety buffer -> skips building and ends turn
      const tightBufferBuildView = createTestView((state) => {
        state.currentRound = 2; // safetyBuffer = 220
        state.activeSeat = 1;
        state.phase = 'action';
        state.players[1].position = 0;
        state.players[1].cash = 240; // 240 - 50 = 190 < 220
        state.properties.get(1)!.ownerSeat = 1;
        state.properties.get(3)!.ownerSeat = 1;
      });
      expect(botService.evaluateMonopolyBotAction(tightBufferBuildView, 1)).toEqual({
        type: 'endTurn',
      });
    });

    it('covers proactive trade cooldowns, candidate filtering, pure cash buyouts, and ineligible targets', () => {
      const botService = createBot();

      // 1. Pure cash buyout when bot owns no isolated tradeable single, plus per-round cooldown on 2nd call
      const cashBuyoutView = createTestView((state) => {
        state.currentRound = 5;
        state.activeSeat = 1;
        state.phase = 'action';
        state.players[1].position = 0;
        state.players[1].cash = 1000;
        state.properties.get(16)!.ownerSeat = 1;
        state.properties.get(18)!.ownerSeat = 1;
        state.properties.get(19)!.ownerSeat = 0; // Cameron Highlands cost 200 -> buyout 280
      });
      const firstTrade = botService.evaluateMonopolyBotAction(cashBuyoutView, 1);
      expect(firstTrade).toEqual({
        type: 'proposeTrade',
        trade: {
          fromSeat: 1,
          toSeat: 0,
          offerCash: 280,
          offerProperties: [],
          requestCash: 0,
          requestProperties: [19],
        },
      });
      // Calling again in same round hits lastTradeRoundBySeat cooldown -> endTurn
      expect(botService.evaluateMonopolyBotAction(cashBuyoutView, 1)).toEqual({ type: 'endTurn' });

      // 2. Log-based recent trade guard blocks duplicate proposal on later round
      const logGuardedView = createTestView((state) => {
        state.currentRound = 6;
        state.activeSeat = 1;
        state.phase = 'action';
        state.players[1].position = 0;
        state.players[1].cash = 1000;
        state.properties.get(16)!.ownerSeat = 1;
        state.properties.get(18)!.ownerSeat = 1;
        state.properties.get(19)!.ownerSeat = 0;
        state.logs.push('[Trade] KL Tycoon (Bot) proposed a trade to Player 1.');
      });
      expect(botService.evaluateMonopolyBotAction(logGuardedView, 1)).toEqual({
        type: 'endTurn',
      });

      // 3. Candidate filtering skips bot pairs, target-group deeds & opponent-monopoly-granting singles, picking safe single
      const filteredCandidateView = createTestView((state) => {
        state.currentRound = 7;
        state.activeSeat = 1;
        state.phase = 'action';
        state.players[1].position = 0;
        state.players[1].cash = 1200;
        // Wants Red 24 (cost 240) from P0
        state.properties.get(21)!.ownerSeat = 1;
        state.properties.get(23)!.ownerSeat = 1;
        state.properties.get(24)!.ownerSeat = 0;
        // Bot owns Brown 1, but P0 owns Brown 3 -> offering 1 would give P0 Brown monopoly (must skip!)
        state.properties.get(1)!.ownerSeat = 1;
        state.properties.get(3)!.ownerSeat = 0;
        // Bot owns 2 of Pink (11, 13) -> pair in same group (must skip!)
        state.properties.get(11)!.ownerSeat = 1;
        state.properties.get(13)!.ownerSeat = 1;
        // Bot owns Yellow 26 (cost 260), safe isolated single after scanning 1, 11, 13, 21, 23!
        state.properties.get(26)!.ownerSeat = 1;
      });
      expect(botService.evaluateMonopolyBotAction(filteredCandidateView, 1)).toEqual({
        type: 'proposeTrade',
        trade: {
          fromSeat: 1,
          toSeat: 0,
          offerCash: 40, // round(240 * 1.25 - 260)
          offerProperties: [26],
          requestCash: 0,
          requestProperties: [24],
        },
      });

      // 4. Skips unowned missing deeds, improved missing deeds, and unaffordable buyouts
      const ineligibleTradeView = createTestView((state) => {
        state.currentRound = 8;
        state.activeSeat = 1;
        state.phase = 'action';
        state.players[1].position = 0;
        state.players[1].cash = 300; // expendableCash = 300 - (220 + 64) = 16
        // Orange missing 19 is unowned
        state.properties.get(16)!.ownerSeat = 1;
        state.properties.get(18)!.ownerSeat = 1;
        // Red missing 24 has houses > 0
        state.properties.get(21)!.ownerSeat = 1;
        state.properties.get(23)!.ownerSeat = 1;
        state.properties.get(24)!.ownerSeat = 0;
        state.properties.get(24)!.houses = 1;
        // Yellow missing 29 is owned by P0 (unimproved), but cash buyout (392) > expendableCash (16)
        state.properties.get(26)!.ownerSeat = 1;
        state.properties.get(27)!.ownerSeat = 1;
        state.properties.get(29)!.ownerSeat = 0;
      });
      expect(botService.evaluateMonopolyBotAction(ineligibleTradeView, 1)).toEqual({
        type: 'endTurn',
      });
    });

    it('handles distress liquidation for unimproved full monopolies and uneven house demolition', () => {
      const botService = createBot();

      // 1. Unimproved full monopoly (Step 2): owns both Brown (1 & 3) with 0 houses -> mortgages space 1
      const unimprovedMonopolyDistressView = createTestView((state) => {
        state.activeSeat = 1;
        state.phase = 'financialDistress';
        state.debtTarget = { creditorSeat: 0, amountOwed: 100 };
        state.players[1].cash = 10;
        state.properties.get(1)!.ownerSeat = 1;
        state.properties.get(3)!.ownerSeat = 1;
      });
      expect(botService.evaluateMonopolyBotAction(unimprovedMonopolyDistressView, 1)).toEqual({
        type: 'mortgageProperty',
        spaceIndex: 1,
      });

      // 2. Improved full monopoly with uneven houses (0, 1, 2 on Light Blue 6, 8, 9) -> skips Step 2 and sells from space 9 (max houses)
      const unevenHousesDistressView = createTestView((state) => {
        state.activeSeat = 1;
        state.phase = 'financialDistress';
        state.debtTarget = { creditorSeat: 0, amountOwed: 100 };
        state.players[1].cash = 10;
        state.properties.get(6)!.ownerSeat = 1;
        state.properties.get(6)!.houses = 0;
        state.properties.get(8)!.ownerSeat = 1;
        state.properties.get(8)!.houses = 1;
        state.properties.get(9)!.ownerSeat = 1;
        state.properties.get(9)!.houses = 2;
      });
      expect(botService.evaluateMonopolyBotAction(unevenHousesDistressView, 1)).toEqual({
        type: 'sellHouse',
        spaceIndex: 9,
      });
    });

    it('evaluates incoming trade responses for unaffordable cash requests and non-monopoly asset swaps', () => {
      const botService = createBot();

      // 1. Rejects immediately when requestCash exceeds bot.cash
      const unaffordableTradeView = createTestView((state) => {
        state.players[1].cash = 150;
        state.pendingTrade = {
          fromSeat: 0,
          toSeat: 1,
          offerCash: 0,
          offerProperties: [5],
          requestCash: 300,
          requestProperties: [],
        };
      });
      expect(botService.evaluateMonopolyBotAction(unaffordableTradeView, 1)).toEqual({
        type: 'rejectTrade',
      });

      // 2. Accepts non-monopoly property swap with positive net value (>= +15) and healthy reserve
      const favorableSwapView = createTestView((state) => {
        state.players[1].cash = 500;
        state.properties.get(5)!.ownerSeat = 0; // KL Sentral (200)
        state.properties.get(11)!.ownerSeat = 0; // George Town (140)
        state.properties.get(12)!.ownerSeat = 1; // TNB (150)
        state.properties.get(1)!.ownerSeat = 1; // A Famosa (60, P0 does not own 3)
        state.pendingTrade = {
          fromSeat: 0,
          toSeat: 1,
          offerCash: 0,
          offerProperties: [5, 11], // 340 value
          requestCash: 0,
          requestProperties: [12, 1], // 210 value -> +130 net delta
        };
      });
      expect(botService.evaluateMonopolyBotAction(favorableSwapView, 1)).toEqual({
        type: 'acceptTrade',
      });

      // 3. Rejects non-monopoly property swap with negative/low net value
      const unfavorableSwapView = createTestView((state) => {
        state.players[1].cash = 500;
        state.properties.get(6)!.ownerSeat = 0; // Kellie's Castle (100)
        state.properties.get(5)!.ownerSeat = 1; // KL Sentral (200)
        state.pendingTrade = {
          fromSeat: 0,
          toSeat: 1,
          offerCash: 0,
          offerProperties: [6], // 100
          requestCash: 0,
          requestProperties: [5], // 200 -> -100 net delta
        };
      });
      expect(botService.evaluateMonopolyBotAction(unfavorableSwapView, 1)).toEqual({
        type: 'rejectTrade',
      });
    });
  });
});

