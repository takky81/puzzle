import { describe, expect, test } from 'vitest';
import {
  cellOwner,
  createGame,
  endStroke,
  extend,
  getConnectedCount,
  getTotalPairs,
  redo,
  resetGame,
  startStroke,
  undo,
} from './logic';
import type { GameState, Stage } from './types';

const simpleStage: Stage = {
  size: 2,
  numbers: [
    {
      id: 1,
      positions: [
        [0, 0],
        [1, 1],
      ],
    },
  ],
  solution: [
    {
      id: 1,
      path: [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
    },
  ],
};

describe('ナンバーリンク ロジック', () => {
  // === 初期状態 ===
  test('createGame: ステージから初期状態を生成する', () => {
    // Arrange / Act
    const state = createGame(simpleStage);

    // Assert
    expect(state.stage).toBe(simpleStage);
    expect(state.paths).toEqual([]);
    expect(state.isCleared).toBe(false);
    expect(state.history).toEqual([]);
    expect(state.future).toEqual([]);
    expect(state.activeId).toBeNull();
    expect(state.pendingStroke).toBeNull();
  });

  // === セル占有 ===
  test('cellOwner: 番号マスはその番号IDで占有されている', () => {
    const state = createGame(simpleStage);
    expect(cellOwner(state, [0, 0])).toBe(1);
    expect(cellOwner(state, [1, 1])).toBe(1);
  });

  test('cellOwner: 線で通過したマスはその番号IDで占有されている', () => {
    const base = createGame(simpleStage);
    const state = {
      ...base,
      paths: [
        {
          id: 1,
          cells: [
            [0, 0],
            [0, 1],
          ] as [number, number][],
        },
      ],
    };
    expect(cellOwner(state, [0, 1])).toBe(1);
  });

  test('cellOwner: 空きマスは null を返す', () => {
    const state = createGame(simpleStage);
    expect(cellOwner(state, [0, 1])).toBeNull();
    expect(cellOwner(state, [1, 0])).toBeNull();
  });

  test('cellOwner: グリッド外は null を返す', () => {
    const state = createGame(simpleStage);
    expect(cellOwner(state, [-1, 0])).toBeNull();
    expect(cellOwner(state, [2, 0])).toBeNull();
    expect(cellOwner(state, [0, 2])).toBeNull();
  });

  // === ストローク開始 (startStroke) ===
  test('startStroke: 番号マスから開始するとそのIDで新しいパスが始まる', () => {
    const state = createGame(simpleStage);
    const result = startStroke(state, [0, 0]);

    expect(result.activeId).toBe(1);
    expect(result.paths.find((p) => p.id === 1)?.cells).toEqual([[0, 0]]);
  });

  test('startStroke: 既存パスのある番号マスから開始すると既存パスをクリアして新規開始', () => {
    const base = createGame(simpleStage);
    const state: GameState = {
      ...base,
      paths: [
        {
          id: 1,
          cells: [
            [0, 0],
            [0, 1],
          ],
        },
      ],
    };
    const result = startStroke(state, [0, 0]);

    expect(result.paths.find((p) => p.id === 1)?.cells).toEqual([[0, 0]]);
    expect(result.activeId).toBe(1);
  });

  test('startStroke: 既存パスの末端セルから開始するとそのパスが継続される', () => {
    const base = createGame(simpleStage);
    const state: GameState = {
      ...base,
      paths: [
        {
          id: 1,
          cells: [
            [0, 0],
            [0, 1],
          ],
        },
      ],
    };
    const result = startStroke(state, [0, 1]);

    expect(result.activeId).toBe(1);
    expect(result.paths.find((p) => p.id === 1)?.cells).toEqual([
      [0, 0],
      [0, 1],
    ]);
  });

  test('startStroke: 空きマスから開始しても何も起こらない', () => {
    const state = createGame(simpleStage);
    const result = startStroke(state, [0, 1]);

    expect(result.activeId).toBeNull();
    expect(result.paths).toEqual([]);
  });

  test('startStroke: 既存パスの途中のマスから開始しても何も起こらない', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [0, 2],
          ],
        },
      ],
      solution: [],
    };
    const base = createGame(stage2);
    const state: GameState = {
      ...base,
      paths: [
        {
          id: 1,
          cells: [
            [0, 0],
            [0, 1],
            [0, 2],
          ],
        },
      ],
    };
    const result = startStroke(state, [0, 1]);

    expect(result.activeId).toBeNull();
  });

  // === 伸長 (extend) ===
  test('extend: 空きマスへ extend するとパスが延びる', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    let state = createGame(stage2);
    state = startStroke(state, [0, 0]);
    state = extend(state, [0, 1]);

    expect(state.paths.find((p) => p.id === 1)?.cells).toEqual([
      [0, 0],
      [0, 1],
    ]);
  });

  test('extend: ストローク未開始の場合は何も起こらない', () => {
    const state = createGame(simpleStage);
    const result = extend(state, [0, 1]);

    expect(result).toBe(state);
  });

  test('extend: 現在の末端から隣接しないマスへの extend は無視される', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    let state = createGame(stage2);
    state = startStroke(state, [0, 0]);
    const before = state;
    state = extend(state, [2, 2]); // 隣接していない

    expect(state.paths).toEqual(before.paths);
  });

  test('extend: 斜め方向への extend は無視される', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    let state = createGame(stage2);
    state = startStroke(state, [0, 0]);
    const before = state;
    state = extend(state, [1, 1]); // 斜め

    expect(state.paths).toEqual(before.paths);
  });
  test('extend: 自パスの1つ前のマスへ戻ると末尾を削る', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    let state = createGame(stage2);
    state = startStroke(state, [0, 0]);
    state = extend(state, [0, 1]);
    state = extend(state, [0, 2]);
    state = extend(state, [0, 1]); // 戻る

    expect(state.paths.find((p) => p.id === 1)?.cells).toEqual([
      [0, 0],
      [0, 1],
    ]);
  });
  test('extend: 他IDの線が通るマスへ extend するとそのマスから先の他ID線は削除される', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [0, 2],
          ],
        },
        {
          id: 2,
          positions: [
            [2, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    const base = createGame(stage2);
    const state: GameState = {
      ...base,
      paths: [
        {
          id: 2,
          cells: [
            [2, 0],
            [2, 1],
            [1, 1],
            [0, 1],
          ],
        },
      ],
      activeId: 1,
    };
    // ID 1 のパスを手動で (0,0) から開始した状態にする
    const withId1: GameState = {
      ...state,
      paths: [...state.paths, { id: 1, cells: [[0, 0]] }],
    };
    const result = extend(withId1, [0, 1]);

    expect(result.paths.find((p) => p.id === 1)?.cells).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(result.paths.find((p) => p.id === 2)?.cells).toEqual([
      [2, 0],
      [2, 1],
      [1, 1],
    ]);
  });
  test('extend: 自番号マス（反対端点）へ extend するとそのIDは完成する', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [0, 2],
          ],
        },
      ],
      solution: [],
    };
    let state = createGame(stage2);
    state = startStroke(state, [0, 0]);
    state = extend(state, [0, 1]);
    state = extend(state, [0, 2]);

    expect(state.paths.find((p) => p.id === 1)?.cells).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
  });

  test('extend: 完成済みパスは末端を越えて伸びない', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [0, 2],
          ],
        },
      ],
      solution: [],
    };
    const base = createGame(stage2);
    const state: GameState = {
      ...base,
      paths: [
        {
          id: 1,
          cells: [
            [0, 0],
            [0, 1],
            [0, 2],
          ],
        },
      ],
      activeId: 1,
    };
    const result = extend(state, [1, 2]); // tip (0,2) に隣接する空きマス

    expect(result.paths.find((p) => p.id === 1)?.cells).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
  });

  // === ストローク確定 (endStroke) ===
  test('endStroke: pendingStroke が history に積まれる', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    let state = createGame(stage2);
    state = startStroke(state, [0, 0]);
    state = extend(state, [0, 1]);
    state = endStroke(state);

    expect(state.history.length).toBe(1);
    expect(state.pendingStroke).toBeNull();
    expect(state.activeId).toBeNull();
  });

  test('endStroke: pendingStroke が未設定なら何もしない', () => {
    const state = createGame(simpleStage);
    const result = endStroke(state);
    expect(result).toBe(state);
  });

  test('endStroke: 末端タップのみでパスに変更がなければ history に積まない', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    const base = createGame(stage2);
    const withPath: GameState = {
      ...base,
      paths: [
        {
          id: 1,
          cells: [
            [0, 0],
            [0, 1],
          ],
        },
      ],
    };
    let state = startStroke(withPath, [0, 1]); // tip から継続（paths 不変）
    state = endStroke(state);

    expect(state.history).toEqual([]);
    expect(state.pendingStroke).toBeNull();
    expect(state.activeId).toBeNull();
  });

  test('endStroke: クリア判定が更新される', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [0, 2],
          ],
        },
      ],
      solution: [],
    };
    let state = createGame(stage2);
    state = startStroke(state, [0, 0]);
    state = extend(state, [0, 1]);
    state = extend(state, [0, 2]);
    state = endStroke(state);

    expect(state.isCleared).toBe(true);
  });

  test('endStroke: future がクリアされる', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    const base = createGame(stage2);
    const state: GameState = {
      ...base,
      pendingStroke: { before: [], after: [] },
      paths: [{ id: 1, cells: [[0, 0]] }],
      future: [{ before: [], after: [] }],
    };
    const result = endStroke(state);
    expect(result.future).toEqual([]);
  });

  // === undo / redo ===
  test('undo: 直前のストロークを取り消してパス状態を戻す', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    let state = createGame(stage2);
    state = startStroke(state, [0, 0]);
    state = extend(state, [0, 1]);
    state = endStroke(state);
    state = undo(state);

    expect(state.paths).toEqual([]);
    expect(state.history).toEqual([]);
    expect(state.future.length).toBe(1);
  });

  test('undo: 履歴が空なら何もしない', () => {
    const state = createGame(simpleStage);
    const result = undo(state);
    expect(result).toBe(state);
  });

  test('redo: 取り消したストロークを再適用する', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    let state = createGame(stage2);
    state = startStroke(state, [0, 0]);
    state = extend(state, [0, 1]);
    state = endStroke(state);
    state = undo(state);
    state = redo(state);

    expect(state.paths.find((p) => p.id === 1)?.cells).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(state.history.length).toBe(1);
    expect(state.future).toEqual([]);
  });

  test('redo: future が空なら何もしない', () => {
    const state = createGame(simpleStage);
    const result = redo(state);
    expect(result).toBe(state);
  });

  test('undo 後に新しいアクションをすると future がクリアされる', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    let state = createGame(stage2);
    state = startStroke(state, [0, 0]);
    state = extend(state, [0, 1]);
    state = endStroke(state);
    state = undo(state);
    // 新しいアクション
    state = startStroke(state, [0, 0]);
    state = extend(state, [1, 0]);
    state = endStroke(state);

    expect(state.future).toEqual([]);
  });

  // === リセット ===
  test('resetGame: 全パスが空になり履歴/futureもクリアされる', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    let state = createGame(stage2);
    state = startStroke(state, [0, 0]);
    state = extend(state, [0, 1]);
    state = endStroke(state);

    const reset = resetGame(state);

    expect(reset.paths).toEqual([]);
    expect(reset.history).toEqual([]);
    expect(reset.future).toEqual([]);
    expect(reset.isCleared).toBe(false);
  });

  // === クリア判定（追加） ===
  test('isCleared: 一部IDが繋がっていないとき false', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [0, 2],
          ],
        },
        {
          id: 2,
          positions: [
            [2, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    let state = createGame(stage2);
    state = startStroke(state, [0, 0]);
    state = extend(state, [0, 1]);
    state = extend(state, [0, 2]);
    state = endStroke(state);

    expect(state.isCleared).toBe(false);
  });

  test('isCleared: 空盤面では false', () => {
    const state = createGame(simpleStage);
    expect(state.isCleared).toBe(false);
  });

  // === 進捗 ===
  test('getConnectedCount: 完成しているペア数を返す', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [0, 2],
          ],
        },
        {
          id: 2,
          positions: [
            [2, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    let state = createGame(stage2);
    expect(getConnectedCount(state)).toBe(0);

    state = startStroke(state, [0, 0]);
    state = extend(state, [0, 1]);
    state = extend(state, [0, 2]);
    state = endStroke(state);

    expect(getConnectedCount(state)).toBe(1);
  });

  test('getTotalPairs: 総ペア数を返す', () => {
    const stage2: Stage = {
      size: 3,
      numbers: [
        {
          id: 1,
          positions: [
            [0, 0],
            [0, 2],
          ],
        },
        {
          id: 2,
          positions: [
            [2, 0],
            [2, 2],
          ],
        },
      ],
      solution: [],
    };
    const state = createGame(stage2);
    expect(getTotalPairs(state)).toBe(2);
  });
});
