export type Color = 'black' | 'white';

export type CellState = Color | null;

export type Board = CellState[][];

export type Position = [number, number];

export type Difficulty = 'easy' | 'normal' | 'hard';

export type GameMode = 'pvp' | 'pve' | 'eve';

export interface GameState {
  board: Board;
  currentColor: Color;
  gameOver: boolean;
  passed: boolean;
  lastMove: Position | null;
  flipped: Position[];
}

export interface AIConfig {
  maxTime: number;
  maxDepth: number;
}
