import { Injectable, inject } from '@angular/core';
import { BOARD_SPACE_MAP, MALAYSIA_BOARD_DATA } from '../data/monopoly-board.data';
import {
  BoardSpace,
  ColorGroup,
  MonopolyAction,
  MonopolyPlayerView,
  PropertyState,
  TradeProposal,
} from '../models/monopoly.model';
import { MonopolyEngineService } from './monopoly-engine.service';

const ROI_COLOR_GROUP_ORDER: readonly ColorGroup[] = [
  'orange',
  'red',
  'yellow',
  'light_blue',
  'pink',
  'dark_blue',
  'green',
  'brown',
];

@Injectable({
  providedIn: 'root',
})
export class MonopolyBotService {
  private readonly engine = inject(MonopolyEngineService);
  private readonly lastTradeRoundBySeat = new Map<number, number>();

  evaluateMonopolyBotAction(
    view: MonopolyPlayerView,
    botSeatIdx: number
  ): MonopolyAction | null {
    if (view.phase === 'gameOver') return null;

    const bot = view.players.find((p) => p.seat === botSeatIdx);
    if (!bot || bot.bankrupt) return null;

    // 1. Respond to Auction
    if (view.phase === 'auction' && view.activeAuction) {
      if (view.activeAuction.activeBidders.includes(botSeatIdx)) {
        return this.evaluateAuctionBid(view, bot, view.activeAuction);
      }
      return null;
    }

    // 2. Respond to Trade Proposal
    if (view.pendingTrade) {
      if (view.pendingTrade.toSeat === botSeatIdx) {
        return this.evaluateTradeResponse(view, bot, view.pendingTrade);
      }
      // Wait for counterparty to resolve pending trade before taking further turn actions
      return null;
    }

    // All other actions require bot to be the active player
    if (view.activeSeat !== botSeatIdx) return null;

    // 3. Financial Distress (Debt Liquidation)
    if (view.phase === 'financialDistress' && view.debtTarget) {
      return this.evaluateDistressLiquidation(view, bot);
    }

    // 4. Roll Dice / Jail Exit
    if (view.phase === 'roll') {
      if (bot.inJail) {
        return this.evaluateJailAction(view, bot);
      }
      return { type: 'rollDice' };
    }

    // 5. Action Phase (Buy, Build, Proactive Trade, Unmortgage, or End Turn)
    if (view.phase === 'action') {
      // 5a. Check landing unowned property
      const space = BOARD_SPACE_MAP.get(bot.position);
      const prop = this.getPropertyState(view, bot.position);
      if (space && prop && prop.ownerSeat === null && space.cost) {
        if (this.shouldBuyProperty(view, bot, space)) {
          return { type: 'buyProperty' };
        }
        return { type: 'passProperty' };
      }

      // 5b. Check building houses / hotels (high-ROI 3-house sweet spot prioritized)
      const buildAction = this.evaluateBuildingInvestment(view, bot);
      if (buildAction) {
        return buildAction;
      }

      // 5c. Proactively propose a monopoly-completing trade (at most once per round)
      const tradeAction = this.evaluateProactiveTrade(view, bot);
      if (tradeAction) {
        return tradeAction;
      }

      // 5d. Check unmortgaging properties if cash is abundant
      const unmortgageAction = this.evaluateUnmortgage(view, bot);
      if (unmortgageAction) {
        return unmortgageAction;
      }

      // 5e. End Turn
      return { type: 'endTurn' };
    }

    return null;
  }

  private getPropertyState(view: MonopolyPlayerView, spaceIndex: number): PropertyState | undefined {
    const entry = view.properties.find(([idx]) => idx === spaceIndex);
    return entry ? entry[1] : undefined;
  }

