import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ShellUiService } from '../../core/services/shell-ui.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-game-placeholder',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="placeholder-container">
      <div class="placeholder-card">
        <h2 class="placeholder-title">{{ gameName }}</h2>
        <p class="placeholder-desc">
          {{ 'HUB.DEV_NOTICE' | translate }}
        </p>
        <button type="button" class="btn-back" (click)="returnToHub()">
          {{ 'HEADER.SWITCH_GAME' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .placeholder-container {
        min-height: calc(100vh - 64px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .placeholder-card {
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 32px;
        text-align: center;
        max-width: 480px;
        width: 100%;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
      }
      .placeholder-title {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 12px;
        color: #f0f6fc;
      }
      .placeholder-desc {
        color: #8b949e;
        margin-bottom: 24px;
        line-height: 1.5;
      }
      .btn-back {
        padding: 10px 20px;
        background: #238636;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .btn-back:hover {
        background: #2ea043;
      }
    `,
  ],
})
export class GamePlaceholderComponent implements OnInit {
  private readonly shellUi = inject(ShellUiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  gameName = 'Game Pavilion';

  ngOnInit(): void {
    const routePath = this.route.snapshot.pathFromRoot
      .map((s) => s.url.map((u) => u.path).join('/'))
      .filter(Boolean)
      .join('/');
    const fullUrl = `${this.router.url}/${routePath}`;

    if (fullUrl.includes('monopoly')) {
      this.shellUi.setActiveGame('monopoly');
      this.gameName = 'Malaysia Landmarks Monopoly (大馬地標大富翁)';
    } else if (fullUrl.includes('avalon')) {
      this.shellUi.setActiveGame('avalon');
      this.gameName = 'The Resistance: Avalon (阿瓦隆)';
    }
  }

  returnToHub(): void {
    void this.router.navigate(['/']);
  }
}
