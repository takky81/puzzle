import type { Stage } from './types';

export interface PuzzleFile {
  puzzles: Stage[];
}

export function pickRandomStage(file: PuzzleFile, rng: () => number = Math.random): Stage {
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
  const res = await fetchFn(`${basePath}/puzzles/one-stroke/${size}x${size}.json`);
  const file = (await res.json()) as PuzzleFile;
  return pickRandomStage(file, rng);
}