  private evaluateJailAction(
    view: MonopolyPlayerView,
    bot: MonopolyPlayerView['players'][number]
  ): MonopolyAction {
    const isEarlyGame = view.currentRound <= 10;
    const ownsHighRentHotels = this.ownsHighRentHotels(view, bot.seat);

    // Early game: pay or use card to get out immediately to buy properties
    if (isEarlyGame) {
      if (bot.outOfJailCards > 0) return { type: 'useJailCard' };
      if (bot.cash >= 50) return { type: 'payJailBail' };
      return { type: 'rollDice' };
    }

    // Late game: Saidina Rule 2! If bot owns hotels, it MUST pay bail to collect rent
    if (ownsHighRentHotels) {
      if (bot.outOfJailCards > 0) return { type: 'useJailCard' };
      if (bot.cash >= 50) return { type: 'payJailBail' };
    }

    // Otherwise roll for doubles to stay safe
    return { type: 'rollDice' };
  }

  private ownsHighRentHotels(view: MonopolyPlayerView, seatIdx: number): boolean {
    for (const [idx, prop] of view.properties) {
      if (prop.ownerSeat === seatIdx && prop.houses >= 4) {
        const space = BOARD_SPACE_MAP.get(idx);
        if (space && (space.baseRent ?? 0) >= 18) {
          return true;
        }
      }
    }
    return false;
  }

  private shouldBuyProperty(
    view: MonopolyPlayerView,
    bot: MonopolyPlayerView['players'][number],
    space: BoardSpace
  ): boolean {
    const cost = space.cost ?? 100;
    if (bot.cash < cost) return false;

    // Check if completes monopoly for bot
    if (space.colorGroup && this.completesMonopoly(view, bot.seat, space.colorGroup, space.index)) {
      return true;
    }

    // Check if blocks an opponent from completing a monopoly
    if (space.colorGroup && this.blocksOpponentMonopoly(view, bot.seat, space.colorGroup, space.index)) {
      return true;
    }

    // Prioritize Transit hubs if bot already owns at least one (exponential rent 25->50->100->200)
    if (space.type === 'transit' && this.countOwnedByType(view, bot.seat, 'transit') >= 1) {
      return bot.cash - cost >= 100;
    }

    // Safety cash reserve: RM 150 + round * 5
    const safetyReserve = 150 + view.currentRound * 5;
    return bot.cash - cost >= safetyReserve;
  }

  private countOwnedByType(
    view: MonopolyPlayerView,
    seatIdx: number,
    spaceType: BoardSpace['type']
  ): number {
    let count = 0;
    for (const [idx, prop] of view.properties) {
      if (prop.ownerSeat === seatIdx && BOARD_SPACE_MAP.get(idx)?.type === spaceType) {
        count++;
      }
    }
    return count;
  }

