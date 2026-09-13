import { describe, test, expect } from 'vitest';
import { compareHands, describeHand, evaluateHand, sortedHandIndices } from './hand';
import { cards } from '../../tests/pokerCards';

// テストリスト（Step 1: List）
// SPEC: src/routes/poker/SPEC.md の「カードと役」から導出

describe('evaluateHand', () => {
  test('どの役にも該当しなければハイカードになる', () => {
    // Arrange
    const hand = cards('Ks Qh 9d 7c 3s');

    // Act
    const rank = evaluateHand(hand);

    // Assert
    expect(rank.category).toBe('highCard');
  });

  test('同ランク2枚はワンペアになる', () => {
    expect(evaluateHand(cards('Ks Kh 9d 7c 3s')).category).toBe('onePair');
  });

  test('2枚+2枚はツーペアになる', () => {
    expect(evaluateHand(cards('Ks Kh 9d 9c 3s')).category).toBe('twoPair');
  });

  test('同ランク3枚はスリーカードになる', () => {
    expect(evaluateHand(cards('Ks Kh Kd 9c 3s')).category).toBe('threeOfAKind');
  });

  test('3枚+2枚はフルハウスになる', () => {
    expect(evaluateHand(cards('Ks Kh Kd 9c 9s')).category).toBe('fullHouse');
  });

  test('同ランク4枚はフォーカードになる', () => {
    expect(evaluateHand(cards('Ks Kh Kd Kc 9s')).category).toBe('fourOfAKind');
  });

  test('ハイカードのタイブレークはランクの降順である', () => {
    expect(evaluateHand(cards('9d Ks 3s Qh 7c')).tiebreak).toEqual([13, 12, 9, 7, 3]);
  });

  test('ワンペアのタイブレークはペアのランク→残り3枚の降順である', () => {
    expect(evaluateHand(cards('7d Ks 3s Kh 9c')).tiebreak).toEqual([13, 9, 7, 3]);
  });

  test('ツーペアのタイブレークは上位ペア→下位ペア→キッカーである', () => {
    expect(evaluateHand(cards('9d Ks 3s Kh 9c')).tiebreak).toEqual([13, 9, 3]);
  });

  test('スリーカードのタイブレークは3枚のランク→残り2枚の降順である', () => {
    expect(evaluateHand(cards('Kd 3s Ks 9c Kh')).tiebreak).toEqual([13, 9, 3]);
  });

  test('フルハウスのタイブレークは3枚のランク→2枚のランクである', () => {
    expect(evaluateHand(cards('9d Ks Kh 9c Kd')).tiebreak).toEqual([13, 9]);
  });

  test('フォーカードのタイブレークは4枚のランク→キッカーである', () => {
    expect(evaluateHand(cards('Kd 9s Ks Kc Kh')).tiebreak).toEqual([13, 9]);
  });

  test('連続する5枚はストレートになる', () => {
    expect(evaluateHand(cards('9s 8h 7d 6c 5s')).category).toBe('straight');
  });

  test('同スート5枚はフラッシュになる', () => {
    expect(evaluateHand(cards('Ks Qs 9s 7s 3s')).category).toBe('flush');
  });

  test('同スートの連続5枚はストレートフラッシュになる', () => {
    expect(evaluateHand(cards('9s 8s 7s 6s 5s')).category).toBe('straightFlush');
  });

  test('ロイヤルフラッシュはAハイのストレートフラッシュとして扱う', () => {
    const rank = evaluateHand(cards('As Ks Qs Js Ts'));
    expect(rank.category).toBe('straightFlush');
    expect(rank.tiebreak).toEqual([14]);
  });

  test('A-2-3-4-5 は5ハイのストレートになる', () => {
    expect(evaluateHand(cards('Ah 2s 3d 4c 5s')).category).toBe('straight');
  });

  test('A-2-3-4-5 の同スートは5ハイのストレートフラッシュになる', () => {
    expect(evaluateHand(cards('As 2s 3s 4s 5s')).category).toBe('straightFlush');
  });

  test('Q-K-A-2-3 は回り込まずハイカードになる', () => {
    expect(evaluateHand(cards('Qh Ks Ad 2c 3s')).category).toBe('highCard');
  });

  test('ストレートのタイブレークは最上位ランクのみである', () => {
    expect(evaluateHand(cards('5s 9s 8h 6c 7d')).tiebreak).toEqual([9]);
  });

  test('5ハイストレートのタイブレークは5である', () => {
    expect(evaluateHand(cards('Ah 2s 3d 4c 5s')).tiebreak).toEqual([5]);
  });

  test('フラッシュのタイブレークはランクの降順である', () => {
    expect(evaluateHand(cards('9s Ks 3s Qs 7s')).tiebreak).toEqual([13, 12, 9, 7, 3]);
  });

  test('5枚以外を渡すと例外を投げる', () => {
    expect(() => evaluateHand(cards('As Ks Qs Js'))).toThrow();
  });
});

