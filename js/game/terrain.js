// 아이소메트릭(마름모) 지형 그래픽 — 이미지 파일 없이 전부 절차 생성
//
//  - 바닥: 이음새 없는 텍스처(128px)를 화면 좌표에 고정된 패턴으로 칠함 → 같은 지형끼리는 타일 경계가 보이지 않음
//          지형이 바뀌는 곳은 마름모 가장자리를 들쭉날쭉하게 겹쳐서 자연스럽게 섞임
//  - 바닥은 16×16 타일 묶음(청크)으로 미리 그려 두고 매 프레임 이미지 몇 장만 붙임
//  - 벽 · 나무 · 바위 · 집 같은 솟은 물체는 스프라이트로 만들어 두고, 캐릭터와 함께 깊이 순서로 그림
import { T } from './world.js';
import { drawGroundDetail } from './scenery.js';

export const TW = 64, TH = 32; // 타일 마름모 폭/높이(px)
export const HW = TW / 2, HH = TH / 2;
// 월드에서 반지름 r 인 원 → 화면 타원 반지름 (가로 ISO_RX·r, 세로 ISO_RY·r)
export const ISO_RX = HW * Math.SQRT2, ISO_RY = HH * Math.SQRT2;

const TEX = 128;
const TAU = Math.PI * 2;

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
};
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const rgb = (c, k = 0) => `rgb(${clamp255(c[0] + k)},${clamp255(c[1] + k)},${clamp255(c[2] + k)})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------------------------------------------------------------- 이음새 없는 노이즈
function periodic(seed, cells) {
  const r = mulberry32(seed);
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const sm = (t) => t * t * (3 - 2 * t);
  const at = (a, b) => g[(((b % cells) + cells) % cells) * cells + (((a % cells) + cells) % cells)];
  return (x, y) => {
    const fx = (x / TEX) * cells, fy = (y / TEX) * cells;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = sm(fx - ix), ty = sm(fy - iy);
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    return a + (b - a) * tx + (c - a + (d - c - b + a) * tx) * ty;
  };
}

function fbm(seed) {
  const n = [periodic(seed, 4), periodic(seed + 1, 8), periodic(seed + 2, 16), periodic(seed + 3, 32)];
  return (x, y) => n[0](x, y) * 0.42 + n[1](x, y) * 0.28 + n[2](x, y) * 0.18 + n[3](x, y) * 0.12;
}

// 텍스처 경계를 넘는 장식은 반대편에도 그려서 이음새가 안 보이게
function wrapped(fn, x, y, pad = 12) {
  for (const dx of [-TEX, 0, TEX]) for (const dy of [-TEX, 0, TEX]) {
    if (x + dx > -pad && x + dx < TEX + pad && y + dy > -pad && y + dy < TEX + pad) fn(x + dx, y + dy);
  }
}

// 노이즈 바탕 텍스처: base 색에 덩어리 노이즈 + 잔 입자
function noiseTex(seed, base, amp, { grain = 6, tint = [1, 1, 1], patch = null } = {}) {
  const c = canvas(TEX, TEX), ctx = c.getContext('2d');
  const img = ctx.createImageData(TEX, TEX), d = img.data;
  const n = fbm(seed), r = mulberry32(seed + 99);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    let v = (n(x, y) - 0.5) * 2 * amp + (r() - 0.5) * grain;
    let col = base;
    if (patch) { const p = n(x * 0.7 + 40, y * 0.7 + 17); if (p > patch.at) col = mix(base, patch.color, Math.min(1, (p - patch.at) * 6)); }
    const i = (y * TEX + x) * 4;
    d[i] = clamp255(col[0] + v * tint[0]); d[i + 1] = clamp255(col[1] + v * tint[1]); d[i + 2] = clamp255(col[2] + v * tint[2]); d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { c, ctx, r };
}

// 돌바닥 · 자갈길: 이음새 없는 보로노이 (세로를 눌러서 비스듬히 본 돌처럼)
function cellTex(seed, count, base, spread, mortar, { squash = 2, mortarW = 1.6, bevel = 26 } = {}) {
  const c = canvas(TEX, TEX), ctx = c.getContext('2d');
  const img = ctx.createImageData(TEX, TEX), d = img.data;
  const r = mulberry32(seed), n = fbm(seed + 5);
  const pts = Array.from({ length: count }, () => {
    const k = (r() - 0.5) * spread, hue = (r() - 0.5) * 6;
    return { x: r() * TEX, y: r() * TEX, col: [base[0] + k + hue, base[1] + k, base[2] + k - hue] };
  });
  const R = Math.sqrt((TEX * TEX) / count) * 0.6;
  const wrap = (v) => (v > TEX / 2 ? v - TEX : v < -TEX / 2 ? v + TEX : v);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    let d1 = 1e9, d2 = 1e9, best = null, bx = 0, by = 0;
    for (const p of pts) {
      const dx = wrap(x - p.x), dy = wrap(y - p.y) * squash;
      const dd = Math.sqrt(dx * dx + dy * dy);
      if (dd < d1) { d2 = d1; d1 = dd; best = p; bx = dx; by = dy; } else if (dd < d2) d2 = dd;
    }
    const edge = d2 - d1;
    const i = (y * TEX + x) * 4;
    const noise = (n(x, y) - 0.5) * 22;
    let col;
    if (edge < mortarW) col = mortar.map((v) => v + noise * 0.5);
    else {
      const light = -(bx * 0.7 + by * 0.9) / R; // 왼쪽 위가 밝게
      const rim = edge < mortarW + 2.2 ? -18 : 0;
      col = best.col.map((v) => v + light * bevel + noise + rim);
    }
    d[i] = clamp255(col[0]); d[i + 1] = clamp255(col[1]); d[i + 2] = clamp255(col[2]); d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { c, ctx, r };
}

function grassBlades(ctx, r, count, light, dark) {
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    const x = r() * TEX, y = r() * TEX, len = 2.5 + r() * 4.5, lean = (r() - 0.5) * 3;
    const col = r() < 0.55 ? light : dark;
    ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.45 + r() * 0.4})`;
    wrapped((px, py) => { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + lean, py - len); ctx.stroke(); }, x, y);
  }
}

function specks(ctx, r, count, colors, size = 1.5) {
  for (let i = 0; i < count; i++) {
    const x = r() * TEX, y = r() * TEX, s = size * (0.6 + r() * 0.8);
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    wrapped((px, py) => { ctx.beginPath(); ctx.ellipse(px, py, s, s * 0.6, 0, 0, TAU); ctx.fill(); }, x, y, 4);
  }
}

