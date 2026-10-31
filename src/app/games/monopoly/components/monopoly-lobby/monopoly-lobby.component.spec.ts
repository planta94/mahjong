import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../../../app.routes';
import { ShellUiService } from '../../../../core/services/shell-ui.service';
import { MonopolySessionService } from '../../services/monopoly-session.service';
import { MonopolyLobbyComponent } from './monopoly-lobby.component';

describe('MonopolyLobbyComponent', () => {
  let activeSession: MonopolySessionService | null = null;

  afterEach(() => {
    activeSession?.leaveRoom();
    activeSession = null;
    vi.restoreAllMocks();
  });

  async function setupLobby(initialQueryParams: Record<string, string> = {}): Promise<{
    fixture: ComponentFixture<MonopolyLobbyComponent>;
    comp: MonopolyLobbyComponent;
    session: MonopolySessionService;
    shellUi: ShellUiService;
    router: Router;
    queryParams$: BehaviorSubject<ParamMap>;
  }> {
    const queryParams$ = new BehaviorSubject<ParamMap>(convertToParamMap(initialQueryParams));

    await TestBed.configureTestingModule({
      imports: [MonopolyLobbyComponent],
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

    const session = TestBed.inject(MonopolySessionService);
    session.leaveRoom();
    activeSession = session;

    const shellUi = TestBed.inject(ShellUiService);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(MonopolyLobbyComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return { fixture, comp, session, shellUi, router, queryParams$ };
  }

  it('initializes default lobby state and renders pre-room configuration controls', async () => {
    const { fixture, comp, session, shellUi } = await setupLobby();

    expect(shellUi.activeGame()).toBe('monopoly');
    expect(comp.playerCount).toBe(4);
    expect(comp.winCondition).toBe('lastTycoon');
    expect(comp.maxRounds).toBe(30);
    expect(comp.auctionEnabled).toBe(true);
    expect(comp.joinCode).toBe('');
    expect(comp.hasUrlInvite()).toBe(false);
    expect(comp.lobbySettings).toEqual({
      winCondition: 'lastTycoon',
      maxRounds: 30,
      auctionEnabled: true,
      startingCash: 1500,
      freeParkingSeed: 100,
      goSalary: 200,
    });

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.lobby-card').length).toBe(1);
    expect(host.querySelector('#monopoly-players-select') !== null).toBe(true);
    expect(host.querySelector('#monopoly-win-mode-select') !== null).toBe(true);
    expect(host.querySelector('#monopoly-auction-select') !== null).toBe(true);
    expect(host.querySelector('#monopoly-rounds-select')).toBeNull();
    expect(host.querySelector('.invite-banner')).toBeNull();
    expect(host.querySelectorAll('.actions-row button').length).toBe(2);

    session.leaveRoom();
  });

  it('updates win mode between lastTycoon and roundLimit with round selector and auction rule', async () => {
    const { fixture, comp, session } = await setupLobby();
    const host = fixture.nativeElement as HTMLElement;

    const winModeSelect = host.querySelector('#monopoly-win-mode-select') as HTMLSelectElement;
    winModeSelect.selectedIndex = 1;
    winModeSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const roundsSelect = host.querySelector('#monopoly-rounds-select') as HTMLSelectElement | null;
    expect(roundsSelect !== null).toBe(true);
    expect(roundsSelect?.querySelectorAll('option').length).toBe(3);

    const playersSelect = host.querySelector('#monopoly-players-select') as HTMLSelectElement;
    playersSelect.selectedIndex = 3; // 5 players
    playersSelect.dispatchEvent(new Event('change'));

    roundsSelect!.selectedIndex = 2; // 40 rounds
    roundsSelect!.dispatchEvent(new Event('change'));

    const auctionSelect = host.querySelector('#monopoly-auction-select') as HTMLSelectElement;
    auctionSelect.selectedIndex = 1; // false
    auctionSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(comp.lobbySettings).toEqual({
      winCondition: 'roundLimit',
      maxRounds: 40,
      auctionEnabled: false,
      startingCash: 1500,
      freeParkingSeed: 100,
      goSalary: 200,
    });

    winModeSelect.selectedIndex = 0;
    winModeSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(host.querySelector('#monopoly-rounds-select')).toBeNull();

    session.leaveRoom();
  });

  it('displays ?room=P... invite banner and joins the room as a guest when taking a seat', async () => {
    const { fixture, comp, session, queryParams$ } = await setupLobby({ room: 'p8k4z9' });
    const host = fixture.nativeElement as HTMLElement;

    expect(comp.hasUrlInvite()).toBe(true);
    expect(comp.joinCode).toBe('P8K4Z9');

    const banner = host.querySelector('.invite-banner');
    expect(banner?.textContent).toContain('P8K4Z9');

    const takeSeatBtn = host.querySelector('.invite-banner button') as HTMLButtonElement;
    takeSeatBtn.click();
    fixture.detectChanges();

    expect(session.snapshot()?.role).toBe('guest');
    expect(session.snapshot()?.roomCode).toBe('P8K4Z9');

    // Emitting a new query param while already in a room does not overwrite the active room code
    queryParams$.next(convertToParamMap({ room: 'pother' }));
    expect(comp.joinCode).toBe('P8K4Z9');

    session.leaveRoom();
  });

  it('launches a quick solo match with custom player count and rules', async () => {
    const { fixture, comp, session, router } = await setupLobby();
    const host = fixture.nativeElement as HTMLElement;

    comp.playerCount = 3;
    comp.winCondition = 'roundLimit';
    comp.maxRounds = 20;
    comp.auctionEnabled = false;
    fixture.detectChanges();

    const soloBtn = host.querySelectorAll('.actions-row button').item(0) as HTMLButtonElement;
    soloBtn.click();
    fixture.detectChanges();

    const snap = session.snapshot();
    expect(snap?.lobby?.started).toBe(true);
    expect(snap?.view?.players.length).toBe(3);
    expect(snap?.view?.winCondition).toBe('roundLimit');
    expect(snap?.view?.maxRounds).toBe(20);
    expect(snap?.view?.auctionEnabled).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/monopoly/board']);

    session.leaveRoom();
  });

  it('creates a multiplayer room, copies invite link, toggles open/bot seats, and starts match', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    const clipboardDesc = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true,
    });

    try {
      const { fixture, comp, session, shellUi, router } = await setupLobby();
      const host = fixture.nativeElement as HTMLElement;

      comp.playerCount = 4;
      const createBtn = host.querySelectorAll('.actions-row button').item(1) as HTMLButtonElement;
      createBtn.click();
      fixture.detectChanges();

      const roomCode = session.snapshot()?.roomCode ?? '';
      expect(roomCode).toMatch(/^P[A-Z0-9]{5}$/);
      expect(shellUi.activeRoomCode()).toBe(roomCode);
      expect(host.querySelector('.room-code-tag')?.textContent?.trim()).toBe(roomCode);

      // Copy invite link via ShellUiService bound to the active room created by the lobby
      shellUi.copyInviteLink();
      expect(shellUi.copiedToast()).toBe(true);
      expect(writeTextSpy).toHaveBeenCalledTimes(1);
      expect(String(writeTextSpy.mock.calls.at(0)?.at(0))).toContain(`?game=monopoly&room=${roomCode}`);

      // Verify 4 seat rows render and seat 0 has no toggle button while seats 1..3 have toggle buttons
      const seatRows = host.querySelectorAll('.seats-list .seat-row');
      expect(seatRows.length).toBe(4);
      expect(seatRows.item(0).querySelector('button')).toBeNull();

      const seat1ToggleBtn = seatRows.item(1).querySelector('button') as HTMLButtonElement;
      expect(session.currentLobby()?.seats.at(1)?.kind).toBe('open');

      // Toggle seat 1: open -> bot -> open -> bot
      seat1ToggleBtn.click();
      fixture.detectChanges();
      expect(session.currentLobby()?.seats.at(1)?.kind).toBe('bot');

      const seat1ToggleAgainBtn = host
        .querySelectorAll('.seats-list .seat-row')
        .item(1)
        .querySelector('button') as HTMLButtonElement;
      seat1ToggleAgainBtn.click();
      fixture.detectChanges();
      expect(session.currentLobby()?.seats.at(1)?.kind).toBe('open');

      comp.toggleSeat(1);
      fixture.detectChanges();
      expect(session.currentLobby()?.seats.at(1)?.kind).toBe('bot');

      // Start match from waiting room
      const startBtn = host.querySelector('.waiting-actions .btn-emerald') as HTMLButtonElement;
      startBtn.click();
      fixture.detectChanges();

      expect(session.snapshot()?.lobby?.started).toBe(true);
      expect(session.currentLobby()?.seats.every((s) => s.kind !== 'open')).toBe(true);
      expect(router.navigate).toHaveBeenCalledWith(['/monopoly/board']);

      session.leaveRoom();
    } finally {
      if (clipboardDesc) {
        Object.defineProperty(navigator, 'clipboard', clipboardDesc);
      } else {
        Reflect.deleteProperty(navigator, 'clipboard');
      }
    }
  });

  it('joins a room by entered code, renders guest waiting state, and resets state on leaveRoom', async () => {
    const { fixture, comp, session } = await setupLobby();
    const host = fixture.nativeElement as HTMLElement;

    // Whitespace-only code should not start a guest session
    comp.joinCode = '   ';
    comp.joinRoom();
    expect(session.snapshot()).toBeNull();

    // Valid code joins as guest
    comp.joinCode = '  P5M7Q2  ';
    const joinBtn = host.querySelector('.join-section button') as HTMLButtonElement;
    joinBtn.click();
    fixture.detectChanges();

    expect(session.snapshot()?.role).toBe('guest');
    expect(session.snapshot()?.roomCode).toBe('P5M7Q2');
    expect(host.querySelector('.waiting-actions .btn-emerald')).toBeNull();
    expect(host.querySelector('.guest-wait-hint') !== null).toBe(true);

    // Leave room via waiting-room action button
    const leaveBtn = host.querySelector('.waiting-actions .btn-outline') as HTMLButtonElement;
    leaveBtn.click();
    fixture.detectChanges();

    expect(session.snapshot()).toBeNull();
    expect(comp.hasUrlInvite()).toBe(false);
    expect(comp.joinCode).toBe('');
    expect(host.querySelectorAll('.lobby-card').length).toBe(1);

    session.leaveRoom();
  });

  it('unsubscribes from route queryParamMap when destroyed', async () => {
    const { fixture, comp, session, queryParams$ } = await setupLobby();

    expect(queryParams$.observed).toBe(true);
    fixture.destroy();
    expect(queryParams$.observed).toBe(false);

    queryParams$.next(convertToParamMap({ room: 'p99999' }));
    expect(comp.hasUrlInvite()).toBe(false);
    expect(comp.joinCode).toBe('');

    session.leaveRoom();
  });
});
