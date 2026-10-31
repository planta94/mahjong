import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GenericLobby, GenericSessionSnapshot } from '../../../core/models/party.model';
import {
  GenericGuestSession,
  GenericHostSession,
  P2PRoomTransportService,
} from '../../../core/services/p2p-room.transport';
import { ShellUiService } from '../../../core/services/shell-ui.service';
import { DEFAULT_AVALON_BOT_NAMES } from '../data/avalon-config.data';
import {
  AvalonAction,
  AvalonLobbySettings,
  AvalonMatchState,
  AvalonPlayerView,
  AvalonSeat,
  DEFAULT_AVALON_SETTINGS,
  ProposalRecord,
  ProposalVote,
  QuestCard,
  createSerializableMap,
  hydrateAvalonPlayerView,
} from '../models/avalon.model';
import { AvalonBotService } from './avalon-bot.service';
import { AvalonEngineService } from './avalon-engine.service';

export type AvalonSnapshot = GenericSessionSnapshot<
  AvalonPlayerView,
  GenericLobby<AvalonSeat, AvalonLobbySettings>
>;

export interface SerializedAvalonSave {
  lobby: GenericLobby<AvalonSeat, AvalonLobbySettings>;
  state: Omit<
    AvalonMatchState,
    'currentVotes' | 'questSubmissions' | 'proposalHistory' | 'lastVoteReveal'
  > & {
    currentVotesEntries: [number, ProposalVote][];
    questSubmissionsEntries: [number, QuestCard][];
    proposalHistory: Array<
      Omit<ProposalRecord, 'votes'> & { votesEntries: [number, ProposalVote][] }
    >;
    lastVoteReveal: {
      votesEntries: [number, ProposalVote][];
      approved: boolean;
    } | null;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AvalonSessionService {
  private readonly router = inject(Router);
  private readonly transport = inject(P2PRoomTransportService);
  private readonly engine = inject(AvalonEngineService);
  private readonly bot = inject(AvalonBotService);
  private readonly shellUi = inject(ShellUiService);

  readonly snapshot = signal<AvalonSnapshot | null>(null);

  readonly mySeat = computed(() => this.snapshot()?.mySeat ?? -1);
  readonly isHost = computed(() => this.snapshot()?.role === 'host');
  readonly currentView = computed(() => this.snapshot()?.view ?? null);
  readonly currentLobby = computed(() => this.snapshot()?.lobby ?? null);

  readonly privacyShieldRevealed = signal<boolean>(false);
  readonly showQuestModal = signal<boolean>(false);
  readonly showLadyModal = signal<boolean>(false);
  readonly showAssassinationModal = signal<boolean>(false);

  private hostSession: GenericHostSession<
    AvalonMatchState,
    AvalonPlayerView,
    AvalonAction
  > | null = null;
  private guestSession: GenericGuestSession<AvalonPlayerView, AvalonAction> | null = null;
  private botTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('p2p:leave', (ev: Event) => {
        const detail = (ev as CustomEvent).detail as { game?: string } | undefined;
        if (!detail || detail.game === 'avalon') {
          this.leaveRoom();
        }
      });
    }
  }

