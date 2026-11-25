import {ITEMS,canEquip} from '../js/data/items.js';
import {CHARS,CHAR_ANGLES,CHAR_DIRS,actionDur,frameAt} from '../js/data/chars.js';
import {drawChar} from '../js/game/chars.js';
import {preloadHeroActions} from '../js/game/hero-sheets.js';
const $=id=>document.getElementById(id),keys=['knight','knight_female'];
const choices=Object.entries(ITEMS).filter(([id])=>canEquip(id,'knight',100));
const options=rows=>rows.map(([id,item])=>`<option value="${id}">${item.name}</option>`).join('');
$('weapon').innerHTML='<option value="">맨손</option>'+options(choices.filter(([,it])=>it.type==='weapon'));
$('shield').innerHTML='<option value="">미착용</option>'+options(choices.filter(([,it])=>it.weaponType==='shield'));
const find=name=>choices.find(([,item])=>item.name===name)?.[0] || '';
$('weapon').value=find('강철 검');$('shield').value=find('강철 원형 방패');
$('direction').innerHTML=CHAR_DIRS.map((d,i)=>`<option value="${i}">${d}</option>`).join('');
await Promise.all(['male','female'].map(gender=>preloadHeroActions({classId:'knight',gender})));
let time=0,paused=false,last=performance.now();
const action=()=>$('action').value;
const frameTimes=key=>['walk','idle'].includes(action())?Array.from({length:8},(_,i)=>i*.1):CHARS[key].actions[action()].durations.map((_,i,a)=>a.slice(0,i).reduce((s,n)=>s+n,0)/1000+.001);
function drawPose(ctx,key,x,y,t,equipped,scale=4){
 const angle=CHAR_ANGLES[Number($('direction').value)],a=action();
 drawChar(ctx,x,y,{sprite:key,classId:'knight',level:100,equipment:equipped?{weapon:$('weapon').value,shield:$('shield').value}:{},scale,facing:{x:Math.cos(angle),y:Math.sin(angle)},moving:a==='walk',walk:t/.8*Math.PI*2,act:['walk','idle'].includes(a)?null:{name:a,t}});
}
function strip(){const c=$('frames'),n=Math.max(...keys.map(k=>frameTimes(k).length));c.width=n*160;const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);for(const [row,key] of keys.entries())for(const [i,t] of frameTimes(key).entries()){drawPose(ctx,key,i*160+80,row*200+180,t,true,2);ctx.fillStyle='#e6edf2';ctx.fillText(`${row?'여기사':'남기사'} ${i+1}`,i*160+8,row*200+20);}}
for(const id of ['weapon','shield','action','direction'])$(id).addEventListener('change',()=>{time=0;strip();});
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'재생':'일시정지';};
$('next').onclick=()=>{paused=true;$('pause').textContent='재생';const times=frameTimes('knight'),next=times.find(t=>t>time+.005);time=next ?? times[0];};
function tick(now){const dt=Math.min(.05,(now-last)/1000);last=now;const duration=['idle','walk'].includes(action()) ? .8 : actionDur('knight',action());if(!paused)time=(time+dt*Number($('speed').value))%(duration+.25);
 const c=$('stage'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);for(let i=0;i<4;i++){const key=keys[Math.floor(i/2)],ownDuration=['idle','walk'].includes(action()) ? .8 : actionDur(key,action()),t=Math.min(time,ownDuration-.001);drawPose(ctx,key,150+i*300,325,t,!!(i%2));}
 const frame=['idle','walk'].includes(action())?Math.floor(Math.min(time,.799)/.8*8)+1:frameAt('knight',action(),Math.min(time,duration-.001))+1;
 $('status').textContent=`${ITEMS[$('weapon').value]?.name || '맨손'} · ${ITEMS[$('shield').value]?.name || '방패 미착용'} · ${$('action').selectedOptions[0].textContent} · ${frame} 프레임`;
 requestAnimationFrame(tick);}
window.knightReview={drawPose,strip,frameTimes};strip();requestAnimationFrame(tick);
