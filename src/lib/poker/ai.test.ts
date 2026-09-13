import { describe, test, expect } from 'vitest';
import { decideAction, decideDiscards, standardDiscards } from './ai';
import { createDeck } from './deck';
import {
  applyAction,
  createInitialState,
  defaultConfig,
  exchangeCards,
  getLegalActions,
  nextDrawer,
  nextHand,
  resolveShowdown,
  startHand,
} from './logic';
import { cards as parseCards } from '../../tests/pokerCards';
import { seededRng } from '../../tests/rng';
import type { Action, AiLevel, BetStructure, Card, GameState } from './types';

/**
 * 交換フェーズの状態を作る。
 * AIは非ディーラー（先に交換する側）とし、手札と山札を固定する。
 */
function drawState(options: {
  aiLevel: AiLevel;
  aiHand: string;
  humanHand?: string;
  deck?: Card[];
}): GameState {
  const config = { ...defaultConfig(), aiLevel: options.aiLevel };
  const state = startHand(createInitialState(config), seededRng(1));
  return {
    ...state,
    dealer: 'human',
    phase: 'draw',
    turn: null,
    deck: options.deck ?? createDeck(),
    players: {
      human: {
        ...state.players.human,
        hand: parseCards(options.humanHand ?? '2c 3c 4c 5h 7d'),
      },
      ai: { ...state.players.ai, hand: parseCards(options.aiHand) },
    },
  };
}

/** 捨てるカードの表記を返す（順序に依存しない比較用） */
function discarded(state: GameState, indices: number[]): string[] {
  return indices
    .map((i) => `${state.players.ai.hand[i].rank}${state.players.ai.hand[i].suit[0]}`)
    .sort();
}

/**
 * AIの手番のベッティング状態を作る。AIは非ディーラー（先に行動する側）。
 */
function bettingState(options: {
  aiLevel: AiLevel;
  aiHand: string;
  humanHand?: string;
  phase?: 'bet1' | 'bet2';
  humanBet?: number;
  pot?: number;
  betStructure?: BetStructure;
  deck?: Card[];
}): GameState {
  const config = {
    ...defaultConfig(),
    aiLevel: options.aiLevel,
    betStructure: options.betStructure ?? 'fixedLimit',
  };
  const state = startHand(createInitialState(config), seededRng(1));
  const humanBet = options.humanBet ?? 0;
  const drawn = options.phase === 'bet2' ? 0 : null;
  return {
    ...state,
    dealer: 'human',
    phase: options.phase ?? 'bet1',
    turn: 'ai',
    pot: options.pot ?? 20,
    deck: options.deck ?? createDeck(),
    raiseCount: humanBet > 0 ? 1 : 0,
    lastRaiseSize: humanBet,
    players: {
      human: {
        ...state.players.human,
        hand: parseCards(options.humanHand ?? '2c 3c 4h 5d 7s'),
        bet: humanBet,
        chips: state.players.human.chips - humanBet,
        acted: humanBet > 0,
        drawCount: drawn,
      },
      ai: {
        ...state.players.ai,
        hand: parseCards(options.aiHand),
        drawCount: drawn,
      },
    },
  };
}

/** アクションが合法か（applyAction が例外を投げないか）を確かめる */
function isLegal(state: GameState, action: Action): boolean {
  try {
    applyAction(state, action);
    return true;
  } catch {
    return false;
  }
}

// テストリスト（Step 1: List）
// SPEC: src/routes/poker/SPEC.md の「AIの強さ」から導出

describe('decideDiscards（共通）', () => {
  test('どのレベルでも0〜5枚のインデックスを重複なく返す', () => {
    for (const level of ['weak', 'normal', 'strong', 'cheat'] as AiLevel[]) {
      for (let seed = 1; seed <= 20; seed++) {
        // Arrange
        const state = drawState({ aiLevel: level, aiHand: 'Ks Kh 9d 7c 3s' });

        // Act
        const indices = decideDiscards(state, seededRng(seed));

        // Assert
        expect(indices.length).toBeLessThanOrEqual(5);
        expect(new Set(indices).size).toBe(indices.length);
        expect(indices.every((i) => i >= 0 && i < 5)).toBe(true);
      }
    }
  });

  test('交換フェーズ以外で呼ぶと例外を投げる', () => {
    const state = {
      ...drawState({ aiLevel: 'normal', aiHand: 'Ks Kh 9d 7c 3s' }),
      phase: 'bet1' as const,
    };
    expect(() => decideDiscards(state, seededRng(1))).toThrow();
  });

  test('AIの交換順でないときは例外を投げる', () => {
    // Arrange: AIがディーラー側なので人間の交換が先
    const base = drawState({ aiLevel: 'normal', aiHand: 'Ks Kh 9d 7c 3s' });
    const state = { ...base, dealer: 'ai' as const };

    // Act / Assert
    expect(() => decideDiscards(state, seededRng(1))).toThrow();
  });
});