  createSoloMatch(playerCount = 5, customSettings?: Partial<AvalonLobbySettings>): void {
    this.leaveRoom();
    const count = Math.max(5, Math.min(10, playerCount));
    const settings: AvalonLobbySettings = {
      ...DEFAULT_AVALON_SETTINGS,
      numPlayers: count,
      ...customSettings,
    };

    const hostName = this.shellUi.playerNickname() || '亚瑟骑士';
    const seats: AvalonSeat[] = [
      {
        seat: 0,
        kind: 'human',
        name: hostName,
        token: 'host_token',
        connected: true,
      },
    ];

    for (let i = 1; i < count; i++) {
      seats.push({
        seat: i,
        kind: 'bot',
        name:
          DEFAULT_AVALON_BOT_NAMES.at((i - 1) % DEFAULT_AVALON_BOT_NAMES.length) ??
          `电脑骑士 ${i + 1}`,
        connected: true,
      });
    }

    const initialLobby: GenericLobby<AvalonSeat, AvalonLobbySettings> = {
      started: true,
      seats,
      rules: settings,
    };

    const initialState = this.engine.createInitialAvalonState(settings, seats);

    this.hostSession = this.transport.createHost<
      AvalonMatchState,
      AvalonPlayerView,
      AvalonAction
    >({
      gamePrefix: 'A',
      online: false,
      hostName,
      initialState,
      initialLobby,
      buildPlayerView: (state, seatIdx) => this.engine.getAvalonPlayerView(state, seatIdx),
      applyAction: (state, seatIdx, action) => this.handleActionApplied(state, seatIdx, action),
    });

    this.hostSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as AvalonSnapshot);
    });

    this.shellUi.setActiveGame('avalon');
    this.shellUi.setActiveRoomCode(null);
    this.shellUi.playSfx('deal');
    void this.router.navigate(['/avalon/table']);
  }

  createMultiplayerRoom(seatsCount = 5, customSettings?: Partial<AvalonLobbySettings>): string {
    this.leaveRoom();
    const count = Math.max(5, Math.min(10, seatsCount));
    const settings: AvalonLobbySettings = {
      ...DEFAULT_AVALON_SETTINGS,
      numPlayers: count,
      ...customSettings,
    };

    const hostName = this.shellUi.playerNickname() || '圆桌领袖';
    const seats: AvalonSeat[] = [
      {
        seat: 0,
        kind: 'human',
        name: hostName,
        connected: true,
      },
    ];

    for (let i = 1; i < count; i++) {
      seats.push({
        seat: i,
        kind: 'open',
        name: `等待骑士入席…`,
        connected: false,
      });
    }

    const initialLobby: GenericLobby<AvalonSeat, AvalonLobbySettings> = {
      started: false,
      seats,
      rules: settings,
    };

    const initialState = this.engine.createInitialAvalonState(settings, seats);

    this.hostSession = this.transport.createHost<
      AvalonMatchState,
      AvalonPlayerView,
      AvalonAction
    >({
      gamePrefix: 'A',
      online: true,
      hostName,
      initialState,
      initialLobby,
      buildPlayerView: (state, seatIdx) => this.engine.getAvalonPlayerView(state, seatIdx),
      applyAction: (state, seatIdx, action) => this.handleActionApplied(state, seatIdx, action),
    });

    const roomCode = this.hostSession.roomCode;
    this.hostSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as AvalonSnapshot);
    });

    this.shellUi.setActiveGame('avalon');
    this.shellUi.setActiveRoomCode(roomCode);
    this.transport.updateUrl(roomCode, 'avalon');
    this.shellUi.playSfx('click');

    return roomCode;
  }

  joinMultiplayerRoom(roomCode: string): void {
    this.leaveRoom();
    const guestName = this.shellUi.playerNickname() || '亚瑟骑士';
    this.guestSession = this.transport.createGuest<AvalonPlayerView, AvalonAction>({
      roomCode,
      guestName,
    });

    this.guestSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as AvalonSnapshot);
    });

    this.shellUi.setActiveGame('avalon');
    this.shellUi.setActiveRoomCode(roomCode);
    this.transport.updateUrl(roomCode, 'avalon');
    this.shellUi.playSfx('click');
  }

  startMatchFromLobby(): void {
    if (!this.hostSession) return;
    const lobby = this.hostSession.lobby;
    lobby.started = true;

    // Fill remaining open seats with bots
    for (const seat of lobby.seats) {
      if (seat.kind === 'open') {
        seat.kind = 'bot';
        seat.name =
          DEFAULT_AVALON_BOT_NAMES.at((seat.seat - 1) % DEFAULT_AVALON_BOT_NAMES.length) ??
          `电脑骑士 ${seat.seat + 1}`;
        seat.connected = true;
      }
    }

    const settings = (lobby.rules as AvalonLobbySettings) ?? DEFAULT_AVALON_SETTINGS;
    settings.numPlayers = lobby.seats.length;
    this.hostSession.state = this.engine.createInitialAvalonState(
      settings,
      lobby.seats as AvalonSeat[]
    );
    this.hostSession.broadcastAll();

    this.shellUi.playSfx('deal');
    void this.router.navigate(['/avalon/table']);
  }

  dispatchAction(action: AvalonAction): void {
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
      seat.name =
        DEFAULT_AVALON_BOT_NAMES.at((seat.seat - 1) % DEFAULT_AVALON_BOT_NAMES.length) ??
        `电脑骑士 ${seat.seat + 1}`;
      seat.connected = true;
    } else if (seat.kind === 'bot') {
      seat.kind = 'open';
      seat.name = `等待骑士入席…`;
      seat.connected = false;
    }
    this.hostSession.broadcastAll();
    this.shellUi.playSfx('click');
  }

  setPlayerCount(count: number): void {
    if (!this.hostSession || this.hostSession.lobby.started) return;
    const clamped = Math.max(5, Math.min(10, count));
    const lobby = this.hostSession.lobby;
    const settings = (lobby.rules as AvalonLobbySettings) ?? DEFAULT_AVALON_SETTINGS;
    settings.numPlayers = clamped;

    const currentSeats = lobby.seats as AvalonSeat[];
    if (currentSeats.length < clamped) {
      for (let i = currentSeats.length; i < clamped; i++) {
        currentSeats.push({
          seat: i,
          kind: 'open',
          name: `等待骑士入席…`,
          connected: false,
        });
      }
    } else if (currentSeats.length > clamped) {
      lobby.seats = currentSeats.slice(0, clamped);
    }

    this.hostSession.broadcastAll();
    this.shellUi.playSfx('click');
  }

  updateSettings(delta: Partial<AvalonLobbySettings>): void {
    if (!this.hostSession || this.hostSession.lobby.started) return;
    const lobby = this.hostSession.lobby;
    const settings = (lobby.rules as AvalonLobbySettings) ?? DEFAULT_AVALON_SETTINGS;
    Object.assign(settings, delta);
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
    this.privacyShieldRevealed.set(false);
    this.showQuestModal.set(false);
    this.showLadyModal.set(false);
    this.showAssassinationModal.set(false);
    this.shellUi.setActiveRoomCode(null);
    this.transport.clearUrl();
  }

  canExportSave(): boolean {
    return (
      this.hostSession !== null &&
      this.hostSession.lobby.started &&
      this.hostSession.state.phase !== 'game_over'
    );
  }

  exportSaveData(): SerializedAvalonSave | null {
    if (!this.canExportSave() || !this.hostSession) return null;
    const state = this.hostSession.state;
    const {
      currentVotes,
      questSubmissions,
      proposalHistory,
      lastVoteReveal,
      ...restState
    } = state;
    const raw: SerializedAvalonSave = {
      lobby: {
        started: true,
        rules: JSON.parse(JSON.stringify(this.hostSession.lobby.rules)) as AvalonLobbySettings,
        seats: (this.hostSession.lobby.seats as AvalonSeat[]).map((s) => ({
          ...s,
          token: null,
        })),
      },
      state: {
        ...restState,
        currentVotesEntries: Array.from(currentVotes.entries()),
        questSubmissionsEntries: Array.from(questSubmissions.entries()),
        proposalHistory: proposalHistory.map(({ votes, ...restP }) => ({
          ...restP,
          votesEntries: Array.from(votes.entries()),
        })),
        lastVoteReveal: lastVoteReveal
          ? {
              approved: lastVoteReveal.approved,
              votesEntries: Array.from(lastVoteReveal.votes.entries()),
            }
          : null,
      },
    };
    return JSON.parse(JSON.stringify(raw)) as SerializedAvalonSave;
  }

  restoreSaveData(saved: SerializedAvalonSave): boolean {
    if (!saved?.lobby || !saved?.state) return false;
    this.leaveRoom();
    const cloned = JSON.parse(JSON.stringify(saved)) as SerializedAvalonSave;
    const hostName = cloned.lobby.seats.at(0)?.name || this.shellUi.playerNickname() || '亚瑟骑士';
    const restoredSeats: AvalonSeat[] = cloned.lobby.seats.map((s, idx) => ({
      ...s,
      seat: idx,
      kind: idx === 0 ? 'human' : 'bot',
      name:
        idx === 0
          ? s.name || hostName
          : s.name ||
            DEFAULT_AVALON_BOT_NAMES.at((idx - 1) % DEFAULT_AVALON_BOT_NAMES.length) ||
            `电脑骑士 ${idx + 1}`,
      token: idx === 0 ? 'host_token' : null,
      connected: true,
    }));

    const restoredLobby: GenericLobby<AvalonSeat, AvalonLobbySettings> = {
      started: true,
      seats: restoredSeats,
      rules: { ...DEFAULT_AVALON_SETTINGS, ...cloned.lobby.rules },
    };

    const {
      currentVotesEntries,
      questSubmissionsEntries,
      proposalHistory,
      lastVoteReveal,
      ...restState
    } = cloned.state;

    const restoredState: AvalonMatchState = {
      ...restState,
      players: restState.players.map((p, idx) => ({
        ...p,
        isBot: idx > 0,
        connected: true,
      })),
      currentVotes: createSerializableMap<number, ProposalVote>(currentVotesEntries),
      questSubmissions: createSerializableMap<number, QuestCard>(questSubmissionsEntries),
      proposalHistory: proposalHistory.map(({ votesEntries, ...restP }) => ({
        ...restP,
        votes: createSerializableMap<number, ProposalVote>(votesEntries),
      })),
      lastVoteReveal: lastVoteReveal
        ? {
            approved: lastVoteReveal.approved,
            votes: createSerializableMap<number, ProposalVote>(lastVoteReveal.votesEntries),
          }
        : null,
    };

    this.hostSession = this.transport.createHost<
      AvalonMatchState,
      AvalonPlayerView,
      AvalonAction
    >({
      gamePrefix: 'A',
      online: false,
      hostName,
      initialState: restoredState,
      initialLobby: restoredLobby,
      buildPlayerView: (state, seatIdx) => this.engine.getAvalonPlayerView(state, seatIdx),
      applyAction: (state, seatIdx, action) => this.handleActionApplied(state, seatIdx, action),
    });

    this.hostSession.onUpdate((snap) => {
      this.handleSnapshotUpdate(snap as AvalonSnapshot);
    });

    this.shellUi.setActiveGame('avalon');
    this.shellUi.setActiveRoomCode(null);
    this.shellUi.playSfx('deal');
    void this.router.navigate(['/avalon/table']);
    return true;
  }

  togglePrivacyShield(): void {
    this.privacyShieldRevealed.update((v) => !v);
    this.shellUi.playSfx('click');
  }

  setPrivacyShield(revealed: boolean): void {
    this.privacyShieldRevealed.set(revealed);
  }

  private handleActionApplied(
    state: AvalonMatchState,
    seatIdx: number,
    action: AvalonAction
  ): void {
    this.engine.applyAvalonAction(state, seatIdx, action);

    // Audio SFX feedback
    switch (action.type) {
      case 'proposeTeam':
        this.shellUi.playSfx('click');
        break;
      case 'voteProposal':
        this.shellUi.playSfx('click');
        break;
      case 'submitQuestCard':
        this.shellUi.playSfx('deal');
        break;
      case 'useLadyOfLake':
        this.shellUi.playSfx('alert');
        break;
      case 'assassinateMerlin':
        if (state.winner === 'evil') {
          this.shellUi.playSfx('fail');
        } else {
          this.shellUi.playSfx('fanfare');
        }
        break;
    }
  }

  private handleSnapshotUpdate(snap: AvalonSnapshot): void {
    const hydratedView = snap.view ? hydrateAvalonPlayerView(snap.view) : null;
    const hydratedSnap: AvalonSnapshot = {
      ...snap,
      view: hydratedView,
    };

    this.snapshot.set(hydratedSnap);

    // Auto navigate to table if match started
    if (snap.lobby?.started && this.router.url.includes('/avalon/lobby')) {
      void this.router.navigate(['/avalon/table']);
    }

    // Auto trigger bot turn on host
    if (this.isHost() && hydratedView && hydratedView.phase !== 'game_over') {
      this.checkAndTriggerBotTurn(hydratedView);
    }
  }

  private checkAndTriggerBotTurn(view: AvalonPlayerView): void {
    clearTimeout(this.botTimer);
    if (!this.hostSession) return;

    // 1. Team Proposal phase
    if (view.phase === 'team_proposal') {
      const leaderSeat = this.hostSession.lobby.seats.find((s) => s.seat === view.currentLeader);
      if (leaderSeat?.kind === 'bot') {
        this.botTimer = setTimeout(() => {
          if (!this.hostSession) return;
          const botView = this.engine.getAvalonPlayerView(
            this.hostSession.state,
            view.currentLeader
          );
          const botAction = this.bot.evaluateAvalonBotAction(botView, view.currentLeader);
          if (botAction) {
            this.hostSession.updateState((state) => {
              this.engine.applyAvalonAction(state, view.currentLeader, botAction);
            });
          }
        }, 650);
        return;
      }
    }

    // 2. Team Voting phase
    if (view.phase === 'team_voting') {
      const pendingBotVoter = this.hostSession.lobby.seats.find((s) => {
        if (s.kind !== 'bot') return false;
        return !this.hostSession?.state.currentVotes.has(s.seat);
      });

      if (pendingBotVoter) {
        this.botTimer = setTimeout(() => {
          if (!this.hostSession) return;
          const botView = this.engine.getAvalonPlayerView(
            this.hostSession.state,
            pendingBotVoter.seat
          );
          const botAction = this.bot.evaluateAvalonBotAction(botView, pendingBotVoter.seat);
          if (botAction) {
            this.hostSession.updateState((state) => {
              this.engine.applyAvalonAction(state, pendingBotVoter.seat, botAction);
            });
          }
        }, 500);
        return;
      }
    }

    // 3. Quest Execution phase
    if (view.phase === 'quest_execution') {
      const pendingBotMember = this.hostSession.state.proposedTeam.find((seatIdx) => {
        const s = this.hostSession?.lobby.seats.find((seat) => seat.seat === seatIdx);
        if (s?.kind !== 'bot') return false;
        return !this.hostSession?.state.questSubmissions.has(seatIdx);
      });

      if (typeof pendingBotMember === 'number') {
        this.botTimer = setTimeout(() => {
          if (!this.hostSession) return;
          const botView = this.engine.getAvalonPlayerView(
            this.hostSession.state,
            pendingBotMember
          );
          const botAction = this.bot.evaluateAvalonBotAction(botView, pendingBotMember);
          if (botAction) {
            this.hostSession.updateState((state) => {
              this.engine.applyAvalonAction(state, pendingBotMember, botAction);
            });
          }
        }, 600);
        return;
      }
    }

    // 4. Lady of the Lake phase
    if (view.phase === 'lady_of_lake' && typeof this.hostSession.state.ladyHolderSeat === 'number') {
      const ladyHolder = this.hostSession.state.ladyHolderSeat;
      const holderSeat = this.hostSession.lobby.seats.find((s) => s.seat === ladyHolder);
      if (holderSeat?.kind === 'bot') {
        this.botTimer = setTimeout(() => {
          if (!this.hostSession) return;
          const botView = this.engine.getAvalonPlayerView(this.hostSession.state, ladyHolder);
          const botAction = this.bot.evaluateAvalonBotAction(botView, ladyHolder);
          if (botAction) {
            this.hostSession.updateState((state) => {
              this.engine.applyAvalonAction(state, ladyHolder, botAction);
            });
          }
        }, 700);
        return;
      }
    }

    // 5. Assassination phase
    if (view.phase === 'assassination') {
      const assassin = this.hostSession.state.players.find((p) => p.role === 'assassin');
      if (assassin) {
        const assassinSeat = this.hostSession.lobby.seats.find((s) => s.seat === assassin.seat);
        if (assassinSeat?.kind === 'bot') {
          this.botTimer = setTimeout(() => {
            if (!this.hostSession) return;
            const botView = this.engine.getAvalonPlayerView(
              this.hostSession.state,
              assassin.seat
            );
            const botAction = this.bot.evaluateAvalonBotAction(botView, assassin.seat);
            if (botAction) {
              this.hostSession.updateState((state) => {
                this.engine.applyAvalonAction(state, assassin.seat, botAction);
              });
            }
          }, 800);
        }
      }
    }
  }
}
