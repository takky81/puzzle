import { describe, test, expect } from 'vitest';
import {
  defaultConfig,
  defaultPlayerName,
  createInitialState,
  isGoalAchieved,
  drawNumber,
  continueGame,
  getRanks,
} from './logic';
import { seededRng } from '../../tests/rng';
import { markAll, markRows, lineOf } from '../../tests/bingoCard';
import type { Goal } from './types';
import { createCard } from './card';
import type { GameConfig, GameState, Player } from './types';

/** テスト用の設定を作る */
function configOf(overrides: Partial<GameConfig> = {}): GameConfig {
  return { ...defaultConfig(), ...overrides };
}

/** 決着するまで引き続け、最終 state を返す */
function playToEnd(config: GameConfig, seed: number): GameState {
  const rng = seededRng(seed);
  let state = createInitialState(config, seededRng(seed + 1));
  while (state.phase === 'playing') {
    state = drawNumber(state, rng);
  }
  return state;
}

// テストリスト（Step 1: List）
// SPEC: src/routes/bingo/SPEC.md の「抽選」「目標（勝利条件）」「ゲーム設定」から導出

// ── defaultConfig ─────────────────────────────────────────────────────────────
// 仕様: ゲーム設定のデフォルト値

describe('defaultConfig', () => {
  test('プレイヤーは2人である', () => {
    expect(defaultConfig().playerTypes).toHaveLength(2);
  });

  test('Player1 は人間、Player2 は CPU である', () => {
    expect(defaultConfig().playerTypes).toEqual(['human', 'cpu']);
  });

  test('プレイヤー名は種別に応じた既定名である', () => {
    expect(defaultConfig().playerNames).toEqual(['プレイヤー1', 'CPU2']);
  });

  test('目標は 1ライン(single) である', () => {
    expect(defaultConfig().goal).toBe('single');
  });

  test('自動抽選間隔は 1500ms である', () => {
    expect(defaultConfig().autoDrawIntervalMs).toBe(1500);
  });
});

// ── defaultPlayerName ─────────────────────────────────────────────────────────
// 仕様: 人間は「プレイヤーN」、CPU は「CPUN」（N は1始まり）

describe('defaultPlayerName', () => {
  test('人間の既定名は「プレイヤー1」である（index=0）', () => {
    expect(defaultPlayerName('human', 0)).toBe('プレイヤー1');
  });

  test('CPU の既定名は「CPU2」である（index=1）', () => {
    expect(defaultPlayerName('cpu', 1)).toBe('CPU2');
  });

  test('4人目の既定名は index に応じて4になる', () => {
    expect(defaultPlayerName('human', 3)).toBe('プレイヤー4');
    expect(defaultPlayerName('cpu', 3)).toBe('CPU4');
  });
});

// ── createInitialState ────────────────────────────────────────────────────────
// 仕様: 設定からゲーム開始状態を作る

describe('createInitialState', () => {
  test('設定した人数分のプレイヤーが生成される', () => {
    // Arrange
    const config = configOf({
      playerTypes: ['human', 'cpu', 'cpu', 'cpu'],
      playerNames: ['A', 'B', 'C', 'D'],
    });

    // Act
    const state = createInitialState(config, seededRng(1));

    // Assert
    expect(state.players).toHaveLength(4);
  });

  test('各プレイヤーに異なるカードが配られる', () => {
    const state = createInitialState(configOf(), seededRng(1));

    expect(state.players[0].card).not.toEqual(state.players[1].card);
  });

  test('各プレイヤーの名前が設定から反映される', () => {
    const config = configOf({ playerTypes: ['human', 'cpu'], playerNames: ['たろう', 'はなこ'] });

    const state = createInitialState(config, seededRng(1));

    expect(state.players.map((player) => player.name)).toEqual(['たろう', 'はなこ']);
  });

  test('各プレイヤーの種別が設定から反映される', () => {
    const config = configOf({ playerTypes: ['cpu', 'human'], playerNames: ['A', 'B'] });

    const state = createInitialState(config, seededRng(1));

    expect(state.players.map((player) => player.type)).toEqual(['cpu', 'human']);
  });

  test('プレイヤーの id は0から連番である', () => {
    const config = configOf({
      playerTypes: ['human', 'cpu', 'cpu'],
      playerNames: ['A', 'B', 'C'],
    });

    const state = createInitialState(config, seededRng(1));

    expect(state.players.map((player) => player.id)).toEqual([0, 1, 2]);
  });

  test('抽選済み番号(drawn)は空である', () => {
    expect(createInitialState(configOf(), seededRng(1)).drawn).toEqual([]);
  });

  test('未抽選番号(remaining)は 1〜75 の75個である', () => {
    const state = createInitialState(configOf(), seededRng(1));

    expect(state.remaining).toHaveLength(75);
    expect([...state.remaining].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 75 }, (_, i) => i + 1),
    );
  });

  test('lastDrawn は null である', () => {
    expect(createInitialState(configOf(), seededRng(1)).lastDrawn).toBeNull();
  });

  test('phase は playing である', () => {
    expect(createInitialState(configOf(), seededRng(1)).phase).toBe('playing');
  });

  test('winners は空である', () => {
    expect(createInitialState(configOf(), seededRng(1)).winners).toEqual([]);
  });

  test('各プレイヤーのビンゴ本数・リーチ本数は0である', () => {
    const state = createInitialState(configOf(), seededRng(1));

    for (const player of state.players) {
      expect(player.bingoLines).toBe(0);
      expect(player.reachLines).toBe(0);
    }
  });
});

