import type { PeerConnectionLike } from './p2p-room.transport';

export const CUSTOM_WSS_BROKERS_STORAGE_KEY = 'party_pavilion_wss_brokers';

export const DEFAULT_WSS_RELAY_BROKERS: readonly string[] = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

const RELAY_TOPIC_ROOT = 'party-pavilion/v2';
const MQTT_KEEPALIVE_SECONDS = 30;
const MQTT_PING_INTERVAL_MS = 20000;
const MQTT_RECONNECT_DELAY_MS = 1500;
const GUEST_HELLO_INTERVAL_MS = 1100;
const MAX_SEEN_MESSAGE_IDS = 512;
const RELAY_ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export interface RelayWebSocketLike {
  binaryType: string;
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  send(data: Uint8Array): void;
  close(): void;
}

export type RelaySocketFactory = (url: string, protocol: string) => RelayWebSocketLike;

export interface WssRelayHostOptions {
  namespace: 'hkmj' | 'party';
  roomCode: string;
  onConnection: (conn: PeerConnectionLike) => void;
  onReady?: () => void;
  brokers?: readonly string[];
  socketFactory?: RelaySocketFactory;
}

export interface WssRelayHostHandle {
  readonly ready: boolean;
  destroy(): void;
}

export interface WssRelayGuestOptions {
  namespace: 'hkmj' | 'party';
  roomCode: string;
  brokers?: readonly string[];
  socketFactory?: RelaySocketFactory;
}

export interface WssRelayGuestHandle {
  readonly conn: PeerConnectionLike;
  destroy(): void;
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}

function createRelayId(len = 12): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    const ch = RELAY_ID_ALPHABET.at(Math.floor(Math.random() * RELAY_ID_ALPHABET.length)) ?? 'a';
    out += ch;
  }
  return out;
}

function isValidRelayId(val: unknown): val is string {
  return typeof val === 'string' && /^[a-z0-9]{6,28}$/i.test(val);
}

export function resolveWssRelayBrokers(override?: readonly string[]): string[] {
  if (override && override.length > 0) {
    return [...override];
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(CUSTOM_WSS_BROKERS_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (u): u is string =>
              typeof u === 'string' &&
              (u.trim().startsWith('wss://') || u.trim().startsWith('ws://'))
          );
          if (valid.length > 0) {
            return valid.map((u) => u.trim());
          }
        }
      }
    }
  } catch {
    // Ignore storage or JSON errors and use defaults
  }
  return [...DEFAULT_WSS_RELAY_BROKERS];
}

function defaultRelaySocketFactory(url: string, protocol: string): RelayWebSocketLike {
  return new WebSocket(url, protocol) as unknown as RelayWebSocketLike;
}

function bytesToBase64(bytes: Uint8Array): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let binary = '';
  for (let i = 0; i < view.byteLength; i++) {
    binary += String.fromCharCode(view.getUint8(i));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  const view = new DataView(out.buffer);
  for (let i = 0; i < binary.length; i++) {
    view.setUint8(i, binary.charCodeAt(i) & 0xff);
  }
  return out;
}

export function encodeMqttRemainingLength(length: number): Uint8Array {
  const encoded: number[] = [];
  let remaining = Math.max(0, Math.floor(length));
  do {
    let digit = remaining % 128;
    remaining = Math.floor(remaining / 128);
    if (remaining > 0) {
      digit |= 0x80;
    }
    encoded.push(digit);
  } while (remaining > 0);
  return Uint8Array.from(encoded);
}

function encodeMqttUtf8String(text: string): Uint8Array {
  const utf8 = utf8Encoder.encode(text);
  const out = new Uint8Array(2 + utf8.byteLength);
  const view = new DataView(out.buffer);
  view.setUint16(0, utf8.byteLength, false);
  out.set(utf8, 2);
  return out;
}

