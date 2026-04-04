import type { Board, Difficulty, Direction, GameState, SlideResult } from './types';

function createEmptyBoard(): Board {
  return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 0));
}

function getEmptyCells(board: Board): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (board[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

function slideRowLeft(row: number[]): {
  newRow: number[];
  score: number;
  mergedFlags: boolean[];
} {
  // 0を除去して詰める
  const filtered = row.filter((v) => v !== 0);
  const newRow: number[] = [];
  const mergedFlags: boolean[] = [];
  let score = 0;

  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const merged = filtered[i] * 2;
      newRow.push(merged);
      mergedFlags.push(true);
      score += merged;
      i++; // 合体した次のタイルをスキップ
    } else {
      newRow.push(filtered[i]);
      mergedFlags.push(false);
    }
  }

  // 残りを0で埋める
  while (newRow.length < 4) {
    newRow.push(0);
    mergedFlags.push(false);
  }

  return { newRow, score, mergedFlags };
}

function rotateGridCW<T>(grid: T[][]): T[][] {
  const n = grid.length;
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => grid[n - 1 - c][r]),
  );
}

function rotateGridCCW<T>(grid: T[][]): T[][] {
  const n = grid.length;
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => grid[c][n - 1 - r]),
  );
}

function rotateGrid180<T>(grid: T[][]): T[][] {
  return grid.map((row) => [...row].reverse()).reverse();
}

export function slide(board: Board, direction: Direction): SlideResult {
  // 全方向を「左スライド」に変換して処理する
  let rotated: Board;
  if (direction === 'left') {
    rotated = board.map((row) => [...row]);
  } else if (direction === 'right') {
    rotated = rotateGrid180(board);
  } else if (direction === 'up') {
    rotated = rotateGridCCW(board);
  } else {
    rotated = rotateGridCW(board);
  }

  let totalScore = 0;
  const result: Board = [];
  const mergedResult: boolean[][] = [];
  for (const row of rotated) {
    const { newRow, score, mergedFlags } = slideRowLeft(row);
    result.push(newRow);
    mergedResult.push(mergedFlags);
    totalScore += score;
  }

  // 元の向きに戻す
  let finalBoard: Board;
  let finalMerged: boolean[][];
  if (direction === 'left') {
    finalBoard = result;
    finalMerged = mergedResult;
  } else if (direction === 'right') {
    finalBoard = rotateGrid180(result);
    finalMerged = mergedResult.map((row) => [...row].reverse()).reverse();
  } else if (direction === 'up') {
    finalBoard = rotateGridCW(result);
    finalMerged = rotateGridCW(mergedResult);
  } else {
    finalBoard = rotateGridCCW(result);
    finalMerged = rotateGridCCW(mergedResult);
  }

  const moved = board.some((row, r) => row.some((val, c) => val !== finalBoard[r][c]));

  return { board: finalBoard, score: totalScore, moved, merged: finalMerged };
}

function chooseValue(difficulty: Difficulty): number {
  if (difficulty === 'easy') return 2;
  const threshold = difficulty === 'random' ? 0.9 : 0.6;
  return Math.random() < threshold ? 2 : 4;
}

function countMovableDirections(board: Board): number {
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  return directions.filter((d) => slide(board, d).moved).length;
}

function choosePositionEasy(board: Board, empty: [number, number][]): [number, number] {
  const value = 2; // Easyは常に2
  // 隣接セルに同じ値のタイルがある空きマスを優先
  const adjacent = empty.filter(([r, c]) => {
    const neighbors = [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ];
    return neighbors.some(
      ([nr, nc]) => nr >= 0 && nr < 4 && nc >= 0 && nc < 4 && board[nr][nc] === value,
    );
  });
  const candidates = adjacent.length > 0 ? adjacent : empty;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function canMergeNextTurn(board: Board, r: number, c: number, value: number): boolean {
  const neighbors: [number, number][] = [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ];
  return neighbors.some(
    ([nr, nc]) => nr >= 0 && nr < 4 && nc >= 0 && nc < 4 && board[nr][nc] === value,
  );
}

function adjacentSum(board: Board, r: number, c: number): number {
  const neighbors: [number, number][] = [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ];
  let sum = 0;
  for (const [nr, nc] of neighbors) {
    if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4) {
      if (board[nr][nc] !== 0) {
        sum += board[nr][nc];
      } else {
        // 空きマスがある場合はその先の隣接タイルを参照
        const dr = nr - r;
        const dc = nc - c;
        let sr = nr + dr;
        let sc = nc + dc;
        while (sr >= 0 && sr < 4 && sc >= 0 && sc < 4 && board[sr][sc] === 0) {
          sr += dr;
          sc += dc;
        }
        if (sr >= 0 && sr < 4 && sc >= 0 && sc < 4) {
          sum += board[sr][sc];
        }
      }
    }
  }
  return sum;
}

