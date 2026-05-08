import type {
  GameConfig,
  GameState,
  GameMode,
  PlayerInput,
  AIConfig,
  AIDifficulty,
  Field,
  Rect,
  Paddle,
} from './types';
import {
  movePuck,
  reflectWalls,
  reflectGoalposts,
  collidePaddlePuck,
  clampPaddleToZone,
} from './physics';

export const DIFFICULTY_PRESETS: Record<Exclude<AIDifficulty, 'custom'>, AIConfig> = {
  easy: { speed: 200, predictionBounces: 0, reactionDelayMs: 300, targetNoiseRadius: 60 },
  normal: { speed: 350, predictionBounces: 1, reactionDelayMs: 100, targetNoiseRadius: 30 },
  hard: { speed: 500, predictionBounces: 2, reactionDelayMs: 0, targetNoiseRadius: 0 },
};

export function defaultConfig(): GameConfig {
  return {
    puckRadius: 18,
    paddleRadius: 35,
    goalWidthRatio: 1 / 3,
    restitution: 1.0,
    friction: 0.998,
    puckInitialSpeed: 250,
    winScore: 7,
    puckResetAngleMax: 10,
    ai: DIFFICULTY_PRESETS.normal,
  };
}

export function makeField(config: GameConfig): Field {
  const width = 400;
  const height = 600;
  return { width, height, goalWidth: config.goalWidthRatio * width, goalDepth: 30 };
}

export function createInitialState(mode: GameMode, config: GameConfig): GameState {
  const field = makeField(config);
  const { vx, vy } = randomPuckVelocity(config, Math.random() < 0.5 ? 1 : -1);

  return {
    mode,
    puck: {
      pos: { x: field.width / 2, y: field.height / 2 },
      vel: { x: vx, y: vy },
      radius: config.puckRadius,
    },
    player1: {
      pos: { x: field.width / 2, y: (field.height * 3) / 4 },
      vel: { x: 0, y: 0 },
      radius: config.paddleRadius,
    },
    player2: {
      pos: { x: field.width / 2, y: field.height / 4 },
      vel: { x: 0, y: 0 },
      radius: config.paddleRadius,
    },
    score: { p1: 0, p2: 0 },
    phase: 'countdown',
    countdownValue: 3,
    countdownTimer: 3,
    goalTimer: 0,
    lastScorer: null,
    winner: null,
    config,
  };
}

export function updateGame(
  state: GameState,
  dt: number,
  inputs: { p1: PlayerInput; p2: PlayerInput },
): GameState {
  switch (state.phase) {
    case 'countdown':
      return updateCountdown(state, dt, inputs);
    case 'playing':
      return updatePlaying(state, dt, inputs);
    case 'grabbed':
      return updateGrabbed(state, dt, inputs);
    case 'goal':
      return updateGoal(state, dt, inputs);
    case 'paused':
    case 'finished':
      return state;
  }
}

export function resetPuck(state: GameState, scoredBy: 1 | 2): GameState {
  const field = makeField(state.config);
  const y = field.height / 2;
  const x = Math.random() < 0.5 ? state.config.puckRadius : field.width - state.config.puckRadius;
  const scoredAgainst = scoredBy === 1 ? 2 : 1;
  const dirSign = scoredAgainst === 1 ? 1 : -1;
  const { vx, vy } = randomPuckVelocity(state.config, dirSign);

  return {
    ...state,
    puck: { ...state.puck, pos: { x, y }, vel: { x: vx, y: vy } },
    phase: 'playing',
  };
}

// ── 内部ヘルパー ──────────────────────────────────────────────────────────────

