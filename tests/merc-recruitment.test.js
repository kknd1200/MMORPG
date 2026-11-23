import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../js/game/game.js';
import {Hud} from '../js/game/hud.js';
import {mercOffers,createMerc,MERC_CLASSES,MERC_REFRESH_COST} from '../js/systems/party.js';
import {heroSprite} from '../js/game/hero-sheets.js';
function fixture(gold=1000) {
 const g=Object.create(Game.prototype);let now=100*3600000,saved;
 Object.assign(g,{char:{name:'대표',level:10,gold,party:[]},player:{dead:false},party:[],world:{def:{id:'town1',type:'village',level:[5,10]}},openNpc:{kind:'mercenary'},now:()=>now,hud:{markDirty(){}},log(){},save(){saved=JSON.parse(JSON.stringify(this.char))},makeMercUnit:char=>({id:char.id,char,ent:{}}),preloadUnit(){},fx(){}});
 g.units=()=>[{char:g.char},...g.party];
 return {g,setHour:h=>{now=h*3600000},saved:()=>saved};
}
test('every four-person roster has two women and two men, including paid refreshes',()=>{
 const femaleClasses=new Set();
 for(let h=100;h<140;h++)for(let r=0;r<4;r++){
  const o=mercOffers('town1',5,h,4,[],r);
  assert.equal(o.filter(x=>x.gender==='female').length,2);assert.equal(o.filter(x=>x.gender==='male').length,2);
  o.filter(x=>x.gender==='female').forEach(x=>femaleClasses.add(x.classId));
  assert.deepEqual(o,mercOffers('town1',5,h,4,[],r));
 }
 assert.deepEqual([...femaleClasses].sort(),[...MERC_CLASSES].sort());
});
test('paid refresh deducts exactly the fixed fee and persists a stable new roster without altering the party',()=>{
 const {g,saved}=fixture(),old=g.mercOffers(),party=g.party;
 assert.equal(g.refreshMercOffers(),true);assert.equal(g.char.gold,1000-MERC_REFRESH_COST);assert.equal(g.party,party);
 assert.ok(g.mercOffers().every(o=>!old.some(x=>x.offerId===o.offerId)));assert.notDeepEqual(g.mercOffers(),old);
 assert.deepEqual(g.mercOffers(),g.mercOffers());
 const {g:reloaded}=fixture();reloaded.char=saved();assert.deepEqual(reloaded.mercOffers(),g.mercOffers());
 const key=g.mercOfferKey();g.refreshMercOffers();assert.notEqual(g.mercOfferKey(),key);assert.equal(g.char.gold,1000-MERC_REFRESH_COST*2);
});
test('insufficient gold, death and leaving the recruiter cannot charge or refresh',()=>{
 for(const reason of ['gold','dead','closed','field']){
  const {g,saved}=fixture(reason==='gold'?MERC_REFRESH_COST-1:1000),before=g.mercOffers(),gold=g.char.gold;
  if(reason==='dead')g.player.dead=true;if(reason==='closed')g.openNpc=null;if(reason==='field')g.world.def.type='field';
  assert.equal(g.refreshMercOffers(),false);assert.equal(g.char.gold,gold);assert.deepEqual(g.mercOffers(),before);assert.equal(saved(),undefined);
 }
 const {g}=fixture(MERC_REFRESH_COST);assert.equal(g.refreshMercOffers(),true);assert.equal(g.char.gold,0);assert.equal(g.refreshMercOffers(),false);
});
test('next hour still gives a free new roster and each town tracks its own refresh',()=>{
 const {g,setHour}=fixture();g.refreshMercOffers();const current=g.mercOffers(),gold=g.char.gold;
 g.world.def.id='town2';assert.equal(g.mercRecruitment().refresh,0);g.refreshMercOffers();g.world.def.id='town1';assert.deepEqual(g.mercOffers(),current);
 setHour(101);assert.equal(g.mercRecruitment().refresh,0);assert.notDeepEqual(g.mercOffers(),current);assert.equal(g.char.gold,gold-MERC_REFRESH_COST);
 assert.deepEqual(g.mercOffers(),mercOffers('town1',5,101,4,[g.char.name]));
});
test('female offer hires as a female character, survives saving, and cannot be hired twice',()=>{
 const {g,saved}=fixture(10000),offer=g.mercOffers().find(x=>x.gender==='female');g.hireMerc(offer.offerId);
 assert.equal(g.party.length,1);assert.equal(g.party[0].char.gender,'female');assert.equal(saved().party[0].gender,'female');assert.equal(heroSprite(g.party[0].char),heroSprite(offer));
 const gold=g.char.gold;g.hireMerc(offer.offerId);assert.equal(g.char.gold,gold);assert.equal(g.party.length,1);
 const stale=g.mercOffers()[0];g.refreshMercOffers();const after=g.char.gold;g.hireMerc(stale.offerId);assert.equal(g.char.gold,after);assert.equal(g.party.length,1);
});
test('all classes use distinct male and female art and legacy offers still default to male',()=>{
 for(const classId of MERC_CLASSES){
  const female=createMerc({classId,name:'여성',level:1,gender:'female'},'f'),male=createMerc({classId,name:'남성',level:1},'m');
  assert.equal(female.gender,'female');assert.equal(male.gender,'male');assert.notEqual(heroSprite(female),heroSprite(male));
 }
});
test('recruiter markup shows offer gender portraits and the exact fee, disabling refresh below the fee',()=>{
 const {g}=fixture(MERC_REFRESH_COST-1);const html=Hud.prototype.mercHtml.call({game:g});
 assert.equal((html.match(/data-gender="female"/g)||[]).length,2);assert.equal((html.match(/data-gender="male"/g)||[]).length,2);
 assert.match(html,/data-refresh-merc disabled/);assert.ok(html.includes(`${MERC_REFRESH_COST}G`));
 g.char.gold=MERC_REFRESH_COST;assert.doesNotMatch(Hud.prototype.mercHtml.call({game:g}),/data-refresh-merc disabled/);
});
