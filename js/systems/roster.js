export function promoteRoster(owner,memberId){
 const root=JSON.parse(JSON.stringify(owner)),index=(root.party || []).findIndex(c=>c.id===memberId);
 if(index<0)throw new Error('교체할 파티원이 없습니다.');
 const next=root.party[index];if(next.hp<=0)throw new Error('살아 있는 파티원을 선택하세요.');
 const remaining=root.party.filter((_,i)=>i!==index);
 const shared=['inventory','gold','itemInstances','hiredOffers','mercRecruitment','mapId','pos','worldVersion','fieldBossKills','autoMode'];
 for(const key of shared){if(key in root)next[key]=root[key];delete root[key];}
 next.partySaveId=root.partySaveId || root.id;delete root.partySaveId;delete root.party;
 root.isMerc=true;next.isMerc=false;root.inventory=[];root.gold=0;
 remaining.splice(index,0,root);next.party=remaining;
 if(next.hotbar?.length!==8)next.hotbar=[...(next.skillSlots || []).filter(Boolean).map(e=>({type:'skill',id:e.id})),{type:'item',id:'red_potion'},{type:'item',id:'blue_potion'}].concat(Array(8).fill(null)).slice(0,8);
 return next;
}
