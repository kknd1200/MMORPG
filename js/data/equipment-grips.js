// Grip coordinates are in the ORIGINAL icon cell, not its changing cropped bounds.
// All catalog blades point up-right: the wrapped handle is at the lower LEFT.
const profiles={
 sword:{grip:[16,47],tip:[51,8],reach:22},greatsword:{grip:[16,47],tip:[51,8],reach:28},
 axe:{grip:[20,44],tip:[43,16],reach:21},greataxe:{grip:[19,44],tip:[43,15],reach:27},
 spear:{grip:[24,36],tip:[52,7],reach:33},staff:{grip:[24,40],tip:[43,12],reach:28},
 bow:{grip:[26,34],tip:[26,5],reach:17},shortbow:{grip:[25,34],tip:[25,7],reach:14},hornbow:{grip:[27,33],tip:[27,6],reach:16},
 shield:{grip:[32,32],tip:[32,7],reach:9},scripture:{grip:[31,35],tip:[31,10],reach:6},orb:{grip:[32,51],tip:[32,8],reach:10},
};
export function equipmentGrip(item){
 const p=profiles[item.weaponType];if(!p)return null;
 const result={...p,grip:[...p.grip],tip:[...p.tip]};
 // Knight swords are the authored exception: blade down-left, grip up-right.
 if(item.atlas && item.name?.includes('기사검')){result.grip=[43,20];result.tip=[12,53];return result;}
 if(!item.atlas && !item.art){
  const legacy={sword:[[31,94],[97,13]],greatsword:[[31,94],[103,13]],axe:[[42,88],[87,25]],greataxe:[[42,88],[87,25]],staff:[[47,81],[87,21]],bow:[[43,70],[43,13]],shortbow:[[43,70],[43,13]]}[item.weaponType];
  if(legacy){result.grip=legacy[0];result.tip=legacy[1];}
 }
 return result;
}
