import test from 'node:test';
import assert from 'node:assert/strict';
import {World,T} from '../js/game/world.js';
import {Game} from '../js/game/game.js';
import {CLASSES} from '../js/data/classes.js';
import {SKILLS} from '../js/data/skills.js';
const world=()=>Object.assign(Object.create(World.prototype),{w:12,h:12,tiles:new Uint8Array(144)});
test('walls, trees and raised obstacles block attacks, while low terrain does not',()=>{
 const w=world();for(const t of [T.WALL,T.TREE,T.DEADTREE,T.ROCK,T.HOUSE,T.SHELF,T.CRYSTAL,T.ICE,T.CORAL,T.GRAVE,T.CACTUS]){w.set(3,2,t);assert.equal(w.hasLineOfSight(.5,2.5,6.5,2.5),false);assert.equal(w.hasLineOfSight(6.5,2.5,.5,2.5),false);}
 for(const t of [T.GRASS,T.DIRT,T.WATER,T.LAVA,T.FLOOR,T.SAND]){w.set(3,2,t);assert.equal(w.hasLineOfSight(.5,2.5,6.5,2.5),true);}
 assert.equal(w.hasLineOfSight(-1,0,1,1),false);assert.equal(w.hasLineOfSight(1,1,Infinity,1),false);
});
test('supercover catches thin diagonal crossings, corners and lines on obstacle boundaries',()=>{
 const w=world();w.set(2,1,T.WALL);assert.equal(w.hasLineOfSight(1.5,1.5,3.5,3.5),false);assert.equal(w.hasLineOfSight(3.5,3.5,1.5,1.5),false);
 assert.equal(w.hasLineOfSight(.2,1.99,5.8,2.01),false);
 w.set(2,1,T.GRASS);w.set(1,2,T.TREE);assert.equal(w.hasLineOfSight(1.5,1.5,3.5,3.5),false);
 assert.equal(w.hasLineOfSight(2,1.5,2,4.5),false);
 w.set(1,2,T.GRASS);assert.equal(w.hasLineOfSight(1.5,1.5,3.5,3.5),true);
});
function combat(classId='mage'){
 const w=world(),cls=CLASSES[classId],target={id:10,x:5.5,y:2.5,radius:.4,armor:0,dead:false},ent={id:'player',x:.5,y:2.5,attackTimer:0,action:{type:'attack',targetId:10},facing:{x:1,y:0}},char={classId,level:30,mp:100,stats:cls.baseStats},unit={id:'player',isLeader:true,ent,char,cooldowns:{},buffs:[],gcd:0},g=Object.create(Game.prototype),calls={move:0,attack:0,spend:0,fx:[],hit:[]};
 Object.assign(g,{world:w,cls,char,leader:unit,player:ent,autoMode:'normal',time:1,mouse:{left:false},monsters:[target],effects:[],pending:[],findEntity:()=>target,derived:()=>({speed:3,attack:10}),pickTarget:()=>target,navigate(){calls.move++;return 'moving'},clearPath(){},spend(){calls.spend++},floatText(){},fx(...args){calls.fx.push(args)},skillHit(...args){calls.hit.push(args)},autoSkill:()=>false});
 return {g,w,unit,target,calls};
}
for(const id of ['elf','mage','priest'])test(`${id} leader and mercenary reposition behind cover instead of attacking`,()=>{
 const {g,w,unit,calls}=combat(id);g.unitAttack=()=>calls.attack++;w.set(2,2,T.TREE);
 g.updatePlayer(.05);g.mercAI(unit,0,.05);assert.equal(calls.move,2);assert.equal(calls.attack,0);
 w.set(2,2,T.GRASS);g.updatePlayer(.05);unit.ent.attackTimer=0;g.mercAI(unit,0,.05);assert.equal(calls.attack,2);assert.equal(calls.move,2);
});
test('direct basic/skill calls cannot shoot through cover or spend MP; manual skill queues repositioning',()=>{
 const {g,w,unit,target,calls}=combat();w.set(2,2,T.WALL);g.unitAttack(unit,target);g.castTargetSkill(SKILLS.fire_bolt,target,unit);assert.equal(g.effects.length,0);assert.equal(calls.spend,0);assert.equal(calls.hit.length,0);
 g.useSkill('fire_bolt');assert.equal(g.player.action.type,'skill');assert.equal(g.player.action.skillId,'fire_bolt');assert.equal(calls.spend,0);
});
test('chain jumps and area hits exclude enemies behind cover',()=>{
 const {g,w,unit,target,calls}=combat();target.x=2.5;w.set(3,2,T.WALL);g.monsters.push({id:11,x:4.5,y:2.5,radius:.4,dead:false});g.addProjectile=()=>.2;
 g.castTargetSkill(SKILLS.chain_lightning,target,unit);assert.equal(calls.hit.length,1);assert.equal(calls.hit[0][1],target);
 calls.hit=[];g.castTargetSkill(SKILLS.arcane_burst,target,unit);assert.ok(calls.hit.every(args=>args[1]===target));
});
test('blocked monster attacks and skills cause no damage or projectiles',()=>{
 const {g,w,unit,target}=combat();w.set(2,2,T.WALL);let damage=0;g.hurtUnit=()=>damage++;
 const def={projectile:'arrow',active:[]};g.monsterAttack(target,def,unit);g.monsterSkill(target,def,unit);assert.equal(g.monsterHit(target,def,1,0,unit),false);assert.equal(damage,0);assert.equal(g.effects.length,0);
});
test('delayed damage and following impact effects are cancelled when target moves behind a wall',()=>{
 const {g,w,unit,target}=combat();target.hp=100;target.type='slime';g.aggro=()=>{};const origin={x:unit.ent.x,y:unit.ent.y};
 g.damageMonster(target,10,'white',.4,unit,origin);assert.equal(g.pending.length,1);w.set(2,2,T.WALL);g.pending[0].fn();assert.equal(target.hp,100);
 g.effects=[{t:0,life:1,attackOrigin:origin,follow:target}];g.updateEffects(.1);assert.equal(g.effects.length,0);
});
test('automatic ranged attacker follows a path around cover and stops once a clear shot opens',()=>{
 const {g,w,unit,target}=combat();for(let y=1;y<5;y++)w.set(2,y,T.WALL);
 g.navigate=Game.prototype.navigate;g.clearPath=Game.prototype.clearPath;unit.ent.radius=.3;let shots=0;
 g.unitAttack=(u,m)=>{assert.equal(g.hasAttackLine(u.ent,m),true);shots++};
 for(let n=0;n<300&&!shots;n++){g.time+=.05;g.updatePlayer(.05)}
 assert.ok(shots>0);assert.ok(unit.ent.y<1||unit.ent.y>4);assert.ok(Math.hypot(unit.ent.x-target.x,unit.ent.y-target.y)>1.5);
});
test('line visibility is symmetric for fractional shots across a seeded obstacle layout',()=>{
 const w=world();for(let y=1;y<10;y++)for(let x=1;x<10;x++)if((x*17+y*31)%11===0)w.set(x,y,T.WALL);
 for(let i=0;i<150;i++){const a=[.1+(i*37%110)/10,.15+(i*23%110)/10],b=[.2+(i*11%110)/10,.25+(i*41%110)/10];assert.equal(w.hasLineOfSight(...a,...b),w.hasLineOfSight(...b,...a));}
});
