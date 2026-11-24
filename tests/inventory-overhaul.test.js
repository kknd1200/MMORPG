import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,INVENTORY_SIZE} from '../js/data/items.js';
import {dismantle,exchangeStones,improvedItem,inventoryCategory,inventorySubtype} from '../js/systems/inventory-tools.js';
import {promoteRoster} from '../js/systems/roster.js';
import {createEquipmentInstance,hydrateItemInstances} from '../js/systems/item-instances.js';
import {activeBook} from '../js/systems/loadout.js';
import {enhancementKind,enhancementChance} from '../js/systems/enhancement.js';
import * as Store from '../js/systems/storage.js';
import {Hud} from '../js/game/hud.js';
import {ItemTooltip} from '../js/ui/item-tooltip.js';
import {createCharacter} from '../js/systems/stats.js';
const find=name=>Object.keys(ITEMS).find(id=>ITEMS[id].name===name);
test('inventory is 100 slots and item tabs have useful category and subtype mappings',()=>{
 assert.equal(INVENTORY_SIZE,100);assert.equal(inventoryCategory(ITEMS.long_sword),'무기');assert.equal(inventorySubtype(ITEMS[find('흑운 단검')]),'단검');assert.equal(inventoryCategory(ITEMS[find('마노 반지')]),'장신구');assert.equal(inventorySubtype(ITEMS[find('마노 반지')]),'반지');
});
test('enhanced items require explicit confirmation, yield one matching stone and leave other copies alone',()=>{
 for(const [base,kind] of [['long_sword','weapon'],['cloth_armor','armor'],[find('마노 반지'),'accessory']]){
  const o={inventory:[]},id=createEquipmentInstance(o,base);o.itemInstances[id].enhance=3;hydrateItemInstances(o);o.inventory=[{id,qty:1},{id:base,qty:1}];
  const before=structuredClone(o);assert.equal(dismantle(o,0,id).confirm,true);assert.deepEqual(o,before);
  assert.equal(dismantle(o,0,id,true).ok,true);assert.ok(o.inventory.some(e=>e.id===base));assert.ok(o.inventory.some(e=>e.id===kind+'_dismantle_stone' && e.qty===1));
  assert.equal(dismantle(o,0,id,true).ok,false);
 }
});
test('100 matching stones exchange atomically, including full-bag failure and exact-stack success',()=>{
 for(const kind of ['weapon','armor','accessory']){
  const o={inventory:[{id:kind+'_dismantle_stone',qty:99}]};assert.equal(exchangeStones(o,kind).ok,false);o.inventory[0].qty=200;
  while(o.inventory.length<100)o.inventory.push({id:'long_sword',qty:1});const before=structuredClone(o);assert.equal(exchangeStones(o,kind).ok,false);assert.deepEqual(o,before);
  o.inventory[0].qty=100;assert.equal(exchangeStones(o,kind).ok,true);assert.equal(o.inventory.length,100);assert.ok(o.inventory.some(e=>e.id===kind+'_enchant_scroll'));
 }
 assert.equal(enhancementKind(find('마노 반지')),'accessory');assert.equal(enhancementChance('accessory',5),.13);
});
test('better options flag an upgrade even when base damage is unchanged',()=>{
 const c={equipment:{weapon:'training_sword'}};assert.equal(improvedItem('long_sword',c),true);assert.equal(improvedItem('red_potion',c),false);
 const o={},id=createEquipmentInstance(o,'long_sword');ITEMS[id].bonuses={accPct:.05};c.equipment.weapon='long_sword';assert.equal(improvedItem(id,c),true);
});
test('representative swapping preserves both characters, shared progress and personal skill ownership',()=>{
 const o={id:'original',name:'old',growth:{hpRollSum:12},equipment:{weapon:'long_sword'},inventory:[{id:'red_potion',qty:5}],gold:999,itemInstances:{},mapId:'town',party:[{id:'recruit',name:'new',classId:'mage',hp:80,growth:{hpRollSum:30},equipment:{weapon:'oak_staff'},mercSkillBook:[{id:'fire_bolt',level:1}],skillSlots:[{id:'fire_bolt'}],hotbar:[]}]};
 const before=structuredClone(o),n=promoteRoster(o,'recruit');assert.deepEqual(o,before);assert.equal(n.id,'recruit');assert.equal(n.partySaveId,'original');assert.equal(n.gold,999);assert.equal(n.inventory[0].qty,5);assert.equal(n.party[0].id,'original');assert.equal(n.party[0].growth.hpRollSum,12);assert.equal(n.party[0].equipment.weapon,'long_sword');assert.equal(activeBook(n)[0].id,'fire_bolt');
 const back=promoteRoster(n,'original');assert.equal(back.id,'original');assert.equal(back.party[0].id,'recruit');assert.equal(back.gold,999);
});
test('saving a promoted representative replaces the same account slot rather than duplicating characters',()=>{
 const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 memory.set('dawnland.v1',JSON.stringify({accounts:{qa:{characters:[{id:'old'}]}}}));
 Store.saveCharacter('qa',{id:'new',partySaveId:'old',inventory:[],party:[]});assert.equal(Store.listCharacters('qa').length,1);assert.equal(Store.listCharacters('qa')[0].id,'new');delete globalThis.localStorage;
});

