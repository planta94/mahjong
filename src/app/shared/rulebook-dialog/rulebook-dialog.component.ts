import { Component, inject, output } from '@angular/core';
import { GameId } from '../../core/models/party.model';
import { HALF_SPICY_BASE } from '../../core/services/scorer.service';
import { ShellUiService } from '../../core/services/shell-ui.service';
import { PLAYER_COUNT_RATIOS, QUEST_TEAM_SIZES } from '../../games/avalon/data/avalon-config.data';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-rulebook-dialog',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './rulebook-dialog.component.html',
  styleUrl: './rulebook-dialog.component.scss',
})
export class RulebookDialogComponent {
  readonly shellUi = inject(ShellUiService);
  readonly closed = output<void>();

  readonly activeTab = this.shellUi.rulebookGame;

  readonly gameTabs: ReadonlyArray<{ id: GameId; icon: string; labelKey: string }> = [
    { id: 'mahjong', icon: '🀄', labelKey: 'RULEBOOK.TAB_MAHJONG' },
    { id: 'monopoly', icon: '🎲', labelKey: 'RULEBOOK.TAB_MONOPOLY' },
    { id: 'avalon', icon: '🛡️', labelKey: 'RULEBOOK.TAB_AVALON' },
    { id: 'pandemic', icon: '☣️', labelKey: 'RULEBOOK.TAB_PANDEMIC' },
  ];

  readonly payoutRows = [5, 6, 7, 8, 9, 10].map((fan) => ({
    fan,
    base: HALF_SPICY_BASE.at(fan) ?? 1,
  }));

  readonly monopolyScheduleRows = [
    {
      typeKey: 'RULEBOOK.MONOPOLY_ROW_TRANSIT_TYPE',
      countKey: 'RULEBOOK.MONOPOLY_ROW_TRANSIT_COUNT',
      effectKey: 'RULEBOOK.MONOPOLY_ROW_TRANSIT_EFFECT',
    },
    {
      typeKey: 'RULEBOOK.MONOPOLY_ROW_UTILITY_TYPE',
      countKey: 'RULEBOOK.MONOPOLY_ROW_UTILITY_COUNT',
      effectKey: 'RULEBOOK.MONOPOLY_ROW_UTILITY_EFFECT',
    },
    {
      typeKey: 'RULEBOOK.MONOPOLY_ROW_TAX_TYPE',
      countKey: 'RULEBOOK.MONOPOLY_ROW_TAX_COUNT',
      effectKey: 'RULEBOOK.MONOPOLY_ROW_TAX_EFFECT',
    },
  ];

  readonly avalonMatrixRows = [5, 6, 7, 8, 9, 10].map((players) => {
    const ratio = PLAYER_COUNT_RATIOS.get(players) ?? { good: 3, evil: 2 };
    const quests = QUEST_TEAM_SIZES.get(players) ?? [2, 3, 2, 3, 3];
    return {
      players,
      good: ratio.good,
      evil: ratio.evil,
      questsLabel: quests.join(' · '),
      twoFailsOnQ4: players >= 7,
    };
  });

  readonly pandemicRoleRows = [
    { roleKey: 'PANDEMIC.ROLE_MEDIC_NAME', descKey: 'PANDEMIC.ROLE_MEDIC_DESC' },
    { roleKey: 'PANDEMIC.ROLE_SCIENTIST_NAME', descKey: 'PANDEMIC.ROLE_SCIENTIST_DESC' },
    { roleKey: 'PANDEMIC.ROLE_RESEARCHER_NAME', descKey: 'PANDEMIC.ROLE_RESEARCHER_DESC' },
    { roleKey: 'PANDEMIC.ROLE_DISPATCHER_NAME', descKey: 'PANDEMIC.ROLE_DISPATCHER_DESC' },
    {
      roleKey: 'PANDEMIC.ROLE_OPERATIONS_EXPERT_NAME',
      descKey: 'PANDEMIC.ROLE_OPERATIONS_EXPERT_DESC',
    },
    {
      roleKey: 'PANDEMIC.ROLE_QUARANTINE_SPECIALIST_NAME',
      descKey: 'PANDEMIC.ROLE_QUARANTINE_SPECIALIST_DESC',
    },
    {
      roleKey: 'PANDEMIC.ROLE_CONTINGENCY_PLANNER_NAME',
      descKey: 'PANDEMIC.ROLE_CONTINGENCY_PLANNER_DESC',
    },
  ];

  readonly pandemicDifficultyRows = [
    {
      levelKey: 'PANDEMIC.DIFFICULTY_INTRODUCTORY',
      epidemicsKey: 'RULEBOOK.PANDEMIC_DIFF_4_EPI',
      descKey: 'RULEBOOK.PANDEMIC_DIFF_INTRO_DESC',
    },
    {
      levelKey: 'PANDEMIC.DIFFICULTY_STANDARD',
      epidemicsKey: 'RULEBOOK.PANDEMIC_DIFF_5_EPI',
      descKey: 'RULEBOOK.PANDEMIC_DIFF_STD_DESC',
    },
    {
      levelKey: 'PANDEMIC.DIFFICULTY_HEROIC',
      epidemicsKey: 'RULEBOOK.PANDEMIC_DIFF_6_EPI',
      descKey: 'RULEBOOK.PANDEMIC_DIFF_HEROIC_DESC',
    },
  ];

  selectGame(game: GameId): void {
    this.shellUi.playSfx('click');
    this.shellUi.rulebookGame.set(game);
  }

  close(): void {
    this.closed.emit();
  }
}
