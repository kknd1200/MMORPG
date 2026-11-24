import { rebirthDrops } from './rebirth-items.js';
// 몬스터 · 사냥터 정의
//
// 몬스터 원본(이름 · 등급 · 공격방식 · 스킬 · 패시브 · 그림)은 rebirth-roster.js (「환생 루프」 300종)
// 여기서는 배치되는 맵(필드 · 던전 층)의 레벨에 맞춰 실시간 사냥용 수치(HP · 공격력 ...)를 계산합니다.
// 어느 맵에 어떤 몬스터가 나오는지는 maps.js 가 정합니다.
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
import { monsterBase } from '../systems/balance.js';

// 지역 테마 → 지형 (world.js 의 BIOMES)
export const THEME_BIOME = {
  '이끼 덮인 숲': 'forest', '고블린 야영지': 'camp', '해골 무덤': 'graveyard', '거미 굴': 'cave',
  '오크 요새': 'fortress', '리자드맨 습지': 'swamp', '트롤 동굴': 'cave', '그림자 숲': 'darkforest',
  '망각의 미궁': 'ruins', '용의 둥지': 'volcano',
  '쐐기 채석장': 'quarry', '침목 제재소': 'lumber', '검댕 대장간': 'forge', '쇠사슬 선창': 'harbor',
  '황동 투기장': 'arena', '깨진 종탑': 'ruins', '현무암 벼랑': 'quarry', '청철 제련소': 'forge',
  '뼈언덕 격전지': 'graveyard', '지맥의 심장': 'volcano',
  '솔바람 오솔길': 'forest', '갈대 비탈': 'reeds', '까치 지붕길': 'town', '모래 소용길': 'desert',
  '새벽 질풍교': 'bridge', '연무 부두': 'harbor', '달꽃 돌계단': 'garden', '소용돌이 수림': 'forest',
  '구름 정거장': 'highland', '별똥 사냥터': 'crater',
  '초승달 서고': 'library', '푸른 인장실': 'library', '유리 관측실': 'crystal', '허수의 회랑': 'void',
  '뇌우 공방': 'forge', '뿌리 연산림': 'lumber', '빙경 도서탑': 'snow', '공허 문장소': 'void',
  '성좌 연금당': 'crystal', '시간의 심문실': 'ruins',
  '이슬 온실': 'garden', '진주 샘길': 'springs', '자작 수피림': 'forest', '붉은 산호원': 'coral',
  '녹맥 치료당': 'garden', '진흙 용출지': 'swamp', '천근 방벽': 'fortress', '심해 기포굴': 'coral',
  '푸른 재생림': 'forest', '장수의 심층': 'darkforest',
};


// ---------------------------------------------------------------- 레벨 → 수치
// 같은 레벨 "평범한 플레이어" 기준으로 역산 (js/systems/balance.js 의 TARGET 에서 조정)
//   일반 몬스터: 약 3초에 처치, 1:1 로 맞기만 하면 약 30초 버팀, 레벨업까지 약 (5 + 0.6×레벨) 마리
export function baseStats(level) {
  return monsterBase(level);
}

// 등급 배율
// 네임드: 약 25초 처치, 혼자 맞으면 약 18초 / 보스: 약 60초 처치, 내려찍기까지 맞으면 약 10초 → 물약·회피 필요
export const RANK = {
  normal: { hp: 1, atk: 1, exp: 1, gold: 1, size: 1 },
  guard: { hp: 8, atk: 1.45, exp: 8, gold: 6, size: 1.15, respawn: 90 },
  boss: { hp: 19, atk: 1.75, exp: 20, gold: 15, size: 1.25, respawn: 180 },
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
  const d = [{item:'weapon_enchant_scroll',chance:.006*k},{item:'armor_enchant_scroll',chance:.01*k}];
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

function buildMonster(src, level, rankId) {
  const rank = RANK[rankId] || RANK.normal;
  const fam = FAMILY[src.family] || FAMILY.biped;
  const b = baseStats(level);
  const r = hash01(src.id);
  const ranged = src.style === 'ranged', magic = src.style === 'magic';
  const named = rankId !== 'normal';
  return {
    rosterId: src.id, name: src.name, rank: rankId, style: src.style, family: src.family,
    level,
    hp: Math.round(b.hp * rank.hp * (0.9 + r * 0.2)),
    atk: Math.max(2, Math.round(b.atk * rank.atk * (ranged || magic ? 0.85 : 1))),
    armor: Math.round(level * 0.18 * fam.armor),
    mr: Math.min(0.5, fam.mr + (magic ? 0.08 : 0)),
    eva: fam.eva,
    exp: Math.round(b.exp * rank.exp),
    gold: [Math.round(b.gold[0] * rank.gold), Math.round(b.gold[1] * rank.gold)],
    // Lv.5 미만 사냥터는 비선공, 이후는 대부분 선공. 네임드는 항상 선공
    aggressive: named || (level >= 5 && r > 0.25),
    social: !named && ['quadruped', 'biped', 'winged', 'spider'].includes(src.family) && r < 0.55,
    speed: fam.speed * (named ? 1.05 : 1),
    attackRange: ranged ? 5.5 : magic ? 4.5 : named ? 1.35 : 1.1,
    attackInterval: Math.round((1.15 + (src.interval - 3) * 0.2) * 100) / 100,
    projectile: ranged ? 'arrow' : magic ? 'bolt' : null,
    magic,
    skillCooldown: 6 + src.interval,
    active: src.active,
    passive: src.passive,
    boss: rankId === 'boss' ? { slam: { interval: 8, windup: 1.1, radius: 2.4, mult: 1.8 } } : null,
    size: Math.max(0.3, src.scale) * rank.size,
    color: src.color,
    art: src.art,
    drops: [...dropsFor(level, rankId, src.style), ...rebirthDrops(level, rankId)],
  };
}

export const MONSTERS = {};

/**
 * 맵에 배치할 몬스터를 등록하고 id 를 돌려줌. 같은 원본 몬스터도 맵마다 레벨이 달라서 따로 등록됩니다.
 * mapId: 맵 id, src: ROSTER 항목, level: 레벨, rank: 'normal' | 'guard' | 'boss' (생략 시 원본 등급)
 */
export function defineMonster(mapId, src, level, rank = src.rank) {
  const id = `${mapId}/${src.id}`;
  MONSTERS[id] = { id, ...buildMonster(src, level, rank) };
  return id;
}
