// 월드 맵 (시드 고정 절차 생성 → 모든 접속에서 같은 지형)
//
// 48칸 격자 COLS × ROWS (8 × 7 = 384 × 336 타일).
//   마을 칸을 중심으로 가까운 고리부터(같은 고리 안에서는 동쪽부터 시계방향) 사냥터를 난이도 순으로 배치합니다.
//   사냥터가 차지하지 않은 칸은 호수/산.
// 칸 경계를 따라 길이 나 있어 모든 사냥터가 이어집니다.
import { SPAWN_ZONES } from '../data/monsters.js';

export const TILE_SIZE = 32;
export const WORLD_VERSION = 3; // 맵 구조가 바뀌면 올림 → 예전 저장 위치는 마을로 초기화

export const T = {
  GRASS: 0, DIRT: 1, TREE: 2, WATER: 3, WALL: 4, FLOOR: 5,
  STONE: 6, ROCK: 7, FLOWER: 8, SAND: 9,
  SWAMP: 10, ASH: 11, DARKGRASS: 12, LAVA: 13, GRAVE: 14, DEADTREE: 15,
  SNOW: 16, ICE: 17, CRYSTAL: 18, CORAL: 19, SHELF: 20, VOID: 21, CACTUS: 22,
};

const SOLID = new Set([T.TREE, T.WATER, T.WALL, T.ROCK, T.LAVA, T.GRAVE, T.DEADTREE, T.ICE, T.CRYSTAL, T.CORAL, T.SHELF, T.CACTUS]);

const CELL = 48, COLS = 8, ROWS = 7;
const VCELL = { x: 3, y: 3 }; // 마을 칸
const OX = VCELL.x * CELL, OY = VCELL.y * CELL; // 마을 칸의 왼쪽 위
const at = (dx, dy) => [OX + dx, OY + dy]; // 마을 칸 기준 좌표
const VC = { x: OX + 24, y: OY + 24 }; // 마을 중심 타일

// 초보자의 마을(새싹 마을) — 성벽 포함 범위, 안전지대
export const VILLAGE = { x0: OX + 12, y0: OY + 12, x1: OX + 36, y1: OY + 36, name: '새싹 마을' };

const cellRect = (cx, cy, pad = 3) => ({ x0: cx * CELL + pad, y0: cy * CELL + pad, x1: (cx + 1) * CELL - pad, y1: (cy + 1) * CELL - pad });

// 칸 순서: 마을과의 거리(고리) → 동쪽부터 시계방향
export const CELL_ORDER = (() => {
  const cells = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (x === VCELL.x && y === VCELL.y) continue;
    const dx = x - VCELL.x, dy = y - VCELL.y;
    let ang = Math.atan2(dy, dx); if (ang < -1e-9) ang += Math.PI * 2;
    cells.push({ x, y, ring: Math.max(Math.abs(dx), Math.abs(dy)), ang });
  }
  return cells.sort((a, b) => a.ring - b.ring || a.ang - b.ang);
})();

// 사냥터 → 칸 (모듈을 불러올 때 한 번)
const CELL_BIOME = new Map();
CELL_ORDER.forEach(({ x, y }, i) => {
  const zone = SPAWN_ZONES[i];
  if (!zone) { CELL_BIOME.set(`${x},${y}`, (x + y) % 2 ? 'lake' : 'mountain'); return; }
  zone.rect = cellRect(x, y);
  zone.cell = { x, y };
  CELL_BIOME.set(`${x},${y}`, zone.biome);
});

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 부드러운 값 노이즈 (0~1): 연못·용암·숲 덩어리 모양
function makeNoise(seed, scale) {
  const lat = (x, y) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / scale, fy = y / scale;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = sm(fx - ix), ty = sm(fy - iy);
    const a = lat(ix, iy), b = lat(ix + 1, iy), c = lat(ix, iy + 1), d = lat(ix + 1, iy + 1);
    return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
  };
}

