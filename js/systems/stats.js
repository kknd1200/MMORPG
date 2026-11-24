import { equipmentTotals, equipmentBonuses } from '../data/equipment.js';
// 캐릭터 성장 / 전투 공식 (DOM 의존성 없음 → node 테스트 가능)
import {
  CLASSES, STAT_KEYS, STAT_NAMES, CREATION, STAT_CAP, MAX_LEVEL,
} from '../data/classes.js';
import { ITEMS } from '../data/items.js';
import { SKILLS } from '../data/skills.js';

// 직업의 첫 스킬 (가장 낮은 레벨)
export function firstSkillId(classId) {
  return [...CLASSES[classId].skills].sort((a, b) => SKILLS[a].level - SKILLS[b].level)[0];
}

export const randInt = (min, max, rng = Math.random) => min + Math.floor(rng() * (max - min + 1));
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------- 생성

export function allocationSpent(classId, stats) {
  const base = CLASSES[classId].baseStats;
  return STAT_KEYS.reduce((sum, k) => sum + (stats[k] - base[k]), 0);
}

export function validateAllocation(classId, stats) {
  const cls = CLASSES[classId];
  if (!cls) return { ok: false, error: '존재하지 않는 직업입니다.' };
  for (const k of STAT_KEYS) {
    const v = stats?.[k];
    if (!Number.isInteger(v)) return { ok: false, error: '잘못된 스탯 값입니다.' };
    if (v < cls.baseStats[k]) return { ok: false, error: `${STAT_NAMES[k]}은(는) 기본값보다 낮출 수 없습니다.` };
    if (v > CREATION.maxStat) return { ok: false, error: `생성 시 스탯은 ${CREATION.maxStat}을 넘을 수 없습니다.` };
  }
  const spent = allocationSpent(classId, stats);
  if (spent !== CREATION.bonusPoints) {
    return { ok: false, error: `보너스 포인트를 모두 사용해야 합니다. (${spent}/${CREATION.bonusPoints})` };
  }
  return { ok: true };
}

