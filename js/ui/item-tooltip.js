import { itemStatRows } from '../data/rebirth-items.js';
import { ITEMS, canEquip, sellPrice } from '../data/items.js';
import { CLASSES } from '../data/classes.js';
import { equipmentSlot, comparisonSlot } from '../data/equipment.js';
import { itemIcon } from './item-icons.js';
import { escapeHtml } from './equipment.js';
const signed = n => `${n >= 0 ? '+' : ''}${n}`;

export function itemComparisonMarkup(game, id) {
  const item = ITEMS[id], char = game.selUnit().char, slot = comparisonSlot(id,char);
  if (!item || !slot) return '';
  const current = ITEMS[char.equipment?.[slot] || (slot==='ranged' ? char.equipment?.weapon : slot==='weapon' ? char.equipment?.ranged : null)];
  const beforeStats=Object.fromEntries(itemStatRows(current).map(([key,,n])=>[key,n])), afterStats=Object.fromEntries(itemStatRows(item).map(([key,,n])=>[key,n]));
  const keys=new Map([...itemStatRows(item),...itemStatRows(current)].map(([key,label])=>[key,label]));
  const rows = [...keys].filter(([key]) => beforeStats[key] || afterStats[key] || item[key]!=null || current?.[key]!=null).map(([key,label]) => {
    const percent=!['atk','def'].includes(key); if (percent) label+=' (%)';
    const before = beforeStats[key] || 0, after = afterStats[key] || 0, delta = +(after-before).toFixed(2);
    return `<tr><th scope="row">${label}</th><td>${signed(before)}</td><td>${signed(after)}</td><td class="${delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral'}">${delta>0?'▲ ':''}${signed(delta)}</td></tr>`;
  }).join('');
  return `<div class="item-comparison"><p><b>${escapeHtml(char.name)}</b>의 착용 장비와 비교</p><p class="comparison-current">현재 착용: ${current ? escapeHtml(current.name) : '미장착'}</p><table><thead><tr><th>능력치</th><th>착용 중</th><th>이 아이템</th><th>차이</th></tr></thead><tbody>${rows}</tbody></table>${canEquip(id,char.classId,char.level || 1) ? '' : '<p class="item-requirement">선택한 캐릭터는 장착할 수 없습니다.</p>'}</div>`;
}

export function itemTooltipMarkup(game, id) {
  const item = ITEMS[id];
  if (!item) return '';
  const classes = item.classes?.map(c=>CLASSES[c]?.name || c).join(' · ') || '모든 직업';
  return `<div class="tooltip-heading">${itemIcon(id)}<b>${escapeHtml(item.name)}</b></div><p class="tooltip-description">${escapeHtml(item.desc)}</p><p class="tooltip-classes">장착/사용 직업: ${classes}</p>${itemComparisonMarkup(game,id)}<div class="tooltip-footer"><span>판매가 ${sellPrice(id)} 골드</span><span>클릭하여 ${['consumable','chest'].includes(item.type) ? '사용' : equipmentSlot(id) ? '장착' : '정보'} 메뉴</span></div>`;
}

export class ItemTooltip {
  constructor(root, game, blocked = () => false) {
    this.root = root; this.game = game; this.blocked = blocked;
    this.el = document.createElement('div');
    this.el.className = 'item-tooltip'; this.el.id = 'item-hover-tooltip';
    this.el.setAttribute('role','tooltip'); this.el.hidden = true; root.append(this.el);
    this.handlers=[];
    const listen=(...args)=>{root.addEventListener(...args);this.handlers.push(args);};
    listen('pointerover', e => this.show(e.target.closest('[data-item-hover]'), e.clientX, e.clientY));
    listen('pointermove', e => {
      if(this.target && !this.keyboard)this.show(e.target.closest('[data-item-hover]'),e.clientX,e.clientY);
    });
    listen('pointerout', e => {
      if(this.target && !this.target.contains(e.relatedTarget))this.hide();
    });
    listen('pointerleave', () => this.hide());
    listen('focusin', e => {
      const target = e.target.closest('[data-item-hover]');
      if (!target) return;
      const box = target.getBoundingClientRect();
      this.show(target,box.right,box.top,true);
    });
    listen('focusout', e => {
      if(this.keyboard && this.target && !this.target.contains(e.relatedTarget))this.hide();
    });
    listen('scroll', () => this.hide(),true);
    listen('dragstart', () => this.hide(),true);
  }
  show(target, x, y, keyboard = false) {
    if (!target || this.blocked()) {this.hide();return;}
    if (target !== this.target) {
      this.hide(); this.target = target;
      this.oldDescription = target.getAttribute('aria-describedby');
      target.setAttribute('aria-describedby',this.el.id);
      this.el.innerHTML = itemTooltipMarkup(this.game,target.dataset.itemHover);
    }
    this.keyboard = keyboard;this.pointerX=x;this.pointerY=y;
    this.el.hidden = false; this.position(x,y);
  }
  destroy() {
    this.hide();
    for(const args of this.handlers)this.root.removeEventListener(...args);
    this.el.remove();
  }
  refresh() {
    if(this.target?.isConnected===false){
      const target=this.keyboard?document.activeElement?.closest('[data-item-hover]'):document.elementFromPoint(this.pointerX,this.pointerY)?.closest('[data-item-hover]');
      if(!target || !this.root.contains(target)){this.hide();return;}
      this.show(target,this.pointerX,this.pointerY,this.keyboard);
    }
    const id=this.target?.dataset.itemHover;
    if(id && ITEMS[id])this.el.innerHTML=itemTooltipMarkup(this.game,id);
    else if(id)this.hide();
  }
  position(x,y) {
    const box = this.el.getBoundingClientRect(), margin = 10;
    let left = x + 16, top = y + 16;
    if (left + box.width > window.innerWidth-margin) left = x-box.width-12;
    if (top + box.height > window.innerHeight-margin) top = window.innerHeight-box.height-margin;
    this.el.style.left = `${Math.max(margin,left)}px`;
    this.el.style.top = `${Math.max(margin,top)}px`;
  }
  hide() {
    this.el.hidden = true;
    if (this.target) {
      if (this.oldDescription) this.target.setAttribute('aria-describedby',this.oldDescription);
      else this.target.removeAttribute('aria-describedby');
    }
    this.target = null;
  }
}
