import type { Board, Color, GameState, Position } from './types';

export function opponent(color: Color): Color {
  return color === 'black' ? 'white' : 'black';
}

function createBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
  board[3][3] = 'white';
  board[3][4] = 'black';
  board[4][3] = 'black';
  board[4][4] = 'white';
  return board;
}

const DIRECTIONS: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

function getFlipsInDirection(
  board: Board,
  row: number,
  col: number,
  dr: number,
  dc: number,
  color: Color,
): Position[] {
  const flips: Position[] = [];
  let r = row + dr;
  let c = col + dc;
  while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === opponent(color)) {
    flips.push([r, c]);
    r += dr;
    c += dc;
  }
  if (flips.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === color) {
    return flips;
  }
  return [];
}

function getAllFlips(board: Board, row: number, col: number, color: Color): Position[] {
  if (board[row][col] !== null) return [];
  const flips: Position[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    flips.push(...getFlipsInDirection(board, row, col, dr, dc, color));
  }
  return flips;
}

export function getValidMoves(board: Board, color: Color): Position[] {
  const moves: Position[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (getAllFlips(board, r, c, color).length > 0) {
        moves.push([r, c]);
      }
    }
  }
  return moves;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function placeStone(game: GameState, row: number, col: number): GameState | null {
  if (game.gameOver) return null;
  const flips = getAllFlips(game.board, row, col, game.currentColor);
  if (flips.length === 0) return null;

  const newBoard = cloneBoard(game.board);
  newBoard[row][col] = game.currentColor;
  for (const [r, c] of flips) {
    newBoard[r][c] = game.currentColor;
  }

  const nextColor = opponent(game.currentColor);
  const nextMoves = getValidMoves(newBoard, nextColor);
  const currentMoves = getValidMoves(newBoard, game.currentColor);

  let gameOver = false;
  let passed = false;
  let actualNextColor = nextColor;

  if (nextMoves.length === 0) {
    if (currentMoves.length === 0) {
      gameOver = true;
    } else {
      passed = true;
      actualNextColor = game.currentColor;
    }
  }

  return {
    board: newBoard,
    currentColor: actualNextColor,
    gameOver,
    passed,
    lastMove: [row, col],
    flipped: flips,
  };
}

export function passMove(game: GameState): GameState {
  const opp = opponent(game.currentColor);
  if (getValidMoves(game.board, opp).length === 0) {
    return { ...game, gameOver: true, passed: false };
  }
  return { ...game, currentColor: opp, passed: true };
}

export function getScore(board: Board): { black: number; white: number } {
  let black = 0;
  let white = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === 'black') black++;
      else if (board[r][c] === 'white') white++;
    }
  }
  return { black, white };
}

export function getWinner(board: Board): Color | null {
  const score = getScore(board);
  if (score.black > score.white) return 'black';
  if (score.white > score.black) return 'white';
  return null;
}

export function createGame(): GameState {
  return {
    board: createBoard(),
    currentColor: 'black',
    gameOver: false,
    passed: false,
    lastMove: null,
    flipped: [],
  };
}
