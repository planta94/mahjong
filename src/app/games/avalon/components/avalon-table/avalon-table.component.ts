import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ShellUiService } from '../../../../core/services/shell-ui.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  getQuestTeamSize,
  getRequiredFails,
  ROLE_METADATA,
  RoleMetadata,
} from '../../data/avalon-config.data';
import {
  AvalonRole,
  NightVisionClue,
  ProposalVote,
  QuestCard,
} from '../../models/avalon.model';
import { AvalonSessionService } from '../../services/avalon-session.service';

@Component({
  selector: 'app-avalon-table',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './avalon-table.component.html',
  styleUrl: './avalon-table.component.scss',
})
export class AvalonTableComponent implements OnInit {
  readonly session = inject(AvalonSessionService);
  readonly shellUi = inject(ShellUiService);
  private readonly router = inject(Router);

  // Local UI state
  readonly selectedTeamSeats = signal<number[]>([]);
  readonly selectedCardToSubmit = signal<QuestCard>('success');
  readonly selectedLadyTarget = signal<number | null>(null);
  readonly selectedAssassinTarget = signal<number | null>(null);
  readonly showHistoryModal = signal<boolean>(false);

  readonly currentView = computed(() => this.session.currentView());
  readonly mySeat = computed(() => this.session.mySeat());

  readonly myRoleMeta = computed<RoleMetadata | null>(() => {
    const role = this.currentView()?.myRole;
    return role ? ROLE_METADATA.get(role) ?? null : null;
  });

  ngOnInit(): void {
    this.shellUi.setActiveGame('avalon');
  }

  getQuestRequiredFails(questNum: number): number {
    const view = this.currentView();
    if (!view) return 1;
    return getRequiredFails(view.numPlayers, questNum);
  }

  getQuestSize(questNum: number): number {
    const view = this.currentView();
    if (!view) return 2;
    return getQuestTeamSize(view.numPlayers, questNum);
  }

  getQuestStatus(questNum: number): 'pending' | 'success' | 'fail' | 'current' {
    const view = this.currentView();
    if (!view) return 'pending';
    const rec = view.questHistory.find((q) => q.questNumber === questNum);
    if (rec) return rec.outcome;
    if (view.currentQuest === questNum && view.phase !== 'game_over') return 'current';
    return 'pending';
  }

  toggleSeatForTeam(seat: number): void {
    const view = this.currentView();
    if (!view || !view.legalActions.canPropose) return;
    const current = this.selectedTeamSeats();
    const req = view.legalActions.requiredTeamSize;

    if (current.includes(seat)) {
      this.selectedTeamSeats.set(current.filter((s) => s !== seat));
    } else {
      if (current.length < req) {
        this.selectedTeamSeats.set([...current, seat].sort((a, b) => a - b));
      }
    }
  }

  proposeSelectedTeam(): void {
    const view = this.currentView();
    if (!view || !view.legalActions.canPropose) return;
    const team = this.selectedTeamSeats();
    if (team.length !== view.legalActions.requiredTeamSize) return;

    this.session.dispatchAction({
      type: 'proposeTeam',
      team,
    });
    this.selectedTeamSeats.set([]);
  }

  castVote(vote: ProposalVote): void {
    this.session.dispatchAction({
      type: 'voteProposal',
      vote,
    });
  }

  openQuestSubmitModal(): void {
    const view = this.currentView();
    if (!view || !view.legalActions.canSubmitQuestCard) return;
    this.selectedCardToSubmit.set('success');
    this.session.showQuestModal.set(true);
  }

  confirmQuestCard(): void {
    const card = this.selectedCardToSubmit();
    this.session.dispatchAction({
      type: 'submitQuestCard',
      card,
    });
    this.session.showQuestModal.set(false);
  }

  openLadyModal(): void {
    const view = this.currentView();
    if (!view || !view.legalActions.canUseLady) return;
    const targets = view.legalActions.eligibleLadyTargets;
    if (targets.length > 0) {
      this.selectedLadyTarget.set(targets.at(0) ?? null);
    }
    this.session.showLadyModal.set(true);
  }

  confirmLadyInvestigation(): void {
    const target = this.selectedLadyTarget();
    if (target === null) return;
    this.session.dispatchAction({
      type: 'useLadyOfLake',
      targetSeat: target,
    });
  }

  closeLadyModal(): void {
    this.session.showLadyModal.set(false);
    this.selectedLadyTarget.set(null);
  }

  openAssassinateModal(): void {
    const view = this.currentView();
    if (!view || !view.legalActions.canAssassinate) return;
    const targets = view.legalActions.eligibleAssassinationTargets;
    if (targets.length > 0) {
      this.selectedAssassinTarget.set(targets.at(0) ?? null);
    }
    this.session.showAssassinationModal.set(true);
  }

  confirmAssassination(): void {
    const target = this.selectedAssassinTarget();
    if (target === null) return;
    this.session.dispatchAction({
      type: 'assassinateMerlin',
      targetSeat: target,
    });
    this.session.showAssassinationModal.set(false);
  }

  returnToLobby(): void {
    this.session.leaveRoom();
    void this.router.navigate(['/avalon/lobby']);
  }

  getClueBadgeText(clue: NightVisionClue | undefined): string {
    switch (clue) {
      case 'evil':
        return '👿 Evil';
      case 'evil_ally':
        return '🤝 Evil Ally';
      case 'merlin_or_morgana':
        return '🔮 Merlin / Morgana';
      case 'self':
        return '👤 You';
      default:
        return '❓ Unknown';
    }
  }

  getClueBadgeClass(clue: NightVisionClue | undefined): string {
    switch (clue) {
      case 'evil':
      case 'evil_ally':
        return 'clue-evil';
      case 'merlin_or_morgana':
        return 'clue-merlin';
      case 'self':
        return 'clue-self';
      default:
        return 'clue-unknown';
    }
  }

  getPlayerRoleName(role: AvalonRole | null | undefined): string {
    if (!role) return '???';
    const meta = ROLE_METADATA.get(role);
    return meta?.nameKey ?? role;
  }

  getPlayerName(seatIdx: number): string {
    const p = this.currentView()?.players.find((pl) => pl.seat === seatIdx);
    return p?.name ?? `Seat ${seatIdx + 1}`;
  }

  formatTeamNames(seats: readonly number[]): string {
    return seats.map((s) => this.getPlayerName(s)).join(', ');
  }

  getVoteValue(record: { votes: Map<number, ProposalVote> }, seatIdx: number): ProposalVote | null {
    return record.votes.get(seatIdx) ?? null;
  }
}
