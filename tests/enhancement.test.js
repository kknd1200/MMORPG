import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, SHOPS, SMITH_MAX_ITEM_LEVEL } from '../js/data/items.js';
import { createEquipmentInstance, hydrateItemInstances, pruneItemInstances, rollEquipment } from '../js/systems/item-instances.js';
import { enhanceEquipment, enhancementKind, enhancementChance } from '../js/systems/enhancement.js';
import { equipmentTotals } from '../js/data/equipment.js';
import { attackPower, defense, itemModifiers } from '../js/systems/stats.js';
import { Game } from '../js/game/game.js';
import { Hud } from '../js/game/hud.js';
import { itemIcon } from '../js/ui/item-icons.js';
import { itemComparisonMarkup } from '../js/ui/item-tooltip.js';
import * as Store from '../js/systems/storage.js';
const find=name=>Object.keys(ITEMS).find(id=>ITEMS[id].name===name);
const owner=()=>({id:'player',name:'시험기사',classId:'knight',level:100,stats:{str:12,dex:12,int:12,con:12},equipment:{},inventory:[],party:[],hotbar:[],gold:10000,hp:50,maxHp:50});
const members=o=>[{id:'player',char:o},...o.party.map((char,i)=>({id:'merc'+i,char}))];
const scrollFor=kind=>kind+'_enchant_scroll';
const target=(o,index=0)=>({kind:'bag',index,id:o.inventory[index].id});

test('target enhancement levels use the exact requested weapon and armor probabilities',()=>{
  assert.deepEqual(Array.from({length:13},(_,i)=>enhancementChance('weapon',i+1)),[1,1,1,1,1,1,.13,.03,.015,.005,.005,.005,.005]);
  assert.deepEqual(Array.from({length:11},(_,i)=>enhancementChance('armor',i+1)),[1,1,1,1,.13,.03,.015,.005,.005,.005,.005]);
  assert.equal(enhancementChance('weapon',0),0);assert.equal(enhancementChance('ring',5),0);
});

test('success and failure boundaries consume one scroll and destroy only the selected copy',()=>{
  for(const kind of ['weapon','armor']) for(const [next,rate] of (kind==='weapon'?[[7,.13],[8,.03],[9,.015],[10,.005],[15,.005]]:[[5,.13],[6,.03],[7,.015],[8,.005],[15,.005]])) {
    for(const succeeds of [true,false]) {
      const o=owner(),base=kind==='weapon'?'long_sword':'cloth_armor';
      const id=createEquipmentInstance(o,base);o.itemInstances[id].enhance=next-1;hydrateItemInstances(o);
      const untouched=createEquipmentInstance(o,base);o.inventory=[{id,qty:1},{id:untouched,qty:1},{id:scrollFor(kind),qty:2}];
      const result=enhanceEquipment(o,scrollFor(kind),target(o),members(o),()=>succeeds ? rate-1e-8 : rate);
      assert.equal(result.success,succeeds,`${kind} +${next}`);assert.equal(o.inventory.find(e=>e.id===scrollFor(kind)).qty,1);
      assert.ok(o.itemInstances[untouched]);assert.ok(o.inventory.some(e=>e.id===untouched));
      if(succeeds){assert.equal(o.itemInstances[id].enhance,next);assert.ok(o.inventory.some(e=>e.id===id));}
      else {assert.equal(o.itemInstances[id],undefined);assert.equal(ITEMS[id],undefined);assert.ok(!o.inventory.some(e=>e.id===id));}
    }
  }
});

test('safe enhancements always succeed without RNG and add one attack or defense per level',()=>{
  for(const kind of ['weapon','armor']) {
    const o=owner(),base=kind==='weapon'?'long_sword':'cloth_armor',max=kind==='weapon'?6:4;
    o.inventory=[{id:base,qty:1},{id:scrollFor(kind),qty:max}];
    for(let i=1;i<=max;i++) {
      const r=enhanceEquipment(o,scrollFor(kind),target(o),members(o),()=>{throw Error('guaranteed upgrades should not roll');});
      assert.ok(r.success);assert.equal(ITEMS[o.inventory[0].id][kind==='weapon'?'atk':'def'],ITEMS[base][kind==='weapon'?'atk':'def']+i);
    }
    assert.equal(o.inventory.filter(e=>e.id===scrollFor(kind)).length,0);assert.equal(ITEMS[base].enhance,undefined);
  }
});

