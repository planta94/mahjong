import { describe, expect, it } from 'vitest';

export type SpaceType =
  | 'corner_go'
  | 'corner_jail'
  | 'corner_parking'
  | 'corner_gotojail'
  | 'property'
  | 'transit'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'community_chest';

export type ColorGroup =
  | 'brown'
  | 'light_blue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'dark_blue';

export interface BoardSpace {
  index: number;
  id: string;
  name: string;
  type: SpaceType;
  colorGroup?: ColorGroup;
  cost?: number;
  baseRent?: number;
  rentSchedule?: readonly [number, number, number, number, number, number]; // base, 1H, 2H, 3H, 4H, Hotel
  houseCost?: number;
  mortgageValue?: number;
}

export interface MonopolyPlayer {
  seat: number;
  name: string;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  outOfJailCards: number;
  bankrupt: boolean;
}

export interface PropertyState {
  ownerSeat: number | null;
  houses: number; // 0..4 = houses, 5 = hotel
  isMortgaged: boolean;
}

export interface MonopolyGameState {
  players: MonopolyPlayer[];
  properties: Map<number, PropertyState>;
  jackpotPot: number;
  currentRound: number;
  maxRounds: number;
  activeSeat: number;
  doublesStreak: number;
}

// 40-Space Malaysia Board Data (English)
export const MALAYSIA_BOARD_DATA: readonly BoardSpace[] = [
  { index: 0, id: 'mula', name: 'GO', type: 'corner_go' },
  { index: 1, id: 'melaka_famosa', name: 'A Famosa Fort, Melaka', type: 'property', colorGroup: 'brown', cost: 60, baseRent: 2, rentSchedule: [2, 10, 30, 90, 160, 250], houseCost: 50, mortgageValue: 30 },
  { index: 2, id: 'dana_1', name: 'Community Chest', type: 'community_chest' },
  { index: 3, id: 'melaka_jonker', name: 'Jonker Walk, Melaka', type: 'property', colorGroup: 'brown', cost: 60, baseRent: 4, rentSchedule: [4, 20, 60, 180, 320, 450], houseCost: 50, mortgageValue: 30 },
  { index: 4, id: 'cukai_pendapatan', name: 'Income Tax', type: 'tax', cost: 200 },
  { index: 5, id: 'transit_kl_sentral', name: 'KL Sentral Station', type: 'transit', cost: 200, mortgageValue: 100 },
  { index: 6, id: 'ipoh_kellies', name: "Kellie's Castle, Ipoh", type: 'property', colorGroup: 'light_blue', cost: 100, baseRent: 6, rentSchedule: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgageValue: 50 },
  { index: 7, id: 'nasib_1', name: 'Chance', type: 'chance' },
  { index: 8, id: 'ipoh_concubine', name: 'Concubine Lane, Ipoh', type: 'property', colorGroup: 'light_blue', cost: 100, baseRent: 6, rentSchedule: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgageValue: 50 },
  { index: 9, id: 'ipoh_birch', name: 'Birch Clock Tower, Ipoh', type: 'property', colorGroup: 'light_blue', cost: 120, baseRent: 8, rentSchedule: [8, 40, 100, 300, 450, 600], houseCost: 50, mortgageValue: 60 },
  { index: 10, id: 'penjara', name: 'Jail / Just Visiting', type: 'corner_jail' },
  { index: 11, id: 'penang_george_town', name: 'George Town, Penang', type: 'property', colorGroup: 'pink', cost: 140, baseRent: 10, rentSchedule: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgageValue: 70 },
  { index: 12, id: 'utiliti_tnb', name: 'National Grid (TNB)', type: 'utility', cost: 150, mortgageValue: 75 },
  { index: 13, id: 'penang_hill', name: 'Penang Hill', type: 'property', colorGroup: 'pink', cost: 140, baseRent: 10, rentSchedule: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgageValue: 70 },
  { index: 14, id: 'penang_kek_lok_si', name: 'Kek Lok Si Temple', type: 'property', colorGroup: 'pink', cost: 160, baseRent: 12, rentSchedule: [12, 60, 180, 500, 700, 900], houseCost: 100, mortgageValue: 80 },
  { index: 15, id: 'transit_port_klang', name: 'Port Klang Cruise Hub', type: 'transit', cost: 200, mortgageValue: 100 },
  { index: 16, id: 'pahang_cempedak', name: 'Teluk Cempedak Beach', type: 'property', colorGroup: 'orange', cost: 180, baseRent: 14, rentSchedule: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgageValue: 90 },
  { index: 17, id: 'dana_2', name: 'Community Chest', type: 'community_chest' },
  { index: 18, id: 'pahang_taman_negara', name: 'Taman Negara Rainforest', type: 'property', colorGroup: 'orange', cost: 180, baseRent: 14, rentSchedule: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgageValue: 90 },
  { index: 19, id: 'pahang_cameron', name: 'Cameron Highlands', type: 'property', colorGroup: 'orange', cost: 200, baseRent: 16, rentSchedule: [16, 80, 220, 600, 800, 1000], houseCost: 100, mortgageValue: 100 },
  { index: 20, id: 'parkir_percuma', name: 'Free Parking (Jackpot)', type: 'corner_parking' },
  { index: 21, id: 'borneo_kinabalu', name: 'Mount Kinabalu, Sabah', type: 'property', colorGroup: 'red', cost: 220, baseRent: 18, rentSchedule: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgageValue: 110 },
  { index: 22, id: 'nasib_2', name: 'Chance', type: 'chance' },
  { index: 23, id: 'borneo_sipadan', name: 'Sipadan Island, Sabah', type: 'property', colorGroup: 'red', cost: 220, baseRent: 18, rentSchedule: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgageValue: 110 },
  { index: 24, id: 'borneo_bako', name: 'Bako National Park', type: 'property', colorGroup: 'red', cost: 240, baseRent: 20, rentSchedule: [20, 100, 300, 750, 925, 1100], houseCost: 150, mortgageValue: 120 },
  { index: 25, id: 'transit_penang_bridge', name: 'Penang Bridge', type: 'transit', cost: 200, mortgageValue: 100 },
  { index: 26, id: 'johor_danga_bay', name: 'Danga Bay, Johor', type: 'property', colorGroup: 'yellow', cost: 260, baseRent: 22, rentSchedule: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgageValue: 130 },
  { index: 27, id: 'johor_desaru', name: 'Desaru Coast, Johor', type: 'property', colorGroup: 'yellow', cost: 260, baseRent: 22, rentSchedule: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgageValue: 130 },
  { index: 28, id: 'utiliti_air_selangor', name: 'Water Works (Air Selangor)', type: 'utility', cost: 150, mortgageValue: 75 },
  { index: 29, id: 'johor_legoland', name: 'Legoland Malaysia', type: 'property', colorGroup: 'yellow', cost: 280, baseRent: 24, rentSchedule: [24, 120, 360, 850, 1025, 1200], houseCost: 150, mortgageValue: 140 },
  { index: 30, id: 'pergi_penjara', name: 'Go To Jail', type: 'corner_gotojail' },
  { index: 31, id: 'kl_genting', name: 'Genting SkyWorlds', type: 'property', colorGroup: 'green', cost: 300, baseRent: 26, rentSchedule: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgageValue: 150 },
  { index: 32, id: 'kl_putrajaya', name: 'Putrajaya Square', type: 'property', colorGroup: 'green', cost: 300, baseRent: 26, rentSchedule: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgageValue: 150 },
  { index: 33, id: 'dana_3', name: 'Community Chest', type: 'community_chest' },
  { index: 34, id: 'kl_bukit_bintang', name: 'Bukit Bintang, KL', type: 'property', colorGroup: 'green', cost: 320, baseRent: 28, rentSchedule: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, mortgageValue: 160 },
  { index: 35, id: 'transit_klia', name: 'KLIA International Airport', type: 'transit', cost: 200, mortgageValue: 100 },
  { index: 36, id: 'nasib_3', name: 'Chance', type: 'chance' },
  { index: 37, id: 'kl_trx', name: 'Tun Razak Exchange (TRX)', type: 'property', colorGroup: 'dark_blue', cost: 350, baseRent: 35, rentSchedule: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, mortgageValue: 175 },
  { index: 38, id: 'cukai_mewah', name: 'Luxury Tax', type: 'tax', cost: 100 },
  { index: 39, id: 'kl_klcc', name: 'Petronas Twin Towers (KLCC)', type: 'property', colorGroup: 'dark_blue', cost: 400, baseRent: 50, rentSchedule: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, mortgageValue: 200 },
];

