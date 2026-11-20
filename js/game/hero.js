import { HERO_BODY } from '../data/hero-anim.js';
// 사람형 캐릭터 (플레이어 · NPC) — 실제 비율(약 7등신) 다크 판타지 풍
//
// 좌표계: (0,0) = 발밑, 위쪽이 -y. 키 약 62px.
// 그리기 전에 바라보는 방향에 따라 좌우 반전하므로 옆모습에서는 항상 +x 가 "앞" 입니다.
// 뼈대(엉덩이→무릎→발목, 어깨→팔꿈치→손)를 계산하고 부위마다 명암을 넣어 그립니다.
//
// 8방향: view = 'front' | 'back', turn = 0(정면/뒷모습) · 0.5(대각선) · 1(옆)

import { img, HERO } from './art.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- 색
const shadeCache = new Map();
function shade(hex, amt) {
  const key = hex + amt;
  let v = shadeCache.get(key);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  v = `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  shadeCache.set(key, v);
  return v;
}

const LINE = 'rgba(14,10,8,0.85)';

// 두 점을 잇는 축에 수직인 방향으로 명암 (원통 느낌: 한쪽 밝고 반대쪽 어둡게)
function crossGrad(ctx, a, b, w, color, metal) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const g = ctx.createLinearGradient(mx + nx * w, my + ny * w, mx - nx * w, my - ny * w);
  if (metal) {
    g.addColorStop(0, shade(color, -0.45)); g.addColorStop(0.35, shade(color, 0.45));
    g.addColorStop(0.55, color); g.addColorStop(1, shade(color, -0.5));
  } else {
    g.addColorStop(0, shade(color, -0.35)); g.addColorStop(0.4, shade(color, 0.12)); g.addColorStop(1, shade(color, -0.45));
  }
  return g;
}

// 굵기가 a→b 로 변하는 둥근 막대 (팔다리)
function limb(ctx, a, b, wa, wb, color, metal = false) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const ang = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(a.x + nx * wa / 2, a.y + ny * wa / 2);
  ctx.lineTo(b.x + nx * wb / 2, b.y + ny * wb / 2);
  ctx.arc(b.x, b.y, wb / 2, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.lineTo(a.x - nx * wa / 2, a.y - ny * wa / 2);
  ctx.arc(a.x, a.y, wa / 2, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.closePath();
  ctx.fillStyle = crossGrad(ctx, a, b, Math.max(wa, wb) / 2, color, metal);
  ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = 0.9; ctx.stroke();
}

function poly(ctx, pts, fill, stroke = LINE, lw = 0.9) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function vgrad(ctx, color, y0, y1, hi = 0.2, lo = -0.4) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(color, hi)); g.addColorStop(0.45, color); g.addColorStop(1, shade(color, lo));
  return g;
}

function hgrad(ctx, color, x0, x1, metal = false) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  if (metal) {
    g.addColorStop(0, shade(color, -0.5)); g.addColorStop(0.3, shade(color, 0.5));
    g.addColorStop(0.5, shade(color, 0.1)); g.addColorStop(0.75, shade(color, -0.15)); g.addColorStop(1, shade(color, -0.55));
  } else {
    g.addColorStop(0, shade(color, -0.4)); g.addColorStop(0.35, shade(color, 0.1)); g.addColorStop(1, shade(color, -0.45));
  }
  return g;
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

// ---------------------------------------------------------------- 직업별 외형 (독자 디자인)
// armor: 'plate' | 'leather' | 'cloth'. robe 가 있으면 다리 대신 긴 옷자락
export const LOOKS = {
  knight: {
    skin: '#e2b994', hair: '#3e2a1c', hairStyle: 'short',
    helm: 'great', helmColor: '#9aa3ad', plume: '#b3201f',
    armor: 'plate', torso: '#8a929c', tabard: '#7e1b1e', trim: '#c9a44e',
    cape: '#5e1215', legs: '#7d858f', boots: '#4a3a2c', arms: '#8a929c', gloves: '#5a6068',
    weapon: 'sword', shield: '#6a1418',
  },
  elf: {
    skin: '#f0d4b6', hair: '#e2cc86', hairStyle: 'long', ears: true,
    helm: 'circlet', helmColor: '#c9d79c',
    armor: 'leather', torso: '#4c6632', trim: '#a88f52',
    cape: '#2a4428', legs: '#584530', boots: '#4a3220', arms: '#4c6632', gloves: '#6a4a2c',
    weapon: 'bow',
  },
  mage: {
    skin: '#e3be9a', hair: '#2a2a3a', hairStyle: 'none',
    helm: 'hood', helmColor: '#262c62',
    armor: 'cloth', torso: '#262c62', robe: '#222858', trim: '#c4a046',
    cape: '#1a1e44', legs: '#1c2046', boots: '#1a1a22', arms: '#262c62', gloves: '#e3be9a',
    weapon: 'staff',
  },
  priest: {
    skin: '#e9c6a2', hair: '#6e4a2c', hairStyle: 'short',
    helm: 'circlet', helmColor: '#e0c060',
    armor: 'cloth', torso: '#e4ded0', robe: '#dcd5c4', trim: '#c89a32', stole: '#8e2226',
    cape: '#bfae86', legs: '#cfc6b0', boots: '#5e4a32', arms: '#e4ded0', gloves: '#e9c6a2',
    weapon: 'mace',
  },
};

// 갑옷 아이템별 겉모습 (직업 기본 외형 위에 덮어씀)
const ARMOR_TINT = {
  leather_armor: { torso: '#6e4a2e', arms: '#634228', armor: 'leather' },
  chain_mail: { torso: '#a2aab4', arms: '#949ca6', mail: true },
};

// ---------------------------------------------------------------- 그리기 진입점
// 피격 시 붉은 번쩍임: 작은 보조 캔버스에 그려서 색을 입힌 뒤 붙임 (canvas filter 는 느려서 쓰지 않음)
let tintCanvas = null;

/**
 * s: { look, facing, walk(위상), moving, attack(1→0 공격 진행), cast(1→0), weaponColor, armorId, hurt, dead, scale, time }
 */
export function drawHumanoid(ctx, x, y, s) {
  if (!(s.hurt > 0) || typeof document === 'undefined') { drawAny(ctx, x, y, s); return; }
  const sc = ctx.getTransform().a || 1;
  const W = 140, H = 130, AX = 70, AY = 108;
  if (!tintCanvas) tintCanvas = document.createElement('canvas');
  const cw = Math.ceil(W * sc), chh = Math.ceil(H * sc);
  if (tintCanvas.width !== cw || tintCanvas.height !== chh) { tintCanvas.width = cw; tintCanvas.height = chh; }
  const t = tintCanvas.getContext('2d');
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.clearRect(0, 0, cw, chh);
  t.setTransform(sc, 0, 0, sc, 0, 0);
  drawAny(t, AX, AY, { ...s, hurt: 0 });
  t.globalCompositeOperation = 'source-atop';
  t.fillStyle = `rgba(255,50,30,${0.55 * Math.min(1, s.hurt)})`;
  t.fillRect(0, 0, W, H);
  t.globalCompositeOperation = 'source-over';
  ctx.drawImage(tintCanvas, x - AX, y - AY, W, H);
}

// 「환생 루프」 도트 캐릭터가 있으면 그것으로, 그림을 불러오기 전이면 도형 캐릭터로
function drawAny(ctx, x, y, s) {
  if (s.sprite && drawSprite(ctx, x, y, s)) return;
  drawBody(ctx, x, y, s);
}

// ---------------------------------------------------------------- 도트 캐릭터 (assets/heroes)
// 프레임: attack-1~6 (평소 자세 = attack-1), skill-1~6. 그림은 오른쪽을 보고 있음
const HERO_PX = 70; // 화면에서의 키(px)

function heroFrame(key, s) {
  let kind = 'attack', i = 0;
  if (s.cast > 0) { kind = 'skill'; i = Math.min(5, Math.floor((1 - s.cast) * 6)); }
  else if (s.attack > 0) i = Math.min(5, Math.floor((1 - s.attack) * 6));
  return img(`heroes/${key}/${kind}-${i + 1}.webp`) || img(`heroes/${key}/attack-1.webp`);
}

// 걷기: 원본 그림에는 걷기 프레임이 없어서 서 있는 그림(다리를 앞뒤로 벌린 자세)으로 걷기 동작을 만듭니다.
//   옆에서 본 걸음 = [벌림(디딤) → 모음(한 발 듦, 몸이 살짝 올라감) → 벌림 → 모음(반대 발 듦)] 의 반복
//   - 허리 아래를 앞다리 / 뒷다리 두 조각으로 나눠 엉덩이 관절을 축으로 '회전' (모양이 찌그러지지 않음)
//   - 들어 올리는 발은 반 걸음마다 번갈아 바뀜
//   - 땅을 딛은 다리 각도에 맞춰 몸 높이를 정해서 발이 땅에 붙어 있음
const HIP = 0.43;          // 발에서 엉덩이까지 = 키의 43%
const STANCE = 0.43;       // 원본 그림에서 다리가 벌어진 각도(라디안)
const CLOSE = 0.36;        // 두 다리가 모일 때 각 다리가 안쪽으로 도는 각도

function drawSprite(ctx, x, y, s) {
  const im = heroFrame(s.sprite, s);
  if (!im) return false;
  const bodyH = HERO_BODY[s.sprite] || HERO.height; // 그림마다 원본 키가 달라서 따로 맞춤
  const sc = (HERO_PX / bodyH) * (s.scale || 1);
  const flip = s.facing && s.facing.x < -0.01 ? -1 : 1;
  const moving = !!s.moving && !s.dead && !(s.attack > 0) && !(s.cast > 0);
  const t = s.time || 0, walk = s.walk || 0;
  ctx.save();
  ctx.translate(x, y);
  if (s.dead) { ctx.rotate(-Math.PI / 2 * flip * 0.95); ctx.globalAlpha *= 0.75; ctx.translate(0, 8); }
  ctx.scale(flip * sc, sc);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const fx = HERO.footX, fy = HERO.footY;
  if (!moving) {
    // 숨쉬기: 발은 고정, 몸만 아주 살짝
    ctx.scale(1, 1 + Math.sin(t * 2.2) * 0.012);
    ctx.translate(-fx, -fy);
    ctx.drawImage(im, 0, 0);
    ctx.restore();
    return true;
  }
  ctx.translate(-fx, -fy); // 이후 좌표는 원본 그림(256px) 기준
  const legLen = HIP * bodyH;
  const hipY = fy - legLen;
  const sw = Math.sin(walk), cw = Math.cos(walk);
  const together = 1 - Math.abs(cw);               // 0 = 벌림(디딤), 1 = 모음(지나감)
  const turnIn = CLOSE * together;                 // 다리가 안쪽으로 도는 정도
  const lift = together * 7;                       // 지나가는 발을 드는 높이 (그림 px)
  const liftFront = sw > 0 ? lift : 0, liftBack = sw > 0 ? 0 : lift; // 반 걸음마다 번갈아
  // 다리가 곧아질수록 엉덩이가 올라감 (발은 땅에)
  const rise = legLen * (Math.cos(STANCE - turnIn) - Math.cos(STANCE));
  ctx.translate(0, -rise);
  const legs = [
    { x0: 0, x1: fx, rot: -turnIn, lift: liftBack },        // 뒷다리: 앞쪽으로 돌림 (먼저 그림)
    { x0: fx, x1: HERO.size, rot: turnIn, lift: liftFront }, // 앞다리: 뒤쪽으로 돌림
  ];
  for (const L of legs) {
    ctx.save();
    ctx.translate(fx, hipY - L.lift);
    ctx.rotate(L.rot); // 캔버스 회전은 시계방향 (+ = 발이 뒤로)
    ctx.translate(-fx, -hipY);
    ctx.beginPath(); ctx.rect(L.x0, hipY - 3, L.x1 - L.x0, HERO.size - hipY + 3); ctx.clip();
    ctx.drawImage(im, 0, 0);
    ctx.restore();
  }
  // 윗몸 (엉덩이 이음새를 덮도록 조금 겹쳐서) + 걸음에 맞춘 아주 작은 흔들림
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, HERO.size, hipY + 4); ctx.clip();
  ctx.translate(fx, hipY); ctx.rotate(0.015 * sw); ctx.translate(-fx, -hipY);
  ctx.drawImage(im, 0, 0);
  ctx.restore();
  ctx.restore();
  return true;
}

// 공격 진행에 따른 무기 각도 (화면 각도, 0 = 앞, -π/2 = 위)
function swing(attack, idle) {
  if (!(attack > 0)) return idle;
  const k = 1 - attack;
  if (k < 0.3) return lerp(idle, -2.35, k / 0.3);
  if (k < 0.75) return lerp(-2.35, 0.95, (k - 0.3) / 0.45);
  return lerp(0.95, idle, (k - 0.75) / 0.25);
}

function drawBody(ctx, x, y, s) {
  const look = { ...s.look, ...(ARMOR_TINT[s.armorId] || {}) };
  if (look.robe && ARMOR_TINT[s.armorId]) look.robe = shade(look.torso, -0.1);
  const { view, turn, flip } = viewOf(s.facing);
  const back = view === 'back';
  const side = turn === 1;
  const time = s.time || 0;
  const attack = s.attack || 0, cast = s.cast || 0;

  ctx.save();
  ctx.translate(x, y);
  if (s.dead) { ctx.translate(-6, -3); ctx.rotate(-Math.PI / 2 * flip * 0.92); ctx.globalAlpha *= 0.75; }
  ctx.scale(flip * (s.scale || 1), s.scale || 1);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  const moving = !!s.moving && !s.dead;
  const walk = s.walk || 0;
  const bob = moving ? Math.abs(Math.sin(walk)) * 1.5 : Math.sin(time * 2) * 0.35;
  const by = -bob;
  const lean = moving ? 1.2 * turn : 0; // 걸을 때 앞으로 살짝 숙임

  // ---- 뼈대
  const shW = lerp(8.6, 4.2, turn), hipW = lerp(4.6, 1.8, turn);
  const Y = { hip: -31 + by, waist: -36 + by, chest: -44 + by, sh: -48.5 + by, neck: -51.5 + by, head: -57 + by };
  const legs = [-1, 1].map((sd) => {
    const ph = walk + (sd > 0 ? 0 : Math.PI);
    const sw = moving ? Math.sin(ph) : 0;
    const lift = moving ? Math.max(0, Math.cos(ph)) : 0;
    const hip = { x: sd * hipW + lean * 0.4, y: Y.hip };
    const ta = sw * 0.5 * turn;
    const knee = { x: hip.x + Math.sin(ta) * 15 + sd * 0.4 * (1 - turn), y: hip.y + Math.cos(ta) * 15 - lift * 2.4 * (1 - turn) };
    const sa = ta - lift * 0.9 * turn;
    const ankle = { x: knee.x + Math.sin(sa) * 14, y: Math.min(-1.5, knee.y + Math.cos(sa) * 14 - lift * 1.6 * (1 - turn)) };
    return { sd, hip, knee, ankle, sw };
  });
  const armSwing = (sd) => (moving ? -Math.sin(walk + (sd > 0 ? 0 : Math.PI)) * 0.45 : Math.sin(time * 2 + sd) * 0.03);
  const shoulder = (sd) => ({ x: sd * shW + lean, y: Y.sh + 1.5 });

  // 팔 자세: 무기 팔(+1) 은 공격/시전 때 따로 계산
  const weaponAng = look.weapon === 'staff' ? swing(attack, 1.35) : look.weapon === 'bow' ? 0 : swing(attack, 1.15);
  const arms = [-1, 1].map((sd) => {
    const S = shoulder(sd);
    let ua, fa;
    if (cast > 0) {
      ua = -0.35 - cast * 0.5; fa = ua - 0.5;
    } else if (sd > 0 && attack > 0 && look.weapon !== 'bow') {
      ua = weaponAng - 0.25; fa = weaponAng;
    } else if (look.weapon === 'bow' && (attack > 0 || sd > 0) && sd > 0) {
      ua = attack > 0 ? 0 : 1.1; fa = attack > 0 ? 0 : 0.6;
    } else if (look.weapon === 'bow' && sd < 0 && attack > 0) {
      ua = 0.15; fa = -0.15;
    } else {
      // 늘어뜨린 팔: 화면 각도 (π/2 = 아래). 옆모습에서는 앞뒤로 흔들기
      const swingA = armSwing(sd) * turn;
      ua = Math.PI / 2 - swingA + sd * 0.12 * (1 - turn) * (sd > 0 ? 1 : -1) * -1;
      fa = ua - 0.25 * turn - (sd > 0 && look.weapon === 'staff' ? 0.5 : 0);
    }
    // 정면/뒷모습에서는 팔의 앞뒤 움직임이 좌우로 덜 보이게
    const sx = (a) => Math.cos(a) * lerp(0.55, 1, turn);
    const elbow = { x: S.x + sx(ua) * 11 + sd * 1.2 * (1 - turn), y: S.y + Math.sin(ua) * 11 };
    const hand = { x: elbow.x + sx(fa) * 10, y: elbow.y + Math.sin(fa) * 10 };
    return { sd, S, elbow, hand, ua, fa };
  });

  const near = (sd) => (side ? sd > 0 : true); // 옆모습: +1 쪽(오른팔·오른다리)이 보는 사람 쪽
  const W = { look, s, turn, back, side, attack, cast, time, Y, weaponAng, arms, legs };

  // ---- 그리는 순서
  if (back) {
    drawWeaponAndShield(ctx, W, true);
  } else {
    drawCape(ctx, W, false);
    if (side) { drawArm(ctx, W, arms[0]); drawShieldOn(ctx, W, arms[0]); }
  }
  for (const L of legs) if (!near(L.sd)) drawLeg(ctx, W, L);
  for (const L of legs) if (near(L.sd)) drawLeg(ctx, W, L);
  if (look.robe) drawRobeSkirt(ctx, W);
  drawTorso(ctx, W);
  if (back) {
    for (const A of arms) drawArm(ctx, W, A);
    drawHead(ctx, W);
    drawCape(ctx, W, true);
    if (look.weapon === 'bow') drawQuiver(ctx, W);
  } else {
    drawHead(ctx, W);
    if (!side) { drawArm(ctx, W, arms[0]); drawShieldOn(ctx, W, arms[0]); }
    drawArm(ctx, W, arms[1]);
    drawWeaponAndShield(ctx, W, false);
  }

  // 시전 중: 두 손 사이에 빛
  if (cast > 0) {
    const hx = (arms[0].hand.x + arms[1].hand.x) / 2, hy = (arms[0].hand.y + arms[1].hand.y) / 2 - 3;
    const col = look.weapon === 'mace' ? '255,226,140' : look.weapon === 'staff' ? '150,200,255' : '160,255,170';
    ctx.globalAlpha *= Math.min(1, cast * 2.2);
    ctx.fillStyle = `rgba(${col},0.22)`; ctx.beginPath(); ctx.arc(hx, hy, 12 + (1 - cast) * 8, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${col},0.55)`; ctx.beginPath(); ctx.arc(hx, hy, 5.5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- 부위
function drawLeg(ctx, W, L) {
  const { look } = W;
  const plate = look.armor === 'plate' && !look.robe;
  const legCol = look.legs;
  limb(ctx, L.hip, L.knee, 6.4, 5.2, legCol, plate);
  limb(ctx, L.knee, L.ankle, 5.2, 4.2, legCol, plate);
  if (plate) {
    // 무릎 보호대
    ctx.beginPath(); ctx.ellipse(L.knee.x + W.turn * 0.8, L.knee.y, 3.2, 2.6, 0, 0, TAU);
    ctx.fillStyle = hgrad(ctx, look.helmColor || look.legs, L.knee.x - 3, L.knee.x + 3, true); ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 0.8; ctx.stroke();
  }
  // 장화
  const toe = W.turn * 4.2;
  const ax = L.ankle.x, ay = L.ankle.y;
  ctx.beginPath();
  ctx.moveTo(ax - 2.6, ay - 6);
  ctx.lineTo(ax + 2.6, ay - 6);
  ctx.lineTo(ax + 2.8 + toe * 0.3, ay - 1.5);
  ctx.quadraticCurveTo(ax + 3 + toe, ay - 1.2, ax + 2.6 + toe, ay + 0.8);
  ctx.lineTo(ax - 2.8, ay + 0.8);
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, look.boots, ay - 6, ay + 1, 0.15, -0.4); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = 0.9; ctx.stroke();
}

function drawRobeSkirt(ctx, W) {
  const { look, turn, Y, legs, back } = W;
  const sway = (legs[1].ankle.x - legs[0].ankle.x) * 0.25 * turn;
  const top = Y.waist + 1, wTop = lerp(5.6, 3.8, turn), wBot = lerp(8.5, 6.5, turn);
  ctx.beginPath();
  ctx.moveTo(-wTop, top);
  ctx.lineTo(wTop, top);
  ctx.quadraticCurveTo(wTop + 2, -14, wBot + sway, -2.2);
  ctx.quadraticCurveTo(sway, 0.4, -wBot + sway, -2.2);
  ctx.quadraticCurveTo(-wTop - 2, -14, -wTop, top);
  ctx.closePath();
  ctx.fillStyle = hgrad(ctx, look.robe, -wBot, wBot); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = 0.9; ctx.stroke();
  // 주름
  ctx.strokeStyle = shade(look.robe, -0.35); ctx.lineWidth = 0.8;
  for (const f of [-0.45, 0.1, 0.55]) {
    ctx.beginPath(); ctx.moveTo(f * wTop, top + 4); ctx.quadraticCurveTo(f * wTop * 1.2, -12, f * wBot + sway, -3); ctx.stroke();
  }
  // 단 장식
  ctx.strokeStyle = look.trim; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-wBot + sway + 0.5, -3.2); ctx.quadraticCurveTo(sway, -0.8, wBot + sway - 0.5, -3.2); ctx.stroke();
  if (!back) {
    ctx.beginPath(); ctx.moveTo(turn * 1.5, top + 2); ctx.lineTo(turn * 1.5 + sway * 0.6, -2); ctx.stroke();
    if (look.stole) {
      // 사제 영대 (붉은 띠)
      for (const sd of turn === 1 ? [1] : [-1, 1]) {
        const x0 = sd * 2.2 + turn * 1.5;
        poly(ctx, [[x0 - 1.1, top], [x0 + 1.1, top], [x0 + 1.4 + sway * 0.3, -8], [x0 - 1.4 + sway * 0.3, -8]], look.stole, LINE, 0.6);
        ctx.fillStyle = look.trim; ctx.fillRect(x0 - 1.4 + sway * 0.3, -9.5, 2.8, 1.5);
      }
    }
  }
  // 발끝
  ctx.fillStyle = look.boots;
  for (const L of legs) { ctx.beginPath(); ctx.ellipse(L.ankle.x + turn * 2, -1, 2.6 + turn, 1.4, 0, 0, TAU); ctx.fill(); }
}

