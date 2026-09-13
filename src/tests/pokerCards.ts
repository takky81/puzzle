import type { Card, Rank, Suit } from '$lib/poker/types';

const SUIT_BY_CHAR: Record<string, Suit> = {
  s: 'spade',
  h: 'heart',
  d: 'diamond',
  c: 'club',
};

const RANK_BY_CHAR: Record<string, Rank> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

/** 'As' のような2文字表記を Card に変換する（T=10, s/h/d/c=スート） */
export function card(notation: string): Card {
  const rank = RANK_BY_CHAR[notation[0]];
  const suit = SUIT_BY_CHAR[notation[1]];
  if (rank === undefined || suit === undefined) {
    throw new Error(`不正なカード表記: ${notation}`);
  }
  return { rank, suit };
}

/** 'As Kh Qd Jc Ts' のような空白区切り表記を Card[] に変換する */
export function cards(notations: string): Card[] {
  return notations.split(/\s+/).filter(Boolean).map(card);
}
