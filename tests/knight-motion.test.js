import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EQUIPMENT_RIG} from '../js/data/equipment-rig.js';
import {drawHandForeground} from '../js/game/equipment-art.js';
const authored=JSON.parse(fs.readFileSync(new URL('../tools/rig/knight-poses.json',import.meta.url),'utf8'));
test('all 400 knight poses use their independently authored hand positions, angles and depth',()=>{
 let count=0;
 for(const key of ['knight','knight_female'])for(const [action,rows] of Object.entries(authored[key]))for(let r=0;r<8;r++)for(let f=0;f<rows[r].length;f++){
  const expected=rows[r][f],actual=EQUIPMENT_RIG[key][action][r][f];count++;
  assert.deepEqual(actual.main,expected.main);assert.deepEqual(actual.off,expected.off);assert.ok(Math.abs(actual.angle-expected.angle)<.00001);assert.equal(actual.mainBehind,expected.mainBehind);assert.equal(actual.offBehind,expected.offBehind);
  assert.deepEqual(actual.hands.map(h=>h.role),['main','off']);
 }
 assert.equal(count,400);
});
test('female wind-up and overhead poses retain their own wrists rather than male or boot sockets',()=>{
 const female=EQUIPMENT_RIG.knight_female,male=EQUIPMENT_RIG.knight;
 assert.ok(female.normal[0][1].main[1]<male.normal[0][1].main[1]-8);
 assert.ok(female.skill[4][3].main[1]<65);assert.ok(female.normal[6][3].main[0]<100);
 assert.notEqual(female.normal[0][3].angle,male.normal[0][3].angle);
});
test('side-facing shield depth changes with the turned torso during attack and returns on recovery',()=>{
 const row=EQUIPMENT_RIG.knight_female.normal[2];assert.equal(row[0].offBehind,false);assert.equal(row[2].offBehind,true);assert.equal(row[7].offBehind,false);
});
test('shield faces cover the left knuckles while sword and axe fingers stay in the foreground',()=>{
 const calls=[],ctx={drawImage(...args){calls.push(args)}},body={hands:{},handPatches:[{role:'main',xy:[0,0],at:[65,80]},{role:'off',xy:[8,0],at:[89,80]}]};
 drawHandForeground(ctx,body,1,{hideOffHand:true});assert.equal(calls.length,1);assert.equal(calls[0][1],0);
 calls.length=0;drawHandForeground(ctx,body);assert.equal(calls.length,2);
});

test('walking keeps a low carry wrist and stable weapon angle through all eight gait frames',()=>{
 for(const key of ['knight','knight_female'])for(const row of EQUIPMENT_RIG[key].walk)for(const p of row){assert.ok(p.main[1]>=76);assert.equal(p.angle,row[0].angle);}
});
