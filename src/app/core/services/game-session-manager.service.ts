import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AvalonSessionService, SerializedAvalonSave } from '../../games/avalon/services/avalon-session.service';
import { MonopolySessionService, SerializedMonopolySave } from '../../games/monopoly/services/monopoly-session.service';
import { GameId } from '../models/party.model';
import { MahjongSessionService, SerializedMahjongSave } from './mahjong-session.service';
import { clearBrowserUrlRoom } from './p2p-room.transport';
import { ShellUiService } from './shell-ui.service';

export const SAVED_GAME_STORAGE_KEY = 'party_saved_game_v1';

export interface SavedGameRecord {
  readonly version: 1;
  readonly game: GameId;
  readonly savedAt: number;
  readonly summary: string;
  readonly payload: SerializedMahjongSave | SerializedMonopolySave | SerializedAvalonSave;
}

function isSavedGameRecord(val: unknown): val is SavedGameRecord {
  if (typeof val !== 'object' || val === null) return false;
  const rec = val as Record<string, unknown>;
  const game = rec['game'];
  return (
    rec['version'] === 1 &&
    (game === 'mahjong' || game === 'monopoly' || game === 'avalon') &&
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

  readonly savedGame = signal<SavedGameRecord | null>(this.readSavedGame());
  readonly showExitConfirmModal = signal<boolean>(false);

  readonly hasActiveProgress = computed(
    () =>
      this.mahjong.snapshot() !== null ||
      this.monopoly.snapshot() !== null ||
      this.avalon.snapshot() !== null
  );

  readonly canSaveCurrentProgress = computed(
    () =>
      this.mahjong.canExportSave() ||
      this.monopoly.canExportSave() ||
      this.avalon.canExportSave()
  );

  requestGoHome(): void {
    if (this.hasActiveProgress()) {
      this.showExitConfirmModal.set(true);
      return;
    }
    this.killAllActiveSessions();
    void this.router.navigate(['/']);
  }

  cancelExitConfirm(): void {
    this.showExitConfirmModal.set(false);
  }

  saveCurrentProgress(): boolean {
    const active = this.shellUi.activeGame();
    const order: GameId[] =
      active === 'monopoly'
        ? ['monopoly', 'mahjong', 'avalon']
        : active === 'avalon'
          ? ['avalon', 'mahjong', 'monopoly']
          : ['mahjong', 'monopoly', 'avalon'];

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
    this.shellUi.setActiveRoomCode(null);
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
