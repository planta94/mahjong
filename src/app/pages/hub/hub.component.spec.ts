import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { ShellUiService } from '../../core/services/shell-ui.service';
import { TranslateService } from '../../core/services/translate.service';
import { HubComponent } from './hub.component';

describe('HubComponent', () => {
  let fixture: ComponentFixture<HubComponent>;
  let component: HubComponent;
  let shellUi: ShellUiService;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HubComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: new Map<string, string>(),
            },
          },
        },
      ],
    }).compileComponents();

    shellUi = TestBed.inject(ShellUiService);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(HubComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('mounts and initializes hub signals, nickname, and renders 3 compact game tiles without inline detail modal', () => {
    expect(shellUi.activeGame()).toBe('hub');
    expect(shellUi.activeRoomCode()).toBe(null);
    expect(component.nicknameInput()).toBe('雀友');
    expect(component.isEditingNickname()).toBe(false);
    expect(component.selectedGame()).toBe(null);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.game-card.game-tile').length).toBe(3);
    expect(el.querySelector('.mahjong-card') !== null).toBe(true);
    expect(el.querySelector('.monopoly-card') !== null).toBe(true);
    expect(el.querySelector('.avalon-card') !== null).toBe(true);
    expect(el.querySelector('.game-detail-modal')).toBe(null);
    expect(el.querySelectorAll('.card-features').length).toBe(0);
  });

  it('opens the game detail dialog when a tile is clicked and enters the game only via the dialog enter button', () => {
    let target = '';
    router.navigate = ((commands: string[]) => {
      target = commands.at(0) ?? '';
      return Promise.resolve(true);
    }) as unknown as typeof router.navigate;

    const el = fixture.nativeElement as HTMLElement;

    // Clicking Monopoly tile opens detail modal without navigating
    const monoTile = el.querySelector('.monopoly-card') as HTMLButtonElement;
    monoTile.click();
    fixture.detectChanges();

    expect(component.selectedGame()).toBe('monopoly');
    expect(target).toBe('');
    const modal = el.querySelector('.game-detail-modal') as HTMLElement;
    expect(modal !== null).toBe(true);
    expect(modal.querySelectorAll('.modal-header button').length).toBe(0);
    expect(modal.querySelectorAll('.card-features li').length).toBe(3);

    // Rules button inside detail modal opens monopoly rulebook
    const rulesBtn = modal.querySelector('.detail-rules-btn') as HTMLButtonElement;
    rulesBtn.click();
    expect(shellUi.showRulebookModal()).toBe(true);
    expect(shellUi.rulebookGame()).toBe('monopoly');
    shellUi.closeRulebook();

    // Close button dismisses modal without navigating
    const closeBtn = modal.querySelector('.detail-close-btn') as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();
    expect(component.selectedGame()).toBe(null);
    expect(el.querySelector('.game-detail-modal')).toBe(null);
    expect(target).toBe('');

    // Re-open Avalon tile and click the dialog's Enter button to navigate
    const avaTile = el.querySelector('.avalon-card') as HTMLButtonElement;
    avaTile.click();
    fixture.detectChanges();
    const enterBtn = el.querySelector('.game-detail-modal .detail-enter-btn') as HTMLButtonElement;
    enterBtn.click();
    fixture.detectChanges();
    expect(component.selectedGame()).toBe(null);
    expect(target).toBe('/avalon/lobby');
  });

  it('allows editing and saving the player nickname', () => {
    component.startEditNickname();
    expect(component.isEditingNickname()).toBe(true);

    component.onNicknameChange('TycoonBob');
    expect(component.nicknameInput()).toBe('TycoonBob');

    component.saveNickname();
    expect(component.isEditingNickname()).toBe(false);
    expect(shellUi.playerNickname()).toBe('TycoonBob');

    // Cancel edit reverts to current nickname
    component.startEditNickname();
    component.onNicknameChange('ChangedMind');
    component.cancelEditNickname();
    expect(component.isEditingNickname()).toBe(false);
    expect(component.nicknameInput()).toBe('TycoonBob');
  });

  it('validates empty and invalid room codes on join', () => {
    component.onRoomCodeChange('');
    component.joinRoom();
    expect(component.joinError()).toBe('HUB.ERROR_EMPTY_ROOM');

    // Typing in room code input clears previous error
    component.onRoomCodeChange('M');
    expect(component.joinError()).toBe(null);

    // Completely invalid characters
    component.onRoomCodeChange('!@#$%');
    component.joinRoom();
    expect(component.joinError()).toBe('HUB.ERROR_INVALID_ROOM');
  });

  it('routes correctly when joining games via prefixed room codes', () => {
    let navigatedPath = '';
    let navParams: Record<string, unknown> | undefined;

    router.navigate = ((commands: string[], extras?: { queryParams?: Record<string, unknown> }) => {
      navigatedPath = commands.at(0) ?? '';
      navParams = extras?.queryParams;
      return Promise.resolve(true);
    }) as unknown as typeof router.navigate;

    // Monopoly code
    component.onRoomCodeChange('P9876');
    component.joinRoom();
    expect(navigatedPath).toBe('/monopoly/lobby');
    expect(navParams).toEqual({ room: 'P9876' });

    // Avalon code
    component.onRoomCodeChange('A1234');
    component.joinRoom();
    expect(navigatedPath).toBe('/avalon/lobby');
    expect(navParams).toEqual({ room: 'A1234' });

    // Mahjong code
    component.onRoomCodeChange('M5555');
    component.joinRoom();
    expect(navigatedPath).toBe('/mahjong/lobby');
    expect(navParams).toEqual({ room: 'M5555' });
  });

  it('navigates directly to lobby when entering a game', () => {
    let target = '';
    router.navigate = ((commands: string[]) => {
      target = commands.at(0) ?? '';
      return Promise.resolve(true);
    }) as unknown as typeof router.navigate;

    component.enterGame('mahjong');
    expect(target).toBe('/mahjong/lobby');

    component.enterGame('monopoly');
    expect(target).toBe('/monopoly/lobby');

    component.enterGame('avalon');
    expect(target).toBe('/avalon/lobby');
  });

  it('opens contextual rulebook modal for target game', () => {
    component.openRulebook('monopoly');
    expect(shellUi.showRulebookModal()).toBe(true);
    expect(shellUi.rulebookGame()).toBe('monopoly');

    component.openRulebook('avalon');
    expect(shellUi.rulebookGame()).toBe('avalon');
  });

  it('redirects on deep-link room query parameters in URL', async () => {
    let redirectPath = '';
    let redirectParams: Record<string, unknown> | undefined;
    let replaced = false;

    const mockRouter = {
      navigate: (commands: string[], extras?: { queryParams?: Record<string, unknown>; replaceUrl?: boolean }) => {
        redirectPath = commands.at(0) ?? '';
        redirectParams = extras?.queryParams;
        replaced = extras?.replaceUrl ?? false;
        return Promise.resolve(true);
      },
    };

    const paramMap = new Map<string, string>([
      ['game', 'monopoly'],
      ['room', 'P4444'],
    ]);

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HubComponent],
      providers: [
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (k: string) => paramMap.get(k) ?? null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    const deepFixture = TestBed.createComponent(HubComponent);
    deepFixture.detectChanges();

    expect(redirectPath).toBe('/monopoly/lobby');
    expect(redirectParams).toEqual({ room: 'P4444' });
    expect(replaced).toBe(true);
  });
});
