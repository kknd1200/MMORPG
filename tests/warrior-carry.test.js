import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAR_ANGLES} from '../js/data/chars.js';
import {EQUIPMENT_RIG} from '../js/data/equipment-rig.js';

test('warrior walking blades trail the movement direction in every frame and appearance',()=>{
 for(const key of ['warrior','warrior_female'])for(let row=0;row<8;row++){
  const facing=CHAR_ANGLES[row];
  for(const pose of EQUIPMENT_RIG[key].walk[row]){
   const forward=Math.cos(pose.angle)*Math.cos(facing)+Math.sin(pose.angle)*Math.sin(facing);
   assert.ok(forward<-.3,`${key}/${row}: blade points forward (${forward})`);
  }
 }
});

test('trailing carry uses torso occlusion toward the camera and visible blades when walking away',()=>{
 for(const key of ['warrior','warrior_female'])for(let row=0;row<8;row++){
  for(const pose of EQUIPMENT_RIG[key].walk[row])assert.equal(pose.mainBehind,[0,1,7].includes(row));
 }
});
