import { ITEMS, SHOPS, sellPrice } from '../data/items.js';
import { EQUIPMENT_SLOTS } from '../data/equipment.js';
import { itemIcon } from './item-icons.js';
import { escapeHtml as esc } from './equipment.js';
import { CLASSES } from '../data/classes.js';

const byId=id=>document.getElementById(id), all=Object.entries(ITEMS);
const category=it=>it.category || (it.type==='weapon'?'무기':it.type==='armor'?'방어구':'소모품');
for (const name of [...new Set(all.map(([,it])=>category(it)))]) byId('category').add(new Option(name,name));
for (const s of EQUIPMENT_SLOTS.filter(s=>s.id!=='consumable' && s.id!=='ring2')) byId('slot').add(new Option(s.label,s.id));
let page=0;
function render() {
  const query=byId('query').value.trim(), cat=byId('category').value, slot=byId('slot').value;
  const list=all.filter(([,it])=>(!query || it.name.includes(query)) && (!cat || category(it)===cat) && (!slot || (it.slot || it.type)===slot));
  const pages=Math.max(1,Math.ceil(list.length/48));page=Math.max(0,Math.min(page,pages-1));
  byId('count').textContent=`전체 ${all.length}종 · 검색 결과 ${list.length}종`;
  byId('items').innerHTML=list.slice(page*48,(page+1)*48).map(([id,it])=>{
    const shops=Object.entries(SHOPS).filter(([,ids])=>ids.includes(id)).map(([key])=>key==='smith'?'대장장이':'잡화상');
    const classes=it.classes?.map(k=>CLASSES[k]?.name || k).join(' · ') || '모든 직업';
    const acquisition=shops.length ? shops.join(' · ')+' / 레벨대 몬스터 드롭' : it.source?.unique || it.source?.set!=null ? '레벨대 네임드·보스 드롭' : '레벨대 몬스터 드롭';
    return `<article class="catalog-card">${itemIcon(id)}<h2>${esc(it.name)}</h2><small>${esc(category(it))} · Lv.${it.minLevel || it.level || 1}</small><p>${esc(it.desc)}</p><p>직업: ${esc(classes)}<br>획득: ${esc(acquisition)}<br>판매: ${sellPrice(id)}G${shops.length ? ' / 구매: '+it.price+'G' : ''}</p></article>`;
  }).join('') || '<p>검색 결과가 없습니다.</p>';
  byId('page').textContent=`${page+1} / ${pages}`;byId('previous').disabled=page===0;byId('next').disabled=page===pages-1;
}
for (const id of ['query','category','slot']) byId(id).addEventListener('input',()=>{page=0;render();});
byId('previous').onclick=()=>{page--;render();};byId('next').onclick=()=>{page++;render();};render();