function drawTorso(ctx, W) {
  const { look, turn, Y, back } = W;
  const lean = W.legs[0].hip.x + W.legs[1].hip.x; // 숙임
  const shW = lerp(8.6, 4.2, turn), waW = lerp(5.4, 3.6, turn), hiW = lerp(6, 3.8, turn);
  const chestOut = turn * 1.8;
  const pts = [
    [-shW + lean * 0.5, Y.sh], [shW + lean * 0.5, Y.sh],
    [shW - 0.6 + chestOut + lean * 0.4, Y.chest], [waW + lean * 0.2, Y.waist],
    [hiW, Y.hip + 1.5], [-hiW, Y.hip + 1.5], [-waW + lean * 0.2, Y.waist], [-shW + 0.6 + lean * 0.4, Y.chest],
  ];
  const metal = look.armor === 'plate' || look.mail;
  poly(ctx, pts, metal ? hgrad(ctx, look.torso, -shW, shW, true) : hgrad(ctx, look.torso, -shW, shW), LINE, 1);
  if (look.mail) {
    ctx.strokeStyle = 'rgba(30,34,40,0.35)'; ctx.lineWidth = 0.6;
    for (let yy = Y.sh + 2; yy < Y.hip; yy += 2.2) { ctx.beginPath(); ctx.moveTo(-shW + 2, yy); ctx.lineTo(shW - 2, yy); ctx.stroke(); }
  }
  if (look.armor === 'plate' && !back) {
    // 가슴판 능선 · 복부 판
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(turn * 2, Y.sh + 1); ctx.lineTo(turn * 2.4, Y.chest + 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    for (const yy of [Y.waist - 1, Y.waist + 2]) { ctx.beginPath(); ctx.moveTo(-waW + 0.5, yy); ctx.quadraticCurveTo(turn * 2, yy + 1.2, waW - 0.5, yy); ctx.stroke(); }
  }
  if (look.armor === 'leather' && !back) {
    // 가죽 조끼 끈
    ctx.strokeStyle = shade(look.torso, -0.45); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(turn * 2 - 1.5, Y.sh + 2); ctx.lineTo(turn * 2, Y.waist); ctx.lineTo(turn * 2 + 1.5, Y.sh + 2); ctx.stroke();
  }
  // 기사 휘장 (가슴~허벅지)
  if (look.tabard) {
    const tw = lerp(4.4, 2.8, turn), off = turn * 1.8;
    const bottom = Y.hip + 9;
    poly(ctx, [[-tw + off, Y.chest - 2], [tw + off, Y.chest - 2], [tw + 0.8 + off, bottom - 1.5], [off, bottom + 1], [-tw - 0.8 + off, bottom - 1.5]], vgrad(ctx, look.tabard, Y.chest, bottom, 0.15, -0.4), LINE, 0.8);
    ctx.strokeStyle = look.trim; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-tw + off + 0.6, bottom - 2.2); ctx.lineTo(off, bottom); ctx.lineTo(tw + off - 0.6, bottom - 2.2); ctx.stroke();
    if (!back) {
      // 문장: 금빛 십자
      ctx.fillStyle = look.trim;
      ctx.fillRect(off - 0.7, Y.chest + 1, 1.4, 7); ctx.fillRect(off - 2.6, Y.chest + 3, 5.2, 1.4);
    }
  }
  // 허리띠
  ctx.fillStyle = '#2e2016';
  ctx.beginPath(); ctx.moveTo(-waW - 0.3, Y.waist + 1); ctx.lineTo(waW + 0.3, Y.waist + 1); ctx.lineTo(hiW * 0.95, Y.waist + 3.6); ctx.lineTo(-hiW * 0.95, Y.waist + 3.6); ctx.closePath(); ctx.fill();
  if (!back) { ctx.fillStyle = look.trim; ctx.fillRect(turn * 2 - 1.3, Y.waist + 1.1, 2.6, 2.4); }
  // 어깨 보호대
  if (look.armor === 'plate') {
    for (const sd of turn === 1 ? [1] : [-1, 1]) {
      const cx = sd * (shW - 0.6), cy = Y.sh + 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, 4.6, 3.6, sd * 0.25, Math.PI, 0); ctx.lineTo(cx + 4.4, cy + 2.4); ctx.quadraticCurveTo(cx, cy + 4.2, cx - 4.4, cy + 2.4); ctx.closePath();
      ctx.fillStyle = hgrad(ctx, look.helmColor || look.torso, cx - 5, cx + 5, true); ctx.fill();
      ctx.strokeStyle = LINE; ctx.lineWidth = 0.9; ctx.stroke();
      ctx.strokeStyle = look.trim; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(cx - 4, cy + 2); ctx.quadraticCurveTo(cx, cy + 3.6, cx + 4, cy + 2); ctx.stroke();
    }
  } else if (look.armor === 'leather') {
    for (const sd of turn === 1 ? [1] : [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(sd * (shW - 0.8), Y.sh + 1.2, 3.2, 2.4, 0, 0, TAU);
      ctx.fillStyle = shade(look.torso, -0.2); ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 0.7; ctx.stroke();
    }
  }
}

