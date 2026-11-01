import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ShellUiService } from '../../../../core/services/shell-ui.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  CITY_ADJACENCY_MAP,
  PACIFIC_WRAPAROUND_ROUTES,
  PANDEMIC_CITIES,
  PANDEMIC_CITIES_MAP,
  PandemicCityNode,
} from '../../data/pandemic-cities.data';
import {
  EVENT_SPEC_MAP,
  ROLE_SPEC_MAP,
} from '../../data/pandemic-roles-events.data';
import {
  CityCubes,
  CityPlayerCard,
  CureStatus,
  DifficultyLevel,
  DiseaseColor,
  EventCardId,
  INFECTION_RATES,
  InfectionCard,
  MAX_OUTBREAKS,
  MAX_RESEARCH_STATIONS,
  PandemicPlayerState,
  SpecialistRole,
} from '../../models/pandemic.model';
import {
  LegalActionsSummary,
  PandemicEngineService,
} from '../../services/pandemic-engine.service';
import { PandemicSessionService } from '../../services/pandemic-session.service';

export interface RouteSegment {
  readonly from: PandemicCityNode;
  readonly to: PandemicCityNode;
}

@Component({
  selector: 'app-pandemic-board',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './pandemic-board.component.html',
  styleUrl: './pandemic-board.component.scss',
})
export class PandemicBoardComponent implements OnInit {
  readonly session = inject(PandemicSessionService);
  readonly engine = inject(PandemicEngineService);
  readonly shellUi = inject(ShellUiService);
  private readonly router = inject(Router);

  readonly cities = PANDEMIC_CITIES;
  readonly cityMap = PANDEMIC_CITIES_MAP;
  readonly adjacencyMap = CITY_ADJACENCY_MAP;
  readonly wraparoundRoutes = PACIFIC_WRAPAROUND_ROUTES;
  readonly roleSpecMap = ROLE_SPEC_MAP;
  readonly eventSpecMap = EVENT_SPEC_MAP;
  readonly infectionRates = INFECTION_RATES;
  readonly maxOutbreaks = MAX_OUTBREAKS;
  readonly maxStations = MAX_RESEARCH_STATIONS;
  readonly diseaseColors: readonly DiseaseColor[] = ['blue', 'yellow', 'black', 'red'];

  readonly normalRoutes: readonly RouteSegment[] = this.computeNormalRoutes();

  private static readonly MAP_WIDTH = 1000;
  private static readonly MAP_HEIGHT = 520;
  private static readonly MIN_ZOOM = 1;
  private static readonly MAX_ZOOM = 3.5;
  private static readonly ZOOM_STEP = 0.5;

  // Interactive Map Zoom & Pan Signals
  readonly mapZoom = signal<number>(1);
  readonly mapPanX = signal<number>(0);
  readonly mapPanY = signal<number>(0);
  readonly isPanning = signal<boolean>(false);

  private readonly activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDistance: number | null = null;
  private panDragExceededThreshold = false;
  private pointerDownOrigin: { x: number; y: number } | null = null;

  readonly mapViewBox = computed<string>(() => {
    const z = this.mapZoom();
    const viewW = PandemicBoardComponent.MAP_WIDTH / z;
    const viewH = PandemicBoardComponent.MAP_HEIGHT / z;
    const maxPanX = (PandemicBoardComponent.MAP_WIDTH - viewW) / 2;
    const maxPanY = (PandemicBoardComponent.MAP_HEIGHT - viewH) / 2;
    const clampedPanX = Math.max(-maxPanX, Math.min(maxPanX, this.mapPanX()));
    const clampedPanY = Math.max(-maxPanY, Math.min(maxPanY, this.mapPanY()));
    const minX = PandemicBoardComponent.MAP_WIDTH / 2 + clampedPanX - viewW / 2;
    const minY = PandemicBoardComponent.MAP_HEIGHT / 2 + clampedPanY - viewH / 2;
    return `${minX.toFixed(1)} ${minY.toFixed(1)} ${viewW.toFixed(1)} ${viewH.toFixed(1)}`;
  });

  readonly mapZoomPercent = computed<number>(() => Math.round(this.mapZoom() * 100));

