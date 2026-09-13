import type { Card, Rank, Rng, Suit } from './types';

export const SUITS: readonly Suit[] = ['spade', 'heart', 'diamond', 'club'];
export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const DECK_SIZE = SUITS.length * RANKS.length;

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
}

/** Fisher-Yates シャッフル。元の配列は変更せず新しい配列を返す */
export function shuffle(deck: Card[], rng: Rng): Card[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 山札の先頭から n 枚を引く。足りない場合は例外（呼び出し側のバグ） */
export function drawCards(deck: Card[], n: number): { cards: Card[]; rest: Card[] } {
  if (n > deck.length) {
    throw new Error(`山札が足りない: ${n}枚要求、残り${deck.length}枚`);
  }
  return { cards: deck.slice(0, n), rest: deck.slice(n) };
}
