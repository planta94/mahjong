import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GenericLobby } from '../../../../core/models/party.model';
import { ShellUiService } from '../../../../core/services/shell-ui.service';
import {
  BalikKampungLobbySettings,
  BalikKampungSeat,
  CarPersonaId,
  DrivetrainType,
} from '../../models/balik-kampung.model';
import {
  BalikKampungSessionService,
  BalikKampungSnapshot,
} from '../../services/balik-kampung-session.service';
import { BalikKampungLobbyComponent } from './balik-kampung-lobby.component';

describe('BalikKampungLobbyComponent', () => {
  let component: BalikKampungLobbyComponent;
  let fixture: ComponentFixture<BalikKampungLobbyComponent>;
  let session: BalikKampungSessionService;
  let shellUi: ShellUiService;
  let queryParams$: BehaviorSubject<Map<string, string>>;

  beforeEach(async () => {
    queryParams$ = new BehaviorSubject<Map<string, string>>(
      new Map([['room', 'b2468']])
    );

    await TestBed.configureTestingModule({
      imports: [BalikKampungLobbyComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParams$.asObservable(),
          },
        },
      ],
    }).compileComponents();

    session = TestBed.inject(BalikKampungSessionService);
    shellUi = TestBed.inject(ShellUiService);
    session.leaveRoom();

    fixture = TestBed.createComponent(BalikKampungLobbyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    session.leaveRoom();
  });

  it('activates balik-kampung theme and detects URL ?room= invite code', () => {
    expect(shellUi.activeGame()).toBe('balik-kampung');
    expect(component.playerCount).toBe(3);
    expect(component.hasUrlInvite()).toBe(true);
    expect(component.joinCode).toBe('B2468');
    expect(component.visibleSoloPersonas.length).toBe(3);

    const root: HTMLElement = fixture.nativeElement;
    const inviteBanner = root.querySelector('.invite-banner');
    expect(inviteBanner?.textContent).toContain('B2468');
  });

  it('updates solo player count, named bot drivers, drivetrain selections, persona lookup, and rulebook trigger', () => {
    component.setPlayerCount(5);
    fixture.detectChanges();
    expect(component.playerCount).toBe(5);
    expect(component.visibleSoloPersonas.length).toBe(5);
    expect(component.getSoloBotKey(1)).toBe('BK.BOT_DRIVER_1');
    expect(component.getSoloBotKey(2)).toBe('BK.BOT_DRIVER_2');
    expect(component.getSoloBotKey(3)).toBe('BK.BOT_DRIVER_3');
    expect(component.getSoloBotKey(4)).toBe('BK.BOT_DRIVER_4');

    const root: HTMLElement = fixture.nativeElement;
    const driverNames = Array.from(root.querySelectorAll('.seat-card .driver-name')).map(
      (el) => el.textContent?.trim() ?? ''
    );
    expect(driverNames.length).toBe(5);
    expect(driverNames.at(1)?.includes('P2')).toBe(false);
    expect((driverNames.at(1)?.length ?? 0)).toBeGreaterThan(1);

    expect(component.getSoloDrivetrain(0)).toBe('ICE');
    expect(component.getSoloDrivetrain(1)).toBe('EV');
    expect(component.getSoloDrivetrain(99)).toBe('ICE');

    component.setSoloDrivetrain(0, 'EV');
    expect(component.getSoloDrivetrain(0)).toBe('EV');

    // Out-of-bounds indices safely no-op
    component.setSoloDrivetrain(-1, 'ICE');
    component.setSoloDrivetrain(99, 'ICE');
    expect(component.getSoloDrivetrain(0)).toBe('EV');

    expect(component.getPersonaMeta('red').hexColor).toBe('#ef4444');
    expect(component.getPersonaMeta('blue').defaultDrivetrain).toBe('EV');

    // Swap Seat 0 car from 'red' to 'emerald' (EV default) and verify Seat 3 receives 'red'
    expect(component.getSoloPersona(0)).toBe('red');
    expect(component.getSoloPersona(99)).toBe('red');
    component.setSoloPersona(0, 'emerald');
    expect(component.getSoloPersona(0)).toBe('emerald');
    expect(component.getSoloPersona(3)).toBe('red');
    expect(component.getSoloDrivetrain(0)).toBe('EV');
    // No-op on same persona or out-of-bounds index
    component.setSoloPersona(0, 'emerald');
    component.setSoloPersona(-1, 'purple');
    expect(component.getSoloPersona(0)).toBe('emerald');

    component.openRules();
    expect(shellUi.showRulebookModal()).toBe(true);
    expect(shellUi.rulebookGame()).toBe('balik-kampung');
    shellUi.closeRulebook();
  });

  it('starts solo match, creates P2P room, and validates join code input', () => {
    let soloCount = 0;
    let soloDrivetrains: DrivetrainType[] = [];
    let soloPersonas: CarPersonaId[] = [];
    session.createSoloMatch = (count = 3, dts = [], personas = []) => {
      soloCount = count;
      soloDrivetrains = [...dts];
      soloPersonas = [...personas];
    };

    component.setPlayerCount(4);
    component.setSoloPersona(0, 'purple');
    component.setSoloDrivetrain(2, 'EV');
    component.startSolo();

    expect(soloCount).toBe(4);
    expect(soloDrivetrains).toEqual(['ICE', 'EV', 'EV', 'EV']);
    expect(soloPersonas).toEqual(['purple', 'blue', 'yellow', 'emerald']);

    let createdRoomCount = 0;
    session.createMultiplayerRoom = (count = 3) => {
      createdRoomCount = count;
      return 'B9999';
    };
    component.createRoom();
    expect(createdRoomCount).toBe(4);

    let joinedRoomCode = '';
    session.joinMultiplayerRoom = (code: string) => {
      joinedRoomCode = code;
    };

    // Whitespace-only code does not invoke joinMultiplayerRoom
    component.joinCode = '   ';
    component.joinRoom();
    expect(joinedRoomCode).toBe('');

    component.joinCode = '  b7788 ';
    component.joinRoom();
    expect(joinedRoomCode).toBe('B7788');
  });

  it('renders host waiting room controls and forwards seat/count/start/leave actions', () => {
    const seats: BalikKampungSeat[] = [
      {
        seat: 0,
        kind: 'human',
        name: 'Host Driver',
        connected: true,
        drivetrain: 'ICE',
        persona: 'red',
      },
      {
        seat: 1,
        kind: 'bot',
        name: 'Kakak e.MAS (Bot)',
        connected: true,
        drivetrain: 'EV',
        persona: 'blue',
      },
      {
        seat: 2,
        kind: 'open',
        name: 'Open Slot',
        connected: false,
        drivetrain: 'ICE',
        persona: 'yellow',
      },
    ];

    const lobby: GenericLobby<BalikKampungSeat, BalikKampungLobbySettings> = {
      started: false,
      seats,
      rules: { numPlayers: 3 },
    };

    const hostSnap: BalikKampungSnapshot = {
      role: 'host',
      mySeat: 0,
      roomCode: 'B5566',
      lobby,
      view: null,
      online: true,
      status: 'Waiting for convoy',
      error: 'Sample peer warning',
    };

    session.snapshot.set(hostSnap);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.room-code-heading')?.textContent?.trim()).toBe('B5566');
    expect(root.querySelector('.banner-alert')?.textContent?.trim()).toBe(
      'Sample peer warning'
    );
    expect(root.querySelectorAll('.seat-card').length).toBe(3);

    expect(component.canEditRoomSeatDrivetrain(0)).toBe(true);
    expect(component.canEditRoomSeatDrivetrain(2)).toBe(true);

    let updatedCount = 0;
    session.setLobbySeatCount = (c: number) => {
      updatedCount = c;
    };
    component.setRoomSeatCount(5);
    expect(updatedCount).toBe(5);

    let toggledIdx = -1;
    session.toggleSeatKind = (idx: number) => {
      toggledIdx = idx;
    };
    component.toggleRoomSeatKind(2);
    expect(toggledIdx).toBe(2);

    let changedSeat = -1;
    let changedDt: DrivetrainType = 'ICE';
    session.setSeatDrivetrain = (idx: number, dt: DrivetrainType) => {
      changedSeat = idx;
      changedDt = dt;
    };
    component.setRoomSeatDrivetrain(1, 'ICE');
    expect(changedSeat).toBe(1);
    expect(changedDt).toBe('ICE');

    let changedPersonaSeat = -1;
    let changedPersona: CarPersonaId = 'red';
    session.setSeatPersona = (idx: number, p: CarPersonaId) => {
      changedPersonaSeat = idx;
      changedPersona = p;
    };
    component.setRoomSeatPersona(0, 'purple');
    expect(changedPersonaSeat).toBe(0);
    expect(changedPersona).toBe('purple');

    let startedOnline = false;
    session.startMatchFromLobby = () => {
      startedOnline = true;
    };
    component.startOnlineMatch();
    expect(startedOnline).toBe(true);

    component.leaveWaitingRoom();
    expect(session.snapshot()).toBeNull();
    expect(component.hasUrlInvite()).toBe(false);
    expect(component.joinCode).toBe('');
  });

  it('restricts guest waiting room drivetrain toggles to guest own seat only', () => {
    const seats: BalikKampungSeat[] = [
      {
        seat: 0,
        kind: 'human',
        name: 'Host Driver',
        connected: true,
        drivetrain: 'ICE',
        persona: 'red',
      },
      {
        seat: 1,
        kind: 'human',
        name: 'Guest Driver',
        connected: true,
        drivetrain: 'EV',
        persona: 'blue',
      },
    ];

    const guestSnap: BalikKampungSnapshot = {
      role: 'guest',
      mySeat: 1,
      roomCode: 'B8899',
      lobby: {
        started: false,
        seats,
        rules: { numPlayers: 2 },
      },
      view: null,
      online: true,
      status: 'Connected to host',
      error: null,
    };

    session.snapshot.set(guestSnap);
    // Emit a new queryParam while snapshot is active — should not overwrite invite state
    queryParams$.next(new Map([['room', 'b0001']]));
    fixture.detectChanges();

    expect(component.canEditRoomSeatDrivetrain(0)).toBe(false);
    expect(component.canEditRoomSeatDrivetrain(1)).toBe(true);

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('.start-convoy-btn').length).toBe(0);
    expect(root.querySelectorAll('.guest-waiting-note').length).toBe(1);
  });
});
