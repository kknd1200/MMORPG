// 월드 구성: 중앙 성도 + 마을 6 · 필드 10 · 던전 7개 × 7층.
// 성도에서 동서남북의 마을과 사냥터로 갈라지는 대륙. 기존 지역 ID와 전투 진행은 유지.
import { ROSTER } from './rebirth-roster.js';
import { defineMonster, THEME_BIOME, RANK } from './monsters.js';

const region = (key) => {
  const [d, t] = key.split('-');
  const mobs = ROSTER.filter((m) => m.dungeon === d && m.tier === Number(t)).sort((a, b) => a.art.row - b.art.row);
  if (mobs.length !== 6) throw new Error(`${key}: 몬스터 6종이 아님`);
  return { key, theme: mobs[0].theme, normals: mobs.filter((m) => m.rank === 'normal'), named: mobs.find((m) => m.rank !== 'normal') };
};

// ---------------------------------------------------------------- 마을
export const VILLAGES = [
  { id: 'capital', name: '새벽 성도', level: 1, biome: 'meadow', capital: true, desc: '네 지역으로 향하는 길이 만나는 왕국의 중심 도시' },
  { id: 'v1', name: '새싹 마을', level: 1, biome: 'meadow', desc: '모험이 시작되는 초보자의 마을' },
  { id: 'v2', name: '바람골 마을', level: 10, biome: 'highland', desc: '언덕 위 풍차 마을' },
  { id: 'v3', name: '은물결 항구', level: 26, biome: 'springs', desc: '배와 상인이 모이는 항구 도시' },
  { id: 'v4', name: '붉은바위 요새', level: 43, biome: 'quarry', desc: '협곡을 지키는 요새 마을' },
  { id: 'v5', name: '서리꽃 마을', level: 61, biome: 'snow', desc: '눈 덮인 북방의 마을' },
  { id: 'v6', name: '별무리 성채', level: 71, biome: 'snow', desc: '북쪽 설원의 끝을 지키는 성채' },
];

// ---------------------------------------------------------------- 필드
// level: 일반 몬스터 최저 레벨(일반 몬스터는 level ~ level+3), region: 원본 지역, 네임드 = 필드 보스
// 필드 보스는 매시 offset 분에 나타나 BOSS_SCHEDULE.stay 분 동안 머묾 (필드마다 시간이 다름)
export const FIELDS = [
  { id: 'f1', region: 'gear-01', level: 1, bossOffset: 0 },
  { id: 'f2', region: 'agi-01', level: 5, bossOffset: 6 },
  { id: 'f3', region: 'agi-02', level: 12, bossOffset: 12 },
  { id: 'f4', region: 'vit-03', level: 20, bossOffset: 18, name: '붉은 협곡', biome: 'quarry' },
  { id: 'f5', region: 'agi-04', level: 28, bossOffset: 24 },
  { id: 'f6', region: 'gear-06', level: 36, bossOffset: 30 },
  { id: 'f7', region: 'str-07', level: 45, bossOffset: 36 },
  { id: 'f8', region: 'gear-08', level: 54, bossOffset: 42, name: '그림자 화산림', biome: 'volcano' },
  { id: 'f9', region: 'agi-09', level: 63, bossOffset: 48, name: '서리바람 고개', biome: 'snow' },
  { id: 'f10', region: 'agi-10', level: 72, bossOffset: 54, name: '별빛 얼음벌판', biome: 'snow' },
];

export const BOSS_SCHEDULE = { every: 60, stay: 20 }; // 분

// ---------------------------------------------------------------- 던전 (7층, 마지막 층 = boss 지역의 보스)
export const DUNGEON_FLOORS = 7;
export const DUNGEONS = [
  { id: 'd1', name: '검은 바위 굴', field: 'f2', levels: [10, 22], palette: 'cave', regions: ['gear-02', 'gear-03', 'gear-04'], boss: 'gear-05' },
  { id: 'd2', name: '쇠망치 광산', field: 'f4', levels: [20, 32], palette: 'mine', regions: ['str-01', 'str-02', 'str-03', 'str-04'], boss: 'str-05' },
  { id: 'd3', name: '물안개 해저굴', field: 'f5', levels: [30, 42], palette: 'coral', regions: ['vit-01', 'vit-02', 'vit-04', 'vit-06'], boss: 'vit-05' },
  { id: 'd4', name: '바람의 탑', field: 'f6', levels: [40, 54], palette: 'tower', regions: ['agi-03', 'agi-06', 'agi-07', 'agi-08'], boss: 'agi-05' },
  { id: 'd5', name: '현자의 대서고', field: 'f7', levels: [52, 66], palette: 'library', regions: ['int-01', 'int-02', 'int-03', 'int-04', 'int-06'], boss: 'int-05' },
  { id: 'd6', name: '용암 심연', field: 'f8', levels: [64, 80], palette: 'volcano', regions: ['gear-07', 'gear-09', 'str-06', 'str-08', 'str-09', 'str-10'], boss: 'gear-10' },
  { id: 'd7', name: '시간의 끝', field: 'f10', levels: [80, 96], palette: 'void', regions: ['int-07', 'int-08', 'int-09', 'vit-07', 'vit-08', 'vit-09', 'vit-10'], boss: 'int-10' },
];