test('drops roll each copy independently, preserve catalog templates and retain values on equip/save/reload',()=>{
  const o=owner(),base=find('강철 단검'),snapshot=structuredClone(ITEMS[base]);
  const a=createEquipmentInstance(o,base,{randomize:true,rng:()=>0}),b=createEquipmentInstance(o,base,{randomize:true,rng:()=>.9999});
  o.inventory=[{id:a,qty:1},{id:b,qty:1}];assert.notEqual(a,b);assert.notEqual(ITEMS[a].atk,ITEMS[b].atk);assert.notEqual(ITEMS[a].bonuses.critRate,ITEMS[b].bonuses.critRate);
  assert.deepEqual(ITEMS[base],snapshot);assert.ok(!Object.keys(ITEMS).includes(a));assert.ok(!SHOPS.smith.includes(a));
  const saved=JSON.parse(JSON.stringify(o)),stats=structuredClone(ITEMS[a]);delete ITEMS[a];delete ITEMS[b];hydrateItemInstances(saved);assert.deepEqual(ITEMS[a],stats);
  const g=Object.create(Game.prototype);g.char=saved;g.leader={id:'player',char:saved};g.selUnit=()=>g.leader;g.log=()=>{};g.hud={markDirty(){}};
  g.equip(0);assert.equal(g.char.equipment.weapon,a);assert.equal(equipmentTotals(g.char).atk,stats.atk);assert.equal(itemModifiers(g.char).critRate,stats.bonuses.critRate);
  const actual=attackPower(g.char);g.unequip('weapon');g.equip(g.char.inventory.findIndex(e=>e.id===a));assert.equal(attackPower(g.char),actual);
  assert.match(itemIcon(a),/rebirth-items.webp/);assert.match(itemIcon(createEquipmentInstance(o,'long_sword')),/icons.webp/);
  const compare=itemComparisonMarkup({selUnit:()=>g.leader},b);assert.ok(compare.includes(String(ITEMS[b].atk)));assert.match(compare,/치명타/);
});

test('wrong scroll, missing scroll, accessories and stale targets never spend or change anything',()=>{
  const cases=[{scroll:'armor_enchant_scroll',id:'long_sword'},{scroll:'weapon_enchant_scroll',id:find('마노 반지')},{scroll:'armor_enchant_scroll',id:find('마노 반지')},{scroll:'weapon_enchant_scroll',id:'long_sword',stale:true},{scroll:'weapon_enchant_scroll',id:'long_sword',missing:true}];
  for(const c of cases) {
    const o=owner();o.inventory=[{id:c.id,qty:1},...(!c.missing?[{id:c.scroll,qty:2}]:[])];
    const t=target(o);if(c.stale)t.id='training_sword';const before=structuredClone(o);
    assert.equal(enhanceEquipment(o,c.scroll,t,members(o)).ok,false);assert.deepEqual(o,before);
  }
});

test('equipped mercenary gear can be upgraded or destroyed without affecting leader or second ring',()=>{
  const o=owner();o.equipment.weapon='training_sword';const merc={name:'용병',classId:'warrior',equipment:{weapon:'battle_axe'}};o.party=[merc];o.inventory=[{id:'weapon_enchant_scroll',qty:10}];
  const t={kind:'equipped',unitId:'merc0',slot:'weapon',id:'battle_axe'};
  let result=enhanceEquipment(o,'weapon_enchant_scroll',t,members(o));assert.ok(result.success);const id=merc.equipment.weapon;
  assert.equal(o.equipment.weapon,'training_sword');o.itemInstances[id].enhance=6;hydrateItemInstances(o);
  result=enhanceEquipment(o,'weapon_enchant_scroll',{...t,id},members(o),()=>.99);assert.equal(result.success,false);assert.equal(merc.equipment.weapon,null);assert.equal(o.equipment.weapon,'training_sword');
});

test('a full bag can enhance existing gear and a stale second click cannot consume another scroll',()=>{
  const o=owner();o.inventory=[{id:'long_sword',qty:1},{id:'weapon_enchant_scroll',qty:2},...Array.from({length:22},()=>({id:'cloth_armor',qty:1}))];const t=target(o);
  assert.ok(enhanceEquipment(o,'weapon_enchant_scroll',t,members(o)).success);const after=structuredClone(o);
  assert.equal(enhanceEquipment(o,'weapon_enchant_scroll',t,members(o)).ok,false);assert.deepEqual(o,after);
});

test('smith offers black-cloud tier gear and no stronger or boss items; scrolls are available at merchant',()=>{
  assert.equal(SMITH_MAX_ITEM_LEVEL,36);assert.ok(SHOPS.smith.includes(find('흑운 단검')));
  for(const name of ['미스릴 단검','수정 단검','룬 단검','역린 단검','타락 단검'])assert.ok(!SHOPS.smith.includes(find(name)),name);
  for(const id of SHOPS.smith)if(ITEMS[id].source){assert.ok(ITEMS[id].level<=36);assert.ok(!ITEMS[id].source.unique && ITEMS[id].source.set==null);}
  assert.ok(SHOPS.merchant.includes('weapon_enchant_scroll'));assert.ok(SHOPS.merchant.includes('armor_enchant_scroll'));
});

