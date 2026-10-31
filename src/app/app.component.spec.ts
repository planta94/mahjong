import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { MahjongSessionService } from './core/services/mahjong-session.service';
import { ShellUiService } from './core/services/shell-ui.service';
import { TranslateService } from './core/services/translate.service';
import { TileComponent } from './shared/tile/tile.component';

describe('AppComponent, LobbyComponent, TableComponent & Modals', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, TileComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('renders SVG tile variants (suit, honor, white board, floral SVG bonus, joker, back)', () => {
    const codes = [
      'back', 'jk_0', 'm5_0', 'p1_0', 'p6_0', 's1_0', 's8_0',
      'dw_0', 'dr_0', 'an1_0', 'fc1_0', 'fc3_0',
    ];
    for (const code of codes) {
      const fixture = TestBed.createComponent(TileComponent);
      fixture.componentRef.setInput('tile', code);
      fixture.componentRef.setInput('size', 'sm');
      fixture.detectChanges();
      const tileEl = (fixture.nativeElement as HTMLElement).querySelector('.mj-tile');
      expect(tileEl !== null).toBe(true);
    }

    const flowerCodes = ['f1_0', 'f2_0', 'f3_0', 'f4_0', 'b1_0', 'b2_0', 'b3_0', 'b4_0'];
    for (const fCode of flowerCodes) {
      const fixture = TestBed.createComponent(TileComponent);
      fixture.componentRef.setInput('tile', fCode);
      fixture.componentRef.setInput('size', 'xs');
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('svg.tile-svg') !== null).toBe(true);
      expect(/[春夏秋冬梅蘭菊竹]/.test(host.textContent ?? '')).toBe(false);
    }
  });

  it('switches header languages, opens bottom-action rulebook modal, and exercises Lobby + 3P/4P Table + Settlement UI', async () => {
    const router = TestBed.inject(Router);
    const session = TestBed.inject(MahjongSessionService);
    const shellUi = TestBed.inject(ShellUiService);
    const translate = TestBed.inject(TranslateService);
    translate.use('zh');

    const appFixture = TestBed.createComponent(AppComponent);
    await router.navigateByUrl('/lobby');
    appFixture.detectChanges();

    const rootEl = appFixture.nativeElement as HTMLElement;
    expect(rootEl.textContent).toContain('星冕桌游荟');
    expect(rootEl.querySelector('.brand-title')?.textContent?.trim()).toBe('港马麻将馆');
    expect(rootEl.querySelector('.brand-logo')?.getAttribute('src')).toBe('favicon.svg');
    expect(rootEl.querySelectorAll('.portal-input').length).toBeGreaterThanOrEqual(3);

    // Language switch to English and back to Chinese
    const langBtns = rootEl.querySelectorAll('.lang-btn');
    expect(langBtns.length).toBe(2);
    (langBtns.item(1) as HTMLButtonElement).click();
    appFixture.detectChanges();
    expect(translate.currentLang()).toBe('en');
    expect(rootEl.textContent).toContain('Tabletop Royale');
    expect(rootEl.querySelector('.brand-title')?.textContent?.trim()).toBe('HK & Fly Mahjong');

    (langBtns.item(0) as HTMLButtonElement).click();
    appFixture.detectChanges();
    expect(translate.currentLang()).toBe('zh');

    // Exercise active game titles & badges in topbar
    shellUi.setActiveGame('monopoly');
    appFixture.detectChanges();
    expect(rootEl.querySelector('.brand-title')?.textContent?.trim()).toBe('大马地标大富翁');
    expect(rootEl.querySelector('.brand-badge')?.textContent).toContain('大富翁');
    expect(document.title).toContain('大马地标大富翁');

    shellUi.setActiveGame('avalon');
    appFixture.detectChanges();
    expect(rootEl.querySelector('.brand-title')?.textContent?.trim()).toBe('阿瓦隆：圣杯传奇');
    expect(rootEl.querySelector('.brand-badge')?.textContent).toContain('阿瓦隆');
    expect(document.title).toContain('阿瓦隆');

    const hubNavBtn = rootEl.querySelector('.hub-btn') as HTMLButtonElement;
    expect(hubNavBtn !== null).toBe(true);
    hubNavBtn.click();
    await appFixture.whenStable();
    appFixture.detectChanges();
    expect(rootEl.querySelector('.brand-title')?.textContent?.trim()).toBe('星冕桌游荟');

    await router.navigateByUrl('/lobby');
    appFixture.detectChanges();
    expect(rootEl.querySelector('.brand-title')?.textContent?.trim()).toBe('港马麻将馆');
    expect(rootEl.querySelector('.brand-badge')?.textContent).toContain('港马麻将');

    // Toggle BGM mute/unmute button in header
    const bgmBtn = rootEl.querySelector('.bgm-toggle-btn') as HTMLButtonElement;
    expect(session.bgmEnabled()).toBe(false);
    bgmBtn.click();
    appFixture.detectChanges();
    expect(session.bgmEnabled()).toBe(true);
    bgmBtn.click();
    appFixture.detectChanges();
    expect(session.bgmEnabled()).toBe(false);

    // Open Rulebook dialog & verify bottom-only close button (no top-right X)
    session.showRulebook.set(true);
    appFixture.detectChanges();
    expect(rootEl.querySelectorAll('.modal-header button').length).toBe(0);
    const footerButtons = rootEl.querySelectorAll('.modal-footer button');
    expect(footerButtons.length).toBe(1);
    (footerButtons.item(0) as HTMLButtonElement).click();
    appFixture.detectChanges();
    expect(session.showRulebook()).toBe(false);

    // Exercise LobbyComponent methods (selectMode, minFan clamping, createOnlineRoom, checkbox toggles, startSolo)
    const modeCards = rootEl.querySelectorAll('.mode-card');
    expect(modeCards.length).toBe(2);
    (modeCards.item(1) as HTMLElement).click();
    appFixture.detectChanges();

    const createRoomBtn = rootEl.querySelector('.btn-emerald') as HTMLButtonElement;
    createRoomBtn.click();
    await appFixture.whenStable();
    appFixture.detectChanges();
    expect(rootEl.querySelectorAll('.seat-slot').length).toBe(4);

    // Toggle concealed, seven-pairs & tenpai-hints checkboxes in waiting lobby
    const lobbyCheckboxes = rootEl.querySelectorAll('.rules-grid input[type="checkbox"]');
    expect(lobbyCheckboxes.length).toBe(3);
    (lobbyCheckboxes.item(0) as HTMLInputElement).click();
    (lobbyCheckboxes.item(1) as HTMLInputElement).click();
    (lobbyCheckboxes.item(2) as HTMLInputElement).click();
    appFixture.detectChanges();
    expect(session.snapshot()?.lobby?.rules.showHints).toBe(false);

    // Exercise header room code pill & copy
    const roomCodeBtn = rootEl.querySelector('.room-code-btn') as HTMLButtonElement;
    expect(roomCodeBtn !== null).toBe(true);
    roomCodeBtn.click();
    appFixture.detectChanges();

    const hubBtn = rootEl.querySelector('.hub-btn') as HTMLButtonElement;
    expect(hubBtn !== null).toBe(true);

    const leaveBtn = rootEl.querySelector('.leave-btn') as HTMLButtonElement;
    expect(leaveBtn !== null).toBe(true);
    leaveBtn.click();
    session.leaveSession();
    await appFixture.whenStable();
    appFixture.detectChanges();

    // Start 4P Solo via Lobby button and exercise TableComponent 4P top seat + discard click + claim bar + tenpai bar
    const refreshedModeCards = rootEl.querySelectorAll('.mode-card');
    (refreshedModeCards.item(1) as HTMLElement).click();
    appFixture.detectChanges();
    const soloBtn = rootEl.querySelector('.cta-row .btn-gold') as HTMLButtonElement;
    soloBtn.click();
    await appFixture.whenStable();
    appFixture.detectChanges();
    expect(rootEl.querySelectorAll('.top-opp-wrap').length).toBe(1);

    // Click first tile in hand rack to discard
    const firstRackTile = rootEl.querySelector('.hand-rack mj-tile') as HTMLElement;
    firstRackTile.click();
    appFixture.detectChanges();

    // Render claim action bar & Tenpai helper strip on 3P table
    session.startSolo('Tester', '3p', {
      minFan: 5,
      maxFan: 10,
      concealedFan: true,
      sevenPairs: true,
    });
    await appFixture.whenStable();
    const snap3p = session.snapshot()!;
    const p0 = snap3p.view!.players.at(0)!;
    session.snapshot.set({
      ...snap3p,
      view: {
        ...snap3p.view!,
        phase: 'claim',
        players: [
          {
            ...p0,
             hand: [
               'p1_0', 'p1_1', 'p1_2',
               'p2_0', 'p3_0', 'p4_0',
               'p5_0', 'p6_0', 'p7_0',
               'p8_0', 'p8_1', 'p8_2',
               'p9_0',
             ],
             discards: ['we_0', 'ws_0'],
           },
           { ...snap3p.view!.players.at(1)!, discards: ['ww_0', 'wn_0', 'dr_0'] },
           { ...snap3p.view!.players.at(2)!, discards: ['dg_0', 'dw_0', 'p1_3', 'p9_1'] },
         ],
         legalActions: {
           phase: 'claim',
           tileId: 'p9_1',
           fromSeat: 2,
           win: { isShapeValid: true, canWin: true, rawFan: 8, cappedFan: 8, items: [{ name: '清一色', fan: 7 }] },
           canKong: true,
           canPong: true,
           chows: [{ partnerCodes: ['p7', 'p8'], meldCodes: ['p7', 'p8', 'p9'] }],
         },
       },
     });
     appFixture.detectChanges();
     expect(rootEl.querySelectorAll('.discard-pool .river-tiles mj-tile').length).toBe(9);
     expect(rootEl.querySelectorAll('.tenpai-bar .wait-pill').length).toBeGreaterThanOrEqual(1);
     session.hintsEnabled.set(false);
     appFixture.detectChanges();
     expect(rootEl.querySelectorAll('.tenpai-bar').length).toBe(0);
     session.hintsEnabled.set(true);
     appFixture.detectChanges();

     // Always-available action buttons in 3P claim phase: Chow, Pong, Kong, Expose Fly, Retrieve Fly, Hu, Pass = 7
     const actionBtns = rootEl.querySelectorAll('.action-bar button');
     expect(actionBtns.length).toBe(7);

     // Click Retrieve Fly button to verify retrieveFly selection prompt, then switch to Pong
     (actionBtns.item(4) as HTMLButtonElement).click();
     appFixture.detectChanges();
     expect(rootEl.querySelector('.selection-prompt')?.textContent).toContain('换回副露中的「飞」');

     // Click Pong button to enter manual tile-selection mode, toggle 2 tiles, then Confirm
     (actionBtns.item(1) as HTMLButtonElement).click();
     appFixture.detectChanges();
     expect(rootEl.querySelectorAll('.selection-strip').length).toBe(1);

     const rackTiles = rootEl.querySelectorAll('.hand-rack mj-tile');
     (rackTiles.item(0) as HTMLElement).click();
     (rackTiles.item(1) as HTMLElement).click();
     appFixture.detectChanges();
     expect(rootEl.querySelectorAll('.hand-rack .mj-tile.selected').length).toBe(2);

     const confirmBtn = rootEl.querySelector('.selection-actions .btn-emerald') as HTMLButtonElement;
     confirmBtn.click();
     appFixture.detectChanges();
     expect(rootEl.querySelectorAll('.selection-strip').length).toBe(0);

     // Toggle selection mode and cancel it, toggle Auto-Pass checkbox, and render Penalty Banner
     (rootEl.querySelectorAll('.action-bar button').item(0) as HTMLButtonElement).click();
     appFixture.detectChanges();
     expect(rootEl.querySelectorAll('.selection-strip').length).toBe(1);
     const cancelBtn = rootEl.querySelectorAll('.selection-actions button').item(1) as HTMLButtonElement;
     cancelBtn.click();
     appFixture.detectChanges();
     expect(rootEl.querySelectorAll('.selection-strip').length).toBe(0);

     const autoPassInput = rootEl.querySelector('.auto-pass-toggle input') as HTMLInputElement;
     autoPassInput.click();
     appFixture.detectChanges();
     expect(session.autoPass()).toBe(true);
     autoPassInput.click();
     appFixture.detectChanges();
     expect(session.autoPass()).toBe(false);

     const penSnap = session.snapshot()!;
     session.snapshot.set({
       ...penSnap,
       view: {
         ...penSnap.view!,
         lastPenalty: {
           seat: 0,
           actionType: 'win',
           isFalseWin: true,
           reasonCode: 'FALSE_WIN_FAN',
           rawFan: 3,
           minFan: 5,
           eachGain: 48,
           totalLost: 96,
         },
       },
     });
     appFixture.detectChanges();
     expect(rootEl.querySelectorAll('.penalty-banner').length).toBe(1);

    // Trigger Settlement modal (win state) and verify desktop table + mobile cards + bottom actions
    const curSnap = session.snapshot()!;
    session.snapshot.set({
      ...curSnap,
      view: {
        ...curSnap.view!,
        phase: 'handOver',
        result: {
          outcome: 'win',
          winnerSeat: 0,
          loserSeat: 1,
          selfDraw: false,
          winningTileId: 'p1_0',
          fanResult: {
            isShapeValid: true,
            canWin: true,
            rawFan: 12,
            cappedFan: 10,
            items: [{ name: '清一色', fan: 7 }, { name: '對對糊', fan: 3 }],
          },
          base: 128,
          deltas: [384, -384, 0],
          winningHand: ['p1_0', 'p1_1'],
          winningMelds: [{ type: 'pong', codes: ['p2', 'p2', 'p2'], concealed: false }],
          winningBonus: ['an1_0'],
        },
      },
    });
    appFixture.detectChanges();
    expect(rootEl.querySelectorAll('.modal-card .desktop-table tbody tr').length).toBe(3);
    expect(rootEl.querySelectorAll('.modal-card .mobile-app-card').length).toBe(3);

    // Leave session and verify return to Lobby
    session.leaveSession();
    await appFixture.whenStable();
    appFixture.detectChanges();
    expect(session.snapshot()).toBeNull();
  });
});
