export type GameId = 'mahjong' | 'monopoly' | 'avalon';
export type ShellGameId = 'hub' | 'mahjong' | 'monopoly' | 'avalon';
export type GamePrefix = 'M' | 'P' | 'A';

export const PREFIX_TO_GAME_MAP: ReadonlyMap<GamePrefix, GameId> = new Map<GamePrefix, GameId>([
  ['M', 'mahjong'],
  ['P', 'monopoly'],
  ['A', 'avalon'],
]);

export const GAME_TO_PREFIX_MAP: ReadonlyMap<GameId, GamePrefix> = new Map<GameId, GamePrefix>([
  ['mahjong', 'M'],
  ['monopoly', 'P'],
  ['avalon', 'A'],
]);

export interface UniversalRoomInfo {
  readonly game: GameId;
  readonly roomCode: string;
}

export type ShellSoundType = 'click' | 'deal' | 'dice' | 'alert' | 'fanfare' | 'fail';

export interface GenericSeat {
  seat: number;
  kind: 'human' | 'bot' | 'open';
  name: string;
  token?: string | null;
  connected: boolean;
}

export interface GenericLobby<TSeat extends GenericSeat = GenericSeat, TRules = unknown> {
  started: boolean;
  seats: TSeat[];
  rules?: TRules;
}

export interface GenericSessionSnapshot<TView = unknown, TLobby = GenericLobby> {
  role: 'host' | 'guest';
  online: boolean;
  roomCode: string;
  status: string;
  error: string | null;
  mySeat: number;
  lobby: TLobby | null;
  view: TView | null;
}