const TEXGEN = {
  grass_field() { // 어두운 올리브빛 풀밭
    const t = noiseTex(11, [70, 78, 36], 18, { patch: { at: 0.6, color: [52, 60, 28] } });
    grassBlades(t.ctx, t.r, 340, [112, 118, 54], [44, 52, 24]);
    return t.c;
  },
  grass_meadow() {
    const t = noiseTex(12, [74, 104, 46], 18, { patch: { at: 0.64, color: [60, 88, 38] } });
    grassBlades(t.ctx, t.r, 300, [112, 146, 64], [46, 70, 30]);
    return t.c;
  },
  darkgrass() {
    const t = noiseTex(13, [46, 58, 34], 14, { patch: { at: 0.6, color: [36, 44, 30] } });
    grassBlades(t.ctx, t.r, 260, [72, 86, 46], [28, 36, 22]);
    return t.c;
  },
  swamp() {
    const t = noiseTex(14, [62, 70, 42], 16, { patch: { at: 0.56, color: [36, 48, 40] } });
    grassBlades(t.ctx, t.r, 140, [96, 110, 56], [40, 50, 30]);
    return t.c;
  },
  dirt() {
    const t = noiseTex(15, [106, 84, 58], 20, { grain: 8 });
    specks(t.ctx, t.r, 46, ['rgba(140,116,86,0.8)', 'rgba(70,54,38,0.7)', 'rgba(122,104,82,0.8)'], 1.8);
    return t.c;
  },
  sand() {
    const t = noiseTex(16, [184, 162, 116], 14, { grain: 7 });
    specks(t.ctx, t.r, 60, ['rgba(150,128,90,0.6)', 'rgba(210,192,150,0.7)'], 1.1);
    return t.c;
  },
  snow() {
    const t = noiseTex(17, [214, 222, 232], 12, { grain: 4, tint: [0.9, 0.95, 1.1] });
    specks(t.ctx, t.r, 40, ['rgba(255,255,255,0.9)', 'rgba(180,196,220,0.6)'], 1.2);
    return t.c;
  },
  stone() { // 거친 바위 땅 (필드)
    const t = noiseTex(18, [96, 92, 86], 22, { grain: 8 });
    const { ctx, r } = t;
    ctx.strokeStyle = 'rgba(48,46,42,0.55)'; ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      let x = r() * TEX, y = r() * TEX;
      const pts = [[x, y]];
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 16; y += (r() - 0.3) * 8; pts.push([x, y]); }
      wrapped((ox, oy) => { ctx.beginPath(); pts.forEach(([px, py], j) => (j ? ctx.lineTo(px + ox - pts[0][0], py + oy - pts[0][1]) : ctx.moveTo(ox, oy))); ctx.stroke(); }, pts[0][0], pts[0][1], 40);
    }
    return t.c;
  },
  ash() {
    const t = noiseTex(19, [62, 56, 54], 14, { grain: 8 });
    specks(t.ctx, t.r, 30, ['rgba(40,36,34,0.8)', 'rgba(90,80,76,0.7)', 'rgba(200,90,40,0.35)'], 1.4);
    return t.c;
  },
  void() {
    const t = noiseTex(20, [40, 30, 58], 16, { grain: 6 });
    specks(t.ctx, t.r, 30, ['rgba(200,170,255,0.7)', 'rgba(120,90,180,0.6)'], 0.9);
    return t.c;
  },
  water() {
    const t = noiseTex(21, [30, 62, 88], 16, { grain: 3, tint: [0.7, 1, 1.2] });
    const { ctx, r } = t;
    ctx.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const x = r() * TEX, y = r() * TEX, w = 6 + r() * 10;
      ctx.strokeStyle = `rgba(140,190,215,${0.18 + r() * 0.2})`;
      wrapped((px, py) => { ctx.beginPath(); ctx.ellipse(px, py, w, w * 0.25, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }, x, y, 20);
    }
    return t.c;
  },
  lava() {
    const c = canvas(TEX, TEX), ctx = c.getContext('2d');
    const img = ctx.createImageData(TEX, TEX), d = img.data, n = fbm(22);
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const v = n(x, y);
      const col = v < 0.42 ? mix([46, 18, 12], [120, 34, 14], v / 0.42) : v < 0.56 ? mix([200, 64, 18], [240, 120, 30], (v - 0.42) / 0.14) : mix([250, 150, 40], [255, 214, 110], Math.min(1, (v - 0.56) / 0.2));
      const i = (y * TEX + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  },
  cobble_town() { return cellTex(23, 150, [118, 102, 84], 34, [58, 48, 40], { mortarW: 1.3, bevel: 18 }).c; },
  flag_gray() { return cellTex(24, 48, [104, 100, 94], 22, [42, 40, 38], { mortarW: 1.7, bevel: 14 }).c; },
  flag_brown() { return cellTex(25, 48, [108, 90, 70], 22, [48, 38, 30], { mortarW: 1.7, bevel: 14 }).c; },
  flag_dark() { return cellTex(26, 48, [68, 62, 60], 16, [26, 22, 22], { mortarW: 1.7, bevel: 12 }).c; },
  flag_sand() { return cellTex(27, 48, [146, 128, 100], 20, [84, 70, 56], { mortarW: 1.6, bevel: 12 }).c; },
  planks() { // 비스듬한 나무 판자
    const c = canvas(TEX, TEX), ctx = c.getContext('2d');
    const img = ctx.createImageData(TEX, TEX), d = img.data, n = fbm(28), r = mulberry32(28);
    const shades = Array.from({ length: 16 }, () => (r() - 0.5) * 28);
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const u = y - x * 0.5 + TEX; // 판자 방향 = 마름모 변 방향
      const row = Math.floor(u / 8) % 16;
      const seam = (u % 8) < 1;
      const grain = Math.sin((x * 0.9 + y * 0.45) * 0.9 + row) * 4 + (n(x, y) - 0.5) * 20;
      const base = seam ? [52, 34, 22] : [118 + shades[row], 82 + shades[row] * 0.8, 50 + shades[row] * 0.6];
      const i = (y * TEX + x) * 4;
      d[i] = clamp255(base[0] + grain); d[i + 1] = clamp255(base[1] + grain * 0.8); d[i + 2] = clamp255(base[2] + grain * 0.6); d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  },
  tiles_tower() { // 마름모 석판 바닥
    const c = canvas(TEX, TEX), ctx = c.getContext('2d');
    const img = ctx.createImageData(TEX, TEX), d = img.data, n = fbm(29);
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const u = x / 32 + y / 16, v = y / 16 - x / 32;
      const fu = u - Math.floor(u), fv = v - Math.floor(v);
      const grout = fu < 0.05 || fv < 0.05;
      const dark = (Math.floor(u) + Math.floor(v)) & 1;
      const base = grout ? [54, 50, 46] : dark ? [100, 96, 90] : [124, 120, 112];
      const k = (n(x, y) - 0.5) * 18 + (grout ? 0 : (0.5 - fu) * 10);
      const i = (y * TEX + x) * 4;
      d[i] = clamp255(base[0] + k); d[i + 1] = clamp255(base[1] + k); d[i + 2] = clamp255(base[2] + k); d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  },
};

const texCache = new Map();
export function texture(key) {
  let t = texCache.get(key);
  if (!t) { t = (TEXGEN[key] || TEXGEN.dirt)(); texCache.set(key, t); }
  return t;
}

// 지형 → 텍스처. 그리는 순서(prio)가 높을수록 위에 덮이고, soft 면 가장자리를 들쭉날쭉하게
const TEXINFO = {
  water: { prio: 0, soft: true }, lava: { prio: 0, soft: true }, void: { prio: 1, soft: true },
  ash: { prio: 2, soft: true }, swamp: { prio: 3, soft: true }, sand: { prio: 4, soft: true }, snow: { prio: 5, soft: true },
  stone: { prio: 6, soft: true },
  flag_gray: { prio: 7 }, flag_brown: { prio: 7 }, flag_dark: { prio: 7 }, flag_sand: { prio: 7 },
  cobble_town: { prio: 7 }, planks: { prio: 7 }, tiles_tower: { prio: 7 },
  dirt: { prio: 8, soft: true }, darkgrass: { prio: 9, soft: true }, grass_field: { prio: 10, soft: true }, grass_meadow: { prio: 10, soft: true },
};

