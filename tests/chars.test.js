import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CHARS, CHAR_DIRS, dirIndex, actionDur, hitTimes, frameAt } from '../js/data/chars.js';
import { CLASSES, heroKey } from '../js/data/classes.js';
import { MERC_LOOKS } from '../js/systems/party.js';
import { NPC_SPRITES } from '../js/game/art.js';

test('모든 직업 · 성별 · 용병 외형 · NPC 에 8방향 그림이 있다', () => {
  for (const id of Object.keys(CLASSES)) for (const g of ['m', 'f']) assert.ok(CHARS[heroKey(id, g)], `${id}/${g}`);
  for (const looks of Object.values(MERC_LOOKS)) for (const k of looks) assert.ok(CHARS[k], k);
  for (const k of Object.values(NPC_SPRITES)) assert.ok(CHARS[k], k);
});

test('그림 파일과 동작 규격 (8프레임, 타격 프레임은 그 안)', () => {
  for (const [key, c] of Object.entries(CHARS)) {
    for (const f of ['idle', 'normal', 'skill', 'fx-normal', 'fx-skill', 'portrait']) {
      assert.ok(existsSync(new URL(`../assets/chars/${key}/${f}.webp`, import.meta.url)), `${key}/${f}`);
    }
    for (const a of ['normal', 'skill']) {
      const act = c.actions[a];
      assert.equal(act.durations.length, 8, `${key} ${a}`);
      assert.ok(act.hits.length >= 1 && act.hits.every((h) => h >= 0 && h < 8), `${key} ${a} hits`);
      const d = actionDur(key, a);
      assert.ok(d > 0.4 && d < 1.2, `${key} ${a} ${d}`);
      for (const t of hitTimes(key, a)) assert.ok(t > 0 && t < d);
      assert.equal(frameAt(key, a, 0), 0);
      assert.equal(frameAt(key, a, d + 1), 7);
    }
  }
});

test('화면 방향 → 8방향 번호 (남 · 서 · 북 · 동)', () => {
  assert.equal(CHAR_DIRS[dirIndex({ x: 0, y: 1 })], 'south');
  assert.equal(CHAR_DIRS[dirIndex({ x: -1, y: 0 })], 'west');
  assert.equal(CHAR_DIRS[dirIndex({ x: 0, y: -1 })], 'north');
  assert.equal(CHAR_DIRS[dirIndex({ x: 1, y: 0 })], 'east');
  assert.equal(CHAR_DIRS[dirIndex({ x: 1, y: 1 })], 'south-east');
});