export function buildMqttConnectPacket(
  clientId: string,
  keepAliveSec = MQTT_KEEPALIVE_SECONDS
): Uint8Array {
  const protoField = encodeMqttUtf8String('MQTT');
  const varHeader = new Uint8Array(protoField.byteLength + 4);
  varHeader.set(protoField, 0);
  const vhView = new DataView(varHeader.buffer);
  vhView.setUint8(protoField.byteLength, 0x04); // MQTT 3.1.1
  vhView.setUint8(protoField.byteLength + 1, 0x02); // Clean Session
  vhView.setUint16(protoField.byteLength + 2, keepAliveSec, false);

  const payload = encodeMqttUtf8String(clientId);
  const remLen = encodeMqttRemainingLength(varHeader.byteLength + payload.byteLength);
  const pkt = new Uint8Array(1 + remLen.byteLength + varHeader.byteLength + payload.byteLength);
  pkt[0] = 0x10;
  pkt.set(remLen, 1);
  pkt.set(varHeader, 1 + remLen.byteLength);
  pkt.set(payload, 1 + remLen.byteLength + varHeader.byteLength);
  return pkt;
}

export function buildMqttSubscribePacket(packetId: number, topic: string): Uint8Array {
  const topicField = encodeMqttUtf8String(topic);
  const bodyLen = 2 + topicField.byteLength + 1;
  const remLen = encodeMqttRemainingLength(bodyLen);
  const pkt = new Uint8Array(1 + remLen.byteLength + bodyLen);
  pkt[0] = 0x82;
  pkt.set(remLen, 1);
  const view = new DataView(pkt.buffer, 1 + remLen.byteLength, bodyLen);
  view.setUint16(0, packetId & 0xffff, false);
  pkt.set(topicField, 1 + remLen.byteLength + 2);
  view.setUint8(2 + topicField.byteLength, 0x00); // QoS 0
  return pkt;
}

export function buildMqttPublishPacket(topic: string, textPayload: string): Uint8Array {
  const topicField = encodeMqttUtf8String(topic);
  const bodyBytes = utf8Encoder.encode(textPayload);
  const bodyLen = topicField.byteLength + bodyBytes.byteLength;
  const remLen = encodeMqttRemainingLength(bodyLen);
  const pkt = new Uint8Array(1 + remLen.byteLength + bodyLen);
  pkt[0] = 0x30; // PUBLISH QoS 0
  pkt.set(remLen, 1);
  pkt.set(topicField, 1 + remLen.byteLength);
  pkt.set(bodyBytes, 1 + remLen.byteLength + topicField.byteLength);
  return pkt;
}

export function buildMqttPingReqPacket(): Uint8Array {
  return Uint8Array.of(0xc0, 0x00);
}

export function drainMqttPackets(
  buffer: Uint8Array,
  onPacket: (packetType: number, flags: number, body: Uint8Array) => void
): Uint8Array {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 0;

  while (offset < view.byteLength) {
    const firstByte = view.getUint8(offset);
    let multiplier = 1;
    let remainingLength = 0;
    let cursor = offset + 1;
    let lengthComplete = false;

    while (cursor < view.byteLength) {
      const encodedByte = view.getUint8(cursor);
      cursor += 1;
      remainingLength += (encodedByte & 0x7f) * multiplier;
      if ((encodedByte & 0x80) === 0) {
        lengthComplete = true;
        break;
      }
      multiplier *= 128;
      if (multiplier > 128 * 128 * 128) {
        // Malformed variable-length header: drop corrupted buffer
        return new Uint8Array(0);
      }
    }

    if (!lengthComplete || cursor + remainingLength > view.byteLength) {
      break;
    }

    const packetType = firstByte >> 4;
    const flags = firstByte & 0x0f;
    const body = buffer.subarray(cursor, cursor + remainingLength);
    onPacket(packetType, flags, body);
    offset = cursor + remainingLength;
  }

  return buffer.subarray(offset);
}

function toUint8Array(raw: unknown): Uint8Array | null {
  if (raw instanceof Uint8Array) {
    return raw;
  }
  if (raw instanceof ArrayBuffer) {
    return new Uint8Array(raw);
  }
  if (ArrayBuffer.isView(raw)) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  }
  return null;
}

