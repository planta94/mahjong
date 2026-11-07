import { GenericSeat } from '../../../core/models/party.model';

export type DrivetrainType = 'ICE' | 'EV';

export type CarPersonaId = 'red' | 'blue' | 'yellow' | 'emerald' | 'purple';

export type ActionCardId = 2 | 3 | 4 | 5 | 0;

export type TrafficEventId = 'SMARTLANE' | 'REMPIT' | 'JEM' | 'KEMALANGAN';

export type RoadCardKind = 'START' | 'STANDARD' | 'SIMPANG_TIGA' | 'FINISH';

export type StandardCorridor = 'RIGHT' | 'LEFT' | 'TRUNK';
export type SimpangCorridor = 'KUBUR' | 'BENDANG' | 'UTAMA';
export type RoadCorridor = StandardCorridor | SimpangCorridor | 'FINISH';

export type SpaceFeature =
  | 'CLEAR'
  | 'AWAS'
  | 'RNR'
  | 'WARUNG'
  | 'OBSTACLE'
  | 'TOLL'
  | 'SPEED_BUMP'
  | 'MUD_ENTRY'
  | 'SCRAPE_ENTRY'
  | 'KAMPUNG';

export type BalikKampungPhase =
  | 'PLANNING'
  | 'RESOLVING'
  | 'EV_CHARGE_PROMPT'
  | 'SIMPANG_SCOUT_PROMPT'
  | 'GAMEOVER';

export interface RoadSegmentCard {
  readonly cardId: string;
  readonly kind: RoadCardKind;
  readonly titleKey: string;
  readonly km: number;
  readonly hasInterchange: boolean;
  readonly isDownhill: boolean;
  readonly right: readonly [SpaceFeature, SpaceFeature];
  readonly left: readonly [SpaceFeature, SpaceFeature];
  readonly trunk: readonly [SpaceFeature, SpaceFeature];
}

export interface ActiveRoadCard {
  trackOrder: number;
  card: RoadSegmentCard;
  awasDisarmed: boolean;
  hasHazardCone: boolean;
}

export interface TrackPosition {
  trackOrder: number;
  lane: RoadCorridor;
  slot: number;
}

export interface RempitSwarmState {
  pos: TrackPosition;
  active: boolean;
}

export interface BalikKampungMoveTrace {
  moveSeq: number;
  seat: number;
  trail: TrackPosition[];
}

export interface ReachableMoveOption {
  optionId: string;
  destination: TrackPosition;
  trail?: TrackPosition[];
  isScoutFrontier: boolean;
  scoutStepsRemaining: number;
  crossedAwasOrders: number[];
  crossedDownhillOrders: number[];
  passedTarget: boolean;
  slipstreamApplied: boolean;
  pitStopKind: 'NONE' | 'RNR' | 'WARUNG' | 'SHOULDER';
  enteringSimpangBranch: SimpangCorridor | null;
  overshootSpaces: number;
  totalEffectiveSpeed: number;
}

export interface BalikKampungSeat extends GenericSeat {
  drivetrain: DrivetrainType;
  persona: CarPersonaId;
}

export interface BalikKampungLobbySettings {
  numPlayers: number;
}

export interface BalikKampungPlayer {
  seat: number;
  name: string;
  isBot: boolean;
  persona: CarPersonaId;
  drivetrain: DrivetrainType;
  pos: TrackPosition;
  bladder: number;
  stress: number;
  scoutTokens: number;
  hand: ActionCardId[];
  discardPile: ActionCardId[];
  isSkipNext: boolean;
  skippedThisRound: boolean;
  fuelDumpUsed: boolean;
  evInstantTorqueReady: boolean;
  evInstantTorqueActiveThisRound: boolean;
  evFastChargeBonusReady: number;
  evFastChargeBonusActiveThisRound: number;
  mudTrapped: boolean;
  plannedCard: ActionCardId | null;
  plannedFuelDump: boolean;
  hasLockedPlan: boolean;
  revealedCard: ActionCardId | null;
  revealedFuelDump: boolean;
  finishedRank: number | null;
  finishedRound: number | null;
  finishedOvershoot: number;
}

