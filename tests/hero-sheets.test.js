import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { HERO_SHEETS, heroFrame, directionRow, preloadHeroSheets, drawHeroSheet } from '../js/game/hero-sheets.js';

test('four directional rows match the supplied right/down/left/up layout', () => {
  assert.deepEqual([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }].map(directionRow), [0, 1, 2, 3]);
});
test('walking uses passing/contact/passing/opposite-contact; standing uses neutral', () => {
  const columns = [0, 1, 2, 3, 4].map(n => heroFrame({ moving: true, walk: n * Math.PI / 2 + 0.01 }).column);
  assert.deepEqual(columns, [1, 0, 1, 2, 1]);
  for (let n = 0; n < 20; n++) assert.equal(heroFrame({ moving: false, walk: n }).column, 1);
  assert.equal(heroFrame({ moving: true, walk: 2, attack: 0.5 }).column, 1);
});
test('every class has a real sprite atlas and passed alignment QC for 12 frames', () => {
  const qc = JSON.parse(readFileSync(new URL('../assets/heroes/walk-qc.json', import.meta.url)));
  for (const id of Object.keys(HERO_SHEETS)) {
    assert.ok(existsSync(new URL(HERO_SHEETS[id])));
    assert.equal(qc[id].qc.valid_frame_count, 12);
    assert.equal(qc[id].qc.empty_count, 0);
    assert.equal(qc[id].qc.paste_clamped_count, 0);
    assert.ok(qc[id].qc.body_scale_cv < 0.08);
    assert.deepEqual(qc[id].sourceEdgeTouch, []);
    assert.deepEqual(qc[id].outputEdgeTouch, []);
  }
});
test('drawing changes source frames without changing body size or ground anchor', async () => {
  const original = globalThis.Image;
  globalThis.Image = class { set src(value) { queueMicrotask(() => this.onload()); } };
  try {
    await preloadHeroSheets();
    const draws = [], ctx = { save(){}, restore(){}, translate(){}, rotate(){}, drawImage(...args){ draws.push(args); } };
    for (let n = 0; n < 4; n++) drawHeroSheet(ctx, 50, 70, { classId: 'knight', facing: { x: 1, y: 0 }, moving: true, walk: n * Math.PI / 2 + .01 });
    assert.equal(draws.length, 4);
    assert.deepEqual(draws.map(d => d[1]), [128, 0, 128, 256]);
    for (const draw of draws) assert.deepEqual(draw.slice(5), draws[0].slice(5));
  } finally { globalThis.Image = original; }
});
