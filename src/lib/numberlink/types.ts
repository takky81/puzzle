export type Position = [number, number];

export interface NumberPair {
  id: number;
  positions: [Position, Position];
}

export interface PathSolution {
  id: number;
  path: Position[];
}

export interface Stage {
  size: number;
  numbers: NumberPair[];
  solution: PathSolution[];
}

export interface PuzzleEntry extends Stage {
  id: string;
  k: number;
  difficulty: number;
}

export interface NumberPath {
  id: number;
  cells: Position[];
}

export interface Stroke {
  before: NumberPath[];
  after: NumberPath[];
}

export interface GameState {
  stage: Stage;
  paths: NumberPath[];
  isCleared: boolean;
  history: Stroke[];
  future: Stroke[];
  activeId: number | null;
  pendingStroke: Stroke | null;
}