// ── drawNumber ────────────────────────────────────────────────────────────────
// 仕様: 番号を1つ抽選し、全プレイヤーのカードを自動マークする

describe('drawNumber', () => {
  test('抽選した番号が drawn の末尾に追加される', () => {
    // Arrange
    const state = createInitialState(configOf(), seededRng(1));

    // Act
    const next = drawNumber(state, seededRng(1));

    // Assert
    expect(next.drawn).toHaveLength(1);
    expect(next.drawn[0]).toBe(next.lastDrawn);
  });

  test('抽選した番号が remaining から取り除かれる', () => {
    const state = createInitialState(configOf(), seededRng(1));

    const next = drawNumber(state, seededRng(1));

    expect(next.remaining).toHaveLength(74);
    expect(next.remaining).not.toContain(next.lastDrawn);
  });

  test('抽選した番号が lastDrawn に入る', () => {
    const state = createInitialState(configOf(), seededRng(1));

    const next = drawNumber(state, seededRng(1));

    expect(next.lastDrawn).not.toBeNull();
  });

  test('抽選は未抽選番号の中から選ばれる', () => {
    const state = createInitialState(configOf(), seededRng(1));

    const next = drawNumber(state, seededRng(1));

    expect(state.remaining).toContain(next.lastDrawn);
  });

  test('同じ番号が2回抽選されることはない', () => {
    // Arrange
    const rng = seededRng(99);
    let state = createInitialState(configOf({ goal: 'blackout' }), seededRng(1));

    // Act: 引けるだけ引く
    while (state.phase === 'playing') {
      state = drawNumber(state, rng);
    }

    // Assert
    expect(new Set(state.drawn).size).toBe(state.drawn.length);
  });

  test('抽選した番号が全プレイヤーのカードでマークされる', () => {
    const state = createInitialState(configOf(), seededRng(1));

    const next = drawNumber(state, seededRng(1));

    for (const player of next.players) {
      const cell = player.card.cells.flat().find((c) => c.value === next.lastDrawn);
      if (cell) expect(cell.marked).toBe(true);
    }
  });

  test('各プレイヤーのビンゴ本数が更新される', () => {
    // Arrange: ブラックアウトを目標に、決着するまで引き続ける
    const rng = seededRng(4);
    let state = createInitialState(configOf({ goal: 'blackout' }), seededRng(1));

    // Act
    while (state.phase === 'playing') {
      state = drawNumber(state, rng);
    }

    // Assert: ブラックアウト達成者は全ラインが揃うので12本になる
    const winner = state.players.find((player) => state.winners.includes(player.id));
    expect(winner?.bingoLines).toBe(12);
  });

  test('各プレイヤーのリーチ本数が更新される', () => {
    // Arrange: 1回の抽選ではリーチは発生しないが、引き続けると必ずリーチを経由する
    const rng = seededRng(4);
    let state = createInitialState(configOf({ goal: 'blackout' }), seededRng(1));
    let sawReach = false;

    // Act
    while (state.phase === 'playing') {
      state = drawNumber(state, rng);
      if (state.players.some((player) => player.reachLines > 0)) sawReach = true;
    }

    // Assert
    expect(sawReach).toBe(true);
  });

  test('元の state を変更せず新しい state を返す', () => {
    const state = createInitialState(configOf(), seededRng(1));

    drawNumber(state, seededRng(1));

    expect(state.drawn).toEqual([]);
    expect(state.remaining).toHaveLength(75);
    expect(state.lastDrawn).toBeNull();
  });

  test('未抽選番号が空の状態で呼ぶと例外を投げる', () => {
    const state = createInitialState(configOf(), seededRng(1));
    const empty = { ...state, remaining: [] };

    expect(() => drawNumber(empty, seededRng(1))).toThrow();
  });

  test('phase が finished の状態で呼ぶと例外を投げる', () => {
    const state = createInitialState(configOf(), seededRng(1));
    const finished = { ...state, phase: 'finished' as const };

    expect(() => drawNumber(finished, seededRng(1))).toThrow();
  });
});

