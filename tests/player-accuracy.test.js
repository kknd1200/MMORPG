import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../js/data/classes.js';
import { SKILLS } from '../js/data/skills.js';
import { Game } from '../js/game/game.js';
import * as S from '../js/systems/stats.js';
import { monsterBase } from '../js/systems/balance.js';

const mapping={knight:['str','power_strike'],warrior:['str','ground_smash'],elf:['dex','piercing_shot'],mage:['int','fire_bolt'],priest:['int','holy_light']};
function fixture(classId,role) {
  const char={classId,level:20,stats:{str:10,dex:10,int:10,con:10},equipment:{}},ent={x:0,y:0,facing:{x:1,y:0}},unit={char,ent,buffs:[],isLeader:role==='leader'};
  const target={x:1,y:0,level:20,eva:.05,mr:.1,armor:0},calls={hits:0,misses:0},g=Object.create(Game.prototype);
  Object.assign(g,{leader:role==='leader'?unit:{char:{classId:'mage',stats:{int:60}}},world:{hasLineOfSight:()=>true},time:1,
    derived:()=>({attack:10}),fx(){},addProjectile:()=>0,aggro(){},floatText(_m,text){if(text==='MISS')calls.misses++;},damageMonster(){calls.hits++;}});
  return {g,unit,char,target,calls};
}
for(const role of ['leader','mercenary'])for(const [classId,[stat,skillId]] of Object.entries(mapping)) {
  test(`${role} ${classId}: increasing ${stat} improves actual basic and skill hit rolls`,()=>{
    const {g,unit,char,target,calls}=fixture(classId,role),old=Math.random;
    Math.random=()=>stat==='int'?.79:.69;
    try {
      const basic=()=>g.unitAttack(unit,target),skill=()=>g.skillHit(SKILLS[skillId],target,60,10,0,0,unit);
      basic();skill();assert.equal(calls.hits,0);assert.equal(calls.misses,2);
      for(const key of ['str','dex','int'])if(key!==stat)char.stats[key]=60;
      basic();skill();assert.equal(calls.hits,0,'unrelated attributes must not improve accuracy');
      char.stats[stat]=14;basic();skill();assert.equal(calls.hits,2,'both actual attack paths use this unit primary stat');
    } finally {Math.random=old;}
  });
}
test('one primary-stat point adds two percentage points before caps, reflected in character stats',()=>{
  for(const [classId,[stat]] of Object.entries(mapping)) {
    const {char,target}=fixture(classId,'leader'),before=S.playerHitChance(char,target);
    char.stats[stat]++;assert.ok(Math.abs(S.playerHitChance(char,target)-before-.02)<1e-9);
    const shown=S.derivedStats(char,[{accPct:.01}]);
    const neutral={level:char.level,eva:0,mr:0};assert.equal(shown.hit,S.playerHitChance(char,neutral,[{accPct:.01}]));assert.equal(shown.skillHit,shown.hit);
  }
});
test('equipment accuracy applies once to both basic and skill attacks, with existing caps retained',()=>{
  for(const [classId,[stat,skillId]] of Object.entries(mapping)) {
    const {g,unit,char,target,calls}=fixture(classId,'leader');unit.buffs=[{accPct:.1}];
    const base=S.playerHitChance(char,target);assert.ok(Math.abs(S.playerHitChance(char,target,unit.buffs)-base-.1)<1e-9);
    const old=Math.random;Math.random=()=>base+.15;
    try {g.unitAttack(unit,target);g.skillHit(SKILLS[skillId],target,10,10,0,0,unit);assert.equal(calls.hits,0,'a second accuracy bonus would incorrectly turn these into hits');}finally{Math.random=old;}
    char.stats[stat]=60;assert.ok(S.playerHitChance(char,target,unit.buffs)<=.98);
  }
});
test('mage/priest basic accuracy uses intelligence and magic resistance rather than physical evasion',()=>{
  for(const classId of ['mage','priest']) {
    const {char,target}=fixture(classId,'leader'),baseline=S.playerHitChance(char,target);
    assert.equal(S.playerHitChance(char,{...target,eva:.9}),baseline);
    assert.ok(S.playerHitChance(char,{...target,mr:.4})<baseline);
  }
});

test('one-second player cadence does not automatically raise existing monster stats',()=>{
  const previous=[
    {level:1,hp:32,atk:5,exp:4,gold:[1,5]},
    {level:10,hp:59,atk:14,exp:145,gold:[8,25]},
    {level:50,hp:180,atk:54,exp:1086,gold:[40,113]},
    {level:99,hp:698,atk:124,exp:2252,gold:[79,221]},
  ];
  for(const {level,...stats} of previous)assert.deepEqual(monsterBase(level),stats);
});