function drawArm(ctx, W, A) {
  const { look } = W;
  const metal = look.armor === 'plate';
  limb(ctx, A.S, A.elbow, 4.6, 4, look.arms, metal);
  limb(ctx, A.elbow, A.hand, 4, 3.4, look.arms, metal);
  if (metal) {
    ctx.beginPath(); ctx.arc(A.elbow.x, A.elbow.y, 2.2, 0, TAU);
    ctx.fillStyle = shade(look.helmColor || look.arms, 0.1); ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 0.6; ctx.stroke();
  } else if (look.robe) {
    // 넓은 소매
    const dx = A.hand.x - A.elbow.x, dy = A.hand.y - A.elbow.y, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const cx = A.elbow.x + dx * 0.75, cy = A.elbow.y + dy * 0.75;
    poly(ctx, [[A.elbow.x + nx * 2.2, A.elbow.y + ny * 2.2], [cx + nx * 3.8, cy + ny * 3.8], [cx - nx * 3.8, cy - ny * 3.8], [A.elbow.x - nx * 2.2, A.elbow.y - ny * 2.2]], shade(look.torso, -0.08), LINE, 0.8);
    ctx.strokeStyle = look.trim; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(cx + nx * 3.6, cy + ny * 3.6); ctx.lineTo(cx - nx * 3.6, cy - ny * 3.6); ctx.stroke();
  }
  // 손 (장갑)
  ctx.beginPath(); ctx.arc(A.hand.x, A.hand.y, 2, 0, TAU);
  ctx.fillStyle = look.gloves || look.skin; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 0.7; ctx.stroke();
}

