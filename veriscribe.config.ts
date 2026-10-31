import { defineConfig } from 'veriscribe/config';

export default defineConfig({
  router: {
    mode: 'path',
    baseHref: '/',
  },
  i18n: {
    locales: ['en', 'zh'],
    defaultLocale: 'en',
    switchLocale: async (page, locale) => {
      await page.evaluate((l: string) => localStorage.setItem('hkmj_lang', l), locale);
      await page.reload();
    },
  },
  checks: {
    i18nKeys: { keySources: ['public/assets/i18n'] },
  },
  gate: {
    minMeaningfulAssertions: 1,
    unitReport: 'test-results/vitest-results.json',
    coverage: {
      file: 'coverage/hk-mahjong/lcov.info',
      branches: 70,
      lines: 80,
    },
    allowList: [
      { item: 'slice:home', reason: 'Living user manual generation intentionally skipped' },
      { item: 'slice:mahjong-lobby', reason: 'Living user manual generation intentionally skipped' },
      { item: 'slice:mahjong-table', reason: 'Living user manual generation intentionally skipped' },
      { item: 'slice:monopoly-lobby', reason: 'Living user manual generation intentionally skipped' },
      { item: 'slice:monopoly-board', reason: 'Living user manual generation intentionally skipped' },
      { item: 'slice:avalon-lobby', reason: 'Living user manual generation intentionally skipped' },
      { item: 'slice:avalon-table', reason: 'Living user manual generation intentionally skipped' },
    ],
  },
});