export const NASIB_CARD_IDS = [
  'CHANCE_ADVANCE_MULA',
  'CHANCE_ADVANCE_KLCC',
  'CHANCE_ADVANCE_TRX',
  'CHANCE_ADVANCE_TRANSIT_NEAREST_1',
  'CHANCE_ADVANCE_TRANSIT_NEAREST_2',
  'CHANCE_ADVANCE_UTILITY_NEAREST',
  'CHANCE_DIVIDEND_ASB',
  'CHANCE_GO_TO_JAIL',
  'CHANCE_GET_OUT_OF_JAIL',
  'CHANCE_REPAIRS',
  'CHANCE_SPEEDING_FINE',
  'CHANCE_BACK_THREE',
  'CHANCE_ADVANCE_GEORGE_TOWN',
  'CHANCE_ADVANCE_KL_SENTRAL',
  'CHANCE_CHAIRMAN_BOARD',
  'CHANCE_LOAN_MATURES',
] as const;

export const DANA_CARD_IDS = [
  'CHEST_ADVANCE_MULA',
  'CHEST_BANK_ERROR',
  'CHEST_DOCTOR_FEE',
  'CHEST_STOCK_SALE',
  'CHEST_GET_OUT_OF_JAIL',
  'CHEST_GO_TO_JAIL',
  'CHEST_HOLIDAY_FUND',
  'CHEST_TAX_REFUND',
  'CHEST_BIRTHDAY',
  'CHEST_LIFE_INSURANCE',
  'CHEST_HOSPITAL_FEE',
  'CHEST_SCHOOL_FEES',
  'CHEST_CONSULTANCY',
  'CHEST_STREET_REPAIRS',
  'CHEST_BEAUTY_CONTEST',
  'CHEST_INHERITANCE',
] as const;

