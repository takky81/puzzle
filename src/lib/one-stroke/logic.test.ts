import { describe, expect, test } from 'vitest';
import {
  createGrid,
  createGame,
  getPathCells,
  isAdjacent,
  normalizeEdge,
  hasEdge,
  toggleEdge,
  endStroke,
  undo,
  redo,
  resetGame,
  getVisitedCount,
  getPathCount,
  getMessage,
} from './logic';
import type { Grid, Edge } from './types';

const simpleGrid: Grid = [
  ['path', 'path'],
  ['path', 'path'],
  ['path', 'path'],
];
const simpleSolution: Edge[] = [
  [
    [0, 0],
    [0, 1],
  ],
  [
    [0, 1],
    [1, 1],
  ],
  [
    [1, 1],
    [2, 1],
  ],
  [
    [2, 1],
    [2, 0],
  ],
  [
    [2, 0],
    [1, 0],
  ],
  [
    [1, 0],
    [0, 0],
  ],
];

const testGrid: Grid = [
  ['path', 'path'],
  ['path', 'wall'],
  ['path', 'path'],
];

describe('一筆書きパズル ロジック', () => {
  describe('グリッド生成', () => {
    test('指定サイズのグリッドを生成できる', () => {
      const grid: Grid = createGrid(4, 4);
      expect(grid).toHaveLength(4);
      expect(grid[0]).toHaveLength(4);
    });

    test('デフォルトは8x8のグリッドである', () => {
      const grid = createGrid();
      expect(grid).toHaveLength(8);
      expect(grid[0]).toHaveLength(8);
    });

    test('グリッドの各セルはpathまたはwallである', () => {
      const grid = createGrid(3, 3);
      for (const row of grid) {
        for (const cell of row) {
          expect(['path', 'wall']).toContain(cell);
        }
      }
    });
  });

  describe('ゲーム初期化', () => {
    test('初期状態ではエッジが空である', () => {
      const game = createGame(simpleGrid, simpleSolution);
      expect(game.edges).toEqual([]);
    });

    test('初期状態ではクリアしていない', () => {
      const game = createGame(simpleGrid, simpleSolution);
      expect(game.isCleared).toBe(false);
    });

    test('初期状態では履歴が空である', () => {
      const game = createGame(simpleGrid, simpleSolution);
      expect(game.history).toEqual([]);
      expect(game.future).toEqual([]);
    });
  });

  describe('通行可能マス', () => {
    test('pathマスの一覧を取得できる', () => {
      const cells = getPathCells(simpleGrid);
      expect(cells).toHaveLength(6);
    });

    test('wallマスは通行可能マスに含まれない', () => {
      const cells = getPathCells(testGrid);
      expect(cells).toHaveLength(5);
      const hasWallCell = cells.some(([r, c]) => r === 1 && c === 1);
      expect(hasWallCell).toBe(false);
    });
  });

  describe('隣接判定', () => {
    test('上下左右のマスが隣接と判定される', () => {
      expect(isAdjacent(simpleGrid, [0, 0], [0, 1])).toBe(true);
      expect(isAdjacent(simpleGrid, [0, 0], [1, 0])).toBe(true);
    });

    test('斜めのマスは隣接と判定されない', () => {
      expect(isAdjacent(simpleGrid, [0, 0], [1, 1])).toBe(false);
    });

    test('壁マスは隣接と判定されない', () => {
      expect(isAdjacent(testGrid, [1, 0], [1, 1])).toBe(false);
    });

    test('グリッド外は隣接と判定されない', () => {
      expect(isAdjacent(simpleGrid, [0, 0], [-1, 0])).toBe(false);
      expect(isAdjacent(simpleGrid, [0, 0], [0, -1])).toBe(false);
    });
  });

  describe('エッジの正規化', () => {
    test('同じ2点間のエッジは順序に関わらず同一と判定される', () => {
      const e1 = normalizeEdge([
        [0, 0],
        [0, 1],
      ]);
      const e2 = normalizeEdge([
        [0, 1],
        [0, 0],
      ]);
      expect(e1).toEqual(e2);
    });

    test('エッジリストに同一エッジが含まれるか判定できる', () => {
      const edges: Edge[] = [
        [
          [0, 0],
          [0, 1],
        ],
      ];
      expect(
        hasEdge(edges, [
          [0, 1],
          [0, 0],
        ]),
      ).toBe(true);
      expect(
        hasEdge(edges, [
          [0, 0],
          [1, 0],
        ]),
      ).toBe(false);
    });
  });

  describe('エッジ操作', () => {
    test('隣接するセル間にエッジを追加できる', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      expect(game.edges).toHaveLength(1);
    });

    test('隣接していないセル間にはエッジを追加できない', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [1, 1]);
      expect(game.edges).toHaveLength(0);
    });

    test('既存エッジをtoggleすると削除される', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      expect(game.edges).toHaveLength(1);
      game = toggleEdge(game, [0, 0], [0, 1]);
      expect(game.edges).toHaveLength(0);
    });

    test('壁マスとの間にはエッジを追加できない', () => {
      let game = createGame(testGrid, []);
      game = toggleEdge(game, [1, 0], [1, 1]);
      expect(game.edges).toHaveLength(0);
    });

    test('離れた場所にも独立してエッジを追加できる', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [2, 0], [2, 1]);
      expect(game.edges).toHaveLength(2);
    });

    test('既に2本のエッジが接続されたマスにはエッジを追加できない', () => {
      const grid3x3: Grid = [
        ['path', 'path', 'path'],
        ['path', 'path', 'path'],
        ['path', 'path', 'path'],
      ];
      let game = createGame(grid3x3, []);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [0, 2]);
      // (0,1)に2本接続済み → (1,1)-(0,1)は追加不可
      game = toggleEdge(game, [1, 1], [0, 1]);
      expect(game.edges).toHaveLength(2);
    });
  });

  describe('ストローク管理', () => {
    test('endStrokeでストロークが確定する', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      expect(game.history).toHaveLength(1);
    });

    test('1ストロークに複数のエッジが含まれる', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [1, 1]);
      game = endStroke(game);
      expect(game.history).toHaveLength(1);
      expect(game.history[0].added).toHaveLength(2);
    });

    test('線の削除もストロークとして記録される', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      expect(game.history).toHaveLength(2);
      expect(game.history[1].removed).toHaveLength(1);
    });
  });

  describe('undo/redo', () => {
    test('undoで直前のストロークを取り消せる', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      expect(game.edges).toHaveLength(1);
      game = undo(game);
      expect(game.edges).toHaveLength(0);
    });

    test('削除ストロークをundoするとエッジが復元される', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      expect(game.edges).toHaveLength(0);
      game = undo(game);
      expect(game.edges).toHaveLength(1);
    });

    test('redoで取り消したストロークを復元できる', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      game = undo(game);
      game = redo(game);
      expect(game.edges).toHaveLength(1);
    });

    test('新しいストローク後はredoスタックがクリアされる', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      game = undo(game);
      game = toggleEdge(game, [1, 0], [1, 1]);
      game = endStroke(game);
      expect(game.future).toEqual([]);
    });

    test('履歴が空のときundoしても何も起きない', () => {
      const game = createGame(simpleGrid, simpleSolution);
      const next = undo(game);
      expect(next).toEqual(game);
    });

    test('futureが空のときredoしても何も起きない', () => {
      const game = createGame(simpleGrid, simpleSolution);
      const next = redo(game);
      expect(next).toEqual(game);
    });
  });

  describe('リセット', () => {
    test('リセットすると全エッジが消える', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      game = resetGame(game);
      expect(game.edges).toEqual([]);
      expect(game.history).toEqual([]);
      expect(game.future).toEqual([]);
    });

    test('リセット後も同じグリッドが維持される', () => {
      let game = createGame(testGrid, []);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      game = resetGame(game);
      expect(game.grid).toEqual(testGrid);
    });
  });

  describe('進捗', () => {
    test('通過済みマス数を取得できる', () => {
      let game = createGame(simpleGrid, simpleSolution);
      expect(getVisitedCount(game)).toBe(0);
      game = toggleEdge(game, [0, 0], [0, 1]);
      expect(getVisitedCount(game)).toBe(2);
    });

    test('全通行可能マス数を取得できる', () => {
      expect(getPathCount(simpleGrid)).toBe(6);
      expect(getPathCount(testGrid)).toBe(5);
    });
  });

  describe('クリア判定', () => {
    test('全pathマスを1つの閉路で結ぶとクリアになる', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [1, 1]);
      game = toggleEdge(game, [1, 1], [2, 1]);
      game = toggleEdge(game, [2, 1], [2, 0]);
      game = toggleEdge(game, [2, 0], [1, 0]);
      game = toggleEdge(game, [1, 0], [0, 0]);
      game = endStroke(game);
      expect(game.isCleared).toBe(true);
    });

    test('全マス通過でも閉路でなければクリアではない', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [1, 1]);
      game = toggleEdge(game, [1, 1], [2, 1]);
      game = toggleEdge(game, [2, 1], [2, 0]);
      game = toggleEdge(game, [2, 0], [1, 0]);
      // 全マス通過だが(1,0)→(0,0)が無い → 閉路でない
      expect(game.isCleared).toBe(false);
    });

    test('エッジが複数の輪に分かれている場合はクリアではない', () => {
      const grid4x2: Grid = [
        ['path', 'path'],
        ['path', 'path'],
        ['path', 'path'],
        ['path', 'path'],
      ];
      let game = createGame(grid4x2, []);
      // ループ1
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [1, 1]);
      game = toggleEdge(game, [1, 1], [1, 0]);
      game = toggleEdge(game, [1, 0], [0, 0]);
      // ループ2
      game = toggleEdge(game, [2, 0], [2, 1]);
      game = toggleEdge(game, [2, 1], [3, 1]);
      game = toggleEdge(game, [3, 1], [3, 0]);
      game = toggleEdge(game, [3, 0], [2, 0]);
      expect(game.isCleared).toBe(false);
    });

    test('一部のマスしか通過していなければクリアではない', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [1, 1]);
      game = toggleEdge(game, [1, 1], [1, 0]);
      game = toggleEdge(game, [1, 0], [0, 0]);
      // 4マスの閉路だが全6マス通過していない
      expect(game.isCleared).toBe(false);
    });
  });

  describe('メッセージ', () => {
    test('全マス通過したが1つの閉路でない場合メッセージを返す', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [1, 1]);
      game = toggleEdge(game, [1, 1], [2, 1]);
      game = toggleEdge(game, [2, 1], [2, 0]);
      game = toggleEdge(game, [2, 0], [1, 0]);
      expect(getMessage(game)).toBe('全マス通過！1つの輪にしましょう');
    });

    test('クリア時にクリアメッセージを返す', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [1, 1]);
      game = toggleEdge(game, [1, 1], [2, 1]);
      game = toggleEdge(game, [2, 1], [2, 0]);
      game = toggleEdge(game, [2, 0], [1, 0]);
      game = toggleEdge(game, [1, 0], [0, 0]);
      game = endStroke(game);
      expect(getMessage(game)).toBe('クリア！');
    });

    test('プレイ中はnullを返す', () => {
      const game = createGame(simpleGrid, simpleSolution);
      expect(getMessage(game)).toBeNull();
    });
  });

  describe('ギブアップ', () => {
    test('ギブアップすると正解ルートを返す', () => {
      const game = createGame(simpleGrid, simpleSolution);
      expect(game.solution).toEqual(simpleSolution);
    });
  });
});
