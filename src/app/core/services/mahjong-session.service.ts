import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  GameAction,
  GameMode,
  GameRules,
  LobbySeat,
  MatchState,
  PublicLobby,
  SessionSnapshot,
  WaitingTileInfo,
} from '../models/mahjong.model';
import { windLabel } from '../utils/tiles.util';
import { chooseBotAction } from './bot.service';
import { applyAction, createMatch, getPlayerView, startNewHand } from './engine.service';
import { DEFAULT_RULES, getWaitingTiles } from './scorer.service';

const PEER_PREFIX = 'hkmj-v1-room-';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BOT_NAMES: readonly string[] = ['阿發 (Bot)', '十三姨 (Bot)', '雀神強 (Bot)', '六嬸 (Bot)'];

interface PeerConnectionLike {
  readonly open: boolean;
  send(data: unknown): void;
  on(event: string, cb: (arg?: unknown) => void): void;
}

interface PeerErrorLike {
  readonly type?: string;
}

interface PeerInstanceLike {
  connect(id: string, opts?: { reliable?: boolean }): PeerConnectionLike;
  on(event: string, cb: (arg?: unknown) => void): void;
  destroy(): void;
}

type PeerConstructorLike = new (id?: string) => PeerInstanceLike;

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}

export function generateRoomCode(len = 5): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    const ch = CODE_ALPHABET.at(Math.floor(Math.random() * CODE_ALPHABET.length)) ?? 'A';
    out += ch;
  }
  return out;
}