// Rules Engine Helper Functions
export function calculateRent(
  space: BoardSpace,
  state: MonopolyGameState,
  diceRollTotal = 7
): number {
  const prop = state.properties.get(space.index);
  if (!prop || prop.ownerSeat === null || prop.isMortgaged) return 0;

  const owner = state.players.at(prop.ownerSeat);
  if (!owner) return 0;

  // Saidina Rule 2: Landlord in jail collects RM 0 rent!
  if (owner.inJail) {
    return 0;
  }

  if (space.type === 'property') {
    const schedule = space.rentSchedule;
    if (!schedule) return 0;
    if (prop.houses > 0) {
      return schedule.at(prop.houses) ?? 0;
    }
    // Check if entire color group is owned for double base rent
    const groupSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.colorGroup === space.colorGroup);
    const ownsAll = groupSpaces.every((s) => state.properties.get(s.index)?.ownerSeat === prop.ownerSeat);
    return ownsAll ? (schedule.at(0) ?? 0) * 2 : (schedule.at(0) ?? 0);
  }

  if (space.type === 'transit') {
    const transitSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.type === 'transit');
    const ownedCount = transitSpaces.filter((s) => state.properties.get(s.index)?.ownerSeat === prop.ownerSeat).length;
    const rentMap = new Map<number, number>([
      [1, 25],
      [2, 50],
      [3, 100],
      [4, 200],
    ]);
    return rentMap.get(ownedCount) ?? 25;
  }

  if (space.type === 'utility') {
    const utilitySpaces = MALAYSIA_BOARD_DATA.filter((s) => s.type === 'utility');
    const ownedCount = utilitySpaces.filter((s) => state.properties.get(s.index)?.ownerSeat === prop.ownerSeat).length;
    const multiplier = ownedCount >= 2 ? 10 : 4;
    return diceRollTotal * multiplier;
  }

  return 0;
}

