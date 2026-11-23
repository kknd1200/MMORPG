import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentTotals } from '../js/data/equipment.js';
import { equipmentMarkup, itemDetailsMarkup } from '../js/ui/equipment.js';
import { Hud } from '../js/game/hud.js';
import { Game } from '../js/game/game.js';
const fixture=()=>{
 const leader={id:'player',isLeader:true,char:{name:'기사',classId:'knight',gold:999,equipment:{weapon:'training_sword',armor:'cloth_armor'},inventory:[{id:'long_sword',qty:1},{id:'oak_staff',qty:1}]}};
 const merc={id:'merc',char:{name:'법사',classId:'mage',equipment:{weapon:'training_staff'}}};
 const game={char:leader.char,selectedId:'merc',units:()=>[leader,merc],unitById:id=>[leader,merc].find(u=>u.id===id),selUnit(){return this.unitById(this.selectedId)},log(){},equip:Game.prototype.equip,unequip:Game.prototype.unequip};
 const hud=Object.create(Hud.prototype);Object.assign(hud,{game,dirty:new Set(),open:new Set()});game.hud=hud;hud.closeItem=()=>{hud.itemContext=null};return {game,hud,leader,merc};
};
test('inventory exposes each party member, 13 equipment slots and current equipment totals',()=>{
 const {game}=fixture();const html=equipmentMarkup(game);assert.equal((html.match(/data-equipment-slot=/g)||[]).length,13);assert.match(html,/data-sel="merc"/);assert.match(html,/data-sel="player"/);assert.deepEqual(equipmentTotals(game.selUnit().char),{atk:0,def:0});
});
test('item details include description, class requirements and selected-character comparison',()=>{
 const {game}=fixture();const html=itemDetailsMarkup(game,{id:'oak_staff',source:'bag',unitId:'merc'});assert.match(html,/현재 장비 대비/);assert.match(html,/법사/);assert.match(html,/data-item-action="equip"/);
 const wrong=itemDetailsMarkup(game,{id:'long_sword',source:'bag',unitId:'merc'});assert.match(wrong,/장착할 수 없는/);assert.match(wrong,/data-item-action="equip" disabled/);
});
test('popup equips and removes the selected mercenary equipment without changing leader',()=>{
 const {game,hud,leader,merc}=fixture();hud.itemContext={id:'oak_staff',source:'bag',unitId:'merc'};hud.itemAction('equip');assert.equal(merc.char.equipment.weapon,'oak_staff');assert.equal(leader.char.equipment.weapon,'training_sword');assert.ok(game.char.inventory.some(e=>e.id==='training_staff'));
 hud.itemContext={id:'oak_staff',source:'equipped',slot:'weapon',unitId:'merc'};hud.itemAction('unequip');assert.equal(merc.char.equipment.weapon,null);assert.ok(game.char.inventory.some(e=>e.id==='oak_staff'));
});
test('a stale popup cannot equip a different party member after selection changes',()=>{
 const {game,hud,merc}=fixture();hud.itemContext={id:'oak_staff',unitId:'merc'};game.selectedId='player';hud.itemAction('equip');assert.equal(merc.char.equipment.weapon,'training_staff');assert.ok(game.char.inventory.some(e=>e.id==='oak_staff'));
});
