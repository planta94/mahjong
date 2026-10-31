import { Component, effect, inject } from '@angular/core';
import { SupportedLang } from '../../core/models/mahjong.model';
import { GameSessionManagerService } from '../../core/services/game-session-manager.service';
import { ShellUiService } from '../../core/services/shell-ui.service';
import { TranslateService } from '../../core/services/translate.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
})
export class AppHeaderComponent {
  readonly shellUi = inject(ShellUiService);
  readonly translate = inject(TranslateService);
  readonly gameManager = inject(GameSessionManagerService);

  readonly languages: ReadonlyArray<{ code: SupportedLang; label: string }> = [
    { code: 'zh', label: '简中' },
    { code: 'en', label: 'EN' },
  ];

  constructor() {
    effect(() => {
      // Track both active game and active language to keep document.title synchronized
      const game = this.shellUi.activeGame();
      this.translate.currentLang();
      const brand = this.translate.instant('HEADER.BRAND');
      if (typeof document !== 'undefined') {
        if (game === 'mahjong') {
          document.title = `${this.translate.instant('HEADER.GAME_TITLE_MAHJONG')} · ${brand}`;
        } else if (game === 'monopoly') {
          document.title = `${this.translate.instant('HEADER.GAME_TITLE_MONOPOLY')} · ${brand}`;
        } else if (game === 'avalon') {
          document.title = `${this.translate.instant('HEADER.GAME_TITLE_AVALON')} · ${brand}`;
        } else {
          document.title = brand;
        }
      }
    });
  }

  setLang(lang: SupportedLang): void {
    this.translate.use(lang);
  }

  switchToHub(): void {
    this.shellUi.playSfx('click');
    this.gameManager.requestGoHome();
  }

  onBrandClick(): void {
    if (this.shellUi.activeGame() !== 'hub') {
      this.switchToHub();
    }
  }
}
