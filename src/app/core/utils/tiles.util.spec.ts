import {
  createDeck,
  isBonusTile,
  isJokerTile,
  isTerminalIndex,
  isTerminalOrHonorIndex,
  playableIndicesForMode,
  sortHandIds,
  tileCode,
  tileSpec,
  windLabel,
} from './tiles.util';

describe('tiles.util', () => {
  it('builds exact 144-tile Hong Kong 4P and 84-tile Malaysian 3P decks', () => {
    const deck4 = createDeck('4p', () => 0.42);
    expect(deck4.length).toBe(144);
    expect(deck4.filter((id) => isJokerTile(id)).length).toBe(0);
    expect(deck4.filter((id) => isBonusTile(id)).length).toBe(8);

    const deck3 = createDeck('3p', () => 0.42);
    expect(deck3.length).toBe(84);
    expect(deck3.filter((id) => isJokerTile(id)).length).toBe(4);
    expect(deck3.filter((id) => isBonusTile(id)).length).toBe(16);
    expect(deck3.some((id) => tileCode(id).startsWith('m') || tileCode(id).startsWith('s'))).toBe(
      false
    );
    expect(playableIndicesForMode('3p').length).toBe(16);
  });

  it('classifies terminals, honors, fallback specs, and hand sort order', () => {
    expect(tileCode('p5_2')).toBe('p5');
    expect(tileCode('dr')).toBe('dr');
    expect(tileSpec('unknown_tile').code).toBe('unknown');
    expect(windLabel(0)).toBe('東');
    expect(windLabel(99)).toBe('東');

    expect(isTerminalIndex(0)).toBe(true);
    expect(isTerminalIndex(4)).toBe(false);
    expect(isTerminalIndex(27)).toBe(false);
    expect(isTerminalOrHonorIndex(27)).toBe(true);
    expect(isTerminalOrHonorIndex(4)).toBe(false);

    const sorted = sortHandIds(['dr_0', 'jk_1', 'p3_0', 'm1_0', 'jk_0']);
    expect(sorted).toEqual(['jk_0', 'jk_1', 'm1_0', 'p3_0', 'dr_0']);
  });
});
