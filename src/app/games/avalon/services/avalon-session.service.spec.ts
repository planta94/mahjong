import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { routes } from '../../../app.routes';
import {
  GenericGuestSession,
  GenericHostSession,
} from '../../../core/services/p2p-room.transport';
import { ShellUiService } from '../../../core/services/shell-ui.service';
import {
  AvalonLobbySettings,
  AvalonPlayerState,
  DEFAULT_AVALON_SETTINGS,
} from '../models/avalon.model';
import {
  AvalonSessionService,
  SerializedAvalonSave,
} from './avalon-session.service';

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
    vi.useRealTimers();
    vi.restoreAllMocks();
    session.leaveRoom();
  });

  function createBaseSave(): SerializedAvalonSave {
    session.createSoloMatch(5, { enableLadyOfLake: true });
    const exported = session.exportSaveData();
    if (!exported) {
      throw new Error('Expected active solo match to export save data');
    }
    return exported;
  }

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

  it('falls back to default Chinese titles when playerNickname signal is blank across solo, host, and guest modes', () => {
    shellUi.playerNickname.set('');

    session.createSoloMatch();
    expect(session.currentLobby()?.seats.at(0)?.name).toBe('亚瑟骑士');
    expect(session.currentLobby()?.seats.length).toBe(5);

    session.createMultiplayerRoom();
    expect(session.currentLobby()?.seats.at(0)?.name).toBe('圆桌领袖');
    expect(session.currentLobby()?.seats.length).toBe(5);

    session.joinMultiplayerRoom('A7654');
    expect(session.snapshot()?.role).toBe('guest');
    expect(session.snapshot()?.roomCode).toBe('A7654');
  });

  it('reacts to window p2p:leave events targeting avalon or generic detail while ignoring unrelated games', () => {
    session.createSoloMatch(5);
    expect(session.isHost()).toBe(true);

    window.dispatchEvent(
      new CustomEvent('p2p:leave', {
        detail: { game: 'monopoly' },
      })
    );
    expect(session.isHost()).toBe(true);

    window.dispatchEvent(
      new CustomEvent('p2p:leave', {
        detail: { game: 'avalon' },
      })
    );
    expect(session.snapshot()).toBe(null);

    session.createSoloMatch(5);
    expect(session.isHost()).toBe(true);

    window.dispatchEvent(new CustomEvent('p2p:leave'));
    expect(session.snapshot()).toBe(null);
  });

  it('routes dispatchAction through solo host, guest transport, and disconnected guard, playing fail/fanfare SFX on assassination', () => {
    // Disconnected guard: no hostSession or guestSession
    session.leaveRoom();
    session.dispatchAction({ type: 'voteProposal', vote: 'approve' });
    expect(session.snapshot()).toBe(null);

    // Guest routing
    const guestSendSpy = vi.spyOn(GenericGuestSession.prototype, 'sendAction');
    session.joinMultiplayerRoom('A5432');
    session.dispatchAction({ type: 'voteProposal', vote: 'reject' });
    expect(guestSendSpy).toHaveBeenCalledWith({ type: 'voteProposal', vote: 'reject' });

    // Solo host dispatchAction callback
    session.createSoloMatch(5);
    const sfxSpy = vi.spyOn(shellUi, 'playSfx');
    session.dispatchAction({ type: 'proposeTeam', team: [0, 1] });
    expect(sfxSpy).toHaveBeenCalledWith('click');

    // Assassination SFX: Evil victory ('fail' SFX when Merlin is struck) vs Good victory ('fanfare' SFX when missed)
    const base = createBaseSave();
    const roles: readonly [AvalonPlayerState['role'], AvalonPlayerState['loyalty']][] = [
      ['assassin', 'evil'],
      ['merlin', 'good'],
      ['percival', 'good'],
      ['morgana', 'evil'],
      ['loyal_servant', 'good'],
    ];
    const assassinationSave: SerializedAvalonSave = {
      ...base,
      state: {
        ...base.state,
        phase: 'assassination',
        players: base.state.players.map((p, idx) => ({
          ...p,
          role: roles.at(idx)?.[0] ?? 'loyal_servant',
          loyalty: roles.at(idx)?.[1] ?? 'good',
        })),
      },
    };

    sfxSpy.mockClear();
    expect(session.restoreSaveData(assassinationSave)).toBe(true);
    session.dispatchAction({ type: 'assassinateMerlin', targetSeat: 1 });
    expect(session.currentView()?.winner).toBe('evil');
    expect(session.currentView()?.winReason).toBe('MERLIN_ASSASSINATED');
    expect(sfxSpy).toHaveBeenCalledWith('fail');

    sfxSpy.mockClear();
    expect(session.restoreSaveData(assassinationSave)).toBe(true);
    session.dispatchAction({ type: 'assassinateMerlin', targetSeat: 2 });
    expect(session.currentView()?.winner).toBe('good');
    expect(session.currentView()?.winReason).toBe('MERLIN_SURVIVED');
    expect(sfxSpy).toHaveBeenCalledWith('fanfare');
  });

  it('enforces seat toggle, player count clamping, human seat preservation, and started-lobby guards', () => {
    const hostRef: { instance: GenericHostSession<unknown, unknown, unknown> | null } = {
      instance: null,
    };
    const origOnUpdate = GenericHostSession.prototype.onUpdate;
    vi.spyOn(GenericHostSession.prototype, 'onUpdate').mockImplementation(function (
      this: GenericHostSession<unknown, unknown, unknown>,
      fn
    ) {
      hostRef.instance = this;
      return origOnUpdate.call(this, fn);
    });

    session.createMultiplayerRoom(6);

    // Host seat 0 and out-of-range seat 99 are ignored by toggleSeatKind
    session.toggleSeatKind(0);
    session.toggleSeatKind(99);
    expect(session.currentLobby()?.seats.at(0)?.kind).toBe('human');

    // Simulate a human guest joining seat 1 via handleClientMessage
    hostRef.instance?.handleClientMessage(
      { type: 'join', token: 'guest_tok_1', name: 'Sir Gawain' },
      () => {}
    );
    expect(session.currentLobby()?.seats.at(1)?.kind).toBe('human');

    // Toggling a human-occupied seat does not overwrite it
    session.toggleSeatKind(1);
    expect(session.currentLobby()?.seats.at(1)?.kind).toBe('human');

    // Equal player count, min clamp (< 5), and max clamp (> 10)
    session.setPlayerCount(6);
    expect(session.currentLobby()?.seats.length).toBe(6);

    session.setPlayerCount(2);
    expect(session.currentLobby()?.seats.length).toBe(5);

    session.setPlayerCount(14);
    expect(session.currentLobby()?.seats.length).toBe(10);

    // Starting match keeps human seat 1 as human while converting remaining open seats to bots
    session.startMatchFromLobby();
    expect(session.currentLobby()?.started).toBe(true);
    expect(session.currentLobby()?.seats.at(1)?.kind).toBe('human');
    expect(session.currentLobby()?.seats.at(2)?.kind).toBe('bot');

    // Once started, setPlayerCount and updateSettings return early
    session.setPlayerCount(6);
    session.updateSettings({ enableLadyOfLake: true });
    expect(session.currentLobby()?.seats.length).toBe(10);
    expect((session.currentLobby()?.rules as AvalonLobbySettings).enableLadyOfLake).toBe(false);
  });

  it('exports and restores save data with proposal history, vote maps, empty seat fallbacks, and guard checks', () => {
    // Cannot export when idle or in unstarted lobby
    expect(session.canExportSave()).toBe(false);
    expect(session.exportSaveData()).toBe(null);

    session.createMultiplayerRoom(5);
    expect(session.canExportSave()).toBe(false);
    expect(session.exportSaveData()).toBe(null);

    // Reject malformed save payloads
    expect(
      session.restoreSaveData({ lobby: null, state: null } as unknown as SerializedAvalonSave)
    ).toBe(false);

    // Build a started match with proposalHistory and lastVoteReveal populated
    const base = createBaseSave();
    const populatedSave: SerializedAvalonSave = {
      lobby: {
        ...base.lobby,
        seats: base.lobby.seats.map((s) => ({
          ...s,
          name: '',
        })),
      },
      state: {
        ...base.state,
        currentLeader: 0,
        phase: 'team_proposal',
        voteTrack: 1,
        currentVotesEntries: [[0, 'approve']],
        questSubmissionsEntries: [],
        proposalHistory: [
          {
            questNumber: 1,
            attemptNumber: 1,
            leaderSeat: 0,
            proposedTeam: [0, 1],
            votesEntries: [
              [0, 'approve'],
              [1, 'reject'],
              [2, 'reject'],
              [3, 'reject'],
              [4, 'approve'],
            ],
            approved: false,
          },
        ],
        lastVoteReveal: {
          approved: false,
          votesEntries: [
            [0, 'approve'],
            [1, 'reject'],
            [2, 'reject'],
            [3, 'reject'],
            [4, 'approve'],
          ],
        },
      },
    };

    shellUi.playerNickname.set('');
    expect(session.restoreSaveData(populatedSave)).toBe(true);
    expect(session.canExportSave()).toBe(true);
    expect(session.currentLobby()?.seats.at(0)?.name).toBe('亚瑟骑士');
    expect(session.currentLobby()?.seats.at(1)?.name.length).toBeGreaterThan(0);
    expect(session.currentView()?.proposalHistory.length).toBe(1);
    expect(session.currentView()?.lastVoteReveal?.approved).toBe(false);

    // Re-exporting preserves proposalHistory and lastVoteReveal while stripping seat tokens
    const reExported = session.exportSaveData();
    expect(reExported?.lobby.seats.every((s) => s.token === null)).toBe(true);
    expect(reExported?.state.proposalHistory.length).toBe(1);
    expect(reExported?.state.lastVoteReveal?.votesEntries.length).toBe(5);

    // Cannot export once phase reaches game_over
    const gameOverSave: SerializedAvalonSave = {
      ...populatedSave,
      state: {
        ...populatedSave.state,
        phase: 'game_over',
        winner: 'good',
        winReason: 'THREE_SUCCESSFUL_QUESTS',
        lastVoteReveal: null,
      },
    };
    expect(session.restoreSaveData(gameOverSave)).toBe(true);
    expect(session.currentView()?.lastVoteReveal).toBe(null);
    expect(session.canExportSave()).toBe(false);
    expect(session.exportSaveData()).toBe(null);
  });

  it('auto-navigates to /avalon/table when snapshot updates with a started lobby while on /avalon/lobby', async () => {
    await router.navigate(['/avalon/lobby']);
    expect(router.url).toContain('/avalon/lobby');

    session.createMultiplayerRoom(5);
    const navSpy = vi.spyOn(router, 'navigate');

    session.startMatchFromLobby();
    expect(navSpy).toHaveBeenCalledTimes(2);
    expect(navSpy).toHaveBeenCalledWith(['/avalon/table']);
  });

  it('schedules and executes AI bot turns across quest_execution, lady_of_lake, and assassination phases', () => {
    vi.useFakeTimers();

    const base = createBaseSave();
    const deterministicPlayers: AvalonPlayerState[] = [
      { seat: 0, name: 'Arthur', isBot: false, connected: true, role: 'merlin', loyalty: 'good' },
      { seat: 1, name: 'Bot 1', isBot: true, connected: true, role: 'percival', loyalty: 'good' },
      { seat: 2, name: 'Bot 2', isBot: true, connected: true, role: 'loyal_servant', loyalty: 'good' },
      { seat: 3, name: 'Bot 3', isBot: true, connected: true, role: 'morgana', loyalty: 'evil' },
      { seat: 4, name: 'Bot 4', isBot: true, connected: true, role: 'assassin', loyalty: 'evil' },
    ];

    // 1 & 2. Quest 2 execution with human seat 0 already submitted and bots 1 & 2 pending,
    // followed automatically by bot seat 3 using Lady of the Lake after Quest 2 completes!
    const questAndLadySave: SerializedAvalonSave = {
      ...base,
      lobby: {
        ...base.lobby,
        rules: {
          ...DEFAULT_AVALON_SETTINGS,
          numPlayers: 5,
          enableLadyOfLake: true,
        },
      },
      state: {
        ...base.state,
        rules: {
          ...DEFAULT_AVALON_SETTINGS,
          numPlayers: 5,
          enableLadyOfLake: true,
        },
        players: deterministicPlayers,
        phase: 'quest_execution',
        currentQuest: 2,
        currentLeader: 0,
        proposedTeam: [0, 1, 2],
        questSubmissionsEntries: [[0, 'success']],
        questHistory: [
          {
            questNumber: 1,
            team: [0, 1],
            successCount: 2,
            failCount: 0,
            requiredFails: 1,
            outcome: 'success',
          },
        ],
        ladyHolderSeat: 3,
        ladyUsedSeats: [],
      },
    };

    expect(session.restoreSaveData(questAndLadySave)).toBe(true);
    expect(session.currentView()?.phase).toBe('quest_execution');

    // Bot 1 submits after 600ms, Bot 2 submits after another 600ms -> transitions to lady_of_lake
    vi.advanceTimersByTime(650);
    vi.advanceTimersByTime(650);
    expect(session.currentView()?.questHistory.length).toBe(2);
    expect(session.currentView()?.phase).toBe('lady_of_lake');

    // Bot 3 (ladyHolderSeat) investigates after 700ms -> transitions to Quest 3 team_proposal
    vi.advanceTimersByTime(750);
    expect(session.currentView()?.ladyHistory.length).toBe(1);
    expect(session.currentView()?.phase).toBe('team_proposal');

    // 3. Assassination phase with bot seat 4 as Assassin -> strikes after 800ms -> game_over
    const botAssassinSave: SerializedAvalonSave = {
      ...questAndLadySave,
      state: {
        ...questAndLadySave.state,
        phase: 'assassination',
        currentQuest: 3,
        proposedTeam: [],
        questSubmissionsEntries: [],
      },
    };

    expect(session.restoreSaveData(botAssassinSave)).toBe(true);
    expect(session.currentView()?.phase).toBe('assassination');

    vi.advanceTimersByTime(850);
    expect(session.currentView()?.phase).toBe('game_over');
    expect(['good', 'evil']).toContain(session.currentView()?.winner);
  });
});
