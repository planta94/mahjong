import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  GenericLobby,
  GenericSessionSnapshot,
} from '../../../core/models/party.model';
import {
  GenericGuestSession,
  GenericHostSession,
  P2PRoomTransportService,
  PeerConstructorLike,
} from '../../../core/services/p2p-room.transport';
import { ShellUiService } from '../../../core/services/shell-ui.service';
import { TranslateService } from '../../../core/services/translate.service';
import { CAR_PERSONAS, getBotDriverKey } from '../data/balik-kampung-cards.data';
import {
  ActionCardId,
  BalikKampungAction,
  BalikKampungLobbySettings,
  BalikKampungMatchState,
  BalikKampungPlayerView,
  BalikKampungSeat,
  CarPersonaId,
  DrivetrainType,
  SimpangCorridor,
} from '../models/balik-kampung.model';
import { BalikKampungBotService } from './balik-kampung-bot.service';
import { BalikKampungEngineService } from './balik-kampung-engine.service';

export type BalikKampungSnapshot = GenericSessionSnapshot<
  BalikKampungPlayerView,
  GenericLobby<BalikKampungSeat, BalikKampungLobbySettings>
>;

export interface SerializedBalikKampungSave {
  lobby: GenericLobby<BalikKampungSeat, BalikKampungLobbySettings>;
  state: BalikKampungMatchState;
}

