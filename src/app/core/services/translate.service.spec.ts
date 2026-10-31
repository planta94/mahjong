import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslateService } from './translate.service';

describe('TranslateService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults to zh when localStorage has no saved language or an unsupported value', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(TranslateService);
    expect(service.currentLang()).toBe('zh');

    localStorage.setItem('hkmj_lang', 'ms');
    const fallbackInstance = new TranslateService();
    expect(fallbackInstance.currentLang()).toBe('zh');
  });

  it('restores saved en and zh language preferences from localStorage on creation', () => {
    localStorage.setItem('hkmj_lang', 'en');
    const enService = new TranslateService();
    expect(enService.currentLang()).toBe('en');

    localStorage.setItem('hkmj_lang', 'zh');
    const zhService = new TranslateService();
    expect(zhService.currentLang()).toBe('zh');
  });

  it('falls back gracefully when localStorage throws on read or write', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const restrictedService = new TranslateService();
    expect(restrictedService.currentLang()).toBe('zh');

    restrictedService.use('en');
    expect(restrictedService.currentLang()).toBe('en');
  });

  it('updates signal and persists language via use()', () => {
    const service = new TranslateService();
    service.use('en');
    expect(service.currentLang()).toBe('en');
    expect(localStorage.getItem('hkmj_lang')).toBe('en');

    service.use('zh');
    expect(service.currentLang()).toBe('zh');
    expect(localStorage.getItem('hkmj_lang')).toBe('zh');
  });

  it('resolves nested dictionary keys in both locales and returns the raw key when missing', () => {
    const service = new TranslateService();
    service.use('en');
    const enBrand = service.instant('HEADER.BRAND');
    expect(enBrand).toBe('Tabletop Royale');

    service.use('zh');
    const zhBrand = service.instant('HEADER.BRAND');
    expect(zhBrand).toBe('星冕桌游荟');
    expect(zhBrand).not.toBe(enBrand);

    expect(service.instant('NON_EXISTENT.KEY.PATH')).toBe('NON_EXISTENT.KEY.PATH');
  });

  it('interpolates single, multiple, and repeated template parameters cleanly', () => {
    const service = new TranslateService();
    const interpolated = service.instant('Hello {{name}}, seat {{seat}} ({{name}})', {
      name: 'Alice',
      seat: 2,
    });
    expect(interpolated).toBe('Hello Alice, seat 2 (Alice)');
  });
});
