import { Inject, Injectable, Optional } from '@angular/core';
import {
  CITY_ADJACENCY_MAP,
  PANDEMIC_CITIES,
} from '../data/pandemic-cities.data';
import { ALL_EVENT_CARDS, ALL_SPECIALIST_ROLES } from '../data/pandemic-roles-events.data';
import {
  CityCubes,
  CityPlayerCard,
  createSerializableMap,
  CUBES_PER_COLOR,
  CureStatus,
  DifficultyLevel,
  DiseaseColor,
  EPIDEMIC_COUNT_MAP,
  EventCardId,
  HAND_LIMIT,
  INFECTION_RATES,
  InfectionCard,
  MAX_OUTBREAKS,
  MAX_RESEARCH_STATIONS,
  PandemicAction,
  PandemicMatchState,
  PandemicPhase,
  PandemicPlayerState,
  PandemicPlayerView,
  PlayerCard,
  SpecialistRole,
} from '../models/pandemic.model';

export interface PandemicSetupOptions {
  readonly difficulty?: DifficultyLevel;
  readonly numPlayers?: number;
  readonly roles?: readonly SpecialistRole[];
  readonly playerNames?: readonly string[];
  readonly rng?: () => number;
}

export interface LegalActionsSummary {
  readonly canDriveOrFerryTo: readonly string[];
  readonly canDirectFlightTo: readonly string[];
  readonly canCharterFlightTo: readonly string[];
  readonly canShuttleFlightTo: readonly string[];
  readonly canBuildStation: boolean;
  readonly canRelocateStationFrom: readonly string[];
  readonly canTreatDiseases: readonly DiseaseColor[];
  readonly canShareKnowledge: readonly { targetSeat: number; cardCityId: string }[];
  readonly canDiscoverCure: readonly DiseaseColor[];
  readonly canOperationsExpertFlightTo: readonly string[];
  readonly canDispatcherMoveToPawn: readonly { targetSeat: number; destinationSeat: number }[];
  readonly canContingencyPlannerTakeEvent: readonly EventCardId[];
  readonly playableEvents: readonly EventCardId[];
  readonly canEndActionsEarly: boolean;
  readonly canResolveEpidemicIntensify: boolean;
  readonly canResolveInfectStep: boolean;
}

function getCityColorCubes(cubes: CityCubes, color: DiseaseColor): number {
  switch (color) {
    case 'blue':
      return cubes.blue;
    case 'yellow':
      return cubes.yellow;
    case 'black':
      return cubes.black;
    case 'red':
      return cubes.red;
  }
}

function updateCityColorCubes(
  cubes: CityCubes,
  color: DiseaseColor,
  count: number
): CityCubes {
  switch (color) {
    case 'blue':
      return { ...cubes, blue: count };
    case 'yellow':
      return { ...cubes, yellow: count };
    case 'black':
      return { ...cubes, black: count };
    case 'red':
      return { ...cubes, red: count };
  }
}

function countTotalCubesOnBoard(
  state: PandemicMatchState,
  color: DiseaseColor
): number {
  let total = 0;
  for (const cubes of state.cityCubes.values()) {
    total += getCityColorCubes(cubes, color);
  }
  return total;
}

function shuffleArray<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    if (i === j) continue;
    const currentI = result.at(i);
    const currentJ = result.at(j);
    if (currentI !== undefined && currentJ !== undefined) {
      result.splice(i, 1, currentJ);
      result.splice(j, 1, currentI);
    }
  }
  return result;
}

@Injectable({
  providedIn: 'root',
})
export class PandemicEngineService {
  private readonly defaultRng: () => number;

  constructor(@Optional() @Inject('PANDEMIC_RNG') customRng?: () => number) {
    this.defaultRng = customRng ?? Math.random;
  }

  public createInitialState(options?: PandemicSetupOptions): PandemicMatchState {
    const rng = options?.rng ?? this.defaultRng;
    const difficulty: DifficultyLevel = options?.difficulty ?? 'standard';
    const numPlayers = Math.min(4, Math.max(2, options?.numPlayers ?? 4));

    // Choose unique roles
    let assignedRoles: SpecialistRole[];
    if (options?.roles && options.roles.length >= numPlayers) {
      assignedRoles = [...options.roles.slice(0, numPlayers)];
    } else {
      const shuffledRoles = shuffleArray(ALL_SPECIALIST_ROLES, rng);
      assignedRoles = shuffledRoles.slice(0, numPlayers);
    }

    // Initialize players at Atlanta
    const players: PandemicPlayerState[] = [];
    for (let i = 0; i < numPlayers; i++) {
      const defaultName = `Player ${i + 1}`;
      const role = assignedRoles.at(i) ?? 'medic';
      const name = options?.playerNames?.at(i) ?? defaultName;
      players.push({
        seat: i,
        name,
        role,
        cityId: 'atlanta',
        cards: [],
        operationsExpertFlightUsed: false,
        storedEventCard: null,
      });
    }

    // Build base player cards: 48 cities + 5 events
    const baseCards: PlayerCard[] = [];
    for (const city of PANDEMIC_CITIES) {
      baseCards.push({
        type: 'city',
        cityId: city.id,
        color: city.color,
      });
    }
    for (const eventId of ALL_EVENT_CARDS) {
      baseCards.push({
        type: 'event',
        eventId,
      });
    }

    const shuffledBaseCards = shuffleArray(baseCards, rng);

    // Initial hands: 2P -> 4 cards, 3P -> 3 cards, 4P -> 2 cards
    const initialHandSize = numPlayers === 2 ? 4 : numPlayers === 3 ? 3 : 2;
    for (let i = 0; i < numPlayers; i++) {
      const player = players.at(i);
      if (player) {
        for (let c = 0; c < initialHandSize; c++) {
          const card = shuffledBaseCards.pop();
          if (card) {
            player.cards.push(card);
          }
        }
      }
    }

    // Prepare Stratified Player Deck with Epidemic cards
    const epidemicCount = EPIDEMIC_COUNT_MAP.get(difficulty) ?? 5;
    const remainingCards = [...shuffledBaseCards];
    const piles: PlayerCard[][] = [];
    for (let p = 0; p < epidemicCount; p++) {
      piles.push([]);
    }

    // Distribute remaining cards into piles
    for (let i = 0; i < remainingCards.length; i++) {
      const pileIndex = i % epidemicCount;
      const targetPile = piles.at(pileIndex);
      const card = remainingCards.at(i);
      if (targetPile && card) {
        targetPile.push(card);
      }
    }

    // Add 1 epidemic card to each pile and shuffle it
    const shuffledPiles = piles.map((pile) => {
      pile.push({ type: 'epidemic' });
      return shuffleArray(pile, rng);
    });

    // Stack piles into final playerDeck (pile 0 on top)
    const playerDeck: PlayerCard[] = [];
    for (const pile of shuffledPiles) {
      playerDeck.push(...pile);
    }

    // City cubes map
    const cityCubes = createSerializableMap<string, CityCubes>();
    for (const city of PANDEMIC_CITIES) {
      cityCubes.set(city.id, { blue: 0, yellow: 0, black: 0, red: 0 });
    }

    const cubesRemaining = createSerializableMap<DiseaseColor, number>([
      ['blue', CUBES_PER_COLOR],
      ['yellow', CUBES_PER_COLOR],
      ['black', CUBES_PER_COLOR],
      ['red', CUBES_PER_COLOR],
    ]);

    const cureStatus = createSerializableMap<DiseaseColor, CureStatus>([
      ['blue', 'uncured'],
      ['yellow', 'uncured'],
      ['black', 'uncured'],
      ['red', 'uncured'],
    ]);

    // Infection Deck: 48 cards
    const rawInfectionCards: InfectionCard[] = PANDEMIC_CITIES.map((c) => ({
      cityId: c.id,
      color: c.color,
    }));
    const infectionDeck = shuffleArray(rawInfectionCards, rng);
    const infectionDiscard: InfectionCard[] = [];

    const state: PandemicMatchState = {
      gameId: 'pandemic',
      difficulty,
      phase: 'actions',
      previousPhase: null,
      activeSeat: 0,
      actionsRemaining: 4,
      players,
      researchStations: ['atlanta'],
      cityCubes,
      cubesRemaining,
      cureStatus,
      infectionRateIndex: 0,
      outbreakCount: 0,
      playerDeck,
      playerDiscard: [],
      infectionDeck,
      infectionDiscard,
      pendingEpidemics: 0,
      pendingEpidemicCityId: null,
      forecastCards: null,
      forecastPreviousPhase: null,
      oneQuietNightActive: false,
      discardQueue: [],
      winner: null,
      winReason: null,
      lossReason: null,
      logs: ['Pandemic game initialized with research station at Atlanta.'],
    };

    // Initial infection: 3 cities get 3 cubes, 3 get 2 cubes, 3 get 1 cube (18 cubes total)
    this.executeInitialInfection(state);

    return state;
  }

