import { Component, computed, inject } from '@angular/core';
import { SupportedLang } from '../../core/models/mahjong.model';
import { MahjongSessionService } from '../../core/services/mahjong-session.service';
import { DEFAULT_RULES } from '../../core/services/scorer.service';
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
  readonly session = inject(MahjongSessionService);
  readonly translate = inject(TranslateService);

  readonly languages: ReadonlyArray<{ code: SupportedLang; label: string }> = [
    { code: 'zh', label: '繁中' },
    { code: 'en', label: 'EN' },
    { code: 'ms', label: 'BM' },
  ];

  readonly activeRules = computed(() => {
    return this.session.snapshot()?.lobby?.rules ?? DEFAULT_RULES;
  });

  setLang(lang: SupportedLang): void {
    this.translate.use(lang);
  }
}