function drawHead(ctx, W) {
  const { look, turn, back, Y, time } = W;
  const hx = turn * 1.4 + (W.legs[0].hip.x + W.legs[1].hip.x) * 0.6, hy = Y.head;
  // 목
  limb(ctx, { x: hx * 0.6, y: Y.sh + 1 }, { x: hx * 0.8, y: Y.neck }, 3.4, 3.2, look.armor === 'plate' ? look.torso : look.skin, look.armor === 'plate');
  const rx = 4.1, ry = 5;
  // 긴 머리 (등 뒤)
  if (look.hairStyle === 'long' && !back) {
    poly(ctx, [[hx - rx - 0.6, hy - 2], [hx + rx + 0.6 - turn * 3, hy - 2], [hx + rx - turn * 4, hy + 9], [hx - rx - 1.5 - turn * 2, hy + 10]], vgrad(ctx, look.hair, hy - 3, hy + 10, 0.25, -0.35), LINE, 0.7);
  }
  // 얼굴 · 뒤통수
  ctx.beginPath(); ctx.ellipse(hx, hy, rx, ry, 0, 0, TAU);
  ctx.fillStyle = back ? look.hair : hgrad(ctx, look.skin, hx - rx, hx + rx); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = 0.8; ctx.stroke();
  if (look.ears) {
    for (const ex of turn === 1 ? [-1] : [-1, 1]) {
      poly(ctx, [[hx + ex * (rx - 0.6), hy - 0.8], [hx + ex * (rx + 4.4), hy - 2.6], [hx + ex * (rx - 0.4), hy + 1.6]], look.skin, LINE, 0.6);
    }
  }
  if (!back) {
    // 머리카락 (앞머리)
    if (look.hairStyle !== 'none') {
      ctx.beginPath();
      ctx.ellipse(hx, hy - 0.8, rx + 0.4, ry + 0.3, 0, Math.PI * 1.02, Math.PI * 1.98);
      ctx.quadraticCurveTo(hx + 1.5 + turn, hy - 3.2, hx - rx - 0.3, hy - 0.8);
      ctx.fillStyle = vgrad(ctx, look.hair, hy - ry, hy, 0.3, -0.2); ctx.fill();
    }
    // 눈 · 코 그림자
    ctx.fillStyle = '#20140e';
    if (turn === 1) ctx.fillRect(hx + 2, hy - 0.6, 1.2, 1.2);
    else {
      const sh = turn * 1.6;
      ctx.fillRect(hx - 2.1 + sh, hy - 0.6, 1.2, 1.1);
      ctx.fillRect(hx + 0.9 + sh, hy - 0.6, 1.2, 1.1);
    }
    ctx.fillStyle = 'rgba(120,60,40,0.35)';
    ctx.fillRect(hx - 0.4 + turn * 2.2, hy + 1, 0.9, 1.6);
  } else if (look.hairStyle === 'long') {
    poly(ctx, [[hx - rx, hy - 1], [hx + rx, hy - 1], [hx + rx + 0.5, hy + 10], [hx - rx - 0.5, hy + 10]], vgrad(ctx, look.hair, hy - 3, hy + 10, 0.25, -0.35), LINE, 0.7);
  }

  // 투구 · 두건 · 머리띠
  if (look.helm === 'great') {
    const top = hy - ry - 2.2, bot = hy + ry - 0.2;
    ctx.beginPath();
    ctx.moveTo(hx - rx - 1, bot);
    ctx.lineTo(hx - rx - 1.2, hy - 1);
    ctx.quadraticCurveTo(hx - rx - 0.8, top, hx + turn * 0.8, top);
    ctx.quadraticCurveTo(hx + rx + 0.8, top, hx + rx + 1.2, hy - 1);
    ctx.lineTo(hx + rx + 1 + turn * 0.8, bot);
    ctx.closePath();
    ctx.fillStyle = hgrad(ctx, look.helmColor, hx - rx - 1, hx + rx + 1, true); ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 0.9; ctx.stroke();
    if (!back) {
      // 눈 틈 · 숨구멍 · 가운데 능선
      ctx.fillStyle = '#0e1014';
      if (turn === 1) ctx.fillRect(hx + 0.5, hy - 1.3, rx + 1, 1.5);
      else ctx.fillRect(hx - rx + 0.2 + turn * 1.2, hy - 1.3, rx * 2 - 0.4, 1.5);
      for (let i = 0; i < 3; i++) ctx.fillRect(hx + 1.6 + turn * 1.5 - i * 1.4, hy + 1.8, 0.6, 1.8);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(hx + turn * 1.5, top + 0.6); ctx.lineTo(hx + turn * 1.6, hy - 1.5); ctx.stroke();
    }
    // 깃털 장식
    const wave = Math.sin(time * 4) * 1;
    ctx.strokeStyle = look.plume; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(hx, top + 0.5); ctx.quadraticCurveTo(hx - 2.5, top - 6, hx - 8 + wave, top - 2.5 + wave * 0.3); ctx.stroke();
    ctx.strokeStyle = shade(look.plume, -0.4); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx, top + 0.5); ctx.quadraticCurveTo(hx - 2.5, top - 5, hx - 8 + wave, top - 2 + wave * 0.3); ctx.stroke();
  } else if (look.helm === 'hood') {
    const top = hy - ry - 2.6;
    ctx.beginPath();
    ctx.moveTo(hx - rx - 2.2, hy + ry + 1);
    ctx.quadraticCurveTo(hx - rx - 2.6, top + 1, hx + 0.8 + turn * 2.2, top - 0.6);
    ctx.quadraticCurveTo(hx + rx + 2.2, top + 2, hx + rx + 2, hy + ry + 1);
    if (!back) ctx.quadraticCurveTo(hx + turn * 2.6, hy + 2, hx - rx - 2.2, hy + ry + 1);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, look.helmColor, top, hy + ry + 1, 0.2, -0.4); ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 0.9; ctx.stroke();
    if (!back) {
      ctx.fillStyle = 'rgba(8,6,16,0.55)';
      ctx.beginPath(); ctx.ellipse(hx + turn * 1.8, hy - 1.6, rx * 0.85, 2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = look.trim; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(hx - rx - 1.6, hy + ry); ctx.quadraticCurveTo(hx + turn * 2.4, hy + 2.6, hx + rx + 1.4, hy + ry); ctx.stroke();
    }
  } else if (look.helm === 'circlet') {
    ctx.strokeStyle = look.helmColor; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(hx, hy - 1.2, rx + 0.3, 1.6, 0, back ? Math.PI : 0, back ? TAU : Math.PI, false); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx, hy - 1.2, rx + 0.3, 1.6, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    if (!back) { ctx.fillStyle = look.weapon === 'mace' ? '#8ad8ff' : '#8ae09a'; ctx.beginPath(); ctx.arc(hx + turn * 2, hy - 2.6, 0.9, 0, TAU); ctx.fill(); }
  }
}