  private executeInitialInfection(state: PandemicMatchState): void {
    const counts = [3, 3, 3, 2, 2, 2, 1, 1, 1];
    for (const count of counts) {
      const card = state.infectionDeck.shift();
      if (!card) break;
      state.infectionDiscard.push(card);

      const current = state.cityCubes.get(card.cityId) ?? {
        blue: 0,
        yellow: 0,
        black: 0,
        red: 0,
      };
      const updated = updateCityColorCubes(current, card.color, count);
      state.cityCubes.set(card.cityId, updated);

      const supply = state.cubesRemaining.get(card.color) ?? CUBES_PER_COLOR;
      state.cubesRemaining.set(card.color, supply - count);
      state.logs.push(`Initial infection: ${count} ${card.color} cubes placed on ${card.cityId}`);
    }
  }

  public applyAction(
    state: PandemicMatchState,
    action: PandemicAction,
    actorSeat?: number,
    rng: () => number = this.defaultRng
  ): PandemicMatchState {
    if (state.phase === 'game_over') {
      throw new Error('Game is already over');
    }

    const currentActor = actorSeat ?? state.activeSeat;

    switch (action.type) {
      case 'driveOrFerry':
        this.handleDriveOrFerry(state, currentActor, action.toCityId);
        break;

      case 'directFlight':
        this.handleDirectFlight(state, currentActor, action.toCityId);
        break;

      case 'charterFlight':
        this.handleCharterFlight(state, currentActor, action.toCityId);
        break;

      case 'shuttleFlight':
        this.handleShuttleFlight(state, currentActor, action.toCityId);
        break;

      case 'dispatcherMoveToPawn':
        this.handleDispatcherMoveToPawn(
          state,
          currentActor,
          action.targetSeat,
          action.destinationSeat
        );
        break;

      case 'dispatcherMoveOther':
        this.handleDispatcherMoveOther(
          state,
          currentActor,
          action.targetSeat,
          action.moveType,
          action.toCityId,
          action.discardCardCityId
        );
        break;

      case 'operationsExpertFlight':
        this.handleOperationsExpertFlight(
          state,
          currentActor,
          action.toCityId,
          action.discardCardCityId
        );
        break;

      case 'buildStation':
        this.handleBuildStation(state, currentActor, action.relocateFromCityId);
        break;

      case 'treatDisease':
        this.handleTreatDisease(state, currentActor, action.color);
        break;

      case 'shareKnowledge':
        this.handleShareKnowledge(state, currentActor, action.targetSeat, action.cardCityId);
        break;

      case 'discoverCure':
        this.handleDiscoverCure(state, currentActor, action.color, action.cardCityIds);
        break;

      case 'contingencyPlannerTakeEvent':
        this.handleContingencyPlannerTakeEvent(state, currentActor, action.eventId);
        break;

      case 'playEvent':
        this.handlePlayEvent(state, action);
        break;

      case 'endActionsEarly':
        this.handleEndActionsEarly(state, currentActor);
        break;

      case 'resolveEpidemicIntensify':
        this.handleResolveEpidemicIntensify(state, rng);
        break;

      case 'confirmForecast':
        this.handleConfirmForecast(state, action.reorderedCityIds);
        break;

      case 'discardCard':
        this.handleDiscardCard(state, action.seat, action.cardIndex);
        break;

      case 'resolveInfectStep':
        this.handleResolveInfectStep(state);
        break;
    }

    return state;
  }

  // --- Movement Handlers ---

  private handleDriveOrFerry(
    state: PandemicMatchState,
    actorSeat: number,
    toCityId: string
  ): void {
    this.assertActionPhaseAndTurn(state, actorSeat);
    const actor = this.getPlayer(state, actorSeat);
    const neighbors = CITY_ADJACENCY_MAP.get(actor.cityId);
    if (!neighbors?.includes(toCityId)) {
      throw new Error(`Cannot drive/ferry from ${actor.cityId} to ${toCityId}: not adjacent`);
    }

    actor.cityId = toCityId;
    state.logs.push(`${actor.name} drove/ferried to ${toCityId}`);
    this.checkMedicAutoClean(state, toCityId);
    this.consumeAction(state);
  }

