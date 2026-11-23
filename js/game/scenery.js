// 타일 좌표·맵 시드에 고정된 바닥 장식. 청크 생성 때만 그려 이동 판정은 유지한다.
import { T } from './world.js';
const TAU = Math.PI * 2;
const vegetation = new Set([T.GRASS, T.FLOWER, T.DARKGRASS, T.SWAMP]);
const stone = new Set([T.STONE, T.ASH, T.FLOOR, T.VOID]);
export function detailSeed(world, x, y) {
  let n = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ world.def.seed;
  return (Math.imul(n ^ (n >>> 13), 1274126177) ^ (n >>> 16)) >>> 0;
}
export function detailAllowed(world, x, y) {
  const t = world.get(x, y);
  if (![...vegetation, ...stone, T.DIRT, T.SAND, T.SNOW].includes(t)) return false;
  return !world.portals.some(p => x + .5 >= p.rect.x0 - .7 && x + .5 <= p.rect.x1 + .7 && y + .5 >= p.rect.y0 - .7 && y + .5 <= p.rect.y1 + .7);
}
export function drawGroundDetail(ctx, world, tx, ty, cx, cy) {
  if (!detailAllowed(world, tx, ty)) return;
  let seed = detailSeed(world, tx, ty);
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const t = world.get(tx, ty), near = [[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>world.get(tx+x,ty+y));
  const nearTree = near.some(t=>t===T.TREE || t===T.DEADTREE);
  const wet = near.includes(T.WATER) || t === T.SWAMP;
  const ellipse = (x,y,rx,ry,color) => { ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill(); };
  ctx.save();
  // 각 타일의 안쪽에만 그려 청크 경계에서 장식이 잘리거나 두 번 찍히지 않게 한다.
  ctx.beginPath();ctx.moveTo(cx,cy-14);ctx.lineTo(cx+29,cy);ctx.lineTo(cx,cy+14);ctx.lineTo(cx-29,cy);ctx.closePath();ctx.clip();
  if (wet) {
    ellipse(cx-4,cy+2,22,8,'rgba(25,45,34,.19)');
    ctx.strokeStyle='rgba(157,180,143,.28)';ctx.lineWidth=.8;
    for(let k=0;k<3;k++){const y=cy-2+k*3;ctx.beginPath();ctx.moveTo(cx-13+rand()*8,y);ctx.lineTo(cx+5+rand()*9,y);ctx.stroke();}
  }
  if (vegetation.has(t) || nearTree && t === T.DIRT) {
    // 숲 가장자리의 낙엽·이끼·고사리. 길 중앙은 비워 둔다.
    if (nearTree || rand()<.16) {
      ellipse(cx,cy,18,7,world.style==='darkforest'?'rgba(30,34,28,.25)':'rgba(41,57,25,.18)');
      for(let k=0;k<(nearTree?13:5);k++) {
        const x=cx+(rand()-.5)*40,y=cy+(rand()-.5)*17;
        ellipse(x+1,y+1,2.5,1.1,'rgba(16,24,13,.27)');
        ctx.save();ctx.translate(x,y);ctx.rotate(rand()*2);
        ellipse(0,0,2.6,.95,['#827244','#6f6538','#9a8550','#526136'][Math.floor(rand()*4)]);ctx.restore();
      }
    }
    if (near.includes(T.DIRT) || nearTree && rand()<.55) {
      const x=cx+(rand()-.5)*27,y=cy+3;
      ctx.strokeStyle=t===T.DARKGRASS?'#50613d':'#66834a';ctx.lineWidth=1;
      for (let side=-1;side<=1;side+=2) {
        ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+side*4,y-8,x+side*11,y-7);ctx.stroke();
        for(let k=1;k<5;k++)ellipse(x+side*k*2,y-3-k,3,1.1,k%2?'#536c38':'#78924e');
      }
    }
    if (nearTree && rand()<.13) {
      for(let k=0;k<3;k++){const x=cx-7+k*4,y=cy+rand()*4;ctx.fillStyle='#a99d76';ctx.fillRect(x,y-3,1.5,4);ellipse(x,y-3,3,1.5,world.style==='darkforest'?'#9b789b':'#ac7751');ellipse(x-1,y-4,1,.5,'#dec49c');}
    }
  } else if (stone.has(t) && (world.type==='dungeon' || t===T.STONE || world.type==='village')) {
    if (rand()<.37) {
      const x=cx+(rand()-.5)*26,y=cy+(rand()-.5)*10;
      ctx.lineWidth=.8;ctx.strokeStyle='rgba(15,18,20,.4)';ctx.beginPath();ctx.moveTo(x-9,y-3);ctx.lineTo(x-3,y-1);ctx.lineTo(x,y+3);ctx.lineTo(x+9,y+5);ctx.moveTo(x,y+3);ctx.lineTo(x+4,y-1);ctx.stroke();
      ctx.strokeStyle='rgba(215,208,181,.15)';ctx.beginPath();ctx.moveTo(x-9,y-4);ctx.lineTo(x-3,y-2);ctx.stroke();
    }
    if (near.some(n=>[T.ROCK,T.WALL,T.SHELF,T.CRYSTAL,T.CORAL].includes(n)) || rand()<.1) {
      for(let k=0;k<5;k++) {
        const x=cx+(rand()-.5)*42,y=cy+(rand()-.5)*17,s=1+rand()*3;
        ellipse(x+1,y+1,s+1,s*.55,'rgba(10,12,13,.3)');
        ctx.fillStyle=world.style==='void'?'#7e6a9c':world.style==='coral'?'#bd9e8b':world.style==='mine'?'#8e7b5b':'#8a877a';
        ctx.beginPath();ctx.moveTo(x-s,y);ctx.lineTo(x-s*.4,y-s);ctx.lineTo(x+s,y-s*.3);ctx.lineTo(x+s*.6,y+s*.5);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(219,211,186,.27)';ctx.beginPath();ctx.moveTo(x-s,y);ctx.lineTo(x-s*.4,y-s);ctx.lineTo(x+s,y-s*.3);ctx.stroke();
      }
      if(!['volcano','void'].includes(world.style))for(let k=0;k<5;k++)ellipse(cx+(rand()-.5)*35,cy+(rand()-.5)*12,3+rand()*3,1.4,'rgba(73,89,49,.28)');
    }
  } else if (t===T.DIRT || t===T.SAND) {
    if(rand()<.3)for(let k=0;k<5;k++){const x=cx+(rand()-.5)*42,y=cy+(rand()-.5)*18;ellipse(x,y+1,2,1,'rgba(36,30,22,.2)');ellipse(x,y,1.6,.7,t===T.SAND?'#cbb58b':'#a18c68');}
    if(nearTree && rand()<.5){ctx.strokeStyle='#594831';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cx-9,cy+2);ctx.lineTo(cx+6,cy-2);ctx.lineTo(cx+12,cy);ctx.moveTo(cx+3,cy-1);ctx.lineTo(cx+7,cy-5);ctx.stroke();}
  } else if(t===T.SNOW && rand()<.25) {
    ellipse(cx,cy,12,3,'rgba(150,178,188,.2)');ellipse(cx-2,cy-1,10,2,'rgba(246,249,243,.35)');
  }
  ctx.restore();
}
