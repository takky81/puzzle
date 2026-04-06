import type { AIConfig, Board, Color, GameState, Position } from './types';
import { getValidMoves, getScore, opponent, placeStone } from './logic';

const WEIGHT_TABLE: number[][] = [
  [100, -20, 10, 5, 5, 10, -20, 100],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [10, -5, 1, 1, 1, 1, -5, 10],
  [5, -5, 1, 1, 1, 1, -5, 5],
  [5, -5, 1, 1, 1, 1, -5, 5],
  [10, -5, 1, 1, 1, 1, -5, 10],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [100, -20, 10, 5, 5, 10, -20, 100],
];

export function evaluatePosition(row: number, col: number): number {
  return WEIGHT_TABLE[row][col];
}

export function chooseRandomMove(game: GameState): Position {
  const moves = getValidMoves(game.board, game.currentColor);
  return moves[Math.floor(Math.random() * moves.length)];
}

export function chooseNormalMove(game: GameState): Position {
  const moves = getValidMoves(game.board, game.currentColor);
  let bestMove = moves[0];
  let bestScore = -Infinity;
  for (const [r, c] of moves) {
    const score = evaluatePosition(r, c);
    if (score > bestScore) {
      bestScore = score;
      bestMove = [r, c];
    }
  }
  return bestMove;
}

export function countStableDiscs(board: Board, color: Color): number {
  const stable: boolean[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => false),
  );

  const corners: [number, number, number, number][] = [
    [0, 0, 1, 1],
    [0, 7, 1, -1],
    [7, 0, -1, 1],
    [7, 7, -1, -1],
  ];

  for (const [cr, cc, dr, dc] of corners) {
    if (board[cr][cc] !== color) continue;
    stable[cr][cc] = true;

    // Along row from corner
    for (let c = cc + dc; c >= 0 && c < 8; c += dc) {
      if (board[cr][c] === color) stable[cr][c] = true;
      else break;
    }

    // Along column from corner
    for (let r = cr + dr; r >= 0 && r < 8; r += dr) {
      if (board[r][cc] === color) stable[r][cc] = true;
      else break;
    }

    // Fill rectangle from corner
    for (let r = cr + dr; r >= 0 && r < 8; r += dr) {
      if (!stable[r][cc]) break;
      for (let c = cc + dc; c >= 0 && c < 8; c += dc) {
        if (board[r][c] === color && stable[r - dr]?.[c] && stable[r][c - dc]) {
          stable[r][c] = true;
        } else {
          break;
        }
      }
    }
  }

  let count = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (stable[r][c]) count++;
    }
  }
  return count;
}

function countEmpty(board: Board): number {
  let count = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === null) count++;
    }
  }
  return count;
}

export function evaluate(board: Board, color: Color): number {
  const opp = opponent(color);
  const empty = countEmpty(board);

  // Position weights
  let posScore = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === color) posScore += WEIGHT_TABLE[r][c];
      else if (board[r][c] === opp) posScore -= WEIGHT_TABLE[r][c];
    }
  }

  // Stable discs
  const stableMe = countStableDiscs(board, color);
  const stableOpp = countStableDiscs(board, opp);
  const stableScore = (stableMe - stableOpp) * 10;

  // Mobility
  const myMoves = getValidMoves(board, color).length;
  const oppMoves = getValidMoves(board, opp).length;
  const mobilityScore = (myMoves - oppMoves) * 5;

  // Endgame: emphasize disc count
  if (empty <= 10) {
    const score = getScore(board);
    const discDiff = color === 'black' ? score.black - score.white : score.white - score.black;
    return discDiff * 20 + stableScore;
  }

  return posScore + stableScore + mobilityScore;
}

function minimax(
  game: GameState,
  depth: number,
  alpha: number,
  beta: number,
  aiColor: Color,
  deadline: number,
): number {
  if (depth === 0 || game.gameOver || Date.now() >= deadline) {
    return evaluate(game.board, aiColor);
  }

  const moves = getValidMoves(game.board, game.currentColor);

  if (moves.length === 0) {
    // Pass: switch turn
    const passedGame: GameState = {
      ...game,
      currentColor: opponent(game.currentColor),
      passed: true,
    };
    const oppMoves = getValidMoves(passedGame.board, passedGame.currentColor);
    if (oppMoves.length === 0) {
      return evaluate(game.board, aiColor);
    }
    return minimax(passedGame, depth - 1, alpha, beta, aiColor, deadline);
  }

  const maximizing = game.currentColor === aiColor;

  if (maximizing) {
    let maxEval = -Infinity;
    for (const [r, c] of moves) {
      if (Date.now() >= deadline) break;
      const next = placeStone(game, r, c);
      if (!next) continue;
      const val = minimax(next, depth - 1, alpha, beta, aiColor, deadline);
      maxEval = Math.max(maxEval, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const [r, c] of moves) {
      if (Date.now() >= deadline) break;
      const next = placeStone(game, r, c);
      if (!next) continue;
      const val = minimax(next, depth - 1, alpha, beta, aiColor, deadline);
      minEval = Math.min(minEval, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export interface HardMoveResult {
  move: Position;
  depth: number;
}

export function chooseHardMove(
  game: GameState,
  config: AIConfig = { maxDepth: Infinity, maxTime: 3000 },
): HardMoveResult {
  return chooseMinimaxMove(game, config, game.currentColor);
}

export function chooseWeakestMove(
  game: GameState,
  config: AIConfig = { maxDepth: Infinity, maxTime: 3000 },
): HardMoveResult {
  return chooseMinimaxMove(game, config, opponent(game.currentColor));
}

function chooseMinimaxMove(game: GameState, config: AIConfig, aiColor: Color): HardMoveResult {
  const moves = getValidMoves(game.board, game.currentColor);
  const deadline = Date.now() + config.maxTime;
  const maxDepth = Math.min(config.maxDepth, 64);

  let bestMove = moves[0];
  let reachedDepth = 0;

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (Date.now() >= deadline) break;

    let depthBestMove = moves[0];
    let depthBestScore = -Infinity;
    let completed = true;

    for (const [r, c] of moves) {
      if (Date.now() >= deadline) {
        completed = false;
        break;
      }
      const next = placeStone(game, r, c);
      if (!next) continue;
      const score = minimax(next, depth - 1, depthBestScore, Infinity, aiColor, deadline);
      if (score > depthBestScore) {
        depthBestScore = score;
        depthBestMove = [r, c];
      }
    }

    if (completed) {
      bestMove = depthBestMove;
      reachedDepth = depth;
    }
  }

  return { move: bestMove, depth: reachedDepth };
}