@Injectable({
  providedIn: 'root',
})
export class BalikKampungSessionService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly transport = inject(P2PRoomTransportService);
  private readonly engine = inject(BalikKampungEngineService);
  private readonly bot = inject(BalikKampungBotService);
  private readonly shellUi = inject(ShellUiService);
  private readonly translate = inject(TranslateService);

  readonly snapshot = signal<BalikKampungSnapshot | null>(null);

  readonly mySeat = computed(() => this.snapshot()?.mySeat ?? -1);
  readonly isHost = computed(() => this.snapshot()?.role === 'host');
  readonly currentView = computed(() => this.snapshot()?.view ?? null);
  readonly currentLobby = computed(() => this.snapshot()?.lobby ?? null);

  readonly myPlayer = computed(() => {
    const view = this.currentView();
    const seat = this.mySeat();
    if (!view || seat < 0) return null;
    return view.players.find((p) => p.seat === seat) ?? null;
  });

  readonly activePlayer = computed(() => {
    const view = this.currentView();
    if (!view) return null;
    return view.players.find((p) => p.seat === view.activeSeat) ?? null;
  });

  readonly isMyResolutionTurn = computed(() => {
    const view = this.currentView();
    if (!view) return false;
    if (
      view.phase !== 'RESOLVING' &&
      view.phase !== 'EV_CHARGE_PROMPT' &&
      view.phase !== 'SIMPANG_SCOUT_PROMPT'
    ) {
      return false;
    }
    return view.activeSeat === this.mySeat();
  });

  readonly pendingFuelDump = signal<boolean>(false);
  readonly spendScoutOnAwas = signal<boolean>(true);
  readonly showGameOverModal = signal<boolean>(false);

  private hostSession: GenericHostSession<
    BalikKampungMatchState,
    BalikKampungPlayerView,
    BalikKampungAction
  > | null = null;
  private guestSession: GenericGuestSession<
    BalikKampungPlayerView,
    BalikKampungAction
  > | null = null;
  private botTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly p2pLeaveHandler = (ev: Event): void => {
    const detail = (ev as CustomEvent).detail as { game?: string } | undefined;
    if (!detail || !detail.game || detail.game === 'balik-kampung') {
      this.leaveRoom();
      if (this.router.url?.includes('/balik-kampung/board')) {
        void this.router.navigate(['/balik-kampung/lobby']);
      }
    }
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('p2p:leave', this.p2pLeaveHandler);
    }
  }

  ngOnDestroy(): void {
    this.leaveRoom();
    if (typeof window !== 'undefined') {
      window.removeEventListener('p2p:leave', this.p2pLeaveHandler);
    }
  }

  getBotDriverName(botSlotIdx: number): string {
    return this.translate.instant(getBotDriverKey(botSlotIdx));
  }

  // --- Solo Match vs AI Bots ---

  createSoloMatch(
    playerCount = 3,
    seatDrivetrains?: readonly DrivetrainType[],
    seatPersonas?: readonly CarPersonaId[]
  ): void {
    this.leaveRoom();
    const clampedCount = Math.max(2, Math.min(5, playerCount));
    const hostName = this.shellUi.playerNickname() || 'Pemandu #1';

    const usedPersonas = new Set<CarPersonaId>();
    const seats: BalikKampungSeat[] = [];
    for (let i = 0; i < clampedCount; i++) {
      const requestedId = seatPersonas?.at(i);
      const fallbackMeta =
        CAR_PERSONAS.find((c) => !usedPersonas.has(c.id)) ?? CAR_PERSONAS[0];
      const chosenMeta =
        requestedId && !usedPersonas.has(requestedId)
          ? (CAR_PERSONAS.find((c) => c.id === requestedId) ?? fallbackMeta)
          : fallbackMeta;
      usedPersonas.add(chosenMeta.id);

      const dt = seatDrivetrains?.at(i) ?? chosenMeta.defaultDrivetrain;
      seats.push({
        seat: i,
        kind: i === 0 ? 'human' : 'bot',
        name: i === 0 ? hostName : this.getBotDriverName(i - 1),
        token: i === 0 ? 'host_token' : null,
        connected: true,
        drivetrain: dt,
        persona: chosenMeta.id,
      });
    }

    const initialLobby: GenericLobby<BalikKampungSeat, BalikKampungLobbySettings> = {
      started: true,
      seats,
      rules: { numPlayers: clampedCount },
    };

    const initialState = this.engine.createInitialState({
      seats: seats.map((s) => ({
        seat: s.seat,
        name: s.name,
        isBot: s.kind === 'bot',
        drivetrain: s.drivetrain,
        persona: s.persona,
      })),
    });

    this.hostSession = this.transport.createHost<
      BalikKampungMatchState,
      BalikKampungPlayerView,
      BalikKampungAction
    >({
      gamePrefix: 'B',
      online: false,
      hostName,
      initialState,
      initialLobby,
      buildPlayerView: (state, seatIdx) => this.engine.buildPlayerView(state, seatIdx),
      applyAction: (state, seatIdx, action) => this.handleActionApplied(state, seatIdx, action),
    });

    this.hostSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as BalikKampungSnapshot);
    });

    this.shellUi.setActiveGame('balik-kampung');
    this.shellUi.setActiveRoomCode(null);
    this.shellUi.playSfx('deal');
    void this.router.navigate(['/balik-kampung/board']);
  }

  // --- Serverless P2P Multiplayer (B* Room Codes) ---

  createMultiplayerRoom(
    seatsCount = 4,
    peerLoader?: () => Promise<PeerConstructorLike>,
    seatPersonas?: readonly CarPersonaId[],
    seatDrivetrains?: readonly DrivetrainType[]
  ): string {
    this.leaveRoom();
    const clampedCount = Math.max(2, Math.min(5, seatsCount));
    const hostName = this.shellUi.playerNickname() || 'Ketua Konvoi';

    const usedPersonas = new Set<CarPersonaId>();
    const seats: BalikKampungSeat[] = [];
    for (let i = 0; i < clampedCount; i++) {
      const requestedId = seatPersonas?.at(i);
      const fallbackMeta =
        CAR_PERSONAS.find((c) => !usedPersonas.has(c.id)) ?? CAR_PERSONAS[0];
      const chosenMeta =
        requestedId && !usedPersonas.has(requestedId)
          ? (CAR_PERSONAS.find((c) => c.id === requestedId) ?? fallbackMeta)
          : fallbackMeta;
      usedPersonas.add(chosenMeta.id);

      seats.push({
        seat: i,
        kind: i === 0 ? 'human' : 'open',
        name: i === 0 ? hostName : `Seat ${i + 1}`,
        connected: i === 0,
        drivetrain: seatDrivetrains?.at(i) ?? chosenMeta.defaultDrivetrain,
        persona: chosenMeta.id,
      });
    }

    const initialLobby: GenericLobby<BalikKampungSeat, BalikKampungLobbySettings> = {
      started: false,
      seats,
      rules: { numPlayers: clampedCount },
    };

    const placeholderState = this.engine.createInitialState({
      seats: seats.map((s) => ({
        seat: s.seat,
        name: s.name,
        isBot: s.kind !== 'human',
        drivetrain: s.drivetrain,
        persona: s.persona,
      })),
    });

    this.hostSession = this.transport.createHost<
      BalikKampungMatchState,
      BalikKampungPlayerView,
      BalikKampungAction
    >({
      gamePrefix: 'B',
      online: true,
      hostName,
      initialState: placeholderState,
      initialLobby,
      buildPlayerView: (state, seatIdx) => this.engine.buildPlayerView(state, seatIdx),
      applyAction: (state, seatIdx, action) => this.handleActionApplied(state, seatIdx, action),
      peerLoader,
    });

    const roomCode = this.hostSession.roomCode;
    this.hostSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as BalikKampungSnapshot);
    });

    this.shellUi.setActiveGame('balik-kampung');
    this.shellUi.setActiveRoomCode(roomCode);
    this.transport.updateUrl(roomCode, 'balik-kampung');
    this.shellUi.playSfx('click');

    return roomCode;
  }

  joinMultiplayerRoom(
    roomCode: string,
    peerLoader?: () => Promise<PeerConstructorLike>
  ): void {
    this.leaveRoom();
    const guestName = this.shellUi.playerNickname() || 'Pemandu';
    this.guestSession = this.transport.createGuest<BalikKampungPlayerView, BalikKampungAction>({
      roomCode,
      guestName,
      peerLoader,
    });

    this.guestSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as BalikKampungSnapshot);
    });

    this.shellUi.setActiveGame('balik-kampung');
    this.shellUi.setActiveRoomCode(roomCode);
    this.transport.updateUrl(roomCode, 'balik-kampung');
    this.shellUi.playSfx('click');
  }

  setLobbySeatCount(count: number): void {
    if (!this.hostSession || this.hostSession.lobby.started) return;
    const clamped = Math.max(2, Math.min(5, count));
    const currentSeats = this.hostSession.lobby.seats as BalikKampungSeat[];

    if (clamped < currentSeats.length) {
      this.hostSession.lobby.seats = currentSeats.slice(0, clamped);
    } else if (clamped > currentSeats.length) {
      for (let i = currentSeats.length; i < clamped; i++) {
        const used = new Set(currentSeats.map((s) => s.persona));
        const personaMeta =
          CAR_PERSONAS.find((c) => !used.has(c.id)) ??
          CAR_PERSONAS.at(i) ??
          CAR_PERSONAS[0];
        currentSeats.push({
          seat: i,
          kind: 'open',
          name: `Seat ${i + 1}`,
          connected: false,
          drivetrain: personaMeta.defaultDrivetrain,
          persona: personaMeta.id as CarPersonaId,
        });
      }
    }

    this.hostSession.lobby.rules = { numPlayers: clamped };
    this.hostSession.broadcastAll();
    this.shellUi.playSfx('click');
  }

  toggleSeatKind(seatIdx: number): void {
    if (!this.hostSession || this.hostSession.lobby.started || seatIdx <= 0) return;
    const seat = (this.hostSession.lobby.seats as BalikKampungSeat[]).find(
      (s) => s.seat === seatIdx
    );
    if (!seat || seat.kind === 'human') return;

    if (seat.kind === 'open') {
      seat.kind = 'bot';
      seat.name = this.getBotDriverName(seatIdx - 1);
      seat.connected = true;
    } else {
      seat.kind = 'open';
      seat.name = `Seat ${seatIdx + 1}`;
      seat.connected = false;
    }

    this.hostSession.broadcastAll();
    this.shellUi.playSfx('click');
  }

  setSeatDrivetrain(seatIdx: number, drivetrain: DrivetrainType): void {
    if (this.hostSession && !this.hostSession.lobby.started) {
      const seat = (this.hostSession.lobby.seats as BalikKampungSeat[]).find(
        (s) => s.seat === seatIdx
      );
      if (seat) {
        seat.drivetrain = drivetrain;
        this.hostSession.broadcastAll();
        this.shellUi.playSfx('click');
      }
      return;
    }

    if (this.guestSession && seatIdx === this.mySeat()) {
      this.guestSession.sendAction({
        type: 'LOBBY_SET_DRIVETRAIN',
        drivetrain,
      });
      this.shellUi.playSfx('click');
    }
  }

  setSeatPersona(seatIdx: number, persona: CarPersonaId): void {
    if (this.hostSession && !this.hostSession.lobby.started) {
      const seats = this.hostSession.lobby.seats as BalikKampungSeat[];
      if (this.applySeatPersonaSwap(seats, seatIdx, persona)) {
        this.hostSession.broadcastAll();
        this.shellUi.playSfx('click');
      }
      return;
    }

    if (this.guestSession && seatIdx === this.mySeat()) {
      this.guestSession.sendAction({
        type: 'LOBBY_SET_PERSONA',
        persona,
      });
      this.shellUi.playSfx('click');
    }
  }

  private applySeatPersonaSwap(
    seats: BalikKampungSeat[],
    seatIdx: number,
    persona: CarPersonaId
  ): boolean {
    const target = seats.find((s) => s.seat === seatIdx);
    if (!target || target.persona === persona) {
      return false;
    }
    const previousPersona = target.persona;
    const holder = seats.find((s) => s.seat !== seatIdx && s.persona === persona);
    target.persona = persona;
    if (holder) {
      holder.persona = previousPersona;
    }
    return true;
  }

  startMatchFromLobby(): void {
    if (!this.hostSession) return;
    const lobby = this.hostSession.lobby as GenericLobby<
      BalikKampungSeat,
      BalikKampungLobbySettings
    >;
    lobby.started = true;

    for (const seat of lobby.seats) {
      if (seat.kind === 'open') {
        seat.kind = 'bot';
        seat.name = this.getBotDriverName(seat.seat - 1);
        seat.connected = true;
      }
    }

    this.hostSession.state = this.engine.createInitialState({
      seats: lobby.seats.map((s) => ({
        seat: s.seat,
        name: s.name,
        isBot: s.kind === 'bot',
        drivetrain: s.drivetrain,
        persona: s.persona,
      })),
    });

    this.showGameOverModal.set(false);
    this.pendingFuelDump.set(false);
    this.hostSession.broadcastAll();
    this.shellUi.playSfx('deal');
    void this.router.navigate(['/balik-kampung/board']);
  }

  restartMatch(): void {
    if (!this.hostSession) return;
    const lobby = this.hostSession.lobby as GenericLobby<
      BalikKampungSeat,
      BalikKampungLobbySettings
    >;
    this.hostSession.state = this.engine.createInitialState({
      seats: lobby.seats.map((s) => ({
        seat: s.seat,
        name: s.name,
        isBot: s.kind === 'bot',
        drivetrain: s.drivetrain,
        persona: s.persona,
      })),
    });
    this.showGameOverModal.set(false);
    this.pendingFuelDump.set(false);
    this.hostSession.broadcastAll();
    this.shellUi.playSfx('deal');
  }

  // --- Gameplay Dispatchers ---

  togglePendingFuelDump(): void {
    const me = this.myPlayer();
    if (!me || me.drivetrain !== 'ICE' || me.fuelDumpUsed) return;
    this.pendingFuelDump.set(!this.pendingFuelDump());
    this.shellUi.playSfx('click');
  }

  toggleSpendScoutOnAwas(): void {
    this.spendScoutOnAwas.set(!this.spendScoutOnAwas());
    this.shellUi.playSfx('click');
  }

  selectPlan(cardId: ActionCardId): void {
    const me = this.myPlayer();
    const useFuel =
      cardId !== 0 &&
      Boolean(me && me.drivetrain === 'ICE' && !me.fuelDumpUsed && this.pendingFuelDump());

    this.sendAction({
      type: 'SELECT_PLAN',
      cardId,
      useFuelDump: useFuel,
    });
    this.pendingFuelDump.set(false);
  }

  unselectPlan(): void {
    this.sendAction({
      type: 'UNSELECT_PLAN',
    });
  }

  commitMove(optionId: string): void {
    this.sendAction({
      type: 'COMMIT_MOVE',
      optionId,
      spendScoutOnAwas: this.spendScoutOnAwas(),
    });
  }

  chooseEvCharge(mode: 'AC_SLOW' | 'DC_FAST'): void {
    this.sendAction({
      type: 'CHOOSE_EV_CHARGE',
      mode,
    });
  }

  chooseScoutedSimpang(branch: SimpangCorridor): void {
    this.sendAction({
      type: 'CHOOSE_SCOUTED_SIMPANG',
      branch,
    });
  }

  openGameOverModal(): void {
    this.showGameOverModal.set(true);
  }

  closeGameOverModal(): void {
    this.showGameOverModal.set(false);
  }

  sendAction(action: BalikKampungAction): void {
    if (this.hostSession) {
      this.hostSession.dispatchHostAction(action);
      return;
    }
    if (this.guestSession) {
      this.guestSession.sendAction(action);
    }
  }

  leaveRoom(): void {
    clearTimeout(this.botTimer);
    if (this.hostSession) {
      this.hostSession.destroy();
      this.hostSession = null;
    }
    if (this.guestSession) {
      this.guestSession.destroy();
      this.guestSession = null;
    }
    this.snapshot.set(null);
    this.pendingFuelDump.set(false);
    this.showGameOverModal.set(false);
  }

  // --- Save & Resume Integration ---

  canExportSave(): boolean {
    return Boolean(
      this.hostSession &&
      this.hostSession.lobby.started &&
      this.hostSession.state.phase !== 'GAMEOVER'
    );
  }

  exportSaveData(): SerializedBalikKampungSave | null {
    if (!this.hostSession || !this.hostSession.lobby.started) {
      return null;
    }
    const raw: SerializedBalikKampungSave = {
      lobby: this.hostSession.lobby as GenericLobby<
        BalikKampungSeat,
        BalikKampungLobbySettings
      >,
      state: this.hostSession.state,
    };
    return JSON.parse(JSON.stringify(raw)) as SerializedBalikKampungSave;
  }

  restoreSaveData(saved: SerializedBalikKampungSave): boolean {
    if (!saved?.lobby || !saved?.state) {
      return false;
    }
    this.leaveRoom();
    const cloned = JSON.parse(JSON.stringify(saved)) as SerializedBalikKampungSave;
    const hostName = cloned.lobby.seats.at(0)?.name || this.shellUi.playerNickname() || 'Host';

    const restoredSeats: BalikKampungSeat[] = cloned.lobby.seats.map((s, idx) => ({
      ...s,
      seat: idx,
      kind: idx === 0 ? 'human' : 'bot',
      name:
        idx === 0
          ? s.name || hostName
          : s.name || this.getBotDriverName(idx - 1),
      token: idx === 0 ? 'host_token' : null,
      connected: true,
    }));

    cloned.state.players.forEach((p, idx) => {
      p.isBot = idx !== 0;
    });

    const restoredLobby: GenericLobby<BalikKampungSeat, BalikKampungLobbySettings> = {
      started: true,
      seats: restoredSeats,
      rules: { numPlayers: restoredSeats.length },
    };

    this.hostSession = this.transport.createHost<
      BalikKampungMatchState,
      BalikKampungPlayerView,
      BalikKampungAction
    >({
      gamePrefix: 'B',
      online: false,
      hostName,
      initialState: cloned.state,
      initialLobby: restoredLobby,
      buildPlayerView: (state, seatIdx) => this.engine.buildPlayerView(state, seatIdx),
      applyAction: (state, seatIdx, action) => this.handleActionApplied(state, seatIdx, action),
    });

    this.hostSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as BalikKampungSnapshot);
    });

    this.shellUi.setActiveGame('balik-kampung');
    this.shellUi.setActiveRoomCode(null);
    this.shellUi.playSfx('deal');
    void this.router.navigate(['/balik-kampung/board']);
    return true;
  }

  // --- Internal State & AI Loop ---

  private handleActionApplied(
    state: BalikKampungMatchState,
    seatIdx: number,
    action: BalikKampungAction
  ): void {
    if (action.type === 'LOBBY_SET_DRIVETRAIN') {
      if (this.hostSession && !this.hostSession.lobby.started) {
        const seat = (this.hostSession.lobby.seats as BalikKampungSeat[]).find(
          (s) => s.seat === seatIdx
        );
        if (seat) {
          seat.drivetrain = action.drivetrain;
        }
      }
      return;
    }

    if (action.type === 'LOBBY_SET_PERSONA') {
      if (this.hostSession && !this.hostSession.lobby.started) {
        const seats = this.hostSession.lobby.seats as BalikKampungSeat[];
        this.applySeatPersonaSwap(seats, seatIdx, action.persona);
      }
      return;
    }

    const applied = this.engine.applyAction(state, seatIdx, action);
    if (applied) {
      this.triggerActionSfx(action, state);
    }
  }

  private triggerActionSfx(action: BalikKampungAction, state: BalikKampungMatchState): void {
    if (state.phase === 'GAMEOVER') {
      this.shellUi.playSfx('fanfare');
      return;
    }
    if (action.type === 'CHOOSE_EV_CHARGE') {
      this.shellUi.playSfx(state.lastCoinFlip === 'TAILS' ? 'fail' : 'dice');
      return;
    }
    if (action.type === 'SELECT_PLAN') {
      this.shellUi.playSfx('deal');
      return;
    }
    this.shellUi.playSfx('click');
  }

  private handleSnapshotUpdate(snap: BalikKampungSnapshot): void {
    this.snapshot.set(snap);

    if (snap.view?.phase === 'GAMEOVER') {
      this.showGameOverModal.set(true);
    }

    if (snap.lobby?.started && this.router.url.includes('/balik-kampung/lobby')) {
      void this.router.navigate(['/balik-kampung/board']);
    }

    if (
      this.isHost() &&
      snap.lobby?.started &&
      snap.view &&
      snap.view.phase !== 'GAMEOVER'
    ) {
      this.scheduleBotActionsIfNeeded();
    }
  }

  private scheduleBotActionsIfNeeded(): void {
    clearTimeout(this.botTimer);
    if (!this.hostSession || !this.hostSession.lobby.started) {
      return;
    }

    const state = this.hostSession.state;

    // 1. Secret Planning phase: lock plans for any bot seats not yet locked
    if (state.phase === 'PLANNING') {
      const pendingBot = state.players.find((p) => {
        if (p.hasLockedPlan || p.pos.lane === 'FINISH') return false;
        const seatObj = this.hostSession?.lobby.seats.find((s) => s.seat === p.seat);
        return seatObj?.kind === 'bot' || p.isBot;
      });

      if (pendingBot) {
        this.botTimer = setTimeout(() => {
          if (!this.hostSession || this.hostSession.state.phase !== 'PLANNING') return;
          this.hostSession.updateState((st) => {
            for (const botP of st.players) {
              if (botP.hasLockedPlan || botP.pos.lane === 'FINISH') continue;
              const seatObj = this.hostSession?.lobby.seats.find((s) => s.seat === botP.seat);
              if (seatObj?.kind !== 'bot' && !botP.isBot) continue;
              const plan = this.bot.decideBotPlan(st, botP);
              if (plan) {
                this.engine.applyAction(st, botP.seat, plan);
              }
            }
          });
        }, 200);
      }
      return;
    }

    // 2. Active Resolution / Prompt phases
    const activePlayer = state.players.find((p) => p.seat === state.activeSeat);
    const activeSeatMeta = this.hostSession.lobby.seats.find(
      (s) => s.seat === state.activeSeat
    );
    const isActiveBot = Boolean(
      activePlayer && (activePlayer.isBot || activeSeatMeta?.kind === 'bot')
    );

    if (isActiveBot && activePlayer) {
      this.botTimer = setTimeout(() => {
        if (!this.hostSession) return;
        const st = this.hostSession.state;
        const botNow = st.players.find((p) => p.seat === st.activeSeat);
        if (!botNow) return;
        const act = this.bot.decideActiveBotAction(st, botNow);
        if (act) {
          this.hostSession.updateState((mutState) => {
            const ok = this.engine.applyAction(mutState, botNow.seat, act);
            if (ok) {
              this.triggerActionSfx(act, mutState);
            }
          });
        }
      }, 540);
    }
  }
}
