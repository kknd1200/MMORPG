import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS} from '../js/data/items.js';
import {EQUIPMENT_RIG} from '../js/data/equipment-rig.js';
import {equipmentGrip} from '../js/data/equipment-grips.js';
import {drawHeldItem,equipmentArt} from '../js/game/equipment-art.js';
import {loadImages} from '../js/game/art.js';

globalThis.Image=class {set src(value){this.width=2048;this.height=2048;queueMicrotask(()=>this.onload());}};
globalThis.OffscreenCanvas=class {
 constructor(w,h){this.width=w;this.height=h;}
 getContext(){return {drawImage(){}};}
};

test('all bow types mirror around the hand without reversing their upper limb',async()=>{
 for(const type of ['shortbow','bow','hornbow']){
  const item=Object.values(ITEMS).find(it=>it.weaponType===type && (it.atlas || it.art));
  assert.ok(item,type);const art=equipmentArt(item),grip=equipmentGrip(item);
  await loadImages([art.path]);
  for(const angle of [-Math.PI/2,2.2])for(const flipX of [false,true]){
   let m=[1,0,0,1],translation,draw;
   const ctx={save(){},restore(){},translate(x,y){translation=[x,y];},
    scale(x,y){m=[m[0]*x,m[1]*x,m[2]*y,m[3]*y];},
    rotate(t){const [a,b,c,d]=m,C=Math.cos(t),S=Math.sin(t);m=[a*C+c*S,b*C+d*S,-a*S+c*C,-b*S+d*C];},
    drawImage(...args){draw=args;}};
   drawHeldItem(ctx,item,[91,86],angle,{scale:2,flipX});
   assert.deepEqual(translation,[22,-46]);assert.ok(draw);
   const factor=draw[3]/art.cell;
   const x=draw[1]+grip.grip[0]*factor,y=draw[2]+grip.grip[1]*factor;
   assert.ok(Math.hypot(x,y)<1e-8,'grip stays on the same hand');
   const dx=(grip.tip[0]-grip.grip[0])*factor,dy=(grip.tip[1]-grip.grip[1])*factor;
   const tx=m[0]*dx+m[2]*dy,ty=m[1]*dx+m[3]*dy;
   assert.ok(Math.hypot(tx-Math.cos(angle)*grip.reach*2,ty-Math.sin(angle)*grip.reach*2)<1e-8,'upper limb keeps its heading');
   assert.ok(Math.abs(m[0]*m[3]-m[1]*m[2]-(flipX?-1:1))<1e-8);
  }
 }
});

test('rear carry reflection is limited to the two new archer walking actions',()=>{
 for(const [key,actions] of Object.entries(EQUIPMENT_RIG))for(const [action,rows] of Object.entries(actions)){
  for(let row=0;row<8;row++)for(const pose of rows[row]){
   const reflected=['archer_male','archer'].includes(key) && action==='walk' && [3,4,5].includes(row);
   assert.equal(!!pose.mainFlipX,reflected,`${key}/${action}/${row}`);
  }
 }
});
