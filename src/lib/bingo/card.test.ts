import { describe, test, expect } from 'vitest';
import {
  createCard,
  markCard,
  getAllLines,
  countBingoLines,
  countReachLines,
  isBlackout,
  columnLabelOf,
  getBingoLines,
  getReachPositions,
  COLUMN_RANGES,
} from './card';
import type { Card } from './types';
import { seededRng } from '../../tests/rng';
import { markPositions, markAll } from '../../tests/bingoCard';

// テストリスト（Step 1: List）
// SPEC: src/routes/bingo/SPEC.md の「カード」「ライン」から導出

// ── createCard ────────────────────────────────────────────────────────────────
// 仕様: 5x5・中央FREE・列ごとの番号レンジでカードを生成する

describe('createCard', () => {
  test('カードは5行5列である', () => {
    // Arrange
    const rng = () => 0;

    // Act
    const card = createCard(rng);

    // Assert
    expect(card.cells).toHaveLength(5);
    for (const row of card.cells) {
      expect(row).toHaveLength(5);
    }
  });
  test('中央(2,2)は FREE（value が null）である', () => {
    const card = createCard(seededRng(1));
    expect(card.cells[2][2].value).toBeNull();
  });

  test('中央(2,2)は最初からマーク済みである', () => {
    const card = createCard(seededRng(1));
    expect(card.cells[2][2].marked).toBe(true);
  });

  test('FREE 以外のセルは最初は未マークである', () => {
    const card = createCard(seededRng(1));
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (row === 2 && col === 2) continue;
        expect(card.cells[row][col].marked).toBe(false);
      }
    }
  });

  const columnSpecs: [label: string, col: number, min: number, max: number][] = [
    ['B', 0, 1, 15],
    ['I', 1, 16, 30],
    ['N', 2, 31, 45],
    ['G', 3, 46, 60],
    ['O', 4, 61, 75],
  ];

  test.each(columnSpecs)(
    '%s列(col=%i)の番号は全て %i〜%i の範囲である',
    (_label, col, min, max) => {
      const card = createCard(seededRng(7));
      for (let row = 0; row < 5; row++) {
        const value = card.cells[row][col].value;
        if (value === null) continue; // FREE
        expect(value).toBeGreaterThanOrEqual(min);
        expect(value).toBeLessThanOrEqual(max);
      }
    },
  );

  test('COLUMN_RANGES は列ごとの番号レンジを表す', () => {
    expect(COLUMN_RANGES).toEqual([
      [1, 15],
      [16, 30],
      [31, 45],
      [46, 60],
      [61, 75],
    ]);
  });

  test('同一カード内に重複する番号はない', () => {
    const card = createCard(seededRng(42));
    const values = card.cells.flat().map((cell) => cell.value);
    const numbers = values.filter((value): value is number => value !== null);
    expect(numbers).toHaveLength(24);
    expect(new Set(numbers).size).toBe(24);
  });

  test('同じ乱数列を渡すと同じカードが生成される', () => {
    expect(createCard(seededRng(123))).toEqual(createCard(seededRng(123)));
  });

  test('異なる乱数列を渡すと異なるカードが生成される', () => {
    expect(createCard(seededRng(1))).not.toEqual(createCard(seededRng(2)));
  });
});

// ── markCard ──────────────────────────────────────────────────────────────────
// 仕様: 抽選された番号を自動でマークする

describe('markCard', () => {
  test('カードにある番号を渡すと該当セルがマークされる', () => {
    // Arrange
    const card = createCard(seededRng(5));
    const target = card.cells[0][0].value as number;

    // Act
    const marked = markCard(card, target);

    // Assert
    expect(marked.cells[0][0].marked).toBe(true);
  });

  test('カードにない番号を渡してもマーク状態は変わらない', () => {
    const card = createCard(seededRng(5));
    const absent = card.cells
      .flat()
      .map((cell) => cell.value)
      .includes(3)
      ? 0 // 3 がカードにある場合は存在しない番号 0 を使う
      : 3;

    const marked = markCard(card, absent);

    expect(marked).toEqual(card);
  });

  test('マーク済みの番号を再度渡してもマーク状態は変わらない', () => {
    const card = createCard(seededRng(5));
    const target = card.cells[0][0].value as number;
    const once = markCard(card, target);

    const twice = markCard(once, target);

    expect(twice).toEqual(once);
  });

  test('元のカードを変更せず新しいカードを返す', () => {
    const card = createCard(seededRng(5));
    const target = card.cells[0][0].value as number;

    markCard(card, target);

    expect(card.cells[0][0].marked).toBe(false);
  });
});

