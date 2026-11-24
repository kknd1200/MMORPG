import {improvedItem} from '../systems/inventory-tools.js';
import { itemStatRows } from '../data/rebirth-items.js';
import { ITEMS, canEquip, sellPrice, INVENTORY_SIZE } from '../data/items.js';
import { CLASSES } from '../data/classes.js';
import { EQUIPMENT_SLOTS, equipmentSlot, equipmentTotals, slotAccepts, comparisonSlot } from '../data/equipment.js';
import { itemIcon } from './item-icons.js';
import { avatarMarkup } from './portraits.js';
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed = n => `${n >= 0 ? '+' : ''}${n}`;
const paths = {
 potion: 'M10 3h12v5h-3v5c7 4 8 14-3 15S6 17 13 13V8h-3z M10 20h13',
 head: 'M7 27V14a9 9 0 0 1 18 0v13h-6V15h-6v12z M10 14h12',
 bow: 'M9 3q24 13 0 26L9 3 M9 3l8 13-8 13 M5 24l20-18 M21 6h4v4',
 cape: 'M12 4h8l6 6-2 18H8L6 10z M12 4l-2 24 M20 4l2 24',
 neck: 'M6 4q0 15 10 17Q26 19 26 4 M16 17l5 6-5 6-5-6z',
 sword: 'M25 3l4 4-16 16-4-4z M6 17l9 9 M4 28l6-6',
 armor: 'M10 4l6 3 6-3 6 7-5 5-1 12H10L9 16l-5-5z M11 4v10h10V4',
 shield: 'M5 5l11-2 11 2v13q-3 7-11 12Q8 25 5 18z M16 8v16 M10 14h12',
 ring: 'M10 4h12l-2 7h-8z M11 11a10 10 0 1 0 10 0 M13 16a5 5 0 1 0 6 0',
 legs: 'M7 4h18l1 24H16l-1-15-1 15H5z M7 9h18',
 gloves: 'M7 17V8h3v8-12h3v12-13h3v13-10h3v13l4-4 3 3-6 10H10z',
 feet: 'M10 4h9v15l9 4v6H7v-7l3-5z M10 9h9',
};
export function emptySlotIcon(shape) {
  return `<svg class="equipment-empty-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="${paths[shape] || paths.armor}"/></svg>`;
}
export function availableInSlot(game, char, slot) {
  return game.char.inventory.filter(e => slot === 'consumable' ? ITEMS[e.id]?.type === 'consumable' : slotAccepts(slot,e.id) && canEquip(e.id, char.classId, char.level || 1));
}
export function equipmentMarkup(game) {
  const unit = game.selUnit(), char = unit.char;
  const units = game.units?.() || [unit];
  const totals = equipmentTotals(char);
  return `<div class="equipment-character-tabs" aria-label="장비를 확인할 캐릭터">${units.map(u => `<button data-sel="${escapeHtml(u.id || 'player')}" class="equipment-character ${u === unit || u.id === unit.id ? 'selected' : ''}" aria-pressed="${u === unit || u.id === unit.id}">${avatarMarkup(u.char, 'tab')}<span>${escapeHtml(u.char.name)}</span></button>`).join('')}</div>
    <div class="inventory-columns"><section class="equipment-board" aria-label="${escapeHtml(char.name)} 장착 장비">
    <div class="equipment-heading"><b>착용 중</b><span>${escapeHtml(char.name)} · ${CLASSES[char.classId].name}</span></div>
    <div class="equipment-grid">${EQUIPMENT_SLOTS.map(slot => {
      const id = char.equipment?.[slot.id], item = ITEMS[id];
      const upgrade = availableInSlot(game, char, slot.id).some(e => improvedItem(e.id,char,slot.id));
      const label = `${slot.label}: ${item ? item.name : '미장착'}`;
      return `<button class="equipment-tile ${item ? 'occupied' : 'empty'}" style="grid-row:${slot.row};grid-column:${slot.col}" ${item ? `data-item-hover="${id}"` : ''} data-equipment-slot="${slot.id}" aria-label="${escapeHtml(label)}" ${item ? '' : `title="${escapeHtml(label)}"`}>${item ? itemIcon(id) : emptySlotIcon(slot.shape)}<span class="equipment-slot-label">${slot.label}</span>${upgrade ? '<span class="equipment-upgrade" aria-label="더 좋은 장비 있음">▲</span>' : ''}</button>`;
    }).join('')}</div>
    <div class="equipment-totals"><b>장비 효과 합계</b><span>일반공격 <strong>${signed(totals.atk)}</strong></span><span>방어력 <strong>${signed(totals.def)}</strong></span></div></section><section class="inventory-bag"><h3>가방 <small>파티 공용</small></h3>`;
}
export function itemDetailsMarkup(game, context) {
  const item = ITEMS[context.id];
  if (!item) return '';
  const unit = game.unitById?.(context.unitId) || game.selUnit(), char = unit.char;
  const slot = comparisonSlot(context.id,char,context.slot);
  const old = ITEMS[char.equipment?.[slot] || (slot==='ranged' ? char.equipment?.weapon : slot==='weapon' ? char.equipment?.ranged : null)];
  const owned = game.char.inventory.filter(e => e.id === context.id).reduce((n,e) => n+e.qty,0);
  const classNames = item.classes?.map(id => CLASSES[id]?.name || id).join(' · ') || '모든 직업';
  const beforeStats=Object.fromEntries(itemStatRows(old).map(([key,,n])=>[key,n]));
  const afterStats=Object.fromEntries(itemStatRows(item).map(([key,,n])=>[key,n]));
  const keys=new Map([...itemStatRows(item),...itemStatRows(old)].map(([key,label])=>[key,label]));
  const stats = [...keys].filter(([key])=>beforeStats[key] || afterStats[key] || item[key]!=null || old?.[key]!=null).map(([key,label]) => {
    const value=afterStats[key] || 0,diff=+(value-(beforeStats[key] || 0)).toFixed(2),unit=['atk','def'].includes(key)?'':'%';
    return `<div><span>${label}</span><b>${signed(value)}${unit}</b>${context.source !== 'equipped' && slot ? `<small class="${diff > 0 ? 'positive' : diff < 0 ? 'negative' : ''}">현재 장비 대비 ${signed(diff)}${unit}</small>` : ''}</div>`;
  }).join('');
  const equipped = context.source === 'equipped';
  const usable = item.type === 'consumable' || item.type === 'chest' || canEquip(context.id,char.classId,char.level || 1);
  const disabled = !usable || (!equipped && !owned);
  const action = equipped ? 'unequip' : ['consumable','chest'].includes(item.type) ? 'use' : 'equip';
  const actionLabel = equipped ? '장착 해제' : ['consumable','chest'].includes(item.type) ? '사용' : slot ? '장착' : '사용 불가';
  const shop = context.source === 'shop';
  return `<header class="item-dialog-header"><h3 id="item-detail-title">아이템 정보</h3><button type="button" data-item-close aria-label="아이템 설명 닫기">×</button></header>
    <div class="item-detail-heading">${itemIcon(context.id)}<div><h2>${escapeHtml(item.name)}</h2><span>${slot ? EQUIPMENT_SLOTS.find(s=>s.id===slot).label : escapeHtml(item.category || '소모품')}${equipped ? ' · 착용 중' : ''}</span></div></div>
    <p class="item-description">${escapeHtml(item.desc)}</p>
    <div class="item-detail-stats">${stats}</div>
    <dl class="item-detail-meta"><div><dt>${slot ? '장착 대상' : '사용 대상'}</dt><dd>${escapeHtml(slot ? char.name : game.char.name)}</dd></div><div><dt>필요 레벨</dt><dd>${item.minLevel || 1}</dd></div><div><dt>직업 조건</dt><dd>${classNames}</dd></div><div><dt>가방 보유 수량</dt><dd>${owned}개</dd></div><div><dt>상점 가격</dt><dd>${item.price} 골드</dd></div><div><dt>판매 가격</dt><dd>${sellPrice(context.id)} 골드</dd></div></dl>
    ${!usable ? '<p class="item-requirement">직업·레벨 조건을 만족하지 않거나, 현재 사용할 수 없는 아이템입니다. (장착할 수 없는 항목)</p>' : ''}
    <div class="item-dialog-actions">${shop ? `<button class="primary" data-item-action="buy" ${game.char.gold < item.price ? 'disabled' : ''}>${item.price} 골드에 구매</button>` : `<button class="primary" data-item-action="${action}" ${disabled || equipped && game.char.inventory.length >= INVENTORY_SIZE ? 'disabled' : ''}>${actionLabel}</button>`}<button data-item-close>닫기</button></div>`;
}
