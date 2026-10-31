import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ClaimSeatEntry,
  GameAction,
  GameMode,
  GameRules,
  LobbySeat,
  MatchState,
  PublicLobby,
  RobKongSeatEntry,
  SessionSnapshot,
  WaitingTileInfo,
} from '../models/mahjong.model';
import { windLabel } from '../utils/tiles.util';
import { chooseBotAction } from './bot.service';
import { applyAction, createMatch, getPlayerView, startNewHand } from './engine.service';
import { DEFAULT_RULES, getWaitingTiles } from './scorer.service';
import { ShellUiService } from './shell-ui.service';

export interface SerializedMahjongSave {
  lobby: PublicLobby;
  match: Omit<MatchState, 'pendingRobKong' | 'pendingClaims'> & {
    pendingRobKong: {
      seat: number;
      meldIdx: number;
      tileId: string;
      bySeatEntries: [number, RobKongSeatEntry][];
    } | null;
    pendingClaims: {
      fromSeat: number;
      tileId: string;
      bySeatEntries: [number, ClaimSeatEntry][];
    } | null;
  };
}

const PEER_PREFIX = 'hkmj-v1-room-';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BOT_NAMES: readonly string[] = ['阿发 (Bot)', '十三姨 (Bot)', '雀神强 (Bot)', '六婶 (Bot)'];

const PEER_OPTIONS = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  secure: true,
  pingInterval: 5000,
  config: {
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun.cloudflare.com:3478',
        ],
      },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp',
          'turns:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
  },
};

interface PeerConnectionLike {
  readonly open: boolean;
  send(data: unknown): void;
  on(event: string, cb: (arg?: unknown) => void): void;
  close?(): void;
}

interface PeerErrorLike {
  readonly type?: string;
}

interface PeerInstanceLike {
  readonly disconnected?: boolean;
  readonly destroyed?: boolean;
  connect(
    id: string,
    opts?: { reliable?: boolean; serialization?: string }
  ): PeerConnectionLike;
  on(event: string, cb: (arg?: unknown) => void): void;
  reconnect?(): void;
  destroy(): void;
}

type PeerConstructorLike = new (
  idOrOpts?: string | Record<string, unknown>,
  opts?: Record<string, unknown>
) => PeerInstanceLike;

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}

function sendConnSafe(conn: PeerConnectionLike, payload: unknown): void {
  if (conn.open) {
    conn.send(payload);
    return;
  }
  let sent = false;
  conn.on('open', () => {
    if (!sent) {
      sent = true;
      conn.send(payload);
    }
  });
}

function createRandomToken(prefix: string): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  return `${prefix}_${suffix}`;
}

export function extractRoomCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const paramMatch = /[?&]room=([A-Za-z0-9]+)/i.exec(trimmed);
  if (paramMatch?.at(1)) {
    return (paramMatch.at(1) ?? '').slice(0, 8).toUpperCase();
  }
  return trimmed.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
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
        tok = createRandomToken('tok');
        sessionStorage.setItem('hkmj_player_token', tok);
      }
      return tok;
    }
  } catch {
    // Fallback in non-browser test environments
  }
  return createRandomToken('tok');
}