  // Signals from session
  readonly view = this.session.currentView;
  readonly mySeat = this.session.mySeat;
  readonly isMyTurn = this.session.isMyTurn;
  readonly isSoloCommander = this.session.isSoloCommander;
  readonly activePlayer = this.session.activePlayer;
  readonly selectedCityId = this.session.selectedCityId;
  readonly selectedRegion = this.session.selectedRegion;

  // Modals signals
  readonly showForecastModal = this.session.showForecastModal;
  readonly showDiscardModal = this.session.showDiscardModal;
  readonly showInfectionDiscardModal = this.session.showInfectionDiscardModal;
  readonly showVictoryDefeatModal = this.session.showVictoryDefeatModal;

  // Local Modal States
  readonly forecastCardsList = signal<InfectionCard[]>([]);
  readonly selectedDiscardCardIndex = signal<number | null>(null);
  readonly resilientPopActive = signal<boolean>(false);
  readonly resilientPopActorSeat = signal<number>(0);

  readonly showAirliftModal = signal<boolean>(false);
  readonly airliftActorSeat = signal<number>(0);
  readonly airliftTargetSeat = signal<number>(0);
  readonly airliftToCityId = signal<string>('atlanta');

  readonly showGovGrantModal = signal<boolean>(false);
  readonly govGrantActorSeat = signal<number>(0);
  readonly govGrantCityId = signal<string>('chicago');
  readonly govGrantRelocateFrom = signal<string | null>(null);

  // Computed state
  readonly selectedCity = computed<PandemicCityNode | null>(() => {
    const id = this.selectedCityId();
    return id ? this.cityMap.get(id) ?? null : null;
  });

  readonly legalActions = computed<LegalActionsSummary | null>(() => {
    const v = this.view();
    if (!v || v.phase === 'game_over') return null;
    const actor = this.isSoloCommander() ? v.activeSeat : this.mySeat();
    if (actor < 0) return null;
    return this.engine.getLegalActions(v, actor);
  });

  readonly effectiveActorSeat = computed<number>(() => {
    const v = this.view();
    if (!v) return 0;
    return this.isSoloCommander() ? v.activeSeat : this.mySeat();
  });

  readonly effectiveActorPlayer = computed<PandemicPlayerState | null>(() => {
    const v = this.view();
    const seat = this.effectiveActorSeat();
    if (!v || seat < 0) return null;
    return v.players.find((p) => p.seat === seat) ?? null;
  });

  readonly hotspots = computed(() => {
    const v = this.view();
    if (!v) return [];
    const list: {
      city: PandemicCityNode;
      total: number;
      blue: number;
      yellow: number;
      black: number;
      red: number;
    }[] = [];

    for (const city of this.cities) {
      const cubes = v.cityCubes.get(city.id) ?? {
        blue: 0,
        yellow: 0,
        black: 0,
        red: 0,
      };
      const total = cubes.blue + cubes.yellow + cubes.black + cubes.red;
      if (total > 0) {
        list.push({
          city,
          total,
          blue: cubes.blue,
          yellow: cubes.yellow,
          black: cubes.black,
          red: cubes.red,
        });
      }
    }
    return list.sort((a, b) => b.total - a.total);
  });

  constructor() {
    // Keep forecast modal synced with engine state
    effect(() => {
      const v = this.view();
      if (v?.phase === 'forecast' && v.forecastCards) {
        this.forecastCardsList.set([...v.forecastCards]);
        this.session.openForecastModal();
      } else if (v?.phase !== 'forecast') {
        this.session.closeForecastModal();
      }
    });

    // Keep discard modal synced
    effect(() => {
      const v = this.view();
      if (v?.phase === 'discard' && v.discardQueue.length > 0) {
        const queueSeat = v.discardQueue.at(0) ?? -1;
        if (this.isSoloCommander() || queueSeat === this.mySeat()) {
          this.session.openDiscardModal();
        }
      } else if (v?.phase !== 'discard') {
        this.session.closeDiscardModal();
      }
    });

    // Auto-open victory / defeat modal when game ends
    effect(() => {
      const v = this.view();
      if (v?.phase === 'game_over' || v?.winner !== null) {
        this.session.openVictoryDefeatModal();
      }
    });
  }

