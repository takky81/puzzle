import { drawCards } from './deck';
import { compareHands, evaluateHand, HAND_SIZE } from './hand';
import { getLegalActions, nextDrawer } from './logic';
import type { Action, Card, GameState, HandCategory, LegalActions, Rank, Rng } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// 共通ヘルパー
// ─────────────────────────────────────────────────────────────────────────────

/** ランク → そのランクを持つ手札のインデックス */
function indicesByRank(hand: Card[]): Map<Rank, number[]> {
  const map = new Map<Rank, number[]>();
  hand.forEach((card, i) => {
    map.set(card.rank, [...(map.get(card.rank) ?? []), i]);
  });
  return map;
}

/** 手札のうち、指定インデックスを新しいカードで置き換える */
function replaceCards(hand: Card[], indices: number[], newCards: Card[]): Card[] {
  const set = new Set(indices);
  let drawn = 0;
  return hand.map((card, i) => (set.has(i) ? newCards[drawn++] : card));
}

/** 4枚が同スートなら、残る1枚のインデックスを返す */
function oddSuitIndex(hand: Card[]): number | null {
  for (let i = 0; i < hand.length; i++) {
    const rest = hand.filter((_, j) => j !== i);
    if (rest.every((c) => c.suit === rest[0].suit)) return i;
  }
  return null;
}

/** 1枚捨てれば4枚ストレートになる場合、その1枚のインデックスを返す */
function oddStraightIndex(hand: Card[]): number | null {
  for (let i = 0; i < hand.length; i++) {
    const ranks = hand.filter((_, j) => j !== i).map((c) => c.rank);
    const unique = new Set(ranks);
    if (unique.size !== 4) continue;
    if (Math.max(...ranks) - Math.min(...ranks) <= 4) return i;
  }
  return null;
}

/** 定石どおりの交換（通常AI・シミュレーション用の相手モデル） */
export function standardDiscards(hand: Card[]): number[] {
  const { category } = evaluateHand(hand);
  const groups = indicesByRank(hand);
  const allIndices = hand.map((_, i) => i);

  switch (category) {
    case 'straightFlush':
    case 'fourOfAKind':
    case 'fullHouse':
    case 'flush':
    case 'straight':
      return [];
    case 'threeOfAKind':
    case 'onePair': {
      const keep = [...groups.values()].find((idx) => idx.length >= 2) ?? [];
      return allIndices.filter((i) => !keep.includes(i));
    }
    case 'twoPair': {
      const single = [...groups.values()].find((idx) => idx.length === 1) ?? [];
      return single;
    }
    default: {
      const flushDraw = oddSuitIndex(hand);
      if (flushDraw !== null) return [flushDraw];
      const straightDraw = oddStraightIndex(hand);
      if (straightDraw !== null) return [straightDraw];
      // ハイカード: K以上が1枚あれば残し、なければ全交換
      const highest = Math.max(...hand.map((c) => c.rank));
      if (highest >= 13) {
        const keepIndex = hand.findIndex((c) => c.rank === highest);
        return allIndices.filter((i) => i !== keepIndex);
      }
      return allIndices;
    }
  }
}

/** 5枚の手札から作れる 2^5 通りの捨て方 */
function allDiscardPatterns(): number[][] {
  const patterns: number[][] = [];
  for (let mask = 0; mask < 1 << HAND_SIZE; mask++) {
    const indices: number[] = [];
    for (let i = 0; i < HAND_SIZE; i++) {
      if (mask & (1 << i)) indices.push(i);
    }
    patterns.push(indices);
  }
  return patterns;
}

// ─────────────────────────────────────────────────────────────────────────────
// レベルごとの交換判断
// ─────────────────────────────────────────────────────────────────────────────

/** 弱いAI: 定石をベースにしつつ、気まぐれに何枚か残してしまう */
function weakDiscards(hand: Card[], rng: Rng): number[] {
  const base = standardDiscards(hand);
  if (base.length === 0) return base;
  const keepBack = Math.floor(rng() * 3); // 0〜2枚は捨てそこねる
  return base.slice(0, Math.max(0, base.length - keepBack));
}

