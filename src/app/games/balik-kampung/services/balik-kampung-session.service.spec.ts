import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameSessionManagerService } from '../../../core/services/game-session-manager.service';
import {
  P2PRoomTransportService,
  PeerConstructorLike,
} from '../../../core/services/p2p-room.transport';
import { ShellUiService } from '../../../core/services/shell-ui.service';
import { BalikKampungSessionService } from './balik-kampung-session.service';

const rejectPeerLoader = (): Promise<PeerConstructorLike> =>
  Promise.reject(new Error('offline-test'));

describe('BalikKampungSessionService', () => {
  let service: BalikKampungSessionService;
  let shellUi: ShellUiService;
  let router: Router;
  let gameManager: GameSessionManagerService;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    service = TestBed.inject(BalikKampungSessionService);
    shellUi = TestBed.inject(ShellUiService);
    router = TestBed.inject(Router);
    gameManager = TestBed.inject(GameSessionManagerService);

    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    service.leaveRoom();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('creates solo match, schedules bot plans and moves automatically, and exports/restores save data', () => {
    service.createSoloMatch(3, ['ICE', 'EV', 'ICE'], ['purple', 'emerald', 'red']);

    expect(shellUi.activeGame()).toBe('balik-kampung');
    expect(shellUi.activeRoomCode()).toBe(null);
    expect(service.mySeat()).toBe(0);
    expect(service.isHost()).toBe(true);
    expect(service.myPlayer()?.drivetrain).toBe('ICE');
    expect(service.myPlayer()?.persona).toBe('purple');
    expect(service.currentView()?.players.at(1)?.name).toBe(service.getBotDriverName(0));
    expect(service.currentView()?.players.at(2)?.name).toBe(service.getBotDriverName(1));
    expect(router.navigate).toHaveBeenCalledWith(['/balik-kampung/board']);

    // Human can lock and unlock plan before bots finish planning
    service.selectPlan(3);
    expect(service.myPlayer()?.hasLockedPlan).toBe(true);
    service.unselectPlan();
    expect(service.myPlayer()?.hasLockedPlan).toBe(false);

    // Advance 250ms so bots lock in their secret plans automatically
    vi.advanceTimersByTime(250);
    const viewAfterBots = service.currentView()!;
    expect(viewAfterBots.players.at(1)?.hasLockedPlan).toBe(true);
    expect(viewAfterBots.players.at(2)?.hasLockedPlan).toBe(true);
    expect(viewAfterBots.players.at(0)?.hasLockedPlan).toBe(false);

    // Toggle ICE Fuel Dump and Scout toggle, then select local human plan
    service.togglePendingFuelDump();
    expect(service.pendingFuelDump()).toBe(true);
    service.toggleSpendScoutOnAwas();
    expect(service.spendScoutOnAwas()).toBe(false);

    service.selectPlan(4);
    expect(service.pendingFuelDump()).toBe(false);

    // All 3 plans locked -> transitions to RESOLVING; Seat 0 is at Pole 1 (lead car!)
    expect(service.currentView()?.phase).toBe('RESOLVING');
    expect(service.isMyResolutionTurn()).toBe(true);

    const firstOpt = service.currentView()!.reachableOptions.at(0)!;
    service.commitMove(firstOpt.optionId);

    // Advance timers so Bot 1 and Bot 2 resolve their moves and advance to Round 2
    vi.advanceTimersByTime(1200);
    expect(service.currentView()?.roundNumber).toBe(2);

    // Verify Save & Resume round-trip via GameSessionManagerService
    expect(service.canExportSave()).toBe(true);
    expect(gameManager.saveCurrentProgress()).toBe(true);
    expect(gameManager.savedGame()?.game).toBe('balik-kampung');

    service.leaveRoom();
    expect(service.snapshot()).toBe(null);

    expect(gameManager.resumeSavedGame()).toBe(true);
    expect(service.currentView()?.roundNumber).toBe(2);
    expect(service.mySeat()).toBe(0);
  });

  it('manages online B* multiplayer room seats, drivetrains, match start, restart, and p2p:leave teardown', () => {
    const code = service.createMultiplayerRoom(
      3,
      rejectPeerLoader,
      ['emerald', 'yellow', 'red'],
      ['EV', 'ICE', 'ICE']
    );
    expect(code.startsWith('B')).toBe(true);
    expect(shellUi.activeRoomCode()).toBe(code);
    expect(service.currentLobby()?.seats.length).toBe(3);
    expect(service.currentLobby()?.seats.at(0)?.persona).toBe('emerald');

    // No-op when setting same persona
    service.setSeatPersona(0, 'emerald');
    expect(service.currentLobby()?.seats.at(0)?.persona).toBe('emerald');

    // Resize lobby seats 3 -> 5 -> 2 -> 3
    service.setLobbySeatCount(5);
    expect(service.currentLobby()?.seats.length).toBe(5);
    service.setLobbySeatCount(2);
    expect(service.currentLobby()?.seats.length).toBe(2);
    service.setLobbySeatCount(3);
    expect(service.currentLobby()?.seats.length).toBe(3);

    // Toggle Seat 1 open -> bot -> open
    service.toggleSeatKind(1);
    expect(service.currentLobby()?.seats.at(1)?.kind).toBe('bot');
    service.toggleSeatKind(1);
    expect(service.currentLobby()?.seats.at(1)?.kind).toBe('open');

    // Change Seat 0 drivetrain to EV and swap Seat 0 ('emerald') car persona with Seat 1 ('yellow')
    service.setSeatDrivetrain(0, 'EV');
    expect(service.currentLobby()?.seats.at(0)?.drivetrain).toBe('EV');
    service.setSeatPersona(0, 'yellow');
    expect(service.currentLobby()?.seats.at(0)?.persona).toBe('yellow');
    expect(service.currentLobby()?.seats.at(1)?.persona).toBe('emerald');

    // Start match from lobby -> converts open seats to bots and starts Round 1
    service.startMatchFromLobby();
    expect(service.currentLobby()?.started).toBe(true);
    expect(service.myPlayer()?.drivetrain).toBe('EV');
    expect(service.myPlayer()?.persona).toBe('yellow');

    // Open/close Game Over modal & restartMatch
    service.openGameOverModal();
    expect(service.showGameOverModal()).toBe(true);
    service.closeGameOverModal();
    expect(service.showGameOverModal()).toBe(false);

    service.restartMatch();
    expect(service.currentView()?.roundNumber).toBe(1);

    // Dispatch p2p:leave -> cleans up room
    window.dispatchEvent(
      new CustomEvent('p2p:leave', { detail: { game: 'balik-kampung' } })
    );
    expect(service.snapshot()).toBe(null);
  });

  it('connects guest session over BroadcastChannel and forwards guest drivetrain, persona & card actions', async () => {
    vi.useRealTimers();
    const transport = TestBed.inject(P2PRoomTransportService);
    const roomCode = service.createMultiplayerRoom(3, rejectPeerLoader);
    const rawGuest = transport.createGuest({
      roomCode,
      guestName: 'Guest Mei',
      peerLoader: rejectPeerLoader,
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 120));
      expect(service.currentLobby()?.seats.at(1)?.kind).toBe('human');

      rawGuest.sendAction({ type: 'LOBBY_SET_DRIVETRAIN', drivetrain: 'ICE' });
      rawGuest.sendAction({ type: 'LOBBY_SET_PERSONA', persona: 'purple' });
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(service.currentLobby()?.seats.at(1)?.drivetrain).toBe('ICE');
      expect(service.currentLobby()?.seats.at(1)?.persona).toBe('purple');
    } finally {
      rawGuest.destroy();
    }

    service.joinMultiplayerRoom('B9TEST', rejectPeerLoader);
    expect(service.snapshot()?.role).toBe('guest');
    expect(shellUi.activeRoomCode()).toBe('B9TEST');

    // Simulate seated guest forwarding lobby drivetrain & persona changes
    service.snapshot.set({
      ...service.snapshot()!,
      mySeat: 1,
    });
    service.setSeatDrivetrain(1, 'EV');
    service.setSeatPersona(1, 'emerald');
    expect(service.mySeat()).toBe(1);

    // Guest dispatching actions when not yet seated does not throw
    service.chooseEvCharge('AC_SLOW');
    service.chooseScoutedSimpang('UTAMA');

    expect(service.restoreSaveData({} as never)).toBe(false);
  });
});
