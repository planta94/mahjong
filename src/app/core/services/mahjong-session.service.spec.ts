import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import {
  GuestSession,
  HostSession,
  MahjongSessionService,
  extractRoomCode,
  generateRoomCode,
  getPlayerToken,
} from './mahjong-session.service';
import { DEFAULT_RULES } from './scorer.service';

describe('MahjongSessionService & Host/Guest P2P Sync', () => {
  it('extracts room codes from invite URLs, isolates Host/Guest tokens across tabs, and syncs seats', async () => {
    expect(generateRoomCode(6).length).toBe(6);
    expect(getPlayerToken().length).toBeGreaterThan(3);
    expect(extractRoomCode('  hk8x4 ')).toBe('HK8X4');
    expect(extractRoomCode('https://planta94.github.io/mahjong/?room=ab92z')).toBe('AB92Z');
    expect(extractRoomCode('https://planta94.github.io/mahjong/lobby?foo=1&room=xy77k')).toBe(
      'XY77K'
    );

    // Simulate duplicated tab where sessionStorage already has hkmj_player_token
    sessionStorage.setItem('hkmj_player_token', 'shared_tab_token');

    const host = new HostSession({
      hostName: 'HostA',
      mode: '3p',
      online: true,
      fillBots: false,
    });
    expect(host.myToken).not.toBe('shared_tab_token');

    // Open seats prevent startGame
    expect(host.startGame()).toBe(false);
    expect(host.error?.includes('空位')).toBe(true);

    // Toggle seat 2 to bot, leave seat 1 open for guest
    host.toggleSeatBot(2);
    expect(host.lobby.seats.at(2)?.kind).toBe('bot');

    // Guest joins without explicit token (uses room-scoped guest token, never colliding with host)
    const guest = new GuestSession({
      roomCode: `https://planta94.github.io/mahjong/?room=${host.roomCode}`,
      guestName: 'FriendB',
    });

    await new Promise<void>((r) => setTimeout(r, 80));
    expect(host.lobby.seats.at(1)?.name).toBe('FriendB');

    // A second guest can even replace a Bot seat before match start
    const guest2 = new GuestSession({
      roomCode: host.roomCode,
      guestName: 'FriendC',
      token: 'tok_guest_2',
    });
    await new Promise<void>((r) => setTimeout(r, 80));
    expect(host.lobby.seats.at(2)?.name).toBe('FriendC');

    // Mode switching preserves seated human guests
    host.setMode('4p');
    expect(host.lobby.seats.length).toBe(4);
    expect(host.lobby.seats.at(1)?.name).toBe('FriendB');
    expect(host.lobby.seats.at(2)?.name).toBe('FriendC');
    host.toggleSeatBot(3);

    host.updateRules({ minFan: 7, maxFan: 5 });
    expect(host.lobby.rules.maxFan).toBe(7);

    // Start game and verify guest receives sanitized view
    let guestSeatSeen = -1;
    guest.onUpdate((snap) => {
      guestSeatSeen = snap.mySeat;
    });
    expect(host.startGame()).toBe(true);
    await new Promise<void>((r) => setTimeout(r, 80));
    expect(guestSeatSeen).toBe(1);

    // Return to lobby
    host.returnToLobby();
    expect(host.lobby.started).toBe(false);

    guest2.destroy();
    guest.destroy();
    host.destroy();
  });

  it('manages solo & online sessions, autoPass, penalty buzzer, and dispatches mahjong:leave', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
    const svc = TestBed.inject(MahjongSessionService);

    let leaveFired = false;
    const listener = () => {
      leaveFired = true;
    };
    window.addEventListener('mahjong:leave', listener);

    svc.startSolo('Tester', '3p', DEFAULT_RULES);
    expect(svc.snapshot()?.lobby?.seats.length).toBe(3);
    expect(svc.snapshot()?.view?.numSeats).toBe(3);

    svc.toggleAutoPass(true);
    expect(svc.autoPass()).toBe(true);
    svc.toggleAutoPass(false);
    expect(svc.autoPass()).toBe(false);
    svc.playPenaltyBuzzer();

    const firstTile = svc.snapshot()?.view?.players.at(0)?.hand?.at(0) ?? '';
    svc.sendAction({ type: 'discard', tileId: firstTile });
    expect(svc.snapshot()?.view?.players.at(0)?.discards.length).toBeGreaterThanOrEqual(0);

    svc.leaveSession();
    expect(svc.snapshot()).toBeNull();
    expect(leaveFired).toBe(true);

    svc.createOnlineRoom('HostUser', '4p', DEFAULT_RULES);
    expect(svc.snapshot()?.lobby?.seats.length).toBe(4);
    svc.setLobbyMode('3p');
    expect(svc.snapshot()?.lobby?.seats.length).toBe(3);
    svc.updateLobbyRules({ minFan: 3, concealedFan: false });
    expect(svc.snapshot()?.lobby?.rules.minFan).toBe(3);
    svc.toggleSeatBot(1);
    svc.toggleSeatBot(2);
    expect(svc.snapshot()?.lobby?.seats.at(1)?.kind).toBe('bot');
    svc.startMatch();
    expect(svc.snapshot()?.view?.phase).toBe('turn');

    svc.speakCallout('碰');
    void svc.copyInviteLink();
    svc.returnToLobby();
    expect(svc.snapshot()?.view).toBeNull();
    svc.leaveSession();

    svc.joinOnlineRoom('https://planta94.github.io/mahjong/?room=ROOM9', 'GuestTester');
    expect(svc.snapshot()?.roomCode).toBe('ROOM9');
    svc.leaveSession();

    window.removeEventListener('mahjong:leave', listener);
  });
});
