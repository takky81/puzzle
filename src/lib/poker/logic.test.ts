import { describe, test, expect } from 'vitest';
import {
  applyAction,
  createInitialState,
  defaultConfig,
  getLegalActions,
  exchangeCards,
  nextHand,
  resolveShowdown,
  startHand,
} from './logic';
import { seededRng } from '../../tests/rng';
import { cards as parseCards } from '../../tests/pokerCards';
import type { GameConfig, GameState } from './types';

const config = (over: Partial<GameConfig> = {}): GameConfig => ({ ...defaultConfig(), ...over });

/** bet1 フェーズのゲーム状態を作る */
const betting = (over: Partial<GameConfig> = {}): GameState =>
  startHand(createInitialState(config(over)), seededRng(1));

// テストリスト（Step 1: List）
// SPEC: src/routes/poker/SPEC.md の「1ハンドの流れ」「ベッティングルール」「決着」「不変条件」から導出

describe('defaultConfig / createInitialState', () => {
  test('デフォルト設定は初期チップ1000・アンティ10・フィックスドリミット・通常AIである', () => {
    expect(defaultConfig()).toEqual({
      initialChips: 1000,
      ante: 10,
      betStructure: 'fixedLimit',
      aiLevel: 'normal',
    });
  });

  test('両者が同額の初期チップを持つ', () => {
    // Arrange / Act
    const state = createInitialState(config({ initialChips: 500 }));

    // Assert
    expect(state.players.human.chips).toBe(500);
    expect(state.players.ai.chips).toBe(500);
  });

  test('初期フェーズは handEnd（ハンド開始待ち）である', () => {
    expect(createInitialState(config()).phase).toBe('handEnd');
  });

  test('初期ディーラーはAI（人間が先に行動する）である', () => {
    expect(createInitialState(config()).dealer).toBe('ai');
  });
});

describe('startHand', () => {
  test('両者からアンティを徴収してポットに入れる', () => {
    // Arrange
    const initial = createInitialState(config({ initialChips: 1000, ante: 10 }));

    // Act
    const state = startHand(initial, seededRng(1));

    // Assert
    expect(state.pot).toBe(20);
    expect(state.players.human.chips).toBe(990);
    expect(state.players.ai.chips).toBe(990);
  });

  test('各プレイヤーに5枚配る', () => {
    const state = startHand(createInitialState(config()), seededRng(1));
    expect(state.players.human.hand).toHaveLength(5);
    expect(state.players.ai.hand).toHaveLength(5);
  });

  test('配ったカードは山札から取り除かれる', () => {
    const state = startHand(createInitialState(config()), seededRng(1));
    expect(state.deck).toHaveLength(42);
  });

  test('両者の手札に重複したカードがない', () => {
    const state = startHand(createInitialState(config()), seededRng(3));
    const all = [...state.players.human.hand, ...state.players.ai.hand];
    expect(new Set(all.map((c) => `${c.suit}-${c.rank}`)).size).toBe(10);
  });

  test('フェーズが bet1 になる', () => {
    expect(startHand(createInitialState(config()), seededRng(1)).phase).toBe('bet1');
  });

  test('手番は非ディーラー側から始まる', () => {
    const state = startHand(createInitialState(config()), seededRng(1));
    expect(state.dealer).toBe('ai');
    expect(state.turn).toBe('human');
  });

  test('ハンド番号が1つ増える', () => {
    expect(startHand(createInitialState(config()), seededRng(1)).handNumber).toBe(1);
  });

  test('ベット状態がリセットされる', () => {
    const state = startHand(createInitialState(config()), seededRng(1));
    for (const p of [state.players.human, state.players.ai]) {
      expect(p.bet).toBe(0);
      expect(p.folded).toBe(false);
      expect(p.drawCount).toBeNull();
      expect(p.acted).toBe(false);
    }
    expect(state.lastResult).toBeNull();
  });

  test('チップがアンティに満たない場合は残り全額を払ってオールインになる', () => {
    // Arrange
    const initial = createInitialState(config({ initialChips: 1000, ante: 10 }));
    initial.players.human.chips = 4;

    // Act
    const state = startHand(initial, seededRng(1));

    // Assert
    expect(state.players.human.chips).toBe(0);
    expect(state.players.human.allIn).toBe(true);
    expect(state.pot).toBe(14);
  });

  test('アンティでオールインになった場合はベッティングを飛ばして draw に進む', () => {
    const initial = createInitialState(config());
    initial.players.human.chips = 4;
    const state = startHand(initial, seededRng(1));
    expect(state.phase).toBe('draw');
    expect(state.turn).toBeNull();
  });

  test('ゲーム終了後は開始できず例外を投げる', () => {
    const initial = createInitialState(config());
    initial.phase = 'gameEnd';
    expect(() => startHand(initial, seededRng(1))).toThrow();
  });
});

