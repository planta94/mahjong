import { TestBed } from '@angular/core/testing';
import {
  CityCubes,
  createSerializableMap,
  PandemicPlayerState,
  PandemicPlayerView,
} from '../models/pandemic.model';
import { PandemicBotService } from './pandemic-bot.service';
import { PandemicEngineService } from './pandemic-engine.service';

describe('PandemicBotService & Cooperative Tactical AI', () => {
  let botService: PandemicBotService;
  let engine: PandemicEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PandemicBotService, PandemicEngineService],
    });
    botService = TestBed.inject(PandemicBotService);
    engine = TestBed.inject(PandemicEngineService);
  });

  function createTestPlayerView(overrides?: Partial<PandemicPlayerView>): PandemicPlayerView {
    const rawState = engine.createInitialState({
      numPlayers: 4,
      roles: ['medic', 'scientist', 'researcher', 'dispatcher'],
    });
    rawState.players[0].cityId = 'atlanta';
    rawState.players[1].cityId = 'paris';
    rawState.players[2].cityId = 'tokyo';
    rawState.players[3].cityId = 'sydney';
    const view = engine.getPandemicPlayerView(rawState, 0);

    return {
      ...view,
      ...overrides,
    };
  }

  describe('1. Game Over & Inactive Boundaries', () => {
    it('returns null when game is over or when bot seat is not found', () => {
      const view = createTestPlayerView({ phase: 'game_over', winner: 'none' });
      expect(botService.chooseBotAction(view, 0)).toBe(null);

      const activeView = createTestPlayerView({ phase: 'actions' });
      expect(botService.chooseBotAction(activeView, 99)).toBe(null);
    });

    it('returns null during actions phase if it is not the bot active seat', () => {
      const view = createTestPlayerView({ phase: 'actions', activeSeat: 1 });
      expect(botService.chooseBotAction(view, 0)).toBe(null);
    });

    it('returns endActionsEarly when actionsRemaining is 0', () => {
      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 2,
        actionsRemaining: 0,
      });
      const action = botService.chooseBotAction(view, 2);
      expect(action).toEqual({ type: 'endActionsEarly' });
    });
  });

  describe('2. Discard Phase Decisions', () => {
    it('returns null if bot is not in discard queue and hand does not exceed limit', () => {
      const view = createTestPlayerView({
        phase: 'discard',
        discardQueue: [1],
      });
      expect(botService.chooseBotAction(view, 0)).toBe(null);
    });

    it('returns null if bot hand is empty', () => {
      const view = createTestPlayerView({
        phase: 'discard',
        discardQueue: [0],
      });
      const bot = view.players[0] as PandemicPlayerState;
      bot.cards = [];
      expect(botService.chooseBotAction(view, 0)).toBe(null);
    });

    it('discards city card of already cured or eradicated disease with highest priority', () => {
      const view = createTestPlayerView({
        phase: 'discard',
        discardQueue: [0],
      });
      view.cureStatus.set('blue', 'cured');
      view.cureStatus.set('yellow', 'uncured');

      const bot = view.players[0] as PandemicPlayerState;
      bot.cards = [
        { type: 'city', cityId: 'lima', color: 'yellow' },
        { type: 'city', cityId: 'santiago', color: 'yellow' },
        { type: 'city', cityId: 'atlanta', color: 'blue' }, // cured color
        { type: 'event', eventId: 'airlift' },
      ];

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'discardCard',
        seat: 0,
        cardIndex: 2, // atlanta is blue (cured)
      });
    });

    it('discards card of the color least held when all diseases are uncured', () => {
      const view = createTestPlayerView({
        phase: 'discard',
        discardQueue: [0],
      });
      view.cureStatus.set('blue', 'uncured');
      view.cureStatus.set('yellow', 'uncured');
      view.cureStatus.set('black', 'uncured');

      const bot = view.players[0] as PandemicPlayerState;
      bot.cards = [
        { type: 'city', cityId: 'atlanta', color: 'blue' },
        { type: 'city', cityId: 'chicago', color: 'blue' },
        { type: 'city', cityId: 'montreal', color: 'blue' },
        { type: 'city', cityId: 'cairo', color: 'black' }, // only 1 black card
      ];

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'discardCard',
        seat: 0,
        cardIndex: 3, // cairo is least held color
      });
    });
  });

  describe('3. Forecast Phase Decisions', () => {
    it('returns null if forecastCards is null or empty', () => {
      const view = createTestPlayerView({ phase: 'forecast', forecastCards: null });
      expect(botService.chooseBotAction(view, 0)).toBe(null);

      const emptyView = createTestPlayerView({ phase: 'forecast', forecastCards: [] });
      expect(botService.chooseBotAction(emptyView, 0)).toBe(null);
    });

    it('reorders forecast cards placing safe cities first and high-threat cities last', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      // chicago has 3 blue cubes (outbreak threat)
      cityCubes.set('chicago', { blue: 3, yellow: 0, black: 0, red: 0 });
      // atlanta has 1 blue cube
      cityCubes.set('atlanta', { blue: 1, yellow: 0, black: 0, red: 0 });
      // montreal has 0 cubes (safe)
      cityCubes.set('montreal', { blue: 0, yellow: 0, black: 0, red: 0 });
      // tokyo has 2 red cubes (medium threat)
      cityCubes.set('tokyo', { blue: 0, yellow: 0, black: 0, red: 2 });
      // paris has 0 cubes (eradicated disease)
      cityCubes.set('paris', { blue: 0, yellow: 0, black: 0, red: 0 });
      // seoul has 1 red cube
      cityCubes.set('seoul', { blue: 0, yellow: 0, black: 0, red: 1 });

      const cureStatus = createSerializableMap<string, string>([
        ['blue', 'uncured'],
        ['red', 'uncured'],
        ['yellow', 'uncured'],
        ['black', 'uncured'],
      ]);

      const forecastCards = [
        { cityId: 'chicago', color: 'blue' as const },
        { cityId: 'montreal', color: 'blue' as const },
        { cityId: 'tokyo', color: 'red' as const },
        { cityId: 'atlanta', color: 'blue' as const },
        { cityId: 'seoul', color: 'red' as const },
        { cityId: 'paris', color: 'blue' as const },
      ];

      const view = createTestPlayerView({
        phase: 'forecast',
        forecastCards,
        cityCubes,
        cureStatus: cureStatus as unknown as PandemicPlayerView['cureStatus'],
      });

      const action = botService.chooseBotAction(view, 0);
      expect(action?.type).toBe('confirmForecast');
      if (action && action.type === 'confirmForecast') {
        expect(action.reorderedCityIds.length).toBe(6);
        // Safest cities (0 cubes) must come before dangerous cities (3 cubes)
        const chicagoIdx = action.reorderedCityIds.indexOf('chicago');
        const montrealIdx = action.reorderedCityIds.indexOf('montreal');
        const atlantaIdx = action.reorderedCityIds.indexOf('atlanta');
        expect(montrealIdx < chicagoIdx).toBe(true);
        expect(atlantaIdx < chicagoIdx).toBe(true);
        expect(chicagoIdx).toBe(5); // highest threat placed at the very back
      }
    });
  });

  describe('4. Epidemic Phase Decisions', () => {
    it('plays resilient_population on high-cube infection discard city if held', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      cityCubes.set('chicago', { blue: 3, yellow: 0, black: 0, red: 0 });
      cityCubes.set('london', { blue: 1, yellow: 0, black: 0, red: 0 });

      const view = createTestPlayerView({
        phase: 'epidemic',
        cityCubes,
        infectionDiscard: [
          { cityId: 'london', color: 'blue' },
          { cityId: 'chicago', color: 'blue' },
        ],
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cards = [{ type: 'event', eventId: 'resilient_population' }];

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'playEvent',
        seat: 0,
        eventId: 'resilient_population',
        cardCityId: 'chicago',
      });
    });

    it('resolves epidemic intensify when bot does not hold resilient_population', () => {
      const view = createTestPlayerView({
        phase: 'epidemic',
        infectionDiscard: [{ cityId: 'chicago', color: 'blue' }],
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cards = [];

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({ type: 'resolveEpidemicIntensify' });
    });
  });

  describe('5. Infect Phase Decisions', () => {
    it('plays one_quiet_night if at least 2 cities have 3 cubes', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      cityCubes.set('chicago', { blue: 3, yellow: 0, black: 0, red: 0 });
      cityCubes.set('tokyo', { blue: 0, yellow: 0, black: 0, red: 3 });

      const view = createTestPlayerView({
        phase: 'infect',
        cityCubes,
        oneQuietNightActive: false,
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cards = [{ type: 'event', eventId: 'one_quiet_night' }];

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'playEvent',
        seat: 0,
        eventId: 'one_quiet_night',
      });
    });

    it('resolves infect step when one_quiet_night condition is not met or already active', () => {
      const view = createTestPlayerView({
        phase: 'infect',
        oneQuietNightActive: true,
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cards = [{ type: 'event', eventId: 'one_quiet_night' }];

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({ type: 'resolveInfectStep' });
    });
  });

  describe('6. Actions Phase Tactical BFS Planner', () => {
    it('discovers cure immediately when ready at a research station', () => {
      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
        researchStations: ['atlanta'],
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cityId = 'atlanta';
      bot.role = 'scientist'; // requires 4 cards
      bot.cards = [
        { type: 'city', cityId: 'atlanta', color: 'blue' },
        { type: 'city', cityId: 'chicago', color: 'blue' },
        { type: 'city', cityId: 'montreal', color: 'blue' },
        { type: 'city', cityId: 'new_york', color: 'blue' },
      ];

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'discoverCure',
        color: 'blue',
        cardCityIds: ['atlanta', 'chicago', 'montreal', 'new_york'],
      });
    });

    it('navigates toward nearest research station when holding enough cards for a cure', () => {
      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
        researchStations: ['atlanta'], // only Atlanta has station
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cityId = 'chicago'; // Chicago is adjacent to Atlanta
      bot.role = 'scientist';
      bot.cards = [
        { type: 'city', cityId: 'chicago', color: 'blue' },
        { type: 'city', cityId: 'montreal', color: 'blue' },
        { type: 'city', cityId: 'new_york', color: 'blue' },
        { type: 'city', cityId: 'washington', color: 'blue' },
      ];

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'driveOrFerry',
        toCityId: 'atlanta',
      });
    });

    it('treats 3-cube hotspot in current city immediately', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      cityCubes.set('atlanta', { blue: 3, yellow: 0, black: 0, red: 0 });

      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
        cityCubes,
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cityId = 'atlanta';

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'treatDisease',
        color: 'blue',
      });
    });

    it('navigates via shortest BFS path toward a 3-cube hotspot elsewhere on the board', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      // Bot is in Atlanta; Miami has 3 yellow cubes (Miami is adjacent to Atlanta)
      cityCubes.set('atlanta', { blue: 0, yellow: 0, black: 0, red: 0 });
      cityCubes.set('miami', { blue: 0, yellow: 3, black: 0, red: 0 });

      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
        cityCubes,
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cityId = 'atlanta';

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'driveOrFerry',
        toCityId: 'miami',
      });
    });

    it('navigates via shuttleFlight to distant station when target hotspot is near other station', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      // Bot in Atlanta; Tokyo has 3 red cubes; Tokyo has a station
      cityCubes.set('atlanta', { blue: 0, yellow: 0, black: 0, red: 0 });
      cityCubes.set('tokyo', { blue: 0, yellow: 0, black: 0, red: 3 });

      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
        researchStations: ['atlanta', 'tokyo'],
        cityCubes,
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cityId = 'atlanta';

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'shuttleFlight',
        toCityId: 'tokyo',
      });
    });

    it('executes shareKnowledge when co-located and advancing a cure set', () => {
      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
      });

      const bot = view.players[0] as PandemicPlayerState;
      const teammate = view.players[1] as PandemicPlayerState;

      bot.cityId = 'atlanta';
      teammate.cityId = 'atlanta';

      // Bot has Atlanta card, teammate already has 2 blue cards
      bot.cards = [{ type: 'city', cityId: 'atlanta', color: 'blue' }];
      teammate.cards = [
        { type: 'city', cityId: 'chicago', color: 'blue' },
        { type: 'city', cityId: 'montreal', color: 'blue' },
      ];

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'shareKnowledge',
        targetSeat: 1,
        cardCityId: 'atlanta',
      });
    });

    it('contingency planner reclaims event card from discard pile', () => {
      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
        playerDiscard: [
          { type: 'event', eventId: 'one_quiet_night' },
          { type: 'city', cityId: 'london', color: 'blue' },
        ],
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cityId = 'atlanta';
      bot.role = 'contingency_planner';
      bot.storedEventCard = null;

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'contingencyPlannerTakeEvent',
        eventId: 'one_quiet_night',
      });
    });

    it('operations expert builds research station without needing a card', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      cityCubes.set('chicago', { blue: 0, yellow: 0, black: 0, red: 0 });

      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
        researchStations: ['atlanta'], // Chicago has no station
        cityCubes,
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cityId = 'chicago';
      bot.role = 'operations_expert';
      bot.cards = [];

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({ type: 'buildStation' });
    });

    it('treats 1 or 2 cubes in current city when no 3-cube emergency exists', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      cityCubes.set('atlanta', { blue: 2, yellow: 0, black: 0, red: 0 });

      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
        cityCubes,
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cityId = 'atlanta';

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'treatDisease',
        color: 'blue',
      });
    });

    it('operations expert flies to distant high threat city by discarding a safe card', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      // Bot at Atlanta station; Cairo has 3 black cubes
      cityCubes.set('atlanta', { blue: 0, yellow: 0, black: 0, red: 0 });
      cityCubes.set('cairo', { blue: 0, yellow: 0, black: 3, red: 0 });

      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
        researchStations: ['atlanta'],
        cityCubes,
      });
      view.cureStatus.set('blue', 'cured');

      const bot = view.players[0] as PandemicPlayerState;
      bot.cityId = 'atlanta';
      bot.role = 'operations_expert';
      bot.operationsExpertFlightUsed = false;
      bot.cards = [{ type: 'city', cityId: 'london', color: 'blue' }]; // blue is cured -> safe to discard

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'operationsExpertFlight',
        toCityId: 'cairo',
        discardCardCityId: 'london',
      });
    });

    it('navigates via direct flight to reach a distant 3-cube hotspot', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      cityCubes.set('atlanta', { blue: 0, yellow: 0, black: 0, red: 0 });
      cityCubes.set('tokyo', { blue: 0, yellow: 0, black: 0, red: 3 });

      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
        researchStations: ['atlanta'],
        cityCubes,
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cityId = 'atlanta';
      bot.cards = [{ type: 'city', cityId: 'tokyo', color: 'red' }]; // holds tokyo

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'directFlight',
        toCityId: 'tokyo',
      });
    });

    it('moves toward 2-cube cluster when no 3-cube hotspot exists', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      cityCubes.set('atlanta', { blue: 0, yellow: 0, black: 0, red: 0 });
      cityCubes.set('chicago', { blue: 2, yellow: 0, black: 0, red: 0 }); // 2 cubes

      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
        researchStations: ['atlanta'],
        cityCubes,
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cityId = 'atlanta';
      bot.cards = [];

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'driveOrFerry',
        toCityId: 'chicago',
      });
    });

    it('navigates multi-hop BFS path to reach a 3-cube hotspot 2 hops away', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      // Bot in Atlanta; Montreal is 2 hops away (Atlanta -> Chicago -> Montreal)
      cityCubes.set('atlanta', { blue: 0, yellow: 0, black: 0, red: 0 });
      cityCubes.set('chicago', { blue: 0, yellow: 0, black: 0, red: 0 });
      cityCubes.set('washington', { blue: 0, yellow: 0, black: 0, red: 0 });
      cityCubes.set('miami', { blue: 0, yellow: 0, black: 0, red: 0 });
      cityCubes.set('montreal', { blue: 3, yellow: 0, black: 0, red: 0 }); // 3-cube hotspot 2 hops away

      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
        researchStations: ['atlanta'],
        cityCubes,
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cityId = 'atlanta';
      bot.cards = [];

      const action = botService.chooseBotAction(view, 0);
      // First hop from Atlanta toward Montreal must be either Chicago or Washington
      expect(action?.type).toBe('driveOrFerry');
      if (action && action.type === 'driveOrFerry') {
        expect(action.toCityId === 'chicago' || action.toCityId === 'washington').toBe(true);
      }
    });

    it('navigates multi-hop BFS via intermediate research station shuttle', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      // Bot at Atlanta (no station); Chicago has a station (1 hop away); Tokyo has a station;
      // Osaka is adjacent to Tokyo and has 3 red cubes
      cityCubes.set('atlanta', { blue: 0, yellow: 0, black: 0, red: 0 });
      cityCubes.set('chicago', { blue: 0, yellow: 0, black: 0, red: 0 });
      cityCubes.set('tokyo', { blue: 0, yellow: 0, black: 0, red: 0 });
      cityCubes.set('osaka', { blue: 0, yellow: 0, black: 0, red: 3 });

      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
        researchStations: ['chicago', 'tokyo'], // Chicago and Tokyo are stations
        cityCubes,
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cityId = 'atlanta';
      bot.cards = [];

      const action = botService.chooseBotAction(view, 0);
      expect(action?.type).toBe('driveOrFerry');
      if (action && action.type === 'driveOrFerry') {
        expect(action.toCityId).toBe('chicago');
      }
    });

    it('executes shareKnowledge when bot receives a card of a color bot is accumulating', () => {
      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
      });

      const bot = view.players[0] as PandemicPlayerState;
      const teammate = view.players[1] as PandemicPlayerState;

      bot.cityId = 'atlanta';
      teammate.cityId = 'atlanta';

      // Teammate holds Atlanta card, bot already holds 2 other blue cards
      teammate.cards = [{ type: 'city', cityId: 'atlanta', color: 'blue' }];
      bot.cards = [
        { type: 'city', cityId: 'chicago', color: 'blue' },
        { type: 'city', cityId: 'montreal', color: 'blue' },
      ];

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'shareKnowledge',
        targetSeat: 1,
        cardCityId: 'atlanta',
      });
    });

    it('executes fallback shareKnowledge when neither player has >= 2 cards of the color', () => {
      const view = createTestPlayerView({
        phase: 'actions',
        activeSeat: 0,
        actionsRemaining: 4,
      });

      const bot = view.players[0] as PandemicPlayerState;
      const teammate = view.players[1] as PandemicPlayerState;

      bot.cityId = 'atlanta';
      teammate.cityId = 'atlanta';
      bot.role = 'medic';
      teammate.role = 'dispatcher';

      // Both have 0 other blue cards
      bot.cards = [{ type: 'city', cityId: 'atlanta', color: 'blue' }];
      teammate.cards = [];

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'shareKnowledge',
        targetSeat: 1,
        cardCityId: 'atlanta',
      });
    });

    it('handles forecast cards where city disease is already eradicated', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      cityCubes.set('atlanta', { blue: 3, yellow: 0, black: 0, red: 0 });

      const cureStatus = createSerializableMap<string, string>([
        ['blue', 'eradicated'],
        ['yellow', 'uncured'],
        ['black', 'uncured'],
        ['red', 'uncured'],
      ]);

      const view = createTestPlayerView({
        phase: 'forecast',
        forecastCards: [
          { cityId: 'atlanta', color: 'blue' },
          { cityId: 'chicago', color: 'blue' },
        ],
        cityCubes,
        cureStatus: cureStatus as unknown as PandemicPlayerView['cureStatus'],
      });

      const action = botService.chooseBotAction(view, 0);
      expect(action?.type).toBe('confirmForecast');
    });

    it('plays resilient population when discard city has 2 cubes', () => {
      const cityCubes = createSerializableMap<string, CityCubes>();
      cityCubes.set('london', { blue: 2, yellow: 0, black: 0, red: 0 });

      const view = createTestPlayerView({
        phase: 'epidemic',
        cityCubes,
        infectionDiscard: [{ cityId: 'london', color: 'blue' }],
      });

      const bot = view.players[0] as PandemicPlayerState;
      bot.cards = [{ type: 'event', eventId: 'resilient_population' }];

      const action = botService.chooseBotAction(view, 0);
      expect(action).toEqual({
        type: 'playEvent',
        seat: 0,
        eventId: 'resilient_population',
        cardCityId: 'london',
      });
    });
  });
});
