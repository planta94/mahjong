import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GameSessionManagerService } from './core/services/game-session-manager.service';
import { ShellUiService } from './core/services/shell-ui.service';
import { AppHeaderComponent } from './layout/header/app-header.component';
import { ExitConfirmDialogComponent } from './shared/exit-confirm-dialog/exit-confirm-dialog.component';
import { RulebookDialogComponent } from './shared/rulebook-dialog/rulebook-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent, RulebookDialogComponent, ExitConfirmDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly shellUi = inject(ShellUiService);
  readonly gameManager = inject(GameSessionManagerService);
}
