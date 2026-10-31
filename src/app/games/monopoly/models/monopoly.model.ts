import { GenericSeat } from '../../../core/models/party.model';

export type SpaceType =
  | 'corner_go'
  | 'corner_jail'
  | 'corner_parking'
  | 'corner_gotojail'
  | 'property'
  | 'transit'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'community_chest';

export type ColorGroup =
  | 'brown'
  | 'light_blue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'dark_blue';

export interface BoardSpace {
  readonly index: number;
  readonly id: string;
  readonly name: string;
  readonly shortName?: string;
  readonly icon?: string;
  readonly type: SpaceType;
  readonly colorGroup?: ColorGroup;
  readonly cost?: number;
  readonly baseRent?: number;
  readonly rentSchedule?: readonly [number, number, number, number, number, number]; // base, 1H, 2H, 3H, 4H, Hotel
  readonly houseCost?: number;
  readonly mortgageValue?: number;
}

export interface MonopolyPlayer {
  readonly seat: number;
  name: string;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  outOfJailCards: number;
  bankrupt: boolean;
  color: string;
}

export interface PropertyState {
  ownerSeat: number | null;
  houses: number; // 0..4 = houses, 5 = hotel
  isMortgaged: boolean;
}

export type ActionCardType =
  | 'advance_mula'
  | 'advance_position'
  | 'advance_nearest_transit'
  | 'advance_nearest_utility'
  | 'collect_bank'
  | 'pay_fines'
  | 'go_to_jail'
  | 'get_out_of_jail'
  | 'repairs'
  | 'collect_players'
  | 'pay_players'
  | 'back_spaces';

export interface ActionCard {
  readonly id: string;
  readonly deck: 'nasib' | 'dana';
  readonly titleKey: string;
  readonly descKey: string;
  readonly actionType: ActionCardType;
  readonly amount?: number;
  readonly targetPosition?: number;
  readonly backSpaces?: number;
  readonly perHouse?: number;
  readonly perHotel?: number;
}

export interface AuctionState {
  readonly spaceIndex: number;
  currentBid: number;
  highestBidderSeat: number | null;
  activeBidders: number[];
  timerSeconds: number;
}

export interface TradeProposal {
  readonly fromSeat: number;
  readonly toSeat: number;
  readonly offerCash: number;
  readonly offerProperties: readonly number[];
  readonly requestCash: number;
  readonly requestProperties: readonly number[];
}

export interface FinancialDistressDebt {
  readonly creditorSeat: number | 'bank' | 'jackpot';
  readonly amountOwed: number;
}

export type MonopolyTurnPhase =
  | 'roll'
  | 'action'
  | 'auction'
  | 'trade'
  | 'financialDistress'
  | 'gameOver';

export type MonopolyWinCondition = 'lastTycoon' | 'roundLimit';

export interface MonopolyLobbySettings {
  winCondition: MonopolyWinCondition;
  maxRounds: number;
  auctionEnabled: boolean;
  startingCash: number;
  freeParkingSeed: number;
  goSalary: number;
}

export interface MonopolySeat extends GenericSeat {
  seat: number;
  kind: 'human' | 'bot' | 'open';
  name: string;
  token?: string | null;
  connected: boolean;
  color: string;
}

export interface MonopolyMatchState {
  players: MonopolyPlayer[];
  properties: Map<number, PropertyState>;
  jackpotPot: number;
  currentRound: number;
  maxRounds: number;
  winCondition: MonopolyWinCondition;
  auctionEnabled: boolean;
  activeSeat: number;
  phase: MonopolyTurnPhase;
  doublesStreak: number;
  lastDice: [number, number];
  extraTurnAllowed: boolean;
  activeCard: ActionCard | null;
  activeAuction: AuctionState | null;
  pendingTrade: TradeProposal | null;
  debtTarget: FinancialDistressDebt | null;
  winnerSeat: number | null;
  gameOverReason: string | null;
  nasibDeck: ActionCard[];
  danaDeck: ActionCard[];
  logs: string[];
}

export interface MonopolyPlayerView {
  readonly players: readonly MonopolyPlayer[];
  readonly properties: readonly [number, PropertyState][];
  readonly jackpotPot: number;
  readonly currentRound: number;
  readonly maxRounds: number;
  readonly winCondition: MonopolyWinCondition;
  readonly auctionEnabled: boolean;
  readonly activeSeat: number;
  readonly phase: MonopolyTurnPhase;
  readonly doublesStreak: number;
  readonly lastDice: readonly [number, number];
  readonly extraTurnAllowed: boolean;
  readonly activeCard: ActionCard | null;
  readonly activeAuction: AuctionState | null;
  readonly pendingTrade: TradeProposal | null;
  readonly debtTarget: FinancialDistressDebt | null;
  readonly winnerSeat: number | null;
  readonly gameOverReason: string | null;
  readonly nasibDeckCount: number;
  readonly danaDeckCount: number;
  readonly logs: readonly string[];
}

export type MonopolyAction =
  | { type: 'rollDice' }
  | { type: 'buyProperty' }
  | { type: 'passProperty' }
  | { type: 'bidAuction'; amount: number }
  | { type: 'passAuction' }
  | { type: 'buildHouse'; spaceIndex: number }
  | { type: 'sellHouse'; spaceIndex: number }
  | { type: 'mortgageProperty'; spaceIndex: number }
  | { type: 'unmortgageProperty'; spaceIndex: number }
  | { type: 'payJailBail' }
  | { type: 'useJailCard' }
  | { type: 'proposeTrade'; trade: TradeProposal }
  | { type: 'acceptTrade' }
  | { type: 'rejectTrade' }
  | { type: 'declareBankruptcy' }
  | { type: 'endTurn' };

export const MONOPOLY_PLAYER_COLORS: readonly string[] = [
  '#e63946', // Red
  '#457b9d', // Blue
  '#2a9d8f', // Teal/Green
  '#e9c46a', // Gold/Yellow
  '#9b5de5', // Purple
  '#f4a261', // Orange
];

export const DEFAULT_MONOPOLY_SETTINGS: MonopolyLobbySettings = {
  winCondition: 'lastTycoon',
  maxRounds: 30,
  auctionEnabled: true,
  startingCash: 1500,
  freeParkingSeed: 100,
  goSalary: 200,
};
