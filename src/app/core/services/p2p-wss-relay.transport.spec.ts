import {
  CUSTOM_WSS_BROKERS_STORAGE_KEY,
  DEFAULT_WSS_RELAY_BROKERS,
  RelaySocketFactory,
  RelayWebSocketLike,
  buildMqttConnectPacket,
  buildMqttPingReqPacket,
  buildMqttPublishPacket,
  buildMqttSubscribePacket,
  createWssRelayGuest,
  createWssRelayHost,
  drainMqttPackets,
  encodeMqttRemainingLength,
  resolveWssRelayBrokers,
} from './p2p-wss-relay.transport';

class InMemoryMqttBrokerHub {
  private readonly clients = new Set<{
    sock: InMemoryRelaySocket;
    subs: Set<string>;
  }>();

  readonly factory: RelaySocketFactory = (_url: string, _protocol: string): RelayWebSocketLike => {
    const clientEntry = {
      sock: null as unknown as InMemoryRelaySocket,
      subs: new Set<string>(),
    };
    const sock = new InMemoryRelaySocket(
      (bytes) => this.handleClientFrame(clientEntry, bytes),
      () => this.clients.delete(clientEntry)
    );
    clientEntry.sock = sock;
    this.clients.add(clientEntry);
    queueMicrotask(() => {
      if (sock.readyState === 1) {
        sock.onopen?.();
      }
    });
    return sock;
  };

  disconnectAll(): void {
    for (const entry of Array.from(this.clients)) {
      this.clients.delete(entry);
      entry.sock.simulateServerDrop();
    }
  }

  private handleClientFrame(
    sender: { sock: InMemoryRelaySocket; subs: Set<string> },
    bytes: Uint8Array
  ): void {
    const decoder = new TextDecoder();
    drainMqttPackets(bytes, (pktType, _flags, body) => {
      if (pktType === 1) {
        // CONNECT -> CONNACK (0x20, len=2, 0x00, rc=0x00)
        sender.sock.deliverFromServer(Uint8Array.of(0x20, 0x02, 0x00, 0x00));
      } else if (pktType === 8 && body.byteLength >= 4) {
        // SUBSCRIBE -> parse packetId + topic, reply SUBACK
        const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
        const pktId = view.getUint16(0, false);
        const topicLen = view.getUint16(2, false);
        const topic = decoder.decode(body.subarray(4, 4 + topicLen));
        sender.subs.add(topic);
        sender.sock.deliverFromServer(
          Uint8Array.of(0x90, 0x03, (pktId >> 8) & 0xff, pktId & 0xff, 0x00)
        );
      } else if (pktType === 3 && body.byteLength >= 2) {
        // PUBLISH -> fan out to subscribed clients
        const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
        const topicLen = view.getUint16(0, false);
        const topic = decoder.decode(body.subarray(2, 2 + topicLen));
        const textPayload = decoder.decode(body.subarray(2 + topicLen));
        const outbound = buildMqttPublishPacket(topic, textPayload);
        for (const target of this.clients) {
          if (target.subs.has(topic)) {
            target.sock.deliverFromServer(outbound);
          }
        }
      } else if (pktType === 12) {
        // PINGREQ -> PINGRESP
        sender.sock.deliverFromServer(Uint8Array.of(0xd0, 0x00));
      }
    });
  }
}

class InMemoryRelaySocket implements RelayWebSocketLike {
  binaryType = 'arraybuffer';
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(
    private readonly onClientSend: (bytes: Uint8Array) => void,
    private readonly onClientClose: () => void
  ) {}

  send(data: Uint8Array): void {
    if (this.readyState !== 1) {
      throw new Error('Socket closed');
    }
    this.onClientSend(data);
  }

  close(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onClientClose();
  }

  deliverFromServer(bytes: Uint8Array): void {
    if (this.readyState !== 1) return;
    const copy = bytes.slice();
    queueMicrotask(() => {
      if (this.readyState === 1) {
        this.onmessage?.({ data: copy.buffer });
      }
    });
  }

