import { describe, test, expect } from 'vitest';
import {
  defaultConfig,
  DIFFICULTY_PRESETS,
  makeField,
  createInitialState,
  updateGame,
  resetPuck,
} from './logic';

// ── defaultConfig ─────────────────────────────────────────────────────────────
// 仕様: デフォルト設定値（物理パラメータ・ルールパラメータ・AIパラメータ）

describe('defaultConfig', () => {
  test('パック半径は 18px', () => {
    expect(defaultConfig().puckRadius).toBe(18);
  });
  test('パドル半径は 35px', () => {
    expect(defaultConfig().paddleRadius).toBe(35);
  });
  test('ゴール幅はフィールド幅の 1/3', () => {
    expect(defaultConfig().goalWidthRatio).toBeCloseTo(1 / 3);
  });
  test('反発係数は 1.0（完全弾性）', () => {
    expect(defaultConfig().restitution).toBe(1.0);
  });
  test('摩擦係数は 0.998（ほぼなし）', () => {
    expect(defaultConfig().friction).toBe(0.998);
  });
  test('パック初速は 250px/s', () => {
    expect(defaultConfig().puckInitialSpeed).toBe(250);
  });
  test('勝利点数は 7 点', () => {
    expect(defaultConfig().winScore).toBe(7);
  });
  test('パックリセット角度の最大値は 10 度', () => {
    expect(defaultConfig().puckResetAngleMax).toBe(10);
  });
  test('デフォルト AI は normal プリセット', () => {
    expect(defaultConfig().ai).toEqual(DIFFICULTY_PRESETS.normal);
  });
});

// ── DIFFICULTY_PRESETS ────────────────────────────────────────────────────────
// 仕様: イージー / ノーマル / ハードの AI パラメータプリセット

describe('DIFFICULTY_PRESETS', () => {
  describe('easy（イージー）', () => {
    test('AI速度は 200px/s', () => {
      expect(DIFFICULTY_PRESETS.easy.speed).toBe(200);
    });
    test('反射予測回数は 0 回（軌道予測なし）', () => {
      expect(DIFFICULTY_PRESETS.easy.predictionBounces).toBe(0);
    });
    test('反応遅延は 300ms（最も鈍い）', () => {
      expect(DIFFICULTY_PRESETS.easy.reactionDelayMs).toBe(300);
    });
    test('狙いのばらつき半径は 60px（最も大きい）', () => {
      expect(DIFFICULTY_PRESETS.easy.targetNoiseRadius).toBe(60);
    });
  });

  describe('normal（ノーマル）', () => {
    test('AI速度は 350px/s', () => {
      expect(DIFFICULTY_PRESETS.normal.speed).toBe(350);
    });
    test('反射予測回数は 1 回', () => {
      expect(DIFFICULTY_PRESETS.normal.predictionBounces).toBe(1);
    });
    test('反応遅延は 100ms', () => {
      expect(DIFFICULTY_PRESETS.normal.reactionDelayMs).toBe(100);
    });
    test('狙いのばらつき半径は 30px', () => {
      expect(DIFFICULTY_PRESETS.normal.targetNoiseRadius).toBe(30);
    });
  });

  describe('hard（ハード）', () => {
    test('AI速度は 500px/s', () => {
      expect(DIFFICULTY_PRESETS.hard.speed).toBe(500);
    });
    test('反射予測回数は 2 回', () => {
      expect(DIFFICULTY_PRESETS.hard.predictionBounces).toBe(2);
    });
    test('反応遅延は 0ms（即時反応）', () => {
      expect(DIFFICULTY_PRESETS.hard.reactionDelayMs).toBe(0);
    });
    test('狙いのばらつきは 0px（完璧な狙い）', () => {
      expect(DIFFICULTY_PRESETS.hard.targetNoiseRadius).toBe(0);
    });
  });
});

// ── makeField ─────────────────────────────────────────────────────────────────
// 仕様: フィールドは 400×600px。ゴール幅は goalWidthRatio × 400。ゴール深さは 30px。

