import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../../../app.routes';
import { GameSessionManagerService } from '../../../../core/services/game-session-manager.service';
import { ShellUiService } from '../../../../core/services/shell-ui.service';
import { ColorGroup, MonopolyPlayerView, PropertyState } from '../../models/monopoly.model';
import { MonopolySessionService } from '../../services/monopoly-session.service';
import { MonopolyBoardComponent } from './monopoly-board.component';

describe('MonopolyBoardComponent', () => {
  let activeSession: MonopolySessionService | null = null;

  afterEach(() => {
    vi.useRealTimers();
    activeSession?.leaveRoom();
    activeSession = null;
    vi.restoreAllMocks();
  });

  async function setupBoard(preCreateMatch = true): Promise<{
    fixture: ComponentFixture<MonopolyBoardComponent>;
    comp: MonopolyBoardComponent;
    session: MonopolySessionService;
    shellUi: ShellUiService;
    gameManager: GameSessionManagerService;
    router: Router;
  }> {
    await TestBed.configureTestingModule({
      imports: [MonopolyBoardComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();

    const session = TestBed.inject(MonopolySessionService);
    session.leaveRoom();
    activeSession = session;

    const shellUi = TestBed.inject(ShellUiService);
    const gameManager = TestBed.inject(GameSessionManagerService);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    if (preCreateMatch) {
      session.createSoloMatch(4);
    }

    const fixture = TestBed.createComponent(MonopolyBoardComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return { fixture, comp, session, shellUi, gameManager, router };
  }

  function patchView(
    session: MonopolySessionService,
    updater: (view: MonopolyPlayerView) => MonopolyPlayerView
  ): void {
    const snap = session.snapshot();
    if (!snap?.view) return;
    session.snapshot.set({
      ...snap,
      view: updater(snap.view),
    });
  }

  function withUpdatedProps(
    properties: readonly [number, PropertyState][],
    overrides: ReadonlyMap<number, Partial<PropertyState>>
  ): [number, PropertyState][] {
    return properties.map(([idx, state]) => {
      const patch = overrides.get(idx);
      return patch ? [idx, { ...state, ...patch }] : [idx, state];
    });
  }

  it('auto-starts a 4-player solo match on init when no snapshot exists and renders 40 perimeter spaces across 11x11 grid edges', async () => {
    const { fixture, comp, session, shellUi } = await setupBoard(false);
    const host = fixture.nativeElement as HTMLElement;

    expect(shellUi.activeGame()).toBe('monopoly');
    expect(session.snapshot()?.view?.players.length).toBe(4);

    const spaces = host.querySelectorAll('.monopoly-grid .board-space');
    expect(spaces.length).toBe(40);
    expect(host.querySelectorAll('.monopoly-grid .board-space.is-corner').length).toBe(4);
    expect(spaces.item(0).textContent).toContain('GO');
    expect(spaces.item(10).textContent).toContain('Jail');
    expect(spaces.item(20).textContent).toContain('Free Parking');
    expect(spaces.item(30).textContent).toContain('Go To Jail');

    // Bottom edge (row 11, cols 11 -> 1)
    expect(comp.getSpaceGridStyle(0)).toEqual({ 'grid-row': '11', 'grid-column': '11' });
    expect(comp.getSpaceGridStyle(5)).toEqual({ 'grid-row': '11', 'grid-column': '6' });
    expect(comp.getSpaceGridStyle(10)).toEqual({ 'grid-row': '11', 'grid-column': '1' });

    // Left edge (rows 10 -> 2, col 1)
    expect(comp.getSpaceGridStyle(11)).toEqual({ 'grid-row': '10', 'grid-column': '1' });
    expect(comp.getSpaceGridStyle(15)).toEqual({ 'grid-row': '6', 'grid-column': '1' });
    expect(comp.getSpaceGridStyle(19)).toEqual({ 'grid-row': '2', 'grid-column': '1' });

    // Top edge (row 1, cols 1 -> 11)
    expect(comp.getSpaceGridStyle(20)).toEqual({ 'grid-row': '1', 'grid-column': '1' });
    expect(comp.getSpaceGridStyle(25)).toEqual({ 'grid-row': '1', 'grid-column': '6' });
    expect(comp.getSpaceGridStyle(30)).toEqual({ 'grid-row': '1', 'grid-column': '11' });

    // Right edge (rows 2 -> 10, col 11) and out-of-bounds fallback
    expect(comp.getSpaceGridStyle(31)).toEqual({ 'grid-row': '2', 'grid-column': '11' });
    expect(comp.getSpaceGridStyle(35)).toEqual({ 'grid-row': '6', 'grid-column': '11' });
    expect(comp.getSpaceGridStyle(39)).toEqual({ 'grid-row': '10', 'grid-column': '11' });
    expect(comp.getSpaceGridStyle(99)).toEqual({ 'grid-row': '1', 'grid-column': '1' });

    expect(comp.getGroupColor('brown')).toBe('#8b5a2b');
    expect(comp.getGroupColor('dark_blue')).toBe('#1e40af');
    expect(comp.getGroupColor(undefined)).toBe('transparent');

    session.leaveRoom();
  });

  it('displays Free Parking jackpot vault, round/win-mode strip, and drawn card banner', async () => {
    const { fixture, session } = await setupBoard();
    const host = fixture.nativeElement as HTMLElement;

    patchView(session, (view) => ({
      ...view,
      jackpotPot: 450,
      currentRound: 7,
      maxRounds: 20,
      winCondition: 'roundLimit',
      activeCard: {
        id: 'nasib_test',
        deck: 'nasib',
        titleKey: 'MONOPOLY.UI_DRAWN_NASIB',
        descKey: 'MONOPOLY.POT_TITLE',
        actionType: 'collect_bank',
        amount: 100,
      },
    }));
    fixture.detectChanges();

    expect(host.querySelector('.jackpot-amount')?.textContent?.trim()).toBe('RM 450');
    expect(host.querySelector('.jackpot-mobile-text')?.textContent?.trim()).toBe('RM 450');
    expect(host.querySelector('.round-badge')?.textContent).toContain('7 / 20');
    expect(host.querySelector('.drawn-card-banner.deck-nasib') !== null).toBe(true);

    session.leaveRoom();
  });

  it('renders mobile cards asset rows and tappable property deeds with houses, hotel, and mortgaged badges', async () => {
    const { fixture, comp, session } = await setupBoard();
    const host = fixture.nativeElement as HTMLElement;

    patchView(session, (view) => ({
      ...view,
      players: view.players.map((p) =>
        p.seat === 0 ? { ...p, cash: 1000, outOfJailCards: 1 } : p
      ),
      properties: withUpdatedProps(
        view.properties,
        new Map<number, Partial<PropertyState>>([
          [1, { ownerSeat: 0, houses: 3, isMortgaged: false }], // A Famosa: cost 60 + 3*50 = 210
          [3, { ownerSeat: 0, houses: 5, isMortgaged: false }], // Jonker Walk: cost 60 + 5*50 = 310
          [6, { ownerSeat: 0, houses: 0, isMortgaged: true }], // Kellie's Castle: mortgageValue 50
        ])
      ),
    }));
    fixture.detectChanges();

    const assetRows = host.querySelectorAll('.mobile-cards .player-asset-row');
    expect(assetRows.length).toBe(4);

    const p0 = comp.myPlayer();
    expect(p0 !== null).toBe(true);
    if (p0) {
      // 1000 cash + 50 jail card + 210 + 310 + 50 = 1620
      expect(comp.calculatePlayerNetWorth(p0)).toBe(1620);
    }

    // Board badges
    expect(host.querySelector('.monopoly-grid .badge-houses')?.textContent?.trim()).toBe('🏠×3');
    expect(host.querySelector('.monopoly-grid .badge-hotel')?.textContent?.trim()).toBe('🏨');
    expect(host.querySelector('.monopoly-grid .badge-mortgaged')?.textContent?.trim()).toBe('M');
    expect(comp.getOwnerColor(1)).toBe(p0?.color ?? '#e63946');
    expect(comp.getOwnerColor(8)).toBeNull();

    // Mobile tappable property deeds
    const mobileDeeds = host.querySelectorAll('.mobile-cards .deed-chip');
    expect(mobileDeeds.length).toBe(3);
    expect(mobileDeeds.item(0).textContent).toContain('A Famosa');
    expect(mobileDeeds.item(0).textContent).toContain('🏠×3');
    expect(mobileDeeds.item(1).textContent).toContain('Jonker Walk');
    expect(mobileDeeds.item(1).textContent).toContain('🏨');
    expect(mobileDeeds.item(2).classList.contains('is-mortgaged')).toBe(true);
    expect(mobileDeeds.item(2).textContent).toContain('(M)');

    (mobileDeeds.item(1) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(session.showDeedModal()).toBe(true);
    expect(comp.selectedSpace()?.index).toBe(3);

    session.leaveRoom();
  });

  it('opens deed modal and dispatches build/sell house, mortgage/unmortgage, and close actions', async () => {
    const { fixture, comp, session } = await setupBoard();
    const host = fixture.nativeElement as HTMLElement;
    const dispatchSpy = vi.spyOn(session, 'dispatchAction').mockImplementation(() => {});

    // 1. Owned property with 0 houses, unmortgaged -> Build & Mortgage available
    patchView(session, (view) => ({
      ...view,
      properties: withUpdatedProps(
        view.properties,
        new Map<number, Partial<PropertyState>>([
          [1, { ownerSeat: 0, houses: 0, isMortgaged: false }],
        ])
      ),
    }));
    comp.openDeed(1);
    fixture.detectChanges();

    expect(session.showDeedModal()).toBe(true);
    expect(host.querySelector('.deed-modal .dialog-title')?.textContent).toBe('A Famosa Fort, Melaka');
    expect(host.querySelectorAll('.deed-modal .rent-row').length).toBe(6);
    expect(host.querySelector('.deed-modal .modal-header button')).toBeNull();

    const controlsZeroHouses = host.querySelectorAll('.deed-modal .management-controls button');
    expect(controlsZeroHouses.length).toBe(2);
    (controlsZeroHouses.item(0) as HTMLButtonElement).click(); // buildHouse
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'buildHouse', spaceIndex: 1 });

    (controlsZeroHouses.item(1) as HTMLButtonElement).click(); // mortgage
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'mortgageProperty', spaceIndex: 1 });

    // 2. Owned property with 2 houses -> Build & Sell available
    patchView(session, (view) => ({
      ...view,
      properties: withUpdatedProps(
        view.properties,
        new Map<number, Partial<PropertyState>>([
          [1, { ownerSeat: 0, houses: 2, isMortgaged: false }],
        ])
      ),
    }));
    fixture.detectChanges();

    const controlsTwoHouses = host.querySelectorAll('.deed-modal .management-controls button');
    expect(controlsTwoHouses.length).toBe(2);
    (controlsTwoHouses.item(1) as HTMLButtonElement).click(); // sellHouse
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'sellHouse', spaceIndex: 1 });

    // 3. Owned mortgaged property -> Unmortgage available
    patchView(session, (view) => ({
      ...view,
      properties: withUpdatedProps(
        view.properties,
        new Map<number, Partial<PropertyState>>([
          [1, { ownerSeat: 0, houses: 0, isMortgaged: true }],
        ])
      ),
    }));
    fixture.detectChanges();

    expect(comp.getUnmortgageCost(30)).toBe(33);
    expect(comp.getUnmortgageCost(undefined)).toBe(55);
    const controlsMortgaged = host.querySelectorAll('.deed-modal .management-controls button');
    expect(controlsMortgaged.length).toBe(1);
    (controlsMortgaged.item(0) as HTMLButtonElement).click(); // unmortgage
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'unmortgageProperty', spaceIndex: 1 });

    // 4. Non-property transit space omits rent schedule table
    comp.openDeed(5);
    fixture.detectChanges();
    expect(host.querySelector('.deed-modal .dialog-title')?.textContent).toBe('KL Sentral Station');
    expect(host.querySelector('.deed-modal .deed-rent-table')).toBeNull();

    // 5. Close deed via footer button
    const closeBtn = host.querySelector('.deed-modal .modal-footer button') as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();
    expect(session.showDeedModal()).toBe(false);

    session.leaveRoom();
  });

  it('dispatches turn actions across roll, jail, unowned landing, financialDistress, and opponent turns', async () => {
    const { fixture, comp, session } = await setupBoard();
    const host = fixture.nativeElement as HTMLElement;
    const dispatchSpy = vi.spyOn(session, 'dispatchAction').mockImplementation(() => {});

    // 1. Roll phase + inJail controls (payBail & useJailCard)
    patchView(session, (view) => ({
      ...view,
      activeSeat: 0,
      phase: 'roll',
      players: view.players.map((p) =>
        p.seat === 0 ? { ...p, position: 10, inJail: true, cash: 500, outOfJailCards: 1 } : p
      ),
    }));
    fixture.detectChanges();

    const rollPhaseBtns = host.querySelectorAll('.hub-actions button');
    expect(rollPhaseBtns.length).toBe(4); // Roll, Pay Bail, Use Card, Trade

    vi.useFakeTimers();
    (rollPhaseBtns.item(0) as HTMLButtonElement).click();
    expect(comp.isDiceRolling()).toBe(true);
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'rollDice' });
    vi.advanceTimersByTime(450);
    expect(comp.isDiceRolling()).toBe(false);
    vi.useRealTimers();

    (rollPhaseBtns.item(1) as HTMLButtonElement).click();
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'payJailBail' });

    (rollPhaseBtns.item(2) as HTMLButtonElement).click();
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'useJailCard' });

    // 2. Action phase on unowned property (Space 3: Jonker Walk)
    patchView(session, (view) => ({
      ...view,
      activeSeat: 0,
      phase: 'action',
      players: view.players.map((p) =>
        p.seat === 0 ? { ...p, position: 3, inJail: false } : p
      ),
      properties: withUpdatedProps(
        view.properties,
        new Map<number, Partial<PropertyState>>([[3, { ownerSeat: null }]])
      ),
    }));
    fixture.detectChanges();

    expect(comp.isUnownedLanding()).toBe(true);
    const actionBtns = host.querySelectorAll('.hub-actions button');
    expect(actionBtns.length).toBe(4); // Buy, Pass, End Turn, Trade

    (actionBtns.item(0) as HTMLButtonElement).click();
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'buyProperty' });

    (actionBtns.item(1) as HTMLButtonElement).click();
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'passProperty' });

    (actionBtns.item(2) as HTMLButtonElement).click();
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'endTurn' });

    // 3. Financial distress phase -> Declare bankruptcy
    patchView(session, (view) => ({
      ...view,
      activeSeat: 0,
      phase: 'financialDistress',
      debtTarget: { creditorSeat: 1, amountOwed: 320 },
    }));
    fixture.detectChanges();

    expect(host.querySelector('.distress-banner')?.textContent).toContain('320');
    const bankruptBtn = host.querySelector('.hub-actions .btn-crimson') as HTMLButtonElement;
    bankruptBtn.click();
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'declareBankruptcy' });

    // 4. Opponent turn -> Waiting hint shown instead of action buttons
    patchView(session, (view) => ({
      ...view,
      activeSeat: 1,
      phase: 'roll',
    }));
    fixture.detectChanges();

    expect(session.isMyTurn()).toBe(false);
    expect(host.querySelector('.hub-actions .roll-dice-hero-btn')).toBeNull();
    expect(host.querySelector('.hub-actions .waiting-turn-hint')?.textContent).toContain(
      comp.getPlayerName(1)
    );

    session.leaveRoom();
  });

  it('renders auction modal and dispatches bidAuction and passAuction actions', async () => {
    const { fixture, comp, session } = await setupBoard();
    const host = fixture.nativeElement as HTMLElement;
    const dispatchSpy = vi.spyOn(session, 'dispatchAction').mockImplementation(() => {});

    patchView(session, (view) => ({
      ...view,
      phase: 'auction',
      activeAuction: {
        spaceIndex: 11,
        currentBid: 140,
        highestBidderSeat: 1,
        activeBidders: [0, 1],
        timerSeconds: 15,
      },
    }));
    fixture.detectChanges();

    const auctionCard = host.querySelector('.auction-info-card');
    expect(auctionCard?.querySelector('h3')?.textContent).toBe('George Town, Penang');
    expect(host.querySelector('.current-bid-display')?.textContent).toContain('RM 140');
    expect(host.querySelector('.highest-bidder-display')?.textContent).toContain(comp.getPlayerName(1));

    const footerBtns = host.querySelectorAll('.modal-footer button');
    expect(footerBtns.length).toBe(2);

    (footerBtns.item(0) as HTMLButtonElement).click();
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'bidAuction', amount: 150 });

    (footerBtns.item(1) as HTMLButtonElement).click();
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'passAuction' });

    // When local seat has passed out of activeBidders, waiting message renders
    patchView(session, (view) => ({
      ...view,
      phase: 'auction',
      activeAuction: {
        spaceIndex: 11,
        currentBid: 150,
        highestBidderSeat: 1,
        activeBidders: [1, 2],
        timerSeconds: 12,
      },
    }));
    fixture.detectChanges();
    expect(host.querySelectorAll('.modal-footer button').length).toBe(0);
    expect(host.querySelector('.modal-footer .waiting-turn-hint') !== null).toBe(true);

    session.leaveRoom();
  });

  it('handles outgoing trade proposal modal and incoming trade accept/reject modal', async () => {
    const { fixture, comp, session } = await setupBoard();
    const host = fixture.nativeElement as HTMLElement;
    const dispatchSpy = vi.spyOn(session, 'dispatchAction').mockImplementation(() => {});

    patchView(session, (view) => ({
      ...view,
      activeSeat: 0,
      properties: withUpdatedProps(
        view.properties,
        new Map<number, Partial<PropertyState>>([
          [1, { ownerSeat: 0, houses: 0, isMortgaged: false }],
          [3, { ownerSeat: 1, houses: 0, isMortgaged: false }],
        ])
      ),
    }));
    fixture.detectChanges();

    // Outgoing trade modal
    const openTradeBtn = host.querySelector('.hub-trade-btn') as HTMLButtonElement;
    openTradeBtn.click();
    fixture.detectChanges();

    expect(session.showTradeModal()).toBe(true);
    expect(comp.tradeTargetSeat).toBe(1);
    expect(comp.getMyOwnedProperties().map((s) => s.index)).toEqual([1]);
    expect(comp.getTargetOwnedProperties().map((s) => s.index)).toEqual([3]);

    comp.toggleTradeOfferProp(1);
    expect(comp.tradeOfferProps).toEqual([1]);
    comp.toggleTradeOfferProp(1);
    expect(comp.tradeOfferProps).toEqual([]);
    comp.toggleTradeOfferProp(1);

    comp.toggleTradeRequestProp(3);
    expect(comp.tradeRequestProps).toEqual([3]);
    comp.toggleTradeRequestProp(3);
    expect(comp.tradeRequestProps).toEqual([]);
    comp.toggleTradeRequestProp(3);

    comp.tradeOfferCash = 120;
    comp.tradeRequestCash = 40;
    fixture.detectChanges();

    const proposeBtn = host.querySelectorAll('.modal-footer button').item(0) as HTMLButtonElement;
    proposeBtn.click();
    fixture.detectChanges();

    expect(session.showTradeModal()).toBe(false);
    expect(dispatchSpy).toHaveBeenLastCalledWith({
      type: 'proposeTrade',
      trade: {
        fromSeat: 0,
        toSeat: 1,
        offerCash: 120,
        offerProperties: [1],
        requestCash: 40,
        requestProperties: [3],
      },
    });

    // Incoming trade targeting another player does not open local incoming modal
    patchView(session, (view) => ({
      ...view,
      pendingTrade: {
        fromSeat: 1,
        toSeat: 2,
        offerCash: 80,
        offerProperties: [3],
        requestCash: 0,
        requestProperties: [],
      },
    }));
    fixture.detectChanges();
    expect(comp.incomingTrade()).toBeNull();

    // Incoming trade targeting local seat (seat 0) opens modal with accept/reject controls
    patchView(session, (view) => ({
      ...view,
      pendingTrade: {
        fromSeat: 1,
        toSeat: 0,
        offerCash: 200,
        offerProperties: [3],
        requestCash: 50,
        requestProperties: [1],
      },
    }));
    fixture.detectChanges();

    expect(comp.incomingTrade()?.fromSeat).toBe(1);
    const summaryBox = host.querySelector('.trade-summary-box');
    expect(summaryBox?.textContent).toContain('RM 200');
    expect(summaryBox?.textContent).toContain('Jonker Walk, Melaka');
    expect(summaryBox?.textContent).toContain('RM 50');
    expect(summaryBox?.textContent).toContain('A Famosa Fort, Melaka');

    const incomingBtns = host.querySelectorAll('.modal-footer button');
    expect(incomingBtns.length).toBe(2);

    (incomingBtns.item(0) as HTMLButtonElement).click();
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'acceptTrade' });

    (incomingBtns.item(1) as HTMLButtonElement).click();
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'rejectTrade' });

    session.leaveRoom();
  });

  it('renders gameOver modal with desktop table and mobile cards, and handles returnToLobby and returnToHub', async () => {
    const { fixture, comp, session, gameManager, router } = await setupBoard();
    const host = fixture.nativeElement as HTMLElement;

    // Mid-game returnToHub prompts exit confirmation instead of immediately killing session
    vi.mocked(router.navigate).mockClear();
    comp.returnToHub();
    expect(gameManager.showExitConfirmModal()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalledWith(['/']);
    gameManager.cancelExitConfirm();

    // Transition to gameOver
    patchView(session, (view) => ({
      ...view,
      phase: 'gameOver',
      winnerSeat: 0,
      gameOverReason: 'All rival tycoons declared bankruptcy.',
    }));
    fixture.detectChanges();

    expect(host.querySelector('.winner-name')?.textContent?.trim()).toBe(comp.getPlayerName(0));
    expect(host.querySelector('.game-over-reason')?.textContent?.trim()).toBe(
      'All rival tycoons declared bankruptcy.'
    );
    expect(host.querySelectorAll('.modal-body table.desktop-table tbody tr').length).toBe(4);
    expect(host.querySelectorAll('.modal-body .mobile-cards .mobile-app-card').length).toBe(4);

    // Return to Hub from gameOver kills active sessions and navigates to '/'
    const hubBtn = host.querySelectorAll('.modal-footer button').item(1) as HTMLButtonElement;
    hubBtn.click();
    expect(session.snapshot()).toBeNull();
    expect(router.navigate).toHaveBeenLastCalledWith(['/']);

    // Re-seed gameOver and test Return to Lobby
    session.createSoloMatch(3);
    patchView(session, (view) => ({
      ...view,
      phase: 'gameOver',
      winnerSeat: 0,
      gameOverReason: 'Round limit reached.',
    }));
    fixture.detectChanges();

    const lobbyBtn = host.querySelectorAll('.modal-footer button').item(0) as HTMLButtonElement;
    lobbyBtn.click();
    expect(session.snapshot()).toBeNull();
    expect(router.navigate).toHaveBeenLastCalledWith(['/monopoly/lobby']);

    session.leaveRoom();
  });

  it('covers board-space click, sidebar deed-chip click, deed backdrop close, bankrupt badge, and corner/tax/utility deed inspection', async () => {
    const { fixture, comp, session, shellUi } = await setupBoard();
    const host = fixture.nativeElement as HTMLElement;
    const sfxSpy = vi.spyOn(shellUi, 'playSfx');

    patchView(session, (view) => ({
      ...view,
      players: view.players.map((p) => (p.seat === 2 ? { ...p, bankrupt: true } : p)),
      properties: withUpdatedProps(
        view.properties,
        new Map<number, Partial<PropertyState>>([
          [1, { ownerSeat: 99, houses: 0, isMortgaged: false }],
          [5, { ownerSeat: 0, houses: 0, isMortgaged: false }],
          [12, { ownerSeat: 0, houses: 0, isMortgaged: false }],
        ])
      ).filter(([idx]) => idx !== 39),
    }));
    fixture.detectChanges();

    expect(comp.getPlayersOnSpace(0).length).toBe(3);
    expect(host.querySelectorAll('.board-sidebar .tycoon-card.is-bankrupt').length).toBe(1);
    expect(comp.getOwnerColor(1)).toBe('#8b949e');

    // Click sidebar non-colorGroup transit deed chip (hits sidebar click listener & #94a3b8 border fallback)
    sfxSpy.mockClear();
    const sidebarDeedBtn = host.querySelector('.board-sidebar .tycoon-deeds .deed-chip') as HTMLButtonElement;
    sidebarDeedBtn.click();
    fixture.detectChanges();

    expect(sfxSpy).toHaveBeenCalledWith('click');
    expect(session.showDeedModal()).toBe(true);
    expect(comp.selectedSpace()?.index).toBe(5);

    // Close deed modal via backdrop click
    (host.querySelector('.modal-backdrop') as HTMLElement).click();
    fixture.detectChanges();
    expect(session.showDeedModal()).toBe(false);

    // Click GO corner space directly on the 11x11 board grid (no cost, no mortgageValue)
    (host.querySelectorAll('.monopoly-grid .board-space').item(0) as HTMLElement).click();
    fixture.detectChanges();
    expect(session.showDeedModal()).toBe(true);
    expect(comp.selectedSpace()?.type).toBe('corner_go');
    expect(comp.selectedPropState()).toBeNull();
    expect(host.querySelectorAll('.deed-modal .deed-meta-box p').length).toBe(0);

    // Tax space (cost only, no mortgageValue)
    comp.openDeed(4);
    fixture.detectChanges();
    expect(host.querySelectorAll('.deed-modal .deed-meta-box p').length).toBe(1);

    // Utility space (cost and mortgageValue)
    comp.openDeed(12);
    fixture.detectChanges();
    expect(host.querySelectorAll('.deed-modal .deed-meta-box p').length).toBe(2);

    // Property omitted from view.properties (selectedPropState() === null) and opponent-owned property
    comp.openDeed(39);
    fixture.detectChanges();
    expect(comp.selectedPropState()).toBeNull();
    expect(host.querySelector('.deed-modal .management-controls')).toBeNull();

    comp.openDeed(1);
    fixture.detectChanges();
    expect(comp.selectedPropState()?.ownerSeat).toBe(99);
    expect(host.querySelector('.deed-modal .management-controls')).toBeNull();

    session.leaveRoom();
  });

  it('covers trade modal DOM bindings, cancel and backdrop close, cash-only incoming trade, and auction/gameOver fallbacks', async () => {
    const { fixture, comp, session, shellUi } = await setupBoard();
    const host = fixture.nativeElement as HTMLElement;
    const sfxSpy = vi.spyOn(shellUi, 'playSfx');

    patchView(session, (view) => ({
      ...view,
      activeSeat: 0,
      properties: withUpdatedProps(
        view.properties,
        new Map<number, Partial<PropertyState>>([
          [1, { ownerSeat: 0, houses: 0, isMortgaged: false }],
          [3, { ownerSeat: 1, houses: 0, isMortgaged: false }],
          [6, { ownerSeat: 2, houses: 0, isMortgaged: false }],
        ])
      ),
    }));
    fixture.detectChanges();

    sfxSpy.mockClear();
    (host.querySelector('.hub-trade-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(sfxSpy).toHaveBeenCalledWith('click');
    expect(session.showTradeModal()).toBe(true);

    // Switch partner via <select [(ngModel)]="tradeTargetSeat">
    const partnerSelect = host.querySelector('#trade-partner-select') as HTMLSelectElement;
    partnerSelect.selectedIndex = 1;
    partnerSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.tradeTargetSeat).toBe(2);
    expect(comp.getTargetOwnedProperties().map((s) => s.index)).toEqual([6]);

    // Update cash fields via <input type="number" [(ngModel)]="...">
    const cashInputs = host.querySelectorAll('.trade-col input[type="number"]');
    const offerInput = cashInputs.item(0) as HTMLInputElement;
    offerInput.value = '180';
    offerInput.dispatchEvent(new Event('input'));

    const requestInput = cashInputs.item(1) as HTMLInputElement;
    requestInput.value = '65';
    requestInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(comp.tradeOfferCash).toBe(180);
    expect(comp.tradeRequestCash).toBe(65);

    // Toggle property checkboxes via DOM change events
    const tradeCols = host.querySelectorAll('.trade-col');
    const offerCb = tradeCols.item(0).querySelector('input[type="checkbox"]') as HTMLInputElement;
    offerCb.dispatchEvent(new Event('change'));
    const requestCb = tradeCols.item(1).querySelector('input[type="checkbox"]') as HTMLInputElement;
    requestCb.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(comp.tradeOfferProps).toEqual([1]);
    expect(comp.tradeRequestProps).toEqual([6]);

    // Close trade modal via Cancel button
    (host.querySelectorAll('.modal-footer button').item(1) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(session.showTradeModal()).toBe(false);

    // Open trade when all rivals are bankrupt (keeps existing tradeTargetSeat) and close via backdrop click
    patchView(session, (view) => ({
      ...view,
      players: view.players.map((p) => (p.seat === 0 ? p : { ...p, bankrupt: true })),
    }));
    comp.tradeTargetSeat = 2;
    comp.openTrade();
    fixture.detectChanges();
    expect(comp.tradeTargetSeat).toBe(2);

    (host.querySelector('.modal-backdrop') as HTMLElement).click();
    fixture.detectChanges();
    expect(session.showTradeModal()).toBe(false);

    // Cash-only incoming trade (empty offerProperties and requestProperties)
    patchView(session, (view) => ({
      ...view,
      pendingTrade: {
        fromSeat: 1,
        toSeat: 0,
        offerCash: 110,
        offerProperties: [],
        requestCash: 35,
        requestProperties: [],
      },
    }));
    fixture.detectChanges();
    expect(comp.incomingTrade()?.offerCash).toBe(110);
    expect(host.querySelector('.trade-summary-box')?.textContent).toContain('RM 110');

    // Auction modal with highestBidderSeat === null
    patchView(session, (view) => ({
      ...view,
      pendingTrade: null,
      phase: 'auction',
      activeAuction: {
        spaceIndex: 5,
        currentBid: 10,
        highestBidderSeat: null,
        activeBidders: [0, 1],
        timerSeconds: 15,
      },
    }));
    fixture.detectChanges();
    expect(comp.getPlayerName(null)).toBe('');
    expect((host.querySelector('.highest-bidder-display strong')?.textContent ?? '').trim().length).toBeGreaterThan(0);

    // GameOver modal with winnerSeat === null
    patchView(session, (view) => ({
      ...view,
      activeAuction: null,
      phase: 'gameOver',
      winnerSeat: null,
      gameOverReason: 'Mutual tie.',
    }));
    fixture.detectChanges();
    expect((host.querySelector('.winner-name')?.textContent ?? '').trim().length).toBeGreaterThan(0);

    session.leaveRoom();
  });

  it('covers broke prisoner jail state, transit/utility/corner landings, dana card, net worth edge cases, and null-view guards', async () => {
    const { fixture, comp, session } = await setupBoard();
    const host = fixture.nativeElement as HTMLElement;

    // 1. Broke prisoner in jail (cash < 50, outOfJailCards === 0)
    patchView(session, (view) => ({
      ...view,
      activeSeat: 0,
      phase: 'roll',
      players: view.players.map((p) =>
        p.seat === 0 ? { ...p, position: 10, inJail: true, cash: 20, outOfJailCards: 0 } : p
      ),
    }));
    fixture.detectChanges();
    expect(host.querySelectorAll('.hub-actions button').length).toBe(2);

    // 2. Action phase on unowned transit (5), unowned utility (12), and non-buyable GO corner (0)
    patchView(session, (view) => ({
      ...view,
      phase: 'action',
      players: view.players.map((p) =>
        p.seat === 0 ? { ...p, position: 5, inJail: false } : p
      ),
    }));
    fixture.detectChanges();
    expect(comp.isUnownedLanding()).toBe(true);

    patchView(session, (view) => ({
      ...view,
      phase: 'action',
      players: view.players.map((p) => (p.seat === 0 ? { ...p, position: 12 } : p)),
    }));
    fixture.detectChanges();
    expect(comp.isUnownedLanding()).toBe(true);

    patchView(session, (view) => ({
      ...view,
      phase: 'action',
      players: view.players.map((p) => (p.seat === 0 ? { ...p, position: 0 } : p)),
    }));
    fixture.detectChanges();
    expect(comp.landingPropState()).toBeNull();
    expect(comp.isUnownedLanding()).toBe(false);
    expect(host.querySelectorAll('.hub-actions button').length).toBe(2);

    // 3. Financial distress with null debtTarget, Dana card banner, and out-of-bounds landing position
    patchView(session, (view) => ({
      ...view,
      phase: 'financialDistress',
      debtTarget: null,
      activeCard: {
        id: 'dana_test',
        deck: 'dana',
        titleKey: 'MONOPOLY.UI_DRAWN_DANA',
        descKey: 'MONOPOLY.POT_TITLE',
        actionType: 'collect_bank',
        amount: 50,
      },
      players: view.players.map((p) => (p.seat === 0 ? { ...p, position: 999 } : p)),
    }));
    fixture.detectChanges();
    expect(host.querySelector('.drawn-card-banner')?.classList.contains('deck-nasib')).toBe(false);
    expect(comp.landingSpace()).toBeNull();
    expect(comp.landingPropState()).toBeNull();
    expect(host.querySelector('.current-space-chip')).toBeNull();

    // 4. Net worth edge cases: zero-cost space, mortgaged space without mortgageValue, unmortgaged space without houseCost
    const testPlayer = {
      seat: 0,
      name: 'Host',
      cash: 500,
      position: 0,
      inJail: false,
      jailTurns: 0,
      outOfJailCards: 0,
      bankrupt: false,
      color: '#e63946',
    };
    patchView(session, (view) => ({
      ...view,
      properties: [
        [0, { ownerSeat: 0, houses: 0, isMortgaged: false }],
        [4, { ownerSeat: 0, houses: 0, isMortgaged: true }],
        [5, { ownerSeat: 0, houses: 1, isMortgaged: false }],
      ],
    }));
    expect(comp.calculatePlayerNetWorth(testPlayer)).toBe(800);

    // 5. Unmatched activeSeat & mySeat
    const currentSnap = session.snapshot();
    if (currentSnap?.view) {
      session.snapshot.set({
        ...currentSnap,
        mySeat: 99,
        view: {
          ...currentSnap.view,
          activeSeat: 99,
        },
      });
    }
    fixture.detectChanges();
    expect(comp.activePlayer()).toBeNull();
    expect(comp.myPlayer()).toBeNull();
    expect(comp.landingSpace()).toBeNull();

    // 6. Helper fallbacks and null-snapshot defensive guards
    expect(comp.getGroupColor('unknown_group' as ColorGroup)).toBe('#30363d');
    expect(comp.getSpaceName(999)).toBe('');
    expect(comp.getPlayerName(99)).toBe('Player 100');

    session.selectedSpaceIndex.set(null);
    expect(comp.selectedSpace()).toBeNull();
    expect(comp.selectedPropState()).toBeNull();

    session.selectedSpaceIndex.set(999);
    expect(comp.selectedSpace()).toBeNull();

    session.leaveRoom();
    session.selectedSpaceIndex.set(1);
    fixture.detectChanges();

    expect(comp.activePlayer()).toBeNull();
    expect(comp.myPlayer()).toBeNull();
    expect(comp.selectedPropState()).toBeNull();
    expect(comp.getPropertyState(1)).toBeUndefined();
    expect(comp.getPlayersOnSpace(0)).toEqual([]);
    expect(comp.getOwnedSpacesForSeat(0)).toEqual([]);
    comp.openTrade();
    expect(session.showTradeModal()).toBe(false);
    expect(comp.calculatePlayerNetWorth(testPlayer)).toBe(0);
  });
});
