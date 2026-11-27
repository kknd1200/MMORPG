import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { heroSprite, heroFrame, drawHeroSheet, preloadHeroArt } from '../js/game/hero-sheets.js';
import { loadImages } from '../js/game/art.js';
import { CHARS, actionDur } from '../js/data/chars.js';

// Simulate actual cached images, not the discarded procedural character painter.
globalThis.Image = class {
  set src(value) { this.url = value; this.height = value.includes('idle.webp') ? 160 : 1280; queueMicrotask(() => this.onload()); }
};
const context = () => ({ calls: [], save(){}, restore(){}, translate(){}, rotate(){}, drawImage(...args){this.calls.push(args);} });

test('all classes and both appearances map to the approved 8-direction asset packs', () => {
  for (const classId of ['knight','elf','mage','priest','warrior']) {
    for (const gender of ['male','female']) {
      const key = heroSprite({classId,gender});
      assert.ok(CHARS[key]);
      for (const action of ['idle','fixed-walk','normal','skill']) assert.ok(fs.existsSync(new URL(`../assets/chars/${key}/${action}.webp`,import.meta.url)));
    }
  }
  assert.equal(heroSprite({classId:'elf'}),'archer_male');
  assert.equal(heroSprite({classId:'mage'}),'mage_male');
});
test('login portraits and game bodies use the same artwork with the requested scale', async () => {
  await preloadHeroArt();
  const ctx=context();
  drawHeroSheet(ctx,0,0,{classId:'knight',facing:{x:0,y:1},scale:2});
  const [sheet,...rect]=ctx.calls[0];
  assert.match(sheet.url,/chars\/knight\/idle.webp$/);
  assert.deepEqual(rect,[0,0,160,160,-160,-218,320,320]);
});
test('walking uses all eight authored frames', async () => {
  await loadImages(['chars/knight/fixed-walk.webp']);
  for(let i=0;i<8;i++) {
    const state={classId:'knight',moving:true,walk:(i+.01)/8*Math.PI*2,facing:{x:1,y:0}};
    const ctx=context();drawHeroSheet(ctx,0,0,state);
    assert.equal(heroFrame(state).column,i);
    assert.equal(ctx.calls[0][1],i*160);
    assert.equal(ctx.calls[0][2],6*160);
    assert.match(ctx.calls[0][0].url,/fixed-walk.webp$/);
  }
});
test('attack, spell and death keep the approved body instead of reverting to primitives', async () => {
  await loadImages(['chars/knight/normal.webp','chars/knight/skill.webp']);
  for(const [action,state] of [['normal',{attack:.5}],['skill',{cast:.5}],['idle',{dead:true}]]) {
    const ctx=context();let fallback=0;
    assert.equal(drawHeroSheet(ctx,0,0,{classId:'knight',facing:{x:0,y:1},...state},()=>fallback++),true);
    assert.equal(fallback,0);
    assert.match(ctx.calls[0][0].url,new RegExp(`${action}.webp$`));
  }
  assert.ok(actionDur('knight','normal')>0);
});

test('direction selection covers all eight authored rows without mirroring the same body', () => {
  const rows = new Set();
  for (let i = 0; i < 8; i++) rows.add(heroFrame({facing:{x:Math.cos(i*Math.PI/4), y:Math.sin(i*Math.PI/4)}}).row);
  assert.equal(rows.size,8);
});