  private handleDirectFlight(
    state: PandemicMatchState,
    actorSeat: number,
    toCityId: string
  ): void {
    this.assertActionPhaseAndTurn(state, actorSeat);
    const actor = this.getPlayer(state, actorSeat);
    const cardIdx = actor.cards.findIndex(
      (c) => c.type === 'city' && c.cityId === toCityId
    );
    if (cardIdx === -1) {
      throw new Error(`Cannot direct flight to ${toCityId}: player lacks matching city card`);
    }

    const [discarded] = actor.cards.splice(cardIdx, 1);
    if (discarded) {
      state.playerDiscard.push(discarded);
    }
    actor.cityId = toCityId;
    state.logs.push(`${actor.name} took a direct flight to ${toCityId}`);
    this.checkMedicAutoClean(state, toCityId);
    this.consumeAction(state);
  }

  private handleCharterFlight(
    state: PandemicMatchState,
    actorSeat: number,
    toCityId: string
  ): void {
    this.assertActionPhaseAndTurn(state, actorSeat);
    const actor = this.getPlayer(state, actorSeat);
    const cardIdx = actor.cards.findIndex(
      (c) => c.type === 'city' && c.cityId === actor.cityId
    );
    if (cardIdx === -1) {
      throw new Error(`Cannot charter flight from ${actor.cityId}: lacks current city card`);
    }

    const [discarded] = actor.cards.splice(cardIdx, 1);
    if (discarded) {
      state.playerDiscard.push(discarded);
    }
    actor.cityId = toCityId;
    state.logs.push(`${actor.name} chartered a flight to ${toCityId}`);
    this.checkMedicAutoClean(state, toCityId);
    this.consumeAction(state);
  }

  private handleShuttleFlight(
    state: PandemicMatchState,
    actorSeat: number,
    toCityId: string
  ): void {
    this.assertActionPhaseAndTurn(state, actorSeat);
    const actor = this.getPlayer(state, actorSeat);
    if (!state.researchStations.includes(actor.cityId)) {
      throw new Error(`Cannot shuttle flight: origin ${actor.cityId} has no research station`);
    }
    if (!state.researchStations.includes(toCityId)) {
      throw new Error(`Cannot shuttle flight: destination ${toCityId} has no research station`);
    }
    if (actor.cityId === toCityId) {
      throw new Error(`Cannot shuttle flight to the same city`);
    }

    actor.cityId = toCityId;
    state.logs.push(`${actor.name} shuttled to research station at ${toCityId}`);
    this.checkMedicAutoClean(state, toCityId);
    this.consumeAction(state);
  }

  // --- Role Movement Specials ---

  private handleDispatcherMoveToPawn(
    state: PandemicMatchState,
    actorSeat: number,
    targetSeat: number,
    destinationSeat: number
  ): void {
    this.assertActionPhaseAndTurn(state, actorSeat);
    const actor = this.getPlayer(state, actorSeat);
    if (actor.role !== 'dispatcher') {
      throw new Error('Only Dispatcher can perform dispatcherMoveToPawn');
    }
    const target = this.getPlayer(state, targetSeat);
    const destination = this.getPlayer(state, destinationSeat);
    if (target.cityId === destination.cityId) {
      throw new Error('Target is already in destination pawn city');
    }

    target.cityId = destination.cityId;
    state.logs.push(
      `Dispatcher moved ${target.name} to ${destination.name}'s city (${destination.cityId})`
    );
    this.checkMedicAutoClean(state, destination.cityId);
    this.consumeAction(state);
  }

  private handleDispatcherMoveOther(
    state: PandemicMatchState,
    actorSeat: number,
    targetSeat: number,
    moveType: 'driveOrFerry' | 'directFlight' | 'charterFlight' | 'shuttleFlight',
    toCityId: string,
    discardCardCityId?: string
  ): void {
    this.assertActionPhaseAndTurn(state, actorSeat);
    const actor = this.getPlayer(state, actorSeat);
    if (actor.role !== 'dispatcher') {
      throw new Error('Only Dispatcher can perform dispatcherMoveOther');
    }
    const target = this.getPlayer(state, targetSeat);

    switch (moveType) {
      case 'driveOrFerry': {
        const neighbors = CITY_ADJACENCY_MAP.get(target.cityId);
        if (!neighbors?.includes(toCityId)) {
          throw new Error(`Target ${target.cityId} not adjacent to ${toCityId}`);
        }
        target.cityId = toCityId;
        break;
      }

      case 'directFlight': {
        const cardCity = discardCardCityId ?? toCityId;
        const cardIdx = actor.cards.findIndex(
          (c) => c.type === 'city' && c.cityId === cardCity
        );
        if (cardIdx === -1 || cardCity !== toCityId) {
          throw new Error('Dispatcher must discard destination city card to move other player');
        }
        const [discarded] = actor.cards.splice(cardIdx, 1);
        if (discarded) {
          state.playerDiscard.push(discarded);
        }
        target.cityId = toCityId;
        break;
      }

      case 'charterFlight': {
        const cardCity = discardCardCityId ?? target.cityId;
        const cardIdx = actor.cards.findIndex(
          (c) => c.type === 'city' && c.cityId === cardCity
        );
        if (cardIdx === -1 || cardCity !== target.cityId) {
          throw new Error('Dispatcher must discard target current city card for charter flight');
        }
        const [discarded] = actor.cards.splice(cardIdx, 1);
        if (discarded) {
          state.playerDiscard.push(discarded);
        }
        target.cityId = toCityId;
        break;
      }

      case 'shuttleFlight': {
        if (!state.researchStations.includes(target.cityId)) {
          throw new Error(`Origin ${target.cityId} has no research station`);
        }
        if (!state.researchStations.includes(toCityId)) {
          throw new Error(`Destination ${toCityId} has no research station`);
        }
        target.cityId = toCityId;
        break;
      }
    }

    state.logs.push(`Dispatcher moved ${target.name} to ${toCityId} via ${moveType}`);
    this.checkMedicAutoClean(state, toCityId);
    this.consumeAction(state);
  }

  private handleOperationsExpertFlight(
    state: PandemicMatchState,
    actorSeat: number,
    toCityId: string,
    discardCardCityId: string
  ): void {
    this.assertActionPhaseAndTurn(state, actorSeat);
    const actor = this.getPlayer(state, actorSeat);
    if (actor.role !== 'operations_expert') {
      throw new Error('Only Operations Expert can perform operationsExpertFlight');
    }
    if (!state.researchStations.includes(actor.cityId)) {
      throw new Error('Operations Expert must be at a research station to use special flight');
    }
    if (actor.operationsExpertFlightUsed) {
      throw new Error('Operations Expert special flight already used this turn');
    }

    const cardIdx = actor.cards.findIndex(
      (c) => c.type === 'city' && c.cityId === discardCardCityId
    );
    if (cardIdx === -1) {
      throw new Error('Must discard any city card for Operations Expert flight');
    }

    const [discarded] = actor.cards.splice(cardIdx, 1);
    if (discarded) {
      state.playerDiscard.push(discarded);
    }
    actor.cityId = toCityId;
    actor.operationsExpertFlightUsed = true;
    state.logs.push(
      `Operations Expert discarded ${discardCardCityId} to fly to ${toCityId}`
    );
    this.checkMedicAutoClean(state, toCityId);
    this.consumeAction(state);
  }

