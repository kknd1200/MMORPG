import {EXTRA_EQUIPMENT} from './extra-equipment.js';
import { REBIRTH_ITEM_SOURCE } from './rebirth-item-source.js';

export const REBIRTH_ATLAS = { path: 'items/rebirth-items.webp', width: 2048, height: 1472, cell: 64 };
const familyNames = ['무기','방어구','장신구','화살','음식','물약','재료','전리품','상자'];
const slotMap = { helmet:'head', boots:'feet', necklace:'neck', ring:'ring1' };
export const MODIFIER_LABELS = { atkPct:'공격력',drPct:'받는 피해 감소',critRate:'치명타 확률',critDmg:'치명타 피해',accPct:'명중률',cdr:'스킬 재사용 감소',regen:'초당 HP 재생',lifesteal:'흡혈',expPct:'경험치',goldPct:'골드',block:'방패 막기',skillDmg:'스킬 피해',double:'추가 타격 확률',execute:'약화된 적 추가 피해',bossDmg:'보스 피해',thorns:'피해 반사',venom:'독 추가 피해',atkSpd:'공격속도',hpFlat:'HP'};
// Attack cadence stays at the user's class settings. Life skills do not exist in this game yet.
const pending = key => ['atkSpd','hpFlat','thorns','venom'].includes(key) || key.startsWith('sp_');
export function modifierText(bonuses = {}) {
  return Object.entries(bonuses).filter(([,n])=>n).map(([k,n])=>`${MODIFIER_LABELS[k] || ({sp_forest:'벌목',sp_mine:'채광',sp_shore:'낚시',sp_hearth:'요리',sp_anvil:'대장장이'})[k] || k} +${k === 'hpFlat' ? n : +(n*100).toFixed(2)+'%'}${pending(k) ? ' (원본 옵션·적용 대기)' : ''}`).join(' · ');
}
const ids = Object.fromEntries(REBIRTH_ITEM_SOURCE.map(r=>[r.name,r.id]));
export const REBIRTH_ITEMS = Object.fromEntries(REBIRTH_ITEM_SOURCE.map(r=>{
  const gear = !!r.slot, slot = slotMap[r.slot] || r.slot, m = r.material || {};
  const type = gear ? r.slot === 'weapon' ? 'weapon' : 'armor' : r.family === 8 ? 'chest' : [4,5].includes(r.family) && (m.heal || m.pot) ? 'consumable' : 'material';
  const bonuses = Object.fromEntries(Object.entries(r.bonuses || {}).filter(([key])=>!pending(key)));
  const item = { name:r.name, type, category:familyNames[r.family], group:r.group, level:r.level, price:Math.max(2,(m.sell || Math.round(10+r.level*5+r.level*r.level*.3))*2), icon:{color:r.color || '#baa178',text:r.name.slice(-1)}, atlas:r.xy, source:r, bonuses, stackable:!gear };
  if (gear) {
    item.slot=r.slot==='weapon' && r.style==='ranged' ? 'ranged' : slot; item.minLevel=Math.max(1,Math.min(100,r.level)); item.twoHanded=r.twoHanded || false;
    if (r.classes) item.classes=r.classes;
    else if (type === 'weapon') item.classes=r.style==='ranged' ? ['elf'] : r.style==='magic' ? ['mage','priest'] : ['knight','warrior','priest'];
    // Original game rolls item stats. Fixed MMO values are rescaled to its existing combat curve.
    if (type==='weapon') item.atk=Math.max(1,Math.round((1+r.level*.22)*(r.mult || 1)));
    else item.def=Math.max(1,Math.round((1+r.level*.08)*(slot==='armor' ? 1.5 : ['neck','ring1'].includes(slot) ? .4 : .65)));
    item.desc=`${r.lore || r.group || item.category}. 필요 레벨 ${item.minLevel}. ${item.atk ? '일반공격 +'+item.atk : '방어력 +'+item.def}${modifierText(r.bonuses) ? ' · '+modifierText(r.bonuses) : ''}`;
    if (r.setBonuses) item.desc+=` · 세트 2부위: ${modifierText(r.setBonuses['2'])} · 세트 4부위 추가: ${modifierText(r.setBonuses['4'])}`;
  } else {
    item.desc=`${r.group || item.category} · 아이템 레벨 ${r.level}.`;
    if (m.heal) { item.effect={hp:m.heal}; item.desc+=` HP ${m.heal} 회복.`; }
    if (m.pot) {
      const [key,value,tier]=m.pot;
      if (key==='heal') { item.effect={hp:value}; item.desc+=` HP ${value} 회복.`; }
      else if (key==='cleanse') { item.effect={cleanse:true}; item.desc+=' 해로운 상태이상 해제.'; }
      else if (!pending(key)) { item.effect={buff:{id:'item_'+key,name:r.name,duration:60*tier,[key]:value}}; item.desc+=` ${modifierText({[key]:value})}, ${60*tier}초. 같은 효과는 중첩되지 않습니다.`; }
      else { item.type='material'; item.desc+=` ${modifierText({[key]:value})}. 현재 사용할 수 없습니다.`; }
    }
    if (r.contents) { item.contents=r.contents.map(c=>({...c,id:ids[c.name]})); item.desc+=' 사용 시 무작위 내용물 1종을 획득합니다.'; }
    if (item.type==='material') item.desc+=' 보관·판매용. 제작/화살 소모 시스템은 아직 연결되지 않았습니다.';
  }
  return [r.id,item];
}));

export function rebirthDrops(level, rank='normal') {
  const pool = Object.entries({...REBIRTH_ITEMS,...EXTRA_EQUIPMENT}).filter(([,it])=>Math.abs(it.level-level)<=12 && (!it.source.unique && it.source.set == null || rank!=='normal'));
  // Fixed overall category budgets prevent hundreds of independent loot rolls per kill.
  const groups=[pool.filter(([,it])=>it.slot),pool.filter(([,it])=>!it.slot && it.type!=='chest'),pool.filter(([,it])=>it.type==='chest')];
  return groups.flatMap((entries,i)=>entries.map(([item])=>({item,chance:([.025,.15,.006][i]*(rank==='boss'?5:rank==='guard'?3:1))/entries.length})));
}

export function itemStatRows(item={}) {
  return [['atk','일반공격',item.atk || 0],['def','방어력',item.def || 0],...Object.entries(item.bonuses || {}).map(([key,n])=>[key,MODIFIER_LABELS[key] || key,+(n*100).toFixed(2)])];
}
