import type { Card, HandCategory, HandRank, Rank } from './types';

const CATEGORY_ORDER: HandCategory[] = [
  'highCard',
  'onePair',
  'twoPair',
  'threeOfAKind',
  'straight',
  'flush',
  'fullHouse',
  'fourOfAKind',
  'straightFlush',
];

const CATEGORY_NAMES: Record<HandCategory, string> = {
  highCard: 'ハイカード',
  onePair: 'ワンペア',
  twoPair: 'ツーペア',
  threeOfAKind: 'スリーカード',
  straight: 'ストレート',
  flush: 'フラッシュ',
  fullHouse: 'フルハウス',
  fourOfAKind: 'フォーカード',
  straightFlush: 'ストレートフラッシュ',
};

const RANK_LABELS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

/** ランクの表示用ラベル（11〜14 は J/Q/K/A） */
export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank] ?? String(rank);
}

/** ランクごとの枚数を「枚数の降順 → ランクの降順」に並べたグループ */
type RankGroup = { rank: Rank; count: number };

function groupByRank(cards: Card[]): RankGroup[] {
  const counts = new Map<Rank, number>();
  for (const { rank } of cards) {
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
}

function categoryOf(groups: RankGroup[]): HandCategory {
  const shape = groups.map((g) => g.count).join('');
  switch (shape) {
    case '41':
      return 'fourOfAKind';
    case '32':
      return 'fullHouse';
    case '311':
      return 'threeOfAKind';
    case '221':
      return 'twoPair';
    case '2111':
      return 'onePair';
    default:
      return 'highCard';
  }
}

export const HAND_SIZE = 5;

function isFlush(cards: Card[]): boolean {
  return cards.every((c) => c.suit === cards[0].suit);
}

/**
 * ストレートなら最上位ランクを返す（成立しなければ null）。
 * A-2-3-4-5 は5ハイのストレートとして 5 を返す。Q-K-A-2-3 のような回り込みは成立しない。
 */
function straightHighRank(groups: RankGroup[]): Rank | null {
  if (groups.length !== HAND_SIZE) return null;
  const ranks = groups.map((g) => g.rank); // 降順
  const isSequence = (sorted: Rank[]) => sorted.every((r, i) => i === 0 || sorted[i - 1] - r === 1);
  if (isSequence(ranks)) return ranks[0];
  // A を 1 として扱う 5ハイストレート
  const lowAce = [...ranks.slice(1), 1];
  if (ranks[0] === 14 && isSequence(lowAce)) return 5;
  return null;
}

export function evaluateHand(cards: Card[]): HandRank {
  if (cards.length !== HAND_SIZE) {
    throw new Error(`手札は${HAND_SIZE}枚でなければならない: ${cards.length}枚`);
  }

  const groups = groupByRank(cards);
  const flush = isFlush(cards);
  const straightHigh = straightHighRank(groups);

  if (straightHigh !== null) {
    return { category: flush ? 'straightFlush' : 'straight', tiebreak: [straightHigh] };
  }

  const tiebreak = groups.map((g) => g.rank);
  if (flush) return { category: 'flush', tiebreak };
  return { category: categoryOf(groups), tiebreak };
}

/** a が強ければ正、b が強ければ負、同値なら 0 */
export function compareHands(a: HandRank, b: HandRank): number {
  const diff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  if (diff !== 0) return diff;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const rankDiff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (rankDiff !== 0) return rankDiff;
  }
  return 0;
}

export function handCategoryName(category: HandCategory): string {
  return CATEGORY_NAMES[category];
}

/** 「ワンペア（K）」のような表示用文字列を返す */
export function describeHand(rank: HandRank): string {
  const name = handCategoryName(rank.category);
  const [first, second] = rank.tiebreak;
  switch (rank.category) {
    case 'straight':
    case 'straightFlush':
    case 'flush':
      return `${name}（${rankLabel(first)}ハイ）`;
    case 'twoPair':
      return `${name}（${rankLabel(first)} と ${rankLabel(second)}）`;
    case 'fullHouse':
      return `${name}（${rankLabel(first)} オーバー ${rankLabel(second)}）`;
    default:
      return `${name}（${rankLabel(first)}）`;
  }
}

/**
 * 役が一目でわかるように手札を並べ替えたときの、元のインデックスの並びを返す。
 * 同ランクのカードをまとめて前に置き、同じ枚数どうしはランクの降順にする。
 * A-2-3-4-5 のストレートだけは A を最後に置く（5ハイとして読めるようにする）。
 */
export function sortedHandIndices(cards: Card[]): number[] {
  const { category, tiebreak } = evaluateHand(cards);
  const isWheel = (category === 'straight' || category === 'straightFlush') && tiebreak[0] === 5;

  const counts = new Map<Rank, number>();
  for (const { rank } of cards) counts.set(rank, (counts.get(rank) ?? 0) + 1);

  /** 並び順の重み（大きいほど前）。5ハイストレートのAだけ最後に回す */
  const weightOf = (rank: Rank): number => (isWheel && rank === 14 ? 1 : rank);

  return cards
    .map((card, index) => ({ card, index }))
    .sort(
      (a, b) =>
        (counts.get(b.card.rank) ?? 0) - (counts.get(a.card.rank) ?? 0) ||
        weightOf(b.card.rank) - weightOf(a.card.rank) ||
        a.index - b.index,
    )
    .map(({ index }) => index);
}