const BRIGHT_BIOMES = new Set(['meadow', 'garden', 'springs', 'highland', 'village', 'reeds', 'bridge', 'lake']);
const DUNGEON_FLOOR = {
  cave: { [T.STONE]: 'flag_gray', [T.ASH]: 'flag_gray' },
  mine: { [T.DIRT]: 'dirt', [T.STONE]: 'flag_brown' },
  coral: { [T.SAND]: 'flag_sand', [T.STONE]: 'flag_sand', [T.WATER]: 'water' },
  tower: { [T.FLOOR]: 'tiles_tower', [T.STONE]: 'tiles_tower' },
  library: { [T.FLOOR]: 'planks' },
  volcano: { [T.ASH]: 'ash', [T.STONE]: 'flag_dark', [T.LAVA]: 'lava' },
  void: { [T.VOID]: 'void' },
};

/** 타일의 바닥 텍스처 이름 */
export function groundKey(world, t) {
  const style = world.style;
  if (world.type === 'dungeon') {
    const m = DUNGEON_FLOOR[style] || DUNGEON_FLOOR.cave;
    return m[t] || Object.values(m)[0];
  }
  const grass = BRIGHT_BIOMES.has(style) ? 'grass_meadow' : 'grass_field';
  switch (t) {
    case T.GRASS: case T.FLOWER: case T.TREE: return grass;
    case T.DIRT: return 'dirt';
    case T.WATER: return 'water';
    case T.LAVA: return 'lava';
    case T.SAND: case T.CACTUS: case T.CORAL: return 'sand';
    case T.SNOW: case T.ICE: return 'snow';
    case T.FLOOR: return world.type === 'village' ? 'cobble_town' : 'planks';
    case T.HOUSE: return 'cobble_town';
    case T.WALL: return world.type === 'village' ? 'cobble_town' : 'stone';
    case T.STONE: case T.ROCK: case T.CRYSTAL: return 'stone';
    case T.SWAMP: return 'swamp';
    case T.ASH: return 'ash';
    case T.DARKGRASS: case T.GRAVE: case T.DEADTREE: return 'darkgrass';
    case T.SHELF: return 'planks';
    case T.VOID: return 'void';
    default: return grass;
  }
}

// ---------------------------------------------------------------- 스프라이트 (고해상도로 한 번만 그림)
const SPR_SCALE = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
const sprCache = new Map();

// w×h(px) 캔버스에 draw(ctx, rng) 로 그림. anchor = 타일 중심이 놓일 점
function sprite(key, w, h, ax, ay, draw, seed = 1) {
  let s = sprCache.get(key);
  if (s) return s;
  const c = canvas(w * SPR_SCALE, h * SPR_SCALE);
  const ctx = c.getContext('2d');
  ctx.scale(SPR_SCALE, SPR_SCALE);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  draw(ctx, mulberry32(seed));
  s = { img: c, w, h, ax, ay };
  sprCache.set(key, s);
  return s;
}

export function drawSprite(ctx, s, x, y) {
  ctx.drawImage(s.img, Math.round(x - s.ax), Math.round(y - s.ay), s.w, s.h);
}

// ---- 솟은 블록 (벽): 쌓은 돌 · 벽돌 · 책장 · 얼음 · 수정
const WALLS = {
  stone: { H: 46, top: [124, 118, 108], left: [98, 92, 84], right: [72, 68, 62], mortar: [38, 36, 34], face: 'stones' },
  mine: { H: 46, top: [122, 104, 84], left: [98, 80, 62], right: [72, 60, 46], mortar: [40, 32, 24], face: 'stones' },
  basalt: { H: 46, top: [74, 66, 66], left: [54, 48, 48], right: [40, 34, 34], mortar: [18, 14, 14], face: 'stones', glow: true },
  coral: { H: 42, top: [196, 132, 128], left: [162, 98, 100], right: [126, 74, 80], mortar: [80, 44, 48], face: 'stones' },
  brick: { H: 50, top: [150, 124, 100], left: [124, 96, 76], right: [94, 72, 56], mortar: [60, 46, 36], face: 'bricks' },
  shelf: { H: 54, top: [96, 64, 38], left: [84, 56, 34], right: [64, 42, 26], mortar: [36, 22, 12], face: 'books' },
  crystal: { H: 50, top: [166, 126, 226], left: [118, 84, 182], right: [84, 58, 140], mortar: [50, 30, 90], face: 'facets' },
  ice: { H: 34, top: [214, 236, 248], left: [168, 210, 234], right: [126, 176, 210], mortar: [100, 150, 190], face: 'facets' },
  town: { H: 52, top: [178, 162, 132], left: [150, 134, 108], right: [114, 100, 80], mortar: [70, 60, 48], face: 'stones', merlons: true },
  ruin: { H: 36, top: [116, 112, 100], left: [92, 88, 78], right: [68, 66, 58], mortar: [40, 40, 34], face: 'stones', moss: true },
};

