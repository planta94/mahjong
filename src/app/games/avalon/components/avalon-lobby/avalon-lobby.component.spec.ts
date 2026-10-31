import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { routes } from '../../../../app.routes';
import { ShellUiService } from '../../../../core/services/shell-ui.service';
import { TranslateService } from '../../../../core/services/translate.service';
import { AvalonLobbySettings, AvalonSeat, DEFAULT_AVALON_SETTINGS } from '../../models/avalon.model';
import { AvalonSessionService, AvalonSnapshot } from '../../services/avalon-session.service';
import { AvalonLobbyComponent } from './avalon-lobby.component';

describe('AvalonLobbyComponent', () => {
  let queryParams$: BehaviorSubject<ParamMap>;
  let session: AvalonSessionService;
  let shellUi: ShellUiService;
  let translate: TranslateService;

  async function setupLobby(initialParams: Record<string, string> = {}): Promise<{
    fixture: ComponentFixture<AvalonLobbyComponent>;
    comp: AvalonLobbyComponent;
    host: HTMLElement;
  }> {
    queryParams$ = new BehaviorSubject<ParamMap>(convertToParamMap(initialParams));

    await TestBed.configureTestingModule({
      imports: [AvalonLobbyComponent],
      providers: [
        provideRouter(routes),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParams$.asObservable(),
          },
        },
      ],
    }).compileComponents();

    session = TestBed.inject(AvalonSessionService);
    shellUi = TestBed.inject(ShellUiService);
    translate = TestBed.inject(TranslateService);
    translate.use('en');

    const fixture = TestBed.createComponent(AvalonLobbyComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return { fixture, comp, host };
  }

  afterEach(() => {
    session?.leaveRoom();
    localStorage.removeItem('hkmj_lang');
  });

  it('renders pre-room configuration card, 5-player 3v2 ratio, role checkboxes, and action buttons', async () => {
    const { comp, host } = await setupLobby();

    expect(shellUi.activeGame()).toBe('avalon');
    expect(comp.playerCount).toBe(5);
    expect(comp.goodCount).toBe(3);
    expect(comp.evilCount).toBe(2);
    expect(comp.hasUrlInvite()).toBe(false);

    expect(host.querySelector('.lobby-title')?.textContent?.trim()).toBe('Avalon Lobby');
    expect(host.querySelector('.lobby-subtitle')?.textContent?.trim()).toContain(
      'Arthurian Social Deduction'
    );
    expect(host.querySelector('.ratio-badge')?.textContent?.trim()).toBe('3 Good vs 2 Evil');
    expect(host.querySelector('.invite-banner')).toBe(null);

    const options = host.querySelectorAll('#avalon-players-select option');
    expect(options.length).toBe(6);

    const roleCheckboxes = host.querySelectorAll('.role-checkbox input[type="checkbox"]');
    expect(roleCheckboxes.length).toBe(5);

    const actionButtons = host.querySelectorAll('.actions-row button');
    expect(actionButtons.length).toBe(2);
    expect(actionButtons.item(0)?.textContent).toContain('Start Solo');
    expect(actionButtons.item(1)?.textContent).toContain('Create Room');
  });

  it('computes Good vs Evil loyalty ratios for all player counts 5 through 10 and unmapped fallback', async () => {
    const { fixture, comp, host } = await setupLobby();

    const expectedRatios: ReadonlyArray<readonly [number, number, number]> = [
      [5, 3, 2],
      [6, 4, 2],
      [7, 4, 3],
      [8, 5, 3],
      [9, 6, 3],
      [10, 6, 4],
    ];

    const playerSelect = host.querySelector('#avalon-players-select') as HTMLSelectElement;
    for (let idx = 0; idx < expectedRatios.length; idx++) {
      const [count, expectedGood, expectedEvil] = expectedRatios.at(idx)!;
      playerSelect.selectedIndex = idx;
      playerSelect.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(comp.playerCount).toBe(count);
      expect(comp.goodCount).toBe(expectedGood);
      expect(comp.evilCount).toBe(expectedEvil);
      expect(host.querySelector('.ratio-badge')?.textContent?.trim()).toBe(
        `${expectedGood} Good vs ${expectedEvil} Evil`
      );
    }

    // Fallback branch when playerCount is outside configured map
    comp.playerCount = 99;
    expect(comp.goodCount).toBe(3);
    expect(comp.evilCount).toBe(2);
  });

  it('toggles percival, morgana, mordred, oberon, and ladyOfLake checkboxes and syncs to host lobby', async () => {
    const { fixture, comp, host } = await setupLobby();

    expect(comp.lobbySettings).toEqual({
      numPlayers: 5,
      roleConfig: {
        percival: true,
        morgana: true,
        mordred: false,
        oberon: false,
      },
      enableLadyOfLake: false,
    });

    const checkboxes = host.querySelectorAll<HTMLInputElement>(
      '.role-checkbox input[type="checkbox"]'
    );
    expect(checkboxes.length).toBe(5);

    // Click all 5 checkboxes in pre-room configuration
    for (let i = 0; i < checkboxes.length; i++) {
      checkboxes.item(i).click();
    }
    fixture.detectChanges();

    expect(comp.lobbySettings).toEqual({
      numPlayers: 5,
      roleConfig: {
        percival: false,
        morgana: false,
        mordred: true,
        oberon: true,
      },
      enableLadyOfLake: true,
    });

    // Create multiplayer room and verify live host updates when count/roles change
    comp.createRoom();
    fixture.detectChanges();

    comp.onPlayerCountChange(8);
    expect(session.currentLobby()?.seats.length).toBe(8);

    comp.percival = true;
    comp.enableLadyOfLake = false;
    comp.onRoleToggle();

    const syncedRules = session.currentLobby()?.rules as AvalonLobbySettings | undefined;
    expect(syncedRules?.numPlayers).toBe(8);
    expect(syncedRules?.roleConfig.percival).toBe(true);
    expect(syncedRules?.roleConfig.mordred).toBe(true);
    expect(syncedRules?.roleConfig.oberon).toBe(true);
    expect(syncedRules?.enableLadyOfLake).toBe(false);
  });

  it('populates uppercase joinCode from ?room=A... invite param and joins from invite banner', async () => {
    const { fixture, comp, host } = await setupLobby({ room: 'a7x9k' });

    expect(comp.joinCode).toBe('A7X9K');
    expect(comp.hasUrlInvite()).toBe(true);

    const banner = host.querySelector('.invite-banner');
    expect(banner?.textContent).toContain('A7X9K');

    const inviteJoinBtn = host.querySelector<HTMLButtonElement>('.invite-banner button');
    inviteJoinBtn?.click();
    fixture.detectChanges();

    expect(session.snapshot()?.role).toBe('guest');
    expect(session.snapshot()?.roomCode).toBe('A7X9K');

    // Emit another room param while snapshot is active — should not overwrite active session
    queryParams$.next(convertToParamMap({ room: 'abbbb' }));
    expect(comp.joinCode).toBe('A7X9K');
  });

  it('unsubscribes from route queryParamMap on ngOnDestroy via DestroyRef', async () => {
    const { fixture, comp } = await setupLobby();

    expect(comp.hasUrlInvite()).toBe(false);
    fixture.destroy();

    queryParams$.next(convertToParamMap({ room: 'a9999' }));
    expect(comp.joinCode).toBe('');
    expect(comp.hasUrlInvite()).toBe(false);
  });

  it('starts solo match with selected player count and special role configuration via DOM button', async () => {
    const { fixture, comp, host } = await setupLobby();

    comp.onPlayerCountChange(7);
    comp.mordred = true;
    comp.enableLadyOfLake = true;
    fixture.detectChanges();

    const soloBtn = host.querySelector<HTMLButtonElement>('.actions-row .btn-crimson');
    soloBtn?.click();
    fixture.detectChanges();

    expect(session.snapshot()?.online).toBe(false);
    expect(session.currentLobby()?.started).toBe(true);
    expect(session.currentView()?.numPlayers).toBe(7);
    expect(session.currentView()?.rules.roleConfig.mordred).toBe(true);
    expect(session.currentView()?.rules.enableLadyOfLake).toBe(true);
  });

  it('creates multiplayer room, toggles seats between Open and Bot, copies invite link, and starts match', async () => {
    const { fixture, host } = await setupLobby();
    const copySpy = vi.spyOn(shellUi, 'copyInviteLink');

    const createBtn = host.querySelector<HTMLButtonElement>('.actions-row .btn-gold');
    createBtn?.click();
    fixture.detectChanges();

    const roomCode = session.snapshot()?.roomCode ?? '';
    expect(roomCode.startsWith('A')).toBe(true);
    expect(host.querySelector('.room-code-heading')?.textContent).toContain(roomCode);

    const seatCards = host.querySelectorAll('.seat-card');
    expect(seatCards.length).toBe(5);
    expect(seatCards.item(0)?.classList.contains('is-my-seat')).toBe(true);
    expect(seatCards.item(0)?.querySelector('.host-pill')?.textContent?.trim().length).toBeGreaterThan(0);
    expect(seatCards.item(0)?.querySelector('.you-pill')?.textContent?.trim().length).toBeGreaterThan(0);

    // Toggle seat #2 from Open to Bot and back via button click
    const seat1ToggleBtn = seatCards.item(1)?.querySelector<HTMLButtonElement>('.seat-right button');
    expect(seat1ToggleBtn?.textContent?.trim()).toBe('👤 Open');

    seat1ToggleBtn?.click();
    fixture.detectChanges();
    expect(session.currentLobby()?.seats.at(1)?.kind).toBe('bot');
    expect(
      host.querySelectorAll('.seat-card').item(1)?.querySelector('.seat-right button')?.textContent?.trim()
    ).toBe('🤖 Bot');

    host.querySelectorAll('.seat-card').item(1)?.querySelector<HTMLButtonElement>('.seat-right button')?.click();
    fixture.detectChanges();
    expect(session.currentLobby()?.seats.at(1)?.kind).toBe('open');

    // Copy invite link button
    const copyBtn = host.querySelector<HTMLButtonElement>('.room-header button');
    copyBtn?.click();
    expect(copySpy).toHaveBeenCalledTimes(1);

    // Start match from lobby footer
    const startMatchBtn = host.querySelector<HTMLButtonElement>('.lobby-footer-actions .btn-crimson');
    startMatchBtn?.click();
    fixture.detectChanges();
    expect(session.currentLobby()?.started).toBe(true);
  });

  it('ignores blank join codes, renders guest seat badges without host controls, and leaves room cleanly', async () => {
    const { fixture, comp, host } = await setupLobby();

    comp.joinCode = '   ';
    const joinBtn = host.querySelector<HTMLButtonElement>('.join-input-group button');
    joinBtn?.click();
    expect(session.snapshot()).toBe(null);

    comp.joinCode = '  A2468  ';
    joinBtn?.click();
    fixture.detectChanges();

    expect(session.snapshot()?.role).toBe('guest');
    expect(session.snapshot()?.roomCode).toBe('A2468');

    // Simulate synced guest lobby snapshot with human, bot, and open disconnected seats
    const guestSeats: AvalonSeat[] = [
      { seat: 0, kind: 'human', name: 'Arthur', connected: true },
      { seat: 1, kind: 'human', name: 'Lancelot', connected: true },
      { seat: 2, kind: 'bot', name: 'Gawain (Bot)', connected: true },
      { seat: 3, kind: 'open', name: 'Waiting...', connected: false },
      { seat: 4, kind: 'open', name: 'Waiting...', connected: false },
    ];
    const guestSnap: AvalonSnapshot = {
      role: 'guest',
      online: true,
      roomCode: 'A2468',
      status: 'Connected',
      error: null,
      mySeat: 1,
      lobby: {
        started: false,
        seats: guestSeats,
        rules: DEFAULT_AVALON_SETTINGS,
      },
      view: null,
    };
    session.snapshot.set(guestSnap);
    fixture.detectChanges();

    // Guest should not see host seat toggle buttons or Start Match button
    expect(host.querySelectorAll('.seat-right button').length).toBe(0);
    expect(host.querySelectorAll('.lobby-footer-actions button').length).toBe(1);

    const cards = host.querySelectorAll('.seat-card');
    expect(cards.item(1)?.classList.contains('is-my-seat')).toBe(true);
    expect(cards.item(0)?.querySelector('.seat-status-tag')?.textContent?.trim()).toBe('🟢');
    expect(cards.item(2)?.querySelector('.seat-status-tag')?.textContent?.trim()).toBe('🤖 Bot');
    expect(cards.item(3)?.querySelector('.seat-status-tag')?.textContent?.trim()).toBe('⚪');

    // Click Leave Table
    const leaveBtn = host.querySelector<HTMLButtonElement>('.lobby-footer-actions button');
    leaveBtn?.click();
    fixture.detectChanges();

    expect(session.snapshot()).toBe(null);
    expect(host.querySelector('.lobby-title')?.textContent?.trim()).toBe('Avalon Lobby');
  });
});
