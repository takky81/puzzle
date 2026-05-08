export type Vec2 = { x: number; y: number };

export type Rect = { x: number; y: number; width: number; height: number };

export type Field = {
  width: number;
  height: number;
  goalWidth: number;
  goalDepth: number;
};

export type GameMode = 'vs-ai' | '2p';

export type PlayerInput = {
  paddleTarget: Vec2;
  grabbing: boolean;
};

export type AIConfig = {
  speed: number;
  predictionBounces: number;
  reactionDelayMs: number;
  targetNoiseRadius: number;
};

export type GameConfig = {
  puckRadius: number;
  paddleRadius: number;
  goalWidthRatio: number;
  restitution: number;
  friction: number;
  puckInitialSpeed: number;
  winScore: number;
  puckResetAngleMax: number;
  ai: AIConfig;
};

export type ConfigTemplate = {
  name: string;
  config: GameConfig;
};

export type AIDifficulty = 'easy' | 'normal' | 'hard' | 'custom';

export type Puck = {
  pos: Vec2;
  vel: Vec2;
  radius: number;
};

export type Paddle = {
  pos: Vec2;
  vel: Vec2;
  radius: number;
};

export type GameState = {
  mode: GameMode;
  puck: Puck;
  player1: Paddle;
  player2: Paddle;
  score: { p1: number; p2: number };
  phase: 'countdown' | 'playing' | 'grabbed' | 'goal' | 'paused' | 'finished';
  countdownValue: 3 | 2 | 1 | 0;
  countdownTimer: number;
  goalTimer: number;
  lastScorer: 1 | 2 | null;
  winner: 1 | 2 | null;
  config: GameConfig;
};
