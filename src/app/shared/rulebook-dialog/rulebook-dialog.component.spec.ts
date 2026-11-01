import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HALF_SPICY_BASE } from '../../core/services/scorer.service';
import { ShellUiService } from '../../core/services/shell-ui.service';
import { TranslateService } from '../../core/services/translate.service';
import { PLAYER_COUNT_RATIOS, QUEST_TEAM_SIZES } from '../../games/avalon/data/avalon-config.data';
import { RulebookDialogComponent } from './rulebook-dialog.component';

describe('RulebookDialogComponent', () => {
  beforeEach(async () => {
    localStorage.removeItem('hkmj_lang');
    await TestBed.configureTestingModule({
      imports: [RulebookDialogComponent],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem('hkmj_lang');
  });

  it('enforces bounded modal structure with zero header buttons and emits closed from footer button or backdrop', () => {
    const translate = TestBed.inject(TranslateService);
    translate.use('zh');

    const fixture = TestBed.createComponent(RulebookDialogComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const modalCard = el.querySelector('.modal-card.rulebook-modal-card') as HTMLElement;
    expect(modalCard.getAttribute('role')).toBe('dialog');
    expect(modalCard.getAttribute('aria-modal')).toBe('true');
    expect(modalCard.getAttribute('aria-labelledby')).toBe('rulebook-dialog-title');
    expect(el.querySelectorAll('.modal-header button').length).toBe(0);
    expect(el.querySelectorAll('.modal-body').length).toBe(1);
    expect(el.querySelectorAll('.modal-footer button').length).toBe(1);

    let closedCount = 0;
    fixture.componentInstance.closed.subscribe(() => {
      closedCount += 1;
    });

    // Clicking inside modal-card stops propagation without closing
    modalCard.click();
    expect(closedCount).toBe(0);

    // Clicking bottom footer close button emits closed
    const footerCloseBtn = el.querySelector('.modal-footer button') as HTMLButtonElement;
    expect(footerCloseBtn.textContent?.trim()).toBe('关闭');
    footerCloseBtn.click();
    expect(closedCount).toBe(1);

    // Clicking outer backdrop also emits closed
    (el.querySelector('.modal-backdrop') as HTMLElement).click();
    expect(closedCount).toBe(2);
  });

  it('switches between Mahjong, Monopoly, and Avalon tabs and renders desktop tables and mobile cards', () => {
    const shellUi = TestBed.inject(ShellUiService);
    const translate = TestBed.inject(TranslateService);
    translate.use('zh');
    shellUi.openRulebook('mahjong');
    const sfxSpy = vi.spyOn(shellUi, 'playSfx');

    const fixture = TestBed.createComponent(RulebookDialogComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const tabs = el.querySelectorAll('.rulebook-tab-btn');
    expect(tabs.length).toBe(4);

    // 1. Mahjong tab (default)
    expect(tabs.item(0).classList.contains('active')).toBe(true);
    expect(tabs.item(0).getAttribute('aria-selected')).toBe('true');
    expect(tabs.item(1).getAttribute('aria-selected')).toBe('false');
    expect(el.querySelector('#rulebook-dialog-title')?.textContent).toContain('香港四人麻将 & 大马三人飞麻');
    expect(el.querySelectorAll('.desktop-table tbody tr').length).toBe(6);
    expect(el.querySelectorAll('.mobile-cards .mobile-app-card').length).toBe(6);
    expect(el.querySelectorAll('.desktop-table tbody tr').item(0).textContent).toContain('24');
    expect(el.querySelectorAll('.desktop-table tbody tr').item(5).textContent).toContain('(封顶)');
    expect(el.querySelectorAll('.desktop-table tbody tr').item(5).textContent).toContain('128');

    // 2. Switch to Monopoly tab
    (tabs.item(1) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(sfxSpy).toHaveBeenCalledWith('click');
    expect(shellUi.rulebookGame()).toBe('monopoly');
    expect(tabs.item(1).classList.contains('active')).toBe(true);
    expect(el.querySelector('#rulebook-dialog-title')?.textContent).toContain('大马地标大富翁');
    expect(el.querySelectorAll('.desktop-table tbody tr').length).toBe(3);
    expect(el.querySelectorAll('.mobile-cards .mobile-app-card').length).toBe(3);
    expect(el.textContent).toContain('RM 1,500');

    // 3. Switch to Avalon tab
    (tabs.item(2) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(shellUi.rulebookGame()).toBe('avalon');
    expect(tabs.item(2).classList.contains('active')).toBe(true);
    expect(el.querySelector('#rulebook-dialog-title')?.textContent).toContain('阿瓦隆');
    expect(el.querySelectorAll('.desktop-table tbody tr').length).toBe(6);
    expect(el.querySelectorAll('.mobile-cards .mobile-app-card').length).toBe(6);
    // 7P, 8P, 9P, 10P require 2 fails on Quest 4 (4 rows with .matrix-note)
    expect(el.querySelectorAll('.desktop-table .matrix-note').length).toBe(4);

    // 4. Switch to Pandemic tab
    (tabs.item(3) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(shellUi.rulebookGame()).toBe('pandemic');
    expect(tabs.item(3).classList.contains('active')).toBe(true);
    expect(el.querySelector('#rulebook-dialog-title')?.textContent).toContain('瘟疫危机');
    expect(el.querySelectorAll('.desktop-table').length).toBe(2);
    expect(el.querySelectorAll('.mobile-cards').length).toBe(2);
    // 7 roles + 3 difficulties = 10 rows
    expect(el.querySelectorAll('.desktop-table tbody tr').length).toBe(10);
    expect(el.querySelectorAll('.mobile-cards .mobile-app-card').length).toBe(10);
  });

  it('uses defensive fallback defaults for payoutRows and avalonMatrixRows when table lookups return undefined', () => {
    const realAt = HALF_SPICY_BASE.at.bind(HALF_SPICY_BASE);
    const realRatioGet = PLAYER_COUNT_RATIOS.get.bind(PLAYER_COUNT_RATIOS);
    const realQuestsGet = QUEST_TEAM_SIZES.get.bind(QUEST_TEAM_SIZES);

    vi.spyOn(HALF_SPICY_BASE, 'at').mockImplementation((idx: number) =>
      idx === 5 ? undefined : realAt(idx)
    );
    vi.spyOn(PLAYER_COUNT_RATIOS, 'get').mockImplementation((players: number) =>
      players === 8 ? undefined : realRatioGet(players)
    );
    vi.spyOn(QUEST_TEAM_SIZES, 'get').mockImplementation((players: number) =>
      players === 8 ? undefined : realQuestsGet(players)
    );

    const fixture = TestBed.createComponent(RulebookDialogComponent);
    const comp = fixture.componentInstance;

    // Fan 5 uses ?? 1 fallback while Fan 10 keeps standard Half-Spicy base 128
    expect(comp.payoutRows.at(0)).toEqual({ fan: 5, base: 1 });
    expect(comp.payoutRows.at(5)).toEqual({ fan: 10, base: 128 });

    // 8P uses ?? { good: 3, evil: 2 } and ?? [2, 3, 2, 3, 3] fallbacks while retaining twoFailsOnQ4: true
    expect(comp.avalonMatrixRows.at(3)).toEqual({
      players: 8,
      good: 3,
      evil: 2,
      questsLabel: '2 · 3 · 2 · 3 · 3',
      twoFailsOnQ4: true,
    });
    // 5P uses standard config values and twoFailsOnQ4: false
    expect(comp.avalonMatrixRows.at(0)).toEqual({
      players: 5,
      good: 3,
      evil: 2,
      questsLabel: '2 · 3 · 2 · 3 · 3',
      twoFailsOnQ4: false,
    });
  });
});