function blockSprite(style, variant) {
  const W = WALLS[style] || WALLS.stone;
  const H = W.H + (W.merlons ? 8 : 0);
  return sprite(`block:${style}:${variant}`, TW + 2, TH + H + 2, HW + 1, H + HH + 1, (ctx, r) => {
    ctx.translate(1, 1);
    const h = W.H, top0 = H - h; // 윗면 높이 (총높이에서)
    const P = { T: [HW, top0], R: [TW, top0 + HH], B: [HW, top0 + TH], L: [0, top0 + HH] };
    const G = { R: [TW, H + HH], B: [HW, H + TH], L: [0, H + HH] };
    const poly = (pts, fill, stroke) => {
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
    };
    // 옆면 바탕(줄눈 색)
    poly([P.L, P.B, G.B, G.L], rgb(W.mortar));
    poly([P.B, P.R, G.R, G.B], rgb(W.mortar, -6));
    // 옆면 무늬
    const face = (a, b, base, dk) => {
      const pt = (u, v) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + v * h];
      if (W.face === 'facets') {
        poly([pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)], rgb(base));
        for (let i = 0; i < 4; i++) {
          const u = r();
          ctx.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.25})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(...pt(u, 0.05)); ctx.lineTo(...pt(u + (r() - 0.5) * 0.3, 0.6 + r() * 0.35)); ctx.stroke();
        }
        return;
      }
      if (W.face === 'books') {
        poly([pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)], rgb(base));
        const shelves = 4;
        for (let s = 0; s < shelves; s++) {
          const v0 = s / shelves + 0.04, v1 = (s + 1) / shelves - 0.04;
          let u = 0.04;
          while (u < 0.94) {
            const bw = 0.05 + r() * 0.05;
            const bh = (v1 - v0) * (0.7 + r() * 0.3);
            const col = [[130, 34, 30], [36, 60, 120], [50, 96, 52], [140, 108, 40], [90, 40, 100], [150, 140, 120]][Math.floor(r() * 6)];
            poly([pt(u, v1 - bh), pt(Math.min(0.96, u + bw), v1 - bh), pt(Math.min(0.96, u + bw), v1), pt(u, v1)], rgb(col, dk));
            u += bw + 0.008;
          }
          poly([pt(0, v1), pt(1, v1), pt(1, v1 + 0.04), pt(0, v1 + 0.04)], rgb([60, 38, 22], dk));
        }
        return;
      }
      const rows = W.face === 'bricks' ? Math.round(h / 7) : Math.round(h / 9.5);
      for (let row = 0; row < rows; row++) {
        const v0 = row / rows, v1 = (row + 1) / rows;
        let u = W.face === 'bricks' ? (row % 2 ? -0.12 : 0) : -r() * 0.2;
        while (u < 1) {
          const wdt = W.face === 'bricks' ? 0.24 : 0.2 + r() * 0.2;
          const u0 = Math.max(0, u) + 0.018, u1 = Math.min(1, u + wdt) - 0.018;
          if (u1 > u0) {
            const k = (r() - 0.5) * 22 + dk;
            const g = 1.2 / h;
            const pts = [pt(u0, v0 + g), pt(u1, v0 + g), pt(u1, v1 - g), pt(u0, v1 - g)];
            poly(pts, rgb(base, k));
            // 돌 윗변 밝게, 아랫변 어둡게
            ctx.lineWidth = 1;
            ctx.strokeStyle = `rgba(255,255,255,${W.face === 'bricks' ? 0.12 : 0.2})`;
            ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.stroke();
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath(); ctx.moveTo(...pts[3]); ctx.lineTo(...pts[2]); ctx.stroke();
            if (W.moss && r() < 0.18) { ctx.fillStyle = 'rgba(70,100,40,0.55)'; ctx.beginPath(); ctx.ellipse(...pt((u0 + u1) / 2, v0 + 0.1), 4, 2, 0, 0, TAU); ctx.fill(); }
            if (W.glow && r() < 0.12) { ctx.strokeStyle = 'rgba(255,110,40,0.7)'; ctx.beginPath(); ctx.moveTo(...pt(u0, v1 - g)); ctx.lineTo(...pt(u1, v1 - g)); ctx.stroke(); }
          }
          u += wdt;
        }
      }
    };
    face(P.L, P.B, W.left, 0);
    face(P.B, P.R, W.right, 0);
    // 윗면
    ctx.save();
    poly([P.T, P.R, P.B, P.L]);
    ctx.clip();
    if (W.face === 'stones' || W.face === 'bricks') {
      const pat = ctx.createPattern(texture(W.face === 'bricks' ? 'tiles_tower' : 'flag_gray'), 'repeat');
      ctx.fillStyle = pat; ctx.fillRect(0, top0, TW, TH);
      ctx.fillStyle = `rgba(${W.top[0]},${W.top[1]},${W.top[2]},0.55)`; ctx.fillRect(0, top0, TW, TH);
    } else {
      ctx.fillStyle = rgb(W.top); ctx.fillRect(0, top0, TW, TH);
    }
    ctx.restore();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,255,240,0.35)';
    ctx.beginPath(); ctx.moveTo(...P.L); ctx.lineTo(...P.T); ctx.lineTo(...P.R); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.moveTo(...P.L); ctx.lineTo(...P.B); ctx.lineTo(...P.R); ctx.stroke();
    if (W.merlons) {
      // 성벽 위 총안(凸)
      for (const [u, side] of [[0.18, 'L'], [0.62, 'L'], [0.18, 'R'], [0.62, 'R']]) {
        const a = side === 'L' ? P.L : P.B, b = side === 'L' ? P.B : P.R;
        const x0 = a[0] + (b[0] - a[0]) * u, y0 = a[1] + (b[1] - a[1]) * u;
        const x1 = a[0] + (b[0] - a[0]) * (u + 0.22), y1 = a[1] + (b[1] - a[1]) * (u + 0.22);
        poly([[x0, y0 - 8], [x1, y1 - 8], [x1, y1], [x0, y0]], rgb(side === 'L' ? W.left : W.right, 8), 'rgba(0,0,0,0.3)');
        poly([[x0, y0 - 8], [x1, y1 - 8], [x1 + (side === 'L' ? 5 : -5), y1 - 10.5], [x0 + (side === 'L' ? 5 : -5), y0 - 10.5]], rgb(W.top));
      }
    }
  }, style.length * 97 + variant * 13);
}

// ---- 나무
const LEAF = {
  field: { dark: [24, 38, 18], mid: [50, 72, 32], light: [108, 130, 58] },
  bright: { dark: [26, 50, 22], mid: [54, 92, 38], light: [118, 156, 68] },
};

function treeSprite(kind, variant, small = false) {
  const pal = LEAF[kind] || LEAF.field;
  const sc = small ? 0.7 : 1;
  return sprite(`tree:${kind}:${variant}:${small}`, 170, 210, 85, 192, (ctx, r) => {
    ctx.translate(85, 192); ctx.scale(sc, sc); ctx.translate(-85, -192);
    const bx = 85, by = 192;
    const lean = (r() - 0.5) * 40;
    const topY = 104 + r() * 20;
    const tx = bx + lean;
    // 비틀린 줄기: 두 번 꺾임
    const mx = bx - lean * 0.6 + (r() - 0.5) * 18, my = by - 46;
    ctx.strokeStyle = '#2e2014'; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(bx - 3, by); ctx.quadraticCurveTo(mx, my, tx, topY); ctx.stroke();
    ctx.strokeStyle = '#4a3422'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(bx - 1, by - 2); ctx.quadraticCurveTo(mx + 1, my, tx + 1, topY); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,130,90,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx + 2, by - 6); ctx.quadraticCurveTo(mx + 3, my, tx + 3, topY + 8); ctx.stroke();
    // 잎 덩어리: 꼭대기 주변에 흩어지게
    const clumps = [];
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const cx = tx + (r() - 0.5) * 70, cy = topY - 14 + (r() - 0.5) * 34;
      clumps.push([cx, cy, 15 + r() * 11]);
      ctx.strokeStyle = '#33241a'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(tx, topY + 4); ctx.quadraticCurveTo((tx + cx) / 2 + (r() - 0.5) * 10, cy + 12, cx, cy + 6); ctx.stroke();
    }
    clumps.sort((a, b) => a[1] - b[1]);
    for (const [cx, cy, R] of clumps) {
      ctx.fillStyle = rgb(pal.dark, -6);
      ctx.beginPath(); ctx.ellipse(cx + 2, cy + 4, R * 1.0, R * 0.72, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 110; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * R;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.72;
        const light = Math.max(0, Math.min(1, 0.45 - ((x - cx) * 0.6 + (y - cy) * 1.1) / (R * 1.5) + (r() - 0.5) * 0.5));
        const col = light < 0.5 ? mix(pal.dark, pal.mid, light * 2) : mix(pal.mid, pal.light, (light - 0.5) * 2);
        ctx.fillStyle = rgb(col, (r() - 0.5) * 16);
        ctx.beginPath(); ctx.ellipse(x, y, 2 + r() * 2.4, 1.5 + r() * 1.5, r() * Math.PI, 0, TAU); ctx.fill();
      }
    }
  }, 4000 + variant * 7 + (kind === 'bright' ? 100 : 0) + (small ? 50 : 0));
}