describe('makeField', () => {
  const config = defaultConfig();

  test('フィールド幅は 400px', () => {
    expect(makeField(config).width).toBe(400);
  });
  test('フィールド高さは 600px', () => {
    expect(makeField(config).height).toBe(600);
  });
  test('ゴール幅は goalWidthRatio × フィールド幅', () => {
    const field = makeField(config);
    expect(field.goalWidth).toBeCloseTo(config.goalWidthRatio * field.width);
  });
  test('ゴール深さは 30px', () => {
    expect(makeField(config).goalDepth).toBe(30);
  });
});

// ── createInitialState ────────────────────────────────────────────────────────
// 仕様: ゲーム開始時の初期状態。countdown フェーズから始まり、スコアは 0-0。

describe('createInitialState', () => {
  const config = defaultConfig();
  const field = makeField(config);

  test('フェーズは countdown から始まる', () => {
    expect(createInitialState('vs-ai', config).phase).toBe('countdown');
  });
  test('カウントダウン値は 3 から始まる', () => {
    expect(createInitialState('vs-ai', config).countdownValue).toBe(3);
  });
  test('スコアは 0-0 から始まる', () => {
    const { score } = createInitialState('vs-ai', config);
    expect(score.p1).toBe(0);
    expect(score.p2).toBe(0);
  });
  test('勝者は null', () => {
    expect(createInitialState('vs-ai', config).winner).toBeNull();
  });
  test('Player 1 パドルはフィールド下半分（自コート）中央に配置される', () => {
    const { player1 } = createInitialState('vs-ai', config);
    expect(player1.pos.x).toBe(field.width / 2);
    expect(player1.pos.y).toBeGreaterThan(field.height / 2);
  });
  test('Player 2 パドルはフィールド上半分（自コート）中央に配置される', () => {
    const { player2 } = createInitialState('vs-ai', config);
    expect(player2.pos.x).toBe(field.width / 2);
    expect(player2.pos.y).toBeLessThan(field.height / 2);
  });
  test('パックはフィールド中央に配置される', () => {
    const { puck } = createInitialState('vs-ai', config);
    expect(puck.pos.x).toBe(field.width / 2);
    expect(puck.pos.y).toBe(field.height / 2);
  });
  test('パックの初速は puckInitialSpeed と一致する', () => {
    const { puck } = createInitialState('vs-ai', config);
    const speed = Math.hypot(puck.vel.x, puck.vel.y);
    expect(speed).toBeCloseTo(config.puckInitialSpeed);
  });
});

// ── updateGame — countdown フェーズ ──────────────────────────────────────────
// 仕様: カウントダウン中はパックが動かない。パドルは動かせる。
//       3→2→1→0 と 1 秒ごとに減少し、0 になると playing フェーズへ遷移する。

describe('updateGame — countdown フェーズ', () => {
  const config = defaultConfig();
  const noInput = { paddleTarget: { x: 200, y: 450 }, grabbing: false };

  test('countdown 中はパックの位置が変わらない', () => {
    const state = createInitialState('vs-ai', config);
    const before = { ...state.puck.pos };
    const next = updateGame(state, 0.016, { p1: noInput, p2: noInput });
    expect(next.puck.pos.x).toBe(before.x);
    expect(next.puck.pos.y).toBe(before.y);
  });
  test('1 秒経過で countdownValue が 3 → 2 に変わる', () => {
    const state = createInitialState('vs-ai', config);
    const next = updateGame(state, 1.0, { p1: noInput, p2: noInput });
    expect(next.countdownValue).toBe(2);
  });
  test('2 秒経過で countdownValue が 3 → 1 に変わる', () => {
    const state = createInitialState('vs-ai', config);
    const next = updateGame(state, 2.0, { p1: noInput, p2: noInput });
    expect(next.countdownValue).toBe(1);
  });
  test('3 秒経過で countdownValue が 0 になり playing フェーズへ遷移する', () => {
    const state = createInitialState('vs-ai', config);
    const next = updateGame(state, 3.0, { p1: noInput, p2: noInput });
    expect(next.countdownValue).toBe(0);
    expect(next.phase).toBe('playing');
  });
  test('countdown 中もパドルは入力に従って移動できる', () => {
    const state = createInitialState('vs-ai', config);
    const p1Input = { paddleTarget: { x: 100, y: 450 }, grabbing: false };
    const next = updateGame(state, 0.016, { p1: p1Input, p2: noInput });
    expect(next.player1.pos.x).not.toBe(state.player1.pos.x);
  });
});