/** 強いAI: 見えていないカードからサンプリングし、勝率が最大の捨て方を選ぶ */
function strongDiscards(state: GameState, rng: Rng): number[] {
  const hand = state.players.ai.hand;
  const unseen = [...state.deck, ...state.players.human.hand];
  const SAMPLES = 40;

  let best: number[] = [];
  let bestScore = -1;

  for (const pattern of allDiscardPatterns()) {
    let wins = 0;
    for (let s = 0; s < SAMPLES; s++) {
      const pool = [...unseen];
      const take = (n: number): Card[] => {
        const taken: Card[] = [];
        for (let i = 0; i < n; i++) {
          taken.push(...pool.splice(Math.floor(rng() * pool.length), 1));
        }
        return taken;
      };
      const myFinal = replaceCards(hand, pattern, take(pattern.length));
      const opponent = take(HAND_SIZE);
      const diff = compareHands(evaluateHand(myFinal), evaluateHand(opponent));
      wins += diff > 0 ? 1 : diff === 0 ? 0.5 : 0;
    }
    const score = wins / SAMPLES;
    if (score > bestScore) {
      bestScore = score;
      best = pattern;
    }
  }
  return best;
}

/** 山札と相手の手札が見える前提で、AIと相手の最終手札を予測する */
function predictFinalHands(state: GameState, aiDiscards: number[]): { ai: Card[]; human: Card[] } {
  const aiPlayer = state.players.ai;
  const humanPlayer = state.players.human;
  const aiFirst = state.dealer === 'human';

  let deck = state.deck;
  let aiHand = aiPlayer.hand;
  let humanHand = humanPlayer.hand;

  const drawFor = (hand: Card[], indices: number[]): Card[] => {
    const { cards, rest } = drawCards(deck, indices.length);
    deck = rest;
    return replaceCards(hand, indices, cards);
  };

  // 相手がまだ交換していなければ、定石どおりに交換すると仮定する
  const humanDiscards = humanPlayer.drawCount === null ? standardDiscards(humanHand) : null;

  if (aiFirst) {
    if (aiPlayer.drawCount === null) aiHand = drawFor(aiHand, aiDiscards);
    if (humanDiscards !== null) humanHand = drawFor(humanHand, humanDiscards);
  } else {
    if (humanDiscards !== null) humanHand = drawFor(humanHand, humanDiscards);
    if (aiPlayer.drawCount === null) aiHand = drawFor(aiHand, aiDiscards);
  }

  return { ai: aiHand, human: humanHand };
}

/** 最強AI（チート）: 山札の並びが見えるので、最善の捨て方を全通りから選ぶ */
function cheatDiscards(state: GameState): number[] {
  let best: number[] = [];
  let bestOutcome = -Infinity;
  let bestHand = evaluateHand(state.players.ai.hand);

  for (const pattern of allDiscardPatterns()) {
    if (pattern.length > state.deck.length) continue;
    const final = predictFinalHands(state, pattern);
    const myRank = evaluateHand(final.ai);
    const outcome = Math.sign(compareHands(myRank, evaluateHand(final.human)));

    if (outcome > bestOutcome || (outcome === bestOutcome && compareHands(myRank, bestHand) > 0)) {
      bestOutcome = outcome;
      bestHand = myRank;
      best = pattern;
    }
  }
  return best;
}