test('shop equipment is individual but fixed; drop and chest acquisition can request random rolls',()=>{
  const g=Object.create(Game.prototype);g.char=owner();g.log=()=>{};g.hud={markDirty(){}};
  g.openNpc={kind:'smith'};g.buy('long_sword',2);const [a,b]=g.char.inventory;assert.notEqual(a.id,b.id);assert.equal(ITEMS[a.id].atk,ITEMS.long_sword.atk);assert.equal(g.char.itemInstances[a.id].randomized,false);
  const base=find('강철 단검');g.addItem(base,2,{randomize:true});const drops=g.char.inventory.slice(2);assert.equal(drops.length,2);assert.ok(drops.every(e=>g.char.itemInstances[e.id].randomized));
});

test('local storage restores randomized and enhanced equipped items and prunes sold instances',()=>{
  const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k) || null,setItem:(k,v)=>memory.set(k,v)};
  const o=owner(),a=createEquipmentInstance(o,'long_sword',{randomize:true,rng:()=>.2}),sold=createEquipmentInstance(o,'cloth_armor');o.equipment.weapon=a;o.itemInstances[a].enhance=6;hydrateItemInstances(o);
  memory.set('dawnland.v1',JSON.stringify({accounts:{qa:{characters:[o]}}}));Store.saveCharacter('qa',o);assert.equal(o.itemInstances[sold],undefined);
  const atk=ITEMS[a].atk;delete ITEMS[a];const restored=Store.listCharacters('qa')[0];assert.equal(restored.equipment.weapon,a);assert.equal(ITEMS[a].atk,atk);assert.equal(ITEMS[a].enhance,6);
  delete globalThis.localStorage;
});

test('enhancement picker shows exact next-level odds and destruction warning; repeated selection cannot retry',()=>{
  const o=owner(),id=createEquipmentInstance(o,'long_sword');o.itemInstances[id].enhance=6;hydrateItemInstances(o);o.inventory=[{id,qty:1},{id:'weapon_enchant_scroll',qty:2}];
  const h=Object.create(Hud.prototype);h.game={char:o,player:{dead:false},countItem:()=>2,units:()=>members(o),enhance:(scroll,t)=>enhanceEquipment(o,scroll,t,members(o),()=>.99)};
  h.showItemDialog=html=>{h.html=html;};h.open=new Set();h.beginEnhancement('weapon_enchant_scroll');assert.match(h.html,/성공 13%/);assert.match(h.html,/실패 시.*파괴/);assert.match(h.html,/data-enhance-target="0"/);
  h.selectEnhancement(0);assert.match(h.html,/장비 파괴/);const left=o.inventory.find(e=>e.id==='weapon_enchant_scroll').qty;h.selectEnhancement(0);assert.equal(o.inventory.find(e=>e.id==='weapon_enchant_scroll').qty,left);
});

test('inventory double-click cancels the single-click description and opens selection without consuming a scroll',()=>{
  const oldDocument=globalThis.document, oldSet=globalThis.setTimeout, oldClear=globalThis.clearTimeout;
  const timers=new Map();let serial=0;
  globalThis.document={createElement:()=>({setAttribute(){}})};
  globalThis.setTimeout=fn=>{const id=++serial;timers.set(id,fn);return id;};globalThis.clearTimeout=id=>timers.delete(id);
  try {
    const listeners=new Map(),overlayListeners=new Map();
    const overlay={addEventListener:(name,fn)=>overlayListeners.set(name,fn)};
    const root={append(){},addEventListener(name,fn){const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list);},querySelector:selector=>selector==='.item-overlay'?overlay:null};
    const o=owner();o.inventory=[{id:'weapon_enchant_scroll',qty:2},{id:'long_sword',qty:1}];
    const h=Object.create(Hud.prototype);h.root=root;h.open=new Set(['inv']);h.showItemDialog=html=>{h.html=html;};h.renderPanel=()=>{};
    h.game={char:o,player:{dead:false},countItem:id=>o.inventory.find(e=>e.id===id)?.qty || 0,units:()=>members(o),enhance:(scroll,t)=>enhanceEquipment(o,scroll,t,members(o))};
    h.bindPanelEvents();
    const cell={dataset:{inv:'0'}};const itemTarget={closest:selector=>selector==='[data-inv]'?cell:null};
    for(const detail of [1,2])for(const fn of listeners.get('click'))fn({type:'click',detail,target:itemTarget});
    assert.equal(h.itemContext,undefined);assert.equal(timers.size,1);
    for(const fn of listeners.get('dblclick'))fn({target:itemTarget,preventDefault(){}});
    assert.equal(timers.size,0);assert.equal(h.itemContext.mode,'enhancement');assert.equal(o.inventory[0].qty,2);
    assert.match(h.html,/강화할 장비 선택/);
    const button={dataset:{enhanceTarget:'0'}},event={target:{classList:{contains:()=>false},closest:selector=>selector==='[data-enhance-target]'?button:null}};
    overlayListeners.get('click')(event);overlayListeners.get('click')(event);
    assert.equal(o.inventory[0].qty,1);assert.equal(ITEMS[o.inventory[1].id].enhance,1);
  } finally {globalThis.document=oldDocument;globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});
