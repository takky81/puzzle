import type { Rng } from '$lib/bingo/types';

/**
 * テスト用のシード付き擬似乱数生成器（mulberry32）。
 * 同じシードからは常に同じ乱数列が得られるため、カード生成や抽選を再現できる。
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
