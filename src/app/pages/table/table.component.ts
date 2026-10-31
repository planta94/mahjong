import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Meld, PlayerPublicState } from '../../core/models/mahjong.model';
import { MahjongSessionService } from '../../core/services/mahjong-session.service';
import { tileSpec, windLabel } from '../../core/utils/tiles.util';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TileComponent } from '../../shared/tile/tile.component';

export type SelectionMode = 'chow' | 'pong' | 'kong' | 'exposeFly' | 'retrieveFly';

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [TileComponent, TranslatePipe],
  templateUrl: './table.component.html',
  styleUrl: './table.component.scss',
})
export class TableComponent implements OnInit {
  readonly session = inject(MahjongSessionService);
  private readonly router = inject(Router);

  readonly selectionMode = signal<SelectionMode | null>(null);
  readonly selectedTileIds = signal<string[]>([]);
  private lastContextKey = '';

  constructor() {
    effect(() => {
      const view = this.session.snapshot()?.view;
      const legal = view?.legalActions;
      const claimTile =
        legal && (legal.phase === 'claim' || legal.phase === 'robKong') ? legal.tileId : '';
      const key = view ? `${view.handNumber}|${view.phase}|${view.turnSeat}|${claimTile}` : 'none';
      if (key !== this.lastContextKey) {
        this.lastContextKey = key;
        this.selectionMode.set(null);
        this.selectedTileIds.set([]);
        this.session.selectionPaused.set(false);
      }
    });
  }

  readonly seatLayout = computed(() => {
    const view = this.session.snapshot()?.view;
    if (!view) return null;
    const me = view.viewerSeat;
    const n = view.numSeats;
    return {
      me,
      right: (me + 1) % n,
      top: n === 4 ? (me + 2) % 4 : null,
      left: n === 4 ? (me + 3) % 4 : (me + 2) % 3,
    };
  });

  readonly discardPool = computed<readonly string[]>(() => {
    const view = this.session.snapshot()?.view;
    if (!view) return [];
    return view.discardPool?.length ? view.discardPool : view.players.flatMap((p) => p.discards);
  });

  readonly myRack = computed<{ main: string[]; drawn: string | null }>(() => {
    const view = this.session.snapshot()?.view;
    if (!view) return { main: [], drawn: null };
    const me = view.players.at(view.viewerSeat);
    const list = [...(me?.hand ?? [])];
    let drawn: string | null = null;
    if (me?.lastDrawnId && list.length % 3 === 2) {
      const idx = list.lastIndexOf(me.lastDrawnId);
      if (idx !== -1) {
        drawn = list.splice(idx, 1).at(0) ?? null;
      }
    }
    return { main: list, drawn };
  });

  ngOnInit(): void {
    if (!this.session.snapshot()?.view) {
      void this.router.navigate(['/lobby'], { queryParamsHandling: 'preserve' });
    }
  }

  playerAt(seatIdx: number): PlayerPublicState | null {
    return this.session.snapshot()?.view?.players.at(seatIdx) ?? null;
  }

  seatName(seatIdx: number | null): string {
    if (seatIdx === null || seatIdx < 0) return '';
    return this.session.snapshot()?.lobby?.seats.at(seatIdx)?.name ?? '';
  }

  seatScore(seatIdx: number): number {
    return this.session.snapshot()?.view?.scores.at(seatIdx) ?? 0;
  }

  seatDelta(seatIdx: number): number {
    return this.session.snapshot()?.view?.result?.deltas.at(seatIdx) ?? 0;
  }

  windAt(windIdx: number): string {
    return windLabel(windIdx);
  }

  latestLog(): string {
    return this.session.snapshot()?.view?.log.at(-1) ?? '';
  }

  meldTiles(m: Meld): readonly string[] {
    return m.tileIds ?? m.codes;
  }

  startSelection(mode: SelectionMode): void {
    if (this.selectionMode() === mode) {
      this.cancelSelection();
      return;
    }
    this.selectionMode.set(mode);
    this.selectedTileIds.set([]);
    this.session.selectionPaused.set(true);
    this.session.playClack(700);
  }

  cancelSelection(): void {
    this.selectionMode.set(null);
    this.selectedTileIds.set([]);
    this.session.selectionPaused.set(false);
  }

  confirmSelection(): void {
    const mode = this.selectionMode();
    const tileIds = [...this.selectedTileIds()];
    this.cancelSelection();
    if (!mode) return;
    this.session.sendAction({ type: mode, tileIds });
  }

  declareWin(): void {
    this.cancelSelection();
    this.session.sendAction({ type: 'win' });
  }

  passClaim(): void {
    this.cancelSelection();
    this.session.sendAction({ type: 'pass' });
  }

  onToggleAutoPass(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) {
      this.session.toggleAutoPass(target.checked);
    }
  }

  isTileSelected(tileId: string): boolean {
    return this.selectedTileIds().includes(tileId);
  }

  onHandTileClick(tileId: string): void {
    if (this.selectionMode() !== null) {
      const cur = this.selectedTileIds();
      this.selectedTileIds.set(
        cur.includes(tileId) ? cur.filter((id) => id !== tileId) : [...cur, tileId]
      );
      this.session.playClack(680);
      return;
    }

    const legal = this.session.snapshot()?.view?.legalActions;
    if (legal?.phase === 'turn' && legal.canDiscard) {
      this.session.sendAction({ type: 'discard', tileId });
    }
  }

  tileName(code: string): string {
    return tileSpec(code).name;
  }

  backPlaceholders(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i);
  }

  isLastPoolDiscard(tileId: string, dIdx: number, totalLen: number): boolean {
    const ld = this.session.snapshot()?.view?.lastDiscard;
    return Boolean(ld && ld.tileId === tileId && dIdx === totalLen - 1);
  }
}
