import { describe, expect, test } from 'vitest';
import { createGame, opponent, placeStone, setForbiddenRule, getForbiddenMoves } from './logic';
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

describe('五目並べ ロジック', () => {
  describe('盤面の初期化', () => {
    test('15x15の空の盤面が作成される', () => {
      const game = createGame();
      expect(game.board).toHaveLength(BOARD_SIZE);
      for (const row of game.board) {
        expect(row).toHaveLength(BOARD_SIZE);
        for (const cell of row) {
          expect(cell).toBeNull();
        }
      }
    });

    test('初期状態のターンは黒である', () => {
      const game = createGame();
      expect(game.currentColor).toBe('black');
    });

    test('初期状態はゲームオーバーではない', () => {
      const game = createGame();
      expect(game.gameOver).toBe(false);
      expect(game.winner).toBeNull();
    });

    test('初期状態の禁じ手ルールは無効である', () => {
      const game = createGame();
      expect(game.forbiddenRule).toBe(false);
    });
  });

  describe('石を置く', () => {
    test('空のマスに石を置ける', () => {
      const game = createGame();
      const result = placeStone(game, 7, 7);
      expect(result).not.toBeNull();
      expect(result!.board[7][7]).toBe('black');
    });

    test('石を置くとターンが切り替わる', () => {
      const game = createGame();
      const result = placeStone(game, 7, 7);
      expect(result!.currentColor).toBe('white');
    });

    test('既に石があるマスには置けない', () => {
      const game = createGame();
      const after = placeStone(game, 7, 7)!;
      const result = placeStone(after, 7, 7);
      expect(result).toBeNull();
    });

    test('盤面外の座標には置けない', () => {
      const game = createGame();
      expect(placeStone(game, -1, 0)).toBeNull();
      expect(placeStone(game, 0, -1)).toBeNull();
      expect(placeStone(game, BOARD_SIZE, 0)).toBeNull();
      expect(placeStone(game, 0, BOARD_SIZE)).toBeNull();
    });

    test('ゲームオーバー後は石を置けない', () => {
      const game = createGame();
      const finished = { ...game, gameOver: true, winner: 'black' as const };
      expect(placeStone(finished, 7, 7)).toBeNull();
    });

    test('直前の手が記録される', () => {
      const game = createGame();
      const result = placeStone(game, 3, 5);
      expect(result!.lastMove).toEqual([3, 5]);
    });
  });

  describe('勝利判定', () => {
    test('横方向に5つ並ぶと勝ち', () => {
      const board = emptyBoard();
      // 黒が(7,3)〜(7,6)に4つ置いてある状態で(7,7)に置く
      for (let c = 3; c <= 6; c++) board[7][c] = 'black';
      const game = makeGame({ board, currentColor: 'black' });
      const result = placeStone(game, 7, 7);
      expect(result!.gameOver).toBe(true);
      expect(result!.winner).toBe('black');
    });

    test('縦方向に5つ並ぶと勝ち', () => {
      const board = emptyBoard();
      for (let r = 0; r <= 3; r++) board[r][5] = 'white';
      const game = makeGame({ board, currentColor: 'white' });
      const result = placeStone(game, 4, 5);
      expect(result!.gameOver).toBe(true);
      expect(result!.winner).toBe('white');
    });

    test('右下がり斜めに5つ並ぶと勝ち', () => {
      const board = emptyBoard();
      for (let i = 0; i <= 3; i++) board[i][i] = 'black';
      const game = makeGame({ board, currentColor: 'black' });
      const result = placeStone(game, 4, 4);
      expect(result!.gameOver).toBe(true);
      expect(result!.winner).toBe('black');
    });

    test('左下がり斜めに5つ並ぶと勝ち', () => {
      const board = emptyBoard();
      for (let i = 0; i <= 3; i++) board[i][14 - i] = 'black';
      const game = makeGame({ board, currentColor: 'black' });
      const result = placeStone(game, 4, 10);
      expect(result!.gameOver).toBe(true);
      expect(result!.winner).toBe('black');
    });

    test('6つ以上並んでも勝ち（禁じ手なしの場合）', () => {
      const board = emptyBoard();
      for (let c = 0; c <= 4; c++) board[0][c] = 'black';
      const game = makeGame({ board, currentColor: 'black' });
      const result = placeStone(game, 0, 5);
      expect(result!.gameOver).toBe(true);
      expect(result!.winner).toBe('black');
    });

    test('4つ以下では勝ちにならない', () => {
      const board = emptyBoard();
      for (let c = 0; c <= 2; c++) board[0][c] = 'black';
      const game = makeGame({ board, currentColor: 'black' });
      const result = placeStone(game, 0, 3);
      expect(result!.gameOver).toBe(false);
      expect(result!.winner).toBeNull();
    });

    test('異なる色が混ざっている場合は勝ちにならない', () => {
      const board = emptyBoard();
      board[0][0] = 'black';
      board[0][1] = 'black';
      board[0][2] = 'white'; // 割り込み
      board[0][3] = 'black';
      board[0][4] = 'black';
      const game = makeGame({ board, currentColor: 'black' });
      const result = placeStone(game, 0, 5);
      expect(result!.gameOver).toBe(false);
    });
  });

  describe('引き分け', () => {
    test('盤面が全て埋まり5連がなければ引き分け', () => {
      // 横4マスごと・縦は行ごとにオフセットして5連を防ぐ
      // パターン: BBBBWWWWBBBBWWW（4つずつ交互、行ごとに2マスずらし）
      const board = emptyBoard();
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (r === BOARD_SIZE - 1 && c === BOARD_SIZE - 1) continue;
          const shifted = (c + r * 2) % 8;
          board[r][c] = shifted < 4 ? 'black' : 'white';
        }
      }
      // (14,14): shifted = (14 + 14*2) % 8 = 42 % 8 = 2 < 4 → black
      const game = makeGame({ board, currentColor: 'black' });
      const result = placeStone(game, BOARD_SIZE - 1, BOARD_SIZE - 1);
      expect(result!.gameOver).toBe(true);
      expect(result!.winner).toBeNull();
    });
  });

  describe('禁じ手ルール', () => {
    test('禁じ手ルールを途中で有効/無効に切り替えられる', () => {
      const game = createGame();
      expect(game.forbiddenRule).toBe(false);
      const enabled = setForbiddenRule(game, true);
      expect(enabled.forbiddenRule).toBe(true);
      const disabled = setForbiddenRule(enabled, false);
      expect(disabled.forbiddenRule).toBe(false);
    });

    describe('長連禁', () => {
      test('禁じ手あり: 黒が6つ以上並べても勝ちにならない', () => {
        const board = emptyBoard();
        for (let c = 0; c <= 4; c++) board[0][c] = 'black';
        const game = makeGame({ board, currentColor: 'black', forbiddenRule: true });
        const result = placeStone(game, 0, 5);
        // 6連は勝ちにならない（禁じ手あり）
        expect(result!.gameOver).toBe(false);
        expect(result!.winner).toBeNull();
      });

      test('禁じ手あり: 白が6つ以上並べた場合は勝ちになる', () => {
        const board = emptyBoard();
        for (let c = 0; c <= 4; c++) board[0][c] = 'white';
        const game = makeGame({ board, currentColor: 'white', forbiddenRule: true });
        const result = placeStone(game, 0, 5);
        expect(result!.gameOver).toBe(true);
        expect(result!.winner).toBe('white');
      });

      test('禁じ手あり: 黒はちょうど5つで勝ち', () => {
        const board = emptyBoard();
        for (let c = 0; c <= 3; c++) board[0][c] = 'black';
        const game = makeGame({ board, currentColor: 'black', forbiddenRule: true });
        const result = placeStone(game, 0, 4);
        expect(result!.gameOver).toBe(true);
        expect(result!.winner).toBe('black');
      });
    });

    describe('三三禁', () => {
      test('禁じ手あり: 黒が活三を2つ同時に作る手は置けない', () => {
        // 横方向: (7,6),(7,8) に黒 → (7,7)に置くと活三（両端空き）
        // 縦方向: (6,7),(8,7) に黒 → (7,7)に置くと活三（両端空き）
        const board = emptyBoard();
        board[7][6] = 'black';
        board[7][8] = 'black';
        board[6][7] = 'black';
        board[8][7] = 'black';
        const game = makeGame({ board, currentColor: 'black', forbiddenRule: true });
        const result = placeStone(game, 7, 7);
        expect(result).toBeNull(); // 禁じ手で置けない
      });

      test('禁じ手あり: 白には三三禁は適用されない', () => {
        const board = emptyBoard();
        board[7][6] = 'white';
        board[7][8] = 'white';
        board[6][7] = 'white';
        board[8][7] = 'white';
        const game = makeGame({ board, currentColor: 'white', forbiddenRule: true });
        const result = placeStone(game, 7, 7);
        expect(result).not.toBeNull();
      });
    });

    describe('四四禁', () => {
      test('禁じ手あり: 黒が四を2つ同時に作る手は置けない', () => {
        // 横方向: (7,4),(7,5),(7,6) に黒 → (7,7)に置くと四
        // 縦方向: (4,7),(5,7),(6,7) に黒 → (7,7)に置くと四
        const board = emptyBoard();
        board[7][4] = 'black';
        board[7][5] = 'black';
        board[7][6] = 'black';
        board[4][7] = 'black';
        board[5][7] = 'black';
        board[6][7] = 'black';
        const game = makeGame({ board, currentColor: 'black', forbiddenRule: true });
        const result = placeStone(game, 7, 7);
        expect(result).toBeNull(); // 禁じ手で置けない
      });

      test('禁じ手あり: 白には四四禁は適用されない', () => {
        const board = emptyBoard();
        board[7][4] = 'white';
        board[7][5] = 'white';
        board[7][6] = 'white';
        board[4][7] = 'white';
        board[5][7] = 'white';
        board[6][7] = 'white';
        const game = makeGame({ board, currentColor: 'white', forbiddenRule: true });
        const result = placeStone(game, 7, 7);
        expect(result).not.toBeNull();
      });
    });

    describe('禁じ手の判定', () => {
      test('禁じ手の位置リストを取得できる', () => {
        const board = emptyBoard();
        board[7][6] = 'black';
        board[7][8] = 'black';
        board[6][7] = 'black';
        board[8][7] = 'black';
        const game = makeGame({ board, currentColor: 'black', forbiddenRule: true });
        const forbidden = getForbiddenMoves(game);
        expect(forbidden).toContainEqual([7, 7]);
      });

      test('禁じ手ルール無効時は禁じ手リストが空', () => {
        const board = emptyBoard();
        board[7][6] = 'black';
        board[7][8] = 'black';
        board[6][7] = 'black';
        board[8][7] = 'black';
        const game = makeGame({ board, currentColor: 'black', forbiddenRule: false });
        const forbidden = getForbiddenMoves(game);
        expect(forbidden).toHaveLength(0);
      });
    });
  });

  describe('ユーティリティ', () => {
    test('相手の色を返す', () => {
      expect(opponent('black')).toBe('white');
      expect(opponent('white')).toBe('black');
    });
  });
});