describe('compareHands', () => {
  test('役のカテゴリが違えば強いカテゴリが勝つ', () => {
    // Arrange
    const flush = evaluateHand(cards('Ks Qs 9s 7s 3s'));
    const straight = evaluateHand(cards('9s 8h 7d 6c 5s'));

    // Act
    const result = compareHands(flush, straight);

    // Assert
    expect(result).toBeGreaterThan(0);
  });

  test('同じカテゴリならタイブレークの上位から比較する', () => {
    const kings = evaluateHand(cards('Ks Kh 9d 7c 3s'));
    const queens = evaluateHand(cards('Qs Qh Ad Kc 3s'));
    expect(compareHands(kings, queens)).toBeGreaterThan(0);
  });

  test('同じペアならキッカーで比較する', () => {
    const better = evaluateHand(cards('Ks Kh 9d 7c 3s'));
    const worse = evaluateHand(cards('Kd Kc 9s 7h 2s'));
    expect(compareHands(better, worse)).toBeGreaterThan(0);
    expect(compareHands(worse, better)).toBeLessThan(0);
  });

  test('タイブレークが全て同じなら引き分け（0）になる', () => {
    const a = evaluateHand(cards('Ks Kh 9d 7c 3s'));
    const b = evaluateHand(cards('Kd Kc 9s 7h 3h'));
    expect(compareHands(a, b)).toBe(0);
  });
});

describe('describeHand', () => {
  test('ワンペアは「ワンペア（K）」のように表示する', () => {
    expect(describeHand(evaluateHand(cards('Ks Kh 9d 7c 3s')))).toBe('ワンペア（K）');
  });

  test('ツーペアは上位ペアと下位ペアを表示する', () => {
    expect(describeHand(evaluateHand(cards('Ks Kh 9d 9c 3s')))).toBe('ツーペア（K と 9）');
  });

  test('フルハウスは3枚と2枚のランクを表示する', () => {
    expect(describeHand(evaluateHand(cards('Ks Kh Kd 9c 9s')))).toBe('フルハウス（K オーバー 9）');
  });

  test('ストレートは最上位ランクを表示する', () => {
    expect(describeHand(evaluateHand(cards('9s 8h 7d 6c 5s')))).toBe('ストレート（9ハイ）');
  });

  test('ハイカードは最上位ランクを表示する', () => {
    expect(describeHand(evaluateHand(cards('Ks Qh 9d 7c 3s')))).toBe('ハイカード（K）');
  });

  test('ランク11〜14はJ/Q/K/Aで表示する', () => {
    expect(describeHand(evaluateHand(cards('Js Jh 9d 7c 3s')))).toBe('ワンペア（J）');
    expect(describeHand(evaluateHand(cards('Qs Qh 9d 7c 3s')))).toBe('ワンペア（Q）');
    expect(describeHand(evaluateHand(cards('As Ah 9d 7c 3s')))).toBe('ワンペア（A）');
    expect(describeHand(evaluateHand(cards('Ts Th 9d 7c 3s')))).toBe('ワンペア（10）');
  });

  test('フォーカード・スリーカード・フラッシュ・ストレートフラッシュも表示できる', () => {
    expect(describeHand(evaluateHand(cards('Ks Kh Kd Kc 9s')))).toBe('フォーカード（K）');
    expect(describeHand(evaluateHand(cards('Ks Kh Kd 9c 3s')))).toBe('スリーカード（K）');
    expect(describeHand(evaluateHand(cards('Ks Qs 9s 7s 3s')))).toBe('フラッシュ（Kハイ）');
    expect(describeHand(evaluateHand(cards('9s 8s 7s 6s 5s')))).toBe(
      'ストレートフラッシュ（9ハイ）',
    );
  });
});

// テストリスト（Step 1: List）
// 役が一目でわかるように手札を並び替える

describe('sortedHandIndices', () => {
  /** 並び替え後の手札を 'Ks Kh ...' の表記で返す */
  const sorted = (notation: string): string => {
    const hand = cards(notation);
    const labels = notation.split(/\s+/);
    return sortedHandIndices(hand)
      .map((i) => labels[i])
      .join(' ');
  };

  test('元のインデックスを重複なく5個返す', () => {
    // Arrange
    const hand = cards('9d Ks 3s Qh 7c');

    // Act
    const indices = sortedHandIndices(hand);

    // Assert
    expect(indices).toHaveLength(5);
    expect([...indices].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  test('ワンペアはペアが先頭に来る', () => {
    expect(sorted('7d Ks 3s Kh 9c')).toBe('Ks Kh 9c 7d 3s');
  });

  test('ツーペアは上位ペア→下位ペア→キッカーの順になる', () => {
    expect(sorted('9d Ks 3s Kh 9c')).toBe('Ks Kh 9d 9c 3s');
  });

  test('スリーカードは3枚が先頭に来る', () => {
    expect(sorted('3s Kd 9c Ks Kh')).toBe('Kd Ks Kh 9c 3s');
  });

  test('フルハウスは3枚→2枚の順になる', () => {
    expect(sorted('9d Ks Kh 9c Kd')).toBe('Ks Kh Kd 9d 9c');
  });

  test('フォーカードは4枚→キッカーの順になる', () => {
    expect(sorted('Kd 9s Ks Kc Kh')).toBe('Kd Ks Kc Kh 9s');
  });

  test('ハイカードはランクの降順になる', () => {
    expect(sorted('9d Ks 3s Qh 7c')).toBe('Ks Qh 9d 7c 3s');
  });

  test('ストレートはランクの降順になる', () => {
    expect(sorted('5s 9s 8h 6c 7d')).toBe('9s 8h 7d 6c 5s');
  });

  test('A-2-3-4-5 のストレートは 5-4-3-2-A の順になる', () => {
    expect(sorted('Ah 2s 3d 4c 5s')).toBe('5s 4c 3d 2s Ah');
  });
});
