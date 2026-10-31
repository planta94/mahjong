import { Injectable } from '@angular/core';
import {
  AvalonAction,
  AvalonLoyalty,
  AvalonPlayerView,
  ProposalVote,
  QuestCard,
} from '../models/avalon.model';

@Injectable({
  providedIn: 'root',
})
export class AvalonBotService {
  computeTrustScores(view: AvalonPlayerView, botSeat: number): Map<number, number> {
    const scores = new Map<number, number>();
    const percivalCandidates: number[] = [];

    // 1. Initial priors based on role knowledge & night vision
    for (let s = 0; s < view.numPlayers; s++) {
      if (s === botSeat) {
        scores.set(s, 1.0);
        continue;
      }

      const clue = view.nightVision.get(s) ?? 'unknown';

      if (view.myLoyalty === 'evil' && view.myRole !== 'oberon') {
        if (clue === 'evil_ally') {
          scores.set(s, 1.0); // Ally
        } else {
          scores.set(s, -0.7); // Presumed Good opponent
        }
      } else if (view.myRole === 'merlin') {
        if (clue === 'evil') {
          scores.set(s, -1.0); // Confirmed Evil (except Mordred)
        } else {
          scores.set(s, 0.3); // Possible Good or Mordred
        }
      } else if (view.myRole === 'percival') {
        if (clue === 'merlin_or_morgana') {
          percivalCandidates.push(s);
          scores.set(s, 0.0); // Ambiguous between Merlin and Morgana until cross-referenced
        } else {
          scores.set(s, 0.0);
        }
      } else {
        // Loyal servant or Oberon
        scores.set(s, 0.0);
      }
    }

    // If Percival sees only 1 candidate (Morgana disabled), that seat is 100% confirmed Merlin!
    if (view.myRole === 'percival' && percivalCandidates.length === 1) {
      const soleMerlin = percivalCandidates.at(0);
      if (typeof soleMerlin === 'number') {
        scores.set(soleMerlin, 1.0);
      }
    }

    // 2. Dynamic updates from Quest History (including exact self-exclusion elimination)
    for (const q of view.questHistory) {
      if (q.outcome === 'fail') {
        const suspectMembers = q.team.filter((m) => !(m === botSeat && view.myLoyalty === 'good'));
        const confirmedAllSuspectsEvil =
          suspectMembers.length > 0 && q.failCount >= suspectMembers.length;
        const penalty = -0.55 * (q.failCount / Math.max(1, suspectMembers.length));

        for (const member of suspectMembers) {
          const cur = scores.get(member) ?? 0;
          if (confirmedAllSuspectsEvil) {
            scores.set(member, -1.0); // Mathematically confirmed Evil!
          } else {
            scores.set(member, Math.max(-1.0, cur + penalty));
          }
        }
      } else {
        // Success bonus
        for (const member of q.team) {
          if (member === botSeat) continue;
          const cur = scores.get(member) ?? 0;
          scores.set(member, Math.min(1.0, cur + 0.15));
        }
      }
    }

    // 3. Dynamic updates from Proposal History & Voting Behavior
    for (const p of view.proposalHistory) {
      // Find outcome of this quest if completed
      const questRes = view.questHistory.find((q) => q.questNumber === p.questNumber);
      if (!questRes) continue;

      if (questRes.outcome === 'fail' && p.approved) {
        // Proposer proposed a team that failed
        if (p.leaderSeat !== botSeat) {
          const leaderCur = scores.get(p.leaderSeat) ?? 0;
          scores.set(p.leaderSeat, Math.max(-1.0, leaderCur - 0.35));
        }

        // Voters who approved the failed team receive trust penalty
        for (let s = 0; s < view.numPlayers; s++) {
          if (s === botSeat) continue;
          const vote = p.votes.get(s);
          const cur = scores.get(s) ?? 0;
          if (vote === 'approve') {
            scores.set(s, Math.max(-1.0, cur - 0.25));
          } else if (vote === 'reject') {
            scores.set(s, Math.min(1.0, cur + 0.2));
          }
        }
      } else if (questRes.outcome === 'success' && p.approved) {
        // Proposer proposed a winning team
        if (p.leaderSeat !== botSeat) {
          const leaderCur = scores.get(p.leaderSeat) ?? 0;
          scores.set(p.leaderSeat, Math.min(1.0, leaderCur + 0.25));
        }

        // Voters who approved winning team gain trust
        for (let s = 0; s < view.numPlayers; s++) {
          if (s === botSeat) continue;
          const vote = p.votes.get(s);
          const cur = scores.get(s) ?? 0;
          if (vote === 'approve') {
            scores.set(s, Math.min(1.0, cur + 0.15));
          }
        }
      }
    }

    // 4. Update from Lady of the Lake results
    if (view.privateLadyResult) {
      // Direct ground truth for this bot
      const target = view.privateLadyResult.targetSeat;
      scores.set(target, view.privateLadyResult.loyalty === 'good' ? 1.0 : -1.0);
    }

    for (const lady of view.ladyHistory) {
      if (lady.investigatorSeat === botSeat) continue;
      const invTrust = scores.get(lady.investigatorSeat) ?? 0;
      if (lady.claimedLoyalty) {
        const curTarget = scores.get(lady.targetSeat) ?? 0;
        const delta = (lady.claimedLoyalty === 'good' ? 0.4 : -0.4) * invTrust;
        scores.set(lady.targetSeat, Math.max(-1.0, Math.min(1.0, curTarget + delta)));
      }
    }

    // 5. Percival cross-deduction: if one Merlin/Morgana candidate acts suspiciously, boost the other as true Merlin
    if (view.myRole === 'percival' && percivalCandidates.length === 2) {
      const c0 = percivalCandidates.at(0);
      const c1 = percivalCandidates.at(1);
      if (typeof c0 === 'number' && typeof c1 === 'number') {
        const t0 = scores.get(c0) ?? 0;
        const t1 = scores.get(c1) ?? 0;
        if (t0 <= -0.2 && t1 > t0) {
          scores.set(c1, Math.min(1.0, t1 + Math.abs(t0) * 0.85));
        } else if (t1 <= -0.2 && t0 > t1) {
          scores.set(c0, Math.min(1.0, t0 + Math.abs(t1) * 0.85));
        }
      }
    }

    return scores;
  }

