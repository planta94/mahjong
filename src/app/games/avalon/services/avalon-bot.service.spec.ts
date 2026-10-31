import { TestBed } from '@angular/core/testing';
import {
  AvalonLobbySettings,
  AvalonPlayerView,
  createSerializableMap,
  NightVisionClue,
  ProposalVote,
} from '../models/avalon.model';
import { AvalonBotService } from './avalon-bot.service';

describe('AvalonBotService & Bayesian Deduction Engine', () => {
  let botService: AvalonBotService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    botService = TestBed.inject(AvalonBotService);
  });

  const baseSettings: AvalonLobbySettings = {
    numPlayers: 5,
    roleConfig: {
      percival: true,
      morgana: true,
      mordred: false,
      oberon: false,
    },
    enableLadyOfLake: false,
  };

  function createMockView(overrides: Partial<AvalonPlayerView> = {}): AvalonPlayerView {
    const nightVision = createSerializableMap<number, NightVisionClue>([
      [0, 'self'],
      [1, 'unknown'],
      [2, 'unknown'],
      [3, 'unknown'],
      [4, 'unknown'],
    ]);

    return {
      viewerSeat: 0,
      numPlayers: 5,
      rules: baseSettings,
      phase: 'team_proposal',
      currentQuest: 1,
      voteTrack: 0,
      currentLeader: 0,
      proposedTeam: [],
      myRole: 'loyal_servant',
      myLoyalty: 'good',
      nightVision,
      players: [
        { seat: 0, name: 'P0', isBot: true, connected: true, isLeader: true, onProposedTeam: false, hasLadyToken: false, hasUsedLady: false },
        { seat: 1, name: 'P1', isBot: true, connected: true, isLeader: false, onProposedTeam: false, hasLadyToken: false, hasUsedLady: false },
        { seat: 2, name: 'P2', isBot: true, connected: true, isLeader: false, onProposedTeam: false, hasLadyToken: false, hasUsedLady: false },
        { seat: 3, name: 'P3', isBot: true, connected: true, isLeader: false, onProposedTeam: false, hasLadyToken: false, hasUsedLady: false },
        { seat: 4, name: 'P4', isBot: true, connected: true, isLeader: false, onProposedTeam: false, hasLadyToken: false, hasUsedLady: false },
      ],
      lastVoteReveal: null,
      lastQuestReveal: null,
      proposalHistory: [],
      questHistory: [],
      ladyHistory: [],
      privateLadyResult: null,
      winner: null,
      winReason: null,
      finalRoles: null,
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
      logs: [],
      ...overrides,
    };
  }

  it('initializes Merlin trust scores with confirmed evil marked at -1.0', () => {
    const nightVision = createSerializableMap<number, NightVisionClue>([
      [0, 'self'],
      [1, 'unknown'],
      [2, 'unknown'],
      [3, 'evil'],
      [4, 'evil'],
    ]);

    const view = createMockView({
      viewerSeat: 0,
      myRole: 'merlin',
      myLoyalty: 'good',
      nightVision,
    });

    const scores = botService.computeTrustScores(view, 0);
    expect(scores.get(0)).toBe(1.0);
    expect(scores.get(3)).toBe(-1.0);
    expect(scores.get(4)).toBe(-1.0);
    expect(scores.get(1)).toBe(0.3);
  });

  it('updates trust scores dynamically from quest failures and proposal voting patterns', () => {
    const view = createMockView({
      questHistory: [
        { questNumber: 1, team: [1, 2], successCount: 1, failCount: 1, requiredFails: 1, outcome: 'fail' },
      ],
      proposalHistory: [
        {
          questNumber: 1,
          attemptNumber: 1,
          leaderSeat: 1,
          proposedTeam: [1, 2],
          votes: createSerializableMap<number, ProposalVote>([
            [0, 'reject'],
            [1, 'approve'],
            [2, 'approve'],
            [3, 'reject'],
            [4, 'approve'],
          ]),
          approved: true,
        },
      ],
    });

    const scores = botService.computeTrustScores(view, 0);

    // Player 1 led and was on failed team -> heavy trust deduction
    expect(scores.get(1)).toBeLessThan(-0.5);

    // Player 3 voted reject on the failed proposal -> gains trust
    expect(scores.get(3)).toBeGreaterThan(0.1);
  });

  it('decides team proposal for Good bot by including self and highest-trust allies', () => {
    const view = createMockView({
      currentLeader: 0,
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
    });

    const action = botService.evaluateAvalonBotAction(view, 0);
    expect(action?.type).toBe('proposeTeam');
    if (action?.type === 'proposeTeam') {
      expect(action.team.length).toBe(2);
      expect(action.team).toContain(0); // Self included
    }
  });

  it('enforces Hammer vote approval for Good bots on 5th attempt', () => {
    const view = createMockView({
      phase: 'team_voting',
      voteTrack: 4, // 5th attempt
      proposedTeam: [1, 2],
      legalActions: {
        canPropose: false,
        requiredTeamSize: 2,
        canVote: true,
        hasVoted: false,
        canSubmitQuestCard: false,
        canOnlyPass: true,
        hasSubmittedQuestCard: false,
        canUseLady: false,
        eligibleLadyTargets: [],
        canAssassinate: false,
        eligibleAssassinationTargets: [],
      },
    });

    const action = botService.evaluateAvalonBotAction(view, 0);
    expect(action).toEqual({ type: 'voteProposal', vote: 'approve' });
  });

  it('forces Evil bot to reject purely Good proposal on 5th attempt (Hammer victory)', () => {
    const nightVision = createSerializableMap<number, NightVisionClue>([
      [4, 'self'],
      [3, 'evil_ally'],
      [0, 'unknown'],
      [1, 'unknown'],
      [2, 'unknown'],
    ]);

    const view = createMockView({
      viewerSeat: 4,
      myRole: 'assassin',
      myLoyalty: 'evil',
      nightVision,
      phase: 'team_voting',
      voteTrack: 4,
      proposedTeam: [0, 1], // Purely Good team
      legalActions: {
        canPropose: false,
        requiredTeamSize: 2,
        canVote: true,
        hasVoted: false,
        canSubmitQuestCard: false,
        canOnlyPass: false,
        hasSubmittedQuestCard: false,
        canUseLady: false,
        eligibleLadyTargets: [],
        canAssassinate: false,
        eligibleAssassinationTargets: [],
      },
    });

    const action = botService.evaluateAvalonBotAction(view, 4);
    expect(action).toEqual({ type: 'voteProposal', vote: 'reject' });
  });

  it('submits success for Good bot and fail for Evil bot on quest execution', () => {
    const goodView = createMockView({
      phase: 'quest_execution',
      proposedTeam: [0, 1],
      legalActions: {
        canPropose: false,
        requiredTeamSize: 2,
        canVote: false,
        hasVoted: false,
        canSubmitQuestCard: true,
        canOnlyPass: true,
        hasSubmittedQuestCard: false,
        canUseLady: false,
        eligibleLadyTargets: [],
        canAssassinate: false,
        eligibleAssassinationTargets: [],
      },
    });

    const goodAction = botService.evaluateAvalonBotAction(goodView, 0);
    expect(goodAction).toEqual({ type: 'submitQuestCard', card: 'success' });

    const evilView = createMockView({
      viewerSeat: 4,
      myRole: 'assassin',
      myLoyalty: 'evil',
      phase: 'quest_execution',
      proposedTeam: [0, 4],
      questHistory: [
        { questNumber: 1, team: [0, 4], successCount: 1, failCount: 1, requiredFails: 1, outcome: 'fail' },
        { questNumber: 2, team: [1, 4], successCount: 1, failCount: 1, requiredFails: 1, outcome: 'fail' },
      ],
      legalActions: {
        canPropose: false,
        requiredTeamSize: 2,
        canVote: false,
        hasVoted: false,
        canSubmitQuestCard: true,
        canOnlyPass: false,
        hasSubmittedQuestCard: false,
        canUseLady: false,
        eligibleLadyTargets: [],
        canAssassinate: false,
        eligibleAssassinationTargets: [],
      },
    });

    // 2 fails already occurred -> 3rd fail wins game -> guaranteed fail
    const evilAction = botService.evaluateAvalonBotAction(evilView, 4);
    expect(evilAction).toEqual({ type: 'submitQuestCard', card: 'fail' });
  });

  it('scores Merlin assassination candidates based on voting accuracy against Evil proposals', () => {
    const nightVision = createSerializableMap<number, NightVisionClue>([
      [4, 'self'],
      [3, 'evil_ally'],
      [0, 'unknown'], // True Merlin
      [1, 'unknown'], // Percival
    ]);

    const view = createMockView({
      viewerSeat: 4,
      myRole: 'assassin',
      myLoyalty: 'evil',
      nightVision,
      phase: 'assassination',
      proposalHistory: [
        // Proposal containing Evil player 3: Player 0 rejected (Merlin knows evil), Player 1 approved
        {
          questNumber: 1,
          attemptNumber: 1,
          leaderSeat: 1,
          proposedTeam: [1, 3],
          votes: createSerializableMap<number, ProposalVote>([
            [0, 'reject'],
            [1, 'approve'],
            [2, 'approve'],
            [3, 'approve'],
            [4, 'approve'],
          ]),
          approved: true,
        },
      ],
      legalActions: {
        canPropose: false,
        requiredTeamSize: 2,
        canVote: false,
        hasVoted: false,
        canSubmitQuestCard: false,
        canOnlyPass: false,
        hasSubmittedQuestCard: false,
        canUseLady: false,
        eligibleLadyTargets: [],
        canAssassinate: true,
        eligibleAssassinationTargets: [0, 1, 2],
      },
    });

    const action = botService.evaluateAvalonBotAction(view, 4);
    expect(action).toEqual({ type: 'assassinateMerlin', targetSeat: 0 });
  });

  it('initializes Percival trust scores with 0.0 for merlin_or_morgana candidates', () => {
    const nightVision = createSerializableMap<number, NightVisionClue>([
      [1, 'self'],
      [0, 'merlin_or_morgana'],
      [2, 'unknown'],
      [3, 'unknown'],
      [4, 'merlin_or_morgana'],
    ]);

    const view = createMockView({
      viewerSeat: 1,
      myRole: 'percival',
      myLoyalty: 'good',
      nightVision,
    });

    const scores = botService.computeTrustScores(view, 1);
    expect(scores.get(1)).toBe(1.0);
    expect(scores.get(0)).toBe(0.0);
    expect(scores.get(4)).toBe(0.0);
  });

  it('selects Lady of the Lake target with highest uncertainty and claims strategic loyalty', () => {
    const goodView = createMockView({
      phase: 'lady_of_lake',
      legalActions: {
        canPropose: false,
        requiredTeamSize: 2,
        canVote: false,
        hasVoted: false,
        canSubmitQuestCard: false,
        canOnlyPass: true,
        hasSubmittedQuestCard: false,
        canUseLady: true,
        eligibleLadyTargets: [1, 2, 3],
        canAssassinate: false,
        eligibleAssassinationTargets: [],
      },
    });

    const goodAction = botService.evaluateAvalonBotAction(goodView, 0);
    expect(goodAction?.type).toBe('useLadyOfLake');
    if (goodAction?.type === 'useLadyOfLake') {
      expect([1, 2, 3]).toContain(goodAction.targetSeat);
    }

    const evilNightVision = createSerializableMap<number, NightVisionClue>([
      [4, 'self'],
      [3, 'evil_ally'],
      [0, 'unknown'],
      [1, 'unknown'],
      [2, 'unknown'],
    ]);

    const evilView = createMockView({
      viewerSeat: 4,
      myRole: 'assassin',
      myLoyalty: 'evil',
      nightVision: evilNightVision,
      phase: 'lady_of_lake',
      legalActions: {
        canPropose: false,
        requiredTeamSize: 2,
        canVote: false,
        hasVoted: false,
        canSubmitQuestCard: false,
        canOnlyPass: false,
        hasSubmittedQuestCard: false,
        canUseLady: true,
        eligibleLadyTargets: [3], // Ally is eligible
        canAssassinate: false,
        eligibleAssassinationTargets: [],
      },
    });

    const evilAction = botService.evaluateAvalonBotAction(evilView, 4);
    expect(evilAction).toEqual({
      type: 'useLadyOfLake',
      targetSeat: 3,
      claimedLoyalty: 'good', // Shields ally by claiming good!
    });
  });

  it('evaluates normal proposal voting thresholds for Evil bot when ally is on team', () => {
    const nightVision = createSerializableMap<number, NightVisionClue>([
      [4, 'self'],
      [3, 'evil_ally'],
      [0, 'unknown'],
      [1, 'unknown'],
      [2, 'unknown'],
    ]);

    const view = createMockView({
      viewerSeat: 4,
      myRole: 'assassin',
      myLoyalty: 'evil',
      nightVision,
      phase: 'team_voting',
      voteTrack: 1,
      proposedTeam: [3, 0], // Contains evil ally 3
      legalActions: {
        canPropose: false,
        requiredTeamSize: 2,
        canVote: true,
        hasVoted: false,
        canSubmitQuestCard: false,
        canOnlyPass: false,
        hasSubmittedQuestCard: false,
        canUseLady: false,
        eligibleLadyTargets: [],
        canAssassinate: false,
        eligibleAssassinationTargets: [],
      },
    });

    const action = botService.evaluateAvalonBotAction(view, 4);
    expect(action).toEqual({ type: 'voteProposal', vote: 'approve' });
  });

  it('evaluates Hammer (5th attempt) proposal for Evil bot, including evil ally and good player', () => {
    const evilNightVision = createSerializableMap<number, NightVisionClue>([
      [4, 'self'],
      [3, 'evil_ally'],
      [0, 'unknown'],
      [1, 'unknown'],
      [2, 'unknown'],
    ]);

    const view = createMockView({
      viewerSeat: 4,
      myRole: 'assassin',
      myLoyalty: 'evil',
      nightVision: evilNightVision,
      currentLeader: 4,
      voteTrack: 4, // Hammer!
      legalActions: {
        canPropose: true,
        requiredTeamSize: 3,
        canVote: false,
        hasVoted: false,
        canSubmitQuestCard: false,
        canOnlyPass: false,
        hasSubmittedQuestCard: false,
        canUseLady: false,
        eligibleLadyTargets: [],
        canAssassinate: false,
        eligibleAssassinationTargets: [],
      },
    });

    const action = botService.evaluateAvalonBotAction(view, 4);
    expect(action?.type).toBe('proposeTeam');
    if (action?.type === 'proposeTeam') {
      expect(action.team.length).toBe(3);
      expect(action.team).toContain(4); // Includes self
    }
  });

  it('evaluates quest card strategies for Evil bots across match states', () => {
    // 1. When 2 quests have already failed -> 3rd fail needed to win match
    const view2Fails = createMockView({
      viewerSeat: 4,
      myRole: 'assassin',
      myLoyalty: 'evil',
      proposedTeam: [4, 0],
      currentQuest: 3,
      questHistory: [
        { questNumber: 1, team: [1, 2], successCount: 1, failCount: 1, requiredFails: 1, outcome: 'fail' },
        { questNumber: 2, team: [2, 3], successCount: 1, failCount: 1, requiredFails: 1, outcome: 'fail' },
      ],
      legalActions: {
        canPropose: false,
        requiredTeamSize: 2,
        canVote: false,
        hasVoted: false,
        canSubmitQuestCard: true,
        canOnlyPass: false,
        hasSubmittedQuestCard: false,
        canUseLady: false,
        eligibleLadyTargets: [],
        canAssassinate: false,
        eligibleAssassinationTargets: [],
      },
    });
    const card2Fails = botService.decideQuestCard(view2Fails);
    expect(card2Fails).toBe('fail');

    // 2. Quest 4 in 7+ players requires 2 fails -> Evil bot always submits fail
    const viewQ4 = createMockView({
      viewerSeat: 4,
      numPlayers: 7,
      myRole: 'assassin',
      myLoyalty: 'evil',
      proposedTeam: [4, 0, 1, 2],
      currentQuest: 4,
      questHistory: [
        { questNumber: 1, team: [0, 1], successCount: 2, failCount: 0, requiredFails: 1, outcome: 'success' },
        { questNumber: 2, team: [0, 1, 2], successCount: 3, failCount: 0, requiredFails: 1, outcome: 'success' },
        { questNumber: 3, team: [0, 1, 2], successCount: 3, failCount: 0, requiredFails: 1, outcome: 'success' },
      ],
    });
    const cardQ4 = botService.decideQuestCard(viewQ4);
    expect(cardQ4).toBe('fail');

    // 3. Quest 2 regular evil decision -> fail
    const viewQ2 = createMockView({
      viewerSeat: 4,
      myRole: 'assassin',
      myLoyalty: 'evil',
      currentQuest: 2,
    });
    const cardQ2 = botService.decideQuestCard(viewQ2);
    expect(cardQ2).toBe('fail');
  });

  it('evaluates Hammer and regular voting rules for Good and Evil bots', () => {
    // Hammer: Good bot must approve to avoid instant defeat
    const goodHammerView = createMockView({
      viewerSeat: 0,
      myLoyalty: 'good',
      voteTrack: 4,
      proposedTeam: [1, 2],
    });
    const goodVote = botService.decideProposalVote(goodHammerView, 0, new Map());
    expect(goodVote).toBe('approve');

    // Hammer: Evil bot with no evil on team -> REJECT for instant evil win
    const evilNightVision = createSerializableMap<number, NightVisionClue>([
      [4, 'self'],
      [3, 'evil_ally'],
      [0, 'unknown'],
      [1, 'unknown'],
      [2, 'unknown'],
    ]);
    const evilHammerView = createMockView({
      viewerSeat: 4,
      myLoyalty: 'evil',
      nightVision: evilNightVision,
      voteTrack: 4,
      proposedTeam: [0, 1], // Pure Good team!
    });
    const evilVote = botService.decideProposalVote(evilHammerView, 4, new Map());
    expect(evilVote).toBe('reject');

    // Regular proposal: Evil bot with pure good team rejects if trust is not high
    const evilRegView = createMockView({
      viewerSeat: 4,
      myLoyalty: 'evil',
      nightVision: evilNightVision,
      voteTrack: 0,
      proposedTeam: [0, 1],
    });
    const evilRegVote = botService.decideProposalVote(evilRegView, 4, new Map([[0, 0.1], [1, 0.1]]));
    expect(evilRegVote).toBe('reject');
  });

  it('updates trust scores from Lady of the Lake history and private results', () => {
    // 1. Private result that target is evil -> score set to -1.0
    const viewWithPrivate = createMockView({
      viewerSeat: 0,
      privateLadyResult: {
        targetSeat: 2,
        loyalty: 'evil',
      },
    });
    const scoresPriv = botService.computeTrustScores(viewWithPrivate, 0);
    expect(scoresPriv.get(2)).toBe(-1.0);

    // 2. Lady history by other players with claimed loyalty
    const viewWithHistory = createMockView({
      viewerSeat: 0,
      ladyHistory: [
        { questNumber: 2, investigatorSeat: 1, targetSeat: 3, claimedLoyalty: 'evil' },
        { questNumber: 3, investigatorSeat: 2, targetSeat: 4, claimedLoyalty: 'good' },
      ],
    });
    const scoresHist = botService.computeTrustScores(viewWithHistory, 0);
    expect(scoresHist.has(3)).toBe(true);
    expect(scoresHist.has(4)).toBe(true);
  });

  it('handles edge case fallbacks for Lady of the Lake and Assassin targets', () => {
    // 1. Empty lady targets fallback
    const viewNoLadyTargets = createMockView({
      legalActions: {
        canPropose: false,
        requiredTeamSize: 2,
        canVote: false,
        hasVoted: false,
        canSubmitQuestCard: false,
        canOnlyPass: true,
        hasSubmittedQuestCard: false,
        canUseLady: true,
        eligibleLadyTargets: [],
        canAssassinate: false,
        eligibleAssassinationTargets: [],
      },
    });
    const ladyRes = botService.decideLadyTarget(viewNoLadyTargets, 0, new Map());
    expect(ladyRes).toEqual({ targetSeat: 0, claimedLoyalty: 'good' });

    // 2. Evil bot framing good player when investigated
    const evilNightVision = createSerializableMap<number, NightVisionClue>([
      [4, 'self'],
      [3, 'evil_ally'],
      [0, 'unknown'],
      [1, 'unknown'],
      [2, 'unknown'],
    ]);
    const viewFrame = createMockView({
      viewerSeat: 4,
      myLoyalty: 'evil',
      nightVision: evilNightVision,
      legalActions: {
        canPropose: false,
        requiredTeamSize: 2,
        canVote: false,
        hasVoted: false,
        canSubmitQuestCard: false,
        canOnlyPass: false,
        hasSubmittedQuestCard: false,
        canUseLady: true,
        eligibleLadyTargets: [1], // Target 1 is unknown/good
        canAssassinate: false,
        eligibleAssassinationTargets: [],
      },
    });
    const frameRes = botService.decideLadyTarget(viewFrame, 4, new Map());
    expect(frameRes).toEqual({ targetSeat: 1, claimedLoyalty: 'evil' });

    // 3. Assassin with empty targets fallback
    const viewNoAssassinTargets = createMockView({
      legalActions: {
        canPropose: false,
        requiredTeamSize: 2,
        canVote: false,
        hasVoted: false,
        canSubmitQuestCard: false,
        canOnlyPass: false,
        hasSubmittedQuestCard: false,
        canUseLady: false,
        eligibleLadyTargets: [],
        canAssassinate: true,
        eligibleAssassinationTargets: [],
      },
    });
    const assassinateRes = botService.decideAssassinationTarget(viewNoAssassinTargets, 4);
    expect(assassinateRes).toBe(0);
  });

  it('deduces 100% confirmed Evil via self-exclusion, resolves Percival Merlin/Morgana pair, and coordinates Evil allies against double-fails', () => {
    // 1. Self-exclusion: Good bot (seat 0) on failed 2-person quest [0, 2] -> seat 2 is -1.0 (100% Evil!)
    const selfExclusionView = createMockView({
      viewerSeat: 0,
      myLoyalty: 'good',
      questHistory: [
        { questNumber: 1, team: [0, 2], successCount: 1, failCount: 1, requiredFails: 1, outcome: 'fail' },
      ],
    });
    const scoresSelfEx = botService.computeTrustScores(selfExclusionView, 0);
    expect(scoresSelfEx.get(2)).toBe(-1.0);

    // 2. Percival cross-deduction: candidates [0, 4]; when 4 fails a quest with Percival (1), 0 is boosted as true Merlin!
    const percivalNv = createSerializableMap<number, NightVisionClue>([
      [1, 'self'],
      [0, 'merlin_or_morgana'],
      [2, 'unknown'],
      [3, 'unknown'],
      [4, 'merlin_or_morgana'],
    ]);
    const percivalView = createMockView({
      viewerSeat: 1,
      myRole: 'percival',
      myLoyalty: 'good',
      nightVision: percivalNv,
      questHistory: [
        { questNumber: 1, team: [1, 4], successCount: 1, failCount: 1, requiredFails: 1, outcome: 'fail' },
      ],
    });
    const percivalScores = botService.computeTrustScores(percivalView, 1);
    expect(percivalScores.get(4)).toBe(-1.0);
    expect(percivalScores.get(0)).toBeGreaterThan(0.8);

    // 3. Coordinated Evil sabotage: when Evil seats 2 and 4 are both on a 1-fail Quest 2, seat 2 fails while seat 4 plays stealth success!
    const evilNvSeat4 = createSerializableMap<number, NightVisionClue>([
      [4, 'self'],
      [2, 'evil_ally'],
      [0, 'unknown'],
      [1, 'unknown'],
      [3, 'unknown'],
    ]);
    const dualEvilSeat4View = createMockView({
      viewerSeat: 4,
      myRole: 'morgana',
      myLoyalty: 'evil',
      nightVision: evilNvSeat4,
      currentQuest: 2,
      proposedTeam: [0, 2, 4],
    });
    expect(botService.decideQuestCard(dualEvilSeat4View)).toBe('success');

    const evilNvSeat2 = createSerializableMap<number, NightVisionClue>([
      [2, 'self'],
      [4, 'evil_ally'],
      [0, 'unknown'],
      [1, 'unknown'],
      [3, 'unknown'],
    ]);
    const dualEvilSeat2View = createMockView({
      viewerSeat: 2,
      myRole: 'assassin',
      myLoyalty: 'evil',
      nightVision: evilNvSeat2,
      currentQuest: 2,
      proposedTeam: [0, 2, 4],
    });
    expect(botService.decideQuestCard(dualEvilSeat2View)).toBe('fail');
  });
});