describe('getLegalActions', () => {
  test('誰もベットしていなければチェックとベットができる', () => {
    // Arrange / Act
    const legal = getLegalActions(betting());

    // Assert
    expect(legal.canCheck).toBe(true);
    expect(legal.canBet).toBe(true);
  });

  test('誰もベットしていなければコールとフォールドはできない', () => {
    const legal = getLegalActions(betting());
    expect(legal.canCall).toBe(false);
    expect(legal.canFold).toBe(false);
  });

  test('相手のベットに対してはコール・レイズ・フォールドができる', () => {
    // Arrange
    const state = betting();
    state.players.human.bet = 20;
    state.players.human.chips -= 20;
    state.players.human.acted = true;
    state.turn = 'ai';
    state.raiseCount = 1;

    // Act
    const legal = getLegalActions(state);

    // Assert
    expect(legal.canCall).toBe(true);
    expect(legal.callAmount).toBe(20);
    expect(legal.canRaise).toBe(true);
    expect(legal.canFold).toBe(true);
    expect(legal.canCheck).toBe(false);
  });

  test('フィックスドリミットのベット額はアンティ×2の固定である', () => {
    const legal = getLegalActions(betting({ ante: 10, betStructure: 'fixedLimit' }));
    expect(legal.minRaiseTo).toBe(20);
    expect(legal.maxRaiseTo).toBe(20);
  });

  test('フィックスドリミットのレイズ額は相手のベット+固定額である', () => {
    const state = betting({ ante: 10, betStructure: 'fixedLimit' });
    state.players.human.bet = 20;
    state.turn = 'ai';
    state.raiseCount = 1;
    const legal = getLegalActions(state);
    expect(legal.minRaiseTo).toBe(40);
    expect(legal.maxRaiseTo).toBe(40);
  });

  test('フィックスドリミットは1ラウンド4ベットでレイズできなくなる', () => {
    const state = betting({ betStructure: 'fixedLimit' });
    state.players.human.bet = 80;
    state.turn = 'ai';
    state.raiseCount = 4;
    const legal = getLegalActions(state);
    expect(legal.canRaise).toBe(false);
    expect(legal.canCall).toBe(true);
    expect(legal.canFold).toBe(true);
  });

  test('ノーリミットの最小ベットはアンティ×2、最大は残りチップ全額である', () => {
    const legal = getLegalActions(
      betting({ ante: 10, betStructure: 'noLimit', initialChips: 1000 }),
    );
    expect(legal.minRaiseTo).toBe(20);
    expect(legal.maxRaiseTo).toBe(990);
  });

  test('ノーリミットの最小レイズ幅は直前のレイズ幅以上である', () => {
    const state = betting({ ante: 10, betStructure: 'noLimit' });
    state.players.human.bet = 100;
    state.turn = 'ai';
    state.raiseCount = 1;
    state.lastRaiseSize = 100;
    const legal = getLegalActions(state);
    expect(legal.minRaiseTo).toBe(200);
  });

  test('チップが固定額に満たない場合はオールイン額が上限になる', () => {
    const state = betting({ ante: 10, betStructure: 'fixedLimit' });
    state.players.ai.chips = 5;
    state.turn = 'ai';
    const legal = getLegalActions(state);
    expect(legal.maxRaiseTo).toBe(5);
    expect(legal.minRaiseTo).toBe(5);
  });

  test('ベッティングフェーズ以外では全てのアクションができない', () => {
    const state = betting();
    state.phase = 'draw';
    state.turn = null;
    const legal = getLegalActions(state);
    expect(legal).toEqual({
      canCheck: false,
      canCall: false,
      callAmount: 0,
      canFold: false,
      canBet: false,
      canRaise: false,
      minRaiseTo: 0,
      maxRaiseTo: 0,
    });
  });
});

