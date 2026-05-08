import type { GameState, Vec2, Puck, Field } from './types';
import { makeField } from './logic';

const PUCK_STOP_SPEED = 20;

export function computeAITarget(state: GameState): Vec2 {
  const field = makeField(state.config);
  const puck = state.puck;
  const ai = state.config.ai;
  const puckInAICourt = puck.pos.y < field.height / 2;

  if (ai.predictionBounces === 0) {
    return applyNoise(puck.pos, ai.targetNoiseRadius);
  }

  // Stopped puck in AI court: move to puck directly
  const puckSpeed = Math.hypot(puck.vel.x, puck.vel.y);
  if (puckInAICourt && puckSpeed <= PUCK_STOP_SPEED) {
    return applyNoise(puck.pos, ai.targetNoiseRadius);
  }

  // Puck in opponent court: defensive position
  if (!puckInAICourt) {
    const defensivePos: Vec2 = {
      x: field.width / 2,
      y: field.goalDepth + state.player2.radius + 10,
    };
    return applyNoise(defensivePos, ai.targetNoiseRadius);
  }

  // Puck in AI court: predict landing, clamp to reachable AI zone
  const rawLanding = predictLanding(puck, field, ai.predictionBounces);
  const landingPoint: Vec2 = {
    x: Math.max(puck.radius, Math.min(field.width - puck.radius, rawLanding.x)),
    y: Math.max(field.goalDepth, Math.min(field.height / 2, rawLanding.y)),
  };
  return applyNoise(landingPoint, ai.targetNoiseRadius);
}

function predictLanding(puck: Puck, field: Field, maxBounces: number): Vec2 {
  let x = puck.pos.x;
  let y = puck.pos.y;
  let vx = puck.vel.x;
  const vy = puck.vel.y;
  let bounces = 0;

  for (let i = 0; i < 200; i++) {
    if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001) break;

    const tLeft = vx < 0 ? (puck.radius - x) / vx : Infinity;
    const tRight = vx > 0 ? (field.width - puck.radius - x) / vx : Infinity;
    const tGoal = vy < 0 ? -y / vy : Infinity;
    const tMid = vy > 0 ? (field.height / 2 - y) / vy : Infinity;

    const tMin = Math.min(
      tLeft > 0 ? tLeft : Infinity,
      tRight > 0 ? tRight : Infinity,
      tGoal > 0 ? tGoal : Infinity,
      tMid > 0 ? tMid : Infinity,
    );

    if (!isFinite(tMin)) break;

    x += vx * tMin;
    y += vy * tMin;

    if (tGoal <= tMin || tMid <= tMin) break;

    if (tLeft <= tMin) {
      x = puck.radius;
      vx = Math.abs(vx);
    } else if (tRight <= tMin) {
      x = field.width - puck.radius;
      vx = -Math.abs(vx);
    }

    bounces++;
    if (bounces > maxBounces) break;
  }

  return { x, y };
}

function applyNoise(target: Vec2, radius: number): Vec2 {
  if (radius === 0) return target;
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * radius;
  return { x: target.x + r * Math.cos(angle), y: target.y + r * Math.sin(angle) };
}