// ── getAllLines ───────────────────────────────────────────────────────────────
// 仕様: 縦5本 + 横5本 + 斜め2本 = 12本

describe('getAllLines', () => {
  test('ラインは全部で12本である', () => {
    expect(getAllLines()).toHaveLength(12);
  });

  test('横ライン(row)が5本含まれる', () => {
    expect(getAllLines().filter((line) => line.kind === 'row')).toHaveLength(5);
  });

  test('縦ライン(col)が5本含まれる', () => {
    expect(getAllLines().filter((line) => line.kind === 'col')).toHaveLength(5);
  });

  test('斜めライン(diag)が2本含まれる', () => {
    expect(getAllLines().filter((line) => line.kind === 'diag')).toHaveLength(2);
  });

  test('各ラインは5マスで構成される', () => {
    for (const line of getAllLines()) {
      expect(line.positions).toHaveLength(5);
    }
  });

  test('斜めライン0は左上から右下である', () => {
    const diag = getAllLines().find((line) => line.kind === 'diag' && line.index === 0);
    expect(diag?.positions).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 2 },
      { row: 3, col: 3 },
      { row: 4, col: 4 },
    ]);
  });

  test('斜めライン1は右上から左下である', () => {
    const diag = getAllLines().find((line) => line.kind === 'diag' && line.index === 1);
    expect(diag?.positions).toEqual([
      { row: 0, col: 4 },
      { row: 1, col: 3 },
      { row: 2, col: 2 },
      { row: 3, col: 1 },
      { row: 4, col: 0 },
    ]);
  });
});

// ── countBingoLines ───────────────────────────────────────────────────────────
// 仕様: 全マスがマークされたラインの本数

describe('countBingoLines', () => {
  test('初期カード（FREE のみマーク）ではビンゴは0本である', () => {
    expect(countBingoLines(createCard(seededRng(3)))).toBe(0);
  });

  test('1行を全てマークするとビンゴは1本である', () => {
    // Arrange
    const card = createCard(seededRng(3));
    const row0 = getAllLines().find((line) => line.kind === 'row' && line.index === 0)!;

    // Act
    const marked = markPositions(card, row0.positions);

    // Assert
    expect(countBingoLines(marked)).toBe(1);
  });

  test('1列を全てマークするとビンゴは1本である', () => {
    const card = createCard(seededRng(3));
    const col0 = getAllLines().find((line) => line.kind === 'col' && line.index === 0)!;

    const marked = markPositions(card, col0.positions);

    expect(countBingoLines(marked)).toBe(1);
  });

  test('斜めを全てマークするとビンゴは1本である（FREE を含む）', () => {
    const card = createCard(seededRng(3));
    const diag = getAllLines().find((line) => line.kind === 'diag' && line.index === 0)!;

    const marked = markPositions(card, diag.positions);

    expect(countBingoLines(marked)).toBe(1);
  });

  test('縦と横が1本ずつ成立するとビンゴは2本である', () => {
    const card = createCard(seededRng(3));
    const row0 = getAllLines().find((line) => line.kind === 'row' && line.index === 0)!;
    const col4 = getAllLines().find((line) => line.kind === 'col' && line.index === 4)!;

    const marked = markPositions(markPositions(card, row0.positions), col4.positions);

    expect(countBingoLines(marked)).toBe(2);
  });

  test('FREE 以外を全てマークするとビンゴは12本である', () => {
    expect(countBingoLines(markAll(createCard(seededRng(3))))).toBe(12);
  });
});

// ── countReachLines ───────────────────────────────────────────────────────────
// 仕様: あと1マスで成立するラインの本数

describe('countReachLines', () => {
  test('初期カード（FREE のみマーク）ではリーチは0本である', () => {
    expect(countReachLines(createCard(seededRng(9)))).toBe(0);
  });

  test('1行のうち4マスをマークするとリーチは1本である', () => {
    // Arrange
    const card = createCard(seededRng(9));
    const row0 = getAllLines().find((line) => line.kind === 'row' && line.index === 0)!;

    // Act
    const marked = markPositions(card, row0.positions.slice(0, 4));

    // Assert
    expect(countReachLines(marked)).toBe(1);
  });

  test('成立済みのラインはリーチに数えない', () => {
    const card = createCard(seededRng(9));
    const row0 = getAllLines().find((line) => line.kind === 'row' && line.index === 0)!;

    const marked = markPositions(card, row0.positions);

    expect(countBingoLines(marked)).toBe(1);
    expect(countReachLines(marked)).toBe(0);
  });

  test('あと2マス必要なラインはリーチに数えない', () => {
    const card = createCard(seededRng(9));
    const row0 = getAllLines().find((line) => line.kind === 'row' && line.index === 0)!;

    const marked = markPositions(card, row0.positions.slice(0, 3));

    expect(countReachLines(marked)).toBe(0);
  });

  test('リーチが2本あれば2を返す', () => {
    const card = createCard(seededRng(9));
    const row0 = getAllLines().find((line) => line.kind === 'row' && line.index === 0)!;
    const row4 = getAllLines().find((line) => line.kind === 'row' && line.index === 4)!;

    const marked = markPositions(
      markPositions(card, row0.positions.slice(0, 4)),
      row4.positions.slice(0, 4),
    );

    expect(countReachLines(marked)).toBe(2);
  });
});