// 지형 종류별 타일 고르기. r = 타일마다 난수, n = 덩어리 노이즈, x/y = 타일 좌표
const BIOMES = {
  meadow: (r, n) => (r < 0.04 ? T.TREE : r < 0.09 ? T.FLOWER : T.GRASS),
  forest: (r, n) => (n > 0.74 ? T.TREE : r < 0.07 ? T.TREE : r < 0.12 ? T.FLOWER : T.GRASS),
  lumber: (r, n) => (n > 0.72 ? T.TREE : n < 0.3 ? T.DIRT : r < 0.05 ? T.TREE : T.GRASS),
  camp: (r, n) => (r < 0.02 ? T.ROCK : r < 0.035 ? T.TREE : n < 0.5 ? T.DIRT : T.GRASS),
  graveyard: (r, n, x, y) => (x % 4 === 0 && y % 3 === 0 && r < 0.55 ? T.GRAVE : r < 0.025 ? T.DEADTREE : n < 0.35 ? T.DIRT : T.DARKGRASS),
  cave: (r, n) => (n > 0.7 ? T.ROCK : r < 0.04 ? T.ROCK : n < 0.3 ? T.STONE : T.ASH),
  fortress: (r, n, x, y) => ((x % 12 === 0 || y % 12 === 0) && (x + y) % 12 > 5 ? T.WALL : r < 0.015 ? T.ROCK : n < 0.4 ? T.DIRT : T.STONE),
  swamp: (r, n) => (n > 0.66 ? T.WATER : r < 0.05 ? T.TREE : n < 0.25 ? T.GRASS : T.SWAMP),
  darkforest: (r, n) => (n > 0.7 ? T.DEADTREE : r < 0.1 ? T.DEADTREE : T.DARKGRASS),
  ruins: (r, n, x, y) => (x % 6 === 0 && y % 5 === 0 && r < 0.7 ? T.ROCK : r < 0.015 ? T.WALL : n > 0.72 ? T.FLOOR : T.STONE),
  volcano: (r, n) => (n > 0.7 ? T.LAVA : r < 0.04 ? T.ROCK : n < 0.3 ? T.STONE : T.ASH),
  forge: (r, n) => (n > 0.75 ? T.LAVA : r < 0.025 ? T.WALL : n < 0.28 ? T.STONE : T.ASH),
  quarry: (r, n) => (r < 0.1 ? T.ROCK : n > 0.72 ? T.ROCK : n < 0.38 ? T.DIRT : T.STONE),
  harbor: (r, n, x) => (n > 0.6 ? (x % 9 < 2 ? T.FLOOR : T.WATER) : r < 0.02 ? T.ROCK : T.SAND),
  arena: (r, n) => (r < 0.012 ? T.ROCK : n > 0.7 ? T.DIRT : T.SAND),
  lake: (r, n) => (n > 0.4 ? T.WATER : n > 0.32 ? T.SAND : r < 0.06 ? T.TREE : T.GRASS),
  mountain: (r, n) => (n > 0.48 ? T.ROCK : r < 0.08 ? T.ROCK : T.STONE),
  // ---- 민첩 · 지능 · 체력 던전 지역
  reeds: (r, n) => (n > 0.7 ? T.WATER : n > 0.56 ? T.SWAMP : r < 0.04 ? T.FLOWER : T.GRASS),
  town: (r, n, x, y) => (x % 11 < 6 && y % 9 < 4 ? T.WALL : r < 0.025 ? T.TREE : n < 0.45 ? T.FLOOR : T.DIRT),
  desert: (r, n) => (n > 0.76 ? T.ROCK : r < 0.02 ? T.CACTUS : n < 0.25 ? T.DIRT : T.SAND),
  bridge: (r, n, x, y) => (n > 0.45 ? (x % 8 < 2 || y % 8 < 2 ? T.FLOOR : T.WATER) : n > 0.4 ? T.SAND : T.GRASS),
  garden: (r, n, x, y) => (n > 0.76 ? T.WATER : r < 0.03 ? T.TREE : x % 7 === 0 && y % 7 === 0 ? T.STONE : r < 0.22 ? T.FLOWER : T.GRASS),
  highland: (r, n) => (n > 0.7 ? T.ROCK : r < 0.03 ? T.TREE : n < 0.35 ? T.STONE : T.GRASS),
  crater: (r, n) => (n > 0.82 ? T.ROCK : n > 0.7 ? T.ASH : r < 0.015 ? T.CRYSTAL : n < 0.3 ? T.DIRT : T.GRASS),
  library: (r, n, x, y) => (y % 5 === 0 && x % 9 > 1 ? T.SHELF : r < 0.01 ? T.ROCK : T.FLOOR),
  crystal: (r, n) => (n > 0.72 ? T.CRYSTAL : r < 0.03 ? T.CRYSTAL : n < 0.35 ? T.FLOOR : T.STONE),
  snow: (r, n) => (n > 0.7 ? T.ICE : r < 0.04 ? T.TREE : n < 0.2 ? T.STONE : T.SNOW),
  void: (r, n) => (n > 0.72 ? T.CRYSTAL : r < 0.02 ? T.WALL : T.VOID),
  springs: (r, n) => (n > 0.6 ? T.WATER : n > 0.53 ? T.SAND : r < 0.06 ? T.FLOWER : r < 0.09 ? T.TREE : T.GRASS),
  coral: (r, n) => (n > 0.62 ? T.WATER : r < 0.06 ? T.CORAL : n < 0.25 ? T.STONE : T.SAND),
};