export interface BalikKampungPublicPlayer {
  seat: number;
  name: string;
  isBot: boolean;
  persona: CarPersonaId;
  drivetrain: DrivetrainType;
  pos: TrackPosition;
  bladder: number;
  stress: number;
  scoutTokens: number;
  hand: ActionCardId[];
  discardPile: ActionCardId[];
  isSkipNext: boolean;
  skippedThisRound: boolean;
  fuelDumpUsed: boolean;
  evInstantTorqueReady: boolean;
  evInstantTorqueActiveThisRound: boolean;
  evFastChargeBonusReady: number;
  evFastChargeBonusActiveThisRound: number;
  mudTrapped: boolean;
  hasLockedPlan: boolean;
  myPlannedCard: ActionCardId | null;
  myPlannedFuelDump: boolean;
  revealedCard: ActionCardId | null;
  revealedFuelDump: boolean;
  finishedRank: number | null;
  finishedRound: number | null;
  finishedOvershoot: number;
}

export interface FinalStandingEntry {
  seat: number;
  name: string;
  persona: CarPersonaId;
  drivetrain: DrivetrainType;
  standingPlace: number;
  finishedRank: number | null;
  arrivalBonus: number;
  stressPenalty: number;
  bladderPenalty: number;
  netHappiness: number;
}

export interface BalikKampungLogEntry {
  round: number;
  key: string;
  params?: Record<string, string | number>;
  tone: 'info' | 'warn' | 'good' | 'danger';
}

export interface BalikKampungMatchState {
  phase: BalikKampungPhase;
  roundNumber: number;
  players: BalikKampungPlayer[];
  visibleTrack: ActiveRoadCard[];
  roadDeck: RoadSegmentCard[];
  finishCard: RoadSegmentCard;
  trafficDeck: TrafficEventId[];
  trafficDiscard: TrafficEventId[];
  activeTrafficEvent: TrafficEventId;
  rempit: RempitSwarmState;
  resolutionQueue: number[];
  activeSeat: number;
  reachableOptions: ReachableMoveOption[];
  pendingScoutSteps: number;
  pendingScoutPlayedSpeed: number;
  pendingScoutPassedTarget: boolean;
  simpangTigaDrawn: boolean;
  rnrBanned: boolean;
  nextFinishRank: number;
  lastDiceRoll: number | null;
  lastCoinFlip: 'HEADS' | 'TAILS' | null;
  recentMoves?: BalikKampungMoveTrace[];
  standings: FinalStandingEntry[];
  logs: BalikKampungLogEntry[];
}

export interface BalikKampungPlayerView {
  phase: BalikKampungPhase;
  roundNumber: number;
  players: BalikKampungPublicPlayer[];
  visibleTrack: ActiveRoadCard[];
  roadDeckCount: number;
  inDangerZone: boolean;
  trafficDeckCount: number;
  activeTrafficEvent: TrafficEventId;
  rempit: RempitSwarmState;
  resolutionQueue: number[];
  activeSeat: number;
  reachableOptions: ReachableMoveOption[];
  playableCards: ActionCardId[];
  simpangTigaDrawn: boolean;
  rnrBanned: boolean;
  lastDiceRoll: number | null;
  lastCoinFlip: 'HEADS' | 'TAILS' | null;
  recentMoves?: BalikKampungMoveTrace[];
  standings: FinalStandingEntry[];
  logs: BalikKampungLogEntry[];
}

export type BalikKampungAction =
  | {
      type: 'LOBBY_SET_DRIVETRAIN';
      drivetrain: DrivetrainType;
    }
  | {
      type: 'LOBBY_SET_PERSONA';
      persona: CarPersonaId;
    }
  | {
      type: 'SELECT_PLAN';
      cardId: ActionCardId;
      useFuelDump?: boolean;
    }
  | {
      type: 'UNSELECT_PLAN';
    }
  | {
      type: 'COMMIT_MOVE';
      optionId: string;
      spendScoutOnAwas?: boolean;
    }
  | {
      type: 'CHOOSE_EV_CHARGE';
      mode: 'AC_SLOW' | 'DC_FAST';
    }
  | {
      type: 'CHOOSE_SCOUTED_SIMPANG';
      branch: SimpangCorridor;
    };

export interface BalikKampungInitConfig {
  seats: Array<{
    seat: number;
    name: string;
    isBot: boolean;
    drivetrain: DrivetrainType;
    persona: CarPersonaId;
  }>;
  rng?: () => number;
}
