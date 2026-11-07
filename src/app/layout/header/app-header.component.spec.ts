import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app.routes';
import { GameSessionManagerService, SAVED_GAME_STORAGE_KEY } from '../../core/services/game-session-manager.service';
import { MahjongSessionService } from '../../core/services/mahjong-session.service';
import { ShellUiService } from '../../core/services/shell-ui.service';
import { TranslateService } from '../../core/services/translate.service';
import { HubComponent } from '../../pages/hub/hub.component';
import { AppHeaderComponent } from './app-header.component';

describe('AppHeaderComponent', () => {
  beforeEach(async () => {
    localStorage.removeItem(SAVED_GAME_STORAGE_KEY);
    localStorage.removeItem('party_bgm_enabled');
    localStorage.removeItem('party_sound_enabled');
    localStorage.removeItem('hkmj_lang');
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [AppHeaderComponent, HubComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.removeItem(SAVED_GAME_STORAGE_KEY);
    localStorage.removeItem('party_bgm_enabled');
    localStorage.removeItem('party_sound_enabled');
    localStorage.removeItem('hkmj_lang');
    sessionStorage.clear();
  });

  it('renders active-game emblem, brand title, badge, clickable state, and document.title without Tabletop Royale inside active games', () => {
    const shellUi = TestBed.inject(ShellUiService);
    const translate = TestBed.inject(TranslateService);
    translate.use('zh');

    const hubFixture = TestBed.createComponent(HubComponent);
    hubFixture.detectChanges();
    const hubEl = hubFixture.nativeElement as HTMLElement;

    const fixture = TestBed.createComponent(AppHeaderComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const normalizeSvgMarkup = (markup: string | undefined): string =>
      (markup ?? '').replace(/\s*_ngcontent-[^=\s>]+=""/g, '').replace(/\s+/g, ' ').trim();

    const assertMatchesLobbyEmblem = (
      gameId: 'mahjong' | 'monopoly' | 'avalon' | 'pandemic' | 'balik-kampung'
    ): void => {
      const headerSvg = host.querySelector(`.brand-emblem.emblem-${gameId} svg`);
      const lobbySvg = hubEl.querySelector(`.tile-emblem.emblem-${gameId} svg`);
      expect(headerSvg?.getAttribute('viewBox')).toBe('0 0 64 64');
      expect(headerSvg?.getAttribute('viewBox')).toBe(lobbySvg?.getAttribute('viewBox'));
      expect(normalizeSvgMarkup(headerSvg?.innerHTML)).toBe(normalizeSvgMarkup(lobbySvg?.innerHTML));
    };

    // Default: hub
    expect(shellUi.activeGame()).toBe('hub');
    expect(host.querySelector('img.brand-logo')?.getAttribute('src')).toBe('favicon.svg');
    expect(host.querySelector('.brand')?.classList.contains('brand-clickable')).toBe(false);
    expect(host.querySelectorAll('.brand-kicker').length).toBe(0);
    expect(host.querySelector('.brand-title')?.textContent?.trim()).toBe('星冕桌游荟');
    expect(host.querySelector('.brand-badge')?.textContent?.trim()).toBe('皇家大厅');
    expect(host.querySelector('.brand-badge')?.classList.contains('badge-mahjong')).toBe(false);
    expect(host.querySelectorAll('.hub-btn').length).toBe(0);
    expect(document.title).toBe('星冕桌游荟');

    // Mahjong active game
    shellUi.setActiveGame('mahjong');
    fixture.detectChanges();
    expect(host.querySelector('.brand')?.classList.contains('brand-clickable')).toBe(true);
    expect(host.querySelectorAll('.brand-kicker').length).toBe(0);
    expect(host.querySelector('.brand-logo')?.classList.contains('emblem-mahjong')).toBe(true);
    assertMatchesLobbyEmblem('mahjong');
    expect(host.textContent).not.toContain('星冕桌游荟');
    expect(host.querySelector('.brand-title')?.textContent?.trim()).toBe('港马麻将馆');
    expect(host.querySelector('.brand-badge')?.textContent?.trim()).toBe('3–4人 · 港马麻将');
    expect(host.querySelector('.brand-badge')?.classList.contains('badge-mahjong')).toBe(true);
    expect(host.querySelectorAll('.hub-btn').length).toBe(1);
    expect(document.title).toBe('港马麻将馆');

    // Monopoly active game
    shellUi.setActiveGame('monopoly');
    fixture.detectChanges();
    expect(host.querySelector('.brand-logo')?.classList.contains('emblem-monopoly')).toBe(true);
    assertMatchesLobbyEmblem('monopoly');
    expect(host.querySelector('.brand-title')?.textContent?.trim()).toBe('大马地标大富翁');
    expect(host.querySelector('.brand-badge')?.textContent?.trim()).toBe('2–6人 · 大马大富翁');
    expect(host.querySelector('.brand-badge')?.classList.contains('badge-monopoly')).toBe(true);
    expect(document.title).toBe('大马地标大富翁');

    // Avalon active game
    shellUi.setActiveGame('avalon');
    fixture.detectChanges();
    expect(host.querySelector('.brand-logo')?.classList.contains('emblem-avalon')).toBe(true);
    assertMatchesLobbyEmblem('avalon');
    expect(host.querySelector('.brand-title')?.textContent?.trim()).toBe('阿瓦隆：圣杯传奇');
    expect(host.querySelector('.brand-badge')?.textContent?.trim()).toBe('5–10人 · 阿瓦隆');
    expect(host.querySelector('.brand-badge')?.classList.contains('badge-avalon')).toBe(true);
    expect(document.title).toBe('阿瓦隆：圣杯传奇');

    // Pandemic active game
    shellUi.setActiveGame('pandemic');
    fixture.detectChanges();
    expect(host.querySelector('.brand-logo')?.classList.contains('emblem-pandemic')).toBe(true);
    assertMatchesLobbyEmblem('pandemic');
    expect(host.querySelector('.brand-title')?.textContent?.trim()).toBe('瘟疫危机：全球防线');
    expect(host.querySelector('.brand-badge')?.textContent?.trim()).toBe('2–4人 · 瘟疫危机');
    expect(host.querySelector('.brand-badge')?.classList.contains('badge-pandemic')).toBe(true);
    expect(document.title).toBe('瘟疫危机：全球防线');

    // Balik Kampung active game
    shellUi.setActiveGame('balik-kampung');
    fixture.detectChanges();
    expect(host.querySelector('.brand-logo')?.classList.contains('emblem-balik-kampung')).toBe(true);
    assertMatchesLobbyEmblem('balik-kampung');
    expect(host.querySelector('.brand-title')?.textContent?.trim()).toBe('回乡大作战：南北大道');
    expect(host.querySelector('.brand-badge')?.textContent?.trim()).toBe('2–5人 · 回乡大作战');
    expect(host.querySelector('.brand-badge')?.classList.contains('badge-balik-kampung')).toBe(true);
    expect(document.title).toBe('回乡大作战：南北大道');

    // Switch back to Pandemic for English assertion
    shellUi.setActiveGame('pandemic');
    fixture.detectChanges();

    translate.use('en');
    fixture.detectChanges();
    expect(host.textContent).not.toContain('Tabletop Royale');
    expect(host.querySelector('.brand-title')?.textContent?.trim()).toBe('Pandemic: Global Defenses');
    expect(host.querySelector('.brand-badge')?.textContent?.trim()).toBe('2–4P · Pandemic');
    expect(document.title).toBe('Pandemic: Global Defenses');
  });

  it('toggles language between zh and en and updates localized labels and document.title', () => {
    const shellUi = TestBed.inject(ShellUiService);
    const translate = TestBed.inject(TranslateService);
    translate.use('zh');
    shellUi.setActiveGame('mahjong');

    const fixture = TestBed.createComponent(AppHeaderComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const langBtns = host.querySelectorAll('.lang-btn');
    expect(langBtns.length).toBe(2);
    expect(langBtns.item(0).textContent?.trim()).toBe('简中');
    expect(langBtns.item(1).textContent?.trim()).toBe('EN');
    expect(langBtns.item(0).classList.contains('active')).toBe(true);
    expect(langBtns.item(1).classList.contains('active')).toBe(false);

    // Switch to English
    (langBtns.item(1) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(translate.currentLang()).toBe('en');
    expect(langBtns.item(0).classList.contains('active')).toBe(false);
    expect(langBtns.item(1).classList.contains('active')).toBe(true);
    expect(host.querySelector('.brand-title')?.textContent?.trim()).toBe('HK & Fly Mahjong');
    expect(host.querySelector('.brand-badge')?.textContent?.trim()).toBe('3–4P · HK-MY Mahjong');
    expect(host.querySelector('.hub-btn .action-label')?.textContent?.trim()).toBe('All Games');
    expect(document.title).toBe('HK & Fly Mahjong');

    // Switch back to Simplified Chinese
    (langBtns.item(0) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(translate.currentLang()).toBe('zh');
    expect(langBtns.item(0).classList.contains('active')).toBe(true);
    expect(host.querySelector('.brand-title')?.textContent?.trim()).toBe('港马麻将馆');
    expect(document.title).toBe('港马麻将馆');
  });

  it('toggles BGM mute/unmute, sound effects mute/unmute, and opens contextual rulebook modal', () => {
    const shellUi = TestBed.inject(ShellUiService);
    const session = TestBed.inject(MahjongSessionService);
    const translate = TestBed.inject(TranslateService);
    translate.use('zh');
    shellUi.setActiveGame('monopoly');

    const fixture = TestBed.createComponent(AppHeaderComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    // BGM toggle button starts muted
    const bgmBtn = host.querySelector('.bgm-toggle-btn') as HTMLButtonElement;
    expect(shellUi.bgmEnabled()).toBe(false);
    expect(session.bgmEnabled()).toBe(false);
    expect(bgmBtn.classList.contains('toggle-muted')).toBe(true);
    expect(bgmBtn.classList.contains('toggle-on')).toBe(false);
    expect(bgmBtn.getAttribute('aria-label')).toBe('音乐关');

    bgmBtn.click();
    fixture.detectChanges();
    expect(shellUi.bgmEnabled()).toBe(true);
    expect(session.bgmEnabled()).toBe(true);
    expect(bgmBtn.classList.contains('toggle-on')).toBe(true);
    expect(bgmBtn.classList.contains('toggle-muted')).toBe(false);
    expect(bgmBtn.getAttribute('aria-label')).toBe('音乐开');

    bgmBtn.click();
    fixture.detectChanges();
    expect(shellUi.bgmEnabled()).toBe(false);
    expect(bgmBtn.classList.contains('toggle-muted')).toBe(true);

    // Sound effects toggle button (next sibling button after bgm-toggle-btn)
    const soundBtn = bgmBtn.nextElementSibling as HTMLButtonElement;
    expect(shellUi.soundEnabled()).toBe(true);
    expect(soundBtn.classList.contains('toggle-on')).toBe(true);
    expect(soundBtn.getAttribute('aria-label')).toBe('音效开');

    soundBtn.click();
    fixture.detectChanges();
    expect(shellUi.soundEnabled()).toBe(false);
    expect(soundBtn.classList.contains('toggle-muted')).toBe(true);
    expect(soundBtn.getAttribute('aria-label')).toBe('静音');

    // Rulebook trigger button syncs session.showRulebook and contextual rulebookGame
    const rulebookBtn = host.querySelector('.rulebook-btn') as HTMLButtonElement;
    expect(session.showRulebook()).toBe(false);
    rulebookBtn.click();
    fixture.detectChanges();
    expect(session.showRulebook()).toBe(true);
    expect(shellUi.showRulebookModal()).toBe(true);
    expect(shellUi.rulebookGame()).toBe('monopoly');
  });

  it('requests return home via hub button or brand click only when outside hub', () => {
    const shellUi = TestBed.inject(ShellUiService);
    const gameManager = TestBed.inject(GameSessionManagerService);
    const requestHomeSpy = vi.spyOn(gameManager, 'requestGoHome');
    const sfxSpy = vi.spyOn(shellUi, 'playSfx');

    const fixture = TestBed.createComponent(AppHeaderComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    // On hub, clicking brand is a no-op
    (host.querySelector('.brand') as HTMLElement).click();
    expect(requestHomeSpy).toHaveBeenCalledTimes(0);
    expect(sfxSpy).toHaveBeenCalledTimes(0);

    // On mahjong, hub button and brand click both invoke switchToHub -> requestGoHome
    shellUi.setActiveGame('mahjong');
    fixture.detectChanges();

    const hubBtn = host.querySelector('.hub-btn') as HTMLButtonElement;
    hubBtn.click();
    expect(sfxSpy).toHaveBeenCalledWith('click');
    expect(requestHomeSpy).toHaveBeenCalledTimes(1);

    (host.querySelector('.brand') as HTMLElement).click();
    expect(requestHomeSpy).toHaveBeenCalledTimes(2);
  });

  it('renders room code copy pill and leave room button when activeRoomCode is set and clears room on leave', () => {
    vi.useFakeTimers();
    const shellUi = TestBed.inject(ShellUiService);
    const translate = TestBed.inject(TranslateService);
    translate.use('zh');
    shellUi.setActiveGame('mahjong');

    const fixture = TestBed.createComponent(AppHeaderComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    // Hidden when no active room code
    expect(host.querySelectorAll('.room-code-btn').length).toBe(0);
    expect(host.querySelectorAll('.leave-btn').length).toBe(0);

    // Visible when activeRoomCode is assigned
    shellUi.setActiveRoomCode('hk8x4');
    fixture.detectChanges();
    expect(shellUi.activeRoomCode()).toBe('HK8X4');
    expect(host.querySelector('.room-code-short')?.textContent?.trim()).toBe('HK8X4');
    expect(host.querySelector('.room-code-btn')?.getAttribute('title')).toBe('(复制链接)');
    expect(host.querySelector('.room-code-btn .action-label')?.textContent).toContain('(复制链接)');

    // Clicking room code pill triggers copied toast state and resets after 2000ms
    const roomBtn = host.querySelector('.room-code-btn') as HTMLButtonElement;
    roomBtn.click();
    fixture.detectChanges();
    expect(shellUi.copiedToast()).toBe(true);
    expect(roomBtn.getAttribute('title')).toBe('已复制链接');
    expect(host.querySelector('.room-code-btn .action-label')?.textContent).toContain('已复制链接');

    vi.advanceTimersByTime(2000);
    fixture.detectChanges();
    expect(shellUi.copiedToast()).toBe(false);

    // Clicking leave room button clears activeRoomCode and dispatches mahjong:leave event
    let leaveEvents = 0;
    const onLeave = (): void => {
      leaveEvents += 1;
    };
    window.addEventListener('mahjong:leave', onLeave);
    try {
      const leaveBtn = host.querySelector('.leave-btn') as HTMLButtonElement;
      expect(leaveBtn.getAttribute('aria-label')).toBe('退出房间');
      leaveBtn.click();
      fixture.detectChanges();

      expect(shellUi.activeRoomCode()).toBeNull();
      expect(leaveEvents).toBe(1);
      expect(host.querySelectorAll('.room-code-btn').length).toBe(0);
      expect(host.querySelectorAll('.leave-btn').length).toBe(0);
    } finally {
      window.removeEventListener('mahjong:leave', onLeave);
    }
  });

  it('renders Exit Match label during an active started match and opens ExitConfirmDialog targeting gameLobby or hub', () => {
    const shellUi = TestBed.inject(ShellUiService);
    const gameManager = TestBed.inject(GameSessionManagerService);
    const mahjong = TestBed.inject(MahjongSessionService);
    const translate = TestBed.inject(TranslateService);
    translate.use('zh');
    shellUi.setActiveGame('mahjong');

    // Start a solo match: no roomCode, but activeProgress and startedMatch are true
    mahjong.startSolo('TestSolo', '3p', { minFan: 5, maxFan: 10, concealedFan: true, sevenPairs: true });
    expect(gameManager.hasStartedMatch()).toBe(true);

    const fixture = TestBed.createComponent(AppHeaderComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const leaveBtn = host.querySelector('.leave-btn') as HTMLButtonElement;
    expect(leaveBtn.getAttribute('aria-label')).toBe('退出对局');
    expect(leaveBtn.textContent?.trim()).toBe('退出对局');

    // Clicking leave button opens modal targeting gameLobby
    leaveBtn.click();
    fixture.detectChanges();
    expect(gameManager.showExitConfirmModal()).toBe(true);
    expect(gameManager.exitDestination()).toBe('gameLobby');

    // Cancel modal
    gameManager.cancelExitConfirm();
    expect(gameManager.showExitConfirmModal()).toBe(false);

    // Clicking All Games hub button opens modal targeting hub
    const hubBtn = host.querySelector('.hub-btn') as HTMLButtonElement;
    hubBtn.click();
    fixture.detectChanges();
    expect(gameManager.showExitConfirmModal()).toBe(true);
    expect(gameManager.exitDestination()).toBe('hub');

    // Switch to English and verify labels
    translate.use('en');
    fixture.detectChanges();
    expect(leaveBtn.getAttribute('aria-label')).toBe('Exit Match');
    expect(hubBtn.querySelector('.action-label')?.textContent?.trim()).toBe('All Games');
  });
});