// 메울 때 쓰는 지형별 막힌 타일
const FILL = {
  swamp: T.WATER, lake: T.WATER, harbor: T.WATER, reeds: T.WATER, bridge: T.WATER, springs: T.WATER, coral: T.WATER,
  volcano: T.LAVA, forge: T.LAVA, darkforest: T.DEADTREE, forest: T.TREE, lumber: T.TREE, meadow: T.TREE, garden: T.TREE,
  snow: T.ICE, crystal: T.CRYSTAL, void: T.CRYSTAL, library: T.SHELF, town: T.WALL, desert: T.CACTUS,
};

// 길 위에 덮을 때: 물/용암 위는 다리(나무 바닥)
const roadTile = (t) => (t === T.WATER || t === T.LAVA ? T.FLOOR : T.DIRT);

export class World {
  constructor(seed = 20261118) {
    this.w = COLS * CELL;
    this.h = ROWS * CELL;
    this.tiles = new Uint8Array(this.w * this.h);
    this.variant = new Uint8Array(this.w * this.h);
    this.rng = mulberry32(seed);
    this.noise = makeNoise(seed, 6);
    this.spawn = { x: VC.x + 0.5, y: VC.y + 5.5 };
    this.generate();
    const npc = (id, kind, name, dx, dy, color) => ({ id, kind, name, x: OX + dx + 0.5, y: OY + dy + 0.5, color });
    this.npcs = [
      npc('npc_merchant', 'merchant', '잡화상 브론', 17, 18, '#c98a3a'),
      npc('npc_smith', 'smith', '대장장이 고른', 31, 18, '#7a5a48'),
      npc('npc_healer', 'healer', '치유사 엘린', 17, 30, '#e8e8f8'),
      npc('npc_guide', 'guide', '안내원 토마', 27, 27, '#5aa0c8'),
    ];
    for (const n of this.npcs) { n.radius = 0.35; n.isNpc = true; }
  }

