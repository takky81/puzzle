import type { Card, Cell, Line, Position, Rng } from './types';

export const SIZE = 5;
export const FREE_ROW = 2;
export const FREE_COL = 2;

/** 列ごとの番号レンジ（B/I/N/G/O） */
export const COLUMN_RANGES: readonly (readonly [number, number])[] = [
  [1, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75],
];

/** min〜max からランダムに count 個を重複なく選ぶ */
function pickDistinct(min: number, max: number, count: number, rng: Rng): number[] {
  const pool: number[] = [];
  for (let value = min; value <= max; value++) {
    pool.push(value);
  }
  const picked: number[] = [];
  for (let i = 0; i < count; i++) {
    const index = Math.floor(rng() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

export function createCard(rng: Rng): Card {
  const cells: Cell[][] = [];
  for (let row = 0; row < SIZE; row++) {
    cells.push([]);
  }
  for (let col = 0; col < SIZE; col++) {
    const [min, max] = COLUMN_RANGES[col];
    const isFreeColumn = col === FREE_COL;
    const values = pickDistinct(min, max, isFreeColumn ? SIZE - 1 : SIZE, rng);
    let valueIndex = 0;
    for (let row = 0; row < SIZE; row++) {
      if (isFreeColumn && row === FREE_ROW) {
        cells[row].push({ value: null, marked: true });
      } else {
        cells[row].push({ value: values[valueIndex++], marked: false });
      }
    }
  }
  return { cells };
}

/** 抽選された番号をマークした新しいカードを返す（元のカードは変更しない） */
export function markCard(card: Card, value: number): Card {
  return {
    cells: card.cells.map((row) =>
      row.map((cell) => (cell.value === value ? { ...cell, marked: true } : cell)),
    ),
  };
}

function buildAllLines(): Line[] {
  const lines: Line[] = [];
  for (let row = 0; row < SIZE; row++) {
    const positions: Position[] = [];
    for (let col = 0; col < SIZE; col++) {
      positions.push({ row, col });
    }
    lines.push({ kind: 'row', index: row, positions });
  }
  for (let col = 0; col < SIZE; col++) {
    const positions: Position[] = [];
    for (let row = 0; row < SIZE; row++) {
      positions.push({ row, col });
    }
    lines.push({ kind: 'col', index: col, positions });
  }
  const downRight: Position[] = [];
  const downLeft: Position[] = [];
  for (let i = 0; i < SIZE; i++) {
    downRight.push({ row: i, col: i });
    downLeft.push({ row: i, col: SIZE - 1 - i });
  }
  lines.push({ kind: 'diag', index: 0, positions: downRight });
  lines.push({ kind: 'diag', index: 1, positions: downLeft });
  return lines;
}

const ALL_LINES = buildAllLines();

/** 縦5本 + 横5本 + 斜め2本 = 12本のライン定義を返す */
export function getAllLines(): Line[] {
  return ALL_LINES;
}

/** ライン上の未マークのマス数 */
function countUnmarked(card: Card, line: Line): number {
  return line.positions.filter(({ row, col }) => !card.cells[row][col].marked).length;
}

/** 全マスがマークされたライン（ビンゴ）の本数 */
export function countBingoLines(card: Card): number {
  return getBingoLines(card).length;
}

/** あと1マスで成立するライン（リーチ）の本数 */
export function countReachLines(card: Card): number {
  return ALL_LINES.filter((line) => countUnmarked(card, line) === 1).length;
}

/** FREE 以外の全マスがマークされているか */
export function isBlackout(card: Card): boolean {
  return card.cells.every((row) => row.every((cell) => cell.marked));
}

/** 列の見出しラベル */
export const COLUMN_LABELS = ['B', 'I', 'N', 'G', 'O'] as const;

/** 番号が属する列のラベルを返す */
export function columnLabelOf(value: number): string {
  const col = COLUMN_RANGES.findIndex(([min, max]) => value >= min && value <= max);
  if (col === -1) {
    throw new Error(`columnLabelOf: 範囲外の番号 ${value}`);
  }
  return COLUMN_LABELS[col];
}

/** 成立済みのラインを返す */
export function getBingoLines(card: Card): Line[] {
  return ALL_LINES.filter((line) => countUnmarked(card, line) === 0);
}

/** リーチラインの未マークのマス（重複なし）を返す */
export function getReachPositions(card: Card): Position[] {
  const seen = new Set<number>();
  const positions: Position[] = [];
  for (const line of ALL_LINES) {
    if (countUnmarked(card, line) !== 1) continue;
    const position = line.positions.find(({ row, col }) => !card.cells[row][col].marked);
    if (!position) continue;
    const key = position.row * SIZE + position.col;
    if (seen.has(key)) continue;
    seen.add(key);
    positions.push(position);
  }
  return positions;
}
