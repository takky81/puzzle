export type Board = number[][];

export type Direction = 'up' | 'down' | 'left' | 'right';

export type Difficulty = 'easy' | 'random' | 'hard';

export interface GameState {
  board: Board;
  score: number;
  bestScore: number;
  isGameOver: boolean;
  isWin: boolean;
  difficulty: Difficulty;
  history: HistoryEntry[];
  future: HistoryEntry[];
  lastMerged: boolean[][] | null;
  lastNewTile: [number, number] | null;
}

export interface HistoryEntry {
  board: Board;
  score: number;
}

export interface SlideResult {
  board: Board;
  score: number;
  moved: boolean;
  merged: boolean[][];
}
