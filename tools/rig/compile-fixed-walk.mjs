// Flatten the reviewed walking poses with one permanent weapon per class.
// This is an asset build step; equipped inventory items never enter these sheets.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/../package.json' : import.meta.url);
const {createCanvas,Image}=require('@napi-rs/canvas');
globalThis.Image=class extends Image {set src(v){super.src=fs.readFileSync(fileURLToPath(v));}};
globalThis.OffscreenCanvas=class {constructor(w,h){return createCanvas(w,h);}};
const {CHARS}=await import('../../js/data/chars.js');
const {loadImages}=await import('../../js/game/art.js');
const {equipmentBody,visibleEquipment,drawHeldItem,drawHandForeground,rigFiles}=await import('../../js/game/equipment-art.js');
const gear={
  // The knight's original shield is already part of the walking artwork.
  knight:{weapon:'rebirth_04d252443fca'},
  warrior:{weapon:'steel_blade'},
  elf:{ranged:'rebirth_9fe9f999215f'},
  mage:{weapon:'rebirth_81ae980b85ff',shield:'orb_0'},
  priest:{weapon:'rebirth_aca16a333292'},
};
await loadImages([...Object.keys(CHARS).flatMap(rigFiles),'items/rebirth-items.webp','items/icons.webp','items/hand-equipment.webp']);
for(const [key,info] of Object.entries(CHARS)){
  const c=createCanvas(1280,1280),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
  const equipped=visibleEquipment({classId:info.classId,level:100,equipment:gear[info.classId]});
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){
    const body=equipmentBody(null,key,'walk',row,col);if(!body)throw Error(`Missing ${key}/${row}/${col}`);
    ctx.save();ctx.translate(col*160+80,row*160+109);
    const main=()=>{if(equipped.main)drawHeldItem(ctx,equipped.main,body.grip,body.angle,{flipX:body.mainFlipX});};
    const off=()=>{if(equipped.off)drawHeldItem(ctx,equipped.off,body.off,-Math.PI/2);};
    const back=[3,4,5].includes(row);
    if(body.mainBehind)main();if(back)off();
    ctx.drawImage(body.sheet,body.sx,body.sy,160,160,-80,-109,160,160);
    if(!body.mainBehind)main();if(!back)off();drawHandForeground(ctx,body);
    ctx.restore();
  }
  fs.writeFileSync(new URL(`../../assets/chars/${key}/fixed-walk.webp`,import.meta.url),execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON || 'python', ['-c', 'import sys,io;from PIL import Image;Image.open(io.BytesIO(sys.stdin.buffer.read())).save(sys.stdout.buffer,format="WEBP",lossless=True)'], {input:c.toBuffer('image/png')}));
  console.log(key);
}
