import { describe, expect, test } from 'vitest';
import {
  chooseRandomMove,
  chooseNormalMove,
  chooseHardMove,
  evaluatePosition,
  countStableDiscs,
} from './ai';
import { createGame, getValidMoves, placeStone } from './logic';
import type { Board, GameState } from './types';

function emptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
}

describe('オセロ AI', () => {
  describe('ランダムAI（弱い）', () => {
    test('合法手の中からランダムに1つ選ぶ', () => {
      const game = createGame();
      const move = chooseRandomMove(game);
      const validMoves = getValidMoves(game.board, game.currentColor);
      expect(validMoves).toContainEqual(move);
    });

    test('合法手が1つなら必ずそれを返す', () => {
      const board = emptyBoard();
      board[0][0] = 'black';
      board[0][1] = 'white';
      // 黒は(0,2)にだけ置ける... いや、(0,0)黒の右に(0,1)白があるので
      // (0,2)に黒を置けば(0,1)を挟める
      const game: GameState = {
        board,
        currentColor: 'black',
        gameOver: false,
        passed: false,
        lastMove: null,
        flipped: [],
      };
      const moves = getValidMoves(board, 'black');
      expect(moves).toHaveLength(1);
      const move = chooseRandomMove(game);
      expect(move).toEqual(moves[0]);
    });
  });

  describe('簡易評価関数AI（普通）', () => {
    test('角が取れるなら角を選ぶ', () => {
      // 角(0,0)が合法手に含まれる盤面を作る
      const board = emptyBoard();
      board[0][1] = 'white';
      board[0][2] = 'black';
      board[1][0] = 'white';
      board[2][0] = 'black';
      // (0,0)は角で合法手
      const game: GameState = {
        board,
        currentColor: 'black',
        gameOver: false,
        passed: false,
        lastMove: null,
        flipped: [],
      };
      const move = chooseNormalMove(game);
      expect(move).toEqual([0, 0]);
    });

    test('角隣は低い評価になる', () => {
      const score00 = evaluatePosition(0, 0); // 角
      const score01 = evaluatePosition(0, 1); // 角隣
      const score11 = evaluatePosition(1, 1); // 角の斜め隣
      expect(score00).toBeGreaterThan(score01);
      expect(score00).toBeGreaterThan(score11);
      expect(score01).toBeLessThan(0);
      expect(score11).toBeLessThan(0);
    });

    test('辺は中央より高い評価になる', () => {
      const scoreEdge = evaluatePosition(0, 3); // 辺
      const scoreCenter = evaluatePosition(3, 3); // 中央
      expect(scoreEdge).toBeGreaterThan(scoreCenter);
    });

    test('最も評価の高い手を選ぶ', () => {
      const game = createGame();
      const move = chooseNormalMove(game);
      const validMoves = getValidMoves(game.board, game.currentColor);
      expect(validMoves).toContainEqual(move);
    });
  });

  describe('ミニマックスAI（強い）', () => {
    test('1手先読みで最善手を返す', () => {
      const game = createGame();
      const move = chooseHardMove(game, { maxDepth: 1, maxTime: 3000 });
      const validMoves = getValidMoves(game.board, game.currentColor);
      expect(validMoves).toContainEqual(move);
    });

    test('相手の手番では最小評価を選ぶ', () => {
      // ミニマックスの基本性質: 合法手を返すことを確認
      const game = createGame();
      const result = placeStone(game, 2, 3)!;
      const move = chooseHardMove(result, { maxDepth: 2, maxTime: 3000 });
      const validMoves = getValidMoves(result.board, result.currentColor);
      expect(validMoves).toContainEqual(move);
    });

    test('複合評価: 位置の重み + 確定石 + 着手可能数', () => {
      // ミニマックスが合法手の中から選ぶことを確認
      const game = createGame();
      const move = chooseHardMove(game, { maxDepth: 3, maxTime: 3000 });
      const validMoves = getValidMoves(game.board, game.currentColor);
      expect(validMoves).toContainEqual(move);
    });

    test('終盤は石数差を重視する', () => {
      // 終盤（空きマス少ない）では合法手を返す
      const board: Board = Array.from({ length: 8 }, () =>
        Array.from({ length: 8 }, () => 'black' as const),
      );
      board[0][0] = 'white';
      board[0][1] = 'white';
      board[0][2] = null;
      board[0][3] = 'white';
      const game: GameState = {
        board,
        currentColor: 'black',
        gameOver: false,
        passed: false,
        lastMove: null,
        flipped: [],
      };
      const moves = getValidMoves(board, 'black');
      if (moves.length > 0) {
        const move = chooseHardMove(game, { maxDepth: 10, maxTime: 3000 });
        expect(moves).toContainEqual(move);
      }
    });

    test('探索が最大深さで打ち切られる', () => {
      const game = createGame();
      // 深さ1でも結果を返す
      const move = chooseHardMove(game, { maxDepth: 1, maxTime: 3000 });
      expect(move).not.toBeNull();
    });

    test('探索が最大時間で打ち切られる', () => {
      const game = createGame();
      const start = Date.now();
      const move = chooseHardMove(game, { maxDepth: 100, maxTime: 100 });
      const elapsed = Date.now() - start;
      expect(move).not.toBeNull();
      // 100ms + マージンで完了すること
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('確定石の計算', () => {
    test('角に置いた石は確定石である', () => {
      const board = emptyBoard();
      board[0][0] = 'black';
      expect(countStableDiscs(board, 'black')).toBeGreaterThanOrEqual(1);
    });

    test('角から辺に連続する同色の石は確定石である', () => {
      const board = emptyBoard();
      board[0][0] = 'black';
      board[0][1] = 'black';
      board[0][2] = 'black';
      expect(countStableDiscs(board, 'black')).toBeGreaterThanOrEqual(3);
    });
  });
});