  evaluateAvalonBotAction(view: AvalonPlayerView, botSeat: number): AvalonAction | null {
    if (view.phase === 'game_over') return null;
    const trustScores = this.computeTrustScores(view, botSeat);

    switch (view.phase) {
      case 'team_proposal': {
        if (!view.legalActions.canPropose || view.currentLeader !== botSeat) return null;
        const team = this.decideTeamProposal(view, botSeat, trustScores);
        return { type: 'proposeTeam', team };
      }

      case 'team_voting': {
        if (!view.legalActions.canVote || view.legalActions.hasVoted) return null;
        const vote = this.decideProposalVote(view, botSeat, trustScores);
        return { type: 'voteProposal', vote };
      }

      case 'quest_execution': {
        if (
          !view.legalActions.canSubmitQuestCard ||
          view.legalActions.hasSubmittedQuestCard ||
          !view.proposedTeam.includes(botSeat)
        ) {
          return null;
        }
        const card = this.decideQuestCard(view);
        return { type: 'submitQuestCard', card };
      }

      case 'lady_of_lake': {
        if (!view.legalActions.canUseLady || view.legalActions.eligibleLadyTargets.length === 0) {
          return null;
        }
        const { targetSeat, claimedLoyalty } = this.decideLadyTarget(view, botSeat, trustScores);
        return { type: 'useLadyOfLake', targetSeat, claimedLoyalty };
      }

      case 'assassination': {
        if (
          !view.legalActions.canAssassinate ||
          view.legalActions.eligibleAssassinationTargets.length === 0
        ) {
          return null;
        }
        const targetSeat = this.decideAssassinationTarget(view, botSeat);
        return { type: 'assassinateMerlin', targetSeat };
      }

      default:
        return null;
    }
  }

