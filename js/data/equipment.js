import { ITEMS } from './items.js';

export const EQUIPMENT_SLOTS = [
  { id: 'consumable', label: '소모품', row: 1, col: 1, shape: 'potion' },
  { id: 'head', label: '투구', row: 1, col: 2, shape: 'head' },
  { id: 'ranged', label: '원거리 전용', row: 1, col: 3, shape: 'bow' },
  { id: 'cape', label: '망토', row: 2, col: 1, shape: 'cape' },
  { id: 'neck', label: '목걸이', row: 2, col: 2, shape: 'neck' },
  { id: 'weapon', label: '무기', row: 3, col: 1, shape: 'sword' },
  { id: 'armor', label: '갑옷', row: 3, col: 2, shape: 'armor' },
  { id: 'shield', label: '방패', row: 3, col: 3, shape: 'shield' },
  { id: 'ring1', label: '반지 1', row: 4, col: 1, shape: 'ring' },
  { id: 'legs', label: '하의', row: 4, col: 2, shape: 'legs' },
  { id: 'ring2', label: '반지 2', row: 4, col: 3, shape: 'ring' },
  { id: 'gloves', label: '장갑', row: 5, col: 1, shape: 'gloves' },
  { id: 'feet', label: '신발', row: 5, col: 2, shape: 'feet' },
];
export function equipmentSlot(id) {
  const item = ITEMS[id];
  if (!item || !['weapon', 'armor'].includes(item.type)) return null;
  const slot = item.slot || item.type;
  return EQUIPMENT_SLOTS.some(s => s.id === slot && s.id !== 'consumable') ? slot : null;
}
export function equipmentTotals(char) {
  const total = { atk: 0, def: 0 };
  for (const slot of EQUIPMENT_SLOTS) {
    const item = ITEMS[char.equipment?.[slot.id]];
    if (item && slotAccepts(slot.id, char.equipment[slot.id])) {
      total.atk += item.atk || 0;
      total.def += item.def || 0;
    }
  }
  return {atk:Number(total.atk.toFixed(2)),def:Number(total.def.toFixed(2))};
}

export function slotAccepts(slot, id) {
  const target=equipmentSlot(id);
  return target===slot || target==='ring1' && slot==='ring2';
}
export function comparisonSlot(id, char, preferred=null) {
  if (preferred && slotAccepts(preferred,id)) return preferred;
  const slot=equipmentSlot(id);
  if (slot==='ring1') {
    if (!char.equipment?.ring1) return 'ring1';
    if (!char.equipment?.ring2) return 'ring2';
  }
  return slot;
}
export function equipmentBonuses(char) {
  const result={}, sets=new Map();
  const add=values=>{for (const [key,value] of Object.entries(values || {})) {
    if (!['hpFlat','atkSpd','thorns','venom'].includes(key) && !key.startsWith('sp_')) result[key]=(result[key] || 0)+value;
  }};
  for (const [slot,id] of Object.entries(char.equipment || {})) {
    if (!slotAccepts(slot,id)) continue;
    const item=ITEMS[id];add(item.bonuses);
    if (item.source?.set != null) {
      const key=item.source.set, group=sets.get(key) || {count:0,bonuses:item.source.setBonuses};
      group.count++;sets.set(key,group);
    }
  }
  for (const group of sets.values()) for (const [count,bonus] of Object.entries(group.bonuses)) if (group.count>=+count) add(bonus);
  return result;
}
