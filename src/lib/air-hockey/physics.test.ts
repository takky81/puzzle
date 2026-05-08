import { describe, test, expect } from 'vitest';
import {
  movePuck,
  reflectWalls,
  reflectGoalposts,
  collidePaddlePuck,
  clampPaddleToZone,
} from './physics';
import type { Puck, Paddle, Field, GameConfig } from './types';

const defaultConfig: GameConfig = {
  puckRadius: 18,
  paddleRadius: 35,
  goalWidthRatio: 1 / 3,
  restitution: 1.0,
  friction: 1.0,
  puckInitialSpeed: 250,
  winScore: 7,
  puckResetAngleMax: 10,
  ai: { speed: 350, predictionBounces: 1, reactionDelayMs: 100, targetNoiseRadius: 30 },
};

const defaultField: Field = { width: 400, height: 600, goalWidth: 400 / 3, goalDepth: 30 };

function makePuck(x: number, y: number, vx = 0, vy = 0): Puck {
  return { pos: { x, y }, vel: { x: vx, y: vy }, radius: 18 };
}

function makePaddle(x: number, y: number, vx = 0, vy = 0): Paddle {
  return { pos: { x, y }, vel: { x: vx, y: vy }, radius: 35 };
}

// ── movePuck ──────────────────────────────────────────────────────────────────
// 仕様: パックは速度ベクトルで動く。摩擦で毎フレーム速度が減衰する。
//       大きなdtはMAX_DT=50msに切り捨て、速度は最大800px/sに制限する。

describe('movePuck', () => {
  test('速度 × dt だけ位置が移動する', () => {
    const puck = makePuck(200, 300, 100, -50);
    const result = movePuck(puck, 0.016, defaultConfig);
    expect(result.pos.x).toBeCloseTo(200 + 100 * 0.016);
    expect(result.pos.y).toBeCloseTo(300 - 50 * 0.016);
  });

  test('dt が 50ms を超えた場合は 50ms に切り捨てる（タブ非表示などの大きなdt対策）', () => {
    const puck = makePuck(200, 300, 200, 0);
    const result = movePuck(puck, 1.0, defaultConfig);
    expect(result.pos.x).toBeCloseTo(200 + 200 * 0.05);
  });

  test('摩擦係数が毎フレーム速度に乗算される', () => {
    const config = { ...defaultConfig, friction: 0.99 };
    const puck = makePuck(200, 300, 100, 0);
    const result = movePuck(puck, 0.016, config);
    expect(result.vel.x).toBeCloseTo(100 * 0.99);
  });

  test('速度が 800px/s を超えた場合は 800px/s にクリップされる', () => {
    const puck = makePuck(200, 300, 1000, 0);
    const result = movePuck(puck, 0.001, defaultConfig);
    expect(result.vel.x).toBeCloseTo(800);
  });

  test('速度ゼロのパックは位置が変わらない', () => {
    const puck = makePuck(200, 300, 0, 0);
    const result = movePuck(puck, 0.016, defaultConfig);
    expect(result.pos.x).toBe(200);
    expect(result.pos.y).toBe(300);
  });
});

// ── reflectWalls ──────────────────────────────────────────────────────────────
// 仕様: 左右の壁では vx を反転。上下の壁ではゴール開口幅外なら vy を反転。
//       パック中心がゴール開口内かつ上端を超えると Player 1 得点、下端を超えると Player 2 得点。
//       反射時に反発係数を乗算する。

