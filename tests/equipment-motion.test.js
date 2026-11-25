import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EQUIPMENT_RIG} from '../js/data/equipment-rig.js';
import {equipmentGrip} from '../js/data/equipment-grips.js';
import {ITEMS} from '../js/data/items.js';
import {drawChar} from '../js/game/chars.js';
import {loadImages} from '../js/game/art.js';
import {CHAR_ANGLES,CHARS} from '../js/data/chars.js';
const pending=[];
globalThis.Image=class {set src(url){this.url=url;this.height=url.includes('idle.webp')?160:4000;if(url.includes('/rigged/'))pending.push(this);else queueMicrotask(()=>this.onload());}};
const ctx=()=>({calls:[],save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(...a){this.calls.push(a);}});
test('all 2000 direction/action frames have finite hand sockets and matching body/hand atlases',()=>{
 let count=0;
 for(const key of Object.keys(CHARS)){
  for(const name of ['body','hands'])assert.ok(fs.existsSync(new URL(`../assets/chars/rigged/${key}/${name}.webp`,import.meta.url)));
  for(const [action,rows] of Object.entries(EQUIPMENT_RIG[key])){
   assert.equal(rows.length,8);
   for(const frames of rows){assert.equal(frames.length,action==='idle'?1:8);for(const f of frames){count++;assert.ok(Number.isFinite(f.angle));for(const n of f.main)assert.ok(n>0&&n<160);assert.ok(f.hands.length);for(const h of f.hands){assert.ok(h.xy[0]>=0&&h.xy[0]<=248);assert.ok(h.xy[1]>=0);}}}
  }
 }
 assert.equal(count,2000);
});
test('axe and sword grips use the wrapped handle rather than the blade corner',()=>{
 for(const type of ['sword','greatsword','axe','greataxe','spear','staff']){
  const item=Object.values(ITEMS).find(it=>it.weaponType===type&&it.atlas);assert.ok(item,type);const p=equipmentGrip(item);assert.ok(p.grip[0]<p.tip[0]);assert.ok(p.grip[1]>p.tip[1]);
 }
});
test('reversed knight-sword icons retain their own handle pivot',()=>{
 const item=Object.values(ITEMS).find(i=>i.name==='구리 기사검');const p=equipmentGrip(item);assert.ok(p.grip[0]>p.tip[0]);assert.ok(p.grip[1]<p.tip[1]);
});
test('wind-up, contact and recovery follow different hands and return to carry angle',()=>{
 for(const key of ['warrior','warrior_female','knight','knight_female']){
  const frames=EQUIPMENT_RIG[key].normal[0];assert.notDeepEqual(frames[0].main,frames[2].main);assert.notEqual(frames[0].angle,frames[2].angle);assert.equal(frames[0].angle,frames[7].angle);
 }
});
test('loading an equipped body never reveals a baked sword, and hands draw over the weapon layer',async()=>{
 await loadImages(['chars/knight/normal.webp','chars/knight/skill.webp','chars/knight/idle.webp']);
 const s={sprite:'knight',classId:'knight',equipment:{},facing:{x:Math.cos(CHAR_ANGLES[0]),y:Math.sin(CHAR_ANGLES[0])},act:{name:'normal',t:.01}};
 const before=ctx();drawChar(before,0,0,s);assert.equal(before.calls.length,0);
 for(const image of pending)image.onload();
 for(const action of ['normal','skill','shield_bash']){
  const c=ctx();drawChar(c,0,0,{...s,act:{name:action,t:.01}});assert.match(c.calls[0][0].url,/rigged\/knight\/body.webp$/);assert.match(c.calls.at(-1)[0].url,/rigged\/knight\/hands.webp$/);
 }
});
