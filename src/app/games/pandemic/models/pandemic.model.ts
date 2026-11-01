import { GenericSeat } from '../../../core/models/party.model';

export type DiseaseColor = 'blue' | 'yellow' | 'black' | 'red';

export type CureStatus = 'uncured' | 'cured' | 'eradicated';

export type SpecialistRole =
  | 'medic'
  | 'scientist'
  | 'researcher'
  | 'dispatcher'
  | 'operations_expert'
  | 'quarantine_specialist'
  | 'contingency_planner';

export type EventCardId =
  | 'airlift'
  | 'government_grant'
  | 'one_quiet_night'
  | 'forecast'
  | 'resilient_population';

export type DifficultyLevel = 'introductory' | 'standard' | 'heroic';

export type PandemicPhase =
  | 'actions'
  | 'epidemic'
  | 'forecast'
  | 'discard'
  | 'infect'
  | 'game_over';

export interface CityPlayerCard {
  readonly type: 'city';
  readonly cityId: string;
  readonly color: DiseaseColor;
}

export interface EventPlayerCard {
  readonly type: 'event';
  readonly eventId: EventCardId;
}

export interface EpidemicPlayerCard {
  readonly type: 'epidemic';
}

export type PlayerCard = CityPlayerCard | EventPlayerCard | EpidemicPlayerCard;

export interface InfectionCard {
  readonly cityId: string;
  readonly color: DiseaseColor;
}

export interface CityCubes {
  readonly blue: number;
  readonly yellow: number;
  readonly black: number;
  readonly red: number;
}

export interface PandemicPlayerState {
  readonly seat: number;
  name: string;
  role: SpecialistRole;
  cityId: string;
  cards: PlayerCard[];
  operationsExpertFlightUsed: boolean;
  storedEventCard: EventCardId | null;
}

export interface PandemicSeat extends GenericSeat {
  role?: SpecialistRole | 'random';
}

export interface PandemicLobbySettings {
  difficulty: DifficultyLevel;
  numPlayers: number;
  roles?: SpecialistRole[];
  soloCommander?: boolean;
}

export const INFECTION_RATES: readonly number[] = [2, 2, 2, 3, 3, 4, 4];
export const MAX_OUTBREAKS = 8;
export const MAX_RESEARCH_STATIONS = 6;
export const CUBES_PER_COLOR = 24;
export const HAND_LIMIT = 7;
export const EPIDEMIC_COUNT_MAP: ReadonlyMap<DifficultyLevel, number> = new Map<DifficultyLevel, number>([
  ['introductory', 4],
  ['standard', 5],
  ['heroic', 6],
]);

export type PandemicAction =
  | { readonly type: 'driveOrFerry'; readonly toCityId: string }
  | { readonly type: 'directFlight'; readonly toCityId: string }
  | { readonly type: 'charterFlight'; readonly toCityId: string }
  | { readonly type: 'shuttleFlight'; readonly toCityId: string }
  | {
      readonly type: 'dispatcherMoveToPawn';
      readonly targetSeat: number;
      readonly destinationSeat: number;
    }
  | {
      readonly type: 'dispatcherMoveOther';
      readonly targetSeat: number;
      readonly moveType: 'driveOrFerry' | 'directFlight' | 'charterFlight' | 'shuttleFlight';
      readonly toCityId: string;
      readonly discardCardCityId?: string;
    }
  | {
      readonly type: 'operationsExpertFlight';
      readonly toCityId: string;
      readonly discardCardCityId: string;
    }
  | { readonly type: 'buildStation'; readonly relocateFromCityId?: string }
  | { readonly type: 'treatDisease'; readonly color: DiseaseColor }
  | {
      readonly type: 'shareKnowledge';
      readonly targetSeat: number;
      readonly cardCityId: string;
    }
  | {
      readonly type: 'discoverCure';
      readonly color: DiseaseColor;
      readonly cardCityIds: readonly string[];
    }
  | {
      readonly type: 'contingencyPlannerTakeEvent';
      readonly eventId: EventCardId;
    }
  | {
      readonly type: 'playEvent';
      readonly seat: number;
      readonly eventId: 'airlift';
      readonly targetSeat: number;
      readonly toCityId: string;
    }
  | {
      readonly type: 'playEvent';
      readonly seat: number;
      readonly eventId: 'government_grant';
      readonly toCityId: string;
      readonly relocateFromCityId?: string;
    }
  | {
      readonly type: 'playEvent';
      readonly seat: number;
      readonly eventId: 'one_quiet_night';
    }
  | {
      readonly type: 'playEvent';
      readonly seat: number;
      readonly eventId: 'forecast';
    }
  | {
      readonly type: 'playEvent';
      readonly seat: number;
      readonly eventId: 'resilient_population';
      readonly cardCityId: string;
    }
  | { readonly type: 'resolveEpidemicIntensify' }
  | {
      readonly type: 'confirmForecast';
      readonly reorderedCityIds: readonly string[];
    }
  | {
      readonly type: 'discardCard';
      readonly seat: number;
      readonly cardIndex: number;
    }
  | { readonly type: 'resolveInfectStep' }
  | { readonly type: 'endActionsEarly' };

