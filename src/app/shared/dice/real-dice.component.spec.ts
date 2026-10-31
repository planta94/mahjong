import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslateService } from '../../core/services/translate.service';
import { RealDiceComponent } from './real-dice.component';

describe('RealDiceComponent', () => {
  beforeEach(async () => {
    localStorage.removeItem('hkmj_lang');
    await TestBed.configureTestingModule({
      imports: [RealDiceComponent],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem('hkmj_lang');
  });

  it('renders default [1, 1] pair with 9 pip slots per die, crimson center pip, sum pill, and doubles badge', () => {
    const translate = TestBed.inject(TranslateService);
    translate.use('zh');

    const fixture = TestBed.createComponent(RealDiceComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    expect(comp.dieOne()).toBe(1);
    expect(comp.dieTwo()).toBe(1);
    expect(comp.diceSum()).toBe(2);
    expect(comp.isDoubles()).toBe(true);

    const widget = host.querySelector('.real-dice-widget') as HTMLElement;
    expect(widget.getAttribute('aria-label')).toBe('1 + 1');
    expect(widget.classList.contains('compact')).toBe(false);
    expect(widget.classList.contains('is-rolling')).toBe(false);

    const cubes = host.querySelectorAll('.die-cube');
    expect(cubes.length).toBe(2);
    expect(cubes.item(0).classList.contains('die-second')).toBe(false);
    expect(cubes.item(1).classList.contains('die-second')).toBe(true);
    expect(cubes.item(0).querySelectorAll('.pip-slot').length).toBe(9);
    expect(cubes.item(0).querySelectorAll('.pip-dot.pip-red.pip-one').length).toBe(1);

    expect(host.querySelector('.dice-sum-pill')?.textContent?.trim()).toBe('共 2 点');
    expect(host.querySelectorAll('.doubles-pill').length).toBe(1);
    expect(host.querySelector('.doubles-pill')?.textContent?.trim()).toBe('双骰连投！');
  });

  it('renders exact 3x3 pip positions and crimson vs dark styling across all faces 1 through 6', () => {
    const expectedLayouts: ReadonlyArray<readonly [number, readonly number[], boolean, boolean]> = [
      [1, [4], true, true],
      [2, [2, 6], false, false],
      [3, [2, 4, 6], false, false],
      [4, [0, 2, 6, 8], true, false],
      [5, [0, 2, 4, 6, 8], false, false],
      [6, [0, 2, 3, 5, 6, 8], false, false],
    ];

    const fixture = TestBed.createComponent(RealDiceComponent);
    const comp = fixture.componentInstance;

    for (const [face, expectedCells, expectRed, expectSingle] of expectedLayouts) {
      const otherFace = face === 6 ? 1 : 6;
      fixture.componentRef.setInput('values', [face, otherFace]);
      fixture.detectChanges();

      const firstCube = (fixture.nativeElement as HTMLElement).querySelectorAll('.die-cube').item(0);
      expect(firstCube.getAttribute('data-face')).toBe(String(face));

      const slots = firstCube.querySelectorAll('.pip-slot');
      const renderedCells: number[] = [];
      slots.forEach((slot, idx) => {
        if (slot.querySelector('.pip-dot') !== null) {
          renderedCells.push(idx);
        }
      });

      expect(renderedCells).toEqual([...expectedCells]);
      expect(firstCube.querySelectorAll('.pip-dot').length).toBe(face);
      expect(firstCube.querySelectorAll('.pip-dot.pip-red').length).toBe(expectRed ? face : 0);
      expect(firstCube.querySelectorAll('.pip-dot.pip-one').length).toBe(expectSingle ? 1 : 0);
      expect(comp.isRedFace(face)).toBe(expectRed);
      expect(comp.isDoubles()).toBe(false);
    }

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.doubles-pill').length).toBe(0);
  });

  it('applies rolling and compact CSS state classes and updates English sum label', () => {
    const translate = TestBed.inject(TranslateService);
    translate.use('en');

    const fixture = TestBed.createComponent(RealDiceComponent);
    fixture.componentRef.setInput('values', [3, 5]);
    fixture.componentRef.setInput('rolling', true);
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const widget = host.querySelector('.real-dice-widget') as HTMLElement;
    expect(widget.classList.contains('is-rolling')).toBe(true);
    expect(widget.classList.contains('compact')).toBe(true);
    expect(widget.getAttribute('aria-label')).toBe('3 + 5');
    expect(host.querySelector('.dice-sum-pill')?.textContent?.trim()).toBe('Total 8');
    expect(host.querySelectorAll('.doubles-pill').length).toBe(0);

    fixture.componentRef.setInput('rolling', false);
    fixture.componentRef.setInput('compact', false);
    fixture.detectChanges();
    expect(widget.classList.contains('is-rolling')).toBe(false);
    expect(widget.classList.contains('compact')).toBe(false);
  });

  it('clamps out-of-range, fractional, non-finite, and missing tuple entries safely', () => {
    const fixture = TestBed.createComponent(RealDiceComponent);
    const comp = fixture.componentInstance;

    // Out-of-range low and high values
    fixture.componentRef.setInput('values', [-4, 99]);
    fixture.detectChanges();
    expect(comp.dieOne()).toBe(1);
    expect(comp.dieTwo()).toBe(6);
    expect(comp.diceSum()).toBe(7);

    // Fractional values round to nearest valid die face
    fixture.componentRef.setInput('values', [2.4, 3.6]);
    fixture.detectChanges();
    expect(comp.dieOne()).toBe(2);
    expect(comp.dieTwo()).toBe(4);
    expect(comp.diceSum()).toBe(6);

    // Non-finite values (NaN, Infinity, -Infinity) fall back to 1
    fixture.componentRef.setInput('values', [Number.NaN, Number.POSITIVE_INFINITY]);
    fixture.detectChanges();
    expect(comp.dieOne()).toBe(1);
    expect(comp.dieTwo()).toBe(1);
    expect(comp.isRedFace(Number.NEGATIVE_INFINITY)).toBe(true);

    // Runtime missing tuple elements exercise ?? 1 fallbacks in dieOne and dieTwo
    const emptyTuple = [] as unknown as readonly [number, number];
    fixture.componentRef.setInput('values', emptyTuple);
    fixture.detectChanges();
    expect(comp.dieOne()).toBe(1);
    expect(comp.dieTwo()).toBe(1);

    const singleTuple = [5] as unknown as readonly [number, number];
    fixture.componentRef.setInput('values', singleTuple);
    fixture.detectChanges();
    expect(comp.dieOne()).toBe(5);
    expect(comp.dieTwo()).toBe(1);

    // Exercise ?? [4] center-pip fallback in hasPip when layout lookup returns undefined
    const mapGetSpy = vi.spyOn(Map.prototype, 'get').mockReturnValueOnce(undefined);
    expect(comp.hasPip(6, 4)).toBe(true);
    mapGetSpy.mockRestore();
    expect(comp.hasPip(6, 4)).toBe(false);
  });
});
