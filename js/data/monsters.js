// 몬스터 · 사냥터 정의
//
// 몬스터 원본(이름 · 등급 · 공격방식 · 스킬 · 패시브 · 그림)은 rebirth-roster.js (「환생 루프」 300종)
// 여기서는 그중 필드에 배치할 지역을 고르고, 실시간 사냥에 맞는 수치(레벨 · HP · 공격력 ...)를 계산합니다.
//
// 몬스터 필드
//   level, hp, atk, armor(물리 피해 감소 = 값/2), mr(마법 저항 비율), eva(회피)
//   exp, gold[min,max], aggressive(선공), social(무리), speed(타일/초)
//   attackRange, attackInterval(초), projectile('arrow'|'bolt'), magic(방어력 절반만 적용)
//   rank: 'normal' | 'guard'(네임드) | 'boss'   — guard/boss 는 사냥터마다 한 마리, 처치 후 일정 시간 뒤 재등장
//   active[]: 스킬 { name, effect(slow|bleed|burn|poison|expose), mult, pulses }
//   passive[]: { kind(fury|haste|mend|focus|hide), value }
//   art: 스프라이트 시트 정보, size: 그림 크기 배율, color: 대표색
import { ROSTER } from './rebirth-roster.js';

// ---------------------------------------------------------------- 필드 사냥터 (지역 20곳 = 몬스터 120종)
// 순서 = 난이도 순. 마을에서 가까운 안쪽 고리 8곳 → 바깥 고리 12곳
export const FIELD_REGIONS = [
  'gear-01', 'str-01', 'gear-02', 'str-02', 'gear-03', 'str-03', 'gear-04', 'str-04',
  'gear-05', 'str-05', 'gear-06', 'str-06', 'gear-07', 'str-07', 'gear-08', 'str-08',
  'gear-09', 'str-09', 'gear-10', 'str-10',
];

// 지역 테마 → 지형 (world.js 의 BIOMES)
export const THEME_BIOME = {
  '이끼 덮인 숲': 'forest', '고블린 야영지': 'camp', '해골 무덤': 'graveyard', '거미 굴': 'cave',
  '오크 요새': 'fortress', '리자드맨 습지': 'swamp', '트롤 동굴': 'cave', '그림자 숲': 'darkforest',
  '망각의 미궁': 'ruins', '용의 둥지': 'volcano',
  '쐐기 채석장': 'quarry', '침목 제재소': 'lumber', '검댕 대장간': 'forge', '쇠사슬 선창': 'harbor',
  '황동 투기장': 'arena', '깨진 종탑': 'ruins', '현무암 벼랑': 'quarry', '청철 제련소': 'forge',
  '뼈언덕 격전지': 'graveyard', '지맥의 심장': 'volcano',
};

export const LEVEL_STEP = 3; // 사냥터마다 레벨 +3 → 20곳이면 Lv.1 ~ 61

// ---------------------------------------------------------------- 레벨 → 수치 공식
// 기준(일반 몬스터): Lv.1 HP 23 / 공격 3, Lv.10 HP 110 / 공격 15, Lv.30 HP 338 / 공격 42, Lv.60 HP 770 / 공격 88
export function baseStats(level) {
  return {
    hp: Math.round(14 + 9 * level + 0.06 * level * level),
    atk: Math.round(2 + 1.3 * level + 0.003 * level * level),
    exp: Math.round(4 + 3 * level + 0.35 * level * level),
    gold: [Math.max(1, Math.round(level * 0.8)), Math.round(3 + level * 2.2)],
  };
}

// 등급 배율
export const RANK = {
  normal: { hp: 1, atk: 1, exp: 1, gold: 1, size: 1 },
  guard: { hp: 4.5, atk: 1.35, exp: 6, gold: 5, size: 1.15, respawn: 90 },
  boss: { hp: 9, atk: 1.6, exp: 14, gold: 12, size: 1.25, respawn: 180 },
};

// 체형별 성향 (이동속도, 방어, 마법저항, 회피)
const FAMILY = {
  slime: { speed: 1.6, armor: 0.5, mr: 0.05, eva: 0 },
  quadruped: { speed: 3.0, armor: 0.8, mr: 0, eva: 0.06 },
  spider: { speed: 3.0, armor: 0.8, mr: 0.05, eva: 0.1 },
  winged: { speed: 3.2, armor: 0.5, mr: 0.05, eva: 0.14 },
  biped: { speed: 2.5, armor: 1.0, mr: 0.06, eva: 0.05 },
  spirit: { speed: 2.3, armor: 0.3, mr: 0.28, eva: 0.16 },
  construct: { speed: 1.9, armor: 1.8, mr: 0.12, eva: 0 },
  dragon: { speed: 2.8, armor: 1.4, mr: 0.2, eva: 0.05 },
  plant: { speed: 1.4, armor: 0.9, mr: 0.1, eva: 0 },
  shell: { speed: 1.7, armor: 1.9, mr: 0.08, eva: 0 },
  aquatic: { speed: 2.2, armor: 0.7, mr: 0.1, eva: 0.08 },
  serpent: { speed: 2.6, armor: 0.7, mr: 0.08, eva: 0.12 },
};

