import {ITEMS,canEquip} from '../data/items.js';
import {REBIRTH_ATLAS} from '../data/rebirth-items.js';
import {ITEM_ICON_ATLAS,ITEM_ICON_CELLS} from '../data/item-icons.js';
import {img} from './art.js';

const frameCache=new Map(),itemCache=new Map();
const canvas=(w,h)=>{const c=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):document.createElement('canvas');c.width=w;c.height=h;return c;};
const cache=(map,key,value,max)=>{if(map.size>=max)map.delete(map.keys().next().value);map.set(key,value);return value;};
const mainHands=[[70,84],[71,84],[73,84],[86,83],[90,84],[91,84],[91,84],[87,84]];
const offHands=[[91,83],[86,83],[72,82],[70,82],[70,82],[76,82],[90,83],[92,83]];
const bowHands=[[91,82],[87,82],[69,82],[69,81],[71,81],[88,82],[92,82],[92,82]];
const staffHands=[[69,83],[69,83],[70,83],[72,82],[89,83],[91,83],[91,83],[91,83]];

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
 const data=ctx.getImageData(0,0,c.width,c.height),pixels=data.data;
 const legacy=!item.atlas && !item.art;
 if(legacy){
  for(let i=0;i<pixels.length;i+=4)if(pixels[i]>60 && pixels[i+2]>60 && pixels[i]>pixels[i+1]*2.5 && pixels[i+2]>pixels[i+1]*2.5)pixels[i+3]=0;
  ctx.putImageData(data,0,0);
 }
 let x0=c.width,y0=c.height,x1=0,y1=0;
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 if(x0>x1)return null;
 return cache(itemCache,key,{canvas:c,x:x0,y:y0,w:x1-x0+1,h:y1-y0+1},128);
}
// Locate the baked steel blade so its authored grip and angle also drive the replacement.
// Only neutral blade pixels and their dark outline are removed; armor and skin keep their original pixels.
function steelBlade(data){
 const {width:w,height:h}=data,p=data.data,points=new Set();
 for(let y=20;y<Math.min(h,123);y++)for(let x=30;x<Math.min(w,133);x++){
  const i=(y*w+x)*4,r=p[i],g=p[i+1],b=p[i+2];
  if(p[i+3]>80 && r>105 && g>105 && b>105 && Math.max(r,g,b)-Math.min(r,g,b)<52 && b>r*.88)points.add(y*w+x);
 }
 let best=null,bestScore=0;
 while(points.size){
  const seed=points.values().next().value,queue=[seed],group=[];points.delete(seed);
  for(let i=0;i<queue.length;i++){
   const a=queue[i],x=a%w,y=Math.floor(a/w);group.push([x,y]);
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const b=(y+dy)*w+x+dx;if(points.delete(b))queue.push(b);}
  }
  if(group.length<7)continue;
  const mx=group.reduce((n,p)=>n+p[0],0)/group.length,my=group.reduce((n,p)=>n+p[1],0)/group.length;
  if(Math.hypot(mx-80,my-57)<8 || mx>=75 && mx<=88 && my>99)continue;
  let xx=0,xy=0,yy=0;for(const [x,y] of group){xx+=(x-mx)**2;xy+=(x-mx)*(y-my);yy+=(y-my)**2;}
  const a=.5*Math.atan2(2*xy,xx-yy),ux=Math.cos(a),uy=Math.sin(a);let lo=Infinity,hi=-Infinity,minor=0;
  for(const [x,y] of group){const v=(x-mx)*ux+(y-my)*uy;lo=Math.min(lo,v);hi=Math.max(hi,v);minor+=((y-my)*ux-(x-mx)*uy)**2;}
  const span=hi-lo,thin=span/Math.max(1,Math.sqrt(minor/group.length)),score=span*Math.min(8,thin);
  if(span<10 || thin<3.5 || score<bestScore)continue;
  const ends=[[mx+lo*ux,my+lo*uy],[mx+hi*ux,my+hi*uy]].sort((a,b)=>Math.hypot(a[0]-80,a[1]-80)-Math.hypot(b[0]-80,b[1]-80));
  bestScore=score;best={points:group,grip:ends[0],angle:Math.atan2(ends[1][1]-ends[0][1],ends[1][0]-ends[0][0])};
 }
 return best;
}
export function equipmentBody(sheet,sprite,action,row,col){
 const key=[sprite,action,row,col,sheet.height].join(':');if(frameCache.has(key))return frameCache.get(key);
 const c=canvas(160,160),ctx=c.getContext('2d');ctx.drawImage(sheet,col*160,(sheet.height>160?row:0)*160,160,160,0,0,160,160);
 const data=ctx.getImageData(0,0,160,160),p=data.data,cls=sprite.startsWith('knight')?'knight':sprite.startsWith('warrior')?'warrior':sprite.startsWith('mage')?'mage':sprite.startsWith('archer')?'elf':'priest';
 let grip=[...mainHands[row]],angle=Math.PI*.7;
 if(['knight','warrior'].includes(cls)){
  const blade=steelBlade(data);
  if(blade){
   grip=blade.grip;angle=blade.angle;
   for(const [x,y] of blade.points)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(y+dy>=100 && x+dx>=72 && x+dx<=89)continue;
    const i=((y+dy)*160+x+dx)*4,r=p[i],g=p[i+1],b=p[i+2];
    if(dx===0 && dy===0 || Math.max(r,g,b)<100 || Math.max(r,g,b)-Math.min(r,g,b)<52)p[i+3]=0;
   }
  }
 }
 if(cls==='mage'){
  grip=[...staffHands[row]];angle=-Math.PI/2;
  for(let y=52;y<109;y++)for(let x=grip[0]-4;x<=grip[0]+2;x++){
   if(y>=77 && y<=87 || y>=100 && x>=72 && x<=89)continue;
   const i=(y*160+x)*4,r=p[i],g=p[i+1],b=p[i+2];
   if(x<74 || x>88){if(y<77 || b<g*.8 || Math.max(r,g,b)<70)p[i+3]=0;}
  }
 }
 if(cls==='elf'){
  grip=[...bowHands[row]];angle=-Math.PI/2;
  for(let y=50;y<111;y++)for(let x=Math.max(0,grip[0]-4);x<=grip[0]+6;x++){
   if(x>=73 && x<=86 || y>=77 && y<=87 || y>=100 && x>=72 && x<=89)continue;
   const i=(y*160+x)*4;if(p[i+3] && (p[i]>p[i+1]*1.2 || Math.max(p[i],p[i+1],p[i+2])<80))p[i+3]=0;
  }
 }
 if(cls==='priest'){grip=[row===0?80:row===1?75:row===7?85:mainHands[row][0],83];angle=-Math.PI/2;}
 ctx.putImageData(data,0,0);
 if(cls==='knight'){
  // Recover the arm hidden by the original shield from the opposite armored arm.
  const copy=canvas(160,160);copy.getContext('2d').drawImage(c,0,0);
  const [x,y]=offHands[row];ctx.save();ctx.beginPath();ctx.rect(x-6,y-9,13,22);ctx.clip();ctx.translate(160,0);ctx.scale(-1,1);ctx.drawImage(copy,0,0);ctx.restore();
 }
 return cache(frameCache,key,{canvas:c,grip,angle,off:[...offHands[row]],cls},256);
}
export function drawHeldItem(ctx,item,point,angle,{scale=1,back=false,time=0}={}){
 const tx=texture(item);if(!tx)return;
 const kind=item.weaponType,[x,y]=point;
 const lengths={sword:26,axe:24,greatsword:35,greataxe:33,spear:44,staff:44,bow:35,shortbow:29,hornbow:34,scripture:14,shield:23,orb:13};
 const length=lengths[kind] || 25;let w,h,rot=0,px=.5,py=.5;
 if(['shield','orb','scripture'].includes(kind)){h=length;w=length*tx.w/tx.h;if(kind==='orb')point=[x,y-7+Math.sin(time*3)*1.2];}
 else if(['bow','shortbow','hornbow'].includes(kind)){h=length;w=length*Math.max(.38,Math.min(.64,tx.w/tx.h));rot=back?-.1:.1;}
 else {
  const diagonal=Math.hypot(tx.w,tx.h);w=length*tx.w/diagonal;h=length*tx.h/diagonal;
  const toRight=kind==='staff' || !item.atlas && !item.art;
  const sourceAngle=Math.atan2(-tx.h,toRight?tx.w:-tx.w);rot=angle-sourceAngle;px=toRight?.17:.83;py=.83;
  if(kind==='staff'){px=.35;py=.65;}
 }
 ctx.save();ctx.translate((point[0]-80)*scale,(point[1]-109)*scale);ctx.rotate(rot);ctx.imageSmoothingEnabled=false;
 ctx.drawImage(tx.canvas,tx.x,tx.y,tx.w,tx.h,-w*px*scale,-h*py*scale,w*scale,h*scale);
 if(item.enhance>=7){ctx.globalAlpha=.22;ctx.globalCompositeOperation='lighter';ctx.drawImage(tx.canvas,tx.x,tx.y,tx.w,tx.h,-w*px*scale,-h*py*scale,w*scale,h*scale);}
 ctx.restore();
}
