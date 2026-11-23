import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../js/game/game.js';
import {CLASSES} from '../js/data/classes.js';
function fixture(classId) {
 const cls=CLASSES[classId],ent={id:'player',x:1,y:1,attackTimer:0,action:{type:'attack',targetId:1},facing:{x:1,y:0}},char={classId,mp:0},unit={id:'player',ent,char,gcd:0},target={id:1,x:2,y:1,radius:.4},g=Object.create(Game.prototype),times=[];
 Object.assign(g,{time:0,cls,char,player:ent,leader:unit,autoMode:'normal',world:{hasLineOfSight:()=>true},mouse:{left:false},derived:()=>({speed:3}),findEntity:()=>target,pickTarget:()=>target,clearPath(){},unitAttack(){times.push(g.time)}});
 return {g,unit,target,times};
}
for(const mode of ['leader','mercenary'])test(`${mode}: normal attack cooldown follows class order and persists across target switches`,()=>{
 for(const [id,seconds] of [['knight',4],['mage',5],['priest',5],['warrior',6],['elf',6]]) {
  const {g,unit,target,times}=fixture(id);
  for(let n=0;n<500;n++){
   g.time+=.05;target.id=n%2+1;g.player.action.targetId=target.id;
   if(mode==='leader')g.updatePlayer(.05);else g.mercAI(unit,0,.05);
  }
  assert.ok(times.length>=4,`${id} keeps attacking`);
  for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]>=seconds-.000001&&times[i]-times[i-1]<=seconds+.051,`${id}: expected ${seconds}s, got ${times[i]-times[i-1]}`);
  assert.equal(g.char.mp,0);
 }
});