  simulateServerDrop(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

async function waitForCondition(predicate: () => boolean, maxTicks = 80): Promise<void> {
  for (let i = 0; i < maxTicks; i++) {
    if (predicate()) return;
    await new Promise<void>((r) => setTimeout(r, 8));
  }
}

describe('P2P Encrypted MQTT-over-WSS Relay Transport', () => {
  afterEach(() => {
    localStorage.removeItem(CUSTOM_WSS_BROKERS_STORAGE_KEY);
  });

  it('encodes and drains MQTT 3.1.1 packets including multi-byte lengths and fragmented streams', () => {
    expect(Array.from(encodeMqttRemainingLength(0))).toEqual([0]);
    expect(Array.from(encodeMqttRemainingLength(127))).toEqual([127]);
    expect(Array.from(encodeMqttRemainingLength(128))).toEqual([0x80, 0x01]);
    expect(Array.from(encodeMqttRemainingLength(16384))).toEqual([0x80, 0x80, 0x01]);

    const connectPkt = buildMqttConnectPacket('pp_client_01', 30);
    expect(connectPkt.at(0)).toBe(0x10);

    const subPkt = buildMqttSubscribePacket(7, 'party-pavilion/v2/hkmj/M8SGBB/h');
    expect(subPkt.at(0)).toBe(0x82);

    const pingPkt = buildMqttPingReqPacket();
    expect(Array.from(pingPkt)).toEqual([0xc0, 0x00]);

    const largePayload = '🀄'.repeat(4500);
    const pubPkt = buildMqttPublishPacket('party-pavilion/v2/hkmj/M8SGBB/g/g1', largePayload);
    expect(pubPkt.byteLength).toBeGreaterThan(16384);

    // Split pubPkt across two arbitrary fragments to test partial frame buffering
    const part1 = pubPkt.subarray(0, 50);
    const part2 = pubPkt.subarray(50);

    const decodedTypes: number[] = [];
    let decodedPayload = '';
    const leftover1 = drainMqttPackets(part1, (t) => decodedTypes.push(t));
    expect(decodedTypes.length).toBe(0);
    expect(leftover1.byteLength).toBe(50);

    const merged = new Uint8Array(leftover1.byteLength + part2.byteLength);
    merged.set(leftover1, 0);
    merged.set(part2, leftover1.byteLength);

    const leftover2 = drainMqttPackets(merged, (t, _flags, body) => {
      decodedTypes.push(t);
      const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
      const tLen = view.getUint16(0, false);
      decodedPayload = new TextDecoder().decode(body.subarray(2 + tLen));
    });
    expect(leftover2.byteLength).toBe(0);
    expect(decodedTypes).toEqual([3]);
    expect(decodedPayload).toBe(largePayload);

    // Malformed >4-byte continuation header is safely discarded
    const corrupted = Uint8Array.of(0x30, 0xff, 0xff, 0xff, 0xff, 0x01);
    const afterCorrupt = drainMqttPackets(corrupted, () => {
      decodedTypes.push(99);
    });
    expect(afterCorrupt.byteLength).toBe(0);
    expect(decodedTypes).toEqual([3]);
  });

  it('resolves default and custom WSS relay brokers from localStorage safely', () => {
    expect(resolveWssRelayBrokers()).toEqual([...DEFAULT_WSS_RELAY_BROKERS]);
    expect(resolveWssRelayBrokers(['wss://custom.example.org/mqtt'])).toEqual([
      'wss://custom.example.org/mqtt',
    ]);

    localStorage.setItem(
      CUSTOM_WSS_BROKERS_STORAGE_KEY,
      JSON.stringify([' wss://a.example.com/mqtt ', 'http://invalid', 123])
    );
    expect(resolveWssRelayBrokers()).toEqual(['wss://a.example.com/mqtt']);

    localStorage.setItem(CUSTOM_WSS_BROKERS_STORAGE_KEY, '{broken_json');
    expect(resolveWssRelayBrokers()).toEqual([...DEFAULT_WSS_RELAY_BROKERS]);
  });

  it('establishes ECDH P-256 + AES-256-GCM encrypted tunnel across dual brokers, deduplicates frames, and handles close', async () => {
    const hub = new InMemoryMqttBrokerHub();
    let hostReadyCount = 0;
    const hostReceived: unknown[] = [];
    const guestReceived: unknown[] = [];
    let hostSideClosed = false;

    const hostRelay = createWssRelayHost({
      namespace: 'hkmj',
      roomCode: 'M8SGBB',
      brokers: ['wss://broker-a.test/mqtt', 'wss://broker-b.test/mqtt'],
      socketFactory: hub.factory,
      onReady: () => {
        hostReadyCount += 1;
      },
      onConnection: (conn) => {
        conn.on('data', (msg) => {
          hostReceived.push(msg);
          conn.send({ type: 'sync', seat: 1, echo: msg });
        });
        conn.on('close', () => {
          hostSideClosed = true;
        });
      },
    });

    await waitForCondition(() => hostRelay.ready);
    expect(hostRelay.ready).toBe(true);
    expect(hostReadyCount).toBe(1);

    const guestRelay = createWssRelayGuest({
      namespace: 'hkmj',
      roomCode: 'M8SGBB',
      brokers: ['wss://broker-a.test/mqtt', 'wss://broker-b.test/mqtt'],
      socketFactory: hub.factory,
    });

    let guestOpened = false;
    guestRelay.conn.on('open', () => {
      guestOpened = true;
    });
    guestRelay.conn.on('data', (msg) => {
      guestReceived.push(msg);
    });

    await waitForCondition(() => guestOpened);
    expect(guestRelay.conn.open).toBe(true);

    guestRelay.conn.send({ type: 'join', token: 'tok_sec_1', name: '雀神A' });
    await waitForCondition(() => guestReceived.length >= 1);

    // Even though 2 brokers fanned out every packet, message IDs deduplicate strictly to 1 delivery
    expect(hostReceived.length).toBe(1);
    expect(hostReceived.at(0)).toEqual({ type: 'join', token: 'tok_sec_1', name: '雀神A' });
    expect(guestReceived.length).toBe(1);
    expect(guestReceived.at(0)).toEqual({
      type: 'sync',
      seat: 1,
      echo: { type: 'join', token: 'tok_sec_1', name: '雀神A' },
    });

    // Simulate broker drop & auto-reconnect
    hub.disconnectAll();
    await new Promise<void>((r) => setTimeout(r, 20));

    guestRelay.destroy();
    await waitForCondition(() => hostSideClosed, 20);
    hostRelay.destroy();
  });

  it('handles broker CONNACK rejection, socket factory errors, and Host-initiated close cleanly', async () => {
    let threwOnce = false;
    let rejectedOnce = false;
    const hub = new InMemoryMqttBrokerHub();
    const flakyFactory: RelaySocketFactory = (url, proto) => {
      if (url.includes('throw') && !threwOnce) {
        threwOnce = true;
        throw new Error('Initial WS blocked');
      }
      if (url.includes('reject') && !rejectedOnce) {
        rejectedOnce = true;
        const rejectSock = new InMemoryRelaySocket(
          (bytes) => {
            drainMqttPackets(bytes, (pktType) => {
              if (pktType === 1) {
                rejectSock.deliverFromServer(Uint8Array.of(0x20, 0x02, 0x00, 0x05));
              }
            });
          },
          () => undefined
        );
        queueMicrotask(() => rejectSock.onopen?.());
        return rejectSock;
      }
      return hub.factory(url, proto);
    };

    const hostConns: Array<{ close: () => void }> = [];
    const host = createWssRelayHost({
      namespace: 'party',
      roomCode: 'P99999',
      brokers: ['wss://throw.test/mqtt', 'wss://reject.test/mqtt', 'wss://good.test/mqtt'],
      socketFactory: flakyFactory,
      onConnection: (c) => {
        hostConns.push({ close: () => c.close?.() });
      },
    });

    await waitForCondition(() => host.ready);
    expect(host.ready).toBe(true);

    const guest = createWssRelayGuest({
      namespace: 'party',
      roomCode: 'P99999',
      brokers: ['wss://good.test/mqtt'],
      socketFactory: hub.factory,
    });

    let guestClosed = false;
    guest.conn.on('close', () => {
      guestClosed = true;
    });

    await waitForCondition(() => guest.conn.open);
    expect(hostConns.length).toBe(1);

    // Host closes virtual connection -> notifies Guest via encrypted bye
    hostConns.at(0)?.close();
    await waitForCondition(() => guestClosed);
    expect(guestClosed).toBe(true);

    guest.destroy();
    host.destroy();
  });
});
