import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../js/game/game.js';
import {CLASSES} from '../js/data/classes.js';
function fixture(classId) {
 const cls=CLASSES[classId],ent={id:'player',x:1,y:1,attackTimer:0,action:{type:'attack',targetId:1},facing:{x:1,y:0}},char={classId,mp:0},unit={id:'player',ent,char,gcd:0},target={id:1,x:2,y:1,radius:.4},g=Object.create(Game.prototype),times=[];
 Object.assign(g,{time:0,cls,char,player:ent,leader:unit,monsters:[target],autoMode:'normal',world:{hasLineOfSight:()=>true},mouse:{left:false},derived:()=>({speed:3}),findEntity:()=>target,pickTarget:()=>target,clearPath(){},unitAttack(){times.push(g.time)}});
 return {g,unit,target,times};
}
for(const mode of ['leader','mercenary'])test(`${mode}: every class uses a one-second normal attack cooldown and persists across target switches`,()=>{
 for(const [id,seconds] of [['knight',1],['mage',1],['priest',1],['warrior',1],['elf',1]]) {
  const {g,unit,target,times}=fixture(id);
  for(let n=0;n<1000;n++){
   g.time+=.05;target.id=n%2+1;g.player.action.targetId=target.id;
   if(mode==='leader')g.updatePlayer(.05);else g.mercAI(unit,0,.05);
  }
  assert.ok(times.length>=4,`${id} keeps attacking`);
  for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]>=seconds-.000001&&times[i]-times[i-1]<=seconds+.051,`${id}: expected ${seconds}s, got ${times[i]-times[i-1]}`);
  assert.equal(g.char.mp,0);
 }
});

function skillFixture(id) {
 const {g,unit,target,times}=fixture(id);
 const skills={knight:'power_strike',mage:'fire_bolt',priest:'holy_bolt',elf:'piercing_shot',warrior:'ground_smash'};
 Object.assign(unit.char,{level:50,hp:100,maxHp:100,mp:10000,maxMp:10000,stats:CLASSES[id].baseStats,skillSlots:[{id:skills[id],cond:'always'}]});
 Object.assign(unit,{cooldowns:{},buffs:[],isLeader:true});
 const casts=[];
 Object.assign(g,{party:[],monsters:[target],autoMode:'skill',derived:()=>({speed:3,attack:10}),fx(){},floatText(){},addProjectile:()=>.2,skillHit(){casts.push(g.time)}});
 g.unitAttack=()=>{times.push(g.time);unit.ent.attackAnim=.3};
 return {g,unit,target,times,casts};
}
for(const role of ['leader','mercenary'])test(`${role}: real auto skills never bypass the basic cooldown or overlap the basic animation`,()=>{
 for(const id of ['knight','mage','priest','warrior','elf']){
  const {g,unit,times,casts}=skillFixture(id);
  for(let n=0;n<1200;n++){
   g.time+=.05;
   if(role==='leader'){g.updatePlayer(.05);g.leaderAI(.05)}else g.mercAI(unit,0,.05);
  }
  assert.ok(times.length>=3,`${id} basic attacks remain active`);assert.ok(casts.length>=3,`${id} skills remain active`);
  for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]>=CLASSES[id].attackInterval-1e-8,`${id} basic interval too short`);
  for(const at of casts)for(const basic of times){const gap=basic-at;assert.ok(gap>=.4-1e-8||gap<=-.3+1e-8,`${id} skill ${at} overlaps basic ${basic}`)}
  assert.ok(unit.char.mp<10000);
 }
});
test('mode changes, target changes and clearing the relative timer do not bypass the absolute basic deadline',()=>{
 const {g,unit,target,times}=fixture('knight');assert.equal(g.tryBasicAttack(unit,target),true);
 g.autoMode='skill';unit.ent.attackTimer=0;g.time=.5;target.id=2;assert.equal(g.tryBasicAttack(unit,target),false);
 g.autoMode='normal';g.time=1;assert.equal(g.tryBasicAttack(unit,target),true);assert.deepEqual(times,[0,1]);
});