  // --- Research Station ---

  private handleBuildStation(
    state: PandemicMatchState,
    actorSeat: number,
    relocateFromCityId?: string
  ): void {
    this.assertActionPhaseAndTurn(state, actorSeat);
    const actor = this.getPlayer(state, actorSeat);

    if (state.researchStations.includes(actor.cityId)) {
      throw new Error(`City ${actor.cityId} already has a research station`);
    }

    if (actor.role !== 'operations_expert') {
      const cardIdx = actor.cards.findIndex(
        (c) => c.type === 'city' && c.cityId === actor.cityId
      );
      if (cardIdx === -1) {
        throw new Error(`Must discard ${actor.cityId} card to build a research station`);
      }
      const [discarded] = actor.cards.splice(cardIdx, 1);
      if (discarded) {
        state.playerDiscard.push(discarded);
      }
    }

    if (state.researchStations.length >= MAX_RESEARCH_STATIONS) {
      if (!relocateFromCityId || !state.researchStations.includes(relocateFromCityId)) {
        throw new Error(
          `Max stations (${MAX_RESEARCH_STATIONS}) reached; must specify existing relocateFromCityId`
        );
      }
      state.researchStations = state.researchStations.filter((s) => s !== relocateFromCityId);
      state.logs.push(`Relocating research station from ${relocateFromCityId} to ${actor.cityId}`);
    }

    state.researchStations.push(actor.cityId);
    state.logs.push(`${actor.name} built a research station at ${actor.cityId}`);
    this.consumeAction(state);
  }

  // --- Treat Disease ---

  private handleTreatDisease(
    state: PandemicMatchState,
    actorSeat: number,
    color: DiseaseColor
  ): void {
    this.assertActionPhaseAndTurn(state, actorSeat);
    const actor = this.getPlayer(state, actorSeat);
    const currentCubes = state.cityCubes.get(actor.cityId);
    const count = currentCubes ? getCityColorCubes(currentCubes, color) : 0;
    if (count <= 0) {
      throw new Error(`No ${color} cubes to treat in ${actor.cityId}`);
    }

    const isCuredOrMedic =
      state.cureStatus.get(color) !== 'uncured' || actor.role === 'medic';
    const removeCount = isCuredOrMedic ? count : 1;

    const updated = updateCityColorCubes(currentCubes ?? {
      blue: 0,
      yellow: 0,
      black: 0,
      red: 0,
    }, color, count - removeCount);
    state.cityCubes.set(actor.cityId, updated);

    const supply = state.cubesRemaining.get(color) ?? 0;
    state.cubesRemaining.set(color, supply + removeCount);
    state.logs.push(
      `${actor.name} treated ${removeCount} ${color} cubes in ${actor.cityId}`
    );

    this.checkEradication(state, color);
    this.consumeAction(state);
  }

  // --- Share Knowledge ---

  private handleShareKnowledge(
    state: PandemicMatchState,
    actorSeat: number,
    targetSeat: number,
    cardCityId: string
  ): void {
    this.assertActionPhaseAndTurn(state, actorSeat);
    const actor = this.getPlayer(state, actorSeat);
    const target = this.getPlayer(state, targetSeat);

    if (actor.cityId !== target.cityId) {
      throw new Error('Both players must be in the same city to share knowledge');
    }

    const actorHasCard = actor.cards.some(
      (c) => c.type === 'city' && c.cityId === cardCityId
    );
    const targetHasCard = target.cards.some(
      (c) => c.type === 'city' && c.cityId === cardCityId
    );

    if (!actorHasCard && !targetHasCard) {
      throw new Error(`Neither player holds the card ${cardCityId}`);
    }

    const giver = actorHasCard ? actor : target;
    const receiver = actorHasCard ? target : actor;

    // Researcher rule: if researcher is giving, can give ANY city card
    if (giver.role !== 'researcher' && cardCityId !== actor.cityId) {
      throw new Error(`Card must match current city (${actor.cityId}) unless Researcher is giving`);
    }

    const cardIdx = giver.cards.findIndex(
      (c) => c.type === 'city' && c.cityId === cardCityId
    );
    const [transferred] = giver.cards.splice(cardIdx, 1);
    if (transferred) {
      receiver.cards.push(transferred);
    }

    state.logs.push(
      `${giver.name} shared knowledge (${cardCityId}) with ${receiver.name}`
    );

    // If receiver exceeds hand limit, queue discard
    if (receiver.cards.length > HAND_LIMIT) {
      state.previousPhase = state.phase;
      state.phase = 'discard';
      state.discardQueue = [receiver.seat];
      state.logs.push(`${receiver.name} hand exceeds ${HAND_LIMIT} cards; must discard down`);
    }

    this.consumeAction(state);
  }

  // --- Discover Cure ---

  private handleDiscoverCure(
    state: PandemicMatchState,
    actorSeat: number,
    color: DiseaseColor,
    cardCityIds: readonly string[]
  ): void {
    this.assertActionPhaseAndTurn(state, actorSeat);
    const actor = this.getPlayer(state, actorSeat);

    if (!state.researchStations.includes(actor.cityId)) {
      throw new Error('Must be at a research station to discover a cure');
    }
    if (state.cureStatus.get(color) !== 'uncured') {
      throw new Error(`Disease ${color} is already cured or eradicated`);
    }

    const requiredCards = actor.role === 'scientist' ? 4 : 5;
    if (cardCityIds.length !== requiredCards) {
      throw new Error(
        `Discovering cure for ${actor.role} requires exactly ${requiredCards} cards, received ${cardCityIds.length}`
      );
    }

    // Verify all cards are held and match color
    for (const cityId of cardCityIds) {
      const card = actor.cards.find(
        (c) => c.type === 'city' && c.cityId === cityId && c.color === color
      );
      if (!card) {
        throw new Error(`Actor does not hold matching ${color} city card: ${cityId}`);
      }
    }

    // Discard the cards
    for (const cityId of cardCityIds) {
      const idx = actor.cards.findIndex(
        (c) => c.type === 'city' && c.cityId === cityId
      );
      const [discarded] = actor.cards.splice(idx, 1);
      if (discarded) {
        state.playerDiscard.push(discarded);
      }
    }

    state.cureStatus.set(color, 'cured');
    state.logs.push(`${actor.name} discovered the cure for ${color} disease!`);

    // Medic passive: auto-cleans newly cured disease in Medic's city
    for (const player of state.players) {
      if (player.role === 'medic') {
        this.checkMedicAutoClean(state, player.cityId);
      }
    }

    this.checkEradication(state, color);

    if (this.checkVictory(state)) {
      return;
    }

    this.consumeAction(state);
  }

