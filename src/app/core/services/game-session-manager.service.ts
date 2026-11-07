import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AvalonSessionService, SerializedAvalonSave } from '../../games/avalon/services/avalon-session.service';
import {
  BalikKampungSessionService,
  SerializedBalikKampungSave,
} from '../../games/balik-kampung/services/balik-kampung-session.service';
import { MonopolySessionService, SerializedMonopolySave } from '../../games/monopoly/services/monopoly-session.service';
import { PandemicSessionService, SerializedPandemicSave } from '../../games/pandemic/services/pandemic-session.service';
import { GameId } from '../models/party.model';
import { MahjongSessionService, SerializedMahjongSave } from './mahjong-session.service';
import { clearBrowserUrlRoom } from './p2p-room.transport';
import { ShellUiService } from './shell-ui.service';

export const SAVED_GAME_STORAGE_KEY = 'party_saved_game_v1';

export type ExitDestination = 'hub' | 'gameLobby';

export interface SavedGameRecord {
  readonly version: 1;
  readonly game: GameId;
  readonly savedAt: number;
  readonly summary: string;
  readonly payload:
    | SerializedMahjongSave
    | SerializedMonopolySave
    | SerializedAvalonSave
    | SerializedPandemicSave
    | SerializedBalikKampungSave;
}

function isSavedGameRecord(val: unknown): val is SavedGameRecord {
  if (typeof val !== 'object' || val === null) return false;
  const rec = val as Record<string, unknown>;
  const game = rec['game'];
  return (
    rec['version'] === 1 &&
    (game === 'mahjong' ||
      game === 'monopoly' ||
      game === 'avalon' ||
      game === 'pandemic' ||
      game === 'balik-kampung') &&
    typeof rec['savedAt'] === 'number' &&
    typeof rec['summary'] === 'string' &&
    typeof rec['payload'] === 'object' &&
    rec['payload'] !== null
  );
}

@Injectable({
  providedIn: 'root',
})
export class GameSessionManagerService {
  private readonly router = inject(Router);
  private readonly shellUi = inject(ShellUiService);
  private readonly mahjong = inject(MahjongSessionService);
  private readonly monopoly = inject(MonopolySessionService);
  private readonly avalon = inject(AvalonSessionService);
  private readonly pandemic = inject(PandemicSessionService);
  private readonly balikKampung = inject(BalikKampungSessionService);

  readonly savedGame = signal<SavedGameRecord | null>(this.readSavedGame());
  readonly showExitConfirmModal = signal<boolean>(false);
  readonly exitDestination = signal<ExitDestination>('hub');

  readonly hasActiveProgress = computed(
    () =>
      this.mahjong.snapshot() !== null ||
      this.monopoly.snapshot() !== null ||
      this.avalon.snapshot() !== null ||
      this.pandemic.snapshot() !== null ||
      this.balikKampung.snapshot() !== null
  );

  readonly hasStartedMatch = computed(
    () =>
      (this.mahjong.snapshot() !== null && this.mahjong.snapshot()?.view !== null) ||
      (this.monopoly.snapshot() !== null && this.monopoly.snapshot()?.view !== null) ||
      (this.avalon.snapshot() !== null && this.avalon.snapshot()?.view !== null) ||
      (this.pandemic.snapshot() !== null && this.pandemic.snapshot()?.view !== null) ||
      (this.balikKampung.snapshot() !== null &&
        Boolean(this.balikKampung.snapshot()?.lobby?.started) &&
        this.balikKampung.snapshot()?.view !== null)
  );

  readonly hasActiveWaitingRoom = computed(
    () =>
      (this.mahjong.snapshot() !== null && this.mahjong.snapshot()?.view === null) ||
      (this.monopoly.snapshot() !== null && this.monopoly.snapshot()?.view === null) ||
      (this.avalon.snapshot() !== null && this.avalon.snapshot()?.view === null) ||
      (this.pandemic.snapshot() !== null && this.pandemic.snapshot()?.view === null) ||
      (this.balikKampung.snapshot() !== null &&
        !this.balikKampung.snapshot()?.lobby?.started) ||
      Boolean(this.shellUi.activeRoomCode() && !this.hasStartedMatch())
  );

  readonly canSaveCurrentProgress = computed(() => {
    const mj = this.mahjong.snapshot();
    const mono = this.monopoly.snapshot();
    const av = this.avalon.snapshot();
    const pan = this.pandemic.snapshot();
    const bk = this.balikKampung.snapshot();
    return (
      (mj !== null && this.mahjong.canExportSave()) ||
      (mono !== null && this.monopoly.canExportSave()) ||
      (av !== null && this.avalon.canExportSave()) ||
      (pan !== null && this.pandemic.canExportSave()) ||
      (bk !== null && this.balikKampung.canExportSave())
    );
  });

  readonly activeSessionGame = computed<GameId | 'hub'>(() => {
    const current = this.shellUi.activeGame();
    if (current !== 'hub') return current;
    if (this.balikKampung.snapshot() !== null) return 'balik-kampung';
    if (this.pandemic.snapshot() !== null) return 'pandemic';
    if (this.monopoly.snapshot() !== null) return 'monopoly';
    if (this.avalon.snapshot() !== null) return 'avalon';
    if (this.mahjong.snapshot() !== null) return 'mahjong';
    return 'hub';
  });

  getGameLobbyRoute(): string {
    const game = this.shellUi.activeGame();
    switch (game) {
      case 'monopoly':
        return '/monopoly/lobby';
      case 'avalon':
        return '/avalon/lobby';
      case 'pandemic':
        return '/pandemic/lobby';
      case 'balik-kampung':
        return '/balik-kampung/lobby';
      case 'mahjong':
      default:
        return '/mahjong/lobby';
    }
  }

