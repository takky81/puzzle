import { useEffect, useState } from "react";

import './Othello.css';

const BOARD_SIZE = 8 as const;

const enum CellState {
  Empty = 0,
  Black = 1,
  White = 2,
}

interface StoneCounts {
  black: number;
  white: number;
}

type Board = CellState[][];

const initialPlayer = CellState.Black;

function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(CellState.Empty));
}

function createInitialBoard() {
  const board = createEmptyBoard();
  board[3][3] = CellState.White;
  board[3][4] = CellState.Black;
  board[4][3] = CellState.Black;
  board[4][4] = CellState.White;
  return board;
}

export default function Othello() {
  const [board, setBoard] = useState(createInitialBoard());
  const [currentPlayer, setCurrentPlayer] = useState(initialPlayer);
  const [stoneCounts, setStoneCounts] = useState<StoneCounts>({ black: 2, white: 2 });
  const [candidates, setCandidates] = useState<[number, number][]>([]);
  const [isGameOver, setIsGameOver] = useState(false);

  useEffect(() => {
    resetGame();
  }, []);

  function resetGame() {
    const initialBoard = createInitialBoard();
    setBoard(initialBoard);
    setCurrentPlayer(initialPlayer);
    setStoneCounts(countStones(initialBoard));
    setCandidates(getCandidates(initialBoard, initialPlayer));
    setIsGameOver(false);
  }

  function handleCellClick(y: number, x: number, isCandidate: boolean) {
    if (isGameOver) return;
    if (!isCandidate) return;
    const newBoard = board.map(row => [...row]);
    reverseStones(newBoard, y, x, currentPlayer, false);
    newBoard[y][x] = currentPlayer;
    setBoard(newBoard);

    const stoneCounts = countStones(newBoard);
    setStoneCounts(stoneCounts);

    const nextPlayer = getOpponent(currentPlayer);

    let candidates = getCandidates(newBoard, nextPlayer);
    if (0 < candidates.length) {
      setCurrentPlayer(nextPlayer);
    } else {
      candidates = getCandidates(newBoard, currentPlayer);
      if (0 < candidates.length) {
        setCurrentPlayer(currentPlayer);
      } else {
        setIsGameOver(true);
      }
    }
    setCandidates(candidates);
  }

  return (
    <div className="container">
      <div className="row">
        <div className="col-12">
          <div id="board-othello" className="d-grid" style={{
            gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
            touchAction: "none",
          }}>
            {board.map((row, rowIndex) => (
              <div>
                {row.map((value, colIndex) => {
                  const isCandidate = candidates.some(([r, c]) => r === rowIndex && c === colIndex);

                  return (
                    <Cell y={rowIndex} x={colIndex} value={isCandidate ? currentPlayer : value} isCandidate={isCandidate} handleCellClick={handleCellClick} />
                  );
                })}
              </div>
            ))}
          </div>
          黒: {stoneCounts.black} 白: {stoneCounts.white} {isGameOver && (<span className="text-danger">{
            stoneCounts.black === stoneCounts.white ? "引き分け" :
              stoneCounts.black > stoneCounts.white ? "黒の勝ち" : "白の勝ち"
          }</span>)}
          <button className="btn btn-primary btn-sm ms-2" onClick={() => resetGame()}>リセット</button>
        </div>
      </div>
    </div>
  );
}

function Cell(props: { y: number, x: number, value: CellState, isCandidate: boolean, handleCellClick: (y: number, x: number, isCandidate: boolean) => void }) {
  const { y, x, value, isCandidate, handleCellClick } = props;
  return (
    <div className={`cell border border-dark`}>
      {value !== CellState.Empty && (
        <div className={`cell-state-${value} ${isCandidate && "candidate"} border border-dark w-100`} onClick={() => handleCellClick(y, x, isCandidate)}></div>
      )}
    </div>
  );
}

function getCandidates(board: Board, player: CellState): [number, number][] {
  const candidates: [number, number][] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const reversedSconesCount = reverseStones(board, y, x, player, true);
      if (reversedSconesCount > 0) {
        candidates.push([y, x]);
      }
    }
  }
  return candidates;
}

function reverseStones(board: Board, y: number, x: number, player: CellState, onlyCount: boolean): number {
  if (board[y][x] !== CellState.Empty) return 0;
  const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1],
  ] as const;
  const opponent = getOpponent(player);
  let reversedStonesCount = 0;

  function reverseStonesRec(ny: number, nx: number, dy: number, dx: number): boolean {
    if (ny < 0 || BOARD_SIZE <= ny || nx < 0 || BOARD_SIZE <= nx) return false;
    if (board[ny][nx] === opponent) {
      if (reverseStonesRec(ny + dy, nx + dx, dy, dx)) {
        if (!onlyCount) {
          board[ny][nx] = player;
        }
        reversedStonesCount++;
        return true;
      }
      return false;
    } else if (board[ny][nx] === player) {
      return true;
    } else {
      return false;
    }
  }

  for (const [dy, dx] of DIRECTIONS) {
    reverseStonesRec(y + dy, x + dx, dy, dx);
  }
  return reversedStonesCount;
}

function countStones(board: Board): StoneCounts {
  let blackCount = 0;
  let whiteCount = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === CellState.Black) {
        blackCount++;
      } else if (board[y][x] === CellState.White) {
        whiteCount++;
      }
    }
  }
  return { black: blackCount, white: whiteCount };
}

function getOpponent(player: CellState): CellState {
  return player === CellState.Black ? CellState.White : CellState.Black;
}