describe('decideDiscards（通常）', () => {
  const discardsFor = (aiHand: string): string[] => {
    const state = drawState({ aiLevel: 'normal', aiHand });
    return discarded(state, decideDiscards(state, seededRng(1)));
  };

  test('ワンペアなら残り3枚を交換する', () => {
    expect(discardsFor('Ks Kh 9d 7c 3s')).toEqual(['3s', '7c', '9d'].sort());
  });

  test('ツーペアならキッカー1枚を交換する', () => {
    expect(discardsFor('Ks Kh 9d 9c 3s')).toEqual(['3s']);
  });

  test('スリーカードなら残り2枚を交換する', () => {
    expect(discardsFor('Ks Kh Kd 9c 3s')).toEqual(['3s', '9c'].sort());
  });

  test('フルハウスは交換しない', () => {
    expect(discardsFor('Ks Kh Kd 9c 9s')).toEqual([]);
  });

  test('フラッシュは交換しない', () => {
    expect(discardsFor('Ks Qs 9s 7s 3s')).toEqual([]);
  });

  test('ストレートは交換しない', () => {
    expect(discardsFor('9s 8h 7d 6c 5s')).toEqual([]);
  });

  test('フォーカードは交換しない', () => {
    expect(discardsFor('Ks Kh Kd Kc 3s')).toEqual([]);
  });

  test('4枚フラッシュなら不要な1枚を交換する', () => {
    expect(discardsFor('Ks Qs 9s 7s 3h')).toEqual(['3h']);
  });

  test('4枚ストレートなら不要な1枚を交換する', () => {
    expect(discardsFor('9s 8h 7d 6c 2s')).toEqual(['2s']);
  });

  test('ノーペアでAを持つならA以外の4枚を交換する', () => {
    expect(discardsFor('As 9h 7d 5c 3s')).toEqual(['3s', '5c', '7d', '9h'].sort());
  });

  test('ノーペアで高いカードもなければ5枚交換する', () => {
    expect(discardsFor('9h 7d 5c 3s 2h')).toHaveLength(5);
  });
});

describe('decideDiscards（弱い）', () => {
  test('ペアがあればペアは残す', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = drawState({ aiLevel: 'weak', aiHand: 'Ks Kh 9d 7c 3s' });
      const indices = decideDiscards(state, seededRng(seed));
      expect(indices).not.toContain(0);
      expect(indices).not.toContain(1);
    }
  });

  test('交換枚数がばらつく（ランダム性がある）', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) {
      const state = drawState({ aiLevel: 'weak', aiHand: 'Ks Kh 9d 7c 3s' });
      counts.add(decideDiscards(state, seededRng(seed)).length);
    }
    expect(counts.size).toBeGreaterThan(1);
  });
});

describe('decideDiscards（最強＝チート）', () => {
  test('山札が見えるので交換後に最強の役になる捨て方を選ぶ', () => {
    // Arrange: 山札の先頭がスペードのA・Kなので、それを引けばロイヤル級の手になる
    const state = drawState({
      aiLevel: 'cheat',
      aiHand: 'Qs Js Ts 7c 3d',
      deck: parseCards('As Ks 2h 4d 6c 8h 9c'),
    });

    // Act
    const indices = decideDiscards(state, seededRng(1));

    // Assert: 7c と 3d を捨てて As Ks を引く
    expect(discarded(state, indices)).toEqual(['3d', '7c'].sort());
  });

  test('交換しない方が強い場合は交換しない', () => {
    const state = drawState({
      aiLevel: 'cheat',
      aiHand: 'As Ks Qs Js Ts',
      deck: parseCards('2h 3d 4c 5h 6s 7d 8c'),
    });
    expect(decideDiscards(state, seededRng(1))).toEqual([]);
  });
});

