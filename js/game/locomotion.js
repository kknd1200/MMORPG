const TAU = Math.PI * 2;

// One cycle is a full left/right stride. Distance, not frame time, drives the feet.
export function advanceGait(entity, distance, dt, strideLength = 1.8) {
  const validDistance = Number.isFinite(distance) && distance > 0 && distance < 4 && !entity.dead ? distance : 0;
  if (validDistance) entity.walkPhase = ((entity.walkPhase || 0) + validDistance / strideLength * TAU) % TAU;
  const target = validDistance > 0.00001 ? 1 : 0;
  const response = 1 - Math.exp(-Math.max(0, dt) * (target ? 16 : 12));
  entity.walkWeight = (entity.walkWeight || 0) + (target - (entity.walkWeight || 0)) * response;
  if (entity.dead || entity.walkWeight < 0.001) entity.walkWeight = 0;
  const facing = entity.facing || { x: 0, y: 1 };
  const angle = Math.atan2(facing.y, facing.x);
  const previous = entity.visualAngle ?? angle;
  const difference = Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous));
  entity.visualAngle = previous + difference * (1 - Math.exp(-Math.max(0, dt) * 18));
  entity.visualFacing = { x: Math.cos(entity.visualAngle), y: Math.sin(entity.visualAngle) };
}

export function footPose(phase, side, turn, weight) {
  const swing = Math.sin(phase + (side < 0 ? Math.PI : 0));
  return {
    stride: weight ? swing * 3.2 * turn * weight : 0,
    lift: Math.pow(Math.max(0, swing), 1.4) * 2.3 * weight,
    lateral: side * (3.6 - turn * 2.6),
  };
}

export function monsterStride(family, size = 1) {
  const base = family === 'spider' ? 1.15 : family === 'quadruped' ? 2.2 : 1.8;
  return base * Math.max(0.65, Math.sqrt(size));
}

// Eight distinct poses per stride, with alternating contact and swing phases.
export function monsterLimbPose(phase, limb, family, weight = 1) {
  const frame = Math.floor(((phase % TAU + TAU) % TAU) / TAU * 8);
  const soft = ['slime', 'serpent', 'plant'].includes(family);
  const offset = soft ? limb * 0.8 : (limb % 2) * Math.PI;
  const swing = Math.sin(frame / 8 * TAU + offset);
  return {
    stride: swing * (soft ? 0.025 : 0.065) * weight,
    lift: Math.max(0, swing) * (soft ? 0.012 : 0.045) * weight,
  };
}