describe('applyAction', () => {
  test('チェックしても手番が相手に移るだけでチップは動かない', () => {
    // Arrange
    const state = betting();
    const chipsBefore = state.players.human.chips;

    // Act
    const next = applyAction(state, { type: 'check' });

    // Assert
    expect(next.players.human.chips).toBe(chipsBefore);
    expect(next.turn).toBe('ai');
    expect(next.phase).toBe('bet1');
  });

  test('両者チェックでラウンドが終わり draw に進む', () => {
    const state = applyAction(applyAction(betting(), { type: 'check' }), { type: 'check' });
    expect(state.phase).toBe('draw');
    expect(state.turn).toBeNull();
  });

  test('ベットするとチップが減りベット額に反映される', () => {
    const next = applyAction(betting({ ante: 10 }), { type: 'bet', amount: 20 });
    expect(next.players.human.bet).toBe(20);
    expect(next.players.human.chips).toBe(970);
  });

  test('ベットしただけではラウンドは終わらない（相手の手番になる）', () => {
    const next = applyAction(betting(), { type: 'bet', amount: 20 });
    expect(next.phase).toBe('bet1');
    expect(next.turn).toBe('ai');
  });

  test('コールで両者のベットが揃うとラウンドが終わる', () => {
    const bet = applyAction(betting(), { type: 'bet', amount: 20 });
    const called = applyAction(bet, { type: 'call' });
    expect(called.phase).toBe('draw');
  });

  test('ラウンド終了時にベット額がポットに移る', () => {
    const bet = applyAction(betting({ ante: 10 }), { type: 'bet', amount: 20 });
    const called = applyAction(bet, { type: 'call' });
    expect(called.pot).toBe(60);
    expect(called.players.human.bet).toBe(0);
    expect(called.players.ai.bet).toBe(0);
  });

  test('レイズすると相手はもう一度アクションできる', () => {
    const bet = applyAction(betting({ ante: 10 }), { type: 'bet', amount: 20 });
    const raised = applyAction(bet, { type: 'raise', amount: 40 });
    expect(raised.phase).toBe('bet1');
    expect(raised.turn).toBe('human');
    expect(raised.players.ai.bet).toBe(40);
  });

  test('フォールドすると相手がポットを獲得してハンドが終わる', () => {
    // Arrange
    const bet = applyAction(betting({ ante: 10 }), { type: 'bet', amount: 20 });

    // Act
    const folded = applyAction(bet, { type: 'fold' });

    // Assert
    expect(folded.phase).toBe('handEnd');
    expect(folded.lastResult?.winner).toBe('human');
    expect(folded.lastResult?.byFold).toBe(true);
    expect(folded.players.human.chips).toBe(1010);
    expect(folded.players.ai.chips).toBe(990);
    expect(folded.pot).toBe(0);
  });

  test('フォールド勝ちのときは手札を公開しない（役は null）', () => {
    const bet = applyAction(betting(), { type: 'bet', amount: 20 });
    const folded = applyAction(bet, { type: 'fold' });
    expect(folded.lastResult?.humanRank).toBeNull();
    expect(folded.lastResult?.aiRank).toBeNull();
  });

  test('結果にはハンド開始時からのチップ増減が入る', () => {
    const bet = applyAction(betting({ ante: 10 }), { type: 'bet', amount: 20 });
    const folded = applyAction(bet, { type: 'fold' });
    expect(folded.lastResult?.delta).toEqual({ human: 10, ai: -10 });
  });

  test('第2ベッティング終了後は showdown に進む', () => {
    // Arrange: bet1 をチェックで抜け、両者交換なしで bet2 へ
    let state = applyAction(applyAction(betting(), { type: 'check' }), { type: 'check' });
    state = exchangeCards(state, 'human', []);
    state = exchangeCards(state, 'ai', []);
    expect(state.phase).toBe('bet2');

    // Act
    state = applyAction(applyAction(state, { type: 'check' }), { type: 'check' });

    // Assert
    expect(state.phase).toBe('showdown');
  });

  test('オールインコールで両者の額が揃うと以降のベッティングを飛ばす', () => {
    // Arrange
    const state = betting({ ante: 10, betStructure: 'noLimit' });

    // Act: 人間がオールイン → AIがコール
    let next = applyAction(state, { type: 'bet', amount: 990 });
    next = applyAction(next, { type: 'call' });

    // Assert
    expect(next.players.human.chips).toBe(0);
    expect(next.players.human.allIn).toBe(true);
    expect(next.phase).toBe('draw');
    expect(next.pot).toBe(2000);
  });

  test('コール額に満たないオールインでは超過分が相手に返る', () => {
    // Arrange
    const state = betting({ ante: 10, betStructure: 'noLimit' });
    state.players.ai.chips = 100;

    // Act: 人間が500ベット、AIは100しか出せない
    let next = applyAction(state, { type: 'bet', amount: 500 });
    next = applyAction(next, { type: 'call' });

    // Assert: 人間の超過400が返り、ポットは アンティ20 + 100 + 100
    expect(next.pot).toBe(220);
    expect(next.players.human.chips).toBe(890);
    expect(next.players.ai.chips).toBe(0);
  });

  test('不正なアクションは例外を投げる', () => {
    const state = betting();
    expect(() => applyAction(state, { type: 'call' })).toThrow();
    expect(() => applyAction(state, { type: 'fold' })).toThrow();
    expect(() => applyAction(state, { type: 'bet', amount: 15 })).toThrow();
  });
});

