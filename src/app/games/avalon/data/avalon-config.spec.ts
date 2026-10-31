import {
  buildRoleDeck,
  DEFAULT_AVALON_BOT_NAMES,
  getQuestTeamSize,
  getRequiredFails,
  PLAYER_COUNT_RATIOS,
  QUEST_TEAM_SIZES,
  ROLE_METADATA,
} from './avalon-config.data';

describe('Avalon Config & Matrices Data', () => {
  it('defines valid player count ratios from 5 to 10 players', () => {
    for (let p = 5; p <= 10; p++) {
      const ratio = PLAYER_COUNT_RATIOS.get(p);
      expect(ratio?.good).toBeGreaterThan(0);
      expect(ratio?.evil).toBeGreaterThan(0);
      expect((ratio?.good ?? 0) + (ratio?.evil ?? 0)).toBe(p);
    }
  });

  it('defines team sizes for Quests 1 to 5 across 5 to 10 players', () => {
    for (let p = 5; p <= 10; p++) {
      const sizes = QUEST_TEAM_SIZES.get(p);
      expect(sizes?.length).toBe(5);
      for (let q = 1; q <= 5; q++) {
        expect(getQuestTeamSize(p, q)).toBeGreaterThan(1);
      }
    }
  });

  it('throws error when requesting team size for unsupported player count or invalid quest', () => {
    expect(() => getQuestTeamSize(4, 1)).toThrow('Unsupported player count: 4');
    expect(() => getQuestTeamSize(5, 6)).toThrow('Invalid quest number: 6');
  });

  it('calculates required fails: strictly 2 fails on Quest 4 for 7+ players, 1 fail otherwise', () => {
    expect(getRequiredFails(5, 4)).toBe(1);
    expect(getRequiredFails(6, 4)).toBe(1);
    expect(getRequiredFails(7, 4)).toBe(2);
    expect(getRequiredFails(8, 4)).toBe(2);
    expect(getRequiredFails(9, 4)).toBe(2);
    expect(getRequiredFails(10, 4)).toBe(2);

    expect(getRequiredFails(10, 1)).toBe(1);
    expect(getRequiredFails(10, 2)).toBe(1);
    expect(getRequiredFails(10, 3)).toBe(1);
    expect(getRequiredFails(10, 5)).toBe(1);
  });

  it('builds role decks correctly for different role toggles across 5 to 10 players', () => {
    const deck5Full = buildRoleDeck(5, {
      percival: true,
      morgana: true,
      mordred: true,
      oberon: true,
    });
    expect(deck5Full.length).toBe(5);
    expect(deck5Full).toContain('merlin');
    expect(deck5Full).toContain('percival');
    expect(deck5Full).toContain('loyal_servant');
    expect(deck5Full).toContain('assassin');
    expect(deck5Full).toContain('morgana');

    const deck10Full = buildRoleDeck(10, {
      percival: true,
      morgana: true,
      mordred: true,
      oberon: true,
    });
    expect(deck10Full.length).toBe(10);
    expect(deck10Full).toContain('mordred');
    expect(deck10Full).toContain('oberon');

    expect(() => buildRoleDeck(3, { percival: false, morgana: false, mordred: false, oberon: false })).toThrow(
      'Unsupported player count: 3'
    );
  });

  it('provides complete metadata for all 8 Avalon roles and default bot names', () => {
    expect(ROLE_METADATA.size).toBe(8);
    expect(DEFAULT_AVALON_BOT_NAMES.length).toBe(10);
    expect(ROLE_METADATA.get('merlin')?.loyalty).toBe('good');
    expect(ROLE_METADATA.get('assassin')?.loyalty).toBe('evil');
  });
});
