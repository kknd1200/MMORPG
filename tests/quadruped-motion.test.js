import test from 'node:test';
import assert from 'node:assert/strict';
import {ROSTER} from '../js/data/rebirth-roster.js';
import {Game} from '../js/game/game.js';
import {quadrupedWalkPose,quadrupedAttackPose,drawQuadrupedFrame,QUADRUPED_ATTACK_SECONDS,QUADRUPED_SKILL_SECONDS,QUADRUPED_IMPACT} from '../js/game/quadruped-motion.js';

test('eight quadruped steps use diagonal pairs, keep support and settle all feet at rest',()=>{
 const poses=new Set();
 for(let f=0;f<8;f++){
  const phase=(f+.1)/8*Math.PI*2,p=quadrupedWalkPose(phase);assert.equal(p.frame,f);
  assert.deepEqual(p.legs[0],p.legs[3]);assert.deepEqual(p.legs[1],p.legs[2]);
  assert.ok(Math.abs(p.legs[0].stride+p.legs[1].stride)<1e-10);
  assert.equal(Math.min(...p.legs.map(p=>p.lift)),0);poses.add(JSON.stringify(p));
  assert.ok(quadrupedWalkPose(phase,0).legs.every(p=>p.stride===0&&p.lift===0));
 }
 assert.equal(poses.size,8);assert.equal(quadrupedWalkPose(-.1).frame,7);
});
test('nine attack stages anticipate, rear, strike and return to the same ready artwork',()=>{
 const p=Array.from({length:9},(_,i)=>quadrupedAttackPose((i+.1)/9));
 assert.ok(p[2].crouch>p[0].crouch);assert.ok(p[4].rear>p[2].rear);assert.ok(p[5].reach>p[4].reach);
 assert.equal(p[0].col,p[8].col);assert.equal(p[8].rear,0);assert.equal(p[8].reach,0);
 for(let i=0;i<9;i++){assert.equal(p[i].frame,i);assert.equal(quadrupedAttackPose((i+.1)/9,true).col,p[i].col+4)}
 assert.equal(quadrupedAttackPose(1).frame,8);
});
test('all 55 quadrupeds retain their own atlas row and positive complete foot patches',()=>{
 const defs=ROSTER.filter(d=>d.family==='quadruped');assert.equal(defs.length,55);
 for(const d of defs)for(const mode of ['walk','attack','skill','dead'])for(let f=0;f<(mode==='walk'?8:9);f++){
  const calls=[],ctx={save(){},restore(){},translate(){},rotate(){},scale(){},transform(){},drawImage(...a){calls.push(a)}};
  const sheet={src:{},cell:192},attack=mode==='attack'||mode==='skill';
  const height=drawQuadrupedFrame(ctx,sheet,d,{walkPhase:(f+.1)/8*Math.PI*2,walkWeight:1,attackAnim:attack?1:0,animKind:mode,dead:mode==='dead'},(f+.1)/9,58);
  assert.ok(height>=58);assert.ok(calls.length);for(const a of calls){assert.equal(a[0],sheet.src);assert.ok(a.slice(1).every(Number.isFinite));assert.ok(a[3]>0&&a[4]>0&&a[7]>0&&a[8]>0);assert.ok(a[2]>=d.art.row*192&&a[2]+a[4]<=(d.art.row+1)*192)}
  if(attack||mode==='dead')assert.equal(calls.length,1);
 }
});
function fixture(){
 const m={id:1,attackAnim:0},target={ent:{x:1,y:0},char:{}},g=Object.create(Game.prototype),hits=[];
 Object.assign(g,{time:10,monsters:[m],pending:[],effects:[],hasAttackLine:()=>true,monsterHit:(...args)=>{hits.push(args);return true},floatText(){},fx(){},applyStatus(){}});
 return {g,m,target,hits,def:{family:'quadruped',active:[{name:'발톱',mult:1,effect:'bleed'}],skillCooldown:5}};
}
test('quadruped strike waits for its paw impact and cancels on death, unloading or blocked line',()=>{
 for(const cancel of ['none','death','target-death','unload','wall']){
  const {g,m,target,hits,def}=fixture();g.monsterAttack(m,def,target);
  assert.equal(m.animDur,QUADRUPED_ATTACK_SECONDS);assert.equal(hits.length,0);assert.equal(g.pending[0].at,10+QUADRUPED_ATTACK_SECONDS*QUADRUPED_IMPACT);
  if(cancel==='death')m.dead=true;if(cancel==='target-death')target.ent.dead=true;if(cancel==='unload')g.monsters=[];if(cancel==='wall')g.hasAttackLine=()=>false;
  g.pending[0].fn();assert.equal(hits.length,cancel==='none'?1:0);
 }
});
test('skill strikes use nine stages and finish planted before chase can interrupt them',()=>{
 const {g,m,target,hits,def}=fixture();g.monsterSkill(m,def,target);assert.equal(m.animDur,QUADRUPED_SKILL_SECONDS);assert.equal(hits.length,0);g.pending[0].fn();assert.equal(hits.length,1);
 assert.doesNotThrow(()=>g.monsterBrain(m,def,null,0,false,.05,target));
});
test('other monster families keep their immediate attack and timing',()=>{
 const {g,m,target,hits,def}=fixture();def.family='biped';g.monsterAttack(m,def,target);assert.equal(m.animDur,.4);assert.equal(hits.length,1);assert.equal(g.pending.length,0);
});
