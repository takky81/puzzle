import { describe, expect, test } from 'vitest';
import {
  chooseRandomMove,
  chooseNormalMove,
  chooseHardMove,
  chooseWeakestMove,
  evaluate,
  getCandidateMoves,
} from './ai';
import { createGame } from './logic';
import type { Board, GameState } from './types';
import { BOARD_SIZE } from './types';

function emptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
}

function makeGame(overrides: Partial<GameState> = {}): GameState {
  return {
    board: emptyBoard(),
    currentColor: 'black',
    gameOver: false,
    winner: null,
    lastMove: null,
    forbiddenRule: false,
    ...overrides,
  };
}

describe('五目並べ AI', () => {
  describe('候補手の生成', () => {
    test('既存の石から2マス以内の空きマスを返す', () => {
      const board = emptyBoard();
      board[7][7] = 'black';
      const game = makeGame({ board });
      const moves = getCandidateMoves(game);
      // 中央に1石 → 周囲2マスの空きマスが候補
      expect(moves.length).toBeGreaterThan(0);
      expect(moves).toContainEqual([7, 8]);
      expect(moves).toContainEqual([9, 9]);
      // 遠すぎるマスは含まない
      expect(moves).not.toContainEqual([7, 10]);
    });

    test('盤面が空なら中央を返す', () => {
      const game = createGame();
      const moves = getCandidateMoves(game);
      expect(moves).toContainEqual([7, 7]);
    });
  });

  describe('ランダムAI（弱い）', () => {
    test('候補手の中から1つを返す', () => {
      const board = emptyBoard();
      board[7][7] = 'black';
      const game = makeGame({ board, currentColor: 'white' });
      const move = chooseRandomMove(game);
      const candidates = getCandidateMoves(game);
      expect(candidates).toContainEqual(move);
    });
  });

  describe('簡易評価関数AI（普通）', () => {
    test('候補手の中から1つを返す', () => {
      const board = emptyBoard();
      board[7][7] = 'black';
      const game = makeGame({ board, currentColor: 'white' });
      const move = chooseNormalMove(game);
      const candidates = getCandidateMoves(game);
      expect(candidates).toContainEqual(move);
    });

    test('4連を完成できる手を優先する', () => {
      const board = emptyBoard();
      // 黒が横に4つ並んでいる → (7,2) or (7,7) で5連
      for (let c = 3; c <= 6; c++) board[7][c] = 'black';
      const game = makeGame({ board, currentColor: 'black' });
      const move = chooseNormalMove(game);
      expect(move[0]).toBe(7);
      expect([2, 7]).toContain(move[1]);
    });
  });

  describe('評価関数', () => {
    test('5連がある盤面は最高評価', () => {
      const board = emptyBoard();
      for (let c = 3; c <= 7; c++) board[7][c] = 'black';
      const score = evaluate(board, 'black');
      expect(score).toBeGreaterThan(10000);
    });

    test('活四は高評価', () => {
      const board = emptyBoard();
      for (let c = 3; c <= 6; c++) board[7][c] = 'black';
      // 両端が空き → 活四
      const score = evaluate(board, 'black');
      expect(score).toBeGreaterThan(1000);
    });

    test('自分の石が多いほど高評価', () => {
      const board1 = emptyBoard();
      board1[7][7] = 'black';
      board1[7][8] = 'black';

      const board2 = emptyBoard();
      board2[7][7] = 'black';
      board2[7][8] = 'black';
      board2[7][9] = 'black';

      expect(evaluate(board2, 'black')).toBeGreaterThan(evaluate(board1, 'black'));
    });
  });

  describe('ミニマックスAI（強い）', () => {
    test('候補手の中から1つを返す', () => {
      const board = emptyBoard();
      board[7][7] = 'black';
      const game = makeGame({ board, currentColor: 'white' });
      const { move } = chooseHardMove(game, { maxDepth: 2, maxTime: 3000 });
      const candidates = getCandidateMoves(game);
      expect(candidates).toContainEqual(move);
    });

    test('勝ちの手があれば必ずそれを選ぶ', () => {
      const board = emptyBoard();
      for (let c = 3; c <= 6; c++) board[7][c] = 'black';
      const game = makeGame({ board, currentColor: 'black' });
      const { move } = chooseHardMove(game, { maxDepth: 2, maxTime: 3000 });
      // (7,2) or (7,7) で5連完成
      expect(move[0]).toBe(7);
      expect([2, 7]).toContain(move[1]);
    });

    test('相手の活四を防ぐ手を選ぶ', () => {
      // NormalMoveでも防御手を選べることを確認
      const board = emptyBoard();
      for (let c = 3; c <= 6; c++) board[7][c] = 'white';
      const game = makeGame({ board, currentColor: 'black' });
      const move = chooseNormalMove(game);
      // (7,2) or (7,7) で相手の活四をブロック
      expect(move[0]).toBe(7);
      expect([2, 7]).toContain(move[1]);
    });

    test('到達した探索深さが返される', () => {
      const board = emptyBoard();
      board[7][7] = 'black';
      const game = makeGame({ board, currentColor: 'white' });
      const result = chooseHardMove(game, { maxDepth: 2, maxTime: 3000 });
      expect(result.depth).toBeGreaterThanOrEqual(1);
    });

    test('時間制限で探索が打ち切られる', () => {
      const board = emptyBoard();
      board[7][7] = 'black';
      const game = makeGame({ board, currentColor: 'white' });
      const start = Date.now();
      chooseHardMove(game, { maxDepth: 100, maxTime: 100 });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('最弱AI（逆ミニマックス）', () => {
    test('候補手の中から1つを返す', () => {
      const board = emptyBoard();
      board[7][7] = 'black';
      const game = makeGame({ board, currentColor: 'white' });
      const { move } = chooseWeakestMove(game, { maxDepth: 2, maxTime: 3000 });
      const candidates = getCandidateMoves(game);
      expect(candidates).toContainEqual(move);
    });

    test('強いAIとは異なる手を選ぶ', () => {
      const board = emptyBoard();
      board[7][7] = 'black';
      board[7][8] = 'white';
      board[8][7] = 'black';
      board[6][6] = 'white';
      const game = makeGame({ board, currentColor: 'black' });
      const config = { maxDepth: 3, maxTime: 3000 };
      const { move: hardMove } = chooseHardMove(game, config);
      const { move: weakestMove } = chooseWeakestMove(game, config);
      expect(weakestMove).not.toEqual(hardMove);
    });
  });
});