// ── isBlackout ────────────────────────────────────────────────────────────────
// 仕様: FREE 以外の24マス全てがマークされた状態

describe('isBlackout', () => {
  test('初期カードでは false を返す', () => {
    expect(isBlackout(createCard(seededRng(11)))).toBe(false);
  });

  test('FREE 以外の24マスを全てマークすると true を返す', () => {
    expect(isBlackout(markAll(createCard(seededRng(11))))).toBe(true);
  });

  test('1マスでも未マークなら false を返す', () => {
    // Arrange: 全マスマーク済みのカードから (0,0) だけ未マークに戻す
    const full = markAll(createCard(seededRng(11)));
    const almost: Card = {
      cells: full.cells.map((row, r) =>
        row.map((cell, c) => (r === 0 && c === 0 ? { ...cell, marked: false } : cell)),
      ),
    };

    // Act & Assert
    expect(isBlackout(almost)).toBe(false);
  });
});

// ── columnLabelOf ─────────────────────────────────────────────────────────────
// 仕様: 番号がどの列（B/I/N/G/O）に属するかを返す（抽選ボールの表示に使う）

describe('columnLabelOf', () => {
  test.each([
    [1, 'B'],
    [15, 'B'],
    [16, 'I'],
    [30, 'I'],
    [31, 'N'],
    [45, 'N'],
    [46, 'G'],
    [60, 'G'],
    [61, 'O'],
    [75, 'O'],
  ])('番号 %i の列ラベルは %s である', (value, label) => {
    expect(columnLabelOf(value)).toBe(label);
  });

  test('範囲外の番号を渡すと例外を投げる', () => {
    expect(() => columnLabelOf(0)).toThrow();
    expect(() => columnLabelOf(76)).toThrow();
  });
});

// ── getBingoLines ─────────────────────────────────────────────────────────────
// 仕様: 成立済みのラインを返す（UI でラインを強調表示するため）

describe('getBingoLines', () => {
  test('初期カードでは空配列を返す', () => {
    expect(getBingoLines(createCard(seededRng(13)))).toEqual([]);
  });

  test('横ライン0が成立するとそのラインを返す', () => {
    // Arrange
    const card = createCard(seededRng(13));
    const row0 = getAllLines().find((line) => line.kind === 'row' && line.index === 0)!;

    // Act
    const lines = getBingoLines(markPositions(card, row0.positions));

    // Assert
    expect(lines).toEqual([row0]);
  });

  test('返すライン数は countBingoLines と一致する', () => {
    const card = markAll(createCard(seededRng(13)));

    expect(getBingoLines(card)).toHaveLength(countBingoLines(card));
  });
});

// ── getReachPositions ─────────────────────────────────────────────────────────
// 仕様: リーチラインの未マークのマスを返す（UI でハイライトするため）

describe('getReachPositions', () => {
  test('初期カードでは空配列を返す', () => {
    expect(getReachPositions(createCard(seededRng(17)))).toEqual([]);
  });

  test('横ライン0の4マスをマークすると残る1マスを返す', () => {
    const card = createCard(seededRng(17));
    const row0 = getAllLines().find((line) => line.kind === 'row' && line.index === 0)!;

    const positions = getReachPositions(markPositions(card, row0.positions.slice(0, 4)));

    expect(positions).toEqual([{ row: 0, col: 4 }]);
  });

  test('複数のリーチが同じマスを指す場合は重複を除く', () => {
    // Arrange: 横ライン0 と 縦ライン4 のどちらも (0,4) だけが残る状態を作る
    const card = createCard(seededRng(17));
    const row0 = getAllLines().find((line) => line.kind === 'row' && line.index === 0)!;
    const col4 = getAllLines().find((line) => line.kind === 'col' && line.index === 4)!;

    // Act
    const marked = markPositions(
      markPositions(card, row0.positions.slice(0, 4)),
      col4.positions.slice(1),
    );

    // Assert
    expect(getReachPositions(marked)).toEqual([{ row: 0, col: 4 }]);
  });
});
