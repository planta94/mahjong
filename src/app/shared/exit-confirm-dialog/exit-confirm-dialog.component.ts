import { Component, inject } from '@angular/core';
import { GameSessionManagerService } from '../../core/services/game-session-manager.service';
import { ShellUiService } from '../../core/services/shell-ui.service';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-exit-confirm-dialog',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './exit-confirm-dialog.component.html',
  styleUrl: './exit-confirm-dialog.component.scss',
})
export class ExitConfirmDialogComponent {
  readonly gameManager = inject(GameSessionManagerService);
  private readonly shellUi = inject(ShellUiService);

  stay(): void {
    this.shellUi.playSfx('click');
    this.gameManager.cancelExitConfirm();
  }

  saveAndExit(): void {
    this.shellUi.playSfx('deal');
    this.gameManager.confirmSaveAndExit();
  }

  discardAndExit(): void {
    this.shellUi.playSfx('click');
    this.gameManager.confirmDiscardAndExit();
  }
}
