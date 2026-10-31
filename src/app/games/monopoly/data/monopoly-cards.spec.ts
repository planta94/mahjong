import { describe, expect, it } from 'vitest';
import { DANA_CARDS, NASIB_CARDS, shuffleCards } from './monopoly-cards.data';

describe('MonopolyCardsData & Authentic Malaysian Action Decks', () => {
  it('contains exactly 16 Nasib (Chance) cards with valid action types', () => {
    expect(NASIB_CARDS.length).toBe(16);

    const ids = new Set<string>();
    for (const card of NASIB_CARDS) {
      expect(card.deck).toBe('nasib');
      expect(card.id.startsWith('CHANCE_')).toBe(true);
      expect(card.titleKey.length).toBeGreaterThan(0);
      expect(card.descKey.length).toBeGreaterThan(0);
      expect(typeof card.actionType).toBe('string');
      ids.add(card.id);
    }
    expect(ids.size).toBe(16);
  });

  it('contains exactly 16 Dana Komuniti (Community Chest) cards with valid action types', () => {
    expect(DANA_CARDS.length).toBe(16);

    const ids = new Set<string>();
    for (const card of DANA_CARDS) {
      expect(card.deck).toBe('dana');
      expect(card.id.startsWith('CHEST_')).toBe(true);
      expect(card.titleKey.length).toBeGreaterThan(0);
      expect(card.descKey.length).toBeGreaterThan(0);
      expect(typeof card.actionType).toBe('string');
      ids.add(card.id);
    }
    expect(ids.size).toBe(16);
  });

  it('shuffles cards preserving total count and element set', () => {
    const shuffled = shuffleCards(NASIB_CARDS);
    expect(shuffled.length).toBe(16);
    expect(shuffled).not.toBe(NASIB_CARDS); // Returns new array

    const shuffledIds = new Set(shuffled.map((c) => c.id));
    expect(shuffledIds.size).toBe(16);
  });

  it('handles card shuffling with crypto and fallback Math.random paths', () => {
    // Shuffling empty or small deck
    expect(shuffleCards([]).length).toBe(0);
    const single = [NASIB_CARDS[0]];
    expect(shuffleCards(single).length).toBe(1);

    // Test fallback when crypto getRandomValues is unavailable
    const origCrypto = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', {
        value: { getRandomValues: undefined },
        configurable: true,
        writable: true,
      });
      const shuffledFallback = shuffleCards(DANA_CARDS);
      expect(shuffledFallback.length).toBe(16);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: origCrypto,
        configurable: true,
        writable: true,
      });
    }
  });
});