describe('exchangeCards', () => {
  /** 両者チェックで draw フェーズまで進める */
  const toDraw = (over: Partial<GameConfig> = {}): GameState =>
    applyAction(applyAction(betting(over), { type: 'check' }), { type: 'check' });

  test('指定した枚数だけカードが入れ替わる', () => {
    // Arrange
    const state = toDraw();
    const before = state.players.human.hand;

    // Act
    const next = exchangeCards(state, 'human', [0, 2]);

    // Assert
    expect(next.players.human.hand).toHaveLength(5);
    expect(next.players.human.hand[1]).toEqual(before[1]);
    expect(next.players.human.hand[3]).toEqual(before[3]);
    expect(next.players.human.hand[4]).toEqual(before[4]);
    expect(next.players.human.drawCount).toBe(2);
  });

  test('交換しない（0枚）を選べる', () => {
    const state = toDraw();
    const next = exchangeCards(state, 'human', []);
    expect(next.players.human.hand).toEqual(state.players.human.hand);
    expect(next.players.human.drawCount).toBe(0);
  });

  test('5枚全部を交換できる', () => {
    const state = toDraw();
    const next = exchangeCards(state, 'human', [0, 1, 2, 3, 4]);
    const before = new Set(state.players.human.hand.map((c) => `${c.suit}-${c.rank}`));
    expect(next.players.human.hand.some((c) => before.has(`${c.suit}-${c.rank}`))).toBe(false);
  });

  test('交換したカードは山札から取り除かれ、捨て札も戻らない', () => {
    // Arrange
    const state = toDraw();
    const deckBefore = state.deck.length;

    // Act
    const next = exchangeCards(state, 'human', [0, 1, 2]);

    // Assert
    expect(next.deck).toHaveLength(deckBefore - 3);
    const discarded = state.players.human.hand.slice(0, 3);
    for (const card of discarded) {
      expect(next.deck).not.toContainEqual(card);
    }
  });

  test('交換順は非ディーラー→ディーラーである', () => {
    const state = toDraw();
    expect(state.dealer).toBe('ai');
    expect(() => exchangeCards(state, 'ai', [])).toThrow();
  });

  test('同じプレイヤーが2回交換すると例外を投げる', () => {
    const state = exchangeCards(toDraw(), 'human', []);
    expect(() => exchangeCards(state, 'human', [])).toThrow();
  });

  test('両者の交換が終わると bet2 に進み非ディーラーの手番になる', () => {
    const state = exchangeCards(exchangeCards(toDraw(), 'human', []), 'ai', []);
    expect(state.phase).toBe('bet2');
    expect(state.turn).toBe('human');
  });

  test('オールインが絡む場合は bet2 を飛ばして showdown に進む', () => {
    // Arrange: 人間がオールイン、AIがコールしてから交換
    let state = betting({ ante: 10, betStructure: 'noLimit' });
    state = applyAction(state, { type: 'bet', amount: 990 });
    state = applyAction(state, { type: 'call' });

    // Act
    state = exchangeCards(exchangeCards(state, 'human', []), 'ai', []);

    // Assert
    expect(state.phase).toBe('showdown');
  });

  test('draw フェーズ以外での交換は例外を投げる', () => {
    expect(() => exchangeCards(betting(), 'human', [])).toThrow();
  });

  test('範囲外・重複したインデックスを指定すると例外を投げる', () => {
    const state = toDraw();
    expect(() => exchangeCards(state, 'human', [5])).toThrow();
    expect(() => exchangeCards(state, 'human', [-1])).toThrow();
    expect(() => exchangeCards(state, 'human', [1, 1])).toThrow();
  });
});