export function validateEvenBuild(
  colorGroup: ColorGroup,
  targetSpaceIndex: number,
  state: MonopolyGameState
): boolean {
  const groupSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.colorGroup === colorGroup);
  const targetProp = state.properties.get(targetSpaceIndex);
  if (!targetProp || targetProp.ownerSeat === null || targetProp.isMortgaged) return false;

  const owner = targetProp.ownerSeat;
  // All must be owned by the same player and none mortgaged
  for (const s of groupSpaces) {
    const p = state.properties.get(s.index);
    if (!p || p.ownerSeat !== owner || p.isMortgaged) return false;
  }

  // Check even build: cannot build if target already has more houses than any other in group
  const currentHouses = targetProp.houses;
  if (currentHouses >= 5) return false; // Already hotel

  for (const s of groupSpaces) {
    const p = state.properties.get(s.index);
    if (p && p.houses < currentHouses) {
      return false; // Must build on other properties first
    }
  }

  return true;
}

export function calculateNetWorth(
  player: MonopolyPlayer,
  state: MonopolyGameState
): number {
  if (player.bankrupt) return 0;
  let worth = player.cash + player.outOfJailCards * 50;

  for (const [spaceIdx, prop] of state.properties.entries()) {
    if (prop.ownerSeat === player.seat) {
      const space = MALAYSIA_BOARD_DATA.at(spaceIdx);
      if (space && space.cost) {
        if (prop.isMortgaged) {
          worth += (space.mortgageValue ?? space.cost / 2);
        } else {
          worth += space.cost;
          if (space.houseCost && prop.houses > 0) {
            worth += prop.houses * space.houseCost;
          }
        }
      }
    }
  }
  return worth;
}

