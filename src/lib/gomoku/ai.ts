import type { AIConfig, Board, Color, GameState, HardMoveResult, Position } from './types';
import { BOARD_SIZE } from './types';
import { opponent, placeStone, getForbiddenMoves, DIRECTIONS } from './logic';

const CANDIDATE_RANGE = 2;

function isOpen(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && board[row][col] === null;
}

function posKey(r: number, c: number): number {
  return r * BOARD_SIZE + c;
}

export function getCandidateMoves(game: GameState): Position[] {
  const occupied = new Set<number>();
  const candidates = new Set<number>();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (game.board[r][c] !== null) occupied.add(posKey(r, c));
    }
  }

  if (occupied.size === 0) {
    return [[7, 7]];
  }

  const forbidden = new Set(getForbiddenMoves(game).map(([r, c]) => posKey(r, c)));

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (game.board[r][c] !== null) {
        for (let dr = -CANDIDATE_RANGE; dr <= CANDIDATE_RANGE; dr++) {
          for (let dc = -CANDIDATE_RANGE; dc <= CANDIDATE_RANGE; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
            const k = posKey(nr, nc);
            if (game.board[nr][nc] === null && !occupied.has(k) && !forbidden.has(k)) {
              candidates.add(k);
            }
          }
        }
      }
    }
  }

  return [...candidates].map((k) => [Math.floor(k / BOARD_SIZE), k % BOARD_SIZE] as Position);
}

// --- 評価関数 ---

// パターンスコア
const SCORE_FIVE = 100000;
const SCORE_OPEN_FOUR = 10000;
const SCORE_FOUR = 1000;
const SCORE_OPEN_THREE = 500;
const SCORE_THREE = 100;
const SCORE_OPEN_TWO = 50;
const SCORE_TWO = 10;

function evaluateColor(board: Board, color: Color): number {
  let score = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== color) continue;

      for (const [dr, dc] of DIRECTIONS) {
        // Only count from the start of a line (avoid double counting)
        const prevR = r - dr;
        const prevC = c - dc;
        if (
          prevR >= 0 &&
          prevR < BOARD_SIZE &&
          prevC >= 0 &&
          prevC < BOARD_SIZE &&
          board[prevR][prevC] === color
        ) {
          continue;
        }

        let len = 0;
        let cr = r;
        let cc = c;
        while (
          cr >= 0 &&
          cr < BOARD_SIZE &&
          cc >= 0 &&
          cc < BOARD_SIZE &&
          board[cr][cc] === color
        ) {
          len++;
          cr += dr;
          cc += dc;
        }

        const beforeR = r - dr;
        const beforeC = c - dc;
        const openBefore = isOpen(board, beforeR, beforeC);
        const openAfter = isOpen(board, cr, cc);
        const openEnds = (openBefore ? 1 : 0) + (openAfter ? 1 : 0);

        if (len >= 5) {
          score += SCORE_FIVE;
        } else if (len === 4) {
          score += openEnds === 2 ? SCORE_OPEN_FOUR : openEnds === 1 ? SCORE_FOUR : 0;
        } else if (len === 3) {
          score += openEnds === 2 ? SCORE_OPEN_THREE : openEnds === 1 ? SCORE_THREE : 0;
        } else if (len === 2) {
          score += openEnds === 2 ? SCORE_OPEN_TWO : openEnds === 1 ? SCORE_TWO : 0;
        }
      }
    }
  }

  return score;
}

export function evaluate(board: Board, color: Color): number {
  return evaluateColor(board, color) - evaluateColor(board, opponent(color));
}

// --- AI関数 ---

export function chooseRandomMove(game: GameState): Position {
  const moves = getCandidateMoves(game);
  return moves[Math.floor(Math.random() * moves.length)];
}

export function chooseNormalMove(game: GameState): Position {
  const moves = getCandidateMoves(game);
  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const [r, c] of moves) {
    const newBoard = game.board.map((row) => [...row]);
    newBoard[r][c] = game.currentColor;
    const score = evaluate(newBoard, game.currentColor);
    if (score > bestScore) {
      bestScore = score;
      bestMove = [r, c];
    }
  }

  return bestMove;
}

// --- ミニマックス ---

function evalWithInversion(board: Board, aiColor: Color, invertEval: boolean): number {
  const score = evaluate(board, aiColor);
  return invertEval ? -score : score;
}

function minimax(
  game: GameState,
  depth: number,
  alpha: number,
  beta: number,
  aiColor: Color,
  deadline: number,
  invertEval = false,
): number {
  if (depth === 0 || game.gameOver || Date.now() >= deadline) {
    return evalWithInversion(game.board, aiColor, invertEval);
  }

  const moves = getCandidateMoves(game);
  if (moves.length === 0) {
    return evalWithInversion(game.board, aiColor, invertEval);
  }

  const maximizing = game.currentColor === aiColor;

  if (maximizing) {
    let maxEval = -Infinity;
    for (const [r, c] of moves) {
      if (Date.now() >= deadline) break;
      const next = placeStone(game, r, c);
      if (!next) continue;
      const val = minimax(next, depth - 1, alpha, beta, aiColor, deadline, invertEval);
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
      const val = minimax(next, depth - 1, alpha, beta, aiColor, deadline, invertEval);
      minEval = Math.min(minEval, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function chooseMinimaxMove(
  game: GameState,
  config: AIConfig,
  aiColor: Color,
  invertEval: boolean,
): HardMoveResult {
  const moves = getCandidateMoves(game);
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
      const score = minimax(
        next,
        depth - 1,
        depthBestScore,
        Infinity,
        aiColor,
        deadline,
        invertEval,
      );
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

export function chooseHardMove(
  game: GameState,
  config: AIConfig = { maxDepth: Infinity, maxTime: 3000 },
): HardMoveResult {
  return chooseMinimaxMove(game, config, game.currentColor, false);
}

export function chooseWeakestMove(
  game: GameState,
  config: AIConfig = { maxDepth: Infinity, maxTime: 3000 },
): HardMoveResult {
  return chooseMinimaxMove(game, config, game.currentColor, true);
}
