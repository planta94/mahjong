import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ShellUiService } from '../../../../core/services/shell-ui.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { MonopolyLobbySettings, MonopolyWinCondition } from '../../models/monopoly.model';
import { MonopolySessionService } from '../../services/monopoly-session.service';

@Component({
  selector: 'app-monopoly-lobby',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './monopoly-lobby.component.html',
  styleUrl: './monopoly-lobby.component.scss',
})
export class MonopolyLobbyComponent implements OnInit {
  readonly session = inject(MonopolySessionService);
  readonly shellUi = inject(ShellUiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  playerCount = 4;
  winCondition: MonopolyWinCondition = 'lastTycoon';
  maxRounds = 30;
  auctionEnabled = true;

  joinCode = '';
  readonly hasUrlInvite = signal<boolean>(false);

  ngOnInit(): void {
    this.shellUi.setActiveGame('monopoly');

    const sub = this.route.queryParamMap.subscribe((params) => {
      const room = params.get('room');
      if (room && !this.session.snapshot()) {
        this.joinCode = room.toUpperCase();
        this.hasUrlInvite.set(true);
      }
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  get lobbySettings(): MonopolyLobbySettings {
    return {
      winCondition: this.winCondition,
      maxRounds: this.maxRounds,
      auctionEnabled: this.auctionEnabled,
      startingCash: 1500,
      freeParkingSeed: 100,
      goSalary: 200,
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

  toggleSeat(seatIdx: number): void {
    this.session.toggleSeatKind(seatIdx);
  }

  startMatch(): void {
    this.session.startMatchFromLobby();
  }

  leaveRoom(): void {
    this.session.leaveRoom();
    this.hasUrlInvite.set(false);
    this.joinCode = '';
  }
}