  decideTeamProposal(
    view: AvalonPlayerView,
    botSeat: number,
    trustScores: Map<number, number>
  ): number[] {
    const requiredSize = view.legalActions.requiredTeamSize;

    if (view.myLoyalty === 'good') {
      // Good bot always includes self
      const candidates: { seat: number; trust: number }[] = [];
      for (let s = 0; s < view.numPlayers; s++) {
        if (s !== botSeat) {
          candidates.push({ seat: s, trust: trustScores.get(s) ?? 0 });
        }
      }
      candidates.sort((a, b) => b.trust - a.trust);
      const chosen = [botSeat, ...candidates.slice(0, requiredSize - 1).map((c) => c.seat)];
      return chosen.sort((a, b) => a - b);
    } else {
      // Evil bot strategy
      const evilAllies: number[] = [];
      const goodOpponents: { seat: number; trust: number }[] = [];

      for (let s = 0; s < view.numPlayers; s++) {
        if (s === botSeat) continue;
        const clue = view.nightVision.get(s);
        if (clue === 'evil_ally') {
          evilAllies.push(s);
        } else {
          goodOpponents.push({ seat: s, trust: trustScores.get(s) ?? 0 });
        }
      }

      goodOpponents.sort((a, b) => b.trust - a.trust); // Pick unsuspecting good players

      // If Hammer (Vote track 4), include self + ally (if room) + unsuspecting good players
      if (view.voteTrack === 4) {
        const team = [botSeat];
        if (evilAllies.length > 0 && requiredSize > 2 && Math.random() < 0.5) {
          team.push(evilAllies.at(0) ?? botSeat);
        }
        for (const g of goodOpponents) {
          if (team.length < requiredSize) {
            team.push(g.seat);
          }
        }
        return team.sort((a, b) => a - b);
      }

      // Early / regular quests: Propose self + high-trust good players
      const team = [botSeat];
      for (const g of goodOpponents) {
        if (team.length < requiredSize) {
          team.push(g.seat);
        }
      }
      return team.sort((a, b) => a - b);
    }
  }

  decideProposalVote(
    view: AvalonPlayerView,
    botSeat: number,
    trustScores: Map<number, number>
  ): ProposalVote {
    // 1. Hammer attempt priority (Vote track 4 = 5th attempt)
    if (view.voteTrack === 4) {
      if (view.myLoyalty === 'good') {
        // Good players MUST approve to prevent instant defeat
        return 'approve';
      } else {
        // Evil bot checks if any evil is on team
        const hasEvilOnTeam = view.proposedTeam.some(
          (s) => s === botSeat || view.nightVision.get(s) === 'evil_ally'
        );
        // If an Evil is on team, approve (quest can fail). If purely good, REJECT to win immediately!
        return hasEvilOnTeam ? 'approve' : 'reject';
      }
    }

    // 2. Regular proposal evaluation
    let totalTrust = 0;
    for (const member of view.proposedTeam) {
      let score = trustScores.get(member) ?? 0;
      if (member === botSeat) {
        score += 0.25; // Self-inclusion bias
      }
      totalTrust += score;
    }

    const avgTrust = totalTrust / Math.max(1, view.proposedTeam.length);

    // If bot is Evil, be more strategic
    if (view.myLoyalty === 'evil') {
      const hasEvilOnTeam = view.proposedTeam.some(
        (s) => s === botSeat || view.nightVision.get(s) === 'evil_ally'
      );
      if (hasEvilOnTeam) {
        return avgTrust >= -0.2 ? 'approve' : 'reject';
      }
      // Pure Good team: reject unless blending in
      return avgTrust > 0.4 ? 'approve' : 'reject';
    }

    // Good bot threshold: strictly block confirmed/heavily suspected Evil, especially on decisive quests
    const hasConfirmedEvil = view.proposedTeam.some((m) => (trustScores.get(m) ?? 0) <= -0.7);
    if (hasConfirmedEvil) {
      return 'reject';
    }
    const evilWins = view.questHistory.filter((q) => q.outcome === 'fail').length;
    const goodWins = view.questHistory.filter((q) => q.outcome === 'success').length;
    const threshold = evilWins >= 2 || goodWins >= 2 ? 0.15 : 0.05;
    return avgTrust >= threshold ? 'approve' : 'reject';
  }