// ── updateGame — playing フェーズ ─────────────────────────────────────────────
// 仕様: パックが物理演算で動く。パドルは自コート内のみ移動可能。
//       ゴール判定でスコアが増加し goal フェーズへ。grabbing=true でパックを掴める。

describe('updateGame — playing フェーズ', () => {
  const config = defaultConfig();
  const field = makeField(config);
  const noInput = { paddleTarget: { x: 200, y: 450 }, grabbing: false };

  function playingState() {
    return { ...createInitialState('vs-ai', config), phase: 'playing' as const };
  }

  test('パックが毎フレーム速度に応じて移動する', () => {
    const state = {
      ...playingState(),
      puck: { pos: { x: 200, y: 300 }, vel: { x: 100, y: 0 }, radius: 18 },
    };
    const next = updateGame(state, 0.016, { p1: noInput, p2: noInput });
    expect(next.puck.pos.x).toBeGreaterThan(200);
  });
  test('Player 1 パドルは自コート（下半分）の下端より外に出ない', () => {
    const state = playingState();
    const farBelowInput = { paddleTarget: { x: 200, y: 650 }, grabbing: false };
    const next = updateGame(state, 0.1, { p1: farBelowInput, p2: noInput });
    expect(next.player1.pos.y).toBeLessThan(field.height - field.goalDepth);
  });
  test('Player 1 パドルは速度制限なく入力位置に即座に移動する（dt が小さくても到達）', () => {
    const state = playingState();
    const farTarget = { paddleTarget: { x: 50, y: 520 }, grabbing: false };
    const next = updateGame(state, 0.001, { p1: farTarget, p2: noInput });
    expect(next.player1.pos.x).toBeCloseTo(50);
    expect(next.player1.pos.y).toBeCloseTo(520);
  });
  test('Player 1 パドルが瞬間移動してパックをすり抜けた場合も CCD で衝突を検出する', () => {
    // パドルが x=100→300 に瞬間移動、パックは x=200 に静止（経路上）
    const state = {
      ...playingState(),
      player1: { pos: { x: 100, y: 520 }, vel: { x: 0, y: 0 }, radius: 35 },
      puck: { pos: { x: 200, y: 520 }, vel: { x: 0, y: 0 }, radius: 18 },
    };
    const p1Input = { paddleTarget: { x: 300, y: 520 }, grabbing: false };
    const next = updateGame(state, 0.016, { p1: p1Input, p2: noInput });
    // 通常判定: dist(300,200)=100 > 53 → 検出されない
    // CCD: パドル経路がパックを通過 → 速度が加わる
    expect(Math.abs(next.puck.vel.x)).toBeGreaterThan(0);
  });

  test('パドルがゾーン境界でクランプされてもパックとの衝突が正しく処理される', () => {
    // AI パドルがゾーン下端（y=265）にクランプされ、ターゲットがゾーン外（y=300）の場合
    // 修正前: paddle.vel.y=350（ゾーン外方向）が設定され relVelN>0 になり衝突無視→パックが沈み込む
    const config = defaultConfig();
    const p2ZoneBottom = field.height / 2 - config.paddleRadius; // 265
    const minDist = config.paddleRadius + config.puckRadius; // 53
    const state = {
      ...playingState(),
      player2: {
        pos: { x: 200, y: p2ZoneBottom },
        vel: { x: 0, y: 0 },
        radius: config.paddleRadius,
      },
      puck: {
        pos: { x: 200, y: p2ZoneBottom - minDist + 10 }, // パドルに 10px 重なっている（y=222）
        vel: { x: 0, y: 200 }, // パドル方向（下向き）に移動中
        radius: config.puckRadius,
      },
    };
    const p2Input = { paddleTarget: { x: 200, y: field.height / 2 }, grabbing: false }; // ゾーン外ターゲット
    const next = updateGame(state, 0.016, { p1: noInput, p2: p2Input });
    const dist = Math.hypot(
      next.puck.pos.x - next.player2.pos.x,
      next.puck.pos.y - next.player2.pos.y,
    );
    expect(dist).toBeGreaterThanOrEqual(minDist - 0.01);
  });

  test('Player 2 パドルは自コート（上半分）の上端より外に出ない', () => {
    const state = playingState();
    const p2Input = { paddleTarget: { x: 200, y: -50 }, grabbing: false };
    const next = updateGame(state, 0.1, { p1: noInput, p2: p2Input });
    expect(next.player2.pos.y).toBeGreaterThan(field.goalDepth);
  });
  test('パックがゴールを通過すると goal フェーズへ遷移しスコアが増える（Player 2 が得点）', () => {
    const goalX = field.width / 2;
    const state = {
      ...playingState(),
      puck: { pos: { x: goalX, y: field.height - 1 }, vel: { x: 0, y: 500 }, radius: 18 },
    };
    const next = updateGame(state, 0.016, { p1: noInput, p2: noInput });
    expect(next.phase).toBe('goal');
    expect(next.score.p2).toBe(1);
  });
  test('grabbing=true でパックの直上にいると grabbed フェーズになる', () => {
    const state = {
      ...playingState(),
      puck: { pos: { x: 200, y: 450 }, vel: { x: 0, y: 0 }, radius: 18 },
    };
    const grabInput = { paddleTarget: { x: 200, y: 450 }, grabbing: true };
    const next = updateGame(state, 0.016, { p1: grabInput, p2: noInput });
    expect(next.phase).toBe('grabbed');
  });
});