// ── drawNumber の勝敗判定 ─────────────────────────────────────────────────────
// 仕様: 目標達成者が出た抽選回で終了。同一抽選回の達成者は全員勝者（同着）

describe('drawNumber の勝敗判定', () => {
  test('目標を達成したプレイヤーが出ると phase が finished になる', () => {
    expect(playToEnd(configOf(), 21).phase).toBe('finished');
  });

  test('目標を達成したプレイヤーの id が winners に入る', () => {
    // Arrange
    const state = playToEnd(configOf(), 21);

    // Assert
    for (const id of state.winners) {
      const player = state.players.find((p) => p.id === id);
      expect(isGoalAchieved(player!.card, state.config.goal)).toBe(true);
    }
  });

  test('同一の抽選回で2人が達成すると winners に2人とも入る', () => {
    // Arrange: 2人に同じカードを配り、リーチの1マス前まで進めた状態を作る
    const base = createInitialState(configOf(), seededRng(1));
    const card = base.players[0].card;
    const row0 = lineOf('row', 0);
    const state = {
      ...base,
      players: base.players.map((player) => ({ ...player, card })),
    };
    const values = row0.positions
      .map(({ row, col }) => card.cells[row][col].value)
      .filter((value): value is number => value !== null);

    // Act: 横ライン0 の番号を順に抽選する
    let current = state;
    for (const value of values) {
      current = { ...current, remaining: [value] };
      current = drawNumber(current, () => 0);
    }

    // Assert
    expect(current.phase).toBe('finished');
    expect(current.winners).toEqual([0, 1]);
  });

  test('誰も達成していない間は phase が playing のままである', () => {
    const state = createInitialState(configOf(), seededRng(1));

    const next = drawNumber(state, seededRng(1));

    expect(next.phase).toBe('playing');
  });

  test('誰も達成していない間は winners は空である', () => {
    const state = createInitialState(configOf(), seededRng(1));

    const next = drawNumber(state, seededRng(1));

    expect(next.winners).toEqual([]);
  });
});

// ── isGoalAchieved ────────────────────────────────────────────────────────────
// 仕様: 目標ごとの達成判定

describe('isGoalAchieved', () => {
  test('single: ビンゴ0本では false を返す', () => {
    expect(isGoalAchieved(createCard(seededRng(2)), 'single')).toBe(false);
  });

  test('single: ビンゴ1本で true を返す', () => {
    const card = markRows(createCard(seededRng(2)), 1);

    expect(isGoalAchieved(card, 'single')).toBe(true);
  });

  test('triple: ビンゴ2本では false を返す', () => {
    const card = markRows(createCard(seededRng(2)), 2);

    expect(isGoalAchieved(card, 'triple')).toBe(false);
  });

  test('triple: ビンゴ3本で true を返す', () => {
    const card = markRows(createCard(seededRng(2)), 3);

    expect(isGoalAchieved(card, 'triple')).toBe(true);
  });

  test('blackout: ビンゴが成立していても全マス埋まるまで false を返す', () => {
    const card = markRows(createCard(seededRng(2)), 4);

    expect(isGoalAchieved(card, 'single')).toBe(true);
    expect(isGoalAchieved(card, 'blackout')).toBe(false);
  });

  test('blackout: FREE 以外の24マスが全て埋まると true を返す', () => {
    const card = markAll(createCard(seededRng(2)));

    expect(isGoalAchieved(card, 'blackout')).toBe(true);
  });
});