  ngOnInit(): void {
    this.shellUi.setActiveGame('pandemic');
    if (!this.session.snapshot()) {
      void this.router.navigate(['/pandemic/lobby']);
    }
  }

  // --- Map Route Precomputation ---

  private computeNormalRoutes(): RouteSegment[] {
    const routes: RouteSegment[] = [];
    const isWraparound = (c1: string, c2: string): boolean =>
      (c1 === 'san_francisco' && (c2 === 'tokyo' || c2 === 'manila')) ||
      (c2 === 'san_francisco' && (c1 === 'tokyo' || c1 === 'manila')) ||
      (c1 === 'los_angeles' && c2 === 'sydney') ||
      (c2 === 'los_angeles' && c1 === 'sydney');

    for (const city of PANDEMIC_CITIES) {
      for (const neighborId of city.neighbors) {
        if (city.id < neighborId && !isWraparound(city.id, neighborId)) {
          const neighbor = PANDEMIC_CITIES_MAP.get(neighborId);
          if (neighbor) {
            routes.push({ from: city, to: neighbor });
          }
        }
      }
    }
    return routes;
  }

  // --- Map Interactivity, Zoom/Pan & Filters ---

  private applyClampedPan(nextPanX: number, nextPanY: number, zoom: number): void {
    const viewW = PandemicBoardComponent.MAP_WIDTH / zoom;
    const viewH = PandemicBoardComponent.MAP_HEIGHT / zoom;
    const maxPanX = (PandemicBoardComponent.MAP_WIDTH - viewW) / 2;
    const maxPanY = (PandemicBoardComponent.MAP_HEIGHT - viewH) / 2;
    this.mapPanX.set(Math.max(-maxPanX, Math.min(maxPanX, nextPanX)));
    this.mapPanY.set(Math.max(-maxPanY, Math.min(maxPanY, nextPanY)));
  }

  setZoomLevel(nextZoom: number): void {
    const clamped = Math.max(
      PandemicBoardComponent.MIN_ZOOM,
      Math.min(PandemicBoardComponent.MAX_ZOOM, Math.round(nextZoom * 100) / 100)
    );
    this.mapZoom.set(clamped);
    if (clamped <= 1) {
      this.mapPanX.set(0);
      this.mapPanY.set(0);
    } else {
      this.applyClampedPan(this.mapPanX(), this.mapPanY(), clamped);
    }
  }

  zoomIn(): void {
    this.setZoomLevel(this.mapZoom() + PandemicBoardComponent.ZOOM_STEP);
  }

  zoomOut(): void {
    this.setZoomLevel(this.mapZoom() - PandemicBoardComponent.ZOOM_STEP);
  }

  resetZoom(): void {
    this.mapZoom.set(1);
    this.mapPanX.set(0);
    this.mapPanY.set(0);
  }

  focusActiveSpecialist(): void {
    const actor = this.effectiveActorPlayer() ?? this.activePlayer();
    if (!actor) return;
    const city = this.cityMap.get(actor.cityId);
    if (!city) return;
    const nextZoom = Math.max(this.mapZoom(), 2.2);
    this.mapZoom.set(nextZoom);
    this.applyClampedPan(
      city.x - PandemicBoardComponent.MAP_WIDTH / 2,
      city.y - PandemicBoardComponent.MAP_HEIGHT / 2,
      nextZoom
    );
  }

  onMapWheel(event: WheelEvent): void {
    const desktopNoScroll =
      typeof window !== 'undefined' && window.innerWidth > 980 && window.innerHeight > 600;
    if (!desktopNoScroll && !event.ctrlKey && !event.metaKey && this.mapZoom() <= 1) {
      return;
    }
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.35 : -0.35;
    this.setZoomLevel(this.mapZoom() + delta);
  }

