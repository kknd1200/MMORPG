// 월드 맵 (시드 고정 절차 생성 → 모든 접속에서 같은 지형)
export const TILE_SIZE = 32;

export const T = {
  GRASS: 0, DIRT: 1, TREE: 2, WATER: 3, WALL: 4, FLOOR: 5,
  STONE: 6, ROCK: 7, FLOWER: 8, SAND: 9,
};

const SOLID = new Set([T.TREE, T.WATER, T.WALL, T.ROCK]);

// 초보자의 마을(새싹 마을) — 성벽 포함 범위, 안전지대
export const VILLAGE = { x0: 48, y0: 48, x1: 72, y1: 72, name: '새싹 마을' };

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class World {
  constructor(seed = 20261118) {
    this.w = 120;
    this.h = 120;
    this.tiles = new Uint8Array(this.w * this.h);
    this.variant = new Uint8Array(this.w * this.h);
    this.rng = mulberry32(seed);
    this.generate();
    this.spawn = { x: 60.5, y: 65.5 };
    this.npcs = [
      { id: 'npc_merchant', kind: 'merchant', name: '잡화상 브론', x: 53.5, y: 54.5, color: '#c98a3a' },
      { id: 'npc_smith', kind: 'smith', name: '대장장이 고른', x: 67.5, y: 54.5, color: '#7a5a48' },
      { id: 'npc_healer', kind: 'healer', name: '치유사 엘린', x: 53.5, y: 66.5, color: '#e8e8f8' },
      { id: 'npc_guide', kind: 'guide', name: '안내원 토마', x: 63.5, y: 63.5, color: '#5aa0c8' },
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

  generate() {
    const { w, h, rng } = this;
    for (let i = 0; i < w * h; i++) { this.tiles[i] = T.GRASS; this.variant[i] = Math.floor(rng() * 256); }

    const inVillageRect = (x, y) => x >= VILLAGE.x0 - 2 && x <= VILLAGE.x1 + 2 && y >= VILLAGE.y0 - 2 && y <= VILLAGE.y1 + 2;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (inVillageRect(x, y)) continue;
        const r = rng();
        // 서쪽 호수
        const ld = Math.hypot(x - 20, y - 62);
        if (ld < 13) { this.set(x, y, T.WATER); continue; }
        if (ld < 15.5) { this.set(x, y, T.SAND); continue; }
        // 북쪽 폐허
        if (y <= 42 && x >= 28 && x <= 96) {
          this.set(x, y, T.STONE);
          if ((x % 6 === 0 && y % 5 === 0 && r < 0.7) || r < 0.025) this.set(x, y, T.ROCK);
          continue;
        }
        // 남쪽 숲
        if (y >= 76) { if (r < 0.16) this.set(x, y, T.TREE); continue; }
        // 동쪽 초원
        if (x > 74) {
          if (r < 0.06) this.set(x, y, T.FLOWER);
          else if (r < 0.08) this.set(x, y, T.TREE);
          continue;
        }
        if (r < 0.04) this.set(x, y, T.TREE);
        else if (r < 0.07) this.set(x, y, T.FLOWER);
      }
    }

    // 마을 밖으로 이어지는 길
    const path = (x0, y0, x1, y1) => {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
          if (this.get(x, y) !== T.WATER) this.set(x, y, T.DIRT);
    };
    path(59, 8, 61, 47);    // 북
    path(59, 73, 61, 112);  // 남
    path(73, 59, 112, 61);  // 동
    path(34, 59, 47, 61);   // 서

    // 마을: 성벽 + 바닥 + 성문
    for (let y = VILLAGE.y0; y <= VILLAGE.y1; y++) {
      for (let x = VILLAGE.x0; x <= VILLAGE.x1; x++) {
        const edge = x === VILLAGE.x0 || x === VILLAGE.x1 || y === VILLAGE.y0 || y === VILLAGE.y1;
        this.set(x, y, edge ? T.WALL : T.FLOOR);
      }
    }
    for (let d = 59; d <= 61; d++) {
      this.set(d, VILLAGE.y0, T.DIRT); this.set(d, VILLAGE.y1, T.DIRT);
      this.set(VILLAGE.x0, d, T.DIRT); this.set(VILLAGE.x1, d, T.DIRT);
    }
    // 마을 중앙 광장 길 + 분수
    path(52, 59, 68, 61);
    path(59, 52, 61, 68);
    this.set(60, 58, T.WATER);
    // 마을 장식 나무
    for (const [x, y] of [[50, 50], [70, 50], [50, 70], [70, 70], [57, 50], [63, 50]]) this.set(x, y, T.TREE);

    // 월드 외곽 나무 울타리
    for (let i = 0; i < w; i++) {
      for (let k = 0; k < 2; k++) {
        this.set(i, k, T.TREE); this.set(i, h - 1 - k, T.TREE);
        this.set(k, i, T.TREE); this.set(w - 1 - k, i, T.TREE);
      }
    }
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
