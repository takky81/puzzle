import type { Puck, Paddle, Field, GameConfig, Rect, Vec2 } from './types';

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
  prevPaddlePos?: Vec2,
  prevPuckPos?: Vec2,
): { paddle: Paddle; puck: Puck } {
  const minDist = paddle.radius + puck.radius;

  // CCD: パドルまたはパックが今フレームに相手をすり抜けたか判定
  if (prevPaddlePos || prevPuckPos) {
    const paddleStart = prevPaddlePos ?? paddle.pos;
    const puckStart = prevPuckPos ?? puck.pos;
    const t = sweptCircleContact(paddleStart, paddle.pos, puckStart, puck.pos, minDist);
    if (t !== null) {
      // 接触時刻 t における両オブジェクトの位置から衝突法線を算出
      const paddleAtT = {
        x: paddleStart.x + t * (paddle.pos.x - paddleStart.x),
        y: paddleStart.y + t * (paddle.pos.y - paddleStart.y),
      };
      const puckAtT = {
        x: puckStart.x + t * (puck.pos.x - puckStart.x),
        y: puckStart.y + t * (puck.pos.y - puckStart.y),
      };
      const cdx = puckAtT.x - paddleAtT.x;
      const cdy = puckAtT.y - paddleAtT.y;
      const cdist = Math.hypot(cdx, cdy);
      if (cdist < 0.001) return { paddle, puck };
      const nx = cdx / cdist;
      const ny = cdy / cdist;

      const relVx = puck.vel.x - paddle.vel.x;
      const relVy = puck.vel.y - paddle.vel.y;
      const relVelN = relVx * nx + relVy * ny;
      if (relVelN >= 0) return { paddle, puck };

      const impulse = -(1 + config.restitution) * relVelN;
      let newVx = puck.vel.x + impulse * nx;
      let newVy = puck.vel.y + impulse * ny;
      const speed = Math.hypot(newVx, newVy);
      if (speed > MAX_SPEED) {
        const scale = MAX_SPEED / speed;
        newVx *= scale;
        newVy *= scale;
      }

      // フレーム末に重なっている場合、CCD 法線方向（衝突時の正しい側）にパックを押し出す
      const finalDist = Math.hypot(puck.pos.x - paddle.pos.x, puck.pos.y - paddle.pos.y);
      const pos =
        finalDist < minDist
          ? { x: paddle.pos.x + nx * minDist, y: paddle.pos.y + ny * minDist }
          : puck.pos;

      return { paddle, puck: { ...puck, pos, vel: { x: newVx, y: newVy } } };
    }
  }

  // 位置ベース判定（通常の重なり検出）
  const dx = puck.pos.x - paddle.pos.x;
  const dy = puck.pos.y - paddle.pos.y;
  const dist = Math.hypot(dx, dy);

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

// 2つの円 a=[aStart→aEnd], b=[bStart→bEnd] が半径 minDist まで接近する
// 最初の正規化時刻 t ∈ [0,1] を返す。接触しない場合は null。
function sweptCircleContact(
  aStart: Vec2,
  aEnd: Vec2,
  bStart: Vec2,
  bEnd: Vec2,
  minDist: number,
): number | null {
  const Px = aStart.x - bStart.x;
  const Py = aStart.y - bStart.y;
  const Qx = aEnd.x - aStart.x - (bEnd.x - bStart.x);
  const Qy = aEnd.y - aStart.y - (bEnd.y - bStart.y);

  const a = Qx * Qx + Qy * Qy;
  const b = Px * Qx + Py * Qy;
  const c = Px * Px + Py * Py - minDist * minDist;

  if (a < 1e-10) return null;

  const disc = b * b - a * c;
  if (disc < 0) return null;

  const t = (-b - Math.sqrt(disc)) / a;
  return t >= 0 && t <= 1 ? t : null;
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
