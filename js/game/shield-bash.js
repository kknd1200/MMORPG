import { SHIELD_BASH_TIMING as T } from '../data/skill-motions.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const ease=t=>1-(1-t)**2;
const clamp=t=>Math.max(0,Math.min(1,t));

// Sweep the whole route; endpoint checks alone allow thin walls and trees to be crossed.
export function sweepSkillMove(world, entity, to, forMonster=false) {
  const x=entity.x,y=entity.y,dx=to.x-x,dy=to.y-y,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.06));
  for(let i=1;i<=steps;i++) {
    const nx=x+dx*i/steps,ny=y+dy*i/steps;
    if(world.blocked(nx,ny,entity.radius || .3,forMonster) || !world.hasLineOfSight(entity.x,entity.y,nx,ny)) return false;
    entity.x=nx;entity.y=ny;
  }
  return true;
}

export function cancelShieldBash(unit) {
  const e=unit.ent,state=e.shieldBash;
  if (!state) return;
  for (const pull of state.pulls) if(pull.monster.forcedPull===state) pull.monster.forcedPull=null;
  e.shieldBash=null;e.castAction=null;e.castAnim=0;
}

export function startShieldBash(game, skill, target, unit) {
  const e=unit.ent;
  if(e.dead || e.shieldBash || target.dead || !game.monsters.includes(target) || distance(e,target)>(skill.range ?? 1.3)+(target.radius || .3) || !game.hasAttackLine(e,target)) return false;
  game.spend(skill,unit);game.face(e,target);game.clearPath(e);e.moveTarget=null;
  const d=distance(e,target),stop=Math.min(d,(e.radius || .3)+(target.radius || .3)+.25),travel=Math.max(0,d-stop);
  const dx=(target.x-e.x)/(d || 1),dy=(target.y-e.y)/(d || 1);
  e.shieldBash={started:game.time,world:game.world,target,skill,start:{x:e.x,y:e.y},end:{x:e.x+dx*travel,y:e.y+dy*travel},pulls:[],hit:false,pullStarted:false,contact:false,blocked:false};
  e.castAction='shield_bash';e.castAnimDuration=T.duration;e.castAnim=T.duration;e.attackAnim=0;
  e.skillMotionUntil=game.time+T.duration;e.attackTimer=Math.max(e.attackTimer || 0,T.duration);
  e.visualFacing={...e.facing};
  game.floatText(e,skill.name,skill.color,13);
  return true;
}

export function advanceShieldBash(game,unit) {
  const e=unit.ent,state=e.shieldBash;
  if(!state) return;
  if(e.dead || state.world!==game.world) { cancelShieldBash(unit); return; }
  const elapsed=Math.max(0,game.time-state.started),target=state.target;
  e.castAnim=Math.max(0,T.duration-elapsed);e.castAnimDuration=T.duration;e.moving=false;
  if(elapsed>=T.dashStart && !state.hit && !state.blocked) {
    if(!game.hasAttackLine(e,target)) state.blocked=true;
    else {
      const k=ease(clamp((elapsed-T.dashStart)/(T.impact-T.dashStart)));
      if(!sweepSkillMove(game.world,e,{x:state.start.x+(state.end.x-state.start.x)*k,y:state.start.y+(state.end.y-state.start.y)*k})) state.blocked=true;
    }
  }
  if(elapsed>=T.impact && !state.hit) {
    state.hit=true;
    if(!state.blocked && !target.dead && game.monsters.includes(target) && distance(e,target)<=1.3+(target.radius || .3) && game.hasAttackLine(e,target)) {
      state.contact=true;
      const origin={x:e.x,y:e.y};
      game.fx({...state.skill.fx,startFrame:4,life:.45},target,0,game.leftOf(e,target),origin);
      game.skillHit(state.skill,target,unit.char.stats[state.skill.stat],game.derived(unit).attack,0,0,unit,origin);
    }
  }
  if(elapsed>=T.pullStart && !state.pullStarted) {
    state.pullStarted=true;
    if(state.contact) {
      const center={x:e.x,y:e.y},radius=state.skill.pullRadius || 3;
      game.effects.push({type:'ring',...center,r:radius,inward:true,t:0,life:T.pullEnd-T.pullStart,color:state.skill.color});
      for(const m of game.monsters) {
        const d=distance(center,m);
        if(m.dead || m.forcedPull || d>radius || !game.hasAttackLine(center,m)) continue;
        game.aggro(m,unit);
        const stop=(e.radius || .3)+(m.radius || .3)+.35;
        if(d<=stop) continue;
        const end={x:center.x+(m.x-center.x)*stop/d,y:center.y+(m.y-center.y)*stop/d};
        m.forcedPull=state;m.attackAnim=0;m.slamTarget=null;
        state.pulls.push({monster:m,start:{x:m.x,y:m.y},end});
      }
    }
  }
  const k=ease(clamp((elapsed-T.pullStart)/(T.pullEnd-T.pullStart)));
  for(const pull of state.pulls) {
    const m=pull.monster;
    if(m.forcedPull!==state) continue;
    if(m.dead || !game.monsters.includes(m) || !game.hasAttackLine(e,m)) {m.forcedPull=null;continue;}
    const clear=sweepSkillMove(game.world,m,{x:pull.start.x+(pull.end.x-pull.start.x)*k,y:pull.start.y+(pull.end.y-pull.start.y)*k},true);
    m.moving=false;
    if(!clear || elapsed>=T.pullEnd) m.forcedPull=null;
  }
  if(elapsed>=T.duration) cancelShieldBash(unit);
}
