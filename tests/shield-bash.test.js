import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../js/game/game.js';
import {SKILLS} from '../js/data/skills.js';
import {actionDur, frameAt, hitTimes} from '../js/data/chars.js';
const make=gender=>{
 const char={classId:'knight',gender,stats:{str:18},level:20,mp:100},ent={x:0,y:0,attackTimer:0},u={char,ent,cooldowns:{}};
 const g=Object.create(Game.prototype),calls={fx:[],hit:[]};
 Object.assign(g,{time:1,leader:u,derived:()=>({attack:10}),spend(){},floatText(){},face(){},fx(...args){calls.fx.push(args)},skillHit(...args){calls.hit.push(args)}});return {g,u,calls};
};
for(const gender of ['male','female'])test(`shield bash ${gender}: authored animation completes and shield impact matches damage`,()=>{
 const {g,u,calls}=make(gender),sprite=gender==='female'?'knight_female':'knight',target={x:1,y:0};
 g.castTargetSkill(SKILLS.shield_bash,target,u);
 const duration=actionDur(sprite,'skill');assert.equal(u.ent.castAnim,duration);assert.equal(u.ent.castAnimDuration,duration);assert.equal(u.ent.attackTimer,duration);assert.equal(u.ent.skillMotionUntil,g.time+duration);
 const seen=new Set();for(let t=0;t<duration;t+=1/60)seen.add(frameAt(sprite,'skill',t));assert.equal(seen.size,8);assert.ok(seen.has(7));
 const hitTime=calls.hit[0][5],effectStart=calls.fx[0][2];assert.equal(hitTime,hitTimes(sprite,'skill').at(-1));assert.ok(Math.abs(effectStart+4/16*.6-hitTime)<1e-9);
 g.time=1.2;assert.equal(g.canCast(SKILLS.power_strike,true,u),false);g.time=1+duration+.001;assert.equal(g.canCast(SKILLS.power_strike,true,u),true);
});
test('other skills keep their current duration and immediate hit schedule',()=>{
 const {g,u,calls}=make('male');g.castTargetSkill(SKILLS.power_strike,{x:1,y:0},u);assert.equal(u.ent.castAnimDuration,.4);assert.equal(calls.hit[0][5],.06);assert.equal(calls.fx[0][2],.06);
});
