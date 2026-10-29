import { Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerPublicState } from '../../core/models/mahjong.model';
import { MahjongSessionService } from '../../core/services/mahjong-session.service';
import { tileSpec, windLabel } from '../../core/utils/tiles.util';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TileComponent } from '../../shared/tile/tile.component';

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
      void this.router.navigate(['/lobby']);
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

  onDiscardClick(tileId: string): void {
    const legal = this.session.snapshot()?.view?.legalActions;
    if (legal?.phase === 'turn' && legal.canDiscard) {
      this.session.sendAction({ type: 'discard', tileId });
    }
  }

  tileName(code: string): string {
    return tileSpec(code).name;
  }

  chowLabel(codes: readonly string[]): string {
    return codes.map((c) => this.tileName(c)).join('');
  }

  backPlaceholders(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i);
  }

  isLastPoolDiscard(tileId: string, dIdx: number, totalLen: number): boolean {
    const ld = this.session.snapshot()?.view?.lastDiscard;
    return Boolean(ld && ld.tileId === tileId && dIdx === totalLen - 1);
  }
}