describe('reflectWalls', () => {
  describe('左右の壁反射', () => {
    test('左壁に当たると vx が正方向に反転する', () => {
      const puck = makePuck(5, 300, -200, 0);
      const { puck: result, goal } = reflectWalls(puck, defaultField, defaultConfig);
      expect(result.vel.x).toBeGreaterThan(0);
      expect(goal).toBeNull();
    });

    test('右壁に当たると vx が負方向に反転する', () => {
      const puck = makePuck(395, 300, 200, 0);
      const { puck: result, goal } = reflectWalls(puck, defaultField, defaultConfig);
      expect(result.vel.x).toBeLessThan(0);
      expect(goal).toBeNull();
    });

    test('壁反射に反発係数が乗算される', () => {
      const config = { ...defaultConfig, restitution: 0.8 };
      const puck = makePuck(5, 300, -100, 0);
      const { puck: result } = reflectWalls(puck, defaultField, config);
      expect(result.vel.x).toBeCloseTo(100 * 0.8);
    });
  });

  describe('上下の壁反射（ゴール開口外）', () => {
    test('上壁のゴール開口外に当たると vy が正方向に反転する', () => {
      const puck = makePuck(5, 5, 0, -200); // x=5 はゴール幅外
      const { puck: result, goal } = reflectWalls(puck, defaultField, defaultConfig);
      expect(result.vel.y).toBeGreaterThan(0);
      expect(goal).toBeNull();
    });

    test('下壁のゴール開口外に当たると vy が負方向に反転する', () => {
      const puck = makePuck(5, 595, 0, 200); // x=5 はゴール幅外
      const { puck: result, goal } = reflectWalls(puck, defaultField, defaultConfig);
      expect(result.vel.y).toBeLessThan(0);
      expect(goal).toBeNull();
    });
  });

  describe('ゴール判定', () => {
    test('パック中心がゴール開口内で上端を超えると Player 1 の得点になる', () => {
      const goalX = defaultField.width / 2;
      const puck = makePuck(goalX, -1, 0, -200);
      const { goal } = reflectWalls(puck, defaultField, defaultConfig);
      expect(goal).toBe(1);
    });

    test('パック中心がゴール開口内で下端を超えると Player 2 の得点になる', () => {
      const goalX = defaultField.width / 2;
      const puck = makePuck(goalX, 601, 0, 200);
      const { goal } = reflectWalls(puck, defaultField, defaultConfig);
      expect(goal).toBe(2);
    });

    test('パック中心がゴール開口幅外では上端に達してもゴールにならず反射する', () => {
      const puck = makePuck(5, 5, 0, -200); // x=5 はゴール範囲外
      const { puck: result, goal } = reflectWalls(puck, defaultField, defaultConfig);
      expect(goal).toBeNull();
      expect(result.vel.y).toBeGreaterThan(0);
    });
  });
});

// ── reflectGoalposts ──────────────────────────────────────────────────────────
// 仕様: ゴール開口の4隅に円柱ポスト（半径0の点）がある。
//       パックがポストに重なって近づいているとき、法線方向に反射する。

describe('reflectGoalposts', () => {
  const goalLeft = (defaultField.width - defaultField.goalWidth) / 2;
  const goalRight = (defaultField.width + defaultField.goalWidth) / 2;

  test('上ゴール左ポスト（上半分）に接触すると速度が変化する', () => {
    const puck = makePuck(goalLeft - 10, 8, 50, -200); // ポスト(goalLeft,0)からdist≈12.8<18
    const before = { vx: 50, vy: -200 };
    const result = reflectGoalposts(puck, defaultField, defaultConfig);
    expect(result.vel.x !== before.vx || result.vel.y !== before.vy).toBe(true);
  });

  test('上ゴール右ポスト（上半分）に接触すると速度が変化する', () => {
    const puck = makePuck(goalRight + 10, 8, -50, -200); // ポスト(goalRight,0)から近い
    const before = { vx: -50, vy: -200 };
    const result = reflectGoalposts(puck, defaultField, defaultConfig);
    expect(result.vel.x !== before.vx || result.vel.y !== before.vy).toBe(true);
  });

  test('下ゴール左ポスト（下半分）に接触すると速度が変化する', () => {
    const puck = makePuck(goalLeft - 10, defaultField.height - 8, 50, 200);
    const before = { vx: 50, vy: 200 };
    const result = reflectGoalposts(puck, defaultField, defaultConfig);
    expect(result.vel.x !== before.vx || result.vel.y !== before.vy).toBe(true);
  });

  test('下ゴール右ポスト（下半分）に接触すると速度が変化する', () => {
    const puck = makePuck(goalRight + 10, defaultField.height - 8, -50, 200);
    const before = { vx: -50, vy: 200 };
    const result = reflectGoalposts(puck, defaultField, defaultConfig);
    expect(result.vel.x !== before.vx || result.vel.y !== before.vy).toBe(true);
  });

  test('ポストから十分離れている場合は速度が変化しない', () => {
    const puck = makePuck(200, 300, 100, -100);
    const result = reflectGoalposts(puck, defaultField, defaultConfig);
    expect(result.vel.x).toBe(100);
    expect(result.vel.y).toBe(-100);
  });
});