// ── 決着の保証（不変条件） ────────────────────────────────────────────────────
// 仕様: 75個引き切れば全員ブラックアウトするため、必ず75回以内に決着する

describe('決着の保証', () => {
  const goals: Goal[] = ['single', 'triple', 'blackout'];

  test.each(goals)('%s: 引き切る前に必ず phase が finished になる', (goal) => {
    // Arrange & Act: 乱数シードを変えて繰り返し確認する
    for (let seed = 1; seed <= 20; seed++) {
      const state = playToEnd(configOf({ goal }), seed);

      // Assert
      expect(state.phase).toBe('finished');
      expect(state.drawn.length).toBeLessThanOrEqual(75);
    }
  });

  test('4人プレイでも引き切る前に必ず phase が finished になる', () => {
    const config = configOf({
      playerTypes: ['human', 'cpu', 'cpu', 'cpu'],
      playerNames: ['A', 'B', 'C', 'D'],
      goal: 'blackout',
    });

    for (let seed = 1; seed <= 20; seed++) {
      const state = playToEnd(config, seed);

      expect(state.phase).toBe('finished');
      expect(state.drawn.length).toBeLessThanOrEqual(75);
    }
  });

  test('決着時 winners は必ず1人以上である', () => {
    for (const goal of goals) {
      for (let seed = 1; seed <= 20; seed++) {
        expect(playToEnd(configOf({ goal }), seed).winners.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

// ── achievedAt（達成した抽選回） ───────────────────────────────────────────────
// 仕様: 順位表示のため、各プレイヤーが何回目の抽選で目標を達成したかを記録する

describe('achievedAt', () => {
  test('初期状態では achievedAt は null である', () => {
    const state = createInitialState(configOf(), seededRng(1));

    for (const player of state.players) {
      expect(player.achievedAt).toBeNull();
    }
  });

  test('目標を達成した抽選回が achievedAt に入る', () => {
    // Arrange & Act
    const state = playToEnd(configOf(), 21);

    // Assert
    for (const id of state.winners) {
      const player = state.players.find((p) => p.id === id);
      expect(player?.achievedAt).toBe(state.drawn.length);
    }
  });

  test('一度設定された achievedAt は以降の抽選で変わらない', () => {
    // Arrange: 決着後に継続して引き続ける
    const rng = seededRng(31);
    let state = playToEnd(configOf(), 31);
    const winnerId = state.winners[0];
    const achievedAt = state.players.find((p) => p.id === winnerId)?.achievedAt;

    // Act
    state = continueGame(state);
    while (state.phase === 'playing') {
      state = drawNumber(state, rng);
    }

    // Assert
    expect(state.players.find((p) => p.id === winnerId)?.achievedAt).toBe(achievedAt);
  });

  test('未達成のプレイヤーの achievedAt は null のままである', () => {
    // Arrange: 1回引いただけでは誰も達成しない
    const state = drawNumber(createInitialState(configOf(), seededRng(1)), seededRng(1));

    // Assert
    for (const player of state.players) {
      expect(player.achievedAt).toBeNull();
    }
  });
});

// ── continueGame ──────────────────────────────────────────────────────────────
// 仕様: 決着後もそのまま抽選を続けて残りの順位を確定できる

describe('continueGame', () => {
  test('finished の状態から playing に戻る', () => {
    // Arrange
    const finished = playToEnd(configOf(), 21);

    // Act
    const continued = continueGame(finished);

    // Assert
    expect(continued.phase).toBe('playing');
  });

  test('continued が true になる', () => {
    expect(continueGame(playToEnd(configOf(), 21)).continued).toBe(true);
  });

  test('winners は最初の達成者のまま変わらない', () => {
    const finished = playToEnd(configOf(), 21);

    expect(continueGame(finished).winners).toEqual(finished.winners);
  });

  test('drawn / remaining / players は変わらない', () => {
    const finished = playToEnd(configOf(), 21);

    const continued = continueGame(finished);

    expect(continued.drawn).toEqual(finished.drawn);
    expect(continued.remaining).toEqual(finished.remaining);
    expect(continued.players).toEqual(finished.players);
  });

  test('playing の状態で呼ぶと例外を投げる', () => {
    const state = createInitialState(configOf(), seededRng(1));

    expect(() => continueGame(state)).toThrow();
  });

  test('元の state を変更せず新しい state を返す', () => {
    const finished = playToEnd(configOf(), 21);

    continueGame(finished);

    expect(finished.phase).toBe('finished');
    expect(finished.continued).toBe(false);
  });
});

// ── 継続モードの終了条件 ──────────────────────────────────────────────────────
// 仕様: 継続モードでは全員が目標を達成した時点で終了する

describe('継続モードの終了条件', () => {
  /** 決着後に継続し、終わるまで引き続ける */
  function playContinued(config: GameConfig, seed: number): GameState {
    const rng = seededRng(seed);
    let state = continueGame(playToEnd(config, seed));
    while (state.phase === 'playing') {
      state = drawNumber(state, rng);
    }
    return state;
  }

  test('継続後、まだ未達成のプレイヤーがいる間は playing のままである', () => {
    // Arrange: 4人・ブラックアウトなら継続直後に全員達成していることはない
    const config = configOf({
      playerTypes: ['human', 'cpu', 'cpu', 'cpu'],
      playerNames: ['A', 'B', 'C', 'D'],
      goal: 'blackout',
    });
    const continued = continueGame(playToEnd(config, 5));

    // Act
    const next = drawNumber(continued, seededRng(5));

    // Assert
    expect(next.players.some((player) => player.achievedAt === null)).toBe(true);
    expect(next.phase).toBe('playing');
  });

  test('継続後に全員が達成すると finished になる', () => {
    const state = playContinued(configOf(), 7);

    expect(state.phase).toBe('finished');
    expect(state.players.every((player) => player.achievedAt !== null)).toBe(true);
  });

  test('継続しても winners は増えない', () => {
    const finished = playToEnd(configOf(), 7);

    const state = playContinued(configOf(), 7);

    expect(state.winners).toEqual(finished.winners);
  });

  test('継続モードでも引き切る前に必ず全員が達成する', () => {
    const config = configOf({
      playerTypes: ['human', 'cpu', 'cpu', 'cpu'],
      playerNames: ['A', 'B', 'C', 'D'],
      goal: 'blackout',
    });

    for (let seed = 1; seed <= 10; seed++) {
      const state = playContinued(config, seed);

      expect(state.phase).toBe('finished');
      expect(state.drawn.length).toBeLessThanOrEqual(75);
    }
  });
});

// ── getRanks ──────────────────────────────────────────────────────────────────
// 仕様: achievedAt の昇順で順位を付ける。同じ抽選回は同順位

describe('getRanks', () => {
  const basePlayer: Player = {
    id: 0,
    name: 'P',
    type: 'human',
    card: createCard(seededRng(1)),
    bingoLines: 0,
    reachLines: 0,
    achievedAt: null,
  };

  test('未達成のプレイヤーは順位を持たない', () => {
    const state = createInitialState(configOf(), seededRng(1));

    expect(getRanks(state.players).size).toBe(0);
  });

  test('最初に達成したプレイヤーが1位である', () => {
    const players = [
      { id: 0, achievedAt: 30 },
      { id: 1, achievedAt: 12 },
    ].map((p) => ({ ...basePlayer, ...p }));

    expect(getRanks(players).get(1)).toBe(1);
  });

  test('2番目に達成したプレイヤーが2位である', () => {
    const players = [
      { id: 0, achievedAt: 30 },
      { id: 1, achievedAt: 12 },
    ].map((p) => ({ ...basePlayer, ...p }));

    expect(getRanks(players).get(0)).toBe(2);
  });

  test('同じ抽選回で達成したプレイヤーは同順位である', () => {
    const players = [
      { id: 0, achievedAt: 12 },
      { id: 1, achievedAt: 12 },
    ].map((p) => ({ ...basePlayer, ...p }));

    const ranks = getRanks(players);

    expect(ranks.get(0)).toBe(1);
    expect(ranks.get(1)).toBe(1);
  });

  test('同順位が2人いる場合、次のプレイヤーは3位である', () => {
    const players = [
      { id: 0, achievedAt: 12 },
      { id: 1, achievedAt: 12 },
      { id: 2, achievedAt: 20 },
    ].map((p) => ({ ...basePlayer, ...p }));

    expect(getRanks(players).get(2)).toBe(3);
  });
});
