export type CellType = 'path' | 'wall';

export type Position = [number, number];

export type Edge = [Position, Position];

export type Grid = CellType[][];

export type Stroke = {
  added: Edge[];
  removed: Edge[];
};

export interface GameState {
  grid: Grid;
  edges: Edge[];
  isCleared: boolean;
  history: Stroke[];
  future: Stroke[];
  solution: Edge[];
  pendingStroke: Stroke;
}

export interface Stage {
  grid: Grid;
  solution: Edge[];
}