// 덤불 (빽빽한 숲의 나머지 칸)
function bushSprite(kind, variant) {
  const pal = LEAF[kind] || LEAF.field;
  return sprite(`bush:${kind}:${variant}`, 80, 56, 40, 46, (ctx, r) => {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(36, 46, 30, 9, 0, 0, TAU); ctx.fill();
    const n = 3 + Math.floor(r() * 2);
    for (let c = 0; c < n; c++) {
      const cx = 40 + (r() - 0.5) * 34, cy = 34 + (r() - 0.5) * 10, R = 9 + r() * 7;
      ctx.fillStyle = rgb(pal.dark, -4); ctx.beginPath(); ctx.ellipse(cx, cy + 2, R, R * 0.7, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 46; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * R;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.7;
        const light = Math.max(0, Math.min(1, 0.45 - ((x - cx) * 0.5 + (y - cy)) / (R * 1.4) + (r() - 0.5) * 0.5));
        ctx.fillStyle = rgb(light < 0.5 ? mix(pal.dark, pal.mid, light * 2) : mix(pal.mid, pal.light, (light - 0.5) * 2), (r() - 0.5) * 14);
        ctx.beginPath(); ctx.ellipse(x, y, 1.8 + r() * 1.8, 1.3 + r() * 1.2, r() * Math.PI, 0, TAU); ctx.fill();
      }
    }
  }, 4500 + variant + (kind === 'bright' ? 100 : 0));
}

function pineSprite(snowy, variant) {
  return sprite(`pine:${snowy}:${variant}`, 110, 190, 55, 176, (ctx, r) => {
    const bx = 55, by = 176;
    ctx.fillStyle = '#3a2818'; ctx.fillRect(bx - 4, by - 30, 8, 30);
    const tiers = 5;
    for (let t = 0; t < tiers; t++) {
      const y = by - 26 - t * 26, w = 46 - t * 8, hgt = 42;
      ctx.fillStyle = rgb([28 + t * 4, 58 + t * 6, 38 + t * 3], (r() - 0.5) * 8);
      ctx.beginPath(); ctx.moveTo(bx - w, y); ctx.quadraticCurveTo(bx, y + 8, bx + w, y); ctx.lineTo(bx + 2, y - hgt); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.moveTo(bx + 2, y - hgt); ctx.lineTo(bx + w, y); ctx.quadraticCurveTo(bx + w * 0.5, y + 4, bx + 4, y + 3); ctx.closePath(); ctx.fill();
      if (snowy) {
        ctx.fillStyle = 'rgba(240,246,252,0.92)';
        ctx.beginPath(); ctx.moveTo(bx - w * 0.6, y - hgt * 0.3); ctx.quadraticCurveTo(bx - w * 0.2, y - hgt * 0.45, bx + 2, y - hgt); ctx.lineTo(bx - w * 0.15, y - hgt * 0.35); ctx.closePath(); ctx.fill();
      }
    }
  }, 5000 + variant);
}

function deadTreeSprite(variant) {
  return sprite(`dead:${variant}`, 140, 170, 70, 156, (ctx, r) => {
    const branch = (x, y, a, len, w, depth) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      ctx.strokeStyle = depth > 2 ? '#2e2620' : '#3a3028'; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * 8, (y + y2) / 2, x2, y2); ctx.stroke();
      if (depth < 4) {
        branch(x2, y2, a - 0.4 - r() * 0.4, len * 0.68, w * 0.62, depth + 1);
        if (r() < 0.8) branch(x2, y2, a + 0.3 + r() * 0.4, len * 0.62, w * 0.6, depth + 1);
      }
    };
    branch(70, 156, -Math.PI / 2 + (r() - 0.5) * 0.3, 54, 9, 0);
  }, 6000 + variant);
}

function boulderSprite(variant, tint = [118, 112, 104]) {
  return sprite(`rock:${variant}:${tint}`, 84, 64, 42, 46, (ctx, r) => {
    const stones = variant % 3 === 0 ? 1 : 2 + (variant % 2);
    for (let s = 0; s < stones; s++) {
      const cx = 42 + (s ? (r() - 0.5) * 34 : 0), cy = 40 + (s ? r() * 8 : -2);
      const rx = s ? 11 + r() * 7 : 20 + r() * 6, ry = rx * (0.62 + r() * 0.15);
      const pts = [];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU, k = 0.82 + r() * 0.3;
        pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k - (Math.sin(a) < 0 ? ry * 0.5 : 0)]);
      }
      const g = ctx.createLinearGradient(cx - rx, cy - ry * 1.4, cx + rx, cy + ry);
      g.addColorStop(0, rgb(tint, 34)); g.addColorStop(0.5, rgb(tint)); g.addColorStop(1, rgb(tint, -46));
      ctx.fillStyle = g;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(30,28,24,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = 'rgba(40,36,32,0.5)';
      ctx.beginPath(); ctx.moveTo(cx - rx * 0.3, cy - ry * 0.6); ctx.lineTo(cx + rx * 0.1, cy - ry * 0.1); ctx.lineTo(cx + rx * 0.05, cy + ry * 0.4); ctx.stroke();
    }
  }, 7000 + variant);
}

function graveSprite(variant) {
  return sprite(`grave:${variant}`, 44, 60, 22, 48, (ctx, r) => {
    ctx.fillStyle = 'rgba(40,34,26,0.8)'; ctx.beginPath(); ctx.ellipse(22, 48, 16, 6, 0, 0, TAU); ctx.fill();
    const g = ctx.createLinearGradient(12, 10, 32, 46);
    g.addColorStop(0, '#a4a4ac'); g.addColorStop(1, '#5a5a62');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(13, 47); ctx.lineTo(13, 18); ctx.quadraticCurveTo(22, 4 + r() * 4, 31, 18); ctx.lineTo(31, 47); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#4a4a52'; ctx.fillRect(21, 19, 2.5, 14); ctx.fillRect(17, 23, 10, 2.5);
  }, 8000 + variant);
}

function crystalSprite(variant) {
  return sprite(`crystal:${variant}`, 64, 84, 32, 70, (ctx, r) => {
    const g = ctx.createRadialGradient(32, 66, 2, 32, 66, 30);
    g.addColorStop(0, 'rgba(170,120,255,0.45)'); g.addColorStop(1, 'rgba(170,120,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(32, 66, 30, 14, 0, 0, TAU); ctx.fill();
    const n = 3 + (variant % 3);
    for (let i = 0; i < n; i++) {
      const x = 32 + (i - (n - 1) / 2) * 9 + (r() - 0.5) * 4, hgt = 24 + r() * 36, w = 5 + r() * 4, tilt = (r() - 0.5) * 10;
      ctx.fillStyle = '#7a4ac0';
      ctx.beginPath(); ctx.moveTo(x - w, 68); ctx.lineTo(x - w + tilt * 0.5, 68 - hgt * 0.75); ctx.lineTo(x + tilt, 68 - hgt); ctx.lineTo(x + w + tilt * 0.5, 68 - hgt * 0.75); ctx.lineTo(x + w, 68); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(220,190,255,0.75)';
      ctx.beginPath(); ctx.moveTo(x - w * 0.3, 68); ctx.lineTo(x - w * 0.3 + tilt * 0.5, 68 - hgt * 0.75); ctx.lineTo(x + tilt, 68 - hgt); ctx.lineTo(x + w * 0.2, 68); ctx.closePath(); ctx.fill();
    }
  }, 9000 + variant);
}

function coralSprite(variant) {
  return sprite(`coral:${variant}`, 64, 70, 32, 58, (ctx, r) => {
    const col = ['#e8646e', '#f08a5a', '#d85090'][variant % 3];
    ctx.strokeStyle = col;
    const br = (x, y, a, len, w, d) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      if (d < 3) { br(x2, y2, a - 0.5 - r() * 0.3, len * 0.7, w * 0.7, d + 1); br(x2, y2, a + 0.4 + r() * 0.3, len * 0.7, w * 0.7, d + 1); }
    };
    br(32, 58, -Math.PI / 2, 16, 5, 0);
  }, 9500 + variant);
}

