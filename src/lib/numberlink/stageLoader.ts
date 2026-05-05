import type { PuzzleEntry, Stage } from './types';

export interface PuzzleFile {
  puzzles: PuzzleEntry[];
}

async function fetchPuzzleFile(
  size: number,
  basePath: string,
  fetchFn: typeof fetch,
): Promise<PuzzleFile> {
  const res = await fetchFn(`${basePath}/puzzles/numberlink/${size}x${size}.json`);
  return (await res.json()) as PuzzleFile;
}

export function pickRandomStage(file: PuzzleFile, rng: () => number = Math.random): PuzzleEntry {
  if (file.puzzles.length === 0) {
    throw new Error('No puzzles available');
  }
  const i = Math.floor(rng() * file.puzzles.length);
  return file.puzzles[i];
}

export async function loadStage(
  size: number,
  basePath: string,
  fetchFn: typeof fetch = fetch,
  rng: () => number = Math.random,
): Promise<Stage> {
  const file = await fetchPuzzleFile(size, basePath, fetchFn);
  return pickRandomStage(file, rng);
}

export async function loadPuzzleList(
  size: number,
  basePath: string,
  fetchFn: typeof fetch = fetch,
): Promise<PuzzleEntry[]> {
  const file = await fetchPuzzleFile(size, basePath, fetchFn);
  return file.puzzles.sort((a, b) => a.difficulty - b.difficulty);
}
