import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EQUIPMENT_RIG} from '../js/data/equipment-rig.js';
import {equipmentGrip} from '../js/data/equipment-grips.js';
import {ITEMS} from '../js/data/items.js';
import {drawChar,charFiles} from '../js/game/chars.js';
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
test('all classes keep identical fixed artwork when equipment is changed or removed',async()=>{
 await loadImages(Object.keys(CHARS).flatMap(charFiles));
 for(const [key,info] of Object.entries(CHARS))for(let dir=0;dir<8;dir++)for(let f=0;f<8;f++){
  const states=[{},{weapon:'training_sword',shield:'orb_5'},{weapon:'steel_blade',ranged:'training_bow'},null];
  for(const action of ['idle','walk','normal','skill',...(info.classId==='knight'?['shield_bash']:[])]){
   const t=action==='shield_bash'?f/8+.001:CHARS[key].actions[action]?.durations.slice(0,f).reduce((s,n)=>s+n,0)/1000+.001;
   const state={sprite:key,classId:info.classId,level:100,facing:{x:Math.cos(CHAR_ANGLES[dir]),y:Math.sin(CHAR_ANGLES[dir])},moving:action==='walk',walk:(f+.01)/8*Math.PI*2,act:['idle','walk'].includes(action)?null:{name:action,t}};
   const renders=states.map(equipment=>{const c=ctx();drawChar(c,0,0,{...state,equipment});return c.calls;});
   assert.equal(renders[0].length,1,`${key}/${action}/${dir}/${f}`);
   for(const calls of renders.slice(1))assert.deepEqual(calls,renders[0]);
   assert.ok(!renders[0][0][0].url.includes('/rigged/'));
   if(action==='walk')assert.match(renders[0][0][0].url,/fixed-walk.webp$/);
  }
 }
 assert.equal(pending.length,0,'runtime must not request equipment body or hand atlases');
});