class MiniMqttBrokerLink {
  private ws: RelayWebSocketLike | null = null;
  private rxBuffer: Uint8Array = new Uint8Array(0);
  private readonly subscriptions = new Set<string>();
  private readonly queuedPublishes: Array<{ topic: string; payload: string }> = [];
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private nextPacketId = 1;
  private connected = false;
  private destroyed = false;

  constructor(
    private readonly url: string,
    private readonly socketFactory: RelaySocketFactory,
    private readonly onConnected: () => void,
    private readonly onMessage: (topic: string, payload: string) => void
  ) {
    this.openSocket();
  }

  get isConnected(): boolean {
    return this.connected;
  }

  subscribe(topic: string): void {
    this.subscriptions.add(topic);
    if (this.connected && this.ws) {
      const pktId = this.nextPacketId++;
      if (this.nextPacketId > 60000) this.nextPacketId = 1;
      this.safeSend(buildMqttSubscribePacket(pktId, topic));
    }
  }

  publish(topic: string, payload: string): void {
    if (this.connected && this.ws) {
      this.safeSend(buildMqttPublishPacket(topic, payload));
      return;
    }
    if (this.queuedPublishes.length < 32) {
      this.queuedPublishes.push({ topic, payload });
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.connected = false;
    clearInterval(this.pingTimer);
    clearTimeout(this.reconnectTimer);
    this.cleanupSocket();
  }

  private safeSend(bytes: Uint8Array): void {
    try {
      this.ws?.send(bytes);
    } catch {
      // Socket transient write failure; close handler will trigger reconnect
    }
  }

  private cleanupSocket(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        // Ignore close error
      }
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.connected = false;
    clearInterval(this.pingTimer);
    clearTimeout(this.reconnectTimer);
    this.cleanupSocket();
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) {
        this.openSocket();
      }
    }, MQTT_RECONNECT_DELAY_MS);
  }

  private openSocket(): void {
    if (this.destroyed) return;
    this.rxBuffer = new Uint8Array(0);
    let sock: RelayWebSocketLike;
    try {
      sock = this.socketFactory(this.url, 'mqtt');
      sock.binaryType = 'arraybuffer';
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws = sock;
    const clientId = `pp_${createRelayId(14)}`;

    sock.onopen = () => {
      if (this.destroyed || this.ws !== sock) return;
      this.safeSend(buildMqttConnectPacket(clientId));
    };

    sock.onmessage = (ev: { data: unknown }) => {
      if (this.destroyed || this.ws !== sock) return;
      const chunk = toUint8Array(ev.data);
      if (!chunk) return;
      const merged = new Uint8Array(this.rxBuffer.byteLength + chunk.byteLength);
      merged.set(this.rxBuffer, 0);
      merged.set(chunk, this.rxBuffer.byteLength);

      this.rxBuffer = drainMqttPackets(merged, (packetType, flags, body) => {
        if (packetType === 2) {
          // CONNACK: verify return code === 0
          if (body.byteLength >= 2) {
            const rc = new DataView(body.buffer, body.byteOffset, body.byteLength).getUint8(1);
            if (rc !== 0) {
              this.scheduleReconnect();
              return;
            }
          }
          this.connected = true;
          for (const topic of this.subscriptions) {
            const pktId = this.nextPacketId++;
            if (this.nextPacketId > 60000) this.nextPacketId = 1;
            this.safeSend(buildMqttSubscribePacket(pktId, topic));
          }
          const pending = this.queuedPublishes.splice(0, this.queuedPublishes.length);
          for (const item of pending) {
            this.safeSend(buildMqttPublishPacket(item.topic, item.payload));
          }
          clearInterval(this.pingTimer);
          this.pingTimer = setInterval(() => {
            if (this.connected && !this.destroyed) {
              this.safeSend(buildMqttPingReqPacket());
            }
          }, MQTT_PING_INTERVAL_MS);
          this.onConnected();
        } else if (packetType === 3 && body.byteLength >= 2) {
          // PUBLISH
          const bodyView = new DataView(body.buffer, body.byteOffset, body.byteLength);
          const topicLen = bodyView.getUint16(0, false);
          const qos = (flags >> 1) & 0x03;
          const packetIdBytes = qos > 0 ? 2 : 0;
          const payloadStart = 2 + topicLen + packetIdBytes;
          if (payloadStart > body.byteLength) return;
          const topic = utf8Decoder.decode(body.subarray(2, 2 + topicLen));
          const text = utf8Decoder.decode(body.subarray(payloadStart));
          this.onMessage(topic, text);
        }
      });
    };

    sock.onerror = () => {
      if (this.ws === sock) {
        this.scheduleReconnect();
      }
    };

    sock.onclose = () => {
      if (this.ws === sock) {
        this.scheduleReconnect();
      }
    };
  }
}