  decideQuestCard(view: AvalonPlayerView): QuestCard {
    if (view.myLoyalty === 'good') {
      return 'success';
    }

    // Evil Bot decision
    const currentFails = view.questHistory.filter((q) => q.outcome === 'fail').length;
    if (currentFails >= 2) {
      // 3rd fail needed to win match! ALWAYS FAIL!
      return 'fail';
    }

    // Quest 4 for 7+ players requires 2 fails
    if (view.currentQuest === 4 && view.numPlayers >= 7) {
      return 'fail';
    }

    // Coordinate with Evil allies on 1-fail quests to avoid throwing 2 Fails and exposing two Evil seats!
    const hasLowerSeatEvilAllyOnTeam = view.proposedTeam.some(
      (s) => s < view.viewerSeat && view.nightVision.get(s) === 'evil_ally'
    );
    if (hasLowerSeatEvilAllyOnTeam) {
      return 'success';
    }

    // Quest 1: 80% fail, 20% stealth success for deep cover
    if (view.currentQuest === 1) {
      return Math.random() < 0.8 ? 'fail' : 'success';
    }

    return 'fail';
  }

  decideLadyTarget(
    view: AvalonPlayerView,
    botSeat: number,
    trustScores: Map<number, number>
  ): { targetSeat: number; claimedLoyalty: AvalonLoyalty } {
    const candidates = view.legalActions.eligibleLadyTargets;
    if (candidates.length === 0) {
      return { targetSeat: 0, claimedLoyalty: 'good' };
    }

    // Target with highest uncertainty (trust closest to 0.0)
    let bestTarget = candidates.at(0) ?? 0;
    let minConfidence = 999;

    for (const s of candidates) {
      const confidence = Math.abs(trustScores.get(s) ?? 0);
      if (confidence < minConfidence) {
        minConfidence = confidence;
        bestTarget = s;
      }
    }

    let claimedLoyalty: AvalonLoyalty = 'good';
    if (view.myLoyalty === 'evil') {
      const targetClue = view.nightVision.get(bestTarget);
      if (targetClue === 'evil_ally') {
        claimedLoyalty = 'good'; // Shield ally by claiming they are Good
      } else {
        claimedLoyalty = 'evil'; // Frame good player
      }
    }

    return { targetSeat: bestTarget, claimedLoyalty };
  }

  decideAssassinationTarget(view: AvalonPlayerView, botSeat: number): number {
    const targets = view.legalActions.eligibleAssassinationTargets.filter((s) => {
      const clue = view.nightVision.get(s);
      return s !== botSeat && clue !== 'evil_ally';
    });

    if (targets.length === 0) {
      return 0;
    }

    // Identify candidate with highest Merlin score
    let bestSeat = targets.at(0) ?? 0;
    let maxMerlinScore = -9999;

    for (const candidate of targets) {
      let score = 0;

      // 1. Voting accuracy against Evil proposals
      for (const p of view.proposalHistory) {
        const containsEvil = p.proposedTeam.some(
          (m) => m === botSeat || view.nightVision.get(m) === 'evil_ally'
        );
        const candidateVote = p.votes.get(candidate);

        if (containsEvil && candidateVote === 'reject') {
          score += 2.5; // Merlin knows evil from turn 1!
        } else if (!containsEvil && candidateVote === 'approve') {
          score += 1.0;
        }

        // 2. Proposal purity: Merlin rarely proposes Evil players
        if (p.leaderSeat === candidate) {
          if (containsEvil) {
            score -= 3.0;
          } else {
            score += 2.0;
          }
        }

        // 3. Approving a failed Evil quest on Quest 2+ strongly contraindicates Merlin
        const questRes = view.questHistory.find((q) => q.questNumber === p.questNumber);
        if (p.approved && questRes?.outcome === 'fail' && p.questNumber >= 2 && candidateVote === 'approve') {
          score -= 2.2;
        }
      }

      // 3. Leadership vocalism penalty (Percival often acts as decoy)
      const proposalsLed = view.proposalHistory.filter((p) => p.leaderSeat === candidate).length;
      score -= proposalsLed * 0.5;

      if (score > maxMerlinScore) {
        maxMerlinScore = score;
        bestSeat = candidate;
      }
    }

    return bestSeat;
  }
}
