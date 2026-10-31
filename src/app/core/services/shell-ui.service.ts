import { Injectable, computed, signal } from '@angular/core';
import { GameId, ShellGameId, ShellSoundType } from '../models/party.model';
import { dispatchP2pLeaveEvent } from './p2p-room.transport';

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const STORAGE_NICKNAME = 'party_pavilion_nickname';
const STORAGE_LEGACY_NICKNAME = 'hkmj_nickname';
const STORAGE_SOUND_KEY = 'party_sound_enabled';
const STORAGE_BGM_KEY = 'party_bgm_enabled';

export const BGM_TRACK_MAP: ReadonlyMap<GameId, string> = new Map<GameId, string>([
  ['mahjong', 'assets/audio/bgm.mp3'],
  ['monopoly', 'assets/audio/monopoly-bgm.mp3'],
  ['avalon', 'assets/audio/avalon-bgm.mp3'],
]);

@Injectable({
  providedIn: 'root',
})
export class ShellUiService {
  readonly activeGame = signal<ShellGameId>('hub');
  readonly activeRoomCode = signal<string | null>(null);

  readonly playerNickname = signal<string>(this.readInitialNickname());
  readonly soundEnabled = signal<boolean>(this.readInitialSound());
  readonly bgmEnabled = signal<boolean>(this.readInitialBgm());

  readonly showRulebookModal = signal<boolean>(false);
  readonly rulebookGame = signal<GameId>('mahjong');

  readonly copiedToast = signal<boolean>(false);
  readonly hasActiveRoom = computed(() => !!this.activeRoomCode());

