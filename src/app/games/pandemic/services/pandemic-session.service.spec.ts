import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { P2PRoomTransportService } from '../../../core/services/p2p-room.transport';
import { ShellUiService } from '../../../core/services/shell-ui.service';
import {
  CityCubes,
  createSerializableMap,
  CureStatus,
  DiseaseColor,
  PandemicMatchState,
} from '../models/pandemic.model';
import { PandemicBotService } from './pandemic-bot.service';
import { PandemicEngineService } from './pandemic-engine.service';
import {
  PandemicSessionService,
  PandemicSnapshot,
  SerializedPandemicSave,
} from './pandemic-session.service';

describe('PandemicSessionService & Session Lifecycle', () => {
  let session: PandemicSessionService;
  let engine: PandemicEngineService;
  let bot: PandemicBotService;
  let shellUi: ShellUiService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PandemicSessionService,
        PandemicEngineService,
        PandemicBotService,
        P2PRoomTransportService,
        ShellUiService,
      ],
    });

    session = TestBed.inject(PandemicSessionService);
    engine = TestBed.inject(PandemicEngineService);
    bot = TestBed.inject(PandemicBotService);
    shellUi = TestBed.inject(ShellUiService);
    router = TestBed.inject(Router);

    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    session.leaveRoom();
    vi.restoreAllMocks();
  });

  describe('1. Solo Match & Bot Initialization', () => {
    it('creates a solo match with bots and starts on board route', () => {
      session.createSoloMatch(3, { difficulty: 'standard' });

      expect(session.isHost()).toBe(true);
      expect(session.mySeat()).toBe(0);
      expect(session.isSoloCommander()).toBe(false);

      const lobby = session.currentLobby();
      expect(lobby?.started).toBe(true);
      expect(lobby?.seats.length).toBe(3);
      expect(lobby?.seats.at(0)?.kind).toBe('human');
      expect(lobby?.seats.at(1)?.kind).toBe('bot');
      expect(lobby?.seats.at(2)?.kind).toBe('bot');

      const view = session.currentView();
      expect(view?.gameId).toBe('pandemic');
      expect(view?.players.length).toBe(3);
      expect(view?.researchStations.includes('atlanta')).toBe(true);

      expect(router.navigate).toHaveBeenCalledWith(['/pandemic/board']);
      expect(shellUi.activeGame()).toBe('pandemic');
    });

    it('computes myPlayer and activePlayer signals correctly', () => {
      session.createSoloMatch(2);

      const myPl = session.myPlayer();
      expect(myPl?.seat).toBe(0);

      const actPl = session.activePlayer();
      expect(actPl?.seat).toBe(0);
      expect(session.isMyTurn()).toBe(true);
    });
  });

  describe('2. Solo Commander Mode', () => {
    it('creates a Solo Commander match where all seats are human under local commander', () => {
      session.createSoloCommanderMatch(4, { difficulty: 'heroic' });

      expect(session.isHost()).toBe(true);
      expect(session.isSoloCommander()).toBe(true);

      const lobby = session.currentLobby();
      expect(lobby?.started).toBe(true);
      expect(lobby?.seats.length).toBe(4);
      for (const seat of lobby?.seats ?? []) {
        expect(seat.kind).toBe('human');
      }

      // In commander mode, local player can control all specialist seats
      expect(session.isMyTurn()).toBe(true);
      expect(session.currentView()?.difficulty).toBe('heroic');
    });

    it('dispatches actions on behalf of any active seat in Solo Commander mode', () => {
      session.createSoloCommanderMatch(2);

      const viewBefore = session.currentView();
      expect(viewBefore?.actionsRemaining).toBe(4);

      // Drive to adjacent city as active seat
      session.dispatchAction({ type: 'driveOrFerry', toCityId: 'chicago' });

      const viewAfter = session.currentView();
      expect(viewAfter?.actionsRemaining).toBe(3);
      expect(viewAfter?.players.at(0)?.cityId).toBe('chicago');
    });
  });

  describe('3. Online P2P & Waiting Room Management', () => {
    it('creates a multiplayer P2P room with D* prefix code', () => {
      const roomCode = session.createMultiplayerRoom(4);

      expect(roomCode.startsWith('D')).toBe(true);
      expect(session.isHost()).toBe(true);
      expect(session.snapshot()?.roomCode).toBe(roomCode);

      const lobby = session.currentLobby();
      expect(lobby?.started).toBe(false);
      expect(lobby?.seats.at(0)?.kind).toBe('human');
      expect(lobby?.seats.at(1)?.kind).toBe('open');
      expect(lobby?.seats.at(2)?.kind).toBe('open');
      expect(lobby?.seats.at(3)?.kind).toBe('open');
    });

    it('toggles seat kind between open and bot in waiting room', () => {
      session.createMultiplayerRoom(3);

      session.toggleSeatKind(1);
      expect(session.currentLobby()?.seats.at(1)?.kind).toBe('bot');

      session.toggleSeatKind(1);
      expect(session.currentLobby()?.seats.at(1)?.kind).toBe('open');

      // Seat 0 (host) cannot be toggled
      session.toggleSeatKind(0);
      expect(session.currentLobby()?.seats.at(0)?.kind).toBe('human');
    });

    it('sets seat role and difficulty in lobby', () => {
      session.createMultiplayerRoom(2);

      session.setSeatRole(0, 'medic');
      session.setSeatRole(1, 'scientist');
      expect(session.currentLobby()?.seats.at(0)?.role).toBe('medic');
      expect(session.currentLobby()?.seats.at(1)?.role).toBe('scientist');

      session.setDifficulty('heroic');
      expect(session.currentLobby()?.rules?.difficulty).toBe('heroic');
    });

    it('starts match from lobby, fills open seats with bots, and navigates to board', () => {
      session.createMultiplayerRoom(3);
      session.setSeatRole(0, 'dispatcher');

      session.startMatchFromLobby();

      expect(session.currentLobby()?.started).toBe(true);
      expect(session.currentLobby()?.seats.at(1)?.kind).toBe('bot');
      expect(session.currentLobby()?.seats.at(2)?.kind).toBe('bot');

      const view = session.currentView();
      expect(view?.players.at(0)?.role).toBe('dispatcher');
      expect(router.navigate).toHaveBeenCalledWith(['/pandemic/board']);
    });

    it('joins multiplayer room as guest and hydrates Map fields after WebRTC JSON round-trip', () => {
      session.createMultiplayerRoom(2);
      session.startMatchFromLobby();
      const hostSnap = session.snapshot()!;
      const wireParsedSnap = JSON.parse(JSON.stringify(hostSnap)) as PandemicSnapshot;

      session.joinMultiplayerRoom('D9999');
      expect(session.isHost()).toBe(false);
      expect(session.snapshot()?.role).toBe('guest');
      expect(session.snapshot()?.roomCode).toBe('D9999');

      const guestSession = (
        session as unknown as {
          guestSession: { handleServerMessage: (raw: unknown) => void };
        }
      ).guestSession;
      guestSession.handleServerMessage({ type: 'sync', snapshot: wireParsedSnap });

      const guestView = session.currentView()!;
      expect(guestView.cityCubes instanceof Map).toBe(true);
      expect(guestView.cubesRemaining instanceof Map).toBe(true);
      expect(guestView.cureStatus instanceof Map).toBe(true);
      expect(guestView.cureStatus.get('blue')).toBe('uncured');
    });
  });

  describe('4. Tactical AI Bot Turn Automation', () => {
    it('triggers bot actions automatically on Host when active seat is a bot', () => {
      vi.useFakeTimers();
      try {
        session.createSoloMatch(2);

        // Ensure top 2 player cards are safe city cards to avoid random epidemic alert pause
        const hostSession = (session as unknown as { hostSession: { state: PandemicMatchState } }).hostSession;
        hostSession.state.playerDeck.unshift(
          { type: 'city', cityId: 'london', color: 'blue' },
          { type: 'city', cityId: 'paris', color: 'blue' }
        );

        // Consume player 0's actions
        session.dispatchAction({ type: 'endActionsEarly' });
        // Transition to infect
        session.dispatchAction({ type: 'resolveInfectStep' });

        const view = session.currentView();
        // Now it is bot seat 1's turn
        expect(view?.activeSeat).toBe(1);

        const botSpy = vi.spyOn(bot, 'chooseBotAction').mockReturnValue({
          type: 'driveOrFerry',
          toCityId: 'chicago',
        });

        // Fast-forward bot turn delay
        vi.advanceTimersByTime(700);

        expect(botSpy).toHaveBeenCalled();
        const updatedView = session.currentView();
        expect(updatedView?.players.at(1)?.cityId).toBe('chicago');
      } finally {
        vi.useRealTimers();
      }
    });

    it('triggers bot discard action when bot is queued in discard phase', () => {
      vi.useFakeTimers();
      try {
        session.createSoloMatch(2);

        // Force bot into discard queue
        const hostSession = (session as unknown as { hostSession: { state: PandemicMatchState; broadcastAll: () => void } }).hostSession;
        hostSession.state.phase = 'discard';
        hostSession.state.discardQueue = [1];
        hostSession.broadcastAll();

        const botSpy = vi.spyOn(bot, 'chooseBotAction').mockReturnValue({
          type: 'discardCard',
          seat: 1,
          cardIndex: 0,
        });

        vi.advanceTimersByTime(600);

        expect(botSpy).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('5. Save & Restore Mechanism', () => {
    it('exports and restores save data preserving Map structures and board state', () => {
      session.createSoloMatch(2);

      expect(session.canExportSave()).toBe(true);

      const exported = session.exportSaveData();
      expect(exported?.lobby.started).toBe(true);
      expect(exported?.state.gameId).toBe('pandemic');
      expect(exported?.state.cityCubesEntries.length).toBeGreaterThan(0);
      expect(exported?.state.cubesRemainingEntries.length).toBe(4);
      expect(exported?.state.cureStatusEntries.length).toBe(4);

      // Mutate current session
      session.leaveRoom();
      expect(session.currentView()).toBe(null);

      // Restore save
      const restored = session.restoreSaveData(exported!);
      expect(restored).toBe(true);
      expect(session.currentView()?.gameId).toBe('pandemic');
      expect(session.currentView()?.cityCubes instanceof Map).toBe(true);
      expect(session.currentView()?.cureStatus.get('blue')).toBe('uncured');
      expect(router.navigate).toHaveBeenCalledWith(['/pandemic/board']);
    });

    it('returns null and false for invalid save exports and restores', () => {
      expect(session.canExportSave()).toBe(false);
      expect(session.exportSaveData()).toBe(null);

      const restored = session.restoreSaveData(null as unknown as SerializedPandemicSave);
      expect(restored).toBe(false);
    });
  });

  describe('6. UI Modals & Filter Signal Controls', () => {
    it('manages city selection and region filter signals', () => {
      session.selectCity('atlanta');
      expect(session.selectedCityId()).toBe('atlanta');

      session.setRegion('yellow');
      expect(session.selectedRegion()).toBe('yellow');

      session.selectCity(null);
      expect(session.selectedCityId()).toBe(null);
    });

    it('opens and closes all game modal dialogs cleanly', () => {
      session.openForecastModal();
      expect(session.showForecastModal()).toBe(true);
      session.closeForecastModal();
      expect(session.showForecastModal()).toBe(false);

      session.openDiscardModal();
      expect(session.showDiscardModal()).toBe(true);
      session.closeDiscardModal();
      expect(session.showDiscardModal()).toBe(false);

      session.openInfectionDiscardModal();
      expect(session.showInfectionDiscardModal()).toBe(true);
      session.closeInfectionDiscardModal();
      expect(session.showInfectionDiscardModal()).toBe(false);

      session.openVictoryDefeatModal();
      expect(session.showVictoryDefeatModal()).toBe(true);
      session.closeVictoryDefeatModal();
      expect(session.showVictoryDefeatModal()).toBe(false);

      session.openEventCardModal('airlift');
      expect(session.showEventCardModal()).toBe('airlift');
      session.openEventCardModal(null);
      expect(session.showEventCardModal()).toBe(null);
    });
  });

  describe('7. Session Tear Down & p2p:leave Handling', () => {
    it('leaves room, clears snapshot and resets selection signals', () => {
      session.createSoloMatch(2);
      session.selectCity('paris');

      session.leaveRoom();

      expect(session.snapshot()).toBe(null);
      expect(session.currentView()).toBe(null);
      expect(session.selectedCityId()).toBe(null);
      expect(session.showForecastModal()).toBe(false);
    });

    it('handles p2p:leave window event and navigates to lobby when on board route', () => {
      session.createSoloMatch(2);

      // Mock router url
      Object.defineProperty(router, 'url', {
        value: '/pandemic/board',
        writable: true,
      });

      window.dispatchEvent(
        new CustomEvent('p2p:leave', {
          detail: { game: 'pandemic' },
        })
      );

      expect(session.snapshot()).toBe(null);
      expect(router.navigate).toHaveBeenCalledWith(['/pandemic/lobby']);
    });
  });
});
