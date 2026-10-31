import { Injectable } from '@angular/core';
import {
  MALAYSIA_BOARD_DATA,
  BOARD_SPACE_MAP,
  getNearestTransitIndex,
  getNearestUtilityIndex,
} from '../data/monopoly-board.data';
import { DANA_CARDS, NASIB_CARDS, shuffleCards } from '../data/monopoly-cards.data';
import {
  BoardSpace,
  ColorGroup,
  DEFAULT_MONOPOLY_SETTINGS,
  MONOPOLY_PLAYER_COLORS,
  MonopolyAction,
  MonopolyLobbySettings,
  MonopolyMatchState,
  MonopolyPlayer,
  MonopolyPlayerView,
  MonopolySeat,
  PropertyState,
  TradeProposal,
} from '../models/monopoly.model';

@Injectable({
  providedIn: 'root',
})
export class MonopolyEngineService {
  createInitialMonopolyState(
    settings: Partial<MonopolyLobbySettings> = {},
    seats: MonopolySeat[] = []
  ): MonopolyMatchState {
    const fullSettings: MonopolyLobbySettings = {
      ...DEFAULT_MONOPOLY_SETTINGS,
      ...settings,
    };

    const activeSeats = seats.filter((s) => s.kind !== 'open');
    const players: MonopolyPlayer[] = (
      activeSeats.length >= 2
        ? activeSeats
        : [
            { seat: 0, kind: 'human', name: 'Player 1', connected: true, color: MONOPOLY_PLAYER_COLORS[0] },
            { seat: 1, kind: 'bot', name: 'KL Tycoon (Bot)', connected: true, color: MONOPOLY_PLAYER_COLORS[1] },
          ]
    ).map((s, idx) => ({
      seat: s.seat ?? idx,
      name: s.name || `Player ${idx + 1}`,
      cash: fullSettings.startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      outOfJailCards: 0,
      bankrupt: false,
      color: s.color || MONOPOLY_PLAYER_COLORS.at(idx % MONOPOLY_PLAYER_COLORS.length) || '#e63946',
    }));

    const properties = new Map<number, PropertyState>();
    for (const space of MALAYSIA_BOARD_DATA) {
      if (space.type === 'property' || space.type === 'transit' || space.type === 'utility') {
        properties.set(space.index, {
          ownerSeat: null,
          houses: 0,
          isMortgaged: false,
        });
      }
    }

    return {
      players,
      properties,
      jackpotPot: fullSettings.freeParkingSeed,
      currentRound: 1,
      maxRounds: fullSettings.maxRounds,
      winCondition: fullSettings.winCondition,
      auctionEnabled: fullSettings.auctionEnabled,
      activeSeat: players.at(0)?.seat ?? 0,
      phase: 'roll',
      doublesStreak: 0,
      lastDice: [1, 1],
      extraTurnAllowed: false,
      activeCard: null,
      activeAuction: null,
      pendingTrade: null,
      debtTarget: null,
      winnerSeat: null,
      gameOverReason: null,
      nasibDeck: shuffleCards(NASIB_CARDS),
      danaDeck: shuffleCards(DANA_CARDS),
      logs: ['[GO] Malaysia Landmarks Monopoly match initialized.'],
    };
  }

  calculateRent(space: BoardSpace, state: MonopolyMatchState, diceRollTotal = 7): number {
    const prop = state.properties.get(space.index);
    if (!prop || prop.ownerSeat === null || prop.isMortgaged) return 0;

    const owner = state.players.find((p) => p.seat === prop.ownerSeat);
    if (!owner) return 0;

    // Saidina Rule 2: Landlord in jail collects RM 0 rent!
    if (owner.inJail) {
      return 0;
    }

    if (space.type === 'property') {
      const schedule = space.rentSchedule;
      if (!schedule) return 0;
      if (prop.houses > 0) {
        return schedule.at(prop.houses) ?? 0;
      }
      // Check if entire color group is owned for double base rent
      const groupSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.colorGroup === space.colorGroup);
      const ownsAll = groupSpaces.every(
        (s) => state.properties.get(s.index)?.ownerSeat === prop.ownerSeat
      );
      return ownsAll ? (schedule.at(0) ?? 0) * 2 : (schedule.at(0) ?? 0);
    }

