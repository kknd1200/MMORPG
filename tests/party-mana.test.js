import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../js/game/game.js';
import {SKILLS} from '../js/data/skills.js';
import {CLASSES} from '../js/data/classes.js';
import {formatVital, refreshPartyVitals} from '../js/ui/party-vitals.js';
function setup(classId,skillId) {
 const char={classId,level:50,hp:100,maxHp:100,mp:100,maxMp:100,stats:CLASSES[classId].baseStats,skillSlots:[{id:skillId,cond:'always'}]};
 const unit={id:'merc1',isLeader:false,char,ent:{x:1,y:1,attackTimer:0,lastHurt:0,facing:{x:1,y:0}},cooldowns:{},buffs:[]};
 const leader={id:'player',isLeader:true,char:{...char,mp:80},ent:{x:1,y:1},cooldowns:{},buffs:[]};
 const target={id:1,x:2,y:1,radius:.4,dead:false},g=Object.create(Game.prototype);
 Object.assign(g,{leader,char:leader.char,player:leader.ent,party:[unit],time:1,world:{hasLineOfSight:()=>true},monsters:[target],effects:[],derived:()=>({attack:10}),floatText(){},fx(){},skillHit(){},addProjectile:()=>.2});
 return {g,unit,leader,target};
}
test('every mercenary attack skill spends its own MP and cooldown without draining the leader',()=>{
 for(const [id,skillId] of [['knight','power_strike'],['elf','piercing_shot'],['mage','fire_bolt'],['priest','holy_bolt'],['warrior','ground_smash']]) {
  const {g,unit,leader,target}=setup(id,skillId),sk=SKILLS[skillId];
  assert.equal(g.autoSkill(unit,target),true);assert.equal(unit.char.mp,100-sk.mp);assert.equal(leader.char.mp,80);assert.equal(unit.cooldowns[skillId],1+sk.cooldown);
  assert.equal(g.autoSkill(unit,target),false);g.time+=sk.cooldown+1;unit.char.mp=sk.mp-1;assert.equal(g.autoSkill(unit,target),false);assert.equal(unit.char.mp,sk.mp-1);
 }
});
test('priest healing and party buffs charge the caster rather than their recipients',()=>{
 const {g,unit,leader}=setup('priest','heal');leader.char.hp=20;g.castSelfSkill(SKILLS.heal,unit);assert.equal(unit.char.mp,100-SKILLS.heal.mp);assert.equal(leader.char.mp,80);assert.ok(leader.char.hp>20);
 g.addBuff=()=>{};g.castSelfSkill(SKILLS.blessing,unit);assert.equal(unit.char.mp,100-SKILLS.heal.mp-SKILLS.blessing.mp);assert.equal(leader.char.mp,80);
});
test('party detail MP numbers refresh on spend and regeneration without replacing controls',()=>{
 const {g,unit}=setup('mage','fire_bolt');const node={dataset:{unitId:'merc1',unitVital:'mp'},textContent:formatVital(unit.char,'mp')},root={querySelectorAll:()=>[node]};
 g.spend(SKILLS.fire_bolt,unit);refreshPartyVitals(root,g);assert.equal(node.textContent,`MP ${100-SKILLS.fire_bolt.mp} / 100`);
 unit.char.mp+=3;refreshPartyVitals(root,g);assert.equal(node.textContent,`MP ${103-SKILLS.fire_bolt.mp} / 100`);
});
