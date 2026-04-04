import { describe, test, expect, vi } from 'vitest';
import {
  initGame,
  slide,
  addRandomTile,
  checkWin,
  checkGameOver,
  moveAndAddTile,
  undo,
  redo,
  changeDifficulty,
} from './logic';
import type { Board, GameState } from './types';

describe('2048', () => {
  // === 初期化 ===
  describe('initGame', () => {
    test('4x4の空ボードにタイルが2つ配置される', () => {
      // Arrange & Act
      const state = initGame();

      // Assert
      expect(state.board).toHaveLength(4);
      for (const row of state.board) {
        expect(row).toHaveLength(4);
      }
      const nonZeroCells = state.board.flat().filter((cell: number) => cell !== 0);
      expect(nonZeroCells).toHaveLength(2);
    });

    test('初期タイルの値は2または4である', () => {
      // Arrange & Act
      const state = initGame();

      // Assert
      const nonZeroCells = state.board.flat().filter((cell: number) => cell !== 0);
      for (const value of nonZeroCells) {
        expect([2, 4]).toContain(value);
      }
    });

    test('初期スコアは0である', () => {
      expect(initGame().score).toBe(0);
    });

    test('初期状態はゲームオーバーでない', () => {
      expect(initGame().isGameOver).toBe(false);
    });

    test('初期状態は勝利でない', () => {
      expect(initGame().isWin).toBe(false);
    });

    test('デフォルト難���度はrandomである', () => {
      expect(initGame().difficulty).toBe('random');
    });

    test('履歴は空である', () => {
      const state = initGame();
      expect(state.history).toHaveLength(0);
      expect(state.future).toHaveLength(0);
    });
  });

  // === スライド ===
  describe('slide', () => {
    test('左スライドでタイルが左端に寄る', () => {
      // Arrange
      const board = [
        [0, 0, 0, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'left');

      // Assert
      expect(result.board[0]).toEqual([2, 0, 0, 0]);
      expect(result.moved).toBe(true);
    });

    test('右スライドでタイルが右端に寄る', () => {
      // Arrange
      const board = [
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'right');

      // Assert
      expect(result.board[0]).toEqual([0, 0, 0, 2]);
      expect(result.moved).toBe(true);
    });

    test('上スライドでタイルが上端に寄る', () => {
      // Arrange
      const board = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [2, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'up');

      // Assert
      expect(result.board[0][0]).toBe(2);
      expect(result.board[3][0]).toBe(0);
      expect(result.moved).toBe(true);
    });

    test('下スライドでタイルが下端に寄る', () => {
      // Arrange
      const board = [
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'down');

      // Assert
      expect(result.board[3][0]).toBe(2);
      expect(result.board[0][0]).toBe(0);
      expect(result.moved).toBe(true);
    });

    test('同じ数字のタイルが合体する（2+2=4）', () => {
      // Arrange
      const board = [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'left');

      // Assert
      expect(result.board[0]).toEqual([4, 0, 0, 0]);
    });

    test('合体時にスコアが加算される', () => {
      // Arrange
      const board = [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'left');

      // Assert
      expect(result.score).toBe(4);
    });

    test('1回のスライドで各タイルが合体できるのは1回まで', () => {
      // Arrange: [2,2,4,4] → 左スライド → [4,8,0,0]（2+2=4, 4+4=8、最初の4と合体した4は再合体しない）
      const board = [
        [2, 2, 4, 4],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'left');

      // Assert
      expect(result.board[0]).toEqual([4, 8, 0, 0]);
    });

    test('タイルが動かない方向にスライドするとmovedがfalse', () => {
      // Arrange: タイルが左端にあるので左スライドしても動かない
      const board = [
        [2, 0, 0, 0],
        [4, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'left');

      // Assert
      expect(result.moved).toBe(false);
    });

    test('空ボードをスライドするとmovedがfalse', () => {
      // Arrange
      const board = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'left');

      // Assert
      expect(result.moved).toBe(false);
    });

    test('合体したセルのmergedがtrueになる', () => {
      // Arrange
      const board: Board = [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'left');

      // Assert: (0,0)が合体した
      expect(result.merged[0][0]).toBe(true);
      expect(result.merged[0][1]).toBe(false);
    });

    test('連続する同じ数字は手前から合体する（左スライド時）', () => {
      // Arrange: [2,2,2,0] → 左スライド → [4,2,0,0]（左から順に合体）
      const board = [
        [2, 2, 2, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'left');

      // Assert
      expect(result.board[0]).toEqual([4, 2, 0, 0]);
    });
  });

  // === ランダムタイル配置 ===
  describe('addRandomTile', () => {
    test('空きマスにタイルが1つ追加される', () => {
      // Arrange
      const board: Board = [
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const newBoard = addRandomTile(board, 'random');

      // Assert
      const nonZeroCells = newBoard.flat().filter((c: number) => c !== 0);
      expect(nonZeroCells).toHaveLength(2);
    });

    test('Random: 90%が2、10%が4', () => {
      // Arrange
      const board: Board = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act & Assert: 0.89 < 0.9（値選択→2）→ 0.0（位置選択）
      const spy = vi.spyOn(Math, 'random').mockReturnValueOnce(0.89).mockReturnValueOnce(0.0);
      const board2 = addRandomTile(board, 'random');
      spy.mockRestore();
      expect(board2.flat().filter((c: number) => c !== 0)).toEqual([2]);

      // Act & Assert: 0.91 >= 0.9（値選択→4）→ 0.0（位置選択）
      const spy2 = vi.spyOn(Math, 'random').mockReturnValueOnce(0.91).mockReturnValueOnce(0.0);
      const board4 = addRandomTile(board, 'random');
      spy2.mockRestore();
      expect(board4.flat().filter((c: number) => c !== 0)).toEqual([4]);
    });

    test('Easy: 新タイルは100%が2', () => {
      // Arrange
      const board: Board = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act: 乱数が何であってもEasyなら必ず2
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.95);
      const newBoard = addRandomTile(board, 'easy');
      spy.mockRestore();

      // Assert
      const nonZero = newBoard.flat().filter((c: number) => c !== 0);
      expect(nonZero).toEqual([2]);
    });

    test('Easy: 隣接セルに同じ値のタイルがある空きマスを優先配置', () => {
      // Arrange: (0,0)=2、隣接する(0,1)や(1,0)が優先されるべき
      const board: Board = [
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.0);
      const newBoard = addRandomTile(board, 'easy');
      spy.mockRestore();

      // Assert: 隣接マス(0,1)か(1,0)に配置される
      const placed = newBoard[0][1] !== 0 || newBoard[1][0] !== 0;
      expect(placed).toBe(true);
    });

    test('Hard: 60%が2、40%が4', () => {
      // Arrange
      const board: Board = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act & Assert: 0.59 < 0.6（値選択→2）→ 0.0（位置選択）
      const spy = vi.spyOn(Math, 'random').mockReturnValueOnce(0.59).mockReturnValueOnce(0.0);
      const board2 = addRandomTile(board, 'hard');
      spy.mockRestore();
      expect(board2.flat().filter((c: number) => c !== 0)).toEqual([2]);

      // Act & Assert: 0.61 >= 0.6（値選択→4）→ 0.0（位置選択）
      const spy2 = vi.spyOn(Math, 'random').mockReturnValueOnce(0.61).mockReturnValueOnce(0.0);
      const board4 = addRandomTile(board, 'hard');
      spy2.mockRestore();
      expect(board4.flat().filter((c: number) => c !== 0)).toEqual([4]);
    });

    test('Hard: 動かせる方向が最も少なくなる位置に配置', () => {
      // Arrange: ほぼ埋まったボードで空きが2つ
      const board: Board = [
        [2, 4, 8, 16],
        [32, 64, 128, 256],
        [512, 1024, 0, 2],
        [4, 8, 16, 0],
      ];

      // Act
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.0);
      const newBoard = addRandomTile(board, 'hard');
      spy.mockRestore();

      // Assert: 空きマスの1つにタイルが配置される
      const emptyCells = newBoard.flat().filter((c: number) => c === 0);
      expect(emptyCells).toHaveLength(1);
    });

    test('満杯のボードにはタイルを追加しない', () => {
      // Arrange
      const board: Board = [
        [2, 4, 8, 16],
        [32, 64, 128, 256],
        [512, 1024, 2048, 4],
        [2, 8, 16, 32],
      ];

      // Act
      const newBoard = addRandomTile(board, 'random');

      // Assert
      expect(newBoard).toEqual(board);
    });
  });

  // === 勝敗判定 ===
  describe('checkWin / checkGameOver', () => {
    test('2048タイルがあれば勝利', () => {
      // Arrange
      const board: Board = [
        [2048, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act & Assert
      expect(checkWin(board)).toBe(true);
    });

    test('2048未満のタイルのみなら勝利でない', () => {
      // Arrange
      const board: Board = [
        [1024, 512, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act & Assert
      expect(checkWin(board)).toBe(false);
    });

    test('空きマスがあればゲームオーバーでない', () => {
      // Arrange
      const board: Board = [
        [2, 4, 8, 16],
        [32, 64, 128, 256],
        [512, 1024, 2, 4],
        [8, 16, 32, 0],
      ];

      // Act & Assert
      expect(checkGameOver(board)).toBe(false);
    });

    test('隣接する同じタイルがあればゲームオーバーでない', () => {
      // Arrange: 満杯だが(0,0)と(0,1)が同じ2
      const board: Board = [
        [2, 2, 8, 16],
        [32, 64, 128, 256],
        [512, 1024, 2, 4],
        [8, 16, 32, 64],
      ];

      // Act & Assert
      expect(checkGameOver(board)).toBe(false);
    });

    test('空きマスも隣接同値もなければゲームオーバー', () => {
      // Arrange: 満杯かつ隣接に同じ値なし
      const board: Board = [
        [2, 4, 8, 16],
        [32, 64, 128, 256],
        [2, 4, 8, 16],
        [32, 64, 128, 256],
      ];

      // Act & Assert
      expect(checkGameOver(board)).toBe(true);
    });
  });

  // === undo/redo ===
  describe('undo / redo', () => {
    test('undoで1手前の状態に戻る', () => {
      // Arrange: initGame → moveAndAddTileで1手進める
      const state = initGame();
      const moved = moveAndAddTile(state, 'left');

      // Act
      const undone = undo(moved);

      // Assert: ボードがmove前に戻る
      expect(undone.board).toEqual(state.board);
    });

    test('undoでスコアも戻る', () => {
      // Arrange: スコアが加算されるボードを用意
      const state: GameState = {
        board: [
          [2, 2, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 0,
        bestScore: 0,
        isGameOver: false,
        isWin: false,
        difficulty: 'random',
        history: [],
        future: [],
        lastMerged: null,
        lastNewTile: null,
      };
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.0);
      const moved = moveAndAddTile(state, 'left');
      spy.mockRestore();

      // Act
      const undone = undo(moved);

      // Assert
      expect(undone.score).toBe(0);
    });

    test('undo後にredoで元に戻る', () => {
      // Arrange
      const state = initGame();
      const moved = moveAndAddTile(state, 'left');
      const undone = undo(moved);

      // Act
      const redone = redo(undone);

      // Assert
      expect(redone.board).toEqual(moved.board);
      expect(redone.score).toEqual(moved.score);
    });

    test('履歴がないときundoしても変化しない', () => {
      // Arrange
      const state = initGame();

      // Act
      const undone = undo(state);

      // Assert
      expect(undone).toEqual(state);
    });

    test('未来がないときredoしても変化しない', () => {
      // Arrange
      const state = initGame();

      // Act
      const redone = redo(state);

      // Assert
      expect(redone).toEqual(state);
    });

    test('スライド後にfutureがクリアされる', () => {
      // Arrange: undo後にfutureがある状態
      const state = initGame();
      const moved1 = moveAndAddTile(state, 'left');
      const undone = undo(moved1);
      expect(undone.future).toHaveLength(1);

      // Act: 新しいスライドをする
      const moved2 = moveAndAddTile(undone, 'right');

      // Assert: futureがクリアされる
      expect(moved2.future).toHaveLength(0);
    });
  });

  // === 難易度変更 ===
  describe('changeDifficulty', () => {
    test('難易度を変更できる', () => {
      // Arrange
      const state = initGame();

      // Act
      const changed = changeDifficulty(state, 'hard');

      // Assert
      expect(changed.difficulty).toBe('hard');
    });

    test('難易度変更後もボードはそのまま継続', () => {
      // Arrange
      const state = initGame();
      const boardBefore = state.board.map((row) => [...row]);

      // Act
      const changed = changeDifficulty(state, 'easy');

      // Assert
      expect(changed.board).toEqual(boardBefore);
      expect(changed.score).toBe(state.score);
    });
  });
});
