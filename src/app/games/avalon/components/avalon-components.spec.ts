import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../../app.routes';
import { ShellUiService } from '../../../core/services/shell-ui.service';
import { AvalonAction, AvalonLobbySettings } from '../models/avalon.model';
import { AvalonSessionService } from '../services/avalon-session.service';
import { AvalonLobbyComponent } from './avalon-lobby/avalon-lobby.component';
import { AvalonTableComponent } from './avalon-table/avalon-table.component';

describe('Avalon Components (Lobby & Arthurian Table)', () => {
  describe('AvalonLobbyComponent', () => {
    async function setupLobby(): Promise<{
      fixture: ComponentFixture<AvalonLobbyComponent>;
      comp: AvalonLobbyComponent;
      session: AvalonSessionService;
      shellUi: ShellUiService;
    }> {
      await TestBed.configureTestingModule({
        imports: [AvalonLobbyComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const session = TestBed.inject(AvalonSessionService);
      const shellUi = TestBed.inject(ShellUiService);
      const fixture = TestBed.createComponent(AvalonLobbyComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();
      return { fixture, comp, session, shellUi };
    }

    it('renders pre-room configuration cards, selects, and action buttons', async () => {
      const { fixture, comp, shellUi } = await setupLobby();

      expect(shellUi.activeGame()).toBe('avalon');
      expect(comp.playerCount).toBe(5);
      expect(comp.goodCount).toBe(3);
      expect(comp.evilCount).toBe(2);

      const host = fixture.nativeElement as HTMLElement;
      const title = host.querySelector('.lobby-title');
      expect(title?.textContent?.trim().length).toBeGreaterThan(0);

      const btns = host.querySelectorAll('.actions-row button');
      expect(btns.length).toBe(2); // Solo + Create Room

      comp.session.leaveRoom();
    });

    it('launches quick solo match with AI bots when clicked', async () => {
      const { fixture, comp, session } = await setupLobby();

      comp.startSolo();
      fixture.detectChanges();

      const snap = session.snapshot();
      expect(snap?.lobby?.started).toBe(true);
      expect(snap?.view?.players.length).toBe(5);

      comp.session.leaveRoom();
    });

    it('creates multiplayer room and updates seat list and settings', async () => {
      const { fixture, comp, session } = await setupLobby();

      comp.createRoom();
      fixture.detectChanges();

      const snap = session.snapshot();
      expect(snap?.roomCode.startsWith('A')).toBe(true);
      expect(snap?.lobby?.seats.length).toBe(5);

      // Toggle seat 1 to bot
      comp.toggleSeat(1);
      fixture.detectChanges();
      expect(session.currentLobby()?.seats.at(1)?.kind).toBe('bot');

      // Change player count
      comp.onPlayerCountChange(7);
      expect(session.currentLobby()?.seats.length).toBe(7);

      // Toggle role
      comp.mordred = true;
      comp.onRoleToggle();
      const rules = session.currentLobby()?.rules as AvalonLobbySettings | undefined;
      expect(rules?.roleConfig.mordred).toBe(true);

      comp.startMatch();
      expect(session.currentLobby()?.started).toBe(true);

      comp.session.leaveRoom();
    });

    it('joins room when joinCode is entered', async () => {
      const { comp } = await setupLobby();

      comp.joinCode = 'A1234';
      comp.joinRoom();
      expect(comp.session.snapshot()?.role).toBe('guest');

      comp.session.leaveRoom();
    });
  });

  describe('AvalonTableComponent', () => {
    async function setupTable(): Promise<{
      fixture: ComponentFixture<AvalonTableComponent>;
      comp: AvalonTableComponent;
      session: AvalonSessionService;
      shellUi: ShellUiService;
    }> {
      await TestBed.configureTestingModule({
        imports: [AvalonTableComponent],
        providers: [provideRouter(routes)],
      }).compileComponents();

      const session = TestBed.inject(AvalonSessionService);
      const shellUi = TestBed.inject(ShellUiService);
      session.createSoloMatch(5);

      const fixture = TestBed.createComponent(AvalonTableComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();
      return { fixture, comp, session, shellUi };
    }

    it('renders Quest Track, Vote Track, Privacy Shield, and Round Table Knights', async () => {
      const { fixture, comp } = await setupTable();

      const host = fixture.nativeElement as HTMLElement;
      const questSlots = host.querySelectorAll('.quest-slot-pill');
      expect(questSlots.length).toBe(5);

      const voteSteps = host.querySelectorAll('.vote-step-slot');
      expect(voteSteps.length).toBe(5);

      const knights = host.querySelectorAll('.knight-card');
      expect(knights.length).toBe(5);

      comp.session.leaveRoom();
    });

    it('toggles Privacy Shield visibility to reveal and conceal secret identity', async () => {
      const { fixture, comp, session } = await setupTable();

      expect(session.privacyShieldRevealed()).toBe(false);

      session.togglePrivacyShield();
      fixture.detectChanges();
      expect(session.privacyShieldRevealed()).toBe(true);

      const host = fixture.nativeElement as HTMLElement;
      const revealed = host.querySelector('.revealed-role-content');
      expect(revealed?.textContent?.trim().length).toBeGreaterThan(0);

      session.setPrivacyShield(false);
      fixture.detectChanges();
      expect(session.privacyShieldRevealed()).toBe(false);

      comp.session.leaveRoom();
    });

    it('handles knight card selection and team proposal dispatching', async () => {
      const { fixture, comp, session } = await setupTable();
      const dispatched: { action: AvalonAction | null } = { action: null };
      session.dispatchAction = (action) => {
        dispatched.action = action;
      };

      comp.toggleSeatForTeam(0);
      comp.toggleSeatForTeam(1);
      fixture.detectChanges();

      comp.castVote('approve');
      expect(dispatched.action?.type).toBe('voteProposal');

      comp.session.leaveRoom();
    });

    it('opens and closes bounded modals for quest card submission, Lady of the Lake, and assassination', async () => {
      const { fixture, comp, session } = await setupTable();
      const dispatched: { action: AvalonAction | null } = { action: null };
      session.dispatchAction = (action) => {
        dispatched.action = action;
      };

      // Quest modal
      comp.openQuestSubmitModal();
      session.showQuestModal.set(true);
      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('.modal-card')?.textContent?.trim().length).toBeGreaterThan(0);

      comp.confirmQuestCard();
      expect(dispatched.action?.type).toBe('submitQuestCard');
      expect(session.showQuestModal()).toBe(false);

      // Lady modal
      session.showLadyModal.set(true);
      comp.selectedLadyTarget.set(1);
      comp.confirmLadyInvestigation();
      expect(dispatched.action?.type).toBe('useLadyOfLake');
      comp.closeLadyModal();
      expect(session.showLadyModal()).toBe(false);

      // Assassination modal
      session.showAssassinationModal.set(true);
      comp.selectedAssassinTarget.set(1);
      comp.confirmAssassination();
      expect(dispatched.action?.type).toBe('assassinateMerlin');
      expect(session.showAssassinationModal()).toBe(false);

      comp.session.leaveRoom();
    });

    it('computes display badges and helpers correctly', async () => {
      const { comp, shellUi } = await setupTable();

      expect(comp.getQuestRequiredFails(4)).toBe(1);
      expect(comp.getQuestSize(1)).toBe(2);
      expect(comp.getQuestStatus(1)).toBe('current');
      expect(comp.getQuestStatus(2)).toBe('pending');

      expect(comp.getClueBadgeText('evil')).toBe('👿 Evil');
      expect(comp.getClueBadgeText('evil_ally')).toBe('🤝 Evil Ally');
      expect(comp.getClueBadgeText('merlin_or_morgana')).toBe('🔮 Merlin / Morgana');
      expect(comp.getClueBadgeText('self')).toBe('👤 You');
      expect(comp.getClueBadgeText('unknown')).toBe('❓ Unknown');

      expect(comp.getClueBadgeClass('evil')).toBe('clue-evil');
      expect(comp.getClueBadgeClass('merlin_or_morgana')).toBe('clue-merlin');
      expect(comp.getClueBadgeClass('self')).toBe('clue-self');
      expect(comp.getClueBadgeClass('unknown')).toBe('clue-unknown');

      expect(comp.getPlayerRoleName('merlin')).toBe('AVALON.ROLES.MERLIN');
      expect(comp.getPlayerRoleName(null)).toBe('???');

      expect(comp.getPlayerName(0)).toBe(shellUi.playerNickname());
      expect(comp.getPlayerName(99)).toBe('Seat 100');

      const mockRecord = {
        votes: new Map([[0, 'approve' as const], [1, 'reject' as const]]),
      };
      expect(comp.getVoteValue(mockRecord, 0)).toBe('approve');
      expect(comp.getVoteValue(mockRecord, 2)).toBe(null);

      comp.returnToLobby();
      expect(comp.session.snapshot()).toBe(null);
    });

    it('enforces team selection caps and modal validation guards', async () => {
      const { comp } = await setupTable();

      // Guard: modal opens return early when legal action is false
      comp.openQuestSubmitModal();
      expect(comp.session.showQuestModal()).toBe(false);

      comp.openLadyModal();
      expect(comp.session.showLadyModal()).toBe(false);

      comp.openAssassinateModal();
      expect(comp.session.showAssassinationModal()).toBe(false);

      // Confirm with null target
      comp.selectedLadyTarget.set(null);
      comp.confirmLadyInvestigation();
      expect(comp.session.showLadyModal()).toBe(false);

      comp.selectedAssassinTarget.set(null);
      comp.confirmAssassination();
      expect(comp.session.showAssassinationModal()).toBe(false);

      // Set snapshot view with canPropose enabled for leader 0
      const snap = comp.session.snapshot();
      if (snap?.view) {
        comp.session.snapshot.set({
          ...snap,
          view: {
            ...snap.view,
            currentLeader: 0,
            legalActions: {
              ...snap.view.legalActions,
              canPropose: true,
              requiredTeamSize: 2,
            },
          },
        });
      }

      // Team selection cap
      comp.selectedTeamSeats.set([]);
      comp.toggleSeatForTeam(0); // Add 0
      expect(comp.selectedTeamSeats()).toContain(0);

      comp.toggleSeatForTeam(0); // Remove 0
      expect(comp.selectedTeamSeats()).not.toContain(0);

      comp.toggleSeatForTeam(0);
      comp.toggleSeatForTeam(1);
      // Already at requiredTeamSize (2), attempting to add seat 2 should not exceed cap
      comp.toggleSeatForTeam(2);
      expect(comp.selectedTeamSeats().length).toBe(2);

      // Propose team with mismatched size returns early
      comp.selectedTeamSeats.set([0]);
      comp.proposeSelectedTeam();
      expect(comp.session.currentView()?.phase).toBe('team_proposal');

      comp.session.leaveRoom();
    });
  });
});

