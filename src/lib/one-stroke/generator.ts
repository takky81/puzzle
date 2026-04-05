import type { Grid, Edge, Stage } from './types';
import { createGrid, getPathCells, getNeighbors, posKey, keyToPos } from './logic';

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function canHaveCycle(grid: Grid): boolean {
  const pathCells = getPathCells(grid);
  if (pathCells.length < 4 || pathCells.length % 2 !== 0) return false;

  // 全マスが隣接2以上
  for (const cell of pathCells) {
    if (getNeighbors(grid, cell).length < 2) return false;
  }

  // 全連結チェック（BFS）
  const visited = new Set<string>();
  const queue = [pathCells[0]];
  visited.add(posKey(pathCells[0]));
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const nbr of getNeighbors(grid, current)) {
      const key = posKey(nbr);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(nbr);
      }
    }
  }
  return visited.size === pathCells.length;
}

function findOneCycle(grid: Grid): Edge[] | null {
  const state = createSolverState(grid);
  if (!state) return null;
  if (!propagate(state)) return null;
  if (isComplete(state)) return stateToEdges(state);

  // 分岐: 最初に見つかった解を返す
  function search(s: SolverState): Edge[] | null {
    const bestKey = pickBranchNode(s);
    if (!bestKey) return null;

    const availList = shuffle([...s.available.get(bestKey)!]);
    for (const nbr of availList) {
      const branch = cloneSolverState(s);
      if (!confirmEdge(branch, bestKey, nbr)) continue;
      if (!propagate(branch)) continue;
      if (isComplete(branch)) return stateToEdges(branch);
      const result = search(branch);
      if (result) return result;
    }
    return null;
  }

  return search(state);
}

export function generateHamiltonianCycle(grid: Grid): Edge[] | null {
  return findOneCycle(grid);
}

export type SolveResult =
  | { type: 'unique'; edges: Edge[] }
  | { type: 'none' }
  | { type: 'multiple' };

interface SolverState {
  nodeKeys: string[];
  confirmed: Map<string, Set<string>>;
  available: Map<string, Set<string>>;
  totalNodes: number;
}

function createSolverState(grid: Grid): SolverState | null {
  const pathCells = getPathCells(grid);
  if (pathCells.length < 4 || pathCells.length % 2 !== 0) return null;

  const nodeKeys = pathCells.map(posKey);
  const confirmed = new Map<string, Set<string>>();
  const available = new Map<string, Set<string>>();

  for (const cell of pathCells) {
    const key = posKey(cell);
    confirmed.set(key, new Set());
    const nbrs = new Set<string>();
    for (const nbr of getNeighbors(grid, cell)) {
      nbrs.add(posKey(nbr));
    }
    if (nbrs.size < 2) return null; // プレチェック: 隣接2未満なら閉路不可能
    available.set(key, nbrs);
  }

  return { nodeKeys, confirmed, available, totalNodes: pathCells.length };
}

function cloneSolverState(s: SolverState): SolverState {
  const confirmed = new Map<string, Set<string>>();
  const available = new Map<string, Set<string>>();
  for (const [k, v] of s.confirmed) confirmed.set(k, new Set(v));
  for (const [k, v] of s.available) available.set(k, new Set(v));
  return { nodeKeys: s.nodeKeys, confirmed, available, totalNodes: s.totalNodes };
}

function hasChainCycle(state: SolverState, node: string): boolean {
  if (state.confirmed.get(node)!.size < 2) return false;
  let current = node;
  let prev = '';
  let length = 0;
  while (true) {
    length++;
    const edges = state.confirmed.get(current)!;
    let next = '';
    for (const e of edges) {
      if (e !== prev) {
        next = e;
        break;
      }
    }
    if (!next) return false;
    if (next === node) return length < state.totalNodes;
    prev = current;
    current = next;
    if (length > state.totalNodes) return false;
  }
}

function confirmEdge(state: SolverState, a: string, b: string): boolean {
  if (state.confirmed.get(a)!.has(b)) return true;
  if (state.confirmed.get(a)!.size >= 2 || state.confirmed.get(b)!.size >= 2) return false;

  state.confirmed.get(a)!.add(b);
  state.confirmed.get(b)!.add(a);
  state.available.get(a)!.delete(b);
  state.available.get(b)!.delete(a);

  if (state.confirmed.get(a)!.size === 2) {
    for (const [key, avail] of state.available) {
      if (key !== a) avail.delete(a);
    }
    state.available.get(a)!.clear();
  }
  if (state.confirmed.get(b)!.size === 2) {
    for (const [key, avail] of state.available) {
      if (key !== b) avail.delete(b);
    }
    state.available.get(b)!.clear();
  }

  // 早期閉路チェック
  if (hasChainCycle(state, a)) return false;

  return true;
}

