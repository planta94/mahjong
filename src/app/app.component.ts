import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MahjongSessionService } from './core/services/mahjong-session.service';
import { AppHeaderComponent } from './layout/header/app-header.component';
import { RulebookDialogComponent } from './shared/rulebook-dialog/rulebook-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent, RulebookDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly session = inject(MahjongSessionService);
}