// ── updateGame — grabbed フェーズ ─────────────────────────────────────────────
// 仕様: パックが Player 1 の入力位置に追従する（自コート内に制限）。
//       grabbing=false になると playing フェーズに戻り、ドラッグ速度がパックに適用される。

describe('updateGame — grabbed フェーズ', () => {
  const config = defaultConfig();
  const noInput = { paddleTarget: { x: 200, y: 450 }, grabbing: false };

  function grabbedState() {
    return {
      ...createInitialState('vs-ai', config),
      phase: 'grabbed' as const,
      puck: {
        ...createInitialState('vs-ai', config).puck,
        pos: { x: 200, y: 450 },
        vel: { x: 0, y: 0 },
      },
    };
  }

  test('grabbing 中はパックが入力位置に追従する（自コート内）', () => {
    const state = grabbedState();
    const grabInput = { paddleTarget: { x: 210, y: 460 }, grabbing: true };
    const next = updateGame(state, 0.016, { p1: grabInput, p2: noInput });
    expect(next.puck.pos.x).toBeCloseTo(210);
    expect(next.puck.pos.y).toBeCloseTo(460);
  });
  test('grabbing=false になると playing フェーズに戻る', () => {
    const state = grabbedState();
    const next = updateGame(state, 0.016, { p1: noInput, p2: noInput });
    expect(next.phase).toBe('playing');
  });
  test('解放時にドラッグ速度がパックに引き継がれる', () => {
    const state = { ...grabbedState(), puck: { ...grabbedState().puck, vel: { x: 100, y: -200 } } };
    const next = updateGame(state, 0.016, { p1: noInput, p2: noInput });
    expect(Math.hypot(next.puck.vel.x, next.puck.vel.y)).toBeGreaterThan(0);
  });
});

// ── updateGame — goal フェーズ ────────────────────────────────────────────────
// 仕様: ゴール後 0.5 秒間演出を表示し、playing フェーズへ直接戻る（カウントダウンなし）。
//       goal フェーズ中もパドルは操作可能。
//       lastScorer を使ってパックを正しい位置にリセットする。