function cactusSprite(variant) {
  return sprite(`cactus:${variant}`, 50, 84, 25, 72, (ctx) => {
    const g = ctx.createLinearGradient(18, 0, 32, 0);
    g.addColorStop(0, '#6aaa5a'); g.addColorStop(1, '#2e6a32');
    ctx.fillStyle = g;
    const pill = (x, y, w, h) => { ctx.beginPath(); ctx.ellipse(x + w / 2, y + w / 2, w / 2, w / 2, 0, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill(); };
    pill(19, 14, 12, 58);
    pill(7, 30 + (variant % 2) * 6, 8, 18); ctx.fillRect(10, 44, 12, 5);
    pill(35, 24, 8, 16); ctx.fillRect(28, 36, 10, 5);
  }, 9700 + variant);
}

/**
 * 타일 위에 솟은 물체의 스프라이트 (없으면 null). v = 타일마다 고정 난수
 */
export function objectSprite(world, t, v, i = -1) {
  const style = world.style;
  if (world.type === 'dungeon') {
    if (world.interior && world.interior[i]) return null;
    const wall = { cave: 'stone', mine: 'mine', coral: 'coral', tower: 'brick', library: 'shelf', volcano: 'basalt', void: 'crystal' }[style] || 'stone';
    if (t === T.ROCK || t === T.WALL || t === T.SHELF || t === T.CORAL || t === T.CRYSTAL) return blockSprite(wall, v % 3);
    return null;
  }
  switch (t) {
    case T.TREE:
      if (style === 'snow' || style === 'highland') return pineSprite(style === 'snow', v % 4);
      {
        // 큰 나무는 드문드문, 나머지는 작은 나무와 덤불 (숲이 나무 벽처럼 보이지 않게)
        const kind = BRIGHT_BIOMES.has(style) ? 'bright' : 'field';
        const k = v % 7;
        if (k < 2) return treeSprite(kind, v % 6);
        if (k < 3) return treeSprite(kind, v % 6, true);
        return bushSprite(kind, v % 5);
      }
    case T.DEADTREE: return deadTreeSprite(v % 4);
    case T.ROCK: return boulderSprite(v % 6, style === 'volcano' || style === 'forge' ? [78, 70, 68] : style === 'desert' ? [150, 126, 96] : [118, 112, 104]);
    case T.WALL: return blockSprite(world.type === 'village' ? 'town' : 'ruin', v % 3);
    case T.GRAVE: return graveSprite(v % 3);
    case T.ICE: return blockSprite('ice', v % 2);
    case T.CRYSTAL: return crystalSprite(v % 4);
    case T.CORAL: return coralSprite(v % 3);
    case T.SHELF: return blockSprite('shelf', v % 3);
    case T.CACTUS: return cactusSprite(v % 2);
    default: return null;
  }
}

// ---- 집 (마을)
const ROOFS = {
  capital: { roof: [48, 86, 142], wall: [226, 220, 197], timber: [154, 121, 62] },
  v1: { roof: [150, 74, 52], wall: [214, 196, 160], timber: [92, 64, 40] },
  v2: { roof: [92, 96, 110], wall: [206, 194, 168], timber: [84, 66, 50] },
  v3: { roof: [60, 92, 130], wall: [222, 214, 194], timber: [70, 60, 52] },
  v4: { roof: [120, 50, 40], wall: [176, 150, 120], timber: [70, 44, 30] },
  v5: { roof: [200, 210, 222], wall: [190, 180, 162], timber: [76, 60, 46], snow: true },
  v6: { roof: [84, 70, 108], wall: [196, 186, 176], timber: [60, 50, 60] },
};

export function propSprite(prop) {
  if (prop.kind === 'fountain') return fountainSprite();
  return houseSprite(prop.w, prop.h, prop.style, prop.seed);
}

function houseSprite(w, h, style, seed) {
  const S = ROOFS[style] || ROOFS.v1;
  const WH = 54, R = h * 14 + 10, ov = 0.35;
  const width = (w + h + ov * 4) * HW + 8, top = WH + R + 16;
  const height = top + (w + h) * HH + 16;
  const offX = (h + ov * 2) * HW + 4;
  const P = (x, y, z) => [offX + (x - y) * HW, top + (x + y) * HH - z];
  // 앵커 = 발자국 중심 (깊이 정렬 기준)
  const [ax, ay] = P(w / 2, h / 2, 0);
  return sprite(`house:${w}x${h}:${style}:${seed}`, width, height, ax, ay, (ctx, r) => {
    const poly = (pts, fill, stroke) => {
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    };
    // 그림자 (왼쪽 아래)
    poly([P(0, h, 0), P(w, h, 0), P(w, h + 1.6, 0), P(-0.6, h + 1.6, 0), P(-0.6, 0.6, 0), P(0, 0, 0)], 'rgba(0,0,0,0.28)');
    // 벽: 동쪽면(오른쪽, 어둡게) / 남쪽면(왼쪽, 밝게)
    const wallFace = (a, b, base) => {
      poly([P(...a, 0), P(...b, 0), P(...b, WH), P(...a, WH)], rgb(base));
      const pt = (u, z) => { const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u; return P(x, y, z); };
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      // 돌 기단
      poly([pt(0, 0), pt(1, 0), pt(1, 10), pt(0, 10)], rgb([110, 100, 88], base === S.wall ? 0 : -20));
      // 나무 기둥 · 들보
      ctx.strokeStyle = rgb(S.timber); ctx.lineWidth = 3;
      for (let i = 0; i <= Math.round(len); i += 2) { const u = i / len; ctx.beginPath(); ctx.moveTo(...pt(u, 10)); ctx.lineTo(...pt(u, WH)); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(...pt(0, 32)); ctx.lineTo(...pt(1, 32)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(...pt(0, WH - 1)); ctx.lineTo(...pt(1, WH - 1)); ctx.stroke();
      // 창문
      for (let i = 1; i < Math.round(len); i += 2) {
        const u0 = (i + 0.25) / len, u1 = (i + 0.75) / len;
        poly([pt(u0, 38), pt(u1, 38), pt(u1, 49), pt(u0, 49)], r() < 0.4 ? 'rgb(236,196,110)' : 'rgb(40,34,30)', rgb(S.timber));
        poly([pt(u0, 16), pt(u1, 16), pt(u1, 27), pt(u0, 27)], r() < 0.35 ? 'rgb(236,196,110)' : 'rgb(40,34,30)', rgb(S.timber));
      }
      return pt;
    };
    wallFace([w, 0], [w, h], S.wall.map((v) => v * 0.78));
    const front = wallFace([0, h], [w, h], S.wall);
    // 문
    const du = Math.min(0.5, 1.2 / w) * 0.5;
    poly([front(0.5 - du, 10), front(0.5 + du, 10), front(0.5 + du, 30), front(0.5 - du, 30)], rgb([70, 46, 28]), rgb([40, 26, 16]));
    // 지붕: 용마루는 x 축을 따라
    const y0 = -ov, y1 = h + ov, ym = h / 2, x0 = -ov, x1 = w + ov;
    const back = [P(x0, y0, WH - 6), P(x1, y0, WH - 6), P(x1, ym, WH + R), P(x0, ym, WH + R)];
    poly(back, rgb(S.roof, -34));
    // 박공 (동쪽 삼각형)
    poly([P(w, 0, WH), P(w, h, WH), P(w, ym, WH + R - 4)], rgb(S.wall.map((v) => v * 0.72)), rgb(S.timber));
    const frontRoof = [P(x0, y1, WH - 6), P(x1, y1, WH - 6), P(x1, ym, WH + R), P(x0, ym, WH + R)];
    poly(frontRoof, rgb(S.roof));
    // 기와 줄
    const rows = Math.round(h * 1.8) + 2;
    for (let i = 1; i <= rows; i++) {
      const t = i / (rows + 1);
      const yy = y1 + (ym - y1) * t, zz = WH - 6 + (R + 6) * t;
      ctx.strokeStyle = `rgba(0,0,0,${0.18 + (i % 2) * 0.08})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(...P(x0, yy, zz)); ctx.lineTo(...P(x1, yy, zz)); ctx.stroke();
      // 기와 세로 마디 (엇갈리게)
      const t2 = (i + 1) / (rows + 1);
      const yy2 = y1 + (ym - y1) * t2, zz2 = WH - 6 + (R + 6) * t2;
      ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 1;
      for (let x = x0 + ((i % 2) ? 0.25 : 0.5); x < x1; x += 0.5) {
        ctx.beginPath(); ctx.moveTo(...P(x, yy, zz)); ctx.lineTo(...P(x, yy2, zz2)); ctx.stroke();
      }
      if (S.snow && i > rows * 0.45) {
        ctx.strokeStyle = 'rgba(245,248,252,0.85)'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(...P(x0, yy, zz + 1)); ctx.lineTo(...P(x1, yy, zz + 1)); ctx.stroke();
      }
    }
    // 빛: 처마 쪽 어둡게
    const g = ctx.createLinearGradient(...P(x0, ym, WH + R), ...P(x0, y1, WH - 6));
    g.addColorStop(0, 'rgba(255,240,210,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
    poly(frontRoof, g);
    // 용마루
    ctx.strokeStyle = rgb(S.roof, -50); ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(...P(x0, ym, WH + R)); ctx.lineTo(...P(x1, ym, WH + R)); ctx.stroke();
    // 굴뚝
    const cx = w * (0.25 + r() * 0.2), cyy = h * 0.3;
    const base = WH + R * (cyy / ym) - 2;
    poly([P(cx, cyy, base), P(cx + 0.6, cyy, base), P(cx + 0.6, cyy, base + 22), P(cx, cyy, base + 22)], rgb([110, 90, 76]));
    poly([P(cx + 0.6, cyy, base), P(cx + 0.6, cyy + 0.6, base), P(cx + 0.6, cyy + 0.6, base + 22), P(cx + 0.6, cyy, base + 22)], rgb([84, 68, 58]));
    poly([P(cx, cyy, base + 22), P(cx + 0.6, cyy, base + 22), P(cx + 0.6, cyy + 0.6, base + 22), P(cx, cyy + 0.6, base + 22)], rgb([60, 50, 44]));
  }, seed);
}

function fountainSprite() {
  const P = (x, y, z) => [72 + (x - y) * HW, 30 + (x + y) * HH - z];
  const [ax, ay] = P(1, 1, 0);
  return sprite('fountain', 144, 110, ax, ay, (ctx) => {
    const ring = (rx, ry, z, fill, stroke) => {
      const [cx, cy] = P(1, 1, z);
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
    };
    ring(62, 31, 0, 'rgba(0,0,0,0.3)');
    ring(58, 29, 10, '#8e867a', '#5a544a');
    ring(52, 26, 12, '#2e5e82');
    ring(44, 22, 12, 'rgba(120,180,210,0.35)');
    const [cx, cy] = P(1, 1, 12);
    ctx.fillStyle = '#9a9286'; ctx.fillRect(cx - 5, cy - 34, 10, 34);
    ring(16, 8, 46, '#a8a094', '#6a645a');
    ctx.strokeStyle = 'rgba(200,230,255,0.7)'; ctx.lineWidth = 2;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx, cy - 46); ctx.quadraticCurveTo(cx + s * 20, cy - 60, cx + s * 30, cy - 8); ctx.stroke(); }
  });
}

// ---------------------------------------------------------------- 지면 청크 캐시
const CH = 16; // 청크 크기(타일)
const MARGIN = 28;
const CHUNK_SCALE = Math.min(1.5, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

// 타일 위쪽 꼭짓점의 절대 화면 좌표
export const isoX = (x, y) => (x - y) * HW;
export const isoY = (x, y) => (x + y) * HH;

export class Ground {
  constructor(world) {
    this.world = world;
    this.chunks = new Map();
    this.patterns = new Map();
    this.max = 28;
  }

  chunkRect(cx, cy) {
    const x0 = cx * CH, y0 = cy * CH;
    return { X0: (x0 - (y0 + CH)) * HW - MARGIN, Y0: (x0 + y0) * HH - MARGIN - 40, W: CH * 2 * HW + MARGIN * 2, H: CH * 2 * HH + MARGIN * 2 + 40 };
  }

  get(cx, cy, build) {
    const k = `${cx},${cy}`;
    let c = this.chunks.get(k);
    if (c) { this.chunks.delete(k); this.chunks.set(k, c); return c; } // LRU
    if (!build) return null;
    c = this.build(cx, cy);
    this.chunks.set(k, c);
    if (this.chunks.size > this.max) this.chunks.delete(this.chunks.keys().next().value);
    return c;
  }

  pattern(ctx, key) {
    return ctx.createPattern(texture(key), 'repeat');
  }

  build(cx, cy) {
    const w = this.world;
    const rc = this.chunkRect(cx, cy);
    const cv = canvas(rc.W * CHUNK_SCALE, rc.H * CHUNK_SCALE);
    const ctx = cv.getContext('2d');
    ctx.scale(CHUNK_SCALE, CHUNK_SCALE);
    const x0 = cx * CH, y0 = cy * CH;
    // 1) 지형별로 모아서, 낮은 순서부터 칠하기 (가장자리 1칸 포함 → 청크 경계에서도 섞임이 이어짐)
    const groups = new Map();
    for (let ty = y0 - 1; ty <= y0 + CH; ty++) for (let tx = x0 - 1; tx <= x0 + CH; tx++) {
      if (tx < 0 || ty < 0 || tx >= w.w || ty >= w.h) continue;
      if (w.interior && w.interior[w.idx(tx, ty)]) continue; // 던전 벽 속은 그리지 않음 (어둠)
      const key = groundKey(w, w.tiles[w.idx(tx, ty)]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push([tx, ty]);
    }
    const order = [...groups.keys()].sort((a, b) => (TEXINFO[a]?.prio ?? 5) - (TEXINFO[b]?.prio ?? 5));
    for (const key of order) {
      const pat = this.pattern(ctx, key);
      pat.setTransform(new DOMMatrix().translate(-rc.X0, -rc.Y0));
      ctx.fillStyle = pat;
      const soft = TEXINFO[key]?.soft;
      ctx.beginPath();
      for (const [tx, ty] of groups.get(key)) this.diamondPath(ctx, tx, ty, rc, soft);
      ctx.fill();
    }
    // 2) 장식: 풀 무더기, 꽃, 자갈, 나무 그림자, 벽 아래 그늘
    for (let ty = y0; ty < y0 + CH; ty++) for (let tx = x0; tx < x0 + CH; tx++) {
      if (tx >= w.w || ty >= w.h) continue;
      if (w.interior && w.interior[w.idx(tx, ty)]) continue;
      this.decorate(ctx, tx, ty, rc);
      drawGroundDetail(ctx, w, tx, ty, isoX(tx, ty) - rc.X0, isoY(tx, ty) - rc.Y0 + HH);
    }
    return { canvas: cv, ...rc };
  }

  diamondPath(ctx, tx, ty, rc, soft) {
    const sx = isoX(tx, ty) - rc.X0, sy = isoY(tx, ty) - rc.Y0;
    if (!soft) {
      ctx.moveTo(sx, sy - 0.5); ctx.lineTo(sx + HW + 0.7, sy + HH); ctx.lineTo(sx, sy + TH + 0.5); ctx.lineTo(sx - HW - 0.7, sy + HH); ctx.closePath();
      return;
    }
    // 가장자리를 바깥으로 들쭉날쭉하게 (이웃 타일과 같은 값을 쓰도록 변 위치로 난수)
    const j = (a, b) => {
      let h = Math.imul(a * 73856093 ^ b * 19349663, 0x5bd1e995);
      h ^= h >>> 13;
      return ((h >>> 0) % 1000) / 1000;
    };
    const cxp = sx, cyp = sy + HH;
    const e = 1.22;
    const pts = [[0, -HH], [HW / 2, -HH / 2], [HW, 0], [HW / 2, HH / 2], [0, HH], [-HW / 2, HH / 2], [-HW, 0], [-HW / 2, -HH / 2]];
    pts.forEach(([px, py], i) => {
      const k = i % 2 ? e + (j(tx * 8 + i, ty * 8 + i) - 0.5) * 0.5 : e - 0.08;
      const x = cxp + px * k, y = cyp + py * k;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }

  decorate(ctx, tx, ty, rc) {
    const w = this.world;
    const i = w.idx(tx, ty);
    const t = w.tiles[i], v = w.variant[i];
    const cx = isoX(tx, ty) - rc.X0, cy = isoY(tx, ty) - rc.Y0 + HH;
    const r = mulberry32(i * 2654435761 + 7);
    const key = groundKey(w, t);
    // 솟은 벽 아래(오른쪽 아래로) 그늘
    const solidN = this.isWallish(tx, ty - 1), solidW = this.isWallish(tx - 1, ty);
    if ((solidN || solidW) && !this.isWallish(tx, ty)) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      if (solidN) { ctx.moveTo(cx, cy - HH); ctx.lineTo(cx + HW, cy); ctx.lineTo(cx + HW * 0.55, cy + HH * 0.45); ctx.lineTo(cx - HW * 0.45, cy - HH * 0.55); ctx.closePath(); }
      if (solidW) { ctx.moveTo(cx, cy - HH); ctx.lineTo(cx - HW, cy); ctx.lineTo(cx - HW * 0.55, cy + HH * 0.45); ctx.lineTo(cx + HW * 0.45, cy - HH * 0.55); ctx.closePath(); }
      ctx.fill();
    }
    if ((t === T.TREE && v % 7 < 3) || t === T.DEADTREE) {
      // 나무 그림자: 왼쪽 아래로 길게
      ctx.fillStyle = t === T.TREE ? 'rgba(10,16,4,0.34)' : 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(cx - 26, cy + 10, 52, 20, -0.15, 0, TAU); ctx.fill();
    }
    if (t === T.FLOWER) {
      const cols = ['#f2d84a', '#f6f2e6', '#e8789a', '#d0a0f0', '#f09040'];
      for (let k = 0; k < 9; k++) {
        const fx = cx + (r() - 0.5) * 46, fy = cy + (r() - 0.5) * 22;
        ctx.fillStyle = 'rgba(40,80,30,0.8)'; ctx.beginPath(); ctx.ellipse(fx, fy + 1.5, 3.2, 1.6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = cols[Math.floor(r() * cols.length)];
        ctx.beginPath(); ctx.arc(fx, fy, 1.8 + r() * 1.2, 0, TAU); ctx.fill();
      }
    } else if ((key === 'grass_field' || key === 'grass_meadow' || key === 'darkgrass' || key === 'swamp') && v % 3 === 0) {
      // 풀 무더기 (키 큰 풀)
      const fx = cx + (r() - 0.5) * 34, fy = cy + (r() - 0.5) * 14;
      const base = key === 'darkgrass' ? [70, 90, 46] : key === 'swamp' ? [110, 120, 60] : key === 'grass_meadow' ? [110, 150, 60] : [128, 132, 58];
      const blades = 5 + Math.floor(r() * 6), tall = 7 + r() * 9;
      ctx.lineWidth = 1.4;
      for (let b = 0; b < blades; b++) {
        ctx.strokeStyle = rgb(base, (r() - 0.5) * 40);
        const bx = fx + (r() - 0.5) * 7;
        ctx.beginPath(); ctx.moveTo(bx, fy); ctx.quadraticCurveTo(bx + (r() - 0.5) * 4, fy - tall * 0.6, bx + (r() - 0.5) * 8, fy - tall * (0.6 + r() * 0.5)); ctx.stroke();
      }
    } else if ((key === 'dirt' || key === 'stone' || key === 'sand') && v % 4 === 0) {
      for (let k = 0; k < 3; k++) {
        const fx = cx + (r() - 0.5) * 36, fy = cy + (r() - 0.5) * 16;
        ctx.fillStyle = rgb(key === 'sand' ? [150, 130, 96] : [120, 108, 92], (r() - 0.5) * 30);
        ctx.beginPath(); ctx.ellipse(fx, fy, 2 + r() * 2.5, 1.2 + r() * 1.4, 0, 0, TAU); ctx.fill();
      }
    }
  }

  isWallish(tx, ty) {
    const w = this.world;
    if (tx < 0 || ty < 0 || tx >= w.w || ty >= w.h) return false;
    const t = w.tiles[w.idx(tx, ty)];
    if (w.type === 'dungeon') return t === T.ROCK || t === T.WALL || t === T.SHELF || t === T.CORAL || t === T.CRYSTAL;
    return t === T.WALL || t === T.HOUSE || t === T.ICE;
  }
}
