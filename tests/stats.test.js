import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES, CLASS_ORDER } from '../js/data/classes.js';
import { SKILLS } from '../js/data/skills.js';
import { ITEMS } from '../js/data/items.js';
import * as S from '../js/systems/stats.js';

const alloc = (classId, extra) => {
  const stats = { ...CLASSES[classId].baseStats };
  for (const [k, v] of Object.entries(extra)) stats[k] += v;
  return stats;
};
const make = (classId = 'knight', extra = { str: 4, con: 2 }) =>
  S.createCharacter({ id: 't', name: '테스트', classId, stats: alloc(classId, extra) });
const fixed = (v) => () => v; // rng 고정

test('직업별 시작 HP/MP', () => {
  const expected = { knight: [40, 20], elf: [35, 25], mage: [25, 35], priest: [30, 30] };
  for (const id of CLASS_ORDER) {
    const c = make(id, { con: 6 });
    assert.deepEqual([c.maxHp, c.maxMp], expected[id], id);
  }
});

test('기사 레벨업: HP 8~12(+체력보너스), MP 3~5', () => {
  const lo = make('knight', { str: 4, dex: 2 }); // con 12 → 체력 보너스 1
  const rLo = S.levelUp(lo, fixed(0));
  assert.equal(rLo.hpRoll, 8);
  assert.equal(rLo.mpRoll, 3);
  assert.equal(rLo.hpGain, 9);
  const hi = make('knight', { str: 4, dex: 2 });
  const rHi = S.levelUp(hi, fixed(0.9999));
  assert.equal(rHi.hpRoll, 12);
  assert.equal(rHi.mpRoll, 5);
});

test('모든 직업 레벨업 주사위가 범위 안', () => {
  for (const id of CLASS_ORDER) {
    const c = make(id, { con: 6 });
    for (let i = 0; i < 200; i++) {
      const r = S.levelUp(c);
      const { hp, mp } = CLASSES[id].growth;
      assert.ok(r.hpRoll >= hp[0] && r.hpRoll <= hp[1]);
      assert.ok(r.mpRoll >= mp[0] && r.mpRoll <= mp[1]);
    }
  }
});

test('보너스 포인트: 10레벨마다 1, 50레벨 이후 매 레벨 1', () => {
  const got = [];
  for (let lv = 2; lv <= 55; lv++) if (S.bonusPointsForLevel(lv)) got.push(lv);
  assert.deepEqual(got, [10, 20, 30, 40, 50, 51, 52, 53, 54, 55]);
  const c = make();
  for (let i = 0; i < 59; i++) S.levelUp(c); // Lv.60
  assert.equal(c.level, 60);
  assert.equal(c.bonusPoints, 5 + 10);
});

test('캐릭터 생성 포인트 검증', () => {
  assert.equal(S.validateAllocation('knight', CLASSES.knight.baseStats).ok, false);
  assert.equal(S.validateAllocation('knight', alloc('knight', { str: 4, con: 2 })).ok, true);
  assert.equal(S.validateAllocation('knight', alloc('knight', { str: 7 })).ok, false); // 7점 사용
  assert.equal(S.validateAllocation('knight', { ...alloc('knight', { str: 6, dex: 1 }), con: 11 }).ok, false); // 기본값 이하
});

test('기본 일반공격: 기사 10 / 요정 8 / 법사 3 / 사제 5, 무기·버프로 변동', () => {
  const expected = { knight: 10, elf: 8, mage: 3, priest: 5 };
  for (const id of CLASS_ORDER) assert.equal(S.attackPower(make(id, { con: 6 })), expected[id]);
  const k = make();
  k.equipment.weapon = 'long_sword';
  assert.equal(S.attackPower(k), 10 + ITEMS.long_sword.atk);
  assert.equal(S.attackPower(k, [{ atk: 3 }]), 17);
});

test('기사 스킬 피해 = 힘 × 일반공격 × 계수', () => {
  const sk = SKILLS.power_strike;
  const dmg = S.skillDamage(18, 10, sk.coef, fixed(0.5)); // 분산 1.0
  assert.equal(dmg, 18 * 10 * sk.coef);
});

test('주스탯이 높을수록 명중 상승', () => {
  const t = { level: 1, eva: 0, mr: 0 };
  assert.ok(S.physicalHitChance(18, 1, t) > S.physicalHitChance(10, 1, t));
  assert.ok(S.magicHitChance(18, 1, t) > S.magicHitChance(10, 1, t));
});

test('체력이 높을수록 방어력과 레벨업 HP 상승', () => {
  const a = make('knight', { str: 4, dex: 2 });
  const b = make('knight', { con: 6 });
  assert.ok(S.defense(b) > S.defense(a));
  assert.ok(S.conHpBonus(b.stats.con) > S.conHpBonus(a.stats.con));
});

test('축캐 / 저주캐 판정', () => {
  const blessed = make();
  const cursed = make();
  for (let i = 0; i < 20; i++) { S.levelUp(blessed, fixed(0.9999)); S.levelUp(cursed, fixed(0)); }
  assert.equal(S.luckGrade(blessed).id, 'blessed');
  assert.equal(S.luckGrade(cursed).id, 'cursed');
  assert.equal(S.luckGrade(make()).id, 'pending');
});

test('경험치 획득 시 연속 레벨업', () => {
  const c = make();
  const ups = S.gainExp(c, S.expToNext(1) + S.expToNext(2) + 1);
  assert.equal(ups.length, 2);
  assert.equal(c.level, 3);
  assert.equal(c.exp, 1);
});