describe('updateGame — goal フェーズ', () => {
  const config = defaultConfig();
  const noInput = { paddleTarget: { x: 200, y: 450 }, grabbing: false };
  const field = makeField(config);

  function goalState(score = { p1: 0, p2: 1 }) {
    return {
      ...createInitialState('vs-ai', config),
      phase: 'goal' as const,
      score,
      goalTimer: 0,
      lastScorer: 2 as const,
    };
  }

  test('goalTimer が毎フレーム増加する', () => {
    const state = goalState();
    const next = updateGame(state, 0.1, { p1: noInput, p2: noInput });
    expect(next.goalTimer).toBeCloseTo(0.1);
  });
  test('0.5 秒経過後に playing フェーズへ遷移する', () => {
    const state = goalState();
    const next = updateGame(state, 0.6, { p1: noInput, p2: noInput });
    expect(next.phase).toBe('playing');
  });
  test('0.5 秒経過後にパックがセンターライン（y=height/2）にリセットされる', () => {
    const state = goalState({ p1: 0, p2: 1 });
    const next = updateGame(state, 0.6, { p1: noInput, p2: noInput });
    expect(next.puck.pos.y).toBeCloseTo(field.height / 2);
  });
  test('goal フェーズ中もパドルは操作可能', () => {
    const state = goalState();
    const p1Move = { paddleTarget: { x: 100, y: 450 }, grabbing: false };
    const next = updateGame(state, 0.016, { p1: p1Move, p2: noInput });
    expect(next.player1.pos.x).not.toBe(state.player1.pos.x);
  });
  test('勝利点数に達すると finished フェーズになり winner が設定される', () => {
    const field2 = makeField(config);
    const goalX = field2.width / 2;
    const state = {
      ...goalState({ p1: 0, p2: config.winScore - 1 }),
      phase: 'playing' as const,
      puck: { pos: { x: goalX, y: field2.height - 1 }, vel: { x: 0, y: 500 }, radius: 18 },
    };
    const next = updateGame(state, 0.016, { p1: noInput, p2: noInput });
    expect(next.phase).toBe('finished');
    expect(next.winner).toBe(2);
  });
});

// ── updateGame — paused フェーズ ──────────────────────────────────────────────
// 仕様: paused 中はゲームが完全に止まる（パックもパドルも動かない）。

describe('updateGame — paused フェーズ', () => {
  const config = defaultConfig();
  const noInput = { paddleTarget: { x: 200, y: 450 }, grabbing: false };

  test('paused 中はパックの位置が変わらない', () => {
    const s = createInitialState('vs-ai', config);
    const state = { ...s, phase: 'paused' as const, puck: { ...s.puck, vel: { x: 200, y: 0 } } };
    const next = updateGame(state, 0.016, { p1: noInput, p2: noInput });
    expect(next.puck.pos.x).toBe(state.puck.pos.x);
  });
  test('paused 中はパドルの位置が変わらない', () => {
    const s = createInitialState('vs-ai', config);
    const state = { ...s, phase: 'paused' as const };
    const p1Move = { paddleTarget: { x: 100, y: 450 }, grabbing: false };
    const next = updateGame(state, 0.016, { p1: p1Move, p2: noInput });
    expect(next.player1.pos.x).toBe(state.player1.pos.x);
  });
});

// ── resetPuck ─────────────────────────────────────────────────────────────────
// 仕様: 得点後、パックはセンターライン（y=height/2）の左端か右端（ランダム）に置かれる。
//       発射方向は得点された側（scoredAgainst）へ向かう。

describe('resetPuck', () => {
  const config = defaultConfig();
  const field = makeField(config);

  test('得点後、パックは y=height/2（センターライン）に配置される', () => {
    const p1scored = resetPuck(createInitialState('vs-ai', config), 1);
    const p2scored = resetPuck(createInitialState('vs-ai', config), 2);
    expect(p1scored.puck.pos.y).toBeCloseTo(field.height / 2);
    expect(p2scored.puck.pos.y).toBeCloseTo(field.height / 2);
  });
  test('パックは左端（x=puckRadius）か右端（x=width-puckRadius）のどちらかに配置される', () => {
    const next = resetPuck(createInitialState('vs-ai', config), 1);
    const leftX = config.puckRadius;
    const rightX = field.width - config.puckRadius;
    expect(next.puck.pos.x === leftX || next.puck.pos.x === rightX).toBe(true);
  });
  test('リセット後のパック速度は puckInitialSpeed と一致する', () => {
    const next = resetPuck(createInitialState('vs-ai', config), 1);
    expect(Math.hypot(next.puck.vel.x, next.puck.vel.y)).toBeCloseTo(config.puckInitialSpeed);
  });
  test('Player 1 が得点した場合、パックは上向き（Player 2 側）に発射される', () => {
    const next = resetPuck(createInitialState('vs-ai', config), 1);
    expect(next.puck.vel.y).toBeLessThan(0);
  });
  test('リセット後のフェーズは playing に戻る', () => {
    const next = resetPuck(createInitialState('vs-ai', config), 1);
    expect(next.phase).toBe('playing');
  });
});
