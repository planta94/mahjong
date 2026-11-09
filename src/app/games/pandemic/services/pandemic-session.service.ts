import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  GenericLobby,
  GenericSessionSnapshot,
} from '../../../core/models/party.model';
import {
  GenericGuestSession,
  GenericHostSession,
  P2PRoomTransportService,
} from '../../../core/services/p2p-room.transport';
import { ShellUiService } from '../../../core/services/shell-ui.service';
import { ALL_SPECIALIST_ROLES } from '../data/pandemic-roles-events.data';
import {
  CityCubes,
  createSerializableMap,
  CureStatus,
  DifficultyLevel,
  DiseaseColor,
  EventCardId,
  hydratePandemicPlayerView,
  PandemicAction,
  PandemicLobbySettings,
  PandemicMatchState,
  PandemicPlayerView,
  PandemicSeat,
  SpecialistRole,
} from '../models/pandemic.model';
import { PandemicBotService } from './pandemic-bot.service';
import { PandemicEngineService } from './pandemic-engine.service';

export type PandemicSnapshot = GenericSessionSnapshot<
  PandemicPlayerView,
  GenericLobby<PandemicSeat, PandemicLobbySettings>
>;

export interface SerializedPandemicSave {
  lobby: GenericLobby<PandemicSeat, PandemicLobbySettings>;
  state: Omit<
    PandemicMatchState,
    'cityCubes' | 'cubesRemaining' | 'cureStatus'
  > & {
    cityCubesEntries: [string, CityCubes][];
    cubesRemainingEntries: [DiseaseColor, number][];
    cureStatusEntries: [DiseaseColor, CureStatus][];
  };
}

const BOT_NAMES = [
  'CDC Specialist Alpha (Bot)',
  'Epidemiologist Beta (Bot)',
  'Field Medic Gamma (Bot)',
  'Biohazard Scout Delta (Bot)',
];

export const DEFAULT_PANDEMIC_SETTINGS: PandemicLobbySettings = {
  difficulty: 'standard',
  numPlayers: 4,
  soloCommander: false,
};

@Injectable({
  providedIn: 'root',
})
export class PandemicSessionService {
  private readonly router = inject(Router);
  private readonly transport = inject(P2PRoomTransportService);
  private readonly engine = inject(PandemicEngineService);
  private readonly bot = inject(PandemicBotService);
  private readonly shellUi = inject(ShellUiService);

  readonly snapshot = signal<PandemicSnapshot | null>(null);

  readonly mySeat = computed(() => this.snapshot()?.mySeat ?? -1);
  readonly isHost = computed(() => this.snapshot()?.role === 'host');
  readonly currentView = computed(() => this.snapshot()?.view ?? null);
  readonly currentLobby = computed(() => this.snapshot()?.lobby ?? null);
  readonly isSoloCommander = computed(() => Boolean(this.currentLobby()?.rules?.soloCommander));

  readonly isMyTurn = computed(() => {
    const view = this.currentView();
    if (!view || view.phase === 'game_over') return false;
    if (this.isSoloCommander()) return true;
    return view.activeSeat === this.mySeat();
  });

  readonly activePlayer = computed(() => {
    const view = this.currentView();
    if (!view) return null;
    return view.players.find((p) => p.seat === view.activeSeat) ?? null;
  });

  readonly myPlayer = computed(() => {
    const view = this.currentView();
    const seat = this.mySeat();
    if (!view || seat < 0) return null;
    return view.players.find((p) => p.seat === seat) ?? null;
  });

  // UI Selection & Modal Signals
  readonly selectedCityId = signal<string | null>(null);
  readonly selectedRegion = signal<'all' | DiseaseColor>('all');
  readonly showForecastModal = signal<boolean>(false);
  readonly showDiscardModal = signal<boolean>(false);
  readonly showInfectionDiscardModal = signal<boolean>(false);
  readonly showVictoryDefeatModal = signal<boolean>(false);
  readonly showEventCardModal = signal<EventCardId | null>(null);

