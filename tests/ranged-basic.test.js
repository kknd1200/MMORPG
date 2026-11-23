import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CLASSES } from '../js/data/classes.js';
import { BASIC_FX } from '../js/data/skills.js';
import { Game } from '../js/game/game.js';
function fixture(classId,mode='normal') {
 const cls=CLASSES[classId],target={id:'enemy',x:5,y:0,radius:.4,armor:0},char={classId,level:1,mp:0,stats:{...cls.baseStats}},ent={id:'player',x:0,y:0,attackTimer:0,facing:{x:1,y:0},action:{type:'attack',targetId:target.id},dead:false};
 const u={id:'player',char,ent,isLeader:true,gcd:0},g=Object.create(Game.prototype);
 const calls={navigate:0,attacks:0,casts:0,projectiles:[]};
 Object.assign(g,{world:{hasLineOfSight:()=>true},cls,char,player:ent,leader:u,autoMode:mode,mouse:{left:false},time:1,findEntity:()=>target,derived:()=>({speed:3,attack:cls.baseAttack}),navigate(){calls.navigate++;return 'moving'},clearPath(){},autoSkill(){calls.casts++;return false},pickTarget:()=>target,unitAttack(){calls.attacks++}});
 return {g,u,target,calls};
}
for(const id of ['elf','mage','priest']) {
 test(`${id}: leader and mercenary basic attacks stop at range without MP or skills`,()=>{
   for(const mode of ['normal','skill']) {
     const {g,u,target,calls}=fixture(id,mode);
     g.updatePlayer(.05);assert.equal(calls.navigate,0);assert.equal(calls.attacks,1);assert.equal(g.player.x,0);assert.equal(g.char.mp,0);
     u.ent.attackTimer=0;g.mercAI(u,0,.05);assert.equal(calls.navigate,0);assert.equal(calls.attacks,2);
     if(mode==='normal')assert.equal(calls.casts,0);
     target.x=10;g.updatePlayer(.05);assert.equal(calls.navigate,1);
     g.mercAI(u,0,.05);assert.equal(calls.navigate,2);assert.equal(calls.attacks,2);
   }
 });
 test(`${id}: basic projectile uses existing art and delays hit effects until arrival`,()=>{
   const {g,u,target,calls}=fixture(id);g.unitAttack=Game.prototype.unitAttack;
   Object.assign(g,{addProjectile(from,to,kind,color,sheet){calls.projectiles.push({from,to,sheet});return .4},fx(fx,m,delay){assert.equal(delay,.4)},damageMonster(m,damage,color,delay){assert.equal(delay,.4)},floatText(m,text,color,size,delay){assert.equal(delay,.4)},aggro(){}});
   g.unitAttack(u,target);assert.equal(calls.projectiles.length,1);assert.equal(calls.projectiles[0].sheet,BASIC_FX[id].proj);assert.ok(fs.existsSync(new URL(`../assets/skills/${BASIC_FX[id].proj}.webp`,import.meta.url)));assert.equal(u.char.mp,0);assert.equal(CLASSES[id].attackType,'ranged');
 });
}
test('knight and warrior retain melee basic attacks',()=>{
 for(const id of ['knight','warrior']){const {g,calls}=fixture(id);g.updatePlayer(.05);assert.equal(calls.navigate,1);assert.equal(calls.attacks,0);assert.equal(CLASSES[id].attackRange,1.3);assert.equal(BASIC_FX[id].proj,undefined);}
});