describe('resolveShowdown', () => {
  /** showdown 直前の状態を作る（両者の手札を固定） */
  const showdownState = (humanHand: string, aiHand: string, pot = 100): GameState => {
    const state = betting({ ante: 10 });
    state.players.human.hand = parseCards(humanHand);
    state.players.ai.hand = parseCards(aiHand);
    state.pot = pot;
    state.phase = 'showdown';
    state.turn = null;
    return state;
  };

  test('役の強い方がポットを獲得する', () => {
    // Arrange
    const state = showdownState('Ks Kh 9d 7c 3s', 'Qs Qh 9c 7d 3h', 100);
    const before = state.players.human.chips;

    // Act
    const next = resolveShowdown(state);

    // Assert
    expect(next.lastResult?.winner).toBe('human');
    expect(next.players.human.chips).toBe(before + 100);
    expect(next.pot).toBe(0);
  });

  test('引き分けならポットを折半する', () => {
    const state = showdownState('Ks Kh 9d 7c 3s', 'Kd Kc 9s 7h 3h', 100);
    const next = resolveShowdown(state);
    expect(next.lastResult?.winner).toBeNull();
    expect(next.lastResult?.bySplit).toBe(true);
    expect(next.players.human.chips - state.players.human.chips).toBe(50);
    expect(next.players.ai.chips - state.players.ai.chips).toBe(50);
  });

  test('折半で奇数チップが出たら非ディーラー側に渡す', () => {
    const state = showdownState('Ks Kh 9d 7c 3s', 'Kd Kc 9s 7h 3h', 101);
    const next = resolveShowdown(state);
    expect(next.dealer).toBe('ai');
    expect(next.players.human.chips - state.players.human.chips).toBe(51);
    expect(next.players.ai.chips - state.players.ai.chips).toBe(50);
  });

  test('結果に両者の役が記録される', () => {
    const next = resolveShowdown(showdownState('Ks Kh 9d 7c 3s', 'Qs Qh 9c 7d 3h'));
    expect(next.lastResult?.humanRank?.category).toBe('onePair');
    expect(next.lastResult?.aiRank?.category).toBe('onePair');
    expect(next.lastResult?.byFold).toBe(false);
  });

  test('決着後のフェーズは handEnd である', () => {
    expect(resolveShowdown(showdownState('Ks Kh 9d 7c 3s', 'Qs Qh 9c 7d 3h')).phase).toBe(
      'handEnd',
    );
  });

  test('どちらかのチップが0になったら gameEnd になる', () => {
    // Arrange
    const state = showdownState('Ks Kh 9d 7c 3s', 'Qs Qh 9c 7d 3h', 200);
    state.players.ai.chips = 0;
    state.players.ai.allIn = true;

    // Act
    const next = resolveShowdown(state);

    // Assert
    expect(next.phase).toBe('gameEnd');
    expect(next.lastResult?.winner).toBe('human');
  });

  test('showdown 以外で呼ぶと例外を投げる', () => {
    expect(() => resolveShowdown(betting())).toThrow();
  });
});

