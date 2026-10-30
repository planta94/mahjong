import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { GameMode } from '../../core/models/mahjong.model';
import {
  MahjongSessionService,
  extractRoomCode,
} from '../../core/services/mahjong-session.service';
import { DEFAULT_RULES } from '../../core/services/scorer.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.scss',
})
export class LobbyComponent {
  readonly session = inject(MahjongSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly minFanOptions: readonly number[] = [3, 5, 7, 8];
  readonly maxFanOptions: readonly number[] = [8, 10, 13];

  nickname = this.loadInitialNickname();
  joinCode = this.loadUrlRoom();
  readonly hasUrlInvite = signal<boolean>(Boolean(this.joinCode));
  readonly selectedMode = signal<GameMode>('3p');

  homeMinFan = DEFAULT_RULES.minFan;
  homeMaxFan = DEFAULT_RULES.maxFan;
  homeConcealed = DEFAULT_RULES.concealedFan;
  homeSevenPairs = DEFAULT_RULES.sevenPairs;
  homeShowHints = DEFAULT_RULES.showHints !== false;

  constructor() {
    const sub = this.route.queryParamMap.subscribe((params) => {
      if (this.session.snapshot()) return;
      const room = extractRoomCode(params.get('room') ?? '');
      if (room) {
        this.joinCode = room;
        this.hasUrlInvite.set(true);
      }
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());

    if (typeof window !== 'undefined') {
      const onLeave = () => {
        this.hasUrlInvite.set(false);
        this.joinCode = '';
      };
      window.addEventListener('mahjong:leave', onLeave);
      this.destroyRef.onDestroy(() => window.removeEventListener('mahjong:leave', onLeave));
    }
  }

  private loadInitialNickname(): string {
    try {
      return localStorage.getItem('hkmj_nickname') || '雀神';
    } catch {
      return '雀神';
    }
  }

  private loadUrlRoom(): string {
    try {
      return extractRoomCode(window.location.search);
    } catch {
      return '';
    }
  }

  private persistNickname(): string {
    const clean = this.nickname.trim() || '雀神';
    this.nickname = clean;
    try {
      localStorage.setItem('hkmj_nickname', clean);
    } catch {
      // Ignore restricted storage environments
    }
    return clean;
  }

  selectMode(mode: GameMode): void {
    this.selectedMode.set(mode);
  }

  onHomeMinFanChange(val: number): void {
    this.homeMinFan = Number(val);
    if (this.homeMaxFan < this.homeMinFan) {
      this.homeMaxFan = this.homeMinFan;
    }
  }

  onLobbyConcealedChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) {
      this.session.updateLobbyRules({ concealedFan: target.checked });
    }
  }

  onLobbySevenPairsChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) {
      this.session.updateLobbyRules({ sevenPairs: target.checked });
    }
  }

  onLobbyHintsChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    const snap = this.session.snapshot();
    if (snap?.role === 'host') {
      this.session.updateLobbyRules({ showHints: target.checked });
    }
    this.session.hintsEnabled.set(target.checked);
  }

  startSolo(): void {
    const name = this.persistNickname();
    this.session.startSolo(name, this.selectedMode(), {
      minFan: Number(this.homeMinFan),
      maxFan: Number(this.homeMaxFan),
      concealedFan: this.homeConcealed,
      sevenPairs: this.homeSevenPairs,
      showHints: this.homeShowHints,
    });
  }

  createOnlineRoom(): void {
    const name = this.persistNickname();
    this.session.createOnlineRoom(name, this.selectedMode(), {
      minFan: Number(this.homeMinFan),
      maxFan: Number(this.homeMaxFan),
      concealedFan: this.homeConcealed,
      sevenPairs: this.homeSevenPairs,
      showHints: this.homeShowHints,
    });
  }

  joinRoom(): void {
    const name = this.persistNickname();
    const cleanCode = extractRoomCode(this.joinCode);
    this.joinCode = cleanCode;
    this.session.joinOnlineRoom(cleanCode, name, this.homeShowHints);
  }
}
