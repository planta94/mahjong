import { Component, computed, input } from '@angular/core';
import { tileCode, tileSpec } from '../../core/utils/tiles.util';

type DotPip = readonly [number, number, number, string];
type BambooStick = readonly [number, number, number, number, string];

const DOT_COORDS_MAP: ReadonlyMap<number, readonly DotPip[]> = new Map<number, readonly DotPip[]>([
  [1, [[20, 26, 9.5, '#c81e1e']]],
  [2, [[20, 15, 6, '#15803d'], [20, 37, 6, '#1e3a8a']]],
  [3, [[12, 13, 5.2, '#1e3a8a'], [20, 26, 5.2, '#c81e1e'], [28, 39, 5.2, '#15803d']]],
  [4, [[13, 15, 5.4, '#1e3a8a'], [27, 15, 5.4, '#15803d'], [13, 37, 5.4, '#15803d'], [27, 37, 5.4, '#1e3a8a']]],
  [5, [[12, 14, 4.8, '#1e3a8a'], [28, 14, 4.8, '#15803d'], [20, 26, 5, '#c81e1e'], [12, 38, 4.8, '#15803d'], [28, 38, 4.8, '#1e3a8a']]],
  [6, [[13, 13, 4.8, '#15803d'], [27, 13, 4.8, '#15803d'], [13, 27, 4.8, '#c81e1e'], [27, 27, 4.8, '#c81e1e'], [13, 39, 4.8, '#c81e1e'], [27, 39, 4.8, '#c81e1e']]],
  [7, [[11, 11, 4.2, '#15803d'], [20, 15, 4.2, '#15803d'], [29, 19, 4.2, '#15803d'], [13, 30, 4.5, '#c81e1e'], [27, 30, 4.5, '#c81e1e'], [13, 41, 4.5, '#c81e1e'], [27, 41, 4.5, '#c81e1e']]],
  [8, [[13, 10, 4.1, '#1e3a8a'], [27, 10, 4.1, '#1e3a8a'], [13, 21, 4.1, '#1e3a8a'], [27, 21, 4.1, '#1e3a8a'], [13, 32, 4.1, '#1e3a8a'], [27, 32, 4.1, '#1e3a8a'], [13, 42, 4.1, '#1e3a8a'], [27, 42, 4.1, '#1e3a8a']]],
  [9, [[10, 12, 4, '#1e3a8a'], [20, 12, 4, '#1e3a8a'], [30, 12, 4, '#1e3a8a'], [10, 26, 4, '#c81e1e'], [20, 26, 4, '#c81e1e'], [30, 26, 4, '#c81e1e'], [10, 40, 4, '#15803d'], [20, 40, 4, '#15803d'], [30, 40, 4, '#15803d']]],
]);

const BAMBOO_STICKS_MAP: ReadonlyMap<number, readonly BambooStick[]> = new Map<
  number,
  readonly BambooStick[]
>([
  [2, [[18, 9, 4, 14, '#1e3a8a'], [18, 29, 4, 14, '#15803d']]],
  [3, [[18, 7, 4, 13, '#1e3a8a'], [11, 28, 4, 14, '#15803d'], [25, 28, 4, 14, '#15803d']]],
  [4, [[12, 9, 4, 14, '#1e3a8a'], [24, 9, 4, 14, '#15803d'], [12, 29, 4, 14, '#15803d'], [24, 29, 4, 14, '#1e3a8a']]],
  [5, [[10, 9, 3.8, 14, '#15803d'], [26, 9, 3.8, 14, '#1e3a8a'], [18, 19, 3.8, 14, '#c81e1e'], [10, 29, 3.8, 14, '#1e3a8a'], [26, 29, 3.8, 14, '#15803d']]],
  [6, [[10, 9, 3.8, 14, '#15803d'], [18, 9, 3.8, 14, '#15803d'], [26, 9, 3.8, 14, '#15803d'], [10, 29, 3.8, 14, '#1e3a8a'], [18, 29, 3.8, 14, '#1e3a8a'], [26, 29, 3.8, 14, '#1e3a8a']]],
  [7, [[18, 5, 3.8, 11, '#c81e1e'], [10, 19, 3.6, 12, '#15803d'], [18, 19, 3.6, 12, '#1e3a8a'], [26, 19, 3.6, 12, '#15803d'], [10, 34, 3.6, 12, '#15803d'], [18, 34, 3.6, 12, '#1e3a8a'], [26, 34, 3.6, 12, '#15803d']]],
  [8, [[9, 8, 3.5, 13, '#15803d'], [16, 8, 3.5, 13, '#15803d'], [23, 8, 3.5, 13, '#15803d'], [30, 8, 3.5, 13, '#15803d'], [9, 29, 3.5, 13, '#1e3a8a'], [16, 29, 3.5, 13, '#1e3a8a'], [23, 29, 3.5, 13, '#1e3a8a'], [30, 29, 3.5, 13, '#1e3a8a']]],
  [9, [[9, 6, 3.6, 11, '#1e3a8a'], [18, 6, 3.6, 11, '#c81e1e'], [27, 6, 3.6, 11, '#15803d'], [9, 20, 3.6, 11, '#1e3a8a'], [18, 20, 3.6, 11, '#c81e1e'], [27, 20, 3.6, 11, '#15803d'], [9, 34, 3.6, 11, '#1e3a8a'], [18, 34, 3.6, 11, '#c81e1e'], [27, 34, 3.6, 11, '#15803d']]],
]);

@Component({
  selector: 'mj-tile',
  standalone: true,
  templateUrl: './tile.component.html',
  styleUrl: './tile.component.scss',
})
export class TileComponent {
  readonly tile = input.required<string>();
  readonly size = input<'' | 'sm' | 'xs'>('');
  readonly clickable = input<boolean>(false);
  readonly highlight = input<boolean>(false);
  readonly drawnGap = input<boolean>(false);

  readonly spec = computed(() => {
    const t = this.tile();
    return t === 'back' ? null : tileSpec(tileCode(t));
  });

  readonly dotPips = computed<readonly DotPip[]>(() => {
    const s = this.spec();
    return s?.suit === 'p' && s.num ? (DOT_COORDS_MAP.get(s.num) ?? []) : [];
  });

  readonly bambooSticks = computed<readonly BambooStick[]>(() => {
    const s = this.spec();
    return s?.suit === 's' && s.num && s.num >= 2 ? (BAMBOO_STICKS_MAP.get(s.num) ?? []) : [];
  });
}
