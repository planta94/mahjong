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
import {
  DEFAULT_MONOPOLY_SETTINGS,
  MONOPOLY_PLAYER_COLORS,
  MonopolyAction,
  MonopolyLobbySettings,
  MonopolyMatchState,
  MonopolyPlayerView,
  MonopolySeat,
  PropertyState,
} from '../models/monopoly.model';
import { MonopolyBotService } from './monopoly-bot.service';
import { MonopolyEngineService } from './monopoly-engine.service';

export type MonopolySnapshot = GenericSessionSnapshot<
  MonopolyPlayerView,
  GenericLobby<MonopolySeat, MonopolyLobbySettings>
>;

export interface SerializedMonopolySave {
  lobby: GenericLobby<MonopolySeat, MonopolyLobbySettings>;
  state: Omit<MonopolyMatchState, 'properties'> & {
    propertiesEntries: [number, PropertyState][];
  };
}

const BOT_NAMES = [
  'KL Tycoon (Bot)',
  'Penang Baron (Bot)',
  'Sabah Mogul (Bot)',
  'Johor Magnate (Bot)',
  'Melaka Towkay (Bot)',
];

@Injectable({
  providedIn: 'root',
})
export class MonopolySessionService {
  private readonly router = inject(Router);
  private readonly transport = inject(P2PRoomTransportService);
  private readonly engine = inject(MonopolyEngineService);
  private readonly bot = inject(MonopolyBotService);
  private readonly shellUi = inject(ShellUiService);

  readonly snapshot = signal<MonopolySnapshot | null>(null);

  readonly mySeat = computed(() => this.snapshot()?.mySeat ?? -1);
  readonly isHost = computed(() => this.snapshot()?.role === 'host');
  readonly currentView = computed(() => this.snapshot()?.view ?? null);
  readonly currentLobby = computed(() => this.snapshot()?.lobby ?? null);
  readonly isMyTurn = computed(() => {
    const view = this.currentView();
    const seat = this.mySeat();
    return view !== null && view.activeSeat === seat && seat >= 0;
  });

  readonly selectedSpaceIndex = signal<number | null>(null);
  readonly showTradeModal = signal<boolean>(false);
  readonly showDeedModal = signal<boolean>(false);
  readonly showAuctionModal = signal<boolean>(false);
  readonly showBankruptcyModal = signal<boolean>(false);

