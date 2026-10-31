// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HubComponent } from '../../pages/hub/hub.component';
import { ShellUiService } from '../services/shell-ui.service';
import { parseUniversalRoomCode } from '../services/p2p-room.transport';

describe('E2E: Hub & Shell Architecture Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.removeItem('party_bgm_enabled');
    localStorage.removeItem('party_sound_enabled');
    localStorage.removeItem('party_pavilion_nickname');
    localStorage.removeItem('hkmj_nickname');
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    localStorage.removeItem('party_bgm_enabled');
    localStorage.removeItem('party_sound_enabled');
    localStorage.removeItem('party_pavilion_nickname');
    localStorage.removeItem('hkmj_nickname');
    sessionStorage.clear();
  });

  describe('1. Universal Room-Code Parser & Deep-Link Resolution', () => {
    it('resolves game prefixes accurately (M -> mahjong, P -> monopoly, A -> avalon)', () => {
      const pResult = parseUniversalRoomCode('P1234');
      expect(pResult.game).toBe('monopoly');
      expect(pResult.roomCode).toBe('P1234');

      const aResult = parseUniversalRoomCode('A7890');
      expect(aResult.game).toBe('avalon');
      expect(aResult.roomCode).toBe('A7890');

      const mResult = parseUniversalRoomCode('M5678');
      expect(mResult.game).toBe('mahjong');
      expect(mResult.roomCode).toBe('M5678');
    });

    it('resolves invite deep links with query parameters', () => {
      const link1 = parseUniversalRoomCode('https://domain.com/?game=monopoly&room=P9876');
      expect(link1.game).toBe('monopoly');
      expect(link1.roomCode).toBe('P9876');

      const link2 = parseUniversalRoomCode('https://domain.com/?game=avalon&room=A5432');
      expect(link2.game).toBe('avalon');
      expect(link2.roomCode).toBe('A5432');

      const link3 = parseUniversalRoomCode('https://domain.com/?room=P3333');
      expect(link3.game).toBe('monopoly');
      expect(link3.roomCode).toBe('P3333');

      const link4 = parseUniversalRoomCode('https://domain.com/?room=A2222');
      expect(link4.game).toBe('avalon');
      expect(link4.roomCode).toBe('A2222');
    });

    it('falls back to mahjong for legacy room codes and handles empty inputs safely', () => {
      const legacy = parseUniversalRoomCode('OLD999');
      expect(legacy.game).toBe('mahjong');
      expect(legacy.roomCode).toBe('OLD999');

      const empty = parseUniversalRoomCode('   ');
      expect(empty.game).toBe('mahjong');
      expect(empty.roomCode).toBe('');
    });
  });

  describe('2. ShellUiService Nickname Migration, Theming & Audio', () => {
    it('migrates legacy hkmj_nickname into party_pavilion_nickname and dual-persists', () => {
      localStorage.setItem('hkmj_nickname', '雀后');
      const service = new ShellUiService();

      expect(service.playerNickname()).toBe('雀后');

      service.setPlayerNickname('財神大亨');
      expect(service.playerNickname()).toBe('財神大亨');
      expect(localStorage.getItem('party_pavilion_nickname')).toBe('財神大亨');
      expect(localStorage.getItem('hkmj_nickname')).toBe('財神大亨');
    });

    it('switches themes and sets document.body.dataset[theme] contextually', () => {
      const service = new ShellUiService();

      service.setActiveGame('monopoly');
      expect(service.activeGame()).toBe('monopoly');
      expect(document.body.dataset['theme']).toBe('monopoly');

      service.setActiveGame('avalon');
      expect(service.activeGame()).toBe('avalon');
      expect(document.body.dataset['theme']).toBe('avalon');

      service.setActiveGame('mahjong');
      expect(service.activeGame()).toBe('mahjong');
      expect(document.body.dataset['theme']).toBe('mahjong');

      service.setActiveGame('hub');
      expect(service.activeGame()).toBe('hub');
      expect(document.body.dataset['theme']).toBe('hub');
    });

    it('tracks active room code and computes hasActiveRoom state', () => {
      const service = new ShellUiService();
      expect(service.hasActiveRoom()).toBe(false);

      service.setActiveRoomCode('P1234');
      expect(service.activeRoomCode()).toBe('P1234');
      expect(service.hasActiveRoom()).toBe(true);

      service.setActiveRoomCode(null);
      expect(service.activeRoomCode()).toBe(null);
      expect(service.hasActiveRoom()).toBe(false);
    });

    it('toggles sound and BGM flags and persists state to localStorage', () => {
      localStorage.removeItem('party_sound_enabled');
      localStorage.removeItem('party_bgm_enabled');
      const service = new ShellUiService();
      expect(service.soundEnabled()).toBe(true);
      expect(service.bgmEnabled()).toBe(false);

      service.toggleSound();
      expect(service.soundEnabled()).toBe(false);
      expect(localStorage.getItem('party_sound_enabled')).toBe('false');

      service.toggleBgm();
      expect(service.bgmEnabled()).toBe(true);
      expect(localStorage.getItem('party_bgm_enabled')).toBe('true');
    });

    it('opens and closes contextual rulebook modal for target game', () => {
      const service = new ShellUiService();
      expect(service.showRulebookModal()).toBe(false);

      service.openRulebook('monopoly');
      expect(service.showRulebookModal()).toBe(true);
      expect(service.rulebookGame()).toBe('monopoly');

      service.closeRulebook();
      expect(service.showRulebookModal()).toBe(false);

      service.setActiveGame('avalon');
      service.openRulebook();
      expect(service.showRulebookModal()).toBe(true);
      expect(service.rulebookGame()).toBe('avalon');
    });

    it('triggers procedural Web Audio sound synthesis safely without crashing', () => {
      const service = new ShellUiService();
      const soundTypes = ['click', 'deal', 'dice', 'alert', 'fanfare', 'fail'] as const;

      for (const st of soundTypes) {
        expect(() => service.playSfx(st)).not.toThrow();
      }

      // Test sound disabled branch
      service.toggleSound();
      expect(service.soundEnabled()).toBe(false);
      expect(() => service.playSfx('click')).not.toThrow();
      service.toggleSound();
      expect(service.soundEnabled()).toBe(true);

      // Speech synthesis voice fallback branches
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const dummyVoices = [
          { lang: 'zh-CN', name: 'Chinese Mainland' } as SpeechSynthesisVoice,
          { lang: 'en-US', name: 'US English' } as SpeechSynthesisVoice,
        ];
        const origGetVoices = window.speechSynthesis.getVoices;
        window.speechSynthesis.getVoices = () => dummyVoices;
        expect(() => service.speak('遊戲開始', 'zh')).not.toThrow();
        expect(() => service.speak('Game Start', 'en')).not.toThrow();
        window.speechSynthesis.getVoices = origGetVoices;
      }
    });
  });

  describe('3. HubComponent Routing & Presentation', () => {
    it('mounts HubComponent, renders 3 game cards, and handles room navigation', async () => {
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

      const fixture = TestBed.createComponent(HubComponent);
      fixture.detectChanges();

      const comp = fixture.componentInstance;
      const el = fixture.nativeElement as HTMLElement;

      // 1. Check hero title and 3 game cards rendered
      expect(el.querySelectorAll('.game-card').length).toBe(3);
      const mjText = el.querySelector('.mahjong-card')?.textContent ?? '';
      expect(mjText.includes('HUB.MAHJONG_TITLE') || mjText.includes('港马麻将馆')).toBe(true);
      const monoText = el.querySelector('.monopoly-card')?.textContent ?? '';
      expect(monoText.includes('HUB.MONOPOLY_TITLE') || monoText.includes('大马地标大富翁')).toBe(true);
      const avaText = el.querySelector('.avalon-card')?.textContent ?? '';
      expect(avaText.includes('HUB.AVALON_TITLE') || avaText.includes('阿瓦隆')).toBe(true);

      // 2. Room code join input with invalid/empty code
      comp.onRoomCodeChange('');
      comp.joinRoom();
      expect(comp.joinError()).toBe('HUB.ERROR_EMPTY_ROOM');

      // 3. Room code join with valid monopoly code
      const router = TestBed.inject(Router);
      let navigatedUrl = '';
      let navigatedParams: Record<string, unknown> | undefined;
      router.navigate = ((commands: string[], extras?: { queryParams?: Record<string, unknown> }) => {
        navigatedUrl = commands.at(0) ?? '';
        navigatedParams = extras?.queryParams;
        return Promise.resolve(true);
      }) as unknown as typeof router.navigate;

      comp.onRoomCodeChange('P9876');
      comp.joinRoom();
      expect(comp.joinError()).toBe(null);
      expect(navigatedUrl).toBe('/monopoly/lobby');
      expect(navigatedParams).toEqual({ room: 'P9876' });

      // 4. Room code join with valid avalon code
      comp.onRoomCodeChange('A4321');
      comp.joinRoom();
      expect(navigatedUrl).toBe('/avalon/lobby');
      expect(navigatedParams).toEqual({ room: 'A4321' });

      // 5. Enter game direct CTA
      comp.enterGame('mahjong');
      expect(navigatedUrl).toBe('/mahjong/lobby');

      // 6. Nickname editing workflow
      comp.startEditNickname();
      expect(comp.isEditingNickname()).toBe(true);
      fixture.detectChanges();
      const editRowText = el.querySelector('.nickname-edit-row')?.textContent ?? '';
      expect(
        editRowText.includes('COMMON.SAVE') ||
          editRowText.includes('保存') ||
          editRowText.includes('Save')
      ).toBe(true);

      comp.cancelEditNickname();
      expect(comp.isEditingNickname()).toBe(false);
      fixture.detectChanges();
      const displayRowText = el.querySelector('.nickname-display-row')?.textContent ?? '';
      expect(
        displayRowText.includes('HUB.EDIT_NICKNAME') ||
          displayRowText.includes('修改') ||
          displayRowText.includes('Edit')
      ).toBe(true);

      comp.startEditNickname();
      comp.onNicknameChange('勝者為王');
      comp.saveNickname();
      expect(comp.isEditingNickname()).toBe(false);
      expect(comp.shellUi.playerNickname()).toBe('勝者為王');

      // 7. Verify alert banner renders on error
      comp.onRoomCodeChange('');
      comp.joinRoom();
      fixture.detectChanges();
      const alertText = el.querySelector('.join-alert')?.textContent ?? '';
      expect(
        alertText.includes('HUB.ERROR_EMPTY_ROOM') ||
          alertText.includes('请输入有效的房号') ||
          alertText.includes('room')
      ).toBe(true);

      // 8. Exercise openRulebook across each game
      comp.openRulebook('monopoly');
      expect(comp.shellUi.rulebookGame()).toBe('monopoly');

      comp.openRulebook('avalon');
      expect(comp.shellUi.rulebookGame()).toBe('avalon');

      // 9. Exercise invalid room code format and clearance on change
      comp.onRoomCodeChange('???');
      comp.joinRoom();
      expect(comp.joinError()).toBe('HUB.ERROR_INVALID_ROOM');
      comp.onRoomCodeChange('M');
      expect(comp.joinError()).toBe(null);
    });

    it('intercepts deep-link room parameters on init and redirects to target lobby', async () => {
      const mockQueryMap = new Map<string, string>([
        ['game', 'monopoly'],
        ['room', 'P5555'],
      ]);

      await TestBed.configureTestingModule({
        imports: [HubComponent],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                queryParamMap: {
                  get: (key: string) => mockQueryMap.get(key) ?? null,
                },
              },
            },
          },
        ],
      }).compileComponents();

      const router = TestBed.inject(Router);
      let redirectedUrl = '';
      let redirectedParams: Record<string, unknown> | undefined;
      let usedReplaceUrl = false;

      router.navigate = ((
        commands: string[],
        extras?: { queryParams?: Record<string, unknown>; replaceUrl?: boolean }
      ) => {
        redirectedUrl = commands.at(0) ?? '';
        redirectedParams = extras?.queryParams;
        usedReplaceUrl = extras?.replaceUrl ?? false;
        return Promise.resolve(true);
      }) as unknown as typeof router.navigate;

      const fixture = TestBed.createComponent(HubComponent);
      fixture.detectChanges(); // triggers ngOnInit

      expect(redirectedUrl).toBe('/monopoly/lobby');
      expect(redirectedParams).toEqual({ room: 'P5555' });
      expect(usedReplaceUrl).toBe(true);

      // Re-trigger with only room parameter (no game parameter)
      mockQueryMap.clear();
      mockQueryMap.set('room', 'M7777');
      fixture.componentInstance.ngOnInit();
      expect(redirectedUrl).toBe('/mahjong/lobby');
      expect(redirectedParams).toEqual({ room: 'M7777' });
    });
  });
});
