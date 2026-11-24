const definitions={
 knight:[['수호자의 갑주','방어력 +3',{def:3}],['전투 집중','명중률 +5%p',{accPct:.05}],['방패 숙련','막기 확률 +8%p',{block:.08}],['강인한 생명','자연 회복 시 최대 HP의 0.4% 추가 회복',{regen:.004}]],
 warrior:[['투사의 힘','공격력 +8%',{atkPct:.08}],['야성의 일격','치명타 확률 +5%p',{critRate:.05}],['피의 갈증','가한 피해의 3% 흡혈',{lifesteal:.03}],['불굴','받는 피해 5% 감소',{drPct:.05}]],
 elf:[['매의 눈','명중률 +6%p',{accPct:.06}],['급소 포착','치명타 확률 +5%p',{critRate:.05}],['숲의 발걸음','이동속도 +10%',{speed:.1}],['정밀 조준','치명타 추가 피해 +20%p',{critDmg:.2}]],
 mage:[['마력 숙련','공격력 +8%',{atkPct:.08}],['통찰','명중률 +6%p',{accPct:.06}],['원소 연구','공격 스킬 피해 +10%',{skillDmg:.1}],['시전 집중','스킬 재사용 시간 8% 감소',{cdr:.08}]],
 priest:[['신앙의 힘','공격 스킬 피해 +8%',{skillDmg:.08}],['회복의 기도','자연 회복 시 최대 HP의 0.6% 추가 회복',{regen:.006}],['수호의 은총','받는 피해 6% 감소',{drPct:.06}],['마나의 샘','자연 회복 시 MP +2 추가 회복',{mpRegen:2}]],
};
export const PASSIVES=Object.fromEntries(Object.entries(definitions).flatMap(([classId,list])=>list.map(([name,desc,effects],i)=>{const id=`${classId}_passive_${i+1}`;return [id,{id,classId,name,desc,effects,level:1}];})));
