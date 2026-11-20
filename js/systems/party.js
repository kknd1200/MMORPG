// 파티 · 용병 데이터 (DOM 없음 → node 테스트 가능)
//
// 파티 = 내 대표 캐릭터 1명 + 마을 용병단장에게 골드로 고용한 용병 최대 3명.
// 용병도 캐릭터와 같은 데이터(레벨 · 경험치 · 스탯 · 장비 · 성장 주사위)를 가지고 따로 성장합니다.
// 전투는 자동: 파티원마다 스킬 칸 4개에 넣은 스킬을 앞칸부터, 조건이 맞고 재사용이 끝난 것을 씁니다.
import { CLASSES, STAT_KEYS, CREATION } from '../data/classes.js';
import { SKILLS } from '../data/skills.js';
import * as S from './stats.js';

export const MAX_MERCS = 3;
export const SKILL_SLOTS = 4;
export const MERC_CLASSES = ['knight', 'elf', 'mage', 'priest', 'warrior'];

const NAMES = [
  '카일', '리안', '세린', '도윤', '하람', '로웬', '미르', '테오', '아린', '바렌', '엘라', '가론', '시엘', '루카', '네아',
  '다린', '페이', '오른', '유나', '케인', '라헬', '보른', '이솔', '한결', '제나', '마르', '솔린', '타냐', '휴고', '벨라',
];

// 스킬 칸 조건
export const CONDITIONS = {
  always: '항상',
  hp50: '내 HP 50% 이하',
  ally50: '파티원 HP 50% 이하',
  enemies3: '주변 적 3마리 이상',
  boss: '보스 · 네임드에게만',
};

export function mercPrice(level) {
  return Math.max(100, Math.round((80 + level * level * 6 + level * 20) / 10) * 10);
}

function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * 용병단장이 보여줄 용병 목록 (마을 · 시간대마다 고정 → 1시간마다 새 얼굴)
 * level: 마을 레벨과 내 레벨 중 낮은 쪽
 */
export function mercOffers(villageId, level, hourKey, count = 4, takenNames = []) {
  const r = seeded(hashStr(`${villageId}:${hourKey}`));
  const out = [];
  const used = new Set(takenNames);
  for (let i = 0; i < count; i++) {
    const classId = MERC_CLASSES[Math.floor(r() * MERC_CLASSES.length)];
    const lv = Math.max(1, level + Math.floor(r() * 3) - 1);
    out.push({
      offerId: `${villageId}:${hourKey}:${i}`,
      classId,
      name: pickName(r, used),
      level: lv,
      price: mercPrice(lv),
    });
  }
  return out;
}

// 겹치지 않는 이름 (이미 파티에 있는 이름 · 같은 목록 안의 이름 제외)
function pickName(r, used) {
  let name = NAMES[Math.floor(r() * NAMES.length)];
  for (let k = 0; used.has(name) && k < NAMES.length; k++) name = NAMES[(NAMES.indexOf(name) + 1) % NAMES.length];
  used.add(name);
  return name;
}

// 생성 보너스 포인트: 주스탯 먼저(최대 18), 남으면 체력
function autoAllocate(classId) {
  const cls = CLASSES[classId];
  const stats = { ...cls.baseStats };
  let left = CREATION.bonusPoints;
  for (const k of [cls.primaryStat, 'con', ...STAT_KEYS]) {
    while (left > 0 && stats[k] < CREATION.maxStat) { stats[k]++; left--; }
  }
  return stats;
}

export function learnedSkills(char) {
  return CLASSES[char.classId].skills.filter((id) => SKILLS[id].level <= char.level)
    .sort((a, b) => SKILLS[a].level - SKILLS[b].level);
}

// 스킬 종류에 맞는 기본 조건
export function defaultCondition(sk) {
  if (sk.kind === 'heal') return 'ally50';
  if (sk.kind === 'restore') return 'always';
  if (sk.kind === 'aoe') return 'enemies3';
  return 'always';
}

/** 배운 스킬로 스킬 칸 채우기 (빈 칸만). 높은 레벨 스킬을 앞에 */
export function fillSlots(char) {
  if (!Array.isArray(char.skillSlots)) char.skillSlots = [];
  while (char.skillSlots.length < SKILL_SLOTS) char.skillSlots.push(null);
  const used = new Set(char.skillSlots.filter(Boolean).map((s) => s.id));
  const learned = learnedSkills(char).reverse();
  for (let i = 0; i < SKILL_SLOTS; i++) {
    if (char.skillSlots[i]) continue;
    const id = learned.find((x) => !used.has(x));
    if (!id) break;
    used.add(id);
    char.skillSlots[i] = { id, cond: defaultCondition(SKILLS[id]) };
  }
  return char.skillSlots;
}

/** 용병 고용: 캐릭터와 같은 방식으로 만들고, 고용 레벨까지 성장 주사위를 굴림 (용병도 축·저주가 갈림) */
export function createMerc(offer, id, rng = Math.random) {
  const cls = CLASSES[offer.classId];
  const char = S.createCharacter({ id, name: offer.name, classId: offer.classId, stats: autoAllocate(offer.classId) });
  char.isMerc = true;
  char.inventory = [];
  char.gold = 0;
  char.hotbar = [];
  for (let lv = 1; lv < offer.level; lv++) S.levelUp(char, rng);
  // 용병은 보너스 포인트를 주스탯에 자동으로 (나중에 파티 창에서 직접 올릴 수도 있음)
  while (char.bonusPoints > 0 && S.allocatePoint(char, cls.primaryStat));
  char.hp = char.maxHp; char.mp = char.maxMp;
  char.skillSlots = [];
  fillSlots(char);
  return char;
}

/** 조건 확인: u = 쓰는 파티원, ctx = { units, enemiesNear(target), target } */
export function condOk(cond, u, ctx) {
  const ch = u.char;
  switch (cond) {
    case 'hp50': return ch.hp <= ch.maxHp * 0.5;
    case 'ally50': return ctx.units.some((o) => !o.ent.dead && o.char.hp <= o.char.maxHp * 0.5);
    case 'enemies3': return (ctx.enemiesNear ?? 0) >= 3;
    case 'boss': return !!ctx.target?.isBoss;
    default: return true;
  }
}

/** 경험치 나누기: 혼자면 전부, 여럿이면 (1.2 / 인원) 씩 */
export function shareExp(exp, n) {
  return n <= 1 ? exp : Math.max(1, Math.round((exp * 1.2) / n));
}
