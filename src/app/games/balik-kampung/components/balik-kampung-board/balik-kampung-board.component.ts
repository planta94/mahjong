import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '../../../../core/services/translate.service';
import { ShellUiService } from '../../../../core/services/shell-ui.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  ACTION_CARD_MAP,
  ACTION_CARD_META_LIST,
  ActionCardMeta,
  ARRIVAL_BONUS_BY_RANK,
  CAR_PERSONAS,
  CAR_PERSONA_MAP,
  CarPersonaMeta,
} from '../../data/balik-kampung-cards.data';
import {
  ActionCardId,
  ActiveRoadCard,
  BalikKampungLogEntry,
  BalikKampungMoveTrace,
  BalikKampungPublicPlayer,
  CarPersonaId,
  ReachableMoveOption,
  RoadCorridor,
  SimpangCorridor,
  SpaceFeature,
  StandardCorridor,
  TrackPosition,
} from '../../models/balik-kampung.model';
import {
  BalikKampungEngineService,
  sameTrackPos,
} from '../../services/balik-kampung-engine.service';
import { BalikKampungSessionService } from '../../services/balik-kampung-session.service';

const STEP_ANIMATION_MS = 175;
const LANDING_HOLD_MS = 100;

const CLEANUP_ALERT_LOG_KEYS: ReadonlySet<string> = new Set([
  'BK.LOG_BLADDER_3_STRESS',
  'BK.LOG_BLADDER_RUPTURE',
  'BK.LOG_STRESS_MELTDOWN',
  'BK.LOG_SIMPANG_REVEALED',
  'BK.LOG_RNR_BANNED',
]);

export interface ConvoyCeremonyItem {
  readonly orderNum: number;
  readonly seat: number;
  readonly name: string;
  readonly persona: CarPersonaId;
  readonly revealedCard: ActionCardId | null;
  readonly revealedFuelDump: boolean;
  readonly skippedThisRound: boolean;
  readonly status: 'DRIVING' | 'DONE' | 'QUEUED';
}