  private completesMonopoly(
    view: MonopolyPlayerView,
    seatIdx: number,
    group: ColorGroup,
    targetSpaceIndex: number
  ): boolean {
    const groupSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.colorGroup === group);
    return groupSpaces.every((s) => {
      if (s.index === targetSpaceIndex) return true;
      const prop = this.getPropertyState(view, s.index);
      return prop?.ownerSeat === seatIdx;
    });
  }

  private blocksOpponentMonopoly(
    view: MonopolyPlayerView,
    _mySeat: number,
    group: ColorGroup,
    targetSpaceIndex: number
  ): boolean {
    const groupSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.colorGroup === group);
    const ownerCounts = new Map<number, number>();

    for (const s of groupSpaces) {
      if (s.index === targetSpaceIndex) continue;
      const prop = this.getPropertyState(view, s.index);
      if (prop && prop.ownerSeat !== null) {
        ownerCounts.set(prop.ownerSeat, (ownerCounts.get(prop.ownerSeat) ?? 0) + 1);
      }
    }

    for (const count of ownerCounts.values()) {
      if (count === groupSpaces.length - 1) {
        return true; // Opponent has all other properties in group
      }
    }
    return false;
  }

  private evaluateAuctionBid(
    view: MonopolyPlayerView,
    bot: MonopolyPlayerView['players'][number],
    auction: NonNullable<MonopolyPlayerView['activeAuction']>
  ): MonopolyAction {
    const space = BOARD_SPACE_MAP.get(auction.spaceIndex);
    if (!space || !space.cost) return { type: 'passAuction' };

    const completes = space.colorGroup
      ? this.completesMonopoly(view, bot.seat, space.colorGroup, space.index)
      : false;
    const blocks = space.colorGroup
      ? this.blocksOpponentMonopoly(view, bot.seat, space.colorGroup, space.index)
      : false;
    const transitSynergy =
      space.type === 'transit' ? this.countOwnedByType(view, bot.seat, 'transit') : 0;

    let multiplier = 0.85;
    if (completes) {
      multiplier = 1.65;
    } else if (blocks) {
      multiplier = 1.3;
    } else if (transitSynergy >= 2) {
      multiplier = 1.4;
    } else if (transitSynergy === 1) {
      multiplier = 1.15;
    }
    const perceivedValue = Math.floor(space.cost * multiplier);

    const safetyReserve = 100 + view.currentRound * 5;
    const maxBid = Math.min(perceivedValue, Math.max(0, bot.cash - safetyReserve));

    const nextBid = auction.currentBid + 10;
    if (nextBid <= maxBid && nextBid <= bot.cash) {
      return { type: 'bidAuction', amount: nextBid };
    }

    return { type: 'passAuction' };
  }

  private evaluateBuildingInvestment(
    view: MonopolyPlayerView,
    bot: MonopolyPlayerView['players'][number]
  ): MonopolyAction | null {
    // Pass 1: Build high-ROI groups up to the 3-house rent spike first; Pass 2: Push to 4H / Hotel
    for (const maxTargetHouses of [3, 5]) {
      for (const group of ROI_COLOR_GROUP_ORDER) {
        const groupSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.colorGroup === group);
        const ownsAll = groupSpaces.every((s) => {
          const prop = this.getPropertyState(view, s.index);
          return prop && prop.ownerSeat === bot.seat && !prop.isMortgaged;
        });

        if (!ownsAll) continue;

        for (const space of groupSpaces) {
          const prop = this.getPropertyState(view, space.index);
          if (!prop || prop.houses >= maxTargetHouses) continue;

          const cost = space.houseCost ?? 100;
          const safetyBuffer = 200 + view.currentRound * 10;
          if (bot.cash - cost < safetyBuffer) continue;

          // Verify even-build rule
          const canBuild = groupSpaces.every((s) => {
            const p = this.getPropertyState(view, s.index);
            return p && p.houses >= prop.houses;
          });

          if (canBuild) {
            return { type: 'buildHouse', spaceIndex: space.index };
          }
        }
      }
    }

    return null;
  }

  private evaluateProactiveTrade(
    view: MonopolyPlayerView,
    bot: MonopolyPlayerView['players'][number]
  ): MonopolyAction | null {
    if (view.currentRound < 3) return null;
    if (this.lastTradeRoundBySeat.get(bot.seat) === view.currentRound) return null;
    if (view.logs.slice(-4).some((l) => l.startsWith(`[Trade] ${bot.name} proposed`))) {
      return null;
    }

    const safetyReserve = 220 + view.currentRound * 8;
    const expendableCash = Math.max(0, bot.cash - safetyReserve);

    for (const group of ROI_COLOR_GROUP_ORDER) {
      const groupSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.colorGroup === group);
      const botOwned = groupSpaces.filter(
        (s) => this.getPropertyState(view, s.index)?.ownerSeat === bot.seat
      );
      if (botOwned.length !== groupSpaces.length - 1) continue;

      const missingSpace = groupSpaces.find(
        (s) => this.getPropertyState(view, s.index)?.ownerSeat !== bot.seat
      );
      if (!missingSpace) continue;

      const missingProp = this.getPropertyState(view, missingSpace.index);
      if (
        !missingProp ||
        missingProp.ownerSeat === null ||
        missingProp.ownerSeat === bot.seat ||
        missingProp.houses > 0
      ) {
        continue;
      }

      const targetPlayer = view.players.find((p) => p.seat === missingProp.ownerSeat);
      if (!targetPlayer || targetPlayer.bankrupt) continue;

      const targetValue = missingSpace.cost ?? 120;

      // Look for an isolated single property owned by bot that does NOT grant targetPlayer a monopoly
      const tradeableSingle = MALAYSIA_BOARD_DATA.find((candidate) => {
        const cProp = this.getPropertyState(view, candidate.index);
        if (!cProp || cProp.ownerSeat !== bot.seat || cProp.houses > 0 || cProp.isMortgaged) {
          return false;
        }
        if (candidate.colorGroup === group) return false;
        if (candidate.colorGroup) {
          const sameGroupOwned = MALAYSIA_BOARD_DATA.filter(
            (g) =>
              g.colorGroup === candidate.colorGroup &&
              this.getPropertyState(view, g.index)?.ownerSeat === bot.seat
          );
          if (sameGroupOwned.length > 1) return false;
          if (this.completesMonopoly(view, targetPlayer.seat, candidate.colorGroup, candidate.index)) {
            return false;
          }
        }
        return true;
      });

      if (tradeableSingle) {
        const offeredPropVal = tradeableSingle.cost ?? 100;
        const cashTopUp = Math.max(0, Math.round(targetValue * 1.25 - offeredPropVal));
        if (cashTopUp <= expendableCash) {
          this.lastTradeRoundBySeat.set(bot.seat, view.currentRound);
          return {
            type: 'proposeTrade',
            trade: {
              fromSeat: bot.seat,
              toSeat: targetPlayer.seat,
              offerCash: cashTopUp,
              offerProperties: [tradeableSingle.index],
              requestCash: 0,
              requestProperties: [missingSpace.index],
            },
          };
        }
      } else {
        const buyoutCash = Math.round(targetValue * 1.4);
        if (buyoutCash <= expendableCash) {
          this.lastTradeRoundBySeat.set(bot.seat, view.currentRound);
          return {
            type: 'proposeTrade',
            trade: {
              fromSeat: bot.seat,
              toSeat: targetPlayer.seat,
              offerCash: buyoutCash,
              offerProperties: [],
              requestCash: 0,
              requestProperties: [missingSpace.index],
            },
          };
        }
      }
    }

    return null;
  }

  private evaluateUnmortgage(
    view: MonopolyPlayerView,
    bot: MonopolyPlayerView['players'][number]
  ): MonopolyAction | null {
    if (bot.cash < 600) return null;

    for (const [idx, prop] of view.properties) {
      if (prop.ownerSeat === bot.seat && prop.isMortgaged) {
        const space = BOARD_SPACE_MAP.get(idx);
        if (space && space.cost) {
          const mortgageValue = space.mortgageValue ?? Math.floor(space.cost * 0.5);
          const unmortgageCost = Math.round(mortgageValue * 1.1);
          if (bot.cash - unmortgageCost >= 350) {
            return { type: 'unmortgageProperty', spaceIndex: idx };
          }
        }
      }
    }
    return null;
  }

  private ownsFullGroup(view: MonopolyPlayerView, seatIdx: number, group: ColorGroup): boolean {
    const groupSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.colorGroup === group);
    return groupSpaces.every((s) => this.getPropertyState(view, s.index)?.ownerSeat === seatIdx);
  }

  private evaluateDistressLiquidation(
    view: MonopolyPlayerView,
    bot: MonopolyPlayerView['players'][number]
  ): MonopolyAction {
    // 1. Mortgage isolated non-monopoly unimproved properties first (only 10% unmortgage interest vs 50% house loss)
    for (const [idx, prop] of view.properties) {
      if (prop.ownerSeat === bot.seat && !prop.isMortgaged && prop.houses === 0) {
        const space = BOARD_SPACE_MAP.get(idx);
        if (space && (!space.colorGroup || !this.ownsFullGroup(view, bot.seat, space.colorGroup))) {
          return { type: 'mortgageProperty', spaceIndex: idx };
        }
      }
    }

    // 2. Mortgage any remaining unimproved properties (0 houses across the group)
    for (const [idx, prop] of view.properties) {
      if (prop.ownerSeat === bot.seat && !prop.isMortgaged && prop.houses === 0) {
        const space = BOARD_SPACE_MAP.get(idx);
        if (space?.colorGroup) {
          const groupHasHouses = MALAYSIA_BOARD_DATA.some(
            (g) =>
              g.colorGroup === space.colorGroup &&
              (this.getPropertyState(view, g.index)?.houses ?? 0) > 0
          );
          if (!groupHasHouses) {
            return { type: 'mortgageProperty', spaceIndex: idx };
          }
        }
      }
    }

    // 3. Sell houses evenly when all unimproved mortgages are exhausted
    for (const [idx, prop] of view.properties) {
      if (prop.ownerSeat === bot.seat && prop.houses > 0) {
        const space = BOARD_SPACE_MAP.get(idx);
        if (space?.colorGroup) {
          const maxHousesInGroup = Math.max(
            ...MALAYSIA_BOARD_DATA.filter((g) => g.colorGroup === space.colorGroup).map(
              (g) => this.getPropertyState(view, g.index)?.houses ?? 0
            )
          );
          if (prop.houses === maxHousesInGroup) {
            return { type: 'sellHouse', spaceIndex: idx };
          }
        }
      }
    }

    // 4. If impossible to raise enough cash, declare bankruptcy
    return { type: 'declareBankruptcy' };
  }

  private evaluateTradeResponse(
    view: MonopolyPlayerView,
    bot: MonopolyPlayerView['players'][number],
    trade: TradeProposal
  ): MonopolyAction {
    if (trade.requestCash > bot.cash) {
      return { type: 'rejectTrade' };
    }

    // Check if trade hands opponent a monopoly
    let opponentGainsMonopoly = false;
    for (const propIdx of trade.requestProperties) {
      const space = BOARD_SPACE_MAP.get(propIdx);
      if (space?.colorGroup) {
        if (this.completesMonopoly(view, trade.fromSeat, space.colorGroup, propIdx)) {
          opponentGainsMonopoly = true;
          break;
        }
      }
    }
    if (opponentGainsMonopoly) {
      return { type: 'rejectTrade' };
    }

    // Evaluate Net Cash + Asset Delta
    const cashDelta = trade.offerCash - trade.requestCash;
    let offeredValue = 0;
    for (const p of trade.offerProperties) {
      offeredValue += BOARD_SPACE_MAP.get(p)?.cost ?? 100;
    }
    let requestedValue = 0;
    for (const p of trade.requestProperties) {
      requestedValue += BOARD_SPACE_MAP.get(p)?.cost ?? 100;
    }
    const netValueDelta = cashDelta + (offeredValue - requestedValue);

    // Check if trade gives bot a monopoly (accept up to a sensible strategic premium without exhausting cash)
    let gainsMonopoly = false;
    for (const propIdx of trade.offerProperties) {
      const space = BOARD_SPACE_MAP.get(propIdx);
      if (space?.colorGroup) {
        if (this.completesMonopoly(view, bot.seat, space.colorGroup, propIdx)) {
          gainsMonopoly = true;
          break;
        }
      }
    }

    if (gainsMonopoly) {
      const maxStrategicOverpay = Math.round(offeredValue * 0.9 + 120);
      const keepsMinimumReserve = bot.cash - trade.requestCash + trade.offerCash >= 80;
      if (keepsMinimumReserve && netValueDelta >= -maxStrategicOverpay) {
        return { type: 'acceptTrade' };
      }
      return { type: 'rejectTrade' };
    }

    if (netValueDelta >= 15 && bot.cash - trade.requestCash >= 120) {
      return { type: 'acceptTrade' };
    }

    return { type: 'rejectTrade' };
  }
}
