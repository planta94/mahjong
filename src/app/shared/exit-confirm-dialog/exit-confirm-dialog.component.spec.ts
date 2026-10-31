import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from '../../app.component';
import { routes } from '../../app.routes';
import { GameSessionManagerService, SAVED_GAME_STORAGE_KEY } from '../../core/services/game-session-manager.service';
import { MahjongSessionService } from '../../core/services/mahjong-session.service';
import { DEFAULT_RULES } from '../../core/services/scorer.service';
import { ShellUiService } from '../../core/services/shell-ui.service';
import { TranslateService } from '../../core/services/translate.service';
import { ExitConfirmDialogComponent } from './exit-confirm-dialog.component';

describe('ExitConfirmDialogComponent', () => {
  beforeEach(async () => {
    localStorage.removeItem(SAVED_GAME_STORAGE_KEY);
    localStorage.removeItem('hkmj_lang');
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [AppComponent, ExitConfirmDialogComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  afterEach(() => {
    const manager = TestBed.inject(GameSessionManagerService);
    manager.killAllActiveSessions();
    vi.restoreAllMocks();
    localStorage.removeItem(SAVED_GAME_STORAGE_KEY);
    localStorage.removeItem('hkmj_lang');
    sessionStorage.clear();
  });

  it('conditionally mounts inside AppComponent only when gameManager.showExitConfirmModal() is true', () => {
    const gameManager = TestBed.inject(GameSessionManagerService);
    const mahjong = TestBed.inject(MahjongSessionService);

    const appFixture = TestBed.createComponent(AppComponent);
    appFixture.detectChanges();
    const appEl = appFixture.nativeElement as HTMLElement;

    expect(gameManager.showExitConfirmModal()).toBe(false);
    expect(appEl.querySelectorAll('app-exit-confirm-dialog').length).toBe(0);

    mahjong.startSolo('Tester', '3p', DEFAULT_RULES);
    gameManager.requestGoHome();
    appFixture.detectChanges();

    expect(gameManager.showExitConfirmModal()).toBe(true);
    expect(appEl.querySelectorAll('app-exit-confirm-dialog').length).toBe(1);

    (appEl.querySelector('.stay-btn') as HTMLButtonElement).click();
    appFixture.detectChanges();

    expect(gameManager.showExitConfirmModal()).toBe(false);
    expect(appEl.querySelectorAll('app-exit-confirm-dialog').length).toBe(0);
    expect(mahjong.snapshot()?.view?.numSeats).toBe(3);
  });

  it('renders bounded modal with zero header close buttons, stops inner card click propagation, and dismisses via backdrop or stay button', () => {
    const gameManager = TestBed.inject(GameSessionManagerService);
    const mahjong = TestBed.inject(MahjongSessionService);
    const shellUi = TestBed.inject(ShellUiService);
    const translate = TestBed.inject(TranslateService);
    translate.use('zh');
    const sfxSpy = vi.spyOn(shellUi, 'playSfx');

    // Online waiting lobby: active progress, but not savable
    mahjong.createOnlineRoom('RoomHost', '3p', DEFAULT_RULES);
    gameManager.requestGoHome();
    expect(gameManager.canSaveCurrentProgress()).toBe(false);
    expect(gameManager.showExitConfirmModal()).toBe(true);

    const fixture = TestBed.createComponent(ExitConfirmDialogComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const card = el.querySelector('.modal-card') as HTMLElement;
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-modal')).toBe('true');
    expect(el.querySelectorAll('.modal-header button').length).toBe(0);
    expect(el.querySelector('#exit-confirm-dialog-title')?.textContent).toContain('返回星冕桌游荟？');
    expect(el.querySelector('.exit-desc')?.textContent).toContain('确定要离开吗');
    expect(el.querySelectorAll('.modal-footer button').length).toBe(2);
    expect(el.querySelectorAll('.save-exit-btn').length).toBe(0);

    // Clicking inside modal-card stops propagation and keeps modal open
    card.click();
    expect(gameManager.showExitConfirmModal()).toBe(true);

    // Clicking backdrop triggers stay() and closes modal while preserving lobby
    (el.querySelector('.exit-confirm-backdrop') as HTMLElement).click();
    expect(sfxSpy).toHaveBeenCalledWith('click');
    expect(gameManager.showExitConfirmModal()).toBe(false);
    expect(mahjong.snapshot()?.role).toBe('host');

    // Re-open and click footer Stay button
    gameManager.requestGoHome();
    expect(gameManager.showExitConfirmModal()).toBe(true);
    (el.querySelector('.stay-btn') as HTMLButtonElement).click();
    expect(gameManager.showExitConfirmModal()).toBe(false);
    expect(mahjong.snapshot()?.role).toBe('host');
  });

  it('terminates active progress without saving when discard-and-exit footer button is clicked', () => {
    const gameManager = TestBed.inject(GameSessionManagerService);
    const mahjong = TestBed.inject(MahjongSessionService);
    const shellUi = TestBed.inject(ShellUiService);
    const sfxSpy = vi.spyOn(shellUi, 'playSfx');

    mahjong.startSolo('DiscardPlayer', '4p', DEFAULT_RULES);
    gameManager.requestGoHome();

    const fixture = TestBed.createComponent(ExitConfirmDialogComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('.modal-footer button').length).toBe(3);
    (el.querySelector('.discard-exit-btn') as HTMLButtonElement).click();

    expect(sfxSpy).toHaveBeenCalledWith('click');
    expect(gameManager.showExitConfirmModal()).toBe(false);
    expect(mahjong.snapshot()).toBeNull();
    expect(gameManager.savedGame()).toBeNull();
    expect(localStorage.getItem(SAVED_GAME_STORAGE_KEY)).toBeNull();
  });

  it('persists active match progress and exits cleanly when save-and-exit footer button is clicked', () => {
    const gameManager = TestBed.inject(GameSessionManagerService);
    const mahjong = TestBed.inject(MahjongSessionService);
    const shellUi = TestBed.inject(ShellUiService);
    const translate = TestBed.inject(TranslateService);
    translate.use('en');
    shellUi.setActiveGame('mahjong');
    const sfxSpy = vi.spyOn(shellUi, 'playSfx');

    mahjong.startSolo('SavePlayer', '3p', DEFAULT_RULES);
    gameManager.requestGoHome();
    expect(gameManager.canSaveCurrentProgress()).toBe(true);

    const fixture = TestBed.createComponent(ExitConfirmDialogComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.exit-desc')?.textContent).toContain('save your progress before leaving');
    expect(el.querySelectorAll('.modal-footer button').length).toBe(3);

    const saveBtn = el.querySelector('.save-exit-btn') as HTMLButtonElement;
    expect(saveBtn.textContent).toContain('Save & Return Home');
    saveBtn.click();

    expect(sfxSpy).toHaveBeenCalledWith('deal');
    expect(gameManager.showExitConfirmModal()).toBe(false);
    expect(mahjong.snapshot()).toBeNull();
    expect(gameManager.savedGame()?.game).toBe('mahjong');
    expect(localStorage.getItem(SAVED_GAME_STORAGE_KEY)?.includes('"mahjong"')).toBe(true);
  });
});
