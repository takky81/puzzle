import type { AIConfig, Board, Color, GameState, HardMoveResult, Position } from './types';
import { BOARD_SIZE } from './types';
import { opponent, placeStone, getForbiddenMoves, DIRECTIONS } from './logic';

const CANDIDATE_RANGE = 2;

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

// パターンスコア（CMA-ESで最適化済み）
const SCORE_FIVE = 74456;
const SCORE_OPEN_FOUR = 52097;
const SCORE_BROKEN_FOUR = 10435;
const SCORE_FOUR = 6433;
const SCORE_OPEN_THREE = 34227;
const SCORE_BROKEN_THREE = 720;
const SCORE_THREE = 275;
const SCORE_OPEN_TWO = 297;
const SCORE_TWO = 9;

function evaluateColor(board: Board, color: Color): number {
  let score = 0;

  for (const [dr, dc] of DIRECTIONS) {
    // 各方向の各ラインを窓でスキャン
    const startPositions: [number, number][] = [];
    if (dr === 0 && dc === 1) {
      // 横: 各行の先頭から
      for (let r = 0; r < BOARD_SIZE; r++) startPositions.push([r, 0]);
    } else if (dr === 1 && dc === 0) {
      // 縦: 各列の先頭から
      for (let c = 0; c < BOARD_SIZE; c++) startPositions.push([0, c]);
    } else if (dr === 1 && dc === 1) {
      // 右下がり斜め
      for (let c = 0; c < BOARD_SIZE; c++) startPositions.push([0, c]);
      for (let r = 1; r < BOARD_SIZE; r++) startPositions.push([r, 0]);
    } else {
      // 左下がり斜め
      for (let c = 0; c < BOARD_SIZE; c++) startPositions.push([0, c]);
      for (let r = 1; r < BOARD_SIZE; r++) startPositions.push([r, BOARD_SIZE - 1]);
    }

    for (const [sr, sc] of startPositions) {
      // ライン上のセルを収集
      const line: (Color | null)[] = [];
      let cr = sr;
      let cc = sc;
      while (cr >= 0 && cr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE) {
        line.push(board[cr][cc]);
        cr += dr;
        cc += dc;
      }

      if (line.length < 5) continue;

      // 窓サイズ5でスキャン
      for (let i = 0; i <= line.length - 5; i++) {
        let myCount = 0;
        let emptyCount = 0;
        let hasOpp = false;
        for (let j = 0; j < 5; j++) {
          const cell = line[i + j];
          if (cell === color) myCount++;
          else if (cell === null) emptyCount++;
          else hasOpp = true;
        }
        if (hasOpp) continue;

        if (myCount === 5) {
          score += SCORE_FIVE;
        } else if (myCount === 4 && emptyCount === 1) {
          // 窓内に4石+1空 → 連続かギャップかで分岐
          const openBefore = i > 0 && line[i - 1] === null;
          const openAfter = i + 5 < line.length && line[i + 5] === null;

          // 連続4かギャップ4かを判定
          let consecutive = true;
          for (let j = 0; j < 4; j++) {
            if (line[i + j] === color && line[i + j + 1] !== color) {
              // 空きの後にまだ色がある → ギャップ
              if (j < 3 && line[i + j + 2] === color) {
                consecutive = false;
                break;
              }
            }
          }

          if (consecutive) {
            const openEnds = (openBefore ? 1 : 0) + (openAfter ? 1 : 0);
            score += openEnds === 2 ? SCORE_OPEN_FOUR : openEnds === 1 ? SCORE_FOUR : 0;
          } else {
            score += SCORE_BROKEN_FOUR;
          }
        } else if (myCount === 3 && emptyCount === 2) {
          // 窓内に3石+2空
          // 連続3かギャップ3かを判定
          let gapCount = 0;
          for (let j = 0; j < 4; j++) {
            if (line[i + j] === color && line[i + j + 1] === null) {
              if (j + 2 < 5 && line[i + j + 2] === color) gapCount++;
            }
          }

          if (gapCount === 0) {
            // 連続3: 両端の空きを確認
            const openBefore = i > 0 && line[i - 1] === null;
            const openAfter = i + 5 < line.length && line[i + 5] === null;
            // 窓の中で石の塊を探す
            let start = -1;
            for (let j = 0; j < 5; j++) {
              if (line[i + j] === color && start === -1) start = j;
            }
            const beforeStone = start === 0 ? openBefore : true; // 窓内の空き
            const afterEnd = start + 3; // 3連の次
            const afterStone = afterEnd >= 5 ? openAfter : true;
            const openEnds = (beforeStone ? 1 : 0) + (afterStone ? 1 : 0);
            score += openEnds === 2 ? SCORE_OPEN_THREE : openEnds === 1 ? SCORE_THREE : 0;
          } else {
            // ギャップ3 (x.xx, xx.x 等)
            score += SCORE_BROKEN_THREE;
          }
        } else if (myCount === 2 && emptyCount === 3) {
          const openBefore = i > 0 && line[i - 1] === null;
          const openAfter = i + 5 < line.length && line[i + 5] === null;
          const openEnds = (openBefore ? 1 : 0) + (openAfter ? 1 : 0);
          score += openEnds === 2 ? SCORE_OPEN_TWO : openEnds === 1 ? SCORE_TWO : 0;
        }
      }
    }
  }

  return score;
}

const DEFENSE_MULTIPLIER = 1.55;

export function evaluate(board: Board, color: Color): number {
  return evaluateColor(board, color) - DEFENSE_MULTIPLIER * evaluateColor(board, opponent(color));
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
