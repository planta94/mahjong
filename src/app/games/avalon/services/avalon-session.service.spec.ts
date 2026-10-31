import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { routes } from '../../../app.routes';
import { ShellUiService } from '../../../core/services/shell-ui.service';
import { AvalonLobbySettings } from '../models/avalon.model';
import { AvalonSessionService } from './avalon-session.service';

describe('AvalonSessionService & Host/Guest P2P Sync', () => {
  let session: AvalonSessionService;
  let shellUi: ShellUiService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
    session = TestBed.inject(AvalonSessionService);
    shellUi = TestBed.inject(ShellUiService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    session.leaveRoom();
  });

  it('creates solo match with 1 human and 4 bot seats, navigating to table', () => {
    session.createSoloMatch(5);

    const snap = session.snapshot();
    expect(snap?.role).toBe('host');
    expect(snap?.online).toBe(false);
    expect(session.mySeat()).toBe(0);
    expect(session.isHost()).toBe(true);

    const lobby = session.currentLobby();
    expect(lobby?.seats.length).toBe(5);
    expect(lobby?.seats.at(0)?.kind).toBe('human');
    expect(lobby?.seats.at(1)?.kind).toBe('bot');

    const view = session.currentView();
    expect(view?.numPlayers).toBe(5);
    expect(view?.phase).toBe('team_proposal');
  });

  it('creates multiplayer room with prefix A and open seats', () => {
    const roomCode = session.createMultiplayerRoom(6);

    expect(roomCode.startsWith('A')).toBe(true);
    const snap = session.snapshot();
    expect(snap?.role).toBe('host');
    expect(snap?.online).toBe(true);

    const lobby = session.currentLobby();
    expect(lobby?.seats.length).toBe(6);
    expect(lobby?.seats.at(0)?.kind).toBe('human');
    expect(lobby?.seats.at(1)?.kind).toBe('open');
  });

  it('allows host to toggle seat between open and bot', () => {
    session.createMultiplayerRoom(5);
    const lobbyBefore = session.currentLobby();
    expect(lobbyBefore?.seats.at(1)?.kind).toBe('open');

    session.toggleSeatKind(1);
    const lobbyAfter = session.currentLobby();
    expect(lobbyAfter?.seats.at(1)?.kind).toBe('bot');

    session.toggleSeatKind(1);
    const lobbyReset = session.currentLobby();
    expect(lobbyReset?.seats.at(1)?.kind).toBe('open');
  });

  it('allows host to change player count in lobby between 5 and 10', () => {
    session.createMultiplayerRoom(5);
    expect(session.currentLobby()?.seats.length).toBe(5);

    session.setPlayerCount(8);
    expect(session.currentLobby()?.seats.length).toBe(8);

    session.setPlayerCount(6);
    expect(session.currentLobby()?.seats.length).toBe(6);
  });

  it('starts match from lobby, filling remaining open seats with bots', () => {
    session.createMultiplayerRoom(5);
    expect(session.currentLobby()?.started).toBe(false);

    session.startMatchFromLobby();
    expect(session.currentLobby()?.started).toBe(true);
    expect(session.currentLobby()?.seats.every((s) => s.kind !== 'open')).toBe(true);
    expect(session.currentView()?.phase).toBe('team_proposal');
  });

  it('manages privacy shield toggle and explicit visibility state', () => {
    expect(session.privacyShieldRevealed()).toBe(false);

    session.togglePrivacyShield();
    expect(session.privacyShieldRevealed()).toBe(true);

    session.setPrivacyShield(false);
    expect(session.privacyShieldRevealed()).toBe(false);
  });

  it('cleans up state and resets signals upon leaveRoom', () => {
    session.createSoloMatch(5);
    expect(session.snapshot()?.role).toBe('host');

    session.leaveRoom();
    expect(session.snapshot()).toBe(null);
    expect(session.currentView()).toBe(null);
    expect(session.currentLobby()).toBe(null);
    expect(session.mySeat()).toBe(-1);
  });

  it('updates lobby settings and dispatches actions across host and guests', () => {
    session.createMultiplayerRoom(5);

    session.updateSettings({ enableLadyOfLake: true });
    const rules = session.currentLobby()?.rules as AvalonLobbySettings | undefined;
    expect(rules?.enableLadyOfLake).toBe(true);

    const sfxSpy = vi.spyOn(shellUi, 'playSfx');

    session.dispatchAction({ type: 'proposeTeam', team: [0, 1] });
    expect(sfxSpy).toHaveBeenCalledWith('click');

    session.dispatchAction({ type: 'voteProposal', vote: 'approve' });
    expect(sfxSpy).toHaveBeenCalledWith('click');

    session.dispatchAction({ type: 'submitQuestCard', card: 'success' });
    expect(sfxSpy).toHaveBeenCalledWith('deal');

    session.dispatchAction({ type: 'useLadyOfLake', targetSeat: 1 });
    expect(sfxSpy).toHaveBeenCalledWith('alert');

    session.dispatchAction({ type: 'assassinateMerlin', targetSeat: 0 });
    expect(session.isHost()).toBe(true);
  });

  it('joins room as guest and updates session snapshot', () => {
    session.joinMultiplayerRoom('A9999');

    expect(session.snapshot()?.role).toBe('guest');
    expect(session.snapshot()?.roomCode).toBe('A9999');
    expect(session.isHost()).toBe(false);
  });

  it('handles guest join with empty player nickname fallback', () => {
    shellUi.setPlayerNickname('');
    session.joinMultiplayerRoom('A8888');

    expect(session.snapshot()?.role).toBe('guest');
    expect(session.snapshot()?.roomCode).toBe('A8888');
  });

  it('returns early from lobby methods when no host session is active', () => {
    session.leaveRoom();

    session.startMatchFromLobby();
    session.toggleSeatKind(1);
    session.setPlayerCount(6);
    session.updateSettings({ enableLadyOfLake: true });

    expect(session.snapshot()).toBe(null);
  });

  it('triggers bot automated actions via timer', () => {
    vi.useFakeTimers();
    session.createSoloMatch(5);

    // If bot was elected initial leader, timer triggers proposal
    if (session.currentView()?.currentLeader !== 0) {
      vi.advanceTimersByTime(700);
    } else {
      session.dispatchAction({ type: 'proposeTeam', team: [0, 1] });
    }

    expect(session.currentView()?.phase).toBe('team_voting');

    // Advance timer for bot voters
    vi.advanceTimersByTime(2500);

    vi.useRealTimers();
  });
});

