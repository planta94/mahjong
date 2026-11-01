import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, beforeEach } from 'vitest';
import { GenericLobby } from '../../../../core/models/party.model';
import {
  CityCubes,
  createSerializableMap,
  CureStatus,
  DifficultyLevel,
  DiseaseColor,
  InfectionCard,
  PandemicAction,
  PandemicLobbySettings,
  PandemicPlayerState,
  PandemicPlayerView,
  PandemicSeat,
} from '../../models/pandemic.model';
import {
  PandemicSessionService,
  PandemicSnapshot,
} from '../../services/pandemic-session.service';
import { PandemicBoardComponent } from './pandemic-board.component';

describe('PandemicBoardComponent', () => {
  let component: PandemicBoardComponent;
  let fixture: ComponentFixture<PandemicBoardComponent>;
  let session: PandemicSessionService;
  let router: Router;

  function createMockPlayerView(
    overrides?: Partial<PandemicPlayerView>
  ): PandemicPlayerView {
    const cityCubes = createSerializableMap<string, CityCubes>();
    cityCubes.set('atlanta', { blue: 0, yellow: 0, black: 0, red: 0 });
    cityCubes.set('chicago', { blue: 2, yellow: 0, black: 0, red: 0 });
    cityCubes.set('tokyo', { blue: 0, yellow: 0, black: 0, red: 3 });

    const cubesRemaining = createSerializableMap<DiseaseColor, number>([
      ['blue', 22],
      ['yellow', 24],
      ['black', 24],
      ['red', 21],
    ]);

    const cureStatus = createSerializableMap<DiseaseColor, CureStatus>([
      ['blue', 'uncured'],
      ['yellow', 'uncured'],
      ['black', 'cured'],
      ['red', 'eradicated'],
    ]);

    const players: PandemicPlayerState[] = [
      {
        seat: 0,
        name: 'Medic Leader',
        role: 'medic',
        cityId: 'chicago',
        cards: [
          { type: 'city', cityId: 'chicago', color: 'blue' },
          { type: 'city', cityId: 'atlanta', color: 'blue' },
          { type: 'city', cityId: 'montreal', color: 'blue' },
          { type: 'city', cityId: 'new_york', color: 'blue' },
          { type: 'city', cityId: 'washington', color: 'blue' },
          { type: 'event', eventId: 'airlift' },
        ],
        operationsExpertFlightUsed: false,
        storedEventCard: null,
      },
      {
        seat: 1,
        name: 'Scientist Ally',
        role: 'scientist',
        cityId: 'chicago',
        cards: [
          { type: 'city', cityId: 'tokyo', color: 'red' },
          { type: 'event', eventId: 'one_quiet_night' },
        ],
        operationsExpertFlightUsed: false,
        storedEventCard: null,
      },
    ];

    return {
      gameId: 'pandemic',
      difficulty: 'standard',
      phase: 'actions',
      activeSeat: 0,
      actionsRemaining: 4,
      mySeat: 0,
      players,
      researchStations: ['atlanta', 'chicago'],
      cityCubes,
      cubesRemaining,
      cureStatus,
      infectionRateIndex: 1,
      outbreakCount: 2,
      playerDeckCount: 38,
      playerDiscard: [],
      infectionDeckCount: 36,
      infectionDiscard: [
        { cityId: 'tokyo', color: 'red' },
        { cityId: 'san_francisco', color: 'blue' },
      ],
      pendingEpidemicCityId: null,
      forecastCards: null,
      oneQuietNightActive: false,
      discardQueue: [],
      winner: null,
      winReason: null,
      lossReason: null,
      logs: ['Match started.'],
      ...overrides,
    };
  }

  function setupSnapshot(view: PandemicPlayerView): void {
    const seats: PandemicSeat[] = view.players.map((p) => ({
      seat: p.seat,
      kind: 'human',
      name: p.name,
      connected: true,
      role: p.role,
    }));

    const lobby: GenericLobby<PandemicSeat, PandemicLobbySettings> = {
      started: true,
      seats,
      rules: {
        difficulty: view.difficulty,
        numPlayers: seats.length,
        soloCommander: false,
      },
    };

    const snapshot: PandemicSnapshot = {
      role: 'host',
      mySeat: view.mySeat,
      roomCode: 'D555',
      lobby,
      view,
      online: true,
      status: 'connected',
      error: null,
    };

    session.snapshot.set(snapshot);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PandemicBoardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PandemicBoardComponent);
    component = fixture.componentInstance;
    session = TestBed.inject(PandemicSessionService);
    router = TestBed.inject(Router);
  });

  it('redirects to /pandemic/lobby if snapshot is not present', () => {
    session.snapshot.set(null);
    let navigatedTo = '';
    router.navigate = (cmds: unknown[]) => {
      navigatedTo = cmds.join('/');
      return Promise.resolve(true);
    };

    component.ngOnInit();
    expect(navigatedTo).toBe('/pandemic/lobby');
  });

  it('initializes map, normalRoutes, and computes legal actions', () => {
    const mockView = createMockPlayerView();
    setupSnapshot(mockView);
    fixture.detectChanges();

    expect(component.cities.length).toBe(48);
    expect(component.normalRoutes.length).toBeGreaterThan(50);

    // Verify wraparounds are excluded from normalRoutes
    const hasWraparound = component.normalRoutes.some(
      (r) =>
        (r.from.id === 'san_francisco' && r.to.id === 'tokyo') ||
        (r.from.id === 'los_angeles' && r.to.id === 'sydney')
    );
    expect(hasWraparound).toBe(false);

    expect(component.view()?.activeSeat).toBe(0);
    expect(component.isMyTurn()).toBe(true);

    const actions = component.legalActions();
    expect(actions?.canDriveOrFerryTo.length).toBeGreaterThan(0);
    expect(actions?.canTreatDiseases).toContain('blue');
  });

  it('handles region filter pill selection and dimming logic', () => {
    const mockView = createMockPlayerView();
    setupSnapshot(mockView);
    fixture.detectChanges();

    component.setRegion('blue');
    expect(component.selectedRegion()).toBe('blue');

    const chicagoNode = component.cityMap.get('chicago')!;
    const tokyoNode = component.cityMap.get('tokyo')!;

    expect(component.isCityDimmed(chicagoNode)).toBe(false);
    expect(component.isCityDimmed(tokyoNode)).toBe(true);

    const blueRoute = component.normalRoutes.find(
      (r) => r.from.id === 'chicago' && r.to.id === 'montreal'
    )!;
    expect(component.isRouteDimmed(blueRoute)).toBe(false);

    component.setRegion('all');
    expect(component.isCityDimmed(tokyoNode)).toBe(false);
  });

  it('toggles city selection and reports target validation', () => {
    const mockView = createMockPlayerView();
    setupSnapshot(mockView);
    fixture.detectChanges();

    component.selectCity('atlanta');
    expect(component.selectedCityId()).toBe('atlanta');
    expect(component.selectedCity()?.name).toBe('Atlanta');

    // Clicking same city deselects
    component.selectCity('atlanta');
    expect(component.selectedCityId()).toBeNull();

    // Adjacency check for Chicago neighbor
    expect(component.isValidTargetCity('san_francisco')).toBe(true);
  });

  it('dispatches movement and city operations', () => {
    const mockView = createMockPlayerView();
    setupSnapshot(mockView);
    fixture.detectChanges();

    let lastDispatchedAction: PandemicAction | null = null;
    session.dispatchAction = (action) => {
      lastDispatchedAction = action;
    };

    component.driveOrFerry('atlanta');
    expect(lastDispatchedAction).toEqual({
      type: 'driveOrFerry',
      toCityId: 'atlanta',
    });

    component.directFlight('montreal');
    expect(lastDispatchedAction).toEqual({
      type: 'directFlight',
      toCityId: 'montreal',
    });

    component.charterFlight('paris');
    expect(lastDispatchedAction).toEqual({
      type: 'charterFlight',
      toCityId: 'paris',
    });

    component.shuttleFlight('atlanta');
    expect(lastDispatchedAction).toEqual({
      type: 'shuttleFlight',
      toCityId: 'atlanta',
    });

    component.buildStation();
    expect(lastDispatchedAction).toEqual({
      type: 'buildStation',
      relocateFromCityId: undefined,
    });

    component.treatDisease('blue');
    expect(lastDispatchedAction).toEqual({
      type: 'treatDisease',
      color: 'blue',
    });

    component.shareKnowledge(1, 'chicago');
    expect(lastDispatchedAction).toEqual({
      type: 'shareKnowledge',
      targetSeat: 1,
      cardCityId: 'chicago',
    });

    component.discoverCure('blue');
    expect(lastDispatchedAction).toEqual({
      type: 'discoverCure',
      color: 'blue',
      cardCityIds: ['chicago', 'atlanta', 'montreal', 'new_york', 'washington'],
    });

    component.operationsExpertFlight('london');
    expect(lastDispatchedAction).toEqual({
      type: 'operationsExpertFlight',
      toCityId: 'london',
      discardCardCityId: 'chicago',
    });

    component.dispatcherMoveToPawn(0, 1);
    expect(lastDispatchedAction).toEqual({
      type: 'dispatcherMoveToPawn',
      targetSeat: 0,
      destinationSeat: 1,
    });

    component.contingencyPlannerTakeEvent('airlift');
    expect(lastDispatchedAction).toEqual({
      type: 'contingencyPlannerTakeEvent',
      eventId: 'airlift',
    });

    component.endActionsEarly();
    expect(lastDispatchedAction).toEqual({ type: 'endActionsEarly' });

    component.resolveEpidemicIntensify();
    expect(lastDispatchedAction).toEqual({ type: 'resolveEpidemicIntensify' });

    component.resolveInfectStep();
    expect(lastDispatchedAction).toEqual({ type: 'resolveInfectStep' });
  });

  it('handles anytime event triggers and modals', () => {
    const mockView = createMockPlayerView();
    setupSnapshot(mockView);
    fixture.detectChanges();

    let lastDispatchedAction: PandemicAction | null = null;
    session.dispatchAction = (action) => {
      lastDispatchedAction = action;
    };

    // One Quiet Night
    component.playEvent(0, 'one_quiet_night');
    expect(lastDispatchedAction).toEqual({
      type: 'playEvent',
      seat: 0,
      eventId: 'one_quiet_night',
    });

    // Forecast
    component.playEvent(0, 'forecast');
    expect(lastDispatchedAction).toEqual({
      type: 'playEvent',
      seat: 0,
      eventId: 'forecast',
    });

    // Resilient Population
    component.playEvent(0, 'resilient_population');
    expect(component.resilientPopActive()).toBe(true);
    expect(session.showInfectionDiscardModal()).toBe(true);

    component.exileInfectionCard('tokyo');
    expect(lastDispatchedAction).toEqual({
      type: 'playEvent',
      seat: 0,
      eventId: 'resilient_population',
      cardCityId: 'tokyo',
    });
    expect(component.resilientPopActive()).toBe(false);

    // Airlift
    component.playEvent(0, 'airlift');
    expect(component.showAirliftModal()).toBe(true);
    component.airliftTargetSeat.set(1);
    component.airliftToCityId.set('new_york');
    component.confirmAirlift();
    expect(lastDispatchedAction).toEqual({
      type: 'playEvent',
      seat: 0,
      eventId: 'airlift',
      targetSeat: 1,
      toCityId: 'new_york',
    });
    expect(component.showAirliftModal()).toBe(false);

    component.playEvent(0, 'airlift');
    component.closeAirliftModal();
    expect(component.showAirliftModal()).toBe(false);

    // Government Grant
    component.playEvent(0, 'government_grant');
    expect(component.showGovGrantModal()).toBe(true);
    component.govGrantCityId.set('paris');
    component.govGrantRelocateFrom.set('atlanta');
    component.confirmGovernmentGrant();
    expect(lastDispatchedAction).toEqual({
      type: 'playEvent',
      seat: 0,
      eventId: 'government_grant',
      toCityId: 'paris',
      relocateFromCityId: 'atlanta',
    });
    expect(component.showGovGrantModal()).toBe(false);

    component.playEvent(0, 'government_grant');
    component.closeGovGrantModal();
    expect(component.showGovGrantModal()).toBe(false);
  });

  it('manages forecast cards reordering and confirmation', () => {
    const mockInfectionCards: InfectionCard[] = [
      { cityId: 'london', color: 'blue' },
      { cityId: 'madrid', color: 'blue' },
      { cityId: 'paris', color: 'blue' },
    ];
    component.forecastCardsList.set(mockInfectionCards);

    component.moveForecastCardDown(0);
    expect(component.forecastCardsList().at(0)?.cityId).toBe('madrid');
    expect(component.forecastCardsList().at(1)?.cityId).toBe('london');

    component.moveForecastCardUp(1);
    expect(component.forecastCardsList().at(0)?.cityId).toBe('london');

    let confirmedAction: PandemicAction | null = null;
    session.dispatchAction = (action) => {
      confirmedAction = action;
    };

    component.confirmForecast();
    expect(confirmedAction).toEqual({
      type: 'confirmForecast',
      reorderedCityIds: ['london', 'madrid', 'paris'],
    });
  });

  it('manages hand-limit discard selection and dispatch', () => {
    const mockView = createMockPlayerView({
      phase: 'discard',
      discardQueue: [0],
    });
    setupSnapshot(mockView);
    fixture.detectChanges();

    component.selectDiscardCard(2);
    expect(component.selectedDiscardCardIndex()).toBe(2);

    let discardAction: PandemicAction | null = null;
    session.dispatchAction = (action) => {
      discardAction = action;
    };

    component.confirmDiscardCard();
    expect(discardAction).toEqual({
      type: 'discardCard',
      seat: 0,
      cardIndex: 2,
    });
    expect(component.selectedDiscardCardIndex()).toBeNull();
  });

  it('provides visual and status helpers accurately', () => {
    const mockView = createMockPlayerView();
    setupSnapshot(mockView);
    fixture.detectChanges();

    expect(component.getRoleColor('medic')).toBe('#e67e22');
    expect(component.getRoleColor(undefined)).toBe('#38bdf8');
    expect(component.getRoleNameKey('medic')).toBe('PANDEMIC.ROLE_MEDIC_NAME');
    expect(component.getRoleNameKey(undefined)).toBe('PANDEMIC.ROLE_RANDOM');
    expect(component.getCityName('atlanta')).toBe('Atlanta');
    expect(component.getCureStatus('black')).toBe('cured');
    expect(component.getCureStatus('red')).toBe('eradicated');
    expect(component.getCubesRemaining('blue')).toBe(22);
    expect(component.getDifficultyKey('heroic')).toBe('PANDEMIC.DIFF_HEROIC');

    const hotspots = component.hotspots();
    expect(hotspots.length).toBe(2);
    expect(hotspots.at(0)?.city.id).toBe('tokyo');
    expect(hotspots.at(0)?.total).toBe(3);

    expect(component.getTotalCubesOnCity('tokyo')).toBe(3);
    expect(component.getPlayersAtCity('chicago').length).toBe(2);
    expect(component.hasStation('atlanta')).toBe(true);
    expect(component.hasStation('tokyo')).toBe(false);
  });

  it('renders victory / defeat modal and supports return actions', () => {
    const mockView = createMockPlayerView({
      phase: 'game_over',
      winner: 'players',
      winReason: 'ALL_CURES_DISCOVERED',
    });
    setupSnapshot(mockView);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const desktopTable = root.querySelector('.modal-body .desktop-table');
    expect(desktopTable?.querySelectorAll('tbody tr').length).toBe(4);

    const mobileCards = root.querySelectorAll('.modal-body .mobile-cards .mobile-app-card');
    expect(mobileCards.length).toBe(1);

    let navigatedRoute = '';
    router.navigate = (cmds: unknown[]) => {
      navigatedRoute = cmds.join('/');
      return Promise.resolve(true);
    };

    component.playAgain();
    expect(navigatedRoute).toBe('/pandemic/lobby');

    component.goToHub();
    expect(navigatedRoute).toBe('/');
  });

  it('handles closeInfectionDiscardModal and forecast phase sync effect', () => {
    const mockView = createMockPlayerView({
      phase: 'forecast',
      forecastCards: [
        { cityId: 'tokyo', color: 'red' },
        { cityId: 'beijing', color: 'red' },
      ],
    });
    setupSnapshot(mockView);
    fixture.detectChanges();

    expect(component.forecastCardsList().length).toBe(2);
    expect(session.showForecastModal()).toBe(true);

    component.resilientPopActive.set(true);
    component.closeInfectionDiscardModal();
    expect(component.resilientPopActive()).toBe(false);
    expect(session.showInfectionDiscardModal()).toBe(false);

    expect(component.getDifficultyKey(undefined)).toBe('PANDEMIC.DIFF_STANDARD');
    expect(component.getDifficultyKey('introductory')).toBe('PANDEMIC.DIFF_INTRODUCTORY');
    expect(component.getDifficultyKey('standard')).toBe('PANDEMIC.DIFF_STANDARD');
    expect(component.getEventNameKey('one_quiet_night')).toBe('PANDEMIC.EVENT_ONE_QUIET_NIGHT_NAME');
  });

  it('supports Solo Commander mode computing legal actions for active seat', () => {
    const mockView = createMockPlayerView({
      activeSeat: 1,
    });
    const seats: PandemicSeat[] = mockView.players.map((p) => ({
      seat: p.seat,
      kind: 'human',
      name: p.name,
      connected: true,
      role: p.role,
    }));

    const snapshot: PandemicSnapshot = {
      role: 'host',
      mySeat: 0,
      roomCode: 'D555',
      lobby: {
        started: true,
        seats,
        rules: {
          difficulty: 'standard',
          numPlayers: 2,
          soloCommander: true,
        },
      },
      view: mockView,
      online: true,
      status: 'connected',
      error: null,
    };

    session.snapshot.set(snapshot);
    fixture.detectChanges();

    expect(component.isSoloCommander()).toBe(true);
    expect(component.isMyTurn()).toBe(true);
    expect(component.effectiveActorSeat()).toBe(1);
    expect(component.effectiveActorPlayer()?.name).toBe('Scientist Ally');
  });

  it('renders side-by-side map-column and ops-sidebar with centered SVG cube and station badges', () => {
    const mockView = createMockPlayerView();
    setupSnapshot(mockView);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(
      root.querySelectorAll('.tactical-stage > .map-column .svg-map-wrapper svg.pandemic-svg-map').length
    ).toBe(1);
    expect(root.querySelectorAll('.tactical-stage > .ops-sidebar .action-drawer').length).toBe(1);
    expect(root.querySelectorAll('.tactical-stage > .ops-sidebar .team-dock').length).toBe(1);

    const cubeTexts = root.querySelectorAll('text.cubes-badge-text');
    expect(cubeTexts.length).toBe(2);
    expect(cubeTexts.item(0)?.getAttribute('x')).toBe('0');
    expect(cubeTexts.item(0)?.getAttribute('y')).toBe('0');
    expect(cubeTexts.item(0)?.getAttribute('dominant-baseline')).toBe('central');
    expect(cubeTexts.item(0)?.getAttribute('text-anchor')).toBe('middle');

    const stationTexts = root.querySelectorAll('text.station-icon-text');
    expect(stationTexts.length).toBe(2);
    expect(stationTexts.item(0)?.getAttribute('x')).toBe('0');
    expect(stationTexts.item(0)?.getAttribute('y')).toBe('0');
  });

  it('supports map zoom buttons, focus active specialist, wheel zoom, pointer drag pan, and 2-finger pinch zoom', () => {
    const mockView = createMockPlayerView();
    setupSnapshot(mockView);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const wrapper = root.querySelector('.svg-map-wrapper') as HTMLElement;
    expect(root.querySelectorAll('.map-zoom-controls .zoom-btn').length).toBe(4);
    expect(component.mapZoom()).toBe(1);
    expect(component.mapZoomPercent()).toBe(100);
    expect(component.mapViewBox()).toBe('0.0 0.0 1000.0 520.0');

    // Zoom in & out & reset
    component.zoomIn();
    expect(component.mapZoom()).toBe(1.5);
    expect(component.mapZoomPercent()).toBe(150);

    component.focusActiveSpecialist();
    expect(component.mapZoom()).toBe(2.2);
    expect(component.mapPanX()).toBeLessThan(0);

    // 1-pointer drag pan while zoomed in suppresses accidental city select
    component.onMapPointerDown({ pointerId: 1, clientX: 200, clientY: 150 } as PointerEvent);
    expect(component.isPanning()).toBe(true);
    const panBefore = component.mapPanX();
    component.onMapPointerMove({ pointerId: 1, clientX: 140, clientY: 130 } as PointerEvent, wrapper);
    expect(component.mapPanX()).toBeGreaterThan(panBefore);
    component.onMapPointerUp({ pointerId: 1, clientX: 140, clientY: 130 } as PointerEvent);
    expect(component.isPanning()).toBe(false);

    // Drag exceeded threshold: first click after drag is ignored, subsequent click selects normally
    component.selectCity('tokyo');
    expect(component.selectedCityId()).toBeNull();
    component.selectCity('tokyo');
    expect(component.selectedCityId()).toBe('tokyo');

    // Reset zoom
    component.resetZoom();
    expect(component.mapZoom()).toBe(1);
    expect(component.mapPanX()).toBe(0);
    expect(component.mapPanY()).toBe(0);

    // Wheel zoom with ctrlKey
    let prevented = false;
    component.onMapWheel({
      deltaY: -100,
      ctrlKey: true,
      metaKey: false,
      preventDefault: () => {
        prevented = true;
      },
    } as unknown as WheelEvent);
    expect(prevented).toBe(true);
    expect(component.mapZoom()).toBe(1.35);

    component.zoomOut();
    expect(component.mapZoom()).toBe(1);

    // 2-finger pinch zoom
    component.onMapPointerDown({ pointerId: 10, clientX: 100, clientY: 100 } as PointerEvent);
    component.onMapPointerDown({ pointerId: 11, clientX: 200, clientY: 100 } as PointerEvent);
    component.onMapPointerMove({ pointerId: 11, clientX: 300, clientY: 100 } as PointerEvent, wrapper);
    expect(component.mapZoom()).toBe(2);
    component.onMapPointerUp({ pointerId: 10, clientX: 100, clientY: 100 } as PointerEvent);
    component.onMapPointerUp({ pointerId: 11, clientX: 300, clientY: 100 } as PointerEvent);
    expect(component.isPanning()).toBe(false);
  });
});
