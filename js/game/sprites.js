import { drawHeroSheet } from './hero-sheets.js';
import { footPose } from './locomotion.js';
// 캐릭터 · NPC · 몬스터 그림 (캔버스 도형으로 그리는 클래식 다크 판타지 풍 스프라이트)
//
// 좌표계: (0,0) = 발밑. 위쪽이 -y. 그리기 전에 바라보는 방향에 따라 좌우 반전하므로
// 옆모습에서는 항상 +x 가 "앞" 입니다.
//
// 방향은 8방향으로 나눕니다: 정면(남) / 뒷모습(북) / 옆(동·서) / 대각선 4방향.
// view = 'front' | 'back', turn = 0(정면/뒷모습) · 0.5(대각선) · 1(옆)

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- 색 유틸
const shadeCache = new Map();
export function shade(hex, amt) {
  const key = hex + amt;
  let v = shadeCache.get(key);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  v = `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  shadeCache.set(key, v);
  return v;
}

// 위→아래 명암 그라데이션 (윗면은 밝게, 아래는 어둡게)
function vgrad(ctx, color, y0, y1, hi = 0.25, lo = -0.35) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(color, hi));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, lo));
  return g;
}
// 좌→우 명암 (금속 광택)
function hgrad(ctx, color, x0, x1) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, shade(color, -0.35));
  g.addColorStop(0.35, shade(color, 0.35));
  g.addColorStop(0.6, color);
  g.addColorStop(1, shade(color, -0.45));
  return g;
}

const OUTLINE = 'rgba(12,8,6,0.9)';
function outlined(ctx, fill, lw = 1.2) {
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = lw; ctx.stroke();
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 바라보는 방향 → 8방향 시점
export function viewOf(facing) {
  const a = Math.atan2(facing.y, facing.x);
  const d = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; // 0=동 1=남동 2=남 ... 6=북
  const turn = d === 0 || d === 4 ? 1 : d === 2 || d === 6 ? 0 : 0.5;
  const view = d >= 5 && d <= 7 ? 'back' : 'front';
  const flip = facing.x < -0.01 ? -1 : 1;
  return { view, turn, flip, dir: d };
}

// ---------------------------------------------------------------- 사람형 캐릭터
// 직업별 외형 (원작 디자인). weaponColor/armorTint 는 장비에 따라 바뀜
export const LOOKS = {
  knight: {
    skin: '#e9c39b', hair: '#4a3020', hairStyle: 'short',
    helm: 'great', helmColor: '#9aa6b4', plume: '#b8262a',
    cape: '#7a1a1e', torso: '#8f9aa8', tabard: '#9e2328', trim: '#d8b45a',
    legs: '#5d6672', boots: '#3a2c22', arms: '#8f9aa8',
    weapon: 'sword', shield: '#7a1a1e',
  },
  elf: {
    skin: '#f1d6b8', hair: '#e8d48a', hairStyle: 'long', ears: true,
    helm: 'circlet', helmColor: '#c9d8a0',
    cape: '#2f5a32', torso: '#5c7a3a', tabard: null, trim: '#b8a060',
    legs: '#4a3a28', boots: '#5a4028', arms: '#6a8a46',
    weapon: 'bow',
  },
  mage: {
    skin: '#e6c3a0', hair: '#2a2a40', hairStyle: 'none',
    helm: 'hood', helmColor: '#2b2f6a',
    cape: null, torso: '#2b2f6a', robe: '#262a5e', trim: '#c9a84a',
    legs: '#1e2148', boots: '#1a1a24', arms: '#2b2f6a',
    weapon: 'staff',
  },
  priest: {
    skin: '#ecc8a4', hair: '#7a5232', hairStyle: 'short',
    helm: 'circlet', helmColor: '#e8c860',
    cape: '#c9b88a', torso: '#ece6d6', robe: '#e2dccb', trim: '#d4a83a',
    legs: '#cfc6b0', boots: '#6a5236', arms: '#ece6d6',
    weapon: 'mace',
  },
};

// 갑옷 아이템별 몸통 색 (직업 기본 외형 위에 덮어씀)
const ARMOR_TINT = {
  leather_armor: { torso: '#7a5434', arms: '#6a4a2e' },
  chain_mail: { torso: '#a8b0bc', arms: '#98a0ac', mail: true },
};

/**
 * 사람형 캐릭터 그리기
 * s: { look, facing, walk(위상), moving, attack(0~1, 공격 동작 진행), cast(0~1), weaponColor, armorId,
 *      dead, scale, time }
 */
export function drawHumanoid(ctx, x, y, s) {
  if (s.classId && drawHeroSheet(ctx, x, y, s, drawOriginalHumanoid)) return;
  drawOriginalHumanoid(ctx, x, y, s);
}

function drawOriginalHumanoid(ctx, x, y, s) {
  const look = { ...s.look, ...(ARMOR_TINT[s.armorId] || {}) };
  if (look.robe && ARMOR_TINT[s.armorId]) look.robe = shade(look.torso, -0.1);
  const { view, turn, flip } = viewOf(s.facing);
  const back = view === 'back';
  const sc = s.scale || 1;

  ctx.save();
  ctx.translate(x, y);
  if (s.hurt > 0) ctx.filter = `sepia(1) saturate(6) hue-rotate(-45deg) brightness(${1 + s.hurt})`;
  if (s.dead) { ctx.translate(-4, -4); ctx.rotate(-Math.PI / 2 * flip); ctx.globalAlpha *= 0.65; }
  ctx.scale(flip * sc, sc);

  const weight = s.motion ?? (s.moving ? 1 : 0);
  const sw = Math.sin(s.walk || 0) * weight;
  const bob = s.lockBody ? 0 : (1 - Math.cos((s.walk || 0) * 2)) * 0.28 * weight;
  const bodyW = lerp(17, 11, turn);
  const half = bodyW / 2;
  const by = -bob; // 몸 전체 위아래 흔들림

  const hand = {
    // 무기 손(오른손) / 방패 손(왼손) 위치. 옆모습일수록 몸 앞뒤로 겹침
    wx: lerp(half + 2.5, 4, turn), wy: -19 + by - sw * 0.8 * (1 - turn),
    sx: lerp(-half - 2.5, -3, turn), sy: -19 + by + sw * 0.8 * (1 - turn),
  };
  // 옆모습에서 팔 앞뒤 흔들기
  hand.wx += sw * 1.4 * turn; hand.sx -= sw * 1.4 * turn;

  const attack = s.attack || 0;

  // 뒷모습: 손에 든 것들이 몸 너머(앞쪽)라서 먼저 그림
  if (back) {
    drawWeapon(ctx, look, s, hand, attack, turn, true);
    if (look.shield) drawShield(ctx, look.shield, hand.sx, hand.sy, true, turn);
  } else if (look.cape) {
    drawCape(ctx, look.cape, half, by, turn, sw, false);
  }
  // 옆모습: 방패 팔은 몸 뒤
  if (!back && turn === 1 && look.shield) drawShield(ctx, look.shield, hand.sx, hand.sy, false, turn);

  drawLegs(ctx, look, sw, turn, by, s.walk || 0, weight);
  drawTorso(ctx, look, half, by, back, turn);

  // 팔
  drawArm(ctx, look, -half + 0.5, by, hand.sx, hand.sy);
  drawArm(ctx, look, half - 0.5, by, hand.wx, hand.wy);

  drawHead(ctx, look, by, back, turn, s.time || 0);

  if (back) {
    if (look.cape) drawCape(ctx, look.cape, half, by, turn, sw, true);
  } else {
    if (turn !== 1 && look.shield) drawShield(ctx, look.shield, hand.sx, hand.sy, false, turn);
    drawWeapon(ctx, look, s, hand, attack, turn, false);
  }

  // 시전 중: 손 주변 빛
  if (s.cast > 0) {
    const g = s.cast;
    ctx.globalAlpha *= Math.min(1, g * 2.5);
    ctx.fillStyle = look.weapon === 'mace' ? 'rgba(255,230,140,0.55)' : 'rgba(140,200,255,0.55)';
    ctx.beginPath(); ctx.arc(hand.wx, hand.wy - 4, 7 + (1 - g) * 8, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawCape(ctx, color, half, by, turn, sw, over) {
  const top = -28 + by;
  const flow = sw * 1.5;
  ctx.beginPath();
  if (turn === 1) {
    // 옆모습: 등 뒤로 휘날림
    ctx.moveTo(-1, top);
    ctx.quadraticCurveTo(-9 - flow, top + 12, -7 - flow * 2, -3);
    ctx.lineTo(-1, -6);
    ctx.closePath();
  } else {
    const w = half + (over ? 2 : 3);
    ctx.moveTo(-half + 1, top);
    ctx.lineTo(half - 1, top);
    ctx.lineTo(w + flow, -3);
    ctx.quadraticCurveTo(0, over ? -1 : 0, -w + flow, -3);
    ctx.closePath();
  }
  outlined(ctx, vgrad(ctx, color, top, -2, over ? 0.15 : -0.1, -0.45));
  if (over) {
    // 망토 주름
    ctx.strokeStyle = shade(color, -0.4); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, top + 4); ctx.lineTo(-3 + flow, -5);
    ctx.moveTo(3, top + 4); ctx.lineTo(4 + flow, -5);
    ctx.stroke();
  }
}

function drawLegs(ctx, look, sw, turn, by, phase, weight) {
  if (look.robe) {
    // 긴 로브: 다리 대신 치맛자락
    const w = lerp(10, 7, turn);
    ctx.beginPath();
    ctx.moveTo(-w + 2, -14 + by);
    ctx.lineTo(w - 2, -14 + by);
    ctx.lineTo(w + 1.5 + sw * turn, -1);
    ctx.quadraticCurveTo(0, 1 + Math.abs(sw), -w - 1.5 + sw * turn, -1);
    ctx.closePath();
    outlined(ctx, vgrad(ctx, look.robe, -14, 0, 0.1, -0.4));
    ctx.strokeStyle = look.trim; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-w - 0.5 + sw * turn, -2); ctx.quadraticCurveTo(0, 0, w - 0.5 + sw * turn, -2); ctx.stroke();
    // 발끝
    ctx.fillStyle = look.boots;
    ctx.fillRect(-4 + sw * 2 * turn, -2, 3, 2); ctx.fillRect(1 - sw * 2 * turn, -2, 3, 2);
    return;
  }
  // Keep hips connected; bend the knee only as the foot clears the ground.
  const sides = Math.sin(phase) > 0 ? [-1, 1] : [1, -1];
  for (const side of sides) {
    const foot = footPose(phase, side, turn, weight);
    const hipX = lerp(side * 3.6, side * 1, turn), hipY = -14 + by;
    const footX = foot.lateral + foot.stride, footY = -2 - foot.lift;
    const kneeX = lerp(hipX, footX, 0.52) + foot.lift * 0.32 * turn;
    const kneeY = lerp(hipY, footY, 0.52) - foot.lift * 0.18;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.quadraticCurveTo(kneeX, kneeY, footX, footY);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 6.4; ctx.stroke();
    ctx.strokeStyle = vgrad(ctx, look.legs, hipY, footY); ctx.lineWidth = 4.3; ctx.stroke();
    ctx.beginPath(); rr(ctx, footX - 3 + turn * 0.6, -4 - foot.lift, 6 + turn, 4, 1.3);
    outlined(ctx, look.boots, 1);
  }
}

function drawTorso(ctx, look, half, by, back, turn) {
  const top = -29 + by, bot = -12 + by;
  ctx.beginPath();
  ctx.moveTo(-half, top + 2);
  ctx.quadraticCurveTo(0, top - 1.5, half, top + 2);
  ctx.lineTo(half - 1.5, bot);
  ctx.lineTo(-half + 1.5, bot);
  ctx.closePath();
  outlined(ctx, look.mail ? hgrad(ctx, look.torso, -half, half) : vgrad(ctx, look.torso, top, bot));
  if (look.mail) {
    ctx.strokeStyle = 'rgba(40,44,52,0.35)'; ctx.lineWidth = 0.8;
    for (let yy = top + 4; yy < bot; yy += 3) { ctx.beginPath(); ctx.moveTo(-half + 2, yy); ctx.lineTo(half - 2, yy); ctx.stroke(); }
  }
  // 기사 휘장 (앞치마형 덧옷)
  if (look.tabard && !back) {
    const tw = lerp(4.5, 3, turn), off = turn * 1.5;
    ctx.beginPath();
    ctx.moveTo(-tw + off, top + 3); ctx.lineTo(tw + off, top + 3);
    ctx.lineTo(tw + off, bot + 4); ctx.lineTo(off, bot + 6); ctx.lineTo(-tw + off, bot + 4);
    ctx.closePath();
    outlined(ctx, vgrad(ctx, look.tabard, top, bot + 6), 1);
    ctx.strokeStyle = look.trim; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(off, top + 6); ctx.lineTo(off, bot); ctx.moveTo(off - 2.5, top + 9); ctx.lineTo(off + 2.5, top + 9); ctx.stroke();
  }
  // 어깨 보호대
  if (look.helm === 'great') {
    for (const sx of turn === 1 ? [1] : [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(sx * (half - 1), top + 3, 4.6, 3.4, 0, 0, TAU);
      outlined(ctx, hgrad(ctx, look.helmColor, sx * (half - 1) - 4, sx * (half - 1) + 4), 1);
    }
  }
  // 허리띠
  ctx.fillStyle = '#3a2618';
  ctx.fillRect(-half + 1.5, bot - 3, half * 2 - 3, 2.6);
  ctx.fillStyle = look.trim;
  if (!back) ctx.fillRect(-1.5 + turn * 2, bot - 3.2, 3, 3);
  // 로브 앞섶 장식선
  if (look.robe && !back) {
    ctx.strokeStyle = look.trim; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(turn * 2, top + 1); ctx.lineTo(turn * 2, bot - 3); ctx.stroke();
  }
}

function drawArm(ctx, look, sx, by, hx, hy) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5.6;
  ctx.beginPath(); ctx.moveTo(sx, -26 + by); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.strokeStyle = look.arms; ctx.lineWidth = 3.6;
  ctx.beginPath(); ctx.moveTo(sx, -26 + by); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.fillStyle = look.helm === 'great' ? '#6a7480' : look.skin;
  ctx.beginPath(); ctx.arc(hx, hy, 2.3, 0, TAU); ctx.fill();
}

function drawHead(ctx, look, by, back, turn, time) {
  const hx = turn * 1.5, hy = -35 + by, r = 6.8;
  // 긴 머리 (뒤로 늘어진 부분)
  if (look.hairStyle === 'long') {
    ctx.beginPath();
    ctx.moveTo(hx - r, hy - 1);
    ctx.quadraticCurveTo(hx - r - 2 - turn * 2, hy + 10, hx - 3 - turn * 3, hy + 13);
    ctx.lineTo(hx + (back ? r : r - turn * 8), hy + (back ? 12 : 4));
    ctx.lineTo(hx + r, hy - 1);
    ctx.closePath();
    outlined(ctx, vgrad(ctx, look.hair, hy - 4, hy + 13, 0.3, -0.3), 1);
  }
  // 얼굴
  ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU);
  outlined(ctx, back ? shade(look.hair, 0) : look.skin);

  if (look.ears) {
    for (const ex of turn === 1 ? [-1] : [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + ex * (r - 1), hy - 1);
      ctx.lineTo(hx + ex * (r + 5), hy - 5);
      ctx.lineTo(hx + ex * (r - 1), hy + 2);
      outlined(ctx, look.skin, 1);
    }
  }

  // 앞모습: 머리카락 + 눈
  if (!back) {
    if (look.hairStyle !== 'none') {
      ctx.beginPath();
      ctx.arc(hx, hy, r, Math.PI * 1.05, Math.PI * 1.95);
      ctx.quadraticCurveTo(hx + 2, hy - 2, hx - r * 0.95, hy - 1);
      ctx.fillStyle = vgrad(ctx, look.hair, hy - r, hy, 0.35, -0.2);
      ctx.fill();
    }
    ctx.fillStyle = '#1a1210';
    if (turn === 1) {
      ctx.fillRect(hx + 3, hy - 0.5, 1.8, 2.2);
    } else {
      const shift = turn * 2;
      ctx.fillRect(hx - 3.2 + shift, hy - 0.5, 1.8, 2.2);
      ctx.fillRect(hx + 1.4 + shift, hy - 0.5, 1.8, 2.2);
    }
  }

  // 투구 / 두건 / 머리띠
  if (look.helm === 'great') {
    ctx.beginPath(); rr(ctx, hx - r - 0.8, hy - r - 2, (r + 0.8) * 2, r * 2 + 3, 4);
    outlined(ctx, hgrad(ctx, look.helmColor, hx - r, hx + r));
    if (!back) {
      // 눈 틈 + 숨구멍
      ctx.fillStyle = '#121418';
      const sx = turn === 1 ? hx + 1 : hx - r + 1.5;
      const sw2 = turn === 1 ? r : (r - 1.5) * 2;
      ctx.fillRect(sx, hy - 1.5, sw2, 2.2);
      ctx.fillRect(hx - 0.6 + turn * 3, hy + 1.5, 1.2, 4);
    }
    // 깃털 장식
    ctx.strokeStyle = look.plume; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const wave = Math.sin(time * 4) * 1.2;
    ctx.beginPath(); ctx.moveTo(hx, hy - r - 2);
    ctx.quadraticCurveTo(hx - 3, hy - r - 9, hx - 9 + wave, hy - r - 4); ctx.stroke();
  } else if (look.helm === 'hood') {
    ctx.beginPath();
    ctx.moveTo(hx - r - 1.5, hy + 5);
    ctx.quadraticCurveTo(hx - r - 2, hy - r - 3, hx + 1 + turn * 2, hy - r - 5);
    ctx.quadraticCurveTo(hx + r + 2, hy - r + 1, hx + r + 1.5, hy + 5);
    if (!back) {
      // 앞모습: 얼굴이 보이는 구멍
      ctx.quadraticCurveTo(hx + turn * 3, hy + 1, hx - r - 1.5, hy + 5);
    }
    ctx.closePath();
    outlined(ctx, vgrad(ctx, look.helmColor, hy - r - 5, hy + 5, 0.25, -0.35));
    if (!back) {
      // 두건 그림자 속 얼굴
      ctx.fillStyle = 'rgba(10,8,20,0.45)';
      ctx.beginPath(); ctx.ellipse(hx + turn * 2, hy - 1.5, r * 0.75, 2.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = look.trim;
      ctx.fillRect(hx - r - 1, hy + 4, (r + 1) * 2, 1.4);
    }
  } else if (look.helm === 'circlet') {
    ctx.strokeStyle = look.helmColor; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(hx, hy + 1, r + 0.3, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    if (!back) { ctx.fillStyle = look.weapon === 'mace' ? '#7ad0ff' : '#7adf8a'; ctx.fillRect(hx - 1 + turn * 3, hy - r + 0.5, 2, 2); }
  }
}

// 공격 동작: attack 1→0 으로 줄어듦. 0.5 이상은 들어올리기, 이하는 내려치기
function swingAngle(attack, idle) {
  if (attack <= 0) return idle;
  const k = 1 - attack; // 0→1 진행
  if (k < 0.35) return lerp(idle, -2.3, k / 0.35);
  return lerp(-2.3, 0.7, Math.min(1, (k - 0.35) / 0.45));
}

function drawWeapon(ctx, look, s, hand, attack, turn, back) {
  const color = s.weaponColor || '#c8ccd2';
  const { wx: x, wy: y } = hand;
  ctx.lineCap = 'round';
  if (look.weapon === 'sword') {
    const a = swingAngle(attack, -1.25);
    const L = 19;
    const tx = x + Math.cos(a) * L, ty = y + Math.sin(a) * L;
    // 칼날
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4.4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4); ctx.lineTo(tx, ty); ctx.stroke();
    // 손잡이 가드
    const px = -Math.sin(a) * 4, py = Math.cos(a) * 4;
    ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 3 + px, y + Math.sin(a) * 3 + py); ctx.lineTo(x + Math.cos(a) * 3 - px, y + Math.sin(a) * 3 - py); ctx.stroke();
    if (attack > 0 && attack < 0.65) {
      // 휘두른 궤적
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(x, y, L - 2, -2.3, a); ctx.stroke();
    }
  } else if (look.weapon === 'mace') {
    const a = swingAngle(attack, -1.15);
    const L = 13;
    const tx = x + Math.cos(a) * L, ty = y + Math.sin(a) * L;
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = '#7a5a36'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, ty, 4.2, 0, TAU);
    outlined(ctx, hgrad(ctx, color, tx - 4, tx + 4), 1);
    ctx.fillStyle = shade(color, -0.3);
    for (let i = 0; i < 4; i++) {
      const aa = a + i * (TAU / 4);
      ctx.fillRect(tx + Math.cos(aa) * 4.5 - 1, ty + Math.sin(aa) * 4.5 - 1, 2, 2);
    }
  } else if (look.weapon === 'staff') {
    const lean = attack > 0 ? lerp(0, 0.5, Math.sin((1 - attack) * Math.PI)) : 0;
    const top = { x: x + 3 + lean * 10, y: y - 20 }, bot = { x: x - 1, y: y + 12 };
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3.8;
    ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    // 갈래 머리 + 보주
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(top.x, top.y - 3, 4, Math.PI * 0.15, Math.PI * 0.85, true); ctx.stroke();
    const pulse = 0.6 + 0.4 * Math.sin((s.time || 0) * 3) + (s.cast || 0);
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 8 + pulse * 6;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(top.x, top.y - 3, 3, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(top.x - 1.2, top.y - 4.5, 1.4, 1.4);
  } else if (look.weapon === 'bow') {
    const draw = attack > 0.35 ? (attack - 0.35) / 0.65 : 0; // 시위 당김
    const bx = x + (turn === 1 ? 3 : 1), by = y - 3;
    const R = 11;
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3.8;
    ctx.beginPath(); ctx.arc(bx - 4, by, R, -1.15, 1.15); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(bx - 4, by, R, -1.15, 1.15); ctx.stroke();
    const ex = bx - 4 + Math.cos(1.15) * R, ey1 = by - Math.sin(1.15) * R, ey2 = by + Math.sin(1.15) * R;
    const pull = ex - 2 - draw * 7;
    ctx.strokeStyle = 'rgba(240,235,220,0.9)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(ex, ey1); ctx.lineTo(pull, by); ctx.lineTo(ex, ey2); ctx.stroke();
    if (draw > 0) {
      ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(pull, by); ctx.lineTo(bx + 9, by); ctx.stroke();
      ctx.fillStyle = '#c8ccd2';
      ctx.beginPath(); ctx.moveTo(bx + 12, by); ctx.lineTo(bx + 8, by - 2); ctx.lineTo(bx + 8, by + 2); ctx.fill();
    }
    // 등 뒤 화살통 (뒷모습에서만 잘 보임)
    if (back) {
      ctx.beginPath(); rr(ctx, -6, -31, 5, 13, 1.5); outlined(ctx, '#6a4428', 1);
      ctx.fillStyle = '#e8e0c8'; ctx.fillRect(-5.5, -34, 1.2, 3); ctx.fillRect(-3.5, -35, 1.2, 4);
    }
  }
}

function drawShield(ctx, color, x, y, back, turn) {
  const w = lerp(7, 4, turn), h = 11;
  ctx.beginPath();
  ctx.moveTo(x - w, y - h / 2);
  ctx.lineTo(x + w, y - h / 2);
  ctx.lineTo(x + w, y + 1);
  ctx.quadraticCurveTo(x + w * 0.6, y + h * 0.6, x, y + h);
  ctx.quadraticCurveTo(x - w * 0.6, y + h * 0.6, x - w, y + 1);
  ctx.closePath();
  if (back) { outlined(ctx, '#5a4030'); return; } // 방패 뒷면 (나무)
  outlined(ctx, vgrad(ctx, color, y - h / 2, y + h, 0.2, -0.35));
  ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 1.2; ctx.stroke();
  if (turn < 1) {
    ctx.strokeStyle = '#e0c060'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x, y - h / 2 + 2); ctx.lineTo(x, y + h - 3);
    ctx.moveTo(x - w + 2, y - 1); ctx.lineTo(x + w - 2, y - 1); ctx.stroke();
  }
}

// ---------------------------------------------------------------- 몬스터
/**
 * m: 몬스터 상태, def: 정의, r: 크기(px), time
 * 반환값: 머리 꼭대기 높이(px, 양수) — 이름표·체력바 위치용
 */
export function drawMonsterSprite(ctx, x, y, m, def, r, time) {
  const dur = m.animDur || 0.3;
  const prog = m.attackAnim > 0 ? 1 - m.attackAnim / dur : 0; // 공격 동작 진행 0→1
  const atk = m.attackAnim > 0 ? Math.sin(prog * Math.PI) : 0; // 0→1→0
  const weight = m.walkWeight ?? (m.moving ? 1 : 0);
  const walk = Math.sin(m.walkPhase || 0) * weight;
  const sheet = def.art && sheetImage(def.art.sheet);
  // 시트 그림은 왼쪽을 보고 그려져 있음 → 오른쪽을 볼 때 뒤집기
  const facingX = (m.visualFacing || m.facing).x;
  if (Math.abs(facingX) > 0.18) m.spriteFacing = facingX > 0 ? 1 : -1;
  const direction = m.spriteFacing || (m.facing.x >= 0 ? 1 : -1);
  const flip = sheet ? -direction : direction;
  const lungeDir = sheet ? -flip : flip;
  ctx.save();
  ctx.translate(x + lungeDir * atk * r * (sheet ? 0.2 : 0.35), y);
  if (m.dead) {
    const k = Math.min(1, (time - m.deathTime) / 0.7);
    ctx.globalAlpha *= 1 - k;
    ctx.scale(1, 1 - k * 0.6);
  }
  ctx.scale(flip, 1);
  // 피격 순간: 하얗게 번쩍 (canvas filter 미지원 브라우저에서는 그냥 무시됨)
  if (m.hurtFlash > 0) ctx.filter = `brightness(${1 + m.hurtFlash / 0.12 * 1.6})`;
  let h;
  if (sheet) {
    h = drawSheetFrame(ctx, sheet, def, m, prog, walk, time);
  } else {
    const draw = SHAPES[def.shape || FAMILY_SHAPE[def.family]] || SHAPES.goblin;
    h = draw({ ctx, r, color: def.color, pal: def.palette || FALLBACK_PAL, walk, atk, time, m, def }) ?? r * 2.4;
  }
  ctx.restore();
  return h;
}

// ---------------------------------------------------------------- 스프라이트 시트 몬스터
// 시트: 384px 칸, 가로 8포즈(1~4 공격, 5~8 스킬, 대기 = 4번째) × 세로 6마리
const SHEET_CELL = 384;
const SHEET_BASE = new URL('../../assets/monsters/', import.meta.url);
const sheets = new Map();
// 플레이어 키(약 46px)를 몬스터 원본의 "영웅 키 100" 에 맞춤 → 몸 높이(px) = 46 × size
export const MONSTER_UNIT_PX = 46;

function sheetImage(name) {
  let s = sheets.get(name);
  if (!s) {
    const img = new Image();
    s = { img, ready: false, failed: false };
    img.onload = () => { s.ready = true; };
    img.onerror = () => { s.failed = true; };
    img.src = new URL(`${name}.webp`, SHEET_BASE).href;
    sheets.set(name, s);
  }
  return s.ready ? s.img : null; // 로딩 전에는 도형 그림으로 대신 그림
}

export function preloadSheets(names) { for (const n of names) sheetImage(n); }

function drawSheetFrame(ctx, img, def, m, prog, walk, time) {
  const a = def.art;
  let col = 3; // 대기
  if (m.attackAnim > 0) col = (m.animKind === 'skill' ? 4 : 0) + Math.min(3, Math.floor(prog * 4));
  const bodyPx = MONSTER_UNIT_PX * def.size;
  const s = bodyPx / a.bodyHeight;
  // 이동 중: 통통 튀는 걸음 / 대기 중: 숨쉬기
  const weight = m.walkWeight ?? (m.moving ? 1 : 0);
  const family = def.family || 'biped';
  const floating = ['winged', 'spirit', 'aquatic'].includes(family);
  const float = floating ? Math.sin(time * 2 + m.id) * Math.min(1.4, bodyPx * 0.025) : 0;
  const settle = floating ? 0 : (1 - Math.cos((m.walkPhase || 0) * 2)) * Math.min(0.35, bodyPx * 0.008) * weight;
  ctx.save();
  ctx.translate(0, -float - settle);
  ctx.imageSmoothingEnabled = false;
  const sx = col * SHEET_CELL, sy = a.row * SHEET_CELL;
  const dx = -a.centerX * s, dy = -a.footY * s;
  if (m.attackAnim > 0 || m.dead || weight < 0.01 || floating) {
    ctx.drawImage(img, sx, sy, SHEET_CELL, SHEET_CELL, dx, dy, SHEET_CELL * s, SHEET_CELL * s);
  } else {
    // A connected lower-body mesh: upper body stays still, lower contours flex smoothly.
    const soft = ['slime', 'serpent', 'plant'].includes(family);
    const cut = Math.max(0, Math.floor(a.footY - a.bodyHeight * (soft ? 0.38 : family === 'quadruped' ? 0.25 : 0.3)));
    ctx.drawImage(img, sx, sy, SHEET_CELL, cut, dx, dy, SHEET_CELL * s, cut * s);
    const stride = Math.min(soft ? 1.3 : 2, bodyPx * (soft ? 0.025 : 0.035)) * weight;
    for (let row = cut; row < SHEET_CELL; row += 3) {
      const h = Math.min(3, SHEET_CELL - row), t = Math.max(0, Math.min(1, (row - cut) / Math.max(1, a.footY - cut)));
      const offset = Math.sin((m.walkPhase || 0) + (soft ? t * 2 : 0)) * Math.sin(t * Math.PI * (soft ? 1 : 0.85)) * stride;
      ctx.drawImage(img, sx, sy + row, SHEET_CELL, h, dx + offset, dy + row * s, SHEET_CELL * s, h * s + 0.1);
    }
  }
  ctx.restore();
  return bodyPx + Math.max(0, float + settle);
}

// 시트를 불러오기 전 잠깐 보이는 도형 그림
const FAMILY_SHAPE = {
  slime: 'slime', quadruped: 'wolf', spider: 'spider', winged: 'wraith', biped: 'goblin', spirit: 'wraith',
  construct: 'orc', dragon: 'orc', plant: 'mushroom', shell: 'boar', aquatic: 'slime', serpent: 'rat',
};
const FALLBACK_PAL = {
  cap: '#a05050', spots: '#eee', stem: '#ddd', tusk: '#eee', mane: '#333', cloth: '#5a4a3a', weapon: '#aaa',
  eyes: '#f44', mark: '#a33', glow: '#9cf', armor: '#5a5048',
};

const eye = (ctx, x, y, c = '#ff3a2a', s = 2.2) => {
  ctx.fillStyle = c; ctx.fillRect(x - s / 2, y - s / 2, s, s);
};

const SHAPES = {
  slime({ ctx, r, color, time, m, atk }) {
    const sq = Math.sin(time * 4 + m.id) * 0.1 + atk * 0.25;
    const w = r * (1.05 + sq), hh = r * (0.8 - sq);
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.quadraticCurveTo(-w, -hh * 1.6, 0, -hh * 1.7);
    ctx.quadraticCurveTo(w, -hh * 1.6, w, 0);
    ctx.closePath();
    const g = ctx.createRadialGradient(-w * 0.3, -hh * 1.2, 1, 0, -hh * 0.6, w * 1.3);
    g.addColorStop(0, shade(color, 0.55)); g.addColorStop(0.5, color); g.addColorStop(1, shade(color, -0.45));
    ctx.globalAlpha *= 0.92;
    outlined(ctx, g);
    ctx.globalAlpha /= 0.92;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(-w * 0.35, -hh * 1.2, 2.5, 1.5, -0.5, 0, TAU); ctx.fill();
    eye(ctx, w * 0.15, -hh * 0.8, '#102010', 2.6); eye(ctx, w * 0.55, -hh * 0.8, '#102010', 2.6);
    return hh * 1.8;
  },

  rat({ ctx, r, color, walk }) {
    ctx.strokeStyle = '#c99090'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-r * 1.1, -r * 0.4); ctx.quadraticCurveTo(-r * 2, -r * 1.3 + walk * 2, -r * 2.3, -r * 0.2); ctx.stroke();
    for (const lx of [-0.6, 0.6]) { ctx.fillStyle = shade(color, -0.4); ctx.fillRect(lx * r + walk * lx * 2 - 1, -r * 0.3, 2.2, r * 0.3); }
    ctx.beginPath(); ctx.ellipse(0, -r * 0.65, r * 1.2, r * 0.62, 0, 0, TAU);
    outlined(ctx, vgrad(ctx, color, -r * 1.3, 0));
    ctx.beginPath(); ctx.ellipse(r * 1.05, -r * 0.75, r * 0.55, r * 0.42, 0.2, 0, TAU);
    outlined(ctx, color);
    ctx.beginPath(); ctx.arc(r * 0.75, -r * 1.2, r * 0.25, 0, TAU); outlined(ctx, '#d9a3a3', 1);
    eye(ctx, r * 1.2, -r * 0.85, '#111', 2);
    return r * 1.5;
  },

  mushroom({ ctx, r, pal, walk, atk }) {
    const hop = Math.abs(walk) * 3 + atk * 4;
    ctx.beginPath(); rr(ctx, -r * 0.45, -r * 1.1 - hop, r * 0.9, r * 1.1, 3);
    outlined(ctx, vgrad(ctx, pal.stem, -r * 1.1, 0));
    eye(ctx, -r * 0.15, -r * 0.6 - hop, '#2a1a10', 2); eye(ctx, r * 0.25, -r * 0.6 - hop, '#2a1a10', 2);
    ctx.beginPath();
    ctx.moveTo(-r * 1.25, -r * 0.95 - hop);
    ctx.quadraticCurveTo(-r * 1.1, -r * 2.3 - hop, 0, -r * 2.3 - hop);
    ctx.quadraticCurveTo(r * 1.1, -r * 2.3 - hop, r * 1.25, -r * 0.95 - hop);
    ctx.quadraticCurveTo(0, -r * 1.25 - hop, -r * 1.25, -r * 0.95 - hop);
    outlined(ctx, vgrad(ctx, pal.cap, -r * 2.3 - hop, -r - hop, 0.3, -0.3));
    ctx.fillStyle = pal.spots;
    for (const [sx, sy, sr] of [[-0.55, -1.6, 0.18], [0.1, -1.95, 0.15], [0.6, -1.5, 0.2], [-0.1, -1.4, 0.12]]) {
      ctx.beginPath(); ctx.arc(sx * r, sy * r - hop, sr * r, 0, TAU); ctx.fill();
    }
    return r * 2.4 + hop;
  },

  wolf({ ctx, r, color, walk, atk }) {
    const legs = (front) => {
      ctx.fillStyle = shade(color, front ? -0.2 : -0.45);
      for (const lx of [-0.8, 0.7]) {
        const sw = (front ? walk : -walk) * 3 * (lx > 0 ? 1 : -1);
        ctx.fillRect(lx * r + sw - 1.5, -r * 0.6, 3, r * 0.6);
      }
    };
    legs(false);
    // 꼬리
    ctx.beginPath(); ctx.moveTo(-r * 1.1, -r * 0.9);
    ctx.quadraticCurveTo(-r * 1.9, -r * 1.2 + walk * 2, -r * 1.8, -r * 0.4);
    ctx.quadraticCurveTo(-r * 1.4, -r * 0.7, -r * 1.1, -r * 0.6); outlined(ctx, shade(color, -0.15));
    ctx.beginPath(); ctx.ellipse(0, -r * 0.85, r * 1.25, r * 0.5, 0, 0, TAU);
    outlined(ctx, vgrad(ctx, color, -r * 1.4, -r * 0.3, 0.3, -0.4));
    legs(true);
    // 머리
    const hy = -r * 1.25 + atk * 3;
    ctx.beginPath();
    ctx.moveTo(r * 0.8, hy - r * 0.35);
    ctx.lineTo(r * 1.15, hy - r * 0.95); ctx.lineTo(r * 1.3, hy - r * 0.4); // 귀
    ctx.lineTo(r * 1.95, hy + r * 0.05); // 주둥이
    ctx.lineTo(r * 1.4, hy + r * 0.4);
    ctx.lineTo(r * 0.8, hy + r * 0.35);
    ctx.closePath();
    outlined(ctx, vgrad(ctx, color, hy - r, hy + r * 0.4));
    eye(ctx, r * 1.35, hy - r * 0.1, '#ffd84a', 2.2);
    if (atk > 0.3) { ctx.fillStyle = '#fff'; ctx.fillRect(r * 1.6, hy + r * 0.12, 1.5, 2.5); }
    return r * 2.2;
  },

  boar({ ctx, r, color, pal, walk, atk }) {
    ctx.fillStyle = shade(color, -0.45);
    for (const lx of [-0.8, -0.35, 0.4, 0.85]) ctx.fillRect(lx * r + walk * 2 * (lx > 0 ? 1 : -1) - 1.6, -r * 0.5, 3.2, r * 0.5);
    ctx.beginPath(); ctx.ellipse(0, -r * 0.9, r * 1.2, r * 0.68, 0, 0, TAU);
    outlined(ctx, vgrad(ctx, color, -r * 1.6, -r * 0.2, 0.2, -0.45));
    // 갈기
    ctx.fillStyle = pal.mane;
    ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 1.45);
    for (let i = 0; i <= 6; i++) ctx.lineTo(-r * 0.8 + i * r * 0.27, -r * (1.55 + (i % 2) * 0.18));
    ctx.lineTo(r * 0.8, -r * 1.3); ctx.closePath(); ctx.fill();
    const hx = r * 1.05 + atk * 4;
    ctx.beginPath(); ctx.ellipse(hx, -r * 0.8, r * 0.55, r * 0.45, 0.2, 0, TAU);
    outlined(ctx, color);
    ctx.beginPath(); ctx.ellipse(hx + r * 0.5, -r * 0.7, r * 0.18, r * 0.2, 0, 0, TAU); outlined(ctx, '#c08a7a', 1);
    ctx.strokeStyle = pal.tusk; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx + r * 0.3, -r * 0.55); ctx.quadraticCurveTo(hx + r * 0.6, -r * 0.5, hx + r * 0.55, -r * 0.95); ctx.stroke();
    eye(ctx, hx + r * 0.05, -r * 0.95, '#1a0a00', 2);
    return r * 1.9;
  },

  goblin(o) { return humanoidMonster(o, 'goblin'); },
  orc(o) { return humanoidMonster(o, 'orc'); },
  skeleton(o) { return humanoidMonster(o, 'skeleton'); },

  spider({ ctx, r, color, pal, walk, atk, time }) {
    ctx.strokeStyle = shade(color, -0.3); ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const ph = Math.sin(time * 14 * (walk ? 1 : 0) + i * 1.7 + side) * 2;
        const bx = (i - 1.5) * r * 0.35, kx = bx + (i - 1.5) * r * 0.5, ky = -r * 1.25 + ph;
        ctx.beginPath(); ctx.moveTo(bx, -r * 0.6); ctx.lineTo(kx, ky); ctx.lineTo(kx + (i - 1.5) * r * 0.3, -ph * 0.5);
        ctx.globalAlpha *= side < 0 ? 0.7 : 1; ctx.stroke(); ctx.globalAlpha /= side < 0 ? 0.7 : 1;
      }
    }
    ctx.beginPath(); ctx.ellipse(-r * 0.45, -r * 0.75, r * 0.8, r * 0.62, 0, 0, TAU);
    outlined(ctx, vgrad(ctx, color, -r * 1.4, -r * 0.1, 0.3, -0.4));
    ctx.fillStyle = pal.mark;
    ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 1.15); ctx.lineTo(-r * 0.25, -r * 0.8); ctx.lineTo(-r * 0.45, -r * 0.45); ctx.lineTo(-r * 0.65, -r * 0.8); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.45 + atk * 3, -r * 0.65, r * 0.4, 0, TAU);
    outlined(ctx, shade(color, 0.1));
    for (const [ex, ey] of [[0.6, -0.8], [0.75, -0.65], [0.55, -0.6]]) eye(ctx, (ex * r) + atk * 3, ey * r, pal.eyes, 1.8);
    return r * 1.6;
  },

  wraith({ ctx, r, color, pal, time, m, atk }) {
    const fl = Math.sin(time * 2.5 + m.id) * 3;
    const top = -r * 2.6 + fl;
    ctx.save();
    ctx.globalAlpha *= 0.85;
    ctx.shadowColor = pal.glow; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, top + r * 0.9);
    ctx.quadraticCurveTo(-r * 0.9, top, 0, top);
    ctx.quadraticCurveTo(r * 0.9, top, r * 0.9, top + r * 0.9);
    ctx.lineTo(r * 1.1, -r * 0.3 + fl);
    for (let i = 0; i <= 5; i++) {
      const tx = r * 1.1 - i * r * 0.44, ty = -r * (0.3 + (i % 2) * 0.35) + fl + Math.sin(time * 6 + i) * 2;
      ctx.lineTo(tx, ty);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, top, 0, fl);
    g.addColorStop(0, shade(color, 0.3)); g.addColorStop(1, 'rgba(60,70,110,0.1)');
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    // 후드 속 어둠 + 빛나는 눈
    ctx.fillStyle = 'rgba(8,10,24,0.9)';
    ctx.beginPath(); ctx.ellipse(r * 0.15, top + r * 0.7, r * 0.5, r * 0.4, 0, 0, TAU); ctx.fill();
    eye(ctx, r * 0.0, top + r * 0.7, pal.glow, 2.4); eye(ctx, r * 0.35, top + r * 0.7, pal.glow, 2.4);
    // 팔 (공격 시 앞으로)
    ctx.strokeStyle = shade(color, -0.1); ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(r * 0.5, top + r * 1.3); ctx.lineTo(r * (1.0 + atk * 0.6), top + r * (1.6 - atk * 0.5)); ctx.stroke();
    if (atk > 0) {
      ctx.fillStyle = pal.glow; ctx.globalAlpha *= atk;
      ctx.beginPath(); ctx.arc(r * (1.1 + atk * 0.6), top + r * (1.5 - atk * 0.5), 3 + atk * 3, 0, TAU); ctx.fill();
      ctx.globalAlpha /= atk;
    }
    return -top + 2;
  },
};

// 고블린 · 오크 · 해골: 사람형 몬스터 (옆모습 고정, 무기 휘두르기)
function humanoidMonster({ ctx, r, color, pal, walk, atk, time, m, def }, kind) {
  const H = r * 2.6; // 전체 키
  const bob = Math.abs(walk) * 1.2;
  const bodyC = kind === 'skeleton' ? '#d8d2c2' : color;
  const k = H / 46; // 기준 키 46px 비율

  // 다리
  for (const side of [-1, 1]) {
    const st = side * walk * 4 * k;
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5 * k + 1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(side * 1.5 * k, -14 * k - bob); ctx.lineTo(st + side * 1.5 * k, -2 * k); ctx.stroke();
    ctx.strokeStyle = kind === 'skeleton' ? bodyC : shade(pal.cloth || pal.armor || color, -0.25); ctx.lineWidth = 5 * k - (kind === 'skeleton' ? 2.5 : 0);
    ctx.beginPath(); ctx.moveTo(side * 1.5 * k, -14 * k - bob); ctx.lineTo(st + side * 1.5 * k, -2 * k); ctx.stroke();
  }
  // 몸통
  const tw = (kind === 'orc' ? 9 : 7) * k;
  const tt = -30 * k - bob, tb = -13 * k - bob;
  ctx.beginPath(); rr(ctx, -tw, tt, tw * 2, tb - tt, 3 * k);
  if (kind === 'skeleton') {
    outlined(ctx, 'rgba(30,24,20,0.85)');
    ctx.strokeStyle = bodyC; ctx.lineWidth = 1.6 * k;
    for (let i = 0; i < 4; i++) { const yy = tt + 4 * k + i * 3.2 * k; ctx.beginPath(); ctx.moveTo(-tw + 1.5, yy); ctx.quadraticCurveTo(0, yy + 1.5 * k, tw - 1.5, yy); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, tt + 2); ctx.lineTo(0, tb); ctx.stroke();
  } else {
    const armor = pal.armor || pal.cloth;
    outlined(ctx, vgrad(ctx, armor, tt, tb, 0.2, -0.4));
    // 드러난 팔·어깨 피부
    ctx.beginPath(); ctx.ellipse(-tw * 0.4, tt + 3 * k, tw * 0.7, 3.2 * k, 0, 0, TAU); outlined(ctx, vgrad(ctx, color, tt, tt + 6 * k), 1);
    ctx.fillStyle = '#3a2618'; ctx.fillRect(-tw, tb - 3.5 * k, tw * 2, 2.5 * k);
  }
  // 머리
  const hr = (kind === 'orc' ? 7.5 : kind === 'goblin' ? 7 : 6.5) * k;
  const hx = 1.5 * k, hy = tt - hr + 1.5 * k;
  if (kind === 'goblin') {
    // 큰 귀
    ctx.beginPath(); ctx.moveTo(hx - hr * 0.6, hy - 1); ctx.lineTo(hx - hr * 1.9, hy - hr * 0.9); ctx.lineTo(hx - hr * 0.5, hy + hr * 0.4); outlined(ctx, shade(color, -0.1), 1);
  }
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU);
  outlined(ctx, vgrad(ctx, bodyC, hy - hr, hy + hr, 0.3, -0.3));
  if (kind === 'skeleton') {
    ctx.fillStyle = '#1a0e0a';
    ctx.beginPath(); ctx.arc(hx + hr * 0.35, hy - hr * 0.1, hr * 0.28, 0, TAU); ctx.fill();
    ctx.fillRect(hx + hr * 0.1, hy + hr * 0.45, hr * 0.7, 1.4 * k);
    eye(ctx, hx + hr * 0.35, hy - hr * 0.1, '#ff5a3a', 1.6);
  } else {
    eye(ctx, hx + hr * 0.45, hy - hr * 0.15, kind === 'orc' ? '#ffcf3a' : '#ffef5a', 2.2);
    if (kind === 'orc') {
      // 엄니
      ctx.fillStyle = '#f2ead8';
      ctx.fillRect(hx + hr * 0.45, hy + hr * 0.35, 1.8 * k, 3 * k);
    } else {
      // 뾰족 코
      ctx.beginPath(); ctx.moveTo(hx + hr * 0.8, hy); ctx.lineTo(hx + hr * 1.5, hy + hr * 0.25); ctx.lineTo(hx + hr * 0.8, hy + hr * 0.4); outlined(ctx, color, 1);
    }
  }
  if (pal.crown) {
    // 보스 족장의 뿔 투구
    ctx.beginPath(); rr(ctx, hx - hr, hy - hr * 1.05, hr * 2, hr * 0.8, 2); outlined(ctx, hgrad(ctx, '#6a6060', hx - hr, hx + hr), 1);
    ctx.fillStyle = '#efe6d0';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(hx + s * hr * 0.8, hy - hr * 0.85); ctx.quadraticCurveTo(hx + s * hr * 1.7, hy - hr * 1.6, hx + s * hr * 1.3, hy - hr * 2.2); ctx.lineTo(hx + s * hr * 0.5, hy - hr * 1.0); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = pal.crown; ctx.fillRect(hx - 2, hy - hr * 0.95, 4, 3);
  } else if (kind === 'skeleton') {
    // 녹슨 투구
    ctx.beginPath(); ctx.arc(hx, hy - 1, hr + 0.8, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); outlined(ctx, '#6a6458', 1);
  }

  // 무기 팔
  const sx = 3 * k, sy = tt + 4 * k;
  const a = atk > 0 ? lerp(-2.0, 0.7, 1 - atk) : -0.9 + Math.sin(time * 2 + m.id) * 0.05;
  const hxw = sx + Math.cos(0.4) * 9 * k, hyw = sy + 8 * k;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4.5 * k + 1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hxw, hyw); ctx.stroke();
  ctx.strokeStyle = bodyC; ctx.lineWidth = 4.5 * k - (kind === 'skeleton' ? 2 : 0);
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hxw, hyw); ctx.stroke();

  if (pal.weapon === 'bow') {
    ctx.strokeStyle = '#8a6438'; ctx.lineWidth = 2.2 * k;
    ctx.beginPath(); ctx.arc(hxw - 3 * k, hyw, 9 * k, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.8;
    const pull = atk * 6 * k;
    ctx.beginPath(); ctx.moveTo(hxw + 0.5 * k, hyw - 8.3 * k); ctx.lineTo(hxw - 3 * k - pull, hyw); ctx.lineTo(hxw + 0.5 * k, hyw + 8.3 * k); ctx.stroke();
  } else {
    // 칼 / 도끼
    const L = (kind === 'orc' ? 18 : 14) * k;
    const tx = hxw + Math.cos(a) * L, ty = hyw + Math.sin(a) * L;
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4 * k;
    ctx.beginPath(); ctx.moveTo(hxw, hyw); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = kind === 'skeleton' ? '#8a7a64' : (pal.weapon || '#aaa'); ctx.lineWidth = 2.4 * k;
    ctx.beginPath(); ctx.moveTo(hxw, hyw); ctx.lineTo(tx, ty); ctx.stroke();
    if (kind === 'orc') {
      // 도끼날
      const px = -Math.sin(a), py = Math.cos(a);
      ctx.beginPath();
      ctx.moveTo(tx - Math.cos(a) * 5 * k, ty - Math.sin(a) * 5 * k);
      ctx.quadraticCurveTo(tx + px * 9 * k, ty + py * 9 * k, tx + Math.cos(a) * 1 * k, ty + Math.sin(a) * 1 * k);
      ctx.closePath();
      outlined(ctx, hgrad(ctx, pal.weapon, tx - 6, tx + 6), 1);
    }
    if (atk > 0.2 && atk < 0.95) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 4 * k;
      ctx.beginPath(); ctx.arc(hxw, hyw, L, -2.0, a); ctx.stroke();
    }
  }
  return H + (pal.crown ? hr * 1.2 : 0);
}
