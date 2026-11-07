import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GenericLobby } from '../../../../core/models/party.model';
import {
  FINISH_ROAD_CARD,
  SIMPANG_TIGA_CARD,
  STANDARD_ROAD_SEGMENTS,
  START_ROAD_CARD,
} from '../../data/balik-kampung-cards.data';
import {
  ActionCardId,
  ActiveRoadCard,
  BalikKampungLobbySettings,
  BalikKampungPlayerView,
  BalikKampungPublicPlayer,
  BalikKampungSeat,
  ReachableMoveOption,
  SimpangCorridor,
} from '../../models/balik-kampung.model';
import {
  BalikKampungSessionService,
  BalikKampungSnapshot,
} from '../../services/balik-kampung-session.service';
import { BalikKampungBoardComponent } from './balik-kampung-board.component';

describe('BalikKampungBoardComponent', () => {
  let component: BalikKampungBoardComponent;
  let fixture: ComponentFixture<BalikKampungBoardComponent>;
  let session: BalikKampungSessionService;
  let router: Router;

  function buildMockPlayers(): BalikKampungPublicPlayer[] {
    return [
      {
        seat: 0,
        name: 'Driver Red',
        isBot: false,
        persona: 'red',
        drivetrain: 'ICE',
        pos: { trackOrder: 1, lane: 'LEFT', slot: 0 },
        bladder: 2,
        stress: 1,
        scoutTokens: 1,
        hand: [2, 3, 4, 5, 0],
        discardPile: [],
        isSkipNext: false,
        skippedThisRound: false,
        fuelDumpUsed: false,
        evInstantTorqueReady: false,
        evInstantTorqueActiveThisRound: false,
        evFastChargeBonusReady: 0,
        evFastChargeBonusActiveThisRound: 0,
        mudTrapped: false,
        hasLockedPlan: false,
        myPlannedCard: null,
        myPlannedFuelDump: false,
        revealedCard: null,
        revealedFuelDump: false,
        finishedRank: null,
        finishedRound: null,
        finishedOvershoot: 0,
      },
      {
        seat: 1,
        name: 'Driver Blue EV',
        isBot: true,
        persona: 'blue',
        drivetrain: 'EV',
        pos: { trackOrder: 1, lane: 'RIGHT', slot: 1 },
        bladder: 1,
        stress: 2,
        scoutTokens: 0,
        hand: [3, 4, 5, 0],
        discardPile: [2],
        isSkipNext: false,
        skippedThisRound: false,
        fuelDumpUsed: false,
        evInstantTorqueReady: true,
        evInstantTorqueActiveThisRound: false,
        evFastChargeBonusReady: 2,
        evFastChargeBonusActiveThisRound: 0,
        mudTrapped: false,
        hasLockedPlan: true,
        myPlannedCard: null,
        myPlannedFuelDump: false,
        revealedCard: 4,
        revealedFuelDump: false,
        finishedRank: null,
        finishedRound: null,
        finishedOvershoot: 0,
      },
    ];
  }

  function buildMockTrack(): ActiveRoadCard[] {
    return [
      {
        trackOrder: 0,
        card: START_ROAD_CARD,
        awasDisarmed: false,
        hasHazardCone: false,
      },
      {
        trackOrder: 1,
        card: STANDARD_ROAD_SEGMENTS[0], // Rawang Bypass (Interchange)
        awasDisarmed: false,
        hasHazardCone: false,
      },
      {
        trackOrder: 2,
        card: STANDARD_ROAD_SEGMENTS[1], // Sungai Buloh R&R + AWAS
        awasDisarmed: false,
        hasHazardCone: true,
      },
      {
        trackOrder: 3,
        card: STANDARD_ROAD_SEGMENTS[13], // Slim River Downhill + Warung + AWAS
        awasDisarmed: true,
        hasHazardCone: false,
      },
    ];
  }

  function buildMockView(
    overrides?: Partial<BalikKampungPlayerView>
  ): BalikKampungPlayerView {
    return {
      phase: 'PLANNING',
      roundNumber: 2,
      players: buildMockPlayers(),
      visibleTrack: buildMockTrack(),
      roadDeckCount: 9,
      inDangerZone: true,
      trafficDeckCount: 6,
      activeTrafficEvent: 'SMARTLANE',
      rempit: {
        pos: { trackOrder: 1, lane: 'LEFT', slot: 1 },
        active: true,
      },
      resolutionQueue: [1, 0],
      activeSeat: 0,
      reachableOptions: [],
      playableCards: [3, 4, 5, 0],
      simpangTigaDrawn: false,
      rnrBanned: false,
      lastDiceRoll: null,
      lastCoinFlip: null,
      standings: [],
      logs: [
        {
          round: 2,
          key: 'BK.LOG_EVENT_SMARTLANE',
          tone: 'good',
        },
      ],
      ...overrides,
    };
  }

  function mountSnapshot(
    view: BalikKampungPlayerView,
    mySeat = 0,
    role: 'host' | 'guest' = 'host'
  ): void {
    const seats: BalikKampungSeat[] = view.players.map((p) => ({
      seat: p.seat,
      kind: p.isBot ? 'bot' : 'human',
      name: p.name,
      connected: true,
      drivetrain: p.drivetrain,
      persona: p.persona,
    }));

    const lobby: GenericLobby<BalikKampungSeat, BalikKampungLobbySettings> = {
      started: true,
      seats,
      rules: { numPlayers: seats.length },
    };

    const snap: BalikKampungSnapshot = {
      role,
      mySeat,
      roomCode: 'B1234',
      lobby,
      view,
      online: false,
      status: 'In Convoy',
      error: null,
    };

    session.snapshot.set(snap);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BalikKampungBoardComponent],
    }).compileComponents();

    session = TestBed.inject(BalikKampungSessionService);
    router = TestBed.inject(Router);
    session.leaveRoom();

    fixture = TestBed.createComponent(BalikKampungBoardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    session.leaveRoom();
  });

  it('redirects to /balik-kampung/lobby on init when no active session snapshot exists', () => {
    let navigatedPath = '';
    router.navigate = (cmds: unknown[]) => {
      navigatedPath = cmds.join('/');
      return Promise.resolve(true);
    };

    component.ngOnInit();
    expect(navigatedPath).toBe('/balik-kampung/lobby');
  });

  it('renders PLANNING telemetry, enforces Bladder>=2 lock on card 2, and dispatches card selection', () => {
    const view = buildMockView();
    mountSnapshot(view);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('.road-segment-card').length).toBe(4);
    expect(root.querySelectorAll('.rempit-token').length).toBe(1);
    expect(root.querySelectorAll('.action-card-btn').length).toBe(5);

    // Card 2 is in hand, but playableCards excludes 2 due to Bladder === 2
    expect(component.isCardInHand(2)).toBe(true);
    expect(component.isCardPlayableNow(2)).toBe(false);
    expect(component.isCardPlayableNow(3)).toBe(true);

    let selectedCard: ActionCardId | null = null;
    session.selectPlan = (cardId: ActionCardId) => {
      selectedCard = cardId;
    };

    component.onPlayCard(2);
    expect(selectedCard).toBeNull();

    component.onPlayCard(4);
    expect(selectedCard).toBe(4);

    // Toggle ICE fuel dump arming
    expect(session.pendingFuelDump()).toBe(false);
    session.togglePendingFuelDump();
    expect(session.pendingFuelDump()).toBe(true);
  });

  it('renders EV telemetry perks, skipping banner, and locked-plan banner accurately', () => {
    const players = buildMockPlayers();
    players[1] = {
      ...players[1],
      hasLockedPlan: true,
      myPlannedCard: 5,
      skippedThisRound: false,
    };
    const evView = buildMockView({
      players,
      rnrBanned: true,
    });
    mountSnapshot(evView, 1);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('.ev-active-chip').length).toBe(2);
    expect(root.querySelectorAll('.locked-plan-banner').length).toBe(1);
    expect(root.querySelectorAll('.change-card-btn').length).toBe(1);
    expect(root.querySelectorAll('.rnr-banned-pill').length).toBe(1);

    let unlockedCount = 0;
    session.unselectPlan = () => {
      unlockedCount += 1;
    };
    component.changeLockedCard();
    expect(unlockedCount).toBe(1);

    // Skipping state banner
    const skipPlayers = buildMockPlayers();
    skipPlayers[0] = {
      ...skipPlayers[0],
      skippedThisRound: true,
    };
    mountSnapshot(buildMockView({ players: skipPlayers }), 0);
    fixture.detectChanges();
    expect(root.querySelectorAll('.driver-console .banner-alert').length).toBe(1);
  });

  it('renders RESOLVING destination targets, Scout Horizon frontier column, and option formatting', () => {
    const options: ReachableMoveOption[] = [
      {
        optionId: 'OPT_CELL_SLIP',
        destination: { trackOrder: 2, lane: 'RIGHT', slot: 1 },
        isScoutFrontier: false,
        scoutStepsRemaining: 0,
        crossedAwasOrders: [2],
        crossedDownhillOrders: [3],
        passedTarget: true,
        slipstreamApplied: true,
        pitStopKind: 'NONE',
        enteringSimpangBranch: null,
        overshootSpaces: 0,
        totalEffectiveSpeed: 4,
      },
      {
        optionId: 'OPT_SCOUT_RIGHT',
        destination: { trackOrder: 4, lane: 'RIGHT', slot: 0 },
        isScoutFrontier: true,
        scoutStepsRemaining: 2,
        crossedAwasOrders: [],
        crossedDownhillOrders: [],
        passedTarget: false,
        slipstreamApplied: false,
        pitStopKind: 'NONE',
        enteringSimpangBranch: null,
        overshootSpaces: 0,
        totalEffectiveSpeed: 5,
      },
      {
        optionId: 'OPT_SCOUT_LEFT',
        destination: { trackOrder: 4, lane: 'LEFT', slot: 0 },
        isScoutFrontier: true,
        scoutStepsRemaining: 1,
        crossedAwasOrders: [],
        crossedDownhillOrders: [],
        passedTarget: false,
        slipstreamApplied: false,
        pitStopKind: 'NONE',
        enteringSimpangBranch: null,
        overshootSpaces: 0,
        totalEffectiveSpeed: 5,
      },
    ];

    const resolvingView = buildMockView({
      phase: 'RESOLVING',
      activeSeat: 0,
      reachableOptions: options,
    });
    mountSnapshot(resolvingView, 0);
    fixture.detectChanges();

    expect(component.hasScoutFrontierColumn()).toBe(true);
    expect(component.getScoutOptionForLane('RIGHT')?.optionId).toBe('OPT_SCOUT_RIGHT');
    expect(component.getScoutOptionForLane('TRUNK')).toBeNull();
    expect(component.getOptionsForCell(2, 'RIGHT', 1).length).toBe(1);

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('.scout-frontier-card').length).toBe(1);
    expect(root.querySelectorAll('.move-opt-btn').length).toBe(3);

    let committedId = '';
    session.commitMove = (optionId: string) => {
      committedId = optionId;
    };
    component.onCellTargetClick(options[0]);
    expect(committedId).toBe('OPT_CELL_SLIP');

    // Label formatting across pit stop, finish, scout, and standard options
    const slipLabel = component.formatOptionLabel(options[0]);
    expect(slipLabel).toContain('#2.2');
    expect(slipLabel).toContain('AWAS');
    expect(slipLabel).toContain('⛰️');

    expect(
      component.formatOptionLabel({
        ...options[0],
        pitStopKind: 'RNR',
      }).length
    ).toBeGreaterThan(0);
    expect(
      component.formatOptionLabel({
        ...options[0],
        pitStopKind: 'WARUNG',
      }).length
    ).toBeGreaterThan(0);
    expect(
      component.formatOptionLabel({
        ...options[0],
        pitStopKind: 'SHOULDER',
      }).length
    ).toBeGreaterThan(0);
    expect(
      component.formatOptionLabel({
        ...options[0],
        destination: { trackOrder: 5, lane: 'FINISH', slot: 0 },
        enteringSimpangBranch: 'KUBUR',
      })
    ).toContain('(');
  });

  it('renders SIMPANG_TIGA & FINISH segments, helper lane labels, happiness math, and scroll helpers', () => {
    const players = buildMockPlayers();
    players[0] = {
      ...players[0],
      pos: { trackOrder: 4, lane: 'BENDANG', slot: 1 },
      mudTrapped: true,
    };
    players[1] = {
      ...players[1],
      pos: { trackOrder: 5, lane: 'FINISH', slot: 0 },
      finishedRank: 1,
      stress: 2,
      bladder: 1,
    };

    const endgameTrack: ActiveRoadCard[] = [
      ...buildMockTrack(),
      {
        trackOrder: 4,
        card: SIMPANG_TIGA_CARD,
        awasDisarmed: false,
        hasHazardCone: false,
      },
      {
        trackOrder: 5,
        card: FINISH_ROAD_CARD,
        awasDisarmed: false,
        hasHazardCone: false,
      },
    ];

    mountSnapshot(
      buildMockView({
        phase: 'RESOLVING',
        activeSeat: 1,
        players,
        visibleTrack: endgameTrack,
        rempit: { pos: { trackOrder: 1, lane: 'LEFT', slot: 0 }, active: false },
      }),
      0
    );
    fixture.detectChanges();

    expect(component.isRempitAt(1, 'LEFT', 0)).toBe(false);
    expect(component.getProjectedHappiness(players[0])).toBe(-3); // 0 - 1 - 2
    expect(component.getProjectedHappiness(players[1])).toBe(7); // 10 - 2 - 1

    expect(component.getLaneLabelKey('RIGHT')).toBe('BK.LANE_RIGHT_SHORT');
    expect(component.getLaneLabelKey('LEFT')).toBe('BK.LANE_LEFT_SHORT');
    expect(component.getLaneLabelKey('TRUNK')).toBe('BK.LANE_TRUNK_SHORT');
    expect(component.getLaneLabelKey('KUBUR')).toBe('BK.BRANCH_KUBUR');
    expect(component.getLaneLabelKey('BENDANG')).toBe('BK.BRANCH_BENDANG');
    expect(component.getLaneLabelKey('UTAMA')).toBe('BK.BRANCH_UTAMA');
    expect(component.getLaneLabelKey('FINISH')).toBe('BK.LANE_FINISH_SHORT');

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('.simpang-lanes').length).toBe(1);
    expect(root.querySelectorAll('.finish-compound').length).toBe(1);

    let scrolledOrder = -1;
    const card4 = root.querySelector('[data-track-order="4"]') as HTMLElement;
    card4.scrollIntoView = () => {
      scrolledOrder = 4;
    };
    component.focusMyCar();
    expect(scrolledOrder).toBe(4);

    const card5 = root.querySelector('[data-track-order="5"]') as HTMLElement;
    card5.scrollIntoView = () => {
      scrolledOrder = 5;
    };
    component.focusActiveCar();
    expect(scrolledOrder).toBe(5);
  });

  it('renders bounded EV_CHARGE_PROMPT and SIMPANG_SCOUT_PROMPT modals with bottom-only buttons', () => {
    mountSnapshot(
      buildMockView({
        phase: 'EV_CHARGE_PROMPT',
        activeSeat: 0,
      }),
      0
    );
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('.modal-header button').length).toBe(0);
    expect(root.querySelectorAll('.modal-footer button').length).toBe(2);

    let chosenEvMode: 'AC_SLOW' | 'DC_FAST' | null = null;
    session.chooseEvCharge = (mode) => {
      chosenEvMode = mode;
    };
    component.chooseEvCharge('DC_FAST');
    expect(chosenEvMode).toBe('DC_FAST');

    mountSnapshot(
      buildMockView({
        phase: 'SIMPANG_SCOUT_PROMPT',
        activeSeat: 0,
      }),
      0
    );
    fixture.detectChanges();

    expect(root.querySelectorAll('.modal-header button').length).toBe(0);
    expect(root.querySelectorAll('.modal-footer button').length).toBe(3);

    let chosenBranch: SimpangCorridor | null = null;
    session.chooseScoutedSimpang = (branch) => {
      chosenBranch = branch;
    };
    component.chooseSimpangBranch('UTAMA');
    expect(chosenBranch).toBe('UTAMA');
  });

  it('renders GAMEOVER settlement modal with desktop-table, mobile-cards, and footer actions', () => {
    mountSnapshot(
      buildMockView({
        phase: 'GAMEOVER',
        standings: [
          {
            seat: 0,
            name: 'Driver Red',
            persona: 'red',
            drivetrain: 'ICE',
            standingPlace: 1,
            finishedRank: 1,
            arrivalBonus: 10,
            stressPenalty: 1,
            bladderPenalty: 0,
            netHappiness: 9,
          },
          {
            seat: 1,
            name: 'Driver Blue EV',
            persona: 'blue',
            drivetrain: 'EV',
            standingPlace: 2,
            finishedRank: null,
            arrivalBonus: 0,
            stressPenalty: 2,
            bladderPenalty: 1,
            netHappiness: -3,
          },
        ],
      }),
      0
    );
    session.openGameOverModal();
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const modal = root.querySelector('.settlement-modal') as HTMLElement;
    expect(modal.querySelectorAll('.modal-header button').length).toBe(0);
    expect(modal.querySelectorAll('.desktop-table tbody tr').length).toBe(2);
    expect(modal.querySelectorAll('.mobile-cards .mobile-app-card').length).toBe(2);

    let restarted = false;
    session.restartMatch = () => {
      restarted = true;
    };
    component.playAgain();
    expect(restarted).toBe(true);

    let navigatedBack = '';
    router.navigate = (cmds: unknown[]) => {
      navigatedBack = cmds.join('/');
      return Promise.resolve(true);
    };
    component.backToLobby();
    expect(navigatedBack).toBe('/balik-kampung/lobby');
  });

  it('orders lanes Trunk -> Hwy Left -> Hwy Right for left-to-right driving, renders ghost previews, and supports mobile 2-tap card confirm', () => {
    const view = buildMockView();
    mountSnapshot(view, 0);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    // Malaysian JKR shield + top-down car SVGs + selected-card confirm bar rendered
    expect(root.querySelectorAll('.jkr-shield-svg').length).toBe(1);
    expect(root.querySelectorAll('.car-svg').length).toBe(2);
    expect(root.querySelectorAll('.selected-card-bar').length).toBe(1);
    expect(root.querySelectorAll('.my-current-slot').length).toBe(1);

    // Verify top-to-bottom lane rows inside standard segment match driver facing -> (Trunk, Left, Right)
    const firstStandardRows = Array.from(
      root.querySelectorAll('.standard-lanes .lane-row')
    ).slice(0, 3);
    expect(firstStandardRows.length).toBe(3);
    expect(firstStandardRows[0].classList.contains('lane-trunk')).toBe(true);
    expect(firstStandardRows[1].classList.contains('lane-left')).toBe(true);
    expect(firstStandardRows[2].classList.contains('lane-right')).toBe(true);

    // Default effectivePreviewCardId falls back to playableCards[0] (card 3)
    expect(component.effectivePreviewCardId()).toBe(3);
    expect(component.planningPreviewOptions().length).toBeGreaterThan(0);
    expect(root.querySelectorAll('.ghost-landing-pill').length).toBeGreaterThan(0);

    // Locked card 2 cannot be selected as preview
    component.setPreviewCard(2);
    expect(component.effectivePreviewCardId()).toBe(3);

    // Default HUD keeps Standings & Radio collapsed until toggled via gantry widget buttons
    expect(component.activeHudWidget()).toBe('NONE');
    expect(root.querySelectorAll('.hud-widget-drawer').length).toBe(0);

    component.toggleHudWidget('STANDINGS');
    fixture.detectChanges();
    expect(component.activeHudWidget()).toBe('STANDINGS');
    expect(root.querySelectorAll('.hud-widget-drawer.convoy-panel').length).toBe(1);

    component.toggleHudWidget('RADIO');
    fixture.detectChanges();
    expect(component.activeHudWidget()).toBe('RADIO');
    expect(root.querySelectorAll('.hud-widget-drawer.log-panel').length).toBe(1);

    component.closeHudWidget();
    fixture.detectChanges();
    expect(component.activeHudWidget()).toBe('NONE');
    expect(root.querySelectorAll('.hud-widget-drawer').length).toBe(0);

    // Card tap UX: clicking a card (even repeatedly) ONLY previews without auto-locking; confirmSelectedCard() locks it
    let lockedCard: ActionCardId | null = null;
    session.selectPlan = (cid: ActionCardId) => {
      lockedCard = cid;
    };
    component.onCardTap(4);
    expect(component.effectivePreviewCardId()).toBe(4);
    expect(lockedCard).toBeNull();

    // Tapping the same card a 2nd time still only previews (no accidental misclick lock!)
    component.onCardTap(4);
    expect(component.effectivePreviewCardId()).toBe(4);
    expect(lockedCard).toBeNull();

    // Arm ICE Fuel Dump (+2 -> effective speed 6 -> scouts past trackOrder 3!)
    session.togglePendingFuelDump();
    fixture.detectChanges();

    expect(component.getCardEffectiveSpeed(4)).toBe(6);
    expect(component.hasPreviewScoutColumn()).toBe(true);
    expect(root.querySelectorAll('.scout-preview-card').length).toBe(1);

    // Route trail step dots appear along active preview option's path
    const firstPreview = component.planningPreviewOptions().at(0)!;
    component.setHoveredOption(firstPreview.optionId);
    expect((firstPreview.trail?.length ?? 0)).toBeGreaterThan(1);
    const step1 = firstPreview.trail!.at(1)!;
    expect(component.getTrailStepAt(step1.trackOrder, step1.lane, step1.slot)).toBe(1);

    let focusedOrder = -1;
    component.scrollTrackToOrder = (ord: number) => {
      focusedOrder = ord;
    };
    component.focusPreviewDestination(firstPreview);
    expect(focusedOrder).toBeGreaterThanOrEqual(0);

    // 2nd tap (or confirmSelectedCard) locks in card 4
    component.confirmSelectedCard();
    expect(lockedCard).toBe(4);

    // Per-card landing summary covers locked, playable movement, pit stop R&R/Warung/Shoulder, and discarded states
    expect(component.getCardLandingSummary(2).length).toBeGreaterThan(0);
    expect(component.getCardLandingSummary(3).length).toBeGreaterThan(0);
    expect(component.getCardLandingSummary(0).length).toBeGreaterThan(0);

    const rnrTrack = buildMockTrack().map((seg) =>
      seg.trackOrder === 2
        ? { ...seg, card: { ...seg.card, left: ['CLEAR', 'RNR'] as const } }
        : seg
    );
    const rnrPlayers = buildMockPlayers();
    rnrPlayers[0] = {
      ...rnrPlayers[0],
      pos: { trackOrder: 2, lane: 'LEFT', slot: 0 },
      hand: [3, 4, 5, 0],
      discardPile: [2],
    };
    mountSnapshot(buildMockView({ players: rnrPlayers, visibleTrack: rnrTrack }), 0);
    component.setPreviewCard(0);
    fixture.detectChanges();
    expect(component.getCardLandingSummary(0)).toContain('2.2');
    expect(component.getCardLandingSummary(2).length).toBeGreaterThan(0);
    expect(
      component.formatGhostBadge(component.planningPreviewOptions().at(0)!)
    ).toContain('R&R');
  });

  it('animates cars step-by-step along recentMoves trail before settling at final destination', () => {
    vi.useFakeTimers();
    try {
      // Mount initial Round 1 PLANNING view (no moves yet)
      mountSnapshot(
        buildMockView({
          roundNumber: 1,
          phase: 'PLANNING',
          recentMoves: [],
        }),
        0
      );
      fixture.detectChanges();

      // Emit a resolved move where seat 0 drives 2 steps: (1,LEFT,0) -> (1,LEFT,1) -> (2,LEFT,0)
      const movedPlayers = buildMockPlayers();
      movedPlayers[0] = {
        ...movedPlayers[0],
        pos: { trackOrder: 2, lane: 'LEFT', slot: 0 },
      };
      mountSnapshot(
        buildMockView({
          roundNumber: 1,
          phase: 'RESOLVING',
          players: movedPlayers,
          recentMoves: [
            {
              moveSeq: 1,
              seat: 0,
              trail: [
                { trackOrder: 1, lane: 'LEFT', slot: 0 },
                { trackOrder: 1, lane: 'LEFT', slot: 1 },
                { trackOrder: 2, lane: 'LEFT', slot: 0 },
              ],
            },
          ],
        }),
        0
      );
      fixture.detectChanges();

      // Immediately after commit, car starts at trail[0] instead of teleporting to (2,LEFT,0)
      expect(component.movingSeat()).toBe(0);
      expect(component.getDisplayPos(movedPlayers[0])).toEqual({
        trackOrder: 1,
        lane: 'LEFT',
        slot: 0,
      });

      // After 1st step tick (175ms), car advances to middle space (1,LEFT,1)
      vi.advanceTimersByTime(180);
      expect(component.getDisplayPos(movedPlayers[0])).toEqual({
        trackOrder: 1,
        lane: 'LEFT',
        slot: 1,
      });

      // After 2nd step tick + landing hold, car arrives at (2,LEFT,0) and animation queue clears
      vi.advanceTimersByTime(320);
      expect(component.getDisplayPos(movedPlayers[0])).toEqual({
        trackOrder: 2,
        lane: 'LEFT',
        slot: 0,
      });
      expect(component.movingSeat()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps camera anchored on my car when bots move, windows 5 road segments without scrolling, and renders named bots & round/phase ceremony', () => {
    vi.useFakeTimers();
    try {
      const longTrack: ActiveRoadCard[] = [
        {
          trackOrder: 0,
          card: START_ROAD_CARD,
          awasDisarmed: false,
          hasHazardCone: false,
        },
        ...STANDARD_ROAD_SEGMENTS.slice(0, 6).map((seg, i) => ({
          trackOrder: i + 1,
          card: seg,
          awasDisarmed: false,
          hasHazardCone: false,
        })),
      ];

      const namedPlayers = buildMockPlayers();
      namedPlayers[0] = {
        ...namedPlayers[0],
        name: 'Planta',
        pos: { trackOrder: 1, lane: 'LEFT', slot: 0 },
        hasLockedPlan: true,
        myPlannedCard: 3,
      };
      namedPlayers[1] = {
        ...namedPlayers[1],
        name: 'Uncle Muthu',
        pos: { trackOrder: 4, lane: 'RIGHT', slot: 1 },
        hasLockedPlan: false,
      };

      mountSnapshot(
        buildMockView({
          roundNumber: 2,
          phase: 'PLANNING',
          players: namedPlayers,
          visibleTrack: longTrack,
          recentMoves: [],
          logs: [
            {
              round: 1,
              key: 'BK.LOG_BLADDER_3_STRESS',
              params: { name: 'Uncle Muthu' },
              tone: 'warn',
            },
          ],
        }),
        0
      );
      fixture.detectChanges();

      const root: HTMLElement = fixture.nativeElement;

      // 1. Named bot pawn labels replace generic P2/P3
      expect(component.getPawnLabel(namedPlayers[1])).toBe('Muthu');
      expect(
        component.getPawnLabel({
          ...namedPlayers[1],
          name: '   ',
        })
      ).toBe('#2');
      const pawnTexts = Array.from(root.querySelectorAll('.pawn-label')).map(
        (el) => el.textContent?.trim() ?? ''
      );
      expect(pawnTexts.includes('P2')).toBe(false);
      expect(pawnTexts.includes('Muthu')).toBe(true);

      // 2. Zero-scroll 5-card window anchored on my car (trackOrder 1 -> orders 1..5)
      expect(component.displayedTrack().map((s) => s.trackOrder)).toEqual([1, 2, 3, 4, 5]);
      expect(component.canPanTrackLeft()).toBe(true);
      expect(component.canPanTrackRight()).toBe(true);

      component.panTrack(1);
      expect(component.displayedTrack().map((s) => s.trackOrder)).toEqual([2, 3, 4, 5, 6]);
      component.panTrack(-2);
      expect(component.displayedTrack().map((s) => s.trackOrder)).toEqual([0, 1, 2, 3, 4]);
      component.focusMyCar();
      expect(component.displayedTrack().map((s) => s.trackOrder)).toEqual([1, 2, 3, 4, 5]);

      // 3. Round Stepper & PLANNING Ceremony Banner + Clean-Up Recap
      expect(component.activeRoundStep()).toBe(2);
      expect(component.planningReadiness()).toEqual({ ready: 1, total: 2 });
      expect(component.lastRoundCleanupLogs().length).toBe(1);
      expect(root.querySelectorAll('.phase-stepper-bar .round-step-pill').length).toBe(4);
      expect(
        root.querySelector('.ceremony-stage-banner')?.getAttribute('data-ceremony')
      ).toBe('PLANNING');
      expect(root.querySelectorAll('.cleanup-recap-row').length).toBe(1);

      // 4. Simultaneous Reveal -> RESOLVING Convoy Strip & Bot Move NEVER Shifts My Camera!
      const scrollCalls: number[] = [];
      component.scrollTrackToOrder = (ord: number) => {
        scrollCalls.push(ord);
      };

      const botMovedPlayers = namedPlayers.map((p) =>
        p.seat === 1
          ? {
              ...p,
              pos: { trackOrder: 5, lane: 'RIGHT' as const, slot: 1 },
              revealedCard: 4 as const,
            }
          : { ...p, revealedCard: 3 as const }
      );

      mountSnapshot(
        buildMockView({
          roundNumber: 2,
          phase: 'RESOLVING',
          activeSeat: 0,
          resolutionQueue: [1, 0],
          players: botMovedPlayers,
          visibleTrack: longTrack,
          recentMoves: [
            {
              moveSeq: 1,
              seat: 1,
              trail: [
                { trackOrder: 4, lane: 'RIGHT', slot: 1 },
                { trackOrder: 5, lane: 'RIGHT', slot: 0 },
                { trackOrder: 5, lane: 'RIGHT', slot: 1 },
              ],
            },
          ],
        }),
        0
      );
      fixture.detectChanges();

      expect(component.activeRoundStep()).toBe(3);
      expect(
        root.querySelector('.ceremony-stage-banner')?.getAttribute('data-ceremony')
      ).toBe('RESOLVING');
      expect(root.querySelectorAll('.convoy-order-chip').length).toBe(2);
      // While bot (seat 1) animates, convoyResolutionItems marks seat 1 as DRIVING
      expect(component.convoyResolutionItems().at(0)?.status).toBe('DRIVING');
      expect(component.convoyResolutionItems().at(0)?.name).toBe('Uncle Muthu');

      vi.advanceTimersByTime(550);
      fixture.detectChanges();

      // Bot finished moving -> zero camera scroll calls and window STILL anchored on my car (1..5)!
      expect(scrollCalls).toEqual([]);
      expect(component.displayedTrack().map((s) => s.trackOrder)).toEqual([1, 2, 3, 4, 5]);
      // Now activeSeat is 0 -> seat 1 is DONE and seat 0 is DRIVING!
      expect(component.convoyResolutionItems().at(0)?.status).toBe('DONE');
      expect(component.convoyResolutionItems().at(1)?.status).toBe('DRIVING');
    } finally {
      vi.useRealTimers();
    }
  });
});