export const DUNGEON_BOSS_RESPAWN = 600; // 초 (던전 최종 보스)
export const FLOOR_NAMED_RESPAWN = RANK.guard.respawn;

// 실제 왕복 출구: [출발, 출발 지점 방향, 도착]
export const WORLD_ROUTES = [
  ['capital', 'west', 'f1'], ['f1', 'west', 'v1'], ['v1', 'north', 'f2'], ['f2', 'north', 'v2'], ['v1', 'south', 'f4'],
  ['capital', 'south', 'f3'], ['f3', 'south', 'v3'], ['v3', 'east', 'f5'], ['f5', 'south', 'f6'],
  ['capital', 'east', 'f7'], ['f7', 'east', 'v4'], ['v4', 'north', 'f8'],
  ['capital', 'north', 'f9'], ['f9', 'north', 'v5'], ['v5', 'east', 'v6'], ['v6', 'east', 'f10'],
];
export const START_MAP = 'v1';

export const MAPS = {};

// ---------------------------------------------------------------- 맵 정의 만들기
const SIZE = { village: [50, 46], field: [64, 48], dungeon: [44, 44] };
let seed = 7001;

function base(id, type, name, extra) {
  const [w, h] = SIZE[type];
  MAPS[id] = { id, type, name, w, h, seed: seed++, exits: {}, entrances: [], ...extra };
  return MAPS[id];
}

for (const v of VILLAGES) base(v.id, 'village', v.name, { level: [v.level, v.level], biome: v.biome, desc: v.desc, village: v.id, capital: !!v.capital });

FIELDS.forEach((f, i) => {
  const r = region(f.region);
  const lv = f.level;
  const id = f.id;
  const mobs = r.normals.map((m, k) => [defineMonster(id, m, lv + (k % 4)), 1 / r.normals.length]);
  const boss = defineMonster(id, r.named, lv + 6, 'boss');
  base(id, 'field', f.name || r.theme, {
    index: i + 1, level: [lv, lv + 3], biome: f.biome || THEME_BIOME[r.theme] || 'forest',
    monsters: mobs, fieldBoss: { type: boss, offset: f.bossOffset },
  });
});

// 던전 층별 구성: 지역 몬스터를 깊이 순으로 늘어놓고, 층마다 몇 종씩 겹치며 내려감
for (const d of DUNGEONS) {
  const regs = d.regions.map(region);
  const bossReg = region(d.boss);
  const pool = [...regs.flatMap((r) => r.normals), ...bossReg.normals];
  const named = regs.map((r) => r.named);
  const k = Math.max(5, Math.ceil(pool.length / DUNGEON_FLOORS));
  const [lo, hi] = d.levels;
  d.floorIds = [];
  for (let f = 0; f < DUNGEON_FLOORS; f++) {
    const id = `${d.id}-${f + 1}`;
    const lv = Math.round(lo + ((hi - lo) * f) / (DUNGEON_FLOORS - 1));
    const start = Math.round((f * (pool.length - k)) / (DUNGEON_FLOORS - 1));
    const kinds = pool.slice(start, start + k);
    const mobs = kinds.map((m, i) => [defineMonster(id, m, lv + (i % 3)), 1 / kinds.length]);
    const last = f === DUNGEON_FLOORS - 1;
    const boss = last
      ? defineMonster(id, bossReg.named, Math.min(99, hi + 4), 'boss')
      : defineMonster(id, named[Math.round((f * (named.length - 1)) / (DUNGEON_FLOORS - 2))], lv + 4, 'guard');
    base(id, 'dungeon', `${d.name} 지하 ${f + 1}층`, {
      dungeon: d.id, floor: f + 1, level: [lv, lv + 2], palette: d.palette, monsters: mobs,
      floorBoss: { type: boss, final: last, respawn: last ? DUNGEON_BOSS_RESPAWN : FLOOR_NAMED_RESPAWN },
    });
    d.floorIds.push(id);
  }
}