function choosePositionHard(
  board: Board,
  empty: [number, number][],
  value: number,
): [number, number] {
  // Criteria #1: 動かせる方向が最も少なくなる位置
  let bestPositions: [number, number][] = [];
  let minDirections = 5;

  for (const [r, c] of empty) {
    const testBoard = board.map((row) => [...row]);
    testBoard[r][c] = value;
    const dirs = countMovableDirections(testBoard);
    if (dirs < minDirections) {
      minDirections = dirs;
      bestPositions = [[r, c]];
    } else if (dirs === minDirections) {
      bestPositions.push([r, c]);
    }
  }

  if (bestPositions.length <= 1) {
    return bestPositions[0];
  }

  // Criteria #2: マージできない位置を優先
  const nonMergeable = bestPositions.filter(([r, c]) => !canMergeNextTurn(board, r, c, value));
  if (nonMergeable.length > 0) {
    bestPositions = nonMergeable;
  }

  if (bestPositions.length <= 1) {
    return bestPositions[0];
  }

  // Criteria #3: 隣接タイルの合計値が大きい位置
  let maxSum = -1;
  let finalPositions: [number, number][] = [];
  for (const [r, c] of bestPositions) {
    const sum = adjacentSum(board, r, c);
    if (sum > maxSum) {
      maxSum = sum;
      finalPositions = [[r, c]];
    } else if (sum === maxSum) {
      finalPositions.push([r, c]);
    }
  }

  return finalPositions[Math.floor(Math.random() * finalPositions.length)];
}

export function addRandomTile(board: Board, difficulty: Difficulty): Board {
  const empty = getEmptyCells(board);
  if (empty.length === 0) return board;

  const value = chooseValue(difficulty);
  let position: [number, number];

  if (difficulty === 'easy') {
    position = choosePositionEasy(board, empty);
  } else if (difficulty === 'hard') {
    position = choosePositionHard(board, empty, value);
  } else {
    position = empty[Math.floor(Math.random() * empty.length)];
  }

  const newBoard = board.map((row) => [...row]);
  newBoard[position[0]][position[1]] = value;
  return newBoard;
}

export function checkWin(board: Board): boolean {
  return board.some((row) => row.some((cell) => cell >= 2048));
}

export function checkGameOver(board: Board): boolean {
  // 空きマスがあればゲームオーバーでない
  if (board.some((row) => row.some((cell) => cell === 0))) return false;
  // 隣接する同じタイルがあればゲームオーバーでない
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = board[r][c];
      if (r + 1 < 4 && board[r + 1][c] === val) return false;
      if (c + 1 < 4 && board[r][c + 1] === val) return false;
    }
  }
  return true;
}

export function moveAndAddTile(state: GameState, direction: Direction): GameState {
  const result = slide(state.board, direction);
  if (!result.moved) return state;

  const newBoard = addRandomTile(result.board, state.difficulty);
  const newScore = state.score + result.score;

  // 新タイルの位置を特定
  let newTilePos: [number, number] | null = null;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (result.board[r][c] === 0 && newBoard[r][c] !== 0) {
        newTilePos = [r, c];
      }
    }
  }

  return {
    ...state,
    board: newBoard,
    score: newScore,
    bestScore: Math.max(state.bestScore, newScore),
    isGameOver: checkGameOver(newBoard),
    isWin: checkWin(newBoard),
    history: [...state.history, { board: state.board, score: state.score }],
    future: [],
    lastMerged: result.merged,
    lastNewTile: newTilePos,
  };
}

export function undo(state: GameState): GameState {
  if (state.history.length === 0) return state;

  const previous = state.history[state.history.length - 1];
  return {
    ...state,
    board: previous.board,
    score: previous.score,
    history: state.history.slice(0, -1),
    future: [...state.future, { board: state.board, score: state.score }],
  };
}

export function redo(state: GameState): GameState {
  if (state.future.length === 0) return state;

  const next = state.future[state.future.length - 1];
  return {
    ...state,
    board: next.board,
    score: next.score,
    history: [...state.history, { board: state.board, score: state.score }],
    future: state.future.slice(0, -1),
  };
}

export function changeDifficulty(state: GameState, difficulty: Difficulty): GameState {
  return { ...state, difficulty };
}

export function initGame(): GameState {
  let board = createEmptyBoard();
  board = addRandomTile(board, 'random');
  board = addRandomTile(board, 'random');
  return {
    board,
    score: 0,
    bestScore: 0,
    isGameOver: false,
    isWin: false,
    difficulty: 'random',
    history: [],
    future: [],
    lastMerged: null,
    lastNewTile: null,
  };
}