function updateCountdown(
  state: GameState,
  dt: number,
  inputs: { p1: PlayerInput; p2: PlayerInput },
): GameState {
  const field = makeField(state.config);
  const newTimer = state.countdownTimer - dt;
  const elapsed = 3 - newTimer;

  let countdownValue: 3 | 2 | 1 | 0;
  let phase = state.phase as GameState['phase'];

  if (newTimer <= 0) {
    countdownValue = 0;
    phase = 'playing';
  } else if (elapsed >= 2) {
    countdownValue = 1;
  } else if (elapsed >= 1) {
    countdownValue = 2;
  } else {
    countdownValue = 3;
  }

  const p2Speed = state.mode === 'vs-ai' ? state.config.ai.speed : Infinity;
  const player1 = movePaddleToward(
    state.player1,
    inputs.p1.paddleTarget,
    dt,
    state.config,
    { x: 0, y: field.height / 2, width: field.width, height: field.height / 2 - field.goalDepth },
    Infinity,
  );
  const player2 = movePaddleToward(
    state.player2,
    inputs.p2.paddleTarget,
    dt,
    state.config,
    { x: 0, y: field.goalDepth, width: field.width, height: field.height / 2 - field.goalDepth },
    p2Speed,
  );

  return {
    ...state,
    player1,
    player2,
    phase,
    countdownValue,
    countdownTimer: Math.max(0, newTimer),
  };
}

function updatePlaying(
  state: GameState,
  dt: number,
  inputs: { p1: PlayerInput; p2: PlayerInput },
): GameState {
  const field = makeField(state.config);

  // パドル移動ゾーン
  const p1Zone: Rect = {
    x: 0,
    y: field.height / 2,
    width: field.width,
    height: field.height / 2 - field.goalDepth,
  };
  const p2Zone: Rect = {
    x: 0,
    y: field.goalDepth,
    width: field.width,
    height: field.height / 2 - field.goalDepth,
  };

  // パックつかみ判定（Player 1）
  if (inputs.p1.grabbing) {
    const dx = inputs.p1.paddleTarget.x - state.puck.pos.x;
    const dy = inputs.p1.paddleTarget.y - state.puck.pos.y;
    if (Math.hypot(dx, dy) < state.config.puckRadius) {
      return { ...state, phase: 'grabbed' };
    }
  }

  const p2Speed = state.mode === 'vs-ai' ? state.config.ai.speed : Infinity;
  const player1 = movePaddleToward(
    state.player1,
    inputs.p1.paddleTarget,
    dt,
    state.config,
    p1Zone,
    Infinity,
  );
  const player2 = movePaddleToward(
    state.player2,
    inputs.p2.paddleTarget,
    dt,
    state.config,
    p2Zone,
    p2Speed,
  );

  // パック物理
  let puck = movePuck(state.puck, dt, state.config);
  ({ puck } = collidePaddlePuck(player1, puck, state.config));
  ({ puck } = collidePaddlePuck(player2, puck, state.config));
  puck = reflectGoalposts(puck, field, state.config);
  const { puck: reflected, goal } = reflectWalls(puck, field, state.config);
  puck = reflected;

  if (goal !== null) {
    const newScore = {
      p1: goal === 1 ? state.score.p1 + 1 : state.score.p1,
      p2: goal === 2 ? state.score.p2 + 1 : state.score.p2,
    };
    const finished = newScore.p1 >= state.config.winScore || newScore.p2 >= state.config.winScore;
    return {
      ...state,
      player1,
      player2,
      puck,
      score: newScore,
      phase: finished ? 'finished' : 'goal',
      goalTimer: 0,
      lastScorer: goal,
      winner: finished ? (newScore.p1 >= state.config.winScore ? 1 : 2) : null,
    };
  }

  return { ...state, player1, player2, puck };
}

