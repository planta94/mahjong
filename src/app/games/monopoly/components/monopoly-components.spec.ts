import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { routes } from '../../../app.routes';
import { ShellUiService } from '../../../core/services/shell-ui.service';
import { MonopolySessionService } from '../services/monopoly-session.service';
import { MonopolyBoardComponent } from './monopoly-board/monopoly-board.component';
import { MonopolyLobbyComponent } from './monopoly-lobby/monopoly-lobby.component';

describe('Monopoly Components (Lobby & 11x11 Board)', () => {
  describe('MonopolyLobbyComponent', () => {
    async function setupLobby(): Promise<{
      fixture: ComponentFixture<MonopolyLobbyComponent>;
      comp: MonopolyLobbyComponent;
      session: MonopolySessionService;
      shellUi: ShellUiService;
    }> {
      await TestBed.configureTestingModule({
        imports: [MonopolyLobbyComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const session = TestBed.inject(MonopolySessionService);
      const shellUi = TestBed.inject(ShellUiService);
      const fixture = TestBed.createComponent(MonopolyLobbyComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();
      return { fixture, comp, session, shellUi };
    }

    it('renders pre-room configuration cards, selects, and action buttons', async () => {
      const { fixture, comp, shellUi } = await setupLobby();

      expect(shellUi.activeGame()).toBe('monopoly');
      expect(comp.playerCount).toBe(4);
      expect(comp.winCondition).toBe('lastTycoon');
      expect(comp.auctionEnabled).toBe(true);

      const host = fixture.nativeElement as HTMLElement;
      const title = host.querySelector('.lobby-title');
      expect(title?.textContent?.trim().length).toBeGreaterThan(0);

      const btns = host.querySelectorAll('.actions-row button');
      expect(btns.length).toBe(2); // Solo + Create Room

      comp.leaveRoom();
    });

    it('launches quick solo match with AI bots when clicked', async () => {
      const { fixture, comp, session } = await setupLobby();

      comp.startSolo();
      fixture.detectChanges();

      const snap = session.snapshot();
      expect(snap?.lobby?.started).toBe(true);
      expect(snap?.view?.players.length).toBe(4);

      comp.leaveRoom();
    });

    it('handles seat toggling, multiplayer room joining, and match launching from waiting room', async () => {
      const { fixture, comp, session } = await setupLobby();

      // Create room
      comp.createRoom();
      fixture.detectChanges();

      // Toggle seat 1 to bot
      comp.toggleSeat(1);
      expect(session.snapshot()?.lobby?.seats[1].kind).toBe('bot');

      // Start match
      comp.startMatch();
      expect(session.snapshot()?.lobby?.started).toBe(true);

      comp.leaveRoom();

      // Join room with code
      comp.joinCode = 'PTEST1';
      comp.joinRoom();
      expect(session.snapshot()?.role).toBe('guest');

      comp.leaveRoom();
    });
  });

  describe('MonopolyBoardComponent', () => {
    async function setupBoard(): Promise<{
      fixture: ComponentFixture<MonopolyBoardComponent>;
      comp: MonopolyBoardComponent;
      session: MonopolySessionService;
    }> {
      await TestBed.configureTestingModule({
        imports: [MonopolyBoardComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const session = TestBed.inject(MonopolySessionService);
      session.createSoloMatch(4);

      const fixture = TestBed.createComponent(MonopolyBoardComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();
      return { fixture, comp, session };
    }

    it('renders desktop 11x11 grid with 40 English spaces and centered Roll Dice button inside Center Hub', async () => {
      const { fixture, comp, session } = await setupBoard();

      const host = fixture.nativeElement as HTMLElement;
      const spaces = host.querySelectorAll('.board-space');
      expect(spaces.length).toBe(40);
      expect(spaces.item(0).textContent).toContain('GO');
      expect(spaces.item(20).textContent).toContain('Free Parking');

      const hub = host.querySelector('.center-hub');
      expect(hub !== null).toBe(true);

      const centerRollBtn = host.querySelector('.center-hub .hub-center-stage .roll-dice-hero-btn');
      expect(centerRollBtn !== null).toBe(true);

      const jackpot = host.querySelector('.jackpot-amount');
      expect(jackpot?.textContent?.includes('RM')).toBe(true);

      comp.session.leaveRoom();
      session.leaveRoom();
    });

    it('opens property deed modal when a space is clicked', async () => {
      const { fixture, comp, session } = await setupBoard();

      // Click on space 1 (A Famosa Fort, Melaka)
      comp.openDeed(1);
      fixture.detectChanges();

      expect(session.showDeedModal()).toBe(true);
      expect(comp.selectedSpace()?.name).toBe('A Famosa Fort, Melaka');

      const host = fixture.nativeElement as HTMLElement;
      const deedTitle = host.querySelector('.dialog-title');
      expect(deedTitle?.textContent).toBe('A Famosa Fort, Melaka');

      comp.closeDeed();
      fixture.detectChanges();
      expect(session.showDeedModal()).toBe(false);

      session.leaveRoom();
    });

    it('opens and closes trade modal with cash and property selectors', async () => {
      const { fixture, comp, session } = await setupBoard();

      comp.openTrade();
      fixture.detectChanges();

      expect(session.showTradeModal()).toBe(true);

      const host = fixture.nativeElement as HTMLElement;
      const tradeHeader = host.querySelector('.modal-card h2');
      expect(tradeHeader !== null).toBe(true);

      comp.closeTrade();
      fixture.detectChanges();
      expect(session.showTradeModal()).toBe(false);

      session.leaveRoom();
    });

    it('renders mobile cards without redundant turn card, highlights active player marker, and shows tappable owned property deeds', async () => {
      const { fixture, comp, session } = await setupBoard();

      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelectorAll('.turn-mobile-card').length).toBe(0);
      expect(host.querySelectorAll('.mobile-cards').length).toBe(1);

      const mobileJackpot = host.querySelector('.jackpot-mobile-text');
      expect(mobileJackpot?.textContent?.includes('RM')).toBe(true);

      const assetRows = host.querySelectorAll('.mobile-cards .player-asset-row');
      expect(assetRows.length).toBe(4);
      expect(host.querySelectorAll('.player-token.is-active-token').length).toBe(1);

      // Assign Space 1 (A Famosa) with 2 houses to Seat 0 and verify mobile deed chip renders & opens modal
      const snap = session.snapshot();
      if (snap?.view) {
        session.snapshot.set({
          ...snap,
          view: {
            ...snap.view,
            properties: snap.view.properties.map(([idx, pr]) =>
              idx === 1 ? [idx, { ...pr, ownerSeat: 0, houses: 2 }] : [idx, pr]
            ),
          },
        });
        fixture.detectChanges();

        const mobileDeeds = host.querySelectorAll('.mobile-cards .deed-chip');
        expect(mobileDeeds.length).toBe(1);
        expect(mobileDeeds.item(0).textContent).toContain('A Famosa');
        expect(mobileDeeds.item(0).textContent).toContain('🏠×2');

        (mobileDeeds.item(0) as HTMLButtonElement).click();
        fixture.detectChanges();
        expect(session.showDeedModal()).toBe(true);
        expect(comp.selectedSpace()?.index).toBe(1);
      }

      session.leaveRoom();
      comp.session.leaveRoom();
    });

    it('exercises player turn actions, auctions, trades, and property management handlers', async () => {
      const { fixture, comp, session } = await setupBoard();

      // Turn actions
      comp.rollDice();
      comp.buyProperty();
      comp.passProperty();
      comp.endTurn();

      // Property management
      comp.buildHouse(1);
      comp.sellHouse(1);
      comp.mortgage(1);
      comp.unmortgage(1);

      // Jail handlers
      comp.payBail();
      comp.useJailCard();

      // Auction handlers
      comp.bidAuction(100);
      comp.passAuction();

      // Trade property toggling and proposal
      comp.toggleTradeOfferProp(1);
      expect(comp.tradeOfferProps).toContain(1);
      comp.toggleTradeOfferProp(1);
      expect(comp.tradeOfferProps).not.toContain(1);

      comp.toggleTradeRequestProp(3);
      expect(comp.tradeRequestProps).toContain(3);
      comp.toggleTradeRequestProp(3);
      expect(comp.tradeRequestProps).not.toContain(3);

      comp.proposeTrade();
      comp.acceptTrade();
      comp.rejectTrade();

      // Helpers
      expect(comp.getSpaceName(1)).toBe('A Famosa Fort, Melaka');
      expect(comp.getPlayerName(0)).toBe('雀友');
      expect(comp.getUnmortgageCost(100)).toBe(110);

      const p0 = comp.myPlayer();
      if (p0) {
        expect(comp.calculatePlayerNetWorth(p0)).toBeGreaterThan(0);
      }

      const myProps = comp.getMyOwnedProperties();
      expect(Array.isArray(myProps)).toBe(true);
      const targetProps = comp.getTargetOwnedProperties();
      expect(Array.isArray(targetProps)).toBe(true);

      // Color and layout helpers
      expect(comp.getGroupColor('brown')).toBe('#8b5a2b');
      expect(comp.getGroupColor(undefined)).toBe('transparent');
      expect(comp.getSpaceGridStyle(0)['grid-row']).toBe('11');
      expect(comp.getOwnerColor(1)).toBeNull(); // Space 1 unowned

      // Players on space 0 (GO) - players 1, 2, 3 remain on GO (plus player 0 if advance_mula was drawn)
      const playersOnGo = comp.getPlayersOnSpace(0);
      expect([3, 4]).toContain(playersOnGo.length);

      // Render Auction & Bankruptcy modals
      session.showAuctionModal.set(true);
      fixture.detectChanges();
      expect(session.showAuctionModal()).toBe(true);
      session.showAuctionModal.set(false);

      session.showBankruptcyModal.set(true);
      fixture.detectChanges();
      expect(session.showBankruptcyModal()).toBe(true);
      session.showBankruptcyModal.set(false);

      // Owned and mortgaged property branches
      const snap = session.snapshot();
      if (snap?.view) {
        const prop1 = snap.view.properties.find(([idx]) => idx === 1);
        if (prop1) {
          prop1[1].ownerSeat = 0;
          expect(comp.getOwnerColor(1)).toBe(p0?.color ?? '#e63946');

          prop1[1].isMortgaged = true;
          if (p0) {
            expect(comp.calculatePlayerNetWorth(p0)).toBeGreaterThan(0);
          }
        }

        // Test incoming trade and unowned landing signals via snapshot update
        session.snapshot.set({
          ...snap,
          view: {
            ...snap.view,
            activeSeat: 0,
            pendingTrade: {
              fromSeat: 1,
              toSeat: 0,
              offerCash: 10,
              offerProperties: [],
              requestCash: 0,
              requestProperties: [],
            },
            properties: snap.view.properties.map(([idx, pr]) =>
              idx === 3 ? [idx, { ...pr, ownerSeat: null }] : [idx, pr]
            ),
            players: snap.view.players.map((p) =>
              p.seat === 0 ? { ...p, position: 3 } : p
            ),
          },
        });
        expect(comp.incomingTrade()?.fromSeat).toBe(1);
        expect(comp.isUnownedLanding()).toBe(true);
      }

      comp.declareBankruptcy();
      comp.returnToLobby();
      comp.returnToHub();

      session.leaveRoom();
    });
  });
});

