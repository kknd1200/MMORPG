import {ITEMS,canEquip} from '../data/items.js';
import {REBIRTH_ATLAS} from '../data/rebirth-items.js';
import {ITEM_ICON_ATLAS,ITEM_ICON_CELLS} from '../data/item-icons.js';
import {EQUIPMENT_RIG} from '../data/equipment-rig.js';
import {equipmentGrip} from '../data/equipment-grips.js';
import {img} from './art.js';
const itemCache=new Map();
const canvas=(w,h)=>{const c=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):document.createElement('canvas');c.width=w;c.height=h;return c;};
export const RIG_ACTION_Y={idle:0,walk:160,normal:1440,skill:2720};
export const rigFiles=key=>[`chars/rigged/${key}/body.webp`,`chars/rigged/${key}/hands.webp`];
export function visibleEquipment(state){
 const eq=state.equipment || {},valid=id=>id && canEquip(id,state.classId,state.level ?? Infinity)?ITEMS[id]:null;
 const main=valid(eq.ranged) || valid(eq.weapon),off=main?.twoHanded?null:valid(eq.shield);
 return {main,off};
}
export function equipmentArt(item){
 if(item.art)return {...item.art,xy:item.art.xy};
 if(item.atlas)return {...REBIRTH_ATLAS,xy:item.atlas};
 const cell=ITEM_ICON_CELLS[item.baseId || Object.keys(ITEMS).find(id=>ITEMS[id]===item)];
 return cell==null?null:{path:ITEM_ICON_ATLAS.path,cell:ITEM_ICON_ATLAS.cell,xy:[cell%ITEM_ICON_ATLAS.columns*ITEM_ICON_ATLAS.cell,Math.floor(cell/ITEM_ICON_ATLAS.columns)*ITEM_ICON_ATLAS.cell]};
}

function texture(item){
 const art=equipmentArt(item);if(!art)return null;
 const key=art.path+':'+art.xy.join(',');if(itemCache.has(key))return itemCache.get(key);
 const image=img(art.path);if(!image)return null;
 const c=canvas(art.cell,art.cell),ctx=c.getContext('2d');ctx.drawImage(image,...art.xy,art.cell,art.cell,0,0,art.cell,art.cell);
 if(!item.atlas && !item.art){const data=ctx.getImageData(0,0,c.width,c.height),p=data.data;for(let i=0;i<p.length;i+=4)if(p[i]>60 && p[i+2]>60 && p[i]>p[i+1]*2.5 && p[i+2]>p[i+1]*2.5)p[i+3]=0;ctx.putImageData(data,0,0);}
 if(itemCache.size>=128)itemCache.delete(itemCache.keys().next().value);itemCache.set(key,c);return c;
}
export function equipmentBody(_original,sprite,action,row,col){
 const sheet=img(`chars/rigged/${sprite}/body.webp`),hands=img(`chars/rigged/${sprite}/hands.webp`);if(!sheet || !hands)return null;
 const resolved=action==='shield_bash'?'skill':action;
 const frames=EQUIPMENT_RIG[sprite]?.[resolved];if(!frames)return null;
 const frame=frames[row]?.[resolved==='idle'?0:col];if(!frame)return null;
 return {...frame,handPatches:frame.hands,sheet,hands,sx:(resolved==='idle'?row:col)*160,sy:RIG_ACTION_Y[resolved]+(resolved==='idle'?0:row*160),grip:frame.main};
}
export function drawHandForeground(ctx,body,scale=1){
 for(const h of body.handsMeta || body.handPatches || [])ctx.drawImage(body.hands,h.xy[0],h.xy[1],8,8,(h.at[0]-80)*scale,(h.at[1]-109)*scale,8*scale,8*scale);
}
export function drawHeldItem(ctx,item,point,angle,{scale=1,back=false}={}){
 const tx=texture(item),profile=equipmentGrip(item);if(!tx || !profile || !point)return;
 const [gx,gy]=profile.grip,[txp,typ]=profile.tip,sourceAngle=Math.atan2(typ-gy,txp-gx);
 const factor=profile.reach/Math.hypot(txp-gx,typ-gy)*scale;
 ctx.save();ctx.translate((point[0]-80)*scale,(point[1]-109)*scale);ctx.rotate(angle-sourceAngle);ctx.imageSmoothingEnabled=false;
 ctx.drawImage(tx,-gx*factor,-gy*factor,tx.width*factor,tx.height*factor);
 if(item.enhance>=7){ctx.globalAlpha=.18;ctx.globalCompositeOperation='lighter';ctx.drawImage(tx,-gx*factor,-gy*factor,tx.width*factor,tx.height*factor);}
 ctx.restore();
}