  // --- Contingency Planner Special ---

  private handleContingencyPlannerTakeEvent(
    state: PandemicMatchState,
    actorSeat: number,
    eventId: EventCardId
  ): void {
    this.assertActionPhaseAndTurn(state, actorSeat);
    const actor = this.getPlayer(state, actorSeat);

    if (actor.role !== 'contingency_planner') {
      throw new Error('Only Contingency Planner can take stored event cards');
    }
    if (actor.storedEventCard !== null) {
      throw new Error('Contingency Planner already holds a stored event card');
    }

    const discardIdx = state.playerDiscard.findIndex(
      (c) => c.type === 'event' && c.eventId === eventId
    );
    if (discardIdx === -1) {
      throw new Error(`Event card ${eventId} not found in player discard pile`);
    }

    state.playerDiscard.splice(discardIdx, 1);
    actor.storedEventCard = eventId;
    state.logs.push(`Contingency Planner reclaimed event card ${eventId}`);
    this.consumeAction(state);
  }

  // --- Event Cards ---

  private handlePlayEvent(
    state: PandemicMatchState,
    action: Extract<PandemicAction, { type: 'playEvent' }>
  ): void {
    const player = this.getPlayer(state, action.seat);

    // Validate event preconditions before consuming card
    if (action.eventId === 'government_grant') {
      if (state.researchStations.includes(action.toCityId)) {
        throw new Error(`City ${action.toCityId} already has a research station`);
      }
      if (state.researchStations.length >= MAX_RESEARCH_STATIONS) {
        if (!action.relocateFromCityId || !state.researchStations.includes(action.relocateFromCityId)) {
          throw new Error(
            `Max stations reached; specify relocateFromCityId for Government Grant`
          );
        }
      }
    } else if (action.eventId === 'resilient_population') {
      const exists = state.infectionDiscard.some(
        (c) => c.cityId === action.cardCityId
      );
      if (!exists) {
        throw new Error(
          `Infection discard does not contain card for ${action.cardCityId}`
        );
      }
    }

    if (player.role === 'contingency_planner' && player.storedEventCard === action.eventId) {
      player.storedEventCard = null;
      state.logs.push(`${player.name} played stored event card ${action.eventId} (exiled from game)`);
    } else {
      const cardIdx = player.cards.findIndex(
        (c) => c.type === 'event' && c.eventId === action.eventId
      );
      if (cardIdx === -1) {
        throw new Error(`Player ${action.seat} does not hold event card ${action.eventId}`);
      }
      const [discarded] = player.cards.splice(cardIdx, 1);
      if (discarded) {
        state.playerDiscard.push(discarded);
      }
      state.logs.push(`${player.name} played event card ${action.eventId}`);
    }

    switch (action.eventId) {
      case 'airlift': {
        const target = this.getPlayer(state, action.targetSeat);
        target.cityId = action.toCityId;
        state.logs.push(`Airlift moved ${target.name} to ${action.toCityId}`);
        this.checkMedicAutoClean(state, action.toCityId);
        break;
      }

      case 'government_grant': {
        if (state.researchStations.length >= MAX_RESEARCH_STATIONS && action.relocateFromCityId) {
          state.researchStations = state.researchStations.filter(
            (s) => s !== action.relocateFromCityId
          );
        }
        state.researchStations.push(action.toCityId);
        state.logs.push(`Government Grant added research station at ${action.toCityId}`);
        break;
      }

      case 'one_quiet_night': {
        state.oneQuietNightActive = true;
        state.logs.push('One Quiet Night activated: the next infect cities step will be skipped');
        break;
      }

      case 'forecast': {
        const count = Math.min(6, state.infectionDeck.length);
        if (count > 0) {
          state.forecastPreviousPhase = state.phase;
          state.phase = 'forecast';
          state.forecastCards = state.infectionDeck.slice(0, count);
          state.logs.push(`Forecast drawn top ${count} infection cards for reordering`);
        }
        break;
      }

      case 'resilient_population': {
        const idx = state.infectionDiscard.findIndex(
          (c) => c.cityId === action.cardCityId
        );
        if (idx !== -1) {
          state.infectionDiscard.splice(idx, 1);
          state.logs.push(
            `Resilient Population permanently removed ${action.cardCityId} from infection discard`
          );
        }
        break;
      }
    }

    // Check if player had to discard down and playing this event satisfied hand limit
    if (state.phase === 'discard' && player.cards.length <= HAND_LIMIT) {
      state.discardQueue = state.discardQueue.filter((s) => s !== player.seat);
      if (state.discardQueue.length === 0) {
        state.phase = state.previousPhase ?? 'infect';
        state.previousPhase = null;
      }
    }
  }

  // --- Confirm Forecast ---

  private handleConfirmForecast(
    state: PandemicMatchState,
    reorderedCityIds: readonly string[]
  ): void {
    if (state.phase !== 'forecast' || !state.forecastCards) {
      throw new Error('Can only confirm forecast during forecast phase');
    }
    if (reorderedCityIds.length !== state.forecastCards.length) {
      throw new Error('Forecast reorder count does not match top cards count');
    }

    const reordered: InfectionCard[] = [];
    for (const cityId of reorderedCityIds) {
      const match = state.forecastCards.find((c) => c.cityId === cityId);
      if (!match) {
        throw new Error(`City ${cityId} is not part of current forecast cards`);
      }
      reordered.push(match);
    }

    const remainingDeck = state.infectionDeck.slice(state.forecastCards.length);
    state.infectionDeck = [...reordered, ...remainingDeck];
    state.forecastCards = null;
    state.phase = state.forecastPreviousPhase ?? 'actions';
    state.forecastPreviousPhase = null;
    state.logs.push('Forecast completed: top infection cards reordered.');
  }

  // --- Hand Limit Discard ---

  private handleDiscardCard(
    state: PandemicMatchState,
    seat: number,
    cardIndex: number
  ): void {
    if (state.phase !== 'discard') {
      throw new Error('Can only discard card during discard phase');
    }
    const player = this.getPlayer(state, seat);
    if (!state.discardQueue.includes(seat) && player.cards.length <= HAND_LIMIT) {
      throw new Error(`Player ${seat} does not need to discard`);
    }

    if (cardIndex < 0 || cardIndex >= player.cards.length) {
      throw new Error(`Invalid card index ${cardIndex}`);
    }

    const [discarded] = player.cards.splice(cardIndex, 1);
    if (discarded) {
      state.playerDiscard.push(discarded);
      state.logs.push(`${player.name} discarded a card to satisfy hand limit`);
    }

    if (player.cards.length <= HAND_LIMIT) {
      state.discardQueue = state.discardQueue.filter((s) => s !== seat);
      if (state.discardQueue.length === 0) {
        state.phase = state.previousPhase ?? 'infect';
        state.previousPhase = null;
      }
    }
  }

