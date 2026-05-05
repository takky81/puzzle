import { describe, test, expect } from 'vitest';
import type { PuzzleEntry } from './types';
import { pickRandomStage, loadStage, loadPuzzleList, type PuzzleFile } from './stageLoader';

const sampleEntry: PuzzleEntry = {
  id: 'abc123',
  k: 1,
  difficulty: 5,
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
  test('puzzlesが1件のときそのEntryを返す', () => {
    const file: PuzzleFile = { puzzles: [sampleEntry] };
    const picked = pickRandomStage(file, () => 0);
    expect(picked).toBe(sampleEntry);
  });

  test('rngに応じてpuzzles内の異なるEntryを返す', () => {
    const s0: PuzzleEntry = { id: 'a', k: 1, difficulty: 1, size: 3, numbers: [], solution: [] };
    const s1: PuzzleEntry = { id: 'b', k: 1, difficulty: 2, size: 4, numbers: [], solution: [] };
    const s2: PuzzleEntry = { id: 'c', k: 1, difficulty: 3, size: 5, numbers: [], solution: [] };
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
  test('指定サイズのJSONをfetchしてEntryを返す', async () => {
    const file: PuzzleFile = { puzzles: [sampleEntry] };
    const fetchFn = async (url: string): Promise<Response> => {
      expect(url).toContain('6x6.json');
      return new Response(JSON.stringify(file), { status: 200 });
    };

    const result = await loadStage(6, '', fetchFn as typeof fetch, () => 0);

    expect(result.size).toBe(sampleEntry.size);
    expect(result.numbers).toEqual(sampleEntry.numbers);
    expect(result.solution).toEqual(sampleEntry.solution);
  });

  test('basePathを付けて numberlink サブディレクトリから fetch する', async () => {
    const file: PuzzleFile = { puzzles: [sampleEntry] };
    let receivedUrl = '';
    const fetchFn = async (url: string): Promise<Response> => {
      receivedUrl = url;
      return new Response(JSON.stringify(file), { status: 200 });
    };

    await loadStage(4, '/puzzle', fetchFn as typeof fetch, () => 0);

    expect(receivedUrl).toBe('/puzzle/puzzles/numberlink/4x4.json');
  });
});

describe('loadPuzzleList', () => {
  test('難易度昇順（易しい順）でエントリ一覧を返す', async () => {
    const hard: PuzzleEntry = {
      id: 'h',
      k: 3,
      difficulty: 100,
      size: 4,
      numbers: [],
      solution: [],
    };
    const easy: PuzzleEntry = { id: 'e', k: 2, difficulty: 10, size: 4, numbers: [], solution: [] };
    const mid: PuzzleEntry = { id: 'm', k: 2, difficulty: 50, size: 4, numbers: [], solution: [] };
    const file: PuzzleFile = { puzzles: [hard, mid, easy] };
    const fetchFn = async (): Promise<Response> =>
      new Response(JSON.stringify(file), { status: 200 });

    const result = await loadPuzzleList(4, '', fetchFn as typeof fetch);

    expect(result[0].id).toBe('e');
    expect(result[1].id).toBe('m');
    expect(result[2].id).toBe('h');
  });

  test('指定サイズの {N}x{N}.json を fetch する', async () => {
    const file: PuzzleFile = { puzzles: [sampleEntry] };
    let receivedUrl = '';
    const fetchFn = async (url: string): Promise<Response> => {
      receivedUrl = url;
      return new Response(JSON.stringify(file), { status: 200 });
    };

    await loadPuzzleList(5, '/base', fetchFn as typeof fetch);

    expect(receivedUrl).toBe('/base/puzzles/numberlink/5x5.json');
  });

  test('puzzlesが空のとき空配列を返す', async () => {
    const file: PuzzleFile = { puzzles: [] };
    const fetchFn = async (): Promise<Response> =>
      new Response(JSON.stringify(file), { status: 200 });

    const result = await loadPuzzleList(4, '', fetchFn as typeof fetch);

    expect(result).toEqual([]);
  });
});