/** AIが捨てるカードのインデックスを決める */
export function decideDiscards(state: GameState, rng: Rng): number[] {
  if (state.phase !== 'draw') throw new Error('交換フェーズではない');
  if (nextDrawer(state) !== 'ai') throw new Error('AIの交換順ではない');

  const hand = state.players.ai.hand;
  switch (state.config.aiLevel) {
    case 'weak':
      return weakDiscards(hand, rng);
    case 'normal':
      return standardDiscards(hand);
    case 'strong':
      return strongDiscards(state, rng);
    case 'cheat':
      return cheatDiscards(state);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// レベルごとのアクション判断
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_STRENGTH: Record<HandCategory, number> = {
  highCard: 0,
  onePair: 1,
  twoPair: 2,
  threeOfAKind: 3,
  straight: 4,
  flush: 5,
  fullHouse: 6,
  fourOfAKind: 7,
  straightFlush: 8,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** ベット/レイズのアクションを作る（額は合法な範囲に収める） */
function aggressiveAction(state: GameState, legal: LegalActions, desiredTo: number): Action | null {
  if (legal.canBet) {
    return { type: 'bet', amount: clamp(desiredTo, legal.minRaiseTo, legal.maxRaiseTo) };
  }
  if (legal.canRaise) {
    return { type: 'raise', amount: clamp(desiredTo, legal.minRaiseTo, legal.maxRaiseTo) };
  }
  return null;
}

/** ポットとラウンド中のベットの合計（バリューベットの目安） */
function potSize(state: GameState): number {
  return state.pot + state.players.human.bet + state.players.ai.bet;
}

/** 弱いAI: 基本はチェック/コール。たまに気まぐれで攻めたり降りたりする */
function weakAction(state: GameState, legal: LegalActions, rng: Rng): Action {
  if (rng() < 0.1) {
    const aggressive = aggressiveAction(state, legal, legal.minRaiseTo);
    if (aggressive !== null) return aggressive;
  }
  if (legal.canCheck) return { type: 'check' };
  if (legal.canCall && rng() < 0.85) return { type: 'call' };
  return { type: 'fold' };
}

/** 通常AI: 役の強さの閾値でアクションを決める（ブラフはしない） */
function normalAction(state: GameState, legal: LegalActions): Action {
  const strength = CATEGORY_STRENGTH[evaluateHand(state.players.ai.hand).category];
  // 交換前は交換で伸びる可能性があるため、攻める基準を高くする
  const raiseThreshold = state.phase === 'bet1' ? 3 : 2;

  if (strength >= raiseThreshold) {
    const aggressive = aggressiveAction(state, legal, potSize(state));
    if (aggressive !== null) return aggressive;
  }
  if (legal.canCheck) return { type: 'check' };
  if (legal.canCall) {
    const cheap = legal.callAmount <= potSize(state) * 0.15;
    if (strength >= 1 || cheap) return { type: 'call' };
  }
  return { type: 'fold' };
}

/** 見えていないカードから相手の最終手札をサンプリングして勝率を推定する */
function estimateEquity(state: GameState, rng: Rng, samples = 200): number {
  const aiHand = state.players.ai.hand;
  const unseen = [...state.deck, ...state.players.human.hand];
  const myDiscards = state.phase === 'bet1' ? standardDiscards(aiHand) : [];

  let score = 0;
  for (let s = 0; s < samples; s++) {
    const pool = [...unseen];
    const take = (n: number): Card[] => {
      const taken: Card[] = [];
      for (let i = 0; i < n; i++) {
        taken.push(...pool.splice(Math.floor(rng() * pool.length), 1));
      }
      return taken;
    };
    const myFinal = replaceCards(aiHand, myDiscards, take(myDiscards.length));
    let opponent = take(HAND_SIZE);
    if (state.phase === 'bet1') {
      const discards = standardDiscards(opponent);
      opponent = replaceCards(opponent, discards, take(discards.length));
    }
    const diff = compareHands(evaluateHand(myFinal), evaluateHand(opponent));
    score += diff > 0 ? 1 : diff === 0 ? 0.5 : 0;
  }
  return score / samples;
}

/** 強いAI: 勝率とポットオッズを比較し、低頻度でブラフも混ぜる */
function strongAction(state: GameState, legal: LegalActions, rng: Rng): Action {
  const equity = estimateEquity(state, rng);

  if (equity >= 0.75) {
    const aggressive = aggressiveAction(state, legal, potSize(state));
    if (aggressive !== null) return aggressive;
  }
  if (legal.canCheck) {
    if (equity < 0.35 && rng() < 0.15) {
      const bluff = aggressiveAction(state, legal, Math.floor(potSize(state) / 2));
      if (bluff !== null) return bluff;
    }
    return { type: 'check' };
  }
  if (legal.canCall) {
    const potOdds = legal.callAmount / (potSize(state) + legal.callAmount);
    if (equity >= potOdds) return { type: 'call' };
  }
  return { type: 'fold' };
}

/**
 * 最強AI（チート）: 相手の手札と山札が見えるので、ショーダウンの結果を予測して行動する。
 * 勝ち確ならバリューを最大化し、負け確なら傷を広げずに降りる。
 */
function cheatAction(state: GameState, legal: LegalActions): Action {
  const discards = state.players.ai.drawCount === null ? cheatDiscards(state) : [];
  const final = predictFinalHands(state, discards);
  const outcome = Math.sign(compareHands(evaluateHand(final.ai), evaluateHand(final.human)));

  if (outcome > 0) {
    // 相手が降りない範囲で搾るため、ポットサイズを目安にする
    const aggressive = aggressiveAction(state, legal, potSize(state));
    if (aggressive !== null) return aggressive;
    if (legal.canCall) return { type: 'call' };
    return { type: 'check' };
  }
  if (outcome === 0) {
    if (legal.canCheck) return { type: 'check' };
    if (legal.canCall) return { type: 'call' };
    return { type: 'fold' };
  }
  if (legal.canCheck) return { type: 'check' };
  return { type: 'fold' };
}

/** AIのアクションを決める */
export function decideAction(state: GameState, rng: Rng): Action {
  if (state.turn !== 'ai') throw new Error('AIの手番ではない');
  const legal = getLegalActions(state);

  switch (state.config.aiLevel) {
    case 'weak':
      return weakAction(state, legal, rng);
    case 'normal':
      return normalAction(state, legal);
    case 'strong':
      return strongAction(state, legal, rng);
    case 'cheat':
      return cheatAction(state, legal);
  }
}
