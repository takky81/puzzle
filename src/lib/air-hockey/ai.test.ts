import { describe, test, expect } from 'vitest';
import { computeAITarget } from './ai';
import { defaultConfig, makeField, createInitialState } from './logic';
import type { GameState } from './types';

const config = defaultConfig();
const field = makeField(config);

function baseState(): GameState {
  return { ...createInitialState('vs-ai', config), phase: 'playing' };
}

// ── computeAITarget ───────────────────────────────────────────────────────────
// 仕様: AI の次フレームのパドル目標座標を返す。
//       predictionBounces / targetNoiseRadius / reactionDelayMs（呼び出し側管理）に従って動作する。

describe('computeAITarget', () => {
  // ── predictionBounces=0（軌道予測なし） ──────────────────────────────────
  // 仕様: パックの現在位置に向かうだけ。守備行動なし。

  describe('predictionBounces=0: 軌道予測なし', () => {
    test('AI コート内のパック位置がターゲットになる', () => {
      const state: GameState = {
        ...baseState(),
        puck: { pos: { x: 150, y: 100 }, vel: { x: 0, y: 50 }, radius: config.puckRadius },
        config: { ...config, ai: { ...config.ai, predictionBounces: 0, targetNoiseRadius: 0 } },
      };
      const target = computeAITarget(state);
      expect(target.x).toBeCloseTo(150);
      expect(target.y).toBeCloseTo(100);
    });

    test('相手コートにあるパック位置もそのままターゲットになる（守備しない）', () => {
      const state: GameState = {
        ...baseState(),
        puck: { pos: { x: 200, y: 450 }, vel: { x: 0, y: 0 }, radius: config.puckRadius },
        config: { ...config, ai: { ...config.ai, predictionBounces: 0, targetNoiseRadius: 0 } },
      };
      const target = computeAITarget(state);
      expect(target.x).toBeCloseTo(200);
      expect(target.y).toBeCloseTo(450);
    });
  });

  // ── predictionBounces>=1（軌道予測あり） ─────────────────────────────────
  // 仕様: パックが相手コートにあるときは自ゴール前の守備ポジションへ戻る。
  //       パックが AI コート内にあるときは壁反射を考慮した着弾点へ先回りする。

  describe('predictionBounces>=1: 守備行動と着弾点予測', () => {
    test('パックが相手コートにあるとき自ゴール前中央（守備ポジション）へ移動する', () => {
      const state: GameState = {
        ...baseState(),
        puck: { pos: { x: 200, y: 450 }, vel: { x: 0, y: 0 }, radius: config.puckRadius },
        config: { ...config, ai: { ...config.ai, predictionBounces: 1, targetNoiseRadius: 0 } },
      };
      const target = computeAITarget(state);
      expect(target.x).toBeCloseTo(field.width / 2, 0);
      expect(target.y).toBeLessThan(field.height / 2);
      expect(target.y).toBeGreaterThanOrEqual(field.goalDepth);
    });

    test('AI コート内のパックが右壁に向かうとき、反射後の着弾点（左寄り）をターゲットにする', () => {
      // predictionBounces=0: パック現在位置 x=350 → predictionBounces=1: 右壁反射後 x<<350
      const state0: GameState = {
        ...baseState(),
        puck: { pos: { x: 350, y: 200 }, vel: { x: 100, y: -50 }, radius: config.puckRadius },
        config: { ...config, ai: { ...config.ai, predictionBounces: 0, targetNoiseRadius: 0 } },
      };
      const state1: GameState = {
        ...state0,
        config: { ...config, ai: { ...config.ai, predictionBounces: 1, targetNoiseRadius: 0 } },
      };
      const target0 = computeAITarget(state0);
      const target1 = computeAITarget(state1);
      expect(target1.x).toBeLessThan(target0.x);
    });

    test('predictionBounces=2 では 1 より深く先読みしてターゲット x が変わる', () => {
      // 右壁 → 左壁と 2 回バウンスする軌道: 予測深度によってターゲット x が異なる
      const state1: GameState = {
        ...baseState(),
        puck: { pos: { x: 50, y: 100 }, vel: { x: -200, y: -50 }, radius: config.puckRadius },
        config: { ...config, ai: { ...config.ai, predictionBounces: 1, targetNoiseRadius: 0 } },
      };
      const state2: GameState = {
        ...state1,
        config: { ...config, ai: { ...config.ai, predictionBounces: 2, targetNoiseRadius: 0 } },
      };
      const target1 = computeAITarget(state1);
      const target2 = computeAITarget(state2);
      // 予測深度が異なるのでターゲット x が変わる（2回バウンス後は右寄りになる）
      expect(target2.x).not.toBeCloseTo(target1.x, 0);
    });

    test('ターゲットは常に AI ゾーン内（y: goalDepth ～ height/2）に収まる', () => {
      const patterns = [
        { pos: { x: 100, y: 100 }, vel: { x: 0, y: -100 } }, // AI コート内、ゴール方向
        { pos: { x: 200, y: 150 }, vel: { x: 150, y: 50 } }, // AI コート内、下方向
        { pos: { x: 300, y: 450 }, vel: { x: -50, y: -200 } }, // 相手コート
      ];
      for (const { pos, vel } of patterns) {
        const state: GameState = {
          ...baseState(),
          puck: { pos, vel, radius: config.puckRadius },
          config: { ...config, ai: { ...config.ai, predictionBounces: 1, targetNoiseRadius: 0 } },
        };
        const target = computeAITarget(state);
        expect(target.y).toBeGreaterThanOrEqual(field.goalDepth);
        expect(target.y).toBeLessThanOrEqual(field.height / 2);
      }
    });
  });

  // ── 停止パック対応 ────────────────────────────────────────────────────────
  // 仕様: AI コート内でパックが停止（speed ≤ 20px/s）したとき、AI はパック位置へ移動する。

  describe('停止パックへの対応', () => {
    test('speed ≤ 20px/s の停止パックが AI コートにあるときパック位置がターゲットになる', () => {
      const state: GameState = {
        ...baseState(),
        puck: { pos: { x: 150, y: 100 }, vel: { x: 5, y: -5 }, radius: config.puckRadius },
        config: { ...config, ai: { ...config.ai, predictionBounces: 1, targetNoiseRadius: 0 } },
      };
      const target = computeAITarget(state);
      expect(target.x).toBeCloseTo(150);
      expect(target.y).toBeCloseTo(100);
    });
  });

  // ── targetNoiseRadius（狙いのばらつき） ──────────────────────────────────
  // 仕様: targetNoiseRadius px の半径内にランダムな誤差を加算する。0 のときは誤差なし。

  describe('targetNoiseRadius: 狙いのばらつき', () => {
    test('targetNoiseRadius=0 のときターゲットがパック位置と完全一致する', () => {
      const state: GameState = {
        ...baseState(),
        puck: { pos: { x: 180, y: 80 }, vel: { x: 0, y: 0 }, radius: config.puckRadius },
        config: { ...config, ai: { ...config.ai, predictionBounces: 0, targetNoiseRadius: 0 } },
      };
      const target = computeAITarget(state);
      expect(target.x).toBe(180);
      expect(target.y).toBe(80);
    });

    test('targetNoiseRadius>0 のときターゲットが指定半径内に収まる（50回試行）', () => {
      const noiseRadius = 40;
      const state: GameState = {
        ...baseState(),
        puck: { pos: { x: 200, y: 120 }, vel: { x: 0, y: 0 }, radius: config.puckRadius },
        config: {
          ...config,
          ai: { ...config.ai, predictionBounces: 0, targetNoiseRadius: noiseRadius },
        },
      };
      for (let i = 0; i < 50; i++) {
        const target = computeAITarget(state);
        expect(Math.hypot(target.x - 200, target.y - 120)).toBeLessThanOrEqual(noiseRadius);
      }
    });
  });
});
