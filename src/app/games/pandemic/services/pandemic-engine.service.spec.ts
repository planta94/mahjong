import { TestBed } from '@angular/core/testing';
import {
  CITY_ADJACENCY_MAP,
  PACIFIC_WRAPAROUND_ROUTES,
  PANDEMIC_CITIES,
  PANDEMIC_CITIES_MAP,
} from '../data/pandemic-cities.data';
import {
  ALL_EVENT_CARDS,
  ALL_SPECIALIST_ROLES,
  getEventSpec,
  getRoleSpec,
} from '../data/pandemic-roles-events.data';
import {
  CityCubes,
  coerceToMap,
  createSerializableMap,
  CUBES_PER_COLOR,
  DiseaseColor,
  EventCardId,
  HAND_LIMIT,
  hydratePandemicPlayerView,
  MAX_OUTBREAKS,
  MAX_RESEARCH_STATIONS,
  PandemicMatchState,
  PandemicPlayerView,
  SpecialistRole,
} from '../models/pandemic.model';
import { PandemicEngineService } from './pandemic-engine.service';

describe('PandemicEngineService & Domain State Machine', () => {
  let service: PandemicEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PandemicEngineService],
    });
    service = TestBed.inject(PandemicEngineService);
  });

  // --- 1. Graph & Symmetrical Adjacency ---

  describe('City Graph & Metadata', () => {
    it('contains exactly 48 cities with 12 cities per color', () => {
      expect(PANDEMIC_CITIES.length).toBe(48);

      const blueCities = PANDEMIC_CITIES.filter((c) => c.color === 'blue');
      const yellowCities = PANDEMIC_CITIES.filter((c) => c.color === 'yellow');
      const blackCities = PANDEMIC_CITIES.filter((c) => c.color === 'black');
      const redCities = PANDEMIC_CITIES.filter((c) => c.color === 'red');

      expect(blueCities.length).toBe(12);
      expect(yellowCities.length).toBe(12);
      expect(blackCities.length).toBe(12);
      expect(redCities.length).toBe(12);
    });

    it('has 100% bidirectional symmetrical city adjacency', () => {
      for (const city of PANDEMIC_CITIES) {
        for (const neighborId of city.neighbors) {
          const neighbor = PANDEMIC_CITIES_MAP.get(neighborId);
          expect(neighbor?.id).toBe(neighborId);
          const reciprocalNeighbors = CITY_ADJACENCY_MAP.get(neighborId);
          expect(reciprocalNeighbors?.includes(city.id)).toBe(true);
        }
      }
    });

    it('includes all 3 classic Pacific wraparound routes', () => {
      expect(PACIFIC_WRAPAROUND_ROUTES.length).toBe(3);

      const sfNeighbors = CITY_ADJACENCY_MAP.get('san_francisco');
      const tokyoNeighbors = CITY_ADJACENCY_MAP.get('tokyo');
      const manilaNeighbors = CITY_ADJACENCY_MAP.get('manila');
      const laNeighbors = CITY_ADJACENCY_MAP.get('los_angeles');
      const sydneyNeighbors = CITY_ADJACENCY_MAP.get('sydney');

      expect(sfNeighbors?.includes('tokyo')).toBe(true);
      expect(tokyoNeighbors?.includes('san_francisco')).toBe(true);

      expect(sfNeighbors?.includes('manila')).toBe(true);
      expect(manilaNeighbors?.includes('san_francisco')).toBe(true);

      expect(laNeighbors?.includes('sydney')).toBe(true);
      expect(sydneyNeighbors?.includes('los_angeles')).toBe(true);
    });

    it('has all city coordinates within 1000x520 viewBox bounds', () => {
      for (const city of PANDEMIC_CITIES) {
        expect(city.x).toBeGreaterThan(0);
        expect(city.x).toBeLessThan(1000);
        expect(city.y).toBeGreaterThan(0);
        expect(city.y).toBeLessThan(520);
      }
    });

    it('provides role and event specifications with correct metadata', () => {
      expect(ALL_SPECIALIST_ROLES.length).toBe(7);
      expect(ALL_EVENT_CARDS.length).toBe(5);

      const medicSpec = getRoleSpec('medic');
      expect(medicSpec.id).toBe('medic');
      expect(medicSpec.nameKey).toBe('PANDEMIC.ROLE_MEDIC_NAME');

      const airliftSpec = getEventSpec('airlift');
      expect(airliftSpec.id).toBe('airlift');
      expect(airliftSpec.nameKey).toBe('PANDEMIC.EVENT_AIRLIFT_NAME');

      expect(() => getRoleSpec('invalid_role' as SpecialistRole)).toThrowError(
        /Unknown role/
      );
      expect(() => getEventSpec('invalid_event' as EventCardId)).toThrowError(
        /Unknown event card/
      );
    });
  });

  // --- 2. Initial Setup & Stratified Deck ---

  describe('Initial Game Setup', () => {
    it('sets up 4-player game with Atlanta station, pawns, and 2 cards each', () => {
      const state = service.createInitialState({ numPlayers: 4 });

      expect(state.players.length).toBe(4);
      expect(state.activeSeat).toBe(0);
      expect(state.actionsRemaining).toBe(4);
      expect(state.phase).toBe('actions');
      expect(state.researchStations).toEqual(['atlanta']);
      expect(state.outbreakCount).toBe(0);
      expect(state.infectionRateIndex).toBe(0);

      for (const player of state.players) {
        expect(player.cityId).toBe('atlanta');
        expect(player.cards.length).toBe(2);
      }
    });

    it('deals 4 cards in 2-player game and 3 cards in 3-player game', () => {
      const state2P = service.createInitialState({ numPlayers: 2 });
      expect(state2P.players.length).toBe(2);
      expect(state2P.players.at(0)?.cards.length).toBe(4);
      expect(state2P.players.at(1)?.cards.length).toBe(4);

      const state3P = service.createInitialState({ numPlayers: 3 });
      expect(state3P.players.length).toBe(3);
      expect(state3P.players.at(0)?.cards.length).toBe(3);
      expect(state3P.players.at(1)?.cards.length).toBe(3);
      expect(state3P.players.at(2)?.cards.length).toBe(3);
    });

    it('infects exactly 9 cities initially with 18 total cubes', () => {
      const state = service.createInitialState();
      expect(state.infectionDiscard.length).toBe(9);

      let totalCubesOnBoard = 0;
      let citiesWith3 = 0;
      let citiesWith2 = 0;
      let citiesWith1 = 0;

      for (const cubes of state.cityCubes.values()) {
        const sum = cubes.blue + cubes.yellow + cubes.black + cubes.red;
        totalCubesOnBoard += sum;
        if (sum === 3) citiesWith3++;
        if (sum === 2) citiesWith2++;
        if (sum === 1) citiesWith1++;
      }

      expect(totalCubesOnBoard).toBe(18);
      expect(citiesWith3).toBe(3);
      expect(citiesWith2).toBe(3);
      expect(citiesWith1).toBe(3);
    });

    it('stratifies player deck with correct epidemic count based on difficulty', () => {
      const introState = service.createInitialState({ difficulty: 'introductory' });
      const standardState = service.createInitialState({ difficulty: 'standard' });
      const heroicState = service.createInitialState({ difficulty: 'heroic' });

      const introEpi = introState.playerDeck.filter((c) => c.type === 'epidemic').length;
      const standardEpi = standardState.playerDeck.filter((c) => c.type === 'epidemic').length;
      const heroicEpi = heroicState.playerDeck.filter((c) => c.type === 'epidemic').length;

      expect(introEpi).toBe(4);
      expect(standardEpi).toBe(5);
      expect(heroicEpi).toBe(6);
    });

    it('respects explicitly provided specialist roles and player names', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['medic', 'scientist'],
        playerNames: ['Alice', 'Bob'],
      });

      expect(state.players.at(0)?.name).toBe('Alice');
      expect(state.players.at(0)?.role).toBe('medic');
      expect(state.players.at(1)?.name).toBe('Bob');
      expect(state.players.at(1)?.role).toBe('scientist');
    });
  });

  // --- 3. Movement Actions ---

  describe('Movement Actions', () => {
    let state: PandemicMatchState;

    beforeEach(() => {
      state = service.createInitialState({
        numPlayers: 2,
        roles: ['dispatcher', 'medic'],
      });
      state.players[0].cityId = 'atlanta';
    });

    it('drives to an adjacent city and decrements actions remaining', () => {
      service.applyAction(state, { type: 'driveOrFerry', toCityId: 'chicago' });

      expect(state.players.at(0)?.cityId).toBe('chicago');
      expect(state.actionsRemaining).toBe(3);
    });

    it('throws error when driving to a non-adjacent city', () => {
      expect(() => {
        service.applyAction(state, { type: 'driveOrFerry', toCityId: 'tokyo' });
      }).toThrowError(/not adjacent/);
    });

    it('takes direct flight by discarding destination city card', () => {
      state.players[0].cards = [
        { type: 'city', cityId: 'tokyo', color: 'red' },
      ];

      service.applyAction(state, { type: 'directFlight', toCityId: 'tokyo' });

      expect(state.players.at(0)?.cityId).toBe('tokyo');
      expect(state.players.at(0)?.cards.length).toBe(0);
      expect(state.playerDiscard.some((c) => c.type === 'city' && c.cityId === 'tokyo')).toBe(
        true
      );
      expect(state.actionsRemaining).toBe(3);
    });

    it('throws error on direct flight without matching city card', () => {
      state.players[0].cards = [];
      expect(() => {
        service.applyAction(state, { type: 'directFlight', toCityId: 'tokyo' });
      }).toThrowError(/lacks matching city card/);
    });

    it('takes charter flight by discarding current city card', () => {
      state.players[0].cards = [
        { type: 'city', cityId: 'atlanta', color: 'blue' },
      ];

      service.applyAction(state, { type: 'charterFlight', toCityId: 'sydney' });

      expect(state.players.at(0)?.cityId).toBe('sydney');
      expect(state.players.at(0)?.cards.length).toBe(0);
      expect(state.playerDiscard.some((c) => c.type === 'city' && c.cityId === 'atlanta')).toBe(
        true
      );
      expect(state.actionsRemaining).toBe(3);
    });

    it('throws error on charter flight without current city card', () => {
      state.players[0].cards = [];
      expect(() => {
        service.applyAction(state, { type: 'charterFlight', toCityId: 'sydney' });
      }).toThrowError(/lacks current city card/);
    });

    it('takes shuttle flight between two research stations', () => {
      state.researchStations.push('paris');

      service.applyAction(state, { type: 'shuttleFlight', toCityId: 'paris' });

      expect(state.players.at(0)?.cityId).toBe('paris');
      expect(state.actionsRemaining).toBe(3);
    });

    it('throws error on shuttle flight if origin or destination has no station', () => {
      expect(() => {
        service.applyAction(state, { type: 'shuttleFlight', toCityId: 'paris' });
      }).toThrowError(/has no research station/);

      state.players[0].cityId = 'chicago';
      expect(() => {
        service.applyAction(state, { type: 'shuttleFlight', toCityId: 'atlanta' });
      }).toThrowError(/has no research station/);
    });

    it('throws error on shuttle flight to the same city', () => {
      expect(() => {
        service.applyAction(state, { type: 'shuttleFlight', toCityId: 'atlanta' });
      }).toThrowError(/same city/);
    });
  });

  // --- 4. Research Stations ---

  describe('Research Stations & Operations Expert', () => {
    it('normal player builds station by discarding matching city card', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['scientist', 'medic'],
      });
      state.players[0].cityId = 'chicago';
      state.players[0].cards = [
        { type: 'city', cityId: 'chicago', color: 'blue' },
      ];

      service.applyAction(state, { type: 'buildStation' });

      expect(state.researchStations.includes('chicago')).toBe(true);
      expect(state.players[0].cards.length).toBe(0);
      expect(state.actionsRemaining).toBe(3);
    });

    it('throws error if normal player lacks matching city card to build station', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['scientist', 'medic'],
      });
      state.players[0].cityId = 'chicago';
      state.players[0].cards = [];

      expect(() => {
        service.applyAction(state, { type: 'buildStation' });
      }).toThrowError(/Must discard chicago card/);
    });

    it('operations expert builds station without discarding card', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['operations_expert', 'medic'],
      });
      state.players[0].cityId = 'chicago';
      state.players[0].cards = [];

      service.applyAction(state, { type: 'buildStation' });

      expect(state.researchStations.includes('chicago')).toBe(true);
      expect(state.actionsRemaining).toBe(3);
    });

    it('relocates station when 6 stations cap is reached', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['operations_expert', 'medic'],
      });
      state.researchStations = [
        'atlanta',
        'chicago',
        'washington',
        'london',
        'paris',
        'essen',
      ];
      expect(state.researchStations.length).toBe(MAX_RESEARCH_STATIONS);

      state.players[0].cityId = 'tokyo';

      service.applyAction(state, {
        type: 'buildStation',
        relocateFromCityId: 'essen',
      });

      expect(state.researchStations.length).toBe(MAX_RESEARCH_STATIONS);
      expect(state.researchStations.includes('essen')).toBe(false);
      expect(state.researchStations.includes('tokyo')).toBe(true);
    });

    it('operations expert can fly from station to any city by discarding any card once per turn', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['operations_expert', 'medic'],
      });
      state.players[0].cityId = 'atlanta';
      state.players[0].cards = [
        { type: 'city', cityId: 'london', color: 'blue' },
      ];

      service.applyAction(state, {
        type: 'operationsExpertFlight',
        toCityId: 'sydney',
        discardCardCityId: 'london',
      });

      expect(state.players[0].cityId).toBe('sydney');
      expect(state.players[0].operationsExpertFlightUsed).toBe(true);
      expect(state.players[0].cards.length).toBe(0);

      // Cannot use twice in same turn
      state.players[0].cityId = 'atlanta';
      state.players[0].cards = [
        { type: 'city', cityId: 'paris', color: 'blue' },
      ];
      expect(() => {
        service.applyAction(state, {
          type: 'operationsExpertFlight',
          toCityId: 'tokyo',
          discardCardCityId: 'paris',
        });
      }).toThrowError(/already used this turn/);
    });
  });

  // --- 5. Treat Disease & Eradication ---

  describe('Treat Disease & Eradication', () => {
    let state: PandemicMatchState;

    beforeEach(() => {
      state = service.createInitialState({
        numPlayers: 2,
        roles: ['scientist', 'dispatcher'],
      });
      state.players[0].cityId = 'atlanta';
    });

    it('treats 1 uncured cube for 1 action', () => {
      state.cityCubes.set('atlanta', { blue: 3, yellow: 0, black: 0, red: 0 });
      state.cubesRemaining.set('blue', 21);

      service.applyAction(state, { type: 'treatDisease', color: 'blue' });

      expect(state.cityCubes.get('atlanta')?.blue).toBe(2);
      expect(state.cubesRemaining.get('blue')).toBe(22);
      expect(state.actionsRemaining).toBe(3);
    });

    it('treats ALL cubes in 1 action when disease is cured', () => {
      state.cureStatus.set('blue', 'cured');
      state.cityCubes.set('atlanta', { blue: 3, yellow: 0, black: 0, red: 0 });
      state.cubesRemaining.set('blue', 20);

      service.applyAction(state, { type: 'treatDisease', color: 'blue' });

      expect(state.cityCubes.get('atlanta')?.blue).toBe(0);
      expect(state.cubesRemaining.get('blue')).toBe(23);
      expect(state.actionsRemaining).toBe(3);
    });

    it('auto-transitions from cured to eradicated when all cubes cleared', () => {
      state.cureStatus.set('blue', 'cured');
      // Clear all blue cubes everywhere except 1 on Atlanta
      for (const city of PANDEMIC_CITIES) {
        state.cityCubes.set(city.id, { blue: 0, yellow: 0, black: 0, red: 0 });
      }
      state.cityCubes.set('atlanta', { blue: 1, yellow: 0, black: 0, red: 0 });

      service.applyAction(state, { type: 'treatDisease', color: 'blue' });

      expect(state.cureStatus.get('blue')).toBe('eradicated');
    });

    it('throws error when treating a disease with 0 cubes', () => {
      state.cityCubes.set('atlanta', { blue: 0, yellow: 0, black: 0, red: 0 });
      expect(() => {
        service.applyAction(state, { type: 'treatDisease', color: 'blue' });
      }).toThrowError(/No blue cubes to treat/);
    });
  });

  // --- 6. Share Knowledge & Researcher ---

  describe('Share Knowledge', () => {
    it('shares matching current city card when both players in same city', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['scientist', 'medic'],
      });
      state.players[0].cityId = 'atlanta';
      state.players[1].cityId = 'atlanta';
      state.players[0].cards = [
        { type: 'city', cityId: 'atlanta', color: 'blue' },
      ];
      state.players[1].cards = [];

      service.applyAction(state, {
        type: 'shareKnowledge',
        targetSeat: 1,
        cardCityId: 'atlanta',
      });

      expect(state.players[0].cards.length).toBe(0);
      expect(state.players[1].cards.length).toBe(1);
      expect(state.players[1].cards.at(0)?.type).toBe('city');
      expect(state.actionsRemaining).toBe(3);
    });

    it('throws error when sharing non-current city card for standard players', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['scientist', 'medic'],
      });
      state.players[0].cityId = 'atlanta';
      state.players[1].cityId = 'atlanta';
      state.players[0].cards = [
        { type: 'city', cityId: 'tokyo', color: 'red' },
      ];

      expect(() => {
        service.applyAction(state, {
          type: 'shareKnowledge',
          targetSeat: 1,
          cardCityId: 'tokyo',
        });
      }).toThrowError(/Card must match current city/);
    });

    it('researcher can give ANY city card in hand to someone in same city', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['researcher', 'medic'],
      });
      state.players[0].cityId = 'atlanta';
      state.players[1].cityId = 'atlanta';
      state.players[0].cards = [
        { type: 'city', cityId: 'tokyo', color: 'red' },
      ];
      state.players[1].cards = [];

      service.applyAction(state, {
        type: 'shareKnowledge',
        targetSeat: 1,
        cardCityId: 'tokyo',
      });

      expect(state.players[0].cards.length).toBe(0);
      expect(state.players[1].cards.length).toBe(1);
      expect(state.actionsRemaining).toBe(3);
    });

    it('triggers discard phase when receiving card causes hand to exceed limit', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['researcher', 'medic'],
      });
      state.players[0].cityId = 'atlanta';
      state.players[1].cityId = 'atlanta';
      state.players[0].cards = [
        { type: 'city', cityId: 'tokyo', color: 'red' },
      ];
      state.players[1].cards = Array.from({ length: 7 }, (_, i) => ({
        type: 'city',
        cityId: `city_${i}`,
        color: 'blue' as DiseaseColor,
      }));

      service.applyAction(state, {
        type: 'shareKnowledge',
        targetSeat: 1,
        cardCityId: 'tokyo',
      });

      expect(state.phase).toBe('discard');
      expect(state.discardQueue).toEqual([1]);
    });
  });

  // --- 7. Discover Cure & Victory ---

  describe('Discover Cure & Victory', () => {
    it('normal player discovers cure with 5 matching cards at research station', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['dispatcher', 'medic'],
      });
      state.cityCubes.set('san_francisco', { blue: 1, yellow: 0, black: 0, red: 0 });
      state.players[0].cityId = 'atlanta';
      state.players[0].cards = [
        { type: 'city', cityId: 'atlanta', color: 'blue' },
        { type: 'city', cityId: 'chicago', color: 'blue' },
        { type: 'city', cityId: 'montreal', color: 'blue' },
        { type: 'city', cityId: 'new_york', color: 'blue' },
        { type: 'city', cityId: 'washington', color: 'blue' },
      ];

      service.applyAction(state, {
        type: 'discoverCure',
        color: 'blue',
        cardCityIds: ['atlanta', 'chicago', 'montreal', 'new_york', 'washington'],
      });

      expect(state.cureStatus.get('blue')).toBe('cured');
      expect(state.players[0].cards.length).toBe(0);
      expect(state.actionsRemaining).toBe(3);
    });

    it('scientist discovers cure with only 4 matching cards', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['scientist', 'medic'],
      });
      state.cityCubes.set('san_francisco', { blue: 1, yellow: 0, black: 0, red: 0 });
      state.players[0].cityId = 'atlanta';
      state.players[0].cards = [
        { type: 'city', cityId: 'atlanta', color: 'blue' },
        { type: 'city', cityId: 'chicago', color: 'blue' },
        { type: 'city', cityId: 'montreal', color: 'blue' },
        { type: 'city', cityId: 'new_york', color: 'blue' },
      ];

      service.applyAction(state, {
        type: 'discoverCure',
        color: 'blue',
        cardCityIds: ['atlanta', 'chicago', 'montreal', 'new_york'],
      });

      expect(state.cureStatus.get('blue')).toBe('cured');
      expect(state.actionsRemaining).toBe(3);
    });

    it('triggers immediate victory when all 4 cures are discovered', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['scientist', 'medic'],
      });
      state.players[0].cityId = 'atlanta';
      state.cureStatus.set('yellow', 'cured');
      state.cureStatus.set('black', 'cured');
      state.cureStatus.set('red', 'cured');

      state.players[0].cards = [
        { type: 'city', cityId: 'atlanta', color: 'blue' },
        { type: 'city', cityId: 'chicago', color: 'blue' },
        { type: 'city', cityId: 'montreal', color: 'blue' },
        { type: 'city', cityId: 'new_york', color: 'blue' },
      ];

      service.applyAction(state, {
        type: 'discoverCure',
        color: 'blue',
        cardCityIds: ['atlanta', 'chicago', 'montreal', 'new_york'],
      });

      expect(state.phase).toBe('game_over');
      expect(state.winner).toBe('players');
      expect(state.winReason).toBe('ALL_CURES_DISCOVERED');
    });

    it('throws error when discovering cure without research station', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['scientist', 'medic'],
      });
      state.players[0].cityId = 'chicago'; // No station

      expect(() => {
        service.applyAction(state, {
          type: 'discoverCure',
          color: 'blue',
          cardCityIds: ['atlanta', 'chicago', 'montreal', 'new_york'],
        });
      }).toThrowError(/Must be at a research station/);
    });
  });

  // --- 8. Medic & Quarantine Specialist Passives ---

  describe('Role Passives: Medic & Quarantine Specialist', () => {
    it('medic treats all cubes of any color in 1 action even if uncured', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['medic', 'scientist'],
      });
      state.players[0].cityId = 'atlanta';
      state.cityCubes.set('atlanta', { blue: 3, yellow: 0, black: 0, red: 0 });

      service.applyAction(state, { type: 'treatDisease', color: 'blue' });

      expect(state.cityCubes.get('atlanta')?.blue).toBe(0);
      expect(state.actionsRemaining).toBe(3);
    });

    it('medic auto-cleans cured disease cubes upon entering a city', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['medic', 'scientist'],
      });
      state.cureStatus.set('blue', 'cured');
      state.cityCubes.set('chicago', { blue: 2, yellow: 0, black: 0, red: 0 });

      service.applyAction(state, { type: 'driveOrFerry', toCityId: 'chicago' });

      expect(state.players[0].cityId).toBe('chicago');
      expect(state.cityCubes.get('chicago')?.blue).toBe(0);
    });

    it('medic auto-cleans cubes in their city when cure is discovered', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['scientist', 'medic'],
      });
      state.players[1].cityId = 'chicago'; // Medic in Chicago
      state.cityCubes.set('chicago', { blue: 3, yellow: 0, black: 0, red: 0 });
      state.cityCubes.set('san_francisco', { blue: 1, yellow: 0, black: 0, red: 0 });

      state.players[0].cityId = 'atlanta'; // Scientist in Atlanta
      state.players[0].cards = [
        { type: 'city', cityId: 'atlanta', color: 'blue' },
        { type: 'city', cityId: 'montreal', color: 'blue' },
        { type: 'city', cityId: 'new_york', color: 'blue' },
        { type: 'city', cityId: 'washington', color: 'blue' },
      ];

      service.applyAction(state, {
        type: 'discoverCure',
        color: 'blue',
        cardCityIds: ['atlanta', 'montreal', 'new_york', 'washington'],
      });

      expect(state.cureStatus.get('blue')).toBe('cured');
      expect(state.cityCubes.get('chicago')?.blue).toBe(0);
    });

    it('quarantine specialist prevents cube placement in their city and adjacent cities', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['dispatcher', 'quarantine_specialist'],
      });
      // QS is in Atlanta; Chicago, Washington, Miami are adjacent
      state.players[1].cityId = 'atlanta';

      state.cityCubes.set('chicago', { blue: 0, yellow: 0, black: 0, red: 0 });
      state.cityCubes.set('atlanta', { blue: 0, yellow: 0, black: 0, red: 0 });

      service.placeCubes(state, 'chicago', 'blue', 3);
      service.placeCubes(state, 'atlanta', 'blue', 3);

      expect(state.cityCubes.get('chicago')?.blue).toBe(0);
      expect(state.cityCubes.get('atlanta')?.blue).toBe(0);
    });
  });

  // --- 9. Dispatcher & Contingency Planner Specials ---

  describe('Dispatcher & Contingency Planner', () => {
    it('dispatcher moves any pawn to another pawn city', () => {
      const state = service.createInitialState({
        numPlayers: 3,
        roles: ['dispatcher', 'medic', 'scientist'],
      });
      state.players[1].cityId = 'atlanta';
      state.players[2].cityId = 'tokyo';

      service.applyAction(state, {
        type: 'dispatcherMoveToPawn',
        targetSeat: 1,
        destinationSeat: 2,
      });

      expect(state.players[1].cityId).toBe('tokyo');
      expect(state.actionsRemaining).toBe(3);
    });

    it('dispatcher moves other pawn via direct flight using dispatcher card', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['dispatcher', 'medic'],
      });
      state.players[0].cards = [
        { type: 'city', cityId: 'sydney', color: 'red' },
      ];
      state.players[1].cityId = 'atlanta';

      service.applyAction(state, {
        type: 'dispatcherMoveOther',
        targetSeat: 1,
        moveType: 'directFlight',
        toCityId: 'sydney',
      });

      expect(state.players[1].cityId).toBe('sydney');
      expect(state.players[0].cards.length).toBe(0);
      expect(state.actionsRemaining).toBe(3);
    });

    it('contingency planner reclaims event card from discard and exiles on play', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['contingency_planner', 'medic'],
      });
      state.playerDiscard = [{ type: 'event', eventId: 'airlift' }];

      service.applyAction(state, {
        type: 'contingencyPlannerTakeEvent',
        eventId: 'airlift',
      });

      expect(state.players[0].storedEventCard).toBe('airlift');
      expect(state.playerDiscard.length).toBe(0);
      expect(state.actionsRemaining).toBe(3);

      // Play stored event card: exiles from game (neither in hand nor in playerDiscard)
      service.applyAction(state, {
        type: 'playEvent',
        seat: 0,
        eventId: 'airlift',
        targetSeat: 1,
        toCityId: 'paris',
      });

      expect(state.players[1].cityId).toBe('paris');
      expect(state.players[0].storedEventCard).toBeNull();
      expect(state.playerDiscard.length).toBe(0); // Exiled!
    });
  });

  // --- 10. Anytime Event Cards ---

  describe('Anytime Event Cards', () => {
    it('plays airlift to move any pawn anywhere', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.players[0].cards = [{ type: 'event', eventId: 'airlift' }];

      service.applyAction(state, {
        type: 'playEvent',
        seat: 0,
        eventId: 'airlift',
        targetSeat: 1,
        toCityId: 'sydney',
      });

      expect(state.players[1].cityId).toBe('sydney');
      expect(state.playerDiscard.some((c) => c.type === 'event' && c.eventId === 'airlift')).toBe(
        true
      );
      // Event cards do not consume action points
      expect(state.actionsRemaining).toBe(4);
    });

    it('plays government grant to build station anywhere without card', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.players[0].cards = [{ type: 'event', eventId: 'government_grant' }];

      service.applyAction(state, {
        type: 'playEvent',
        seat: 0,
        eventId: 'government_grant',
        toCityId: 'tokyo',
      });

      expect(state.researchStations.includes('tokyo')).toBe(true);
    });

    it('plays one quiet night to skip the next infect cities step', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.players[0].cards = [{ type: 'event', eventId: 'one_quiet_night' }];

      service.applyAction(state, {
        type: 'playEvent',
        seat: 0,
        eventId: 'one_quiet_night',
      });

      expect(state.oneQuietNightActive).toBe(true);

      // Advance to infect phase
      state.phase = 'infect';
      const discardBefore = state.infectionDiscard.length;

      service.applyAction(state, { type: 'resolveInfectStep' });

      // No new infection cards drawn
      expect(state.infectionDiscard.length).toBe(discardBefore);
      expect(state.oneQuietNightActive).toBe(false);
      expect(state.phase).toBe('actions');
      expect(state.activeSeat).toBe(1);
    });

    it('plays forecast and confirms reordered top 6 cards', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.players[0].cards = [{ type: 'event', eventId: 'forecast' }];
      const top6 = state.infectionDeck.slice(0, 6);
      const reversedIds = top6.map((c) => c.cityId).reverse();

      service.applyAction(state, {
        type: 'playEvent',
        seat: 0,
        eventId: 'forecast',
      });

      expect(state.phase).toBe('forecast');
      expect(state.forecastCards?.length).toBe(6);

      service.applyAction(state, {
        type: 'confirmForecast',
        reorderedCityIds: reversedIds,
      });

      expect(state.phase).toBe('actions');
      expect(state.forecastCards).toBeNull();
      expect(state.infectionDeck.at(0)?.cityId).toBe(reversedIds.at(0));
    });

    it('plays resilient population to exile card from infection discard', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.players[0].cards = [{ type: 'event', eventId: 'resilient_population' }];
      state.infectionDiscard = [
        { cityId: 'tokyo', color: 'red' },
        { cityId: 'paris', color: 'blue' },
      ];

      service.applyAction(state, {
        type: 'playEvent',
        seat: 0,
        eventId: 'resilient_population',
        cardCityId: 'tokyo',
      });

      expect(state.infectionDiscard.length).toBe(1);
      expect(state.infectionDiscard.some((c) => c.cityId === 'tokyo')).toBe(false);
    });
  });

  // --- 11. Stepper Flow, Epidemics & Outbreaks ---

  describe('Stepper Flow, Epidemics & Defeat', () => {
    it('advances to draw phase after 4 actions and transitions to infect', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      // Ensure player deck top 2 cards are regular city cards
      state.playerDeck.unshift(
        { type: 'city', cityId: 'london', color: 'blue' },
        { type: 'city', cityId: 'paris', color: 'blue' }
      );

      service.applyAction(state, { type: 'driveOrFerry', toCityId: 'chicago' });
      service.applyAction(state, { type: 'driveOrFerry', toCityId: 'atlanta' });
      service.applyAction(state, { type: 'driveOrFerry', toCityId: 'chicago' });
      service.applyAction(state, { type: 'driveOrFerry', toCityId: 'atlanta' });

      // After 4th action, 2 cards drawn
      expect(state.players[0].cards.length).toBe(6); // 4 initial + 2 drawn
      expect(state.phase).toBe('infect');
    });

    it('endActionsEarly draws 2 cards immediately', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.playerDeck.unshift(
        { type: 'city', cityId: 'london', color: 'blue' },
        { type: 'city', cityId: 'paris', color: 'blue' }
      );

      service.applyAction(state, { type: 'endActionsEarly' });

      expect(state.players[0].cards.length).toBe(6);
      expect(state.phase).toBe('infect');
    });

    it('triggers defeat DECK_EXHAUSTED when player deck has fewer than 2 cards on draw', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.playerDeck = [{ type: 'city', cityId: 'london', color: 'blue' }]; // only 1 card

      service.applyAction(state, { type: 'endActionsEarly' });

      expect(state.phase).toBe('game_over');
      expect(state.winner).toBe('none');
      expect(state.lossReason).toBe('DECK_EXHAUSTED');
    });

    it('pauses in phase epidemic when epidemic card drawn and intensifies on confirm', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.playerDeck.unshift(
        { type: 'epidemic' },
        { type: 'city', cityId: 'london', color: 'blue' }
      );

      const discardCountBefore = state.infectionDiscard.length;

      service.applyAction(state, { type: 'endActionsEarly' });

      expect(state.phase).toBe('epidemic');
      expect(state.infectionRateIndex).toBe(1);
      expect(state.pendingEpidemicCityId).not.toBe('');
      // Bottom card was drawn and placed in discard
      expect(state.infectionDiscard.length).toBe(discardCountBefore + 1);

      // Confirm intensify
      service.applyAction(state, { type: 'resolveEpidemicIntensify' });

      expect(state.infectionDiscard.length).toBe(0);
      expect(state.phase).toBe('infect');
    });

    it('triggers hand limit discard phase when player exceeds 7 cards', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.players[0].cards = Array.from({ length: 6 }, (_, i) => ({
        type: 'city',
        cityId: `c_${i}`,
        color: 'blue' as DiseaseColor,
      }));
      state.playerDeck.unshift(
        { type: 'city', cityId: 'extra_1', color: 'blue' },
        { type: 'city', cityId: 'extra_2', color: 'blue' }
      );

      service.applyAction(state, { type: 'endActionsEarly' });

      // 6 + 2 = 8 cards -> hand limit exceeded!
      expect(state.phase).toBe('discard');
      expect(state.discardQueue).toEqual([0]);

      // Discard down
      service.applyAction(state, {
        type: 'discardCard',
        seat: 0,
        cardIndex: 0,
      });

      expect(state.players[0].cards.length).toBe(7);
      expect(state.phase).toBe('infect');
    });

    it('resolves infect step and chains outbreaks up to 8 causing defeat', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['scientist', 'dispatcher'],
      });
      state.phase = 'infect';
      state.outbreakCount = 7;

      // Set Atlanta to 3 blue cubes
      state.cityCubes.set('atlanta', { blue: 3, yellow: 0, black: 0, red: 0 });
      state.infectionDeck.unshift({ cityId: 'atlanta', color: 'blue' });

      service.applyAction(state, { type: 'resolveInfectStep' });

      expect(state.phase).toBe('game_over');
      expect(state.winner).toBe('none');
      expect(state.lossReason).toBe('TOO_MANY_OUTBREAKS');
    });

    it('triggers defeat OUT_OF_CUBES when supply runs out', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['scientist', 'dispatcher'],
      });
      state.cubesRemaining.set('blue', 0);

      service.placeCubes(state, 'chicago', 'blue', 1);

      expect(state.phase).toBe('game_over');
      expect(state.winner).toBe('none');
      expect(state.lossReason).toBe('OUT_OF_CUBES');
    });

    it('prevents city from outbreaking twice in the same chain reaction', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      // Clear quarantine specialist to avoid interference
      state.players[0].role = 'medic';
      state.players[1].role = 'scientist';

      // Clear all cubes to isolate the chain reaction between Montreal and New York
      for (const city of PANDEMIC_CITIES) {
        state.cityCubes.set(city.id, { blue: 0, yellow: 0, black: 0, red: 0 });
      }
      state.cityCubes.set('montreal', { blue: 3, yellow: 0, black: 0, red: 0 });
      state.cityCubes.set('new_york', { blue: 3, yellow: 0, black: 0, red: 0 });

      const initialOutbreaks = state.outbreakCount;
      const outbrokenSet = new Set<string>();

      service.placeCubes(state, 'montreal', 'blue', 1, outbrokenSet);

      // Montreal outbroke once, propagating to New York which outbroke once,
      // propagating back to Montreal which must NOT outbreak again!
      expect(outbrokenSet.has('montreal')).toBe(true);
      expect(outbrokenSet.has('new_york')).toBe(true);
      expect(state.outbreakCount).toBe(initialOutbreaks + 2);
    });
  });

  // --- 12. View Sanitization & Hydration ---

  describe('Player View Sanitization & Hydration', () => {
    it('strips playerDeck and infectionDeck while exposing counts', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      const view = service.getPandemicPlayerView(state, 0);

      expect(view.playerDeckCount).toBe(state.playerDeck.length);
      expect(view.infectionDeckCount).toBe(state.infectionDeck.length);
      expect(view.mySeat).toBe(0);
      expect(view.forecastCards).toBeNull();
      expect(view.pendingEpidemicCityId).toBeNull();
    });

    it('exposes forecastCards only during forecast phase', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.phase = 'forecast';
      state.forecastCards = state.infectionDeck.slice(0, 6);

      const view = service.getPandemicPlayerView(state, 0);
      expect(view.forecastCards?.length).toBe(6);
    });

    it('exposes pendingEpidemicCityId only during epidemic phase', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.phase = 'epidemic';
      state.pendingEpidemicCityId = 'tokyo';

      const view = service.getPandemicPlayerView(state, 0);
      expect(view.pendingEpidemicCityId).toBe('tokyo');

      state.phase = 'actions';
      const actionsView = service.getPandemicPlayerView(state, 0);
      expect(actionsView.pendingEpidemicCityId).toBeNull();
    });

    it('hydrates player view reconstituting Maps accurately', () => {
      const rawCubes = {
        atlanta: { blue: 2, yellow: 0, black: 0, red: 0 },
      };
      const rawView = {
        gameId: 'pandemic',
        difficulty: 'standard',
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
        mySeat: 0,
        players: [],
        researchStations: ['atlanta'],
        cityCubes: rawCubes,
        cubesRemaining: { blue: 22, yellow: 24, black: 24, red: 24 },
        cureStatus: { blue: 'uncured', yellow: 'uncured', black: 'uncured', red: 'uncured' },
        infectionRateIndex: 0,
        outbreakCount: 0,
        playerDeckCount: 40,
        playerDiscard: [],
        infectionDeckCount: 39,
        infectionDiscard: [],
        pendingEpidemicCityId: null,
        forecastCards: null,
        oneQuietNightActive: false,
        discardQueue: [],
        winner: null,
        winReason: null,
        lossReason: null,
        logs: [],
      } as unknown as PandemicPlayerView;

      const hydrated = hydratePandemicPlayerView(rawView);
      expect(hydrated.cityCubes instanceof Map).toBe(true);
      expect(hydrated.cityCubes.get('atlanta')?.blue).toBe(2);
      expect(hydrated.cubesRemaining.get('blue')).toBe(22);
      expect(hydrated.cureStatus.get('blue')).toBe('uncured');
    });

    it('covers createSerializableMap and coerceToMap edge cases', () => {
      const serializableMap = createSerializableMap([['key1', 'val1']]);
      const jsonStr = JSON.stringify(serializableMap);
      expect(jsonStr).toBe('[["key1","val1"]]');

      // coerceToMap from Map
      const fromMap = coerceToMap(serializableMap);
      expect(fromMap.get('key1')).toBe('val1');

      // coerceToMap from Array
      const fromArr = coerceToMap([['arrKey', 42]]);
      expect(fromArr.get('arrKey')).toBe(42);

      // coerceToMap from object with numeric and string keys
      const fromObj = coerceToMap({ '0': 'first', name: 'pandemic' });
      expect(fromObj.get(0)).toBe('first');
      expect(fromObj.get('name')).toBe('pandemic');

      // coerceToMap from null / undefined
      const fromNull = coerceToMap(null);
      expect(fromNull.size).toBe(0);
      const fromUndef = coerceToMap(undefined);
      expect(fromUndef.size).toBe(0);
    });
  });

  // --- 13. Legal Actions Summary ---

  describe('Legal Actions Query', () => {
    it('summarizes legal actions for active player accurately', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['operations_expert', 'medic'],
      });
      state.players[0].cityId = 'atlanta';

      const actions = service.getLegalActions(state, 0);

      expect(actions.canDriveOrFerryTo.length).toBe(3); // chicago, washington, miami
      expect(actions.canBuildStation).toBe(false); // Atlanta already has station
      expect(actions.canEndActionsEarly).toBe(true);
      expect(actions.canResolveInfectStep).toBe(false);
      expect(actions.canResolveEpidemicIntensify).toBe(false);
    });

    it('returns empty legal actions when not player turn or invalid seat', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      const actionsForSeat1 = service.getLegalActions(state, 1);

      expect(actionsForSeat1.canDriveOrFerryTo.length).toBe(0);
      expect(actionsForSeat1.canEndActionsEarly).toBe(false);

      const actionsForInvalid = service.getLegalActions(state, 99);
      expect(actionsForInvalid.canDriveOrFerryTo.length).toBe(0);
    });

    it('covers all legal action options across roles, flights, cures, and events', () => {
      const state = service.createInitialState({
        numPlayers: 3,
        roles: ['dispatcher', 'researcher', 'contingency_planner'],
      });

      // Give Seat 0 charter flight, shuttle flight, and station relocation options
      state.players[0].cityId = 'chicago';
      state.players[0].cards = [
        { type: 'city', cityId: 'chicago', color: 'blue' },
        { type: 'city', cityId: 'paris', color: 'blue' },
        { type: 'event', eventId: 'airlift' },
      ];
      state.researchStations = [
        'atlanta',
        'chicago',
        'washington',
        'london',
        'paris',
        'essen',
      ];
      state.cityCubes.set('chicago', { blue: 2, yellow: 1, black: 0, red: 0 });

      // Put researcher in same city with cards to test share knowledge
      state.players[1].cityId = 'chicago';
      state.players[1].cards = [
        { type: 'city', cityId: 'tokyo', color: 'red' },
      ];

      // Put contingency planner in another city
      state.players[2].cityId = 'tokyo';

      const actions = service.getLegalActions(state, 0);

      expect(actions.canCharterFlightTo.length).toBe(47); // all cities except chicago
      expect(actions.canShuttleFlightTo.length).toBe(5); // all stations except chicago
      expect(actions.canTreatDiseases).toEqual(['blue', 'yellow']);
      expect(actions.canShareKnowledge.length).toBeGreaterThan(0);
      expect(actions.canDispatcherMoveToPawn.length).toBeGreaterThan(0);
      expect(actions.playableEvents).toContain('airlift');

      // Test contingency planner legal actions when it is seat 2's turn
      state.activeSeat = 2;
      state.playerDiscard = [{ type: 'event', eventId: 'one_quiet_night' }];
      state.players[2].storedEventCard = null;

      const cpActions = service.getLegalActions(state, 2);
      expect(cpActions.canContingencyPlannerTakeEvent).toContain('one_quiet_night');

      // When CP has stored card
      state.players[2].storedEventCard = 'forecast';
      const cpWithStored = service.getLegalActions(state, 2);
      expect(cpWithStored.playableEvents).toContain('forecast');

      // Test Operations Expert flight legal action
      state.players[2].role = 'operations_expert';
      state.players[2].cityId = 'atlanta'; // has station
      state.players[2].operationsExpertFlightUsed = false;
      state.players[2].cards = [{ type: 'city', cityId: 'sydney', color: 'red' }];
      const opActions = service.getLegalActions(state, 2);
      expect(opActions.canOperationsExpertFlightTo.length).toBe(47);

      // Test canDiscoverCure in legal actions
      state.players[2].cityId = 'atlanta';
      state.players[2].cards = [
        { type: 'city', cityId: 'c1', color: 'blue' },
        { type: 'city', cityId: 'c2', color: 'blue' },
        { type: 'city', cityId: 'c3', color: 'blue' },
        { type: 'city', cityId: 'c4', color: 'blue' },
        { type: 'city', cityId: 'c5', color: 'blue' },
      ];
      const cureActions = service.getLegalActions(state, 2);
      expect(cureActions.canDiscoverCure).toContain('blue');
    });
  });

  // --- 14. Error Paths & Invariants ---

  describe('Error Paths & Invariants', () => {
    it('throws error when applying action after game is over', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.phase = 'game_over';

      expect(() => {
        service.applyAction(state, { type: 'driveOrFerry', toCityId: 'chicago' });
      }).toThrowError(/Game is already over/);
    });

    it('throws error when action performed during wrong phase or out of turn', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.phase = 'infect';

      expect(() => {
        service.applyAction(state, { type: 'driveOrFerry', toCityId: 'chicago' }, 0);
      }).toThrowError(/Action not permitted during phase/);

      state.phase = 'actions';
      expect(() => {
        service.applyAction(state, { type: 'driveOrFerry', toCityId: 'chicago' }, 1);
      }).toThrowError(/Not player 1's turn/);

      state.actionsRemaining = 0;
      expect(() => {
        service.applyAction(state, { type: 'driveOrFerry', toCityId: 'chicago' }, 0);
      }).toThrowError(/No actions remaining/);
    });

    it('throws error when target player seat is not found', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.activeSeat = 99;
      expect(() => {
        service.applyAction(state, { type: 'driveOrFerry', toCityId: 'chicago' }, 99);
      }).toThrowError(/Player with seat 99 not found/);
    });

    it('throws error for invalid Dispatcher moves', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['medic', 'scientist'],
      });

      // Actor is not Dispatcher
      expect(() => {
        service.applyAction(state, {
          type: 'dispatcherMoveToPawn',
          targetSeat: 1,
          destinationSeat: 0,
        });
      }).toThrowError(/Only Dispatcher/);

      expect(() => {
        service.applyAction(state, {
          type: 'dispatcherMoveOther',
          targetSeat: 1,
          moveType: 'driveOrFerry',
          toCityId: 'chicago',
        });
      }).toThrowError(/Only Dispatcher/);

      // Now set role to Dispatcher
      state.players[0].role = 'dispatcher';
      state.players[0].cards = [];
      state.players[1].cityId = 'atlanta';
      state.players[0].cityId = 'atlanta';

      // Move to same city
      expect(() => {
        service.applyAction(state, {
          type: 'dispatcherMoveToPawn',
          targetSeat: 1,
          destinationSeat: 0,
        });
      }).toThrowError(/Target is already in destination pawn city/);

      // Dispatcher drive non-adjacent
      expect(() => {
        service.applyAction(state, {
          type: 'dispatcherMoveOther',
          targetSeat: 1,
          moveType: 'driveOrFerry',
          toCityId: 'tokyo',
        });
      }).toThrowError(/not adjacent/);

      // Dispatcher direct flight without matching card
      expect(() => {
        service.applyAction(state, {
          type: 'dispatcherMoveOther',
          targetSeat: 1,
          moveType: 'directFlight',
          toCityId: 'tokyo',
        });
      }).toThrowError(/Dispatcher must discard destination city card/);

      // Dispatcher charter flight without target current city card
      expect(() => {
        service.applyAction(state, {
          type: 'dispatcherMoveOther',
          targetSeat: 1,
          moveType: 'charterFlight',
          toCityId: 'tokyo',
        });
      }).toThrowError(/Dispatcher must discard target current city card/);

      // Dispatcher shuttle flight without stations
      state.players[1].cityId = 'sydney';
      expect(() => {
        service.applyAction(state, {
          type: 'dispatcherMoveOther',
          targetSeat: 1,
          moveType: 'shuttleFlight',
          toCityId: 'atlanta',
        });
      }).toThrowError(/has no research station/);

      state.players[1].cityId = 'atlanta';
      expect(() => {
        service.applyAction(state, {
          type: 'dispatcherMoveOther',
          targetSeat: 1,
          moveType: 'shuttleFlight',
          toCityId: 'sydney',
        });
      }).toThrowError(/has no research station/);
    });

    it('throws error for invalid Operations Expert actions', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['medic', 'scientist'],
      });

      expect(() => {
        service.applyAction(state, {
          type: 'operationsExpertFlight',
          toCityId: 'paris',
          discardCardCityId: 'chicago',
        });
      }).toThrowError(/Only Operations Expert/);

      state.players[0].role = 'operations_expert';
      state.players[0].cityId = 'chicago'; // Not a station
      expect(() => {
        service.applyAction(state, {
          type: 'operationsExpertFlight',
          toCityId: 'paris',
          discardCardCityId: 'chicago',
        });
      }).toThrowError(/must be at a research station/);

      state.players[0].cityId = 'atlanta'; // At station
      state.players[0].cards = [];
      expect(() => {
        service.applyAction(state, {
          type: 'operationsExpertFlight',
          toCityId: 'paris',
          discardCardCityId: 'chicago',
        });
      }).toThrowError(/Must discard any city card/);
    });

    it('throws error when building station on city that already has one', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.players[0].cityId = 'atlanta'; // Atlanta already has station

      expect(() => {
        service.applyAction(state, { type: 'buildStation' });
      }).toThrowError(/already has a research station/);
    });

    it('throws error when building station at 6-station cap without valid relocateFromCityId', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['operations_expert', 'medic'],
      });
      state.researchStations = ['atlanta', 'c1', 'c2', 'c3', 'c4', 'c5'];
      state.players[0].cityId = 'tokyo';

      expect(() => {
        service.applyAction(state, {
          type: 'buildStation',
          relocateFromCityId: 'invalid_city',
        });
      }).toThrowError(/must specify existing relocateFromCityId/);
    });

    it('throws error for invalid Share Knowledge conditions', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.players[0].cityId = 'atlanta';
      state.players[1].cityId = 'chicago'; // Different cities

      expect(() => {
        service.applyAction(state, {
          type: 'shareKnowledge',
          targetSeat: 1,
          cardCityId: 'atlanta',
        });
      }).toThrowError(/Both players must be in the same city/);

      state.players[1].cityId = 'atlanta';
      state.players[0].cards = [];
      state.players[1].cards = [];
      expect(() => {
        service.applyAction(state, {
          type: 'shareKnowledge',
          targetSeat: 1,
          cardCityId: 'atlanta',
        });
      }).toThrowError(/Neither player holds the card/);
    });

    it('throws error for invalid Discover Cure conditions', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['dispatcher', 'medic'],
      });
      state.players[0].cityId = 'atlanta';
      state.cureStatus.set('blue', 'cured');

      expect(() => {
        service.applyAction(state, {
          type: 'discoverCure',
          color: 'blue',
          cardCityIds: ['c1', 'c2', 'c3', 'c4', 'c5'],
        });
      }).toThrowError(/already cured or eradicated/);

      state.cureStatus.set('blue', 'uncured');
      expect(() => {
        service.applyAction(state, {
          type: 'discoverCure',
          color: 'blue',
          cardCityIds: ['c1', 'c2'],
        });
      }).toThrowError(/requires exactly 5 cards/);

      state.players[0].cards = [];
      expect(() => {
        service.applyAction(state, {
          type: 'discoverCure',
          color: 'blue',
          cardCityIds: ['c1', 'c2', 'c3', 'c4', 'c5'],
        });
      }).toThrowError(/Actor does not hold matching blue city card/);
    });

    it('throws error for invalid Contingency Planner operations', () => {
      const state = service.createInitialState({
        numPlayers: 2,
        roles: ['medic', 'scientist'],
      });

      expect(() => {
        service.applyAction(state, {
          type: 'contingencyPlannerTakeEvent',
          eventId: 'airlift',
        });
      }).toThrowError(/Only Contingency Planner/);

      state.players[0].role = 'contingency_planner';
      state.players[0].storedEventCard = 'forecast';
      expect(() => {
        service.applyAction(state, {
          type: 'contingencyPlannerTakeEvent',
          eventId: 'airlift',
        });
      }).toThrowError(/already holds a stored event card/);

      state.players[0].storedEventCard = null;
      state.playerDiscard = [];
      expect(() => {
        service.applyAction(state, {
          type: 'contingencyPlannerTakeEvent',
          eventId: 'airlift',
        });
      }).toThrowError(/not found in player discard pile/);
    });

    it('throws error for invalid Event Card executions', () => {
      const state = service.createInitialState({ numPlayers: 2 });
      state.players[0].cards = [];

      expect(() => {
        service.applyAction(state, {
          type: 'playEvent',
          seat: 0,
          eventId: 'airlift',
          targetSeat: 1,
          toCityId: 'tokyo',
        });
      }).toThrowError(/does not hold event card/);

      // Government Grant on city that already has station
      state.players[0].cards = [{ type: 'event', eventId: 'government_grant' }];
      expect(() => {
        service.applyAction(state, {
          type: 'playEvent',
          seat: 0,
          eventId: 'government_grant',
          toCityId: 'atlanta',
        });
      }).toThrowError(/already has a research station/);

      // Government Grant at 6 stations without relocate
      state.researchStations = ['atlanta', 'c1', 'c2', 'c3', 'c4', 'c5'];
      expect(() => {
        service.applyAction(state, {
          type: 'playEvent',
          seat: 0,
          eventId: 'government_grant',
          toCityId: 'tokyo',
        });
      }).toThrowError(/Max stations reached; specify relocateFromCityId/);

      // Resilient Population card not in discard
      state.players[0].cards = [{ type: 'event', eventId: 'resilient_population' }];
      state.infectionDiscard = [];
      expect(() => {
        service.applyAction(state, {
          type: 'playEvent',
          seat: 0,
          eventId: 'resilient_population',
          cardCityId: 'tokyo',
        });
      }).toThrowError(/Infection discard does not contain card/);

      // Confirm forecast outside forecast phase or with mismatched count
      expect(() => {
        service.applyAction(state, {
          type: 'confirmForecast',
          reorderedCityIds: ['tokyo'],
        });
      }).toThrowError(/Can only confirm forecast during forecast phase/);

      state.phase = 'forecast';
      state.forecastCards = [{ cityId: 'c1', color: 'blue' }];
      expect(() => {
        service.applyAction(state, {
          type: 'confirmForecast',
          reorderedCityIds: ['c1', 'c2'],
        });
      }).toThrowError(/Forecast reorder count does not match/);

      expect(() => {
        service.applyAction(state, {
          type: 'confirmForecast',
          reorderedCityIds: ['wrong_city'],
        });
      }).toThrowError(/is not part of current forecast cards/);
    });

    it('throws error for invalid Discard, Intensify, and Infect actions', () => {
      const state = service.createInitialState({ numPlayers: 2 });

      // DiscardCard outside discard phase
      expect(() => {
        service.applyAction(state, {
          type: 'discardCard',
          seat: 0,
          cardIndex: 0,
        });
      }).toThrowError(/Can only discard card during discard phase/);

      // DiscardCard when player does not need to discard
      state.phase = 'discard';
      state.players[0].cards = [];
      expect(() => {
        service.applyAction(state, {
          type: 'discardCard',
          seat: 0,
          cardIndex: 0,
        });
      }).toThrowError(/does not need to discard/);

      // DiscardCard with invalid index
      state.discardQueue = [0];
      state.players[0].cards = [{ type: 'city', cityId: 'c1', color: 'blue' }];
      expect(() => {
        service.applyAction(state, {
          type: 'discardCard',
          seat: 0,
          cardIndex: 99,
        });
      }).toThrowError(/Invalid card index/);

      // ResolveEpidemicIntensify outside epidemic phase
      state.phase = 'actions';
      expect(() => {
        service.applyAction(state, { type: 'resolveEpidemicIntensify' });
      }).toThrowError(/Can only resolve epidemic intensify during epidemic phase/);

      // ResolveInfectStep outside infect phase
      expect(() => {
        service.applyAction(state, { type: 'resolveInfectStep' });
      }).toThrowError(/Can only resolve infect step during infect phase/);
    });
  });
});

