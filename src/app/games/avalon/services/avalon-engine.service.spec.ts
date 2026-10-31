import { TestBed } from '@angular/core/testing';
import {
  buildRoleDeck,
  getQuestTeamSize,
  getRequiredFails,
  PLAYER_COUNT_RATIOS,
} from '../data/avalon-config.data';
import {
  AvalonLobbySettings,
  AvalonMatchState,
  AvalonRole,
  AvalonSeat,
  createSerializableMap,
} from '../models/avalon.model';
import {
  AvalonEngineService,
  computeNightVisionClues,
  evaluateQuestResult,
  shuffleQuestCards,
} from './avalon-engine.service';

describe('AvalonEngineService & Domain State Machine', () => {
  let service: AvalonEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AvalonEngineService);
  });

  const defaultSeats5: AvalonSeat[] = [
    { seat: 0, kind: 'human', name: 'Knight 1', connected: true },
    { seat: 1, kind: 'bot', name: 'Knight 2', connected: true },
    { seat: 2, kind: 'bot', name: 'Knight 3', connected: true },
    { seat: 3, kind: 'bot', name: 'Knight 4', connected: true },
    { seat: 4, kind: 'bot', name: 'Knight 5', connected: true },
  ];

  const defaultSettings5: AvalonLobbySettings = {
    numPlayers: 5,
    roleConfig: {
      percival: true,
      morgana: true,
      mordred: false,
      oberon: false,
    },
    enableLadyOfLake: false,
  };

  it('initializes match state correctly with 5 players and proper role distributions', () => {
    const state = service.createInitialAvalonState(defaultSettings5, defaultSeats5);

    expect(state.numPlayers).toBe(5);
    expect(state.phase).toBe('team_proposal');
    expect(state.currentQuest).toBe(1);
    expect(state.voteTrack).toBe(0);
    expect(state.players.length).toBe(5);

    const goodCount = state.players.filter((p) => p.loyalty === 'good').length;
    const evilCount = state.players.filter((p) => p.loyalty === 'evil').length;
    expect(goodCount).toBe(3);
    expect(evilCount).toBe(2);

    expect(state.ladyHolderSeat).toBe(null);
  });

  it('assigns Lady of the Lake token to the right of the starting leader when enabled', () => {
    const settingsLady: AvalonLobbySettings = {
      ...defaultSettings5,
      numPlayers: 7,
      enableLadyOfLake: true,
    };
    const seats7: AvalonSeat[] = Array.from({ length: 7 }, (_, i) => ({
      seat: i,
      kind: 'bot',
      name: `Knight ${i + 1}`,
      connected: true,
    }));

    const state = service.createInitialAvalonState(settingsLady, seats7);
    const expectedLadySeat = (state.currentLeader - 1 + 7) % 7;
    expect(state.ladyHolderSeat).toBe(expectedLadySeat);
  });

  it('handles team proposal validation and transitions to team_voting', () => {
    const state = service.createInitialAvalonState(defaultSettings5, defaultSeats5);
    const leader = state.currentLeader;
    const reqSize = getQuestTeamSize(5, 1); // 2

    // Propose invalid team size -> rejected
    service.applyAvalonAction(state, leader, {
      type: 'proposeTeam',
      team: [0],
    });
    expect(state.phase).toBe('team_proposal');

    // Propose by non-leader -> rejected
    const nonLeader = (leader + 1) % 5;
    service.applyAvalonAction(state, nonLeader, {
      type: 'proposeTeam',
      team: [0, 1],
    });
    expect(state.phase).toBe('team_proposal');

    // Valid proposal by leader -> accepted
    service.applyAvalonAction(state, leader, {
      type: 'proposeTeam',
      team: [leader, nonLeader],
    });
    expect(state.phase).toBe('team_voting');
    expect(state.proposedTeam).toEqual([leader, nonLeader]);
  });

  it('processes proposal voting: strict majority approves, advances to quest_execution', () => {
    const state = service.createInitialAvalonState(defaultSettings5, defaultSeats5);
    state.currentLeader = 0;
    state.phase = 'team_proposal';
    service.applyAvalonAction(state, 0, { type: 'proposeTeam', team: [0, 1] });

    // 3 Approves, 2 Rejects
    service.applyAvalonAction(state, 0, { type: 'voteProposal', vote: 'approve' });
    service.applyAvalonAction(state, 1, { type: 'voteProposal', vote: 'approve' });
    service.applyAvalonAction(state, 2, { type: 'voteProposal', vote: 'approve' });
    service.applyAvalonAction(state, 3, { type: 'voteProposal', vote: 'reject' });
    service.applyAvalonAction(state, 4, { type: 'voteProposal', vote: 'reject' });

    expect(state.phase).toBe('quest_execution');
    expect(state.voteTrack).toBe(0);
    expect(state.proposalHistory.length).toBe(1);
    expect(state.proposalHistory.at(0)?.approved).toBe(true);
  });

  it('processes proposal voting rejection: advances vote track, resets leader, triggers Hammer on 5th fail', () => {
    const state = service.createInitialAvalonState(defaultSettings5, defaultSeats5);
    state.currentLeader = 0;

    for (let attempt = 1; attempt <= 4; attempt++) {
      state.phase = 'team_proposal';
      service.applyAvalonAction(state, state.currentLeader, { type: 'proposeTeam', team: [0, 1] });

      // 4 rejects, 1 approve
      for (let s = 0; s < 5; s++) {
        service.applyAvalonAction(state, s, {
          type: 'voteProposal',
          vote: s === 0 ? 'approve' : 'reject',
        });
      }

      expect(state.voteTrack).toBe(attempt);
      expect(state.phase).toBe('team_proposal');
    }

    // 5th attempt (Hammer rejection)
    state.phase = 'team_proposal';
    service.applyAvalonAction(state, state.currentLeader, { type: 'proposeTeam', team: [0, 1] });
    for (let s = 0; s < 5; s++) {
      service.applyAvalonAction(state, s, { type: 'voteProposal', vote: 'reject' });
    }

    expect(state.voteTrack).toBe(5);
    expect(state.winner).toBe('evil');
    expect(state.winReason).toBe('FIVE_REJECTED_TEAMS');
    expect(state.phase).toBe('game_over');
  });

  it('coerces Good players quest card to success and records quest failure when fails meet threshold', () => {
    const state = service.createInitialAvalonState(defaultSettings5, defaultSeats5);
    state.players[0] = { seat: 0, name: 'P0', isBot: false, connected: true, role: 'merlin', loyalty: 'good' };
    state.players[1] = { seat: 1, name: 'P1', isBot: false, connected: true, role: 'assassin', loyalty: 'evil' };

    state.phase = 'quest_execution';
    state.proposedTeam = [0, 1];

    // Good player attempts to submit 'fail' -> coerced to 'success'
    service.applyAvalonAction(state, 0, { type: 'submitQuestCard', card: 'fail' });
    expect(state.questSubmissions.get(0)).toBe('success');

    // Evil player submits 'fail'
    service.applyAvalonAction(state, 1, { type: 'submitQuestCard', card: 'fail' });

    expect(state.questHistory.length).toBe(1);
    expect(state.questHistory.at(0)?.outcome).toBe('fail');
    expect(state.questHistory.at(0)?.failCount).toBe(1);
  });

  it('enforces Special Rule: Quest 4 for 7 players requires 2 fails to fail', () => {
    const reqFails7P = getRequiredFails(7, 4);
    expect(reqFails7P).toBe(2);

    const res1Fail = evaluateQuestResult(['success', 'success', 'success', 'fail'], reqFails7P);
    expect(res1Fail.outcome).toBe('success');

    const res2Fails = evaluateQuestResult(['success', 'success', 'fail', 'fail'], reqFails7P);
    expect(res2Fails.outcome).toBe('fail');
  });

  it('transitions to assassination when Good wins 3 quests, resolving Merlin hit/miss', () => {
    const state = service.createInitialAvalonState(defaultSettings5, defaultSeats5);
    state.players[0] = { seat: 0, name: 'Merlin', isBot: false, connected: true, role: 'merlin', loyalty: 'good' };
    state.players[1] = { seat: 1, name: 'Percival', isBot: false, connected: true, role: 'percival', loyalty: 'good' };
    state.players[2] = { seat: 2, name: 'Loyal', isBot: false, connected: true, role: 'loyal_servant', loyalty: 'good' };
    state.players[3] = { seat: 3, name: 'Assassin', isBot: false, connected: true, role: 'assassin', loyalty: 'evil' };
    state.players[4] = { seat: 4, name: 'Morgana', isBot: false, connected: true, role: 'morgana', loyalty: 'evil' };

    // Simulate 3 successful quests
    state.questHistory = [
      { questNumber: 1, team: [0, 1], successCount: 2, failCount: 0, requiredFails: 1, outcome: 'success' },
      { questNumber: 2, team: [0, 1, 2], successCount: 3, failCount: 0, requiredFails: 1, outcome: 'success' },
    ];
    state.currentQuest = 3;
    state.proposedTeam = [0, 1];
    state.phase = 'quest_execution';

    service.applyAvalonAction(state, 0, { type: 'submitQuestCard', card: 'success' });
    service.applyAvalonAction(state, 1, { type: 'submitQuestCard', card: 'success' });

    expect(state.phase).toBe('assassination');

    // Strike Merlin (seat 0) -> Evil wins
    service.applyAvalonAction(state, 3, { type: 'assassinateMerlin', targetSeat: 0 });
    expect(state.phase).toBe('game_over');
    expect(state.winner).toBe('evil');
    expect(state.winReason).toBe('MERLIN_ASSASSINATED');
  });

  it('delivers Lady of the Lake private result strictly to investigator seat', () => {
    const state = service.createInitialAvalonState(defaultSettings5, defaultSeats5);
    state.rules.enableLadyOfLake = true;
    state.ladyHolderSeat = 0;
    state.phase = 'lady_of_lake';
    state.players[0] = { seat: 0, name: 'P0', isBot: false, connected: true, role: 'loyal_servant', loyalty: 'good' };
    state.players[1] = { seat: 1, name: 'P1', isBot: false, connected: true, role: 'morgana', loyalty: 'evil' };

    service.applyAvalonAction(state, 0, { type: 'useLadyOfLake', targetSeat: 1 });

    expect(state.ladyHolderSeat).toBe(1);
    expect(state.ladyUsedSeats).toContain(0);
    expect(state.phase).toBe('team_proposal');

    // Check player views: investigator sees result, target & others see null
    const invView = service.getAvalonPlayerView(state, 0);
    expect(invView.privateLadyResult).toEqual({ targetSeat: 1, loyalty: 'evil' });

    const targetView = service.getAvalonPlayerView(state, 1);
    expect(targetView.privateLadyResult).toBe(null);

    const bystanderView = service.getAvalonPlayerView(state, 2);
    expect(bystanderView.privateLadyResult).toBe(null);
  });

  it('masks opponent roles as null during match, and reveals finalRoles on game_over', () => {
    const state = service.createInitialAvalonState(defaultSettings5, defaultSeats5);
    state.players[0] = { seat: 0, name: 'P0', isBot: false, connected: true, role: 'merlin', loyalty: 'good' };
    state.players[1] = { seat: 1, name: 'P1', isBot: false, connected: true, role: 'assassin', loyalty: 'evil' };

    const inGameView = service.getAvalonPlayerView(state, 0);
    expect(inGameView.myRole).toBe('merlin');
    expect(inGameView.finalRoles).toBe(null);

    state.phase = 'game_over';
    const gameOverView = service.getAvalonPlayerView(state, 0);
    expect(gameOverView.finalRoles?.get(0)).toBe('merlin');
    expect(gameOverView.finalRoles?.get(1)).toBe('assassin');
  });

  it('triggers Hammer defeat (FIVE_REJECTED_TEAMS) when 5 consecutive proposals are rejected', () => {
    const state = service.createInitialAvalonState(defaultSettings5, defaultSeats5);
    state.currentLeader = 0;

    for (let attempt = 0; attempt < 5; attempt++) {
      expect(state.phase).toBe('team_proposal');
      const leader = state.currentLeader;
      service.applyAvalonAction(state, leader, { type: 'proposeTeam', team: [0, 1] });
      expect(state.phase).toBe('team_voting');

      // All 5 players vote reject
      for (let s = 0; s < 5; s++) {
        service.applyAvalonAction(state, s, { type: 'voteProposal', vote: 'reject' });
      }
    }

    expect(state.phase).toBe('game_over');
    expect(state.winner).toBe('evil');
    expect(state.winReason).toBe('FIVE_REJECTED_TEAMS');
  });

  it('declares Evil victory (THREE_FAILED_QUESTS) when 3 quests fail', () => {
    const state = service.createInitialAvalonState(defaultSettings5, defaultSeats5);
    state.players[0] = { seat: 0, name: 'P0', isBot: false, connected: true, role: 'assassin', loyalty: 'evil' };
    state.players[1] = { seat: 1, name: 'P1', isBot: false, connected: true, role: 'morgana', loyalty: 'evil' };

    state.questHistory = [
      { questNumber: 1, team: [0, 1], successCount: 1, failCount: 1, requiredFails: 1, outcome: 'fail' },
      { questNumber: 2, team: [0, 1], successCount: 1, failCount: 1, requiredFails: 1, outcome: 'fail' },
    ];
    state.currentQuest = 3;
    state.phase = 'quest_execution';
    state.proposedTeam = [0, 1];

    service.applyAvalonAction(state, 0, { type: 'submitQuestCard', card: 'fail' });
    service.applyAvalonAction(state, 1, { type: 'submitQuestCard', card: 'fail' });

    expect(state.phase).toBe('game_over');
    expect(state.winner).toBe('evil');
    expect(state.winReason).toBe('THREE_FAILED_QUESTS');
  });

  it('declares Good victory (THREE_SUCCESSFUL_QUESTS) when 3 quests succeed and no assassin in game', () => {
    const state = service.createInitialAvalonState(defaultSettings5, defaultSeats5);
    state.players[0] = { seat: 0, name: 'P0', isBot: false, connected: true, role: 'merlin', loyalty: 'good' };
    state.players[1] = { seat: 1, name: 'P1', isBot: false, connected: true, role: 'loyal_servant', loyalty: 'good' };
    // Remove assassin from roster to test THREE_SUCCESSFUL_QUESTS branch
    state.players[2] = { seat: 2, name: 'P2', isBot: false, connected: true, role: 'minion', loyalty: 'evil' };
    state.players[3] = { seat: 3, name: 'P3', isBot: false, connected: true, role: 'minion', loyalty: 'evil' };
    state.players[4] = { seat: 4, name: 'P4', isBot: false, connected: true, role: 'loyal_servant', loyalty: 'good' };

    state.questHistory = [
      { questNumber: 1, team: [0, 1], successCount: 2, failCount: 0, requiredFails: 1, outcome: 'success' },
      { questNumber: 2, team: [0, 1], successCount: 2, failCount: 0, requiredFails: 1, outcome: 'success' },
    ];
    state.currentQuest = 3;
    state.phase = 'quest_execution';
    state.proposedTeam = [0, 1];

    service.applyAvalonAction(state, 0, { type: 'submitQuestCard', card: 'success' });
    service.applyAvalonAction(state, 1, { type: 'submitQuestCard', card: 'success' });

    expect(state.phase).toBe('game_over');
    expect(state.winner).toBe('good');
    expect(state.winReason).toBe('THREE_SUCCESSFUL_QUESTS');
  });

  it('declares Good victory (MERLIN_SURVIVED) when assassin strikes a non-Merlin target', () => {
    const state = service.createInitialAvalonState(defaultSettings5, defaultSeats5);
    state.phase = 'assassination';
    state.players[0] = { seat: 0, name: 'Merlin', isBot: false, connected: true, role: 'merlin', loyalty: 'good' };
    state.players[1] = { seat: 1, name: 'Loyal', isBot: false, connected: true, role: 'loyal_servant', loyalty: 'good' };
    state.players[2] = { seat: 2, name: 'Percival', isBot: false, connected: true, role: 'percival', loyalty: 'good' };
    state.players[3] = { seat: 3, name: 'Assassin', isBot: false, connected: true, role: 'assassin', loyalty: 'evil' };
    state.players[4] = { seat: 4, name: 'Morgana', isBot: false, connected: true, role: 'morgana', loyalty: 'evil' };

    // Assassin targets Loyal servant (seat 1) instead of Merlin (seat 0)
    service.applyAvalonAction(state, 3, { type: 'assassinateMerlin', targetSeat: 1 });

    expect(state.phase).toBe('game_over');
    expect(state.winner).toBe('good');
    expect(state.winReason).toBe('MERLIN_SURVIVED');
  });

  it('requires 2 fails on Quest 4 for 7+ players', () => {
    const settings7: AvalonLobbySettings = {
      ...defaultSettings5,
      numPlayers: 7,
    };
    const seats7: AvalonSeat[] = Array.from({ length: 7 }, (_, i) => ({
      seat: i,
      kind: 'bot',
      name: `K${i}`,
      connected: true,
    }));
    const state = service.createInitialAvalonState(settings7, seats7);
    state.players[0] = { seat: 0, name: 'P0', isBot: false, connected: true, role: 'assassin', loyalty: 'evil' };
    state.players[1] = { seat: 1, name: 'P1', isBot: false, connected: true, role: 'morgana', loyalty: 'evil' };
    state.players[2] = { seat: 2, name: 'P2', isBot: false, connected: true, role: 'loyal_servant', loyalty: 'good' };
    state.players[3] = { seat: 3, name: 'P3', isBot: false, connected: true, role: 'loyal_servant', loyalty: 'good' };

    state.currentQuest = 4;
    state.phase = 'quest_execution';
    state.proposedTeam = [0, 1, 2, 3];

    // 1 fail and 3 successes -> Should SUCCEED on Quest 4 in 7p game!
    service.applyAvalonAction(state, 0, { type: 'submitQuestCard', card: 'fail' });
    service.applyAvalonAction(state, 1, { type: 'submitQuestCard', card: 'success' });
    service.applyAvalonAction(state, 2, { type: 'submitQuestCard', card: 'success' });
    service.applyAvalonAction(state, 3, { type: 'submitQuestCard', card: 'success' });

    const q4Record = state.questHistory.find((q) => q.questNumber === 4);
    expect(q4Record?.requiredFails).toBe(2);
    expect(q4Record?.failCount).toBe(1);
    expect(q4Record?.outcome).toBe('success');
  });

  it('enforces safety guards against illegal actions in engine', () => {
    const state = service.createInitialAvalonState(defaultSettings5, defaultSeats5);
    state.players[0] = { seat: 0, name: 'P0', isBot: false, connected: true, role: 'loyal_servant', loyalty: 'good' };
    state.players[3] = { seat: 3, name: 'P3', isBot: false, connected: true, role: 'assassin', loyalty: 'evil' };

    // 1. Propose team with out-of-bounds seats or duplicates
    service.applyAvalonAction(state, state.currentLeader, { type: 'proposeTeam', team: [0, 99] });
    expect(state.phase).toBe('team_proposal');
    service.applyAvalonAction(state, state.currentLeader, { type: 'proposeTeam', team: [0, 0] });
    expect(state.phase).toBe('team_proposal');

    // 2. Voting in non-voting phase
    service.applyAvalonAction(state, 0, { type: 'voteProposal', vote: 'approve' });
    expect(state.currentVotes.size).toBe(0);

    // 3. Submitting quest card in non-quest phase or by non-member
    service.applyAvalonAction(state, 0, { type: 'submitQuestCard', card: 'success' });
    expect(state.questSubmissions.size).toBe(0);

    // 4. Good player submitting 'fail' is coerced to 'success'
    state.phase = 'quest_execution';
    state.proposedTeam = [0, 1];
    service.applyAvalonAction(state, 0, { type: 'submitQuestCard', card: 'fail' });
    expect(state.questSubmissions.get(0)).toBe('success');

    // Submitting again should be ignored
    service.applyAvalonAction(state, 0, { type: 'submitQuestCard', card: 'fail' });
    expect(state.questSubmissions.size).toBe(1);

    // 5. Illegal Lady of the Lake actions
    state.phase = 'lady_of_lake';
    state.ladyHolderSeat = 0;
    // Target self -> ignored
    service.applyAvalonAction(state, 0, { type: 'useLadyOfLake', targetSeat: 0 });
    expect(state.ladyHolderSeat).toBe(0);
    // Target out of bounds -> ignored
    service.applyAvalonAction(state, 0, { type: 'useLadyOfLake', targetSeat: 99 });
    expect(state.ladyHolderSeat).toBe(0);
    // Non-holder calling -> ignored
    service.applyAvalonAction(state, 1, { type: 'useLadyOfLake', targetSeat: 2 });
    expect(state.ladyHolderSeat).toBe(0);

    // 6. Illegal Assassination actions
    state.phase = 'assassination';
    // Non-assassin calling -> ignored
    service.applyAvalonAction(state, 0, { type: 'assassinateMerlin', targetSeat: 1 });
    expect(state.phase).toBe('assassination');
    // Assassin targeting self -> ignored
    service.applyAvalonAction(state, 3, { type: 'assassinateMerlin', targetSeat: 3 });
    expect(state.phase).toBe('assassination');
    // Assassin targeting out of bounds -> ignored
    service.applyAvalonAction(state, 3, { type: 'assassinateMerlin', targetSeat: 99 });
    expect(state.phase).toBe('assassination');
  });
});