function drawCape(ctx, W, over) {
  const { look, turn, Y, legs, s } = W;
  if (!look.cape) return;
  const sw = s.moving ? Math.sin(s.walk || 0) : 0;
  const shW = lerp(8.2, 3.8, turn);
  const top = Y.sh + 0.5, bot = -10;
  const flutter = s.moving ? 3 + Math.abs(sw) : 0.5;
  if (turn === 1) {
    // 옆모습: 등 뒤로 휘날림
    poly(ctx, [[-1, top], [1, top + 1], [-3 - flutter, bot + 2], [-7 - flutter * 1.6, bot]], vgrad(ctx, look.cape, top, bot, 0.05, -0.5), LINE, 0.9);
    return;
  }
  const w = shW + 2.5 + (over ? 0 : 1);
  ctx.beginPath();
  ctx.moveTo(-shW + 0.5, top);
  ctx.lineTo(shW - 0.5, top);
  ctx.quadraticCurveTo(w + 1, (top + bot) / 2, w + sw * 1.2, bot);
  ctx.quadraticCurveTo(sw * 0.8, bot + 2.2, -w + sw * 1.2, bot);
  ctx.quadraticCurveTo(-w - 1, (top + bot) / 2, -shW + 0.5, top);
  ctx.closePath();
  ctx.fillStyle = over ? hgrad(ctx, look.cape, -w, w) : vgrad(ctx, look.cape, top, bot, -0.1, -0.55);
  ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = 0.9; ctx.stroke();
  if (over) {
    ctx.strokeStyle = shade(look.cape, -0.45); ctx.lineWidth = 0.8;
    for (const f of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(f * shW, top + 4); ctx.quadraticCurveTo(f * w * 1.1, (top + bot) / 2, f * w + sw, bot - 1); ctx.stroke(); }
    if (look.trim) { ctx.strokeStyle = look.trim; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-shW + 0.5, top + 0.6); ctx.lineTo(shW - 0.5, top + 0.6); ctx.stroke(); }
  }
}

