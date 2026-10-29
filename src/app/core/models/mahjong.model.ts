export type GameMode = '4p' | '3p';
export type SuitType = 'm' | 'p' | 's';
export type SupportedLang = 'zh' | 'en' | 'ms';

export interface TileSpec {
  readonly code: string;
  readonly kind: 'suit' | 'honor' | 'bonus' | 'joker';
  readonly suit?: 'm' | 'p' | 's' | 'w' | 'd';
  readonly num?: number;
  readonly wind?: number;
  readonly dragon?: number;
  readonly bonusGroup?: 'season' | 'flower' | 'animal' | 'face';
  readonly flowerNum?: number;
  readonly top?: string;
  readonly bottom?: string;
  readonly glyph?: string;
  readonly tag?: string;
  readonly sub?: string;
  readonly color?: string;
  readonly name: string;
  readonly sort: number;
}

export interface GameRules {
  minFan: number;
  maxFan: number;
  concealedFan: boolean;
  sevenPairs: boolean;
  showHints?: boolean;
}

export interface FanItem {
  name: string;
  fan: number;
  limit?: boolean;
}

export interface MeldLike {
  type: 'chow' | 'pong' | 'kong';
  codes: string[];
  concealed?: boolean;
}

export interface Meld extends MeldLike {
  tileIds?: string[];
  concealed: boolean;
  fromSeat?: number | null;
}

export interface ChowOption {
  partnerCodes: [string, string];
  meldCodes: string[];
}

export interface WinEvalResult {
  isShapeValid: boolean;
  canWin: boolean;
  rawFan: number;
  cappedFan: number;
  items: FanItem[];
  shape?: string;
}

export interface WaitingTileInfo {
  code: string;
  canDiscardWin: boolean;
  discardFan: number;
  canSelfDrawWin: boolean;
  selfDrawFan: number;
}

export interface EvaluateWinParams {
  handIds: string[];
  melds?: MeldLike[];
  bonusIds?: string[];
  mode?: GameMode;
  seatWind?: number;
  roundWind?: number;
  selfDraw?: boolean;
  robbedKong?: boolean;
  kongReplacement?: boolean;
  lastTile?: boolean;
  heavenly?: boolean;
  earthly?: boolean;
  rules?: Partial<GameRules>;
}

export interface PlayerState {
  seat: number;
  seatWind: number;
  hand: string[];
  lastDrawnId: string | null;
  melds: Meld[];
  bonus: string[];
  discards: string[];
}

export interface PlayerPublicState {
  seat: number;
  seatWind: number;
  hand: string[] | null;
  handCount: number;
  lastDrawnId: string | null;
  melds: Meld[];
  bonus: string[];
  discards: string[];
}

export interface HandResult {
  outcome: 'win' | 'draw';
  winnerSeat: number | null;
  loserSeat: number | null;
  selfDraw: boolean;
  winningTileId?: string;
  fanResult: WinEvalResult | null;
  base?: number;
  deltas: number[];
  winningHand?: string[];
  winningMelds?: Meld[];
  winningBonus?: string[];
}

export type LegalActions =
  | {
      phase: 'turn';
      canDiscard: boolean;
      win: WinEvalResult | null;
      exposeFly: boolean;
      concealedKongs: string[];
      addedKongs: string[];
    }
  | {
      phase: 'claim';
      tileId: string;
      fromSeat: number;
      win: WinEvalResult | null;
      canKong: boolean;
      canPong: boolean;
      chows: ChowOption[];
    }
  | {
      phase: 'robKong';
      tileId: string;
      fromSeat: number;
      win: WinEvalResult | null;
    };

export interface PlayerView {
  mode: GameMode;
  numSeats: number;
  rules: GameRules;
  roundWind: number;
  dealerSeat: number;
  dealerStreak: number;
  handNumber: number;
  scores: number[];
  phase: 'lobby' | 'turn' | 'claim' | 'robKong' | 'handOver';
  wallCount: number;
  turnSeat: number;
  lastDiscard: { seat: number; tileId: string } | null;
  discardPool?: string[];
  viewerSeat: number;
  legalActions: LegalActions | null;
  players: PlayerPublicState[];
  log: string[];
  result: HandResult | null;
}

export interface GameAction {
  type:
    | 'win'
    | 'exposeFly'
    | 'concealedKong'
    | 'addedKong'
    | 'discard'
    | 'kong'
    | 'pong'
    | 'chow'
    | 'pass';
  tileId?: string;
  code?: string;
  chowIndex?: number;
}

export interface ClaimSeatEntry {
  winEval: WinEvalResult | null;
  canKong: boolean;
  canPong: boolean;
  chows: ChowOption[];
  decision: { type: GameAction['type']; chowIndex: number } | null;
}

export interface RobKongSeatEntry {
  winEval: WinEvalResult;
  decision: { type: 'win' | 'pass' } | null;
}

export interface MatchState {
  mode: GameMode;
  numSeats: number;
  rules: GameRules;
  roundWind: number;
  dealerSeat: number;
  dealerStreak: number;
  handNumber: number;
  scores: number[];
  phase: 'lobby' | 'turn' | 'claim' | 'robKong' | 'handOver';
  wall: string[];
  turnSeat: number;
  canSelfAct: boolean;
  kongReplacement: boolean;
  isFirstGoAround: boolean;
  turnsTaken: number[];
  lastDiscard: { seat: number; tileId: string } | null;
  discardPool: string[];
  pendingRobKong: {
    seat: number;
    meldIdx: number;
    tileId: string;
    bySeat: Map<number, RobKongSeatEntry>;
  } | null;
  pendingClaims: {
    fromSeat: number;
    tileId: string;
    bySeat: Map<number, ClaimSeatEntry>;
  } | null;
  players: PlayerState[];
  log: string[];
  result: HandResult | null;
}

export interface LobbySeat {
  seat: number;
  kind: 'human' | 'bot' | 'open';
  name: string;
  token: string | null;
  connected: boolean;
  windLabel: string;
}

export interface PublicLobby {
  mode: GameMode;
  rules: GameRules;
  started: boolean;
  seats: LobbySeat[];
}

export interface SessionSnapshot {
  role: 'host' | 'guest';
  online: boolean;
  roomCode: string;
  status: string;
  error: string | null;
  mySeat: number;
  lobby: PublicLobby | null;
  view: PlayerView | null;
}
