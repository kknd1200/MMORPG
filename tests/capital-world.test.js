import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAPS,VILLAGES,WORLD_ROUTES} from '../js/data/maps.js';
import {NPC_ART} from '../js/data/npcs.js';
import {World,T} from '../js/game/world.js';
import {ATLAS_POSITIONS,worldRoute,worldMapMarkup,surfaceMap} from '../js/ui/world-map.js';

test('all supplied NPC appearances are used, anchored to the atlas and reachable in safe towns',()=>{
 const used=new Set();assert.equal(Object.keys(NPC_ART).length,16);assert.ok(fs.existsSync(new URL('../assets/npcs/townsfolk.webp',import.meta.url)));
 for(const v of VILLAGES){const w=new World(MAPS[v.id]),ids=new Set();assert.equal(w.safe,true);assert.equal(w.zones.length,0);
  for(const n of w.npcs){assert.ok(NPC_ART[n.art]);used.add(n.art);assert.ok(!ids.has(n.id));ids.add(n.id);assert.ok(w.reachable(n));assert.equal(w.blocked(n.x,n.y),false);}
  for(const kind of ['guide','merchant','smith','healer','teleporter','mercenary'])assert.equal(w.npcs.filter(n=>n.kind===kind).length,1);
 }
 assert.equal(used.size,16);
 for(const a of Object.values(NPC_ART)){assert.ok(a.col>=0&&a.col<4&&a.row>=0&&a.row<4);assert.ok(a.height>0&&a.height<=340);assert.ok(a.footY<=384)}
});
test('capital has a moat, four walkable gates and bridges with safe arrivals outside portal rectangles',()=>{
 const w=new World(MAPS.capital);assert.equal(w.type,'village');assert.equal(w.get(4,10),T.WATER);
 for(const side of ['north','south','east','west']){const p=w.spots[side];assert.ok(w.reachable(p));assert.equal(w.portalAt(p.x,p.y),null);assert.ok(w.portals.some(q=>q.to.map===MAPS.capital.exits[side].map));}
});
test('world atlas and directions represent every real surface connection and dungeon entrance',()=>{
 assert.ok(fs.existsSync(new URL('../assets/environment/world-map.webp',import.meta.url)));
 const ids=Object.values(MAPS).filter(m=>m.type!=='dungeon').map(m=>m.id);assert.equal(Object.keys(ATLAS_POSITIONS).length,ids.length);
 for(const id of ids){assert.ok(ATLAS_POSITIONS[id]);for(const dest of ids){const route=worldRoute(id,dest);assert.equal(route[0],id);assert.equal(route.at(-1),dest);for(let i=1;i<route.length;i++)assert.ok(Object.values(MAPS[route[i-1]].exits).some(e=>e.map===route[i]));}}
 assert.equal(surfaceMap('d6-7'),'f8');assert.equal(worldRoute('d6-7','capital')[0],'f8');
 const html=worldMapMarkup('d1-3','f8');assert.ok(html.includes('용암 심연'));assert.ok(html.includes('검은 바위 굴'));assert.ok(html.includes('현재 위치'));assert.equal((html.match(/<line /g)||[]).length,WORLD_ROUTES.length);
});
test('return scroll and death homes use the nearest connected town after the radial map change',()=>{
 for(const m of Object.values(MAPS)){const home=MAPS[m.home];assert.equal(home.type,'village');if(m.type==='village'){assert.equal(m.home,m.id);continue}
  const distance=worldRoute(m.id,m.home).length;assert.ok(distance>0);assert.equal(distance,Math.min(...VILLAGES.map(v=>worldRoute(m.id,v.id).length)));
 }
});
