import { describe, expect, it } from 'vitest';
import {
  BOARD_SPACE_MAP,
  COLOR_GROUP_HEX_MAP,
  MALAYSIA_BOARD_DATA,
  getGroupSpaces,
  getNearestTransitIndex,
  getNearestUtilityIndex,
  getSpaceByIndex,
} from './monopoly-board.data';
import { ColorGroup } from '../models/monopoly.model';

describe('MonopolyBoardData & Board Registry', () => {
  it('contains exactly 40 spaces in perimeter ring indexed 0 to 39', () => {
    expect(MALAYSIA_BOARD_DATA.length).toBe(40);
    expect(BOARD_SPACE_MAP.size).toBe(40);

    for (let i = 0; i < 40; i++) {
      const s = MALAYSIA_BOARD_DATA.at(i);
      expect(s?.index).toBe(i);
    }
  });

  it('verifies 4 corners at indices 0, 10, 20, 30', () => {
    const mula = getSpaceByIndex(0);
    expect(mula?.id).toBe('mula');
    expect(mula?.type).toBe('corner_go');

    const penjara = getSpaceByIndex(10);
    expect(penjara?.id).toBe('penjara');
    expect(penjara?.type).toBe('corner_jail');

    const parkir = getSpaceByIndex(20);
    expect(parkir?.id).toBe('parkir_percuma');
    expect(parkir?.type).toBe('corner_parking');

    const pergi = getSpaceByIndex(30);
    expect(pergi?.id).toBe('pergi_penjara');
    expect(pergi?.type).toBe('corner_gotojail');
  });

  it('verifies 22 street landmark properties grouped into 8 color groups', () => {
    const properties = MALAYSIA_BOARD_DATA.filter((s) => s.type === 'property');
    expect(properties.length).toBe(22);

    const groups: ColorGroup[] = [
      'brown',
      'light_blue',
      'pink',
      'orange',
      'red',
      'yellow',
      'green',
      'dark_blue',
    ];

    expect(COLOR_GROUP_HEX_MAP.size).toBe(8);

    expect(getGroupSpaces('brown').length).toBe(2); // Melaka
    expect(getGroupSpaces('light_blue').length).toBe(3); // Ipoh
    expect(getGroupSpaces('pink').length).toBe(3); // Penang
    expect(getGroupSpaces('orange').length).toBe(3); // Pahang
    expect(getGroupSpaces('red').length).toBe(3); // Borneo
    expect(getGroupSpaces('yellow').length).toBe(3); // Johor
    expect(getGroupSpaces('green').length).toBe(3); // KL-Metro
    expect(getGroupSpaces('dark_blue').length).toBe(2); // KLCC / TRX

    for (const g of groups) {
      const colorHex = COLOR_GROUP_HEX_MAP.get(g);
      expect(typeof colorHex).toBe('string');
      expect(colorHex?.startsWith('#')).toBe(true);
    }
  });

  it('verifies 4 Transit Hubs and 2 Utilities', () => {
    const transits = MALAYSIA_BOARD_DATA.filter((s) => s.type === 'transit');
    expect(transits.length).toBe(4);
    expect(transits.map((t) => t.index)).toEqual([5, 15, 25, 35]);

    const utilities = MALAYSIA_BOARD_DATA.filter((s) => s.type === 'utility');
    expect(utilities.length).toBe(2);
    expect(utilities.map((u) => u.index)).toEqual([12, 28]);
  });

  it('calculates nearest transit and utility indices with wraparound', () => {
    expect(getNearestTransitIndex(0)).toBe(5);
    expect(getNearestTransitIndex(7)).toBe(15);
    expect(getNearestTransitIndex(22)).toBe(25);
    expect(getNearestTransitIndex(26)).toBe(35);
    expect(getNearestTransitIndex(36)).toBe(5); // Wraparound

    expect(getNearestUtilityIndex(0)).toBe(12);
    expect(getNearestUtilityIndex(15)).toBe(28);
    expect(getNearestUtilityIndex(35)).toBe(12); // Wraparound
  });
});
