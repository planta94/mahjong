import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { routes } from '../../app.routes';
import { AvalonSessionService } from '../../games/avalon/services/avalon-session.service';
import { BalikKampungSessionService } from '../../games/balik-kampung/services/balik-kampung-session.service';
import { MonopolyBoardComponent } from '../../games/monopoly/components/monopoly-board/monopoly-board.component';
import { MonopolySessionService } from '../../games/monopoly/services/monopoly-session.service';
import { PandemicSessionService } from '../../games/pandemic/services/pandemic-session.service';
import { HubComponent } from '../../pages/hub/hub.component';
import { RealDiceComponent } from '../../shared/dice/real-dice.component';
import { ExitConfirmDialogComponent } from '../../shared/exit-confirm-dialog/exit-confirm-dialog.component';
import { RulebookDialogComponent } from '../../shared/rulebook-dialog/rulebook-dialog.component';
import { GameSessionManagerService, SAVED_GAME_STORAGE_KEY } from './game-session-manager.service';
import { MahjongSessionService } from './mahjong-session.service';
import { DEFAULT_RULES } from './scorer.service';
import { ShellUiService } from './shell-ui.service';
import { TranslateService } from './translate.service';

describe('GameSessionManagerService, ExitConfirmDialog, Multi-Game Rulebook & RealDice', () => {
  beforeEach(() => {
    localStorage.removeItem(SAVED_GAME_STORAGE_KEY);
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.removeItem(SAVED_GAME_STORAGE_KEY);
    sessionStorage.clear();
  });

  describe('1. GameSessionManagerService Save/Resume & Exit Confirmation Lifecycle', () => {
    it('navigates directly home when idle and opens ExitConfirmDialog when any game session is active', async () => {
      await TestBed.configureTestingModule({
        imports: [ExitConfirmDialogComponent, HubComponent],
        providers: [
          provideRouter(routes),
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                queryParamMap: new Map<string, string>(),
              },
            },
          },
        ],
      }).compileComponents();

      const router = TestBed.inject(Router);
      const manager = TestBed.inject(GameSessionManagerService);
      const mahjong = TestBed.inject(MahjongSessionService);

      await router.navigateByUrl('/mahjong/lobby');
      expect(manager.hasActiveProgress()).toBe(false);
      expect(manager.canSaveCurrentProgress()).toBe(false);
      expect(manager.resumeSavedGame()).toBe(false);
      expect(manager.saveCurrentProgress()).toBe(false);

      // Idle requestGoHome navigates directly without opening modal
      manager.requestGoHome();
      expect(manager.showExitConfirmModal()).toBe(false);

      // Start online waiting lobby (has progress, but no started match yet)
      mahjong.createOnlineRoom('LobbyHost', '3p', DEFAULT_RULES);
      expect(manager.hasActiveProgress()).toBe(true);
      expect(manager.hasStartedMatch()).toBe(false);
      expect(manager.hasActiveWaitingRoom()).toBe(true);
      expect(manager.canSaveCurrentProgress()).toBe(false);

      // In an unstarted waiting room, requestGoHome goes directly home without opening modal
      manager.requestGoHome();
      expect(manager.showExitConfirmModal()).toBe(false);
      expect(mahjong.snapshot()).toBeNull();

      // In an unstarted waiting room, requestLeaveCurrentGame leaves cleanly to game lobby
      mahjong.createOnlineRoom('LobbyHost', '3p', DEFAULT_RULES);
      expect(manager.hasActiveWaitingRoom()).toBe(true);
      manager.requestLeaveCurrentGame();
      expect(manager.showExitConfirmModal()).toBe(false);
      expect(mahjong.snapshot()).toBeNull();

      // Now start an active match: hasStartedMatch is true
      mahjong.startSolo('LobbyHost', '3p', DEFAULT_RULES);
      expect(manager.hasStartedMatch()).toBe(true);
      expect(manager.hasActiveWaitingRoom()).toBe(false);

      // Started match requestGoHome opens ExitConfirmDialog targeting hub
      manager.requestGoHome();
      expect(manager.showExitConfirmModal()).toBe(true);
      expect(manager.exitDestination()).toBe('hub');

      const modalFixture = TestBed.createComponent(ExitConfirmDialogComponent);
      modalFixture.detectChanges();
      const modalEl = modalFixture.nativeElement as HTMLElement;
      expect(modalEl.querySelectorAll('.modal-header button').length).toBe(0);
      expect(modalEl.querySelectorAll('.modal-footer button').length).toBe(4);

      // Click Stay button
      (modalEl.querySelector('.stay-btn') as HTMLButtonElement).click();
      expect(manager.showExitConfirmModal()).toBe(false);
      expect(mahjong.snapshot()?.role).toBe('host');

      // Request leave current game targeting gameLobby
      manager.requestLeaveCurrentGame();
      expect(manager.showExitConfirmModal()).toBe(true);
      expect(manager.exitDestination()).toBe('gameLobby');

      // Click Back to Game Lobby button
      (modalEl.querySelector('.game-lobby-btn') as HTMLButtonElement).click();
      expect(manager.showExitConfirmModal()).toBe(false);
      expect(mahjong.snapshot()).toBeNull();
    });

    it('saves, terminates, renders Hub resume banner, and restores Mahjong, Monopoly, and Avalon matches', async () => {
      await TestBed.configureTestingModule({
        imports: [ExitConfirmDialogComponent, HubComponent],
        providers: [
          provideRouter(routes),
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                queryParamMap: new Map<string, string>(),
              },
            },
          },
        ],
      }).compileComponents();

      const manager = TestBed.inject(GameSessionManagerService);
      const shellUi = TestBed.inject(ShellUiService);
      const mahjong = TestBed.inject(MahjongSessionService);
      const monopoly = TestBed.inject(MonopolySessionService);
      const avalon = TestBed.inject(AvalonSessionService);

      // A. Mahjong 3P round-trip save & resume via ExitConfirmDialog
      shellUi.setActiveGame('mahjong');
      mahjong.startSolo('SaverMJ', '3p', DEFAULT_RULES);
      expect(manager.canSaveCurrentProgress()).toBe(true);

      manager.requestGoHome();
      const dialogFixture = TestBed.createComponent(ExitConfirmDialogComponent);
      dialogFixture.detectChanges();
      const dialogEl = dialogFixture.nativeElement as HTMLElement;
      expect(dialogEl.querySelectorAll('.modal-footer button').length).toBe(4);

      (dialogEl.querySelector('.save-exit-btn') as HTMLButtonElement).click();
      expect(manager.showExitConfirmModal()).toBe(false);
      expect(mahjong.snapshot()).toBeNull();
      expect(manager.savedGame()?.game).toBe('mahjong');
      expect(localStorage.getItem(SAVED_GAME_STORAGE_KEY)?.includes('"mahjong"')).toBe(true);

      // Mount HubComponent: verify saved banner renders and resume button restores Mahjong match
      const hubFixture = TestBed.createComponent(HubComponent);
      hubFixture.detectChanges();
      const hubEl = hubFixture.nativeElement as HTMLElement;
      expect(hubEl.querySelectorAll('.saved-game-card').length).toBe(1);

      (hubEl.querySelector('.resume-saved-btn') as HTMLButtonElement).click();
      expect(mahjong.snapshot()?.view?.numSeats).toBe(3);
      mahjong.terminateSession();

      // B. Monopoly 4P round-trip save & resume
      monopoly.createSoloMatch(4);
      monopoly.dispatchAction({ type: 'rollDice' });
      expect(shellUi.activeRoomCode()).toBeNull();
      expect(manager.canSaveCurrentProgress()).toBe(true);

      manager.confirmSaveAndExit();
      expect(monopoly.snapshot()).toBeNull();
      expect(manager.savedGame()?.game).toBe('monopoly');

      hubFixture.detectChanges();
      expect(hubEl.querySelector('.saved-subtitle')?.textContent?.includes('4P')).toBe(true);

      expect(manager.resumeSavedGame()).toBe(true);
      expect(monopoly.snapshot()?.view?.players.length).toBe(4);

      // Visiting Hub directly kills active in-memory Monopoly session
      hubFixture.componentInstance.ngOnInit();
      expect(monopoly.snapshot()).toBeNull();

      // C. Avalon 5P round-trip save, resume, and leave
      avalon.createSoloMatch(5);
      expect(shellUi.activeRoomCode()).toBeNull();
      expect(manager.canSaveCurrentProgress()).toBe(true);

      manager.confirmSaveAndExit();
      expect(avalon.snapshot()).toBeNull();
      expect(manager.savedGame()?.game).toBe('avalon');

      hubFixture.detectChanges();
      expect(hubEl.querySelector('.saved-subtitle')?.textContent?.includes('5P')).toBe(true);

      expect(manager.resumeSavedGame()).toBe(true);
      expect(avalon.snapshot()?.view?.numPlayers).toBe(5);
      avalon.leaveRoom();

      // D. Pandemic 4P round-trip save, resume, and delete save
      const pandemic = TestBed.inject(PandemicSessionService);
      pandemic.createSoloMatch(4);
      expect(shellUi.activeRoomCode()).toBeNull();
      expect(manager.canSaveCurrentProgress()).toBe(true);

      manager.confirmSaveAndExit();
      expect(pandemic.snapshot()).toBeNull();
      expect(manager.savedGame()?.game).toBe('pandemic');

      hubFixture.detectChanges();
      expect(hubEl.querySelector('.saved-subtitle')?.textContent?.includes('4P')).toBe(true);

      expect(manager.resumeSavedGame()).toBe(true);
      expect(pandemic.snapshot()?.view?.players.length).toBe(4);
      pandemic.leaveRoom();

      // E. Balik Kampung 3P round-trip save & resume
      const balikKampung = TestBed.inject(BalikKampungSessionService);
      balikKampung.createSoloMatch(3);
      expect(shellUi.activeRoomCode()).toBeNull();
      expect(manager.canSaveCurrentProgress()).toBe(true);

      manager.confirmSaveAndExit();
      expect(balikKampung.snapshot()).toBeNull();
      expect(manager.savedGame()?.game).toBe('balik-kampung');

      hubFixture.detectChanges();
      expect(hubEl.querySelector('.saved-subtitle')?.textContent?.includes('3P')).toBe(true);

      expect(manager.resumeSavedGame()).toBe(true);
      expect(balikKampung.snapshot()?.view?.players.length).toBe(3);
      balikKampung.leaveRoom();

      // Delete saved game from Hub banner
      hubFixture.detectChanges();
      (hubEl.querySelector('.delete-saved-btn') as HTMLButtonElement).click();
      hubFixture.detectChanges();
      expect(manager.savedGame()).toBeNull();
      expect(localStorage.getItem(SAVED_GAME_STORAGE_KEY)).toBeNull();
      expect(hubEl.querySelectorAll('.saved-game-card').length).toBe(0);
    });

    it('gracefully ignores malformed saved game JSON in localStorage and covers storage/fallback branches', () => {
      // 1. Invalid version object
      localStorage.setItem(SAVED_GAME_STORAGE_KEY, '{"version":99,"invalid":true}');
      TestBed.configureTestingModule({
        providers: [provideRouter(routes)],
      });
      const manager = TestBed.inject(GameSessionManagerService);
      expect(manager.savedGame()).toBeNull();

      // 2. Non-object JSON, corrupted JSON, null payload, and valid pre-seeded save on startup
      TestBed.resetTestingModule();
      localStorage.setItem(SAVED_GAME_STORAGE_KEY, '"not-an-object"');
      TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
      expect(TestBed.inject(GameSessionManagerService).savedGame()).toBeNull();

      TestBed.resetTestingModule();
      localStorage.setItem(SAVED_GAME_STORAGE_KEY, '{corrupted-json');
      TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
      expect(TestBed.inject(GameSessionManagerService).savedGame()).toBeNull();

      TestBed.resetTestingModule();
      localStorage.setItem(
        SAVED_GAME_STORAGE_KEY,
        '{"version":1,"game":"mahjong","savedAt":100,"summary":"x","payload":null}'
      );
      TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
      expect(TestBed.inject(GameSessionManagerService).savedGame()).toBeNull();

      // 3. Fallback save ordering when activeGame is 'hub' while Monopoly/Avalon is active + storage errors
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
      const mgr2 = TestBed.inject(GameSessionManagerService);
      const shellUi = TestBed.inject(ShellUiService);
      const monopoly = TestBed.inject(MonopolySessionService);

      monopoly.createSoloMatch(4);
      shellUi.setActiveGame('hub');
      expect(mgr2.saveCurrentProgress()).toBe(true);
      expect(mgr2.savedGame()?.game).toBe('monopoly');

      // Startup hydration from valid pre-existing localStorage record
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
      const hydratedMgr = TestBed.inject(GameSessionManagerService);
      expect(hydratedMgr.savedGame()?.game).toBe('monopoly');

      // Storage quota error on persistRecord & removeItem error on deleteSavedGame
      const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
      const removeSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('StorageLocked');
      });
      try {
        const hydMonopoly = TestBed.inject(MonopolySessionService);
        hydMonopoly.createSoloMatch(4);
        expect(hydratedMgr.saveCurrentProgress()).toBe(false);
        hydratedMgr.deleteSavedGame();
        expect(hydratedMgr.savedGame()).toBeNull();
        hydMonopoly.leaveRoom();
      } finally {
        setSpy.mockRestore();
        removeSpy.mockRestore();
      }
    });
  });

  describe('2. Contextual Multi-Game RulebookDialogComponent', () => {
    it('opens contextually to the active game and switches between Mahjong, Monopoly, and Avalon tabs', async () => {
      await TestBed.configureTestingModule({
        imports: [RulebookDialogComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const shellUi = TestBed.inject(ShellUiService);
      const translate = TestBed.inject(TranslateService);
      translate.use('zh');

      // Open while Monopoly is active
      shellUi.setActiveGame('monopoly');
      shellUi.openRulebook();
      expect(shellUi.rulebookGame()).toBe('monopoly');

      const fixture = TestBed.createComponent(RulebookDialogComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      // Bounded modal invariant: 0 buttons in header, 1 close button in footer, 0 cross-game tabs inside active game
      expect(el.querySelectorAll('.modal-header button').length).toBe(0);
      expect(el.querySelectorAll('.modal-footer button').length).toBe(1);
      expect(el.querySelectorAll('.rulebook-tab-btn').length).toBe(0);
      expect(el.textContent).toContain('GO');
      expect(el.querySelectorAll('.desktop-table tbody tr').length).toBe(3);

      // On the Hub, multi-game rulebook tabs appear and switch between games
      shellUi.setActiveGame('hub');
      fixture.detectChanges();
      const tabs = el.querySelectorAll('.rulebook-tab-btn');
      expect(tabs.length).toBe(5);
      (tabs.item(2) as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(shellUi.rulebookGame()).toBe('avalon');
      expect(el.textContent).toContain('梅林');
      expect(el.querySelectorAll('.desktop-table tbody tr').length).toBe(6);

      // Switch to Mahjong tab
      (tabs.item(0) as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(shellUi.rulebookGame()).toBe('mahjong');
      expect(el.textContent).toContain('全铳制');
      expect(el.querySelectorAll('.desktop-table tbody tr').length).toBe(6);

      let closedCount = 0;
      fixture.componentInstance.closed.subscribe(() => {
        closedCount++;
      });
      (el.querySelector('.modal-footer button') as HTMLButtonElement).click();
      expect(closedCount).toBe(1);
    });
  });

  describe('3. RealDiceComponent & Unified Mobile/Desktop Monopoly Board', () => {
    it('renders exact pip counts for faces 1-6, crimson pips on 1 & 4, and doubles indicator', async () => {
      await TestBed.configureTestingModule({
        imports: [RealDiceComponent],
      }).compileComponents();

      const fixture = TestBed.createComponent(RealDiceComponent);
      const comp = fixture.componentInstance;

      for (const face of [1, 2, 3, 4, 5, 6] as const) {
        fixture.componentRef.setInput('values', [face, 6]);
        fixture.detectChanges();
        const firstDiePips = (fixture.nativeElement as HTMLElement)
          .querySelectorAll('.die-cube')
          .item(0)
          .querySelectorAll('.pip-dot').length;
        expect(firstDiePips).toBe(face);
      }

      // Red face rules: 1 and 4 are crimson; 2, 3, 5, 6 are dark
      expect(comp.isRedFace(1)).toBe(true);
      expect(comp.isRedFace(4)).toBe(true);
      expect(comp.isRedFace(2)).toBe(false);
      expect(comp.isRedFace(6)).toBe(false);
      expect(comp.isRedFace(Number.NaN)).toBe(true); // Clamps NaN -> 1

      // Doubles & sum pill
      fixture.componentRef.setInput('values', [4, 4]);
      fixture.componentRef.setInput('rolling', true);
      fixture.componentRef.setInput('compact', true);
      fixture.detectChanges();

      expect(comp.diceSum()).toBe(8);
      expect(comp.isDoubles()).toBe(true);
      const hostEl = fixture.nativeElement as HTMLElement;
      expect(hostEl.querySelectorAll('.doubles-pill').length).toBe(1);
      expect(hostEl.querySelectorAll('.real-dice-widget.compact').length).toBe(1);
      expect(hostEl.querySelectorAll('.real-dice-widget.is-rolling').length).toBe(1);
    });

    it('renders RealDiceComponent inside MonopolyBoardComponent alongside both 40-space board and mobile cards', async () => {
      await TestBed.configureTestingModule({
        imports: [MonopolyBoardComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const session = TestBed.inject(MonopolySessionService);
      const manager = TestBed.inject(GameSessionManagerService);
      session.createSoloMatch(3);

      const fixture = TestBed.createComponent(MonopolyBoardComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelectorAll('app-real-dice').length).toBe(1);
      expect(el.querySelectorAll('.turn-mobile-card').length).toBe(0);
      expect(el.querySelectorAll('.monopoly-grid .board-space').length).toBe(40);
      expect(el.querySelectorAll('.board-sidebar').length).toBe(1);
      expect(el.querySelectorAll('.mobile-cards').length).toBe(1);

      // Active match returnToHub opens exit confirmation modal rather than abruptly discarding
      fixture.componentInstance.returnToHub();
      expect(manager.showExitConfirmModal()).toBe(true);
      manager.confirmDiscardAndExit();
    });
  });

  describe('4. Session p2p:leave Cleanup and Route Recovery', () => {
    it('cleans up and navigates Mahjong, Monopoly, and Avalon sessions to lobbies on p2p:leave', async () => {
      await TestBed.configureTestingModule({
        providers: [provideRouter(routes)],
      }).compileComponents();

      const router = TestBed.inject(Router);
      const mahjong = TestBed.inject(MahjongSessionService);
      const monopoly = TestBed.inject(MonopolySessionService);
      const avalon = TestBed.inject(AvalonSessionService);
      const pandemic = TestBed.inject(PandemicSessionService);

      // A. Mahjong on /table
      await router.navigateByUrl('/mahjong/table');
      mahjong.startSolo('Player1', '3p', DEFAULT_RULES);
      expect(mahjong.snapshot()?.role).toBe('host');

      window.dispatchEvent(new CustomEvent('p2p:leave', { detail: { game: 'mahjong' } }));
      expect(mahjong.snapshot()).toBe(null);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(router.url).toContain('/lobby');

      // B. Monopoly on /monopoly/board
      await router.navigateByUrl('/monopoly/board');
      monopoly.createSoloMatch(3);
      expect(monopoly.snapshot()?.role).toBe('host');

      window.dispatchEvent(new CustomEvent('p2p:leave', { detail: { game: 'monopoly' } }));
      expect(monopoly.snapshot()).toBe(null);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(router.url).toContain('/monopoly/lobby');

      // C. Avalon on /avalon/table
      await router.navigateByUrl('/avalon/table');
      avalon.createSoloMatch(5);
      expect(avalon.snapshot()?.role).toBe('host');

      window.dispatchEvent(new CustomEvent('p2p:leave', { detail: { game: 'avalon' } }));
      expect(avalon.snapshot()).toBe(null);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(router.url).toContain('/avalon/lobby');

      // D. Pandemic on /pandemic/board
      await router.navigateByUrl('/pandemic/board');
      pandemic.createSoloMatch(4);
      expect(pandemic.snapshot()?.role).toBe('host');

      window.dispatchEvent(new CustomEvent('p2p:leave', { detail: { game: 'pandemic' } }));
      expect(pandemic.snapshot()).toBe(null);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(router.url).toContain('/pandemic/lobby');

      // E. Balik Kampung on /balik-kampung/board
      const balikKampung = TestBed.inject(BalikKampungSessionService);
      await router.navigateByUrl('/balik-kampung/board');
      balikKampung.createSoloMatch(3);
      expect(balikKampung.snapshot()?.role).toBe('host');

      window.dispatchEvent(
        new CustomEvent('p2p:leave', { detail: { game: 'balik-kampung' } })
      );
      expect(balikKampung.snapshot()).toBe(null);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(router.url).toContain('/balik-kampung/lobby');
    });
  });
});