test('filtered inventory keeps original bag indices and all 100 cells remain in the full view',()=>{
 const char=createCharacter({id:'hero',name:'Hero',classId:'knight',stats:{str:18,dex:11,int:8,con:12}});
 char.inventory=[{id:'red_potion',qty:2},{id:'long_sword',qty:1},{id:'cloth_armor',qty:1}];
 const unit={id:'player',char},h=Object.create(Hud.prototype);h.game={char,selUnit:()=>unit,units:()=>[unit],countItem:()=>0};
 assert.equal((h.invHtml().match(/class="cell /g)||[]).length,100);
 h.invTab='무기';let html=h.invHtml();assert.match(html,/data-inv="1"/);assert.doesNotMatch(html,/data-inv="0"/);assert.match(html,/bag-upgrade/);
 h.invTab='분해';html=h.invHtml();assert.match(html,/data-inv="2"/);assert.doesNotMatch(html,/data-inv="0"/);assert.equal((html.match(/data-exchange-stone=/g)||[]).length,3);
});

test('enhanced equipment warning is a separate non-destructive step and cancel leaves it intact',()=>{
 const char={inventory:[]},id=createEquipmentInstance(char,'long_sword');char.itemInstances[id].enhance=6;hydrateItemInstances(char);char.inventory=[{id,qty:1}];
 const h=Object.create(Hud.prototype);h.open=new Set();h.showItemDialog=html=>h.html=html;h.game={char,dismantleItem:(...a)=>dismantle(char,...a)};
 h.showDismantle(id);h.dismantleAction(false);assert.match(h.html,/정말로 삭제/);assert.match(h.html,/data-dismantle-confirm="yes"/);assert.equal(char.inventory[0].id,id);
 h.itemContext=null;h.dismantleAction(true);assert.equal(char.inventory[0].id,id);
 h.showDismantle(id);h.dismantleAction(false);h.closeItem=()=>{h.itemContext=null;};h.dismantleAction(true);assert.equal(char.inventory[0].id,'weapon_dismantle_stone');
});

test('hover comparison follows equipment, closes on departure and cleans up old HUD listeners',()=>{
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 const makeTarget=id=>({dataset:{itemHover:id},getAttribute:()=>null,setAttribute(){},removeAttribute(){},contains(node){return node===this || node?.parent===this;}});
 const listeners=new Map(),root={innerHTML:'',append(){},addEventListener(name,fn){const a=listeners.get(name)||[];a.push(fn);listeners.set(name,a);},removeEventListener(name,fn){listeners.set(name,(listeners.get(name)||[]).filter(x=>x!==fn));},querySelector:s=>s==='.item-overlay'?{addEventListener(){}}:null};
 globalThis.document={createElement:()=>({hidden:true,style:{},setAttribute(){},getBoundingClientRect:()=>({width:310,height:300}),remove(){}})};globalThis.window={innerWidth:1000,innerHeight:800};
 try {
  const unit={char:{name:'Hero',classId:'knight',equipment:{weapon:'training_sword'}}},g={selUnit:()=>unit};
  const t=new ItemTooltip(root,g),a=makeTarget('long_sword'),b=makeTarget('steel_blade');t.show(a,10,10);const html=t.el.innerHTML;
  const fire=(name,event={})=>{for(const fn of listeners.get(name)||[])fn(event);};
  const child={parent:a};fire('pointerout',{relatedTarget:child});assert.equal(t.el.hidden,false);
  fire('pointerout',{relatedTarget:null});assert.equal(t.target,null);assert.equal(t.el.hidden,true);
  t.show(a,10,10);t.show(b,50,50);assert.equal(t.target,b);assert.notEqual(t.el.innerHTML,html);t.refresh();assert.equal(t.el.hidden,false);
  fire('pointerleave');assert.equal(t.el.hidden,true);
  t.show(a,10,10,true);fire('focusout',{relatedTarget:child});assert.equal(t.el.hidden,false);fire('focusout',{relatedTarget:b});assert.equal(t.el.hidden,true);
  t.show(a,10,10);fire('pointermove',{target:{closest:()=>null},clientX:90,clientY:90});assert.equal(t.el.hidden,true);
  t.show(a,10,10);fire('scroll');assert.equal(t.el.hidden,true);
  a.isConnected=false;root.contains=node=>node===b;document.elementFromPoint=()=>({closest:()=>b});t.show(a,10,10);t.refresh();assert.equal(t.target,b);
  b.isConnected=false;document.elementFromPoint=()=>null;t.refresh();assert.equal(t.el.hidden,true);
  t.destroy();assert.ok([...listeners.values()].every(a=>a.length===0));
  const h=Object.create(Hud.prototype);h.root=root;h.game=g;h.bindPanelEvents();assert.ok([...listeners.values()].some(a=>a.length));h.destroy();assert.ok([...listeners.values()].every(a=>a.length===0));
 } finally {globalThis.document=oldDocument;globalThis.window=oldWindow;}
});
