// All menus use the same class look and body scale as the in-game renderer.
import { CLASS_ORDER, CLASSES } from '../data/classes.js';
import { ITEMS } from '../data/items.js';
import { LOOKS, drawHumanoid } from '../game/sprites.js';

export const PORTRAIT_LAYOUT = Object.freeze({
  card: Object.freeze({ width: 44, height: 64, scale: 1, footY: 59 }),
  login: Object.freeze({ width: 96, height: 132, scale: 2, footY: 114 }),
  // 게임 HUD: 상태창 · 파티 창 · 용병 고용 (상반신 위주로 크게)
  hud: Object.freeze({ width: 62, height: 62, scale: 1.25, footY: 78 }),
  frame: Object.freeze({ width: 36, height: 36, scale: 0.8, footY: 50 }),
  tab: Object.freeze({ width: 26, height: 26, scale: 0.6, footY: 37 }),
});

/** 캐릭터 한 명의 초상화 캔버스 (그리기는 paintAvatars) */
export function avatarMarkup(ch, layout = 'card', cls = '') {
  const eq = ch.equipment || {};
  return `<canvas class="avatar ${cls}" data-portrait="${layout}" data-class="${ch.classId}" data-weapon="${eq.weapon || ''}" data-armor="${eq.armor || ''}" role="img" aria-label=""></canvas>`;
}

export function loginRosterMarkup() {
  return CLASS_ORDER.map((id) => {
    const cls = CLASSES[id];
    return `<figure class="login-class"><canvas class="avatar" data-portrait="login" data-class="${id}" data-weapon="${cls.startEquipment.weapon}" role="img" aria-label="${cls.name} 캐릭터"></canvas><figcaption>${cls.name}</figcaption></figure>`;
  }).join('');
}

export function paintAvatars(root) {
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
