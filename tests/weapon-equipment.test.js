import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ITEMS,canEquip,INVENTORY_SIZE,SHOPS} from '../js/data/items.js';
import {WEAPON_TYPES} from '../js/data/weapon-rules.js';
import {EXTRA_EQUIPMENT,HAND_ATLAS} from '../js/data/extra-equipment.js';
import {equipmentTotals,equipmentBonuses} from '../js/data/equipment.js';
import {migrateEquipment} from '../js/systems/equipment-migration.js';
import {Game} from '../js/game/game.js';
import {equipmentArt,visibleEquipment} from '../js/game/equipment-art.js';
import {createEquipmentInstance,hydrateItemInstances} from '../js/systems/item-instances.js';
import {enhanceEquipment,enhancementKind} from '../js/systems/enhancement.js';
import {dismantleKind} from '../js/systems/inventory-tools.js';
import {equipmentMarkup} from '../js/ui/equipment.js';
import {avatarMarkup} from '../js/ui/portraits.js';
import {CLASSES} from '../js/data/classes.js';
const find=name=>Object.keys(ITEMS).find(id=>ITEMS[id].name===name);
const classes=['knight','warrior','elf','mage','priest'];
const fixture=classId=>{
 const g=Object.create(Game.prototype);g.char={id:'hero',name:'Hero',classId,level:100,equipment:{},inventory:[],gold:999,party:[]};
 g.leader={id:'player',char:g.char};g.selUnit=()=>g.leader;g.hud={markDirty(){}};g.log=()=>{};return g;
};
test('every weapon and shield obeys exactly the requested class/type matrix, including random copies',()=>{
 const found=new Set();
 for(const [id,it] of Object.entries(ITEMS)){
  if(!it.weaponType)continue;found.add(it.weaponType);
  for(const cls of classes)assert.equal(canEquip(id,cls,100),!!WEAPON_TYPES[it.weaponType]?.classes.includes(cls),`${it.name} / ${cls}`);
  if(WEAPON_TYPES[it.weaponType])assert.equal(!!it.twoHanded,!!WEAPON_TYPES[it.weaponType].twoHanded);
 }
 for(const kind of Object.keys(WEAPON_TYPES))assert.ok(found.has(kind),kind);
 const o={},id=createEquipmentInstance(o,find('수정 전투도끼'),{randomize:true});assert.equal(canEquip(id,'knight',100),false);assert.equal(canEquip(id,'warrior',100),true);
});
test('unsupported daggers, maces, crossbows and wands cannot bypass restrictions through game actions',()=>{
 for(const cls of classes)for(const name of ['강철 단검','구리 철퇴','참나무 석궁','마노 완드']){
  const g=fixture(cls),id=find(name);assert.ok(id,name);g.char.inventory=[{id,qty:1}];const before=structuredClone(g.char);g.equip(0);assert.deepEqual(g.char,before);
 }
});
test('staff and orb equip together only on mages and orb enhancement uses weapon scrolls',()=>{
 const g=fixture('mage');g.char.inventory=[{id:'oak_staff',qty:1},{id:'orb_0',qty:1}];g.equip(0);g.equip(0);
 assert.equal(g.char.equipment.weapon,'oak_staff');assert.equal(g.char.equipment.shield,'orb_0');assert.equal(equipmentTotals(g.char).atk,ITEMS.oak_staff.atk+ITEMS.orb_0.atk);
 assert.equal(enhancementKind('orb_0'),'weapon');assert.equal(dismantleKind(ITEMS.orb_0),'weapon');
 g.char.inventory=[{id:'weapon_enchant_scroll',qty:1}];const r=enhanceEquipment(g.char,'weapon_enchant_scroll',{kind:'equipped',unitId:'player',slot:'shield',id:'orb_0'},[g.leader]);assert.ok(r.success);assert.equal(ITEMS[g.char.equipment.shield].atk,ITEMS.orb_0.atk+1);
 const html=equipmentMarkup({...g,units:()=>[g.leader]});assert.match(html,/오브/);assert.match(html,/data-equipment-slot="shield"/);
});
test('old incompatible equipped gear is returned intact even when the bag is full, and migration is idempotent',()=>{
 const owner={classId:'knight',level:100,inventory:Array.from({length:INVENTORY_SIZE},()=>({id:'red_potion',qty:1})),equipment:{weapon:find('구리 대검')},party:[{classId:'priest',level:100,equipment:{weapon:'training_mace',shield:find('구리 원형 방패')}}]};
 const id=createEquipmentInstance(owner,find('흑운 대검'));owner.equipment.weapon=id;owner.itemInstances[id].enhance=7;hydrateItemInstances(owner);
 migrateEquipment(owner);assert.equal(owner.equipment.weapon,null);assert.equal(owner.party[0].equipment.shield,null);assert.equal(owner.party[0].equipment.weapon,'training_mace');assert.equal(owner.inventory.length,102);assert.ok(owner.inventory.some(e=>e.id===id));assert.equal(ITEMS[id].enhance,7);
 const snapshot=structuredClone(owner);migrateEquipment(owner);assert.deepEqual(owner,snapshot);
});
test('legacy bows move into the ranged slot and illegal equipment contributes neither stats nor bonuses',()=>{
 const ch={classId:'elf',level:100,inventory:[],equipment:{weapon:'training_bow'}};migrateEquipment(ch);assert.equal(ch.equipment.ranged,'training_bow');assert.equal(ch.inventory.length,0);
 ch.equipment={weapon:find('구리 기사검'),shield:find('구리 원형 방패')};assert.deepEqual(equipmentTotals(ch),{atk:0,def:0});assert.deepEqual(equipmentBonuses(ch),{});
 for(const [cls,data] of Object.entries(CLASSES))for(const id of Object.values(data.startEquipment))assert.ok(canEquip(id,cls,1),`${cls} starter ${id}`);
});
test('new orb and hornbow art exists, is available from drops/shops, and equipped images use item-specific cells',()=>{
 assert.equal(Object.keys(EXTRA_EQUIPMENT).length,18);assert.ok(fs.existsSync(new URL('../assets/'+HAND_ATLAS.path,import.meta.url)));
 for(const id of ['orb_0','hornbow_0'])assert.ok(SHOPS.smith.includes(id));
 const sword=ITEMS[find('강철 검')],axe=ITEMS[find('강철 도끼')];assert.notDeepEqual(equipmentArt(sword).xy,equipmentArt(axe).xy);
 const state={classId:'mage',level:100,equipment:{weapon:'oak_staff',shield:'orb_0'}};assert.equal(visibleEquipment(state).off,ITEMS.orb_0);state.equipment.shield='orb_5';assert.equal(visibleEquipment(state).off,ITEMS.orb_5);state.classId='knight';assert.deepEqual(visibleEquipment(state),{main:null,off:null});
 const html=avatarMarkup({classId:'mage',level:100,equipment:{weapon:'oak_staff',shield:'orb_5'}});assert.match(html,/data-shield="orb_5"/);
});
