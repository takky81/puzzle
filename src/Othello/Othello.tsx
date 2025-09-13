import { useEffect, useState } from "react";

import './Othello.css';

const BOARD_SIZE = 8 as const;

const enum CellState {
  Empty = 0,
  Black = 1,
  White = 2,
}

type StoneColor = CellState.Black | CellState.White;

interface StoneCounts {
  black: number;
  white: number;
}

interface Coord {
  y: number;
  x: number;
}

interface AiThinkingResult {
  winCount: number;
  gameCount: number;
}

type Board = CellState[][];

const initialPlayer: StoneColor = CellState.Black;

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

export default function Othello(props: { setLockString: (lockString: string | undefined) => void }) {
  const { setLockString } = props;

  const [board, setBoard] = useState(createInitialBoard());
  const [currentPlayer, setCurrentPlayer] = useState(initialPlayer);
  const [stoneCounts, setStoneCounts] = useState<StoneCounts>({ black: 2, white: 2 });
  const [candidates, setCandidates] = useState<Coord[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [aiUsage, setAiUsage] = useState<Record<StoneColor, boolean>>({
    [CellState.Black]: false,
    [CellState.White]: false,
  });
  const [aiThinkingResult, setAiThinkingResult] = useState<Record<StoneColor, AiThinkingResult>>({
    [CellState.Black]: { winCount: 0, gameCount: 0 },
    [CellState.White]: { winCount: 0, gameCount: 0 },
  });

  useEffect(() => {
    resetGame();
  }, []);

  useEffect(() => {
    const runAi = async () => {
      if (aiUsage[currentPlayer] && !isGameOver) {
        setLockString("AIが思考中...");

        await new Promise(resolve => setTimeout(resolve, 100));

        const { coord, aiThinkingResult } = aiAction(board, currentPlayer, candidates);
        setAiThinkingResult(prev => ({ ...prev, [currentPlayer]: aiThinkingResult }));
        handleCellClick(coord.y, coord.x, candidates.some(c => c.y === coord.y && c.x === coord.x));

        setLockString(undefined);
      }
    }
    runAi();
  }, [currentPlayer, aiUsage, isGameOver]);

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

  function handleChangeAiUsage(color: StoneColor, isAiUsed: boolean) {
    setAiUsage(prev => ({ ...prev, [color]: isAiUsed }));
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
                  const isCandidate = candidates.some(({ y, x }) => y === rowIndex && x === colIndex);

                  return (
                    <Cell y={rowIndex} x={colIndex} value={isCandidate ? currentPlayer : value} isCandidate={isCandidate} handleCellClick={handleCellClick} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="col-12">
          黒: {stoneCounts.black} 白: {stoneCounts.white} {isGameOver && (<span className="text-danger">{
            stoneCounts.black === stoneCounts.white ? "引き分け" :
              stoneCounts.black > stoneCounts.white ? "黒の勝ち" : "白の勝ち"
          }</span>)}
          <button className="btn btn-primary btn-sm ms-2" onClick={() => resetGame()}>リセット</button>
        </div>
        <div className="col-12">
          <span className="me-2">AIの使用:</span>
          <div className="form-check form-check-inline">
            <input className="form-check-input" type="checkbox" name="aiUsage" id="isBlackAi" checked={aiUsage[CellState.Black]}
              onChange={(e) => handleChangeAiUsage(CellState.Black, e.target.checked)} />
            <label className="form-check-label" htmlFor="isBlackAi">黒</label>
          </div>
          <div className="form-check form-check-inline">
            <input className="form-check-input" type="checkbox" name="aiUsage" id="isWhiteAi" checked={aiUsage[CellState.White]}
              onChange={(e) => handleChangeAiUsage(CellState.White, e.target.checked)} />
            <label className="form-check-label" htmlFor="isWhiteAi">白</label>
          </div>
        </div>
        <div className="col-12">
          <span className="me-2">AIの試行結果:</span>
          {[CellState.Black, CellState.White].map(color => {
            const result = aiThinkingResult[color as StoneColor];
            const colorName = color === CellState.Black ? "黒" : "白";
            const winRate = result.gameCount === 0 ? "-" : (100 * result.winCount / result.gameCount).toFixed(2);
            return (
              <span className="me-2">{colorName} {result.winCount} / {result.gameCount} = {winRate} %</span>
            );
          })}
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

function getCandidates(board: Board, player: StoneColor): Coord[] {
  const candidates: Coord[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const reversedSconesCount = reverseStones(board, y, x, player, true);
      if (reversedSconesCount > 0) {
        candidates.push({ y, x });
      }
    }
  }
  return candidates;
}

function reverseStones(board: Board, y: number, x: number, player: StoneColor, onlyCount: boolean): number {
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

function getOpponent(player: StoneColor): StoneColor {
  return player === CellState.Black ? CellState.White : CellState.Black;
}


function aiAction(baseBoard: Board, player: StoneColor, candidates: Coord[]): { coord: Coord, aiThinkingResult: AiThinkingResult } {
  const winCounts: number[] = candidates.map(_ => 0);
  let gameCount = 0;

  const startTime = performance.now();
  const thinkingTime = 3000; // ミリ秒

  while (performance.now() - startTime < thinkingTime) {
    gameCount++;
    for (let i = 0; i < candidates.length; i++) {
      const coord = candidates[i];
      const newBoard = baseBoard.map(row => [...row]);

      reverseStones(newBoard, coord.y, coord.x, player, false);
      newBoard[coord.y][coord.x] = player;

      let currentPlayer = player;

      while (true) {
        const nextPlayer = getOpponent(currentPlayer);

        let nextCandidates = getCandidates(newBoard, nextPlayer);
        if (0 < nextCandidates.length) {
          currentPlayer = nextPlayer;
        } else {
          nextCandidates = getCandidates(newBoard, currentPlayer);
          if (0 < nextCandidates.length) {
            // プレイヤーを変えずに続行
          } else {
            const stoneCounts = countStones(newBoard);
            if (stoneCounts.black < stoneCounts.white) {
              winCounts[i] += (player === CellState.Black ? 0 : 1);
            } else if (stoneCounts.black > stoneCounts.white) {
              winCounts[i] += (player === CellState.Black ? 1 : 0);
            } else {
              winCounts[i] += 0.5;
            }
            break;
          }
        }

        const randomCandidateIndex = Math.floor(Math.random() * nextCandidates.length);
        const nextCoord = nextCandidates[randomCandidateIndex];
        const reversedSconesCount = reverseStones(newBoard, nextCoord.y, nextCoord.x, currentPlayer, false);
        if (reversedSconesCount === 0) {
          throw new Error("AIの手番でありながら、打てる場所がない");
        }
        newBoard[nextCoord.y][nextCoord.x] = currentPlayer;
      }
    }
  }

  const maxWinCount = Math.max(...winCounts);
  const aiThinkingResult: AiThinkingResult = { winCount: maxWinCount, gameCount };
  const coord = candidates[winCounts.indexOf(maxWinCount)];

  return { coord, aiThinkingResult };
}
