import { useEffect, useState } from "react";

import './Game2048.css';

interface Game2048SaveData {
  highScore: number;
}

const SAVE_DATA_KEY = "game2048" as const;

const BOARD_SIZE = 4 as const;

type Difficulty = "Easy" | "Random" | "Hard";

const defaultDifficulty = "Random" as const;
const difficulties: Difficulty[] = ["Easy", defaultDifficulty, "Hard"] as const;

interface BoardPoint {
  x: number;
  y: number;
}

function createEmptyBoard(): number[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

function addTileRandom(board: number[][]) {
  const spacePoints: BoardPoint[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const row = board[i];
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (row[j] === 0) {
        spacePoints.push({ y: i, x: j });
      }
    }
  }

  const addedPoint = spacePoints[Math.floor(Math.random() * spacePoints.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  board[addedPoint.y][addedPoint.x] = value;
}

function addTileHard(board: number[][]) {
  const { maxSpacePoints } = getNeighborCounts(board);
  const { maxLineSumPoints } = getLineSums(board, maxSpacePoints);

  const addedPoint = maxLineSumPoints[Math.floor(Math.random() * maxLineSumPoints.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  board[addedPoint.y][addedPoint.x] = value;
}

function addTileEasy(board: number[][]) {
  const { minSpacePoints } = getNeighborCounts(board);
  const { minLineSumPoints } = getLineSums(board, minSpacePoints);

  const addedPoint = minLineSumPoints[Math.floor(Math.random() * minLineSumPoints.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  board[addedPoint.y][addedPoint.x] = value;
}

function getNeighborCounts(board: number[][]) {
  let maxSpacePoints: BoardPoint[] = [];
  let minSpacePoints: BoardPoint[] = [];
  let maxNeighborCount = -1;
  let minNeighborCount = 5;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const row = board[i];
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (0 < row[j]) continue;

      let neighborCount = 0;
      (0 == i || board[i - 1][j] !== 0) && neighborCount++;
      (i == BOARD_SIZE - 1 || board[i + 1][j] !== 0) && neighborCount++;
      (0 == j || row[j - 1] !== 0) && neighborCount++;
      (j == BOARD_SIZE - 1 || row[j + 1] !== 0) && neighborCount++;

      if (neighborCount === maxNeighborCount) {
        maxSpacePoints.push({ y: i, x: j });
      } else if (maxNeighborCount < neighborCount) {
        maxNeighborCount = neighborCount;
        maxSpacePoints = [{ y: i, x: j }];
      }

      if (neighborCount === minNeighborCount) {
        minSpacePoints.push({ y: i, x: j });
      } else if (neighborCount < minNeighborCount) {
        minNeighborCount = neighborCount;
        minSpacePoints = [{ y: i, x: j }];
      }
    }
  }

  return {
    maxSpacePoints: maxSpacePoints,
    minSpacePoints: minSpacePoints,
  };
}

function getLineSums(board: number[][], spacePoints: BoardPoint[]) {
  let maxLineSum = 0;
  let minLineSum = Infinity;
  let maxLineSumPoints: BoardPoint[] = [];
  let minLineSumPoints: BoardPoint[] = [];
  for (const point of spacePoints) {
    let lineSum = 0;

    function getCollidedValue(start: number, end: number, step: number, list: number[]) {
      for (let i = start; 0 <= i && i < list.length && i !== end; i += step) {
        if (list[i] !== 0) {
          lineSum += list[i];
          break;
        }
      }
    }

    const row = board[point.y];
    getCollidedValue(point.x - 1, -1, -1, row);
    getCollidedValue(point.x + 1, row.length, 1, row);

    const col = board.map(row => row[point.x]);
    getCollidedValue(point.y - 1, -1, -1, col);
    getCollidedValue(point.y + 1, col.length, 1, col);

    if (lineSum === maxLineSum) {
      maxLineSumPoints.push(point);
    } else if (maxLineSum < lineSum) {
      maxLineSum = lineSum;
      maxLineSumPoints = [point];
    }

    if (lineSum === minLineSum) {
      minLineSumPoints.push(point);
    } else if (lineSum < minLineSum) {
      minLineSum = lineSum;
      minLineSumPoints = [point];
    }
  }

  return {
    maxLineSumPoints: maxLineSumPoints,
    minLineSumPoints: minLineSumPoints,
  };
}

function moveLeft(currentBoard: number[][]) {
  let added_score = 0;
  const newBoard = createEmptyBoard();
  for (let i = 0; i < BOARD_SIZE; i++) {
    let targetIndex = 0;
    for (let j = 0; j < BOARD_SIZE; j++) {
      const currentValue = currentBoard[i][j];
      if (currentValue === 0) continue;
      const targetValue = newBoard[i][targetIndex];
      if (targetValue === 0) {
        newBoard[i][targetIndex] = currentValue;
      } else if (currentValue === newBoard[i][targetIndex]) {
        newBoard[i][targetIndex] *= 2;
        added_score += currentValue * 2;
        targetIndex++;
      } else {
        targetIndex++;
        newBoard[i][targetIndex] = currentValue;
      }
    }
  }
  return { newBoard, added_score };
}

function moveRight(currentBoard: number[][]) {
  let added_score = 0;
  const newBoard = createEmptyBoard();
  for (let i = 0; i < BOARD_SIZE; i++) {
    let targetIndex = BOARD_SIZE - 1;
    for (let j = BOARD_SIZE - 1; j >= 0; j--) {
      const currentValue = currentBoard[i][j];
      if (currentValue === 0) continue;
      const targetValue = newBoard[i][targetIndex];
      if (targetValue === 0) {
        newBoard[i][targetIndex] = currentValue;
      } else if (currentValue === newBoard[i][targetIndex]) {
        newBoard[i][targetIndex] *= 2;
        added_score += currentValue * 2;
        targetIndex--;
      } else {
        targetIndex--;
        newBoard[i][targetIndex] = currentValue;
      }
    }
  }
  return { newBoard, added_score };
}

function moveUp(currentBoard: number[][]) {
  let added_score = 0;
  const newBoard = createEmptyBoard();
  for (let j = 0; j < BOARD_SIZE; j++) {
    let targetIndex = 0;
    for (let i = 0; i < BOARD_SIZE; i++) {
      const currentValue = currentBoard[i][j];
      if (currentValue === 0) continue;
      const targetValue = newBoard[targetIndex][j];
      if (targetValue === 0) {
        newBoard[targetIndex][j] = currentValue;
      } else if (currentValue === newBoard[targetIndex][j]) {
        newBoard[targetIndex][j] *= 2;
        added_score += currentValue * 2;
        targetIndex++;
      } else {
        targetIndex++;
        newBoard[targetIndex][j] = currentValue;
      }
    }
  }
  return { newBoard, added_score };
}

function moveDown(currentBoard: number[][]) {
  let added_score = 0;
  const newBoard = createEmptyBoard();
  for (let j = 0; j < BOARD_SIZE; j++) {
    let targetIndex = BOARD_SIZE - 1;
    for (let i = BOARD_SIZE - 1; i >= 0; i--) {
      const currentValue = currentBoard[i][j];
      if (currentValue === 0) continue;
      const targetValue = newBoard[targetIndex][j];
      if (targetValue === 0) {
        newBoard[targetIndex][j] = currentValue;
      } else if (currentValue === newBoard[targetIndex][j]) {
        newBoard[targetIndex][j] *= 2;
        added_score += currentValue * 2;
        targetIndex--;
      } else {
        targetIndex--;
        newBoard[targetIndex][j] = currentValue;
      }
    }
  }
  return { newBoard, added_score };
}

export default function Game2048(props: { isActive: boolean }) {
  const { isActive } = props;

  const [isGameOver, setIsGameOver] = useState(false);
  const [isGameOverShown, setIsGameOverShown] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(defaultDifficulty);
  const [board, setBoard] = useState(createInitialBoard);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  if (isGameOverShown) {
    let message = `Game Over!`;
    if (highScore < score) {
      setHighScore(score);
      const saveData: Game2048SaveData = {
        highScore: score,
      };
      localStorage.setItem(SAVE_DATA_KEY, JSON.stringify(saveData));
      message += `\nハイスコアを更新しました！: ${highScore} → ${score}`;
    }
    setIsGameOverShown(false);
    setTimeout(() => alert(message), 100);
  }

  function createInitialBoard() {
    const board = createEmptyBoard();
    addTile(board);
    return board;
  }

  function addTile(board: number[][]) {
    switch (selectedDifficulty) {
      case "Easy":
        addTileEasy(board);
        break;
      case "Random":
        addTileRandom(board);
        break;
      case "Hard":
        addTileHard(board);
        break;
    }

    const serializedBoard = JSON.stringify(board);
    const newIsGameOver = JSON.stringify(moveUp(board).newBoard) === serializedBoard
      && JSON.stringify(moveDown(board).newBoard) === serializedBoard
      && JSON.stringify(moveLeft(board).newBoard) === serializedBoard
      && JSON.stringify(moveRight(board).newBoard) === serializedBoard;
    if (newIsGameOver) {
      setIsGameOver(true);
      setIsGameOverShown(true);
    }
  }

  function move(direction: "up" | "down" | "left" | "right") {
    let added_score: number | undefined;
    let newBoard: number[][] | undefined;
    if (direction === "up") {
      ({ newBoard, added_score } = moveUp(board));
    } else if (direction === "down") {
      ({ newBoard, added_score } = moveDown(board));
    } else if (direction === "left") {
      ({ newBoard, added_score } = moveLeft(board));
    } else if (direction === "right") {
      ({ newBoard, added_score } = moveRight(board));
    }
    if (newBoard) {
      if (JSON.stringify(newBoard) === JSON.stringify(board)) return;
      addTile(newBoard);
      setBoard(newBoard);
    }
    if (added_score) {
      setScore(score + added_score);
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const directions = {
        ArrowUp: "up" as const,
        ArrowDown: "down" as const,
        ArrowLeft: "left" as const,
        ArrowRight: "right" as const,
      };
      move(directions[e.key as keyof typeof directions]);
    };

    if (isActive) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, board, selectedDifficulty]);

  useEffect(() => {
    const savedData = localStorage.getItem(SAVE_DATA_KEY);
    if (savedData) {
      const parsedData: Game2048SaveData = JSON.parse(savedData);
      setHighScore(parsedData.highScore);
    }
  }, [])

  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX = e.changedTouches[0].clientX;
    touchEndY = e.changedTouches[0].clientY;

    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;

    if (Math.abs(dx) > Math.abs(dy)) {
      // 左右
      if (dx > 30) move("right");
      else if (dx < -30) move("left");
    } else {
      // 上下
      if (dy > 30) move("down");
      else if (dy < -30) move("up");
    }
  };

  return (
    <div className="container">
      <div className="row">
        <div className="col-12">
          <span>score: {score}</span>
          <span className="ms-2">high score: {highScore}</span>
          {isGameOver && <span className="ms-2 text-danger">Game Over</span>}
        </div>
        <div className="col-12">
          <table onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} style={{ touchAction: "none" }}>
            {board.map((row) => (
              <tr>
                {row.map((value) => (
                  <Tile value={value} />
                ))}
              </tr>
            ))}
          </table>
        </div>
        <div className="col-12">
          {difficulties.map((difficulty) => (
            <div className="form-check">
              <input className="form-check-input" type="radio" name="difficulty" id={difficulty} value={difficulty} checked={difficulty === selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as Difficulty)} />
              <label className="form-check-label" htmlFor={difficulty}>{difficulty}</label>
            </div>
          ))}
        </div>
        <div className="col-12 mt-3">
          <button className="btn btn-primary" onClick={() => setBoard(createInitialBoard())}>リセット</button>
        </div>
      </div>
    </div>
  )
}

function Tile({ value }: { value: number }) {
  return (
    <td className={`tile tile-${value} tile-font-size-${String(value).length} border`} style={value === 0 ? {} : { backgroundColor: getStepColor(Math.log2(value)) }}>
      {value === 0 ? "" : value}
    </td>
  );
}


/**
 * 1〜stepsの番号を渡すと色相を等分してHEXカラーコードを返す
 * @param index 1〜steps の番号
 * @param steps 全段階数（デフォルト14）
 * @param saturation 彩度（%）
 * @param lightness 明度（%）
 */
function getStepColor(
  index: number,
  steps: number = 14,
  saturation: number = 70,
  lightness: number = 70
): string {
  if (index < 1 || index > steps) {
    throw new Error(`index must be between 1 and ${steps}`);
  }
  const hue = (360 * (index - 1)) / steps;
  return hslToHex(hue, saturation, lightness);
}

/** HSL → HEX 変換 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else[r, g, b] = [c, 0, x];

  const toHex = (v: number) => {
    const val = Math.round((v + m) * 255);
    return val.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
