// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { GamePlaceholderComponent } from './game-placeholder.component';
import { ShellUiService } from '../../core/services/shell-ui.service';

describe('GamePlaceholderComponent', () => {
  let fixture: ComponentFixture<GamePlaceholderComponent>;
  let component: GamePlaceholderComponent;
  let shellUi: ShellUiService;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    if (typeof document !== 'undefined' && document.body) {
      delete document.body.dataset['theme'];
    }

    await TestBed.configureTestingModule({
      imports: [GamePlaceholderComponent],
      providers: [
        provideRouter([
          { path: 'monopoly/lobby', component: GamePlaceholderComponent },
          { path: 'avalon/lobby', component: GamePlaceholderComponent },
          { path: '', component: GamePlaceholderComponent },
        ]),
      ],
    }).compileComponents();

    shellUi = TestBed.inject(ShellUiService);
    router = TestBed.inject(Router);
  });

  it('sets monopoly theme and game name when navigating to monopoly route', async () => {
    await router.navigateByUrl('/monopoly/lobby');
    fixture = TestBed.createComponent(GamePlaceholderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.gameName).toBe('Malaysia Landmarks Monopoly (大馬地標大富翁)');
    expect(shellUi.activeGame()).toBe('monopoly');
    expect(document.body.dataset['theme']).toBe('monopoly');

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.placeholder-title')?.textContent).toBe('Malaysia Landmarks Monopoly (大馬地標大富翁)');
  });

  it('sets avalon theme and game name when navigating to avalon route', async () => {
    await router.navigateByUrl('/avalon/lobby');
    fixture = TestBed.createComponent(GamePlaceholderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.gameName).toBe('The Resistance: Avalon (阿瓦隆)');
    expect(shellUi.activeGame()).toBe('avalon');
    expect(document.body.dataset['theme']).toBe('avalon');

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.placeholder-title')?.textContent).toBe('The Resistance: Avalon (阿瓦隆)');
  });

  it('navigates back to hub on returnToHub button click', async () => {
    await router.navigateByUrl('/monopoly/lobby');
    fixture = TestBed.createComponent(GamePlaceholderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector('.btn-back') as HTMLButtonElement;
    btn.click();
    await fixture.whenStable();

    expect(router.url).toBe('/');
  });
});
