import {
  AvalonLobbySettings,
  AvalonPlayerView,
  createSerializableMap,
  DEFAULT_AVALON_SETTINGS,
  hydrateAvalonPlayerView,
  NightVisionClue,
  ProposalVote,
} from './avalon.model';

describe('Avalon Domain Models & Hydration', () => {
  it('creates serializable map that includes custom toJSON serializer returning entries array', () => {
    const map = createSerializableMap<number, string>([
      [0, 'Merlin'],
      [1, 'Assassin'],
    ]);

    expect(map.get(0)).toBe('Merlin');
    expect(map.get(1)).toBe('Assassin');

    const jsonString = JSON.stringify({ roles: map });
    expect(jsonString).toBe('{"roles":[[0,"Merlin"],[1,"Assassin"]]}');
  });

  it('hydrates player view when collections are sent over P2P wire as raw arrays or objects', () => {
    const rawWireView: unknown = {
      viewerSeat: 0,
      numPlayers: 5,
      rules: DEFAULT_AVALON_SETTINGS,
      phase: 'team_proposal',
      currentQuest: 1,
      voteTrack: 0,
      currentLeader: 0,
      proposedTeam: [0, 1],
      myRole: 'merlin',
      myLoyalty: 'good',
      nightVision: [
        [0, 'self'],
        [1, 'evil'],
      ],
      players: [],
      lastVoteReveal: {
        approved: true,
        votes: [
          [0, 'approve'],
          [1, 'reject'],
        ],
      },
      lastQuestReveal: null,
      proposalHistory: [
        {
          questNumber: 1,
          attemptNumber: 1,
          leaderSeat: 0,
          proposedTeam: [0, 1],
          votes: { '0': 'approve', '1': 'reject' },
          approved: true,
        },
      ],
      questHistory: [],
      ladyHistory: [],
      privateLadyResult: null,
      winner: null,
      winReason: null,
      finalRoles: { '0': 'merlin', '1': 'assassin' },
      legalActions: {
        canPropose: true,
        requiredTeamSize: 2,
        canVote: false,
        hasVoted: false,
        canSubmitQuestCard: false,
        canOnlyPass: true,
        hasSubmittedQuestCard: false,
        canUseLady: false,
        eligibleLadyTargets: [],
        canAssassinate: false,
        eligibleAssassinationTargets: [],
      },
      logs: ['Initialized'],
    };

    const hydrated = hydrateAvalonPlayerView(rawWireView as AvalonPlayerView);

    expect(hydrated.nightVision instanceof Map).toBe(true);
    expect(hydrated.nightVision.get(0)).toBe('self');
    expect(hydrated.nightVision.get(1)).toBe('evil');

    expect(hydrated.lastVoteReveal?.votes instanceof Map).toBe(true);
    expect(hydrated.lastVoteReveal?.votes.get(0)).toBe('approve');

    expect(hydrated.proposalHistory.at(0)?.votes instanceof Map).toBe(true);
    expect(hydrated.proposalHistory.at(0)?.votes.get(0)).toBe('approve');

    expect(hydrated.finalRoles instanceof Map).toBe(true);
    expect(hydrated.finalRoles?.get(0)).toBe('merlin');
  });
});