function updateGrabbed(
  state: GameState,
  dt: number,
  inputs: { p1: PlayerInput; p2: PlayerInput },
): GameState {
  const field = makeField(state.config);
  const p1Zone: Rect = {
    x: 0,
    y: field.height / 2,
    width: field.width,
    height: field.height / 2 - field.goalDepth,
  };

  if (!inputs.p1.grabbing) {
    // 解放: ドラッグ速度をパックに適用
    const MAX_SPEED = 800;
    const speed = Math.hypot(state.puck.vel.x, state.puck.vel.y);
    const scale = speed > MAX_SPEED ? MAX_SPEED / speed : 1;
    return {
      ...state,
      puck: { ...state.puck, vel: { x: state.puck.vel.x * scale, y: state.puck.vel.y * scale } },
      phase: 'playing',
    };
  }

  // つかみ中: パックを目標位置に追従（自コート内制限）
  const target = inputs.p1.paddleTarget;
  const clampedTarget = clampPaddleToZone(
    { ...state.puck, pos: target, vel: { x: 0, y: 0 }, radius: state.puck.radius },
    p1Zone,
  );

  const prevPos = state.puck.pos;
  const newPos = clampedTarget.pos;
  const puckVel = { x: (newPos.x - prevPos.x) / dt, y: (newPos.y - prevPos.y) / dt };

  const player1 = movePaddleToward(
    state.player1,
    inputs.p1.paddleTarget,
    dt,
    state.config,
    p1Zone,
    Infinity,
  );
  const p2Zone: Rect = {
    x: 0,
    y: field.goalDepth,
    width: field.width,
    height: field.height / 2 - field.goalDepth,
  };
  const p2Speed = state.mode === 'vs-ai' ? state.config.ai.speed : Infinity;
  const player2 = movePaddleToward(
    state.player2,
    inputs.p2.paddleTarget,
    dt,
    state.config,
    p2Zone,
    p2Speed,
  );

  return {
    ...state,
    player1,
    player2,
    puck: { ...state.puck, pos: newPos, vel: puckVel },
  };
}

function updateGoal(
  state: GameState,
  dt: number,
  inputs: { p1: PlayerInput; p2: PlayerInput },
): GameState {
  const field = makeField(state.config);
  const newGoalTimer = state.goalTimer + dt;

  // パドルは goal フェーズ中も動ける
  const p1Zone: Rect = {
    x: 0,
    y: field.height / 2,
    width: field.width,
    height: field.height / 2 - field.goalDepth,
  };
  const p2Zone: Rect = {
    x: 0,
    y: field.goalDepth,
    width: field.width,
    height: field.height / 2 - field.goalDepth,
  };
  const p2Speed = state.mode === 'vs-ai' ? state.config.ai.speed : Infinity;
  const player1 = movePaddleToward(
    state.player1,
    inputs.p1.paddleTarget,
    dt,
    state.config,
    p1Zone,
    Infinity,
  );
  const player2 = movePaddleToward(
    state.player2,
    inputs.p2.paddleTarget,
    dt,
    state.config,
    p2Zone,
    p2Speed,
  );

  if (newGoalTimer >= 0.5) {
    const scoredBy = state.lastScorer ?? 1;
    const resetState = resetPuck({ ...state, player1, player2 }, scoredBy);
    return resetState;
  }

  return { ...state, player1, player2, goalTimer: newGoalTimer };
}

function movePaddleToward(
  paddle: Paddle,
  target: { x: number; y: number },
  dt: number,
  config: GameConfig,
  zone: Rect,
  speed = config.ai.speed,
): Paddle {
  const dx = target.x - paddle.pos.x;
  const dy = target.y - paddle.pos.y;
  const dist = Math.hypot(dx, dy);
  const maxMove = speed * dt;

  let newPos;
  if (dist <= maxMove || dist < 0.001) {
    newPos = { x: target.x, y: target.y };
  } else {
    newPos = {
      x: paddle.pos.x + (dx / dist) * maxMove,
      y: paddle.pos.y + (dy / dist) * maxMove,
    };
  }

  const vel = {
    x: (newPos.x - paddle.pos.x) / dt,
    y: (newPos.y - paddle.pos.y) / dt,
  };

  const clamped = clampPaddleToZone({ ...paddle, pos: newPos, vel }, zone);
  return clamped;
}

function randomPuckVelocity(config: GameConfig, directionSign: 1 | -1) {
  const angle = (Math.random() * 2 - 1) * ((config.puckResetAngleMax * Math.PI) / 180);
  return {
    vx: config.puckInitialSpeed * Math.sin(angle),
    vy: config.puckInitialSpeed * Math.cos(angle) * directionSign,
  };
}