describe('decideAction（共通）', () => {
  test('どのレベルでも合法なアクションだけを返す', () => {
    for (const level of ['weak', 'normal', 'strong', 'cheat'] as AiLevel[]) {
      for (const humanBet of [0, 20]) {
        for (let seed = 1; seed <= 5; seed++) {
          // Arrange
          const state = bettingState({ aiLevel: level, aiHand: 'Ks Kh 9d 7c 3s', humanBet });

          // Act
          const action = decideAction(state, seededRng(seed));

          // Assert
          expect(isLegal(state, action)).toBe(true);
        }
      }
    }
  });

  test('ノーリミットでも合法なアクションだけを返す', () => {
    for (const level of ['weak', 'normal', 'strong', 'cheat'] as AiLevel[]) {
      for (const humanBet of [0, 100]) {
        const state = bettingState({
          aiLevel: level,
          aiHand: 'As Ah Ad 7c 3s',
          humanBet,
          betStructure: 'noLimit',
        });
        const action = decideAction(state, seededRng(3));
        expect(isLegal(state, action)).toBe(true);
      }
    }
  });

  test('AIの手番でないときは例外を投げる', () => {
    const base = bettingState({ aiLevel: 'normal', aiHand: 'Ks Kh 9d 7c 3s' });
    const state = { ...base, turn: 'human' as const };
    expect(() => decideAction(state, seededRng(1))).toThrow();
  });
});

describe('decideAction（弱い）', () => {
  const countActions = (humanBet: number): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (let seed = 1; seed <= 40; seed++) {
      const state = bettingState({ aiLevel: 'weak', aiHand: '9h 7d 5c 3s 2h', humanBet });
      const action = decideAction(state, seededRng(seed));
      counts[action.type] = (counts[action.type] ?? 0) + 1;
    }
    return counts;
  };

  test('弱い手でベットに直面してもほとんどはコールする', () => {
    const counts = countActions(20);
    expect(counts.call ?? 0).toBeGreaterThan(counts.fold ?? 0);
  });

  test('チェックできるときはほとんどチェックする', () => {
    const counts = countActions(0);
    expect(counts.check ?? 0).toBeGreaterThan(counts.bet ?? 0);
  });
});

describe('decideAction（通常）', () => {
  test('強い役ならベットする', () => {
    const state = bettingState({ aiLevel: 'normal', aiHand: 'Ks Kh Kd 9c 3s' });
    expect(decideAction(state, seededRng(1)).type).toBe('bet');
  });

  test('弱い役でベットに直面したらフォールドする', () => {
    const state = bettingState({
      aiLevel: 'normal',
      aiHand: '9h 7d 5c 3s 2h',
      phase: 'bet2',
      humanBet: 100,
      betStructure: 'noLimit',
    });
    expect(decideAction(state, seededRng(1)).type).toBe('fold');
  });

  test('弱い役でもチェックできるならチェックする', () => {
    const state = bettingState({ aiLevel: 'normal', aiHand: '9h 7d 5c 3s 2h' });
    expect(decideAction(state, seededRng(1)).type).toBe('check');
  });
});

describe('decideAction（強い）', () => {
  test('勝率が高ければベットする', () => {
    const state = bettingState({
      aiLevel: 'strong',
      aiHand: 'As Ah Ad Ac 3s',
      phase: 'bet2',
    });
    expect(decideAction(state, seededRng(1)).type).toBe('bet');
  });

  test('勝率が低く高額のコールを迫られたらフォールドする', () => {
    const state = bettingState({
      aiLevel: 'strong',
      aiHand: '9h 7d 5c 3s 2h',
      phase: 'bet2',
      humanBet: 500,
      pot: 20,
      betStructure: 'noLimit',
    });
    expect(decideAction(state, seededRng(1)).type).toBe('fold');
  });

  test('勝率が低くてもチェックできるならフォールドしない', () => {
    const state = bettingState({ aiLevel: 'strong', aiHand: '9h 7d 5c 3s 2h', phase: 'bet2' });
    expect(decideAction(state, seededRng(1)).type).not.toBe('fold');
  });
});

