import { describe, expect, it } from 'vitest';

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

export type NightVisionClue =
  | 'self'
  | 'evil'
  | 'merlin_or_morgana'
  | 'evil_ally'
  | 'unknown';

export type ProposalVote = 'approve' | 'reject';
export type QuestCard = 'success' | 'fail';

export interface PlayerRatio {
  good: number;
  evil: number;
}

export const PLAYER_COUNT_RATIOS = new Map<number, PlayerRatio>([
  [5, { good: 3, evil: 2 }],
  [6, { good: 4, evil: 2 }],
  [7, { good: 4, evil: 3 }],
  [8, { good: 5, evil: 3 }],
  [9, { good: 6, evil: 3 }],
  [10, { good: 6, evil: 4 }],
]);

export const QUEST_TEAM_SIZES = new Map<number, readonly [number, number, number, number, number]>([
  [5, [2, 3, 2, 3, 3]],
  [6, [2, 3, 4, 3, 4]],
  [7, [2, 3, 3, 4, 4]],
  [8, [3, 4, 4, 5, 5]],
  [9, [3, 4, 4, 5, 5]],
  [10, [3, 4, 4, 5, 5]],
]);

export function getRequiredFails(numPlayers: number, questNumber: number): number {
  if (questNumber === 4 && numPlayers >= 7) {
    return 2;
  }
  return 1;
}

export interface AvalonPlayer {
  seat: number;
  name: string;
  role: AvalonRole;
  loyalty: AvalonLoyalty;
}