function drawQuiver(ctx, W) {
  const { Y } = W;
  poly(ctx, [[-4.5, Y.sh - 4], [-0.5, Y.sh - 5], [1.5, Y.waist], [-2.5, Y.waist + 1]], '#5a3a22', LINE, 0.8);
  ctx.fillStyle = '#e8e0c8';
  for (let i = 0; i < 3; i++) ctx.fillRect(-3.8 + i * 1.2, Y.sh - 7.5 + i * 0.4, 0.9, 3);
  ctx.fillStyle = '#b02a2a';
  for (let i = 0; i < 3; i++) ctx.fillRect(-3.8 + i * 1.2, Y.sh - 8.5 + i * 0.4, 0.9, 1.2);
}

function drawShieldOn(ctx, W, A) {
  const { look, turn, back } = W;
  if (!look.shield) return;
  const x = A.hand.x + (turn === 1 ? -1 : -1.5), y = A.hand.y - 4;
  const w = lerp(6.8, 2.6, turn), h = 15;
  ctx.beginPath();
  ctx.moveTo(x - w, y - h * 0.42);
  ctx.quadraticCurveTo(x, y - h * 0.55, x + w, y - h * 0.42);
  ctx.lineTo(x + w, y + 0.5);
  ctx.quadraticCurveTo(x + w * 0.8, y + h * 0.4, x, y + h * 0.58);
  ctx.quadraticCurveTo(x - w * 0.8, y + h * 0.4, x - w, y + 0.5);
  ctx.closePath();
  ctx.fillStyle = back ? shade('#6a5a48', -0.2) : hgrad(ctx, look.shield, x - w, x + w); ctx.fill();
  ctx.strokeStyle = '#b8a070'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.strokeStyle = LINE; ctx.lineWidth = 0.6; ctx.stroke();
  if (!back && turn < 1) {
    // 문장: 금빛 사자 대신 단순한 십자 + 테두리 징
    ctx.fillStyle = '#d4b060';
    ctx.fillRect(x - 0.7, y - h * 0.32, 1.4, h * 0.72);
    ctx.fillRect(x - w * 0.62, y - h * 0.12, w * 1.24, 1.4);
  }
}