@Component({
  selector: 'app-balik-kampung-board',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './balik-kampung-board.component.html',
  styleUrl: './balik-kampung-board.component.scss',
})
export class BalikKampungBoardComponent implements OnInit {
  readonly session = inject(BalikKampungSessionService);
  readonly shellUi = inject(ShellUiService);
  private readonly engine = inject(BalikKampungEngineService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('trackScroller') trackScroller?: ElementRef<HTMLElement>;

  readonly allCardMeta = ACTION_CARD_META_LIST;
  readonly standardSlots: readonly number[] = [0, 1];
  readonly kuburSlots: readonly number[] = [0, 1];
  readonly bendangSlots: readonly number[] = [0, 1, 2];
  readonly utamaSlots: readonly number[] = [0, 1, 2, 3];
  readonly bladderSegments: readonly number[] = [1, 2, 3, 4];
  readonly stressSegments: readonly number[] = [1, 2, 3, 4, 5, 6];

  readonly selectedPreviewCardId = signal<ActionCardId | null>(null);
  readonly hoveredOptionId = signal<string | null>(null);
  readonly activeHudWidget = signal<'NONE' | 'STANDINGS' | 'RADIO'>('NONE');
  readonly trackPanOffset = signal<number>(0);

  // Step-by-step car driving animation state
  readonly animatedCarPositions = signal<ReadonlyMap<number, TrackPosition>>(new Map());
  readonly movingSeat = signal<number | null>(null);
  private animQueue: BalikKampungMoveTrace[] = [];
  private animTimer: ReturnType<typeof setTimeout> | undefined;
  private lastProcessedMoveSeq = -1;
  private lastObservedRound = -1;
  private lastObservedPhase = '';

  readonly effectivePreviewCardId = computed<ActionCardId | null>(() => {
    const view = this.session.currentView();
    const me = this.session.myPlayer();
    if (
      !view ||
      !me ||
      view.phase !== 'PLANNING' ||
      me.skippedThisRound ||
      me.pos.lane === 'FINISH'
    ) {
      return null;
    }
    if (me.hasLockedPlan) {
      return me.myPlannedCard;
    }
    const manual = this.selectedPreviewCardId();
    if (manual !== null && view.playableCards.includes(manual)) {
      return manual;
    }
    return view.playableCards.at(0) ?? null;
  });

  readonly planningPreviewOptions = computed<ReachableMoveOption[]>(() => {
    const view = this.session.currentView();
    const me = this.session.myPlayer();
    const cardId = this.effectivePreviewCardId();
    if (!view || !me || view.phase !== 'PLANNING' || cardId === null) {
      return [];
    }
    const useFuel = me.hasLockedPlan
      ? me.myPlannedFuelDump
      : this.session.pendingFuelDump();
    return this.engine.previewCardOptionsFromView(view, me.seat, cardId, useFuel);
  });

  readonly previewScoutOptions = computed<ReachableMoveOption[]>(() =>
    this.planningPreviewOptions().filter((opt) => opt.isScoutFrontier)
  );

  readonly hasPreviewScoutColumn = computed(
    () => !this.hasScoutFrontierColumn() && this.previewScoutOptions().length > 0
  );

  readonly activeTrailOption = computed<ReachableMoveOption | null>(() => {
    const view = this.session.currentView();
    if (!view) return null;
    const hoveredId = this.hoveredOptionId();

    if (view.phase === 'RESOLVING' && this.session.isMyResolutionTurn()) {
      if (hoveredId !== null) {
        const hit = view.reachableOptions.find((o) => o.optionId === hoveredId);
        if (hit) return hit;
      }
      return view.reachableOptions.at(0) ?? null;
    }

    if (view.phase === 'PLANNING') {
      const opts = this.planningPreviewOptions();
      if (hoveredId !== null) {
        const hit = opts.find((o) => o.optionId === hoveredId);
        if (hit) return hit;
      }
      return opts.at(0) ?? null;
    }

    return null;
  });

  readonly scoutFrontierOptions = computed<ReachableMoveOption[]>(() => {
    const view = this.session.currentView();
    if (!view || !this.session.isMyResolutionTurn() || view.phase !== 'RESOLVING') {
      return [];
    }
    return view.reachableOptions.filter((opt) => opt.isScoutFrontier);
  });

  readonly hasScoutFrontierColumn = computed(() => this.scoutFrontierOptions().length > 0);

  readonly maxVisibleRoadCards = computed<number>(() => {
    const extraCol =
      this.hasScoutFrontierColumn() || this.hasPreviewScoutColumn() ? 1 : 0;
    return Math.max(3, 5 - extraCol);
  });

  readonly baseTrackStartIndex = computed<number>(() => {
    const view = this.session.currentView();
    if (!view) return 0;
    const track = view.visibleTrack;
    const maxCards = this.maxVisibleRoadCards();
    if (track.length <= maxCards) return 0;

    const me = this.session.myPlayer();
    if (!me) return 0;
    const myOrder = this.getDisplayPos(me).trackOrder;
    const myIdx = track.findIndex((seg) => seg.trackOrder === myOrder);
    if (myIdx < 0) return 0;

    return Math.max(0, Math.min(myIdx, track.length - maxCards));
  });

  readonly effectiveTrackStartIndex = computed<number>(() => {
    const view = this.session.currentView();
    if (!view) return 0;
    const maxStart = Math.max(0, view.visibleTrack.length - this.maxVisibleRoadCards());
    return Math.max(0, Math.min(maxStart, this.baseTrackStartIndex() + this.trackPanOffset()));
  });

  readonly displayedTrack = computed<ActiveRoadCard[]>(() => {
    const view = this.session.currentView();
    if (!view) return [];
    const start = this.effectiveTrackStartIndex();
    return view.visibleTrack.slice(start, start + this.maxVisibleRoadCards());
  });

  readonly canPanTrackLeft = computed<boolean>(() => this.effectiveTrackStartIndex() > 0);

  readonly canPanTrackRight = computed<boolean>(() => {
    const view = this.session.currentView();
    if (!view) return false;
    return this.effectiveTrackStartIndex() + this.maxVisibleRoadCards() < view.visibleTrack.length;
  });

  readonly activeRoundStep = computed<1 | 2 | 3 | 4>(() => {
    const view = this.session.currentView();
    if (!view) return 1;
    if (view.phase === 'PLANNING') return 2;
    if (view.phase === 'GAMEOVER') return 4;
    return 3;
  });

  readonly planningReadiness = computed<{ ready: number; total: number }>(() => {
    const view = this.session.currentView();
    if (!view) return { ready: 0, total: 0 };
    const activeDrivers = view.players.filter(
      (p) => !p.skippedThisRound && p.finishedRank === null
    );
    const readyCount = activeDrivers.filter((p) => p.hasLockedPlan).length;
    return { ready: readyCount, total: activeDrivers.length };
  });

  readonly convoyResolutionItems = computed<ConvoyCeremonyItem[]>(() => {
    const view = this.session.currentView();
    if (!view) return [];
    const drivingSeat = this.movingSeat() ?? view.activeSeat;
    const activeQueueIdx = view.resolutionQueue.indexOf(drivingSeat);

    return view.resolutionQueue
      .map((seat, idx) => {
        const p = view.players.find((pl) => pl.seat === seat);
        if (!p) return null;
        let status: 'DRIVING' | 'DONE' | 'QUEUED' = 'QUEUED';
        if (idx === activeQueueIdx) {
          status = 'DRIVING';
        } else if (activeQueueIdx >= 0 && idx < activeQueueIdx) {
          status = 'DONE';
        }
        return {
          orderNum: idx + 1,
          seat: p.seat,
          name: p.name,
          persona: p.persona,
          revealedCard: p.revealedCard,
          revealedFuelDump: p.revealedFuelDump,
          skippedThisRound: p.skippedThisRound,
          status,
        };
      })
      .filter((item): item is ConvoyCeremonyItem => item !== null);
  });

  readonly lastRoundCleanupLogs = computed<BalikKampungLogEntry[]>(() => {
    const view = this.session.currentView();
    if (!view || view.roundNumber <= 1 || view.phase !== 'PLANNING') return [];
    const prevRound = view.roundNumber - 1;
    return view.logs.filter(
      (entry) => entry.round === prevRound && CLEANUP_ALERT_LOG_KEYS.has(entry.key)
    );
  });

  constructor() {
    effect(() => {
      const view = this.session.currentView();
      if (!view) {
        this.resetAnimationState();
        this.lastObservedRound = -1;
        this.lastObservedPhase = '';
        return;
      }

      if (this.lastObservedRound !== -1) {
        if (view.roundNumber > this.lastObservedRound) {
          this.trackPanOffset.set(0);
          this.shellUi.playSfx('deal');
        } else if (
          this.lastObservedPhase === 'PLANNING' &&
          view.phase !== 'PLANNING' &&
          view.phase !== 'GAMEOVER'
        ) {
          this.shellUi.playSfx('alert');
        }
      }
      this.lastObservedRound = view.roundNumber;
      this.lastObservedPhase = view.phase;

      const traces = view.recentMoves ?? [];
      if (traces.length === 0) {
        if (view.roundNumber <= 1 && view.phase === 'PLANNING') {
          this.lastProcessedMoveSeq = 0;
        }
        return;
      }

      if (this.lastProcessedMoveSeq === -1) {
        const firstSeq = traces.at(0)?.moveSeq ?? 0;
        if (traces.length === 1 && firstSeq === 1) {
          this.lastProcessedMoveSeq = 0;
        } else {
          this.lastProcessedMoveSeq = traces.at(-1)?.moveSeq ?? 0;
          return;
        }
      }

      const reducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reducedMotion) {
        this.lastProcessedMoveSeq = traces.at(-1)?.moveSeq ?? this.lastProcessedMoveSeq;
        return;
      }

      const fresh = traces.filter((t) => t.moveSeq > this.lastProcessedMoveSeq);
      if (fresh.length === 0) {
        return;
      }
      this.lastProcessedMoveSeq = fresh.at(-1)?.moveSeq ?? this.lastProcessedMoveSeq;

      const nextMap = new Map<number, TrackPosition>(this.animatedCarPositions());
      for (const tr of fresh) {
        const origin = tr.trail.at(0);
        if (origin && !nextMap.has(tr.seat) && this.movingSeat() !== tr.seat) {
          nextMap.set(tr.seat, { ...origin });
        }
        this.animQueue.push({
          moveSeq: tr.moveSeq,
          seat: tr.seat,
          trail: tr.trail.map((p) => ({ ...p })),
        });
      }
      this.animatedCarPositions.set(nextMap);

      if (this.movingSeat() === null) {
        this.playNextQueuedMove();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.resetAnimationState();
    });
  }

  ngOnInit(): void {
    this.shellUi.setActiveGame('balik-kampung');
    if (!this.session.snapshot()) {
      void this.router.navigate(['/balik-kampung/lobby']);
    }
  }

  private resetAnimationState(): void {
    clearTimeout(this.animTimer);
    this.animQueue = [];
    this.movingSeat.set(null);
    this.animatedCarPositions.set(new Map());
    this.lastProcessedMoveSeq = -1;
  }

  private playNextQueuedMove(): void {
    clearTimeout(this.animTimer);
    const current = this.animQueue.shift();
    if (!current || current.trail.length < 2) {
      this.movingSeat.set(null);
      if (this.animQueue.length === 0) {
        this.animatedCarPositions.set(new Map());
      }
      return;
    }

    const startPos = current.trail.at(0);
    if (!startPos) {
      this.playNextQueuedMove();
      return;
    }

    this.movingSeat.set(current.seat);
    const initMap = new Map<number, TrackPosition>(this.animatedCarPositions());
    initMap.set(current.seat, { ...startPos });
    this.animatedCarPositions.set(initMap);
    if (current.seat === this.session.mySeat()) {
      this.trackPanOffset.set(0);
      this.scrollTrackToOrder(startPos.trackOrder);
    }

    let stepIdx = 0;
    const advanceStep = (): void => {
      stepIdx += 1;
      const nextPos = current.trail.at(stepIdx);
      if (!nextPos) {
        this.finishSeatAnimation(current.seat);
        return;
      }

      const updated = new Map<number, TrackPosition>(this.animatedCarPositions());
      updated.set(current.seat, { ...nextPos });
      this.animatedCarPositions.set(updated);
      if (current.seat === this.session.mySeat()) {
        this.trackPanOffset.set(0);
        this.scrollTrackToOrder(nextPos.trackOrder);
      }

      if (stepIdx < current.trail.length - 1) {
        this.animTimer = setTimeout(advanceStep, STEP_ANIMATION_MS);
      } else {
        this.animTimer = setTimeout(() => {
          this.finishSeatAnimation(current.seat);
        }, LANDING_HOLD_MS);
      }
    };

    this.animTimer = setTimeout(advanceStep, STEP_ANIMATION_MS);
  }

  private finishSeatAnimation(seat: number): void {
    const updated = new Map<number, TrackPosition>(this.animatedCarPositions());
    const nextForSameSeat = this.animQueue.find((q) => q.seat === seat);
    const nextOrigin = nextForSameSeat?.trail.at(0);
    if (nextOrigin) {
      updated.set(seat, { ...nextOrigin });
    } else {
      updated.delete(seat);
    }
    this.animatedCarPositions.set(updated);
    this.movingSeat.set(null);
    this.playNextQueuedMove();
  }

  getDisplayPos(player: BalikKampungPublicPlayer): TrackPosition {
    return this.animatedCarPositions().get(player.seat) ?? player.pos;
  }

  getPersona(id: CarPersonaId): CarPersonaMeta {
    return CAR_PERSONA_MAP.get(id) ?? CAR_PERSONAS[0];
  }

  getCardMeta(id: ActionCardId): ActionCardMeta {
    return ACTION_CARD_MAP.get(id) ?? ACTION_CARD_META_LIST[0];
  }

  getPawnLabel(car: BalikKampungPublicPlayer): string {
    if (car.seat === this.session.mySeat()) {
      return this.translate.instant('BK.YOU_BADGE');
    }
    const cleaned = car.name.replace(/\s*\(Bot\)\s*/gi, '').trim();
    if (!cleaned) {
      return `#${car.seat + 1}`;
    }
    const stripped = cleaned
      .replace(/^(Uncle|Pak Cik|Kakak|Abang|Mak Cik)\s+/i, '')
      .trim();
    const candidate = cleaned.length > 8 && stripped.length > 0 ? stripped : cleaned;
    return candidate.length > 9 ? `${candidate.slice(0, 8)}…` : candidate;
  }

  getPlayersAt(
    players: readonly BalikKampungPublicPlayer[],
    trackOrder: number,
    lane: RoadCorridor,
    slot: number
  ): BalikKampungPublicPlayer[] {
    return players.filter((p) =>
      sameTrackPos(this.getDisplayPos(p), { trackOrder, lane, slot })
    );
  }

  isRempitAt(trackOrder: number, lane: RoadCorridor, slot: number): boolean {
    const view = this.session.currentView();
    if (!view || !view.rempit.active) return false;
    return sameTrackPos(view.rempit.pos, { trackOrder, lane, slot });
  }

  getSpaceFeature(seg: ActiveRoadCard, lane: StandardCorridor, slot: number): SpaceFeature {
    const idx = slot === 1 ? 1 : 0;
    if (lane === 'RIGHT') {
      return seg.card.right.at(idx) ?? 'CLEAR';
    }
    if (lane === 'LEFT') {
      return seg.card.left.at(idx) ?? 'CLEAR';
    }
    return seg.card.trunk.at(idx) ?? 'CLEAR';
  }

  getOptionsForCell(
    trackOrder: number,
    lane: RoadCorridor,
    slot: number
  ): ReachableMoveOption[] {
    const view = this.session.currentView();
    if (!view || !this.session.isMyResolutionTurn() || view.phase !== 'RESOLVING') {
      return [];
    }
    return view.reachableOptions.filter(
      (opt) =>
        !opt.isScoutFrontier &&
        sameTrackPos(opt.destination, { trackOrder, lane, slot })
    );
  }

  getScoutOptionForLane(lane: StandardCorridor): ReachableMoveOption | null {
    return (
      this.scoutFrontierOptions().find((opt) => opt.destination.lane === lane) ?? null
    );
  }

  onCellTargetClick(opt: ReachableMoveOption): void {
    this.hoveredOptionId.set(null);
    this.session.commitMove(opt.optionId);
  }

  setPreviewCard(cardId: ActionCardId | null): void {
    if (cardId !== null && !this.isCardPlayableNow(cardId)) {
      return;
    }
    this.selectedPreviewCardId.set(cardId);
    this.hoveredOptionId.set(null);
  }

  setHoveredOption(optionId: string | null): void {
    this.hoveredOptionId.set(optionId);
  }

  focusPreviewDestination(opt: ReachableMoveOption): void {
    this.hoveredOptionId.set(opt.optionId);
    const view = this.session.currentView();
    const fallbackOrder = view?.visibleTrack.at(-1)?.trackOrder ?? opt.destination.trackOrder;
    const targetOrder = opt.isScoutFrontier ? fallbackOrder : opt.destination.trackOrder;
    this.scrollTrackToOrder(targetOrder);
  }

  isMyCarAt(trackOrder: number, lane: RoadCorridor, slot: number): boolean {
    const me = this.session.myPlayer();
    if (!me) return false;
    return sameTrackPos(this.getDisplayPos(me), { trackOrder, lane, slot });
  }

  getPreviewLandingAt(
    trackOrder: number,
    lane: RoadCorridor,
    slot: number
  ): ReachableMoveOption[] {
    return this.planningPreviewOptions().filter(
      (opt) =>
        !opt.isScoutFrontier &&
        sameTrackPos(opt.destination, { trackOrder, lane, slot })
    );
  }

  getPreviewScoutForLane(lane: StandardCorridor): ReachableMoveOption | null {
    return (
      this.previewScoutOptions().find((opt) => opt.destination.lane === lane) ?? null
    );
  }

  getTrailStepAt(
    trackOrder: number,
    lane: RoadCorridor,
    slot: number
  ): number | null {
    const trail = this.activeTrailOption()?.trail;
    if (!trail || trail.length <= 1) return null;
    const idx = trail.findIndex(
      (p, stepIdx) => stepIdx >= 1 && sameTrackPos(p, { trackOrder, lane, slot })
    );
    return idx >= 1 ? idx : null;
  }

  getCardEffectiveSpeed(cardId: ActionCardId): number {
    const view = this.session.currentView();
    const me = this.session.myPlayer();
    if (!view || !me) return cardId;
    const useFuel = me.hasLockedPlan
      ? me.myPlannedFuelDump
      : this.session.pendingFuelDump();
    return this.engine.previewEffectiveSpeedFromView(view, me.seat, cardId, useFuel);
  }

  getCardLandingSummary(cardId: ActionCardId): string {
    const view = this.session.currentView();
    const me = this.session.myPlayer();
    if (!view || !me) return '';
    if (!this.isCardInHand(cardId)) {
      return this.translate.instant('BK.FORECAST_DISCARDED');
    }
    if (cardId === 0 && view.rnrBanned) {
      return this.translate.instant('BK.FORECAST_BANNED');
    }
    if (cardId === 2 && me.bladder >= 2) {
      return this.translate.instant('BK.FORECAST_LOCKED');
    }

    const useFuel = me.hasLockedPlan
      ? me.myPlannedFuelDump
      : this.session.pendingFuelDump();
    const opts = this.engine.previewCardOptionsFromView(view, me.seat, cardId, useFuel);
    const first = opts.at(0);
    if (!first) return '—';

    if (cardId === 0) {
      if (first.pitStopKind === 'RNR') {
        return this.translate.instant('BK.FORECAST_RNR', {
          order: first.destination.trackOrder,
          slot: first.destination.slot + 1,
        });
      }
      if (first.pitStopKind === 'WARUNG') {
        return this.translate.instant('BK.FORECAST_WARUNG', {
          order: first.destination.trackOrder,
          slot: first.destination.slot + 1,
        });
      }
      return this.translate.instant('BK.FORECAST_SHOULDER');
    }

    const previewLabels = opts.slice(0, 2).map((o) => this.formatShortSpot(o));
    const more = opts.length > 2 ? ` +${opts.length - 2}` : '';
    return this.translate.instant('BK.FORECAST_SPOTS', {
      summary: `${previewLabels.join(', ')}${more}`,
    });
  }

  formatShortSpot(opt: ReachableMoveOption): string {
    if (opt.isScoutFrontier) {
      const ln = this.translate.instant(this.getLaneLabelKey(opt.destination.lane));
      return `🔭 ${ln}`;
    }
    if (opt.destination.lane === 'FINISH') {
      return '🏁 Kampung';
    }
    const ln = this.translate.instant(this.getLaneLabelKey(opt.destination.lane));
    const warn =
      opt.crossedAwasOrders.length > 0
        ? '📸'
        : opt.slipstreamApplied
          ? '💨'
          : '';
    return `${ln} #${opt.destination.trackOrder}.${opt.destination.slot + 1}${warn}`;
  }

  formatGhostBadge(opt: ReachableMoveOption): string {
    const cardId = this.effectivePreviewCardId() ?? 0;
    if (opt.pitStopKind === 'RNR') {
      return '⛽ R&R';
    }
    if (opt.pitStopKind === 'WARUNG') {
      return '☕ Warung';
    }
    if (opt.pitStopKind === 'SHOULDER') {
      return '🛑 +1💢';
    }
    const flags: string[] = [];
    if (opt.crossedAwasOrders.length > 0) flags.push('📸');
    if (opt.slipstreamApplied) flags.push('💨+1');
    if (opt.crossedDownhillOrders.length > 0) flags.push('⛰️');
    return flags.length > 0 ? `[${cardId}] ${flags.join('')}` : `[${cardId}]`;
  }

  isCardInHand(cardId: ActionCardId): boolean {
    const me = this.session.myPlayer();
    return Boolean(me?.hand.includes(cardId));
  }

  isCardPlayableNow(cardId: ActionCardId): boolean {
    const view = this.session.currentView();
    const me = this.session.myPlayer();
    if (!view || !me || view.phase !== 'PLANNING' || me.hasLockedPlan) {
      return false;
    }
    return view.playableCards.includes(cardId);
  }

  toggleHudWidget(widget: 'STANDINGS' | 'RADIO'): void {
    this.shellUi.playSfx('click');
    this.activeHudWidget.set(this.activeHudWidget() === widget ? 'NONE' : widget);
  }

  closeHudWidget(): void {
    this.activeHudWidget.set('NONE');
  }

  onCardTap(cardId: ActionCardId): void {
    if (!this.isCardPlayableNow(cardId)) return;
    this.shellUi.playSfx('click');
    this.setPreviewCard(cardId);
    const firstOpt = this.planningPreviewOptions().at(0);
    if (firstOpt) {
      this.focusPreviewDestination(firstOpt);
    }
  }

  confirmSelectedCard(): void {
    const cid = this.effectivePreviewCardId();
    if (cid !== null) {
      this.onPlayCard(cid);
    }
  }

  changeLockedCard(): void {
    const view = this.session.currentView();
    const me = this.session.myPlayer();
    if (!view || !me || view.phase !== 'PLANNING' || !me.hasLockedPlan) return;
    this.shellUi.playSfx('click');
    this.session.unselectPlan();
  }

  onPlayCard(cardId: ActionCardId): void {
    if (!this.isCardPlayableNow(cardId)) return;
    this.selectedPreviewCardId.set(cardId);
    this.session.selectPlan(cardId);
  }

  chooseEvCharge(mode: 'AC_SLOW' | 'DC_FAST'): void {
    this.session.chooseEvCharge(mode);
  }

  chooseSimpangBranch(branch: SimpangCorridor): void {
    this.session.chooseScoutedSimpang(branch);
  }

  getProjectedHappiness(p: BalikKampungPublicPlayer): number {
    const bonus =
      p.finishedRank !== null ? (ARRIVAL_BONUS_BY_RANK.get(p.finishedRank) ?? 0) : 0;
    return bonus - p.stress - p.bladder;
  }

  getLaneLabelKey(lane: RoadCorridor): string {
    switch (lane) {
      case 'RIGHT':
        return 'BK.LANE_RIGHT_SHORT';
      case 'LEFT':
        return 'BK.LANE_LEFT_SHORT';
      case 'TRUNK':
        return 'BK.LANE_TRUNK_SHORT';
      case 'KUBUR':
        return 'BK.BRANCH_KUBUR';
      case 'BENDANG':
        return 'BK.BRANCH_BENDANG';
      case 'UTAMA':
        return 'BK.BRANCH_UTAMA';
      case 'FINISH':
        return 'BK.LANE_FINISH_SHORT';
    }
  }

  formatOptionLabel(opt: ReachableMoveOption): string {
    if (opt.pitStopKind === 'RNR') {
      return this.translate.instant('BK.OPT_PIT_RNR');
    }
    if (opt.pitStopKind === 'WARUNG') {
      return this.translate.instant('BK.OPT_PIT_WARUNG');
    }
    if (opt.pitStopKind === 'SHOULDER') {
      return this.translate.instant('BK.OPT_PIT_SHOULDER');
    }
    if (opt.isScoutFrontier) {
      const laneText = this.translate.instant(this.getLaneLabelKey(opt.destination.lane));
      return this.translate.instant('BK.OPT_SCOUT_FRONTIER', { lane: laneText });
    }
    if (opt.destination.lane === 'FINISH') {
      const via = opt.enteringSimpangBranch
        ? ` (${this.translate.instant(this.getLaneLabelKey(opt.enteringSimpangBranch))})`
        : '';
      return `${this.translate.instant('BK.OPT_FINISH_KAMPUNG')}${via}`;
    }

    const laneName = this.translate.instant(this.getLaneLabelKey(opt.destination.lane));
    const tags: string[] = [];
    if (opt.slipstreamApplied) {
      tags.push(this.translate.instant('BK.TAG_SLIPSTREAM'));
    }
    if (opt.crossedAwasOrders.length > 0) {
      tags.push('AWAS');
    }
    if (opt.crossedDownhillOrders.length > 0) {
      tags.push('⛰️');
    }
    const suffix = tags.length > 0 ? ` · ${tags.join(' ')}` : '';
    return `${laneName} #${opt.destination.trackOrder}.${opt.destination.slot + 1}${suffix}`;
  }

  formatLogEntry(entry: BalikKampungLogEntry): string {
    return this.translate.instant(entry.key, entry.params);
  }

  scrollTrackToOrder(trackOrder: number): void {
    const container = this.trackScroller?.nativeElement;
    if (!container) return;
    const cardEl = container.querySelector(
      `[data-track-order="${trackOrder}"]`
    ) as HTMLElement | null;
    if (cardEl && typeof cardEl.scrollIntoView === 'function') {
      cardEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  panTrack(delta: number): void {
    const view = this.session.currentView();
    if (!view) return;
    const maxStart = Math.max(0, view.visibleTrack.length - this.maxVisibleRoadCards());
    const targetStart = Math.max(
      0,
      Math.min(maxStart, this.effectiveTrackStartIndex() + delta)
    );
    this.trackPanOffset.set(targetStart - this.baseTrackStartIndex());
    this.shellUi.playSfx('click');
  }

  focusMyCar(): void {
    this.trackPanOffset.set(0);
    const me = this.session.myPlayer();
    if (me) {
      this.scrollTrackToOrder(this.getDisplayPos(me).trackOrder);
    }
  }

  focusActiveCar(): void {
    const active = this.session.activePlayer();
    if (active) {
      this.scrollTrackToOrder(this.getDisplayPos(active).trackOrder);
    }
  }

  playAgain(): void {
    this.session.restartMatch();
  }

  backToLobby(): void {
    this.session.leaveRoom();
    this.shellUi.setActiveRoomCode(null);
    void this.router.navigate(['/balik-kampung/lobby']);
  }
}