export interface PandemicMatchState {
  readonly gameId: 'pandemic';
  difficulty: DifficultyLevel;
  phase: PandemicPhase;
  previousPhase: PandemicPhase | null;
  activeSeat: number;
  actionsRemaining: number;
  players: PandemicPlayerState[];
  researchStations: string[];
  cityCubes: Map<string, CityCubes>;
  cubesRemaining: Map<DiseaseColor, number>;
  cureStatus: Map<DiseaseColor, CureStatus>;
  infectionRateIndex: number;
  outbreakCount: number;
  playerDeck: PlayerCard[];
  playerDiscard: PlayerCard[];
  infectionDeck: InfectionCard[];
  infectionDiscard: InfectionCard[];
  pendingEpidemics: number;
  pendingEpidemicCityId: string | null;
  forecastCards: InfectionCard[] | null;
  forecastPreviousPhase: PandemicPhase | null;
  oneQuietNightActive: boolean;
  discardQueue: number[];
  winner: 'players' | 'none' | null;
  winReason: 'ALL_CURES_DISCOVERED' | null;
  lossReason: 'TOO_MANY_OUTBREAKS' | 'OUT_OF_CUBES' | 'DECK_EXHAUSTED' | null;
  logs: string[];
}

export interface PandemicPlayerView {
  readonly gameId: 'pandemic';
  readonly difficulty: DifficultyLevel;
  readonly phase: PandemicPhase;
  readonly activeSeat: number;
  readonly actionsRemaining: number;
  readonly mySeat: number;
  readonly players: readonly PandemicPlayerState[];
  readonly researchStations: readonly string[];
  readonly cityCubes: Map<string, CityCubes>;
  readonly cubesRemaining: Map<DiseaseColor, number>;
  readonly cureStatus: Map<DiseaseColor, CureStatus>;
  readonly infectionRateIndex: number;
  readonly outbreakCount: number;
  readonly playerDeckCount: number;
  readonly playerDiscard: readonly PlayerCard[];
  readonly infectionDeckCount: number;
  readonly infectionDiscard: readonly InfectionCard[];
  readonly pendingEpidemicCityId: string | null;
  readonly forecastCards: readonly InfectionCard[] | null;
  readonly oneQuietNightActive: boolean;
  readonly discardQueue: readonly number[];
  readonly winner: 'players' | 'none' | null;
  readonly winReason: 'ALL_CURES_DISCOVERED' | null;
  readonly lossReason: 'TOO_MANY_OUTBREAKS' | 'OUT_OF_CUBES' | 'DECK_EXHAUSTED' | null;
  readonly logs: readonly string[];
}

export function createSerializableMap<K, V>(
  entries?: Iterable<readonly [K, V]>
): Map<K, V> {
  const map = new Map<K, V>(entries);
  Object.defineProperty(map, 'toJSON', {
    value: () => Array.from(map.entries()),
    enumerable: false,
    configurable: true,
  });
  return map;
}

export function coerceToMap<K, V>(input: unknown): Map<K, V> {
  if (input instanceof Map) {
    return createSerializableMap(input.entries());
  }
  if (Array.isArray(input)) {
    return createSerializableMap(input as [K, V][]);
  }
  if (typeof input === 'object' && input !== null) {
    const entries = Object.entries(input).map(([k, v]) => {
      const numKey = Number(k);
      const parsedKey = !Number.isNaN(numKey) && String(numKey) === k ? numKey : k;
      return [parsedKey, v] as unknown as [K, V];
    });
    return createSerializableMap(entries);
  }
  return createSerializableMap();
}

export function hydratePandemicPlayerView(raw: PandemicPlayerView): PandemicPlayerView {
  const cityCubes = coerceToMap<string, CityCubes>(raw.cityCubes);
  const cubesRemaining = coerceToMap<DiseaseColor, number>(raw.cubesRemaining);
  const cureStatus = coerceToMap<DiseaseColor, CureStatus>(raw.cureStatus);

  return {
    ...raw,
    cityCubes,
    cubesRemaining,
    cureStatus,
  };
}