  // --- Stepper: Actions -> Draw 2 Player Cards ---

  private handleEndActionsEarly(
    state: PandemicMatchState,
    actorSeat: number
  ): void {
    this.assertActionPhaseAndTurn(state, actorSeat);
    state.actionsRemaining = 0;
    this.advanceToPlayerCardDraw(state);
  }

  private consumeAction(state: PandemicMatchState): void {
    state.actionsRemaining--;
    if (state.actionsRemaining <= 0) {
      this.advanceToPlayerCardDraw(state);
    }
  }

  private advanceToPlayerCardDraw(
    state: PandemicMatchState
  ): void {
    const activePlayer = this.getPlayer(state, state.activeSeat);

    // Draw 2 cards
    if (state.playerDeck.length < 2) {
      state.phase = 'game_over';
      state.winner = 'none';
      state.lossReason = 'DECK_EXHAUSTED';
      state.logs.push('Defeat: Player deck exhausted when trying to draw 2 cards.');
      return;
    }

    let epidemicsDrawn = 0;
    for (let i = 0; i < 2; i++) {
      const card = state.playerDeck.shift();
      if (!card) break;

      if (card.type === 'epidemic') {
        epidemicsDrawn++;
        state.logs.push(`EPIDEMIC ALERT: ${activePlayer.name} drew an Epidemic card!`);
      } else {
        activePlayer.cards.push(card);
      }
    }

    if (epidemicsDrawn > 0) {
      state.pendingEpidemics = epidemicsDrawn;
      this.triggerNextEpidemicInfection(state);
    } else {
      this.checkHandLimitAndProceed(state);
    }
  }

  private triggerNextEpidemicInfection(state: PandemicMatchState): void {
    // 1. Advance infection rate marker
    state.infectionRateIndex = Math.min(
      state.infectionRateIndex + 1,
      INFECTION_RATES.length - 1
    );

    // 2. Infect bottom card
    const bottomCard = state.infectionDeck.pop();
    if (bottomCard) {
      state.infectionDiscard.push(bottomCard);
      state.pendingEpidemicCityId = bottomCard.cityId;
      state.logs.push(
        `Epidemic infect step: 3 cubes placed on bottom card city ${bottomCard.cityId}`
      );
      this.placeCubes(state, bottomCard.cityId, bottomCard.color, 3, new Set<string>());
    }

    if (state.phase !== 'game_over') {
      state.phase = 'epidemic';
      state.logs.push(
        'Epidemic pause: Teammates have an event reaction window before Intensify is confirmed.'
      );
    }
  }

  // --- Stepper: Resolve Epidemic Intensify ---

  private handleResolveEpidemicIntensify(
    state: PandemicMatchState,
    rng: () => number
  ): void {
    if (state.phase !== 'epidemic') {
      throw new Error('Can only resolve epidemic intensify during epidemic phase');
    }

    // Shuffle infection discard onto top of infection deck
    const shuffledDiscard = shuffleArray(state.infectionDiscard, rng);
    state.infectionDeck = [...shuffledDiscard, ...state.infectionDeck];
    state.infectionDiscard = [];
    state.pendingEpidemicCityId = null;
    state.pendingEpidemics--;
    state.logs.push('Epidemic Intensify: Infection discard shuffled onto top of infection deck.');

    if (state.pendingEpidemics > 0) {
      this.triggerNextEpidemicInfection(state);
    } else {
      this.checkHandLimitAndProceed(state);
    }
  }

  private checkHandLimitAndProceed(state: PandemicMatchState): void {
    const overLimitSeats: number[] = [];
    for (const player of state.players) {
      if (player.cards.length > HAND_LIMIT) {
        overLimitSeats.push(player.seat);
      }
    }

    if (overLimitSeats.length > 0) {
      state.phase = 'discard';
      state.discardQueue = overLimitSeats;
      state.logs.push(
        `Hand limit exceeded for seat(s) ${overLimitSeats.join(', ')}; discarding down to ${HAND_LIMIT}`
      );
    } else {
      state.phase = 'infect';
    }
  }

  // --- Stepper: Resolve Infect Step ---

  private handleResolveInfectStep(state: PandemicMatchState): void {
    if (state.phase !== 'infect') {
      throw new Error('Can only resolve infect step during infect phase');
    }

    if (state.oneQuietNightActive) {
      state.oneQuietNightActive = false;
      state.logs.push('One Quiet Night skipped the infect cities step.');
    } else {
      const rate = INFECTION_RATES.at(state.infectionRateIndex) ?? 2;
      for (let i = 0; i < rate; i++) {
        if (state.infectionDeck.length === 0) break;
        const card = state.infectionDeck.shift();
        if (!card) break;
        state.infectionDiscard.push(card);
        state.logs.push(`Infecting ${card.cityId} with 1 ${card.color} cube`);
        this.placeCubes(state, card.cityId, card.color, 1, new Set<string>());
        if ((state.phase as PandemicPhase) === 'game_over') return;
      }
    }

    if ((state.phase as PandemicPhase) !== 'game_over') {
      // Advance to next specialist turn
      state.activeSeat = (state.activeSeat + 1) % state.players.length;
      state.actionsRemaining = 4;
      const nextPlayer = this.getPlayer(state, state.activeSeat);
      nextPlayer.operationsExpertFlightUsed = false;
      state.phase = 'actions';
      state.logs.push(`Next turn: ${nextPlayer.name} (${nextPlayer.role}) with 4 actions.`);
    }
  }

  // --- Cube Placement & Outbreaks ---

