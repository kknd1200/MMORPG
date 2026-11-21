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

// ---------------------------------------------------------------- 사람형 캐릭터 (플레이어 · NPC) → hero.js
export { LOOKS, drawHumanoid } from './hero.js';

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
  const paint = () => {
    if (sheet) return drawSheetFrame(ctx, sheet, def, m, prog, walk, time);
    const draw = SHAPES[def.shape || FAMILY_SHAPE[def.family]] || SHAPES.goblin;
    return draw({ ctx, r, color: def.color, pal: def.palette || FALLBACK_PAL, walk, atk, time, m, def }) ?? r * 2.4;
  };
  const h = paint();
  // 피격 순간: 같은 그림을 '더하기'로 한 번 더 그려 하얗게 번쩍
  // (canvas filter 는 그래픽 가속이 끊겨 공격할 때마다 렉이 걸려서 쓰지 않음)
  if (m.hurtFlash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= Math.min(1, m.hurtFlash / 0.12) * 0.85;
    paint();
  }
  ctx.restore();
  return h;
}

// ---------------------------------------------------------------- 스프라이트 시트 몬스터
// 시트: 384px 칸, 가로 8포즈(1~4 공격, 5~8 스킬, 대기 = 4번째) × 세로 6마리
const SHEET_CELL = 384;
const SHEET_W = SHEET_CELL * 8, SHEET_H = SHEET_CELL * 6; // 8포즈 × 6마리
const SHEET_BASE = new URL('../../assets/monsters/', import.meta.url);
const sheets = new Map();
// 플레이어 키(약 62px, 투구 포함)를 몬스터 원본의 "영웅 키 100" 에 맞춤 → 몸 높이(px) = 58 × size
export const MONSTER_UNIT_PX = 58;

// 시트 캐시: name → { src, cell, ready, failed, cellPx }
// 원본 시트(3072×2304, 디코딩 시 약 28MB)를 실제로 그려지는 크기로 한 번만 줄여서 보관 → 메모리·그리기 비용 절감
function sheetEntry(name, cellPx = SHEET_CELL) {
  let s = sheets.get(name);
  if (s) return s;
  s = { src: null, cell: SHEET_CELL, ready: false, failed: false, cellPx: Math.min(SHEET_CELL, Math.max(48, Math.ceil(cellPx))) };
  sheets.set(name, s);
  const url = new URL(`${name}.webp`, SHEET_BASE).href;
  const k = s.cellPx / SHEET_CELL;
  const done = (src, w) => {
    if (sheets.get(name) !== s) { src.close?.(); return; } // 불러오는 사이 해제됨
    s.src = src;
    s.cell = SHEET_CELL * (w / SHEET_W);
    s.ready = true;
  };
  const viaImage = () => {
    const img = new Image();
    img.onload = () => {
      if (k >= 0.95) { done(img, img.width); return; }
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const cx = c.getContext('2d');
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(img, 0, 0, c.width, c.height);
      img.src = '';
      done(c, c.width);
    };
    img.onerror = () => { s.failed = true; };
    img.src = url;
  };
  // 가능하면 디코딩·축소를 메인 스레드 밖에서 (사냥터에 들어설 때 끊김 방지)
  if (typeof createImageBitmap === 'function' && typeof fetch === 'function' && k < 0.95) {
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then((b) => createImageBitmap(b, {
        resizeWidth: Math.round(SHEET_W * k), resizeHeight: Math.round(SHEET_H * k), resizeQuality: 'high',
      }))
      .then((bmp) => done(bmp, bmp.width))
      .catch(() => { if (sheets.get(name) === s && !s.ready) viaImage(); });
  } else {
    viaImage();
  }
  return s;
}

function sheetImage(name) {
  const s = sheetEntry(name);
  return s.ready ? s : null; // 로딩 전에는 도형 그림으로 대신 그림
}

/** 시트를 미리 불러옴. cellPx = 화면에 그려질 한 칸의 최대 크기(px) */
export function loadSheet(name, cellPx) { sheetEntry(name, cellPx); }

/** 시트 메모리 해제 (다시 필요하면 자동으로 다시 불러옴) */
export function releaseSheet(name) {
  const s = sheets.get(name);
  if (!s) return;
  sheets.delete(name);
  s.src?.close?.();
  if (s.src && 'src' in s.src) s.src.src = '';
  s.src = null;
}

export function sheetStats() {
  let loaded = 0, bytes = 0;
  for (const s of sheets.values()) {
    if (!s.ready) continue;
    loaded++;
    bytes += (s.src.width || 0) * (s.src.height || 0) * 4;
  }
  return { loaded, total: sheets.size, mb: bytes / 1048576 };
}

/** def 몬스터가 화면에 그려질 때 시트 한 칸의 크기(px) */
export function sheetCellPx(def) {
  return SHEET_CELL * (MONSTER_UNIT_PX * def.size) / def.art.bodyHeight;
}

export function preloadSheets(names) { for (const n of names) sheetEntry(n); }

