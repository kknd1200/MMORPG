import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../js/data/classes.js';
import { SKILLS } from '../js/data/skills.js';
import { mercOffers, createMerc, mercPrice, fillSlots, learnedSkills, condOk, shareExp, MERC_CLASSES, MERC_LOOKS, SKILL_SLOTS } from '../js/systems/party.js';
import * as S from '../js/systems/stats.js';
import fs from 'node:fs';

const asset = (p) => fs.existsSync(new URL(`../assets/${p}`, import.meta.url));

test('용병 목록: 같은 마을 · 같은 시간이면 같고, 이름이 겹치지 않음', () => {
  const a = mercOffers('v1', 1, 100), b = mercOffers('v1', 1, 100), c = mercOffers('v1', 1, 101);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(new Set(a.map((o) => o.name)).size, a.length);
  const taken = mercOffers('v1', 1, 100, 4, a.map((o) => o.name));
  for (const o of taken) assert.ok(!a.some((x) => x.name === o.name), `${o.name} 겹침`);
  for (const o of a) {
    assert.ok(MERC_CLASSES.includes(o.classId));
    assert.ok(MERC_LOOKS[o.classId].includes(o.look));
    assert.ok(asset(`heroes/${o.look}/attack-1.webp`), o.look);
    assert.equal(o.price, mercPrice(o.level));
  }
});

test('용병 고용: 레벨까지 성장, 스킬 칸 채움, 보너스 포인트는 주스탯에', () => {
  for (const classId of MERC_CLASSES) {
    const m = createMerc({ classId, look: MERC_LOOKS[classId][0], name: '시험', level: 21 }, 'x');
    assert.equal(m.level, 21);
    assert.equal(m.growth.count, 20);
    assert.equal(m.bonusPoints, 0);
    assert.ok(m.stats[CLASSES[classId].primaryStat] >= 20, `${classId} 주스탯`);
    assert.equal(m.skillSlots.length, SKILL_SLOTS);
    for (const sl of m.skillSlots.filter(Boolean)) assert.ok(learnedSkills(m).includes(sl.id));
    assert.equal(m.hp, m.maxHp);
  }
});

test('전사(용병) 스킬 8개 · 그림 파일', () => {
  assert.equal(CLASSES.warrior.skills.length, 8);
  assert.ok(CLASSES.warrior.hireOnly);
  for (const id of CLASSES.warrior.skills) {
    assert.ok(asset(`skills/${SKILLS[id].fx.sheet}.webp`), id);
    assert.ok(asset(`skills/${SKILLS[id].fx.sheet}-icon.webp`), id);
  }
});

test('스킬 칸: 배운 스킬만, 빈 칸만 채움', () => {
  const c = S.createCharacter({ id: 'a', name: 'a', classId: 'mage', stats: { ...CLASSES.mage.baseStats, int: 18, con: 13 } });
  c.skillSlots = [];
  fillSlots(c);
  assert.deepEqual(c.skillSlots.filter(Boolean).map((s) => s.id), ['fire_bolt']);
  c.level = 20;
  fillSlots(c);
  assert.equal(c.skillSlots[0].id, 'fire_bolt');
  assert.equal(c.skillSlots.filter(Boolean).length, 4);
});

test('조건 · 경험치 나누기', () => {
  const u = { char: { hp: 40, maxHp: 100 }, ent: { dead: false } };
  const full = { char: { hp: 100, maxHp: 100 }, ent: { dead: false } };
  assert.equal(condOk('hp50', u, { units: [u] }), true);
  assert.equal(condOk('hp50', full, { units: [full] }), false);
  assert.equal(condOk('ally50', full, { units: [full, u] }), true);
  assert.equal(condOk('enemies3', full, { units: [full], enemiesNear: 3 }), true);
  assert.equal(condOk('boss', full, { units: [full], target: { isBoss: false } }), false);
  assert.equal(shareExp(100, 1), 100);
  assert.equal(shareExp(100, 4), 30);
});
