// Cache poses from the project's ORIGINAL character painter, never a redesigned hero.
export const HERO_CELL = 96;
export const HERO_FOOT_Y = 76;
const WALK_SEQUENCE = [1, 0, 1, 2];
const POSE_PHASES = [Math.PI / 2, 0, Math.PI * 1.5];
const atlases = new Map();

export function directionRow(facing) {
  if (Math.abs(facing.x) > Math.abs(facing.y)) return facing.x >= 0 ? 0 : 2;
  return facing.y >= 0 ? 1 : 3;
}

export function heroFrame(state) {
  const row = directionRow(state.facing || { x: 0, y: 1 });
  const phase = (((state.walk || 0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const column = state.moving && !state.dead && !(state.attack > 0 || state.cast > 0)
    ? WALK_SEQUENCE[Math.floor(phase / (Math.PI / 2)) % 4] : 1;
  return { row, column, sx: column * HERO_CELL, sy: 0 };
}

export function drawHeroSheet(ctx, x, y, state, paintOriginal) {
  // Combat keeps its original animation and equipment rendering.
  if (!paintOriginal || !state.look || state.attack > 0 || state.cast > 0 || state.dead) return false;
  if (typeof document === 'undefined') return false;
  const f = state.facing || { x: 0, y: 1 };
  const direction = ((Math.round(Math.atan2(f.y, f.x) / (Math.PI / 4)) % 8) + 8) % 8;
  const key = JSON.stringify([state.classId, state.look, state.armorId, state.weaponColor, direction]);
  let atlas = atlases.get(key);
  if (!atlas) {
    atlas = document.createElement('canvas');
    const resolution = 2;
    atlas.width = HERO_CELL * 3 * resolution;
    atlas.height = HERO_CELL * resolution;
    const painter = atlas.getContext('2d');
    if (!painter) return false;
    painter.setTransform(resolution, 0, 0, resolution, 0, 0);
    const angle = direction * Math.PI / 4;
    for (let column = 0; column < 3; column++) {
      paintOriginal(painter, HERO_CELL * (column + 0.5), HERO_FOOT_Y, {
        ...state, scale: 1, facing: { x: Math.cos(angle), y: Math.sin(angle) },
        walk: POSE_PHASES[column], moving: column !== 1, motion: column === 1 ? 0 : 1,
        lockBody: true, hurt: 0, dead: false, attack: 0, cast: 0, time: 0,
      });
    }
    if (atlases.size >= 64) atlases.delete(atlases.keys().next().value);
    atlases.set(key, atlas);
  }
  const frame = heroFrame(state), scale = state.scale || 1;
  ctx.save();
  ctx.translate(x, y);
  if (state.hurt > 0) ctx.filter = 'sepia(1) saturate(6) hue-rotate(-45deg) brightness(' + (1 + state.hurt) + ')';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas, frame.column * HERO_CELL * 2, 0, HERO_CELL * 2, HERO_CELL * 2,
    -HERO_CELL / 2 * scale, -HERO_FOOT_Y * scale, HERO_CELL * scale, HERO_CELL * scale);
  ctx.restore();
  return true;
}