// 레벨대별 드롭 (기존 아이템 사용)
function dropsFor(level, rank, style) {
  const named = rank !== 'normal';
  const k = named ? 3 : 1;
  const d = [];
  if (level < 25) d.push({ item: 'red_potion', chance: 0.12 * k });
  if (level >= 10) d.push({ item: 'orange_potion', chance: (level >= 25 ? 0.12 : 0.06) * k });
  d.push({ item: 'blue_potion', chance: (style === 'magic' ? 0.14 : 0.07) * k });
  if (level >= 5) d.push({ item: 'return_scroll', chance: 0.03 * k });
  if (level >= 12) d.push({ item: 'courage_potion', chance: (named ? 0.3 : 0.02) });
  const gear = (ids, c) => ids.forEach((item) => d.push({ item, chance: c }));
  if (level >= 4 && level < 30) gear(['long_sword', 'long_bow', 'oak_staff', 'iron_mace'], named ? 0.05 : 0.006);
  if (level >= 4 && level < 25) d.push({ item: 'leather_armor', chance: named ? 0.06 : 0.008 });
  if (level >= 12) d.push({ item: 'chain_mail', chance: named ? 0.06 : 0.006 });
  if (level >= 20) gear(['steel_blade', 'elven_bow', 'arcane_staff', 'holy_mace'], named ? 0.07 : 0.003);
  return d;
}

// 문자열 → 0~1 고정 난수 (같은 몬스터는 항상 같은 성향)
function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

function buildMonster(src, zoneIndex) {
  const rank = RANK[src.rank] || RANK.normal;
  const fam = FAMILY[src.family] || FAMILY.biped;
  const slot = src.art.row; // 0~4 일반, 5 네임드
  const minLv = 1 + zoneIndex * LEVEL_STEP;
  const level = src.rank === 'normal' ? minLv + (slot % 3) : minLv + LEVEL_STEP + 1;
  const b = baseStats(level);
  const r = hash01(src.id);
  const ranged = src.style === 'ranged', magic = src.style === 'magic';
  const named = src.rank !== 'normal';
  return {
    id: src.id, name: src.name, rank: src.rank, style: src.style, family: src.family,
    level,
    hp: Math.round(b.hp * rank.hp * (0.9 + r * 0.2)),
    atk: Math.max(2, Math.round(b.atk * rank.atk * (ranged || magic ? 0.85 : 1))),
    armor: Math.round(level * 0.18 * fam.armor),
    mr: Math.min(0.5, fam.mr + (magic ? 0.08 : 0)),
    eva: fam.eva,
    exp: Math.round(b.exp * rank.exp),
    gold: [Math.round(b.gold[0] * rank.gold), Math.round(b.gold[1] * rank.gold)],
    // 첫 사냥터는 비선공, 이후는 대부분 선공. 네임드는 항상 선공
    aggressive: named || (zoneIndex > 0 && r > 0.25),
    social: !named && ['quadruped', 'biped', 'winged', 'spider'].includes(src.family) && r < 0.55,
    speed: fam.speed * (named ? 1.05 : 1),
    attackRange: ranged ? 5.5 : magic ? 4.5 : named ? 1.35 : 1.1,
    attackInterval: Math.round((1.15 + (src.interval - 3) * 0.2) * 100) / 100,
    projectile: ranged ? 'arrow' : magic ? 'bolt' : null,
    magic,
    skillCooldown: 6 + src.interval,
    active: src.active,
    passive: src.passive,
    boss: src.rank === 'boss' ? { slam: { interval: 8, windup: 1.1, radius: 2.4, mult: 1.8 } } : null,
    size: Math.max(0.3, src.scale) * rank.size,
    color: src.color,
    art: src.art,
    zoneIndex,
    drops: dropsFor(level, src.rank, src.style),
  };
}

export const MONSTERS = {};
export const SPAWN_ZONES = [];

FIELD_REGIONS.forEach((key, zi) => {
  const [dungeon, n] = key.split('-');
  const mobs = ROSTER.filter((m) => m.dungeon === dungeon && m.tier === Number(n)).sort((a, b) => a.art.row - b.art.row);
  if (mobs.length !== 6) throw new Error(`${key}: 몬스터 6종이 아님`);
  for (const m of mobs) MONSTERS[m.id] = buildMonster(m, zi);
  const normals = mobs.filter((m) => m.rank === 'normal');
  const named = mobs.find((m) => m.rank !== 'normal');
  const minLv = 1 + zi * LEVEL_STEP;
  SPAWN_ZONES.push({
    id: key,
    index: zi,
    theme: mobs[0].theme,
    biome: THEME_BIOME[mobs[0].theme] || 'forest',
    name: `${mobs[0].theme} (Lv.${minLv}~${minLv + LEVEL_STEP + 1})`,
    minLevel: minLv,
    rect: null, // world.js 가 맵을 만들며 채움
    monsters: normals.map((m) => [m.id, 1 / normals.length]),
    max: 15,
    boss: named ? { type: named.id, respawn: (RANK[named.rank] || RANK.guard).respawn } : null,
  });
});