  onMapPointerDown(event: PointerEvent): void {
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.activePointers.size === 1) {
      this.pointerDownOrigin = { x: event.clientX, y: event.clientY };
      this.panDragExceededThreshold = false;
      if (this.mapZoom() > 1) {
        this.isPanning.set(true);
      }
    } else if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      const p0 = pts.at(0);
      const p1 = pts.at(1);
      if (p0 && p1) {
        this.lastPinchDistance = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      }
      this.panDragExceededThreshold = true;
      this.isPanning.set(true);
    }
  }

  onMapPointerMove(event: PointerEvent, container: HTMLElement): void {
    const prev = this.activePointers.get(event.pointerId);
    if (!prev) return;
    const curr = { x: event.clientX, y: event.clientY };
    this.activePointers.set(event.pointerId, curr);

    if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      const p0 = pts.at(0);
      const p1 = pts.at(1);
      if (p0 && p1) {
        const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        if (this.lastPinchDistance && this.lastPinchDistance > 8) {
          const scaleFactor = dist / this.lastPinchDistance;
          this.setZoomLevel(this.mapZoom() * scaleFactor);
        }
        this.lastPinchDistance = dist;
      }
      return;
    }

    if (this.activePointers.size === 1 && this.mapZoom() > 1) {
      if (
        this.pointerDownOrigin &&
        Math.hypot(curr.x - this.pointerDownOrigin.x, curr.y - this.pointerDownOrigin.y) > 6
      ) {
        this.panDragExceededThreshold = true;
      }
      const rectW = Math.max(container.clientWidth, 200);
      const rectH = Math.max(container.clientHeight, 120);
      const z = this.mapZoom();
      const svgUnitsPerPxX = PandemicBoardComponent.MAP_WIDTH / z / rectW;
      const svgUnitsPerPxY = PandemicBoardComponent.MAP_HEIGHT / z / rectH;
      const dx = (curr.x - prev.x) * svgUnitsPerPxX;
      const dy = (curr.y - prev.y) * svgUnitsPerPxY;
      this.applyClampedPan(this.mapPanX() - dx, this.mapPanY() - dy, z);
    }
  }

  onMapPointerUp(event: PointerEvent): void {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size < 2) {
      this.lastPinchDistance = null;
    }
    if (this.activePointers.size === 0) {
      this.isPanning.set(false);
      this.pointerDownOrigin = null;
    }
  }

  selectCity(cityId: string): void {
    if (this.panDragExceededThreshold) {
      this.panDragExceededThreshold = false;
      return;
    }
    if (this.selectedCityId() === cityId) {
      this.session.selectCity(null);
    } else {
      this.session.selectCity(cityId);
    }
  }

  setRegion(region: 'all' | DiseaseColor): void {
    this.session.setRegion(region);
  }

  isCityDimmed(city: PandemicCityNode): boolean {
    const reg = this.selectedRegion();
    if (reg === 'all') return false;
    return city.color !== reg;
  }

  isRouteDimmed(route: RouteSegment): boolean {
    const reg = this.selectedRegion();
    if (reg === 'all') return false;
    return route.from.color !== reg && route.to.color !== reg;
  }

  getCubesOnCity(cityId: string): CityCubes {
    const v = this.view();
    return (
      v?.cityCubes.get(cityId) ?? {
        blue: 0,
        yellow: 0,
        black: 0,
        red: 0,
      }
    );
  }

  getTotalCubesOnCity(cityId: string): number {
    const c = this.getCubesOnCity(cityId);
    return c.blue + c.yellow + c.black + c.red;
  }

  getPlayersAtCity(cityId: string): readonly PandemicPlayerState[] {
    const v = this.view();
    if (!v) return [];
    return v.players.filter((p) => p.cityId === cityId);
  }

  hasStation(cityId: string): boolean {
    const v = this.view();
    return Boolean(v?.researchStations.includes(cityId));
  }

  isValidTargetCity(cityId: string): boolean {
    const actions = this.legalActions();
    if (!actions) return false;
    return (
      actions.canDriveOrFerryTo.includes(cityId) ||
      actions.canDirectFlightTo.includes(cityId) ||
      actions.canCharterFlightTo.includes(cityId) ||
      actions.canShuttleFlightTo.includes(cityId) ||
      actions.canOperationsExpertFlightTo.includes(cityId)
    );
  }

  // --- Action Execution ---

  driveOrFerry(toCityId: string): void {
    this.session.dispatchAction({ type: 'driveOrFerry', toCityId });
    this.session.selectCity(null);
  }

  directFlight(toCityId: string): void {
    this.session.dispatchAction({ type: 'directFlight', toCityId });
    this.session.selectCity(null);
  }

  charterFlight(toCityId: string): void {
    this.session.dispatchAction({ type: 'charterFlight', toCityId });
    this.session.selectCity(null);
  }

  shuttleFlight(toCityId: string): void {
    this.session.dispatchAction({ type: 'shuttleFlight', toCityId });
    this.session.selectCity(null);
  }

  buildStation(relocateFromCityId?: string): void {
    this.session.dispatchAction({ type: 'buildStation', relocateFromCityId });
  }

  treatDisease(color: DiseaseColor): void {
    this.session.dispatchAction({ type: 'treatDisease', color });
  }

  shareKnowledge(targetSeat: number, cardCityId: string): void {
    this.session.dispatchAction({
      type: 'shareKnowledge',
      targetSeat,
      cardCityId,
    });
  }

  discoverCure(color: DiseaseColor): void {
    const player = this.effectiveActorPlayer();
    if (!player) return;
    const requiredCount = player.role === 'scientist' ? 4 : 5;
    const cards = player.cards
      .filter((c): c is CityPlayerCard => c.type === 'city' && c.color === color)
      .slice(0, requiredCount)
      .map((c) => c.cityId);

    if (cards.length >= requiredCount) {
      this.session.dispatchAction({
        type: 'discoverCure',
        color,
        cardCityIds: cards,
      });
    }
  }

  operationsExpertFlight(toCityId: string): void {
    const player = this.effectiveActorPlayer();
    if (!player) return;
    const firstCityCard = player.cards.find((c): c is CityPlayerCard => c.type === 'city');
    if (!firstCityCard) return;

    this.session.dispatchAction({
      type: 'operationsExpertFlight',
      toCityId,
      discardCardCityId: firstCityCard.cityId,
    });
    this.session.selectCity(null);
  }

  dispatcherMoveToPawn(targetSeat: number, destinationSeat: number): void {
    this.session.dispatchAction({
      type: 'dispatcherMoveToPawn',
      targetSeat,
      destinationSeat,
    });
  }

  contingencyPlannerTakeEvent(eventId: EventCardId): void {
    this.session.dispatchAction({
      type: 'contingencyPlannerTakeEvent',
      eventId,
    });
  }

  endActionsEarly(): void {
    this.session.dispatchAction({ type: 'endActionsEarly' });
  }

  resolveEpidemicIntensify(): void {
    this.session.dispatchAction({ type: 'resolveEpidemicIntensify' });
  }

  resolveInfectStep(): void {
    this.session.dispatchAction({ type: 'resolveInfectStep' });
  }

  // --- Anytime Event Handling ---

  playEvent(seat: number, eventId: EventCardId): void {
    if (eventId === 'one_quiet_night') {
      this.session.dispatchAction({
        type: 'playEvent',
        seat,
        eventId: 'one_quiet_night',
      });
    } else if (eventId === 'forecast') {
      this.session.dispatchAction({
        type: 'playEvent',
        seat,
        eventId: 'forecast',
      });
    } else if (eventId === 'resilient_population') {
      this.resilientPopActorSeat.set(seat);
      this.resilientPopActive.set(true);
      this.session.openInfectionDiscardModal();
    } else if (eventId === 'airlift') {
      this.airliftActorSeat.set(seat);
      this.showAirliftModal.set(true);
    } else if (eventId === 'government_grant') {
      this.govGrantActorSeat.set(seat);
      this.showGovGrantModal.set(true);
    }
  }

  // --- Forecast Modal Logic ---

  moveForecastCardUp(idx: number): void {
    if (idx <= 0) return;
    const list = [...this.forecastCardsList()];
    const current = list.at(idx);
    const prev = list.at(idx - 1);
    if (current && prev) {
      list.splice(idx - 1, 2, current, prev);
      this.forecastCardsList.set(list);
    }
  }

  moveForecastCardDown(idx: number): void {
    const list = [...this.forecastCardsList()];
    if (idx >= list.length - 1) return;
    const current = list.at(idx);
    const next = list.at(idx + 1);
    if (current && next) {
      list.splice(idx, 2, next, current);
      this.forecastCardsList.set(list);
    }
  }

  confirmForecast(): void {
    const reorderedCityIds = this.forecastCardsList().map((c) => c.cityId);
    this.session.dispatchAction({
      type: 'confirmForecast',
      reorderedCityIds,
    });
    this.session.closeForecastModal();
  }

  // --- Discard Modal Logic ---

  selectDiscardCard(index: number): void {
    this.selectedDiscardCardIndex.set(index);
  }

  confirmDiscardCard(): void {
    const v = this.view();
    const idx = this.selectedDiscardCardIndex();
    if (!v || idx === null || v.discardQueue.length === 0) return;
    const targetSeat = v.discardQueue.at(0) ?? 0;
    this.session.dispatchAction({
      type: 'discardCard',
      seat: targetSeat,
      cardIndex: idx,
    });
    this.selectedDiscardCardIndex.set(null);
  }

  // --- Resilient Population Logic ---

  exileInfectionCard(cityId: string): void {
    if (!this.resilientPopActive()) return;
    const seat = this.resilientPopActorSeat();
    this.session.dispatchAction({
      type: 'playEvent',
      seat,
      eventId: 'resilient_population',
      cardCityId: cityId,
    });
    this.resilientPopActive.set(false);
    this.session.closeInfectionDiscardModal();
  }

  closeInfectionDiscardModal(): void {
    this.resilientPopActive.set(false);
    this.session.closeInfectionDiscardModal();
  }

  // --- Airlift Event Logic ---

  confirmAirlift(): void {
    this.session.dispatchAction({
      type: 'playEvent',
      seat: this.airliftActorSeat(),
      eventId: 'airlift',
      targetSeat: this.airliftTargetSeat(),
      toCityId: this.airliftToCityId(),
    });
    this.showAirliftModal.set(false);
  }

  closeAirliftModal(): void {
    this.showAirliftModal.set(false);
  }

  // --- Government Grant Event Logic ---

  confirmGovernmentGrant(): void {
    const relocate = this.govGrantRelocateFrom();
    this.session.dispatchAction({
      type: 'playEvent',
      seat: this.govGrantActorSeat(),
      eventId: 'government_grant',
      toCityId: this.govGrantCityId(),
      relocateFromCityId: relocate ?? undefined,
    });
    this.showGovGrantModal.set(false);
  }

  closeGovGrantModal(): void {
    this.showGovGrantModal.set(false);
  }

  // --- Victory / Defeat Modal Navigation ---

  playAgain(): void {
    this.session.closeVictoryDefeatModal();
    this.session.leaveRoom();
    void this.router.navigate(['/pandemic/lobby']);
  }

  goToHub(): void {
    this.session.closeVictoryDefeatModal();
    this.session.leaveRoom();
    void this.router.navigate(['/']);
  }

  // --- Visual & i18n Helpers ---

  getRoleColor(role?: SpecialistRole): string {
    if (!role) return '#38bdf8';
    return this.roleSpecMap.get(role)?.badgeColor ?? '#38bdf8';
  }

  getRoleNameKey(role?: SpecialistRole): string {
    if (!role) return 'PANDEMIC.ROLE_RANDOM';
    return this.roleSpecMap.get(role)?.nameKey ?? 'PANDEMIC.ROLE_RANDOM';
  }

  getEventNameKey(eventId: EventCardId): string {
    return this.eventSpecMap.get(eventId)?.nameKey ?? eventId;
  }

  getCityName(cityId: string): string {
    return this.cityMap.get(cityId)?.name ?? cityId;
  }

  getCureStatus(color: DiseaseColor): CureStatus {
    const v = this.view();
    return v?.cureStatus.get(color) ?? 'uncured';
  }

  getCubesRemaining(color: DiseaseColor): number {
    const v = this.view();
    return v?.cubesRemaining.get(color) ?? 24;
  }

  getDifficultyKey(diff?: DifficultyLevel): string {
    if (!diff) return 'PANDEMIC.DIFF_STANDARD';
    if (diff === 'introductory') return 'PANDEMIC.DIFF_INTRODUCTORY';
    if (diff === 'heroic') return 'PANDEMIC.DIFF_HEROIC';
    return 'PANDEMIC.DIFF_STANDARD';
  }
}
