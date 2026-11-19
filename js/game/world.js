// 월드 맵 (시드 고정 절차 생성 → 모든 접속에서 같은 지형)
//
// 240×240 타일을 48칸 격자 5×5 로 나눕니다.
//   가운데 칸 = 새싹 마을, 안쪽 고리 8칸 = 사냥터 1~8, 바깥 고리 12칸 = 사냥터 9~20, 네 모서리 = 호수/산
// 칸 경계를 따라 길이 나 있어 모든 사냥터가 이어집니다.
import { SPAWN_ZONES } from '../data/monsters.js';

export const TILE_SIZE = 32;
export const WORLD_VERSION = 2; // 맵 구조가 바뀌면 올림 → 예전 저장 위치는 마을로 초기화

export const T = {
  GRASS: 0, DIRT: 1, TREE: 2, WATER: 3, WALL: 4, FLOOR: 5,
  STONE: 6, ROCK: 7, FLOWER: 8, SAND: 9,
  SWAMP: 10, ASH: 11, DARKGRASS: 12, LAVA: 13, GRAVE: 14, DEADTREE: 15,
};

const SOLID = new Set([T.TREE, T.WATER, T.WALL, T.ROCK, T.LAVA, T.GRAVE, T.DEADTREE]);

const W = 240, CELL = 48;

// 초보자의 마을(새싹 마을) — 성벽 포함 범위, 안전지대
export const VILLAGE = { x0: 108, y0: 108, x1: 132, y1: 132, name: '새싹 마을' };

// 사냥터 칸 배치 (난이도 순서). 안쪽 고리는 동쪽부터 시계방향, 바깥 고리는 그 바깥을 이어서 시계방향
const INNER = [[3, 2], [3, 3], [2, 3], [1, 3], [1, 2], [1, 1], [2, 1], [3, 1]];
const OUTER = [[4, 1], [4, 2], [4, 3], [3, 4], [2, 4], [1, 4], [0, 3], [0, 2], [0, 1], [1, 0], [2, 0], [3, 0]];
const CORNERS = { '0,0': 'lake', '4,0': 'mountain', '0,4': 'mountain', '4,4': 'lake' };

const cellRect = (cx, cy, pad = 3) => ({ x0: cx * CELL + pad, y0: cy * CELL + pad, x1: (cx + 1) * CELL - pad, y1: (cy + 1) * CELL - pad });

// 사냥터 → 칸 (모듈을 불러올 때 한 번)
const CELL_BIOME = new Map();
[...INNER, ...OUTER].forEach(([cx, cy], i) => {
  const zone = SPAWN_ZONES[i];
  if (!zone) return;
  zone.rect = cellRect(cx, cy);
  zone.cell = { x: cx, y: cy };
  CELL_BIOME.set(`${cx},${cy}`, zone.biome);
});
for (const [k, b] of Object.entries(CORNERS)) CELL_BIOME.set(k, b);

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
};

// 길 위에 덮을 때: 물/용암 위는 다리(나무 바닥)
const roadTile = (t) => (t === T.WATER || t === T.LAVA ? T.FLOOR : T.DIRT);

export class World {
  constructor(seed = 20261118) {
    this.w = W;
    this.h = W;
    this.tiles = new Uint8Array(this.w * this.h);
    this.variant = new Uint8Array(this.w * this.h);
    this.rng = mulberry32(seed);
    this.noise = makeNoise(seed, 6);
    this.generate();
    this.spawn = { x: 120.5, y: 125.5 };
    this.npcs = [
      { id: 'npc_merchant', kind: 'merchant', name: '잡화상 브론', x: 113.5, y: 114.5, color: '#c98a3a' },
      { id: 'npc_smith', kind: 'smith', name: '대장장이 고른', x: 127.5, y: 114.5, color: '#7a5a48' },
      { id: 'npc_healer', kind: 'healer', name: '치유사 엘린', x: 113.5, y: 126.5, color: '#e8e8f8' },
      { id: 'npc_guide', kind: 'guide', name: '안내원 토마', x: 123.5, y: 123.5, color: '#5aa0c8' },
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
    for (const g of [CELL, CELL * 2, CELL * 3, CELL * 4]) {
      road(g - 1, 2, g, h - 3);
      road(2, g - 1, w - 3, g);
    }
    road(119, 2, 121, h - 3);
    road(2, 119, w - 3, 121);

    // 마을: 성벽 + 바닥 + 성문
    for (let y = V.y0; y <= V.y1; y++) {
      for (let x = V.x0; x <= V.x1; x++) {
        const edge = x === V.x0 || x === V.x1 || y === V.y0 || y === V.y1;
        this.set(x, y, edge ? T.WALL : T.FLOOR);
      }
    }
    for (let d = 119; d <= 121; d++) {
      this.set(d, V.y0, T.DIRT); this.set(d, V.y1, T.DIRT);
      this.set(V.x0, d, T.DIRT); this.set(V.x1, d, T.DIRT);
    }
    // 마을 중앙 광장 길 + 분수 + 장식 나무
    road(112, 119, 128, 121);
    road(119, 112, 121, 128);
    this.set(120, 118, T.WATER);
    for (const [x, y] of [[110, 110], [130, 110], [110, 130], [130, 130], [117, 110], [123, 110]]) this.set(x, y, T.TREE);

    // 월드 외곽 나무 울타리
    for (let i = 0; i < w; i++) {
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
    const stack = [this.idx(120, 125)];
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
    const FILL = { swamp: T.WATER, lake: T.WATER, harbor: T.WATER, volcano: T.LAVA, forge: T.LAVA, darkforest: T.DEADTREE, forest: T.TREE, lumber: T.TREE, meadow: T.TREE };
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
