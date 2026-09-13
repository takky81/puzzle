import { markCard, getAllLines } from '$lib/bingo/card';
import type { Card, Line, Position } from '$lib/bingo/types';

/** 指定位置のマスをマークしたカードを返す（FREE は無視） */
export function markPositions(card: Card, positions: Position[]): Card {
  return positions.reduce((acc, { row, col }) => {
    const value = acc.cells[row][col].value;
    return value === null ? acc : markCard(acc, value);
  }, card);
}

/** FREE 以外の全マスをマークしたカードを返す */
export function markAll(card: Card): Card {
  const positions: Position[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      positions.push({ row, col });
    }
  }
  return markPositions(card, positions);
}

/** kind と index でラインを取得する */
export function lineOf(kind: Line['kind'], index: number): Line {
  const line = getAllLines().find((l) => l.kind === kind && l.index === index);
  if (!line) throw new Error(`line not found: ${kind}#${index}`);
  return line;
}

/** 指定した本数のビンゴが成立したカードを返す（横ラインを上から順に埋める） */
export function markRows(card: Card, count: number): Card {
  let result = card;
  for (let index = 0; index < count; index++) {
    result = markPositions(result, lineOf('row', index).positions);
  }
  return result;
}
