import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ShellUiService } from '../../../../core/services/shell-ui.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PLAYER_COUNT_RATIOS } from '../../data/avalon-config.data';
import { AvalonLobbySettings, AvalonRoleConfig } from '../../models/avalon.model';
import { AvalonSessionService } from '../../services/avalon-session.service';

@Component({
  selector: 'app-avalon-lobby',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './avalon-lobby.component.html',
  styleUrl: './avalon-lobby.component.scss',
})
export class AvalonLobbyComponent implements OnInit {
  readonly session = inject(AvalonSessionService);
  readonly shellUi = inject(ShellUiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  playerCount = 5;
  percival = true;
  morgana = true;
  mordred = false;
  oberon = false;
  enableLadyOfLake = false;

  joinCode = '';
  readonly hasUrlInvite = signal<boolean>(false);

  ngOnInit(): void {
    this.shellUi.setActiveGame('avalon');

    const sub = this.route.queryParamMap.subscribe((params) => {
      const room = params.get('room');
      if (room && !this.session.snapshot()) {
        this.joinCode = room.toUpperCase();
        this.hasUrlInvite.set(true);
      }
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  get goodCount(): number {
    return PLAYER_COUNT_RATIOS.get(this.playerCount)?.good ?? 3;
  }

  get evilCount(): number {
    return PLAYER_COUNT_RATIOS.get(this.playerCount)?.evil ?? 2;
  }

  get roleConfig(): AvalonRoleConfig {
    return {
      percival: this.percival,
      morgana: this.morgana,
      mordred: this.mordred,
      oberon: this.oberon,
    };
  }

  get lobbySettings(): AvalonLobbySettings {
    return {
      numPlayers: this.playerCount,
      roleConfig: this.roleConfig,
      enableLadyOfLake: this.enableLadyOfLake,
    };
  }

  startSolo(): void {
    this.session.createSoloMatch(this.playerCount, this.lobbySettings);
  }

  createRoom(): void {
    this.session.createMultiplayerRoom(this.playerCount, this.lobbySettings);
  }

  joinRoom(): void {
    if (!this.joinCode.trim()) return;
    this.session.joinMultiplayerRoom(this.joinCode.trim());
  }

  startMatch(): void {
    this.session.startMatchFromLobby();
  }

  toggleSeat(seatIdx: number): void {
    this.session.toggleSeatKind(seatIdx);
  }

  onPlayerCountChange(val: number): void {
    this.playerCount = Number(val);
    if (this.session.isHost() && this.session.currentLobby()) {
      this.session.setPlayerCount(this.playerCount);
    }
  }

  onRoleToggle(): void {
    if (this.session.isHost() && this.session.currentLobby()) {
      this.session.updateSettings(this.lobbySettings);
    }
  }
}