export function getPlayerToken(): string {
  try {
    if (typeof sessionStorage !== 'undefined') {
      let tok = sessionStorage.getItem('hkmj_player_token');
      if (!tok) {
        tok =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `tok_${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem('hkmj_player_token', tok);
      }
      return tok;
    }
  } catch {
    // Fallback in non-browser test environments
  }
  return `tok_${Math.random().toString(36).slice(2)}`;
}

async function loadPeerClass(): Promise<PeerConstructorLike> {
  const mod = (await import('peerjs')) as unknown as {
    Peer?: PeerConstructorLike;
    default?: PeerConstructorLike;
  };
  const ctor = mod.Peer ?? mod.default;
  if (!ctor) {
    throw new Error('PeerJS constructor unavailable');
  }
  return ctor;
}

function makeDefaultSeats(
  mode: GameMode,
  hostName: string,
  hostToken: string,
  fillBots = false
): LobbySeat[] {
  const count = mode === '3p' ? 3 : 4;
  return Array.from({ length: count }, (_, idx) => {
    if (idx === 0) {
      return {
        seat: 0,
        kind: 'human',
        name: hostName || '房主',
        token: hostToken,
        connected: true,
        windLabel: windLabel(0),
      };
    }
    if (fillBots) {
      return {
        seat: idx,
        kind: 'bot',
        name: BOT_NAMES.at(idx - 1) ?? 'Bot',
        token: `bot_${idx}`,
        connected: true,
        windLabel: windLabel(idx),
      };
    }
    return {
      seat: idx,
      kind: 'open',
      name: '等待朋友加入…',
      token: null,
      connected: false,
      windLabel: windLabel(idx),
    };
  });
}

export class HostSession {
  readonly role = 'host' as const;
  readonly online: boolean;
  readonly roomCode: string;
  readonly myToken: string;
  readonly mySeat = 0;
  status: string;
  error: string | null = null;
  lobby: PublicLobby;
  match: MatchState | null = null;

  private readonly listeners = new Set<(snap: SessionSnapshot) => void>();
  private peer: PeerInstanceLike | null = null;
  private readonly peerConns = new Map<string, PeerConnectionLike>();
  private bc: BroadcastChannel | null = null;
  private botTimer: ReturnType<typeof setTimeout> | undefined;

  constructor({
    hostName = '房主',
    mode = '4p',
    online = false,
    fillBots = false,
    rules = {},
    token,
  }: {
    hostName?: string;
    mode?: GameMode;
    online?: boolean;
    fillBots?: boolean;
    rules?: Partial<GameRules>;
    token?: string;
  } = {}) {
    this.online = online;
    this.roomCode = online ? generateRoomCode() : 'LOCAL';
    this.myToken = token ?? getPlayerToken();
    this.status = online ? '正在建立 P2P 房間…' : '單機模式就緒';

    this.lobby = {
      mode,
      rules: { ...DEFAULT_RULES, ...rules },
      started: false,
      seats: makeDefaultSeats(mode, hostName, this.myToken, fillBots),
    };

    if (online) {
      void this.initTransports();
    }
  }

  onUpdate(fn: (snap: SessionSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.buildSnapshotForSeat(0));
    return () => this.listeners.delete(fn);
  }

  destroy(): void {
    clearTimeout(this.botTimer);
    this.bc?.close();
    this.peer?.destroy();
  }

  private async initTransports(): Promise<void> {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(`hkmj-bc-${this.roomCode}`);
      this.bc.onmessage = (ev: MessageEvent) => {
        if (!isRecord(ev.data) || ev.data['to'] === 'guest') return;
        const senderToken = typeof ev.data['token'] === 'string' ? ev.data['token'] : '';
        this.handleClientMessage(ev.data, (reply) => {
          this.bc?.postMessage({ ...reply, to: 'guest', targetToken: senderToken });
        });
      };
    }

    if (typeof RTCPeerConnection === 'undefined') {
      this.status = `房號 ${this.roomCode} 已開啟（本機通道就緒）`;
      this.broadcastAll();
      return;
    }

    try {
      const PeerCtor = await loadPeerClass();
      const peer = new PeerCtor(`${PEER_PREFIX}${this.roomCode}`);
      this.peer = peer;

      peer.on('open', () => {
        this.status = `房號 ${this.roomCode} 已開啟（WebRTC P2P 就緒）`;
        this.broadcastAll();
      });

      peer.on('connection', (rawConn: unknown) => {
        const conn = rawConn as PeerConnectionLike;
        conn.on('data', (rawMsg: unknown) => {
          if (!isRecord(rawMsg)) return;
          const tok = typeof rawMsg['token'] === 'string' ? rawMsg['token'] : '';
          if (tok) this.peerConns.set(tok, conn);
          this.handleClientMessage(rawMsg, (reply) => {
            if (conn.open) conn.send(reply);
          });
        });

        conn.on('close', () => {
          for (const [tok, c] of this.peerConns.entries()) {
            if (c === conn) {
              this.peerConns.delete(tok);
              const seatObj = this.lobby.seats.find((s) => s.token === tok);
              if (seatObj) {
                seatObj.connected = false;
                this.broadcastAll();
              }
            }
          }
        });
      });

      peer.on('error', (rawErr: unknown) => {
        const err = rawErr as PeerErrorLike | undefined;
        this.status = `本機分頁連線就緒（外部信令離線：${err?.type ?? 'offline'}）`;
        this.broadcastAll();
      });
    } catch {
      this.status = '離線區域模式（支援同瀏覽器多分頁或電腦對戰）';
      this.broadcastAll();
    }
  }

  private handleClientMessage(
    msg: Record<string, unknown>,
    replyFn: (reply: Record<string, unknown>) => void
  ): void {
    const type = typeof msg['type'] === 'string' ? msg['type'] : '';
    const token = typeof msg['token'] === 'string' ? msg['token'] : '';
    const name = typeof msg['name'] === 'string' ? msg['name'] : '';
    if (!token) return;

    if (type === 'join') {
      const existing = this.lobby.seats.find((s) => s.token === token);
      if (existing) {
        existing.connected = true;
        if (name) existing.name = name;
        this.broadcastAll();
        return;
      }

      if (this.lobby.started) {
        replyFn({ type: 'error', message: '牌局已經開始，無法中途加入新座位。' });
        return;
      }

      const openSeat = this.lobby.seats.find((s) => s.kind === 'open');
      if (!openSeat) {
        replyFn({ type: 'error', message: '房間座位已滿！請房主釋放座位。' });
        return;
      }

      openSeat.kind = 'human';
      openSeat.name = name.trim() || `雀友 ${openSeat.seat + 1}`;
      openSeat.token = token;
      openSeat.connected = true;
      this.broadcastAll();
      return;
    }

    if (type === 'action' && this.match && isRecord(msg['action'])) {
      const seatObj = this.lobby.seats.find((s) => s.token === token);
      if (!seatObj) return;
      try {
        applyAction(this.match, seatObj.seat, msg['action'] as unknown as GameAction);
        this.broadcastAll();
        this.scheduleBots();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : '非法動作';
        replyFn({ type: 'error', message });
      }
    }
  }

  setMode(mode: GameMode): void {
    if (this.lobby.started) return;
    const prevHumans = this.lobby.seats.filter((s, idx) => idx > 0 && s.kind === 'human');
    const allBotsBefore = this.lobby.seats.slice(1).every((s) => s.kind === 'bot');
    const hostName = this.lobby.seats.at(0)?.name ?? '房主';
    this.lobby.mode = mode;
    const nextSeats = makeDefaultSeats(mode, hostName, this.myToken, allBotsBefore);

    let slot = 1;
    for (const h of prevHumans) {
      if (slot < nextSeats.length) {
        nextSeats.splice(slot, 1, { ...h, seat: slot, windLabel: windLabel(slot) });
        slot++;
      }
    }
    this.lobby.seats = nextSeats;
    this.broadcastAll();
  }

  toggleSeatBot(seatIdx: number): void {
    if (this.lobby.started || seatIdx <= 0 || seatIdx >= this.lobby.seats.length) return;
    const s = this.lobby.seats.at(seatIdx);
    if (!s) return;
    if (s.kind === 'bot') {
      s.kind = 'open';
      s.name = '等待朋友加入…';
      s.token = null;
      s.connected = false;
    } else if (s.kind === 'open') {
      s.kind = 'bot';
      s.name = BOT_NAMES.at((seatIdx - 1) % BOT_NAMES.length) ?? 'Bot';
      s.token = `bot_${seatIdx}`;
      s.connected = true;
    }
    this.broadcastAll();
  }

  updateRules(partial: Partial<GameRules>): void {
    if (this.lobby.started) return;
    this.lobby.rules = { ...this.lobby.rules, ...partial };
    if (this.lobby.rules.maxFan < this.lobby.rules.minFan) {
      this.lobby.rules.maxFan = this.lobby.rules.minFan;
    }
    this.broadcastAll();
  }

  startGame(): boolean {
    const hasOpen = this.lobby.seats.some((s) => s.kind === 'open');
    if (hasOpen) {
      this.error = '仍有空位等待朋友加入！請等待朋友進房，或點擊空位切換為「電腦 Bot」。';
      this.broadcastAll();
      return false;
    }
    this.error = null;
    this.lobby.started = true;
    this.match = createMatch({
      mode: this.lobby.mode,
      rules: this.lobby.rules,
      startingScore: 1000,
    });
    this.broadcastAll();
    this.scheduleBots();
    return true;
  }

  nextHand(): void {
    if (!this.match || this.match.phase !== 'handOver') return;
    startNewHand(this.match);
    this.broadcastAll();
    this.scheduleBots();
  }

  returnToLobby(): void {
    clearTimeout(this.botTimer);
    this.match = null;
    this.lobby.started = false;
    this.broadcastAll();
  }

  sendAction(action: GameAction): void {
    if (!this.match) return;
    try {
      this.error = null;
      applyAction(this.match, this.mySeat, action);
      this.broadcastAll();
      this.scheduleBots();
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : '動作失敗';
      this.broadcastAll();
    }
  }

  private scheduleBots(): void {
    clearTimeout(this.botTimer);
    if (!this.match || this.match.phase === 'handOver') return;

    for (let s = 0; s < this.match.numSeats; s++) {
      if (this.lobby.seats.at(s)?.kind !== 'bot') continue;
      const botView = getPlayerView(this.match, s);
      if (!botView.legalActions) continue;

      const act = chooseBotAction(botView);
      if (!act) continue;
      const delay = act.type === 'pass' ? 240 : 460;

      this.botTimer = setTimeout(() => {
        if (!this.match || this.match.phase === 'handOver') return;
        const freshView = getPlayerView(this.match, s);
        if (!freshView.legalActions) {
          this.scheduleBots();
          return;
        }
        const freshAct = chooseBotAction(freshView);
        if (freshAct) {
          applyAction(this.match, s, freshAct);
          this.broadcastAll();
        }
        this.scheduleBots();
      }, delay);
      return;
    }
  }

  private buildSnapshotForSeat(seatIdx: number): SessionSnapshot {
    return {
      role: seatIdx === 0 ? 'host' : 'guest',
      online: this.online,
      roomCode: this.roomCode,
      status: this.status,
      error: seatIdx === 0 ? this.error : null,
      mySeat: seatIdx,
      lobby: {
        mode: this.lobby.mode,
        rules: { ...this.lobby.rules },
        started: this.lobby.started,
        seats: this.lobby.seats.map((s) => ({ ...s, token: null })),
      },
      view: this.match ? getPlayerView(this.match, seatIdx) : null,
    };
  }

  private broadcastAll(): void {
    const hostSnap = this.buildSnapshotForSeat(0);
    for (const fn of this.listeners) fn(hostSnap);

    for (const s of this.lobby.seats) {
      if (s.seat === 0 || s.kind !== 'human' || !s.token) continue;
      const snap = this.buildSnapshotForSeat(s.seat);
      const payload = { type: 'sync', snapshot: snap };

      const conn = this.peerConns.get(s.token);
      if (conn?.open) conn.send(payload);
      this.bc?.postMessage({ ...payload, to: 'guest', targetToken: s.token });
    }
  }
}

export class GuestSession {
  readonly role = 'guest' as const;
  readonly online = true;
  readonly roomCode: string;
  readonly myToken: string;

  private readonly guestName: string;
  private readonly listeners = new Set<(snap: SessionSnapshot) => void>();
  private snapshot: SessionSnapshot;
  private bc: BroadcastChannel | null = null;
  private peer: PeerInstanceLike | null = null;
  private conn: PeerConnectionLike | null = null;
  private connectedViaBc = false;

  constructor({
    roomCode,
    guestName = '雀友',
    token,
  }: {
    roomCode: string;
    guestName?: string;
    token?: string;
  }) {
    this.roomCode = roomCode.trim().toUpperCase();
    this.guestName = guestName.trim() || '雀友';
    this.myToken = token ?? getPlayerToken();
    this.snapshot = {
      role: 'guest',
      online: true,
      roomCode: this.roomCode,
      status: `正在連線至房間 ${this.roomCode}…`,
      error: null,
      mySeat: -1,
      lobby: null,
      view: null,
    };
    void this.connect();
  }

  onUpdate(fn: (snap: SessionSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot);
    return () => this.listeners.delete(fn);
  }

  destroy(): void {
    this.bc?.close();
    this.peer?.destroy();
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.snapshot);
  }

  private async connect(): Promise<void> {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(`hkmj-bc-${this.roomCode}`);
      this.bc.onmessage = (ev: MessageEvent) => {
        if (!isRecord(ev.data)) return;
        if (ev.data['to'] !== 'guest' || ev.data['targetToken'] !== this.myToken) return;
        if (ev.data['type'] === 'sync' && isRecord(ev.data['snapshot'])) {
          this.connectedViaBc = true;
          this.snapshot = {
            ...(ev.data['snapshot'] as unknown as SessionSnapshot),
            status: `已連線至房間 ${this.roomCode}`,
          };
          this.emit();
        } else if (ev.data['type'] === 'error') {
          this.snapshot = {
            ...this.snapshot,
            error: typeof ev.data['message'] === 'string' ? ev.data['message'] : '連線錯誤',
          };
          this.emit();
        }
      };
      this.bc.postMessage({ type: 'join', token: this.myToken, name: this.guestName });
    }

    await new Promise<void>((r) => setTimeout(r, 200));
    if (this.connectedViaBc || typeof RTCPeerConnection === 'undefined') return;

    try {
      const PeerCtor = await loadPeerClass();
      const peer = new PeerCtor();
      this.peer = peer;

      peer.on('open', () => {
        const conn = peer.connect(`${PEER_PREFIX}${this.roomCode}`, { reliable: true });
        this.conn = conn;

        conn.on('open', () => {
          conn.send({ type: 'join', token: this.myToken, name: this.guestName });
        });

        conn.on('data', (rawMsg: unknown) => {
          if (!isRecord(rawMsg)) return;
          if (rawMsg['type'] === 'sync' && isRecord(rawMsg['snapshot'])) {
            this.snapshot = {
              ...(rawMsg['snapshot'] as unknown as SessionSnapshot),
              status: `已連線至房間 ${this.roomCode}`,
            };
            this.emit();
          } else if (rawMsg['type'] === 'error') {
            this.snapshot = {
              ...this.snapshot,
              error: typeof rawMsg['message'] === 'string' ? rawMsg['message'] : '連線錯誤',
            };
            this.emit();
          }
        });

        conn.on('close', () => {
          this.snapshot = { ...this.snapshot, status: '與房主連線中斷，請重新整理重連。' };
          this.emit();
        });
      });

      peer.on('error', (rawErr: unknown) => {
        const err = rawErr as PeerErrorLike | undefined;
        this.snapshot = {
          ...this.snapshot,
          error: `無法連線至房號 ${this.roomCode}（${err?.type ?? '請確認房號是否正確'}）`,
        };
        this.emit();
      });
    } catch {
      this.snapshot = { ...this.snapshot, error: '載入 P2P 連線模組失敗，請檢查網路連線。' };
      this.emit();
    }
  }

  sendAction(action: GameAction): void {
    const payload = { type: 'action', token: this.myToken, action };
    if (this.connectedViaBc && this.bc) {
      this.bc.postMessage(payload);
    } else if (this.conn?.open) {
      this.conn.send(payload);
    }
  }
}

@Injectable({ providedIn: 'root' })
export class MahjongSessionService {
  private readonly router = inject(Router);

  readonly snapshot = signal<SessionSnapshot | null>(null);
  readonly soundEnabled = signal<boolean>(true);
  readonly bgmEnabled = signal<boolean>(true);
  readonly hintsEnabled = signal<boolean>(true);
  readonly showRulebook = signal<boolean>(false);
  readonly copiedToast = signal<boolean>(false);

  private session: HostSession | GuestSession | null = null;
  private audioCtx: AudioContext | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private lastLogSeen = '';

  toggleBgm(): void {
    this.bgmEnabled.set(!this.bgmEnabled());
    this.syncBgm(Boolean(this.snapshot()?.view));
  }

  private syncBgm(inMatch: boolean): void {
    if (
      typeof window === 'undefined' ||
      typeof Audio === 'undefined' ||
      (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('jsdom'))
    ) {
      return;
    }
    try {
      if (!inMatch) {
        if (this.bgmAudio) {
          this.bgmAudio.pause();
          this.bgmAudio.currentTime = 0;
        }
        return;
      }
      if (!this.bgmEnabled()) {
        this.bgmAudio?.pause();
        return;
      }
      if (!this.bgmAudio) {
        const audioSrc = new URL('assets/audio/bgm.mp3', document.baseURI).toString();
        const audio = new Audio(audioSrc);
        audio.loop = true;
        audio.volume = 0.38;
        this.bgmAudio = audio;
      }
      if (this.bgmAudio.paused) {
        void this.bgmAudio.play().catch(() => undefined);
      }
    } catch {
      // Ignore browser media restrictions
    }
  }

  readonly waitingTiles = computed<WaitingTileInfo[]>(() => {
    const view = this.snapshot()?.view;
    if (!view || view.rules.showHints === false || !this.hintsEnabled()) return [];
    const me = view.players.at(view.viewerSeat);
    if (!me?.hand || me.hand.length % 3 !== 1) return [];
    return getWaitingTiles({
      handIds: me.hand,
      melds: me.melds,
      bonusIds: me.bonus,
      mode: view.mode,
      seatWind: me.seatWind,
      roundWind: view.roundWind,
      rules: view.rules,
    });
  });

  playClack(freq = 620): void {
    if (!this.soundEnabled() || typeof window === 'undefined') return;
    try {
      const win = window as WindowWithWebkitAudio;
      const Ctx = globalThis.AudioContext ?? win.webkitAudioContext;
      if (!Ctx) return;
      const ctx = this.audioCtx ?? new Ctx();
      this.audioCtx = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.055);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.065);
    } catch {
      // Ignore autoplay restrictions prior to user gesture
    }
  }

  speakCallout(text: string): void {
    if (!this.soundEnabled() || typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();
      const hkVoice =
        voices.find((v) => v.lang?.toLowerCase().includes('hk')) ??
        voices.find((v) => v.lang?.toLowerCase().includes('zh'));
      if (hkVoice) u.voice = hkVoice;
      u.lang = 'zh-HK';
      u.rate = 1.15;
      speechSynthesis.speak(u);
    } catch {
      // Ignore speech synthesis unavailable errors
    }
  }

  private attach(session: HostSession | GuestSession): void {
    this.session?.destroy();
    this.session = session;
    session.onUpdate((snap) => {
      const newestLog = snap.view?.log.at(-1) ?? '';
      if (newestLog && newestLog !== this.lastLogSeen) {
        this.lastLogSeen = newestLog;
        if (newestLog.includes('自摸')) this.speakCallout('自摸');
        else if (newestLog.includes('食糊')) this.speakCallout('食糊');
        else if (newestLog.includes('槓')) this.speakCallout('槓');
        else if (newestLog.includes('碰')) this.speakCallout('碰');
        else if (newestLog.includes('上 ')) this.speakCallout('上');
        else if (newestLog.includes('打飛')) this.speakCallout('打飛');
        else this.playClack(580);
      }
      this.snapshot.set(snap);
      this.syncBgm(Boolean(snap.view));

      if (snap.view) {
        void this.router.navigate(['/table']);
      } else {
        void this.router.navigate(['/lobby']);
      }
    });
  }

  startSolo(hostName: string, mode: GameMode, rules: GameRules): void {
    this.playClack(700);
    this.hintsEnabled.set(rules.showHints !== false);
    const host = new HostSession({ hostName, mode, online: false, fillBots: true, rules });
    this.attach(host);
    host.startGame();
  }

  createOnlineRoom(hostName: string, mode: GameMode, rules: GameRules): void {
    this.hintsEnabled.set(rules.showHints !== false);
    const host = new HostSession({ hostName, mode, online: true, fillBots: false, rules });
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `${window.location.pathname}?room=${host.roomCode}`);
    }
    this.attach(host);
  }

  joinOnlineRoom(roomCode: string, guestName: string, enableHints = true): void {
    const code = roomCode.trim().toUpperCase();
    if (!code) return;
    this.hintsEnabled.set(enableHints);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `${window.location.pathname}?room=${code}`);
    }
    this.attach(new GuestSession({ roomCode: code, guestName }));
  }

  setLobbyMode(mode: GameMode): void {
    if (this.session?.role === 'host') this.session.setMode(mode);
  }

  toggleSeatBot(seatIdx: number): void {
    if (this.session?.role === 'host') this.session.toggleSeatBot(seatIdx);
  }

  updateLobbyRules(partial: Partial<GameRules>): void {
    if (this.session?.role === 'host') this.session.updateRules(partial);
  }

  startMatch(): void {
    if (this.session?.role === 'host') {
      this.playClack(700);
      this.session.startGame();
    }
  }

  nextHand(): void {
    if (this.session?.role === 'host') {
      this.playClack(700);
      this.session.nextHand();
    }
  }

  returnToLobby(): void {
    if (this.session?.role === 'host') this.session.returnToLobby();
  }

  leaveSession(): void {
    this.session?.destroy();
    this.session = null;
    this.lastLogSeen = '';
    this.snapshot.set(null);
    this.syncBgm(false);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', window.location.pathname);
      window.dispatchEvent(new CustomEvent('mahjong:leave'));
    }
    void this.router.navigate(['/lobby']);
  }

  sendAction(action: GameAction): void {
    this.playClack(action.type === 'discard' ? 640 : 740);
    this.syncBgm(Boolean(this.snapshot()?.view));
    this.session?.sendAction(action);
  }

  async copyInviteLink(): Promise<void> {
    const code = this.snapshot()?.roomCode;
    if (!code || typeof window === 'undefined') return;
    const url = new URL(`?room=${code}`, document.baseURI).toString();
    try {
      await navigator.clipboard.writeText(url);
      this.copiedToast.set(true);
      setTimeout(() => this.copiedToast.set(false), 1800);
    } catch {
      window.prompt('Copy invite link:', url);
    }
  }
}
