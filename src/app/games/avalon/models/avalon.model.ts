import { GenericSeat } from '../../../core/models/party.model';

export type AvalonLoyalty = 'good' | 'evil';

export type AvalonRole =
  | 'merlin'
  | 'percival'
  | 'loyal_servant'
  | 'assassin'
  | 'morgana'
  | 'mordred'
  | 'oberon'
  | 'minion';

export type AvalonPhase =
  | 'lobby'
  | 'team_proposal'
  | 'team_voting'
  | 'quest_execution'
  | 'lady_of_lake'
  | 'assassination'
  | 'game_over';

export type ProposalVote = 'approve' | 'reject';
export type QuestCard = 'success' | 'fail';

export type NightVisionClue =
  | 'self'
  | 'evil'
  | 'merlin_or_morgana'
  | 'evil_ally'
  | 'unknown';

export type AvalonWinReason =
  | 'THREE_SUCCESSFUL_QUESTS'
  | 'THREE_FAILED_QUESTS'
  | 'FIVE_REJECTED_TEAMS'
  | 'MERLIN_ASSASSINATED'
  | 'MERLIN_SURVIVED';

export interface AvalonRoleConfig {
  percival: boolean;
  morgana: boolean;
  mordred: boolean;
  oberon: boolean;
}

export interface AvalonLobbySettings {
  numPlayers: number; // 5 to 10
  roleConfig: AvalonRoleConfig;
  enableLadyOfLake: boolean;
}

export const DEFAULT_AVALON_SETTINGS: AvalonLobbySettings = {
  numPlayers: 5,
  roleConfig: {
    percival: true,
    morgana: true,
    mordred: false,
    oberon: false,
  },
  enableLadyOfLake: false,
};

export interface AvalonSeat extends GenericSeat {
  seat: number;
  kind: 'human' | 'bot' | 'open';
  name: string;
  token?: string | null;
  connected: boolean;
  role?: AvalonRole;
  loyalty?: AvalonLoyalty;
}

export interface AvalonPlayerState {
  readonly seat: number;
  readonly name: string;
  readonly isBot: boolean;
  readonly connected: boolean;
  readonly role: AvalonRole;
  readonly loyalty: AvalonLoyalty;
}

export interface AvalonPublicPlayer {
  readonly seat: number;
  readonly name: string;
  readonly isBot: boolean;
  readonly connected: boolean;
  readonly isLeader: boolean;
  readonly onProposedTeam: boolean;
  readonly hasLadyToken: boolean;
  readonly hasUsedLady: boolean;
}

export interface ProposalRecord {
  readonly questNumber: number;
  readonly attemptNumber: number;
  readonly leaderSeat: number;
  readonly proposedTeam: readonly number[];
  readonly votes: Map<number, ProposalVote>;
  readonly approved: boolean;
}

export interface QuestResultRecord {
  readonly questNumber: number;
  readonly team: readonly number[];
  readonly successCount: number;
  readonly failCount: number;
  readonly requiredFails: number;
  readonly outcome: 'success' | 'fail';
}

export interface LadyInvestigationRecord {
  readonly questNumber: number;
  readonly investigatorSeat: number;
  readonly targetSeat: number;
  readonly claimedLoyalty?: AvalonLoyalty;
}

export interface AvalonLegalActions {
  readonly canPropose: boolean;
  readonly requiredTeamSize: number;
  readonly canVote: boolean;
  readonly hasVoted: boolean;
  readonly canSubmitQuestCard: boolean;
  readonly canOnlyPass: boolean;
  readonly hasSubmittedQuestCard: boolean;
  readonly canUseLady: boolean;
  readonly eligibleLadyTargets: readonly number[];
  readonly canAssassinate: boolean;
  readonly eligibleAssassinationTargets: readonly number[];
}

