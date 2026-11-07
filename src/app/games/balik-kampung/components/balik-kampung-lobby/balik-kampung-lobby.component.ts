import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { clearBrowserUrlRoom } from '../../../../core/services/p2p-room.transport';
import { ShellUiService } from '../../../../core/services/shell-ui.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  CAR_PERSONAS,
  CAR_PERSONA_MAP,
  CarPersonaMeta,
  getBotDriverKey,
} from '../../data/balik-kampung-cards.data';
import { CarPersonaId, DrivetrainType } from '../../models/balik-kampung.model';
import { BalikKampungSessionService } from '../../services/balik-kampung-session.service';

@Component({
  selector: 'app-balik-kampung-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './balik-kampung-lobby.component.html',
  styleUrl: './balik-kampung-lobby.component.scss',
})
export class BalikKampungLobbyComponent implements OnInit {
  readonly session = inject(BalikKampungSessionService);
  readonly shellUi = inject(ShellUiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly playerCounts: readonly number[] = [2, 3, 4, 5];
  readonly personas = CAR_PERSONAS;

  playerCount = 3;
  soloPersonas: CarPersonaId[] = CAR_PERSONAS.map((p) => p.id);
  soloDrivetrains: DrivetrainType[] = CAR_PERSONAS.map((p) => p.defaultDrivetrain);
  joinCode = '';
  readonly hasUrlInvite = signal<boolean>(false);

  ngOnInit(): void {
    this.shellUi.setActiveGame('balik-kampung');

    const sub = this.route.queryParamMap.subscribe((params) => {
      const room = params.get('room');
      if (room && !this.session.snapshot()) {
        this.joinCode = room.toUpperCase();
        this.hasUrlInvite.set(true);
      }
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  get visibleSoloPersonas(): readonly CarPersonaMeta[] {
    return this.soloPersonas
      .slice(0, this.playerCount)
      .map((id) => this.getPersonaMeta(id));
  }

  setPlayerCount(count: number): void {
    this.playerCount = count;
    this.shellUi.playSfx('click');
  }

  getSoloPersona(idx: number): CarPersonaId {
    return this.soloPersonas.at(idx) ?? 'red';
  }

  setSoloPersona(idx: number, persona: CarPersonaId): void {
    if (idx < 0 || idx >= this.soloPersonas.length) return;
    const current = this.soloPersonas.at(idx);
    if (!current || current === persona) return;

    const otherIdx = this.soloPersonas.findIndex((p, i) => i !== idx && p === persona);
    this.soloPersonas.splice(idx, 1, persona);
    this.soloDrivetrains.splice(idx, 1, this.getPersonaMeta(persona).defaultDrivetrain);

    if (otherIdx !== -1) {
      this.soloPersonas.splice(otherIdx, 1, current);
      this.soloDrivetrains.splice(otherIdx, 1, this.getPersonaMeta(current).defaultDrivetrain);
    }
    this.shellUi.playSfx('click');
  }

  getSoloDrivetrain(idx: number): DrivetrainType {
    return this.soloDrivetrains.at(idx) ?? 'ICE';
  }

  setSoloDrivetrain(idx: number, dt: DrivetrainType): void {
    if (idx >= 0 && idx < this.soloDrivetrains.length) {
      this.soloDrivetrains.splice(idx, 1, dt);
      this.shellUi.playSfx('click');
    }
  }

  getPersonaMeta(id: CarPersonaId): CarPersonaMeta {
    return CAR_PERSONA_MAP.get(id) ?? CAR_PERSONAS[0];
  }

  getSoloBotKey(idx: number): string {
    return getBotDriverKey(Math.max(0, idx - 1));
  }

  startSolo(): void {
    this.session.createSoloMatch(
      this.playerCount,
      this.soloDrivetrains.slice(0, this.playerCount),
      this.soloPersonas.slice(0, this.playerCount)
    );
  }

  createRoom(): void {
    this.session.createMultiplayerRoom(
      this.playerCount,
      undefined,
      this.soloPersonas.slice(0, this.playerCount),
      this.soloDrivetrains.slice(0, this.playerCount)
    );
  }

  joinRoom(): void {
    const clean = this.joinCode.trim().toUpperCase();
    if (!clean) {
      this.shellUi.playSfx('fail');
      return;
    }
    this.session.joinMultiplayerRoom(clean);
  }

  setRoomSeatCount(count: number): void {
    this.session.setLobbySeatCount(count);
  }

  toggleRoomSeatKind(seatIdx: number): void {
    this.session.toggleSeatKind(seatIdx);
  }

  setRoomSeatDrivetrain(seatIdx: number, dt: DrivetrainType): void {
    this.session.setSeatDrivetrain(seatIdx, dt);
  }

  setRoomSeatPersona(seatIdx: number, persona: CarPersonaId): void {
    this.session.setSeatPersona(seatIdx, persona);
  }

  canEditRoomSeatDrivetrain(seatIdx: number): boolean {
    if (this.session.isHost()) return true;
    return this.session.mySeat() === seatIdx;
  }

  startOnlineMatch(): void {
    this.session.startMatchFromLobby();
  }

  leaveWaitingRoom(): void {
    this.session.leaveRoom();
    this.shellUi.setActiveRoomCode(null);
    clearBrowserUrlRoom();
    this.hasUrlInvite.set(false);
    this.joinCode = '';
  }

  openRules(): void {
    this.shellUi.playSfx('click');
    this.shellUi.openRulebook('balik-kampung');
  }
}