// ── collidePaddlePuck ─────────────────────────────────────────────────────────
// 仕様: パドルとパックが重なって接近しているとき、衝突処理を行う。
//       パドルの速度もパックに転送される（スマッシュ可能）。
//       衝突後にパドルとパックが重ならない位置に押し出す。
//       衝突後の速度は最大 800px/s に制限する。反発係数を適用する。

describe('collidePaddlePuck', () => {
  test('パドルとパックが重なっていない場合は速度が変化しない', () => {
    const paddle = makePaddle(200, 500);
    const puck = makePuck(200, 200, 0, 100);
    const { puck: result } = collidePaddlePuck(paddle, puck, defaultConfig);
    expect(result.vel.y).toBe(100);
  });

  test('パックがパドルに向かって衝突すると法線方向に反射する', () => {
    const paddle = makePaddle(200, 500);
    // パドル(r=35)とパック(r=18)の接触距離 53px。dist=52 → 接触
    const puck = makePuck(200, 448, 0, 100);
    const { puck: result } = collidePaddlePuck(paddle, puck, defaultConfig);
    expect(result.vel.y).toBeLessThan(0);
  });

  test('高速移動するパドルの速度がパックに加算される（スマッシュ）', () => {
    const paddle = makePaddle(200, 500, 0, -300); // 上方向に高速移動中のパドル
    const puck = makePuck(200, 448, 0, 0);
    const { puck: result } = collidePaddlePuck(paddle, puck, defaultConfig);
    expect(result.vel.y).toBeLessThan(0);
  });

  test('衝突後はパドルとパックが重ならない（押し出し処理が働く）', () => {
    const paddle = makePaddle(200, 500);
    const puck = makePuck(200, 448, 0, 100);
    const { puck: result } = collidePaddlePuck(paddle, puck, defaultConfig);
    const dist = Math.hypot(result.pos.x - 200, result.pos.y - 500);
    expect(dist).toBeGreaterThanOrEqual(paddle.radius + puck.radius - 0.01);
  });

  test('衝突後の速度が 800px/s を超えない', () => {
    const paddle = makePaddle(200, 500, 0, -800);
    const puck = makePuck(200, 448, 0, 200);
    const { puck: result } = collidePaddlePuck(paddle, puck, defaultConfig);
    const speed = Math.hypot(result.vel.x, result.vel.y);
    expect(speed).toBeLessThanOrEqual(800 + 0.01);
  });

  test('反発係数が衝突速度に乗算される', () => {
    const config = { ...defaultConfig, restitution: 0.5 };
    const paddle = makePaddle(200, 500);
    const puck = makePuck(200, 448, 0, 100);
    const { puck: result } = collidePaddlePuck(paddle, puck, config);
    expect(result.vel.y).toBeCloseTo(-100 * 0.5, 0);
  });
});

// ── clampPaddleToZone ─────────────────────────────────────────────────────────
// 仕様: パドルはゾーン内にのみ移動できる。パドル半径分の余白を確保する。

describe('clampPaddleToZone', () => {
  const zone = { x: 0, y: 300, width: 400, height: 270 };

  test('ゾーン内のパドルは位置が変化しない', () => {
    const paddle = makePaddle(200, 400);
    const result = clampPaddleToZone(paddle, zone);
    expect(result.pos.x).toBe(200);
    expect(result.pos.y).toBe(400);
  });

  test('左端を超えたパドルはパドル半径分の位置にクランプされる', () => {
    const paddle = makePaddle(-10, 400);
    const result = clampPaddleToZone(paddle, zone);
    expect(result.pos.x).toBe(zone.x + paddle.radius);
  });

  test('右端を超えたパドルはゾーン右端からパドル半径分の位置にクランプされる', () => {
    const paddle = makePaddle(420, 400);
    const result = clampPaddleToZone(paddle, zone);
    expect(result.pos.x).toBe(zone.x + zone.width - paddle.radius);
  });

  test('上端を超えたパドルはゾーン上端からパドル半径分の位置にクランプされる', () => {
    const paddle = makePaddle(200, 250);
    const result = clampPaddleToZone(paddle, zone);
    expect(result.pos.y).toBe(zone.y + paddle.radius);
  });

  test('下端を超えたパドルはゾーン下端からパドル半径分の位置にクランプされる', () => {
    const paddle = makePaddle(200, 600);
    const result = clampPaddleToZone(paddle, zone);
    expect(result.pos.y).toBe(zone.y + zone.height - paddle.radius);
  });
});
