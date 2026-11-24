import {WEAPON_TYPES} from '../data/weapon-rules.js';
import {ITEMS,INVENTORY_SIZE} from '../data/items.js';
import {comparisonSlot} from '../data/equipment.js';
import {itemStatRows} from '../data/rebirth-items.js';
export function inventoryCategory(item) {
 if(item.weaponType==='orb')return '무기';
 if(item.category==='장신구' || ['neck','ring1','ring2'].includes(item.slot))return '장신구';
 return item.type==='weapon'?'무기':item.type==='armor'?'방어구':['consumable','chest'].includes(item.type)?'소모품':'재료';
}
export function dismantleKind(item){const c=inventoryCategory(item);return {무기:'weapon',방어구:'armor',장신구:'accessory'}[c] || null;}
export function inventorySubtype(item){
 if(WEAPON_TYPES[item.weaponType])return WEAPON_TYPES[item.weaponType].label;
 if(item.type==='weapon')return ['단검','대검','장검','도끼','전투망치','철퇴','미늘창','창','석궁','단궁','장궁','활','지팡이','완드','마도서','새총','검'].find(n=>item.name.includes(n)) || '무기';
 const slot=item.slot || item.type,labels={head:'투구',armor:'갑옷',shield:'방패',legs:'하의',gloves:'장갑',feet:'신발',cape:'망토',neck:'목걸이',ring1:'반지',ring2:'반지'};
 return labels[slot] || (item.enhanceType?'강화 주문서':item.group || item.category || '재료');
}
export function improvedItem(id,char,slotOverride=null){
 const item=ITEMS[id];if(!item || !['weapon','armor'].includes(item.type))return false;
 const slot=slotOverride || comparisonSlot(id,char),old=ITEMS[char.equipment?.[slot] || (slot==='ranged'?char.equipment?.weapon:slot==='weapon'?char.equipment?.ranged:null)];
 const before=Object.fromEntries(itemStatRows(old).map(([k,,n])=>[k,n]));
 return itemStatRows(item).some(([key,,n])=>n>(before[key] || 0));
}
export function dismantle(owner,index,expectedId,confirmed=false){
 const e=owner.inventory[index],item=ITEMS[e?.id];
 if(!e || e.id!==expectedId || !item)return {ok:false,error:'선택한 아이템이 변경되었습니다.'};
 const kind=dismantleKind(item);if(!kind)return {ok:false,error:'장비만 분해할 수 있습니다.'};
 if(item.enhance>0 && !confirmed)return {ok:false,confirm:true,id:e.id,name:item.name};
 const stone=kind+'_dismantle_stone',stack=owner.inventory.find(x=>x.id===stone);
 if(e.qty>1 && !stack && owner.inventory.length>=INVENTORY_SIZE)return {ok:false,error:'가방 공간이 부족합니다.'};
 e.qty--;if(!e.qty)owner.inventory.splice(index,1);
 if(stack)stack.qty++;else owner.inventory.push({id:stone,qty:1});
 return {ok:true,name:item.name,stone};
}
export function exchangeStones(owner,kind){
 if(!['weapon','armor','accessory'].includes(kind))return {ok:false,error:'잘못된 종류입니다.'};
 const stone=kind+'_dismantle_stone',scroll=kind+'_enchant_scroll',total=owner.inventory.filter(e=>e.id===stone).reduce((n,e)=>n+e.qty,0);
 if(total<100)return {ok:false,error:'분해석 100개가 필요합니다.'};
 const copy=owner.inventory.map(e=>({...e}));let left=100;
 for(const e of copy)if(e.id===stone){const take=Math.min(left,e.qty);e.qty-=take;left-=take;}
 const next=copy.filter(e=>e.qty>0),stack=next.find(e=>e.id===scroll);
 if(!stack && next.length>=INVENTORY_SIZE)return {ok:false,error:'가방 공간이 부족합니다.'};
 if(stack)stack.qty++;else next.push({id:scroll,qty:1});owner.inventory=next;return {ok:true,scroll};
}
