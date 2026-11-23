// Retarget the supplied south-facing lion's eight-step walk and nine-step
// crouch / rear / paw-strike / recovery onto each monster's existing artwork.
// These are motion controls, not replacement lion artwork or new directions.
const TAU = Math.PI * 2;
export const QUADRUPED_ATTACK_SECONDS = 0.72;
export const QUADRUPED_SKILL_SECONDS = 0.9;
export const QUADRUPED_IMPACT = 5 / 9;
const WALK = [0, 0.72, 1, 0.65, 0, -0.72, -1, -0.65];
// Existing atlas columns: ready, anticipation, extended strike, recovery.
const ATTACK = [
  { col: 3, crouch: 0, rear: 0, reach: 0 },
  { col: 3, crouch: 0.06, rear: 0, reach: -0.02 },
  { col: 0, crouch: 0.1, rear: 0, reach: -0.03 },
  { col: 0, crouch: 0.03, rear: 0.06, reach: 0 },
  { col: 1, crouch: 0, rear: 0.14, reach: 0.04 },
  { col: 1, crouch: 0, rear: 0.08, reach: 0.15 },
  { col: 2, crouch: 0.05, rear: 0, reach: 0.08 },
  { col: 2, crouch: 0.02, rear: 0, reach: 0.03 },
  { col: 3, crouch: 0, rear: 0, reach: 0 },
];
const frameAt = (phase) => Math.floor(((phase % TAU + TAU) % TAU) / TAU * 8) % 8;

export function quadrupedWalkPose(phase, weight = 1) {
  const frame = frameAt(phase);
  // Source art faces left. Front far/near, hind far/near: diagonal support.
  const legs = [0, 4, 4, 0].map(offset => {
    const swing = WALK[(frame + offset) % 8] * weight;
    return { stride: swing * 0.065, lift: Math.max(0, swing) * 0.055 };
  });
  return { frame, legs, bob: [0, .012, .018, .01, 0, .012, .018, .01][frame] * weight };
}

export function quadrupedAttackPose(progress, skill = false) {
  const p = Math.max(0, Math.min(1, progress));
  const frame = Math.min(8, Math.floor(p * 9));
  const pose = ATTACK[frame];
  return { ...pose, frame, col: pose.col + (skill ? 4 : 0) };
}

// Move intact foot patches about their hips; avoid the old horizontal strips
// which stretched paws into ribbons. Torso overlaps the attachment points.
export function drawQuadrupedFrame(ctx, sheet, def, m, progress, bodyPx) {
  const a = def.art, c = sheet.cell, k = c / 384, s = bodyPx / a.bodyHeight;
  const attacking = m.attackAnim > 0 && !m.dead;
  const attack = attacking ? quadrupedAttackPose(progress, m.animKind === 'skill') : null;
  const walk = quadrupedWalkPose(m.walkPhase || 0, m.dead || attacking ? 0 : (m.walkWeight ?? (m.moving ? 1 : 0)));
  const col = attack?.col ?? 3, sx = col * c, sy = a.row * c;
  const dx = -a.centerX * s, dy = -a.footY * s;
  ctx.save();
  // Feet stay at ground level during compression; front rises around hind feet.
  if (attack) {
    ctx.translate(-attack.reach * bodyPx, 0);
    ctx.rotate(attack.rear * .65);
    ctx.scale(1 + attack.crouch * .25, 1 - attack.crouch);
  } else ctx.translate(0, -walk.bob * bodyPx);
  if (attacking || m.dead || !(m.walkWeight ?? (m.moving ? 1 : 0))) {
    ctx.drawImage(sheet.src, sx, sy, c, c, dx, dy, 384 * s, 384 * s);
  } else {
    const cut = Math.floor((a.footY - a.bodyHeight * .32) * k);
    const left = Math.max(0, Math.floor((a.centerX - a.bodyWidth * .55) * k));
    const right = Math.min(c, Math.ceil((a.centerX + a.bodyWidth * .55) * k));
    if (left) ctx.drawImage(sheet.src, sx, sy + cut, left, c - cut, dx, dy + cut / k * s, left / k * s, (c - cut) / k * s);
    if (right < c) ctx.drawImage(sheet.src, sx + right, sy + cut, c - right, c - cut, dx + right / k * s, dy + cut / k * s, (c - right) / k * s, (c - cut) / k * s);
    for (let leg = 0; leg < 4; leg++) {
      const x0 = Math.round(left + (right - left) * leg / 4);
      const x1 = Math.round(left + (right - left) * (leg + 1) / 4);
      const pose = walk.legs[leg];
      const hipX = dx + (x0 + x1) / (2 * k) * s, hipY = dy + cut / k * s;
      ctx.save();
      ctx.translate(hipX, hipY);
      // Affine shear keeps the upper attachment fixed as the paw swings.
      ctx.transform(1, 0, pose.stride * bodyPx / Math.max(1, (a.footY - cut / k) * s),
        1 - pose.lift / .32, 0, 0);
      ctx.drawImage(sheet.src, sx + x0, sy + cut, x1 - x0, c - cut,
        dx + x0 / k * s - hipX, 0, (x1 - x0) / k * s, (c - cut) / k * s);
      ctx.restore();
    }
    ctx.drawImage(sheet.src, sx, sy, c, cut + 1, dx, dy, 384 * s, (cut + 1) / k * s);
  }
  ctx.restore();
  return bodyPx * (1 + (attack?.rear || walk.bob));
}
