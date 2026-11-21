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
// 보너스 6점을 체력 위주로 (생성 최대 18을 넘지 않게, 남으면 힘)
const six = (id) => { const c = CLASSES[id].baseStats.con; const k = Math.min(6, 18 - c); return k === 6 ? { con: 6 } : { con: k, str: 6 - k }; };

test('직업별 시작 HP/MP', () => {
  const expected = { knight: [40, 20], elf: [35, 25], mage: [25, 35], priest: [30, 30], warrior: [45, 15] };
  for (const id of CLASS_ORDER) {
    const c = make(id, six(id));
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
    const c = make(id, six(id));
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

test('기본 일반공격: 기사 10 / 요정 8 / 법사 3 / 사제 5 / 전사 11, 무기·버프로 변동', () => {
  const expected = { knight: 10, elf: 8, mage: 3, priest: 5, warrior: 11 };
  for (const id of CLASS_ORDER) assert.equal(S.attackPower(make(id, six(id))), expected[id]);
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

// ---------------------------------------------------------------- 몬스터 데이터
import fs from 'node:fs';
import { MONSTERS } from '../js/data/monsters.js';
import '../js/data/maps.js'; // 맵에 배치하면서 몬스터가 등록됨
import { ROSTER } from '../js/data/rebirth-roster.js';

test('원본 몬스터 300종: 그림 시트 파일 존재, 시트 안 행 번호 0~5', () => {
  assert.equal(ROSTER.length, 300);
  for (const m of ROSTER) {
    assert.ok(fs.existsSync(new URL(`../assets/monsters/${m.art.sheet}.webp`, import.meta.url)), `${m.id} 시트 없음`);
    assert.ok(m.art.row >= 0 && m.art.row <= 5 && m.art.bodyHeight > 0, m.id);
  }
});

test('배치된 몬스터 전부: 드롭 아이템 존재, 필수 수치 양수, 레벨 1~99', () => {
  assert.ok(Object.keys(MONSTERS).length > 300);
  for (const [id, m] of Object.entries(MONSTERS)) {
    for (const k of ['level', 'hp', 'atk', 'exp', 'speed', 'attackRange', 'attackInterval', 'size']) {
      assert.ok(m[k] > 0, `${id}.${k}`);
    }
    assert.ok(m.level <= 99, `${id} 레벨 ${m.level}`);
    for (const d of m.drops || []) assert.ok(ITEMS[d.item], `${id} 드롭 ${d.item} 없음`);
    if (m.projectile) assert.ok(m.attackRange > 2, `${id}: 원거리인데 사거리가 짧음`);
  }
});

// ---------------------------------------------------------------- 캐릭터 · 스킬 그림
import { BASIC_FX, STATUS_FX, LEVELUP_FX } from '../js/data/skills.js';
import { heroKey } from '../js/data/classes.js';

const asset = (p) => fs.existsSync(new URL(`../assets/${p}`, import.meta.url));

test('직업마다 스킬 8개, 레벨 1 스킬이 있고 이펙트 · 아이콘 · 날아가는 그림 파일이 모두 있음', () => {
  for (const id of CLASS_ORDER) {
    const cls = CLASSES[id];
    assert.equal(cls.skills.length, 8, id);
    assert.ok(cls.skills.some((s) => SKILLS[s].level === 1), `${id}: Lv.1 스킬 없음`);
    for (const sid of cls.skills) {
      const sk = SKILLS[sid];
      assert.ok(sk, sid);
      assert.equal(sk.classId, id, sid);
      assert.ok(asset(`skills/${sk.fx.sheet}.webp`), `${sid} 이펙트`);
      assert.ok(asset(`skills/${sk.fx.sheet}-icon.webp`), `${sid} 아이콘`);
      if (sk.proj) assert.ok(asset(`skills/${sk.proj}.webp`), `${sid} 날아가는 그림`);
    }
    assert.ok(asset(`skills/${BASIC_FX[id].sheet}.webp`), `${id} 기본공격 이펙트`);
  }
  for (const f of [...Object.values(STATUS_FX), LEVELUP_FX]) assert.ok(asset(`skills/${f.sheet}.webp`), f.sheet);
});

test('직업 · 성별마다 캐릭터 그림(공격 6 + 스킬 6)과 초상화가 있음', () => {
  for (const id of CLASS_ORDER) for (const g of ['m', 'f']) {
    const key = heroKey(id, g);
    for (let i = 1; i <= 6; i++) {
      assert.ok(asset(`heroes/${key}/attack-${i}.webp`), `${key} attack-${i}`);
      assert.ok(asset(`heroes/${key}/skill-${i}.webp`), `${key} skill-${i}`);
    }
    assert.ok(asset(`portraits/${key}.webp`), `${key} 초상화`);
  }
});

test('새 캐릭터: 성별 저장, 첫 단축칸은 Lv.1 스킬', () => {
  const c = S.createCharacter({ id: 'g', name: '성별', classId: 'knight', stats: alloc('knight', { con: 6 }), gender: 'f' });
  assert.equal(c.gender, 'f');
  assert.equal(SKILLS[c.hotbar[0].id].level, 1);
  assert.equal(S.createCharacter({ id: 'h', name: '기본', classId: 'elf', stats: alloc('elf', { con: 6 }) }).gender, 'm'); // 기본 외형: 요정 = archer_male
});

test('밸런스: 같은 레벨 일반 몬스터는 2~5초에 처치, 레벨이 오를수록 HP·공격·경험치 상승', async () => {
  const B = await import('../js/systems/balance.js');
  let prev = null;
  for (const lv of [1, 10, 30, 60, 99]) {
    const m = B.monsterBase(lv);
    const kill = m.hp / B.curve(lv).dps;
    assert.ok(kill >= 2 && kill <= 5, `Lv.${lv} 처치 ${kill.toFixed(1)}초`);
    if (prev) for (const k of ['hp', 'atk', 'exp']) assert.ok(m[k] > prev[k], `Lv.${lv} ${k}`);
    prev = m;
  }
});

test('레벨업하면 HP · MP 모두 회복', () => {
  const c = make('knight', six('knight'));
  c.hp = 3; c.mp = 1;
  S.levelUp(c, fixed(0.5));
  assert.equal(c.hp, c.maxHp);
  assert.equal(c.mp, c.maxMp);
});
