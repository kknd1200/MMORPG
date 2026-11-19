// 밸런스 기준선: "그 레벨의 평범한 플레이어"를 계산해서 몬스터 수치를 거꾸로 정합니다.
//
//   몬스터 HP     = 기준 플레이어 평균 DPS × 처치 목표 시간
//   몬스터 공격력 = 기준 플레이어가 1:1로 목표 시간만큼 버티도록
//   몬스터 경험치 = 다음 레벨까지 필요 경험치 ÷ 목표 사냥 수
//
// 기준 플레이어 (직업 4개 평균)
//   - 생성 시 주스탯 +4(생성 한도까지), 나머지 체력 / 보너스 포인트는 전부 주스탯 (최대 STAT_CAP)
//   - HP·MP 는 레벨업 주사위 평균
//   - 장비: Lv.1~9 수련용 / 10~29 중급 무기·가죽 갑옷 / 30~ 상급 무기·사슬(가능하면) 갑옷
//   - 전투: 일반공격을 계속하면서 주력 공격 스킬을 재사용 대기마다 SKILL_USE 비율만큼 사용
import { CLASSES, CLASS_ORDER, STAT_CAP, CREATION } from '../data/classes.js';
import { SKILLS } from '../data/skills.js';
import { ITEMS } from '../data/items.js';
import * as S from './stats.js';

export const TARGET = {
  killSeconds: 3.2, // 같은 레벨 일반 몬스터 처치 시간
  surviveSeconds: 30, // 같은 레벨 일반 몬스터 한 마리에게 맞기만 할 때 버티는 시간
  monsterInterval: 1.35, // 몬스터 평균 공격 간격 (계산용)
  killsPerLevel: (lv) => 5 + 0.6 * lv, // 레벨업까지 사냥 수
};
const SKILL_USE = 0.6;

const WEAPONS = {
  knight: ['training_sword', 'long_sword', 'steel_blade'],
  elf: ['training_bow', 'long_bow', 'elven_bow'],
  mage: ['training_staff', 'oak_staff', 'arcane_staff'],
  priest: ['training_mace', 'iron_mace', 'holy_mace'],
};

export function gearTier(level) { return level < 10 ? 0 : level < 30 ? 1 : 2; }

export function referenceCharacter(classId, level) {
  const cls = CLASSES[classId];
  const p = cls.primaryStat;
  const stats = { ...cls.baseStats };
  // 생성: 주스탯에 최대 4점 (생성 한도 CREATION.maxStat), 나머지는 체력
  const toPrimary = Math.min(4, CREATION.maxStat - stats[p]);
  stats[p] += toPrimary; stats.con += CREATION.bonusPoints - toPrimary;
  let points = 0;
  for (let lv = 2; lv <= level; lv++) points += S.bonusPointsForLevel(lv);
  stats[p] = Math.min(STAT_CAP, stats[p] + points);
  const avg = ([a, b]) => (a + b) / 2;
  const tier = gearTier(level);
  const armorId = tier === 0 ? 'cloth_armor' : tier === 1 ? 'leather_armor'
    : (ITEMS.chain_mail.classes.includes(classId) ? 'chain_mail' : 'leather_armor');
  return {
    classId, level, stats,
    maxHp: Math.round(cls.start.hp + (level - 1) * (avg(cls.growth.hp) + S.conHpBonus(stats.con))),
    maxMp: Math.round(cls.start.mp + (level - 1) * avg(cls.growth.mp)),
    equipment: { weapon: WEAPONS[classId][tier], armor: armorId },
  };
}

// 같은 레벨 몬스터 상대로 초당 피해 (명중률·방어 반영)
export function playerDps(classId, level, target = { level, eva: 0.06, mr: 0.08, armor: Math.round(level * 0.18) }) {
  const ch = referenceCharacter(classId, level);
  const cls = CLASSES[classId];
  const atk = S.attackPower(ch);
  const stat = ch.stats[cls.primaryStat];
  const normalHit = S.physicalHitChance(stat, level, target);
  let dps = (normalHit * S.physicalMitigate(atk, target.armor)) / cls.attackInterval;
  // 배운 공격 스킬 중 초당 피해가 가장 높은 것 하나
  let best = 0;
  for (const id of cls.skills) {
    const sk = SKILLS[id];
    if (sk.kind !== 'damage' && sk.kind !== 'aoe') continue;
    if (sk.level > level) continue;
    const magic = sk.element === 'magic';
    const st = ch.stats[sk.stat];
    const hit = magic ? S.magicHitChance(st, level, target) : S.physicalHitChance(st, level, target);
    const raw = st * atk * sk.coef;
    const per = magic ? raw * (1 - target.mr) : Math.max(1, raw - target.armor / 2);
    best = Math.max(best, (hit * per * (sk.hits || 1)) / sk.cooldown);
  }
  return dps + best * SKILL_USE;
}

export function playerEhp(classId, level) {
  const ch = referenceCharacter(classId, level);
  return { hp: ch.maxHp, def: S.defense(ch) };
}

// 레벨별 기준값 (직업 평균). 몬스터 레벨은 최대 110 까지 미리 계산
const CURVE = [];
for (let lv = 1; lv <= 110; lv++) {
  const pl = Math.min(lv, 99);
  let dps = 0, hp = 0, def = 0;
  for (const id of CLASS_ORDER) {
    dps += playerDps(id, pl);
    const e = playerEhp(id, pl);
    hp += e.hp; def += e.def;
  }
  const n = CLASS_ORDER.length;
  CURVE[lv] = { dps: dps / n, hp: hp / n, def: def / n };
}
export const curve = (lv) => CURVE[Math.max(1, Math.min(110, Math.round(lv)))];

// 같은 레벨 일반 몬스터의 기본 수치
export function monsterBase(level) {
  const c = curve(level);
  const hp = Math.max(12, Math.round(c.dps * TARGET.killSeconds));
  // 버티는 시간 = (HP ÷ 한 대 피해) × 간격 ÷ 명중률  →  한 대 피해 역산
  const hit = S.monsterHitChance(level, Math.min(level, 99), c.def);
  const perHit = (c.hp * TARGET.monsterInterval) / (hit * TARGET.surviveSeconds);
  const atk = Math.max(2, Math.round((perHit + c.def / 2) / 0.9));
  const exp = Math.max(4, Math.round(S.expToNext(Math.min(level, 98)) / TARGET.killsPerLevel(level)));
  return {
    hp, atk, exp,
    gold: [Math.max(1, Math.round(level * 0.8)), Math.round(3 + level * 2.2)],
  };
}
