import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../js/game/game.js';
import {World,T} from '../js/game/world.js';
import {CLASSES} from '../js/data/classes.js';
import {formationGoal,isVanguard,vanguardTarget} from '../js/game/party-formation.js';

function unit(classId,id,x=8,y=10) {
 const char={id,name:id,classId,level:20,stats:{...CLASSES[classId].baseStats},hp:100,maxHp:100,mp:0,maxMp:100,skillSlots:[],equipment:{}};
 return {id,char,ent:{id,x,y,radius:.3,facing:{x:1,y:0},attackTimer:0,dead:false,stuck:0},buffs:[],cooldowns:{},gcd:0,target:null};
}
function fixture(classId='knight',mode='normal') {
 const leader=unit('mage','player',10,10),front=unit(classId,'front'),support=unit('priest','support',8,11);
 leader.isLeader=true;leader.ent.action={type:'attack',targetId:'enemy'};
 const enemy={id:'enemy',x:16,y:10,radius:.3,dead:false,state:'idle'},g=Object.create(Game.prototype),hits=[];
 Object.assign(g,{leader,player:leader.ent,char:leader.char,party:[support,front],monsters:[enemy],autoMode:mode,time:0,mouse:{left:false},world:{blocked:()=>false,hasLineOfSight:()=>true,findPath:()=>[]},derived:()=>({speed:4,attack:10}),effects:[],hud:{markDirty(){}},fx(){},unitAttack(u,target){hits.push({unit:u.id,target:target.id,time:g.time});u.ent.attackAnim=.3;}});
 g.findEntity=id=>g.monsters.find(m=>m.id===id && !m.dead);
 return {g,front,support,enemy,hits};
}
for(const classId of ['knight','warrior'])for(const mode of ['normal','skill'])test(`${classId} ${mode}: advances beyond a stationary ranged leader and actually makes melee attacks`,()=>{
 const {g,front,enemy,hits}=fixture(classId,mode);
 for(let i=0;i<150;i++){g.time+=.05;g.mercAI(front,1,.05);}
 assert.ok(front.ent.x>g.player.x);assert.ok(Math.hypot(front.ent.x-enemy.x,front.ent.y-enemy.y)<=1.6);
 assert.ok(hits.length>=3);for(let i=1;i<hits.length;i++)assert.ok(hits[i].time-hits[i-1].time>=1-1e-8);
});
test('frontline position is ahead in all eight travel directions, independent of recruitment order',()=>{
 const {g,front,support}=fixture();const warrior=unit('warrior','warrior');g.party=[support,warrior,front];g.player.action=null;
 for(let i=0;i<8;i++) {
  const f={x:Math.cos(i*Math.PI/4),y:Math.sin(i*Math.PI/4)};g.player.facing=f;
  const a=formationGoal(g,front),b=formationGoal(g,warrior),rear=formationGoal(g,support);
  const projection=q=>(q.x-g.player.x)*f.x+(q.y-g.player.y)*f.y;
  assert.ok(projection(a)>2 && projection(b)>2);assert.ok(projection(rear)<0);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>1);
 }
 assert.equal(isVanguard(front),true);assert.equal(isVanguard(warrior),true);assert.equal(isVanguard(support),false);
});
test('manual movement puts melee mercenaries in front while suppressing a fight that would leave them behind',()=>{
 const {g,front}=fixture();g.player.moveTarget={x:20,y:10};g.player.facing={x:0,y:-1};g.player.action=null;
 g.mercAI(front,1,.05);assert.equal(front.target,null);assert.ok(front.ent.x>8);
 const goal=formationGoal(g,front);assert.ok(goal.x>g.player.x);assert.ok(Math.abs(goal.y-g.player.y)<.01);
});
test('frontliners can regain their forward slot even when the player has a movement-speed buff',()=>{
 const {g,front}=fixture();g.monsters=[];g.player.action=null;g.player.moveTarget={x:100,y:10};g.player.moving=true;
 g.derived=u=>({speed:u===front?4:6,attack:10});
 for(let i=0;i<100;i++){g.time+=.05;g.player.x+=6*.05;g.mercAI(front,1,.05);}
 assert.ok(front.ent.x>g.player.x+.5);
});
test('auto hunting shares the leader roaming target beyond the old 11-tile engagement limit',()=>{
 const {g,front,enemy}=fixture();enemy.x=35;
 assert.equal(g.pickTarget(front,null),null);assert.equal(vanguardTarget(g,front),enemy);
 g.mercAI(front,1,.05);assert.equal(front.target,enemy);assert.ok(front.ent.x>8);
 g.player.action=null;front.target=null;assert.equal(vanguardTarget(g,front),enemy);
 g.autoMode='manual';assert.equal(vanguardTarget(g,front),null);
});
test('focus takes priority and dead or returning roaming enemies are not selected',()=>{
 const {g,front,enemy}=fixture();const focus={...enemy,id:'focus',x:14};g.monsters.push(focus);g.focusId='focus';assert.equal(vanguardTarget(g,front),focus);
 focus.dead=true;assert.equal(vanguardTarget(g,front),enemy);enemy.state='return';assert.equal(vanguardTarget(g,front),null);
});
test('frontliners path around real walls and trees before attacking rather than crossing them',()=>{
 for(const obstruction of [T.WALL,T.TREE]) {
  const {g,front,enemy,hits}=fixture();
  const world=Object.assign(Object.create(World.prototype),{w:20,h:20,tiles:new Uint8Array(400)});
  for(let y=8;y<=12;y++)world.set(12,y,obstruction);
  g.world=world;g.player.x=10.5;g.player.y=10.5;front.ent.x=9.5;front.ent.y=10.5;enemy.x=17.5;enemy.y=10.5;
  for(let i=0;i<400 && !hits.length;i++) {g.time+=.05;g.mercAI(front,1,.05);assert.equal(world.blocked(front.ent.x,front.ent.y,front.ent.radius),false);}
  assert.ok(hits.length>0,'must reach a valid melee attack position around the obstacle');
 }
});
test('blocked formation slots fall back to a visible walkable position near the player',()=>{
 const {g,front}=fixture();g.player.action=null;g.world.blocked=x=>x>11;g.world.hasLineOfSight=(_x,_y,x)=>x<=11;
 const goal=formationGoal(g,front);assert.ok(!g.world.blocked(goal.x,goal.y));assert.ok(g.world.hasLineOfSight(10,10,goal.x,goal.y));
});
test('recruiting and reviving knights places them in front without changing equipment or growth',()=>{
 const {g,front}=fixture();g.player.action=null;
 const fresh=g.makeMercUnit({...front.char,id:'new'},g.player,0);assert.ok(fresh.ent.x>g.player.x);
 front.ent.dead=true;front.char.hp=0;front.char.equipment.weapon='long_sword';g.reviveMerc(front,true);
 assert.equal(front.ent.dead,false);assert.equal(front.char.hp,100);assert.ok(front.ent.x>g.player.x);assert.equal(front.char.equipment.weapon,'long_sword');
});
test('map entry restores role formation instead of putting frontliners behind the leader',()=>{
 const {g,front,support}=fixture();g.world.zones=[];
 Object.assign(g,{artZones:new Set(),activeZones:new Set(),hud:{closeTravelPrompt(){},onMapChange(){}},streamZones(){},camera:{},clockOffset:0});
 const world={id:'next',zones:[],def:{},blocked:()=>false,hasLineOfSight:()=>true};
 g.enterMap(world,{x:20,y:20},true);assert.ok(front.ent.x>20);assert.ok(support.ent.x<20);assert.equal(front.target,null);
});
test('stuck melee pursuit retries pathfinding, and death/leash still overrides pursuit',()=>{
 const {g,front}=fixture();let clears=0;g.navigate=()=> 'stuck';g.clearPath=()=>{clears++;};
 for(let i=0;i<20;i++){g.time+=.05;g.mercAI(front,1,.05);}assert.ok(clears>0);
 g.player.dead=true;g.mercAI(front,1,.05);assert.equal(front.target,null);
 g.player.dead=false;front.ent.x=-5;g.mercAI(front,1,.05);assert.equal(front.target,null);
});
