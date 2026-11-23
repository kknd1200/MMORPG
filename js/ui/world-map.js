import {MAPS,WORLD_ROUTES,DUNGEONS} from '../data/maps.js';
import {url} from '../game/art.js';
export const ATLAS_POSITIONS={capital:[43,46],f1:[35,46],v1:[27,46],f2:[21,34],v2:[26,22],f4:[15,70],f3:[52,62],v3:[66,86],f5:[78,70],f6:[44,84],f7:[61,47],v4:[77,48],f8:[87,25],f9:[44,29],v5:[53,15],v6:[63,10],f10:[73,15]};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function surfaceMap(id){const m=MAPS[id];return m?.type==='dungeon'?DUNGEONS.find(d=>d.id===m.dungeon)?.field:id;}
export function worldRoute(from,to){
 from=surfaceMap(from);to=surfaceMap(to);if(!MAPS[from]||!MAPS[to])return [];
 const queue=[[from]],seen=new Set([from]);
 for(let i=0;i<queue.length;i++){const p=queue[i],id=p.at(-1);if(id===to)return p;for(const e of Object.values(MAPS[id].exits)){if(!seen.has(e.map)){seen.add(e.map);queue.push([...p,e.map]);}}}return [];
}
export function worldMapMarkup(currentId,selectedId){
 const current=surfaceMap(currentId),selected=surfaceMap(selectedId)||current,def=MAPS[selected]||MAPS.capital;
 const route=worldRoute(current,def.id),dungeons=DUNGEONS.filter(d=>d.field===def.id);
 const lines=WORLD_ROUTES.map(([a,,b])=>{const [x1,y1]=ATLAS_POSITIONS[a],[x2,y2]=ATLAS_POSITIONS[b];const active=route.some((id,i)=>i&&((route[i-1]===a&&id===b)||(route[i-1]===b&&id===a)));return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${active?'route-active':''}"/>`;}).join('');
 const pins=Object.entries(ATLAS_POSITIONS).map(([id,[x,y]])=>{const m=MAPS[id],label=`${m.name}${m.type==='field'?` Lv.${m.level[0]}~${m.level[1]}`:''}`;return `<button data-atlas-map="${id}" class="atlas-pin ${m.type} ${m.capital?'capital':''} ${id===current?'current':''} ${id===def.id?'selected':''}" style="left:${x}%;top:${y}%" aria-label="${escape(label)}${id===current?' · 현재 위치':''}" aria-pressed="${id===def.id}" title="${escape(label)}"><span>${m.capital?'♜':m.type==='village'?'◆':'●'}</span><small>${escape(m.name)}${id===current?' · 현재':''}</small></button>`;}).join('');
 return `<p class="atlas-intro">성도를 중심으로 마을과 사냥터가 연결됩니다. 지점을 선택하면 실제 이동 경로와 던전 입구를 확인할 수 있습니다.</p><div class="atlas-art"><img src="${url('environment/world-map.webp')}" alt="중앙 성도와 숲·설원·협곡·해안·화산으로 이루어진 대륙 지도"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${pins}</div><div class="atlas-details"><b>${escape(def.name)}</b> · ${def.type==='village'?'안전지대':`권장 Lv.${def.level[0]}~${def.level[1]}`}<p>현재 위치: ${escape(MAPS[currentId]?.name||'')}<br>이동 경로: ${route.map(id=>escape(MAPS[id].name)).join(' → ')}</p>${dungeons.length?`<p>던전 입구: ${dungeons.map(d=>`${escape(d.name)} · Lv.${d.levels[0]}~${d.levels[1]} · 7층`).join('<br>')}</p>`:''}<small>지도는 길 안내입니다. 맵의 출구로 걸어 이동하거나 마을 이동술사를 이용하세요.</small></div>`;
}
