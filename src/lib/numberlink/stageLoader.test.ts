import { describe, test, expect } from 'vitest';
import type { Stage } from './types';
import { pickRandomStage, loadStage, type PuzzleFile } from './stageLoader';

const sampleStage: Stage = {
  size: 3,
  numbers: [
    {
      id: 1,
      positions: [
        [0, 0],
        [0, 2],
      ],
    },
  ],
  solution: [
    {
      id: 1,
      path: [
        [0, 0],
        [0, 1],
        [0, 2],
      ],
    },
  ],
};

describe('pickRandomStage', () => {
  test('puzzlesが1件のときそのStageを返す', () => {
    const file: PuzzleFile = { puzzles: [sampleStage] };
    const picked = pickRandomStage(file, () => 0);
    expect(picked).toBe(sampleStage);
  });

  test('rngに応じてpuzzles内の異なるStageを返す', () => {
    const s0: Stage = { size: 3, numbers: [], solution: [] };
    const s1: Stage = { size: 4, numbers: [], solution: [] };
    const s2: Stage = { size: 5, numbers: [], solution: [] };
    const file: PuzzleFile = { puzzles: [s0, s1, s2] };
    const picked = pickRandomStage(file, () => 0.5);
    expect(picked).toBe(s1);
  });

  test('puzzlesが空のときエラーを投げる', () => {
    const file: PuzzleFile = { puzzles: [] };
    expect(() => pickRandomStage(file)).toThrow();
  });
});

describe('loadStage', () => {
  test('指定サイズのJSONをfetchしてStageを返す', async () => {
    const file: PuzzleFile = { puzzles: [sampleStage] };
    const fetchFn = async (url: string): Promise<Response> => {
      expect(url).toContain('6x6.json');
      return new Response(JSON.stringify(file), { status: 200 });
    };

    const result = await loadStage(6, '', fetchFn as typeof fetch, () => 0);

    expect(result.size).toBe(sampleStage.size);
    expect(result.numbers).toEqual(sampleStage.numbers);
    expect(result.solution).toEqual(sampleStage.solution);
  });

  test('basePathを付けて numberlink サブディレクトリから fetch する', async () => {
    const file: PuzzleFile = { puzzles: [sampleStage] };
    let receivedUrl = '';
    const fetchFn = async (url: string): Promise<Response> => {
      receivedUrl = url;
      return new Response(JSON.stringify(file), { status: 200 });
    };

    await loadStage(4, '/puzzle', fetchFn as typeof fetch, () => 0);

    expect(receivedUrl).toBe('/puzzle/puzzles/numberlink/4x4.json');
  });
});