function getGuestToken(roomCode: string): string {
  const key = `hkmj_guest_token_${roomCode}`;
  try {
    if (typeof sessionStorage !== 'undefined') {
      let tok = sessionStorage.getItem(key);
      if (!tok) {
        tok = createRandomToken('guest');
        sessionStorage.setItem(key, tok);
      }
      return tok;
    }
  } catch {
    // Fallback in restricted storage environments
  }
  return createRandomToken('guest');
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
      name: '等待好友加入…',
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
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private visibilityHandler: (() => void) | null = null;
  private destroyed = false;

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
    this.myToken = token ?? createRandomToken('host');
    this.status = online ? '正在建立 P2P 房间…' : '单机模式就绪';

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
    this.destroyed = true;
    clearTimeout(this.botTimer);
    clearTimeout(this.reconnectTimer);
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.bc?.close();
    this.peer?.destroy();
  }

  private tryReconnectSignaling(): void {
    if (this.destroyed || !this.peer || this.peer.destroyed) return;
    if (this.peer.disconnected && typeof this.peer.reconnect === 'function') {
      try {
        this.peer.reconnect();
      } catch {
        // Ignore transient signaling reconnect errors
      }
    }
  }

  private async initTransports(): Promise<void> {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(`hkmj-bc-${this.roomCode}`);
      this.bc.onmessage = (ev: MessageEvent) => {
        if (this.destroyed || !isRecord(ev.data) || ev.data['to'] === 'guest') return;
        const senderToken = typeof ev.data['token'] === 'string' ? ev.data['token'] : '';
        this.handleClientMessage(ev.data, (reply) => {
          this.bc?.postMessage({ ...reply, to: 'guest', targetToken: senderToken });
        });
      };
    }

    if (typeof RTCPeerConnection === 'undefined') {
      this.status = `房号 ${this.roomCode} 已开启（本机通道就绪）`;
      this.broadcastAll();
      return;
    }

    try {
      const PeerCtor = await loadPeerClass();
      if (this.destroyed) return;
      const peer = new PeerCtor(`${PEER_PREFIX}${this.roomCode}`, PEER_OPTIONS);
      this.peer = peer;

      if (typeof document !== 'undefined') {
        this.visibilityHandler = () => {
          if (document.visibilityState === 'visible') {
            this.tryReconnectSignaling();
          }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);
      }

      peer.on('open', () => {
        if (this.destroyed) return;
        this.status = `房号 ${this.roomCode} 已开启（WebRTC P2P 就绪）`;
        this.broadcastAll();
      });

      peer.on('disconnected', () => {
        if (this.destroyed) return;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.tryReconnectSignaling(), 600);
      });

      peer.on('connection', (rawConn: unknown) => {
        if (this.destroyed) return;
        const conn = rawConn as PeerConnectionLike;
        conn.on('data', (rawMsg: unknown) => {
          if (this.destroyed || !isRecord(rawMsg)) return;
          const tok = typeof rawMsg['token'] === 'string' ? rawMsg['token'] : '';
          if (tok) this.peerConns.set(tok, conn);
          this.handleClientMessage(rawMsg, (reply) => {
            sendConnSafe(conn, reply);
          });
        });

        conn.on('close', () => {
          for (const [tok, c] of this.peerConns.entries()) {
            if (c === conn) {
              this.peerConns.delete(tok);
              const seatObj = this.lobby.seats.find((s) => s.seat > 0 && s.token === tok);
              if (seatObj) {
                seatObj.connected = false;
                this.broadcastAll();
              }
            }
          }
        });
      });

      peer.on('error', (rawErr: unknown) => {
        if (this.destroyed) return;
        const err = rawErr as PeerErrorLike | undefined;
        if (err?.type === 'network') {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this.tryReconnectSignaling(), 800);
          return;
        }
        this.status = `本机分页连接就绪（外部信令离线：${err?.type ?? 'offline'}）`;
        this.broadcastAll();
      });
    } catch {
      if (this.destroyed) return;
      this.status = '离线局域模式（支持同浏览器多分页或电脑对战）';
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
    if (!token || token === this.myToken) return;

    if (type === 'join') {
      const existing = this.lobby.seats.find(
        (s) => s.seat > 0 && s.kind === 'human' && s.token === token
      );
      if (existing) {
        existing.connected = true;
        if (name.trim()) existing.name = name.trim();
        this.broadcastAll();
        return;
      }

      if (this.lobby.started) {
        replyFn({ type: 'error', message: '牌局已经开始，无法中途加入新座位。' });
        return;
      }

      const targetSeat =
        this.lobby.seats.find((s) => s.seat > 0 && s.kind === 'open') ??
        this.lobby.seats.find((s) => s.seat > 0 && s.kind === 'bot');
      if (!targetSeat) {
        replyFn({ type: 'error', message: '房间座位已满！请房主释放座位。' });
        return;
      }

      targetSeat.kind = 'human';
      targetSeat.name = name.trim() || `雀友 ${targetSeat.seat + 1}`;
      targetSeat.token = token;
      targetSeat.connected = true;
      this.broadcastAll();
      return;
    }

    if (type === 'action' && this.match && isRecord(msg['action'])) {
      const seatObj = this.lobby.seats.find(
        (s) => s.seat > 0 && s.kind === 'human' && s.token === token
      );
      if (!seatObj) return;
      try {
        applyAction(this.match, seatObj.seat, msg['action'] as unknown as GameAction);
        this.broadcastAll();
        this.scheduleBots();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : '非法操作';
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
      s.name = '等待好友加入…';
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
      this.error = '仍有空位等待好友加入！请等待好友进房，或点击空位切换为「电脑 Bot」。';
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

  resumeRestoredMatch(lobby: PublicLobby, match: MatchState): void {
    this.error = null;
    this.lobby = lobby;
    this.match = match;
    this.broadcastAll();
    this.scheduleBots();
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
      this.error = e instanceof Error ? e.message : '操作失败';
      this.broadcastAll();
    }
  }

  private scheduleBots(): void {
    clearTimeout(this.botTimer);
    if (!this.match || this.match.phase === 'handOver') return;

    if (this.match.phase === 'claim' || this.match.phase === 'robKong') {
      const pendingBots: Array<{ seat: number; act: GameAction }> = [];
      for (let s = 0; s < this.match.numSeats; s++) {
        if (this.lobby.seats.at(s)?.kind !== 'bot') continue;
        const botView = getPlayerView(this.match, s);
        if (!botView.legalActions) continue;
        const act = chooseBotAction(botView);
        if (act) pendingBots.push({ seat: s, act });
      }
      if (pendingBots.length === 0) return;

      const allPass = pendingBots.every((b) => b.act.type === 'pass');
      const delay = allPass ? 90 : 340;
      this.botTimer = setTimeout(() => {
        if (!this.match || this.match.phase === 'handOver') return;
        let changed = false;
        for (const { seat } of pendingBots) {
          if (!this.match) break;
          const curPhase: string = this.match.phase;
          if (curPhase !== 'claim' && curPhase !== 'robKong') break;
          const freshView = getPlayerView(this.match, seat);
          if (!freshView.legalActions) continue;
          const freshAct = chooseBotAction(freshView);
          if (freshAct) {
            applyAction(this.match, seat, freshAct);
            changed = true;
          }
        }
        if (changed) this.broadcastAll();
        this.scheduleBots();
      }, delay);
      return;
    }

    const turnSeat = this.match.turnSeat;
    if (this.lobby.seats.at(turnSeat)?.kind !== 'bot') return;
    const botView = getPlayerView(this.match, turnSeat);
    if (!botView.legalActions) return;

    this.botTimer = setTimeout(() => {
      if (!this.match || this.match.phase !== 'turn' || this.match.turnSeat !== turnSeat) {
        this.scheduleBots();
        return;
      }
      const freshView = getPlayerView(this.match, turnSeat);
      if (!freshView.legalActions) return;
      const freshAct = chooseBotAction(freshView);
      if (freshAct) {
        applyAction(this.match, turnSeat, freshAct);
        this.broadcastAll();
      }
      this.scheduleBots();
    }, 380);
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
      if (conn) sendConnSafe(conn, payload);
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
  private destroyed = false;
  private joinRetryTimer: ReturnType<typeof setInterval> | undefined;
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | undefined;
  private peerRetryTimer: ReturnType<typeof setTimeout> | undefined;
  private unavailableRetries = 0;

  constructor({
    roomCode,
    guestName = '雀友',
    token,
  }: {
    roomCode: string;
    guestName?: string;
    token?: string;
  }) {
    this.roomCode = extractRoomCode(roomCode);
    this.guestName = guestName.trim() || '雀友';
    this.myToken = token ?? getGuestToken(this.roomCode);
    this.snapshot = {
      role: 'guest',
      online: true,
      roomCode: this.roomCode,
      status: `正在连接至房间 ${this.roomCode}…`,
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
    this.destroyed = true;
    clearInterval(this.joinRetryTimer);
    clearTimeout(this.connectTimeoutTimer);
    clearTimeout(this.peerRetryTimer);
    this.bc?.close();
    this.peer?.destroy();
  }

  private emit(): void {
    if (this.destroyed) return;
    for (const fn of this.listeners) fn(this.snapshot);
  }

  private clearHandshakeTimers(): void {
    clearInterval(this.joinRetryTimer);
    clearTimeout(this.connectTimeoutTimer);
    clearTimeout(this.peerRetryTimer);
  }

  private openHostConnection(peer: PeerInstanceLike): void {
    if (this.destroyed || this.connectedViaBc) return;
    this.conn?.close?.();
    const conn = peer.connect(`${PEER_PREFIX}${this.roomCode}`, {
      reliable: true,
      serialization: 'json',
    });
    this.conn = conn;

    const sendJoin = () => {
      if (this.destroyed || this.snapshot.mySeat >= 0) return;
      const joinMsg = { type: 'join', token: this.myToken, name: this.guestName };
      sendConnSafe(conn, joinMsg);
    };

    conn.on('open', () => {
      if (this.destroyed) return;
      sendJoin();
      clearInterval(this.joinRetryTimer);
      let attempts = 0;
      this.joinRetryTimer = setInterval(() => {
        attempts++;
        if (this.destroyed || this.snapshot.mySeat >= 0 || this.snapshot.error || attempts > 6) {
          clearInterval(this.joinRetryTimer);
          return;
        }
        sendJoin();
      }, 1400);
    });

    conn.on('data', (rawMsg: unknown) => {
      if (this.destroyed || !isRecord(rawMsg)) return;
      if (rawMsg['type'] === 'sync' && isRecord(rawMsg['snapshot'])) {
        this.clearHandshakeTimers();
        this.snapshot = {
          ...(rawMsg['snapshot'] as unknown as SessionSnapshot),
          error: null,
          status: `已连接至房间 ${this.roomCode}`,
        };
        this.emit();
      } else if (rawMsg['type'] === 'error') {
        this.clearHandshakeTimers();
        this.snapshot = {
          ...this.snapshot,
          error: typeof rawMsg['message'] === 'string' ? rawMsg['message'] : '连接错误',
        };
        this.emit();
      }
    });

    conn.on('error', () => {
      if (this.destroyed || this.connectedViaBc) return;
      this.clearHandshakeTimers();
      this.snapshot = {
        ...this.snapshot,
        error: `与房主建立 WebRTC 通道失败（房号 ${this.roomCode}），请房主保持页面开启后重试。`,
      };
      this.emit();
    });

    conn.on('close', () => {
      if (this.destroyed || this.connectedViaBc) return;
      this.clearHandshakeTimers();
      this.snapshot = { ...this.snapshot, status: '与房主连接中断，请刷新页面重连。' };
      this.emit();
    });
  }

  private async connect(): Promise<void> {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(`hkmj-bc-${this.roomCode}`);
      this.bc.onmessage = (ev: MessageEvent) => {
        if (this.destroyed || !isRecord(ev.data)) return;
        if (ev.data['to'] !== 'guest' || ev.data['targetToken'] !== this.myToken) return;
        if (ev.data['type'] === 'sync' && isRecord(ev.data['snapshot'])) {
          this.connectedViaBc = true;
          this.clearHandshakeTimers();
          this.snapshot = {
            ...(ev.data['snapshot'] as unknown as SessionSnapshot),
            error: null,
            status: `已连接至房间 ${this.roomCode}`,
          };
          this.emit();
        } else if (ev.data['type'] === 'error') {
          this.clearHandshakeTimers();
          this.snapshot = {
            ...this.snapshot,
            error: typeof ev.data['message'] === 'string' ? ev.data['message'] : '连接错误',
          };
          this.emit();
        }
      };
      this.bc.postMessage({ type: 'join', token: this.myToken, name: this.guestName });
    }

    await new Promise<void>((r) => setTimeout(r, 120));
    if (this.destroyed || this.connectedViaBc || typeof RTCPeerConnection === 'undefined') return;

    this.connectTimeoutTimer = setTimeout(() => {
      if (this.destroyed || this.connectedViaBc || this.snapshot.mySeat >= 0 || this.snapshot.error) {
        return;
      }
      this.clearHandshakeTimers();
      this.snapshot = {
        ...this.snapshot,
        error: `连接超时：找不到房号 ${this.roomCode} 或网络防火墙阻挡，请确认房主仍在等候室后再试。`,
      };
      this.emit();
    }, 15000);

    try {
      const PeerCtor = await loadPeerClass();
      if (this.destroyed || this.connectedViaBc) return;
      const peer = new PeerCtor(PEER_OPTIONS);
      this.peer = peer;

      peer.on('open', () => {
        this.openHostConnection(peer);
      });

      peer.on('error', (rawErr: unknown) => {
        if (this.destroyed || this.connectedViaBc) return;
        const err = rawErr as PeerErrorLike | undefined;
        if (err?.type === 'peer-unavailable' && this.unavailableRetries < 2) {
          this.unavailableRetries += 1;
          clearTimeout(this.peerRetryTimer);
          this.peerRetryTimer = setTimeout(() => this.openHostConnection(peer), 1500);
          return;
        }
        this.clearHandshakeTimers();
        this.snapshot = {
          ...this.snapshot,
          error: `无法连接至房号 ${this.roomCode}（${err?.type ?? '请确认房号是否正确'}）`,
        };
        this.emit();
      });
    } catch {
      if (this.destroyed || this.connectedViaBc) return;
      this.clearHandshakeTimers();
      this.snapshot = { ...this.snapshot, error: '加载 P2P 连接模块失败，请检查网络连接。' };
      this.emit();
    }
  }

  sendAction(action: GameAction): void {
    const payload = { type: 'action', token: this.myToken, action };
    if (this.connectedViaBc && this.bc) {
      this.bc.postMessage(payload);
    } else if (this.conn) {
      sendConnSafe(this.conn, payload);
    }
  }
}

@Injectable({ providedIn: 'root' })
export class MahjongSessionService {
  private readonly router = inject(Router);
  private readonly shellUi = inject(ShellUiService);

  readonly snapshot = signal<SessionSnapshot | null>(null);
  readonly soundEnabled = this.shellUi.soundEnabled;
  readonly bgmEnabled = this.shellUi.bgmEnabled;
  readonly hintsEnabled = signal<boolean>(true);
  readonly autoPass = signal<boolean>(false);
  readonly selectionPaused = signal<boolean>(false);
  readonly showRulebook = this.shellUi.showRulebookModal;
  readonly copiedToast = this.shellUi.copiedToast;

  private session: HostSession | GuestSession | null = null;
  private audioCtx: AudioContext | null = null;
  private autoPassTimer: ReturnType<typeof setTimeout> | undefined;
  private lastLogSeen = '';

  toggleBgm(): void {
    this.shellUi.toggleBgm();
  }

  toggleAutoPass(enabled?: boolean): void {
    const next = enabled !== undefined ? enabled : !this.autoPass();
    this.autoPass.set(next);
    if (next) {
      this.scheduleAutoPassIfNeeded(this.snapshot());
    } else {
      clearTimeout(this.autoPassTimer);
    }
  }

  private scheduleAutoPassIfNeeded(snap: SessionSnapshot | null): void {
    clearTimeout(this.autoPassTimer);
    if (!this.autoPass() || this.selectionPaused() || !snap?.view) return;
    const legal = snap.view.legalActions;
    if (!legal || (legal.phase !== 'claim' && legal.phase !== 'robKong')) return;

    this.autoPassTimer = setTimeout(() => {
      const cur = this.snapshot();
      const curLegal = cur?.view?.legalActions;
      if (
        this.autoPass() &&
        !this.selectionPaused() &&
        curLegal &&
        (curLegal.phase === 'claim' || curLegal.phase === 'robKong')
      ) {
        this.session?.sendAction({ type: 'pass' });
      }
    }, 120);
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

  playPenaltyBuzzer(): void {
    if (!this.soundEnabled() || typeof window === 'undefined') return;
    try {
      const win = window as WindowWithWebkitAudio;
      const Ctx = globalThis.AudioContext ?? win.webkitAudioContext;
      if (!Ctx) return;
      const ctx = this.audioCtx ?? new Ctx();
      this.audioCtx = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(125, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
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
    clearTimeout(this.autoPassTimer);
    this.session?.destroy();
    this.session = session;
    session.onUpdate((snap) => {
      const newestLog = snap.view?.log.at(-1) ?? '';
      if (newestLog && newestLog !== this.lastLogSeen) {
        this.lastLogSeen = newestLog;
        if (newestLog.startsWith('⚠️')) {
          this.playPenaltyBuzzer();
          this.speakCallout(
            newestLog.includes('詐糊') || newestLog.includes('诈糊') ? '詐糊' : '錯章'
          );
        } else if (newestLog.includes('自摸')) this.speakCallout('自摸');
        else if (newestLog.includes('食糊') || newestLog.includes('食胡')) this.speakCallout('食糊');
        else if (newestLog.includes('槓') || newestLog.includes('杠')) this.speakCallout('槓');
        else if (newestLog.includes('碰')) this.speakCallout('碰');
        else if (newestLog.includes('上 ')) this.speakCallout('上');
        else if (newestLog.includes('打飛') || newestLog.includes('打飞')) this.speakCallout('打飛');
        else if (newestLog.includes('換飛') || newestLog.includes('换飞')) this.speakCallout('換飛');
        else this.playClack(580);
      }

      if (snap.view?.phase === 'handOver') {
        this.autoPass.set(false);
        this.selectionPaused.set(false);
      }

      this.snapshot.set(snap);
      this.shellUi.setActiveGame('mahjong');
      if (snap.online && snap.roomCode && snap.roomCode !== 'LOCAL') {
        this.shellUi.setActiveRoomCode(snap.roomCode);
      } else if (!snap.online) {
        this.shellUi.setActiveRoomCode(null);
      }
      this.scheduleAutoPassIfNeeded(snap);

      const queryParams = snap.online && snap.roomCode ? { room: snap.roomCode } : {};
      if (snap.view) {
        void this.router.navigate(['/table'], { queryParams, replaceUrl: true });
      } else {
        void this.router.navigate(['/lobby'], { queryParams, replaceUrl: true });
      }
    });
  }

  startSolo(hostName: string, mode: GameMode, rules: GameRules): void {
    this.playClack(700);
    this.autoPass.set(false);
    this.selectionPaused.set(false);
    this.hintsEnabled.set(rules.showHints !== false);
    const host = new HostSession({ hostName, mode, online: false, fillBots: true, rules });
    this.attach(host);
    host.startGame();
  }

  createOnlineRoom(hostName: string, mode: GameMode, rules: GameRules): void {
    this.autoPass.set(false);
    this.selectionPaused.set(false);
    this.hintsEnabled.set(rules.showHints !== false);
    const host = new HostSession({ hostName, mode, online: true, fillBots: false, rules });
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `${window.location.pathname}?room=${host.roomCode}`);
    }
    this.attach(host);
  }

  joinOnlineRoom(roomCode: string, guestName: string, enableHints = true): void {
    const code = extractRoomCode(roomCode);
    if (!code) return;
    this.autoPass.set(false);
    this.selectionPaused.set(false);
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

  terminateSession(): void {
    clearTimeout(this.autoPassTimer);
    this.autoPass.set(false);
    this.selectionPaused.set(false);
    this.session?.destroy();
    this.session = null;
    this.lastLogSeen = '';
    this.snapshot.set(null);
    this.shellUi.setActiveRoomCode(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', window.location.pathname);
      window.dispatchEvent(new CustomEvent('mahjong:leave'));
      window.dispatchEvent(new CustomEvent('p2p:leave'));
    }
  }

  leaveSession(): void {
    this.terminateSession();
    void this.router.navigate(['/lobby'], { queryParams: {}, replaceUrl: true });
  }

  canExportSave(): boolean {
    return this.session?.role === 'host' && this.session.match !== null;
  }

  exportSaveData(): SerializedMahjongSave | null {
    if (this.session?.role !== 'host' || !this.session.match) return null;
    const match = this.session.match;
    const raw: SerializedMahjongSave = {
      lobby: {
        mode: this.session.lobby.mode,
        rules: { ...this.session.lobby.rules },
        started: true,
        seats: this.session.lobby.seats.map((s) => ({ ...s, token: null })),
      },
      match: {
        mode: match.mode,
        numSeats: match.numSeats,
        rules: { ...match.rules },
        roundWind: match.roundWind,
        dealerSeat: match.dealerSeat,
        dealerStreak: match.dealerStreak,
        handNumber: match.handNumber,
        scores: [...match.scores],
        phase: match.phase,
        wall: [...match.wall],
        turnSeat: match.turnSeat,
        canSelfAct: match.canSelfAct,
        kongReplacement: match.kongReplacement,
        isFirstGoAround: match.isFirstGoAround,
        turnsTaken: [...match.turnsTaken],
        lastDiscard: match.lastDiscard ? { ...match.lastDiscard } : null,
        lastPenalty: match.lastPenalty ? { ...match.lastPenalty } : null,
        discardPool: [...match.discardPool],
        pendingRobKong: match.pendingRobKong
          ? {
              seat: match.pendingRobKong.seat,
              meldIdx: match.pendingRobKong.meldIdx,
              tileId: match.pendingRobKong.tileId,
              bySeatEntries: Array.from(match.pendingRobKong.bySeat.entries()),
            }
          : null,
        pendingClaims: match.pendingClaims
          ? {
              fromSeat: match.pendingClaims.fromSeat,
              tileId: match.pendingClaims.tileId,
              bySeatEntries: Array.from(match.pendingClaims.bySeat.entries()),
            }
          : null,
        players: match.players,
        log: [...match.log],
        result: match.result,
      },
    };
    return JSON.parse(JSON.stringify(raw)) as SerializedMahjongSave;
  }

  restoreSaveData(saved: SerializedMahjongSave): boolean {
    if (!saved?.lobby || !saved?.match) return false;
    this.terminateSession();
    const cloned = JSON.parse(JSON.stringify(saved)) as SerializedMahjongSave;
    const hostName = cloned.lobby.seats.at(0)?.name || this.shellUi.playerNickname() || '房主';
    const host = new HostSession({
      hostName,
      mode: cloned.lobby.mode,
      online: false,
      fillBots: true,
      rules: cloned.lobby.rules,
    });

    const restoredSeats: LobbySeat[] = cloned.lobby.seats.map((s, idx) => {
      if (idx === 0) {
        return {
          seat: 0,
          kind: 'human',
          name: s.name || hostName,
          token: host.myToken,
          connected: true,
          windLabel: s.windLabel || windLabel(0),
        };
      }
      return {
        seat: idx,
        kind: 'bot',
        name: s.name || BOT_NAMES.at((idx - 1) % BOT_NAMES.length) || 'Bot',
        token: `bot_${idx}`,
        connected: true,
        windLabel: s.windLabel || windLabel(idx),
      };
    });

    const restoredLobby: PublicLobby = {
      mode: cloned.lobby.mode,
      rules: { ...DEFAULT_RULES, ...cloned.lobby.rules },
      started: true,
      seats: restoredSeats,
    };

    const { pendingRobKong, pendingClaims, ...restMatch } = cloned.match;
    const restoredMatch: MatchState = {
      ...restMatch,
      pendingRobKong: pendingRobKong
        ? {
            seat: pendingRobKong.seat,
            meldIdx: pendingRobKong.meldIdx,
            tileId: pendingRobKong.tileId,
            bySeat: new Map<number, RobKongSeatEntry>(pendingRobKong.bySeatEntries),
          }
        : null,
      pendingClaims: pendingClaims
        ? {
            fromSeat: pendingClaims.fromSeat,
            tileId: pendingClaims.tileId,
            bySeat: new Map<number, ClaimSeatEntry>(pendingClaims.bySeatEntries),
          }
        : null,
    };

    this.autoPass.set(false);
    this.selectionPaused.set(false);
    this.hintsEnabled.set(restoredLobby.rules.showHints !== false);
    this.attach(host);
    host.resumeRestoredMatch(restoredLobby, restoredMatch);
    return true;
  }

  sendAction(action: GameAction): void {
    this.playClack(action.type === 'discard' ? 640 : 740);
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
