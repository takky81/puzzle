import { describe, expect, test } from 'vitest';
import { generateHamiltonianCycle, isUniqueSolution, generateStage, solveCycle } from './generator';
import { createGame, toggleEdge, endStroke, posKey } from './logic';
import type { Grid } from './types';

const grid2x2: Grid = [
  ['path', 'path'],
  ['path', 'path'],
];
const grid3x3CenterWall: Grid = [
  ['path', 'path', 'path'],
  ['path', 'wall', 'path'],
  ['path', 'path', 'path'],
];
const grid4x4AllPath: Grid = [
  ['path', 'path', 'path', 'path'],
  ['path', 'path', 'path', 'path'],
  ['path', 'path', 'path', 'path'],
  ['path', 'path', 'path', 'path'],
];

describe('一筆書きパズル ステージ生成', () => {
  describe('ハミルトン閉路生成', () => {
    test('小さいグリッドでハミルトン閉路を生成できる', () => {
      const cycle = generateHamiltonianCycle(grid2x2);
      expect(cycle).not.toBeNull();
      expect(cycle!.length).toBe(4);
    });
    test('生成された閉路は全pathマスを1回ずつ通る', () => {
      const cycle = generateHamiltonianCycle(grid2x2)!;
      const visited = new Set<string>();
      for (const edge of cycle) {
        visited.add(posKey(edge[0]));
      }
      expect(visited.size).toBe(4);
    });
    test('閉路の始点と終点が隣接している', () => {
      const cycle = generateHamiltonianCycle(grid2x2)!;
      const first = cycle[0][0];
      const last = cycle[cycle.length - 1][1];
      const dr = Math.abs(first[0] - last[0]);
      const dc = Math.abs(first[1] - last[1]);
      expect(dr + dc).toBe(0); // 始点と終点は同じ（閉路なので最後のエッジが始点に戻る）
    });
    test('閉路の各エッジは上下左右に隣接するマス間のものである', () => {
      const grid: Grid = [
        ['path', 'path', 'path'],
        ['path', 'path', 'path'],
      ];
      const cycle = generateHamiltonianCycle(grid)!;
      for (const [a, b] of cycle) {
        const dr = Math.abs(a[0] - b[0]);
        const dc = Math.abs(a[1] - b[1]);
        expect(dr + dc).toBe(1);
      }
    });
    test('奇数pathマスのグリッドではnullを返す', () => {
      const grid: Grid = [
        ['path', 'path'],
        ['path', 'wall'],
        ['path', 'path'],
      ];
      const cycle = generateHamiltonianCycle(grid);
      expect(cycle).toBeNull();
    });

    test('壁マスを含む偶数マスのグリッドでハミルトン閉路を生成できる', () => {
      const cycle = generateHamiltonianCycle(grid3x3CenterWall);
      expect(cycle).not.toBeNull();
      if (cycle) {
        for (const [a, b] of cycle) {
          expect(grid3x3CenterWall[a[0]][a[1]]).toBe('path');
          expect(grid3x3CenterWall[b[0]][b[1]]).toBe('path');
        }
      }
    });
  });

  describe('一意性検証', () => {
    test('解が一意であることを検証できる', () => {
      expect(isUniqueSolution(grid2x2)).toBe(true);
    });
    test('解が複数ある場合はfalseを返す', () => {
      expect(isUniqueSolution(grid4x4AllPath)).toBe(false);
    });
  });

  describe('壁マス配置', () => {
    test('壁マスを追加して解の一意性を確保する', () => {
      const stage = generateStage(4, 4);
      expect(isUniqueSolution(stage.grid)).toBe(true);
    });
    test('壁マスの数はできるだけ少ない', () => {
      const stage = generateStage(4, 4);
      let wallCount = 0;
      for (const row of stage.grid) {
        for (const cell of row) {
          if (cell === 'wall') wallCount++;
        }
      }
      // 4x4グリッドで壁は最大でも4個程度に収まるべき
      expect(wallCount).toBeLessThanOrEqual(4);
    });
  });

  describe('制約伝播ソルバー', () => {
    test('隣接マスが2つしかないノードのエッジは確定する', () => {
      const result = solveCycle(grid2x2);
      expect(result.type).toBe('unique');
    });
    test('確定したエッジにより別のノードのエッジも連鎖的に確定する', () => {
      const result = solveCycle(grid3x3CenterWall);
      expect(result.type).toBe('unique');
      if (result.type === 'unique') {
        expect(result.edges).toHaveLength(8);
      }
    });
    test('2x2グリッドは伝播だけで全エッジが確定する', () => {
      const result = solveCycle(grid2x2);
      expect(result.type).toBe('unique');
      if (result.type === 'unique') {
        // 4マス4エッジの閉路
        expect(result.edges).toHaveLength(4);
      }
    });
    test('確定中に矛盾が検出されたらnoneを返す', () => {
      // 隣接が1つしかないマスがある → 閉路不可能
      const grid: Grid = [
        ['path', 'path'],
        ['path', 'wall'],
        ['path', 'path'],
      ];
      // (1,0)は(0,0)と(2,0)の2隣接だが5マス(奇数)→閉路不可
      const result = solveCycle(grid);
      expect(result.type).toBe('none');
    });
    test('閉路が完成前に閉じたらnoneを返す', () => {
      // 2つの独立した2x2ブロック → 各ブロックで小さい閉路は作れるが全体の閉路は不可
      const grid: Grid = [
        ['path', 'path', 'wall', 'path', 'path'],
        ['path', 'path', 'wall', 'path', 'path'],
      ];
      const result = solveCycle(grid);
      expect(result.type).toBe('none');
    });
    test('解が一意のグリッドでuniqueを返す', () => {
      const result = solveCycle(grid3x3CenterWall);
      expect(result.type).toBe('unique');
    });
    test('解が複数あるグリッドでmultipleを返す', () => {
      const result = solveCycle(grid4x4AllPath);
      expect(result.type).toBe('multiple');
    });
    test('6x6グリッドでも実用的な時間で解ける', () => {
      // 6x6 中央壁で外周を通る閉路。pathマス=20(偶数)、全マス隣接2以上
      const grid: Grid = [
        ['path', 'path', 'path', 'path', 'path', 'path'],
        ['path', 'wall', 'wall', 'wall', 'wall', 'path'],
        ['path', 'wall', 'wall', 'wall', 'wall', 'path'],
        ['path', 'wall', 'wall', 'wall', 'wall', 'path'],
        ['path', 'wall', 'wall', 'wall', 'wall', 'path'],
        ['path', 'path', 'path', 'path', 'path', 'path'],
      ];
      const start = Date.now();
      const result = solveCycle(grid);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
      expect(result.type).toBe('unique');
    });
  });

  describe('ステージ生成', () => {
    test('指定サイズのステージを生成できる', () => {
      const stage = generateStage(4, 4);
      expect(stage.grid).toHaveLength(4);
      expect(stage.grid[0]).toHaveLength(4);
    });
    test('生成されたステージは有効なグリッドを持つ', () => {
      const stage = generateStage(4, 4);
      for (const row of stage.grid) {
        for (const cell of row) {
          expect(['path', 'wall']).toContain(cell);
        }
      }
    });
    test('生成されたステージは正解のルートを持つ', () => {
      const stage = generateStage(4, 4);
      expect(stage.solution.length).toBeGreaterThan(0);
    });
    test('正解ルートはハミルトン閉路である', () => {
      const stage = generateStage(4, 4);
      const pathCells = new Set<string>();
      for (let r = 0; r < stage.grid.length; r++) {
        for (let c = 0; c < stage.grid[r].length; c++) {
          if (stage.grid[r][c] === 'path') pathCells.add(posKey([r, c]));
        }
      }
      // 全pathマスを通る
      const visited = new Set<string>();
      for (const edge of stage.solution) {
        visited.add(posKey(edge[0]));
      }
      expect(visited.size).toBe(pathCells.size);
      // 閉路: 最後のエッジの終点が最初のエッジの始点
      const first = stage.solution[0][0];
      const last = stage.solution[stage.solution.length - 1][1];
      expect(first).toEqual(last);
    });
  });

  describe('ハミルトン閉路生成（追加ケース）', () => {
    test('L字形壁配置でハミルトン閉路を生成できる', () => {
      const grid: Grid = [
        ['path', 'path', 'path', 'path'],
        ['path', 'path', 'path', 'path'],
        ['path', 'path', 'wall', 'wall'],
        ['path', 'path', 'wall', 'wall'],
      ];
      // 12マス(偶数)、L字形
      const cycle = generateHamiltonianCycle(grid);
      expect(cycle).not.toBeNull();
      if (cycle) {
        const visited = new Set<string>();
        for (const edge of cycle) {
          visited.add(posKey(edge[0]));
        }
        expect(visited.size).toBe(12);
      }
    });

    test('T字形壁配置で隣接1のマスがある場合はnullを返す', () => {
      // (0,1)は隣接が(1,1)のみ → 隣接2未満で閉路不可
      const grid: Grid = [
        ['wall', 'path', 'wall'],
        ['path', 'path', 'path'],
        ['path', 'path', 'path'],
        ['path', 'path', 'path'],
      ];
      const cycle = generateHamiltonianCycle(grid);
      expect(cycle).toBeNull();
    });

    test('コの字形壁配置でハミルトン閉路を生成できる', () => {
      const grid: Grid = [
        ['path', 'path', 'path', 'path'],
        ['path', 'wall', 'wall', 'path'],
        ['path', 'path', 'path', 'path'],
      ];
      // 10マス(偶数)、コの字形
      const cycle = generateHamiltonianCycle(grid);
      expect(cycle).not.toBeNull();
      if (cycle) {
        const visited = new Set<string>();
        for (const edge of cycle) {
          visited.add(posKey(edge[0]));
        }
        expect(visited.size).toBe(10);
      }
    });

    test('壁でグリッドが分断されている場合はnullを返す', () => {
      const grid: Grid = [
        ['path', 'wall', 'path'],
        ['path', 'wall', 'path'],
      ];
      // 左右2マスずつの2ブロック → 閉路不可
      const cycle = generateHamiltonianCycle(grid);
      expect(cycle).toBeNull();
    });

    test('3x2全pathグリッドでハミルトン閉路を生成できる', () => {
      const grid: Grid = [
        ['path', 'path', 'path'],
        ['path', 'path', 'path'],
      ];
      const cycle = generateHamiltonianCycle(grid);
      expect(cycle).not.toBeNull();
      expect(cycle!.length).toBe(6);
    });
  });

  describe('制約伝播ソルバー（追加ケース）', () => {
    test('3x3全pathグリッドは奇数マスなので閉路不可（none）', () => {
      // 9マス（奇数）→ ハミルトン閉路は存在しない
      const grid: Grid = [
        ['path', 'path', 'path'],
        ['path', 'path', 'path'],
        ['path', 'path', 'path'],
      ];
      const result = solveCycle(grid);
      expect(result.type).toBe('none');
    });

    test('3x2全pathグリッドは解が一意', () => {
      const grid: Grid = [
        ['path', 'path', 'path'],
        ['path', 'path', 'path'],
      ];
      const result = solveCycle(grid);
      expect(result.type).toBe('unique');
    });

    test('壁で分断されたグリッドはnoneを返す', () => {
      const grid: Grid = [
        ['path', 'path', 'wall', 'path', 'path'],
        ['path', 'path', 'wall', 'path', 'path'],
      ];
      const result = solveCycle(grid);
      expect(result.type).toBe('none');
    });

    test('pathが4未満のグリッドはnoneを返す', () => {
      const grid: Grid = [
        ['path', 'wall'],
        ['wall', 'wall'],
      ];
      const result = solveCycle(grid);
      expect(result.type).toBe('none');
    });

    test('pathが奇数のグリッドはnoneを返す', () => {
      const grid: Grid = [
        ['path', 'path', 'path'],
        ['path', 'path', 'wall'],
      ];
      // 5マス（奇数）
      const result = solveCycle(grid);
      expect(result.type).toBe('none');
    });

    test('4x2全pathグリッドは解が一意', () => {
      // 4x2: 8マスで外周を回る閉路のみ
      const grid: Grid = [
        ['path', 'path', 'path', 'path'],
        ['path', 'path', 'path', 'path'],
      ];
      const result = solveCycle(grid);
      expect(result.type).toBe('unique');
    });
  });

  describe('ステージ生成（追加ケース）', () => {
    test('6x6ステージを実用的な時間で生成できる', () => {
      const start = Date.now();
      const stage = generateStage(6, 6);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(30000);
      expect(isUniqueSolution(stage.grid)).toBe(true);
    });

    test('生成されたステージでpathマス数は偶数かつ4以上', () => {
      const stage = generateStage(4, 4);
      let pathCount = 0;
      for (const row of stage.grid) {
        for (const cell of row) {
          if (cell === 'path') pathCount++;
        }
      }
      expect(pathCount).toBeGreaterThanOrEqual(4);
      expect(pathCount % 2).toBe(0);
    });

    test('生成されたステージの正解ルートの各エッジは隣接マス間のもの', () => {
      const stage = generateStage(4, 4);
      for (const [a, b] of stage.solution) {
        const dr = Math.abs(a[0] - b[0]);
        const dc = Math.abs(a[1] - b[1]);
        expect(dr + dc).toBe(1);
      }
    });

    test('onProgressコールバックが呼ばれる', () => {
      let called = false;
      generateStage(4, 4, (attempt) => {
        if (attempt === 0) called = true;
      });
      expect(called).toBe(true);
    });

    test('生成されたステージの正解ルートは壁マスを通らない', () => {
      const stage = generateStage(4, 4);
      for (const [a, b] of stage.solution) {
        expect(stage.grid[a[0]][a[1]]).toBe('path');
        expect(stage.grid[b[0]][b[1]]).toBe('path');
      }
    });
  });

  describe('ロジックとジェネレータの統合', () => {
    test('生成されたステージのsolutionでゲームをクリアできる', () => {
      const stage = generateStage(4, 4);
      let game = createGame(stage.grid, stage.solution);
      // solutionの各エッジを順番に追加
      for (const [from, to] of stage.solution) {
        game = toggleEdge(game, from, to);
      }
      game = endStroke(game);
      expect(game.isCleared).toBe(true);
    });
  });
});
