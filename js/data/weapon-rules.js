// Shared restrictions for equipment actions, stats and visible hand items.
export const WEAPON_TYPES={
 sword:{label:'한손검',classes:['knight']},axe:{label:'한손도끼',classes:['knight']},shield:{label:'방패',classes:['knight']},
 greatsword:{label:'양손검',classes:['warrior'],twoHanded:true},greataxe:{label:'양손도끼',classes:['warrior'],twoHanded:true},spear:{label:'양손창',classes:['warrior'],twoHanded:true},
 bow:{label:'활',classes:['elf'],twoHanded:true},shortbow:{label:'단궁',classes:['elf'],twoHanded:true},hornbow:{label:'각궁',classes:['elf'],twoHanded:true},
 staff:{label:'스태프',classes:['mage']},orb:{label:'오브',classes:['mage']},scripture:{label:'경전',classes:['priest'],twoHanded:true},
};
const legacy={training_sword:'sword',long_sword:'sword',steel_blade:'greatsword',training_axe:'greataxe',battle_axe:'greataxe',war_axe:'greataxe',training_bow:'bow',long_bow:'bow',elven_bow:'bow',training_staff:'staff',oak_staff:'staff',arcane_staff:'staff',training_mace:'scripture',iron_mace:'scripture',holy_mace:'scripture'};
export function weaponType(item,id=''){
 if(item.weaponType)return item.weaponType;
 if(legacy[item.baseId || id])return legacy[item.baseId || id];
 if(item.slot==='shield')return 'shield';
 if(item.type!=='weapon')return null;
 const group=item.group || '',name=item.source?.name || item.name;
 if(group.includes('단검') || group.includes('철퇴') || group.includes('전투망치') || group.includes('석궁') || group.includes('완드') || name.includes('새총') || name==='뼈 부수개')return 'unsupported';
 if(group.includes('마도서'))return 'scripture';
 if(group.includes('지팡이') || name.includes('지팡이'))return 'staff';
 if(group.includes('단궁'))return 'shortbow';
 if(group.includes('장궁') || name.includes('장궁'))return 'bow';
 if(group.includes('전투도끼') || name.includes('대도끼'))return 'greataxe';
 if(group.includes('대검'))return 'greatsword';
 if(group.includes('미늘창') || group.includes('창'))return 'spear';
 if(group.includes('도끼'))return 'axe';
 if(group.includes('검') || name.includes('기사검') || name.includes('비늘검'))return item.twoHanded?'greatsword':'sword';
 return 'unsupported';
}
export function applyWeaponRules(items){
 for(const [id,it] of Object.entries(items)){
  const kind=weaponType(it,id);if(!kind)continue;
  const rule=WEAPON_TYPES[kind];it.weaponType=kind;it.classes=rule?[...rule.classes]:[];
  it.twoHanded=!!rule?.twoHanded;
  if(['bow','shortbow','hornbow'].includes(kind))it.slot='ranged';
  if(kind==='orb')it.slot='shield';
 }
}