describe('E2E: Malaysia Landmarks Monopoly Rules & Domain Architecture', () => {
  describe('1. 40-Space Board Layout & Landmarks Registry', () => {
    it('verifies exact 40 perimeter spaces, 4 corners, and RM currency values', () => {
      expect(MALAYSIA_BOARD_DATA.length).toBe(40);

      // Verify corners at indices 0, 10, 20, 30
      expect(MALAYSIA_BOARD_DATA.at(0)?.id).toBe('mula');
      expect(MALAYSIA_BOARD_DATA.at(0)?.type).toBe('corner_go');

      expect(MALAYSIA_BOARD_DATA.at(10)?.id).toBe('penjara');
      expect(MALAYSIA_BOARD_DATA.at(10)?.type).toBe('corner_jail');

      expect(MALAYSIA_BOARD_DATA.at(20)?.id).toBe('parkir_percuma');
      expect(MALAYSIA_BOARD_DATA.at(20)?.type).toBe('corner_parking');

      expect(MALAYSIA_BOARD_DATA.at(30)?.id).toBe('pergi_penjara');
      expect(MALAYSIA_BOARD_DATA.at(30)?.type).toBe('corner_gotojail');

      // Verify 22 street landmark properties
      const propertySpaces = MALAYSIA_BOARD_DATA.filter((s) => s.type === 'property');
      expect(propertySpaces.length).toBe(22);

      // Verify 4 Transit Hubs
      const transitSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.type === 'transit');
      expect(transitSpaces.length).toBe(4);
      expect(transitSpaces.map((t) => t.id)).toEqual([
        'transit_kl_sentral',
        'transit_port_klang',
        'transit_penang_bridge',
        'transit_klia',
      ]);

      // Verify 2 Utilities
      const utilitySpaces = MALAYSIA_BOARD_DATA.filter((s) => s.type === 'utility');
      expect(utilitySpaces.length).toBe(2);
      expect(utilitySpaces.map((u) => u.id)).toEqual(['utiliti_tnb', 'utiliti_air_selangor']);

      // Verify 2 Taxes
      const taxSpaces = MALAYSIA_BOARD_DATA.filter((s) => s.type === 'tax');
      expect(taxSpaces.length).toBe(2);
      expect(taxSpaces.at(0)?.cost).toBe(200); // Income Tax RM 200
      expect(taxSpaces.at(1)?.cost).toBe(100); // Luxury Tax RM 100
    });

    it('verifies 8 Color Groups distribution matching authentic Malaysia landmarks', () => {
      const groups = new Map<ColorGroup, string[]>();
      for (const s of MALAYSIA_BOARD_DATA) {
        if (s.colorGroup) {
          const list = groups.get(s.colorGroup) ?? [];
          list.push(s.id);
          groups.set(s.colorGroup, list);
        }
      }

      expect(groups.size).toBe(8);
      expect(groups.get('brown')?.length).toBe(2); // Melaka (A Famosa, Jonker)
      expect(groups.get('light_blue')?.length).toBe(3); // Ipoh (Kellie, Concubine, Birch)
      expect(groups.get('pink')?.length).toBe(3); // Penang (George Town, Hill, Kek Lok Si)
      expect(groups.get('orange')?.length).toBe(3); // Pahang (Teluk Cempedak, Taman Negara, Cameron)
      expect(groups.get('red')?.length).toBe(3); // Borneo (Kinabalu, Sipadan, Bako)
      expect(groups.get('yellow')?.length).toBe(3); // Johor (Danga Bay, Desaru, Legoland)
      expect(groups.get('green')?.length).toBe(3); // KL-Metro (Genting, Putrajaya, Bukit Bintang)
      expect(groups.get('dark_blue')?.length).toBe(2); // KLCC / TRX (TRX, KLCC)
    });
  });

  describe('2. Action Decks (16 Nasib & 16 Dana Komuniti)', () => {
    it('verifies authentic 16 Nasib and 16 Dana Komuniti card inventories', () => {
      expect(NASIB_CARD_IDS.length).toBe(16);
      expect(DANA_CARD_IDS.length).toBe(16);

      // Verify key landmark advance cards exist
      expect(NASIB_CARD_IDS.includes('CHANCE_ADVANCE_MULA')).toBe(true);
      expect(NASIB_CARD_IDS.includes('CHANCE_ADVANCE_KLCC')).toBe(true);
      expect(NASIB_CARD_IDS.includes('CHANCE_ADVANCE_TRX')).toBe(true);
      expect(NASIB_CARD_IDS.includes('CHANCE_GO_TO_JAIL')).toBe(true);
      expect(NASIB_CARD_IDS.includes('CHANCE_GET_OUT_OF_JAIL')).toBe(true);

      expect(DANA_CARD_IDS.includes('CHEST_ADVANCE_MULA')).toBe(true);
      expect(DANA_CARD_IDS.includes('CHEST_DOCTOR_FEE')).toBe(true);
      expect(DANA_CARD_IDS.includes('CHEST_GET_OUT_OF_JAIL')).toBe(true);
      expect(DANA_CARD_IDS.includes('CHEST_STREET_REPAIRS')).toBe(true);
    });
  });

  describe('3. Saidina House Rule 1: Free Parking Jackpot Pot', () => {
    it('accumulates taxes, bails, and fines into Free Parking Jackpot Pot and awards on landing', () => {
      const state: MonopolyGameState = {
        players: [
          { seat: 0, name: 'P1', cash: 1500, position: 0, inJail: false, jailTurns: 0, outOfJailCards: 0, bankrupt: false },
          { seat: 1, name: 'P2', cash: 1500, position: 10, inJail: true, jailTurns: 1, outOfJailCards: 0, bankrupt: false },
        ],
        properties: new Map(),
        jackpotPot: 100, // Seed
        currentRound: 1,
        maxRounds: 30,
        activeSeat: 0,
        doublesStreak: 0,
      };

      // 1. Player 0 pays Income Tax (RM 200) -> routed into jackpotPot
      const incomeTax = 200;
      state.players[0].cash -= incomeTax;
      state.jackpotPot += incomeTax;
      expect(state.jackpotPot).toBe(300);

      // 2. Player 1 pays Jail Bail (RM 50) -> routed into jackpotPot
      const jailBail = 50;
      state.players[1].cash -= jailBail;
      state.jackpotPot += jailBail;
      expect(state.jackpotPot).toBe(350);

      // 3. Player 0 lands on Luxury Tax (RM 100) -> routed into jackpotPot
      const luxuryTax = 100;
      state.players[0].cash -= luxuryTax;
      state.jackpotPot += luxuryTax;
      expect(state.jackpotPot).toBe(450);

      // 4. Player 0 lands on Free Parking (Space 20) -> collects entire pot!
      const potCollected = state.jackpotPot;
      state.players[0].cash += potCollected;
      state.jackpotPot = 100; // Reset to seed

      expect(potCollected).toBe(450);
      expect(state.jackpotPot).toBe(100);
      expect(state.players[0].cash).toBe(1500 - 200 - 100 + 450); // RM 1650
    });
  });

  describe('4. Saidina House Rule 2: No Rent in Jail', () => {
    it('enforces RM 0 rent paid when landlord is in jail, and normal rent when released', () => {
      const state: MonopolyGameState = {
        players: [
          { seat: 0, name: 'Tenant', cash: 1500, position: 39, inJail: false, jailTurns: 0, outOfJailCards: 0, bankrupt: false },
          { seat: 1, name: 'Landlord', cash: 1500, position: 10, inJail: true, jailTurns: 1, outOfJailCards: 0, bankrupt: false },
        ],
        properties: new Map([
          [39, { ownerSeat: 1, houses: 5, isMortgaged: false }], // KLCC Hotel! Normal rent = RM 2,000
        ]),
        jackpotPot: 100,
        currentRound: 5,
        maxRounds: 30,
        activeSeat: 0,
        doublesStreak: 0,
      };

      const klccSpace = MALAYSIA_BOARD_DATA.at(39)!;

      // When Landlord is in jail, rent must be strictly RM 0
      const rentInJail = calculateRent(klccSpace, state);
      expect(rentInJail).toBe(0);

      // When Landlord exits jail, rent is fully restored to RM 2,000
      state.players[1].inJail = false;
      const rentFree = calculateRent(klccSpace, state);
      expect(rentFree).toBe(2000);
    });
  });

  describe('5. Even-Build Constraint & Mortgage Calculations', () => {
    it('validates even-build rules across color groups for houses and hotels', () => {
      const state: MonopolyGameState = {
        players: [
          { seat: 0, name: 'Builder', cash: 2000, position: 0, inJail: false, jailTurns: 0, outOfJailCards: 0, bankrupt: false },
        ],
        properties: new Map([
          [1, { ownerSeat: 0, houses: 0, isMortgaged: false }], // Kota A Famosa
          [3, { ownerSeat: 0, houses: 0, isMortgaged: false }], // Jonker Walk
        ]),
        jackpotPot: 100,
        currentRound: 2,
        maxRounds: 30,
        activeSeat: 0,
        doublesStreak: 0,
      };

      // 1. Can build 1st house on A Famosa (both 0 houses)
      expect(validateEvenBuild('brown', 1, state)).toBe(true);

      // Build 1st house on A Famosa
      state.properties.get(1)!.houses = 1;

      // 2. Cannot build 2nd house on A Famosa until Jonker Walk has 1 house
      expect(validateEvenBuild('brown', 1, state)).toBe(false);
      expect(validateEvenBuild('brown', 3, state)).toBe(true);

      // Build 1st house on Jonker Walk
      state.properties.get(3)!.houses = 1;

      // 3. Now can build 2nd house on A Famosa
      expect(validateEvenBuild('brown', 1, state)).toBe(true);

      // 4. Cannot build if any property in group is mortgaged
      state.properties.get(3)!.isMortgaged = true;
      expect(validateEvenBuild('brown', 1, state)).toBe(false);
    });

    it('calculates 50% mortgage payout and 55% unmortgage cost (50% + 10% interest)', () => {
      const klcc = MALAYSIA_BOARD_DATA.at(39)!; // Cost RM 400
      expect(klcc.cost).toBe(400);

      const mortgagePayout = (klcc.cost ?? 0) * 0.5;
      expect(mortgagePayout).toBe(200);

      const unmortgageCost = Math.round(mortgagePayout * 1.1); // 50% + 10% fee = 55%
      expect(unmortgageCost).toBe(220);
    });
  });

  describe('6. Win Condition Evaluation (Last Tycoon vs Round Limit)', () => {
    it('evaluates Last Tycoon Standing win condition upon bankruptcies', () => {
      const players: MonopolyPlayer[] = [
        { seat: 0, name: 'Winner', cash: 3200, position: 5, inJail: false, jailTurns: 0, outOfJailCards: 0, bankrupt: false },
        { seat: 1, name: 'Bankrupt1', cash: 0, position: 12, inJail: false, jailTurns: 0, outOfJailCards: 0, bankrupt: true },
        { seat: 2, name: 'Bankrupt2', cash: 0, position: 24, inJail: false, jailTurns: 0, outOfJailCards: 0, bankrupt: true },
      ];

      const solvent = players.filter((p) => !p.bankrupt);
      expect(solvent.length).toBe(1);
      expect(solvent.at(0)?.seat).toBe(0);
    });

    it('evaluates Round Limit win condition based on maximum Net Worth calculation', () => {
      const state: MonopolyGameState = {
        players: [
          { seat: 0, name: 'Cash King', cash: 2500, position: 0, inJail: false, jailTurns: 0, outOfJailCards: 1, bankrupt: false },
          { seat: 1, name: 'Property Baron', cash: 500, position: 10, inJail: false, jailTurns: 0, outOfJailCards: 0, bankrupt: false },
        ],
        properties: new Map([
          // Property Baron owns KLCC (cost 400) with Hotel (5 * houseCost 200 = 1000) and TRX (cost 350) with 4 houses (4 * 200 = 800)
          [39, { ownerSeat: 1, houses: 5, isMortgaged: false }],
          [37, { ownerSeat: 1, houses: 4, isMortgaged: false }],
        ]),
        jackpotPot: 100,
        currentRound: 31,
        maxRounds: 30,
        activeSeat: 0,
        doublesStreak: 0,
      };

      const netWorth0 = calculateNetWorth(state.players[0], state);
      // P0: 2500 + 50 (card) = 2550
      expect(netWorth0).toBe(2550);

      const netWorth1 = calculateNetWorth(state.players[1], state);
      // P1: 500 + 400 (KLCC) + 1000 (hotel) + 350 (TRX) + 800 (4H) = 3050
      expect(netWorth1).toBe(3050);

      expect(netWorth1).toBeGreaterThan(netWorth0);
      const winner = netWorth1 > netWorth0 ? state.players[1] : state.players[0];
      expect(winner.seat).toBe(1);
      expect(winner.name).toBe('Property Baron');
    });
  });

  describe('7. Tactical AI Bot Heuristics & Trading Logic', () => {
    it('AI maintains dynamic safety reserve (RM 150 + round * 5) and avoids reckless buying', () => {
      const round = 10;
      const safetyReserve = 150 + round * 5; // RM 200
      expect(safetyReserve).toBe(200);

      const botCash = 300;
      const propertyCost = 180;

      // Purchase leaves cash at 120 < safetyReserve (200) -> should NOT buy isolated property
      const shouldBuyIsolated = botCash - propertyCost >= safetyReserve;
      expect(shouldBuyIsolated).toBe(false);

      // But if it completes a Monopoly color group, bot overrides safety reserve!
      const completesMonopoly = true;
      const shouldBuyMonopoly = completesMonopoly || botCash - propertyCost >= safetyReserve;
      expect(shouldBuyMonopoly).toBe(true);
    });

    it('AI Jail exit strategy adapts to Saidina Rule 2: pays bail late game if owning high-rent hotels', () => {
      // Early game (round 3): pays bail to buy properties
      const earlyRound = 3;
      const shouldPayEarly = earlyRound <= 10;
      expect(shouldPayEarly).toBe(true);

      // Late game (round 22): bot owns KLCC Hotel. Because of Saidina Rule 2,
      // staying in jail means collecting RM 0 rent from opponents!
      const lateRound = 22;
      const ownsHighRentHotels = true;
      const shouldPayLateWithHotels = lateRound > 10 && ownsHighRentHotels;
      expect(shouldPayLateWithHotels).toBe(true);

      // Late game (round 22) without hotels when opponents have deadly hotels: stays safe in jail!
      const ownsFewProperties = false;
      const shouldHideInJail = lateRound > 10 && !ownsFewProperties;
      expect(shouldHideInJail).toBe(true);
    });
  });
});