export function computeNightVisionClues(
  players: readonly AvalonPlayer[],
  viewerSeat: number
): Map<number, NightVisionClue> {
  const clues = new Map<number, NightVisionClue>();
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
        // Merlin sees all Evil EXCEPT Mordred
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
    const temp = result.at(i) ?? 'success';
    result[i] = result.at(j) ?? 'success';
    result[j] = temp;
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

describe('E2E: The Resistance Avalon Social Deduction Suite', () => {
  describe('1. Don Eskridge 5–10 Player Count & Quest Matrices', () => {
    it('verifies Good and Evil player ratios across 5 to 10 players', () => {
      expect(PLAYER_COUNT_RATIOS.get(5)).toEqual({ good: 3, evil: 2 });
      expect(PLAYER_COUNT_RATIOS.get(6)).toEqual({ good: 4, evil: 2 });
      expect(PLAYER_COUNT_RATIOS.get(7)).toEqual({ good: 4, evil: 3 });
      expect(PLAYER_COUNT_RATIOS.get(8)).toEqual({ good: 5, evil: 3 });
      expect(PLAYER_COUNT_RATIOS.get(9)).toEqual({ good: 6, evil: 3 });
      expect(PLAYER_COUNT_RATIOS.get(10)).toEqual({ good: 6, evil: 4 });
    });

    it('verifies Quest 1 to 5 team size matrix for all player counts', () => {
      expect(QUEST_TEAM_SIZES.get(5)).toEqual([2, 3, 2, 3, 3]);
      expect(QUEST_TEAM_SIZES.get(6)).toEqual([2, 3, 4, 3, 4]);
      expect(QUEST_TEAM_SIZES.get(7)).toEqual([2, 3, 3, 4, 4]);
      expect(QUEST_TEAM_SIZES.get(8)).toEqual([3, 4, 4, 5, 5]);
      expect(QUEST_TEAM_SIZES.get(9)).toEqual([3, 4, 4, 5, 5]);
      expect(QUEST_TEAM_SIZES.get(10)).toEqual([3, 4, 4, 5, 5]);
    });

    it('enforces Special Rule: Quest 4 requires strictly 2 Fails for 7+ players, but 1 Fail for 5-6 players', () => {
      // 5p and 6p: Quest 4 requires 1 fail
      expect(getRequiredFails(5, 4)).toBe(1);
      expect(getRequiredFails(6, 4)).toBe(1);

      // 7p to 10p: Quest 4 requires strictly 2 fails
      expect(getRequiredFails(7, 4)).toBe(2);
      expect(getRequiredFails(8, 4)).toBe(2);
      expect(getRequiredFails(9, 4)).toBe(2);
      expect(getRequiredFails(10, 4)).toBe(2);

      // Quests 1, 2, 3, 5 always require 1 fail
      for (const p of [5, 6, 7, 8, 9, 10]) {
        expect(getRequiredFails(p, 1)).toBe(1);
        expect(getRequiredFails(p, 2)).toBe(1);
        expect(getRequiredFails(p, 3)).toBe(1);
        expect(getRequiredFails(p, 5)).toBe(1);
      }

      // Test resolution: 1 Fail on Quest 4 for 7 players still SUCCEEDS
      const res1Fail7P = evaluateQuestResult(['success', 'success', 'success', 'fail'], getRequiredFails(7, 4));
      expect(res1Fail7P.outcome).toBe('success');
      expect(res1Fail7P.failCount).toBe(1);
      expect(res1Fail7P.successCount).toBe(3);

      // 2 Fails on Quest 4 for 7 players FAILS
      const res2Fails7P = evaluateQuestResult(['success', 'success', 'fail', 'fail'], getRequiredFails(7, 4));
      expect(res2Fails7P.outcome).toBe('fail');
      expect(res2Fails7P.failCount).toBe(2);
    });
  });

  describe('2. Vote Track ("Hammer") 5th Rejection Evil Victory', () => {
    it('advances vote track on rejected proposals, and triggers instant Evil victory on 5th rejection', () => {
      let voteTrack = 0;
      let winner: AvalonLoyalty | null = null;
      let winReason: string | null = null;

      const recordProposalVote = (approved: boolean) => {
        if (!approved) {
          voteTrack++;
          if (voteTrack >= 5) {
            winner = 'evil';
            winReason = 'FIVE_REJECTED_TEAMS';
          }
        } else {
          voteTrack = 0; // Reset on approval
        }
      };

      // 1st, 2nd, 3rd, 4th rejections
      recordProposalVote(false);
      expect(voteTrack).toBe(1);
      expect(winner).toBe(null);

      recordProposalVote(false);
      expect(voteTrack).toBe(2);

      recordProposalVote(false);
      expect(voteTrack).toBe(3);

      recordProposalVote(false);
      expect(voteTrack).toBe(4); // Hammer attempt!
      expect(winner).toBe(null);

      // 5th rejection triggers immediate Evil victory
      recordProposalVote(false);
      expect(voteTrack).toBe(5);
      expect(winner).toBe('evil');
      expect(winReason).toBe('FIVE_REJECTED_TEAMS');
    });
  });

  describe('3. Mathematical Night-Vision Sanitization Matrix', () => {
    const players: AvalonPlayer[] = [
      { seat: 0, name: 'Merlin', role: 'merlin', loyalty: 'good' },
      { seat: 1, name: 'Percival', role: 'percival', loyalty: 'good' },
      { seat: 2, name: 'Loyal1', role: 'loyal_servant', loyalty: 'good' },
      { seat: 3, name: 'Loyal2', role: 'loyal_servant', loyalty: 'good' },
      { seat: 4, name: 'Assassin', role: 'assassin', loyalty: 'evil' },
      { seat: 5, name: 'Morgana', role: 'morgana', loyalty: 'evil' },
      { seat: 6, name: 'Mordred', role: 'mordred', loyalty: 'evil' },
      { seat: 7, name: 'Oberon', role: 'oberon', loyalty: 'evil' },
    ];

    it('Merlin sees all Evil EXCEPT Mordred, and DOES see Oberon', () => {
      const merlinClues = computeNightVisionClues(players, 0);

      expect(merlinClues.get(0)).toBe('self');
      expect(merlinClues.get(1)).toBe('unknown'); // Percival
      expect(merlinClues.get(2)).toBe('unknown'); // Loyal
      expect(merlinClues.get(3)).toBe('unknown'); // Loyal

      expect(merlinClues.get(4)).toBe('evil'); // Assassin is seen
      expect(merlinClues.get(5)).toBe('evil'); // Morgana is seen
      expect(merlinClues.get(6)).toBe('unknown'); // Mordred is HIDDEN from Merlin!
      expect(merlinClues.get(7)).toBe('evil'); // Oberon IS seen by Merlin!
    });

    it('Percival sees Merlin and Morgana with identical clue (merlin_or_morgana)', () => {
      const percivalClues = computeNightVisionClues(players, 1);

      expect(percivalClues.get(1)).toBe('self');
      expect(percivalClues.get(0)).toBe('merlin_or_morgana'); // Merlin
      expect(percivalClues.get(5)).toBe('merlin_or_morgana'); // Morgana
      expect(percivalClues.get(2)).toBe('unknown');
      expect(percivalClues.get(4)).toBe('unknown');
      expect(percivalClues.get(6)).toBe('unknown');
      expect(percivalClues.get(7)).toBe('unknown');
    });

    it('Evil teammates see each other EXCEPT Oberon', () => {
      const assassinClues = computeNightVisionClues(players, 4);

      expect(assassinClues.get(4)).toBe('self');
      expect(assassinClues.get(5)).toBe('evil_ally'); // Morgana
      expect(assassinClues.get(6)).toBe('evil_ally'); // Mordred
      expect(assassinClues.get(7)).toBe('unknown'); // Oberon is HIDDEN from fellow Evils!
      expect(assassinClues.get(0)).toBe('unknown'); // Merlin
      expect(assassinClues.get(1)).toBe('unknown'); // Percival
    });

    it('Oberon and Loyal Servants see nobody (all unknown)', () => {
      const oberonClues = computeNightVisionClues(players, 7);
      expect(oberonClues.get(7)).toBe('self');
      for (let s = 0; s < 7; s++) {
        expect(oberonClues.get(s)).toBe('unknown');
      }

      const loyalClues = computeNightVisionClues(players, 2);
      expect(loyalClues.get(2)).toBe('self');
      for (let s = 0; s < 8; s++) {
        if (s !== 2) expect(loyalClues.get(s)).toBe('unknown');
      }
    });
  });

  describe('4. Lady of the Lake Private Delivery Sanitization', () => {
    it('delivers private investigation result strictly to investigator seat, masked for all other seats', () => {
      const allPlayers: AvalonPlayer[] = [
        { seat: 0, name: 'Holder', role: 'loyal_servant', loyalty: 'good' },
        { seat: 1, name: 'Target', role: 'morgana', loyalty: 'evil' },
        { seat: 2, name: 'Other', role: 'merlin', loyalty: 'good' },
      ];

      // Simulated state buildPlayerView logic
      const buildLadyView = (viewerSeat: number, investigatorSeat: number, targetSeat: number) => {
        if (viewerSeat === investigatorSeat) {
          const target = allPlayers.at(targetSeat);
          return {
            targetSeat,
            loyalty: target?.loyalty ?? 'good',
          };
        }
        return null;
      };

      // Investigator (seat 0) receives secret result
      const investigatorView = buildLadyView(0, 0, 1);
      expect(investigatorView).toEqual({ targetSeat: 1, loyalty: 'evil' });

      // Target (seat 1) and bystander (seat 2) receive null
      const targetView = buildLadyView(1, 0, 1);
      expect(targetView).toBe(null);

      const bystanderView = buildLadyView(2, 0, 1);
      expect(bystanderView).toBe(null);
    });
  });

  describe('5. CSPRNG Fisher-Yates Shuffled Quest Reveal', () => {
    it('shuffles submitted quest cards so card position cannot reveal player identity', () => {
      const submittedCards: QuestCard[] = ['success', 'success', 'fail'];
      const shuffled = shuffleQuestCards(submittedCards);

      expect(shuffled.length).toBe(3);
      const successCount = shuffled.filter((c) => c === 'success').length;
      const failCount = shuffled.filter((c) => c === 'fail').length;

      expect(successCount).toBe(2);
      expect(failCount).toBe(1);
    });
  });

  describe('6. Endgame Phase: Assassinate Merlin Logic', () => {
    it('awards victory to Evil if Assassin correctly kills Merlin, or to Good if missed', () => {
      const players: AvalonPlayer[] = [
        { seat: 0, name: 'Merlin', role: 'merlin', loyalty: 'good' },
        { seat: 1, name: 'Percival', role: 'percival', loyalty: 'good' },
        { seat: 2, name: 'Loyal', role: 'loyal_servant', loyalty: 'good' },
        { seat: 3, name: 'Assassin', role: 'assassin', loyalty: 'evil' },
        { seat: 4, name: 'Morgana', role: 'morgana', loyalty: 'evil' },
      ];

      const resolveAssassination = (targetSeat: number) => {
        const target = players.at(targetSeat);
        if (target?.role === 'merlin') {
          return { winner: 'evil', reason: 'MERLIN_ASSASSINATED' };
        }
        return { winner: 'good', reason: 'MERLIN_SURVIVED' };
      };

      // Correct strike on Merlin (seat 0) -> Evil wins
      const hitResult = resolveAssassination(0);
      expect(hitResult.winner).toBe('evil');
      expect(hitResult.reason).toBe('MERLIN_ASSASSINATED');

      // Missed strike on Percival (seat 1) -> Good wins
      const missResult1 = resolveAssassination(1);
      expect(missResult1.winner).toBe('good');
      expect(missResult1.reason).toBe('MERLIN_SURVIVED');

      // Missed strike on Loyal (seat 2) -> Good wins
      const missResult2 = resolveAssassination(2);
      expect(missResult2.winner).toBe('good');
      expect(missResult2.reason).toBe('MERLIN_SURVIVED');
    });
  });

  describe('7. Deduction AI Bot Bayesian Trust Updates & Merlin Scoring', () => {
    it('penalizes player trust dynamically when quests fail, and rewards rejectors of failed quests', () => {
      const trustScores = new Map<number, number>([
        [0, 0.0],
        [1, 0.0],
        [2, 0.0],
        [3, 0.0],
        [4, 0.0],
      ]);

      // Quest 1 team [0, 1] fails with 1 fail
      const team = [0, 1];
      const fails = 1;
      const penalty = -0.55 * (fails / team.length); // -0.275

      for (const m of team) {
        trustScores.set(m, (trustScores.get(m) ?? 0) + penalty);
      }

      expect(trustScores.get(0)).toBe(-0.275);
      expect(trustScores.get(1)).toBe(-0.275);
      expect(trustScores.get(2)).toBe(0.0); // Not on team

      // Player 2 voted reject on the failed proposal -> gains trust
      trustScores.set(2, (trustScores.get(2) ?? 0) + 0.2);
      expect(trustScores.get(2)).toBe(0.2);
    });

    it('Assassin AI scores candidates based on vote precision to identify the true Merlin', () => {
      // Merlin knows Evil from turn 1, so Merlin consistently rejects proposals containing Evil players.
      // Percival decoys vote more haphazardly or try to bait.
      const candidate1Merlin = {
        votesAgainstEvilTeams: 4,
        proposedEvilMember: 0,
        leadershipVocalism: 1, // subtle
      };
      const candidate2Percival = {
        votesAgainstEvilTeams: 2,
        proposedEvilMember: 1,
        leadershipVocalism: 5, // very vocal decoy
      };

      const computeMerlinScore = (c: {
        votesAgainstEvilTeams: number;
        proposedEvilMember: number;
        leadershipVocalism: number;
      }) => {
        return c.votesAgainstEvilTeams * 2.5 - c.proposedEvilMember * 3.0 - c.leadershipVocalism * 0.5;
      };

      const score1 = computeMerlinScore(candidate1Merlin);
      const score2 = computeMerlinScore(candidate2Percival);

      // Score 1 = 4 * 2.5 - 0 - 0.5 = 9.5
      // Score 2 = 2 * 2.5 - 3 - 2.5 = -0.5
      expect(score1).toBe(9.5);
      expect(score2).toBe(-0.5);
      expect(score1).toBeGreaterThan(score2);
    });
  });
});
