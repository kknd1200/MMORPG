import test from 'node:test';
import assert from 'node:assert/strict';
import {PASSIVES} from '../js/data/passives.js';
import {CLASSES} from '../js/data/classes.js';
import {SKILLS} from '../js/data/skills.js';
import {ensureLoadout,activeBook,passiveBook,setPassive,passiveModifiers} from '../js/systems/loadout.js';
import {mercOffers,createMerc,fillSlots} from '../js/systems/party.js';
import * as S from '../js/systems/stats.js';
import {Game} from '../js/game/game.js';
import {Hud} from '../js/game/hud.js';
const char=id=>({id,classId:id,name:id,level:50,stats:{...CLASSES[id].baseStats},equipment:{},mp:100,hp:100,maxHp:100,maxMp:100,hotbar:[]});
test('every class has four active options and four passives, with exactly two slots each',()=>{
 assert.equal(Object.keys(PASSIVES).length,20);
 for(const id of Object.keys(CLASSES)){const c=char(id);ensureLoadout(c);assert.equal(activeBook(c).length,4);assert.equal(passiveBook(c).length,4);assert.equal(c.skillSlots.length,2);assert.equal(c.passiveSlots.length,2);assert.equal(new Set(c.passiveSlots).size,2);}
});
test('migration preserves old four active choices in the book, trims equipment to two, and does not refill intentionally empty slots',()=>{
 const c=char('knight');c.skillSlots=['charge_strike','judgment_blade','earth_splitter','shield_bash'].map(id=>({id,cond:'boss'}));
 ensureLoadout(c);assert.deepEqual(activeBook(c).map(e=>e.id),['charge_strike','judgment_blade','earth_splitter','shield_bash']);assert.equal(c.skillSlots[0].cond,'boss');
 c.skillSlots[0]=null;c.passiveSlots[0]=null;fillSlots(c);assert.equal(c.skillSlots[0],null);assert.equal(c.passiveSlots[0],null);
 const copy=JSON.parse(JSON.stringify(c));ensureLoadout(copy);assert.deepEqual(copy,c);
});
test('only selected passives apply, duplicates do not stack and foreign class passives are rejected',()=>{
 const c=char('knight');ensureLoadout(c);const baseline=S.defense({...c,passiveSlots:[]});assert.equal(S.defense(c),baseline+3);
 assert.equal(setPassive(c,0,'warrior_passive_1'),false);assert.equal(setPassive(c,2,'knight_passive_3'),false);
 setPassive(c,0,null);assert.equal(S.defense(c),baseline);
 setPassive(c,0,'knight_passive_2');assert.equal(passiveModifiers(c).accPct,.05);
 c.passiveSlots=['knight_passive_2','knight_passive_2'];assert.equal(passiveModifiers(c).accPct,.05);
});
test('attack, movement, skill damage, cooldown and mana recovery passive values reach live combat modifiers',()=>{
 const w=char('warrior');ensureLoadout(w);const bare=S.attackPower({...w,passiveSlots:[]});assert.equal(S.attackPower(w),bare*1.08);
 const e=char('elf');ensureLoadout(e);setPassive(e,0,'elf_passive_3');assert.equal(S.derivedStats(e).speed,4.4);
 const m=char('mage');ensureLoadout(m);setPassive(m,0,'mage_passive_3');setPassive(m,1,'mage_passive_4');assert.equal(S.itemModifiers(m).skillDmg,.1);
 const u={char:m,ent:{},buffs:[],cooldowns:{}};const g=Object.assign(Object.create(Game.prototype),{time:1,leader:u});g.spend(SKILLS.fire_bolt,u);assert.equal(u.cooldowns.fire_bolt,1+1.5*.92);assert.equal(m.mp,95);
 const p=char('priest');ensureLoadout(p);setPassive(p,0,'priest_passive_4');assert.equal(S.itemModifiers(p).mpRegen,2);
});
test('manual casting rejects unselected active skills and passive selection does not consume MP',()=>{
 const c=char('knight');ensureLoadout(c);const g=Object.assign(Object.create(Game.prototype),{time:1,log(){}}),u={char:c,ent:{},cooldowns:{}};
 assert.equal(g.canCast(SKILLS[c.skillSlots[0].id],true,u),true);const unselected=activeBook(c).find(e=>!c.skillSlots.some(s=>s?.id===e.id));assert.equal(g.canCast(SKILLS[unselected.id],true,u),false);
 const mp=c.mp;setPassive(c,0,'knight_passive_3');assert.equal(c.mp,mp);
});
test('mercenary personal active books survive the new two-active two-passive loadout',()=>{
 for(const offer of mercOffers('town',30,100)){const c=createMerc(offer,'merc');assert.deepEqual(c.mercSkillBook,offer.mercSkillBook);assert.equal(c.skillSlots.length,2);assert.equal(c.passiveSlots.length,2);const saved=JSON.parse(JSON.stringify(c));fillSlots(saved);assert.deepEqual(saved.passiveSlots,c.passiveSlots);}
});
test('party UI exposes two active slots and four passive choices for each of two passive selectors',()=>{
 const c=char('knight');ensureLoadout(c);const u={id:'player',char:c,isLeader:true};const g={selUnit:()=>u,units:()=>[u],derived:()=>({attack:10,defense:5})};const html=Hud.prototype.partyHtml.call({game:g});
 assert.equal((html.match(/data-pslot=/g)||[]).length,2);assert.equal((html.match(/data-passive-slot=/g)||[]).length,2);for(const p of passiveBook(c))assert.ok(html.includes(p.name));
});
