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
  getNeighbors,
  posKey,
  keyToPos,
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

const grid3x3: Grid = [
  ['path', 'path', 'path'],
  ['path', 'path', 'path'],
  ['path', 'path', 'path'],
];

const grid4x2: Grid = [
  ['path', 'path'],
  ['path', 'path'],
  ['path', 'path'],
  ['path', 'path'],
];

const grid3x3CenterWall: Grid = [
  ['path', 'path', 'path'],
  ['path', 'wall', 'path'],
  ['path', 'path', 'path'],
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

  describe('getNeighbors', () => {
    test('角マスは2方向の隣接マスを返す', () => {
      const nbrs = getNeighbors(simpleGrid, [0, 0]);
      expect(nbrs).toHaveLength(2);
      expect(nbrs).toContainEqual([0, 1]);
      expect(nbrs).toContainEqual([1, 0]);
    });

    test('辺マスは3方向の隣接マスを返す', () => {
      // simpleGridは3行2列なので(1,0)は上下右の3隣接
      const nbrs = getNeighbors(simpleGrid, [1, 0]);
      expect(nbrs).toHaveLength(3);
      expect(nbrs).toContainEqual([0, 0]);
      expect(nbrs).toContainEqual([2, 0]);
      expect(nbrs).toContainEqual([1, 1]);
      // 3x3のグリッドで辺マスをテスト
      const nbrs2 = getNeighbors(grid3x3, [0, 1]);
      expect(nbrs2).toHaveLength(3);
      expect(nbrs2).toContainEqual([0, 0]);
      expect(nbrs2).toContainEqual([0, 2]);
      expect(nbrs2).toContainEqual([1, 1]);
    });

    test('中央マスは4方向の隣接マスを返す', () => {
      const nbrs = getNeighbors(grid3x3, [1, 1]);
      expect(nbrs).toHaveLength(4);
    });

    test('壁マスに隣接するマスは除外される', () => {
      const nbrs = getNeighbors(testGrid, [1, 0]);
      // (1,1)はwallなので除外
      expect(nbrs).toHaveLength(2);
      expect(nbrs).toContainEqual([0, 0]);
      expect(nbrs).toContainEqual([2, 0]);
    });

    test('壁マスからの隣接取得は隣接pathマスを返す', () => {
      // testGrid: (1,1)はwall。getNeighborsは隣接pathを返す
      // (0,1)=path, (2,1)=path, (1,0)=path → 3マス
      const nbrs = getNeighbors(testGrid, [1, 1]);
      expect(nbrs).toHaveLength(3);
      expect(nbrs).toContainEqual([0, 1]);
      expect(nbrs).toContainEqual([2, 1]);
      expect(nbrs).toContainEqual([1, 0]);
    });
  });

  describe('posKey / keyToPos', () => {
    test('posKeyで座標を文字列に変換できる', () => {
      expect(posKey([0, 0])).toBe('0,0');
      expect(posKey([3, 7])).toBe('3,7');
    });

    test('keyToPosで文字列を座標に変換できる', () => {
      expect(keyToPos('0,0')).toEqual([0, 0]);
      expect(keyToPos('3,7')).toEqual([3, 7]);
    });

    test('posKeyとkeyToPosは可逆である', () => {
      const positions: [number, number][] = [
        [0, 0],
        [5, 3],
        [10, 15],
      ];
      for (const pos of positions) {
        expect(keyToPos(posKey(pos))).toEqual(pos);
      }
    });
  });

  describe('線の交差と接触', () => {
    test('グリッド構造上、線が交差することはない（上下左右移動のみ）', () => {
      // SPEC: 線が交差するのはNG
      // グリッド上で上下左右のみ移動するため、2本のエッジが交差する配置は構造的に不可能
      // エッジは隣接マス間のみなので、交差するには同じマスを共有する必要があり、
      // その場合は「接触」であって「交差」ではない
      let game = createGame(grid3x3, []);
      // 横エッジ (0,0)-(0,1) と縦エッジ (0,0)-(1,0) は端点を共有するが交差ではない
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 0], [1, 0]);
      expect(game.edges).toHaveLength(2);
      // 2本のエッジは(0,0)で接するが交差しない
    });

    test('線が接する場合はOK（端点を共有する2本のエッジ）', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [1, 1]);
      expect(game.edges).toHaveLength(2);
      // (0,1)で2本が接している
    });

    test('3本目のエッジは同じマスに追加できない', () => {
      let game = createGame(grid3x3, []);
      game = toggleEdge(game, [0, 1], [1, 1]);
      game = toggleEdge(game, [1, 1], [2, 1]);
      // (1,1)に2本接続済み → (1,0)-(1,1)は不可
      game = toggleEdge(game, [1, 0], [1, 1]);
      expect(game.edges).toHaveLength(2);
      // (1,1)に対して追加しようとする側も拒否される
      game = toggleEdge(game, [1, 1], [1, 2]);
      expect(game.edges).toHaveLength(2);
    });

    test('エッジ削除後に同じ位置に再追加できる', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      expect(game.edges).toHaveLength(1);
      game = toggleEdge(game, [0, 0], [0, 1]); // 削除
      expect(game.edges).toHaveLength(0);
      game = toggleEdge(game, [0, 0], [0, 1]); // 再追加
      expect(game.edges).toHaveLength(1);
    });

    test('逆方向からtoggleしても同一エッジとして扱われる', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      // 逆方向で削除
      game = toggleEdge(game, [0, 1], [0, 0]);
      expect(game.edges).toHaveLength(0);
    });
  });

  describe('ストローク管理（追加ケース）', () => {
    test('操作がないままendStrokeしても履歴に追加されない', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = endStroke(game);
      expect(game.history).toHaveLength(0);
    });

    test('1ストローク内でエッジの追加と削除が混在する', () => {
      let game = createGame(simpleGrid, simpleSolution);
      // 先にエッジを1本追加して確定
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      // 新ストローク: 追加+既存削除
      game = toggleEdge(game, [1, 0], [1, 1]); // 追加
      game = toggleEdge(game, [0, 0], [0, 1]); // 削除
      game = endStroke(game);
      expect(game.history).toHaveLength(2);
      expect(game.history[1].added).toHaveLength(1);
      expect(game.history[1].removed).toHaveLength(1);
      expect(game.edges).toHaveLength(1); // (1,0)-(1,1)のみ残る
    });

    test('endStroke後にpendingStrokeがクリアされる', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      expect(game.pendingStroke.added).toHaveLength(1);
      game = endStroke(game);
      expect(game.pendingStroke.added).toHaveLength(0);
      expect(game.pendingStroke.removed).toHaveLength(0);
    });
  });

  describe('undo/redo（追加ケース）', () => {
    test('複数ストロークを連続undoできる', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      game = toggleEdge(game, [1, 0], [1, 1]);
      game = endStroke(game);
      game = toggleEdge(game, [2, 0], [2, 1]);
      game = endStroke(game);
      expect(game.edges).toHaveLength(3);
      game = undo(game);
      game = undo(game);
      game = undo(game);
      expect(game.edges).toHaveLength(0);
      expect(game.future).toHaveLength(3);
    });

    test('undo→undo→新ストローク後にredoスタックが破棄される', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      game = toggleEdge(game, [1, 0], [1, 1]);
      game = endStroke(game);
      game = toggleEdge(game, [2, 0], [2, 1]);
      game = endStroke(game);
      game = undo(game);
      game = undo(game);
      // 新しいストロークを追加
      game = toggleEdge(game, [0, 0], [1, 0]);
      game = endStroke(game);
      expect(game.future).toEqual([]);
      expect(game.history).toHaveLength(2);
    });

    test('削除ストロークのundo/redoが正確に復元される', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [1, 1]);
      game = endStroke(game);
      // 削除ストローク
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      expect(game.edges).toHaveLength(1);
      game = undo(game); // 削除を取り消し
      expect(game.edges).toHaveLength(2);
      game = redo(game); // 削除を再適用
      expect(game.edges).toHaveLength(1);
    });

    test('undoでクリア状態が正しく再計算される', () => {
      let game = createGame(simpleGrid, simpleSolution);
      // 全エッジを引いてクリア
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [1, 1]);
      game = toggleEdge(game, [1, 1], [2, 1]);
      game = toggleEdge(game, [2, 1], [2, 0]);
      game = toggleEdge(game, [2, 0], [1, 0]);
      game = toggleEdge(game, [1, 0], [0, 0]);
      game = endStroke(game);
      expect(game.isCleared).toBe(true);
      game = undo(game);
      expect(game.isCleared).toBe(false);
      game = redo(game);
      expect(game.isCleared).toBe(true);
    });
  });

  describe('クリア判定（追加ケース）', () => {
    test('クリア判定はendStroke時に行われる（endStroke前はfalse）', () => {
      let game = createGame(simpleGrid, simpleSolution);
      // 全エッジを引く
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [1, 1]);
      game = toggleEdge(game, [1, 1], [2, 1]);
      game = toggleEdge(game, [2, 1], [2, 0]);
      game = toggleEdge(game, [2, 0], [1, 0]);
      game = toggleEdge(game, [1, 0], [0, 0]);
      // endStroke前: 閉路が完成していてもisClearedはfalse
      expect(game.isCleared).toBe(false);
      // endStroke後: クリア判定が実行される
      game = endStroke(game);
      expect(game.isCleared).toBe(true);
    });

    test('4x4グリッドでのクリア判定が正しい', () => {
      // 4x2グリッドで8マスの閉路
      let game = createGame(grid4x2, []);
      // 外周を一周する閉路
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [1, 1]);
      game = toggleEdge(game, [1, 1], [2, 1]);
      game = toggleEdge(game, [2, 1], [3, 1]);
      game = toggleEdge(game, [3, 1], [3, 0]);
      game = toggleEdge(game, [3, 0], [2, 0]);
      game = toggleEdge(game, [2, 0], [1, 0]);
      game = toggleEdge(game, [1, 0], [0, 0]);
      game = endStroke(game);
      expect(game.isCleared).toBe(true);
    });

    test('壁マスを含むグリッドでのクリア判定', () => {
      // 3x3中央壁: 8マスの閉路
      let game = createGame(grid3x3CenterWall, []);
      // 外周一周
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [0, 2]);
      game = toggleEdge(game, [0, 2], [1, 2]);
      game = toggleEdge(game, [1, 2], [2, 2]);
      game = toggleEdge(game, [2, 2], [2, 1]);
      game = toggleEdge(game, [2, 1], [2, 0]);
      game = toggleEdge(game, [2, 0], [1, 0]);
      game = toggleEdge(game, [1, 0], [0, 0]);
      game = endStroke(game);
      expect(game.isCleared).toBe(true);
    });

    test('エッジが0本の場合クリアではない', () => {
      const game = createGame(simpleGrid, simpleSolution);
      expect(game.isCleared).toBe(false);
    });

    test('全マス通過しているが各ノードの次数が2でない場合クリアではない', () => {
      // エッジが足りないケース（全マス通過だが閉路構成不十分）
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = toggleEdge(game, [0, 1], [1, 1]);
      game = toggleEdge(game, [1, 1], [2, 1]);
      game = toggleEdge(game, [2, 1], [2, 0]);
      game = toggleEdge(game, [2, 0], [1, 0]);
      // 5本のエッジ、全6マス通過だが閉路ではない
      game = endStroke(game);
      expect(game.isCleared).toBe(false);
    });
  });

  describe('メッセージ（追加ケース）', () => {
    test('visitedCountとpathCountを明示的に渡せる', () => {
      const game = createGame(simpleGrid, simpleSolution);
      // 外部から値を渡す
      expect(getMessage(game, 6, 6)).toBe('全マス通過！1つの輪にしましょう');
      expect(getMessage(game, 3, 6)).toBeNull();
    });

    test('エッジ追加中（endStroke前）でもメッセージは正しい', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      // endStrokeしていない状態でもgetMessageは動作する
      expect(getMessage(game)).toBeNull();
    });
  });

  describe('リセット（追加ケース）', () => {
    test('リセット後もsolutionが維持される', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      game = endStroke(game);
      game = resetGame(game);
      expect(game.solution).toEqual(simpleSolution);
    });

    test('リセット後にpendingStrokeがクリアされる', () => {
      let game = createGame(simpleGrid, simpleSolution);
      game = toggleEdge(game, [0, 0], [0, 1]);
      // endStrokeせずにリセット
      game = resetGame(game);
      expect(game.pendingStroke.added).toHaveLength(0);
      expect(game.pendingStroke.removed).toHaveLength(0);
    });
  });
});
