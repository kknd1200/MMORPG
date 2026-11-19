// 맵 생성 (맵마다 시드 고정 절차 생성 → 모든 접속에서 같은 지형)
//
// 맵 종류 (js/data/maps.js 의 정의를 받아 만듦)
//   village : 성벽으로 둘러싼 마을 + 동/서 출구. 맵 전체가 안전지대 (몬스터 없음)
//   field   : 지형 + 동/서를 잇는 길, 던전 입구, 필드 보스 터, 사냥 구역(격자)
//   dungeon : 방과 통로. 올라가는 계단(1층은 필드 입구로), 내려가는 계단, 마지막 층은 보스 방
// 포탈(portals)에 들어서면 다른 맵으로 이동, spots 는 도착 지점 이름표 (west/east/center/up/down/entrance:d1 ...)
import { MAPS } from '../data/maps.js';

export const TILE_SIZE = 32;
export const WORLD_VERSION = 5; // 맵 구조가 바뀌면 올림 → 예전 저장 위치는 시작 마을로 초기화

export const T = {
  GRASS: 0, DIRT: 1, TREE: 2, WATER: 3, WALL: 4, FLOOR: 5,
  STONE: 6, ROCK: 7, FLOWER: 8, SAND: 9,
  SWAMP: 10, ASH: 11, DARKGRASS: 12, LAVA: 13, GRAVE: 14, DEADTREE: 15,
  SNOW: 16, ICE: 17, CRYSTAL: 18, CORAL: 19, SHELF: 20, VOID: 21, CACTUS: 22,
  HOUSE: 23, // 건물이 차지한 땅 (그림은 props 의 집이 그림)
};

const SOLID = new Set([T.TREE, T.WATER, T.WALL, T.ROCK, T.LAVA, T.GRAVE, T.DEADTREE, T.ICE, T.CRYSTAL, T.CORAL, T.SHELF, T.CACTUS, T.HOUSE]);

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

// 던전 테마별 바닥/벽/장식
const PALETTES = {
  cave: { floor: [T.STONE, T.ASH], wall: T.ROCK, deco: T.ROCK, dark: 0.55 },
  mine: { floor: [T.DIRT, T.STONE], wall: T.ROCK, deco: T.ROCK, dark: 0.5 },
  coral: { floor: [T.SAND, T.STONE], wall: T.CORAL, deco: T.WATER, dark: 0.45 },
  tower: { floor: [T.FLOOR, T.STONE], wall: T.WALL, deco: T.ROCK, dark: 0.35 },
  library: { floor: [T.FLOOR], wall: T.SHELF, deco: T.SHELF, dark: 0.4 },
  volcano: { floor: [T.ASH, T.STONE], wall: T.ROCK, deco: T.LAVA, dark: 0.45 },
  void: { floor: [T.VOID], wall: T.CRYSTAL, deco: T.CRYSTAL, dark: 0.55 },
};

export class World {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.type = def.type;
    this.w = def.w;
    this.h = def.h;
    this.tiles = new Uint8Array(this.w * this.h);
    this.variant = new Uint8Array(this.w * this.h);
    this.rng = mulberry32(def.seed);
    this.noise = makeNoise(def.seed, 6);
    this.portals = [];
    this.npcs = [];
    this.zones = [];
    this.spots = {};
    this.props = []; // 집 · 분수처럼 여러 칸을 차지하는 큰 그림
    this.safe = def.type === 'village';
    this.dark = 0;
    for (let i = 0; i < this.w * this.h; i++) this.variant[i] = Math.floor(this.rng() * 256);
    if (def.type === 'village') this.genVillage();
    else if (def.type === 'field') this.genField();
    else this.genDungeon();
    this.spawn = this.spots.center;
    this.style = def.type === 'dungeon' ? def.palette : def.type === 'village' ? 'village' : def.biome;
    for (const n of this.npcs) { n.radius = 0.35; n.isNpc = true; }
    this.sealPockets();
    if (def.type === 'dungeon') this.markInterior();
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

