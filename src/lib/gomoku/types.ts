export type Color = 'black' | 'white';

export type CellState = Color | null;

export type Board = CellState[][];

export type Position = [number, number];

export const BOARD_SIZE = 15;

export interface GameState {
  board: Board;
  currentColor: Color;
  gameOver: boolean;
  winner: Color | null;
  lastMove: Position | null;
  forbiddenRule: boolean;
}

export interface AIConfig {
  maxTime: number;
  maxDepth: number;
}

export interface HardMoveResult {
  move: Position;
  depth: number;
}

export type Difficulty = 'weakest' | 'easy' | 'normal' | 'hard';

export type GameMode = 'pvp' | 'pve' | 'eve';
