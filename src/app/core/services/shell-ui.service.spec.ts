import { TestBed } from '@angular/core/testing';
import { BGM_TRACK_MAP, ShellUiService } from './shell-ui.service';

function restoreProp(target: object, key: string, desc: PropertyDescriptor | undefined): void {
  if (desc) {
    Object.defineProperty(target, key, desc);
  } else {
    Reflect.deleteProperty(target, key);
  }
}

describe('ShellUiService', () => {
  let service: ShellUiService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [ShellUiService],
    });
    service = TestBed.inject(ShellUiService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('initializes with default hub signals and theming', () => {
    expect(service.activeGame()).toBe('hub');
    expect(service.activeRoomCode()).toBe(null);
    expect(service.hasActiveRoom()).toBe(false);
    expect(service.soundEnabled()).toBe(true);
    expect(service.bgmEnabled()).toBe(false);
    expect(service.showRulebookModal()).toBe(false);
    expect(service.rulebookGame()).toBe('mahjong');
    expect(service.playerNickname()).toBe('雀友');
    expect(document.body.dataset['theme']).toBe('hub');
  });

  it('loads existing nickname from localStorage or migrates legacy hkmj_nickname', () => {
    localStorage.setItem('hkmj_nickname', 'OldMaster');
    const migratedService = new ShellUiService();
    expect(migratedService.playerNickname()).toBe('OldMaster');
    migratedService.ngOnDestroy();

    localStorage.setItem('party_pavilion_nickname', 'NewTycoon');
    const directService = new ShellUiService();
    expect(directService.playerNickname()).toBe('NewTycoon');
    directService.ngOnDestroy();
  });

  it('updates and persists player nickname in dual storage keys', () => {
    service.setPlayerNickname('  GodOfGamblers  ');
    expect(service.playerNickname()).toBe('GodOfGamblers');
    expect(localStorage.getItem('party_pavilion_nickname')).toBe('GodOfGamblers');
    expect(localStorage.getItem('hkmj_nickname')).toBe('GodOfGamblers');

    // Empty nickname falls back to default
    service.setPlayerNickname('   ');
    expect(service.playerNickname()).toBe('雀友');

    // Clamps long nickname to 16 chars
    service.setPlayerNickname('12345678901234567890');
    expect(service.playerNickname()).toBe('1234567890123456');
  });

  it('switches active game and updates document theme dataset', () => {
    service.setActiveGame('mahjong');
    expect(service.activeGame()).toBe('mahjong');
    expect(document.body.dataset['theme']).toBe('mahjong');

    service.setActiveGame('monopoly');
    expect(service.activeGame()).toBe('monopoly');
    expect(document.body.dataset['theme']).toBe('monopoly');

    service.setActiveGame('avalon');
    expect(service.activeGame()).toBe('avalon');
    expect(document.body.dataset['theme']).toBe('avalon');

    service.setActiveGame('pandemic');
    expect(service.activeGame()).toBe('pandemic');
    expect(document.body.dataset['theme']).toBe('pandemic');
  });

  it('tracks room code, sanitizes input, and computes hasActiveRoom', () => {
    service.setActiveRoomCode('  m1a2b  ');
    expect(service.activeRoomCode()).toBe('M1A2B');
    expect(service.hasActiveRoom()).toBe(true);

    service.setActiveRoomCode('');
    expect(service.activeRoomCode()).toBe(null);
    expect(service.hasActiveRoom()).toBe(false);

    service.setActiveRoomCode('p9876');
    expect(service.activeRoomCode()).toBe('P9876');
    expect(service.hasActiveRoom()).toBe(true);

    service.setActiveRoomCode(null);
    expect(service.activeRoomCode()).toBe(null);
    expect(service.hasActiveRoom()).toBe(false);
  });

  it('toggles sound and BGM with localStorage persistence', () => {
    expect(service.soundEnabled()).toBe(true);
    service.toggleSound();
    expect(service.soundEnabled()).toBe(false);
    expect(localStorage.getItem('party_sound_enabled')).toBe('false');

    service.toggleSound();
    expect(service.soundEnabled()).toBe(true);
    expect(localStorage.getItem('party_sound_enabled')).toBe('true');

    expect(service.bgmEnabled()).toBe(false);
    service.toggleBgm();
    expect(service.bgmEnabled()).toBe(true);
    expect(localStorage.getItem('party_bgm_enabled')).toBe('true');

    service.toggleBgm();
    expect(service.bgmEnabled()).toBe(false);
    expect(localStorage.getItem('party_bgm_enabled')).toBe('false');
  });

  it('opens and closes contextual rulebook modal correctly', () => {
    service.openRulebook('monopoly');
    expect(service.showRulebookModal()).toBe(true);
    expect(service.rulebookGame()).toBe('monopoly');

    service.closeRulebook();
    expect(service.showRulebookModal()).toBe(false);

    service.setActiveGame('avalon');
    service.openRulebook();
    expect(service.showRulebookModal()).toBe(true);
    expect(service.rulebookGame()).toBe('avalon');

    service.setActiveGame('pandemic');
    service.openRulebook();
    expect(service.showRulebookModal()).toBe(true);
    expect(service.rulebookGame()).toBe('pandemic');

    service.openRulebook('pandemic');
    expect(service.showRulebookModal()).toBe(true);
    expect(service.rulebookGame()).toBe('pandemic');

    service.setActiveGame('balik-kampung');
    service.openRulebook();
    expect(service.showRulebookModal()).toBe(true);
    expect(service.rulebookGame()).toBe('balik-kampung');

    service.setActiveGame('hub');
    service.openRulebook();
    expect(service.rulebookGame()).toBe('mahjong');
  });

  it('synthesizes Web Audio sound effects across all sound types', () => {
    const mockOsc = {
      type: 'triangle',
      frequency: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
      },
      connect: () => mockGain,
      start: () => {},
      stop: () => {},
    };
    const mockGain = {
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => mockGain,
    };
    const mockAudioContext = {
      currentTime: 10,
      createOscillator: () => mockOsc,
      createGain: () => mockGain,
      destination: {},
    };

    const audioCtxDesc = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: function () {
        return mockAudioContext;
      },
    });

    try {
      const audioSvc = new ShellUiService();
      audioSvc.playSfx('click');
      audioSvc.playSfx('deal');
      audioSvc.playSfx('dice');
      audioSvc.playSfx('alert');
      audioSvc.playSfx('fanfare');
      audioSvc.playSfx('fail');

      // When sound is disabled, does not play
      audioSvc.toggleSound();
      audioSvc.playSfx('click');
      expect(audioSvc.soundEnabled()).toBe(false);
      audioSvc.ngOnDestroy();
    } finally {
      restoreProp(globalThis, 'AudioContext', audioCtxDesc);
    }
  });

  it('handles SpeechSynthesis calls safely with voice selection', () => {
    let spokenText = '';
    const mockSpeech = {
      cancel: () => {},
      getVoices: () => [
        { lang: 'zh-HK', name: 'Cantonese' },
        { lang: 'en-US', name: 'English' },
      ],
      speak: (u: { text: string }) => {
        spokenText = u.text;
      },
    };

    const speechDesc = Object.getOwnPropertyDescriptor(globalThis, 'speechSynthesis');
    const utteranceDesc = Object.getOwnPropertyDescriptor(globalThis, 'SpeechSynthesisUtterance');
    Object.defineProperty(globalThis, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: mockSpeech,
    });
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
      configurable: true,
      writable: true,
      value: function (text: string) {
        return { text, lang: '', rate: 1, voice: null };
      },
    });

    try {
      service.speak('碰！', 'zh-HK');
      expect(spokenText).toBe('碰！');

      service.toggleSound();
      service.speak('吃牌', 'zh-HK');
      // When muted, does not speak
      expect(service.soundEnabled()).toBe(false);
    } finally {
      restoreProp(globalThis, 'speechSynthesis', speechDesc);
      restoreProp(globalThis, 'SpeechSynthesisUtterance', utteranceDesc);
    }
  });

  it('copies invite link to clipboard and activates copied toast', async () => {
    let copiedStr = '';
    const clipboardDesc = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: {
        writeText: (val: string) => {
          copiedStr = val;
          return Promise.resolve();
        },
      },
    });

    try {
      service.setActiveGame('monopoly');
      service.setActiveRoomCode('P1234');
      service.copyInviteLink();

      expect(service.copiedToast()).toBe(true);
      expect(copiedStr).toContain('P1234');
      expect(copiedStr).toContain('game=monopoly');
    } finally {
      restoreProp(navigator, 'clipboard', clipboardDesc);
    }
  });

  it('dispatches p2p:leave and resets room code upon leaveActiveRoom', () => {
    const leaveEvents: Array<{ roomCode?: string; game?: string }> = [];
    const onLeave = (ev: Event) => {
      leaveEvents.push((ev as CustomEvent<{ roomCode?: string; game?: string }>).detail);
    };
    window.addEventListener('p2p:leave', onLeave);

    try {
      service.setActiveGame('avalon');
      service.setActiveRoomCode('A8888');
      expect(service.hasActiveRoom()).toBe(true);

      service.leaveActiveRoom();
      expect(service.activeRoomCode()).toBe(null);
      expect(service.hasActiveRoom()).toBe(false);
      expect(leaveEvents.length).toBe(1);
      expect(leaveEvents.at(0)?.roomCode).toBe('A8888');
      expect(leaveEvents.at(0)?.game).toBe('avalon');
    } finally {
      window.removeEventListener('p2p:leave', onLeave);
    }
  });

  it('plays game-specific BGM tracks for Mahjong, Monopoly, and Avalon and pauses on Hub or mute', async () => {
    interface MockAudioInstance {
      src: string;
      loop: boolean;
      volume: number;
      paused: boolean;
      currentTime: number;
      playCalls: number;
      pauseCalls: number;
      play: () => Promise<void>;
      pause: () => void;
    }

    const createdAudios: MockAudioInstance[] = [];
    let rejectNextPlay = false;

    const MockAudio = function (src = ''): MockAudioInstance {
      const instance: MockAudioInstance = {
        src,
        loop: false,
        volume: 1,
        paused: true,
        currentTime: 0,
        playCalls: 0,
        pauseCalls: 0,
        play() {
          instance.playCalls += 1;
          if (rejectNextPlay) {
            rejectNextPlay = false;
            return Promise.reject(new Error('Autoplay blocked'));
          }
          instance.paused = false;
          return Promise.resolve();
        },
        pause() {
          instance.pauseCalls += 1;
          instance.paused = true;
        },
      };
      createdAudios.push(instance);
      return instance;
    };
    MockAudio.isMockAudio = true;

    const audioDesc = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
    Object.defineProperty(globalThis, 'Audio', {
      configurable: true,
      writable: true,
      value: MockAudio,
    });

    try {
      expect(BGM_TRACK_MAP.get('mahjong')).toBe('assets/audio/bgm.mp3');
      expect(BGM_TRACK_MAP.get('monopoly')).toBe('assets/audio/monopoly-bgm.mp3');
      expect(BGM_TRACK_MAP.get('avalon')).toBe('assets/audio/avalon-bgm.mp3');

      const bgmSvc = new ShellUiService();
      bgmSvc.setActiveGame('monopoly');
      // BGM starts muted by default
      expect(createdAudios.length).toBe(0);

      // Unmute BGM while in Monopoly -> loads monopoly-bgm.mp3
      bgmSvc.toggleBgm();
      expect(createdAudios.length).toBe(1);
      expect(createdAudios.at(0)?.src).toContain('assets/audio/monopoly-bgm.mp3');
      expect(createdAudios.at(0)?.loop).toBe(true);
      expect(createdAudios.at(0)?.paused).toBe(false);

      // Switch to Avalon -> pauses Monopoly BGM and plays avalon-bgm.mp3
      bgmSvc.setActiveGame('avalon');
      expect(createdAudios.at(0)?.paused).toBe(true);
      expect(createdAudios.length).toBe(2);
      expect(createdAudios.at(1)?.src).toContain('assets/audio/avalon-bgm.mp3');
      expect(createdAudios.at(1)?.paused).toBe(false);

      // Switch to Mahjong -> pauses Avalon BGM and plays bgm.mp3
      rejectNextPlay = true;
      bgmSvc.setActiveGame('mahjong');
      expect(createdAudios.at(1)?.paused).toBe(true);
      expect(createdAudios.length).toBe(3);
      expect(createdAudios.at(2)?.src).toContain('assets/audio/bgm.mp3');

      // Wait microtask for rejected play() to bind unlock listener, then dispatch pointerdown
      await Promise.resolve();
      expect(createdAudios.at(2)?.paused).toBe(true);
      window.dispatchEvent(new Event('pointerdown'));
      expect(createdAudios.at(2)?.paused).toBe(false);

      // Mute BGM -> pauses active track
      bgmSvc.toggleBgm();
      expect(createdAudios.at(2)?.paused).toBe(true);

      // Unmute then return to Hub -> pauses and resets currentTime
      bgmSvc.toggleBgm();
      expect(createdAudios.at(2)?.paused).toBe(false);
      bgmSvc.setActiveGame('hub');
      expect(createdAudios.at(2)?.paused).toBe(true);
      expect(createdAudios.at(2)?.currentTime).toBe(0);
      bgmSvc.ngOnDestroy();
    } finally {
      restoreProp(globalThis, 'Audio', audioDesc);
    }
  });

  it('auto-suspends idle AudioContext and pauses/resumes audio on tab visibilitychange', () => {
    vi.useFakeTimers();
    let suspendCalls = 0;
    let resumeCalls = 0;
    let speechCancels = 0;
    let ctxState: AudioContextState = 'running';

    const mockGain = {
      gain: {
        setValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: () => mockGain,
    };
    const mockOsc = {
      type: 'triangle',
      frequency: {
        setValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: () => mockGain,
      start: () => undefined,
      stop: () => undefined,
    };
    const mockCtx = {
      get state() {
        return ctxState;
      },
      currentTime: 1,
      destination: {},
      createOscillator: () => mockOsc,
      createGain: () => mockGain,
      suspend: () => {
        suspendCalls += 1;
        ctxState = 'suspended';
        return Promise.resolve();
      },
      resume: () => {
        resumeCalls += 1;
        ctxState = 'running';
        return Promise.resolve();
      },
    };

    let bgmPaused = true;
    const MockAudio = function () {
      return {
        src: '',
        loop: false,
        volume: 1,
        get paused() {
          return bgmPaused;
        },
        currentTime: 0,
        play() {
          bgmPaused = false;
          return Promise.resolve();
        },
        pause() {
          bgmPaused = true;
        },
      };
    };
    MockAudio.isMockAudio = true;

    const audioCtxDesc = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
    const audioDesc = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
    const speechDesc = Object.getOwnPropertyDescriptor(globalThis, 'speechSynthesis');
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');

    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: function () {
        return mockCtx;
      },
    });
    Object.defineProperty(globalThis, 'Audio', {
      configurable: true,
      writable: true,
      value: MockAudio,
    });
    Object.defineProperty(globalThis, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: {
        cancel: () => {
          speechCancels += 1;
        },
        getVoices: () => [],
        speak: () => undefined,
      },
    });

    try {
      service.ngOnDestroy();
      const powerSvc = new ShellUiService();
      powerSvc.setActiveGame('monopoly');
      powerSvc.toggleBgm();
      expect(bgmPaused).toBe(false);

      powerSvc.playSfx('click');
      expect(suspendCalls).toBe(0);

      // Idle timeout (1500ms) suspends AudioContext
      vi.advanceTimersByTime(1600);
      expect(suspendCalls).toBe(1);
      expect(ctxState).toBe('suspended');

      // Playing SFX again resumes suspended AudioContext
      powerSvc.playSfx('click');
      expect(resumeCalls).toBe(1);
      expect(ctxState).toBe('running');

      // Backgrounding tab pauses BGM, suspends AudioContext immediately, and cancels TTS
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(bgmPaused).toBe(true);
      expect(suspendCalls).toBe(2);
      expect(speechCancels).toBe(1);

      // Foregrounding tab resumes BGM when bgmEnabled is true
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(bgmPaused).toBe(false);

      // Muting sound suspends active AudioContext immediately
      powerSvc.playSfx('click');
      expect(ctxState).toBe('running');
      powerSvc.toggleSound();
      expect(ctxState).toBe('suspended');

      powerSvc.ngOnDestroy();
    } finally {
      restoreProp(globalThis, 'AudioContext', audioCtxDesc);
      restoreProp(globalThis, 'Audio', audioDesc);
      restoreProp(globalThis, 'speechSynthesis', speechDesc);
      restoreProp(document, 'hidden', hiddenDescriptor);
      vi.useRealTimers();
    }
  });
});