    if (space.type === 'transit') {
      const transitSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.type === 'transit');
      const ownedCount = transitSpaces.filter(
        (s) => state.properties.get(s.index)?.ownerSeat === prop.ownerSeat
      ).length;
      const rentMap = new Map<number, number>([
        [1, 25],
        [2, 50],
        [3, 100],
        [4, 200],
      ]);
      return rentMap.get(ownedCount) ?? 25;
    }

    if (space.type === 'utility') {
      const utilitySpaces = MALAYSIA_BOARD_DATA.filter((s) => s.type === 'utility');
      const ownedCount = utilitySpaces.filter(
        (s) => state.properties.get(s.index)?.ownerSeat === prop.ownerSeat
      ).length;
      const multiplier = ownedCount >= 2 ? 10 : 4;
      return diceRollTotal * multiplier;
    }

    return 0;
  }

  validateEvenBuild(
    colorGroup: ColorGroup,
    targetSpaceIndex: number,
    state: MonopolyMatchState
  ): boolean {
    const groupSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.colorGroup === colorGroup);
    const targetProp = state.properties.get(targetSpaceIndex);
    if (!targetProp || targetProp.ownerSeat === null || targetProp.isMortgaged) return false;

    const owner = targetProp.ownerSeat;
    // All must be owned by the same player and none mortgaged
    for (const s of groupSpaces) {
      const p = state.properties.get(s.index);
      if (!p || p.ownerSeat !== owner || p.isMortgaged) return false;
    }

    // Check even build: cannot build if target already has more houses than any other in group
    const currentHouses = targetProp.houses;
    if (currentHouses >= 5) return false; // Already hotel

    for (const s of groupSpaces) {
      const p = state.properties.get(s.index);
      if (p && p.houses < currentHouses) {
        return false; // Must build on other properties first
      }
    }

    return true;
  }

  validateEvenDemolish(
    colorGroup: ColorGroup,
    targetSpaceIndex: number,
    state: MonopolyMatchState
  ): boolean {
    const groupSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.colorGroup === colorGroup);
    const targetProp = state.properties.get(targetSpaceIndex);
    if (!targetProp || targetProp.ownerSeat === null || targetProp.houses <= 0) return false;

    const currentHouses = targetProp.houses;
    for (const s of groupSpaces) {
      const p = state.properties.get(s.index);
      if (p && p.houses > currentHouses) {
        return false; // Cannot demolish if another has more houses
      }
    }
    return true;
  }

  calculateNetWorth(player: MonopolyPlayer, state: MonopolyMatchState): number {
    if (player.bankrupt) return 0;
    let worth = player.cash + player.outOfJailCards * 50;

    for (const [spaceIdx, prop] of state.properties.entries()) {
      if (prop.ownerSeat === player.seat) {
        const space = MALAYSIA_BOARD_DATA.at(spaceIdx);
        if (space && space.cost) {
          if (prop.isMortgaged) {
            worth += space.mortgageValue ?? space.cost / 2;
          } else {
            worth += space.cost;
            if (space.houseCost && prop.houses > 0) {
              worth += prop.houses * space.houseCost;
            }
          }
        }
      }
    }
    return worth;
  }

  getMonopolyPlayerView(state: MonopolyMatchState, viewerSeatIdx = 0): MonopolyPlayerView {
    const isViewerValid = viewerSeatIdx >= 0 && viewerSeatIdx < state.players.length;
    return {
      players: state.players.map((p) => ({ ...p })),
      properties: Array.from(state.properties.entries()),
      jackpotPot: state.jackpotPot,
      currentRound: state.currentRound,
      maxRounds: state.maxRounds,
      winCondition: state.winCondition,
      auctionEnabled: state.auctionEnabled,
      activeSeat: state.activeSeat,
      phase: state.phase,
      doublesStreak: state.doublesStreak,
      lastDice: [...state.lastDice] as [number, number],
      extraTurnAllowed: isViewerValid && state.extraTurnAllowed,
      activeCard: state.activeCard ? { ...state.activeCard } : null,
      activeAuction: state.activeAuction ? { ...state.activeAuction } : null,
      pendingTrade: state.pendingTrade ? { ...state.pendingTrade } : null,
      debtTarget: state.debtTarget ? { ...state.debtTarget } : null,
      winnerSeat: state.winnerSeat,
      gameOverReason: state.gameOverReason,
      nasibDeckCount: state.nasibDeck.length,
      danaDeckCount: state.danaDeck.length,
      logs: [...state.logs],
    };
  }

  applyMonopolyAction(
    state: MonopolyMatchState,
    seatIdx: number,
    action: MonopolyAction
  ): MonopolyMatchState {
    if (state.phase === 'gameOver') {
      return state;
    }

    switch (action.type) {
      case 'rollDice':
        return this.handleRollDice(state, seatIdx);
      case 'buyProperty':
        return this.handleBuyProperty(state, seatIdx);
      case 'passProperty':
        return this.handlePassProperty(state, seatIdx);
      case 'bidAuction':
        return this.handleBidAuction(state, seatIdx, action.amount);
      case 'passAuction':
        return this.handlePassAuction(state, seatIdx);
      case 'buildHouse':
        return this.handleBuildHouse(state, seatIdx, action.spaceIndex);
      case 'sellHouse':
        return this.handleSellHouse(state, seatIdx, action.spaceIndex);
      case 'mortgageProperty':
        return this.handleMortgageProperty(state, seatIdx, action.spaceIndex);
      case 'unmortgageProperty':
        return this.handleUnmortgageProperty(state, seatIdx, action.spaceIndex);
      case 'payJailBail':
        return this.handlePayJailBail(state, seatIdx);
      case 'useJailCard':
        return this.handleUseJailCard(state, seatIdx);
      case 'proposeTrade':
        return this.handleProposeTrade(state, seatIdx, action.trade);
      case 'acceptTrade':
        return this.handleAcceptTrade(state, seatIdx);
      case 'rejectTrade':
        return this.handleRejectTrade(state, seatIdx);
      case 'declareBankruptcy':
        return this.handleDeclareBankruptcy(state, seatIdx);
      case 'endTurn':
        return this.handleEndTurn(state, seatIdx);
    }
  }

  private handleRollDice(state: MonopolyMatchState, seatIdx: number): MonopolyMatchState {
    if (state.activeSeat !== seatIdx || state.phase !== 'roll') {
      return state;
    }

    const player = state.players.find((p) => p.seat === seatIdx);
    if (!player || player.bankrupt) return state;

    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const diceTotal = die1 + die2;
    const isDouble = die1 === die2;
    state.lastDice = [die1, die2];

    const logs = [...state.logs];
    logs.push(`[${player.name}] rolled ${die1} + ${die2} = ${diceTotal}${isDouble ? ' (Doubles!)' : ''}`);

    if (player.inJail) {
      if (isDouble) {
        player.inJail = false;
        player.jailTurns = 0;
        state.doublesStreak = 0;
        state.extraTurnAllowed = false; // Escaping via doubles does not grant extra turn
        logs.push(`[Jail] ${player.name} rolled doubles and is released from Jail!`);
        this.movePlayer(state, player, diceTotal, logs);
        this.resolveLanding(state, player, diceTotal, logs);
      } else {
        player.jailTurns++;
        if (player.jailTurns >= 3) {
          logs.push(`[Jail] 3 turns in Jail. Must pay RM 50 bail.`);
          if (player.cash >= 50) {
            player.cash -= 50;
            state.jackpotPot += 50; // Saidina Rule 1!
            player.inJail = false;
            player.jailTurns = 0;
            logs.push(`[Jail] Paid RM 50 bail into Free Parking Jackpot.`);
            this.movePlayer(state, player, diceTotal, logs);
            this.resolveLanding(state, player, diceTotal, logs);
          } else {
            state.phase = 'financialDistress';
            state.debtTarget = { creditorSeat: 'jackpot', amountOwed: 50 };
          }
        } else {
          state.phase = 'action';
        }
      }
      state.logs = logs;
      return state;
    }

    // Normal movement
    if (isDouble) {
      state.doublesStreak++;
      if (state.doublesStreak === 3) {
        player.position = 10;
        player.inJail = true;
        player.jailTurns = 0;
        state.doublesStreak = 0;
        state.extraTurnAllowed = false;
        state.phase = 'action';
        logs.push(`[Jail] Speeding! 3 consecutive doubles. ${player.name} sent directly to Jail.`);
        state.logs = logs;
        return state;
      }
      state.extraTurnAllowed = true;
    } else {
      state.doublesStreak = 0;
      state.extraTurnAllowed = false;
    }

    this.movePlayer(state, player, diceTotal, logs);
    this.resolveLanding(state, player, diceTotal, logs);

    state.logs = logs;
    return state;
  }

  private movePlayer(
    state: MonopolyMatchState,
    player: MonopolyPlayer,
    steps: number,
    logs: string[]
  ): void {
    const oldPos = player.position;
    const newPos = (oldPos + steps) % 40;
    player.position = newPos;

    if (newPos < oldPos) {
      // Passed GO
      player.cash += 200;
      logs.push(`[GO] ${player.name} passed GO and collected RM 200.`);
    }
  }

  private resolveLanding(
    state: MonopolyMatchState,
    player: MonopolyPlayer,
    diceTotal: number,
    logs: string[]
  ): void {
    const space = BOARD_SPACE_MAP.get(player.position);
    if (!space) {
      state.phase = 'action';
      return;
    }

    logs.push(`[Landing] ${player.name} landed on ${space.name} (Space ${space.index}).`);

    switch (space.type) {
      case 'corner_go':
      case 'corner_jail':
        state.phase = 'action';
        break;

      case 'corner_parking': {
        // Saidina Rule 1: Free Parking Jackpot!
        const award = state.jackpotPot;
        player.cash += award;
        state.jackpotPot = 100; // Reset to seed
        logs.push(`[Free Parking] Jackpot! ${player.name} collects the entire pot of RM ${award}! (Pot reset to RM 100)`);
        state.phase = 'action';
        break;
      }

      case 'corner_gotojail':
        player.position = 10;
        player.inJail = true;
        player.jailTurns = 0;
        state.doublesStreak = 0;
        state.extraTurnAllowed = false;
        logs.push(`[Go To Jail] ${player.name} sent directly to Jail.`);
        state.phase = 'action';
        break;

      case 'tax': {
        const tax = space.cost ?? 100;
        if (player.cash >= tax) {
          player.cash -= tax;
          state.jackpotPot += tax; // Saidina Rule 1
          logs.push(`[Tax] ${player.name} paid RM ${tax} into Free Parking Jackpot.`);
          state.phase = 'action';
        } else {
          state.phase = 'financialDistress';
          state.debtTarget = { creditorSeat: 'jackpot', amountOwed: tax };
          logs.push(`[Distress] ${player.name} owes RM ${tax} in taxes!`);
        }
        break;
      }

      case 'chance':
        this.drawCard(state, player, 'nasib', diceTotal, logs);
        break;

      case 'community_chest':
        this.drawCard(state, player, 'dana', diceTotal, logs);
        break;

      case 'property':
      case 'transit':
      case 'utility': {
        const prop = state.properties.get(space.index);
        if (!prop) {
          state.phase = 'action';
          return;
        }

        if (prop.ownerSeat === null) {
          // Unowned property
          state.phase = 'action';
        } else if (prop.ownerSeat === player.seat) {
          // Owned by self
          state.phase = 'action';
        } else {
          // Owned by other player: pay rent!
          const rent = this.calculateRent(space, state, diceTotal);
          const landlord = state.players.find((p) => p.seat === prop.ownerSeat);

          if (landlord?.inJail) {
            logs.push(`[Saidina Rule 2] Landlord ${landlord.name} is in Jail — RM 0 rent collected!`);
            state.phase = 'action';
          } else if (prop.isMortgaged) {
            logs.push(`[Mortgage] ${space.name} is mortgaged — RM 0 rent collected.`);
            state.phase = 'action';
          } else if (rent > 0) {
            if (player.cash >= rent) {
              player.cash -= rent;
              if (landlord) landlord.cash += rent;
              logs.push(`[Rent] ${player.name} paid RM ${rent} rent to ${landlord?.name ?? 'Bank'}.`);
              state.phase = 'action';
            } else {
              state.phase = 'financialDistress';
              state.debtTarget = { creditorSeat: landlord?.seat ?? 'bank', amountOwed: rent };
              logs.push(`[Distress] ${player.name} owes RM ${rent} rent to ${landlord?.name ?? 'Bank'}!`);
            }
          } else {
            state.phase = 'action';
          }
        }
        break;
      }
    }
  }

  private drawCard(
    state: MonopolyMatchState,
    player: MonopolyPlayer,
    deckType: 'nasib' | 'dana',
    diceTotal: number,
    logs: string[]
  ): void {
    let deck = deckType === 'nasib' ? state.nasibDeck : state.danaDeck;
    if (deck.length === 0) {
      deck = shuffleCards(deckType === 'nasib' ? NASIB_CARDS : DANA_CARDS);
      if (deckType === 'nasib') state.nasibDeck = deck;
      else state.danaDeck = deck;
    }

    const card = deck.shift();
    if (!card) {
      state.phase = 'action';
      return;
    }
    state.activeCard = card;
    logs.push(`[${deckType === 'nasib' ? 'Chance' : 'Community Chest'}] ${card.id}`);

    switch (card.actionType) {
      case 'advance_mula':
        player.position = 0;
        player.cash += card.amount ?? 200;
        logs.push(`[Advance to GO] ${player.name} advanced to GO and collected RM ${card.amount ?? 200}.`);
        state.phase = 'action';
        break;

      case 'advance_position': {
        const target = card.targetPosition ?? 0;
        if (target < player.position) {
          player.cash += 200;
          logs.push(`[GO] Passed GO and collected RM 200.`);
        }
        player.position = target;
        this.resolveLanding(state, player, diceTotal, logs);
        break;
      }

      case 'advance_nearest_transit': {
        const nearest = getNearestTransitIndex(player.position);
        if (nearest < player.position) {
          player.cash += 200;
          logs.push(`[GO] Passed GO and collected RM 200.`);
        }
        player.position = nearest;
        const prop = state.properties.get(nearest);
        if (prop && prop.ownerSeat !== null && prop.ownerSeat !== player.seat) {
          const space = BOARD_SPACE_MAP.get(nearest)!;
          const normalRent = this.calculateRent(space, state, diceTotal);
          const doubleRent = normalRent * 2;
          const landlord = state.players.find((p) => p.seat === prop.ownerSeat);
          if (landlord && !landlord.inJail && !prop.isMortgaged) {
            if (player.cash >= doubleRent) {
              player.cash -= doubleRent;
              landlord.cash += doubleRent;
              logs.push(`[Transit 2x] Paid double rent of RM ${doubleRent} to ${landlord.name}.`);
              state.phase = 'action';
            } else {
              state.phase = 'financialDistress';
              state.debtTarget = { creditorSeat: landlord.seat, amountOwed: doubleRent };
            }
          } else {
            state.phase = 'action';
          }
        } else {
          state.phase = 'action';
        }
        break;
      }

      case 'advance_nearest_utility': {
        const nearest = getNearestUtilityIndex(player.position);
        if (nearest < player.position) {
          player.cash += 200;
          logs.push(`[GO] Passed GO and collected RM 200.`);
        }
        player.position = nearest;
        const prop = state.properties.get(nearest);
        if (prop && prop.ownerSeat !== null && prop.ownerSeat !== player.seat) {
          const landlord = state.players.find((p) => p.seat === prop.ownerSeat);
          const roll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
          const utilityRent = roll * 10;
          if (landlord && !landlord.inJail && !prop.isMortgaged) {
            if (player.cash >= utilityRent) {
              player.cash -= utilityRent;
              landlord.cash += utilityRent;
              logs.push(`[Utility 10x] Rolled ${roll}, paid 10x = RM ${utilityRent} to ${landlord.name}.`);
              state.phase = 'action';
            } else {
              state.phase = 'financialDistress';
              state.debtTarget = { creditorSeat: landlord.seat, amountOwed: utilityRent };
            }
          } else {
            state.phase = 'action';
          }
        } else {
          state.phase = 'action';
        }
        break;
      }

      case 'collect_bank': {
        const amt = card.amount ?? 50;
        player.cash += amt;
        logs.push(`[Bank Payout] ${player.name} received RM ${amt} from Bank.`);
        state.phase = 'action';
        break;
      }

      case 'pay_fines': {
        const fine = card.amount ?? 50;
        if (player.cash >= fine) {
          player.cash -= fine;
          state.jackpotPot += fine; // Saidina Rule 1!
          logs.push(`[Fine] ${player.name} paid RM ${fine} fine into Free Parking Jackpot.`);
          state.phase = 'action';
        } else {
          state.phase = 'financialDistress';
          state.debtTarget = { creditorSeat: 'jackpot', amountOwed: fine };
        }
        break;
      }

      case 'go_to_jail':
        player.position = 10;
        player.inJail = true;
        player.jailTurns = 0;
        state.doublesStreak = 0;
        state.extraTurnAllowed = false;
        logs.push(`[Jail] ${player.name} sent directly to Jail.`);
        state.phase = 'action';
        break;

      case 'get_out_of_jail':
        player.outOfJailCards++;
        logs.push(`[Jail Free Card] ${player.name} received a Get Out of Jail Free card.`);
        state.phase = 'action';
        break;

      case 'repairs': {
        let houses = 0;
        let hotels = 0;
        for (const p of state.properties.values()) {
          if (p.ownerSeat === player.seat) {
            if (p.houses === 5) hotels++;
            else houses += p.houses;
          }
        }
        const cost = houses * (card.perHouse ?? 25) + hotels * (card.perHotel ?? 100);
        if (cost > 0) {
          if (player.cash >= cost) {
            player.cash -= cost;
            state.jackpotPot += cost; // Saidina Rule 1!
            logs.push(`[Repairs] Paid RM ${cost} repair assessment into Free Parking Jackpot.`);
            state.phase = 'action';
          } else {
            state.phase = 'financialDistress';
            state.debtTarget = { creditorSeat: 'jackpot', amountOwed: cost };
          }
        } else {
          state.phase = 'action';
        }
        break;
      }

      case 'back_spaces': {
        const back = card.backSpaces ?? 3;
        player.position = (player.position - back + 40) % 40;
        logs.push(`[Back 3 Spaces] ${player.name} moved back 3 spaces to Space ${player.position}.`);
        this.resolveLanding(state, player, diceTotal, logs);
        break;
      }

      case 'pay_players': {
        const amt = card.amount ?? 50;
        const otherPlayers = state.players.filter((p) => p.seat !== player.seat && !p.bankrupt);
        const totalCost = amt * otherPlayers.length;
        if (player.cash >= totalCost) {
          player.cash -= totalCost;
          for (const op of otherPlayers) {
            op.cash += amt;
          }
          logs.push(`[GLC Payout] ${player.name} paid RM ${amt} to each opponent.`);
          state.phase = 'action';
        } else {
          state.phase = 'financialDistress';
          state.debtTarget = { creditorSeat: 'bank', amountOwed: totalCost };
        }
        break;
      }

      case 'collect_players': {
        const amt = card.amount ?? 10;
        const otherPlayers = state.players.filter((p) => p.seat !== player.seat && !p.bankrupt);
        for (const op of otherPlayers) {
          const paid = Math.min(op.cash, amt);
          op.cash -= paid;
          player.cash += paid;
        }
        logs.push(`[Birthday] ${player.name} collected RM ${amt} gift from each player.`);
        state.phase = 'action';
        break;
      }
    }
  }

  private handleBuyProperty(state: MonopolyMatchState, seatIdx: number): MonopolyMatchState {
    if (state.activeSeat !== seatIdx || state.phase !== 'action') return state;

    const player = state.players.find((p) => p.seat === seatIdx);
    if (!player) return state;

    const space = BOARD_SPACE_MAP.get(player.position);
    if (!space || (space.type !== 'property' && space.type !== 'transit' && space.type !== 'utility')) {
      return state;
    }

    const prop = state.properties.get(space.index);
    if (!prop || prop.ownerSeat !== null) return state;

    const cost = space.cost ?? 100;
    if (player.cash >= cost) {
      player.cash -= cost;
      prop.ownerSeat = player.seat;
      state.logs.push(`[Purchase] ${player.name} purchased ${space.name} for RM ${cost}.`);
    }

    return state;
  }

  private handlePassProperty(state: MonopolyMatchState, seatIdx: number): MonopolyMatchState {
    if (state.activeSeat !== seatIdx || state.phase !== 'action') return state;

    const player = state.players.find((p) => p.seat === seatIdx);
    if (!player) return state;

    const space = BOARD_SPACE_MAP.get(player.position);
    if (!space || (space.type !== 'property' && space.type !== 'transit' && space.type !== 'utility')) {
      return state;
    }

    const prop = state.properties.get(space.index);
    if (!prop || prop.ownerSeat !== null) return state;

    if (state.auctionEnabled) {
      // Begin Auction
      const activeBidders = state.players.filter((p) => !p.bankrupt).map((p) => p.seat);
      state.activeAuction = {
        spaceIndex: space.index,
        currentBid: 0,
        highestBidderSeat: null,
        activeBidders,
        timerSeconds: 10,
      };
      state.phase = 'auction';
      state.logs.push(`[Auction] Auction started for ${space.name}! All active players may bid.`);
    }

    return state;
  }

  private handleBidAuction(
    state: MonopolyMatchState,
    seatIdx: number,
    amount: number
  ): MonopolyMatchState {
    if (state.phase !== 'auction' || !state.activeAuction) return state;

    const auction = state.activeAuction;
    if (!auction.activeBidders.includes(seatIdx)) return state;

    const bidder = state.players.find((p) => p.seat === seatIdx);
    if (!bidder || bidder.cash < amount || amount <= auction.currentBid) return state;

    auction.currentBid = amount;
    auction.highestBidderSeat = seatIdx;
    auction.timerSeconds = 10;
    state.logs.push(`[Bid] ${bidder.name} bids RM ${amount} for ${BOARD_SPACE_MAP.get(auction.spaceIndex)?.name}.`);

    return state;
  }

  private handlePassAuction(state: MonopolyMatchState, seatIdx: number): MonopolyMatchState {
    if (state.phase !== 'auction' || !state.activeAuction) return state;

    const auction = state.activeAuction;
    auction.activeBidders = auction.activeBidders.filter((s) => s !== seatIdx);
    const passer = state.players.find((p) => p.seat === seatIdx);
    state.logs.push(`[Auction Pass] ${passer?.name ?? `Seat ${seatIdx}`} passed on auction.`);

    if (auction.activeBidders.length <= 1) {
      this.concludeAuction(state);
    }

    return state;
  }

  private concludeAuction(state: MonopolyMatchState): void {
    const auction = state.activeAuction;
    if (!auction) return;

    const space = BOARD_SPACE_MAP.get(auction.spaceIndex);
    const prop = state.properties.get(auction.spaceIndex);

    if (auction.highestBidderSeat !== null && prop && space) {
      const winner = state.players.find((p) => p.seat === auction.highestBidderSeat);
      if (winner && winner.cash >= auction.currentBid) {
        winner.cash -= auction.currentBid;
        prop.ownerSeat = winner.seat;
        state.logs.push(`[Auction Won] ${winner.name} won ${space.name} for RM ${auction.currentBid}!`);
      }
    } else {
      state.logs.push(`[Auction Unsold] No bids placed. ${space?.name} remains in the bank.`);
    }

    state.activeAuction = null;
    state.phase = 'action';
  }

  private handleBuildHouse(
    state: MonopolyMatchState,
    seatIdx: number,
    spaceIndex: number
  ): MonopolyMatchState {
    const space = BOARD_SPACE_MAP.get(spaceIndex);
    if (!space || space.type !== 'property' || !space.colorGroup) return state;

    const prop = state.properties.get(spaceIndex);
    if (!prop || prop.ownerSeat !== seatIdx) return state;

    if (!this.validateEvenBuild(space.colorGroup, spaceIndex, state)) return state;

    const cost = space.houseCost ?? 100;
    const player = state.players.find((p) => p.seat === seatIdx);
    if (!player || player.cash < cost) return state;

    player.cash -= cost;
    prop.houses++;
    const type = prop.houses === 5 ? 'Hotel' : `House ${prop.houses}`;
    state.logs.push(`[Build] ${player.name} built a ${type} on ${space.name} for RM ${cost}.`);

    return state;
  }

  private handleSellHouse(
    state: MonopolyMatchState,
    seatIdx: number,
    spaceIndex: number
  ): MonopolyMatchState {
    const space = BOARD_SPACE_MAP.get(spaceIndex);
    if (!space || space.type !== 'property' || !space.colorGroup) return state;

    const prop = state.properties.get(spaceIndex);
    if (!prop || prop.ownerSeat !== seatIdx || prop.houses <= 0) return state;

    if (!this.validateEvenDemolish(space.colorGroup, spaceIndex, state)) return state;

    const refund = Math.floor((space.houseCost ?? 100) * 0.5);
    const player = state.players.find((p) => p.seat === seatIdx);
    if (!player) return state;

    player.cash += refund;
    prop.houses--;
    state.logs.push(`[Demolish] ${player.name} sold building on ${space.name} for RM ${refund}.`);

    if (state.phase === 'financialDistress' && state.debtTarget && player.cash >= state.debtTarget.amountOwed) {
      this.resolveDistressDebt(state, player);
    }

    return state;
  }

  private handleMortgageProperty(
    state: MonopolyMatchState,
    seatIdx: number,
    spaceIndex: number
  ): MonopolyMatchState {
    const space = BOARD_SPACE_MAP.get(spaceIndex);
    const prop = state.properties.get(spaceIndex);
    if (!space || !prop || prop.ownerSeat !== seatIdx || prop.isMortgaged) return state;

    // Cannot mortgage if any property in same color group has houses
    if (space.colorGroup) {
      const groupSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.colorGroup === space.colorGroup);
      const hasHouses = groupSpaces.some((s) => (state.properties.get(s.index)?.houses ?? 0) > 0);
      if (hasHouses) return state;
    }

    const payout = space.mortgageValue ?? Math.floor((space.cost ?? 100) * 0.5);
    const player = state.players.find((p) => p.seat === seatIdx);
    if (!player) return state;

    prop.isMortgaged = true;
    player.cash += payout;
    state.logs.push(`[Mortgage] ${player.name} mortgaged ${space.name} for RM ${payout}.`);

    if (state.phase === 'financialDistress' && state.debtTarget && player.cash >= state.debtTarget.amountOwed) {
      this.resolveDistressDebt(state, player);
    }

    return state;
  }

  private handleUnmortgageProperty(
    state: MonopolyMatchState,
    seatIdx: number,
    spaceIndex: number
  ): MonopolyMatchState {
    const space = BOARD_SPACE_MAP.get(spaceIndex);
    const prop = state.properties.get(spaceIndex);
    if (!space || !prop || prop.ownerSeat !== seatIdx || !prop.isMortgaged) return state;

    const mortgageValue = space.mortgageValue ?? Math.floor((space.cost ?? 100) * 0.5);
    const unmortgageCost = Math.round(mortgageValue * 1.1); // 50% + 10% fee = 55%

    const player = state.players.find((p) => p.seat === seatIdx);
    if (!player || player.cash < unmortgageCost) return state;

    player.cash -= unmortgageCost;
    prop.isMortgaged = false;
    state.logs.push(`[Unmortgage] ${player.name} lifted mortgage on ${space.name} for RM ${unmortgageCost}.`);

    return state;
  }

  private handlePayJailBail(state: MonopolyMatchState, seatIdx: number): MonopolyMatchState {
    const player = state.players.find((p) => p.seat === seatIdx);
    if (!player || !player.inJail || player.cash < 50) return state;

    player.cash -= 50;
    state.jackpotPot += 50; // Saidina Rule 1!
    player.inJail = false;
    player.jailTurns = 0;
    state.logs.push(`[Jail] ${player.name} paid RM 50 bail into Free Parking Jackpot.`);

    return state;
  }

  private handleUseJailCard(state: MonopolyMatchState, seatIdx: number): MonopolyMatchState {
    const player = state.players.find((p) => p.seat === seatIdx);
    if (!player || !player.inJail || player.outOfJailCards <= 0) return state;

    player.outOfJailCards--;
    player.inJail = false;
    player.jailTurns = 0;
    state.logs.push(`[Jail Free Card] ${player.name} used a Get Out of Jail Free card.`);

    return state;
  }

  private handleProposeTrade(
    state: MonopolyMatchState,
    seatIdx: number,
    trade: TradeProposal
  ): MonopolyMatchState {
    if (state.pendingTrade || trade.fromSeat !== seatIdx) return state;

    const fromPlayer = state.players.find((p) => p.seat === trade.fromSeat);
    const toPlayer = state.players.find((p) => p.seat === trade.toSeat);
    if (!fromPlayer || !toPlayer || fromPlayer.cash < trade.offerCash || toPlayer.cash < trade.requestCash) {
      return state;
    }

    state.pendingTrade = trade;
    state.logs.push(`[Trade] ${fromPlayer.name} proposed a trade to ${toPlayer.name}.`);
    return state;
  }

  private handleAcceptTrade(state: MonopolyMatchState, seatIdx: number): MonopolyMatchState {
    const trade = state.pendingTrade;
    if (!trade || trade.toSeat !== seatIdx) return state;

    const fromPlayer = state.players.find((p) => p.seat === trade.fromSeat);
    const toPlayer = state.players.find((p) => p.seat === trade.toSeat);
    if (!fromPlayer || !toPlayer) return state;

    // Exchange Cash
    fromPlayer.cash = fromPlayer.cash - trade.offerCash + trade.requestCash;
    toPlayer.cash = toPlayer.cash - trade.requestCash + trade.offerCash;

    // Exchange Properties
    for (const propIdx of trade.offerProperties) {
      const prop = state.properties.get(propIdx);
      if (prop && prop.ownerSeat === fromPlayer.seat) {
        prop.ownerSeat = toPlayer.seat;
      }
    }
    for (const propIdx of trade.requestProperties) {
      const prop = state.properties.get(propIdx);
      if (prop && prop.ownerSeat === toPlayer.seat) {
        prop.ownerSeat = fromPlayer.seat;
      }
    }

    state.logs.push(`[Trade Accepted] Deal between ${fromPlayer.name} and ${toPlayer.name} confirmed!`);
    state.pendingTrade = null;

    return state;
  }

  private handleRejectTrade(state: MonopolyMatchState, seatIdx: number): MonopolyMatchState {
    const trade = state.pendingTrade;
    if (!trade || trade.toSeat !== seatIdx) return state;

    const toPlayer = state.players.find((p) => p.seat === trade.toSeat);
    state.logs.push(`[Trade Declined] ${toPlayer?.name ?? `Player ${seatIdx}`} rejected the trade offer.`);
    state.pendingTrade = null;

    return state;
  }

  private resolveDistressDebt(state: MonopolyMatchState, player: MonopolyPlayer): void {
    const debt = state.debtTarget;
    if (!debt) return;

    player.cash -= debt.amountOwed;
    if (debt.creditorSeat === 'jackpot') {
      state.jackpotPot += debt.amountOwed;
    } else if (debt.creditorSeat !== 'bank') {
      const creditor = state.players.find((p) => p.seat === debt.creditorSeat);
      if (creditor) creditor.cash += debt.amountOwed;
    }

    state.debtTarget = null;
    state.phase = 'action';
    state.logs.push(`[Debt Settled] ${player.name} successfully paid RM ${debt.amountOwed} debt.`);
  }

  private handleDeclareBankruptcy(state: MonopolyMatchState, seatIdx: number): MonopolyMatchState {
    const player = state.players.find((p) => p.seat === seatIdx);
    if (!player || player.bankrupt) return state;

    player.bankrupt = true;
    player.cash = 0;
    const debt = state.debtTarget;
    const creditor = typeof debt?.creditorSeat === 'number' ? state.players.find((p) => p.seat === debt.creditorSeat) : null;

    state.logs.push(`[Bankruptcy] ${player.name} is bankrupt!`);

    for (const prop of state.properties.values()) {
      if (prop.ownerSeat === player.seat) {
        if (creditor) {
          prop.ownerSeat = creditor.seat;
        } else {
          // Bank gets property back unimproved and unmortgaged
          prop.ownerSeat = null;
          prop.houses = 0;
          prop.isMortgaged = false;
        }
      }
    }

    state.debtTarget = null;
    this.checkGameOver(state);

    if (state.phase !== 'gameOver') {
      this.advanceToNextPlayer(state);
    }

    return state;
  }

  private handleEndTurn(state: MonopolyMatchState, seatIdx: number): MonopolyMatchState {
    if (state.activeSeat !== seatIdx || state.phase !== 'action') return state;

    if (state.extraTurnAllowed) {
      state.phase = 'roll';
      state.extraTurnAllowed = false;
      state.logs.push(`[Extra Turn] ${state.players.find((p) => p.seat === seatIdx)?.name} rolled doubles and takes an extra turn!`);
      return state;
    }

    this.advanceToNextPlayer(state);
    return state;
  }

  private advanceToNextPlayer(state: MonopolyMatchState): void {
    const activeIndex = state.players.findIndex((p) => p.seat === state.activeSeat);
    let nextIdx = (activeIndex + 1) % state.players.length;

    // Check round increment when wrapping around
    if (nextIdx === 0) {
      state.currentRound++;
      state.logs.push(`--- Round ${state.currentRound} ---`);

      if (state.winCondition === 'roundLimit' && state.currentRound > state.maxRounds) {
        this.evaluateRoundLimitWinner(state);
        return;
      }
    }

    // Skip bankrupt players
    let loops = 0;
    while (state.players.at(nextIdx)?.bankrupt && loops < state.players.length) {
      nextIdx = (nextIdx + 1) % state.players.length;
      loops++;
    }

    const nextPlayer = state.players.at(nextIdx);
    if (!nextPlayer || nextPlayer.bankrupt) {
      this.checkGameOver(state);
      return;
    }

    state.activeSeat = nextPlayer.seat;
    state.phase = 'roll';
    state.doublesStreak = 0;
    state.extraTurnAllowed = false;
    state.activeCard = null;
    state.debtTarget = null;

    this.checkGameOver(state);
  }

  private checkGameOver(state: MonopolyMatchState): void {
    const solvent = state.players.filter((p) => !p.bankrupt);
    if (solvent.length <= 1) {
      state.phase = 'gameOver';
      state.winnerSeat = solvent.at(0)?.seat ?? null;
      state.gameOverReason = 'Last Tycoon Standing — All opponents bankrupt!';
      state.logs.push(`[Game Over] ${solvent.at(0)?.name ?? 'Winner'} is the Last Tycoon Standing!`);
    }
  }

  private evaluateRoundLimitWinner(state: MonopolyMatchState): void {
    state.phase = 'gameOver';
    let highestWorth = -1;
    let winner: MonopolyPlayer | null = null;

    for (const player of state.players) {
      if (!player.bankrupt) {
        const worth = this.calculateNetWorth(player, state);
        if (worth > highestWorth) {
          highestWorth = worth;
          winner = player;
        }
      }
    }

    state.winnerSeat = winner?.seat ?? null;
    state.gameOverReason = `Round Limit Reached (${state.maxRounds} rounds — Highest Net Worth wins!)`;
    state.logs.push(
      `[Game Over] Round limit reached. Winner: ${winner?.name ?? 'None'} with RM ${highestWorth} Net Worth!`
    );
  }
}
