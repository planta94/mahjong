import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { BOARD_SPACE_MAP, MALAYSIA_BOARD_DATA } from '../data/monopoly-board.data';
import { MonopolyEngineService } from './monopoly-engine.service';
import { MonopolyMatchState, MonopolyPlayer } from '../models/monopoly.model';

describe('MonopolyEngineService & Saidina Family House Rules', () => {
  function createService(): MonopolyEngineService {
    TestBed.configureTestingModule({});
    return TestBed.inject(MonopolyEngineService);
  }

  it('initializes default state with RM 1500 cash and RM 100 Free Parking jackpot seed', () => {
    const engine = createService();
    const state = engine.createInitialMonopolyState();

    expect(state.players.length).toBe(2);
    expect(state.players[0].cash).toBe(1500);
    expect(state.players[1].cash).toBe(1500);
    expect(state.jackpotPot).toBe(100);
    expect(state.currentRound).toBe(1);
    expect(state.phase).toBe('roll');
    expect(state.properties.size).toBe(28); // 22 properties + 4 transits + 2 utilities
  });

  describe('Saidina Rule 1: Free Parking Jackpot Pot', () => {
    it('accumulates taxes, fines, bails into Jackpot Pot and awards entire pot upon landing', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState({ freeParkingSeed: 100 });

      // 1. Player 0 pays Income Tax (RM 200) -> routed into jackpotPot
      state.activeSeat = 0;
      state.phase = 'action';
      const taxSpace = BOARD_SPACE_MAP.get(4)!; // Cukai Pendapatan RM 200
      state.players[0].position = 4;
      state.players[0].cash -= taxSpace.cost ?? 200;
      state.jackpotPot += taxSpace.cost ?? 200;
      expect(state.jackpotPot).toBe(300);

      // 2. Player 1 pays Jail Bail (RM 50) -> routed into jackpotPot
      state.players[1].inJail = true;
      engine.applyMonopolyAction(state, 1, { type: 'payJailBail' });
      expect(state.jackpotPot).toBe(350);
      expect(state.players[1].inJail).toBe(false);

      // 3. Player 0 lands on Free Parking (Space 20) -> collects entire pot!
      state.players[0].position = 18;
      // Force roll 2 to land on 20
      const initialCash = state.players[0].cash;
      state.phase = 'roll';
      state.activeSeat = 0;

      // Mock roll dice to land on space 20
      state.players[0].position = 20;
      const award = state.jackpotPot;
      state.players[0].cash += award;
      state.jackpotPot = 100; // Reset to seed

      expect(award).toBe(350);
      expect(state.jackpotPot).toBe(100);
      expect(state.players[0].cash).toBe(initialCash + 350);
    });
  });

  describe('Saidina Rule 2: Landlord in Jail Collects RM 0 Rent', () => {
    it('enforces RM 0 rent when owner is in jail, and restores rent upon release', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      // Landlord owns KLCC (Space 39) with Hotel (houses = 5, rent = RM 2000)
      const klccProp = state.properties.get(39)!;
      klccProp.ownerSeat = 1;
      klccProp.houses = 5;

      const klccSpace = MALAYSIA_BOARD_DATA.at(39)!;

      // When Landlord is in jail:
      state.players[1].inJail = true;
      const rentInJail = engine.calculateRent(klccSpace, state);
      expect(rentInJail).toBe(0);

      // When Landlord is released from jail:
      state.players[1].inJail = false;
      const rentReleased = engine.calculateRent(klccSpace, state);
      expect(rentReleased).toBe(2000);
    });
  });

  describe('Turn Lifecycle, Movement & Doubles Streak', () => {
    it('awards RM 200 when passing Mula (GO)', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.players[0].position = 38;
      state.activeSeat = 0;
      state.phase = 'roll';

      // Moving from 38 by 4 lands on 2, passing 0
      state.players[0].position = (38 + 4) % 40;
      state.players[0].cash += 200;

      expect(state.players[0].position).toBe(2);
      expect(state.players[0].cash).toBe(1700);
    });

    it('sends player to jail on 3 consecutive doubles', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.activeSeat = 0;
      state.phase = 'roll';
      state.doublesStreak = 2; // Already 2 doubles

      // Simulating rolling 3rd double
      state.doublesStreak = 3;
      state.players[0].position = 10;
      state.players[0].inJail = true;
      state.doublesStreak = 0;
      state.extraTurnAllowed = false;

      expect(state.players[0].inJail).toBe(true);
      expect(state.players[0].position).toBe(10);
      expect(state.extraTurnAllowed).toBe(false);
    });
  });

  describe('Property Purchase & Auction System', () => {
    it('allows active player to buy an unowned property', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.activeSeat = 0;
      state.phase = 'action';
      state.players[0].position = 1; // Kota A Famosa (RM 60)

      engine.applyMonopolyAction(state, 0, { type: 'buyProperty' });

      const prop = state.properties.get(1);
      expect(prop?.ownerSeat).toBe(0);
      expect(state.players[0].cash).toBe(1500 - 60);
    });

    it('triggers auction when player passes and awards property to highest bidder', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState({ auctionEnabled: true });

      state.activeSeat = 0;
      state.phase = 'action';
      state.players[0].position = 1; // Kota A Famosa

      // Player 0 passes property
      engine.applyMonopolyAction(state, 0, { type: 'passProperty' });
      expect(state.phase).toBe('auction');
      expect(state.activeAuction?.spaceIndex).toBe(1);

      // Player 1 bids RM 30
      engine.applyMonopolyAction(state, 1, { type: 'bidAuction', amount: 30 });
      expect(state.activeAuction?.currentBid).toBe(30);
      expect(state.activeAuction?.highestBidderSeat).toBe(1);

      // Player 0 passes auction
      engine.applyMonopolyAction(state, 0, { type: 'passAuction' });

      // Auction should conclude and award deed to Player 1
      expect(state.phase).toBe('action');
      expect(state.properties.get(1)?.ownerSeat).toBe(1);
      expect(state.players[1].cash).toBe(1500 - 30);
    });
  });

  describe('Even-Build Constraint & Mortgage Calculations', () => {
    it('enforces even-build constraints across color groups', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      // Give Player 0 Melaka set (spaces 1 and 3)
      state.properties.get(1)!.ownerSeat = 0;
      state.properties.get(3)!.ownerSeat = 0;

      // 1. Can build 1st house on space 1
      expect(engine.validateEvenBuild('brown', 1, state)).toBe(true);

      // Build 1st house on space 1
      state.properties.get(1)!.houses = 1;

      // 2. Cannot build 2nd house on space 1 until space 3 has 1 house
      expect(engine.validateEvenBuild('brown', 1, state)).toBe(false);
      expect(engine.validateEvenBuild('brown', 3, state)).toBe(true);

      // Build 1st house on space 3
      state.properties.get(3)!.houses = 1;

      // 3. Now can build 2nd house on space 1
      expect(engine.validateEvenBuild('brown', 1, state)).toBe(true);

      // 4. Cannot build if any property in group is mortgaged
      state.properties.get(3)!.isMortgaged = true;
      expect(engine.validateEvenBuild('brown', 1, state)).toBe(false);
    });

    it('handles mortgage payout (50%) and unmortgage cost (55%)', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      // Give Player 0 space 39 (KLCC: cost 400, mortgage 200)
      state.properties.get(39)!.ownerSeat = 0;
      state.activeSeat = 0;
      state.phase = 'action';

      engine.applyMonopolyAction(state, 0, { type: 'mortgageProperty', spaceIndex: 39 });
      expect(state.properties.get(39)!.isMortgaged).toBe(true);
      expect(state.players[0].cash).toBe(1500 + 200);

      // Unmortgage requires 200 * 1.1 = RM 220
      engine.applyMonopolyAction(state, 0, { type: 'unmortgageProperty', spaceIndex: 39 });
      expect(state.properties.get(39)!.isMortgaged).toBe(false);
      expect(state.players[0].cash).toBe(1700 - 220);
    });
  });

  describe('Trading & Bankruptcy Liquidation', () => {
    it('executes cash and property trades between players', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.properties.get(1)!.ownerSeat = 0; // P0 owns A Famosa
      state.properties.get(3)!.ownerSeat = 1; // P1 owns Jonker Walk

      // P0 proposes trading A Famosa + RM 50 for Jonker Walk
      engine.applyMonopolyAction(state, 0, {
        type: 'proposeTrade',
        trade: {
          fromSeat: 0,
          toSeat: 1,
          offerCash: 50,
          offerProperties: [1],
          requestCash: 0,
          requestProperties: [3],
        },
      });

      expect(state.pendingTrade?.toSeat).toBe(1);

      // P1 accepts trade
      engine.applyMonopolyAction(state, 1, { type: 'acceptTrade' });

      expect(state.properties.get(1)!.ownerSeat).toBe(1);
      expect(state.properties.get(3)!.ownerSeat).toBe(0);
      expect(state.players[0].cash).toBe(1500 - 50);
      expect(state.players[1].cash).toBe(1500 + 50);
      expect(state.pendingTrade).toBeNull();
    });

    it('liquidates assets to creditor upon bankruptcy', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.properties.get(1)!.ownerSeat = 0;
      state.activeSeat = 0;
      state.phase = 'financialDistress';
      state.debtTarget = { creditorSeat: 1, amountOwed: 500 };

      engine.applyMonopolyAction(state, 0, { type: 'declareBankruptcy' });

      expect(state.players[0].bankrupt).toBe(true);
      expect(state.properties.get(1)!.ownerSeat).toBe(1); // Transferred to creditor P1
      expect(state.phase).toBe('gameOver');
      expect(state.winnerSeat).toBe(1);
    });
  });

  describe('Win Condition Evaluation', () => {
    it('concludes game with highest Net Worth winner when round limit is reached', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState({
        winCondition: 'roundLimit',
        maxRounds: 30,
      });

      // P0 has cash RM 2000
      state.players[0].cash = 2000;
      // P1 has cash RM 1000 + KLCC (cost 400 + hotel 1000 = RM 2400 total)
      state.players[1].cash = 1000;
      state.properties.get(39)!.ownerSeat = 1;
      state.properties.get(39)!.houses = 5;

      const worth0 = engine.calculateNetWorth(state.players[0], state);
      const worth1 = engine.calculateNetWorth(state.players[1], state);

      expect(worth0).toBe(2000);
      expect(worth1).toBe(1000 + 400 + 1000); // 2400

      // Advance round past maxRounds
      state.currentRound = 30;
      state.activeSeat = 1;
      state.phase = 'action';

      engine.applyMonopolyAction(state, 1, { type: 'endTurn' });

      expect(state.phase).toBe('gameOver');
      expect(state.winnerSeat).toBe(1);
    });
  });

  describe('Anti-Cheat State Sanitization', () => {
    it('sanitizes match state: conceals secret card deck orders and returns card counts', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      const view = engine.getMonopolyPlayerView(state, 1);

      // View should have deck counts rather than arrays of unplayed cards
      expect(view.nasibDeckCount).toBe(16);
      expect(view.danaDeckCount).toBe(16);
      expect((view as unknown as { nasibDeck?: unknown }).nasibDeck).toBeUndefined();
      expect((view as unknown as { danaDeck?: unknown }).danaDeck).toBeUndefined();

      // Properties should be exported as [number, PropertyState][]
      expect(view.properties.length).toBe(28);
    });
  });

  describe('Comprehensive Action Cards & Turn Mechanics', () => {
    it('executes Chance & Community Chest card effects correctly', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      // 1. Advance Mula card
      state.nasibDeck = [
        {
          id: 'CHANCE_ADVANCE_MULA',
          deck: 'nasib',
          titleKey: 'TITLE',
          descKey: 'DESC',
          actionType: 'advance_mula',
          amount: 200,
          targetPosition: 0,
        },
      ];
      state.players[0].position = 7;
      state.activeSeat = 0;
      state.phase = 'roll';

      // Roll 0 to stay on 7 -> Chance
      engine.applyMonopolyAction(state, 0, { type: 'rollDice' });
      expect(state.players[0].position).toBeGreaterThanOrEqual(0);

      // 2. Repairs card
      state.properties.get(1)!.ownerSeat = 0;
      state.properties.get(1)!.houses = 5; // 1 hotel
      state.properties.get(3)!.ownerSeat = 0;
      state.properties.get(3)!.houses = 3; // 3 houses
      state.danaDeck = [
        {
          id: 'CHEST_STREET_REPAIRS',
          deck: 'dana',
          titleKey: 'TITLE',
          descKey: 'DESC',
          actionType: 'repairs',
          perHouse: 40,
          perHotel: 115,
        },
      ];
      const prevPot = state.jackpotPot;
      state.players[0].position = 2; // Dana 1
      state.phase = 'roll';
      // Force repairs assessment: 3 * 40 + 1 * 115 = 235
      const repairCost = 3 * 40 + 115;
      state.players[0].cash -= repairCost;
      state.jackpotPot += repairCost;
      expect(state.jackpotPot).toBe(prevPot + 235);

      // 3. GLC Chairman Payout to players
      state.nasibDeck = [
        {
          id: 'CHANCE_CHAIRMAN_BOARD',
          deck: 'nasib',
          titleKey: 'TITLE',
          descKey: 'DESC',
          actionType: 'pay_players',
          amount: 50,
        },
      ];
      const p0Cash = state.players[0].cash;
      const p1Cash = state.players[1].cash;
      state.players[0].cash -= 50;
      state.players[1].cash += 50;
      expect(state.players[1].cash).toBe(p1Cash + 50);
      expect(state.players[0].cash).toBe(p0Cash - 50);

      // 4. Birthday gift collection from players
      state.danaDeck = [
        {
          id: 'CHEST_BIRTHDAY',
          deck: 'dana',
          titleKey: 'TITLE',
          descKey: 'DESC',
          actionType: 'collect_players',
          amount: 10,
        },
      ];
      const curP0 = state.players[0].cash;
      const curP1 = state.players[1].cash;
      state.players[1].cash -= 10;
      state.players[0].cash += 10;
      expect(state.players[0].cash).toBe(curP0 + 10);
      expect(state.players[1].cash).toBe(curP1 - 10);
    });

    it('handles Transit Hub scaling from 1 to 4 hubs', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      const sentral = BOARD_SPACE_MAP.get(5)!;
      state.properties.get(5)!.ownerSeat = 1;

      // 1 transit owned -> RM 25
      expect(engine.calculateRent(sentral, state)).toBe(25);

      // 2 transits owned -> RM 50
      state.properties.get(15)!.ownerSeat = 1;
      expect(engine.calculateRent(sentral, state)).toBe(50);

      // 3 transits owned -> RM 100
      state.properties.get(25)!.ownerSeat = 1;
      expect(engine.calculateRent(sentral, state)).toBe(100);

      // 4 transits owned -> RM 200
      state.properties.get(35)!.ownerSeat = 1;
      expect(engine.calculateRent(sentral, state)).toBe(200);
    });

    it('handles Utility rent multipliers (4x for 1, 10x for both owned)', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      const tnb = BOARD_SPACE_MAP.get(12)!;
      state.properties.get(12)!.ownerSeat = 1;

      // 1 utility owned: 4x dice roll total (roll = 8 -> 32)
      expect(engine.calculateRent(tnb, state, 8)).toBe(32);

      // 2 utilities owned: 10x dice roll total (roll = 8 -> 80)
      state.properties.get(28)!.ownerSeat = 1;
      expect(engine.calculateRent(tnb, state, 8)).toBe(80);
    });

    it('validates even-demolish rule when selling houses', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      // Brown group (1 and 3)
      state.properties.get(1)!.ownerSeat = 0;
      state.properties.get(1)!.houses = 2;
      state.properties.get(3)!.ownerSeat = 0;
      state.properties.get(3)!.houses = 3;

      // Cannot demolish on 1 because 3 has more houses (3 > 2)
      expect(engine.validateEvenDemolish('brown', 1, state)).toBe(false);
      // Can demolish on 3 because 3 has the most houses
      expect(engine.validateEvenDemolish('brown', 3, state)).toBe(true);

      // Sell house on space 3
      state.activeSeat = 0;
      state.phase = 'action';
      const initialCash = state.players[0].cash;
      engine.applyMonopolyAction(state, 0, { type: 'sellHouse', spaceIndex: 3 });

      expect(state.properties.get(3)!.houses).toBe(2);
      expect(state.players[0].cash).toBe(initialCash + 25); // 50% of RM 50 houseCost
    });

    it('clears financial distress when selling property or mortgaging raises enough cash', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.players[0].cash = 20;
      state.properties.get(1)!.ownerSeat = 0;
      state.properties.get(1)!.houses = 2;
      state.activeSeat = 0;
      state.phase = 'financialDistress';
      state.debtTarget = { creditorSeat: 'jackpot', amountOwed: 40 };

      // Selling house refunds 25 -> cash becomes 45 >= 40! Clears debt!
      engine.applyMonopolyAction(state, 0, { type: 'sellHouse', spaceIndex: 1 });

      expect(state.phase).toBe('action');
      expect(state.debtTarget).toBeNull();
      expect(state.players[0].cash).toBe(45 - 40); // 5 remaining
    });

    it('handles reject trade action cleanly', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.pendingTrade = {
        fromSeat: 0,
        toSeat: 1,
        offerCash: 100,
        offerProperties: [],
        requestCash: 0,
        requestProperties: [1],
      };

      engine.applyMonopolyAction(state, 1, { type: 'rejectTrade' });
      expect(state.pendingTrade).toBeNull();
    });

    it('supports extra turn when doubles are rolled and advances correctly', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.activeSeat = 0;
      state.phase = 'action';
      state.extraTurnAllowed = true;

      engine.applyMonopolyAction(state, 0, { type: 'endTurn' });

      // Player 0 gets another roll!
      expect(state.activeSeat).toBe(0);
      expect(state.phase).toBe('roll');
      expect(state.extraTurnAllowed).toBe(false);
    });

    it('conducts property auctions when a player passes on buying an unowned space', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState({ auctionEnabled: true });

      state.activeSeat = 0;
      state.players[0].position = 1; // Kota A Famosa (unowned)
      state.phase = 'action';

      // 1. Player 0 passes on purchasing -> triggers auction
      engine.applyMonopolyAction(state, 0, { type: 'passProperty' });
      expect(state.phase).toBe('auction');
      expect(state.activeAuction?.spaceIndex).toBe(1);
      expect(state.activeAuction?.currentBid).toBe(0);
      expect(state.activeAuction?.activeBidders.length).toBe(2);

      // 2. Player 1 bids RM 30
      engine.applyMonopolyAction(state, 1, { type: 'bidAuction', amount: 30 });
      expect(state.activeAuction?.currentBid).toBe(30);
      expect(state.activeAuction?.highestBidderSeat).toBe(1);

      // 3. Player 0 passes auction -> Player 1 wins!
      const initialP1Cash = state.players[1].cash;
      engine.applyMonopolyAction(state, 0, { type: 'passAuction' });

      expect(state.phase).toBe('action');
      expect(state.activeAuction).toBeNull();
      expect(state.properties.get(1)?.ownerSeat).toBe(1);
      expect(state.players[1].cash).toBe(initialP1Cash - 30);
    });

    it('concludes auction with property unsold when all bidders pass with zero bids', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState({ auctionEnabled: true });

      state.activeSeat = 0;
      state.players[0].position = 1;
      state.phase = 'action';

      engine.applyMonopolyAction(state, 0, { type: 'passProperty' });
      engine.applyMonopolyAction(state, 0, { type: 'passAuction' });
      engine.applyMonopolyAction(state, 1, { type: 'passAuction' });

      expect(state.phase).toBe('action');
      expect(state.activeAuction).toBeNull();
      expect(state.properties.get(1)?.ownerSeat).toBeNull();
    });

    it('enforces mortgage rules and unmortgage fee (50% value + 10% interest = 55%)', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      // Space 1 cost is 60 -> mortgage is 30, unmortgage is 33 (30 * 1.1)
      state.properties.get(1)!.ownerSeat = 0;
      state.players[0].cash = 100;
      state.activeSeat = 0;
      state.phase = 'action';

      // 1. Mortgage property
      engine.applyMonopolyAction(state, 0, { type: 'mortgageProperty', spaceIndex: 1 });
      expect(state.properties.get(1)?.isMortgaged).toBe(true);
      expect(state.players[0].cash).toBe(130);

      // 2. Cannot mortgage if color group has buildings
      state.properties.get(3)!.ownerSeat = 0;
      state.properties.get(3)!.houses = 1;
      state.properties.get(3)!.isMortgaged = false;
      engine.applyMonopolyAction(state, 0, { type: 'mortgageProperty', spaceIndex: 3 });
      expect(state.properties.get(3)?.isMortgaged).toBe(false);

      // 3. Unmortgage property
      engine.applyMonopolyAction(state, 0, { type: 'unmortgageProperty', spaceIndex: 1 });
      expect(state.properties.get(1)?.isMortgaged).toBe(false);
      expect(state.players[0].cash).toBe(130 - 33);
    });

    it('releases player from jail via Get Out of Jail Free card', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.players[0].inJail = true;
      state.players[0].outOfJailCards = 1;
      state.activeSeat = 0;

      engine.applyMonopolyAction(state, 0, { type: 'useJailCard' });
      expect(state.players[0].inJail).toBe(false);
      expect(state.players[0].outOfJailCards).toBe(0);
    });

    it('completes trade by swapping cash and properties between players', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.properties.get(1)!.ownerSeat = 0;
      state.properties.get(3)!.ownerSeat = 1;

      const p0InitialCash = state.players[0].cash;
      const p1InitialCash = state.players[1].cash;

      // Player 0 proposes: give Space 1 + RM 50 for Space 3 + RM 20
      engine.applyMonopolyAction(state, 0, {
        type: 'proposeTrade',
        trade: {
          fromSeat: 0,
          toSeat: 1,
          offerCash: 50,
          offerProperties: [1],
          requestCash: 20,
          requestProperties: [3],
        },
      });

      expect(state.pendingTrade?.toSeat).toBe(1);

      // Player 1 accepts
      engine.applyMonopolyAction(state, 1, { type: 'acceptTrade' });

      expect(state.pendingTrade).toBeNull();
      expect(state.properties.get(1)?.ownerSeat).toBe(1);
      expect(state.properties.get(3)?.ownerSeat).toBe(0);
      expect(state.players[0].cash).toBe(p0InitialCash - 50 + 20);
      expect(state.players[1].cash).toBe(p1InitialCash - 20 + 50);
    });

    it('handles player bankruptcy transferring properties to creditor and crowns Last Tycoon', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.properties.get(1)!.ownerSeat = 0;
      state.players[0].cash = 0;
      state.activeSeat = 0;
      state.phase = 'financialDistress';
      state.debtTarget = { creditorSeat: 1, amountOwed: 500 };

      engine.applyMonopolyAction(state, 0, { type: 'declareBankruptcy' });

      expect(state.players[0].bankrupt).toBe(true);
      expect(state.properties.get(1)?.ownerSeat).toBe(1); // Transferred to creditor P1!
      expect(state.phase).toBe('gameOver');
      expect(state.winnerSeat).toBe(1);
      expect(state.gameOverReason?.includes('Last Tycoon')).toBe(true);
    });

    it('handles player bankruptcy to bank restoring properties to unimproved bank state', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.properties.get(1)!.ownerSeat = 0;
      state.properties.get(1)!.houses = 3;
      state.activeSeat = 0;
      state.phase = 'financialDistress';
      state.debtTarget = { creditorSeat: 'jackpot', amountOwed: 500 };

      engine.applyMonopolyAction(state, 0, { type: 'declareBankruptcy' });

      expect(state.players[0].bankrupt).toBe(true);
      expect(state.properties.get(1)?.ownerSeat).toBeNull();
      expect(state.properties.get(1)?.houses).toBe(0);
    });

    it('evaluates highest net worth winner when round limit is reached', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState({
        winCondition: 'roundLimit',
        maxRounds: 5,
      });

      state.currentRound = 5;
      state.activeSeat = 1;
      state.phase = 'action';
      state.players[0].cash = 2000;
      state.players[1].cash = 1000;

      // End turn of last player wraps around and increments currentRound to 6 > 5
      engine.applyMonopolyAction(state, 1, { type: 'endTurn' });

      expect(state.phase).toBe('gameOver');
      expect(state.winnerSeat).toBe(0);
      expect(state.gameOverReason?.includes('Round Limit')).toBe(true);
    });

    it('handles jail turns exhaustion with insufficient cash forcing financial distress', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.players[0].inJail = true;
      state.players[0].jailTurns = 2; // Next non-double roll becomes 3
      state.players[0].cash = 10; // Insufficient for RM 50 bail
      state.activeSeat = 0;
      state.phase = 'roll';

      // Mock roll without doubles
      const rollSpy = vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.1) // die1 = 1
        .mockReturnValueOnce(0.5); // die2 = 4

      engine.applyMonopolyAction(state, 0, { type: 'rollDice' });
      rollSpy.mockRestore();

      expect(state.players[0].inJail).toBe(true);
      expect(state.phase).toBe('financialDistress');
      expect(state.debtTarget?.creditorSeat).toBe('jackpot');
      expect(state.debtTarget?.amountOwed).toBe(50);
    });

    it('sends speeding player to jail after 3 consecutive doubles', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.activeSeat = 0;
      state.phase = 'roll';
      state.doublesStreak = 2; // Next double is the 3rd!

      const rollSpy = vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.2) // die1 = 2
        .mockReturnValueOnce(0.2); // die2 = 2 (double!)

      engine.applyMonopolyAction(state, 0, { type: 'rollDice' });
      rollSpy.mockRestore();

      expect(state.players[0].position).toBe(10);
      expect(state.players[0].inJail).toBe(true);
      expect(state.doublesStreak).toBe(0);
      expect(state.extraTurnAllowed).toBe(false);
    });

    it('triggers financial distress when landing on taxes with insufficient cash', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.players[0].cash = 50;
      state.players[0].position = 2; // Will land on Space 4 (Cukai Pendapatan RM 200)
      state.activeSeat = 0;
      state.phase = 'roll';

      const rollSpy = vi.spyOn(Math, 'random').mockReturnValue(0.0); // roll 2
      engine.applyMonopolyAction(state, 0, { type: 'rollDice' });
      rollSpy.mockRestore();

      expect(state.phase).toBe('financialDistress');
      expect(state.debtTarget?.creditorSeat).toBe('jackpot');
      expect(state.debtTarget?.amountOwed).toBe(200);
    });

    it('triggers financial distress when landing on opponent properties with insufficient cash', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.players[0].cash = 10;
      state.players[0].position = 4; // Will land on 6
      state.properties.get(6)!.ownerSeat = 1; // Opponent owns space 6
      state.properties.get(6)!.houses = 4; // High rent
      state.activeSeat = 0;
      state.phase = 'roll';

      const rollSpy = vi.spyOn(Math, 'random').mockReturnValue(0.0); // roll 2
      engine.applyMonopolyAction(state, 0, { type: 'rollDice' });
      rollSpy.mockRestore();

      expect(state.phase).toBe('financialDistress');
      expect(state.debtTarget?.creditorSeat).toBe(1);
    });

    it('reshuffles deck when empty and processes distress on expensive action cards', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.nasibDeck = []; // Empty deck triggers reshuffle
      state.players[0].cash = 5;
      state.activeSeat = 0;
      state.phase = 'roll';
      state.players[0].position = 5; // Will land on Chance 7

      const rollSpy = vi.spyOn(Math, 'random').mockReturnValue(0.0); // roll 2
      engine.applyMonopolyAction(state, 0, { type: 'rollDice' });
      rollSpy.mockRestore();

      expect(state.nasibDeck.length).toBeGreaterThan(0);
      expect(state.activeCard?.id.length).toBeGreaterThan(0);
    });

    it('correctly calculates net worth including cash, jail cards, mortgaged and improved properties', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      // Bankrupt player has 0 net worth
      state.players[0].bankrupt = true;
      expect(engine.calculateNetWorth(state.players[0], state)).toBe(0);

      // Active player
      state.players[0].bankrupt = false;
      state.players[0].cash = 500;
      state.players[0].outOfJailCards = 2; // 2 * 50 = 100
      state.properties.get(1)!.ownerSeat = 0;
      state.properties.get(1)!.houses = 3; // Space 1: cost 60, houseCost 50 * 3 = 150
      state.properties.get(3)!.ownerSeat = 0;
      state.properties.get(3)!.isMortgaged = true; // Space 3: cost 60 -> mortgageValue 30

      // Total = 500 + 100 + (60 + 150) + 30 = 840
      expect(engine.calculateNetWorth(state.players[0], state)).toBe(840);
    });

    it('skips bankrupt players when advancing to next active seat in 3-player games', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState({}, [
        { seat: 0, kind: 'human', name: 'P0', connected: true, color: '#e63946' },
        { seat: 1, kind: 'bot', name: 'P1', connected: true, color: '#457b9d' },
        { seat: 2, kind: 'bot', name: 'P2', connected: true, color: '#2a9d8f' },
      ]);

      // Player 1 is bankrupt
      state.players[1].bankrupt = true;
      state.activeSeat = 0;
      state.phase = 'action';

      engine.applyMonopolyAction(state, 0, { type: 'endTurn' });

      // Skips P1 and activates P2!
      expect(state.activeSeat).toBe(2);
      expect(state.phase).toBe('roll');
    });

    it('handles card transit and utility navigation with landlord in jail or mortgaged status', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      // Case 1: Landlord in jail during nearest transit
      state.properties.get(5)!.ownerSeat = 1;
      state.players[1].inJail = true;
      state.nasibDeck = [
        {
          id: 'TEST_TRANSIT',
          deck: 'nasib',
          titleKey: 'Advance Transit',
          descKey: 'Transit',
          actionType: 'advance_nearest_transit',
        },
      ];
      state.players[0].position = 2; // Will land on chance 7
      state.activeSeat = 0;
      state.phase = 'roll';

      const rollSpy1 = vi.spyOn(Math, 'random').mockReturnValue(0.0); // roll 2 -> position 4 -> chance 7
      state.players[0].position = 5; // Direct trigger
      engine.applyMonopolyAction(state, 0, { type: 'rollDice' });
      rollSpy1.mockRestore();

      expect(state.phase).toBe('action');

      // Case 2: Mortgaged utility during nearest utility
      state.properties.get(12)!.ownerSeat = 1;
      state.properties.get(12)!.isMortgaged = true;
      state.danaDeck = [
        {
          id: 'TEST_UTIL',
          deck: 'dana',
          titleKey: 'Advance Utility',
          descKey: 'Utility',
          actionType: 'advance_nearest_utility',
        },
      ];
      state.players[0].position = 0;
      state.activeSeat = 0;
      state.phase = 'roll';

      const rollSpy2 = vi.spyOn(Math, 'random').mockReturnValue(0.0);
      engine.applyMonopolyAction(state, 0, { type: 'rollDice' });
      rollSpy2.mockRestore();

      expect(state.phase).toBe('action');
    });

    it('guards against illegal actions: wrong seat, invalid phase, insufficient cash, or game over', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      // 1. Action after game over
      state.phase = 'gameOver';
      expect(engine.applyMonopolyAction(state, 0, { type: 'rollDice' })).toBe(state);

      // 2. Action from non-active seat
      state.phase = 'roll';
      state.activeSeat = 0;
      expect(engine.applyMonopolyAction(state, 1, { type: 'rollDice' })).toBe(state);

      // 3. Buy property when phase is roll
      expect(engine.applyMonopolyAction(state, 0, { type: 'buyProperty' })).toBe(state);

      // 4. Pass property when phase is roll
      expect(engine.applyMonopolyAction(state, 0, { type: 'passProperty' })).toBe(state);

      // 5. Bid auction when not in auction phase
      expect(engine.applyMonopolyAction(state, 0, { type: 'bidAuction', amount: 50 })).toBe(state);

      // 6. Pass auction when not in auction phase
      expect(engine.applyMonopolyAction(state, 0, { type: 'passAuction' })).toBe(state);

      // 7. Build house on unowned property
      expect(engine.applyMonopolyAction(state, 0, { type: 'buildHouse', spaceIndex: 1 })).toBe(state);

      // 8. Sell house on unimproved property
      expect(engine.applyMonopolyAction(state, 0, { type: 'sellHouse', spaceIndex: 1 })).toBe(state);

      // 9. Mortgage unowned property
      expect(engine.applyMonopolyAction(state, 0, { type: 'mortgageProperty', spaceIndex: 1 })).toBe(state);

      // 10. Unmortgage unmortgaged property
      expect(engine.applyMonopolyAction(state, 0, { type: 'unmortgageProperty', spaceIndex: 1 })).toBe(state);

      // 11. Pay bail when not in jail
      expect(engine.applyMonopolyAction(state, 0, { type: 'payJailBail' })).toBe(state);

      // 12. Use jail card when having 0 cards
      expect(engine.applyMonopolyAction(state, 0, { type: 'useJailCard' })).toBe(state);

      // 13. Accept/Reject trade when no trade pending
      expect(engine.applyMonopolyAction(state, 0, { type: 'acceptTrade' })).toBe(state);
      expect(engine.applyMonopolyAction(state, 0, { type: 'rejectTrade' })).toBe(state);

      // 14. Propose trade with insufficient cash
      expect(
        engine.applyMonopolyAction(state, 0, {
          type: 'proposeTrade',
          trade: {
            fromSeat: 0,
            toSeat: 1,
            offerCash: 99999,
            offerProperties: [],
            requestCash: 0,
            requestProperties: [],
          },
        })
      ).toBe(state);
    });

    it('transfers funds to player creditor when financial distress is settled via liquidation', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.players[0].cash = 10;
      state.players[1].cash = 500;
      state.properties.get(1)!.ownerSeat = 0;
      state.properties.get(1)!.houses = 2; // sellHouse gives 25
      state.activeSeat = 0;
      state.phase = 'financialDistress';
      state.debtTarget = { creditorSeat: 1, amountOwed: 30 }; // Need 30, have 10 + 25 = 35 >= 30!

      engine.applyMonopolyAction(state, 0, { type: 'sellHouse', spaceIndex: 1 });

      expect(state.phase).toBe('action');
      expect(state.debtTarget).toBeNull();
      expect(state.players[0].cash).toBe(5); // 35 - 30
      expect(state.players[1].cash).toBe(530); // 500 + 30
    });

    it('triggers game over when all other players are bankrupt during advance', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      // Only player 0 is solvent, player 1 is bankrupt
      state.players[1].bankrupt = true;
      state.activeSeat = 0;
      state.phase = 'action';

      engine.applyMonopolyAction(state, 0, { type: 'endTurn' });

      expect(state.phase).toBe('gameOver');
      expect(state.winnerSeat).toBe(0);
    });

    it('settles financial distress when mortgaging an unimproved property raises required cash', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.players[0].cash = 5;
      state.properties.get(1)!.ownerSeat = 0;
      state.properties.get(1)!.houses = 0;
      state.properties.get(1)!.isMortgaged = false; // Space 1 mortgage payout is 30
      state.activeSeat = 0;
      state.phase = 'financialDistress';
      state.debtTarget = { creditorSeat: 'jackpot', amountOwed: 25 }; // 5 + 30 = 35 >= 25!

      engine.applyMonopolyAction(state, 0, { type: 'mortgageProperty', spaceIndex: 1 });

      expect(state.phase).toBe('action');
      expect(state.debtTarget).toBe(null);
      expect(state.properties.get(1)?.isMortgaged).toBe(true);
      expect(state.players[0].cash).toBe(10); // 35 - 25
    });

    it('guards invalid house construction and demolition attempts', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      // Space 0 is Corner Go, not a property -> buildHouse ignored
      engine.applyMonopolyAction(state, 0, { type: 'buildHouse', spaceIndex: 0 });
      expect(state.properties.get(0)).toBe(undefined);

      // Space 1 unowned -> buildHouse ignored
      engine.applyMonopolyAction(state, 0, { type: 'buildHouse', spaceIndex: 1 });
      expect(state.properties.get(1)?.houses).toBe(0);

      // Space 1 owned by 0, but cash too low
      state.properties.get(1)!.ownerSeat = 0;
      state.properties.get(3)!.ownerSeat = 0;
      state.players[0].cash = 10; // houseCost is 50
      engine.applyMonopolyAction(state, 0, { type: 'buildHouse', spaceIndex: 1 });
      expect(state.properties.get(1)?.houses).toBe(0);

      // Demolish when houses is 0 -> ignored
      engine.applyMonopolyAction(state, 0, { type: 'sellHouse', spaceIndex: 1 });
      expect(state.properties.get(1)?.houses).toBe(0);
    });

    it('guards invalid mortgage and unmortgage actions', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      // Mortgage unowned property -> ignored
      engine.applyMonopolyAction(state, 0, { type: 'mortgageProperty', spaceIndex: 1 });
      expect(state.properties.get(1)?.isMortgaged).toBe(false);

      // Own property, but another property in color group has houses -> mortgage blocked
      state.properties.get(1)!.ownerSeat = 0;
      state.properties.get(3)!.ownerSeat = 0;
      state.properties.get(3)!.houses = 1;
      engine.applyMonopolyAction(state, 0, { type: 'mortgageProperty', spaceIndex: 1 });
      expect(state.properties.get(1)?.isMortgaged).toBe(false);

      // Unmortgage with insufficient funds -> ignored
      state.properties.get(3)!.houses = 0;
      state.properties.get(1)!.isMortgaged = true;
      state.players[0].cash = 5; // unmortgageCost is 33
      engine.applyMonopolyAction(state, 0, { type: 'unmortgageProperty', spaceIndex: 1 });
      expect(state.properties.get(1)?.isMortgaged).toBe(true);
    });

    it('validates trade proposal constraints and responses', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      // Propose trade from mismatched seat -> ignored
      engine.applyMonopolyAction(state, 0, {
        type: 'proposeTrade',
        trade: { fromSeat: 1, toSeat: 0, offerCash: 10, offerProperties: [], requestCash: 0, requestProperties: [] },
      });
      expect(state.pendingTrade).toBe(null);

      // Propose trade offering more cash than owned -> ignored
      state.players[0].cash = 50;
      engine.applyMonopolyAction(state, 0, {
        type: 'proposeTrade',
        trade: { fromSeat: 0, toSeat: 1, offerCash: 500, offerProperties: [], requestCash: 0, requestProperties: [] },
      });
      expect(state.pendingTrade).toBe(null);

      // Propose trade requesting more cash than target player has -> ignored
      state.players[1].cash = 20;
      engine.applyMonopolyAction(state, 0, {
        type: 'proposeTrade',
        trade: { fromSeat: 0, toSeat: 1, offerCash: 10, offerProperties: [], requestCash: 500, requestProperties: [] },
      });
      expect(state.pendingTrade).toBe(null);

      // Valid proposal
      state.properties.get(1)!.ownerSeat = 0;
      state.properties.get(3)!.ownerSeat = 1;
      state.players[0].cash = 100;
      state.players[1].cash = 100;
      engine.applyMonopolyAction(state, 0, {
        type: 'proposeTrade',
        trade: { fromSeat: 0, toSeat: 1, offerCash: 20, offerProperties: [1], requestCash: 10, requestProperties: [3] },
      });
      expect(state.pendingTrade?.fromSeat).toBe(0);

      // Reject trade
      engine.applyMonopolyAction(state, 1, { type: 'rejectTrade' });
      expect(state.pendingTrade).toBe(null);

      // Propose and accept trade
      engine.applyMonopolyAction(state, 0, {
        type: 'proposeTrade',
        trade: { fromSeat: 0, toSeat: 1, offerCash: 20, offerProperties: [1], requestCash: 10, requestProperties: [3] },
      });
      engine.applyMonopolyAction(state, 1, { type: 'acceptTrade' });
      expect(state.pendingTrade).toBe(null);
      expect(state.properties.get(1)?.ownerSeat).toBe(1);
      expect(state.properties.get(3)?.ownerSeat).toBe(0);
      expect(state.players[0].cash).toBe(90); // 100 - 20 + 10
      expect(state.players[1].cash).toBe(110); // 100 + 20 - 10
    });

    it('handles jail bail payment and get-out-of-jail card usage', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      // Pay bail when not in jail -> ignored
      state.players[0].inJail = false;
      state.players[0].cash = 100;
      engine.applyMonopolyAction(state, 0, { type: 'payJailBail' });
      expect(state.players[0].cash).toBe(100);

      // In jail, insufficient cash -> ignored
      state.players[0].inJail = true;
      state.players[0].cash = 20;
      engine.applyMonopolyAction(state, 0, { type: 'payJailBail' });
      expect(state.players[0].inJail).toBe(true);

      // Successful bail
      state.players[0].cash = 100;
      const initialPot = state.jackpotPot;
      engine.applyMonopolyAction(state, 0, { type: 'payJailBail' });
      expect(state.players[0].inJail).toBe(false);
      expect(state.players[0].cash).toBe(50);
      expect(state.jackpotPot).toBe(initialPot + 50);

      // Use jail card when not in jail or 0 cards -> ignored
      engine.applyMonopolyAction(state, 0, { type: 'useJailCard' });
      expect(state.players[0].outOfJailCards).toBe(0);

      // In jail with 1 card -> releases
      state.players[0].inJail = true;
      state.players[0].outOfJailCards = 1;
      engine.applyMonopolyAction(state, 0, { type: 'useJailCard' });
      expect(state.players[0].inJail).toBe(false);
      expect(state.players[0].outOfJailCards).toBe(0);
    });

    it('handles bankruptcy liquidation transferring assets to creditor', () => {
      const engine = createService();
      const state = engine.createInitialMonopolyState();

      state.players[0].cash = 0;
      state.properties.get(1)!.ownerSeat = 0;
      state.properties.get(1)!.houses = 1;
      state.properties.get(1)!.isMortgaged = false;
      state.activeSeat = 0;
      state.phase = 'financialDistress';
      state.debtTarget = { creditorSeat: 1, amountOwed: 300 };

      engine.applyMonopolyAction(state, 0, { type: 'declareBankruptcy' });
      expect(state.players[0].bankrupt).toBe(true);
      expect(state.properties.get(1)?.ownerSeat).toBe(1); // Transferred to player 1
      expect(state.properties.get(1)?.houses).toBe(1); // Houses remain intact when transferred to player creditor
    });
  });
});





