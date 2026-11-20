import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { HERO_BODY, HERO_ACTION, contactTime, releaseTime, FX_PHASES, FX_PART } from '../js/data/hero-anim.js';

const anim = JSON.parse(readFileSync(new URL('../assets/animations.json', import.meta.url)));

test('캐릭터 프레임 규격이 animations.json 과 같다', () => {
  for (const [key, h] of Object.entries(anim.heroes)) {
    assert.equal(HERO_BODY[key], h.bodyHeight, key);
    assert.equal(HERO_ACTION.attack.dur * 1000, h.attack.durationMs, key);
    assert.equal(HERO_ACTION.skill.dur * 1000, h.skill.durationMs, key);
    assert.equal(HERO_ACTION.attack.contact, h.attack.contactFrame, key);
    assert.equal(HERO_ACTION.skill.release, h.skill.releaseFrame, key);
  }
  assert.ok(contactTime() > 0 && contactTime() < HERO_ACTION.attack.dur);
  assert.ok(releaseTime() > 0 && releaseTime() < HERO_ACTION.skill.dur);
});

test('이펙트 4단계가 16장을 빠짐없이 나눈다', () => {
  for (const [key, e] of Object.entries(anim.effects)) {
    for (const [name, ph] of Object.entries(e.phases)) {
      assert.deepEqual(ph.frames, [0, 1, 2, 3].map((i) => FX_PHASES[name].from + i), `${key} ${name}`);
      assert.equal(ph.durationMs / 1000, FX_PHASES[name].dur, `${key} ${name}`);
    }
  }
  assert.equal(FX_PART.cast.from + FX_PART.cast.n, FX_PART.hit.from);
  assert.equal(FX_PART.hit.from + FX_PART.hit.n, 16);
});

test('원본 그림 파일이 바뀌지 않았다 (SHA-256)', () => {
  const integ = JSON.parse(readFileSync(new URL('../assets/original-integrity.json', import.meta.url)));
  const list = Array.isArray(integ) ? integ : integ.files || Object.entries(integ).map(([file, sha256]) => ({ file, sha256 }));
  let checked = 0;
  for (const f of list) {
    const path = new URL(`../assets/${f.file}`, import.meta.url);
    if (!existsSync(path) || !f.sha256) continue;
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), f.sha256, f.file);
    checked++;
  }
  assert.ok(checked > 400, `확인한 파일 수: ${checked}`);
});
