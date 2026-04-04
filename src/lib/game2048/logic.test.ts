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

    test('Easy: 隣接に同じ値がない場合はランダム配置にフォールバック', () => {
      // Arrange: 値2のタイルがないので隣接優先候補なし→全空きマスからランダム
      const board: Board = [
        [4, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.0);
      const newBoard = addRandomTile(board, 'easy');
      spy.mockRestore();

      // Assert: タイルが1つ追加される（どこかの空きマスに配置）
      const nonZero = newBoard.flat().filter((c: number) => c !== 0);
      expect(nonZero).toHaveLength(2);
      // 追加されたのは2
      expect(nonZero).toContain(2);
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

    test('縦に隣接する同じタイルがあればゲームオーバーでない', () => {
      // Arrange: 満杯だが(0,0)と(1,0)が同じ2（縦に隣接）
      const board: Board = [
        [2, 4, 8, 16],
        [2, 64, 128, 256],
        [512, 1024, 4, 8],
        [32, 16, 64, 128],
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

    test('undo/redoを複数回連続で実行できる（無制限）', () => {
      // Arrange: 3手進める
      const state = initGame();
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const moved1 = moveAndAddTile(state, 'left');
      const moved2 = moveAndAddTile(moved1, 'right');
      const moved3 = moveAndAddTile(moved2, 'up');
      spy.mockRestore();

      // Act: 3回undo
      const undo1 = undo(moved3);
      const undo2 = undo(undo1);
      const undo3 = undo(undo2);

      // Assert: 初期状態に戻る
      expect(undo3.board).toEqual(state.board);
      expect(undo3.score).toBe(state.score);
      expect(undo3.history).toHaveLength(0);

      // Act: 3回redo
      const redo1 = redo(undo3);
      const redo2 = redo(redo1);
      const redo3 = redo(redo2);

      // Assert: 3手目の状態に戻る
      expect(redo3.board).toEqual(moved3.board);
      expect(redo3.score).toEqual(moved3.score);
    });

    test('スライド後にfutureがクリアされる', () => {
      // Arrange: 確実に動くボードでundo後にfutureがある状態
      const state: GameState = {
        board: [
          [0, 0, 0, 2],
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
      const moved1 = moveAndAddTile(state, 'left');
      const undone = undo(moved1);
      expect(undone.future).toHaveLength(1);

      // Act: 新しいスライドをする（undone後のボードは右端にタイルがあるので左スライドで動く）
      const moved2 = moveAndAddTile(undone, 'left');

      // Assert: futureがクリアされる
      expect(moved2.future).toHaveLength(0);
    });
  });

  // === moveAndAddTile ===
  describe('moveAndAddTile', () => {
    test('動かない方向にスライドすると状態が変わらない', () => {
      // Arrange: タイルが左端にあるので左スライドしても動かない
      const state: GameState = {
        board: [
          [2, 0, 0, 0],
          [4, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 10,
        bestScore: 10,
        isGameOver: false,
        isWin: false,
        difficulty: 'random',
        history: [],
        future: [],
        lastMerged: null,
        lastNewTile: null,
      };

      // Act
      const result = moveAndAddTile(state, 'left');

      // Assert: 同じ参照が返る
      expect(result).toBe(state);
    });

    test('スライド後に新タイルが1つ追加される', () => {
      // Arrange
      const state: GameState = {
        board: [
          [0, 0, 0, 2],
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

      // Act
      const result = moveAndAddTile(state, 'left');

      // Assert: 元が1タイル、スライド後に1つ追加で計2タイル
      const nonZero = result.board.flat().filter((c: number) => c !== 0);
      expect(nonZero).toHaveLength(2);
    });

    test('isGameOverフラグがゲームオーバー時にtrueになる', () => {
      // Arrange: ほぼ満杯で隣接同値なし、右スライドで(3,0)が空く→新タイル2で埋まる
      const state: GameState = {
        board: [
          [2, 4, 8, 16],
          [32, 64, 128, 256],
          [512, 1024, 2, 4],
          [8, 16, 32, 0],
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

      // Act: 右スライドで row3=[0,8,16,32]、新タイル2が(3,0)に配置
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.0);
      const result = moveAndAddTile(state, 'right');
      spy.mockRestore();

      // Assert: 全マス埋まり、隣接同値なし → gameOver
      expect(result.isGameOver).toBe(true);
    });

    test('isWinフラグが2048達成時にtrueになる', () => {
      // Arrange: 1024+1024=2048で勝利
      const state: GameState = {
        board: [
          [1024, 1024, 0, 0],
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

      // Act
      const result = moveAndAddTile(state, 'left');

      // Assert
      expect(result.isWin).toBe(true);
    });

    test('2048達成後も続行可能（isGameOverでなければスライドできる）', () => {
      // Arrange: 2048達成済みだがまだスライドできる
      const state: GameState = {
        board: [
          [2048, 2, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 2048,
        bestScore: 2048,
        isGameOver: false,
        isWin: true,
        difficulty: 'random',
        history: [],
        future: [],
        lastMerged: null,
        lastNewTile: null,
      };

      // Act: 右スライドで2が右に移動
      const result = moveAndAddTile(state, 'right');

      // Assert: ボードが変化する（続行できている）
      expect(result.board).not.toEqual(state.board);
    });

    test('bestScoreは低いスコアでは下がらない', () => {
      // Arrange: bestScoreが100の状態でスコア0からスライド
      const state: GameState = {
        board: [
          [0, 0, 0, 2],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 0,
        bestScore: 100,
        isGameOver: false,
        isWin: false,
        difficulty: 'random',
        history: [],
        future: [],
        lastMerged: null,
        lastNewTile: null,
      };

      // Act: 合体なしのスライド（スコア加算0）
      const result = moveAndAddTile(state, 'left');

      // Assert: bestScoreは100のまま下がらない
      expect(result.bestScore).toBe(100);
    });

    test('bestScoreがスコア超過時に更新される', () => {
      // Arrange
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

      // Act: 2+2=4でスコア4
      const result = moveAndAddTile(state, 'left');

      // Assert
      expect(result.score).toBe(4);
      expect(result.bestScore).toBe(4);
    });

    test('historyに前の状態が記録される', () => {
      // Arrange
      const state: GameState = {
        board: [
          [0, 0, 0, 2],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 10,
        bestScore: 10,
        isGameOver: false,
        isWin: false,
        difficulty: 'random',
        history: [],
        future: [],
        lastMerged: null,
        lastNewTile: null,
      };

      // Act
      const result = moveAndAddTile(state, 'left');

      // Assert
      expect(result.history).toHaveLength(1);
      expect(result.history[0].board).toEqual(state.board);
      expect(result.history[0].score).toBe(10);
    });

    test('futureがクリアされる', () => {
      // Arrange: futureに何かある状態
      const state: GameState = {
        board: [
          [0, 0, 0, 2],
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
        future: [
          {
            board: [
              [1, 1, 1, 1],
              [1, 1, 1, 1],
              [1, 1, 1, 1],
              [1, 1, 1, 1],
            ],
            score: 99,
          },
        ],
        lastMerged: null,
        lastNewTile: null,
      };

      // Act
      const result = moveAndAddTile(state, 'left');

      // Assert
      expect(result.future).toHaveLength(0);
    });

    test('lastMergedが記録される', () => {
      // Arrange: 合体が起きるボード
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

      // Act
      const result = moveAndAddTile(state, 'left');

      // Assert: (0,0)が合体
      expect(result.lastMerged).not.toBeNull();
      expect(result.lastMerged![0][0]).toBe(true);
    });

    test('ゲームオーバー後にスライドしても状態が変わらない', () => {
      // Arrange: ゲームオーバー状態（満杯・隣接同値なし）
      const state: GameState = {
        board: [
          [2, 4, 8, 16],
          [32, 64, 128, 256],
          [2, 4, 8, 16],
          [32, 64, 128, 256],
        ],
        score: 100,
        bestScore: 100,
        isGameOver: true,
        isWin: false,
        difficulty: 'random',
        history: [],
        future: [],
        lastMerged: null,
        lastNewTile: null,
      };

      // Act: どの方向にスライドしても変わらない
      const resultL = moveAndAddTile(state, 'left');
      const resultR = moveAndAddTile(state, 'right');
      const resultU = moveAndAddTile(state, 'up');
      const resultD = moveAndAddTile(state, 'down');

      // Assert: 全て同じ参照（状態が変わっていない）
      expect(resultL).toBe(state);
      expect(resultR).toBe(state);
      expect(resultU).toBe(state);
      expect(resultD).toBe(state);
    });

    test('moveAndAddTileは元のGameStateを変更しない（イミュータビリティ）', () => {
      // Arrange
      const state: GameState = {
        board: [
          [0, 0, 0, 2],
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
      const stateCopy = JSON.stringify(state);

      // Act
      moveAndAddTile(state, 'left');

      // Assert: 元のstateが変更されていない
      expect(JSON.stringify(state)).toBe(stateCopy);
    });

    test('lastNewTileが記録される', () => {
      // Arrange
      const state: GameState = {
        board: [
          [0, 0, 0, 2],
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

      // Act
      const result = moveAndAddTile(state, 'left');

      // Assert: 新タイルの位置が記録されている
      expect(result.lastNewTile).not.toBeNull();
      const [r, c] = result.lastNewTile!;
      expect(result.board[r][c]).toBeGreaterThan(0);
    });
  });

  // === slide追加テスト ===
  describe('slide（追加仕様）', () => {
    test('下スライドで同じタイルが合体する', () => {
      // Arrange
      const board: Board = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [2, 0, 0, 0],
        [2, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'down');

      // Assert: (3,0)に4、(2,0)は0
      expect(result.board[3][0]).toBe(4);
      expect(result.board[2][0]).toBe(0);
      expect(result.score).toBe(4);
    });

    test('複数行が同時にスライド・合体する', () => {
      // Arrange: 複数行にタイルがあり、それぞれ独立に合体する
      const board: Board = [
        [2, 2, 0, 0],
        [4, 4, 0, 0],
        [8, 0, 8, 0],
        [0, 0, 0, 16],
      ];

      // Act
      const result = slide(board, 'left');

      // Assert: 各行が独立に処理される
      expect(result.board[0]).toEqual([4, 0, 0, 0]);
      expect(result.board[1]).toEqual([8, 0, 0, 0]);
      expect(result.board[2]).toEqual([16, 0, 0, 0]);
      expect(result.board[3]).toEqual([16, 0, 0, 0]);
      // スコア: 4+8+16=28
      expect(result.score).toBe(28);
    });

    test('addRandomTileは元のボードを変更しない（イミュータビリティ）', () => {
      // Arrange
      const board: Board = [
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
      const boardCopy = JSON.stringify(board);

      // Act
      addRandomTile(board, 'random');

      // Assert
      expect(JSON.stringify(board)).toBe(boardCopy);
    });

    test('上スライドで同じタイルが合体する', () => {
      // Arrange
      const board: Board = [
        [2, 0, 0, 0],
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'up');

      // Assert: (0,0)に4、(1,0)は0
      expect(result.board[0][0]).toBe(4);
      expect(result.board[1][0]).toBe(0);
      expect(result.score).toBe(4);
    });

    test('右スライドで連続する同じ数字は奥から合体する', () => {
      // Arrange: [0,2,2,2] → 右スライド → [0,0,2,4]（右から順に合体）
      const board: Board = [
        [0, 2, 2, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'right');

      // Assert
      expect(result.board[0]).toEqual([0, 0, 2, 4]);
    });

    test('4つ同じ数字のスライドで2組に合体する', () => {
      // Arrange: [4,4,4,4] → 左スライド → [8,8,0,0]
      const board: Board = [
        [4, 4, 4, 4],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'left');

      // Assert
      expect(result.board[0]).toEqual([8, 8, 0, 0]);
      expect(result.score).toBe(16);
    });

    test('複数の合体でスコアが正しく加算される（2+2と4+4で合計12）', () => {
      // Arrange
      const board: Board = [
        [2, 2, 4, 4],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'left');

      // Assert: 2+2=4(score+4) + 4+4=8(score+8) = 12
      expect(result.score).toBe(12);
    });

    test('大きい数の合体（4+4=8）', () => {
      // Arrange
      const board: Board = [
        [4, 4, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      // Act
      const result = slide(board, 'left');

      // Assert
      expect(result.board[0]).toEqual([8, 0, 0, 0]);
      expect(result.score).toBe(8);
    });

    test('slideは元のボードを変更しない（イミュータビリティ）', () => {
      // Arrange
      const board: Board = [
        [0, 0, 0, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
      const boardCopy = JSON.stringify(board);

      // Act
      slide(board, 'left');

      // Assert
      expect(JSON.stringify(board)).toBe(boardCopy);
    });
  });

  // === Hard難易度の追加仕様 ===
  describe('Hard難易度（追加仕様）', () => {
    test('マージできない位置と値を優先する', () => {
      // Arrange: 空き2つ(0,1)と(0,2)。criteria#1（動かせる方向数）は両方3で同じ。
      // (0,1)に2→隣(0,0)=2でマージ可能（bad）, (0,2)に2→隣に2なし（good）
      const board: Board = [
        [2, 0, 0, 4],
        [8, 16, 32, 64],
        [128, 256, 512, 1024],
        [2, 4, 8, 16],
      ];

      // random=0.0 → value=2, criteria#1タイ → criteria#2で(0,2)が選ばれるべき
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.0);
      const newBoard = addRandomTile(board, 'hard');
      spy.mockRestore();

      expect(newBoard[0][2]).toBe(2);
      expect(newBoard[0][1]).toBe(0);
    });

    test('空きマスの先の隣接タイルを参照して合計値を計算する', () => {
      // Arrange: 空き2つ(1,0)と(1,3)。criteria#1,#2でタイ。
      // (1,0)の隣接: 上(0,0)=2, 下(2,0)=4, 右(1,1)=0→その先(1,2)=0→その先(1,3)=空き=skip
      //   左=範囲外 → 合計=2+4=6 + (1,1)→(1,2)→(1,3)は空き→0
      // (1,3)の隣接: 上(0,3)=256, 下(2,3)=128, 左(1,2)=0→その先(1,1)=0→その先(1,0)=空き=skip
      //   右=範囲外 → 合計=256+128=384
      // criteria#3で(1,3)が選ばれるべき
      const board: Board = [
        [2, 8, 16, 256],
        [0, 0, 0, 0],
        [4, 32, 64, 128],
        [512, 1024, 2, 4],
      ];

      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.0);
      const newBoard = addRandomTile(board, 'hard');
      spy.mockRestore();

      // (1,3)に配置されるべき（隣接合計が大きい方）
      expect(newBoard[1][3]).toBe(2);
    });

    test('隣接タイルの合計値が大きい位置を優先する', () => {
      // Arrange: 空き2つ。criteria#1同値、criteria#2も同条件（両方マージ不可）
      // → criteria#3: 隣接タイルの合計値が大きい位置を優先
      const board: Board = [
        [4, 0, 8, 16],
        [32, 64, 128, 256],
        [512, 0, 1024, 2],
        [8, 16, 32, 64],
      ];

      // 値は2(random=0.0)。(0,1)と(2,1)がどちらもマージ不可（隣に2なし）
      // (0,1)隣接: (0,0)=4, (0,2)=8, (1,1)=64 → 合計76
      // (2,1)隣接: (2,0)=512, (2,2)=1024, (1,1)=64, (3,1)=16 → 合計1616
      // criteria#3で(2,1)が選ばれるべき
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.0);
      const newBoard = addRandomTile(board, 'hard');
      spy.mockRestore();

      expect(newBoard[2][1]).toBe(2);
      expect(newBoard[0][1]).toBe(0);
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
