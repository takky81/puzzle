import { describe, expect, test } from 'vitest';
import { createGame, opponent, getValidMoves, placeStone, getScore, getWinner } from './logic';
import type { Board, GameState } from './types';

describe('オセロ ロジック', () => {
  describe('盤面の初期化', () => {
    test('8x8の盤面が作成される', () => {
      const game = createGame();
      expect(game.board).toHaveLength(8);
      game.board.forEach((row) => {
        expect(row).toHaveLength(8);
      });
    });
    test('初期配置は中央に黒2白2である', () => {
      const game = createGame();
      expect(game.board[3][3]).toBe('white');
      expect(game.board[3][4]).toBe('black');
      expect(game.board[4][3]).toBe('black');
      expect(game.board[4][4]).toBe('white');
    });

    test('初期状態のターンは黒である', () => {
      const game = createGame();
      expect(game.currentColor).toBe('black');
    });

    test('初期状態はゲーム終了ではない', () => {
      const game = createGame();
      expect(game.gameOver).toBe(false);
    });

    test('初期状態でパスではない', () => {
      const game = createGame();
      expect(game.passed).toBe(false);
    });

    test('初期状態で最後の手はnullである', () => {
      const game = createGame();
      expect(game.lastMove).toBeNull();
    });
  });

  describe('合法手の判定', () => {
    test('初期盤面で黒の合法手は4箇所ある', () => {
      const game = createGame();
      const moves = getValidMoves(game.board, 'black');
      expect(moves).toHaveLength(4);
    });

    test('石を挟める位置のみが合法手である', () => {
      const game = createGame();
      const moves = getValidMoves(game.board, 'black');
      const expected: [number, number][] = [
        [2, 3],
        [3, 2],
        [4, 5],
        [5, 4],
      ];
      expected.forEach(([r, c]) => {
        expect(moves).toContainEqual([r, c]);
      });
    });

    test('縦方向に挟める位置が合法手になる', () => {
      const game = createGame();
      // 黒(4,3)の上に白(3,3)がある → (2,3)に黒を置ける（縦方向）
      const moves = getValidMoves(game.board, 'black');
      expect(moves).toContainEqual([2, 3]);
    });

    test('横方向に挟める位置が合法手になる', () => {
      const game = createGame();
      // 黒(4,3)の左に白(3,3)... → (3,2)に黒を置ける（横方向）
      const moves = getValidMoves(game.board, 'black');
      expect(moves).toContainEqual([3, 2]);
    });

    test('斜め方向に挟める位置が合法手になる', () => {
      // カスタム盤面: 斜め方向のみで挟める配置
      const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
      board[3][3] = 'black';
      board[4][4] = 'white';
      // (5,5)に黒を置くと斜めで白(4,4)を挟める
      const moves = getValidMoves(board, 'black');
      expect(moves).toContainEqual([5, 5]);
    });

    test('相手の石がない方向は合法手にならない', () => {
      const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
      board[3][3] = 'black';
      // 隣に相手の石がない → (3,4)は合法手でない
      const moves = getValidMoves(board, 'black');
      expect(moves).not.toContainEqual([3, 4]);
    });

    test('自分の石で終わらない方向は合法手にならない', () => {
      const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
      board[3][3] = 'white';
      board[3][4] = 'white';
      // (3,2)に黒を置いても、白白で自分の石がないので挟めない
      const moves = getValidMoves(board, 'black');
      expect(moves).not.toContainEqual([3, 2]);
    });

    test('盤面の端を超える方向は合法手にならない', () => {
      const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
      board[0][0] = 'white';
      // (0,1)に黒を置こうとしても、左方向に自分の石がないので挟めない
      // 端を超える方向はエラーにならず合法手にならない
      const moves = getValidMoves(board, 'black');
      expect(moves).not.toContainEqual([0, 1]);
    });

    test('すでに石がある場所は合法手にならない', () => {
      const game = createGame();
      const moves = getValidMoves(game.board, 'black');
      // 中央の4マスは既に石がある
      expect(moves).not.toContainEqual([3, 3]);
      expect(moves).not.toContainEqual([3, 4]);
      expect(moves).not.toContainEqual([4, 3]);
      expect(moves).not.toContainEqual([4, 4]);
    });
  });

  describe('石の配置と裏返し', () => {
    test('石を置くと盤面に反映される', () => {
      const game = createGame();
      const result = placeStone(game, 2, 3);
      expect(result!.board[2][3]).toBe('black');
    });

    test('挟まれた相手の石が裏返る', () => {
      const game = createGame();
      // 黒が(2,3)に置く → 白(3,3)が裏返る
      const result = placeStone(game, 2, 3);
      expect(result!.board[3][3]).toBe('black');
    });

    test('複数方向の石が同時に裏返る', () => {
      // 黒が複数方向で白を挟む配置
      const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
      board[2][4] = 'black';
      board[3][4] = 'white';
      board[4][3] = 'white';
      board[4][5] = 'white';
      board[4][2] = 'black';
      board[4][6] = 'black';
      // (4,4)に黒を置くと、上方向(3,4)と左方向(4,3)と右方向(4,5)が裏返る
      const game: GameState = {
        board,
        currentColor: 'black',
        gameOver: false,
        passed: false,
        lastMove: null,
        flipped: [],
      };
      const result = placeStone(game, 4, 4);
      expect(result!.board[3][4]).toBe('black');
      expect(result!.board[4][3]).toBe('black');
      expect(result!.board[4][5]).toBe('black');
    });

    test('複数個の石が連続して裏返る', () => {
      const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
      board[0][0] = 'black';
      board[1][0] = 'white';
      board[2][0] = 'white';
      board[3][0] = 'white';
      // (4,0)に黒を置くと、白3個が連続して裏返る
      const game: GameState = {
        board,
        currentColor: 'black',
        gameOver: false,
        passed: false,
        lastMove: null,
        flipped: [],
      };
      const result = placeStone(game, 4, 0);
      expect(result!.board[1][0]).toBe('black');
      expect(result!.board[2][0]).toBe('black');
      expect(result!.board[3][0]).toBe('black');
    });

    test('裏返った石の位置リストが返される', () => {
      const game = createGame();
      const result = placeStone(game, 2, 3);
      expect(result!.flipped).toContainEqual([3, 3]);
      expect(result!.flipped).toHaveLength(1);
    });

    test('合法手でない位置には石を置けない', () => {
      const game = createGame();
      const result = placeStone(game, 0, 0);
      expect(result).toBeNull();
    });
  });

  describe('ターン管理', () => {
    test('石を置くとターンが相手に切り替わる', () => {
      const game = createGame();
      const result = placeStone(game, 2, 3);
      expect(result!.currentColor).toBe('white');
    });

    test('黒の次は白、白の次は黒である', () => {
      const game = createGame();
      const after1 = placeStone(game, 2, 3)!;
      expect(after1.currentColor).toBe('white');
      const after2 = placeStone(after1, 2, 2)!;
      expect(after2.currentColor).toBe('black');
    });
  });

  describe('パス判定', () => {
    function createPassBoard(): Board {
      // 行0: [空, 白, 黒, 白, 空, ...]  行1: [黒, ...]
      // 黒が(0,0)に置く → (0,1)裏返る → [黒,黒,黒,白,空,...]
      // 白は合法手なし、黒は(0,4)に置ける → パス
      const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
      board[0][1] = 'white';
      board[0][2] = 'black';
      board[0][3] = 'white';
      board[1][0] = 'black';
      return board;
    }

    test('合法手がない場合はパスになる', () => {
      const game: GameState = {
        board: createPassBoard(),
        currentColor: 'black',
        gameOver: false,
        passed: false,
        lastMove: null,
        flipped: [],
      };
      const result = placeStone(game, 0, 0);
      expect(result!.passed).toBe(true);
    });

    test('パス後はターンが元のプレイヤーに戻る', () => {
      const game: GameState = {
        board: createPassBoard(),
        currentColor: 'black',
        gameOver: false,
        passed: false,
        lastMove: null,
        flipped: [],
      };
      const result = placeStone(game, 0, 0);
      expect(result!.currentColor).toBe('black');
    });
  });

  describe('ゲーム終了判定', () => {
    test('両者とも合法手がない場合はゲーム終了', () => {
      // 全部埋まった盤面 → 両者合法手なし
      const board: Board = Array.from({ length: 8 }, () =>
        Array.from({ length: 8 }, () => 'black' as const),
      );
      board[0][0] = 'white';
      expect(getValidMoves(board, 'black')).toHaveLength(0);
      expect(getValidMoves(board, 'white')).toHaveLength(0);
    });

    test('盤面が全て埋まったらゲーム終了', () => {
      const board: Board = Array.from({ length: 8 }, () =>
        Array.from({ length: 8 }, () => 'black' as const),
      );
      // 1箇所だけ白にして、最後に石を置いたら全部埋まる
      board[7][7] = 'white';
      board[7][6] = 'white';
      expect(getValidMoves(board, 'black')).toHaveLength(0);
      expect(getValidMoves(board, 'white')).toHaveLength(0);
    });

    test('片方だけ合法手がある場合は終了しない', () => {
      const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
      board[0][0] = 'black';
      board[0][1] = 'white';
      // 黒は(0,2)に置ける、白は置けない → 終了しない
      const blackMoves = getValidMoves(board, 'black');
      expect(blackMoves.length).toBeGreaterThan(0);
    });
  });

  describe('スコア計算', () => {
    test('黒と白それぞれの石の数を返す', () => {
      const game = createGame();
      const score = getScore(game.board);
      expect(score).toEqual({ black: 2, white: 2 });
    });

    test('初期盤面は黒2白2である', () => {
      const game = createGame();
      const score = getScore(game.board);
      expect(score.black).toBe(2);
      expect(score.white).toBe(2);
    });

    test('石の多い方が勝者である', () => {
      const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
      board[0][0] = 'black';
      board[0][1] = 'black';
      board[0][2] = 'white';
      expect(getWinner(board)).toBe('black');
    });

    test('同数の場合は引き分けである', () => {
      const game = createGame();
      expect(getWinner(game.board)).toBeNull();
    });
  });

  describe('opponent関数', () => {
    test('blackの相手はwhiteである', () => {
      expect(opponent('black')).toBe('white');
    });

    test('whiteの相手はblackである', () => {
      expect(opponent('white')).toBe('black');
    });
  });
});