  // ------------------------------------------------------------ 그리기 도구
  fillBiome(biome) {
    const f = BIOMES[biome] || BIOMES.meadow;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      this.tiles[this.idx(x, y)] = f(this.rng(), this.noise(x, y), x, y);
    }
    this.fillTile = FILL[biome] ?? T.ROCK;
  }

  rect(x0, y0, x1, y1, t) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, typeof t === 'function' ? t(x, y) : t);
  }

  road(x0, y0, x1, y1) { this.rect(x0, y0, x1, y1, (x, y) => roadTile(this.get(x, y))); }

  // 폭 3칸 ㄱ자 길
  roadLine(ax, ay, bx, by) {
    this.road(ax, ay - 1, bx, ay + 1);
    this.road(bx - 1, ay, bx + 1, by);
  }

  clearing(cx, cy, r, t = T.DIRT) {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (Math.hypot(x - cx, y - cy) <= r + 0.3) this.set(x, y, t);
    }
  }

  border(t, keep = () => false) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if ((x < 2 || y < 2 || x >= this.w - 2 || y >= this.h - 2) && !keep(x, y)) this.set(x, y, t);
    }
  }

  portal(kind, cx, cy, w, h, to, label) {
    const p = {
      id: `${kind}:${this.portals.length}`, kind, to, label,
      cx, cy, rect: { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 },
    };
    this.portals.push(p);
    return p;
  }

  // 동/서 출구: 맵 끝의 길 + 포탈 + 도착 지점
  edgeExits(cy) {
    const ex = this.def.exits;
    if (ex.west) {
      this.road(0, cy - 1, 6, cy + 1);
      this.portal('exit', 1, cy + 0.5, 2, 3, ex.west, `← ${MAPS[ex.west.map].name}`);
      this.spots.west = { x: 4.5, y: cy + 0.5 };
    }
    if (ex.east) {
      this.road(this.w - 7, cy - 1, this.w - 1, cy + 1);
      this.portal('exit', this.w - 1, cy + 0.5, 2, 3, ex.east, `${MAPS[ex.east.map].name} →`);
      this.spots.east = { x: this.w - 4.5, y: cy + 0.5 };
    }
  }

  // ------------------------------------------------------------ 마을
  genVillage() {
    const d = this.def;
    this.fillBiome(d.biome);
    const cy = Math.floor(this.h / 2), cx = Math.floor(this.w / 2);
    const town = { x0: 12, y0: 8, x1: this.w - 13, y1: this.h - 9 };
    this.town = town;
    // 마을 밖 둘레는 풀밭 위주로 (지형은 테마 색만)
    this.rect(town.x0 - 4, town.y0 - 4, town.x1 + 4, town.y1 + 4, (x, y) => (this.rng() < 0.08 ? T.FLOWER : T.GRASS));
    this.rect(town.x0, town.y0, town.x1, town.y1, (x, y) =>
      (x === town.x0 || x === town.x1 || y === town.y0 || y === town.y1 ? T.WALL : T.FLOOR));
    this.border(this.fillTile === T.WATER ? T.TREE : this.fillTile);
    if (d.exits.west) this.road(0, cy - 1, town.x0 + 2, cy + 1);
    if (d.exits.east) this.road(town.x1 - 2, cy - 1, this.w - 1, cy + 1);
    this.edgeExits(cy);
    // 광장 길 · 분수 · 나무
    this.road(town.x0 + 2, cy - 1, town.x1 - 2, cy + 1);
    this.road(cx - 1, town.y0 + 2, cx + 1, town.y1 - 2);
    this.rect(cx - 1, cy - 5, cx, cy - 4, T.WATER);
    this.props.push({ kind: 'fountain', x0: cx - 1, y0: cy - 5, w: 2, h: 2 });
    // 집 (성벽 안 네 구역, 길과 NPC 자리는 피함)
    const house = (x0, y0, w, h) => {
      this.rect(x0, y0, x0 + w - 1, y0 + h - 1, T.HOUSE);
      this.props.push({ kind: 'house', x0, y0, w, h, style: d.id, seed: x0 * 31 + y0 });
    };
    const ox = town.x0, oy = town.y0;
    house(ox + 8, oy + 2, 6, 5);
    house(ox + 21, oy + 2, 6, 5);
    house(ox + 8, oy + 25, 6, 5);
    house(ox + 22, oy + 23, 7, 5);
    house(ox + 28, oy + 30, 4, 3);
    house(ox + 2, oy + 10, 4, 4);
    house(ox + 30, oy + 10, 4, 4);
    // 꽃밭
    const bed = (x0, y0, x1, y1) => this.rect(x0, y0, x1, y1, (x, y) => (this.get(x, y) === T.FLOOR ? T.FLOWER : this.get(x, y)));
    bed(ox + 9, oy + 10, ox + 14, oy + 13);
    bed(ox + 21, oy + 9, ox + 26, oy + 11);
    bed(ox + 29, oy + 19, ox + 33, oy + 21);
    for (const [x, y] of [[town.x0 + 2, town.y0 + 2], [town.x1 - 2, town.y0 + 2], [town.x0 + 2, town.y1 - 2], [town.x1 - 2, town.y1 - 2]]) this.set(x, y, T.TREE);

    const npc = (kind, name, x, y, color) => this.npcs.push({ id: `npc_${kind}`, kind, name, x: x + 0.5, y: y + 0.5, color });
    const names = VILLAGE_NPC_NAMES[d.id] || VILLAGE_NPC_NAMES.v1;
    npc('merchant', names[0], town.x0 + 6, town.y0 + 6, '#c98a3a');
    npc('smith', names[1], town.x1 - 6, town.y0 + 6, '#7a5a48');
    npc('healer', names[2], town.x0 + 6, town.y1 - 6, '#e8e8f8');
    npc('teleporter', names[3], cx + 5, cy - 4, '#9a6ad8');
    npc('guide', names[4], cx - 5, cy + 4, '#5aa0c8');
    this.spots.center = { x: cx + 0.5, y: cy + 4.5 };
  }

  // ------------------------------------------------------------ 필드
  genField() {
    const d = this.def, rng = this.rng;
    this.fillBiome(d.biome);
    const cy = Math.floor(this.h / 2);
    // 동서를 잇는 구불구불한 큰길
    const xs = [0, 32, 64, 96, this.w - 1];
    const ys = xs.map((x, i) => (i === 0 || i === xs.length - 1 ? cy : 28 + Math.floor(rng() * (this.h - 56))));
    const lastX = d.exits.east ? this.w - 1 : this.w - 8;
    for (let i = 0; i < xs.length - 1; i++) {
      this.roadLine(xs[i], ys[i], Math.min(xs[i + 1], lastX), ys[i + 1]);
    }
    const roadY = (x) => ys[Math.min(ys.length - 1, Math.round(x / 32))];
    this.border(this.fillTile, (x, y) => Math.abs(y - cy) <= 1 && ((x < 2 && d.exits.west) || (x >= this.w - 2 && d.exits.east)));
    this.edgeExits(cy);
    this.spots.center = { x: 64.5, y: roadY(64) + 0.5 };

    // 던전 입구: 큰길에서 갈라지는 샛길 끝의 동굴
    d.entrances.forEach((did, j) => {
      const ex = 80 + j * 14;
      const ry = roadY(ex);
      const ey = ry > cy ? 14 : this.h - 16;
      this.roadLine(ex, ry, ex, ey + 4);
      this.clearing(ex, ey + 3, 5);
      this.rect(ex - 4, ey - 3, ex + 4, ey - 1, T.ROCK);
      this.rect(ex - 1, ey - 1, ex + 1, ey + 1, T.DIRT);
      const dun = MAPS[`${did}-1`];
      this.portal('cave', ex + 0.5, ey + 0.5, 3, 2, { map: dun.id, spot: 'up' }, `${dun.name.replace(' 지하 1층', '')} 입구`);
      this.spots[`entrance:${did}`] = { x: ex + 0.5, y: ey + 4.5 };
    });

    // 필드 보스 터: 입구 반대쪽 공터
    const bx = 34, by = roadY(bx) > cy ? 18 : this.h - 20;
    this.roadLine(bx, roadY(bx), bx, by);
    this.clearing(bx, by, 6);
    this.spots.boss = { x: bx + 0.5, y: by + 0.5 };

    // 사냥 구역: 32칸 격자 (출구 근처 10칸은 비워 둠)
    for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 4; gx++) {
      const r = { x0: Math.max(10, gx * 32 + 2), y0: gy * 32 + 3, x1: Math.min(this.w - 10, gx * 32 + 30), y1: gy * 32 + 29 };
      this.zones.push({ id: `z${gy}${gx}`, rect: r, monsters: d.monsters, max: 9 });
    }
  }

  // ------------------------------------------------------------ 던전
  genDungeon() {
    const d = this.def, rng = this.rng;
    const pal = PALETTES[d.palette] || PALETTES.cave;
    this.dark = pal.dark;
    this.fillTile = pal.wall;
    this.tiles.fill(pal.wall);
    const final = d.floorBoss?.final;
    const rooms = [{ x0: 4, y0: 4, x1: 16, y1: 14 }];
    if (final) rooms.push({ x0: this.w - 30, y0: this.h - 26, x1: this.w - 5, y1: this.h - 5, boss: true });
    const overlaps = (a) => rooms.some((b) => a.x0 - 3 <= b.x1 && b.x0 - 3 <= a.x1 && a.y0 - 3 <= b.y1 && b.y0 - 3 <= a.y1);
    for (let t = 0; t < 300 && rooms.length < 11; t++) {
      const rw = 9 + Math.floor(rng() * 7), rh = 8 + Math.floor(rng() * 6);
      const x0 = 3 + Math.floor(rng() * (this.w - rw - 6)), y0 = 3 + Math.floor(rng() * (this.h - rh - 6));
      const r = { x0, y0, x1: x0 + rw, y1: y0 + rh };
      if (!overlaps(r)) rooms.push(r);
    }
    const center = (r) => ({ x: Math.floor((r.x0 + r.x1) / 2), y: Math.floor((r.y0 + r.y1) / 2) });
    // 방 바닥 + 장식
    for (const r of rooms) {
      this.rect(r.x0, r.y0, r.x1, r.y1, () => pal.floor[Math.floor(rng() * pal.floor.length)]);
      for (let y = r.y0 + 2; y <= r.y1 - 2; y++) for (let x = r.x0 + 2; x <= r.x1 - 2; x++) {
        const c = center(r);
        if (Math.abs(x - c.x) > 2 && Math.abs(y - c.y) > 2 && rng() < 0.03) this.set(x, y, pal.deco);
      }
    }
    // 가까운 방끼리 차례로 통로 연결 (+ 고리 몇 개)
    const order = [rooms[0]];
    const left = rooms.slice(1);
    while (left.length) {
      const last = center(order[order.length - 1]);
      left.sort((a, b) => Math.hypot(center(a).x - last.x, center(a).y - last.y) - Math.hypot(center(b).x - last.x, center(b).y - last.y));
      order.push(left.shift());
    }
    const corridor = (a, b) => {
      const p = center(a), q = center(b);
      this.rect(p.x - 1, p.y - 1, q.x + 1, p.y + 1, () => pal.floor[0]);
      this.rect(q.x - 1, p.y - 1, q.x + 1, q.y + 1, () => pal.floor[0]);
    };
    for (let i = 1; i < order.length; i++) corridor(order[i - 1], order[i]);
    for (let i = 0; i + 3 < order.length; i += 3) corridor(order[i], order[i + 3]);

    // 계단
    const r0 = rooms[0];
    this.portal('up', r0.x0 + 3.5, r0.y0 + 2, 2, 2, d.up, d.floor === 1 ? '밖으로 나가기' : `지하 ${d.floor - 1}층으로`);
    this.spots.up = { x: r0.x0 + 3.5, y: r0.y0 + 4.5 };
    this.spots.center = this.spots.up;
    const far = rooms.slice(1).sort((a, b) => Math.hypot(center(b).x - 6, center(b).y - 6) - Math.hypot(center(a).x - 6, center(a).y - 6));
    const last = final ? rooms[1] : far[0];
    if (d.down) {
      const c = center(last);
      this.rect(c.x - 2, c.y - 2, c.x + 2, c.y + 3, pal.floor[0]);
      this.portal('down', c.x + 0.5, c.y + 0.5, 2, 2, d.down, `지하 ${d.floor + 1}층으로`);
      this.spots.down = { x: c.x + 0.5, y: c.y + 3 };
    }
    // 사냥 구역 = 첫 방을 뺀 모든 방. 층 네임드는 가운데쯤 방, 최종 보스는 보스 방
    const huntRooms = rooms.slice(1);
    const named = final ? rooms[1] : far[Math.floor(far.length / 2)];
    for (const r of huntRooms) {
      const rect = { x0: r.x0 + 1, y0: r.y0 + 1, x1: r.x1 - 1, y1: r.y1 - 1 };
      const area = (r.x1 - r.x0) * (r.y1 - r.y0);
      const zone = { id: `r${this.zones.length}`, rect, monsters: d.monsters, max: Math.max(3, Math.min(8, Math.round(area / 22))) };
      if (r === named) {
        const c = center(r);
        zone.boss = { ...d.floorBoss, rect: { x0: c.x - 1, y0: c.y - 1, x1: c.x + 2, y1: c.y + 2 } };
        if (final) { zone.max = 4; this.spots.boss = { x: c.x + 0.5, y: c.y + 0.5 }; }
      }
      this.zones.push(zone);
    }
    this.border(pal.wall);
  }

  // 도착 지점에서 걸어서 닿지 않는 빈 땅은 막힌 타일로 메움 (갈 수 없는 곳에 몬스터가 생기지 않게)
  sealPockets() {
    const { w, h } = this;
    const seen = new Uint8Array(w * h);
    const stack = [];
    const start = (p) => {
      if (!p) return;
      const i = this.idx(Math.floor(p.x), Math.floor(p.y));
      if (!seen[i]) { seen[i] = 1; stack.push(i); }
    };
    start(this.spots.center);
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
    this.reach = seen;
    let sealed = 0;
    for (let i = 0; i < w * h; i++) {
      if (seen[i] || SOLID.has(this.tiles[i])) continue;
      this.tiles[i] = this.fillTile ?? T.ROCK;
      sealed++;
    }
    this.sealedTiles = sealed;
  }

  // 던전: 사방 8칸이 모두 막힌 벽 속 칸 → 그리지 않고 어둠으로 (얇은 벽만 보이게)
  markInterior() {
    const { w, h } = this;
    this.interior = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!this.isSolidTile(x, y)) continue;
      let inside = true;
      for (let dy = -1; dy <= 1 && inside; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (!this.isSolidTile(nx, ny)) { inside = false; break; }
      }
      this.interior[this.idx(x, y)] = inside ? 1 : 0;
    }
  }

  reachable(p) { return !!this.reach?.[this.idx(Math.floor(p.x), Math.floor(p.y))]; }

  portalAt(x, y) {
    return this.portals.find((p) => x >= p.rect.x0 && x <= p.rect.x1 && y >= p.rect.y0 && y <= p.rect.y1) || null;
  }

  isSolidTile(tx, ty) { return SOLID.has(this.get(tx, ty)); }

  // 마을 맵은 전체가 안전지대
  inVillage() { return this.safe; }

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

// 마을별 NPC 이름: 잡화상, 대장장이, 치유사, 이동술사, 안내원
const VILLAGE_NPC_NAMES = {
  v1: ['잡화상 브론', '대장장이 고른', '치유사 엘린', '이동술사 세라', '안내원 토마'],
  v2: ['잡화상 미나', '대장장이 하겔', '치유사 로웬', '이동술사 키아', '안내원 바르'],
  v3: ['잡화상 페드로', '대장장이 오스카', '치유사 마리스', '이동술사 니엘', '안내원 해린'],
  v4: ['잡화상 두란', '대장장이 그라임', '치유사 소냐', '이동술사 베이', '안내원 카르'],
  v5: ['잡화상 엘사', '대장장이 브욘', '치유사 리브', '이동술사 오린', '안내원 시그'],
  v6: ['잡화상 아르노', '대장장이 텔론', '치유사 셀레네', '이동술사 이스카', '안내원 노아'],
};
