import { describe, expect, test } from 'vitest';
import { generateHamiltonianCycle, isUniqueSolution, generateStage, solveCycle } from './generator';
import type { Grid } from './types';

describe('一筆書きパズル ステージ生成', () => {
  describe('ハミルトン閉路生成', () => {
    test('小さいグリッドでハミルトン閉路を生成できる', () => {
      const grid: Grid = [
        ['path', 'path'],
        ['path', 'path'],
      ];
      const cycle = generateHamiltonianCycle(grid);
      expect(cycle).not.toBeNull();
      expect(cycle!.length).toBe(4); // 4マス → 4エッジの閉路
    });
    test('生成された閉路は全pathマスを1回ずつ通る', () => {
      const grid: Grid = [
        ['path', 'path'],
        ['path', 'path'],
      ];
      const cycle = generateHamiltonianCycle(grid)!;
      const visited = new Set<string>();
      for (const edge of cycle) {
        visited.add(`${edge[0][0]},${edge[0][1]}`);
      }
      expect(visited.size).toBe(4);
    });
    test('閉路の始点と終点が隣接している', () => {
      const grid: Grid = [
        ['path', 'path'],
        ['path', 'path'],
      ];
      const cycle = generateHamiltonianCycle(grid)!;
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
    test('壁マスを含むグリッドでもハミルトン閉路を生成できる', () => {
      const grid: Grid = [
        ['path', 'path'],
        ['path', 'wall'],
        ['path', 'path'],
      ];
      // 5マス（奇数）なので閉路は存在しない
      const cycle = generateHamiltonianCycle(grid);
      expect(cycle).toBeNull();
    });

    test('壁マスを含む偶数マスのグリッドでハミルトン閉路を生成できる', () => {
      const grid: Grid = [
        ['path', 'path', 'path'],
        ['path', 'wall', 'path'],
        ['path', 'path', 'path'],
      ];
      // 8マス（偶数）
      const cycle = generateHamiltonianCycle(grid);
      expect(cycle).not.toBeNull();
      // 壁マスは通らない
      if (cycle) {
        for (const [a, b] of cycle) {
          expect(grid[a[0]][a[1]]).toBe('path');
          expect(grid[b[0]][b[1]]).toBe('path');
        }
      }
    });
  });

  describe('一意性検証', () => {
    test('解が一意であることを検証できる', () => {
      // 2x2は閉路が1通りしかない（回転・反転は同一閉路）
      const grid: Grid = [
        ['path', 'path'],
        ['path', 'path'],
      ];
      expect(isUniqueSolution(grid)).toBe(true);
    });
    test('解が複数ある場合はfalseを返す', () => {
      // 4x4の全pathグリッドは複数のハミルトン閉路がある
      const grid: Grid = [
        ['path', 'path', 'path', 'path'],
        ['path', 'path', 'path', 'path'],
        ['path', 'path', 'path', 'path'],
        ['path', 'path', 'path', 'path'],
      ];
      expect(isUniqueSolution(grid)).toBe(false);
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
      // 2x2: 4つの角マスは全て隣接2つ → 全エッジ確定
      const grid: Grid = [
        ['path', 'path'],
        ['path', 'path'],
      ];
      const result = solveCycle(grid);
      expect(result.type).toBe('unique');
    });
    test('確定したエッジにより別のノードのエッジも連鎖的に確定する', () => {
      // 中央壁の3x3: 角4つは各2隣接→確定→中辺4つも確定
      const grid2: Grid = [
        ['path', 'path', 'path'],
        ['path', 'wall', 'path'],
        ['path', 'path', 'path'],
      ];
      // 8マス。角4つは各2隣接→確定→中辺4つも確定
      const result = solveCycle(grid2);
      expect(result.type).toBe('unique');
      if (result.type === 'unique') {
        expect(result.edges).toHaveLength(8);
      }
    });
    test('2x2グリッドは伝播だけで全エッジが確定する', () => {
      const grid: Grid = [
        ['path', 'path'],
        ['path', 'path'],
      ];
      const result = solveCycle(grid);
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
      // 中央壁の3x3 → 解は一意
      const grid: Grid = [
        ['path', 'path', 'path'],
        ['path', 'wall', 'path'],
        ['path', 'path', 'path'],
      ];
      const result = solveCycle(grid);
      expect(result.type).toBe('unique');
    });
    test('解が複数あるグリッドでmultipleを返す', () => {
      // 4x4全path → 複数の閉路が存在
      const grid: Grid = [
        ['path', 'path', 'path', 'path'],
        ['path', 'path', 'path', 'path'],
        ['path', 'path', 'path', 'path'],
        ['path', 'path', 'path', 'path'],
      ];
      const result = solveCycle(grid);
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
          if (stage.grid[r][c] === 'path') pathCells.add(`${r},${c}`);
        }
      }
      // 全pathマスを通る
      const visited = new Set<string>();
      for (const edge of stage.solution) {
        visited.add(`${edge[0][0]},${edge[0][1]}`);
      }
      expect(visited.size).toBe(pathCells.size);
      // 閉路: 最後のエッジの終点が最初のエッジの始点
      const first = stage.solution[0][0];
      const last = stage.solution[stage.solution.length - 1][1];
      expect(first).toEqual(last);
    });
  });
});
