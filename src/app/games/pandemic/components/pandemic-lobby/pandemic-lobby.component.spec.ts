import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, beforeEach } from 'vitest';
import { GenericLobby } from '../../../../core/models/party.model';
import {
  DifficultyLevel,
  PandemicLobbySettings,
  PandemicSeat,
  SpecialistRole,
} from '../../models/pandemic.model';
import {
  PandemicSessionService,
  PandemicSnapshot,
} from '../../services/pandemic-session.service';
import { PandemicLobbyComponent } from './pandemic-lobby.component';

describe('PandemicLobbyComponent', () => {
  let component: PandemicLobbyComponent;
  let fixture: ComponentFixture<PandemicLobbyComponent>;
  let session: PandemicSessionService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PandemicLobbyComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(new Map([['room', 'D123']])),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PandemicLobbyComponent);
    component = fixture.componentInstance;
    session = TestBed.inject(PandemicSessionService);
    session.leaveRoom();
    fixture.detectChanges();
  });

  it('initializes with default settings and handles URL room invite', () => {
    expect(component.playerCount).toBe(4);
    expect(component.difficulty).toBe('standard');
    expect(component.soloCommander).toBe(false);
    expect(component.hasUrlInvite()).toBe(true);
    expect(component.joinCode).toBe('D123');
    expect(component.seatRoles.length).toBe(4);

    const root: HTMLElement = fixture.nativeElement;
    const actionBtns = root.querySelectorAll('.lobby-card .actions-row .btn');
    expect(actionBtns.length).toBe(3);
    expect(actionBtns.item(1)?.classList.contains('btn-cyan')).toBe(true);
  });

  it('updates role for seat using onRoleChange and generates correct settings', () => {
    component.playerCount = 3;
    component.difficulty = 'heroic';
    component.onRoleChange(0, 'medic');
    component.onRoleChange(1, 'scientist');
    component.onRoleChange(2, 'random');

    const settings = component.getLobbySettings();
    expect(settings.difficulty).toBe('heroic');
    expect(settings.numPlayers).toBe(3);
    expect(settings.roles).toEqual(['medic', 'scientist']);

    // Invalid index does not crash
    component.onRoleChange(99, 'medic');
    expect(component.seatRoles.length).toBe(4);
  });

  it('getLobbySettings handles all random roles by setting roles to undefined', () => {
    component.seatRoles = ['random', 'random', 'random', 'random'];
    const settings = component.getLobbySettings();
    expect(settings.roles).toBeUndefined();
  });

  it('starts solo match with configured settings', () => {
    let capturedCount = 0;
    let capturedSettings: Partial<PandemicLobbySettings> | undefined;

    session.createSoloMatch = (count = 4, s) => {
      capturedCount = count;
      capturedSettings = s;
    };

    component.playerCount = 3;
    component.difficulty = 'introductory';
    component.startSolo();

    expect(capturedCount).toBe(3);
    expect(capturedSettings?.difficulty).toBe('introductory');
    expect(capturedSettings?.soloCommander).toBe(false);
  });

  it('starts solo commander match with soloCommander flag set to true', () => {
    let capturedCount = 0;
    let capturedSettings: Partial<PandemicLobbySettings> | undefined;

    session.createSoloCommanderMatch = (count = 4, s) => {
      capturedCount = count;
      capturedSettings = s;
    };

    component.playerCount = 2;
    component.difficulty = 'heroic';
    component.startSoloCommander();

    expect(capturedCount).toBe(2);
    expect(capturedSettings?.soloCommander).toBe(true);
  });

  it('creates multiplayer room and joins room', () => {
    let createdCount = 0;
    session.createMultiplayerRoom = (count = 4) => {
      createdCount = count;
      return 'D999';
    };

    component.playerCount = 4;
    component.createRoom();
    expect(createdCount).toBe(4);

    let joinedCode = '';
    session.joinMultiplayerRoom = (code) => {
      joinedCode = code;
    };

    component.joinCode = '  d456  ';
    component.joinRoom();
    expect(joinedCode).toBe('D456');

    // Empty join code does not trigger join
    joinedCode = '';
    component.joinCode = '   ';
    component.joinRoom();
    expect(joinedCode).toBe('');
  });

  it('returns role badge colors accurately', () => {
    expect(component.getRoleColor('medic')).toBe('#e67e22');
    expect(component.getRoleColor('scientist')).toBe('#bdc3c7');
    expect(component.getRoleColor('dispatcher')).toBe('#9b59b6');
    expect(component.getRoleColor('random')).toBe('#64748b');
    expect(component.getRoleColor(undefined)).toBe('#64748b');
  });

  it('renders waiting room view when session snapshot exists', () => {
    const mockSeats: PandemicSeat[] = [
      {
        seat: 0,
        kind: 'human',
        name: 'Host Commander',
        connected: true,
        role: 'medic',
      },
      {
        seat: 1,
        kind: 'bot',
        name: 'Bot 1',
        connected: true,
        role: 'scientist',
      },
      {
        seat: 2,
        kind: 'open',
        name: 'Open Seat',
        connected: false,
        role: 'random',
      },
    ];

    const mockLobby: GenericLobby<PandemicSeat, PandemicLobbySettings> = {
      started: false,
      seats: mockSeats,
      rules: {
        difficulty: 'standard',
        numPlayers: 3,
        soloCommander: false,
      },
    };

    const mockSnapshot: PandemicSnapshot = {
      role: 'host',
      mySeat: 0,
      roomCode: 'D777',
      lobby: mockLobby,
      view: null,
      online: true,
      status: 'connected',
      error: null,
    };

    session.snapshot.set(mockSnapshot);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const roomCodeEl = root.querySelector('.room-code-tag');
    expect(roomCodeEl?.textContent?.trim()).toBe('D777');

    const seatRows = root.querySelectorAll('.seat-row');
    expect(seatRows.length).toBe(3);

    // Host controls test
    let toggledSeat = -1;
    session.toggleSeatKind = (idx) => {
      toggledSeat = idx;
    };
    component.toggleSeat(1);
    expect(toggledSeat).toBe(1);

    let changedSeat = -1;
    let changedRole: SpecialistRole | 'random' = 'random';
    session.setSeatRole = (idx, r) => {
      changedSeat = idx;
      changedRole = r;
    };
    component.setSeatRole(1, 'researcher');
    expect(changedSeat).toBe(1);
    expect(changedRole).toBe('researcher');

    let setDiff: DifficultyLevel = 'standard';
    session.setDifficulty = (d) => {
      setDiff = d;
    };
    component.setDifficulty('heroic');
    expect(setDiff).toBe('heroic');

    let started = false;
    session.startMatchFromLobby = () => {
      started = true;
    };
    component.startMatch();
    expect(started).toBe(true);

    component.leaveRoom();
    expect(component.hasUrlInvite()).toBe(false);
    expect(component.joinCode).toBe('');
  });

  it('renders guest waiting room view with wait hint and solo commander tag', () => {
    const mockSeats: PandemicSeat[] = [
      {
        seat: 0,
        kind: 'human',
        name: 'Commander Alpha',
        connected: true,
        role: 'medic',
      },
      {
        seat: 1,
        kind: 'human',
        name: 'Guest Specialist',
        connected: true,
        role: 'scientist',
      },
    ];

    const mockLobby: GenericLobby<PandemicSeat, PandemicLobbySettings> = {
      started: false,
      seats: mockSeats,
      rules: {
        difficulty: 'heroic',
        numPlayers: 2,
        soloCommander: true,
      },
    };

    const mockSnapshot: PandemicSnapshot = {
      role: 'guest',
      mySeat: 1,
      roomCode: 'D888',
      lobby: mockLobby,
      view: null,
      online: true,
      status: 'connected',
      error: null,
    };

    session.snapshot.set(mockSnapshot);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.guest-wait-hint')?.textContent?.trim().length).toBeGreaterThan(0);
    expect(root.querySelector('.commander-tag')?.textContent?.trim().length).toBeGreaterThan(0);

    expect(component.getDifficultyKey(undefined)).toBe('PANDEMIC.DIFF_STANDARD');
    expect(component.getDifficultyKey('introductory')).toBe('PANDEMIC.DIFF_INTRODUCTORY');
    expect(component.getDifficultyKey('standard')).toBe('PANDEMIC.DIFF_STANDARD');
    expect(component.getDifficultyKey('heroic')).toBe('PANDEMIC.DIFF_HEROIC');

    expect(component.getRoleNameKey(undefined)).toBe('PANDEMIC.ROLE_RANDOM');
    expect(component.getRoleNameKey('random')).toBe('PANDEMIC.ROLE_RANDOM');
    expect(component.getRoleNameKey('medic')).toBe('PANDEMIC.ROLE_MEDIC_NAME');
  });
});
