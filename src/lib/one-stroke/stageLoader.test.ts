import { describe, test, expect } from 'vitest';
import type { Stage } from './types';
import { pickRandomStage, loadStage, type PuzzleFile } from './stageLoader';

describe('pickRandomStage', () => {
  test('puzzlesが1件のときそのStageを返す', () => {
    // Arrange
    const stage: Stage = {
      grid: [
        ['path', 'path'],
        ['path', 'path'],
      ],
      solution: [],
    };
    const file: PuzzleFile = { puzzles: [stage] };

    // Act
    const picked = pickRandomStage(file, () => 0);

    // Assert
    expect(picked).toBe(stage);
  });

  test('rngに応じてpuzzles内の異なるStageを返す', () => {
    // Arrange
    const s0: Stage = { grid: [['path']], solution: [] };
    const s1: Stage = { grid: [['wall']], solution: [] };
    const s2: Stage = { grid: [['path', 'wall']], solution: [] };
    const file: PuzzleFile = { puzzles: [s0, s1, s2] };

    // Act
    const picked = pickRandomStage(file, () => 0.5);

    // Assert
    expect(picked).toBe(s1);
  });

  test('puzzlesが空のときエラーを投げる', () => {
    // Arrange
    const file: PuzzleFile = { puzzles: [] };

    // Act & Assert
    expect(() => pickRandomStage(file)).toThrow();
  });
});

describe('loadStage', () => {
  test('指定サイズのJSONをfetchしてStageを返す', async () => {
    // Arrange
    const stage: Stage = {
      grid: [
        ['path', 'path'],
        ['path', 'path'],
      ],
      solution: [
        [
          [0, 0],
          [0, 1],
        ],
      ],
    };
    const file: PuzzleFile = { puzzles: [stage] };
    const fetchFn = async (url: string): Promise<Response> => {
      expect(url).toContain('6x6.json');
      return new Response(JSON.stringify(file), { status: 200 });
    };

    // Act
    const result = await loadStage(6, '', fetchFn as typeof fetch, () => 0);

    // Assert
    expect(result.grid).toEqual(stage.grid);
    expect(result.solution).toEqual(stage.solution);
  });

  test('basePathを付けてfetchする', async () => {
    // Arrange
    const stage: Stage = { grid: [['path']], solution: [] };
    const file: PuzzleFile = { puzzles: [stage] };
    let receivedUrl = '';
    const fetchFn = async (url: string): Promise<Response> => {
      receivedUrl = url;
      return new Response(JSON.stringify(file), { status: 200 });
    };

    // Act
    await loadStage(4, '/puzzle', fetchFn as typeof fetch, () => 0);

    // Assert
    expect(receivedUrl).toBe('/puzzle/puzzles/4x4.json');
  });
});