  idx(x, y) { return y * this.w + x; }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return T.WALL;
    return this.tiles[this.idx(x, y)];
  }
  set(x, y, t) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.tiles[this.idx(x, y)] = t;
  }

  biomeAt(x, y) {
    return CELL_BIOME.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`) || 'meadow';
  }

  generate() {
    const { w, h, rng, noise } = this;
    const V = VILLAGE;
    const nearVillage = (x, y) => x >= V.x0 - 3 && x <= V.x1 + 3 && y >= V.y0 - 3 && y <= V.y1 + 3;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = this.idx(x, y);
        this.variant[i] = Math.floor(rng() * 256);
        const r = rng();
        if (nearVillage(x, y)) { this.tiles[i] = T.GRASS; continue; }
        this.tiles[i] = BIOMES[this.biomeAt(x, y)](r, noise(x, y), x, y);
      }
    }

    // 격자 길: 칸 경계마다 2칸 폭 + 마을 성문에서 이어지는 십자길
    const road = (x0, y0, x1, y1) => {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, roadTile(this.get(x, y)));
    };
    for (let c = 1; c < COLS; c++) road(c * CELL - 1, 2, c * CELL, h - 3);
    for (let c = 1; c < ROWS; c++) road(2, c * CELL - 1, w - 3, c * CELL);
    road(VC.x - 1, 2, VC.x + 1, h - 3);
    road(2, VC.y - 1, w - 3, VC.y + 1);

    // 마을: 성벽 + 바닥 + 성문
    for (let y = V.y0; y <= V.y1; y++) {
      for (let x = V.x0; x <= V.x1; x++) {
        const edge = x === V.x0 || x === V.x1 || y === V.y0 || y === V.y1;
        this.set(x, y, edge ? T.WALL : T.FLOOR);
      }
    }
    for (let d = -1; d <= 1; d++) {
      this.set(VC.x + d, V.y0, T.DIRT); this.set(VC.x + d, V.y1, T.DIRT);
      this.set(V.x0, VC.y + d, T.DIRT); this.set(V.x1, VC.y + d, T.DIRT);
    }
    // 마을 중앙 광장 길 + 분수 + 장식 나무
    road(...at(16, 23), ...at(32, 25));
    road(...at(23, 16), ...at(25, 32));
    this.set(...at(24, 22), T.WATER);
    for (const [dx, dy] of [[14, 14], [34, 14], [14, 34], [34, 34], [21, 14], [27, 14]]) this.set(...at(dx, dy), T.TREE);

    // 월드 외곽 나무 울타리
    for (let i = 0; i < Math.max(w, h); i++) {
      for (let k = 0; k < 2; k++) {
        this.set(i, k, T.TREE); this.set(i, h - 1 - k, T.TREE);
        this.set(k, i, T.TREE); this.set(w - 1 - k, i, T.TREE);
      }
    }
    this.sealPockets();
  }

  // 마을에서 걸어서 닿지 않는 빈 땅은 주변 지형으로 메움 (갈 수 없는 곳에 몬스터가 생기지 않게)
  sealPockets() {
    const { w, h } = this;
    const seen = new Uint8Array(w * h);
    const stack = [this.idx(Math.floor(this.spawn.x), Math.floor(this.spawn.y))];
    seen[stack[0]] = 1;
    while (stack.length) {
      const i = stack.pop();
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = this.idx(nx, ny);
        if (seen[j] || SOLID.has(this.tiles[j])) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    let sealed = 0;
    for (let i = 0; i < w * h; i++) {
      if (seen[i] || SOLID.has(this.tiles[i])) continue;
      this.tiles[i] = FILL[this.biomeAt(i % w, (i / w) | 0)] ?? T.ROCK;
      sealed++;
    }
    this.sealedTiles = sealed;
  }

  isSolidTile(tx, ty) { return SOLID.has(this.get(tx, ty)); }

  inVillage(x, y) {
    return x >= VILLAGE.x0 && x < VILLAGE.x1 + 1 && y >= VILLAGE.y0 && y < VILLAGE.y1 + 1;
  }

  // 반지름 r 인 원(사각 근사)이 막혀있는지
  blocked(x, y, r = 0.3, forMonster = false) {
    const pts = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]];
    for (const [px, py] of pts) {
      if (this.isSolidTile(Math.floor(px), Math.floor(py))) return true;
      if (forMonster && this.inVillage(px, py)) return true;
    }
    return false;
  }

  // A* 길찾기 (8방향, 모서리 끼임 방지). 타일 중심 좌표 배열을 반환, 실패 시 null
  findPath(sx, sy, gx, gy, maxNodes = 4000) {
    const w = this.w;
    const s = { x: Math.floor(sx), y: Math.floor(sy) };
    let g = { x: Math.floor(gx), y: Math.floor(gy) };
    if (this.isSolidTile(g.x, g.y)) {
      // 막힌 곳을 클릭하면 가장 가까운 열린 타일로
      let best = null, bd = Infinity;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = g.x + dx, y = g.y + dy;
        const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
        if (!this.isSolidTile(x, y) && d < bd) { bd = d; best = { x, y }; }
      }
      if (!best) return null;
      g = best;
    }
    if (s.x === g.x && s.y === g.y) return [];
    const key = (x, y) => y * w + x;
    const h = (x, y) => { const dx = Math.abs(x - g.x), dy = Math.abs(y - g.y); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const gScore = new Map([[key(s.x, s.y), 0]]);
    const came = new Map();
    const closed = new Set();
    const heap = [[h(s.x, s.y), s.x, s.y]];
    const push = (n) => {
      heap.push(n);
      let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top;
    };
    let expanded = 0;
    while (heap.length && expanded < maxNodes) {
      const [, x, y] = pop();
      const k = key(x, y);
      if (closed.has(k)) continue;
      closed.add(k);
      expanded++;
      if (x === g.x && y === g.y) {
        const path = [];
        let c = k;
        while (c !== key(s.x, s.y)) { path.push({ x: (c % w) + 0.5, y: Math.floor(c / w) + 0.5 }); c = came.get(c); }
        return path.reverse();
      }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (this.isSolidTile(nx, ny)) continue;
        if (dx && dy && (this.isSolidTile(x + dx, y) || this.isSolidTile(x, y + dy))) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        const ng = gScore.get(k) + (dx && dy ? 1.414 : 1);
        if (ng < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, ng);
          came.set(nk, k);
          push([ng + h(nx, ny), nx, ny]);
        }
      }
    }
    return null;
  }

  findOpenTileIn(rect, rng = Math.random, tries = 30) {
    for (let i = 0; i < tries; i++) {
      const x = rect.x0 + Math.floor(rng() * (rect.x1 - rect.x0)) + 0.5;
      const y = rect.y0 + Math.floor(rng() * (rect.y1 - rect.y0)) + 0.5;
      if (!this.blocked(x, y, 0.4, true)) return { x, y };
    }
    return null;
  }
}
