export const isVanguard = unit => ['knight','warrior'].includes(unit.char.classId);

// Formation slots depend on role, not recruitment order. Frontliners stand ahead of the player.
export function formationGoal(game, unit, near=game.player) {
  const p=near || game.player, anchor=game.player || p;
  const action=anchor.action;
  const target=action && ['attack','skill','talk'].includes(action.type) ? game.findEntity?.(action.targetId) : null;
  const toward=anchor.moveTarget || target;
  let facing=toward ? {x:toward.x-p.x,y:toward.y-p.y} : p.facing || anchor.facing || {x:0,y:1};
  if(Math.hypot(facing.x,facing.y)<1e-6) facing=p.facing || anchor.facing || {x:0,y:1};
  if(Math.hypot(facing.x,facing.y)<1e-6) facing={x:0,y:1};
  const length=Math.hypot(facing.x,facing.y) || 1, f={x:facing.x/length,y:facing.y/length},side={x:-f.y,y:f.x};
  const front=isVanguard(unit),party=[...(game.party || [])];if(!party.includes(unit))party.push(unit);
  const group=party.filter(u=>!u.ent.dead && isVanguard(u)===front);
  const rank=Math.max(0,group.indexOf(unit)),lateral=group.length===1?0:(rank-(group.length-1)/2)*1.4;
  const forward=front?2.2:-1.7;
  const at=(ahead,across)=>({x:p.x+f.x*ahead+side.x*across,y:p.y+f.y*ahead+side.y*across});
  const candidates=[at(forward,lateral),at(forward*.65,lateral),at(forward,lateral+1),at(forward,lateral-1),at(forward*.35,lateral*.5),at(0,lateral),{x:p.x,y:p.y}];
  return candidates.find(q=>!game.world?.blocked?.(q.x,q.y,unit.ent.radius || .3) && (!game.world?.hasLineOfSight || game.world.hasLineOfSight(p.x,p.y,q.x,q.y))) || {x:p.x,y:p.y};
}

export function vanguardTarget(game,unit) {
  if(!isVanguard(unit) || game.autoMode==='manual' || game.player.dead || game.userMoving()) return null;
  const focus=game.focusId && game.monsters.find(m=>m.id===game.focusId && !m.dead && m.state!=='return');
  if(focus) return focus;
  const action=game.player.action;
  const shared=action?.type==='attack' && game.monsters.find(m=>m.id===action.targetId && !m.dead && m.state!=='return');
  if(shared) return shared;
  const nearby=game.pickTarget(unit,unit.target);
  return (nearby && !nearby.dead && nearby.state!=='return' ? nearby : null) || game.roamTarget();
}
