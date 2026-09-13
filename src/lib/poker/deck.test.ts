import { describe, test, expect } from 'vitest';
import { createDeck, drawCards, shuffle } from './deck';
import { seededRng } from '../../tests/rng';

// テストリスト（Step 1: List）
// SPEC: src/routes/poker/SPEC.md の「カードと役」「不変条件」から導出

describe('createDeck', () => {
  test('52枚のカードを作る', () => {
    // Act
    const deck = createDeck();

    // Assert
    expect(deck).toHaveLength(52);
  });

  test('同じカードが重複しない', () => {
    const deck = createDeck();
    const keys = new Set(deck.map((c) => `${c.suit}-${c.rank}`));
    expect(keys.size).toBe(52);
  });

  test('各スートが13枚ずつある', () => {
    const deck = createDeck();
    for (const suit of ['spade', 'heart', 'diamond', 'club']) {
      expect(deck.filter((c) => c.suit === suit)).toHaveLength(13);
    }
  });

  test('ランクは2〜14である', () => {
    const deck = createDeck();
    const ranks = [...new Set(deck.map((c) => c.rank))].sort((a, b) => a - b);
    expect(ranks).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });
});

describe('shuffle', () => {
  test('枚数は変わらない', () => {
    expect(shuffle(createDeck(), seededRng(1))).toHaveLength(52);
  });

  test('カードの集合は変わらない', () => {
    const shuffled = shuffle(createDeck(), seededRng(1));
    const keys = new Set(shuffled.map((c) => `${c.suit}-${c.rank}`));
    expect(keys.size).toBe(52);
  });

  test('元の配列を変更しない', () => {
    // Arrange
    const deck = createDeck();
    const before = [...deck];

    // Act
    shuffle(deck, seededRng(1));

    // Assert
    expect(deck).toEqual(before);
  });

  test('並び順が変わる', () => {
    const deck = createDeck();
    expect(shuffle(deck, seededRng(1))).not.toEqual(deck);
  });

  test('同じシードなら同じ並びになる', () => {
    expect(shuffle(createDeck(), seededRng(7))).toEqual(shuffle(createDeck(), seededRng(7)));
  });
});

describe('drawCards', () => {
  test('先頭からn枚を取り出す', () => {
    // Arrange
    const deck = createDeck();

    // Act
    const { cards, rest } = drawCards(deck, 5);

    // Assert
    expect(cards).toEqual(deck.slice(0, 5));
    expect(rest).toEqual(deck.slice(5));
  });

  test('0枚のときは何も取り出さない', () => {
    const deck = createDeck();
    const { cards, rest } = drawCards(deck, 0);
    expect(cards).toEqual([]);
    expect(rest).toEqual(deck);
  });

  test('元の配列を変更しない', () => {
    const deck = createDeck();
    drawCards(deck, 5);
    expect(deck).toHaveLength(52);
  });

  test('山札が足りなければ例外を投げる', () => {
    expect(() => drawCards(createDeck().slice(0, 3), 5)).toThrow();
  });
});