  private audioCtx: AudioContext | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private currentBgmTrack: string | null = null;
  private unlockListenersBound = false;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.applyTheme(this.activeGame());
    this.syncBgm();
  }

  setActiveGame(game: ShellGameId): void {
    this.activeGame.set(game);
    this.applyTheme(game);
    this.syncBgm();
  }

  setActiveRoomCode(code: string | null): void {
    const normalized = code ? code.trim().toUpperCase() : '';
    this.activeRoomCode.set(normalized.length > 0 && normalized !== 'LOCAL' ? normalized : null);
  }

  setPlayerNickname(name: string): void {
    const trimmed = name.trim();
    const finalName = trimmed.length > 0 ? trimmed.slice(0, 16) : '雀友';
    this.playerNickname.set(finalName);
    this.persistNickname(finalName);
  }

  toggleSound(): void {
    const next = !this.soundEnabled();
    this.soundEnabled.set(next);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_SOUND_KEY, String(next));
      }
    } catch {
      // Storage unavailable
    }
  }

  toggleBgm(): void {
    const next = !this.bgmEnabled();
    this.bgmEnabled.set(next);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_BGM_KEY, String(next));
      }
    } catch {
      // Storage unavailable
    }
    this.syncBgm();
  }

  openRulebook(game?: GameId): void {
    if (game) {
      this.rulebookGame.set(game);
    } else {
      const cur = this.activeGame();
      if (cur === 'monopoly' || cur === 'avalon' || cur === 'mahjong') {
        this.rulebookGame.set(cur);
      } else {
        this.rulebookGame.set('mahjong');
      }
    }
    this.showRulebookModal.set(true);
  }

  closeRulebook(): void {
    this.showRulebookModal.set(false);
  }

  copyInviteLink(): void {
    const code = this.activeRoomCode();
    if (!code || typeof window === 'undefined') return;
    const game = this.activeGame() !== 'hub' ? this.activeGame() : 'mahjong';
    const origin = window.location.origin ?? '';
    const path = window.location.pathname ?? '';
    const url = `${origin}${path}?game=${game}&room=${code}`;
    try {
      void navigator.clipboard?.writeText(url).catch(() => {});
    } catch {
      // Clipboard unavailable
    }
    this.copiedToast.set(true);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.copiedToast.set(false), 2000);
  }

  leaveActiveRoom(): void {
    const code = this.activeRoomCode();
    const game = this.activeGame();
    this.setActiveRoomCode(null);
    dispatchP2pLeaveEvent(code ?? undefined, game !== 'hub' ? game : undefined);
  }

  private applyTheme(game: ShellGameId): void {
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset['theme'] = game;
    }
  }

  private readInitialNickname(): string {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(STORAGE_NICKNAME) ?? localStorage.getItem(STORAGE_LEGACY_NICKNAME);
        if (val && val.trim().length > 0) {
          return val.trim().slice(0, 16);
        }
      }
    } catch {
      // Storage unavailable
    }
    return '雀友';
  }

  private persistNickname(name: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_NICKNAME, name);
        localStorage.setItem(STORAGE_LEGACY_NICKNAME, name);
      }
    } catch {
      // Storage unavailable
    }
  }

  private readInitialSound(): boolean {
    try {
      if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(STORAGE_SOUND_KEY);
        if (item !== null) return item === 'true';
      }
    } catch {
      // Storage unavailable
    }
    return true;
  }

  private readInitialBgm(): boolean {
    try {
      if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(STORAGE_BGM_KEY);
        if (item !== null) return item === 'true';
      }
    } catch {
      // Storage unavailable
    }
    return false;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const win = window as WindowWithWebkitAudio;
      const Ctx = globalThis.AudioContext ?? win.webkitAudioContext;
      if (!Ctx) return null;
      if (!this.audioCtx) {
        this.audioCtx = new Ctx();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  private syncBgm(): void {
    if (
      typeof window === 'undefined' ||
      typeof Audio === 'undefined' ||
      (typeof navigator !== 'undefined' &&
        navigator.userAgent.toLowerCase().includes('jsdom') &&
        !('isMockAudio' in Audio))
    ) {
      return;
    }

    try {
      const game = this.activeGame();
      const trackRelPath = game === 'hub' ? null : (BGM_TRACK_MAP.get(game) ?? null);

      if (!trackRelPath) {
        if (this.bgmAudio) {
          this.bgmAudio.pause();
          this.bgmAudio.currentTime = 0;
        }
        this.currentBgmTrack = null;
        return;
      }

      if (!this.bgmEnabled()) {
        this.bgmAudio?.pause();
        return;
      }

      const baseUri =
        typeof document !== 'undefined' && document.baseURI
          ? document.baseURI
          : window.location.href;
      const resolvedSrc = new URL(trackRelPath, baseUri).toString();

      if (!this.bgmAudio || this.currentBgmTrack !== trackRelPath) {
        this.bgmAudio?.pause();
        const audio = new Audio(resolvedSrc);
        audio.loop = true;
        audio.volume = 0.38;
        this.bgmAudio = audio;
        this.currentBgmTrack = trackRelPath;
      }

      if (this.bgmAudio.paused) {
        const playPromise = this.bgmAudio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          void playPromise.catch(() => {
            this.bindAutoplayUnlock();
          });
        }
      }
    } catch {
      // Ignore browser media restrictions
    }
  }

  private bindAutoplayUnlock(): void {
    if (this.unlockListenersBound || typeof window === 'undefined') return;
    this.unlockListenersBound = true;
    const unlock = (): void => {
      this.unlockListenersBound = false;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      this.syncBgm();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  playSfx(type: ShellSoundType): void {
    if (this.bgmEnabled() && this.bgmAudio?.paused) {
      this.syncBgm();
    }
    if (!this.soundEnabled()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      switch (type) {
        case 'click': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(950, now);
          osc.frequency.exponentialRampToValueAtTime(320, now + 0.035);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.connect(gain).connect(ctx.destination);
          osc.start();
          osc.stop(now + 0.045);
          break;
        }
        case 'deal': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(620, now);
          osc.frequency.exponentialRampToValueAtTime(140, now + 0.055);
          gain.gain.setValueAtTime(0.16, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc.connect(gain).connect(ctx.destination);
          osc.start();
          osc.stop(now + 0.065);
          break;
        }
        case 'dice': {
          // Rapid dice rattle
          const tones = [480, 620, 390];
          tones.forEach((freq, idx) => {
            const tapTime = now + idx * 0.045;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, tapTime);
            gain.gain.setValueAtTime(0.14, tapTime);
            gain.gain.exponentialRampToValueAtTime(0.001, tapTime + 0.035);
            osc.connect(gain).connect(ctx.destination);
            osc.start(tapTime);
            osc.stop(tapTime + 0.04);
          });
          break;
        }
        case 'alert': {
          // Double beep
          [0, 0.1].forEach((delay) => {
            const beepTime = now + delay;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, beepTime);
            gain.gain.setValueAtTime(0.15, beepTime);
            gain.gain.exponentialRampToValueAtTime(0.001, beepTime + 0.075);
            osc.connect(gain).connect(ctx.destination);
            osc.start(beepTime);
            osc.stop(beepTime + 0.08);
          });
          break;
        }
        case 'fanfare': {
          // Major arpeggio C5, E5, G5, C6
          const freqs = [523.25, 659.25, 783.99, 1046.5];
          freqs.forEach((freq, idx) => {
            const noteTime = now + idx * 0.085;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, noteTime);
            gain.gain.setValueAtTime(0.16, noteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.14);
            osc.connect(gain).connect(ctx.destination);
            osc.start(noteTime);
            osc.stop(noteTime + 0.15);
          });
          break;
        }
        case 'fail': {
          // Descending pitch buzz
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.linearRampToValueAtTime(110, now + 0.24);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.connect(gain).connect(ctx.destination);
          osc.start();
          osc.stop(now + 0.26);
          break;
        }
      }
    } catch {
      // Audio playback restrictions prior to user gesture
    }
  }

  speak(text: string, lang = 'zh-HK'): void {
    if (!this.soundEnabled() || typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();
      const targetLang = lang.toLowerCase();

      const matchedVoice =
        voices.find((v) => v.lang.toLowerCase() === targetLang) ??
        voices.find((v) => v.lang.toLowerCase().includes(targetLang)) ??
        voices.find((v) => v.lang.toLowerCase().includes('zh'));

      if (matchedVoice) {
        u.voice = matchedVoice;
      }
      u.lang = lang;
      u.rate = 1.1;
      speechSynthesis.speak(u);
    } catch {
      // Speech synthesis unsupported or blocked
    }
  }
}
