import { Injectable } from '@angular/core';
import {
  buildRoleDeck,
  getQuestTeamSize,
  getRequiredFails,
  ROLE_METADATA,
} from '../data/avalon-config.data';
import {
  AvalonAction,
  AvalonLobbySettings,
  AvalonMatchState,
  AvalonPlayerState,
  AvalonPlayerView,
  AvalonPublicPlayer,
  AvalonRole,
  AvalonSeat,
  createSerializableMap,
  NightVisionClue,
  ProposalRecord,
  ProposalVote,
  QuestCard,
  QuestResultRecord,
} from '../models/avalon.model';

export function computeNightVisionClues(
  players: readonly AvalonPlayerState[],
  viewerSeat: number
): Map<number, NightVisionClue> {
  const clues = createSerializableMap<number, NightVisionClue>();
  const viewer = players.at(viewerSeat);
  if (!viewer) return clues;

  for (let i = 0; i < players.length; i++) {
    if (i === viewerSeat) {
      clues.set(i, 'self');
      continue;
    }
    const target = players.at(i);
    if (!target) continue;

    switch (viewer.role) {
      case 'merlin':
        // Merlin sees all Evil EXCEPT Mordred, and DOES see Oberon
        if (target.loyalty === 'evil' && target.role !== 'mordred') {
          clues.set(i, 'evil');
        } else {
          clues.set(i, 'unknown');
        }
        break;

      case 'percival':
        // Percival sees Merlin and Morgana with identical clue
        if (target.role === 'merlin' || target.role === 'morgana') {
          clues.set(i, 'merlin_or_morgana');
        } else {
          clues.set(i, 'unknown');
        }
        break;

      case 'assassin':
      case 'morgana':
      case 'mordred':
      case 'minion':
        // Evil teammates see each other EXCEPT Oberon
        if (target.loyalty === 'evil' && target.role !== 'oberon') {
          clues.set(i, 'evil_ally');
        } else {
          clues.set(i, 'unknown');
        }
        break;

      case 'oberon':
      case 'loyal_servant':
      default:
        // Oberon and Loyal Servants see nobody
        clues.set(i, 'unknown');
        break;
    }
  }

  return clues;
}

export function shuffleQuestCards(cards: QuestCard[]): QuestCard[] {
  const result = [...cards];
  const randomBuffer = new Uint32Array(result.length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(randomBuffer);
  }
  for (let i = result.length - 1; i > 0; i--) {
    const rawRnd = randomBuffer.at(i) ?? Math.floor(Math.random() * 1000);
    const j = rawRnd % (i + 1);
    const tmp = result.at(i);
    const target = result.at(j);
    if (tmp !== undefined && target !== undefined) {
      result.splice(i, 1, target);
      result.splice(j, 1, tmp);
    }
  }
  return result;
}

export function evaluateQuestResult(
  cards: QuestCard[],
  requiredFails: number
): { outcome: 'success' | 'fail'; successCount: number; failCount: number } {
  let successCount = 0;
  let failCount = 0;
  for (const c of cards) {
    if (c === 'fail') failCount++;
    else successCount++;
  }
  const outcome = failCount >= requiredFails ? 'fail' : 'success';
  return { outcome, successCount, failCount };
}

@Injectable({
  providedIn: 'root',
})
export class AvalonEngineService {
  createInitialAvalonState(rules: AvalonLobbySettings, seats: AvalonSeat[]): AvalonMatchState {
    const numPlayers = Math.max(5, Math.min(10, seats.length));
    const deck = buildRoleDeck(numPlayers, rules.roleConfig);

    // Cryptographic Fisher-Yates deck shuffle
    const shuffledRoles = [...deck];
    const randomBuffer = new Uint32Array(shuffledRoles.length);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(randomBuffer);
    }
    for (let i = shuffledRoles.length - 1; i > 0; i--) {
      const rawRnd = randomBuffer.at(i) ?? Math.floor(Math.random() * 1000);
      const j = rawRnd % (i + 1);
      const tmp = shuffledRoles.at(i);
      const target = shuffledRoles.at(j);
      if (tmp !== undefined && target !== undefined) {
        shuffledRoles.splice(i, 1, target);
        shuffledRoles.splice(j, 1, tmp);
      }
    }

    const players: AvalonPlayerState[] = seats.slice(0, numPlayers).map((s, idx) => {
      const role = shuffledRoles.at(idx) ?? 'loyal_servant';
      const meta = ROLE_METADATA.get(role);
      const loyalty = meta?.loyalty ?? 'good';
      return {
        seat: s.seat,
        name: s.name,
        isBot: s.kind === 'bot',
        connected: s.connected,
        role,
        loyalty,
      };
    });