function drawSheetFrame(ctx, sheet, def, m, prog, walk, time) {
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
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // 시트는 화면 크기에 맞춰 줄여 두었으므로 원본 좌표 × k 로 잘라 옴
  const img = sheet.src, c = sheet.cell, k = c / SHEET_CELL;
  const sx = col * c, sy = a.row * c;
  const dx = -a.centerX * s, dy = -a.footY * s;
  const legged = LEGGED.has(family);
  if (m.attackAnim > 0 || m.dead || weight < 0.01 || floating) {
    ctx.drawImage(img, sx, sy, c, c, dx, dy, SHEET_CELL * s, SHEET_CELL * s);
  } else if (legged && typeof document !== 'undefined') {
    // 다리 있는 몬스터: 대기 그림에서 만든 8프레임 걸음 (앞다리 · 뒷다리가 번갈아 디딤)
    const wf = monsterWalk(sheet, a, family);
    const TAU = Math.PI * 2;
    const f = Math.floor(((((m.walkPhase || 0) % TAU) + TAU) % TAU) / TAU * 8) % 8;
    ctx.drawImage(wf, f * c, 0, c, c, dx, dy, SHEET_CELL * s, SHEET_CELL * s);
  } else {
    // 상체는 그대로, 하체만 띠 단위로 살짝 앞뒤로 휘어 걷는 느낌 (통째로 튀지 않음)
    const soft = ['slime', 'serpent', 'plant'].includes(family);
    const cut = Math.max(0, Math.floor(a.footY - a.bodyHeight * (soft ? 0.38 : family === 'quadruped' ? 0.25 : 0.3)));
    const cutK = Math.floor(cut * k);
    ctx.drawImage(img, sx, sy, c, cutK, dx, dy, SHEET_CELL * s, cutK / k * s);
    const stride = Math.min(soft ? 1.3 : 2, bodyPx * (soft ? 0.025 : 0.035)) * weight;
    const band = Math.max(1, Math.round(3 * k));
    for (let row = cutK; row < c; row += band) {
      const h = Math.min(band, c - row), t = Math.max(0, Math.min(1, (row / k - cut) / Math.max(1, a.footY - cut)));
      const offset = Math.sin((m.walkPhase || 0) + (soft ? t * 2 : 0)) * Math.sin(t * Math.PI * (soft ? 1 : 0.85)) * stride;
      ctx.drawImage(img, sx, sy + row, c, h, dx + offset, dy + row / k * s, SHEET_CELL * s, h / k * s + 0.3);
    }
  }
  ctx.restore();
  return bodyPx + Math.max(0, float + settle);
}

// ---------------------------------------------------------------- 몬스터 걸음
// 원본 몬스터 그림에는 걷기 프레임이 없어서, 대기 그림(4번째 칸)에서 8프레임 걸음을 만듭니다.
//   - 하체(엉덩이 아래)를 몸 가운데에서 앞 · 뒤 두 조각으로 나눔 (옆모습 그림이라 앞다리 · 뒷다리)
//   - 두 조각이 번갈아: 발 쪽으로 갈수록 앞뒤로 기울어 벌어졌다 모이고, 지나갈 때 정강이가 살짝 들림
//   - 디딘 직후 상체가 1px 정도 내려앉음
// 화면에 나온 몬스터만, 처음 걸을 때 한 번 만들어 두고 계속 씀 (시트를 해제하면 함께 사라짐)
const LEGGED = new Set(['biped', 'quadruped', 'spider', 'construct', 'dragon', 'shell']);
const W_LIFT = [0, 0, 0.6, 1, 0.6, 0, 0, 0];       // 들림 (최대값 대비)
const W_STRIDE = [1, 0.6, 0, -0.6, -1, -0.6, 0, 0.6]; // 앞(+) · 뒤(−)로 벌림
const W_BOB = [0, 1, 0, 0, 0, 1, 0, 0];
const walkCache = new WeakMap(); // sheet → Map(row → canvas)

export function monsterWalk(sheet, a, family) {
  let rows = walkCache.get(sheet);
  if (!rows) { rows = new Map(); walkCache.set(sheet, rows); }
  let cv = rows.get(a.row);
  if (cv) return cv;
  const c = sheet.cell, k = c / SHEET_CELL;
  cv = document.createElement('canvas');
  cv.width = c * 8; cv.height = c;
  const g = cv.getContext('2d');
  const foot = Math.round(a.footY * k), bh = a.bodyHeight * k;
  const hip = Math.round(foot - bh * (family === 'quadruped' || family === 'shell' ? 0.3 : 0.34));
  const knee = Math.round(foot - bh * 0.16);
  const mid = Math.round(a.centerX * k);
  const lift = Math.max(1, Math.round(bh * 0.05));
  const stride = Math.max(1, Math.round(bh * 0.06));
  const sx = 3 * c, sy = a.row * c; // 대기 그림
  for (let i = 0; i < 8; i++) {
    const ox = i * c;
    g.drawImage(sheet.src, sx, sy, c, hip, ox, W_BOB[i] * Math.max(1, Math.round(k * 2)), c, hip);
    // 뒤쪽 조각(왼쪽 = 등 쪽) 먼저, 앞쪽 조각을 나중에
    // 뒤쪽 조각은 벌어지는 폭만큼 가운데를 넘겨 그려서 두 조각 사이에 틈이 생기지 않게
    const ov = stride * 2 + 1;
    for (const [x0, w, ph] of [[0, Math.min(c, mid + ov), 4], [mid, c - mid, 0]]) {
      const f = (i + ph) % 8;
      const st = W_STRIDE[f] * stride, up = Math.round(W_LIFT[f] * lift);
      for (let y = hip; y < c; y++) {
        const t = (y - hip + 1) / Math.max(1, foot - hip);
        const shift = Math.round(st * Math.min(1, t));
        const dy = y >= knee ? -up : 0;
        g.drawImage(sheet.src, sx + x0, sy + y, w, 1, ox + x0 + shift, y + dy, w, 1);
      }
    }
  }
  if (rows.size > 8) rows.delete(rows.keys().next().value);
  rows.set(a.row, cv);
  return cv;
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
