import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { routes } from '../../../../app.routes';
import { ShellUiService } from '../../../../core/services/shell-ui.service';
import { TranslateService } from '../../../../core/services/translate.service';
import {
  AvalonAction,
  AvalonLegalActions,
  AvalonLoyalty,
  AvalonPlayerView,
  AvalonPublicPlayer,
  AvalonRole,
  AvalonWinReason,
  DEFAULT_AVALON_SETTINGS,
  NightVisionClue,
  ProposalVote,
  createSerializableMap,
} from '../../models/avalon.model';
import { AvalonSessionService, AvalonSnapshot } from '../../services/avalon-session.service';
import { AvalonTableComponent } from './avalon-table.component';

function buildPlayers(count: number, leaderSeat = 0, proposedTeam: number[] = [], ladySeat: number | null = null): AvalonPublicPlayer[] {
  const names = ['Arthur', 'Merlin', 'Percival', 'Morgana', 'Assassin', 'Lancelot', 'Gawain'];
  const list: AvalonPublicPlayer[] = [];
  for (let i = 0; i < count; i++) {
    list.push({
      seat: i,
      name: names.at(i) ?? `Knight ${i + 1}`,
      isBot: i > 0,
      connected: true,
      isLeader: i === leaderSeat,
      onProposedTeam: proposedTeam.includes(i),
      hasLadyToken: ladySeat === i,
      hasUsedLady: false,
    });
  }
  return list;
}

function buildLegalActions(overrides: Partial<AvalonLegalActions> = {}): AvalonLegalActions {
  return {
    canPropose: false,
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
    ...overrides,
  };
}

function buildPlayerView(overrides: Partial<AvalonPlayerView> = {}): AvalonPlayerView {
  const numPlayers = overrides.numPlayers ?? 5;
  const currentLeader = overrides.currentLeader ?? 0;
  const proposedTeam = overrides.proposedTeam ? [...overrides.proposedTeam] : [];
  return {
    viewerSeat: 0,
    numPlayers,
    rules: { ...DEFAULT_AVALON_SETTINGS, numPlayers },
    phase: 'team_proposal',
    currentQuest: 1,
    voteTrack: 0,
    currentLeader,
    proposedTeam,
    myRole: 'merlin',
    myLoyalty: 'good',
    nightVision: createSerializableMap<number, NightVisionClue>([
      [0, 'self'],
      [1, 'unknown'],
      [2, 'merlin_or_morgana'],
      [3, 'evil'],
      [4, 'evil_ally'],
    ]),
    players: buildPlayers(numPlayers, currentLeader, proposedTeam),
    lastVoteReveal: null,
    lastQuestReveal: null,
    proposalHistory: [],
    questHistory: [],
    ladyHistory: [],
    privateLadyResult: null,
    winner: null,
    winReason: null,
    finalRoles: null,
    legalActions: buildLegalActions(),
    logs: [],
    ...overrides,
  };
}