function propagate(state: SolverState): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of state.nodeKeys) {
      const confirmedCount = state.confirmed.get(key)!.size;
      const availCount = state.available.get(key)!.size;
      const needed = 2 - confirmedCount;

      if (needed === 0) continue;
      if (availCount < needed) return false;

      if (availCount === needed) {
        const toConfirm = [...state.available.get(key)!];
        for (const nbr of toConfirm) {
          if (!confirmEdge(state, key, nbr)) return false;
        }
        changed = true;
      }
    }
  }
  return true;
}

function isComplete(state: SolverState): boolean {
  for (const key of state.nodeKeys) {
    if (state.confirmed.get(key)!.size !== 2) return false;
  }
  return true;
}

function pickBranchNode(state: SolverState): string | null {
  let bestKey: string | null = null;
  let bestCount = Infinity;
  for (const key of state.nodeKeys) {
    if (state.confirmed.get(key)!.size >= 2) continue;
    const avail = state.available.get(key)!.size;
    if (avail > 0 && avail < bestCount) {
      bestCount = avail;
      bestKey = key;
    }
  }
  return bestKey;
}

function stateToEdges(state: SolverState): Edge[] {
  const start = state.nodeKeys[0];
  const edges: Edge[] = [];
  let current = start;
  let prev = '';
  for (let i = 0; i < state.totalNodes; i++) {
    const nbrs = [...state.confirmed.get(current)!];
    const next = nbrs.find((n) => n !== prev) ?? nbrs[0];
    edges.push([keyToPos(current), keyToPos(next)]);
    prev = current;
    current = next;
  }
  return edges;
}

function solveRecursive(state: SolverState): SolveResult {
  if (!propagate(state)) return { type: 'none' };
  if (isComplete(state)) return { type: 'unique', edges: stateToEdges(state) };

  const bestKey = pickBranchNode(state);
  if (!bestKey) return { type: 'none' };

  let foundOne: Edge[] | null = null;
  for (const nbr of state.available.get(bestKey)!) {
    const branch = cloneSolverState(state);
    if (!confirmEdge(branch, bestKey, nbr)) continue;
    const result = solveRecursive(branch);
    if (result.type === 'multiple') return { type: 'multiple' };
    if (result.type === 'unique') {
      if (foundOne) return { type: 'multiple' };
      foundOne = result.edges;
    }
  }

  if (foundOne) return { type: 'unique', edges: foundOne };
  return { type: 'none' };
}

export function solveCycle(grid: Grid): SolveResult {
  const state = createSolverState(grid);
  if (!state) return { type: 'none' };
  return solveRecursive(state);
}

export function isUniqueSolution(grid: Grid): boolean {
  return solveCycle(grid).type === 'unique';
}

function gridKey(grid: Grid): string {
  return grid.map((row) => row.map((c) => (c === 'wall' ? 'W' : '.')).join('')).join('|');
}

export function generateStage(
  rows: number,
  cols: number,
  onProgress?: (attempt: number) => void,
): Stage {
  const total = rows * cols;
  const noneCache = new Set<string>();

  for (let attempt = 0; attempt < 100000; attempt++) {
    if (onProgress && attempt % 100 === 0) {
      onProgress(attempt);
    }

    // ランダムに壁を配置
    const grid = createGrid(rows, cols);
    const wallCount = Math.floor(Math.random() * (total / 3));
    if (wallCount > 0) {
      const cells = shuffle(getPathCells(grid));
      for (let i = 0; i < wallCount && i < cells.length; i++) {
        grid[cells[i][0]][cells[i][1]] = 'wall';
      }
    }

    // 事前枝刈り: solveCycleを呼ぶ前に不可能な盤面を除外
    if (!canHaveCycle(grid)) continue;

    const key = gridKey(grid);
    if (noneCache.has(key)) continue;

    const result = solveCycle(grid);
    if (result.type === 'unique') {
      return { grid, solution: result.edges };
    }
    if (result.type === 'none') {
      noneCache.add(key);
    }
  }

  throw new Error('Failed to generate unique stage');
}