const OPPOSITE = {north:'south',south:'north',east:'west',west:'east'};
for (const [from, direction, to] of WORLD_ROUTES) {
  if (MAPS[from].exits[direction] || MAPS[to].exits[OPPOSITE[direction]]) throw new Error(`Duplicate exit ${from}:${direction} / ${to}`);
  MAPS[from].exits[direction] = {map:to,spot:OPPOSITE[direction]};
  MAPS[to].exits[OPPOSITE[direction]] = {map:from,spot:direction};
}

// 던전 계단 / 입구
for (const d of DUNGEONS) {
  MAPS[d.field].entrances.push(d.id);
  d.floorIds.forEach((id, f) => {
    const m = MAPS[id];
    m.up = f === 0 ? { map: d.field, spot: `entrance:${d.id}` } : { map: d.floorIds[f - 1], spot: 'down' };
    m.down = f < DUNGEON_FLOORS - 1 ? { map: d.floorIds[f + 1], spot: 'up' } : null;
    m.exitToEntrance = { map: d.field, spot: `entrance:${d.id}` };
  });
}

// 실제 출구 그래프에서 가장 가까운 마을 (귀환 주문서 · 사망 시 부활 위치).
function nearestVillage(id) {
  const queue = [id], seen = new Set(queue);
  for (let i=0;i<queue.length;i++) {
    const m = MAPS[queue[i]];
    if (m.type === 'village') return m.id;
    for (const e of Object.values(m.exits)) if (!seen.has(e.map)) { seen.add(e.map); queue.push(e.map); }
  }
  return START_MAP;
}
for (const m of Object.values(MAPS)) {
  const anchor = m.type === 'dungeon' ? DUNGEONS.find((d) => d.id === m.dungeon).field : m.id;
  m.home = m.type === 'village' ? m.id : nearestVillage(anchor);
}

// ---------------------------------------------------------------- 필드 보스 시간표 (실제 시계 기준)
/** now(ms) 기준 이번 출현 시간대. active = 지금 머무는 중, start = 이번(또는 가장 최근) 출현 시각, next = 다음 출현 시각 */
export function bossWindow(offsetMin, now = Date.now()) {
  const per = BOSS_SCHEDULE.every * 60000;
  const off = offsetMin * 60000;
  const start = Math.floor((now - off) / per) * per + off;
  const end = start + BOSS_SCHEDULE.stay * 60000;
  return { start, end, next: start + per, active: now >= start && now < end };
}

export function formatClock(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- 이동술사
// 마을 · 필드는 그 맵으로, 던전은 입구가 있는 필드의 입구 앞까지만
export function teleportCost(kind, level) {
  const raw = kind === 'dungeon' ? 60 + level * 6 : kind === 'village' ? 20 + level * 3 : 20 + level * 4;
  return Math.max(20, Math.round(raw / 10) * 10);
}

export function teleportDestinations() {
  const out = [];
  for (const v of VILLAGES) out.push({ kind: 'village', id: v.id, map: v.id, spot: 'center', name: v.name, level: v.level, cost: teleportCost('village', v.level) });
  for (const f of FIELDS) {
    const m = MAPS[f.id];
    out.push({ kind: 'field', id: f.id, map: f.id, spot: 'center', name: m.name, level: m.level[0], levelText: `Lv.${m.level[0]}~${m.level[1]}`, cost: teleportCost('field', m.level[0]) });
  }
  for (const d of DUNGEONS) {
    out.push({
      kind: 'dungeon', id: d.id, map: d.field, spot: `entrance:${d.id}`, name: `${d.name} 입구`,
      level: d.levels[0], levelText: `Lv.${d.levels[0]}~${d.levels[1]}`, where: MAPS[d.field].name,
      cost: teleportCost('dungeon', d.levels[0]),
    });
  }
  return out;
}

export function mapTitle(m) {
  if (m.type === 'village') return `${m.name} (안전지대)`;
  return `${m.name} (Lv.${m.level[0]}~${m.level[1]})`;
}