describe('AvalonTableComponent', () => {
  let session: AvalonSessionService;
  let shellUi: ShellUiService;
  let translate: TranslateService;
  let router: Router;

  function setSessionView(view: AvalonPlayerView | null, mySeat = 0): void {
    if (!view) {
      session.snapshot.set(null);
      return;
    }
    const snap: AvalonSnapshot = {
      role: 'host',
      online: false,
      roomCode: 'LOCAL',
      status: 'Ready',
      error: null,
      mySeat,
      lobby: {
        started: true,
        seats: view.players.map((p) => ({
          seat: p.seat,
          kind: p.isBot ? 'bot' : 'human',
          name: p.name,
          connected: p.connected,
        })),
        rules: view.rules,
      },
      view,
    };
    session.snapshot.set(snap);
  }

  async function setupTable(initialView?: AvalonPlayerView | null): Promise<{
    fixture: ComponentFixture<AvalonTableComponent>;
    comp: AvalonTableComponent;
    host: HTMLElement;
  }> {
    await TestBed.configureTestingModule({
      imports: [AvalonTableComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();

    session = TestBed.inject(AvalonSessionService);
    shellUi = TestBed.inject(ShellUiService);
    translate = TestBed.inject(TranslateService);
    router = TestBed.inject(Router);
    translate.use('en');

    if (initialView !== undefined) {
      setSessionView(initialView);
    } else {
      setSessionView(buildPlayerView());
    }

    const fixture = TestBed.createComponent(AvalonTableComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return { fixture, comp, host };
  }

  afterEach(() => {
    session?.leaveRoom();
    localStorage.removeItem('hkmj_lang');
  });

  it('guards template rendering and helper methods safely when currentView is null', async () => {
    const { comp, host } = await setupTable(null);

    expect(shellUi.activeGame()).toBe('avalon');
    expect(comp.currentView()).toBe(null);
    expect(comp.mySeat()).toBe(-1);
    expect(comp.myRoleMeta()).toBe(null);
    expect(host.querySelector('.quest-board-card')).toBe(null);

    expect(comp.getQuestRequiredFails(4)).toBe(1);
    expect(comp.getQuestSize(1)).toBe(2);
    expect(comp.getQuestStatus(1)).toBe('pending');
    expect(comp.getPlayerName(0)).toBe('Seat 1');
    expect(comp.getPlayerRoleName(null)).toBe('???');
    expect(comp.getPlayerRoleName(undefined)).toBe('???');

    comp.toggleSeatForTeam(0);
    comp.proposeSelectedTeam();
    expect(comp.selectedTeamSeats()).toEqual([]);
  });

  it('renders Quest Track statuses and displays 2-Fails badge on Quest 4 only for 7+ players', async () => {
    // 5-player table: no 2-fails badge on Quest 4
    const { fixture, comp, host } = await setupTable(
      buildPlayerView({
        numPlayers: 5,
        currentQuest: 1,
      })
    );

    expect(host.querySelectorAll('.quest-slot-pill').length).toBe(5);
    expect(host.querySelector('.two-fails-badge')).toBe(null);
    expect(comp.getQuestRequiredFails(4)).toBe(1);

    // Upgrade to 7-player table on Quest 3 with Quest 1 passed and Quest 2 failed
    setSessionView(
      buildPlayerView({
        numPlayers: 7,
        currentQuest: 3,
        players: buildPlayers(7, 0, [], 6),
        questHistory: [
          {
            questNumber: 1,
            team: [0, 1],
            successCount: 2,
            failCount: 0,
            requiredFails: 1,
            outcome: 'success',
          },
          {
            questNumber: 2,
            team: [1, 2, 3],
            successCount: 2,
            failCount: 1,
            requiredFails: 1,
            outcome: 'fail',
          },
        ],
        legalActions: buildLegalActions({ requiredTeamSize: 3 }),
      })
    );
    fixture.detectChanges();

    expect(comp.getQuestRequiredFails(4)).toBe(2);
    expect(comp.getQuestSize(4)).toBe(4);
    expect(comp.getQuestStatus(1)).toBe('success');
    expect(comp.getQuestStatus(2)).toBe('fail');
    expect(comp.getQuestStatus(3)).toBe('current');
    expect(comp.getQuestStatus(4)).toBe('pending');

    const questSlots = host.querySelectorAll('.quest-slot-pill');
    expect(questSlots.item(0)?.classList.contains('status-success')).toBe(true);
    expect(questSlots.item(0)?.textContent).toContain('Pass');
    expect(questSlots.item(1)?.classList.contains('status-fail')).toBe(true);
    expect(questSlots.item(1)?.textContent).toContain('Fail');
    expect(questSlots.item(2)?.classList.contains('status-current')).toBe(true);
    expect(questSlots.item(2)?.textContent).toContain('Active');
    expect(questSlots.item(3)?.querySelector('.two-fails-badge')?.textContent?.trim()).toBe('2 Fails');
  });

  it('tracks rejected proposal count on Vote Track and highlights Hammer warning at step 4', async () => {
    const { fixture, host } = await setupTable(
      buildPlayerView({
        voteTrack: 2,
      })
    );

    const voteContainer = host.querySelector('.vote-track-container');
    expect(voteContainer?.classList.contains('hammer-active')).toBe(false);
    expect(host.querySelector('.hammer-badge-text')).toBe(null);
    expect(host.querySelectorAll('.vote-step-slot.is-filled').length).toBe(2);
    expect(host.querySelectorAll('.vote-step-slot').item(2)?.classList.contains('is-current')).toBe(true);
    expect(host.querySelectorAll('.vote-step-slot').item(4)?.classList.contains('is-hammer')).toBe(true);

    setSessionView(
      buildPlayerView({
        voteTrack: 4,
      })
    );
    fixture.detectChanges();

    expect(host.querySelector('.vote-track-container')?.classList.contains('hammer-active')).toBe(true);
    expect(host.querySelector('.hammer-badge-text')?.textContent).toContain(
      'HAMMER! 5th rejection leads to immediate Evil victory!'
    );
  });

  it('toggles Privacy Shield via button and pointerdown/pointerup/pointerleave, rendering Night Vision and Lady Intel clues', async () => {
    const { fixture, comp, host } = await setupTable(
      buildPlayerView({
        myRole: 'merlin',
        myLoyalty: 'good',
        privateLadyResult: {
          targetSeat: 3,
          loyalty: 'evil',
        },
      })
    );

    const toggleBtn = host.querySelector<HTMLButtonElement>('.shield-header button');
    const viewport = host.querySelector<HTMLElement>('.shield-viewport');

    expect(session.privacyShieldRevealed()).toBe(false);
    expect(toggleBtn?.textContent).toContain('Shielded');
    expect(host.querySelector('.concealed-prompt')?.textContent).toContain('Hold to Peek Secret Role');

    // Click toggle button to reveal
    toggleBtn?.click();
    fixture.detectChanges();
    expect(session.privacyShieldRevealed()).toBe(true);
    expect(toggleBtn?.textContent).toContain('Role Visible');
    expect(host.querySelector('.role-badge-chip')?.classList.contains('badge-good')).toBe(true);
    expect(host.querySelector('.role-title-text')?.textContent?.trim()).toBe('Merlin');

    // Check Night Vision chips (seats 1..4 excluding viewerSeat 0)
    const nvChips = host.querySelectorAll('.nv-chip');
    expect(nvChips.length).toBe(4);
    expect(nvChips.item(0)?.classList.contains('clue-unknown')).toBe(true);
    expect(nvChips.item(0)?.textContent).toContain('❓ Unknown');
    expect(nvChips.item(1)?.classList.contains('clue-merlin')).toBe(true);
    expect(nvChips.item(1)?.textContent).toContain('🔮 Merlin / Morgana');
    expect(nvChips.item(2)?.classList.contains('clue-evil')).toBe(true);
    expect(nvChips.item(2)?.textContent).toContain('👿 Evil');
    expect(nvChips.item(3)?.classList.contains('clue-evil')).toBe(true);
    expect(nvChips.item(3)?.textContent).toContain('🤝 Evil Ally');
    expect(comp.getClueBadgeText('self')).toBe('👤 You');
    expect(comp.getClueBadgeClass('self')).toBe('clue-self');

    // Check Lady of the Lake private intel box for Evil target
    const ladyBox = host.querySelector('.lady-private-box');
    expect(ladyBox?.textContent).toContain('Morgana');
    expect(ladyBox?.textContent).toContain('Target is a Minion of Mordred (EVIL)');
    expect(ladyBox?.querySelector('.neg-delta')?.textContent?.trim()).toBe(
      'Target is a Minion of Mordred (EVIL)'
    );

    // Pointerup conceals shield
    viewport?.dispatchEvent(new Event('pointerup'));
    fixture.detectChanges();
    expect(session.privacyShieldRevealed()).toBe(false);

    // Switch to Evil role + Good Lady result, then hold-to-peek via pointerdown and release via pointerleave
    setSessionView(
      buildPlayerView({
        myRole: 'assassin',
        myLoyalty: 'evil',
        privateLadyResult: {
          targetSeat: 1,
          loyalty: 'good',
        },
      })
    );
    viewport?.dispatchEvent(new Event('pointerdown'));
    fixture.detectChanges();

    expect(session.privacyShieldRevealed()).toBe(true);
    expect(host.querySelector('.role-badge-chip')?.classList.contains('badge-evil')).toBe(true);
    expect(host.querySelector('.lady-private-box .pos-delta')?.textContent?.trim()).toBe(
      'Target is Loyal to Arthur (GOOD)'
    );

    viewport?.dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(session.privacyShieldRevealed()).toBe(false);
  });

  it('selects and deselects knights up to requiredTeamSize and dispatches proposeTeam action', async () => {
    const { fixture, comp, host } = await setupTable(
      buildPlayerView({
        phase: 'team_proposal',
        currentLeader: 0,
        legalActions: buildLegalActions({
          canPropose: true,
          requiredTeamSize: 2,
        }),
      })
    );

    const dispatched: AvalonAction[] = [];
    vi.spyOn(session, 'dispatchAction').mockImplementation((action) => {
      dispatched.push(action);
    });

    const proposeBtn = host.querySelector<HTMLButtonElement>('.action-dock-card .btn-crimson');
    expect(proposeBtn?.disabled).toBe(true);

    const knightCards = host.querySelectorAll<HTMLElement>('.knight-card');
    // Select seat 2 then seat 0 -> sorted [0, 2]
    knightCards.item(2)?.click();
    knightCards.item(0)?.click();
    fixture.detectChanges();

    expect(comp.selectedTeamSeats()).toEqual([0, 2]);
    expect(proposeBtn?.disabled).toBe(false);

    // Attempting to select seat 3 when already at requiredTeamSize (2) does not exceed cap
    knightCards.item(3)?.click();
    expect(comp.selectedTeamSeats()).toEqual([0, 2]);

    // Toggle seat 0 off via checkbox click, then select seat 1 -> [1, 2]
    const seat0Checkbox = knightCards.item(0)?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    seat0Checkbox?.click();
    knightCards.item(1)?.click();
    fixture.detectChanges();

    expect(comp.selectedTeamSeats()).toEqual([1, 2]);

    proposeBtn?.click();
    fixture.detectChanges();

    expect(dispatched).toEqual([{ type: 'proposeTeam', team: [1, 2] }]);
    expect(comp.selectedTeamSeats()).toEqual([]);
  });

  it('renders nominated team chips, dispatches approve/reject open votes, and shows waiting banner after voting', async () => {
    const { fixture, host } = await setupTable(
      buildPlayerView({
        phase: 'team_voting',
        proposedTeam: [0, 2],
        players: buildPlayers(5, 0, [0, 2]),
        legalActions: buildLegalActions({
          canVote: true,
          hasVoted: false,
        }),
      })
    );

    const dispatched: AvalonAction[] = [];
    vi.spyOn(session, 'dispatchAction').mockImplementation((action) => {
      dispatched.push(action);
    });

    const chips = host.querySelectorAll('.nominee-chip');
    expect(chips.length).toBe(2);
    expect(chips.item(0)?.textContent).toContain('Arthur');
    expect(chips.item(1)?.textContent).toContain('Percival');

    const voteBtns = host.querySelectorAll<HTMLButtonElement>('.vote-action-buttons button');
    expect(voteBtns.length).toBe(2);

    voteBtns.item(0)?.click();
    voteBtns.item(1)?.click();
    expect(dispatched).toEqual([
      { type: 'voteProposal', vote: 'approve' },
      { type: 'voteProposal', vote: 'reject' },
    ]);

    // Transition to hasVoted waiting state
    setSessionView(
      buildPlayerView({
        phase: 'team_voting',
        proposedTeam: [0, 2],
        legalActions: buildLegalActions({
          canVote: false,
          hasVoted: true,
        }),
      })
    );
    fixture.detectChanges();

    expect(host.querySelector('.voted-waiting-box')?.textContent).toContain(
      'Vote registered. Waiting for fellow knights'
    );
  });

  it('enforces Loyal Servant fail lock vs Evil fail choice in Quest Card Modal and renders quest waiting states', async () => {
    const { fixture, comp, host } = await setupTable(
      buildPlayerView({
        phase: 'quest_execution',
        proposedTeam: [0, 1],
        myRole: 'merlin',
        myLoyalty: 'good',
        legalActions: buildLegalActions({
          canSubmitQuestCard: true,
          canOnlyPass: true,
        }),
      })
    );

    const dispatched: AvalonAction[] = [];
    vi.spyOn(session, 'dispatchAction').mockImplementation((action) => {
      dispatched.push(action);
    });

    // Open Quest Modal via dock button
    const openModalBtn = host.querySelector<HTMLButtonElement>('.quest-callout .btn-emerald');
    openModalBtn?.click();
    fixture.detectChanges();

    expect(session.showQuestModal()).toBe(true);
    const failCardGood = host.querySelector<HTMLElement>('.choice-fail');
    expect(failCardGood?.classList.contains('disabled')).toBe(true);
    expect(failCardGood?.textContent).toContain('Loyal servants of Arthur cannot fail a quest!');

    // Clicking disabled fail card keeps selection locked to 'success'
    failCardGood?.click();
    expect(comp.selectedCardToSubmit()).toBe('success');

    // Switch to Evil player who can choose 'fail'
    setSessionView(
      buildPlayerView({
        phase: 'quest_execution',
        proposedTeam: [0, 1],
        myRole: 'morgana',
        myLoyalty: 'evil',
        legalActions: buildLegalActions({
          canSubmitQuestCard: true,
          canOnlyPass: false,
        }),
      })
    );
    fixture.detectChanges();

    const failCardEvil = host.querySelector<HTMLElement>('.choice-fail');
    expect(failCardEvil?.classList.contains('disabled')).toBe(false);
    expect(failCardEvil?.textContent).toContain("Sabotage the quest in Mordred's name.");

    failCardEvil?.click();
    fixture.detectChanges();
    expect(comp.selectedCardToSubmit()).toBe('fail');

    const confirmCardBtn = host.querySelector<HTMLButtonElement>('.modal-footer .btn-emerald');
    confirmCardBtn?.click();
    fixture.detectChanges();

    expect(dispatched).toEqual([{ type: 'submitQuestCard', card: 'fail' }]);
    expect(session.showQuestModal()).toBe(false);

    // Waiting state after team member submitted quest card
    setSessionView(
      buildPlayerView({
        phase: 'quest_execution',
        proposedTeam: [0, 1],
        legalActions: buildLegalActions({
          canSubmitQuestCard: false,
          hasSubmittedQuestCard: true,
        }),
      })
    );
    fixture.detectChanges();
    expect(host.querySelector('.voted-waiting-box')?.textContent).toContain(
      'Secret card submitted. Waiting for teammates'
    );

    // Waiting state for non-team bystander
    setSessionView(
      buildPlayerView({
        phase: 'quest_execution',
        proposedTeam: [1, 2],
        legalActions: buildLegalActions({
          canSubmitQuestCard: false,
          hasSubmittedQuestCard: false,
        }),
      })
    );
    fixture.detectChanges();
    expect(host.querySelector('.voted-waiting-box')?.textContent).toContain(
      'Quest 1 is underway. Knights are on their mission'
    );
  });

  it('opens Lady of the Lake modal, investigates selected target, reveals loyalty, and closes modal', async () => {
    const { fixture, comp, host } = await setupTable(
      buildPlayerView({
        phase: 'lady_of_lake',
        players: buildPlayers(5, 0, [], 0),
        legalActions: buildLegalActions({
          canUseLady: true,
          eligibleLadyTargets: [1, 3],
        }),
      })
    );

    const dispatched: AvalonAction[] = [];
    vi.spyOn(session, 'dispatchAction').mockImplementation((action) => {
      dispatched.push(action);
    });

    const openLadyBtn = host.querySelector<HTMLButtonElement>('.action-dock-card .btn-gold');
    openLadyBtn?.click();
    fixture.detectChanges();

    expect(session.showLadyModal()).toBe(true);
    expect(comp.selectedLadyTarget()).toBe(1);

    const radios = host.querySelectorAll<HTMLInputElement>('input[name="ladyTarget"]');
    expect(radios.length).toBe(2);
    radios.item(1)?.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(comp.selectedLadyTarget()).toBe(3);

    const inspectBtn = host.querySelector<HTMLButtonElement>('.modal-footer .btn-gold');
    inspectBtn?.click();
    expect(dispatched).toEqual([{ type: 'useLadyOfLake', targetSeat: 3 }]);

    // Reveal sacred waters result in modal
    setSessionView(
      buildPlayerView({
        phase: 'team_proposal',
        privateLadyResult: {
          targetSeat: 3,
          loyalty: 'evil',
        },
      })
    );
    fixture.detectChanges();

    expect(host.querySelector('.lady-result-reveal')?.textContent).toContain('Sacred Waters Revealed:');
    expect(host.querySelector('.target-loyalty-text')?.textContent).toContain(
      'Target is a Minion of Mordred (EVIL)'
    );

    const continueBtn = host.querySelector<HTMLButtonElement>('.modal-footer .btn-gold');
    continueBtn?.click();
    fixture.detectChanges();

    expect(session.showLadyModal()).toBe(false);
    expect(comp.selectedLadyTarget()).toBe(null);
  });

  it('opens Assassination modal, selects Good target, and dispatches assassinateMerlin', async () => {
    const { fixture, comp, host } = await setupTable(
      buildPlayerView({
        phase: 'assassination',
        myRole: 'assassin',
        myLoyalty: 'evil',
        legalActions: buildLegalActions({
          canAssassinate: true,
          eligibleAssassinationTargets: [0, 1, 2],
        }),
      })
    );

    const dispatched: AvalonAction[] = [];
    vi.spyOn(session, 'dispatchAction').mockImplementation((action) => {
      dispatched.push(action);
    });

    const openAssassinBtn = host.querySelector<HTMLButtonElement>('.action-dock-card .btn-crimson');
    openAssassinBtn?.click();
    fixture.detectChanges();

    expect(session.showAssassinationModal()).toBe(true);
    expect(comp.selectedAssassinTarget()).toBe(0);

    const radios = host.querySelectorAll<HTMLInputElement>('input[name="assassinTarget"]');
    expect(radios.length).toBe(3);
    radios.item(1)?.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(comp.selectedAssassinTarget()).toBe(1);

    const strikeBtn = host.querySelector<HTMLButtonElement>('.modal-footer .btn-crimson');
    strikeBtn?.click();
    fixture.detectChanges();

    expect(dispatched).toEqual([{ type: 'assassinateMerlin', targetSeat: 1 }]);
    expect(session.showAssassinationModal()).toBe(false);
  });

  it('renders Quest & Vote History in both desktop table and mobile cards for empty and populated records', async () => {
    const { fixture, comp, host } = await setupTable(
      buildPlayerView({
        proposalHistory: [],
      })
    );

    expect(host.querySelector('.desktop-table .empty-history-cell')?.textContent?.trim()).toBe(
      'No team proposals cast yet.'
    );
    expect(host.querySelector('.mobile-cards .empty-history-cell')?.textContent?.trim()).toBe(
      'No team proposals cast yet.'
    );

    const rejectedVotes = createSerializableMap<number, ProposalVote>([
      [0, 'approve'],
      [1, 'reject'],
      [2, 'reject'],
      [3, 'reject'],
      [4, 'approve'],
    ]);
    const approvedVotes = createSerializableMap<number, ProposalVote>([
      [0, 'approve'],
      [1, 'approve'],
      [2, 'approve'],
      [3, 'reject'],
      [4, 'reject'],
    ]);

    setSessionView(
      buildPlayerView({
        proposalHistory: [
          {
            questNumber: 1,
            attemptNumber: 1,
            leaderSeat: 0,
            proposedTeam: [0, 4],
            votes: rejectedVotes,
            approved: false,
          },
          {
            questNumber: 1,
            attemptNumber: 2,
            leaderSeat: 1,
            proposedTeam: [1, 2],
            votes: approvedVotes,
            approved: true,
          },
        ],
      })
    );
    fixture.detectChanges();

    expect(comp.formatTeamNames([1, 2])).toBe('Merlin, Percival');

    const desktopRows = host.querySelectorAll('.desktop-table tbody tr');
    expect(desktopRows.length).toBe(2);
    expect(desktopRows.item(0)?.querySelector('.outcome-rejected')?.textContent?.trim()).toBe('REJECTED');
    expect(desktopRows.item(0)?.querySelectorAll('.vote-chip-approve').length).toBe(2);
    expect(desktopRows.item(0)?.querySelectorAll('.vote-chip-reject').length).toBe(3);
    expect(desktopRows.item(1)?.querySelector('.outcome-approved')?.textContent?.trim()).toBe('APPROVED');

    const mobileCards = host.querySelectorAll('.mobile-cards .mobile-app-card');
    expect(mobileCards.length).toBe(2);
    expect(mobileCards.item(0)?.textContent).toContain('Arthur, Assassin');
    expect(mobileCards.item(1)?.textContent).toContain('Merlin, Percival');
  });

  it('renders all 5 game_over win reasons, reveals final role identities, and navigates back to lobby', async () => {
    const finalRoles = createSerializableMap<number, AvalonRole>([
      [0, 'loyal_servant'],
      [1, 'merlin'],
      [2, 'percival'],
      [3, 'morgana'],
      [4, 'assassin'],
    ]);

    const { fixture, host } = await setupTable(
      buildPlayerView({
        phase: 'game_over',
        winner: 'good',
        winReason: 'THREE_SUCCESSFUL_QUESTS',
        finalRoles,
      })
    );
    const navSpy = vi.spyOn(router, 'navigate');

    const outcomeScenarios: ReadonlyArray<{
      winner: AvalonLoyalty;
      winReason: AvalonWinReason;
      expectedHeader: string;
      expectedReason: string;
    }> = [
      {
        winner: 'good',
        winReason: 'THREE_SUCCESSFUL_QUESTS',
        expectedHeader: 'Good Triumphs!',
        expectedReason: 'Good completed 3 Quests and Merlin survived!',
      },
      {
        winner: 'evil',
        winReason: 'THREE_FAILED_QUESTS',
        expectedHeader: 'Evil Triumphs!',
        expectedReason: 'Evil sabotaged 3 Quests!',
      },
      {
        winner: 'evil',
        winReason: 'FIVE_REJECTED_TEAMS',
        expectedHeader: 'Evil Triumphs!',
        expectedReason: '5 proposals rejected in a row! Chaos engulfed the kingdom.',
      },
      {
        winner: 'evil',
        winReason: 'MERLIN_ASSASSINATED',
        expectedHeader: 'Evil Triumphs!',
        expectedReason: 'Assassin correctly identified and killed Merlin!',
      },
      {
        winner: 'good',
        winReason: 'MERLIN_SURVIVED',
        expectedHeader: 'Good Triumphs!',
        expectedReason: 'Assassin failed to identify Merlin!',
      },
    ];

    for (const scenario of outcomeScenarios) {
      setSessionView(
        buildPlayerView({
          phase: 'game_over',
          winner: scenario.winner,
          winReason: scenario.winReason,
          finalRoles,
        })
      );
      fixture.detectChanges();

      expect(host.querySelector('.modal-header h2')?.textContent?.trim()).toBe(
        scenario.expectedHeader
      );
      expect(host.querySelector('.win-reason-banner')?.textContent?.trim()).toBe(
        scenario.expectedReason
      );
    }

    const roleRows = host.querySelectorAll('.final-role-row');
    expect(roleRows.length).toBe(5);
    expect(roleRows.item(1)?.querySelector('.final-role-tag')?.textContent?.trim()).toBe('Merlin');
    expect(roleRows.item(4)?.querySelector('.final-role-tag')?.textContent?.trim()).toBe('Assassin');

    const returnBtn = host.querySelector<HTMLButtonElement>('.modal-footer .btn-gold');
    returnBtn?.click();
    fixture.detectChanges();

    expect(session.snapshot()).toBe(null);
    expect(navSpy).toHaveBeenCalledWith(['/avalon/lobby']);
  });
});
