import test from 'node:test';
import assert from 'node:assert/strict';
import {mercOffers,createMerc,skillBook,learnedSkills,fillSlots,MERC_CLASSES} from '../js/systems/party.js';
import {SKILLS} from '../js/data/skills.js';
import {CLASSES} from '../js/data/classes.js';
import {Game} from '../js/game/game.js';
import {Hud} from '../js/game/hud.js';

test('recruits have stable, distinct personal skill builds with two starter techniques and two growth unlocks',()=>{
 const variety=new Map(MERC_CLASSES.map(id=>[id,new Set()]));
 for(let h=100;h<150;h++)for(let roll=0;roll<3;roll++){
  const offers=mercOffers('town1',1,h,4,[],roll),keys=[];
  assert.deepEqual(offers,mercOffers('town1',1,h,4,[],roll));
  for(const o of offers){
   const book=o.mercSkillBook;assert.equal(book.length,4);assert.equal(new Set(book.map(e=>e.id)).size,4);assert.deepEqual(book.map(e=>e.level),[1,1,15,30]);
   assert.ok(book.every(e=>SKILLS[e.id].classId===o.classId));assert.ok(book.slice(0,2).some(e=>['damage','chain','aoe_target'].includes(SKILLS[e.id].kind)));
   const key=book.map(e=>e.id).sort().join(':');keys.push(key);variety.get(o.classId).add(key);
  }
  assert.equal(new Set(keys).size,4);
 }
 for(const builds of variety.values())assert.ok(builds.size>10);
});
test('hired skill book survives save, source changes, and growth without acquiring unowned class skills',()=>{
 for(const o of mercOffers('town1',1,100)){
  const ch=createMerc(o,'test'),original=JSON.parse(JSON.stringify(o.mercSkillBook));
  assert.deepEqual(ch.mercSkillBook,original);o.mercSkillBook[0].level=99;assert.deepEqual(ch.mercSkillBook,original);
  const restored=JSON.parse(JSON.stringify(ch));
  for(const [lv,count] of [[1,2],[14,2],[15,3],[29,3],[30,4],[99,4]]){
   restored.level=lv;fillSlots(restored);assert.equal(learnedSkills(restored).length,count);assert.equal(restored.skillSlots.filter(Boolean).length,count);assert.deepEqual(restored.mercSkillBook,original);
   assert.ok(restored.skillSlots.filter(Boolean).every(e=>original.some(x=>x.id===e.id)));
  }
 }
});
test('casting enforces individual ownership and personal unlock levels without changing leader or old mercenary rules',()=>{
 const o=mercOffers('town1',1,101)[0],ch=createMerc(o,'test');ch.mp=100;
 const u={char:ch,ent:{},cooldowns:{}},g=Object.assign(Object.create(Game.prototype),{time:1,log(){}});
 for(const e of ch.mercSkillBook)assert.equal(g.canCast(SKILLS[e.id],true,u),e.level<=ch.level);
 const unowned=CLASSES[ch.classId].skills.find(id=>!ch.mercSkillBook.some(e=>e.id===id));ch.level=99;assert.equal(g.canCast(SKILLS[unowned],true,u),false);
 ch.skillSlots[0]={id:unowned,cond:'always'};fillSlots(ch);assert.ok(ch.skillSlots.every(e=>!e||e.id!==unowned));
 for(const isMerc of [false,true]){
  const legacy={classId:'knight',isMerc,level:1,mp:100},unit={char:legacy,ent:{},cooldowns:{}};
  assert.equal(skillBook(legacy).length,8);assert.equal(g.canCast(SKILLS.power_strike,true,unit),true);assert.equal(g.canCast(SKILLS.shield_bash,true,unit),false);
 }
});
test('recruiter preview and party skill list show the personal repertoire and the same unlock requirements',()=>{
 const offers=mercOffers('town1',1,100),o=offers[0],ch=createMerc(o,'test'),u={id:'merc1',char:ch,ent:{}};
 const g={char:{gold:1000},party:[],mercOffers:()=>offers};const html=Hud.prototype.mercHtml.call({game:g});
 for(const offer of offers)for(const e of offer.mercSkillBook)assert.ok(html.includes(SKILLS[e.id].name));
 Object.assign(g,{units:()=>[u],selUnit:()=>u,derived:()=>({attack:10,defense:5})});const party=Hud.prototype.partyHtml.call({game:g});
 for(const e of ch.mercSkillBook)assert.ok(party.includes(SKILLS[e.id].name));
 for(const id of CLASSES[ch.classId].skills.filter(id=>!ch.mercSkillBook.some(e=>e.id===id)))assert.ok(!party.split('<div class="pskills">')[1].split('</div>\n      <small')[0].includes(`title="${SKILLS[id].name} (`));
 assert.ok(party.includes('Lv.15'));assert.ok(party.includes('Lv.30'));
});
