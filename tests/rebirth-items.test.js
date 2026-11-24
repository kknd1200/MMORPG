import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { ITEMS, SHOPS, INVENTORY_SIZE } from '../js/data/items.js';
import { REBIRTH_ITEMS, rebirthDrops } from '../js/data/rebirth-items.js';
import { REBIRTH_ITEM_SOURCE } from '../js/data/rebirth-item-source.js';
import { equipmentSlot, equipmentTotals } from '../js/data/equipment.js';
import { attackPower, defense, itemModifiers } from '../js/systems/stats.js';
import { Game } from '../js/game/game.js';
import { MAPS } from '../js/data/maps.js';
import { MONSTERS } from '../js/data/monsters.js';
import { Hud } from '../js/game/hud.js';
const find=name=>Object.entries(REBIRTH_ITEMS).find(([,it])=>it.name===name)?.[0];
function fixture(classId='knight') {
  const g=Object.create(Game.prototype);
  g.char={name:'시험',classId,level:100,stats:{str:12,dex:12,int:12,con:12},equipment:{},inventory:[],gold:1e7,hp:1,maxHp:100,mp:10,maxMp:50};
  g.leader={id:'player',char:g.char,ent:{dead:false},buffs:[],isLeader:true};g.player=g.leader.ent;g.time=10;g.itemReadyAt=0;g.selUnit=()=>g.leader;
  g.hud={markDirty(){}};g.log=()=>{};g.floatText=()=>{};return g;
}
test('733 original names and cells retain stable IDs, every category, and legacy save IDs',()=>{
  assert.equal(REBIRTH_ITEM_SOURCE.length,733);assert.equal(Object.keys(REBIRTH_ITEMS).length,733);assert.equal(Object.keys(ITEMS).length,762);
  assert.equal(new Set(REBIRTH_ITEM_SOURCE.map(r=>r.name)).size,733);
  assert.equal(new Set(REBIRTH_ITEM_SOURCE.map(r=>r.xy.join(','))).size,733);
  const image=fs.readFileSync(new URL('../assets/items/rebirth-items.webp',import.meta.url));assert.ok(image.length>1e6);
  for(const r of REBIRTH_ITEM_SOURCE) {
    assert.equal(r.id,'rebirth_'+crypto.createHash('sha1').update(r.name).digest('hex').slice(0,12));
    const [x,y]=r.xy;assert.ok(x%64===0 && y%64===0 && x>=0 && y>=0 && x+64<=2048 && y+64<=1472);
    assert.ok(ITEMS[r.id].desc && ITEMS[r.id].icon);
  }
  assert.ok(ITEMS.training_sword && ITEMS.red_potion && ITEMS.chain_mail);
  assert.deepEqual([...new Set(Object.values(REBIRTH_ITEMS).map(it=>it.category))].sort(),['무기','방어구','장신구','화살','음식','물약','재료','전리품','상자'].sort());
});
test('new head, feet, legs and two rings equip separately and change real combat stats',()=>{
  const g=fixture(), bareAttack=attackPower(g.char),bareDefense=defense(g.char);
  for (const name of ['구리 투구','구리 철장화','구리 각반','마노 반지','자수정 반지']) { const id=find(name);assert.ok(id,name);g.addItem(id);g.equip(g.char.inventory.findIndex(e=>e.id===id)); }
  assert.equal(g.char.equipment.head,find('구리 투구'));assert.equal(g.char.equipment.feet,find('구리 철장화'));
  assert.ok(g.char.equipment.ring1 && g.char.equipment.ring2);assert.ok(equipmentTotals(g.char).def>=5);assert.ok(defense(g.char)>bareDefense);
  assert.ok(itemModifiers(g.char).goldPct>0 && itemModifiers(g.char).cdr>0);assert.ok(attackPower(g.char)>=bareAttack);
  g.unequip('ring2');assert.equal(g.char.equipment.ring2,null);assert.equal(itemModifiers(g.char).cdr || 0,0);
});
test('level and class requirements reject gear atomically; bows use the ranged slot',()=>{
  const g=fixture('elf'),bow=find('참나무 장궁');g.addItem(bow);g.equip(0);assert.equal(g.char.equipment.ranged,bow);assert.ok(attackPower(g.char)>8);
  const sword=find('강철 검');g.addItem(sword);g.equip(0);assert.equal(g.char.inventory[0].id,sword);assert.equal(g.char.equipment.ranged,bow);
  const knight=fixture();knight.char.level=1;knight.addItem(sword);knight.equip(0);assert.equal(knight.char.inventory[0].id,sword);assert.equal(knight.char.equipment.weapon,undefined);
});
test('two-handed equipment returns shields safely; a full bag cannot lose equipment',()=>{
  const g=fixture(),sword=find('구리 대검'),shield=find('구리 원형 방패');
  g.char.equipment={shield};g.addItem(sword);g.equip(0);assert.equal(g.char.equipment.shield,null);assert.equal(g.char.inventory[0].id,shield);
  g.equip(0);assert.equal(g.char.equipment.shield,null);assert.equal(g.char.inventory[0].id,shield);
  g.char.equipment={weapon:find('구리 검'),shield};g.char.inventory=Array.from({length:INVENTORY_SIZE},()=>({id:sword,qty:1}));
  const before=structuredClone(g.char);g.equip(0);assert.deepEqual(g.char,before);
});
test('materials stack, do not disappear on use, and recovery/cleanse consumables work',()=>{
  const g=fixture(),ore=find('구리 광석');g.addItem(ore,7);g.addItem(ore,3);assert.equal(g.char.inventory[0].qty,10);g.useItem(ore);assert.equal(g.char.inventory[0].qty,10);
  const food=find('건빵');g.addItem(food);g.useItem(food);assert.equal(g.char.hp,21);assert.equal(g.countItem(food),0);
  g.time++;const cleanse=find('하급 정화 물약');g.addItem(cleanse);g.leader.buffs=[{id:'st_poison'},{id:'test_buff'}];g.useItem(cleanse);assert.deepEqual(g.leader.buffs,[{id:'test_buff'}]);
});
test('all twenty chests have valid weighted contents and opening failure restores the chest',()=>{
  for(const [id,it] of Object.entries(REBIRTH_ITEMS).filter(([,it])=>it.type==='chest')) {
    assert.ok(it.contents.length,id);for(const c of it.contents) assert.ok(ITEMS[c.id] && c.weight>0 && c.min>0 && c.max>=c.min,c.name);
    const g=fixture();g.addItem(id);g.useItem(id);assert.equal(g.countItem(id),0);assert.ok(g.char.inventory.length>0);
    const full=fixture();full.addItem(id,2);while(full.char.inventory.length<INVENTORY_SIZE) full.char.inventory.push({id:'long_sword',qty:1});
    const before=structuredClone(full.char.inventory);full.useItem(id);assert.deepEqual(full.char.inventory,before);
  }
});
test('drop rolls have a bounded category budget and all imported items are obtainable',()=>{
  const attainable=new Set(Object.values(SHOPS).flat());
  for(const monster of Object.values(MONSTERS)) for(const drop of monster.drops) { assert.ok(ITEMS[drop.item] && drop.chance>0 && drop.chance<=1);attainable.add(drop.item); }
  for(const [id,it] of Object.entries(REBIRTH_ITEMS)) for(const c of it.contents || []) attainable.add(c.id);
  for(const id of Object.keys(REBIRTH_ITEMS)) assert.ok(attainable.has(id),ITEMS[id].name);
  for(const rank of ['normal','guard','boss']) for(const level of [1,10,50,100]) {
    const drops=rebirthDrops(level,rank);assert.ok(drops.reduce((sum,d)=>sum+d.chance,0)<=.906);
    if(rank==='normal') assert.ok(drops.every(d=>!ITEMS[d.item].source.unique && ITEMS[d.item].source.set==null));
  }
});
test('shops paginate hundreds of registered items and filters match item names',()=>{
  const h=Object.create(Hud.prototype),g=fixture();g.openNpc={kind:'smith'};h.game=g;
  const first=h.npcHtml();assert.equal((first.match(/data-shop-item=/g)||[]).length,24);assert.match(first,/data-shop-category/);
  h.shopQuery='투구';const filtered=h.npcHtml();assert.match(filtered,/투구/);assert.doesNotMatch(filtered,/data-shop-item="training_sword"/);
});