describe('nextHand', () => {
  /** ハンドを1つ終わらせた状態を作る（AIのフォールド勝ち） */
  const afterHand = (): GameState => {
    const bet = applyAction(betting({ ante: 10 }), { type: 'bet', amount: 20 });
    return applyAction(bet, { type: 'fold' });
  };

  test('ディーラーが交代する', () => {
    const state = afterHand();
    expect(state.dealer).toBe('ai');
    expect(nextHand(state, seededRng(2)).dealer).toBe('human');
  });

  test('新しいハンドが開始される', () => {
    const next = nextHand(afterHand(), seededRng(2));
    expect(next.handNumber).toBe(2);
    expect(next.phase).toBe('bet1');
    expect(next.turn).toBe('ai');
    expect(next.players.human.hand).toHaveLength(5);
  });

  test('ゲーム終了後は例外を投げる', () => {
    const state = { ...afterHand(), phase: 'gameEnd' as const };
    expect(() => nextHand(state, seededRng(2))).toThrow();
  });
});

describe('不変条件', () => {
  test('チップの総量（ポット+両者のチップ）は常に初期チップ×2である', () => {
    // Arrange
    let state = betting({ ante: 10, initialChips: 1000, betStructure: 'noLimit' });
    // ラウンド中の bet はまだポットに移っていないので合算する
    const total = (s: GameState) =>
      s.pot + s.players.human.chips + s.players.human.bet + s.players.ai.chips + s.players.ai.bet;

    // Act / Assert
    expect(total(state)).toBe(2000);
    state = applyAction(state, { type: 'bet', amount: 100 });
    expect(total(state)).toBe(2000);
    state = applyAction(state, { type: 'raise', amount: 300 });
    expect(total(state)).toBe(2000);
    state = applyAction(state, { type: 'call' });
    expect(total(state)).toBe(2000);
    state = exchangeCards(exchangeCards(state, 'human', [0, 1]), 'ai', [2]);
    expect(total(state)).toBe(2000);
    state = applyAction(applyAction(state, { type: 'check' }), { type: 'check' });
    state = resolveShowdown(state);
    expect(total(state)).toBe(2000);
  });

  test('山札+両者の手札に重複したカードがない', () => {
    // Arrange
    let state = betting();
    state = applyAction(applyAction(state, { type: 'check' }), { type: 'check' });

    // Act
    state = exchangeCards(exchangeCards(state, 'human', [0, 1, 2]), 'ai', [3, 4]);

    // Assert
    const all = [...state.deck, ...state.players.human.hand, ...state.players.ai.hand];
    expect(new Set(all.map((c) => `${c.suit}-${c.rank}`)).size).toBe(all.length);
    expect(all.length).toBe(47);
  });
});
