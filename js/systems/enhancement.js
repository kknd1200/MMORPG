import { ITEMS } from '../data/items.js';
import { createEquipmentInstance, registerInstance, forgetInstance } from './item-instances.js';

export function enhancementKind(itemOrId) {
  const item=typeof itemOrId==='string' ? ITEMS[itemOrId] : itemOrId;
  if (item?.type==='weapon') return 'weapon';
  if (item?.type==='armor' && (item.category==='장신구' || ['neck','ring1','ring2'].includes(item.slot))) return 'accessory';
  if (item?.type==='armor' && item.category!=='장신구' && !['neck','ring1','ring2'].includes(item.slot)) return 'armor';
  return null;
}
export function enhancementChance(kind, targetLevel) {
  if (!['weapon','armor','accessory'].includes(kind) || !Number.isSafeInteger(targetLevel) || targetLevel<1) return 0;
  const safe=kind==='weapon'?6:4, step=targetLevel-safe;
  return step<=0 ? 1 : step===1 ? .13 : step===2 ? .03 : step===3 ? .015 : .005;
}
export const enhancementPercent=rate=>`${+(rate*100).toFixed(2)}%`;

// Target is validated again when selected. No item or scroll changes on a stale selection.
export function enhanceEquipment(owner, scrollId, target, members, rng=Math.random) {
  const scroll=ITEMS[scrollId], inventory=owner.inventory || [], scrollEntry=inventory.find(e=>e.id===scrollId && e.qty>0);
  if (!scroll?.enhanceType || !scrollEntry) return {ok:false,error:'강화 주문서가 없습니다.'};
  let entry, member;
  if (target?.kind==='bag') entry=inventory[target.index];
  else if (target?.kind==='equipped') { member=members.find(u=>u.id===target.unitId); if (member?.char.equipment?.[target.slot]===target.id) entry={id:target.id,qty:1}; }
  if (!entry || entry.id!==target.id || entry.qty!==1 || enhancementKind(entry.id)!==scroll.enhanceType) return {ok:false,error:'선택한 장비가 바뀌었거나 강화할 수 없는 장비입니다.'};
  const original=ITEMS[entry.id], next=(original.enhance || 0)+1, chance=enhancementChance(scroll.enhanceType,next);
  let id=entry.id;
  if (!original.instanceId) {
    id=createEquipmentInstance(owner,id);
    if (member) member.char.equipment[target.slot]=id;
    else entry.id=id;
  }
  const record=owner.itemInstances?.[id] || members.map(u=>u.char.itemInstances?.[id]).find(Boolean);
  if (!record) return {ok:false,error:'장비 저장 정보를 확인할 수 없습니다.'};
  const success=chance===1 || rng()<chance;
  scrollEntry.qty--;if (!scrollEntry.qty) inventory.splice(inventory.indexOf(scrollEntry),1);
  if (success) { record.enhance=next;registerInstance(id,record); }
  else {
    if (member) member.char.equipment[target.slot]=null;
    else {const at=inventory.indexOf(entry);if(at>=0)inventory.splice(at,1);}
    forgetInstance(owner,id);
  }
  return {ok:true,success,id,name:ITEMS[original.baseId || record.baseId].name,level:next,chance};
}