  private hostSession: GenericHostSession<MonopolyMatchState, MonopolyPlayerView, MonopolyAction> | null = null;
  private guestSession: GenericGuestSession<MonopolyPlayerView, MonopolyAction> | null = null;
  private botTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('p2p:leave', (ev: Event) => {
        const detail = (ev as CustomEvent).detail as { game?: string } | undefined;
        if (!detail || detail.game === 'monopoly') {
          this.leaveRoom();
        }
      });
    }
  }

  createSoloMatch(playerCount = 4, customSettings?: Partial<MonopolyLobbySettings>): void {
    this.leaveRoom();
    const settings: MonopolyLobbySettings = {
      ...DEFAULT_MONOPOLY_SETTINGS,
      ...customSettings,
    };

    const hostName = this.shellUi.playerNickname() || 'Host';
    const seats: MonopolySeat[] = [
      {
        seat: 0,
        kind: 'human',
        name: hostName,
        token: 'host_token',
        connected: true,
        color: MONOPOLY_PLAYER_COLORS[0],
      },
    ];

    for (let i = 1; i < playerCount; i++) {
      seats.push({
        seat: i,
        kind: 'bot',
        name: BOT_NAMES.at((i - 1) % BOT_NAMES.length) ?? `Bot ${i}`,
        connected: true,
        color: MONOPOLY_PLAYER_COLORS.at(i % MONOPOLY_PLAYER_COLORS.length) ?? '#457b9d',
      });
    }

    const initialLobby: GenericLobby<MonopolySeat, MonopolyLobbySettings> = {
      started: true,
      seats,
      rules: settings,
    };

    const initialState = this.engine.createInitialMonopolyState(settings, seats);

    this.hostSession = this.transport.createHost<MonopolyMatchState, MonopolyPlayerView, MonopolyAction>({
      gamePrefix: 'P',
      online: false,
      hostName,
      initialState,
      initialLobby,
      buildPlayerView: (state, seatIdx) => this.engine.getMonopolyPlayerView(state, seatIdx),
      applyAction: (state, seatIdx, action) => this.handleActionApplied(state, seatIdx, action),
    });

    this.hostSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as MonopolySnapshot);
    });

    this.shellUi.setActiveGame('monopoly');
    this.shellUi.setActiveRoomCode(null);
    this.shellUi.playSfx('deal');
    void this.router.navigate(['/monopoly/board']);
  }

  createMultiplayerRoom(seatsCount = 4, customSettings?: Partial<MonopolyLobbySettings>): string {
    this.leaveRoom();
    const settings: MonopolyLobbySettings = {
      ...DEFAULT_MONOPOLY_SETTINGS,
      ...customSettings,
    };

    const hostName = this.shellUi.playerNickname() || 'Host';
    const seats: MonopolySeat[] = [
      {
        seat: 0,
        kind: 'human',
        name: hostName,
        connected: true,
        color: MONOPOLY_PLAYER_COLORS[0],
      },
    ];

    for (let i = 1; i < seatsCount; i++) {
      seats.push({
        seat: i,
        kind: 'open',
        name: `Player ${i + 1}`,
        connected: false,
        color: MONOPOLY_PLAYER_COLORS.at(i % MONOPOLY_PLAYER_COLORS.length) ?? '#457b9d',
      });
    }

    const initialLobby: GenericLobby<MonopolySeat, MonopolyLobbySettings> = {
      started: false,
      seats,
      rules: settings,
    };

    const initialState = this.engine.createInitialMonopolyState(settings, seats);

    this.hostSession = this.transport.createHost<MonopolyMatchState, MonopolyPlayerView, MonopolyAction>({
      gamePrefix: 'P',
      online: true,
      hostName,
      initialState,
      initialLobby,
      buildPlayerView: (state, seatIdx) => this.engine.getMonopolyPlayerView(state, seatIdx),
      applyAction: (state, seatIdx, action) => this.handleActionApplied(state, seatIdx, action),
    });

    const roomCode = this.hostSession.roomCode;
    this.hostSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as MonopolySnapshot);
    });

    this.shellUi.setActiveGame('monopoly');
    this.shellUi.setActiveRoomCode(roomCode);
    this.transport.updateUrl(roomCode, 'monopoly');
    this.shellUi.playSfx('click');

    return roomCode;
  }

  joinMultiplayerRoom(roomCode: string): void {
    this.leaveRoom();
    const guestName = this.shellUi.playerNickname() || 'Player';
    this.guestSession = this.transport.createGuest<MonopolyPlayerView, MonopolyAction>({
      roomCode,
      guestName,
    });

    this.guestSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as MonopolySnapshot);
    });

    this.shellUi.setActiveGame('monopoly');
    this.shellUi.setActiveRoomCode(roomCode);
    this.transport.updateUrl(roomCode, 'monopoly');
    this.shellUi.playSfx('click');
  }

  startMatchFromLobby(): void {
    if (!this.hostSession) return;
    const lobby = this.hostSession.lobby;
    lobby.started = true;

    // Fill any open seats with bots if needed
    for (const seat of lobby.seats) {
      if (seat.kind === 'open') {
        seat.kind = 'bot';
        seat.name = BOT_NAMES.at((seat.seat - 1) % BOT_NAMES.length) ?? `Bot ${seat.seat + 1}`;
        seat.connected = true;
      }
    }

    const settings = (lobby.rules as MonopolyLobbySettings) ?? DEFAULT_MONOPOLY_SETTINGS;
    this.hostSession.state = this.engine.createInitialMonopolyState(settings, lobby.seats as MonopolySeat[]);
    this.hostSession.broadcastAll();

    this.shellUi.playSfx('deal');
    void this.router.navigate(['/monopoly/board']);
  }

  dispatchAction(action: MonopolyAction): void {
    if (this.hostSession) {
      this.hostSession.dispatchHostAction(action);
    } else if (this.guestSession) {
      this.guestSession.sendAction(action);
    }
  }

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
      seat.name = 'Waiting for friend…';
      seat.connected = false;
    }
    this.hostSession.broadcastAll();
    this.shellUi.playSfx('click');
  }

  leaveRoom(): void {
    clearTimeout(this.botTimer);
    this.hostSession?.destroy();
    this.guestSession?.destroy();
    this.hostSession = null;
    this.guestSession = null;
    this.snapshot.set(null);
    this.selectedSpaceIndex.set(null);
    this.showTradeModal.set(false);
    this.showDeedModal.set(false);
    this.showAuctionModal.set(false);
    this.showBankruptcyModal.set(false);
    this.shellUi.setActiveRoomCode(null);
    this.transport.clearUrl();
  }

  canExportSave(): boolean {
    return (
      this.hostSession !== null &&
      this.hostSession.lobby.started &&
      this.hostSession.state.phase !== 'gameOver'
    );
  }

  exportSaveData(): SerializedMonopolySave | null {
    if (!this.canExportSave() || !this.hostSession) return null;
    const { properties, ...restState } = this.hostSession.state;
    const raw: SerializedMonopolySave = {
      lobby: {
        started: true,
        rules: { ...(this.hostSession.lobby.rules as MonopolyLobbySettings) },
        seats: (this.hostSession.lobby.seats as MonopolySeat[]).map((s) => ({
          ...s,
          token: null,
        })),
      },
      state: {
        ...restState,
        propertiesEntries: Array.from(properties.entries()),
      },
    };
    return JSON.parse(JSON.stringify(raw)) as SerializedMonopolySave;
  }

  restoreSaveData(saved: SerializedMonopolySave): boolean {
    if (!saved?.lobby || !saved?.state) return false;
    this.leaveRoom();
    const cloned = JSON.parse(JSON.stringify(saved)) as SerializedMonopolySave;
    const hostName = cloned.lobby.seats.at(0)?.name || this.shellUi.playerNickname() || 'Host';
    const restoredSeats: MonopolySeat[] = cloned.lobby.seats.map((s, idx) => ({
      ...s,
      seat: idx,
      kind: idx === 0 ? 'human' : 'bot',
      name:
        idx === 0
          ? s.name || hostName
          : s.name || BOT_NAMES.at((idx - 1) % BOT_NAMES.length) || `Bot ${idx}`,
      token: idx === 0 ? 'host_token' : null,
      connected: true,
      color: s.color || MONOPOLY_PLAYER_COLORS.at(idx % MONOPOLY_PLAYER_COLORS.length) || '#457b9d',
    }));

    const restoredLobby: GenericLobby<MonopolySeat, MonopolyLobbySettings> = {
      started: true,
      seats: restoredSeats,
      rules: { ...DEFAULT_MONOPOLY_SETTINGS, ...cloned.lobby.rules },
    };

    const { propertiesEntries, ...restState } = cloned.state;
    const restoredState: MonopolyMatchState = {
      ...restState,
      properties: new Map<number, PropertyState>(propertiesEntries),
    };

    this.hostSession = this.transport.createHost<
      MonopolyMatchState,
      MonopolyPlayerView,
      MonopolyAction
    >({
      gamePrefix: 'P',
      online: false,
      hostName,
      initialState: restoredState,
      initialLobby: restoredLobby,
      buildPlayerView: (state, seatIdx) => this.engine.getMonopolyPlayerView(state, seatIdx),
      applyAction: (state, seatIdx, action) => this.handleActionApplied(state, seatIdx, action),
    });

    this.hostSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as MonopolySnapshot);
    });

    this.shellUi.setActiveGame('monopoly');
    this.shellUi.setActiveRoomCode(null);
    this.shellUi.playSfx('deal');
    void this.router.navigate(['/monopoly/board']);
    return true;
  }

  inspectSpace(spaceIndex: number): void {
    this.selectedSpaceIndex.set(spaceIndex);
    this.showDeedModal.set(true);
    this.shellUi.playSfx('click');
  }

  closeDeedModal(): void {
    this.showDeedModal.set(false);
  }

  private handleActionApplied(
    state: MonopolyMatchState,
    seatIdx: number,
    action: MonopolyAction
  ): void {
    this.engine.applyMonopolyAction(state, seatIdx, action);

    // Audio SFX cues
    if (action.type === 'rollDice') {
      this.shellUi.playSfx('dice');
    } else if (action.type === 'declareBankruptcy') {
      this.shellUi.playSfx('fail');
    } else if (action.type === 'buyProperty' || action.type === 'buildHouse') {
      this.shellUi.playSfx('click');
    }
  }

  private handleSnapshotUpdate(snap: MonopolySnapshot): void {
    this.snapshot.set(snap);

    // Navigate to board automatically if match started
    if (snap.lobby?.started && this.router.url.includes('/monopoly/lobby')) {
      void this.router.navigate(['/monopoly/board']);
    }

    // Auto-trigger tactical bot turn on Host
    if (this.isHost() && snap.view && snap.view.phase !== 'gameOver') {
      this.checkAndTriggerBotTurn(snap.view);
    }
  }

  private checkAndTriggerBotTurn(view: MonopolyPlayerView): void {
    clearTimeout(this.botTimer);

    // 1. If a trade proposal is pending for an AI bot, let that bot respond immediately
    if (view.pendingTrade) {
      const targetSeatIdx = view.pendingTrade.toSeat;
      const targetSeatObj = this.hostSession?.lobby.seats.find((s) => s.seat === targetSeatIdx);
      if (targetSeatObj?.kind === 'bot') {
        this.botTimer = setTimeout(() => {
          if (!this.hostSession) return;
          const botView = this.engine.getMonopolyPlayerView(this.hostSession.state, targetSeatIdx);
          const botAction = this.bot.evaluateMonopolyBotAction(botView, targetSeatIdx);
          if (botAction) {
            this.hostSession.updateState((state) => {
              this.engine.applyMonopolyAction(state, targetSeatIdx, botAction);
            });
          }
        }, 600);
        return;
      }
      // Pending trade targets a human player — pause bot actions until resolved
      return;
    }

    // 2. If auction phase: check if next active bidder is a bot
    if (view.phase === 'auction' && view.activeAuction) {
      const botBidder = view.activeAuction.activeBidders.find((seatIdx) => {
        const s = this.hostSession?.lobby.seats.find((seat) => seat.seat === seatIdx);
        return s?.kind === 'bot';
      });

      if (typeof botBidder === 'number') {
        this.botTimer = setTimeout(() => {
          if (!this.hostSession) return;
          const botAction = this.bot.evaluateMonopolyBotAction(view, botBidder);
          if (botAction) {
            this.hostSession.updateState((state) => {
              this.engine.applyMonopolyAction(state, botBidder, botAction);
            });
          }
        }, 800);
        return;
      }
    }

    // 2. Active seat bot turn
    const activeSeatObj = this.hostSession?.lobby.seats.find((s) => s.seat === view.activeSeat);
    if (activeSeatObj?.kind === 'bot') {
      this.botTimer = setTimeout(() => {
        if (!this.hostSession) return;
        const botAction = this.bot.evaluateMonopolyBotAction(view, view.activeSeat);
        if (botAction) {
          this.hostSession.updateState((state) => {
            this.engine.applyMonopolyAction(state, view.activeSeat, botAction);
          });
        }
      }, 700);
    }
  }
}
