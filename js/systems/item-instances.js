import { ITEMS } from '../data/items.js';
import { modifierText } from '../data/rebirth-items.js';

let serial=0;
const round=(n,d=2)=>Number(n.toFixed(d));
export const isEquipment=item=>!!item && ['weapon','armor'].includes(item.type);
export function rollEquipment(base, rng=Math.random) {
  const roll={bonuses:{}};
  for (const key of ['atk','def']) if (base[key]!=null) roll[key]=round(base[key]*(.8+rng()*.4));
  for (const [key,value] of Object.entries(base.bonuses || {})) roll.bonuses[key]=round(value*(.5+rng()),4);
  return roll;
}
export function registerInstance(id,record) {
  const base=ITEMS[record.baseId];
  if (!id.startsWith('gear_') || !isEquipment(base) || base.instanceId || !Number.isSafeInteger(record.enhance) || record.enhance<0) return false;
  const rolled=record.roll || {}, enhanced=record.enhance;
  const values={};
  for (const key of ['atk','def']) if (base[key]!=null) values[key]=Number.isFinite(rolled[key]) ? rolled[key] : base[key];
  if (base.type==='weapon') values.atk=round((values.atk || 0)+enhanced);
  else values.def=round((values.def || 0)+enhanced);
  const bonuses={...base.bonuses};
  for (const key of Object.keys(bonuses)) if (Number.isFinite(rolled.bonuses?.[key])) bonuses[key]=rolled.bonuses[key];
  const item={...base,...values,bonuses,instanceId:id,baseId:record.baseId,enhance:enhanced,name:`${enhanced ? '+'+enhanced+' ' : ''}${base.name}`};
  const stats=[values.atk!=null ? `일반공격 +${round(values.atk)}` : '', values.def!=null ? `방어력 +${round(values.def)}` : '', modifierText(bonuses)].filter(Boolean).join(' · ');
  item.desc=`${base.source?.lore || base.group || base.category || '장비'}. ${record.randomized ? '드롭 시 부여된 무작위 수치' : '고정 수치'} · 강화 +${enhanced}. ${stats}. 필요 레벨 ${base.minLevel || 1}.`;
  if (base.source?.setBonuses) item.desc+=` 세트 2부위: ${modifierText(base.source.setBonuses['2'])} · 4부위 추가: ${modifierText(base.source.setBonuses['4'])}.`;
  Object.defineProperty(ITEMS,id,{value:item,writable:true,configurable:true,enumerable:false});
  return true;
}
export function createEquipmentInstance(owner, baseId, {randomize=false,rng=Math.random}={}) {
  const base=ITEMS[baseId];
  if (!isEquipment(base) || base.instanceId) throw new Error('장비 원본 ID가 필요합니다.');
  const id='gear_'+(globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}_${++serial}_${Math.random().toString(36).slice(2)}`);
  const record={baseId,enhance:0,randomized:randomize,roll:randomize ? rollEquipment(base,rng) : {atk:base.atk,def:base.def,bonuses:{...base.bonuses}}};
  owner.itemInstances ??= {};owner.itemInstances[id]=record;registerInstance(id,record);return id;
}
export function hydrateItemInstances(owner) {
  for (const [id,record] of Object.entries(owner.itemInstances || {})) registerInstance(id,record);
  for (const member of owner.party || []) hydrateItemInstances(member);
  return owner;
}
export function forgetInstance(owner,id) {
  delete owner.itemInstances?.[id];
  for (const member of owner.party || []) delete member.itemInstances?.[id];
  if (ITEMS[id]?.instanceId) delete ITEMS[id];
  for (const member of [owner,...(owner.party || [])]) if (member.hotbar) member.hotbar=member.hotbar.map(e=>e?.type==='item' && e.id===id ? null : e);
}
export function pruneItemInstances(owner) {
  const owned=new Set((owner.inventory || []).map(e=>e.id));
  for (const member of [owner,...(owner.party || [])]) for (const id of Object.values(member.equipment || {})) if (id) owned.add(id);
  for (const member of [owner,...(owner.party || [])]) for (const id of Object.keys(member.itemInstances || {})) if (!owned.has(id)) forgetInstance(owner,id);
}
