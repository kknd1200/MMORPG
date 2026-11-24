import {ITEMS,canEquip} from '../data/items.js';
import {equipmentSlot,slotAccepts} from '../data/equipment.js';
// Return incompatible saved gear intact. A temporarily overfull bag never deletes gear.
export function migrateEquipment(owner){
 owner.inventory ??=[];let returned=0;
 const retain=id=>{owner.inventory.push({id,qty:1});returned++;};
 for(const ch of [owner,...(owner.party || [])]){
  ch.equipment ??={};
  for(const [slot,id] of Object.entries(ch.equipment)){
   const it=ITEMS[id];if(!id || !it)continue;
   if(canEquip(id,ch.classId,ch.level || 1) && slotAccepts(slot,id))continue;
   ch.equipment[slot]=null;
   const target=equipmentSlot(id);
   if(canEquip(id,ch.classId,ch.level || 1) && target && !ch.equipment[target])ch.equipment[target]=id;
   else retain(id);
  }
  if([ch.equipment.weapon,ch.equipment.ranged].some(id=>ITEMS[id]?.twoHanded) && ch.equipment.shield){retain(ch.equipment.shield);ch.equipment.shield=null;}
 }
 if(returned)owner.equipmentRuleReturns=(owner.equipmentRuleReturns || 0)+returned;
 return owner;
}
