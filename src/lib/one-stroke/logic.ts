import type { Grid, GameState, Position, Edge } from './types';

export function posKey(p: Position): string {
  return `${p[0]},${p[1]}`;
}

export function keyToPos(key: string): Position {
  const [r, c] = key.split(',').map(Number);
  return [r, c] as Position;
}

const DIRECTIONS: Position[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

export function getNeighbors(grid: Grid, pos: Position): Position[] {
  const result: Position[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const nr = pos[0] + dr;
    const nc = pos[1] + dc;
    if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length && grid[nr][nc] === 'path') {
      result.push([nr, nc]);
    }
  }
  return result;
}

export function createGrid(rows: number = 8, cols: number = 8): Grid {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'path' as const));
}

export function createGame(grid: Grid, solution: Edge[]): GameState {
  return {
    grid,
    edges: [],
    isCleared: false,
    history: [],
    future: [],
    solution,
    pendingStroke: { added: [], removed: [] },
  };
}

export function getPathCells(grid: Grid): Position[] {
  const cells: Position[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === 'path') {
        cells.push([r, c]);
      }
    }
  }
  return cells;
}

export function isAdjacent(grid: Grid, a: Position, b: Position): boolean {
  return getNeighbors(grid, a).some((n) => n[0] === b[0] && n[1] === b[1]);
}

export function normalizeEdge(edge: Edge): Edge {
  const [[r1, c1], [r2, c2]] = edge;
  if (r1 < r2 || (r1 === r2 && c1 <= c2)) {
    return [
      [r1, c1],
      [r2, c2],
    ];
  }
  return [
    [r2, c2],
    [r1, c1],
  ];
}

export function edgeKey(edge: Edge): string {
  const [[r1, c1], [r2, c2]] = normalizeEdge(edge);
  return `${r1},${c1}-${r2},${c2}`;
}

function edgesEqual(a: Edge, b: Edge): boolean {
  const na = normalizeEdge(a);
  const nb = normalizeEdge(b);
  return (
    na[0][0] === nb[0][0] && na[0][1] === nb[0][1] && na[1][0] === nb[1][0] && na[1][1] === nb[1][1]
  );
}

export function hasEdge(edges: Edge[], edge: Edge): boolean {
  return edges.some((e) => edgesEqual(e, edge));
}

function edgeCountAt(edges: Edge[], pos: Position): number {
  let count = 0;
  for (const e of edges) {
    if ((e[0][0] === pos[0] && e[0][1] === pos[1]) || (e[1][0] === pos[0] && e[1][1] === pos[1])) {
      count++;
      if (count >= 2) return count;
    }
  }
  return count;
}

function getVisitedNodes(edges: Edge[]): Set<string> {
  const visited = new Set<string>();
  for (const edge of edges) {
    visited.add(posKey(edge[0]));
    visited.add(posKey(edge[1]));
  }
  return visited;
}

function isConnectedCycle(edges: Edge[]): boolean {
  if (edges.length === 0) return false;

  const adj = new Map<string, Position[]>();
  for (const [a, b] of edges) {
    const ka = posKey(a);
    const kb = posKey(b);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka)!.push(b);
    adj.get(kb)!.push(a);
  }

  for (const [, neighbors] of adj) {
    if (neighbors.length !== 2) return false;
  }

  const startKey = adj.keys().next().value!;
  const visited = new Set<string>();
  const queue = [startKey];
  visited.add(startKey);
  while (queue.length > 0) {
    const key = queue.pop()!;
    for (const nbr of adj.get(key) ?? []) {
      const nk = posKey(nbr);
      if (!visited.has(nk)) {
        visited.add(nk);
        queue.push(nk);
      }
    }
  }

  return visited.size === adj.size;
}

function checkCleared(state: GameState): boolean {
  const pathCount = getPathCount(state.grid);
  const visitedCount = getVisitedNodes(state.edges).size;
  if (visitedCount < pathCount) return false;
  return isConnectedCycle(state.edges);
}

export function toggleEdge(state: GameState, from: Position, to: Position): GameState {
  if (!isAdjacent(state.grid, from, to)) return state;

  const edge: Edge = [from, to];

  // 既存エッジなら削除
  if (hasEdge(state.edges, edge)) {
    const newEdges = state.edges.filter((e) => !edgesEqual(e, edge));
    return {
      ...state,
      edges: newEdges,
      pendingStroke: {
        ...state.pendingStroke,
        removed: [...state.pendingStroke.removed, normalizeEdge(edge)],
      },
      isCleared: false,
    };
  }

  // 両端が2本未満ならエッジ追加
  if (edgeCountAt(state.edges, from) >= 2 || edgeCountAt(state.edges, to) >= 2) {
    return state;
  }

  const newEdges = [...state.edges, normalizeEdge(edge)];
  return {
    ...state,
    edges: newEdges,
    pendingStroke: {
      ...state.pendingStroke,
      added: [...state.pendingStroke.added, normalizeEdge(edge)],
    },
    isCleared: false,
  };
}

export function endStroke(state: GameState): GameState {
  if (state.pendingStroke.added.length === 0 && state.pendingStroke.removed.length === 0) {
    return state;
  }

  const newState: GameState = {
    ...state,
    history: [...state.history, state.pendingStroke],
    future: [],
    pendingStroke: { added: [], removed: [] },
    isCleared: false,
  };
  newState.isCleared = checkCleared(newState);
  return newState;
}

export function undo(state: GameState): GameState {
  if (state.history.length === 0) return state;

  const stroke = state.history[state.history.length - 1];
  let edges = [...state.edges];

  for (const edge of stroke.added) {
    edges = edges.filter((e) => !edgesEqual(e, edge));
  }
  for (const edge of stroke.removed) {
    edges.push(edge);
  }

  const newState: GameState = {
    ...state,
    edges,
    history: state.history.slice(0, -1),
    future: [stroke, ...state.future],
    pendingStroke: { added: [], removed: [] },
    isCleared: false,
  };
  newState.isCleared = checkCleared(newState);
  return newState;
}

export function redo(state: GameState): GameState {
  if (state.future.length === 0) return state;

  const stroke = state.future[0];
  let edges = [...state.edges];

  for (const edge of stroke.added) {
    edges.push(edge);
  }
  for (const edge of stroke.removed) {
    edges = edges.filter((e) => !edgesEqual(e, edge));
  }

  const newState: GameState = {
    ...state,
    edges,
    history: [...state.history, stroke],
    future: state.future.slice(1),
    pendingStroke: { added: [], removed: [] },
    isCleared: false,
  };
  newState.isCleared = checkCleared(newState);
  return newState;
}

export function resetGame(state: GameState): GameState {
  return createGame(state.grid, state.solution);
}

export function getVisitedCount(state: GameState): number {
  return getVisitedNodes(state.edges).size;
}

export function getPathCount(grid: Grid): number {
  return getPathCells(grid).length;
}

export function getMessage(
  state: GameState,
  visitedCount?: number,
  pathCount?: number,
): string | null {
  if (state.isCleared) return 'クリア！';

  const visited = visitedCount ?? getVisitedNodes(state.edges).size;
  const total = pathCount ?? getPathCount(state.grid);
  if (visited >= total) {
    return '全マス通過！1つの輪にしましょう';
  }

  return null;
}
