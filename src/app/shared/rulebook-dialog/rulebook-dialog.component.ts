import { Component, output } from '@angular/core';
import { HALF_SPICY_BASE } from '../../core/services/scorer.service';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-rulebook-dialog',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './rulebook-dialog.component.html',
  styleUrl: './rulebook-dialog.component.scss',
})
export class RulebookDialogComponent {
  readonly closed = output<void>();

  readonly payoutRows = [5, 6, 7, 8, 9, 10].map((fan) => ({
    fan,
    base: HALF_SPICY_BASE.at(fan) ?? 1,
  }));

  close(): void {
    this.closed.emit();
  }
}