  public placeCubes(
    state: PandemicMatchState,
    cityId: string,
    color: DiseaseColor,
    count: number,
    outbrokenSet: Set<string> = new Set<string>()
  ): void {
    if (state.phase === 'game_over') return;

    if (state.cureStatus.get(color) === 'eradicated') {
      state.logs.push(`Disease ${color} is eradicated; 0 cubes placed on ${cityId}.`);
      return;
    }

    if (this.isCityProtectedByQuarantine(state, cityId)) {
      state.logs.push(`Quarantine Specialist prevented cube placement on ${cityId}.`);
      return;
    }

    if (this.isCityProtectedByMedic(state, cityId, color)) {
      state.logs.push(`Medic prevented placement of cured ${color} cubes on ${cityId}.`);
      return;
    }

    const currentCubes = state.cityCubes.get(cityId) ?? {
      blue: 0,
      yellow: 0,
      black: 0,
      red: 0,
    };
    let currentCount = getCityColorCubes(currentCubes, color);

    for (let i = 0; i < count; i++) {
      if ((state.phase as PandemicPhase) === 'game_over') return;

      if (currentCount < 3) {
        const supply = state.cubesRemaining.get(color) ?? 0;
        if (supply <= 0) {
          state.cubesRemaining.set(color, -1);
          state.phase = 'game_over';
          state.winner = 'none';
          state.lossReason = 'OUT_OF_CUBES';
          state.logs.push(`Defeat: Out of ${color} disease cubes!`);
          return;
        }

        state.cubesRemaining.set(color, supply - 1);
        currentCount++;
        const updated = updateCityColorCubes(
          state.cityCubes.get(cityId) ?? currentCubes,
          color,
          currentCount
        );
        state.cityCubes.set(cityId, updated);
      } else {
        // Outbreak!
        if (outbrokenSet.has(cityId)) {
          break;
        }
        outbrokenSet.add(cityId);
        state.outbreakCount++;
        state.logs.push(
          `OUTBREAK of ${color} in ${cityId}! Outbreak meter: ${state.outbreakCount}/${MAX_OUTBREAKS}`
        );

        if (state.outbreakCount >= MAX_OUTBREAKS) {
          state.phase = 'game_over';
          state.winner = 'none';
          state.lossReason = 'TOO_MANY_OUTBREAKS';
          state.logs.push('Defeat: 8 outbreaks occurred!');
          return;
        }

        const neighbors = CITY_ADJACENCY_MAP.get(cityId) ?? [];
        for (const neighbor of neighbors) {
          this.placeCubes(state, neighbor, color, 1, outbrokenSet);
          if ((state.phase as PandemicPhase) === 'game_over') return;
        }
        break;
      }
    }
  }

  // --- Role Passives & Checks ---

  private isCityProtectedByQuarantine(
    state: PandemicMatchState,
    cityId: string
  ): boolean {
    const qs = state.players.find((p) => p.role === 'quarantine_specialist');
    if (!qs) return false;
    if (qs.cityId === cityId) return true;
    const neighbors = CITY_ADJACENCY_MAP.get(qs.cityId);
    return neighbors?.includes(cityId) ?? false;
  }

  private isCityProtectedByMedic(
    state: PandemicMatchState,
    cityId: string,
    color: DiseaseColor
  ): boolean {
    if (state.cureStatus.get(color) === 'uncured') return false;
    return state.players.some((p) => p.role === 'medic' && p.cityId === cityId);
  }

  private checkMedicAutoClean(state: PandemicMatchState, cityId: string): void {
    const medic = state.players.find(
      (p) => p.role === 'medic' && p.cityId === cityId
    );
    if (!medic) return;

    const currentCubes = state.cityCubes.get(cityId);
    if (!currentCubes) return;

    const colors: readonly DiseaseColor[] = ['blue', 'yellow', 'black', 'red'];
    let updatedCubes = currentCubes;

    for (const color of colors) {
      if (state.cureStatus.get(color) !== 'uncured') {
        const count = getCityColorCubes(updatedCubes, color);
        if (count > 0) {
          updatedCubes = updateCityColorCubes(updatedCubes, color, 0);
          const supply = state.cubesRemaining.get(color) ?? 0;
          state.cubesRemaining.set(color, supply + count);
          state.logs.push(
            `Medic passively cleared ${count} cured ${color} cubes in ${cityId}`
          );
          this.checkEradication(state, color);
        }
      }
    }

    state.cityCubes.set(cityId, updatedCubes);
  }

  private checkEradication(
    state: PandemicMatchState,
    color: DiseaseColor
  ): void {
    if (state.cureStatus.get(color) === 'cured') {
      if (countTotalCubesOnBoard(state, color) === 0) {
        state.cureStatus.set(color, 'eradicated');
        state.logs.push(`Disease ${color} has been ERADICATED!`);
      }
    }
  }

  private checkVictory(state: PandemicMatchState): boolean {
    const colors: readonly DiseaseColor[] = ['blue', 'yellow', 'black', 'red'];
    const allCured = colors.every((c) => state.cureStatus.get(c) !== 'uncured');
    if (allCured) {
      state.phase = 'game_over';
      state.winner = 'players';
      state.winReason = 'ALL_CURES_DISCOVERED';
      state.logs.push('VICTORY: All 4 disease cures discovered!');
      return true;
    }
    return false;
  }

  // --- Anti-Cheat Player View Sanitizer ---