  requestGoHome(): void {
    if (this.hasStartedMatch()) {
      this.exitDestination.set('hub');
      this.showExitConfirmModal.set(true);
      return;
    }
    this.killAllActiveSessions();
    void this.router.navigate(['/']);
  }

  requestLeaveCurrentGame(): void {
    if (this.hasStartedMatch()) {
      this.exitDestination.set('gameLobby');
      this.showExitConfirmModal.set(true);
      return;
    }
    const targetLobby = this.getGameLobbyRoute();
    this.killAllActiveSessions();
    void this.router.navigate([targetLobby]);
  }

  cancelExitConfirm(): void {
    this.showExitConfirmModal.set(false);
  }

  saveCurrentProgress(): boolean {
    const active = this.shellUi.activeGame();
    const allGames: GameId[] = ['mahjong', 'monopoly', 'avalon', 'pandemic', 'balik-kampung'];
    const order: GameId[] = [
      active !== 'hub' ? active : 'mahjong',
      ...allGames.filter((g) => g !== active),
    ];

    for (const game of order) {
      if (game === 'mahjong' && this.mahjong.canExportSave()) {
        const payload = this.mahjong.exportSaveData();
        if (payload) {
          return this.persistRecord({
            version: 1,
            game: 'mahjong',
            savedAt: Date.now(),
            summary: `${payload.match.mode.toUpperCase()} · #${payload.match.handNumber}`,
            payload,
          });
        }
      }
      if (game === 'monopoly' && this.monopoly.canExportSave()) {
        const payload = this.monopoly.exportSaveData();
        if (payload) {
          return this.persistRecord({
            version: 1,
            game: 'monopoly',
            savedAt: Date.now(),
            summary: `R${payload.state.currentRound} · ${payload.state.players.length}P`,
            payload,
          });
        }
      }
      if (game === 'avalon' && this.avalon.canExportSave()) {
        const payload = this.avalon.exportSaveData();
        if (payload) {
          return this.persistRecord({
            version: 1,
            game: 'avalon',
            savedAt: Date.now(),
            summary: `Q${payload.state.currentQuest} · ${payload.state.numPlayers}P`,
            payload,
          });
        }
      }
      if (game === 'pandemic' && this.pandemic.canExportSave()) {
        const payload = this.pandemic.exportSaveData();
        if (payload) {
          return this.persistRecord({
            version: 1,
            game: 'pandemic',
            savedAt: Date.now(),
            summary: `${payload.state.difficulty.toUpperCase()} · ${payload.lobby.seats.length}P`,
            payload,
          });
        }
      }
      if (game === 'balik-kampung' && this.balikKampung.canExportSave()) {
        const payload = this.balikKampung.exportSaveData();
        if (payload) {
          return this.persistRecord({
            version: 1,
            game: 'balik-kampung',
            savedAt: Date.now(),
            summary: `R${payload.state.roundNumber} · ${payload.state.players.length}P`,
            payload,
          });
        }
      }
    }
    return false;
  }

  confirmSaveAndExit(): void {
    this.saveCurrentProgress();
    this.showExitConfirmModal.set(false);
    this.killAllActiveSessions();
    void this.router.navigate(['/']);
  }

  confirmDiscardAndExit(): void {
    this.showExitConfirmModal.set(false);
    this.killAllActiveSessions();
    void this.router.navigate(['/']);
  }

  confirmLeaveToGameLobby(): void {
    this.showExitConfirmModal.set(false);
    const targetLobby = this.getGameLobbyRoute();
    this.killAllActiveSessions();
    void this.router.navigate([targetLobby]);
  }

  killAllActiveSessions(): void {
    this.showExitConfirmModal.set(false);
    if (this.mahjong.snapshot() !== null) {
      this.mahjong.terminateSession();
    }
    if (this.monopoly.snapshot() !== null) {
      this.monopoly.leaveRoom();
    }
    if (this.avalon.snapshot() !== null) {
      this.avalon.leaveRoom();
    }
    if (this.pandemic.snapshot() !== null) {
      this.pandemic.leaveRoom();
    }
    if (this.balikKampung.snapshot() !== null) {
      this.balikKampung.leaveRoom();
    }
    this.shellUi.leaveActiveRoom();
    clearBrowserUrlRoom();
  }

  resumeSavedGame(): boolean {
    const record = this.savedGame();
    if (!record) return false;
    this.killAllActiveSessions();
    switch (record.game) {
      case 'mahjong':
        return this.mahjong.restoreSaveData(record.payload as SerializedMahjongSave);
      case 'monopoly':
        return this.monopoly.restoreSaveData(record.payload as SerializedMonopolySave);
      case 'avalon':
        return this.avalon.restoreSaveData(record.payload as SerializedAvalonSave);
      case 'pandemic':
        return this.pandemic.restoreSaveData(record.payload as SerializedPandemicSave);
      case 'balik-kampung':
        return this.balikKampung.restoreSaveData(record.payload as SerializedBalikKampungSave);
      default:
        return false;
    }
  }

  deleteSavedGame(): void {
    this.savedGame.set(null);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SAVED_GAME_STORAGE_KEY);
      }
    } catch {
      // Storage unavailable
    }
  }

  private persistRecord(record: SavedGameRecord): boolean {
    this.savedGame.set(record);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SAVED_GAME_STORAGE_KEY, JSON.stringify(record));
      }
      return true;
    } catch {
      return false;
    }
  }

  private readSavedGame(): SavedGameRecord | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(SAVED_GAME_STORAGE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (isSavedGameRecord(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Corrupted or unavailable storage
    }
    return null;
  }
}
