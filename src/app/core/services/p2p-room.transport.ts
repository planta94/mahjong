import { Injectable } from '@angular/core';
import {
  GameId,
  GamePrefix,
  GenericLobby,
  GenericSeat,
  GenericSessionSnapshot,
  PREFIX_TO_GAME_MAP,
  UniversalRoomInfo,
} from '../models/party.model';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PEER_ID_PREFIX = 'party-pavilion-v1-';

export const PEER_OPTIONS = {
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

export interface PeerConnectionLike {
  readonly open: boolean;
  send(data: unknown): void;
  on(event: string, cb: (arg?: unknown) => void): void;
  close?(): void;
}

export interface PeerErrorLike {
  readonly type?: string;
}

export interface PeerInstanceLike {
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

export type PeerConstructorLike = new (
  idOrOpts?: string | Record<string, unknown>,
  opts?: Record<string, unknown>
) => PeerInstanceLike;

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}

export function sendConnSafe(conn: PeerConnectionLike, payload: unknown): void {
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

export function createRandomToken(prefix: string): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  return `${prefix}_${suffix}`;
}

export function generatePrefixedRoomCode(prefix: GamePrefix, len = 5): string {
  let out = prefix;
  for (let i = 0; i < len; i++) {
    const ch = CODE_ALPHABET.at(Math.floor(Math.random() * CODE_ALPHABET.length)) ?? 'A';
    out += ch;
  }
  return out;
}

export function parseUniversalRoomCode(input: string): UniversalRoomInfo {
  const trimmed = input.trim();
  if (!trimmed) {
    return { game: 'mahjong', roomCode: '' };
  }

  // 1. Check URL parameters (?game=...&room=... or ?room=...)
  const isUrl = trimmed.includes('?') || trimmed.includes('/');
  const gameMatch = /[?&]game=([a-z]+)/i.exec(trimmed);
  const roomMatch = /[?&]room=([A-Za-z0-9]+)/i.exec(trimmed);

  const rawCode = (
    isUrl
      ? (roomMatch?.at(1) ?? '')
      : trimmed.replace(/[^A-Za-z0-9]/g, '')
  ).toUpperCase();
  const roomCode = rawCode.slice(0, 8);

  const matchedGame = gameMatch?.at(1)?.toLowerCase();
  if (matchedGame === 'monopoly' || matchedGame === 'avalon' || matchedGame === 'mahjong') {
    return { game: matchedGame, roomCode };
  }

  // 2. Prefix-based resolution: 'M' -> mahjong, 'P' -> monopoly, 'A' -> avalon
  const firstChar = roomCode.charAt(0) as GamePrefix;
  const gameFromPrefix = PREFIX_TO_GAME_MAP.get(firstChar);
  if (gameFromPrefix) {
    return { game: gameFromPrefix, roomCode };
  }

  // 3. Backward-compatibility fallback: legacy codes without prefix route to mahjong
  return { game: 'mahjong', roomCode };
}

export function getPartyGuestToken(roomCode: string): string {
  const key = `party_guest_token_${roomCode}`;
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
    // Non-browser or restricted environment
  }
  return createRandomToken('guest');
}

export function updateBrowserUrlWithRoom(roomCode: string, game?: GameId): void {
  if (typeof window === 'undefined' || !window.history || !window.location) return;
  const path = window.location.pathname;
  const query = game ? `?game=${game}&room=${roomCode}` : `?room=${roomCode}`;
  window.history.replaceState({}, '', `${path}${query}`);
}

export function clearBrowserUrlRoom(): void {
  if (typeof window === 'undefined' || !window.history || !window.location) return;
  window.history.replaceState({}, '', window.location.pathname);
}