interface EphemeralEcdhIdentity {
  readonly privateKey: CryptoKey;
  readonly publicJwk: JsonWebKey;
}

async function generateEcdhIdentity(): Promise<EphemeralEcdhIdentity | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return null;
  }
  try {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveKey',
    ]);
    const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    return { privateKey: pair.privateKey, publicJwk };
  } catch {
    return null;
  }
}

async function deriveSharedAesKey(
  myPrivateKey: CryptoKey,
  peerPublicJwk: JsonWebKey
): Promise<CryptoKey | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return null;
  }
  try {
    const importedPub = await crypto.subtle.importKey(
      'jwk',
      peerPublicJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );
    return await crypto.subtle.deriveKey(
      { name: 'ECDH', public: importedPub },
      myPrivateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  } catch {
    return null;
  }
}

async function encryptEnvelope(
  senderId: string,
  innerObj: Record<string, unknown>,
  aesKey: CryptoKey | null
): Promise<string | null> {
  const plainJson = JSON.stringify(innerObj);
  if (!aesKey) {
    return JSON.stringify({ t: 'plain', sid: senderId, body: plainJson });
  }
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      utf8Encoder.encode(plainJson)
    );
    return JSON.stringify({
      t: 'enc',
      sid: senderId,
      iv: bytesToBase64(iv),
      ct: bytesToBase64(new Uint8Array(cipherBuf)),
    });
  } catch {
    return null;
  }
}

