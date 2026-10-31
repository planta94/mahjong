import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app.routes';
import { SessionSnapshot } from '../../core/models/mahjong.model';
import { MahjongSessionService } from '../../core/services/mahjong-session.service';
import { DEFAULT_RULES } from '../../core/services/scorer.service';
import { ShellUiService } from '../../core/services/shell-ui.service';
import { TranslateService } from '../../core/services/translate.service';
import { LobbyComponent } from './lobby.component';

describe('LobbyComponent', () => {
  let queryParamSubject: BehaviorSubject<ParamMap>;
  let session: MahjongSessionService;
  let shellUi: ShellUiService;
  let translate: TranslateService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/lobby');
    queryParamSubject = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [LobbyComponent],
      providers: [
        provideRouter(routes),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParamSubject.asObservable(),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    }).compileComponents();

    session = TestBed.inject(MahjongSessionService);
    shellUi = TestBed.inject(ShellUiService);
    translate = TestBed.inject(TranslateService);
    translate.use('zh');
  });

  afterEach(() => {
    session.leaveSession();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('activates mahjong shell context on init and switches between 3P and 4P modes via click and keyboard', () => {
    const fixture = TestBed.createComponent(LobbyComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const hostEl = fixture.nativeElement as HTMLElement;

    expect(shellUi.activeGame()).toBe('mahjong');
    expect(comp.selectedMode()).toBe('3p');

    const modeCards = hostEl.querySelectorAll('.mode-card');
    expect(modeCards.length).toBe(2);
    expect(modeCards.item(0).classList.contains('active')).toBe(true);
    expect(modeCards.item(1).classList.contains('active')).toBe(false);

    (modeCards.item(1) as HTMLElement).click();
    fixture.detectChanges();
    expect(comp.selectedMode()).toBe('4p');
    expect(modeCards.item(1).classList.contains('active')).toBe(true);
    expect(modeCards.item(0).classList.contains('active')).toBe(false);

    modeCards.item(0).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(comp.selectedMode()).toBe('3p');
    expect(modeCards.item(0).classList.contains('active')).toBe(true);

    modeCards.item(1).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(comp.selectedMode()).toBe('4p');
    expect(modeCards.item(1).classList.contains('active')).toBe(true);

    (modeCards.item(0) as HTMLElement).click();
    fixture.detectChanges();
    expect(comp.selectedMode()).toBe('3p');
    expect(modeCards.item(0).classList.contains('active')).toBe(true);
  });

  it('updates home fan selects and rule checkboxes via DOM events and clamps homeMaxFan upward', async () => {
    const fixture = TestBed.createComponent(LobbyComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    const hostEl = fixture.nativeElement as HTMLElement;

    expect(comp.homeMinFan).toBe(DEFAULT_RULES.minFan);
    expect(comp.homeMaxFan).toBe(DEFAULT_RULES.maxFan);

    const minSelect = hostEl.querySelector('select[aria-label="Minimum Fan"]') as HTMLSelectElement;
    const maxSelect = hostEl.querySelector('select[aria-label="Maximum Fan"]') as HTMLSelectElement;
    expect(minSelect.options.length).toBe(4);
    expect(maxSelect.options.length).toBe(3);

    // Lower maxFan to 8 via DOM select, then set minFan to 7 and 8 via DOM select
    maxSelect.selectedIndex = 0; // 8
    maxSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(comp.homeMaxFan).toBe(8);

    minSelect.selectedIndex = 2; // 7
    minSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(comp.homeMinFan).toBe(7);
    expect(comp.homeMaxFan).toBe(8);

    // Also verify upward clamping when homeMaxFan starts below new homeMinFan
    comp.homeMaxFan = 5;
    minSelect.selectedIndex = 3; // 8
    minSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(comp.homeMinFan).toBe(8);
    expect(comp.homeMaxFan).toBe(8);

    // Raise maxFan to 13 via DOM select
    maxSelect.selectedIndex = 2; // 13
    maxSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(comp.homeMaxFan).toBe(13);

    // Toggle all three home rules-grid checkboxes via DOM click
    const homeCheckboxes = hostEl.querySelectorAll('.rules-grid input[type="checkbox"]');
    expect(homeCheckboxes.length).toBe(3);

    (homeCheckboxes.item(0) as HTMLInputElement).click();
    (homeCheckboxes.item(1) as HTMLInputElement).click();
    (homeCheckboxes.item(2) as HTMLInputElement).click();
    fixture.detectChanges();

    expect(comp.homeConcealed).toBe(false);
    expect(comp.homeSevenPairs).toBe(false);
    expect(comp.homeShowHints).toBe(false);
  });

  it('persists trimmed nickname on blur and change events and falls back to default when blank', async () => {
    shellUi.setPlayerNickname('Initial雀神');
    const fixture = TestBed.createComponent(LobbyComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    const hostEl = fixture.nativeElement as HTMLElement;
    expect(comp.nickname).toBe('Initial雀神');

    const inputEl = hostEl.querySelector('#nickname-input') as HTMLInputElement;
    inputEl.value = '  十三幺大师  ';
    inputEl.dispatchEvent(new Event('input'));
    inputEl.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(comp.nickname).toBe('十三幺大师');
    expect(shellUi.playerNickname()).toBe('十三幺大师');
    expect(localStorage.getItem('party_pavilion_nickname')).toBe('十三幺大师');

    inputEl.value = '  清一色王  ';
    inputEl.dispatchEvent(new Event('input'));
    inputEl.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(comp.nickname).toBe('清一色王');
    expect(shellUi.playerNickname()).toBe('清一色王');

    comp.nickname = '    ';
    const fallback = comp.persistNickname();
    expect(fallback).toBe('雀友');
    expect(comp.nickname).toBe('雀友');
    expect(shellUi.playerNickname()).toBe('雀友');
  });

  it('launches 3P and 4P solo games with configured rules via startSolo button', async () => {
    const fixture = TestBed.createComponent(LobbyComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const hostEl = fixture.nativeElement as HTMLElement;

    comp.nickname = 'SoloHero';
    comp.selectMode('3p');
    comp.onHomeMinFanChange(7);
    comp.homeMaxFan = 10;
    comp.homeConcealed = false;
    comp.homeSevenPairs = true;
    comp.homeShowHints = false;
    fixture.detectChanges();

    const startSoloBtn = hostEl.querySelector('.cta-row .btn-gold') as HTMLButtonElement;
    startSoloBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const snap3p = session.snapshot();
    expect(snap3p?.role).toBe('host');
    expect(snap3p?.online).toBe(false);
    expect(snap3p?.view?.mode).toBe('3p');
    expect(snap3p?.view?.numSeats).toBe(3);
    expect(snap3p?.view?.rules.minFan).toBe(7);
    expect(snap3p?.view?.rules.concealedFan).toBe(false);
    expect(session.hintsEnabled()).toBe(false);

    session.leaveSession();
    fixture.detectChanges();
    expect(session.snapshot()).toBeNull();

    comp.selectMode('4p');
    comp.homeShowHints = true;
    comp.startSolo();
    expect(session.snapshot()?.view?.mode).toBe('4p');
    expect(session.snapshot()?.view?.numSeats).toBe(4);
    expect(session.hintsEnabled()).toBe(true);
  });

  it('auto-fills invite room code from query params, toggles invite hints checkbox, joins room, and clears on leave', async () => {
    const joinSpy = vi.spyOn(session, 'joinOnlineRoom');
    const fixture = TestBed.createComponent(LobbyComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    const hostEl = fixture.nativeElement as HTMLElement;

    expect(comp.hasUrlInvite()).toBe(false);
    expect(hostEl.querySelectorAll('.invite-banner').length).toBe(0);

    queryParamSubject.next(convertToParamMap({ room: 'hk8x4' }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.joinCode).toBe('HK8X4');
    expect(comp.hasUrlInvite()).toBe(true);
    expect(hostEl.querySelectorAll('.invite-banner').length).toBe(1);
    expect(hostEl.querySelector('.invite-banner h3')?.textContent).toContain('HK8X4');

    comp.nickname = 'InvitedGuest';
    const inviteHintsCheckbox = hostEl.querySelector(
      '.invite-banner input[type="checkbox"]'
    ) as HTMLInputElement;
    inviteHintsCheckbox.click();
    fixture.detectChanges();
    expect(comp.homeShowHints).toBe(false);

    const inviteJoinBtn = hostEl.querySelector('.invite-banner .btn-gold') as HTMLButtonElement;
    inviteJoinBtn.click();
    fixture.detectChanges();

    expect(joinSpy).toHaveBeenCalledWith('HK8X4', 'InvitedGuest', false);
    expect(session.snapshot()?.role).toBe('guest');
    expect(session.snapshot()?.roomCode).toBe('HK8X4');

    // While session snapshot is active, new queryParamMap emissions are ignored
    queryParamSubject.next(convertToParamMap({ room: 'other9' }));
    expect(comp.joinCode).toBe('HK8X4');

    // Leaving session dispatches mahjong:leave and clears invite state
    session.leaveSession();
    fixture.detectChanges();
    expect(comp.hasUrlInvite()).toBe(false);
    expect(comp.joinCode).toBe('');
    expect(hostEl.querySelectorAll('.invite-banner').length).toBe(0);
  });

  it('joins room from manual join input via DOM input, hints checkbox, Enter key, and button click', async () => {
    const joinSpy = vi.spyOn(session, 'joinOnlineRoom');
    const fixture = TestBed.createComponent(LobbyComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    const hostEl = fixture.nativeElement as HTMLElement;

    comp.nickname = 'ManualJoiner';
    const joinInput = hostEl.querySelector('.uppercase-input') as HTMLInputElement;
    joinInput.value = 'https://example.com/lobby?room=xy99z';
    joinInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(comp.joinCode).toBe('https://example.com/lobby?room=xy99z');

    joinInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(comp.joinCode).toBe('XY99Z');
    expect(joinSpy).toHaveBeenCalledWith('XY99Z', 'ManualJoiner', true);

    // Leave back to home view and join again via manual join hints toggle + button click
    session.leaveSession();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const refreshedJoinInput = hostEl.querySelector('.uppercase-input') as HTMLInputElement;
    refreshedJoinInput.value = 'ab12c';
    refreshedJoinInput.dispatchEvent(new Event('input'));

    const joinRowCheckbox = hostEl.querySelector(
      '.join-row input[type="checkbox"]'
    ) as HTMLInputElement;
    joinRowCheckbox.click();
    fixture.detectChanges();
    expect(comp.homeShowHints).toBe(false);

    const joinRowBtn = hostEl.querySelector('.join-row .btn-gold') as HTMLButtonElement;
    joinRowBtn.click();
    fixture.detectChanges();

    expect(comp.joinCode).toBe('AB12C');
    expect(joinSpy).toHaveBeenLastCalledWith('AB12C', 'ManualJoiner', false);
  });

  it('creates online waiting room, toggles seats, updates lobby fan selects and checkboxes, copies room link, and starts match', async () => {
    let copiedUrl = '';
    const clipboardDesc = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: {
        writeText: (val: string) => {
          copiedUrl = val;
          return Promise.resolve();
        },
      },
    });

    try {
      const fixture = TestBed.createComponent(LobbyComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const comp = fixture.componentInstance;
      const hostEl = fixture.nativeElement as HTMLElement;

      comp.nickname = 'RoomHost';
      comp.selectMode('3p');
      const createBtn = hostEl.querySelector('.cta-row .btn-emerald') as HTMLButtonElement;
      createBtn.click();
      await fixture.whenStable();
      fixture.detectChanges();

      const initialSnap = session.snapshot();
      expect(initialSnap?.online).toBe(true);
      expect(initialSnap?.role).toBe('host');
      expect(initialSnap?.lobby?.seats.length).toBe(3);
      expect(hostEl.querySelectorAll('.seat-slot').length).toBe(3);
      expect(hostEl.querySelector('.you-tag')?.textContent).toContain('你');

      // Switch lobby mode 3p -> 4p -> 3p via waiting room header buttons
      const switchBtns = hostEl.querySelectorAll('.mode-switch-btns button');
      expect(switchBtns.length).toBe(2);
      (switchBtns.item(1) as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(session.snapshot()?.lobby?.seats.length).toBe(4);
      expect(hostEl.querySelectorAll('.seat-slot').length).toBe(4);

      (switchBtns.item(0) as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(session.snapshot()?.lobby?.seats.length).toBe(3);

      // Update waiting-room Lobby Minimum Fan and Lobby Maximum Fan via DOM select elements
      await fixture.whenStable();
      fixture.detectChanges();
      const lobbyMinSelect = hostEl.querySelector(
        'select[aria-label="Lobby Minimum Fan"]'
      ) as HTMLSelectElement;
      const lobbyMaxSelect = hostEl.querySelector(
        'select[aria-label="Lobby Maximum Fan"]'
      ) as HTMLSelectElement;

      lobbyMinSelect.selectedIndex = 2; // 7 Fan
      lobbyMinSelect.dispatchEvent(new Event('change'));
      lobbyMaxSelect.selectedIndex = 2; // 13 Fan
      lobbyMaxSelect.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(session.snapshot()?.lobby?.rules.minFan).toBe(7);
      expect(session.snapshot()?.lobby?.rules.maxFan).toBe(13);

      // Copy room invite link
      await session.copyInviteLink();
      expect(copiedUrl).toContain(`?room=${session.snapshot()?.roomCode ?? ''}`);
      expect(session.copiedToast()).toBe(true);

      // Attempting startMatch with open seats renders error alert banner
      const startMatchBtn = hostEl.querySelector('.cta-row .btn-gold') as HTMLButtonElement;
      startMatchBtn.click();
      fixture.detectChanges();
      expect(session.snapshot()?.view).toBeNull();
      expect(hostEl.querySelectorAll('.banner-alert').length).toBe(1);

      // Toggle seats 1 & 2 from open -> bot, verify toggle back to open and back to bot
      const toggleBtnsFirst = hostEl.querySelectorAll('.seat-toggle-btn');
      expect(toggleBtnsFirst.length).toBe(2);
      (toggleBtnsFirst.item(0) as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(session.snapshot()?.lobby?.seats.at(1)?.kind).toBe('bot');

      (hostEl.querySelectorAll('.seat-toggle-btn').item(0) as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(session.snapshot()?.lobby?.seats.at(1)?.kind).toBe('open');

      (hostEl.querySelectorAll('.seat-toggle-btn').item(0) as HTMLButtonElement).click();
      (hostEl.querySelectorAll('.seat-toggle-btn').item(1) as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(session.snapshot()?.lobby?.seats.at(1)?.kind).toBe('bot');
      expect(session.snapshot()?.lobby?.seats.at(2)?.kind).toBe('bot');

      // Toggle waiting-room rules checkboxes (concealedFan, sevenPairs, showHints)
      const checkboxes = hostEl.querySelectorAll('.rules-grid input[type="checkbox"]');
      expect(checkboxes.length).toBe(3);

      (checkboxes.item(0) as HTMLInputElement).click();
      (checkboxes.item(1) as HTMLInputElement).click();
      (checkboxes.item(2) as HTMLInputElement).click();
      fixture.detectChanges();

      expect(session.snapshot()?.lobby?.rules.concealedFan).toBe(false);
      expect(session.snapshot()?.lobby?.rules.sevenPairs).toBe(false);
      expect(session.snapshot()?.lobby?.rules.showHints).toBe(false);
      expect(session.hintsEnabled()).toBe(false);

      // Defensive null-target change events do not mutate rules
      comp.onLobbyConcealedChange(new Event('change'));
      comp.onLobbySevenPairsChange(new Event('change'));
      comp.onLobbyHintsChange(new Event('change'));
      expect(session.snapshot()?.lobby?.rules.concealedFan).toBe(false);
      expect(session.snapshot()?.lobby?.rules.sevenPairs).toBe(false);
      expect(session.hintsEnabled()).toBe(false);

      // Start match once all seats are filled
      (hostEl.querySelector('.cta-row .btn-gold') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(session.snapshot()?.lobby?.started).toBe(true);
      expect(session.snapshot()?.view?.phase).toBe('turn');
    } finally {
      if (clipboardDesc) {
        Object.defineProperty(navigator, 'clipboard', clipboardDesc);
      } else {
        Reflect.deleteProperty(navigator, 'clipboard');
      }
    }
  });

  it('renders guest waiting view, host-disabled hints state, and connecting error state accurately', () => {
    const fixture = TestBed.createComponent(LobbyComponent);
    const hostEl = fixture.nativeElement as HTMLElement;

    // 1. Connecting state with no lobby yet + error banner (and no-error branch)
    const connectingNoErrorSnap: SessionSnapshot = {
      role: 'guest',
      online: true,
      roomCode: 'RM777',
      status: '正在连接至房间 RM777…',
      error: null,
      mySeat: -1,
      lobby: null,
      view: null,
    };
    session.snapshot.set(connectingNoErrorSnap);
    fixture.detectChanges();
    expect(hostEl.querySelector('.section-heading')?.textContent).toBe('正在连接至房间 RM777…');
    expect(hostEl.querySelectorAll('.banner-alert').length).toBe(0);

    session.snapshot.set({ ...connectingNoErrorSnap, error: '连接超时' });
    fixture.detectChanges();
    expect(hostEl.querySelector('.banner-alert')?.textContent).toBe('连接超时');

    // 2. Seated guest waiting room view (read-only host rules, local hints toggle, offline indicator)
    const guestWaitingSnap: SessionSnapshot = {
      role: 'guest',
      online: true,
      roomCode: 'RM777',
      status: '已连接至房间 RM777',
      error: null,
      mySeat: 1,
      lobby: {
        mode: '3p',
        rules: { ...DEFAULT_RULES, minFan: 5, maxFan: 10, showHints: true },
        started: false,
        seats: [
          { seat: 0, kind: 'human', name: 'HostA', token: null, connected: true, windLabel: '東' },
          { seat: 1, kind: 'human', name: 'GuestB', token: null, connected: true, windLabel: '南' },
          { seat: 2, kind: 'human', name: 'GuestC', token: null, connected: false, windLabel: '西' },
        ],
      },
      view: null,
    };
    session.snapshot.set(guestWaitingSnap);
    fixture.detectChanges();

    expect(hostEl.querySelectorAll('.mode-switch-btns').length).toBe(0);
    expect(hostEl.querySelectorAll('.seat-toggle-btn').length).toBe(0);
    expect(hostEl.querySelector('.wait-host-label')?.textContent).toContain('等待房主');
    expect(hostEl.textContent).toContain('离线');

    const guestCheckboxes = hostEl.querySelectorAll('.rules-grid input[type="checkbox"]');
    expect((guestCheckboxes.item(0) as HTMLInputElement).disabled).toBe(true);
    expect((guestCheckboxes.item(1) as HTMLInputElement).disabled).toBe(true);
    expect((guestCheckboxes.item(2) as HTMLInputElement).disabled).toBe(false);

    // Guest toggling hints updates local hintsEnabled without altering lobby rules
    (guestCheckboxes.item(2) as HTMLInputElement).click();
    fixture.detectChanges();
    expect(session.hintsEnabled()).toBe(false);
    expect(session.snapshot()?.lobby?.rules.showHints).toBe(true);

    // 3. When host disables showHints globally, guest hints checkbox becomes disabled and unchecked
    session.hintsEnabled.set(true);
    session.snapshot.set({
      ...guestWaitingSnap,
      lobby: {
        ...guestWaitingSnap.lobby!,
        rules: { ...DEFAULT_RULES, minFan: 3, maxFan: 8, showHints: false },
      },
    });
    fixture.detectChanges();

    const lockedHintsCheckbox = hostEl
      .querySelectorAll('.rules-grid input[type="checkbox"]')
      .item(2) as HTMLInputElement;
    expect(lockedHintsCheckbox.disabled).toBe(true);
    expect(lockedHintsCheckbox.checked).toBe(false);
  });

  it('cleans up queryParamMap subscription and mahjong:leave listener on destroy', () => {
    const fixture = TestBed.createComponent(LobbyComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(queryParamSubject.observed).toBe(true);
    queryParamSubject.next(convertToParamMap({ room: 'INIT1' }));
    expect(comp.joinCode).toBe('INIT1');
    expect(comp.hasUrlInvite()).toBe(true);

    fixture.destroy();
    expect(queryParamSubject.observed).toBe(false);

    // Post-destroy emissions and window events must not mutate destroyed component state
    queryParamSubject.next(convertToParamMap({ room: 'POST9' }));
    expect(comp.joinCode).toBe('INIT1');

    window.dispatchEvent(new CustomEvent('mahjong:leave'));
    expect(comp.hasUrlInvite()).toBe(true);
    expect(comp.joinCode).toBe('INIT1');
  });
});