export function dispatchP2pLeaveEvent(roomCode?: string, game?: GameId): void {
  if (typeof window === 'undefined') return;
  clearBrowserUrlRoom();
  window.dispatchEvent(
    new CustomEvent('p2p:leave', {
      detail: { roomCode: roomCode ?? '', game: game ?? 'hub' },
    })
  );
  window.dispatchEvent(new CustomEvent('mahjong:leave'));
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

export interface GenericHostOptions<TState, TView, TAction> {
  gamePrefix: GamePrefix;
  roomCode?: string;
  hostName?: string;
  online?: boolean;
  token?: string;
  initialState: TState;
  initialLobby: GenericLobby;
  buildPlayerView: (state: TState, seatIdx: number) => TView;
  applyAction: (state: TState, seatIdx: number, action: TAction) => void;
  onSeatConnectedChange?: (seatIdx: number, connected: boolean) => void;
}

export class GenericHostSession<TState, TView, TAction> {
  readonly role = 'host' as const;
  readonly online: boolean;
  readonly roomCode: string;
  readonly myToken: string;
  readonly mySeat = 0;
  status: string;
  error: string | null = null;
  state: TState;
  lobby: GenericLobby;

  private readonly listeners = new Set<(snap: GenericSessionSnapshot<TView>) => void>();
  private peer: PeerInstanceLike | null = null;
  private readonly peerConns = new Map<string, PeerConnectionLike>();
  private bc: BroadcastChannel | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private visibilityHandler: (() => void) | null = null;
  private destroyed = false;

  private readonly buildPlayerView: (state: TState, seatIdx: number) => TView;
  private readonly applyActionFn: (state: TState, seatIdx: number, action: TAction) => void;
  private readonly onSeatConnectedChange?: (seatIdx: number, connected: boolean) => void;

  constructor(opts: GenericHostOptions<TState, TView, TAction>) {
    this.online = opts.online ?? false;
    this.roomCode = opts.roomCode ?? (this.online ? generatePrefixedRoomCode(opts.gamePrefix) : 'LOCAL');
    this.myToken = opts.token ?? createRandomToken('host');
    this.status = this.online ? '正在建立 P2P 房间…' : '单机模式就绪';
    this.state = opts.initialState;
    this.lobby = opts.initialLobby;
    this.buildPlayerView = opts.buildPlayerView;
    this.applyActionFn = opts.applyAction;
    this.onSeatConnectedChange = opts.onSeatConnectedChange;

    // Ensure host seat is configured
    const hostSeat = this.lobby.seats.at(0);
    if (hostSeat) {
      hostSeat.kind = 'human';
      hostSeat.name = opts.hostName?.trim() || hostSeat.name || '房主';
      hostSeat.token = this.myToken;
      hostSeat.connected = true;
    }

    if (this.online) {
      void this.initTransports();
    }
  }

  onUpdate(fn: (snap: GenericSessionSnapshot<TView>) => void): () => void {
    this.listeners.add(fn);
    fn(this.buildSnapshotForSeat(0));
    return () => this.listeners.delete(fn);
  }

  destroy(): void {
    this.destroyed = true;
    clearTimeout(this.reconnectTimer);
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.bc?.close();
    this.peer?.destroy();
  }

  buildSnapshotForSeat(seatIdx: number): GenericSessionSnapshot<TView> {
    const sanitizedSeats: GenericSeat[] = this.lobby.seats.map((s) => ({
      ...s,
      token: null, // Critical security rule: strip seat authentication tokens
    }));

    return {
      role: seatIdx === 0 ? 'host' : 'guest',
      online: this.online,
      roomCode: this.roomCode,
      status: this.status,
      error: seatIdx === 0 ? this.error : null,
      mySeat: seatIdx,
      lobby: {
        ...this.lobby,
        seats: sanitizedSeats,
      },
      view: this.buildPlayerView(this.state, seatIdx),
    };
  }

  broadcastAll(): void {
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

  dispatchHostAction(action: TAction): void {
    try {
      this.applyActionFn(this.state, 0, action);
      this.broadcastAll();
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : '操作无效';
      this.broadcastAll();
    }
  }

  updateState(stateModifier: (s: TState) => void): void {
    stateModifier(this.state);
    this.broadcastAll();
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
      this.bc = new BroadcastChannel(`party-bc-${this.roomCode}`);
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
      const peer = new PeerCtor(`${PEER_ID_PREFIX}${this.roomCode}`, PEER_OPTIONS);
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
                this.onSeatConnectedChange?.(seatObj.seat, false);
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

  handleClientMessage(
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
        this.onSeatConnectedChange?.(existing.seat, true);
        this.broadcastAll();
        return;
      }

      if (this.lobby.started) {
        replyFn({ type: 'error', message: '游戏已经开始，无法中途加入新座位。' });
        return;
      }

      const targetSeat =
        this.lobby.seats.find((s) => s.seat > 0 && s.kind === 'open') ??
        this.lobby.seats.find((s) => s.seat > 0 && s.kind === 'bot');
      if (!targetSeat) {
        replyFn({ type: 'error', message: '房间座位已满！' });
        return;
      }

      targetSeat.kind = 'human';
      targetSeat.name = name.trim() || `玩家 ${targetSeat.seat + 1}`;
      targetSeat.token = token;
      targetSeat.connected = true;
      this.onSeatConnectedChange?.(targetSeat.seat, true);
      this.broadcastAll();
      return;
    }

    if (type === 'action' && isRecord(msg['action'])) {
      const seatObj = this.lobby.seats.find(
        (s) => s.seat > 0 && s.kind === 'human' && s.token === token
      );
      if (!seatObj) return;
      try {
        this.applyActionFn(this.state, seatObj.seat, msg['action'] as unknown as TAction);
        this.broadcastAll();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : '非法操作';
        replyFn({ type: 'error', message });
      }
    }
  }
}

export interface GenericGuestOptions {
  roomCode: string;
  guestName?: string;
  token?: string;
}

export class GenericGuestSession<TView, TAction> {
  readonly role = 'guest' as const;
  readonly online = true;
  readonly roomCode: string;
  readonly myToken: string;

  private readonly guestName: string;
  private readonly listeners = new Set<(snap: GenericSessionSnapshot<TView>) => void>();
  private snapshot: GenericSessionSnapshot<TView>;
  private bc: BroadcastChannel | null = null;
  private peer: PeerInstanceLike | null = null;
  private conn: PeerConnectionLike | null = null;
  private connectedViaBc = false;
  private destroyed = false;
  private joinRetryTimer: ReturnType<typeof setInterval> | undefined;
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | undefined;
  private peerRetryTimer: ReturnType<typeof setTimeout> | undefined;
  private unavailableRetries = 0;

  constructor(opts: GenericGuestOptions) {
    this.roomCode = parseUniversalRoomCode(opts.roomCode).roomCode;
    this.guestName = opts.guestName?.trim() || '玩家';
    this.myToken = opts.token ?? getPartyGuestToken(this.roomCode);
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

  onUpdate(fn: (snap: GenericSessionSnapshot<TView>) => void): () => void {
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

  sendAction(action: TAction): void {
    const payload = {
      type: 'action',
      token: this.myToken,
      action,
    };
    if (this.conn?.open) {
      this.conn.send(payload);
    } else if (this.bc) {
      this.bc.postMessage(payload);
    }
  }

  private emitUpdate(): void {
    for (const fn of this.listeners) fn(this.snapshot);
  }

  private sendJoin(): void {
    const payload = {
      type: 'join',
      token: this.myToken,
      name: this.guestName,
    };
    if (this.conn?.open) {
      this.conn.send(payload);
    } else if (this.bc) {
      this.bc.postMessage(payload);
    }
  }

  handleServerMessage(raw: unknown): void {
    if (this.destroyed || !isRecord(raw)) return;
    const type = typeof raw['type'] === 'string' ? raw['type'] : '';
    if (type === 'error') {
      const msg = typeof raw['message'] === 'string' ? raw['message'] : '连接错误';
      this.snapshot = { ...this.snapshot, error: msg, status: msg };
      this.emitUpdate();
      return;
    }

    if (type === 'sync' && isRecord(raw['snapshot'])) {
      const snap = raw['snapshot'] as unknown as GenericSessionSnapshot<TView>;
      this.snapshot = {
        ...snap,
        role: 'guest',
        roomCode: this.roomCode,
        online: true,
      };
      this.emitUpdate();
    }
  }

  private async connect(): Promise<void> {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(`party-bc-${this.roomCode}`);
      this.bc.onmessage = (ev: MessageEvent) => {
        if (this.destroyed || !isRecord(ev.data)) return;
        const target = typeof ev.data['targetToken'] === 'string' ? ev.data['targetToken'] : '';
        if (target && target !== this.myToken) return;
        this.connectedViaBc = true;
        this.handleServerMessage(ev.data);
      };
    }

    this.sendJoin();
    this.joinRetryTimer = setInterval(() => {
      if (this.destroyed) return;
      if (!this.snapshot.lobby) {
        this.sendJoin();
      }
    }, 1000);

    this.connectTimeoutTimer = setTimeout(() => {
      if (this.destroyed || this.snapshot.lobby) return;
      if (!this.connectedViaBc && !this.conn?.open) {
        this.snapshot = {
          ...this.snapshot,
          status: `连接超时：找不到房间 ${this.roomCode}。请确认房号是否正确。`,
          error: `找不到房间 ${this.roomCode}`,
        };
        this.emitUpdate();
      }
    }, 12000);

    if (typeof RTCPeerConnection === 'undefined') {
      return;
    }

    await this.initPeerJs();
  }

  private async initPeerJs(): Promise<void> {
    try {
      const PeerCtor = await loadPeerClass();
      if (this.destroyed) return;
      const guestId = `${PEER_ID_PREFIX}g-${createRandomToken('tok').slice(0, 12)}`;
      const peer = new PeerCtor(guestId, PEER_OPTIONS);
      this.peer = peer;

      peer.on('open', () => {
        if (this.destroyed) return;
        const hostPeerId = `${PEER_ID_PREFIX}${this.roomCode}`;
        const conn = peer.connect(hostPeerId, {
          reliable: true,
          serialization: 'json',
        });
        this.conn = conn;

        conn.on('open', () => {
          if (this.destroyed) return;
          this.snapshot = {
            ...this.snapshot,
            status: `已连接至房主（P2P）`,
            error: null,
          };
          this.emitUpdate();
          this.sendJoin();
        });

        conn.on('data', (raw: unknown) => {
          this.handleServerMessage(raw);
        });

        conn.on('close', () => {
          if (this.destroyed) return;
          this.snapshot = {
            ...this.snapshot,
            status: '与房主连接中断',
            error: '与房主连接已断开',
          };
          this.emitUpdate();
        });
      });

      peer.on('error', (rawErr: unknown) => {
        if (this.destroyed) return;
        const err = rawErr as PeerErrorLike | undefined;
        if (err?.type === 'peer-unavailable' && this.unavailableRetries < 3) {
          this.unavailableRetries++;
          clearTimeout(this.peerRetryTimer);
          this.peerRetryTimer = setTimeout(() => void this.initPeerJs(), 1500);
          return;
        }
        if (!this.snapshot.lobby) {
          this.snapshot = {
            ...this.snapshot,
            status: `WebRTC 信令错误 (${err?.type ?? 'error'})，尝试本地通道…`,
          };
          this.emitUpdate();
        }
      });
    } catch {
      // PeerJS unavailable, BroadcastChannel active
    }
  }
}

@Injectable({
  providedIn: 'root',
})
export class P2PRoomTransportService {
  createHost<TState, TView, TAction>(
    opts: GenericHostOptions<TState, TView, TAction>
  ): GenericHostSession<TState, TView, TAction> {
    return new GenericHostSession<TState, TView, TAction>(opts);
  }

  createGuest<TView, TAction>(
    opts: GenericGuestOptions
  ): GenericGuestSession<TView, TAction> {
    return new GenericGuestSession<TView, TAction>(opts);
  }

  parseRoomCode(input: string): UniversalRoomInfo {
    return parseUniversalRoomCode(input);
  }

  generateCode(prefix: GamePrefix, len = 5): string {
    return generatePrefixedRoomCode(prefix, len);
  }

  getGuestToken(roomCode: string): string {
    return getPartyGuestToken(roomCode);
  }

  updateUrl(roomCode: string, game?: GameId): void {
    updateBrowserUrlWithRoom(roomCode, game);
  }

  clearUrl(): void {
    clearBrowserUrlRoom();
  }

  dispatchLeave(roomCode?: string, game?: GameId): void {
    dispatchP2pLeaveEvent(roomCode, game);
  }
}
