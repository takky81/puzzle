import type { Puck, Paddle, Field, GameConfig, Rect } from './types';

const MAX_SPEED = 800;
const MAX_DT = 0.05;

export function movePuck(puck: Puck, dt: number, config: GameConfig): Puck {
  const clampedDt = Math.min(dt, MAX_DT);

  let vx = puck.vel.x * config.friction;
  let vy = puck.vel.y * config.friction;

  const speed = Math.hypot(vx, vy);
  if (speed > MAX_SPEED) {
    const scale = MAX_SPEED / speed;
    vx *= scale;
    vy *= scale;
  }

  return {
    ...puck,
    pos: { x: puck.pos.x + vx * clampedDt, y: puck.pos.y + vy * clampedDt },
    vel: { x: vx, y: vy },
  };
}

export function reflectWalls(
  puck: Puck,
  field: Field,
  config: GameConfig,
): { puck: Puck; goal: 1 | 2 | null } {
  const goalLeft = (field.width - field.goalWidth) / 2;
  const goalRight = (field.width + field.goalWidth) / 2;

  let x = puck.pos.x;
  let y = puck.pos.y;
  let vx = puck.vel.x;
  let vy = puck.vel.y;

  // Left wall
  if (x - puck.radius < 0 && vx < 0) {
    x = puck.radius;
    vx = Math.abs(vx) * config.restitution;
  }
  // Right wall
  if (x + puck.radius > field.width && vx > 0) {
    x = field.width - puck.radius;
    vx = -Math.abs(vx) * config.restitution;
  }

  const inGoalX = x >= goalLeft && x <= goalRight;

  // Goal scoring: puck center past goal line within goal x range
  if (y < 0 && inGoalX) {
    return { puck: { ...puck, pos: { x, y }, vel: { x: vx, y: vy } }, goal: 1 };
  }
  if (y > field.height && inGoalX) {
    return { puck: { ...puck, pos: { x, y }, vel: { x: vx, y: vy } }, goal: 2 };
  }

  // Top wall outside goal
  if (y - puck.radius < 0 && !inGoalX && vy < 0) {
    y = puck.radius;
    vy = Math.abs(vy) * config.restitution;
  }
  // Bottom wall outside goal
  if (y + puck.radius > field.height && !inGoalX && vy > 0) {
    y = field.height - puck.radius;
    vy = -Math.abs(vy) * config.restitution;
  }

  return { puck: { ...puck, pos: { x, y }, vel: { x: vx, y: vy } }, goal: null };
}

export function reflectGoalposts(puck: Puck, field: Field, config: GameConfig): Puck {
  const goalLeft = (field.width - field.goalWidth) / 2;
  const goalRight = (field.width + field.goalWidth) / 2;

  const posts = [
    { x: goalLeft, y: 0 },
    { x: goalRight, y: 0 },
    { x: goalLeft, y: field.height },
    { x: goalRight, y: field.height },
  ];

  const pos = { x: puck.pos.x, y: puck.pos.y };
  const vel = { x: puck.vel.x, y: puck.vel.y };

  for (const post of posts) {
    const dx = pos.x - post.x;
    const dy = pos.y - post.y;
    const dist = Math.hypot(dx, dy);

    if (dist < puck.radius && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      const velN = vel.x * nx + vel.y * ny;

      if (velN < 0) {
        const impulse = -(1 + config.restitution) * velN;
        vel.x += impulse * nx;
        vel.y += impulse * ny;

        const overlap = puck.radius - dist;
        pos.x += nx * overlap;
        pos.y += ny * overlap;
      }
    }
  }

  return { ...puck, pos, vel };
}

export function collidePaddlePuck(
  paddle: Paddle,
  puck: Puck,
  config: GameConfig,
): { paddle: Paddle; puck: Puck } {
  const dx = puck.pos.x - paddle.pos.x;
  const dy = puck.pos.y - paddle.pos.y;
  const dist = Math.hypot(dx, dy);
  const minDist = paddle.radius + puck.radius;

  if (dist >= minDist || dist < 0.001) {
    return { paddle, puck };
  }

  const nx = dx / dist;
  const ny = dy / dist;

  const relVx = puck.vel.x - paddle.vel.x;
  const relVy = puck.vel.y - paddle.vel.y;
  const relVelN = relVx * nx + relVy * ny;

  if (relVelN >= 0) {
    return { paddle, puck };
  }

  const impulse = -(1 + config.restitution) * relVelN;
  let newVx = puck.vel.x + impulse * nx;
  let newVy = puck.vel.y + impulse * ny;

  const speed = Math.hypot(newVx, newVy);
  if (speed > MAX_SPEED) {
    const scale = MAX_SPEED / speed;
    newVx *= scale;
    newVy *= scale;
  }

  const overlap = minDist - dist;
  return {
    paddle,
    puck: {
      ...puck,
      pos: { x: puck.pos.x + nx * overlap, y: puck.pos.y + ny * overlap },
      vel: { x: newVx, y: newVy },
    },
  };
}

export function clampPaddleToZone(paddle: Paddle, zone: Rect): Paddle {
  const x = Math.max(
    zone.x + paddle.radius,
    Math.min(zone.x + zone.width - paddle.radius, paddle.pos.x),
  );
  const y = Math.max(
    zone.y + paddle.radius,
    Math.min(zone.y + zone.height - paddle.radius, paddle.pos.y),
  );
  return { ...paddle, pos: { x, y } };
}