function drawWeaponAndShield(ctx, W, behind) {
  const { look, s, arms, attack, turn } = W;
  const hand = arms[1].hand;
  const color = s.weaponColor || '#c8ccd2';
  if (behind && look.shield) drawShieldOn(ctx, W, arms[0]);
  if (look.weapon === 'sword') {
    const a = W.weaponAng - 0.15;
    const L = 26;
    const tx = hand.x + Math.cos(a) * L, ty = hand.y + Math.sin(a) * L;
    const nx = -Math.sin(a), ny = Math.cos(a);
    // 칼날 (가운데 홈 + 끝이 뾰족)
    ctx.beginPath();
    ctx.moveTo(hand.x + Math.cos(a) * 3 + nx * 1.4, hand.y + Math.sin(a) * 3 + ny * 1.4);
    ctx.lineTo(tx - Math.cos(a) * 3 + nx * 1.1, ty - Math.sin(a) * 3 + ny * 1.1);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx - Math.cos(a) * 3 - nx * 1.1, ty - Math.sin(a) * 3 - ny * 1.1);
    ctx.lineTo(hand.x + Math.cos(a) * 3 - nx * 1.4, hand.y + Math.sin(a) * 3 - ny * 1.4);
    ctx.closePath();
    const g = ctx.createLinearGradient(hand.x + nx * 1.5, hand.y + ny * 1.5, hand.x - nx * 1.5, hand.y - ny * 1.5);
    g.addColorStop(0, shade(color.length === 7 ? color : '#c8ccd2', 0.5)); g.addColorStop(1, shade(color.length === 7 ? color : '#c8ccd2', -0.35));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 0.7; ctx.stroke();
    // 가드 · 손잡이 · 폼멜
    ctx.strokeStyle = '#b8964a'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(hand.x + Math.cos(a) * 2.6 + nx * 3.6, hand.y + Math.sin(a) * 2.6 + ny * 3.6); ctx.lineTo(hand.x + Math.cos(a) * 2.6 - nx * 3.6, hand.y + Math.sin(a) * 2.6 - ny * 3.6); ctx.stroke();
    ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(hand.x - Math.cos(a) * 3, hand.y - Math.sin(a) * 3); ctx.lineTo(hand.x + Math.cos(a) * 2, hand.y + Math.sin(a) * 2); ctx.stroke();
    ctx.fillStyle = '#b8964a'; ctx.beginPath(); ctx.arc(hand.x - Math.cos(a) * 3.6, hand.y - Math.sin(a) * 3.6, 1.2, 0, TAU); ctx.fill();
    if (attack > 0.2 && attack < 0.7) {
      // 휘두른 궤적
      ctx.strokeStyle = 'rgba(255,250,235,0.32)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(arms[1].S.x, arms[1].S.y, 30, -2.4, a, false); ctx.stroke();
    }
  } else if (look.weapon === 'mace') {
    const a = W.weaponAng - 0.2;
    const L = 16;
    const tx = hand.x + Math.cos(a) * L, ty = hand.y + Math.sin(a) * L;
    ctx.strokeStyle = LINE; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(hand.x - Math.cos(a) * 3, hand.y - Math.sin(a) * 3); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1.5; ctx.stroke();
    // 날개 달린 머리
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(a);
    for (let i = 0; i < 3; i++) poly(ctx, [[-2.5, -1 + (i - 1) * 2.2], [3.5, -0.8 + (i - 1) * 2.2], [3.5, 0.8 + (i - 1) * 2.2], [-2.5, 1 + (i - 1) * 2.2]], i === 1 ? shade('#c8ccd2', 0.3) : '#9aa0a8', LINE, 0.6);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(4.4, 0, 1.4, 0, TAU); ctx.fill();
    ctx.restore();
    if (attack > 0.2 && attack < 0.7) {
      ctx.strokeStyle = 'rgba(255,240,200,0.3)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(arms[1].S.x, arms[1].S.y, 22, -2.4, a, false); ctx.stroke();
    }
  } else if (look.weapon === 'staff') {
    const tilt = attack > 0 ? Math.sin((1 - attack) * Math.PI) * 0.55 : 0;
    const a = -Math.PI / 2 + 0.12 + tilt; // 위로 세운 지팡이
    const topP = { x: hand.x + Math.cos(a) * 26, y: hand.y + Math.sin(a) * 26 };
    const botP = { x: hand.x - Math.cos(a) * 17, y: Math.min(-0.5, hand.y - Math.sin(a) * 17) };
    ctx.strokeStyle = LINE; ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(botP.x, botP.y); ctx.lineTo(topP.x, topP.y); ctx.stroke();
    ctx.strokeStyle = '#5e4026'; ctx.lineWidth = 1.7; ctx.stroke();
    ctx.strokeStyle = 'rgba(200,170,120,0.4)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(botP.x + 0.4, botP.y); ctx.lineTo(topP.x + 0.4, topP.y); ctx.stroke();
    // 갈래 머리 + 보주
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(topP.x, topP.y - 3.2, 3.8, Math.PI * 0.1, Math.PI * 0.9, true); ctx.stroke();
    const pulse = 0.6 + 0.4 * Math.sin(W.time * 3) + W.cast;
    ctx.fillStyle = color;
    ctx.globalAlpha *= 0.2;
    ctx.beginPath(); ctx.arc(topP.x, topP.y - 3.2, 6.5 + pulse * 2.5, 0, TAU); ctx.fill();
    ctx.globalAlpha /= 0.2;
    ctx.beginPath(); ctx.arc(topP.x, topP.y - 3.2, 2.6, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(topP.x - 1.1, topP.y - 4.4, 1.2, 1.2);
  } else if (look.weapon === 'bow') {
    const drawK = attack > 0 ? Math.min(1, Math.sin((1 - attack) * Math.PI) * 1.4) : 0;
    const aiming = attack > 0;
    // 활: 겨눌 때는 앞으로, 평소에는 손에 세로로
    const bx = aiming ? arms[0].hand.x + (turn === 1 ? 3 : 1) : hand.x + 1.5;
    const byy = aiming ? arms[0].hand.y : hand.y - 4;
    const R = 13;
    ctx.strokeStyle = LINE; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(bx - 5, byy, R, -1.1, 1.1); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = shade('#8a6a3a', 0.2); ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.arc(bx - 5.6, byy, R, -0.9, 0.9); ctx.stroke();
    const ex = bx - 5 + Math.cos(1.1) * R, ey1 = byy - Math.sin(1.1) * R, ey2 = byy + Math.sin(1.1) * R;
    const pull = ex - 1 - drawK * 9;
    ctx.strokeStyle = 'rgba(236,230,214,0.9)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(ex, ey1); ctx.lineTo(pull, byy); ctx.lineTo(ex, ey2); ctx.stroke();
    if (drawK > 0.1) {
      ctx.strokeStyle = '#d8ccb0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pull, byy); ctx.lineTo(bx + 11, byy); ctx.stroke();
      ctx.fillStyle = '#c8ccd2';
      ctx.beginPath(); ctx.moveTo(bx + 14, byy); ctx.lineTo(bx + 10, byy - 1.6); ctx.lineTo(bx + 10, byy + 1.6); ctx.fill();
    }
  }
}
