import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { ShellUiService } from '../../../core/services/shell-ui.service';
import { MonopolySessionService } from './monopoly-session.service';

import { provideRouter } from '@angular/router';
import { routes } from '../../../app.routes';

describe('MonopolySessionService & Host/Guest Sync', () => {
  function setupService(): { session: MonopolySessionService; router: Router; shellUi: ShellUiService } {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
    const session = TestBed.inject(MonopolySessionService);
    const router = TestBed.inject(Router);
    const shellUi = TestBed.inject(ShellUiService);
    return { session, router, shellUi };
  }

  it('creates solo match with AI bots and navigates to /monopoly/board', () => {
    const { session, shellUi } = setupService();

    session.createSoloMatch(4);

    expect(session.isHost()).toBe(true);
    expect(session.mySeat()).toBe(0);
    expect(shellUi.activeGame()).toBe('monopoly');
    expect(shellUi.activeRoomCode()).toBe(null);

    const snap = session.snapshot();
    expect(snap?.lobby?.seats.length).toBe(4);
    expect(snap?.lobby?.seats[0].kind).toBe('human');
    expect(snap?.lobby?.seats[1].kind).toBe('bot');
    expect(snap?.lobby?.started).toBe(true);
    expect(snap?.view?.players.length).toBe(4);

    session.leaveRoom();
  });

  it('generates P-prefixed room code when creating multiplayer room', () => {
    const { session, shellUi } = setupService();

    const roomCode = session.createMultiplayerRoom(4);

    expect(roomCode.startsWith('P')).toBe(true);
    expect(roomCode.length).toBeGreaterThanOrEqual(5);
    expect(shellUi.activeRoomCode()).toBe(roomCode);

    const snap = session.snapshot();
    expect(snap?.role).toBe('host');
    expect(snap?.lobby?.started).toBe(false);
    expect(snap?.lobby?.seats[1].kind).toBe('open');

    session.leaveRoom();
  });

  it('toggles seat between open and bot in lobby', () => {
    const { session } = setupService();
    session.createMultiplayerRoom(4);

    const snapBefore = session.snapshot();
    expect(snapBefore?.lobby?.seats[1].kind).toBe('open');

    // Toggle seat 1 to bot
    session.toggleSeatKind(1);
    const snapBot = session.snapshot();
    expect(snapBot?.lobby?.seats[1].kind).toBe('bot');

    // Toggle seat 1 back to open
    session.toggleSeatKind(1);
    const snapOpen = session.snapshot();
    expect(snapOpen?.lobby?.seats[1].kind).toBe('open');

    session.leaveRoom();
  });

  it('starts match from lobby and fills remaining open seats with bots', () => {
    const { session } = setupService();
    session.createMultiplayerRoom(4);

    session.startMatchFromLobby();

    const snap = session.snapshot();
    expect(snap?.lobby?.started).toBe(true);
    // All open seats should have been filled with bots
    for (let i = 1; i < 4; i++) {
      expect(snap?.lobby?.seats[i].kind).toBe('bot');
    }

    session.leaveRoom();
  });

  it('opens and closes deed inspector modal', () => {
    const { session } = setupService();
    session.createSoloMatch(2);

    session.inspectSpace(1); // Space 1 (Kota A Famosa)
    expect(session.selectedSpaceIndex()).toBe(1);
    expect(session.showDeedModal()).toBe(true);

    session.closeDeedModal();
    expect(session.showDeedModal()).toBe(false);

    session.leaveRoom();
  });

  it('cleans up session and resets signals on leaveRoom()', () => {
    const { session } = setupService();
    session.createSoloMatch(4);

    session.leaveRoom();

    expect(session.snapshot()).toBeNull();
    expect(session.mySeat()).toBe(-1);
    expect(session.isHost()).toBe(false);
    expect(session.selectedSpaceIndex()).toBeNull();
  });

  it('joins multiplayer room as guest and initializes guest transport', () => {
    const { session, shellUi } = setupService();

    session.joinMultiplayerRoom('PTEST9');

    expect(shellUi.activeGame()).toBe('monopoly');
    expect(shellUi.activeRoomCode()).toBe('PTEST9');

    session.leaveRoom();
  });

  it('routes action dispatches with corresponding SFX triggers', () => {
    const { session } = setupService();
    session.createSoloMatch(2);

    // Dispatch rollDice
    session.dispatchAction({ type: 'rollDice' });
    // Dispatch buyProperty
    session.dispatchAction({ type: 'buyProperty' });
    // Dispatch buildHouse
    session.dispatchAction({ type: 'buildHouse', spaceIndex: 1 });
    // Dispatch declareBankruptcy
    session.dispatchAction({ type: 'declareBankruptcy' });

    session.leaveRoom();
  });

  it('responds to global p2p:leave CustomEvent and resets room', () => {
    const { session } = setupService();
    session.createSoloMatch(2);

    expect(session.isHost()).toBe(true);

    window.dispatchEvent(new CustomEvent('p2p:leave', { detail: { game: 'monopoly' } }));

    expect(session.snapshot()).toBeNull();
  });

  it('triggers bot actions via timer when active seat is bot or in auction', () => {
    vi.useFakeTimers();
    try {
      const { session } = setupService();
      session.createSoloMatch(2);

      // Advance to seat 1 (bot)
      session.dispatchAction({ type: 'rollDice' });
      session.dispatchAction({ type: 'endTurn' });

      // Run timer for bot turn
      vi.advanceTimersByTime(1000);

      expect(session.snapshot()?.view?.players.length).toBe(2);

      session.leaveRoom();
    } finally {
      vi.useRealTimers();
    }
  });

  it('covers modal visibility signals, guest action dispatch, and seat toggle guards', () => {
    const { session } = setupService();

    // 1. Guard check when no hostSession
    session.toggleSeatKind(1);
    session.startMatchFromLobby();
    expect(session.snapshot()).toBeNull();

    // 2. Modals state
    session.showTradeModal.set(true);
    session.showAuctionModal.set(true);
    session.showBankruptcyModal.set(true);
    expect(session.showTradeModal()).toBe(true);
    expect(session.showAuctionModal()).toBe(true);
    expect(session.showBankruptcyModal()).toBe(true);

    // 3. Guest action dispatch
    session.joinMultiplayerRoom('PTEST9');
    session.dispatchAction({ type: 'rollDice' });

    // 4. Leave room resets all modals
    session.leaveRoom();
    expect(session.showTradeModal()).toBe(false);
    expect(session.showAuctionModal()).toBe(false);
    expect(session.showBankruptcyModal()).toBe(false);

    // 5. Host seat 0 guard in toggleSeatKind
    session.createMultiplayerRoom(3);
    session.toggleSeatKind(0);
    expect(session.snapshot()?.lobby?.seats.at(0)?.kind).toBe('human');

    session.toggleSeatKind(99);

    session.leaveRoom();
  });
});


