import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TILE_SPEC_MAP } from '../../core/utils/tiles.util';
import { TileComponent } from './tile.component';

describe('TileComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TileComponent],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders concealed back tile across default, sm, and xs sizes and interactive state classes on face-up tiles', () => {
    const fixture = TestBed.createComponent(TileComponent);
    const comp = fixture.componentInstance;

    // Face-down back tile across sizes
    fixture.componentRef.setInput('tile', 'back');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const backEl = host.querySelector('.mj-tile.tile-back') as HTMLElement;
    expect(comp.spec()).toBeNull();
    expect(comp.dotPips()).toEqual([]);
    expect(comp.bambooSticks()).toEqual([]);
    expect(backEl.classList.contains('sm')).toBe(false);
    expect(backEl.classList.contains('xs')).toBe(false);

    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    expect((host.querySelector('.mj-tile.tile-back') as HTMLElement).classList.contains('sm')).toBe(true);

    fixture.componentRef.setInput('size', 'xs');
    fixture.detectChanges();
    expect((host.querySelector('.mj-tile.tile-back') as HTMLElement).classList.contains('xs')).toBe(true);

    // Face-up interactive / disabled / selected / highlight / drawnGap inputs
    fixture.componentRef.setInput('tile', 'm5_0');
    fixture.componentRef.setInput('size', '');
    fixture.componentRef.setInput('clickable', false);
    fixture.componentRef.setInput('selected', false);
    fixture.componentRef.setInput('highlight', false);
    fixture.componentRef.setInput('drawnGap', false);
    fixture.detectChanges();

    const faceTile = host.querySelector('.mj-tile') as HTMLElement;
    expect(faceTile.classList.contains('clickable')).toBe(false);
    expect(faceTile.classList.contains('selected')).toBe(false);
    expect(faceTile.classList.contains('highlight-last')).toBe(false);
    expect(faceTile.classList.contains('drawn-gap')).toBe(false);

    fixture.componentRef.setInput('size', 'sm');
    fixture.componentRef.setInput('clickable', true);
    fixture.componentRef.setInput('selected', true);
    fixture.componentRef.setInput('highlight', true);
    fixture.componentRef.setInput('drawnGap', true);
    fixture.detectChanges();

    expect(faceTile.classList.contains('sm')).toBe(true);
    expect(faceTile.classList.contains('clickable')).toBe(true);
    expect(faceTile.classList.contains('selected')).toBe(true);
    expect(faceTile.classList.contains('highlight-last')).toBe(true);
    expect(faceTile.classList.contains('drawn-gap')).toBe(true);
  });

  it('renders Character (m1-m9), Dot (p1-p9), and Bamboo (s1-s9) suit tiles with exact pip and stick geometry', () => {
    const fixture = TestBed.createComponent(TileComponent);
    const comp = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    // Characters m1..m9
    for (let n = 1; n <= 9; n++) {
      fixture.componentRef.setInput('tile', `m${n}_0`);
      fixture.detectChanges();
      expect(host.querySelector('.t-corner.corner-navy')?.textContent?.trim()).toBe(String(n));
      expect(host.querySelector('.t-man-bot')?.textContent?.trim()).toBe('萬');
      expect(comp.dotPips()).toEqual([]);
      expect(comp.bambooSticks()).toEqual([]);
    }

    // Dots p1..p9 (each dot renders 2 concentric SVG circles)
    for (let n = 1; n <= 9; n++) {
      fixture.componentRef.setInput('tile', `p${n}_0`);
      fixture.detectChanges();
      expect(comp.dotPips().length).toBe(n);
      expect(comp.bambooSticks()).toEqual([]);
      expect(host.querySelector('.t-corner.corner-jade')?.textContent?.trim()).toBe(String(n));
      expect(host.querySelectorAll('svg.tile-svg circle').length).toBe(n * 2);
    }

    // Bamboo s1 (bird graphic + text) vs s2..s9 (rect sticks)
    fixture.componentRef.setInput('tile', 's1_0');
    fixture.detectChanges();
    expect(comp.bambooSticks()).toEqual([]);
    expect(host.querySelector('svg.tile-svg text')?.textContent?.trim()).toBe('一索');
    expect(host.querySelectorAll('svg.tile-svg rect').length).toBe(0);

    for (let n = 2; n <= 9; n++) {
      fixture.componentRef.setInput('tile', `s${n}_0`);
      fixture.detectChanges();
      expect(comp.bambooSticks().length).toBe(n);
      expect(comp.dotPips()).toEqual([]);
      expect(host.querySelectorAll('svg.tile-svg rect').length).toBe(n);
    }
  });

  it('renders winds, dragons (dw, dr, dg), Malaysian Fly joker (jk), flowers/seasons, and 3P animals/faces', () => {
    const fixture = TestBed.createComponent(TileComponent);
    const host = fixture.nativeElement as HTMLElement;

    // White Dragon board
    fixture.componentRef.setInput('tile', 'dw_0');
    fixture.detectChanges();
    expect(host.querySelector('.t-white-board')?.textContent?.trim()).toBe('白');
    expect(host.querySelectorAll('.t-honor').length).toBe(0);

    // Red & Green Dragons
    fixture.componentRef.setInput('tile', 'dr_0');
    fixture.detectChanges();
    expect(host.querySelector('.t-honor.red')?.textContent?.trim()).toBe('中');

    fixture.componentRef.setInput('tile', 'dg_0');
    fixture.detectChanges();
    expect(host.querySelector('.t-honor.green')?.textContent?.trim()).toBe('發');

    // Four Winds
    const windExpectations: ReadonlyArray<readonly [string, string]> = [
      ['we_0', '東'],
      ['ws_0', '南'],
      ['ww_0', '西'],
      ['wn_0', '北'],
    ];
    for (const [code, glyph] of windExpectations) {
      fixture.componentRef.setInput('tile', code);
      fixture.detectChanges();
      expect(host.querySelector('.t-honor.wind')?.textContent?.trim()).toBe(glyph);
    }

    // Malaysian 3P Fly wildcard (jk)
    fixture.componentRef.setInput('tile', 'jk_0');
    fixture.detectChanges();
    expect((host.querySelector('.mj-tile') as HTMLElement).classList.contains('tile-joker')).toBe(true);
    expect((host.querySelector('.mj-tile') as HTMLElement).getAttribute('title')).toBe('飛牌');
    expect(host.querySelector('.t-joker-main')?.textContent?.trim()).toBe('飛');
    expect(host.querySelector('.t-joker-sub')?.textContent?.trim()).toBe('百搭');

    // Flowers f1..f4 and Seasons b1..b4 render pure botanical SVGs without raw Kanji text
    for (let i = 1; i <= 4; i++) {
      fixture.componentRef.setInput('tile', `f${i}_0`);
      fixture.detectChanges();
      expect((host.querySelector('.mj-tile') as HTMLElement).classList.contains('tile-bonus')).toBe(true);
      expect(host.querySelector('.t-corner.corner-crimson')?.textContent?.trim()).toBe(String(i));
      expect(host.querySelectorAll('svg.tile-svg').length).toBe(1);
      expect(/[春夏秋冬梅蘭菊竹]/.test(host.textContent ?? '')).toBe(false);

      fixture.componentRef.setInput('tile', `b${i}_0`);
      fixture.detectChanges();
      expect(host.querySelector('.t-corner.corner-navy')?.textContent?.trim()).toBe(String(i));
      expect(host.querySelectorAll('svg.tile-svg').length).toBe(1);
      expect(/[春夏秋冬梅蘭菊竹]/.test(host.textContent ?? '')).toBe(false);
    }

    // Malaysian 3P Animals (an1..an4)
    const animals: ReadonlyArray<readonly [string, string]> = [
      ['an1_0', '🐱'],
      ['an2_0', '🐭'],
      ['an3_0', '🐓'],
      ['an4_0', '🐛'],
    ];
    for (const [code, emoji] of animals) {
      fixture.componentRef.setInput('tile', code);
      fixture.detectChanges();
      expect(host.querySelector('.t-corner.corner-gold')?.textContent?.trim()).toBe('★');
      expect(host.querySelector('.t-bonus-icon')?.textContent?.trim()).toBe(emoji);
    }

    // Malaysian 3P Faces (fc1..fc2 male, fc3..fc4 female)
    const faces: ReadonlyArray<readonly [string, string]> = [
      ['fc1_0', '🤴'],
      ['fc2_0', '🤴'],
      ['fc3_0', '👸'],
      ['fc4_0', '👸'],
    ];
    for (const [code, icon] of faces) {
      fixture.componentRef.setInput('tile', code);
      fixture.detectChanges();
      expect(host.querySelector('.t-corner.corner-crimson')?.textContent?.trim()).toBe('♦');
      expect(host.querySelector('.t-bonus-icon')?.textContent?.trim()).toBe(icon);
    }
  });

  it('handles unknown fallback tile codes and out-of-range suit numbers cleanly', () => {
    const fixture = TestBed.createComponent(TileComponent);
    const comp = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    // Unknown code with and without copy suffix falls back to '?' honor spec
    fixture.componentRef.setInput('tile', 'zz_0');
    fixture.detectChanges();
    expect(comp.spec()?.code).toBe('unknown');
    expect(host.querySelector('.t-honor')?.textContent?.trim()).toBe('?');
    expect((host.querySelector('.mj-tile') as HTMLElement).getAttribute('title')).toBe('?');
    expect(comp.dotPips()).toEqual([]);
    expect(comp.bambooSticks()).toEqual([]);

    fixture.componentRef.setInput('tile', 'mystery');
    fixture.detectChanges();
    expect(comp.spec()?.glyph).toBe('?');

    // Exercise ?? [] fallbacks in dotPips and bambooSticks when suit num is outside 1..9
    const realSpecGet = TILE_SPEC_MAP.get.bind(TILE_SPEC_MAP);
    vi.spyOn(TILE_SPEC_MAP, 'get').mockImplementation((code: string) => {
      if (code === 'p99') {
        return { code: 'p99', kind: 'suit', suit: 'p', num: 99, name: '?', sort: 99 };
      }
      if (code === 's99') {
        return { code: 's99', kind: 'suit', suit: 's', num: 99, name: '?', sort: 99 };
      }
      return realSpecGet(code);
    });

    fixture.componentRef.setInput('tile', 'p99');
    fixture.detectChanges();
    expect(comp.dotPips()).toEqual([]);

    fixture.componentRef.setInput('tile', 's99');
    fixture.detectChanges();
    expect(comp.bambooSticks()).toEqual([]);
  });
});
