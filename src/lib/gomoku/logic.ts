import type { Board, Color, GameState, Position } from './types';
import { BOARD_SIZE } from './types';

export function createGame(): GameState {
  const board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
  return {
    board,
    currentColor: 'black',
    gameOver: false,
    winner: null,
    lastMove: null,
    forbiddenRule: false,
  };
}

export function opponent(color: Color): Color {
  return color === 'black' ? 'white' : 'black';
}

export const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function countInDirection(
  board: Board,
  row: number,
  col: number,
  dr: number,
  dc: number,
  color: Color,
): number {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === color) {
    count++;
    r += dr;
    c += dc;
  }
  return count;
}

function checkWin(
  board: Board,
  row: number,
  col: number,
  color: Color,
  forbiddenRule: boolean,
): boolean {
  for (const [dr, dc] of DIRECTIONS) {
    const count =
      1 +
      countInDirection(board, row, col, dr, dc, color) +
      countInDirection(board, row, col, -dr, -dc, color);
    if (forbiddenRule && color === 'black') {
      if (count === 5) return true; // ちょうど5のみ勝ち
    } else {
      if (count >= 5) return true;
    }
  }
  return false;
}

function isBoardFull(board: Board): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === null) return false;
    }
  }
  return true;
}

function isOpenEnd(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && board[row][col] === null;
}

function countLinesOfLength(
  board: Board,
  row: number,
  col: number,
  color: Color,
  targetLen: number,
  requireOpen: number,
): number {
  let count = 0;
  for (const [dr, dc] of DIRECTIONS) {
    const forward = countInDirection(board, row, col, dr, dc, color);
    const backward = countInDirection(board, row, col, -dr, -dc, color);
    const total = 1 + forward + backward;
    if (total !== targetLen) continue;

    const endR1 = row + dr * (forward + 1);
    const endC1 = col + dc * (forward + 1);
    const endR2 = row - dr * (backward + 1);
    const endC2 = col - dc * (backward + 1);
    const open1 = isOpenEnd(board, endR1, endC1);
    const open2 = isOpenEnd(board, endR2, endC2);
    const openEnds = (open1 ? 1 : 0) + (open2 ? 1 : 0);
    if (openEnds >= requireOpen) count++;
  }
  return count;
}

function isForbiddenMove(board: Board, row: number, col: number): boolean {
  const color = 'black';
  const testBoard = board.map((r) => [...r]);
  testBoard[row][col] = color;

  // 長連禁: 6以上はそもそもcheckWinで勝ちにならないが、置くこと自体は許可
  // → 長連禁はplaceStone内のcheckWinで処理、ここでは三三・四四のみ

  // 五連なら禁じ手にならない（勝ちの手は許可）
  for (const [dr, dc] of DIRECTIONS) {
    const total =
      1 +
      countInDirection(testBoard, row, col, dr, dc, color) +
      countInDirection(testBoard, row, col, -dr, -dc, color);
    if (total === 5) return false;
  }

  // 三三禁: 活三（両端開きの3連）が2つ以上
  const openThrees = countLinesOfLength(testBoard, row, col, color, 3, 2);
  if (openThrees >= 2) return true;

  // 四四禁: 四（4連）が2つ以上
  const fours = countLinesOfLength(testBoard, row, col, color, 4, 1);
  if (fours >= 2) return true;

  return false;
}

export function setForbiddenRule(game: GameState, enabled: boolean): GameState {
  return { ...game, forbiddenRule: enabled };
}

export function getForbiddenMoves(game: GameState): Position[] {
  if (!game.forbiddenRule || game.currentColor !== 'black') return [];
  const forbidden: Position[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (game.board[r][c] !== null) continue;
      if (isForbiddenMove(game.board, r, c)) {
        forbidden.push([r, c]);
      }
    }
  }
  return forbidden;
}

export function placeStone(game: GameState, row: number, col: number): GameState | null {
  if (game.gameOver) return null;
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  if (game.board[row][col] !== null) return null;

  // 禁じ手チェック（黒のみ）
  if (game.forbiddenRule && game.currentColor === 'black') {
    if (isForbiddenMove(game.board, row, col)) return null;
  }

  const newBoard = game.board.map((r) => [...r]);
  newBoard[row][col] = game.currentColor;

  const won = checkWin(newBoard, row, col, game.currentColor, game.forbiddenRule);
  const full = !won && isBoardFull(newBoard);

  return {
    ...game,
    board: newBoard,
    currentColor: opponent(game.currentColor),
    lastMove: [row, col],
    gameOver: won || full,
    winner: won ? game.currentColor : null,
  };
}