export interface AvalonMatchState {
  readonly rules: AvalonLobbySettings;
  readonly numPlayers: number;
  phase: AvalonPhase;
  players: AvalonPlayerState[];
  currentQuest: number; // 1 to 5
  voteTrack: number; // 0 to 5
  currentLeader: number; // 0 to numPlayers - 1
  proposedTeam: number[];
  currentVotes: Map<number, ProposalVote>;
  questSubmissions: Map<number, QuestCard>;
  proposalHistory: ProposalRecord[];
  questHistory: QuestResultRecord[];
  ladyHistory: LadyInvestigationRecord[];
  ladyHolderSeat: number | null;
  ladyUsedSeats: number[];
  winner: AvalonLoyalty | null;
  winReason: AvalonWinReason | null;
  assassinationTarget: number | null;
  lastVoteReveal: {
    votes: Map<number, ProposalVote>;
    approved: boolean;
  } | null;
  lastQuestReveal: {
    successCount: number;
    failCount: number;
    outcome: 'success' | 'fail';
  } | null;
  privateLadyResult: {
    investigatorSeat: number;
    targetSeat: number;
    loyalty: AvalonLoyalty;
  } | null;
  logs: string[];
}

export interface AvalonPlayerView {
  readonly viewerSeat: number;
  readonly numPlayers: number;
  readonly rules: AvalonLobbySettings;
  readonly phase: AvalonPhase;
  readonly currentQuest: number;
  readonly voteTrack: number;
  readonly currentLeader: number;
  readonly proposedTeam: readonly number[];
  readonly myRole: AvalonRole | null;
  readonly myLoyalty: AvalonLoyalty | null;
  readonly nightVision: Map<number, NightVisionClue>;
  readonly players: readonly AvalonPublicPlayer[];
  readonly lastVoteReveal: {
    votes: Map<number, ProposalVote>;
    approved: boolean;
  } | null;
  readonly lastQuestReveal: {
    successCount: number;
    failCount: number;
    outcome: 'success' | 'fail';
  } | null;
  readonly proposalHistory: readonly ProposalRecord[];
  readonly questHistory: readonly QuestResultRecord[];
  readonly ladyHistory: readonly LadyInvestigationRecord[];
  readonly privateLadyResult: {
    targetSeat: number;
    loyalty: AvalonLoyalty;
  } | null;
  readonly winner: AvalonLoyalty | null;
  readonly winReason: AvalonWinReason | null;
  readonly finalRoles: Map<number, AvalonRole> | null;
  readonly legalActions: AvalonLegalActions;
  readonly logs: readonly string[];
}

export type AvalonAction =
  | { type: 'proposeTeam'; team: number[] }
  | { type: 'voteProposal'; vote: ProposalVote }
  | { type: 'submitQuestCard'; card: QuestCard }
  | { type: 'useLadyOfLake'; targetSeat: number; claimedLoyalty?: AvalonLoyalty }
  | { type: 'assassinateMerlin'; targetSeat: number };

export function createSerializableMap<K, V>(
  entries?: Iterable<readonly [K, V]>
): Map<K, V> {
  const map = new Map<K, V>(entries);
  Object.defineProperty(map, 'toJSON', {
    value: () => Array.from(map.entries()),
    enumerable: false,
    configurable: true,
  });
  return map;
}

function coerceToMap<K, V>(input: unknown): Map<K, V> {
  if (input instanceof Map) {
    return createSerializableMap(input.entries());
  }
  if (Array.isArray(input)) {
    return createSerializableMap(input as [K, V][]);
  }
  if (typeof input === 'object' && input !== null) {
    const entries = Object.entries(input).map(([k, v]) => {
      const numKey = Number(k);
      const parsedKey = !Number.isNaN(numKey) && String(numKey) === k ? numKey : k;
      return [parsedKey, v] as unknown as [K, V];
    });
    return createSerializableMap(entries);
  }
  return createSerializableMap();
}

export function hydrateAvalonPlayerView(raw: AvalonPlayerView): AvalonPlayerView {
  const nightVision = coerceToMap<number, NightVisionClue>(raw.nightVision);

  let lastVoteReveal: AvalonPlayerView['lastVoteReveal'] = null;
  if (raw.lastVoteReveal) {
    lastVoteReveal = {
      approved: raw.lastVoteReveal.approved,
      votes: coerceToMap<number, ProposalVote>(raw.lastVoteReveal.votes),
    };
  }

  const proposalHistory = (raw.proposalHistory ?? []).map((p) => ({
    ...p,
    votes: coerceToMap<number, ProposalVote>(p.votes),
  }));

  const finalRoles = raw.finalRoles ? coerceToMap<number, AvalonRole>(raw.finalRoles) : null;

  return {
    ...raw,
    nightVision,
    lastVoteReveal,
    proposalHistory,
    finalRoles,
  };
}
