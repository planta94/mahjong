import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../pipes/translate.pipe';

const PIP_LAYOUT_MAP: ReadonlyMap<number, readonly number[]> = new Map<number, readonly number[]>([
  [1, [4]],
  [2, [2, 6]],
  [3, [2, 4, 6]],
  [4, [0, 2, 6, 8]],
  [5, [0, 2, 4, 6, 8]],
  [6, [0, 2, 3, 5, 6, 8]],
]);

const NINE_CELLS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

@Component({
  selector: 'app-real-dice',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './real-dice.component.html',
  styleUrl: './real-dice.component.scss',
})
export class RealDiceComponent {
  readonly values = input<readonly [number, number]>([1, 1]);
  readonly rolling = input<boolean>(false);
  readonly compact = input<boolean>(false);

  readonly cells = NINE_CELLS;

  readonly dieOne = computed<number>(() => this.clampFace(this.values().at(0) ?? 1));
  readonly dieTwo = computed<number>(() => this.clampFace(this.values().at(1) ?? 1));
  readonly diceSum = computed<number>(() => this.dieOne() + this.dieTwo());
  readonly isDoubles = computed<boolean>(() => this.dieOne() === this.dieTwo());

  hasPip(face: number, cellIdx: number): boolean {
    const activeCells = PIP_LAYOUT_MAP.get(this.clampFace(face)) ?? [4];
    return activeCells.includes(cellIdx);
  }

  isRedFace(face: number): boolean {
    const clamped = this.clampFace(face);
    return clamped === 1 || clamped === 4;
  }

  private clampFace(val: number): number {
    if (!Number.isFinite(val)) return 1;
    return Math.max(1, Math.min(6, Math.round(val)));
  }
}
