import type { GameState, NumberPath, Position, Stage, Stroke } from './types';

export function createGame(stage: Stage): GameState {
  return {
    stage,
    paths: [],
    isCleared: false,
    history: [],
    future: [],
    activeId: null,
    pendingStroke: null,
  };
}

function numberCellId(state: GameState, pos: Position): number | null {
  for (const pair of state.stage.numbers) {
    for (const p of pair.positions) {
      if (p[0] === pos[0] && p[1] === pos[1]) return pair.id;
    }
  }
  return null;
}

export function startStroke(state: GameState, from: Position): GameState {
  const id = numberCellId(state, from);
  if (id !== null) {
    const otherPaths = state.paths.filter((p) => p.id !== id);
    return {
      ...state,
      paths: [...otherPaths, { id, cells: [from] }],
      activeId: id,
      pendingStroke: { before: state.paths, after: [] },
    };
  }
  for (const path of state.paths) {
    if (path.cells.length === 0) continue;
    const tip = path.cells[path.cells.length - 1];
    if (tip[0] === from[0] && tip[1] === from[1]) {
      return {
        ...state,
        activeId: path.id,
        pendingStroke: { before: state.paths, after: [] },
      };
    }
  }
  return state;
}

function pathsEqual(a: NumberPath[], b: NumberPath[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((p) => [p.id, p]));
  for (const p of a) {
    const q = byId.get(p.id);
    if (!q || q.cells.length !== p.cells.length) return false;
    for (let i = 0; i < p.cells.length; i++) {
      if (p.cells[i][0] !== q.cells[i][0] || p.cells[i][1] !== q.cells[i][1]) return false;
    }
  }
  return true;
}

function samePos(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function pairConnected(path: NumberPath | undefined, endpoints: [Position, Position]): boolean {
  if (!path || path.cells.length < 2) return false;
  const start = path.cells[0];
  const end = path.cells[path.cells.length - 1];
  const [a, b] = endpoints;
  return (samePos(start, a) && samePos(end, b)) || (samePos(start, b) && samePos(end, a));
}

export function resetGame(state: GameState): GameState {
  return createGame(state.stage);
}

export function getTotalPairs(state: GameState): number {
  return state.stage.numbers.length;
}

export function canUndo(state: GameState): boolean {
  return state.history.length > 0;
}

export function canRedo(state: GameState): boolean {
  return state.future.length > 0;
}

export function getConnectedCount(state: GameState): number {
  let count = 0;
  for (const pair of state.stage.numbers) {
    const path = state.paths.find((p) => p.id === pair.id);
    if (pairConnected(path, pair.positions)) count++;
  }
  return count;
}

function isCleared(state: GameState): boolean {
  const total = getTotalPairs(state);
  return total > 0 && getConnectedCount(state) === total;
}

export function undo(state: GameState): GameState {
  if (state.history.length === 0) return state;
  const stroke = state.history[state.history.length - 1];
  const next: GameState = {
    ...state,
    paths: stroke.before,
    history: state.history.slice(0, -1),
    future: [stroke, ...state.future],
    pendingStroke: null,
    activeId: null,
  };
  next.isCleared = isCleared(next);
  return next;
}

export function redo(state: GameState): GameState {
  if (state.future.length === 0) return state;
  const stroke = state.future[0];
  const next: GameState = {
    ...state,
    paths: stroke.after,
    history: [...state.history, stroke],
    future: state.future.slice(1),
    pendingStroke: null,
    activeId: null,
  };
  next.isCleared = isCleared(next);
  return next;
}

export function endStroke(state: GameState): GameState {
  if (!state.pendingStroke) return state;
  if (pathsEqual(state.pendingStroke.before, state.paths)) {
    return { ...state, pendingStroke: null, activeId: null };
  }
  const stroke: Stroke = { before: state.pendingStroke.before, after: state.paths };
  const next: GameState = {
    ...state,
    history: [...state.history, stroke],
    future: [],
    pendingStroke: null,
    activeId: null,
  };
  next.isCleared = isCleared(next);
  return next;
}

export function extend(state: GameState, to: Position): GameState {
  if (state.activeId === null) return state;
  const activeId = state.activeId;
  const activePath = state.paths.find((p) => p.id === activeId);
  if (!activePath || activePath.cells.length === 0) return state;

  const start = activePath.cells[0];
  const tip = activePath.cells[activePath.cells.length - 1];
  const isComplete =
    activePath.cells.length > 1 &&
    numberCellId(state, start) === activeId &&
    numberCellId(state, tip) === activeId;
  if (isComplete) return state;

  if (Math.abs(tip[0] - to[0]) + Math.abs(tip[1] - to[1]) !== 1) return state;

  const idx = activePath.cells.findIndex((c) => c[0] === to[0] && c[1] === to[1]);
  const newCells = idx >= 0 ? activePath.cells.slice(0, idx + 1) : [...activePath.cells, to];

  const newPaths = state.paths.map((p) => {
    if (p.id === activeId) return { id: p.id, cells: newCells };
    const otherIdx = p.cells.findIndex((c) => c[0] === to[0] && c[1] === to[1]);
    if (otherIdx >= 0) {
      return { id: p.id, cells: p.cells.slice(0, otherIdx) };
    }
    return p;
  });
  return { ...state, paths: newPaths };
}

export function cellOwner(state: GameState, pos: Position): number | null {
  const numId = numberCellId(state, pos);
  if (numId !== null) return numId;
  for (const path of state.paths) {
    for (const c of path.cells) {
      if (c[0] === pos[0] && c[1] === pos[1]) return path.id;
    }
  }
  return null;
}