    const startingLeader = Math.floor(Math.random() * numPlayers);
    const ladyHolderSeat = rules.enableLadyOfLake
      ? (startingLeader - 1 + numPlayers) % numPlayers
      : null;

    return {
      rules,
      numPlayers,
      phase: 'team_proposal',
      players,
      currentQuest: 1,
      voteTrack: 0,
      currentLeader: startingLeader,
      proposedTeam: [],
      currentVotes: createSerializableMap<number, ProposalVote>(),
      questSubmissions: createSerializableMap<number, QuestCard>(),
      proposalHistory: [],
      questHistory: [],
      ladyHistory: [],
      ladyHolderSeat,
      ladyUsedSeats: [],
      winner: null,
      winReason: null,
      assassinationTarget: null,
      lastVoteReveal: null,
      lastQuestReveal: null,
      privateLadyResult: null,
      logs: [
        `Game initialized with ${numPlayers} players.`,
        `Quest 1 commences. Knight Leader: ${players.at(startingLeader)?.name ?? `Seat ${startingLeader}`}.`,
      ],
    };
  }

  applyAvalonAction(state: AvalonMatchState, seatIdx: number, action: AvalonAction): void {
    if (state.phase === 'game_over') return;

    switch (action.type) {
      case 'proposeTeam': {
        if (state.phase !== 'team_proposal' || state.currentLeader !== seatIdx) return;
        const requiredSize = getQuestTeamSize(state.numPlayers, state.currentQuest);
        const uniqueSeats = Array.from(new Set(action.team));
        if (uniqueSeats.length !== requiredSize) return;
        const valid = uniqueSeats.every((s) => s >= 0 && s < state.numPlayers);
        if (!valid) return;

        state.proposedTeam = uniqueSeats;
        state.phase = 'team_voting';
        state.currentVotes.clear();
        state.logs.push(
          `Leader ${state.players.at(seatIdx)?.name ?? seatIdx} proposed team: [${uniqueSeats
            .map((s) => state.players.at(s)?.name ?? s)
            .join(', ')}].`
        );
        break;
      }

      case 'voteProposal': {
        if (state.phase !== 'team_voting') return;
        if (state.currentVotes.has(seatIdx)) return;
        if (action.vote !== 'approve' && action.vote !== 'reject') return;

        state.currentVotes.set(seatIdx, action.vote);

        // Check if all players have cast votes
        if (state.currentVotes.size === state.numPlayers) {
          let approves = 0;
          let rejects = 0;
          for (let i = 0; i < state.numPlayers; i++) {
            const v = state.currentVotes.get(i);
            if (v === 'approve') approves++;
            else rejects++;
          }

          const approved = approves > rejects; // Strict majority required
          const record: ProposalRecord = {
            questNumber: state.currentQuest,
            attemptNumber: state.voteTrack + 1,
            leaderSeat: state.currentLeader,
            proposedTeam: [...state.proposedTeam],
            votes: createSerializableMap(state.currentVotes.entries()),
            approved,
          };
          state.proposalHistory.push(record);
          state.lastVoteReveal = {
            votes: createSerializableMap(state.currentVotes.entries()),
            approved,
          };

          if (approved) {
            state.voteTrack = 0;
            state.phase = 'quest_execution';
            state.questSubmissions.clear();
            state.logs.push(
              `Proposal APPROVED (${approves} to ${rejects}). Quest ${state.currentQuest} executing.`
            );
          } else {
            state.voteTrack++;
            state.currentLeader = (state.currentLeader + 1) % state.numPlayers;
            state.proposedTeam = [];

            if (state.voteTrack >= 5) {
              state.winner = 'evil';
              state.winReason = 'FIVE_REJECTED_TEAMS';
              state.phase = 'game_over';
              state.logs.push('5 consecutive proposals rejected! Evil wins via Hammer track.');
            } else {
              state.phase = 'team_proposal';
              state.logs.push(
                `Proposal REJECTED (${approves} to ${rejects}). Vote track: ${state.voteTrack}/5. Next Leader: ${
                  state.players.at(state.currentLeader)?.name ?? state.currentLeader
                }.`
              );
            }
          }
        }
        break;
      }

      case 'submitQuestCard': {
        if (state.phase !== 'quest_execution') return;
        if (!state.proposedTeam.includes(seatIdx)) return;
        if (state.questSubmissions.has(seatIdx)) return;

        const player = state.players.at(seatIdx);
        if (!player) return;

        // Good players can ONLY submit 'success'
        const effectiveCard: QuestCard = player.loyalty === 'good' ? 'success' : action.card;
        state.questSubmissions.set(seatIdx, effectiveCard);

        if (state.questSubmissions.size === state.proposedTeam.length) {
          const rawCards: QuestCard[] = [];
          for (const member of state.proposedTeam) {
            const card = state.questSubmissions.get(member) ?? 'success';
            rawCards.push(card);
          }

          const shuffled = shuffleQuestCards(rawCards);
          const reqFails = getRequiredFails(state.numPlayers, state.currentQuest);
          const { outcome, successCount, failCount } = evaluateQuestResult(shuffled, reqFails);

          const questRecord: QuestResultRecord = {
            questNumber: state.currentQuest,
            team: [...state.proposedTeam],
            successCount,
            failCount,
            requiredFails: reqFails,
            outcome,
          };
          state.questHistory.push(questRecord);
          state.lastQuestReveal = { successCount, failCount, outcome };

          // Count overall outcomes
          const totalSuccess = state.questHistory.filter((q) => q.outcome === 'success').length;
          const totalFails = state.questHistory.filter((q) => q.outcome === 'fail').length;

          if (totalFails >= 3) {
            state.winner = 'evil';
            state.winReason = 'THREE_FAILED_QUESTS';
            state.phase = 'game_over';
            state.logs.push(
              `Quest ${state.currentQuest} FAILED (${failCount} fails). Evil has sabotaged 3 Quests and wins!`
            );
          } else if (totalSuccess >= 3) {
            // Good achieved 3 quests; check if Assassin exists
            const hasAssassin = state.players.some((p) => p.role === 'assassin');
            if (hasAssassin) {
              state.phase = 'assassination';
              state.logs.push(
                `Quest ${state.currentQuest} SUCCEEDED! Good completed 3 Quests. Assassin prepares to strike Merlin...`
              );
            } else {
              state.winner = 'good';
              state.winReason = 'THREE_SUCCESSFUL_QUESTS';
              state.phase = 'game_over';
              state.logs.push(
                `Quest ${state.currentQuest} SUCCEEDED! Good completed 3 Quests and triumphs!`
              );
            }
          } else {
            // Quests continue
            const completedQuestNum = state.currentQuest;
            state.currentQuest++;
            state.voteTrack = 0;
            state.currentLeader = (state.currentLeader + 1) % state.numPlayers;
            state.proposedTeam = [];

            // Check Lady of the Lake trigger (after Quests 2, 3, 4)
            if (
              state.rules.enableLadyOfLake &&
              (completedQuestNum === 2 || completedQuestNum === 3 || completedQuestNum === 4) &&
              state.ladyHolderSeat !== null
            ) {
              state.phase = 'lady_of_lake';
              state.logs.push(
                `Quest ${completedQuestNum} concluded (${outcome.toUpperCase()}). Lady of the Lake awakens! Holder: ${
                  state.players.at(state.ladyHolderSeat)?.name ?? state.ladyHolderSeat
                }.`
              );
            } else {
              state.phase = 'team_proposal';
              state.logs.push(
                `Quest ${completedQuestNum} concluded (${outcome.toUpperCase()}). Quest ${
                  state.currentQuest
                } commences. Leader: ${
                  state.players.at(state.currentLeader)?.name ?? state.currentLeader
                }.`
              );
            }
          }
        }
        break;
      }

      case 'useLadyOfLake': {
        if (state.phase !== 'lady_of_lake' || state.ladyHolderSeat !== seatIdx) return;
        if (
          action.targetSeat === seatIdx ||
          action.targetSeat < 0 ||
          action.targetSeat >= state.numPlayers
        )
          return;
        if (state.ladyUsedSeats.includes(action.targetSeat)) return;

        const target = state.players.at(action.targetSeat);
        if (!target) return;

        state.ladyHistory.push({
          questNumber: state.currentQuest - 1,
          investigatorSeat: seatIdx,
          targetSeat: action.targetSeat,
          claimedLoyalty: action.claimedLoyalty ?? target.loyalty,
        });

        state.privateLadyResult = {
          investigatorSeat: seatIdx,
          targetSeat: action.targetSeat,
          loyalty: target.loyalty,
        };

        state.ladyUsedSeats.push(seatIdx);
        state.ladyHolderSeat = action.targetSeat;
        state.phase = 'team_proposal';
        state.logs.push(
          `Lady Holder ${state.players.at(seatIdx)?.name ?? seatIdx} examined ${
            target.name
          }. Lady token handed to ${target.name}. Quest ${state.currentQuest} begins.`
        );
        break;
      }

      case 'assassinateMerlin': {
        if (state.phase !== 'assassination') return;
        const actor = state.players.at(seatIdx);
        if (actor?.role !== 'assassin') return;
        if (
          action.targetSeat === seatIdx ||
          action.targetSeat < 0 ||
          action.targetSeat >= state.numPlayers
        )
          return;

        const target = state.players.at(action.targetSeat);
        if (!target) return;

        state.assassinationTarget = action.targetSeat;
        state.phase = 'game_over';

        if (target.role === 'merlin') {
          state.winner = 'evil';
          state.winReason = 'MERLIN_ASSASSINATED';
          state.logs.push(
            `Assassin struck ${target.name} (Seat ${action.targetSeat}) — It was MERLIN! Evil steals victory!`
          );
        } else {
          state.winner = 'good';
          state.winReason = 'MERLIN_SURVIVED';
          state.logs.push(
            `Assassin struck ${target.name} (Seat ${action.targetSeat}) — NOT Merlin (${target.role})! Good triumphs!`
          );
        }
        break;
      }
    }
  }

  getAvalonPlayerView(state: AvalonMatchState, viewerSeat: number): AvalonPlayerView {
    const viewer = state.players.at(viewerSeat);
    const myRole = viewer?.role ?? null;
    const myLoyalty = viewer?.loyalty ?? null;
    const nightVision = computeNightVisionClues(state.players, viewerSeat);

    const publicPlayers: AvalonPublicPlayer[] = state.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      isBot: p.isBot,
      connected: p.connected,
      isLeader: p.seat === state.currentLeader,
      onProposedTeam: state.proposedTeam.includes(p.seat),
      hasLadyToken: p.seat === state.ladyHolderSeat,
      hasUsedLady: state.ladyUsedSeats.includes(p.seat),
    }));

    // Private lady result strictly masked for everyone except investigator
    let privateLadyResult: AvalonPlayerView['privateLadyResult'] = null;
    if (state.privateLadyResult && state.privateLadyResult.investigatorSeat === viewerSeat) {
      privateLadyResult = {
        targetSeat: state.privateLadyResult.targetSeat,
        loyalty: state.privateLadyResult.loyalty,
      };
    }

    // Final roles revealed strictly when game is over
    let finalRoles: Map<number, AvalonRole> | null = null;
    if (state.phase === 'game_over') {
      finalRoles = createSerializableMap(state.players.map((p) => [p.seat, p.role]));
    }

    const requiredTeamSize =
      state.phase !== 'game_over'
        ? getQuestTeamSize(state.numPlayers, state.currentQuest)
        : 0;

    const canPropose =
      state.phase === 'team_proposal' && state.currentLeader === viewerSeat;
    const canVote = state.phase === 'team_voting' && !state.currentVotes.has(viewerSeat);
    const hasVoted = state.currentVotes.has(viewerSeat);

    const canSubmitQuestCard =
      state.phase === 'quest_execution' &&
      state.proposedTeam.includes(viewerSeat) &&
      !state.questSubmissions.has(viewerSeat);
    const canOnlyPass = myLoyalty === 'good';
    const hasSubmittedQuestCard = state.questSubmissions.has(viewerSeat);

    const canUseLady = state.phase === 'lady_of_lake' && state.ladyHolderSeat === viewerSeat;
    const eligibleLadyTargets: number[] = [];
    if (canUseLady) {
      for (let s = 0; s < state.numPlayers; s++) {
        if (s !== viewerSeat && !state.ladyUsedSeats.includes(s)) {
          eligibleLadyTargets.push(s);
        }
      }
    }

    const canAssassinate = state.phase === 'assassination' && myRole === 'assassin';
    const eligibleAssassinationTargets: number[] = [];
    if (canAssassinate) {
      for (let s = 0; s < state.numPlayers; s++) {
        if (s !== viewerSeat) {
          eligibleAssassinationTargets.push(s);
        }
      }
    }

    return {
      viewerSeat,
      numPlayers: state.numPlayers,
      rules: state.rules,
      phase: state.phase,
      currentQuest: state.currentQuest,
      voteTrack: state.voteTrack,
      currentLeader: state.currentLeader,
      proposedTeam: [...state.proposedTeam],
      myRole,
      myLoyalty,
      nightVision,
      players: publicPlayers,
      lastVoteReveal: state.lastVoteReveal
        ? {
            approved: state.lastVoteReveal.approved,
            votes: createSerializableMap(state.lastVoteReveal.votes.entries()),
          }
        : null,
      lastQuestReveal: state.lastQuestReveal ? { ...state.lastQuestReveal } : null,
      proposalHistory: state.proposalHistory.map((p) => ({
        ...p,
        votes: createSerializableMap(p.votes.entries()),
      })),
      questHistory: [...state.questHistory],
      ladyHistory: [...state.ladyHistory],
      privateLadyResult,
      winner: state.winner,
      winReason: state.winReason,
      finalRoles,
      legalActions: {
        canPropose,
        requiredTeamSize,
        canVote,
        hasVoted,
        canSubmitQuestCard,
        canOnlyPass,
        hasSubmittedQuestCard,
        canUseLady,
        eligibleLadyTargets,
        canAssassinate,
        eligibleAssassinationTargets,
      },
      logs: [...state.logs],
    };
  }
}