describe('decideAction（最強＝チート）', () => {
  /** 交換後（bet2）の勝敗が確定している状態を作る */
  const settled = (aiHand: string, humanHand: string, humanBet = 0): GameState =>
    bettingState({
      aiLevel: 'cheat',
      aiHand,
      humanHand,
      humanBet,
      phase: 'bet2',
      betStructure: 'noLimit',
      pot: 100,
    });

  test('勝ちが確定していればベットする', () => {
    const state = settled('As Ah Ad Ac Ks', '2c 3c 4h 5d 7s');
    expect(decideAction(state, seededRng(1)).type).toBe('bet');
  });

  test('勝ちが確定していてベットに直面したらレイズする', () => {
    const state = settled('As Ah Ad Ac Ks', '2c 3c 4h 5d 7s', 50);
    expect(decideAction(state, seededRng(1)).type).toBe('raise');
  });

  test('負けが確定していてベットに直面したらフォールドする', () => {
    const state = settled('2c 3c 4h 5d 7s', 'As Ah Ad Ac Ks', 50);
    expect(decideAction(state, seededRng(1)).type).toBe('fold');
  });

  test('負けが確定していてもチェックできるならチェックする', () => {
    const state = settled('2c 3c 4h 5d 7s', 'As Ah Ad Ac Ks');
    expect(decideAction(state, seededRng(1)).type).toBe('check');
  });

  test('引き分けが確定していればチェックする', () => {
    const state = settled('Ks Kh 9d 7c 3s', 'Kd Kc 9s 7h 3h');
    expect(decideAction(state, seededRng(1)).type).toBe('check');
  });

  test('引き分けが確定していてベットに直面したらコールする', () => {
    const state = settled('Ks Kh 9d 7c 3s', 'Kd Kc 9s 7h 3h', 50);
    expect(decideAction(state, seededRng(1)).type).toBe('call');
  });

  test('交換前でも山札を見て勝敗を予測して行動する', () => {
    // Arrange: 交換すればフォーカードになると分かっている
    const state = bettingState({
      aiLevel: 'cheat',
      aiHand: 'As Ah Ad 7c 3s',
      humanHand: '2c 3c 4h 5d 7s',
      deck: parseCards('Ac Kd Qh Jd 9c 8s 6h 4c'),
      betStructure: 'noLimit',
    });

    // Act / Assert
    expect(decideAction(state, seededRng(1)).type).toBe('bet');
  });
});

describe('ゲーム全体の進行', () => {
  /** 人間側の単純な戦略（チェックできればチェック、安ければコール） */
  function humanAction(state: GameState): Action {
    const legal = getLegalActions(state);
    if (legal.canCheck) return { type: 'check' };
    if (legal.canCall && legal.callAmount <= state.players.human.chips * 0.3) {
      return { type: 'call' };
    }
    return { type: 'fold' };
  }

  test.each(['weak', 'normal', 'strong', 'cheat'] as AiLevel[])(
    '%s のAIと最後までプレイしても例外なく破産で決着する',
    (aiLevel) => {
      // Arrange
      const rng = seededRng(42);
      const config = { ...defaultConfig(), initialChips: 100, ante: 10, aiLevel };
      let state = startHand(createInitialState(config), rng);
      const total = () =>
        state.pot +
        state.players.human.chips +
        state.players.human.bet +
        state.players.ai.chips +
        state.players.ai.bet;

      // Act
      let steps = 0;
      while (state.phase !== 'gameEnd' && steps < 3000) {
        steps++;
        if (state.turn === 'ai') {
          state = applyAction(state, decideAction(state, rng));
        } else if (state.turn === 'human') {
          state = applyAction(state, humanAction(state));
        } else if (nextDrawer(state) === 'ai') {
          state = exchangeCards(state, 'ai', decideDiscards(state, rng));
        } else if (nextDrawer(state) === 'human') {
          state = exchangeCards(state, 'human', standardDiscards(state.players.human.hand));
        } else if (state.phase === 'showdown') {
          state = resolveShowdown(state);
        } else if (state.phase === 'handEnd') {
          state = nextHand(state, rng);
        }
        // Assert: チップの総量は常に保たれる
        expect(total()).toBe(200);
      }

      // Assert
      expect(state.phase).toBe('gameEnd');
      expect(Math.min(state.players.human.chips, state.players.ai.chips)).toBe(0);
    },
  );
});
