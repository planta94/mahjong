import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ShellUiService } from '../../../../core/services/shell-ui.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ALL_SPECIALIST_ROLES, ROLE_SPEC_MAP } from '../../data/pandemic-roles-events.data';
import {
  DifficultyLevel,
  PandemicLobbySettings,
  SpecialistRole,
} from '../../models/pandemic.model';
import { PandemicSessionService } from '../../services/pandemic-session.service';

@Component({
  selector: 'app-pandemic-lobby',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './pandemic-lobby.component.html',
  styleUrl: './pandemic-lobby.component.scss',
})
export class PandemicLobbyComponent implements OnInit {
  readonly session = inject(PandemicSessionService);
  readonly shellUi = inject(ShellUiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly availableRoles = ALL_SPECIALIST_ROLES;
  readonly roleSpecMap = ROLE_SPEC_MAP;

  playerCount = 4;
  difficulty: DifficultyLevel = 'standard';
  soloCommander = false;
  seatRoles: (SpecialistRole | 'random')[] = ['random', 'random', 'random', 'random'];

  joinCode = '';
  readonly hasUrlInvite = signal<boolean>(false);

  ngOnInit(): void {
    this.shellUi.setActiveGame('pandemic');

    const sub = this.route.queryParamMap.subscribe((params) => {
      const room = params.get('room');
      if (room && !this.session.snapshot()) {
        this.joinCode = room.toUpperCase();
        this.hasUrlInvite.set(true);
      }
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  getLobbySettings(): PandemicLobbySettings {
    const rolesSlice = this.seatRoles.slice(0, this.playerCount);
    const assignedRoles: SpecialistRole[] = [];
    for (const r of rolesSlice) {
      if (r !== 'random') {
        assignedRoles.push(r);
      }
    }

    return {
      difficulty: this.difficulty,
      numPlayers: this.playerCount,
      roles: assignedRoles.length > 0 ? assignedRoles : undefined,
      soloCommander: this.soloCommander,
    };
  }

  onRoleChange(seatIdx: number, role: SpecialistRole | 'random'): void {
    if (seatIdx >= 0 && seatIdx < this.seatRoles.length) {
      this.seatRoles.splice(seatIdx, 1, role);
    }
  }

  startSolo(): void {
    this.session.createSoloMatch(this.playerCount, this.getLobbySettings());
  }

  startSoloCommander(): void {
    this.session.createSoloCommanderMatch(this.playerCount, {
      ...this.getLobbySettings(),
      soloCommander: true,
    });
  }

  createRoom(): void {
    this.session.createMultiplayerRoom(this.playerCount, this.getLobbySettings());
  }

  joinRoom(): void {
    if (!this.joinCode.trim()) return;
    this.session.joinMultiplayerRoom(this.joinCode.trim().toUpperCase());
  }

  toggleSeat(seatIdx: number): void {
    this.session.toggleSeatKind(seatIdx);
  }

  setSeatRole(seatIdx: number, role: SpecialistRole | 'random'): void {
    this.session.setSeatRole(seatIdx, role);
  }

  setDifficulty(diff: DifficultyLevel): void {
    this.session.setDifficulty(diff);
  }

  startMatch(): void {
    this.session.startMatchFromLobby();
  }

  leaveRoom(): void {
    this.session.leaveRoom();
    this.hasUrlInvite.set(false);
    this.joinCode = '';
  }

  getRoleColor(role?: SpecialistRole | 'random'): string {
    if (!role || role === 'random') return '#64748b';
    return this.roleSpecMap.get(role)?.badgeColor ?? '#38bdf8';
  }

  getRoleNameKey(role?: SpecialistRole | 'random'): string {
    if (!role || role === 'random') return 'PANDEMIC.ROLE_RANDOM';
    return this.roleSpecMap.get(role)?.nameKey ?? 'PANDEMIC.ROLE_RANDOM';
  }

  getDifficultyKey(diff?: DifficultyLevel): string {
    if (!diff) return 'PANDEMIC.DIFF_STANDARD';
    if (diff === 'introductory') return 'PANDEMIC.DIFF_INTRODUCTORY';
    if (diff === 'heroic') return 'PANDEMIC.DIFF_HEROIC';
    return 'PANDEMIC.DIFF_STANDARD';
  }
}
