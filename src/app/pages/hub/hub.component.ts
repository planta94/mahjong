import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GameId } from '../../core/models/party.model';
import { GameSessionManagerService } from '../../core/services/game-session-manager.service';
import { parseUniversalRoomCode } from '../../core/services/p2p-room.transport';
import { ShellUiService } from '../../core/services/shell-ui.service';
import { TranslateService } from '../../core/services/translate.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

export interface GameTileMeta {
  readonly id: GameId;
  readonly cardClass: string;
  readonly badgeClass: string;
  readonly btnClass: string;
  readonly badgeKey: string;
  readonly titleKey: string;
  readonly playersKey: string;
  readonly descKey: string;
  readonly featureKeys: readonly string[];
  readonly enterKey: string;
}

const GAME_TILES: readonly GameTileMeta[] = [
  {
    id: 'mahjong',
    cardClass: 'mahjong-card',
    badgeClass: 'badge-jade',
    btnClass: 'btn-jade',
    badgeKey: 'HUB.MAHJONG_BADGE',
    titleKey: 'HUB.MAHJONG_TITLE',
    playersKey: 'HUB.MAHJONG_PLAYERS',
    descKey: 'HUB.MAHJONG_DESC',
    featureKeys: ['HUB.MAHJONG_FEAT_1', 'HUB.MAHJONG_FEAT_2', 'HUB.MAHJONG_FEAT_3'],
    enterKey: 'HUB.ENTER_MAHJONG',
  },
  {
    id: 'monopoly',
    cardClass: 'monopoly-card',
    badgeClass: 'badge-gold',
    btnClass: 'btn-gold',
    badgeKey: 'HUB.MONOPOLY_BADGE',
    titleKey: 'HUB.MONOPOLY_TITLE',
    playersKey: 'HUB.MONOPOLY_PLAYERS',
    descKey: 'HUB.MONOPOLY_DESC',
    featureKeys: ['HUB.MONOPOLY_FEAT_1', 'HUB.MONOPOLY_FEAT_2', 'HUB.MONOPOLY_FEAT_3'],
    enterKey: 'HUB.ENTER_MONOPOLY',
  },
  {
    id: 'avalon',
    cardClass: 'avalon-card',
    badgeClass: 'badge-crimson',
    btnClass: 'btn-crimson',
    badgeKey: 'HUB.AVALON_BADGE',
    titleKey: 'HUB.AVALON_TITLE',
    playersKey: 'HUB.AVALON_PLAYERS',
    descKey: 'HUB.AVALON_DESC',
    featureKeys: ['HUB.AVALON_FEAT_1', 'HUB.AVALON_FEAT_2', 'HUB.AVALON_FEAT_3'],
    enterKey: 'HUB.ENTER_AVALON',
  },
];

const GAME_TILE_MAP: ReadonlyMap<GameId, GameTileMeta> = new Map(
  GAME_TILES.map((tile) => [tile.id, tile])
);

@Component({
  selector: 'app-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './hub.component.html',
  styleUrl: './hub.component.scss',
})
export class HubComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  readonly shellUi = inject(ShellUiService);
  readonly gameManager = inject(GameSessionManagerService);

  readonly gameTiles = GAME_TILES;
  readonly roomCodeInput = signal<string>('');
  readonly nicknameInput = signal<string>('');
  readonly isEditingNickname = signal<boolean>(false);
  readonly joinError = signal<string | null>(null);
  readonly selectedGame = signal<GameId | null>(null);

  readonly selectedGameMeta = computed<GameTileMeta | null>(() => {
    const id = this.selectedGame();
    return id ? (GAME_TILE_MAP.get(id) ?? null) : null;
  });

  ngOnInit(): void {
    this.shellUi.setActiveGame('hub');
    this.shellUi.setActiveRoomCode(null);
    this.nicknameInput.set(this.shellUi.playerNickname());

    const params = this.route.snapshot.queryParamMap;
    const roomParam = params.get('room');
    const gameParam = params.get('game');

    if (roomParam) {
      const inputStr = gameParam ? `?game=${gameParam}&room=${roomParam}` : `?room=${roomParam}`;
      const parsed = parseUniversalRoomCode(inputStr);
      if (parsed.roomCode) {
        void this.router.navigate([`/${parsed.game}/lobby`], {
          queryParams: { room: parsed.roomCode },
          replaceUrl: true,
        });
        return;
      }
    }

    // Visiting homepage directly terminates any active in-memory game sessions
    this.gameManager.killAllActiveSessions();
  }

  onRoomCodeChange(val: string): void {
    this.roomCodeInput.set(val);
    if (this.joinError()) {
      this.joinError.set(null);
    }
  }

  onNicknameChange(val: string): void {
    this.nicknameInput.set(val);
  }

  startEditNickname(): void {
    this.nicknameInput.set(this.shellUi.playerNickname());
    this.isEditingNickname.set(true);
  }

  saveNickname(): void {
    this.shellUi.setPlayerNickname(this.nicknameInput());
    this.isEditingNickname.set(false);
    this.shellUi.playSfx('click');
  }

  cancelEditNickname(): void {
    this.nicknameInput.set(this.shellUi.playerNickname());
    this.isEditingNickname.set(false);
  }

  joinRoom(): void {
    const raw = this.roomCodeInput().trim();
    if (!raw) {
      this.joinError.set('HUB.ERROR_EMPTY_ROOM');
      this.shellUi.playSfx('fail');
      return;
    }

    const parsed = parseUniversalRoomCode(raw);
    if (!parsed.roomCode) {
      this.joinError.set('HUB.ERROR_INVALID_ROOM');
      this.shellUi.playSfx('fail');
      return;
    }

    this.shellUi.playSfx('click');
    void this.router.navigate([`/${parsed.game}/lobby`], {
      queryParams: { room: parsed.roomCode },
    });
  }

  openGameDetail(game: GameId): void {
    this.shellUi.playSfx('click');
    this.selectedGame.set(game);
  }

  closeGameDetail(): void {
    this.selectedGame.set(null);
  }

  enterSelectedGame(): void {
    const game = this.selectedGame();
    if (!game) {
      return;
    }
    this.selectedGame.set(null);
    this.enterGame(game);
  }

  enterGame(game: GameId): void {
    this.shellUi.playSfx('click');
    void this.router.navigate([`/${game}/lobby`]);
  }

  openRulebook(game: GameId): void {
    this.shellUi.playSfx('click');
    this.shellUi.openRulebook(game);
  }

  getSavedSubtitle(game: GameId, summary: string, savedAt: number): string {
    const gameKey =
      game === 'monopoly'
        ? 'HUB.MONOPOLY_TITLE'
        : game === 'avalon'
          ? 'HUB.AVALON_TITLE'
          : 'HUB.MAHJONG_TITLE';
    const gameTitle = this.translate.instant(gameKey);
    const d = new Date(savedAt);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return this.translate.instant('HUB.SAVED_SUBTITLE', {
      game: gameTitle,
      summary,
      time: `${hh}:${mm}`,
    });
  }

  resumeSaved(): void {
    this.shellUi.playSfx('deal');
    this.gameManager.resumeSavedGame();
  }

  deleteSaved(): void {
    this.shellUi.playSfx('click');
    this.gameManager.deleteSavedGame();
  }
}
