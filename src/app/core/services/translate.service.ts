import { Injectable, signal } from '@angular/core';
import en from '../../../../public/assets/i18n/en.json';
import ms from '../../../../public/assets/i18n/ms.json';
import zh from '../../../../public/assets/i18n/zh.json';
import { SupportedLang } from '../models/mahjong.model';

function flattenToMap(obj: Record<string, unknown>, prefix = '', out = new Map<string, string>()): Map<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      flattenToMap(v as Record<string, unknown>, key, out);
    } else if (typeof v === 'string') {
      out.set(key, v);
    }
  }
  return out;
}

const DICTIONARIES: ReadonlyMap<SupportedLang, ReadonlyMap<string, string>> = new Map([
  ['en', flattenToMap(en as Record<string, unknown>)],
  ['zh', flattenToMap(zh as Record<string, unknown>)],
  ['ms', flattenToMap(ms as Record<string, unknown>)],
]);

@Injectable({ providedIn: 'root' })
export class TranslateService {
  readonly currentLang = signal<SupportedLang>(this.loadInitialLang());

  private loadInitialLang(): SupportedLang {
    try {
      const saved = localStorage.getItem('hkmj_lang');
      if (saved === 'en' || saved === 'zh' || saved === 'ms') {
        return saved;
      }
    } catch {
      // Fallback to zh in restricted environments
    }
    return 'zh';
  }

  use(lang: SupportedLang): void {
    this.currentLang.set(lang);
    try {
      localStorage.setItem('hkmj_lang', lang);
    } catch {
      // Ignore storage write errors
    }
  }

  instant(key: string, params?: Record<string, string | number>): string {
    const dict = DICTIONARIES.get(this.currentLang()) ?? DICTIONARIES.get('zh');
    const template = dict?.get(key) ?? key;
    if (!params) return template;

    let result = template;
    for (const [paramKey, paramVal] of Object.entries(params)) {
      result = result.replaceAll(`{{${paramKey}}}`, String(paramVal));
    }
    return result;
  }
}