export function createCharacter({ id, name, classId, stats }) {
  const check = validateAllocation(classId, stats);
  if (!check.ok) throw new Error(check.error);
  const cls = CLASSES[classId];
  return {
    version: 1,
    id,
    name,
    classId,
    level: 1,
    exp: 0,
    stats: { ...stats },
    bonusPoints: 0,
    maxHp: cls.start.hp,
    maxMp: cls.start.mp,
    hp: cls.start.hp,
    mp: cls.start.mp,
    // 축/저주 판정용 주사위 기록 (체력 보너스는 제외한 순수 운)
    growth: { count: 0, hpRollSum: 0, mpRollSum: 0, history: [] },
    gold: 100,
    inventory: [
      { id: 'red_potion', qty: 10 },
      { id: 'blue_potion', qty: 3 },
      { id: 'return_scroll', qty: 2 },
    ],
    equipment: { ...cls.startEquipment },
    hotbar: [
      { type: 'skill', id: firstSkillId(classId) },
      { type: 'item', id: 'red_potion' },
      { type: 'item', id: 'blue_potion' },
      null, null, null, null,
      { type: 'item', id: 'return_scroll' },
    ],
    pos: null,
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------- 성장

export function expToNext(level) {
  return Math.floor(15 * level * level + 10 * level);
}

// 10레벨마다 1포인트, 50레벨 이후로는 레벨업마다 1포인트
export function bonusPointsForLevel(level) {
  if (level > 50) return 1;
  return level % 10 === 0 ? 1 : 0;
}

export function nextBonusLevel(level) {
  if (level >= 50) return level + 1;
  return (Math.floor(level / 10) + 1) * 10;
}

// 체력 스탯에 따른 레벨업 HP 추가량
export function conHpBonus(con) {
  return Math.max(0, Math.floor((con - 10) / 2));
}

export function levelUp(char, rng = Math.random) {
  const cls = CLASSES[char.classId];
  const [hMin, hMax] = cls.growth.hp;
  const [mMin, mMax] = cls.growth.mp;
  const hpRoll = randInt(hMin, hMax, rng);
  const mpRoll = randInt(mMin, mMax, rng);
  const conBonus = conHpBonus(char.stats.con);
  const hpGain = hpRoll + conBonus;
  const mpGain = mpRoll;

  char.level += 1;
  char.maxHp += hpGain;
  char.maxMp += mpGain;
  char.hp = Math.min(char.maxHp, char.hp + hpGain);
  char.mp = Math.min(char.maxMp, char.mp + mpGain);
  const bonus = bonusPointsForLevel(char.level);
  char.bonusPoints += bonus;

  const g = char.growth;
  g.count += 1;
  g.hpRollSum += hpRoll;
  g.mpRollSum += mpRoll;
  g.history.push({ level: char.level, hpRoll, mpRoll, conBonus });
  if (g.history.length > 100) g.history.shift();

  return { level: char.level, hpRoll, mpRoll, conBonus, hpGain, mpGain, bonus };
}

export function gainExp(char, amount, rng = Math.random) {
  const results = [];
  if (char.level >= MAX_LEVEL) return results;
  char.exp += amount;
  while (char.level < MAX_LEVEL && char.exp >= expToNext(char.level)) {
    char.exp -= expToNext(char.level);
    results.push(levelUp(char, rng));
  }
  if (char.level >= MAX_LEVEL) char.exp = 0;
  return results;
}

export function allocatePoint(char, stat) {
  if (!STAT_KEYS.includes(stat)) return false;
  if (char.bonusPoints <= 0 || char.stats[stat] >= STAT_CAP) return false;
  char.stats[stat] += 1;
  char.bonusPoints -= 1;
  return true;
}

// 사망 시 현재 레벨 필요 경험치의 5% 손실 (레벨 다운 없음)
export function deathPenalty(char) {
  const loss = Math.min(char.exp, Math.floor(expToNext(char.level) * 0.05));
  char.exp -= loss;
  return loss;
}

// ---------------------------------------------------------------- 축캐 / 저주캐 판정
// 레벨업 주사위 합이 기대값에서 표준편차 몇 배만큼 벗어났는지(z) 로 판정.

const GRADES = [
  { min: 1.5, id: 'blessed', label: '축복받은 캐릭터', short: '축캐' },
  { min: 0.5, id: 'good', label: '우수한 성장', short: '우수' },
  { min: -0.5, id: 'normal', label: '평범한 성장', short: '평범' },
  { min: -1.5, id: 'bad', label: '불운한 성장', short: '불운' },
  { min: -Infinity, id: 'cursed', label: '저주받은 캐릭터', short: '저주캐' },
];

function rollStats(sum, n, [a, b]) {
  const expected = (n * (a + b)) / 2;
  const variance = ((b - a + 1) ** 2 - 1) / 12;
  const z = n > 0 ? (sum - expected) / Math.sqrt(n * variance) : 0;
  return { sum, expected, diff: sum - expected, z };
}

export function luckGrade(char) {
  const cls = CLASSES[char.classId];
  const g = char.growth;
  const hp = rollStats(g.hpRollSum, g.count, cls.growth.hp);
  const mp = rollStats(g.mpRollSum, g.count, cls.growth.mp);
  // HP 60%, MP 40% 가중 후 표준화
  const z = (hp.z * 0.6 + mp.z * 0.4) / Math.sqrt(0.6 ** 2 + 0.4 ** 2);
  if (g.count < 3) {
    return { id: 'pending', label: '판정 중 (레벨업 3회 이후)', short: '판정중', z, hp, mp, n: g.count };
  }
  const grade = GRADES.find((gr) => z >= gr.min);
  return { ...grade, z, hp, mp, n: g.count };
}

// ---------------------------------------------------------------- 전투 수치

export function sumBuffs(buffs, key) {
  return (buffs || []).reduce((s, b) => s + (b[key] || 0), 0);
}

// 레벨 보너스: 일반공격력은 직업별 attackGrowth × (레벨-1), 방어력은 (레벨-1)/4
export function levelAttack(char) {
  return Math.floor((char.level - 1) * (CLASSES[char.classId].attackGrowth || 0));
}
export function levelDefense(char) {
  return Math.floor((char.level - 1) / 4);
}

// 일반공격력 = 직업 기본 + 레벨 보너스 + 무기 + 버프
export function attackBreakdown(char, buffs = []) {
  const base = CLASSES[char.classId].baseAttack;
  const level = levelAttack(char);
  const weapon = equipmentTotals(char).atk;
  const buff = sumBuffs(buffs, 'atk');
  return { base, level, weapon, buff, total: (base + level + weapon + buff) * (1 + Math.min(2,itemModifiers(char,buffs).atkPct || 0)) };
}

export function attackPower(char, buffs = []) {
  return attackBreakdown(char, buffs).total;
}

// 방어력 = 체력/3 + 레벨 보너스 + 방어구 + 버프
export function defense(char, buffs = []) {
  const armor = equipmentTotals(char).def;
  return Math.floor(char.stats.con / 3) + levelDefense(char) + armor + sumBuffs(buffs, 'def');
}

export function moveSpeed(buffs = []) {
  return 4 * (1 + sumBuffs(buffs, 'speed'));
}

// 물리 명중: 주스탯(힘/민첩) 기준
export function physicalHitChance(stat, level, target) {
  return clamp(0.7 + (stat - 10) * 0.02 + (level - target.level) * 0.02 - (target.eva || 0), 0.05, 0.95);
}

// 마법 명중: 지능 기준
export function magicHitChance(int, level, target) {
  return clamp(0.8 + (int - 10) * 0.02 + (level - target.level) * 0.02 - (target.mr || 0) * 0.5, 0.05, 0.98);
}

// All player attacks use the class primary stat; apply equipment accuracy exactly once.
export function playerHitChance(char, target, buffs=[], element=null) {
  const cls=CLASSES[char.classId], stat=char.stats[cls.primaryStat];
  const opponent={...target,level:target.level ?? char.level};
  const magic=(element || (cls.primaryStat==='int'?'magic':'physical'))==='magic';
  const base=magic ? magicHitChance(stat,char.level,opponent) : physicalHitChance(stat,char.level,opponent);
  return clamp(base+(itemModifiers(char,buffs).accPct || 0),.05,.98);
}

export function normalDamage(atk, targetArmor, rng = Math.random) {
  const raw = atk * (0.9 + rng() * 0.2);
  return physicalMitigate(raw, targetArmor);
}

// 스킬 피해 = 주스탯 × 일반공격력 × 스킬계수 (±10%)
export function skillDamage(stat, atk, coef, rng = Math.random) {
  return stat * atk * coef * (0.9 + rng() * 0.2);
}

export function physicalMitigate(raw, armor) {
  return Math.max(1, Math.round(raw - (armor || 0) / 2));
}

export function magicMitigate(raw, mr) {
  return Math.max(1, Math.round(raw * (1 - (mr || 0))));
}

export function monsterHitChance(monsterLevel, playerLevel, playerDef) {
  return clamp(0.75 + (monsterLevel - playerLevel) * 0.03 - playerDef * 0.01, 0.1, 0.95);
}

export function monsterDamage(atk, playerDef, rng = Math.random) {
  const raw = atk * (0.8 + rng() * 0.2);
  return Math.max(1, Math.round(raw - playerDef / 2));
}

export function regenAmounts(char) {
  const lv = Math.floor(char.level / 10);
  return {
    hp: 1 + Math.floor(char.stats.con / 6) + lv,
    mp: 1 + Math.floor(char.stats.int / 6) + lv,
  };
}

export function derivedStats(char, buffs = []) {
  const cls = CLASSES[char.classId];
  const same = { level: char.level, eva: 0, mr: 0 };
  return {
    attack: attackPower(char, buffs),
    attackParts: attackBreakdown(char, buffs),
    defense: defense(char, buffs),
    hit: playerHitChance(char,same,buffs),
    skillHit: playerHitChance(char,same,buffs),
    magicHit: magicHitChance(char.stats.int, char.level, same),
    speed: moveSpeed(buffs),
    conHpBonus: conHpBonus(char.stats.con),
  };
}

export function itemModifiers(char, buffs=[]) {
  const values=equipmentBonuses(char);
  for (const buff of buffs) for (const key of ['atkPct','drPct','accPct','cdr','critRate','critDmg','regen','lifesteal','expPct','goldPct','block','skillDmg','double','execute','bossDmg']) values[key]=(values[key] || 0)+(buff[key] || 0);
  return values;
}
export function itemDamage(raw, char, buffs, target, rng=Math.random) {
  const b=itemModifiers(char,buffs);
  if (rng()<Math.min(.5,b.critRate || 0)) raw*=1.5+(b.critDmg || 0);
  if (rng()<Math.min(.5,b.double || 0)) raw*=2;
  if (target.isBoss) raw*=1+(b.bossDmg || 0);
  if (target.hp<target.maxHp*.3) raw*=1+(b.execute || 0);
  return Math.max(1,Math.round(raw));
}
