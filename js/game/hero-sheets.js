// Authored 4-direction / 3-pose walk cycles; no limb warping or body scaling.
export const HERO_SHEETS = Object.freeze({
  knight: new URL('../../assets/heroes/knight-walk.webp', import.meta.url).href,
  elf: new URL('../../assets/heroes/elf-walk.webp', import.meta.url).href,
  mage: new URL('../../assets/heroes/mage-walk.webp', import.meta.url).href,
  priest: new URL('../../assets/heroes/priest-walk.webp', import.meta.url).href,
});
export const HERO_CELL = 128;
export const HERO_FOOT_Y = 114;
export const HERO_BODY_HEIGHT = 96;
const WALK_SEQUENCE = [1, 0, 1, 2];
const images = new Map();
let loading;

export function directionRow(facing) {
  if (Math.abs(facing.x) > Math.abs(facing.y)) return facing.x >= 0 ? 0 : 2;
  return facing.y >= 0 ? 1 : 3;
}

export function heroFrame(state) {
  const row = directionRow(state.facing || { x: 0, y: 1 });
  const phase = (((state.walk || 0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const column = state.moving && !state.dead && !(state.attack > 0 || state.cast > 0)
    ? WALK_SEQUENCE[Math.floor(phase / (Math.PI / 2)) % 4] : 1;
  return { row, column, sx: column * HERO_CELL, sy: row * HERO_CELL };
}

export function preloadHeroSheets() {
  if (loading) return loading;
  if (typeof Image === 'undefined') return Promise.resolve();
  loading = Promise.all(Object.entries(HERO_SHEETS).map(([id, url]) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images.set(id, img); resolve(true); };
    img.onerror = () => resolve(false);
    img.src = url;
  })));
  return loading;
}

export function drawHeroSheet(ctx, x, y, state) {
  const img = images.get(state.classId);
  if (!img) { preloadHeroSheets(); return false; }
  const frame = heroFrame(state), scale = 46 * (state.scale || 1) / HERO_BODY_HEIGHT;
  ctx.save();
  ctx.translate(x, y);
  // Attack/cast retain this identity; existing game FX remain separate from the body.
  const attack = Math.max(0, Math.min(1, state.attack || 0));
  if (attack) {
    const facing = state.facing || { x: 0, y: 1 };
    const length = Math.hypot(facing.x, facing.y) || 1;
    const reach = Math.sin(attack * Math.PI) * 2 * (state.scale || 1);
    ctx.translate(facing.x / length * reach, facing.y / length * reach);
  }
  if (state.hurt > 0) ctx.filter = 'brightness(1.65) sepia(.3)';
  if (state.dead) { ctx.globalAlpha *= 0.6; ctx.rotate(-Math.PI / 2); }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, frame.sx, frame.sy, HERO_CELL, HERO_CELL,
    -HERO_CELL / 2 * scale, -HERO_FOOT_Y * scale, HERO_CELL * scale, HERO_CELL * scale);
  ctx.restore();
  return true;
}