  public getPandemicPlayerView(
    state: PandemicMatchState,
    viewerSeat: number
  ): PandemicPlayerView {
    const playersCopy = state.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      role: p.role,
      cityId: p.cityId,
      cards: [...p.cards],
      operationsExpertFlightUsed: p.operationsExpertFlightUsed,
      storedEventCard: p.storedEventCard,
    }));

    return {
      gameId: 'pandemic',
      difficulty: state.difficulty,
      phase: state.phase,
      activeSeat: state.activeSeat,
      actionsRemaining: state.actionsRemaining,
      mySeat: viewerSeat,
      players: playersCopy,
      researchStations: [...state.researchStations],
      cityCubes: createSerializableMap(state.cityCubes.entries()),
      cubesRemaining: createSerializableMap(state.cubesRemaining.entries()),
      cureStatus: createSerializableMap(state.cureStatus.entries()),
      infectionRateIndex: state.infectionRateIndex,
      outbreakCount: state.outbreakCount,
      playerDeckCount: state.playerDeck.length,
      playerDiscard: [...state.playerDiscard],
      infectionDeckCount: state.infectionDeck.length,
      infectionDiscard: [...state.infectionDiscard],
      pendingEpidemicCityId:
        state.phase === 'epidemic' ? state.pendingEpidemicCityId : null,
      forecastCards:
        state.phase === 'forecast' && state.forecastCards
          ? [...state.forecastCards]
          : null,
      oneQuietNightActive: state.oneQuietNightActive,
      discardQueue: [...state.discardQueue],
      winner: state.winner,
      winReason: state.winReason,
      lossReason: state.lossReason,
      logs: [...state.logs],
    };
  }

  // --- Query Helpers ---

  public getLegalActions(
    state: PandemicMatchState | PandemicPlayerView,
    seat: number
  ): LegalActionsSummary {
    const player = state.players.find((p) => p.seat === seat);
    if (!player) {
      return {
        canDriveOrFerryTo: [],
        canDirectFlightTo: [],
        canCharterFlightTo: [],
        canShuttleFlightTo: [],
        canBuildStation: false,
        canRelocateStationFrom: [],
        canTreatDiseases: [],
        canShareKnowledge: [],
        canDiscoverCure: [],
        canOperationsExpertFlightTo: [],
        canDispatcherMoveToPawn: [],
        canContingencyPlannerTakeEvent: [],
        playableEvents: [],
        canEndActionsEarly: false,
        canResolveEpidemicIntensify: false,
        canResolveInfectStep: false,
      };
    }

    const isTurnAndActions =
      state.phase === 'actions' &&
      state.activeSeat === seat &&
      state.actionsRemaining > 0;

    // Movement
    const canDriveOrFerryTo: string[] = isTurnAndActions
      ? [...(CITY_ADJACENCY_MAP.get(player.cityId) ?? [])]
      : [];

    const canDirectFlightTo: string[] = isTurnAndActions
      ? player.cards
          .filter((c): c is CityPlayerCard => c.type === 'city' && c.cityId !== player.cityId)
          .map((c) => c.cityId)
      : [];

    const hasCurrentCityCard = player.cards.some(
      (c) => c.type === 'city' && c.cityId === player.cityId
    );
    const canCharterFlightTo: string[] =
      isTurnAndActions && hasCurrentCityCard
        ? PANDEMIC_CITIES.map((c) => c.id).filter((id) => id !== player.cityId)
        : [];

    const isAtStation = state.researchStations.includes(player.cityId);
    const canShuttleFlightTo: string[] =
      isTurnAndActions && isAtStation
        ? state.researchStations.filter((id) => id !== player.cityId)
        : [];

    // Build Station
    const canBuildStation =
      isTurnAndActions &&
      !isAtStation &&
      (player.role === 'operations_expert' || hasCurrentCityCard);

    const canRelocateStationFrom: string[] =
      canBuildStation && state.researchStations.length >= MAX_RESEARCH_STATIONS
        ? [...state.researchStations]
        : [];

    // Treat Disease
    const canTreatDiseases: DiseaseColor[] = [];
    if (isTurnAndActions) {
      const cubes = state.cityCubes.get(player.cityId);
      if (cubes) {
        const colors: readonly DiseaseColor[] = ['blue', 'yellow', 'black', 'red'];
        for (const col of colors) {
          if (getCityColorCubes(cubes, col) > 0) {
            canTreatDiseases.push(col);
          }
        }
      }
    }

    // Share Knowledge
    const canShareKnowledge: { targetSeat: number; cardCityId: string }[] = [];
    if (isTurnAndActions) {
      for (const other of state.players) {
        if (other.seat !== seat && other.cityId === player.cityId) {
          if (hasCurrentCityCard) {
            canShareKnowledge.push({ targetSeat: other.seat, cardCityId: player.cityId });
          }
          if (other.cards.some((c) => c.type === 'city' && c.cityId === player.cityId)) {
            canShareKnowledge.push({ targetSeat: other.seat, cardCityId: player.cityId });
          }
          if (player.role === 'researcher') {
            for (const card of player.cards) {
              if (card.type === 'city' && card.cityId !== player.cityId) {
                canShareKnowledge.push({ targetSeat: other.seat, cardCityId: card.cityId });
              }
            }
          }
        }
      }
    }

    // Discover Cure
    const canDiscoverCure: DiseaseColor[] = [];
    if (isTurnAndActions && isAtStation) {
      const required = player.role === 'scientist' ? 4 : 5;
      const colors: readonly DiseaseColor[] = ['blue', 'yellow', 'black', 'red'];
      for (const col of colors) {
        if (state.cureStatus.get(col) === 'uncured') {
          const matchingCards = player.cards.filter(
            (c) => c.type === 'city' && c.color === col
          );
          if (matchingCards.length >= required) {
            canDiscoverCure.push(col);
          }
        }
      }
    }

    // Role Specials
    const canOperationsExpertFlightTo: string[] =
      isTurnAndActions &&
      player.role === 'operations_expert' &&
      isAtStation &&
      !player.operationsExpertFlightUsed &&
      player.cards.some((c) => c.type === 'city')
        ? PANDEMIC_CITIES.map((c) => c.id).filter((id) => id !== player.cityId)
        : [];

    const canDispatcherMoveToPawn: { targetSeat: number; destinationSeat: number }[] = [];
    if (isTurnAndActions && player.role === 'dispatcher') {
      for (const target of state.players) {
        for (const dest of state.players) {
          if (target.seat !== dest.seat && target.cityId !== dest.cityId) {
            canDispatcherMoveToPawn.push({
              targetSeat: target.seat,
              destinationSeat: dest.seat,
            });
          }
        }
      }
    }

    const canContingencyPlannerTakeEvent: EventCardId[] = [];
    if (
      isTurnAndActions &&
      player.role === 'contingency_planner' &&
      player.storedEventCard === null
    ) {
      for (const card of state.playerDiscard) {
        if (card.type === 'event' && !canContingencyPlannerTakeEvent.includes(card.eventId)) {
          canContingencyPlannerTakeEvent.push(card.eventId);
        }
      }
    }

    // Playable Events anytime
    const playableEvents: EventCardId[] = [];
    for (const card of player.cards) {
      if (card.type === 'event' && !playableEvents.includes(card.eventId)) {
        playableEvents.push(card.eventId);
      }
    }
    if (player.role === 'contingency_planner' && player.storedEventCard) {
      playableEvents.push(player.storedEventCard);
    }

    return {
      canDriveOrFerryTo,
      canDirectFlightTo,
      canCharterFlightTo,
      canShuttleFlightTo,
      canBuildStation,
      canRelocateStationFrom,
      canTreatDiseases,
      canShareKnowledge,
      canDiscoverCure,
      canOperationsExpertFlightTo,
      canDispatcherMoveToPawn,
      canContingencyPlannerTakeEvent,
      playableEvents,
      canEndActionsEarly: isTurnAndActions,
      canResolveEpidemicIntensify: state.phase === 'epidemic',
      canResolveInfectStep: state.phase === 'infect',
    };
  }

  // --- Private Helpers ---

  private getPlayer(state: PandemicMatchState, seat: number): PandemicPlayerState {
    const player = state.players.find((p) => p.seat === seat);
    if (!player) {
      throw new Error(`Player with seat ${seat} not found`);
    }
    return player;
  }

  private assertActionPhaseAndTurn(state: PandemicMatchState, seat: number): void {
    if (state.phase !== 'actions') {
      throw new Error(`Action not permitted during phase: ${state.phase}`);
    }
    if (state.activeSeat !== seat) {
      throw new Error(`Not player ${seat}'s turn (current active seat: ${state.activeSeat})`);
    }
    if (state.actionsRemaining <= 0) {
      throw new Error('No actions remaining');
    }
  }
}