  private hostSession: GenericHostSession<
    PandemicMatchState,
    PandemicPlayerView,
    PandemicAction
  > | null = null;
  private guestSession: GenericGuestSession<PandemicPlayerView, PandemicAction> | null = null;
  private botTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('p2p:leave', (ev: Event) => {
        const detail = (ev as CustomEvent).detail as { game?: string } | undefined;
        if (!detail || !detail.game || detail.game === 'pandemic') {
          this.leaveRoom();
          if (this.router.url?.includes('/pandemic/board')) {
            void this.router.navigate(['/pandemic/lobby']);
          }
        }
      });
    }
  }

  // --- Solo Match with AI Bots ---

  createSoloMatch(playerCount = 4, customSettings?: Partial<PandemicLobbySettings>): void {
    this.leaveRoom();
    const settings: PandemicLobbySettings = {
      ...DEFAULT_PANDEMIC_SETTINGS,
      ...customSettings,
      numPlayers: playerCount,
      soloCommander: false,
    };

    const hostName = this.shellUi.playerNickname() || 'CDC Commander';
    const seats: PandemicSeat[] = [
      {
        seat: 0,
        kind: 'human',
        name: hostName,
        token: 'host_token',
        connected: true,
        role: settings.roles?.at(0) ?? 'random',
      },
    ];

    for (let i = 1; i < playerCount; i++) {
      seats.push({
        seat: i,
        kind: 'bot',
        name: BOT_NAMES.at((i - 1) % BOT_NAMES.length) ?? `Bot ${i}`,
        connected: true,
        role: settings.roles?.at(i) ?? 'random',
      });
    }

    const assignedRoles = this.resolveLobbyRoles(seats);
    const initialLobby: GenericLobby<PandemicSeat, PandemicLobbySettings> = {
      started: true,
      seats,
      rules: {
        ...settings,
        roles: assignedRoles,
      },
    };

    const initialState = this.engine.createInitialState({
      difficulty: settings.difficulty,
      numPlayers: playerCount,
      roles: assignedRoles,
      playerNames: seats.map((s) => s.name),
    });

    this.hostSession = this.transport.createHost<
      PandemicMatchState,
      PandemicPlayerView,
      PandemicAction
    >({
      gamePrefix: 'D',
      online: false,
      hostName,
      initialState,
      initialLobby,
      buildPlayerView: (state, seatIdx) => this.engine.getPandemicPlayerView(state, seatIdx),
      applyAction: (state, seatIdx, action) => this.handleActionApplied(state, seatIdx, action),
    });

    this.hostSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as PandemicSnapshot);
    });

    this.shellUi.setActiveGame('pandemic');
    this.shellUi.setActiveRoomCode(null);
    this.shellUi.playSfx('deal');
    void this.router.navigate(['/pandemic/board']);
  }

  // --- Solo Commander Mode ---
  // Local Seat 0 commands all 2-4 human Specialist seats directly without P2P

  createSoloCommanderMatch(playerCount = 4, customSettings?: Partial<PandemicLobbySettings>): void {
    this.leaveRoom();
    const settings: PandemicLobbySettings = {
      ...DEFAULT_PANDEMIC_SETTINGS,
      ...customSettings,
      numPlayers: playerCount,
      soloCommander: true,
    };

    const hostName = this.shellUi.playerNickname() || 'Solo Commander';
    const seats: PandemicSeat[] = [];

    for (let i = 0; i < playerCount; i++) {
      seats.push({
        seat: i,
        kind: 'human',
        name: i === 0 ? hostName : `Specialist ${i + 1}`,
        token: i === 0 ? 'host_token' : `commander_token_${i}`,
        connected: true,
        role: settings.roles?.at(i) ?? 'random',
      });
    }

    const assignedRoles = this.resolveLobbyRoles(seats);
    const initialLobby: GenericLobby<PandemicSeat, PandemicLobbySettings> = {
      started: true,
      seats,
      rules: {
        ...settings,
        roles: assignedRoles,
      },
    };

    const initialState = this.engine.createInitialState({
      difficulty: settings.difficulty,
      numPlayers: playerCount,
      roles: assignedRoles,
      playerNames: seats.map((s) => s.name),
    });

    this.hostSession = this.transport.createHost<
      PandemicMatchState,
      PandemicPlayerView,
      PandemicAction
    >({
      gamePrefix: 'D',
      online: false,
      hostName,
      initialState,
      initialLobby,
      buildPlayerView: (state, seatIdx) => this.engine.getPandemicPlayerView(state, seatIdx),
      applyAction: (state, seatIdx, action) => this.handleActionApplied(state, seatIdx, action),
    });

    this.hostSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as PandemicSnapshot);
    });

    this.shellUi.setActiveGame('pandemic');
    this.shellUi.setActiveRoomCode(null);
    this.shellUi.playSfx('deal');
    void this.router.navigate(['/pandemic/board']);
  }

  // --- Online P2P (D* Codes) ---

  createMultiplayerRoom(seatsCount = 4, customSettings?: Partial<PandemicLobbySettings>): string {
    this.leaveRoom();
    const settings: PandemicLobbySettings = {
      ...DEFAULT_PANDEMIC_SETTINGS,
      ...customSettings,
      numPlayers: seatsCount,
      soloCommander: false,
    };

    const hostName = this.shellUi.playerNickname() || 'Host';
    const seats: PandemicSeat[] = [
      {
        seat: 0,
        kind: 'human',
        name: hostName,
        connected: true,
        role: 'random',
      },
    ];

    for (let i = 1; i < seatsCount; i++) {
      seats.push({
        seat: i,
        kind: 'open',
        name: `Player ${i + 1}`,
        connected: false,
        role: 'random',
      });
    }

    const initialLobby: GenericLobby<PandemicSeat, PandemicLobbySettings> = {
      started: false,
      seats,
      rules: settings,
    };

    // Placeholder initial state before match start
    const dummyState = this.engine.createInitialState({
      difficulty: settings.difficulty,
      numPlayers: seatsCount,
    });

    this.hostSession = this.transport.createHost<
      PandemicMatchState,
      PandemicPlayerView,
      PandemicAction
    >({
      gamePrefix: 'D',
      online: true,
      hostName,
      initialState: dummyState,
      initialLobby,
      buildPlayerView: (state, seatIdx) => this.engine.getPandemicPlayerView(state, seatIdx),
      applyAction: (state, seatIdx, action) => this.handleActionApplied(state, seatIdx, action),
    });

    const roomCode = this.hostSession.roomCode;
    this.hostSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as PandemicSnapshot);
    });

    this.shellUi.setActiveGame('pandemic');
    this.shellUi.setActiveRoomCode(roomCode);
    this.transport.updateUrl(roomCode, 'pandemic');
    this.shellUi.playSfx('click');

    return roomCode;
  }

  joinMultiplayerRoom(roomCode: string): void {
    this.leaveRoom();
    const guestName = this.shellUi.playerNickname() || 'Specialist';
    this.guestSession = this.transport.createGuest<PandemicPlayerView, PandemicAction>({
      roomCode,
      guestName,
    });

    this.guestSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as PandemicSnapshot);
    });

    this.shellUi.setActiveGame('pandemic');
    this.shellUi.setActiveRoomCode(roomCode);
    this.transport.updateUrl(roomCode, 'pandemic');
    this.shellUi.playSfx('click');
  }

  startMatchFromLobby(): void {
    if (!this.hostSession) return;
    const lobby = this.hostSession.lobby;
    lobby.started = true;

    // Convert any remaining open seats to bots
    for (const seat of lobby.seats) {
      if (seat.kind === 'open') {
        seat.kind = 'bot';
        seat.name = BOT_NAMES.at((seat.seat - 1) % BOT_NAMES.length) ?? `Bot ${seat.seat + 1}`;
        seat.connected = true;
      }
    }

    const currentRules =
      (lobby.rules as PandemicLobbySettings) ?? DEFAULT_PANDEMIC_SETTINGS;
    const assignedRoles = this.resolveLobbyRoles(lobby.seats as PandemicSeat[]);
    const updatedRules: PandemicLobbySettings = {
      ...currentRules,
      numPlayers: lobby.seats.length,
      roles: assignedRoles,
    };
    lobby.rules = updatedRules;

    this.hostSession.state = this.engine.createInitialState({
      difficulty: updatedRules.difficulty,
      numPlayers: lobby.seats.length,
      roles: assignedRoles,
      playerNames: lobby.seats.map((s) => s.name),
    });

    this.hostSession.broadcastAll();
    this.shellUi.playSfx('deal');
    void this.router.navigate(['/pandemic/board']);
  }

  // --- Lobby Controls ---

  toggleSeatKind(seatIdx: number): void {
    if (!this.hostSession) return;
    const seat = this.hostSession.lobby.seats.find((s) => s.seat === seatIdx);
    if (!seat || seat.seat === 0) return;

    if (seat.kind === 'open') {
      seat.kind = 'bot';
      seat.name = BOT_NAMES.at((seat.seat - 1) % BOT_NAMES.length) ?? `Bot ${seat.seat + 1}`;
      seat.connected = true;
    } else if (seat.kind === 'bot') {
      seat.kind = 'open';
      seat.name = 'Waiting for specialist…';
      seat.connected = false;
    }
    this.hostSession.broadcastAll();
    this.shellUi.playSfx('click');
  }

  setSeatRole(seatIdx: number, role: SpecialistRole | 'random'): void {
    if (!this.hostSession) return;
    const seat = (this.hostSession.lobby.seats as PandemicSeat[]).find((s) => s.seat === seatIdx);
    if (!seat) return;

    seat.role = role;
    this.hostSession.broadcastAll();
    this.shellUi.playSfx('click');
  }

  setDifficulty(difficulty: DifficultyLevel): void {
    if (!this.hostSession) return;
    const rules = this.hostSession.lobby.rules as PandemicLobbySettings;
    if (rules) {
      rules.difficulty = difficulty;
      this.hostSession.broadcastAll();
      this.shellUi.playSfx('click');
    }
  }

  // --- Action Dispatching ---

  dispatchAction(action: PandemicAction, forSeat?: number): void {
    if (this.hostSession) {
      if (this.isSoloCommander()) {
        const targetSeat =
          typeof forSeat === 'number'
            ? forSeat
            : (this.currentView()?.activeSeat ?? 0);
        this.hostSession.updateState((state) => {
          this.engine.applyAction(state, action, targetSeat);
          this.triggerActionSfx(action, state);
        });
      } else {
        this.hostSession.dispatchHostAction(action);
      }
    } else if (this.guestSession) {
      this.guestSession.sendAction(action);
    }
  }

  // --- Session Cleanup ---

  leaveRoom(): void {
    clearTimeout(this.botTimer);
    this.hostSession?.destroy();
    this.guestSession?.destroy();
    this.hostSession = null;
    this.guestSession = null;
    this.snapshot.set(null);
    this.selectedCityId.set(null);
    this.selectedRegion.set('all');
    this.showForecastModal.set(false);
    this.showDiscardModal.set(false);
    this.showInfectionDiscardModal.set(false);
    this.showVictoryDefeatModal.set(false);
    this.showEventCardModal.set(null);
    this.shellUi.setActiveRoomCode(null);
    this.transport.clearUrl();
  }

  // --- Save & Restore ---

  canExportSave(): boolean {
    return (
      this.hostSession !== null &&
      this.hostSession.lobby.started &&
      this.hostSession.state.phase !== 'game_over'
    );
  }

  exportSaveData(): SerializedPandemicSave | null {
    if (!this.canExportSave() || !this.hostSession) return null;
    const { cityCubes, cubesRemaining, cureStatus, ...restState } = this.hostSession.state;
    const raw: SerializedPandemicSave = {
      lobby: {
        started: true,
        rules: { ...(this.hostSession.lobby.rules as PandemicLobbySettings) },
        seats: (this.hostSession.lobby.seats as PandemicSeat[]).map((s) => ({
          ...s,
          token: null,
        })),
      },
      state: {
        ...restState,
        cityCubesEntries: Array.from(cityCubes.entries()),
        cubesRemainingEntries: Array.from(cubesRemaining.entries()),
        cureStatusEntries: Array.from(cureStatus.entries()),
      },
    };
    return JSON.parse(JSON.stringify(raw)) as SerializedPandemicSave;
  }

  restoreSaveData(saved: SerializedPandemicSave): boolean {
    if (!saved?.lobby || !saved?.state) return false;
    this.leaveRoom();
    const cloned = JSON.parse(JSON.stringify(saved)) as SerializedPandemicSave;
    const hostName = cloned.lobby.seats.at(0)?.name || this.shellUi.playerNickname() || 'Host';
    const isSoloCommander = Boolean(cloned.lobby.rules?.soloCommander);

    const restoredSeats: PandemicSeat[] = cloned.lobby.seats.map((s, idx) => ({
      ...s,
      seat: idx,
      kind: idx === 0 || isSoloCommander ? 'human' : 'bot',
      name:
        idx === 0
          ? s.name || hostName
          : s.name || BOT_NAMES.at((idx - 1) % BOT_NAMES.length) || `Bot ${idx}`,
      token: idx === 0 ? 'host_token' : null,
      connected: true,
    }));

    const restoredLobby: GenericLobby<PandemicSeat, PandemicLobbySettings> = {
      started: true,
      seats: restoredSeats,
      rules: { ...DEFAULT_PANDEMIC_SETTINGS, ...cloned.lobby.rules },
    };

    const {
      cityCubesEntries,
      cubesRemainingEntries,
      cureStatusEntries,
      ...restState
    } = cloned.state;

    const restoredState: PandemicMatchState = {
      ...restState,
      cityCubes: createSerializableMap(cityCubesEntries),
      cubesRemaining: createSerializableMap(cubesRemainingEntries),
      cureStatus: createSerializableMap(cureStatusEntries),
    };

    this.hostSession = this.transport.createHost<
      PandemicMatchState,
      PandemicPlayerView,
      PandemicAction
    >({
      gamePrefix: 'D',
      online: false,
      hostName,
      initialState: restoredState,
      initialLobby: restoredLobby,
      buildPlayerView: (state, seatIdx) => this.engine.getPandemicPlayerView(state, seatIdx),
      applyAction: (state, seatIdx, action) => this.handleActionApplied(state, seatIdx, action),
    });

    this.hostSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as PandemicSnapshot);
    });

    this.shellUi.setActiveGame('pandemic');
    this.shellUi.setActiveRoomCode(null);
    this.shellUi.playSfx('deal');
    void this.router.navigate(['/pandemic/board']);
    return true;
  }

  // --- UI Modal & Filter Controls ---

  selectCity(cityId: string | null): void {
    this.selectedCityId.set(cityId);
    this.shellUi.playSfx('click');
  }

  setRegion(region: 'all' | DiseaseColor): void {
    this.selectedRegion.set(region);
    this.shellUi.playSfx('click');
  }

  openForecastModal(): void {
    this.showForecastModal.set(true);
  }

  closeForecastModal(): void {
    this.showForecastModal.set(false);
  }

  openDiscardModal(): void {
    this.showDiscardModal.set(true);
  }

  closeDiscardModal(): void {
    this.showDiscardModal.set(false);
  }

  openInfectionDiscardModal(): void {
    this.showInfectionDiscardModal.set(true);
    this.shellUi.playSfx('click');
  }

  closeInfectionDiscardModal(): void {
    this.showInfectionDiscardModal.set(false);
  }

  openVictoryDefeatModal(): void {
    this.showVictoryDefeatModal.set(true);
  }

  closeVictoryDefeatModal(): void {
    this.showVictoryDefeatModal.set(false);
  }

  openEventCardModal(eventId: EventCardId | null): void {
    this.showEventCardModal.set(eventId);
    if (eventId) {
      this.shellUi.playSfx('click');
    }
  }

  // --- Internal Session Handling ---

  private handleActionApplied(
    state: PandemicMatchState,
    seatIdx: number,
    action: PandemicAction
  ): void {
    const actor = this.isSoloCommander() ? state.activeSeat : seatIdx;
    this.engine.applyAction(state, action, actor);
    this.triggerActionSfx(action, state);
  }

  private triggerActionSfx(action: PandemicAction, state: PandemicMatchState): void {
    if (state.winner === 'players') {
      this.shellUi.playSfx('fanfare');
      return;
    }
    if (state.winner === 'none') {
      this.shellUi.playSfx('fail');
      return;
    }

    if (action.type === 'discoverCure') {
      this.shellUi.playSfx('fanfare');
    } else if (action.type === 'playEvent') {
      this.shellUi.playSfx('deal');
    } else if (state.phase === 'epidemic') {
      this.shellUi.playSfx('alert');
    } else {
      this.shellUi.playSfx('click');
    }
  }

  private handleSnapshotUpdate(snap: PandemicSnapshot): void {
    const hydratedView = snap.view ? hydratePandemicPlayerView(snap.view) : null;
    const hydratedSnap: PandemicSnapshot = {
      ...snap,
      view: hydratedView,
    };
    this.snapshot.set(hydratedSnap);

    // Auto-navigate to board if started
    if (snap.lobby?.started && this.router.url.includes('/pandemic/lobby')) {
      void this.router.navigate(['/pandemic/board']);
    }

    // Auto-trigger Tactical AI Bot turn on Host (unless in Solo Commander Mode)
    if (
      this.isHost() &&
      !this.isSoloCommander() &&
      hydratedView &&
      hydratedView.phase !== 'game_over'
    ) {
      this.checkAndTriggerBotTurn(hydratedView);
    }
  }

  private checkAndTriggerBotTurn(view: PandemicPlayerView): void {
    clearTimeout(this.botTimer);

    // 1. Discard Phase: check if any bot needs to discard
    if (view.phase === 'discard' && view.discardQueue.length > 0) {
      const discardSeat = view.discardQueue.find((s) => {
        const seatObj = this.hostSession?.lobby.seats.find((seat) => seat.seat === s);
        return seatObj?.kind === 'bot';
      });

      if (typeof discardSeat === 'number') {
        this.botTimer = setTimeout(() => {
          if (!this.hostSession) return;
          const botAction = this.bot.chooseBotAction(view, discardSeat);
          if (botAction) {
            this.hostSession.updateState((state) => {
              this.engine.applyAction(state, botAction, discardSeat);
              this.triggerActionSfx(botAction, state);
            });
          }
        }, 500);
        return;
      }
    }

    // 2. Active seat check for actions, forecast, epidemic, and infect
    const activeSeatObj = this.hostSession?.lobby.seats.find(
      (s) => s.seat === view.activeSeat
    );
    if (activeSeatObj?.kind === 'bot') {
      const delay = view.phase === 'actions' ? 600 : 500;
      this.botTimer = setTimeout(() => {
        if (!this.hostSession) return;
        const botAction = this.bot.chooseBotAction(view, view.activeSeat);
        if (botAction) {
          this.hostSession.updateState((state) => {
            this.engine.applyAction(state, botAction, view.activeSeat);
            this.triggerActionSfx(botAction, state);
          });
        }
      }, delay);
    }
  }

  private resolveLobbyRoles(seats: readonly PandemicSeat[]): SpecialistRole[] {
    const assigned: (SpecialistRole | null)[] = seats.map((s) =>
      s.role && s.role !== 'random' ? s.role : null
    );

    const usedRoles = new Set(assigned.filter((r): r is SpecialistRole => r !== null));
    const availableRoles = ALL_SPECIALIST_ROLES.filter((r) => !usedRoles.has(r));

    let availableIdx = 0;
    return assigned.map((r) => {
      if (r !== null) return r;
      const fallback = availableRoles.at(availableIdx) ?? 'medic';
      availableIdx++;
      return fallback;
    });
  }
}
