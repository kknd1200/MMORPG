import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../js/game/game.js';
import {SKILLS} from '../js/data/skills.js';
import {actionDur, frameAt, hitTimes, CHAR_ANGLES} from '../js/data/chars.js';
import {SHIELD_BASH_MOTION,SHIELD_BASH_TIMING as T} from '../js/data/skill-motions.js';
import {advanceShieldBash,sweepSkillMove} from '../js/game/shield-bash.js';
import {drawHeroSheet} from '../js/game/hero-sheets.js';
import {loadImages} from '../js/game/art.js';

const monster=(x,y,id=1)=>({id,x,y,radius:.3,hp:100,maxHp:100,dead:false});
function make(gender='male') {
 const char={classId:'knight',gender,stats:{str:18},level:20,mp:100,equipment:{}},ent={id:'player',x:0,y:0,radius:.3,attackTimer:0},u={id:'player',char,ent,cooldowns:{},buffs:[]};
 const target=monster(1.5,0),near=monster(2.8,0,2),g=Object.create(Game.prototype),calls={fx:[],hit:[],aggro:[]};
 Object.assign(g,{world:{hasLineOfSight:()=>true,blocked:()=>false},time:1,leader:u,player:ent,char,party:[],monsters:[target,near],effects:[],derived:()=>({attack:10}),floatText(){},clearPath(){},fx(...args){calls.fx.push(args)},skillHit(...args){calls.hit.push(args)},aggro(m,unit){calls.aggro.push([m,unit]);}});
 const at=elapsed=>{g.time=1+elapsed;advanceShieldBash(g,u);};return {g,u,target,near,calls,at};
}
for(const gender of ['male','female'])test(`${gender}: shield-first charge, one collision, inward pull and full recovery share the dedicated frame clock`,()=>{
 const {g,u,target,near,calls,at}=make(gender),sprite=gender==='female'?'knight_female':'knight';
 assert.equal(g.castTargetSkill(SKILLS.shield_bash,target,u),true);
 assert.equal(u.char.mp,92);assert.equal(u.cooldowns.shield_bash,6);assert.equal(actionDur(sprite,'shield_bash'),1);assert.equal(u.ent.castAction,'shield_bash');
 assert.equal(u.ent.skillMotionUntil,2);assert.equal(u.ent.attackTimer,1);
 at(.1);assert.equal(u.ent.x,0);assert.equal(calls.hit.length,0);
 at(.23);assert.ok(u.ent.x>0 && u.ent.x<.65);assert.equal(calls.hit.length,0);
 at(T.impact);assert.equal(calls.hit.length,1);assert.ok(Math.abs(u.ent.x-.65)<1e-8);assert.equal(calls.fx[0][0].startFrame,4);assert.equal(calls.hit[0][5],0);
 const before=near.x;at(T.pullStart+.001);assert.ok(near.forcedPull);at(.55);assert.ok(near.x<before && near.x>1.6);
 at(T.pullEnd+.001);assert.ok(near.x<=1.600001);assert.equal(near.forcedPull,null);assert.ok(u.ent.shieldBash);assert.equal(g.tryBasicAttack(u,target),false);
 assert.equal(calls.hit.length,1);assert.ok(g.effects.some(f=>f.type==='ring' && f.inward));
 at(T.duration+.001);assert.equal(u.ent.shieldBash,null);assert.equal(u.ent.castAction,null);assert.equal(u.ent.castAnim,0);assert.equal(g.canCast(SKILLS.power_strike,true,u),true);
 assert.equal(hitTimes(sprite,'shield_bash')[0],T.impact);assert.equal(SHIELD_BASH_MOTION.frames.length,12);
});
test('pull excludes distant, dead and obscured monsters, including walls that appear after cast',()=>{
 const {g,u,target,near,at}=make();const behind=monster(0,2.5,3),outside=monster(5,0,4),dead={...monster(2,-1,5),dead:true};g.monsters.push(behind,outside,dead);
 g.world.hasLineOfSight=(_x,y,_tx,ty)=>y<=1 && ty<=1;
 g.castTargetSkill(SKILLS.shield_bash,target,u);at(.5);assert.ok(near.forcedPull);assert.equal(behind.forcedPull,undefined);assert.equal(outside.forcedPull,undefined);assert.equal(dead.forcedPull,undefined);
 const x=near.x;g.world.hasLineOfSight=()=>false;at(.6);assert.equal(near.x,x);assert.equal(near.forcedPull,null);
});
test('swept movement prevents dash and pull from crossing thin obstacles at low frame rates',()=>{
 const world={hasLineOfSight:()=>true,blocked:x=>x>.4 && x<.5},e={x:0,y:0,radius:.1};assert.equal(sweepSkillMove(world,e,{x:1,y:0}),false);assert.ok(e.x<=.4);
 const {g,u,target,calls,at}=make();g.castTargetSkill(SKILLS.shield_bash,target,u);g.world.blocked=x=>x>.4 && x<.5;at(.5);assert.ok(u.ent.x<=.4);assert.equal(calls.hit.length,0);assert.ok(!g.monsters.some(m=>m.forcedPull));
 const pull=make();pull.g.castTargetSkill(SKILLS.shield_bash,pull.target,pull.u);pull.at(.39);pull.g.world.blocked=x=>x>1.8 && x<1.9;pull.at(.8);assert.ok(pull.near.x>=1.9);
});
test('out of range, hidden and stale targets cannot spend MP or start a charge',()=>{
 for(const condition of ['range','hidden','stale','dead']) {
  const {g,u,target}=make();if(condition==='range')target.x=5;if(condition==='hidden')g.world.hasLineOfSight=()=>false;if(condition==='stale')g.monsters=[];if(condition==='dead')target.dead=true;
  assert.equal(g.castTargetSkill(SKILLS.shield_bash,target,u),false);assert.equal(u.char.mp,100);assert.equal(u.cooldowns.shield_bash,undefined);assert.equal(u.ent.shieldBash,undefined);
 }
});
test('death, despawn and map changes cancel the remaining collision/pull work safely',()=>{
 for(const condition of ['death','world','despawn']) {
  const {g,u,target,near,calls,at}=make();g.castTargetSkill(SKILLS.shield_bash,target,u);
  if(condition==='death')u.ent.dead=true;if(condition==='world')g.world={...g.world};if(condition==='despawn')g.monsters=[];
  at(.6);assert.equal(calls.hit.length,0);assert.ok(!near.forcedPull);
 }
 const {g,u,target,near,at}=make();g.castTargetSkill(SKILLS.shield_bash,target,u);at(.5);const x=near.x;u.ent.dead=true;at(.6);assert.equal(near.x,x);assert.equal(near.forcedPull,null);assert.equal(u.ent.shieldBash,null);
});
test('leader and mercenary movement remain locked while charging and attacks cannot overwrite recovery',()=>{
 const {g,u,target,at}=make();g.castTargetSkill(SKILLS.shield_bash,target,u);
 g.mouse={left:true,mode:'move',wx:8,wy:8};g.updatePlayer(.05);g.leaderAI(.05);g.mercAI(u,0,.05);assert.equal(u.ent.x,0);
 at(.8);u.ent.attackTimer=0;assert.equal(g.tryBasicAttack(u,target),false);assert.equal(g.canCast(SKILLS.power_strike,true,u),false);
});
test('pull starts after the collision and does not double-hit or drag already-nearby enemies outward',()=>{
 const {g,u,target,calls,at}=make();g.castTargetSkill(SKILLS.shield_bash,target,u);at(.38);assert.ok(!target.forcedPull);const x=target.x;
 for(const t of [.4,.5,.6,.7,1.1])at(t);assert.equal(target.x,x);assert.equal(calls.hit.length,1);assert.equal(u.char.mp,92);
});
test('other skills retain their existing cast duration and hit schedule',()=>{
 const {g,u,calls}=make();g.castTargetSkill(SKILLS.power_strike,{x:1,y:0},u);assert.equal(u.ent.castAnimDuration,.4);assert.equal(calls.hit[0][5],.06);assert.equal(calls.fx[0][2],.06);
});
test('all 8 directions and both genders actually draw remapped source frames, including recovery',async()=>{
 globalThis.Image=class{set src(url){this.url=url;this.height=1280;queueMicrotask(()=>this.onload());}};
 await loadImages(['chars/knight/skill.webp','chars/knight_female/skill.webp']);
 for(const gender of ['male','female'])for(const angle of CHAR_ANGLES)for(const t of [.03,.19,.33,.5,.67,.76,.85,.95]) {
  const calls=[],ctx={save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(...args){calls.push(args);}};
  drawHeroSheet(ctx,0,0,{classId:'knight',gender,castAction:'shield_bash',cast:1-t,facing:{x:Math.cos(angle),y:Math.sin(angle)}});
  assert.equal(calls.length,1);assert.equal(calls[0][1],frameAt(gender==='female'?'knight_female':'knight','shield_bash',t)*160);assert.match(calls[0][0].url,/\/skill.webp$/);
  assert.ok(calls[0][1]>=0 && calls[0][1]<1280);
 }
});
