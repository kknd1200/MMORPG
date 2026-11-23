import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { World } from '../js/game/world.js';
import { MAPS } from '../js/data/maps.js';
import { detailSeed, detailAllowed, drawGroundDetail } from '../js/game/scenery.js';
const dungeon=Object.values(MAPS).find(m=>m.type==='dungeon'&&m.floor===1);
function fixture(def) {
 const game=Object.create(Game.prototype),world=new World(def),portal=world.portals.find(p=>p.kind==='cave'||p.kind==='down')||world.portals[0];
 Object.assign(game,{world,player:{x:portal.cx,y:portal.cy,dead:false,moveTarget:{x:1,y:1}},mouse:{left:true,mode:'move'},time:2,portalReadyAt:0,tempPortals:[],clearPath(){},changes:[],prompts:[],hud:{showTravelPrompt(dest,kind){game.prompts.push({dest,kind})},closeTravelPrompt(){},update(){}}});
 game.changeMap=(map,spot)=>game.changes.push({map,spot});return {game,portal};
}
test('dungeon entrance asks once and transfers only after confirmation',()=>{
 const field=MAPS[dungeon.up.map],{game,portal}=fixture(field);game.checkPortal();game.checkPortal();assert.equal(game.prompts.length,1);assert.equal(game.changes.length,0);assert.equal(game.player.moveTarget,null);assert.equal(game.mouse.left,false);game.resolveTravel(true);assert.deepEqual(game.changes,[portal.to]);
});
test('cancelling a staircase stays on the floor and asks again only after leaving',()=>{
 const {game,portal}=fixture(dungeon);game.checkPortal();game.resolveTravel(false);game.checkPortal();assert.equal(game.prompts.length,1);assert.equal(game.changes.length,0);game.player.x=-2;game.player.y=-2;game.checkPortal();game.player.x=portal.cx;game.player.y=portal.cy;game.checkPortal();assert.equal(game.prompts.length,2);
});
test('upstairs and dungeon return portal also require confirmation',()=>{
 const {game}=fixture(dungeon);const up=game.world.portals.find(p=>p.kind==='up');game.player.x=up.cx;game.player.y=up.cy;game.checkPortal();assert.equal(game.prompts[0].kind,'up');assert.equal(game.changes.length,0);
 game.resolveTravel(false);game.player.x=-1;game.player.y=-1;game.checkPortal();const q={kind:'return',to:dungeon.exitToEntrance,cx:0,cy:0,rect:{x0:-2,y0:-2,x1:0,y1:0}};game.tempPortals=[q];game.checkPortal();assert.equal(game.prompts.at(-1).kind,'return');
});
test('field exits remain direct and stale or dead-player confirmations cannot transfer',()=>{
 const field=Object.values(MAPS).find(m=>m.type==='field'),{game}=fixture(field);const exit=game.world.portals.find(p=>p.kind==='exit');game.player.x=exit.cx;game.player.y=exit.cy;game.checkPortal();assert.equal(game.changes.length,1);assert.equal(game.prompts.length,0);
 const other=fixture(dungeon).game;other.checkPortal();other.player.dead=true;other.resolveTravel(true);assert.equal(other.changes.length,0);
});
test('confirmation pauses simulation and does not advance combat time',()=>{
 const {game}=fixture(dungeon);game.checkPortal();game.update(.05);assert.equal(game.time,2);
});
test('scenery is repeatable, preserves map collision data and keeps portals clear',()=>{
 const world=new World(dungeon),tiles=world.tiles.slice();assert.equal(detailSeed(world,5,8),detailSeed(world,5,8));assert.notEqual(detailSeed(world,5,8),detailSeed(world,6,8));
 const noop=()=>{},ctx=new Proxy({}, {get:()=>noop,set:()=>true});
 for(let y=0;y<world.h;y++)for(let x=0;x<world.w;x++)drawGroundDetail(ctx,world,x,y,0,0);
 assert.deepEqual(world.tiles,tiles);for(const p of world.portals)assert.equal(detailAllowed(world,Math.floor(p.cx),Math.floor(p.cy)),false);
});
