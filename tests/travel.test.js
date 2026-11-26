import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { World } from '../js/game/world.js';
import { MAPS } from '../js/data/maps.js';
import { detailSeed, detailAllowed, drawGroundDetail } from '../js/game/scenery.js';
const dungeon=Object.values(MAPS).find(m=>m.type==='dungeon'&&m.floor===1);
function fixture(def,autoMode='normal') {
 const game=Object.create(Game.prototype),world=new World(def),portal=world.portals.find(p=>p.kind==='cave'||p.kind==='down')||world.portals[0];
 Object.assign(game,{world,autoMode,player:{x:portal.cx,y:portal.cy,dead:false,moveTarget:null},mouse:{left:false,mode:null,sx:1e6,sy:1e6},time:2,portalReadyAt:0,tempPortals:[],clearPath(){},changes:[],prompts:[],hud:{showTravelPrompt(dest,kind){game.prompts.push({dest,kind})},closeTravelPrompt(){},update(){}}});
 game.changeMap=(map,spot)=>game.changes.push({map,spot});return {game,portal};
}
const click=(g,p)=>g.moveToClick(p.cx,p.cy);
function bind(game) {
 const previous=globalThis.window;globalThis.window={addEventListener(){}};
 game.canvas={addEventListener(){}};game.camera={};game.renderer={worldToScreen:(x,y)=>({x:x*10,y:y*10})};
 game.updateMouse=e=>Object.assign(game.mouse,{wx:e.x,wy:e.y});
 try{game.bindInput();}finally{globalThis.window=previous;}
 return (x,y)=>game.handlers.mousedown({button:0,x,y});
}
for(const mode of ['manual','normal','skill'])test(`${mode}: crossing any entrance, stair, map exit or return portal never activates travel`,()=>{
 const defs=[MAPS[dungeon.up.map],dungeon,MAPS[dungeon.down.map]];
 for(const def of defs){
  const {game}=fixture(def,mode);game.tempPortals=[{kind:'return',cx:-3,cy:-3,rect:{x0:-4,y0:-4,x1:-2,y1:-2},to:dungeon.exitToEntrance}];
  const action={type:'attack',targetId:'enemy',auto:true};game.player.action=action;
  for(const portal of [...game.world.portals,...game.tempPortals]){
   game.player.x=portal.cx;game.player.y=portal.cy;game.checkPortal();game.checkPortal();
   assert.equal(game.changes.length,0);assert.equal(game.prompts.length,0);assert.equal(game.player.action,action);
  }
 }
});
for(const mode of ['manual','normal','skill'])test(`${mode}: explicitly clicking a dungeon entrance asks once and requires confirmation`,()=>{
 const {game,portal}=fixture(MAPS[dungeon.up.map],mode);game.mouse.left=true;click(game,portal);game.checkPortal();
 assert.equal(game.prompts.length,1);assert.equal(game.changes.length,0);assert.equal(game.player.moveTarget,null);assert.equal(game.mouse.left,false);
 game.resolveTravel(true);assert.deepEqual(game.changes,[portal.to]);
});
test('cancelling never reopens on overlap or reentry; a fresh click retries at the same spot',()=>{
 const {game,portal}=fixture(dungeon);click(game,portal);game.resolveTravel(false);game.checkPortal();
 game.player.x=-2;game.player.y=-2;game.checkPortal();game.player.x=portal.cx;game.player.y=portal.cy;game.checkPortal();
 assert.equal(game.prompts.length,1);assert.equal(game.changes.length,0);click(game,portal);assert.equal(game.prompts.length,2);
});
test('clicking from afar keeps the chosen portal until arrival and prevents auto AI taking over',()=>{
 const {game,portal}=fixture(dungeon,'skill');game.player.x=-2;game.player.y=-2;click(game,portal);
 assert.equal(game.prompts.length,0);assert.equal(game.travelIntent.portal,portal);
 game.player.x=portal.cx;game.player.y=portal.cy;game.player.moveTarget=null;game.leader={gcd:0};game.pickTarget=()=>assert.fail('automatic combat must not replace a portal click at arrival');
 game.leaderAI(.05);game.checkPortal();assert.equal(game.prompts.length,1);assert.equal(game.travelIntent,null);
});
test('an ordinary ground destination across a portal does not authorize travel',()=>{
 const {game,portal}=fixture(dungeon);game.moveToClick(-10,-10);game.player.x=portal.cx;game.player.y=portal.cy;game.checkPortal();assert.equal(game.prompts.length,0);assert.equal(game.changes.length,0);
});
test('upstairs and temporary return portals require their own clicks',()=>{
 const {game}=fixture(dungeon),up=game.world.portals.find(p=>p.kind==='up');game.player.x=up.cx;game.player.y=up.cy;game.checkPortal();assert.equal(game.prompts.length,0);
 click(game,up);assert.equal(game.prompts[0].kind,'up');game.resolveTravel(false);
 const q={kind:'return',to:dungeon.exitToEntrance,cx:-3,cy:-3,rect:{x0:-4,y0:-4,x1:-2,y1:-2}};game.tempPortals=[q];game.player.x=-3;game.player.y=-3;
 game.checkPortal();assert.equal(game.prompts.length,1);click(game,q);assert.equal(game.prompts.at(-1).kind,'return');
});
test('field exits are direct only after clicking them, including while auto hunting',()=>{
 const {game}=fixture(Object.values(MAPS).find(m=>m.type==='field'));
 const portal=game.world.portals.find(p=>p.kind==='exit');game.player.x=portal.cx;game.player.y=portal.cy;
 game.checkPortal();assert.equal(game.changes.length,0);click(game,portal);assert.deepEqual(game.changes,[portal.to]);assert.equal(game.prompts.length,0);assert.equal(game.travelIntent,null);
});
test('clicks cannot transfer after death, changing maps, losing the portal or failed navigation',()=>{
 for(const reason of ['dead','map','removed','failed']){
  const {game,portal}=fixture(dungeon);game.player.x=-2;game.player.y=-2;click(game,portal);
  if(reason==='dead')game.player.dead=true;
  if(reason==='map')game.world.id='other-map';
  if(reason==='removed')game.world.portals=game.world.portals.filter(p=>p!==portal);
  if(reason==='failed')game.player.moveTarget=null;
  game.checkPortal();assert.equal(game.travelIntent,null);game.player.x=portal.cx;game.player.y=portal.cy;game.checkPortal();assert.equal(game.prompts.length,0);
 }
});
test('stale and dead-player confirmation cannot transfer; confirmation still pauses simulation',()=>{
 for(const reason of ['dead','map','away']){
  const {game,portal}=fixture(dungeon);click(game,portal);game.update(.05);assert.equal(game.time,2);
  if(reason==='dead')game.player.dead=true;
  if(reason==='map')game.world.id='other-map';
  if(reason==='away'){game.player.x=-2;game.player.y=-2;}
  game.resolveTravel(true);assert.equal(game.changes.length,0);
 }
});
test('actual canvas clicks arm a portal; NPC or enemy clicks on the same tile do not',()=>{
 const {game,portal}=fixture(dungeon),press=bind(game);
 for(const entity of [{id:'enemy'},{id:'npc',isNpc:true}]){
  game.hover=entity;press(portal.cx,portal.cy);game.checkPortal();assert.equal(game.prompts.length,0);assert.equal(game.travelIntent,null);
 }
 game.hover=null;press(portal.cx,portal.cy);assert.equal(game.prompts.length,1);
});
test('dragging away cancels an entrance click; dragging onto a portal never arms it',()=>{
 const {game,portal}=fixture(dungeon),press=bind(game);game.player.x=-2;game.player.y=-2;
 press(portal.cx,portal.cy);assert.ok(game.travelIntent);game.handlers.mousemove({x:-5,y:-5});assert.equal(game.travelIntent,null);
 game.handlers.mousemove({x:portal.cx,y:portal.cy});assert.equal(game.travelIntent,null);
 game.player.x=portal.cx;game.player.y=portal.cy;game.checkPortal();assert.equal(game.prompts.length,0);
});
test('a cave opening or portal label can be clicked above its ground footprint',()=>{
 const {game,portal}=fixture(MAPS[dungeon.up.map]);game.camera={};game.renderer={worldToScreen:()=>({x:100,y:200})};
 game.mouse.wx=-10;game.mouse.wy=-10;game.mouse.sx=100;game.mouse.sy=140;assert.equal(game.portalFromClick(),portal);
 game.mouse.sy=70;assert.equal(game.portalFromClick(),portal);
 game.mouse.sx=999;assert.equal(game.portalFromClick(),null);
});
test('scenery is repeatable, preserves map collision data and keeps portals clear',()=>{
 const world=new World(dungeon),tiles=world.tiles.slice();assert.equal(detailSeed(world,5,8),detailSeed(world,5,8));assert.notEqual(detailSeed(world,5,8),detailSeed(world,6,8));
 const noop=()=>{},ctx=new Proxy({}, {get:()=>noop,set:()=>true});
 for(let y=0;y<world.h;y++)for(let x=0;x<world.w;x++)drawGroundDetail(ctx,world,x,y,0,0);
 assert.deepEqual(world.tiles,tiles);for(const p of world.portals)assert.equal(detailAllowed(world,Math.floor(p.cx),Math.floor(p.cy)),false);
});
