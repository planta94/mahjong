// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AppComponent } from '../../app.component';
import { routes } from '../../app.routes';
import { MahjongSessionService } from '../services/mahjong-session.service';
import { ShellUiService } from '../services/shell-ui.service';
import { createMatch, getPlayerView } from '../services/engine.service';
import { LobbyComponent } from '../../pages/lobby/lobby.component';

describe('Empirical Challenge Suite — Milestone 1: Universal Hub & Route Resolution', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    if (typeof document !== 'undefined' && document.body) {
      delete document.body.dataset['theme'];
    }
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    if (typeof document !== 'undefined' && document.body) {
      delete document.body.dataset['theme'];
    }
  });

  // =========================================================================
  // Challenge Area 1: Route Redirect Semantics
  // =========================================================================
  describe('Challenge 1: Route Redirect Semantics', () => {
    it('redirects /lobby to /mahjong/lobby preserving query parameters', async () => {
      await TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const router = TestBed.inject(Router);
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      // Test 1: Plain /lobby
      await router.navigateByUrl('/lobby');
      fixture.detectChanges();
      expect(router.url).toBe('/mahjong/lobby');

      // Test 2: /lobby with single room query parameter
      await router.navigateByUrl('/lobby?room=M1234');
      fixture.detectChanges();
      expect(router.url).toBe('/mahjong/lobby?room=M1234');

      // Test 3: /lobby with multiple query parameters
      await router.navigateByUrl('/lobby?room=M5678&mode=3p&test=alpha');
      fixture.detectChanges();
      expect(router.url).toBe('/mahjong/lobby?room=M5678&mode=3p&test=alpha');
    });

    it('redirects /table to /mahjong/table preserving query parameters when session is active', async () => {
      await TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const router = TestBed.inject(Router);
      const session = TestBed.inject(MahjongSessionService);
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      // Mock an active session snapshot so TableComponent does not auto-redirect to /lobby
      const match = createMatch({ mode: '3p' });
      session.snapshot.set({
        role: 'host',
        online: false,
        roomCode: 'LOCAL',
        status: 'playing',
        error: null,
        mySeat: 0,
        lobby: null,
        view: getPlayerView(match, 0),
      });
      fixture.detectChanges();

      // Navigate to legacy /table with room parameter
      await router.navigateByUrl('/table?room=LOCAL');
      fixture.detectChanges();
      expect(router.url).toBe('/mahjong/table?room=LOCAL');

      // Clean up session
      session.snapshot.set(null);
    });

    it('preserves query parameters when /table is visited without an active session (redirects to /mahjong/lobby?room=M1234)', async () => {
      await TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const router = TestBed.inject(Router);
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      await router.navigateByUrl('/table?room=M1234');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(router.url).toBe('/mahjong/lobby?room=M1234');
    });

    it('redirects unknown wildcards to root /', async () => {
      await TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const router = TestBed.inject(Router);
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      await router.navigateByUrl('/non-existent-page-12345');
      fixture.detectChanges();
      expect(router.url).toBe('/');
    });
  });

  // =========================================================================
  // Challenge Area 2: Direct CTA Navigation to Target Lobbies
  // =========================================================================
  describe('Challenge 2: Direct CTA Navigation to Target Lobbies', () => {
    it('verifies CTA navigation: resolves cleanly to /mahjong/lobby, /monopoly/lobby, and /avalon/lobby', async () => {
      await TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const router = TestBed.inject(Router);
      const fixture = TestBed.createComponent(AppComponent);
      await router.navigateByUrl('/');
      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;
      const gameCards = host.querySelectorAll('.game-card');
      expect(gameCards.length).toBe(3);

      // Verify clicking Mahjong tile opens detail dialog first, then Enter CTA navigates to /mahjong/lobby
      expect(host.querySelector('.game-detail-modal')).toBe(null);
      const mjTile = host.querySelector('.mahjong-card') as HTMLButtonElement;
      expect(mjTile !== null).toBe(true);
      mjTile.click();
      fixture.detectChanges();
      expect(router.url).toBe('/');
      const mjEnterBtn = host.querySelector('.game-detail-modal .detail-enter-btn') as HTMLButtonElement;
      expect(mjEnterBtn !== null).toBe(true);
      mjEnterBtn.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(router.url).toBe('/mahjong/lobby');

      // Return to Hub
      await router.navigateByUrl('/');
      fixture.detectChanges();

      // Verify clicking Monopoly tile opens detail dialog, then Enter CTA navigates to /monopoly/lobby
      const monoTile = host.querySelector('.monopoly-card') as HTMLButtonElement;
      expect(monoTile !== null).toBe(true);
      monoTile.click();
      fixture.detectChanges();
      expect(router.url).toBe('/');
      const monoEnterBtn = host.querySelector('.game-detail-modal .detail-enter-btn') as HTMLButtonElement;
      expect(monoEnterBtn !== null).toBe(true);
      monoEnterBtn.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(router.url).toBe('/monopoly/lobby');

      // Return to Hub
      await router.navigateByUrl('/');
      fixture.detectChanges();

      // Verify clicking Avalon tile opens detail dialog, then Enter CTA navigates to /avalon/lobby
      const avaTile = host.querySelector('.avalon-card') as HTMLButtonElement;
      expect(avaTile !== null).toBe(true);
      avaTile.click();
      fixture.detectChanges();
      expect(router.url).toBe('/');
      const avaEnterBtn = host.querySelector('.game-detail-modal .detail-enter-btn') as HTMLButtonElement;
      expect(avaEnterBtn !== null).toBe(true);
      avaEnterBtn.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(router.url).toBe('/avalon/lobby');
    });

    it('verifies universal room input routing: resolves cleanly to /mahjong/lobby, /monopoly/lobby, and /avalon/lobby with room params', async () => {
      await TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const router = TestBed.inject(Router);
      const fixture = TestBed.createComponent(AppComponent);
      await router.navigateByUrl('/');
      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;

      // 1. Mahjong room code 'M9999' -> Successfully resolves to /mahjong/lobby?room=M9999
      const roomInput = host.querySelector('.room-code-input') as HTMLInputElement;
      const joinBtn = host.querySelector('.join-btn') as HTMLButtonElement;
      expect(roomInput !== null).toBe(true);
      expect(joinBtn !== null).toBe(true);

      roomInput.value = 'M9999';
      roomInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      joinBtn.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(router.url).toBe('/mahjong/lobby?room=M9999');

      // Return to Hub
      await router.navigateByUrl('/');
      fixture.detectChanges();

      // 2. Monopoly room code 'P1234' -> Resolves to /monopoly/lobby?room=P1234
      const roomInput2 = host.querySelector('.room-code-input') as HTMLInputElement;
      const joinBtn2 = host.querySelector('.join-btn') as HTMLButtonElement;
      roomInput2.value = 'P1234';
      roomInput2.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      joinBtn2.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(router.url).toBe('/monopoly/lobby?room=P1234');

      // Return to Hub
      await router.navigateByUrl('/');
      fixture.detectChanges();

      // 3. Avalon room code 'A5678' -> Resolves to /avalon/lobby?room=A5678
      const roomInput3 = host.querySelector('.room-code-input') as HTMLInputElement;
      const joinBtn3 = host.querySelector('.join-btn') as HTMLButtonElement;
      roomInput3.value = 'A5678';
      roomInput3.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      joinBtn3.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(router.url).toBe('/avalon/lobby?room=A5678');
    });
  });

  // =========================================================================
  // Challenge Area 3: Nickname Migration & Persistence
  // =========================================================================
  describe('Challenge 3: Nickname Migration & Persistence', () => {
    it('correctly prioritizes and loads initial nickname across legacy and new keys', () => {
      // Scenario A: Only legacy key exists
      localStorage.setItem('hkmj_nickname', '雀后小芳');
      const serviceA = new ShellUiService();
      expect(serviceA.playerNickname()).toBe('雀后小芳');

      // Scenario B: Both keys exist with distinct values -> new key takes precedence
      localStorage.setItem('party_pavilion_nickname', '大富翁老闆');
      localStorage.setItem('hkmj_nickname', '雀后小芳');
      const serviceB = new ShellUiService();
      expect(serviceB.playerNickname()).toBe('大富翁老闆');

      // Scenario C: Neither key exists -> defaults to 雀友
      localStorage.clear();
      const serviceC = new ShellUiService();
      expect(serviceC.playerNickname()).toBe('雀友');

      // Scenario D: Whitespace-only in storage -> defaults to 雀友
      localStorage.setItem('party_pavilion_nickname', '   ');
      localStorage.setItem('hkmj_nickname', '   ');
      const serviceD = new ShellUiService();
      expect(serviceD.playerNickname()).toBe('雀友');
    });

    it('dual-persists nickname updates and enforces 16-character limit and whitespace trimming', () => {
      const service = new ShellUiService();

      // Normal valid nickname
      service.setPlayerNickname('  九指神丐  ');
      expect(service.playerNickname()).toBe('九指神丐');
      expect(localStorage.getItem('party_pavilion_nickname')).toBe('九指神丐');
      expect(localStorage.getItem('hkmj_nickname')).toBe('九指神丐');

      // Overlength nickname: clamp to 16 characters
      service.setPlayerNickname('abcdefghijklmnopqrstuvwxyz');
      expect(service.playerNickname()).toBe('abcdefghijklmnop');
      expect(service.playerNickname().length).toBe(16);
      expect(localStorage.getItem('party_pavilion_nickname')).toBe('abcdefghijklmnop');
      expect(localStorage.getItem('hkmj_nickname')).toBe('abcdefghijklmnop');

      // Blank nickname resets to fallback '雀友'
      service.setPlayerNickname('    ');
      expect(service.playerNickname()).toBe('雀友');
      expect(localStorage.getItem('party_pavilion_nickname')).toBe('雀友');
      expect(localStorage.getItem('hkmj_nickname')).toBe('雀友');
    });

    it('persists through HubComponent UI editing flow (start, change, save, cancel)', async () => {
      await TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const router = TestBed.inject(Router);
      const shellUi = TestBed.inject(ShellUiService);
      const fixture = TestBed.createComponent(AppComponent);
      await router.navigateByUrl('/');
      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;

      // Click Edit button
      const editBtn = host.querySelector('.nickname-display-row button') as HTMLButtonElement;
      expect(editBtn !== null).toBe(true);
      editBtn.click();
      fixture.detectChanges();

      // Input field appears
      const nickInput = host.querySelector('.nickname-input') as HTMLInputElement;
      expect(nickInput !== null).toBe(true);

      // Modify and save
      nickInput.value = '賭聖阿星';
      nickInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const saveBtn = host.querySelector('.nickname-edit-row .btn-emerald') as HTMLButtonElement;
      saveBtn.click();
      fixture.detectChanges();

      expect(shellUi.playerNickname()).toBe('賭聖阿星');
      expect(localStorage.getItem('party_pavilion_nickname')).toBe('賭聖阿星');
      expect(localStorage.getItem('hkmj_nickname')).toBe('賭聖阿星');

      // Edit and cancel
      const editBtn2 = host.querySelector('.nickname-display-row button') as HTMLButtonElement;
      editBtn2.click();
      fixture.detectChanges();

      const nickInput2 = host.querySelector('.nickname-input') as HTMLInputElement;
      nickInput2.value = '不想改了';
      nickInput2.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const cancelBtn = host.querySelector('.nickname-edit-row button:last-child') as HTMLButtonElement;
      cancelBtn.click();
      fixture.detectChanges();

      // Should retain saved nickname
      expect(shellUi.playerNickname()).toBe('賭聖阿星');
      expect(localStorage.getItem('party_pavilion_nickname')).toBe('賭聖阿星');
    });

    it('synchronizes nickname between LobbyComponent and ShellUiService: updates both party_pavilion_nickname and hkmj_nickname', () => {
      // 1. User sets nickname in ShellUiService (e.g. via Hub UI)
      TestBed.configureTestingModule({
        providers: [provideRouter(routes)],
      });
      const shellUi = TestBed.inject(ShellUiService);
      shellUi.setPlayerNickname('館主阿強');
      expect(localStorage.getItem('party_pavilion_nickname')).toBe('館主阿強');
      expect(localStorage.getItem('hkmj_nickname')).toBe('館主阿強');

      // 2. User goes to Mahjong Lobby, where persistNickname synchronizes with ShellUiService
      const fixture = TestBed.createComponent(LobbyComponent);
      const lobby = fixture.componentInstance;
      expect(lobby.nickname).toBe('館主阿強');

      lobby.nickname = '麻雀戰神';
      lobby.persistNickname();

      // 3. Both localStorage keys and ShellUiService signal are kept in sync
      expect(shellUi.playerNickname()).toBe('麻雀戰神');
      expect(localStorage.getItem('hkmj_nickname')).toBe('麻雀戰神');
      expect(localStorage.getItem('party_pavilion_nickname')).toBe('麻雀戰神');
    });
  });

  // =========================================================================
  // Challenge Area 4: Theme Dataset on Body Tag
  // =========================================================================
  describe('Challenge 4: Theme Dataset on Body Tag', () => {
    it('sets document.body.dataset[theme] contextually via ShellUiService.setActiveGame', () => {
      const service = new ShellUiService();

      expect(document.body.dataset['theme']).toBe('hub');

      service.setActiveGame('mahjong');
      expect(document.body.dataset['theme']).toBe('mahjong');

      service.setActiveGame('monopoly');
      expect(document.body.dataset['theme']).toBe('monopoly');

      service.setActiveGame('avalon');
      expect(document.body.dataset['theme']).toBe('avalon');

      service.setActiveGame('hub');
      expect(document.body.dataset['theme']).toBe('hub');
    });

    it('empirically examines theme state and activeGame during route navigation', async () => {
      await TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const router = TestBed.inject(Router);
      const shellUi = TestBed.inject(ShellUiService);
      const fixture = TestBed.createComponent(AppComponent);

      // 1. App loads at Hub '/'
      await router.navigateByUrl('/');
      fixture.detectChanges();
      expect(shellUi.activeGame()).toBe('hub');
      expect(document.body.dataset['theme']).toBe('hub');

      // 2. Navigate to /mahjong/lobby
      await router.navigateByUrl('/mahjong/lobby');
      fixture.detectChanges();

      // On /mahjong/lobby: activeGame = "mahjong", theme = "mahjong"
      expect(shellUi.activeGame()).toBe('mahjong');
      expect(document.body.dataset['theme']).toBe('mahjong');

      // 3. Navigate to /monopoly/lobby
      await router.navigateByUrl('/monopoly/lobby');
      fixture.detectChanges();
      expect(shellUi.activeGame()).toBe('monopoly');
      expect(document.body.dataset['theme']).toBe('monopoly');

      // 4. Return to Hub '/'
      await router.navigateByUrl('/');
      fixture.detectChanges();
      expect(shellUi.activeGame()).toBe('hub');
      expect(document.body.dataset['theme']).toBe('hub');
    });

    it('switches theme and header badge to "mahjong" when navigating to /mahjong/lobby', async () => {
      await TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const router = TestBed.inject(Router);
      const shellUi = TestBed.inject(ShellUiService);
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      expect(document.body.dataset['theme']).toBe('hub');

      await router.navigateByUrl('/mahjong/lobby');
      fixture.detectChanges();

      // Active game and theme switch to 'mahjong' because LobbyComponent invokes setActiveGame('mahjong')
      expect(shellUi.activeGame()).toBe('mahjong');
      expect(document.body.dataset['theme']).toBe('mahjong');
      const rootEl = fixture.nativeElement as HTMLElement;
      // Header brand badge displays Mahjong badge
      expect(rootEl.querySelector('.brand-badge')?.textContent).toContain('港马麻将');
      // Hub navigation button is visible because activeGame !== 'hub'
      expect(rootEl.querySelector('.hub-btn') !== null).toBe(true);
    });
  });
});