async function decryptEnvelope(
  pkt: Record<string, unknown>,
  aesKey: CryptoKey | null,
  allowPlainFallback: boolean
): Promise<Record<string, unknown> | null> {
  if (aesKey) {
    if (pkt['t'] !== 'enc' || typeof pkt['iv'] !== 'string' || typeof pkt['ct'] !== 'string') {
      return null;
    }
    try {
      const ivBytes = base64ToBytes(pkt['iv']);
      const ctBytes = base64ToBytes(pkt['ct']);
      const ivBuf = ivBytes.buffer.slice(
        ivBytes.byteOffset,
        ivBytes.byteOffset + ivBytes.byteLength
      ) as ArrayBuffer;
      const ctBuf = ctBytes.buffer.slice(
        ctBytes.byteOffset,
        ctBytes.byteOffset + ctBytes.byteLength
      ) as ArrayBuffer;
      const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, aesKey, ctBuf);
      const parsed: unknown = JSON.parse(utf8Decoder.decode(new Uint8Array(plainBuf)));
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  if (allowPlainFallback && pkt['t'] === 'plain' && typeof pkt['body'] === 'string') {
    try {
      const parsed: unknown = JSON.parse(pkt['body']);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

function isPlainDevAllowed(): boolean {
  if (typeof location !== 'undefined' && location.protocol === 'https:') {
    return false;
  }
  return true;
}

function recordSeenMessageId(seen: Set<string>, mid: string): boolean {
  if (seen.has(mid)) {
    return false;
  }
  if (seen.size >= MAX_SEEN_MESSAGE_IDS) {
    const oldest = seen.keys().next().value;
    if (typeof oldest === 'string') {
      seen.delete(oldest);
    }
  }
  seen.add(mid);
  return true;
}

class RelayVirtualConnection implements PeerConnectionLike {
  open: boolean;
  private closed = false;
  private readonly listeners = new Map<string, Array<(arg?: unknown) => void>>();
  private onSendHandler: (payload: unknown) => void;
  private onLocalCloseHandler: () => void;

  constructor(
    initiallyOpen: boolean,
    onSend: (payload: unknown) => void,
    onLocalClose: () => void
  ) {
    this.open = initiallyOpen;
    this.onSendHandler = onSend;
    this.onLocalCloseHandler = onLocalClose;
  }

  setSendHandler(fn: (payload: unknown) => void): void {
    this.onSendHandler = fn;
  }

  send(data: unknown): void {
    if (this.closed || !this.open) return;
    this.onSendHandler(data);
  }

  on(event: string, cb: (arg?: unknown) => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(cb);
    this.listeners.set(event, list);
  }

  close(): void {
    if (this.closed) return;
    const wasOpen = this.open;
    this.closed = true;
    this.open = false;
    this.onLocalCloseHandler();
    if (wasOpen) {
      this.emit('close');
    }
  }

  markOpen(): void {
    if (this.closed || this.open) return;
    this.open = true;
    this.emit('open');
  }

  handleRemoteData(data: unknown): void {
    if (this.closed) return;
    this.emit('data', data);
  }

  handleRemoteClose(): void {
    if (this.closed) return;
    const wasOpen = this.open;
    this.closed = true;
    this.open = false;
    if (wasOpen) {
      this.emit('close');
    }
  }

  private emit(event: string, arg?: unknown): void {
    for (const cb of this.listeners.get(event) ?? []) {
      cb(arg);
    }
  }
}

export function createWssRelayHost(opts: WssRelayHostOptions): WssRelayHostHandle {
  const socketFactory = opts.socketFactory ?? defaultRelaySocketFactory;
  const brokerUrls = resolveWssRelayBrokers(opts.brokers);
  const hostId = createRelayId(12);
  const topicToHost = `${RELAY_TOPIC_ROOT}/${opts.namespace}/${opts.roomCode}/h`;
  const allowPlainFallback = isPlainDevAllowed();

  let destroyed = false;
  let isReady = false;
  let txSeq = 0;

  interface GuestEntry {
    readonly conn: RelayVirtualConnection;
    readonly aesKey: CryptoKey | null;
    readonly replyTopic: string;
  }

  const guests = new Map<string, GuestEntry>();
  const pendingHellos = new Set<string>();
  const seenMids = new Set<string>();
  const links: MiniMqttBrokerLink[] = [];
  const identityPromise = generateEcdhIdentity();

  const publishAll = (topic: string, payload: string): void => {
    for (const link of links) {
      link.publish(topic, payload);
    }
  };

  const handleIncoming = async (_topic: string, rawText: string): Promise<void> => {
    if (destroyed) return;
    let pkt: unknown;
    try {
      pkt = JSON.parse(rawText);
    } catch {
      return;
    }
    if (!isRecord(pkt) || typeof pkt['t'] !== 'string') return;

    const identity = await identityPromise;
    if (destroyed) return;

    if (pkt['t'] === 'hello') {
      const gid = pkt['gid'];
      if (!isValidRelayId(gid)) return;
      const replyTopic = `${RELAY_TOPIC_ROOT}/${opts.namespace}/${opts.roomCode}/g/${gid}`;

      let entry = guests.get(gid);
      if (!entry && !pendingHellos.has(gid)) {
        pendingHellos.add(gid);
        try {
          let aesKey: CryptoKey | null = null;
          if (identity && isRecord(pkt['pub'])) {
            aesKey = await deriveSharedAesKey(identity.privateKey, pkt['pub'] as JsonWebKey);
            if (!aesKey) return;
          } else if (allowPlainFallback && (!identity || pkt['pub'] === null)) {
            aesKey = null;
          } else {
            return;
          }
          if (destroyed) return;

          entry = guests.get(gid);
          if (!entry) {
            const conn = new RelayVirtualConnection(
              true,
              (data: unknown) => {
                const mid = `${hostId}_${++txSeq}`;
                void encryptEnvelope(hostId, { mid, data }, aesKey).then((encoded) => {
                  if (!destroyed && encoded) {
                    publishAll(replyTopic, encoded);
                  }
                });
              },
              () => {
                guests.delete(gid);
                const mid = `${hostId}_${++txSeq}`;
                void encryptEnvelope(hostId, { mid, bye: true }, aesKey).then((encoded) => {
                  if (encoded) {
                    publishAll(replyTopic, encoded);
                  }
                });
              }
            );
            entry = { conn, aesKey, replyTopic };
            guests.set(gid, entry);
            opts.onConnection(conn);
          }
        } finally {
          pendingHellos.delete(gid);
        }
      }

      if (entry) {
        publishAll(
          replyTopic,
          JSON.stringify({
            t: 'welcome',
            hid: hostId,
            gid,
            pub: entry.aesKey && identity ? identity.publicJwk : null,
          })
        );
      }
      return;
    }

    const sid = pkt['sid'];
    if (!isValidRelayId(sid)) return;
    const guestEntry = guests.get(sid);
    if (!guestEntry) return;

    const inner = await decryptEnvelope(pkt, guestEntry.aesKey, allowPlainFallback);
    if (destroyed || !inner || typeof inner['mid'] !== 'string') return;
    if (!recordSeenMessageId(seenMids, inner['mid'])) return;

    if (inner['bye'] === true) {
      guests.delete(sid);
      guestEntry.conn.handleRemoteClose();
      return;
    }

    if ('data' in inner) {
      guestEntry.conn.handleRemoteData(inner['data']);
    }
  };

  for (const url of brokerUrls) {
    const link = new MiniMqttBrokerLink(
      url,
      socketFactory,
      () => {
        if (!destroyed && !isReady) {
          isReady = true;
          opts.onReady?.();
        }
      },
      (topic, text) => {
        void handleIncoming(topic, text);
      }
    );
    link.subscribe(topicToHost);
    links.push(link);
  }

  return {
    get ready(): boolean {
      return isReady;
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const [gid, entry] of guests.entries()) {
        guests.delete(gid);
        const mid = `${hostId}_${++txSeq}`;
        void encryptEnvelope(hostId, { mid, bye: true }, entry.aesKey).then((encoded) => {
          if (encoded) {
            publishAll(entry.replyTopic, encoded);
          }
        });
      }
      for (const link of links) {
        link.destroy();
      }
    },
  };
}

export function createWssRelayGuest(opts: WssRelayGuestOptions): WssRelayGuestHandle {
  const socketFactory = opts.socketFactory ?? defaultRelaySocketFactory;
  const brokerUrls = resolveWssRelayBrokers(opts.brokers);
  const guestId = createRelayId(12);
  const topicToHost = `${RELAY_TOPIC_ROOT}/${opts.namespace}/${opts.roomCode}/h`;
  const topicToGuest = `${RELAY_TOPIC_ROOT}/${opts.namespace}/${opts.roomCode}/g/${guestId}`;
  const allowPlainFallback = isPlainDevAllowed();

  let destroyed = false;
  let established = false;
  let derivingWelcome = false;
  let hostId = '';
  let sharedAesKey: CryptoKey | null = null;
  let txSeq = 0;
  let helloTimer: ReturnType<typeof setInterval> | undefined;

  const bufferedEnvelopes: Array<Record<string, unknown>> = [];
  const seenMids = new Set<string>();
  const links: MiniMqttBrokerLink[] = [];
  const identityPromise = generateEcdhIdentity();

  const publishAll = (topic: string, payload: string): void => {
    for (const link of links) {
      link.publish(topic, payload);
    }
  };

  const conn = new RelayVirtualConnection(
    false,
    (data: unknown) => {
      if (destroyed || !established) return;
      const mid = `${guestId}_${++txSeq}`;
      void encryptEnvelope(guestId, { mid, data }, sharedAesKey).then((encoded) => {
        if (!destroyed && encoded) {
          publishAll(topicToHost, encoded);
        }
      });
    },
    () => {
      if (established && !destroyed) {
        const mid = `${guestId}_${++txSeq}`;
        void encryptEnvelope(guestId, { mid, bye: true }, sharedAesKey).then((encoded) => {
          if (encoded) {
            publishAll(topicToHost, encoded);
          }
        });
      }
    }
  );

  const sendHello = async (): Promise<void> => {
    if (destroyed || established) return;
    const identity = await identityPromise;
    if (destroyed || established) return;
    if (!identity && !allowPlainFallback) return;
    publishAll(
      topicToHost,
      JSON.stringify({
        t: 'hello',
        gid: guestId,
        pub: identity ? identity.publicJwk : null,
      })
    );
  };

  const processEnvelope = async (pkt: Record<string, unknown>): Promise<void> => {
    if (destroyed || !established) return;
    if (pkt['sid'] !== hostId) return;
    const inner = await decryptEnvelope(pkt, sharedAesKey, allowPlainFallback);
    if (destroyed || !inner || typeof inner['mid'] !== 'string') return;
    if (!recordSeenMessageId(seenMids, inner['mid'])) return;

    if (inner['bye'] === true) {
      conn.handleRemoteClose();
      return;
    }

    if ('data' in inner) {
      conn.handleRemoteData(inner['data']);
    }
  };

  const handleIncoming = async (_topic: string, rawText: string): Promise<void> => {
    if (destroyed) return;
    let pkt: unknown;
    try {
      pkt = JSON.parse(rawText);
    } catch {
      return;
    }
    if (!isRecord(pkt) || typeof pkt['t'] !== 'string') return;

    if (pkt['t'] === 'welcome') {
      if (established || derivingWelcome || pkt['gid'] !== guestId || !isValidRelayId(pkt['hid'])) {
        return;
      }
      derivingWelcome = true;
      try {
        const identity = await identityPromise;
        if (destroyed || established) return;
        let derived: CryptoKey | null = null;
        if (identity && isRecord(pkt['pub'])) {
          derived = await deriveSharedAesKey(identity.privateKey, pkt['pub'] as JsonWebKey);
          if (!derived) return;
        } else if (allowPlainFallback && (!identity || pkt['pub'] === null)) {
          derived = null;
        } else {
          return;
        }
        if (destroyed || established) return;

        hostId = pkt['hid'];
        sharedAesKey = derived;
        established = true;
        clearInterval(helloTimer);
        helloTimer = undefined;
        conn.markOpen();

        const pending = bufferedEnvelopes.splice(0, bufferedEnvelopes.length);
        for (const env of pending) {
          await processEnvelope(env);
        }
      } finally {
        derivingWelcome = false;
      }
      return;
    }

    if (derivingWelcome) {
      if (bufferedEnvelopes.length < 32) {
        bufferedEnvelopes.push(pkt);
      }
      return;
    }

    await processEnvelope(pkt);
  };

  let helloLoopStarted = false;
  for (const url of brokerUrls) {
    const link = new MiniMqttBrokerLink(
      url,
      socketFactory,
      () => {
        if (destroyed || established) return;
        void sendHello();
        if (!helloLoopStarted) {
          helloLoopStarted = true;
          helloTimer = setInterval(() => {
            if (destroyed || established) {
              clearInterval(helloTimer);
              helloTimer = undefined;
              return;
            }
            void sendHello();
          }, GUEST_HELLO_INTERVAL_MS);
        }
      },
      (topic, text) => {
        void handleIncoming(topic, text);
      }
    );
    link.subscribe(topicToGuest);
    links.push(link);
  }

  return {
    conn,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      clearInterval(helloTimer);
      helloTimer = undefined;
      if (established) {
        const mid = `${guestId}_${++txSeq}`;
        void encryptEnvelope(guestId, { mid, bye: true }, sharedAesKey).then((encoded) => {
          if (encoded) {
            publishAll(topicToHost, encoded);
          }
          for (const link of links) {
            link.destroy();
          }
        });
      } else {
        for (const link of links) {
          link.destroy();
        }
      }
    },
  };
}
