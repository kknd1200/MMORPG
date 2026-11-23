// Original town characters supplied by the user; shared foot anchor and scale.
const ids=['child','guard','merchant','mage','smith','noble','farmer','herbalist','traveler','scout','paladin','priest','commander','captain','goblin_trader','orc_traveler'];
const heights=[299,340,340,330,325,340,333,333,272,340,289,340,339,340,280,270];
export const NPC_ART=Object.fromEntries(ids.map((id,i)=>[id,{col:i%4,row:Math.floor(i/4),height:heights[i],cellW:256,cellH:384,footY:366,centerX:128}]));
export function npcAppearance(kind,village){
 if(kind==='merchant')return village==='v3'?'goblin_trader':village==='v4'?'orc_traveler':'merchant';
 if(kind==='smith')return 'smith';
 if(kind==='healer')return village==='capital'?'priest':'herbalist';
 if(kind==='teleporter')return 'mage';
 if(kind==='mercenary')return village==='capital'?'commander':'captain';
 return village==='v1'?'child':'traveler';
}
export const NPC_RESIDENTS={
 capital:[['guard','성문 경비병',7,23,'성도 밖에는 위험한 사냥터가 있습니다. 세계지도에서 권장 레벨을 확인하세요.'],['noble','왕실 사절 레온',29,24,'이곳 새벽 성도에서 서부 마을, 남부 항구, 동부 요새, 북부 설원으로 향할 수 있습니다.'],['paladin','성도 수호기사',21,24,'성도 안은 안전합니다. 장비와 물약을 준비한 뒤 성문 밖으로 나가세요.'],['scout','정찰병 카이',17,22,'사냥터마다 동굴과 보스가 있습니다. 던전 위치는 세계지도에서 확인할 수 있습니다.']],
 v1:[['guard','마을 경비병',7,23,'마을은 안전합니다. 동쪽 길을 따라가면 성도로 갈 수 있습니다.'],['farmer','농부 로만',17,28,'들판에서 모험을 시작해 보세요. 북쪽 길은 바람골 마을로 이어집니다.']],
 v2:[['traveler','여행자 리오',21,24,'풍차가 보이는 길을 따라 이 마을에 도착했습니다. 새싹 마을 남쪽에는 협곡으로 가는 길이 있습니다.']],
 v3:[['orc_traveler','행상 오르만',21,24,'은물결 항구에는 먼 지역의 여행자와 상인이 모여듭니다.']],
 v4:[['guard','요새 경비병',21,24,'북쪽 사냥터는 위험합니다. 충분히 성장한 후에 도전하세요.']],
 v5:[['scout','설원 정찰병',21,24,'동쪽에는 별무리 성채로 이어지는 길이 있습니다.']],
 v6:[['paladin','별무리 수호기사',21,24,'성채 밖의 마지막 사냥터에는 강력한 적들이 기다립니다.']],
};
