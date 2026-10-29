import { TestBed } from '@angular/core/testing';
import en from '../../../../public/assets/i18n/en.json';
import ms from '../../../../public/assets/i18n/ms.json';
import zh from '../../../../public/assets/i18n/zh.json';
import { TranslateService } from './translate.service';

describe('i18n Translation Dictionary Parity & TranslateService', () => {
  function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    let keys: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        keys = keys.concat(flattenKeys(v as Record<string, unknown>, full));
      } else {
        keys.push(full);
      }
    }
    return keys;
  }

  const enKeys = flattenKeys(en as Record<string, unknown>).sort();
  const msKeys = flattenKeys(ms as Record<string, unknown>).sort();
  const zhKeys = flattenKeys(zh as Record<string, unknown>).sort();

  it('has identical key count across en, ms, and zh dictionaries', () => {
    expect(msKeys.length).toBe(enKeys.length);
    expect(zhKeys.length).toBe(enKeys.length);
  });

  it('contains zero missing or extra keys across Malay and Chinese dictionaries', () => {
    expect(enKeys.filter((k) => !msKeys.includes(k))).toEqual([]);
    expect(enKeys.filter((k) => !zhKeys.includes(k))).toEqual([]);
    expect(msKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(zhKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
  });

  it('contains non-empty string values for all translated keys', () => {
    function validateNonEmpty(obj: Record<string, unknown>, langName: string): void {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'object' && v !== null) {
          validateNonEmpty(v as Record<string, unknown>, langName);
        } else if (typeof v === 'string') {
          expect(v.trim().length, `Empty key "${k}" in ${langName}`).toBeGreaterThan(0);
        }
      }
    }

    validateNonEmpty(en as Record<string, unknown>, 'en.json');
    validateNonEmpty(ms as Record<string, unknown>, 'ms.json');
    validateNonEmpty(zh as Record<string, unknown>, 'zh.json');
  });

  it('switches active language and interpolates parameters in TranslateService', () => {
    localStorage.removeItem('hkmj_lang');
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(TranslateService);

    expect(svc.currentLang()).toBe('zh');
    expect(svc.instant('HEADER.FAN_SUMMARY', { min: 5, max: 10 })).toBe('5番起糊 · 10番封頂');

    svc.use('en');
    expect(svc.currentLang()).toBe('en');
    expect(svc.instant('HEADER.FAN_SUMMARY', { min: 5, max: 10 })).toBe('5 Fan Min · 10 Fan Cap');

    svc.use('ms');
    expect(svc.instant('HEADER.ROOM_CODE', { code: 'HK888' })).toBe('Bilik HK888');
    expect(svc.instant('UNKNOWN.KEY')).toBe('UNKNOWN.KEY');
  });
});
