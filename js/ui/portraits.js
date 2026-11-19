import { preloadHeroSheets } from '../game/hero-sheets.js';
// All menus use the same class look and body scale as the in-game renderer.
import { CLASS_ORDER, CLASSES } from '../data/classes.js';
import { ITEMS } from '../data/items.js';
import { LOOKS, drawHumanoid } from '../game/sprites.js';

export const PORTRAIT_LAYOUT = Object.freeze({
  card: Object.freeze({ width: 44, height: 64, scale: 1, footY: 59 }),
  login: Object.freeze({ width: 96, height: 132, scale: 2, footY: 114 }),
});

export function loginRosterMarkup() {
  return CLASS_ORDER.map((id) => {
    const cls = CLASSES[id];
    return `<figure class="login-class"><canvas class="avatar" data-portrait="login" data-class="${id}" data-weapon="${cls.startEquipment.weapon}" role="img" aria-label="${cls.name} 캐릭터"></canvas><figcaption>${cls.name}</figcaption></figure>`;
  }).join('');
}

const waiting = new WeakSet();
export function paintAvatars(root) {
  if (!waiting.has(root)) {
    waiting.add(root);
    preloadHeroSheets().then(() => paintAvatars(root));
  }
  for (const cv of root.querySelectorAll('canvas.avatar')) {
    const cls = CLASSES[cv.dataset.class];
    const look = LOOKS[cv.dataset.class];
    if (!cls || !look) continue;
    const layout = PORTRAIT_LAYOUT[cv.dataset.portrait] || PORTRAIT_LAYOUT.card;
    const dpr = globalThis.devicePixelRatio || 1;
    cv.width = layout.width * dpr;
    cv.height = layout.height * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, layout.width, layout.height);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(layout.width / 2, layout.footY, 12 * layout.scale, 4 * layout.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    drawHumanoid(ctx, layout.width / 2, layout.footY, {
      classId: cv.dataset.class, look, facing: { x: 0.45, y: 0.9 }, walk: 0, moving: false, time: 0,
      scale: layout.scale,
      weaponColor: ITEMS[cv.dataset.weapon]?.icon?.color,
      armorId: cv.dataset.armor || null,
    });
  }
}
